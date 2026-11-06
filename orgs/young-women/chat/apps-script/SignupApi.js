/* Sign-up HTTP handler. Membership comes from the private ward list, never from
   the browser's demo persona. This file has no Apps Script or DOM calls, so the
   same checks run in Node tests and inside the Google script. */
(function (root, factory) {
  var api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.YWSignupApi = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  function rules() {
    if (!globalThis.YWSignups) throw new Error("Sign-up rules are not loaded.");
    return globalThis.YWSignups;
  }
  function clone(x) { return JSON.parse(JSON.stringify(x)); }
  function fail(error, message) { return { ok: false, error: error, message: message }; }
  function reply(status, body) { return { status: status, body: body }; }
  function emailOf(value) { return String(value || "").trim().toLowerCase(); }
  function validEmail(value) { return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(emailOf(value)); }

  function findMember(store, email) {
    var want = emailOf(email);
    var users = (store && store.users) || [];
    for (var i = 0; i < users.length; i++) {
      if (emailOf(users[i].email) === want) return users[i];
    }
    return null;
  }
  function kindFor(role) {
    if (role === "youth") return "youth";
    return "adult";
  }
  function publicMember(user) {
    return {
      id: user.id,
      name: user.name,
      role: user.role,
      classId: user.classId || null,
      status: user.status || "active"
    };
  }
  function stripContacts(value) {
    if (!value || typeof value !== "object") return value;
    if (Object.prototype.toString.call(value) === "[object Array]") return value.map(stripContacts);
    var out = {};
    Object.keys(value).forEach(function (key) {
      if (key === "email" || key === "phone" || key === "parentId" || key === "contact") return;
      out[key] = stripContacts(value[key]);
    });
    return out;
  }
  function present(store, member, now, options) {
    var view = rules().buildView(store, member.id, now, {
      roster: options.roster || null,
      classFilter: options.classFilter || "",
      reviewClassId: options.reviewClassId || "",
      demo: false,
      shared: true
    });
    view = stripContacts(view);
    view.version = store.signups ? store.signups.version : 0;
    return view;
  }
  function memberAdmin(store, member) {
    if (!rules().isPresidency(member)) return null;
    return (store.users || []).filter(function (user) { return !user.removed; }).map(function (user) {
      var row = publicMember(user);
      row.email = emailOf(user.email);
      return row;
    });
  }
  function blankStore(now) {
    return { users: [], signups: rules().createModel(now || new Date()) };
  }
  function countModerators(users, exceptId) {
    return (users || []).filter(function (user) {
      return user.id !== exceptId && user.role === "moderator" && user.kind !== "youth" && !user.removed && user.status !== "removed";
    }).length;
  }
  function applyMemberChange(store, body) {
    var next = clone(store);
    var users = next.users || (next.users = []);
    var role = body.role;
    var allowed = { youth: 1, adviser: 1, moderator: 1, bishopric: 1, parent: 1 };
    if (body.op === "add-member") {
      if (!validEmail(body.email)) return fail("validation", "Enter The Google Account Email.");
      if (findMember(next, body.email)) return fail("validation", "That Google Account Is Already On The List.");
      if (!body.name || String(body.name).trim().length < 2) return fail("validation", "Enter The Name To Show.");
      if (!allowed[role]) return fail("validation", "Choose A Role.");
      if (role === "youth" && !rules().CLASSES.some(function (c) { return c.id === body.classId; })) {
        return fail("validation", "Choose That Young Woman’s Class.");
      }
      users.push({
        id: body.id || ("m-" + Math.random().toString(36).slice(2, 10)),
        email: emailOf(body.email),
        name: String(body.name).trim().slice(0, 80),
        role: role,
        kind: kindFor(role),
        classId: body.classId || null,
        status: body.status || "active",
        childIds: role === "parent" ? (body.childIds || []) : []
      });
      return { ok: true, store: next, message: "Added To The Ward List." };
    }
    var current = null;
    for (var i = 0; i < users.length; i++) if (users[i].id === body.memberId) current = users[i];
    if (!current) return fail("validation", "That Person Is Not On The List.");
    if (current.role === "moderator" && role && role !== "moderator" && countModerators(users, current.id) < 1) {
      return fail("validation", "Keep At Least One Moderator.");
    }
    if (body.email) {
      if (!validEmail(body.email)) return fail("validation", "Enter The Google Account Email.");
      var other = findMember(next, body.email);
      if (other && other.id !== current.id) return fail("validation", "That Google Account Is Already On The List.");
      current.email = emailOf(body.email);
    }
    if (body.name) current.name = String(body.name).trim().slice(0, 80);
    if (allowed[role]) {
      current.role = role;
      current.kind = kindFor(role);
    }
    if (body.classId) current.classId = body.classId;
    if (body.status) current.status = body.status;
    if (body.status === "removed") current.removed = true;
    if (body.childIds) current.childIds = body.childIds;
    return { ok: true, store: next, message: "Ward List Updated." };
  }

  function handleSignupRequest(opts) {
    opts = opts || {};
    var body = opts.body || {};
    var now = opts.now || new Date();
    var options = {
      roster: opts.roster || null,
      classFilter: body.classFilter || "",
      reviewClassId: body.reviewClassId || ""
    };
    if (!body.idToken) return reply(401, fail("unauthorized", "Sign In With Google To Use Sign-Ups."));
    var identity;
    try { identity = opts.verifyToken(body.idToken); }
    catch (err) { return reply(401, fail("unauthorized", "Sign In Again.")); }
    var email = emailOf(identity && identity.email);
    if (!email) return reply(401, fail("unauthorized", "Sign In Again."));
    var store = opts.loadStore() || blankStore(now);
    if (!store.signups) store.signups = rules().createModel(now);
    if (!store.users) store.users = [];
    var member = findMember(store, email);
    if (!member || member.removed || member.status === "removed") {
      return reply(403, fail("not-member", "That Google Account Is Not On The Young Women List."));
    }
    if (body.op === "view") {
      return reply(200, { ok: true, view: present(store, member, now, options), members: memberAdmin(store, member) });
    }
    if (body.op === "add-member" || body.op === "update-member") {
      if (!rules().isPresidency(member)) return reply(403, fail("forbidden", "The Presidency Manages The Ward List."));
      var changed = applyMemberChange(store, body);
      if (!changed.ok) return reply(400, changed);
      opts.saveStore(changed.store);
      return reply(200, {
        ok: true,
        message: changed.message,
        view: present(changed.store, member, now, options),
        members: memberAdmin(changed.store, member)
      });
    }
    if (body.op === "mutate") {
      var action = clone(body.action || {});
      if (body.version != null) action.baseVersion = body.version;
      var result = rules().commitStored({
        load: function () { return opts.loadStore(); },
        save: function (next) { opts.saveStore(next); },
        actorId: member.id,
        action: action,
        now: now
      });
      if (!result.ok) {
        var status = result.error === "conflict" || result.error === "full" ? 409 : (result.error === "forbidden" || result.error === "not-member" ? 403 : 400);
        return reply(status, result);
      }
      return reply(200, {
        ok: true,
        message: result.message,
        view: present(result.store, member, now, options),
        members: memberAdmin(result.store, member)
      });
    }
    return reply(400, fail("validation", "That Action Is Not Available."));
  }

  return {
    handleSignupRequest: handleSignupRequest,
    blankStore: blankStore,
    emailOf: emailOf
  };
});
