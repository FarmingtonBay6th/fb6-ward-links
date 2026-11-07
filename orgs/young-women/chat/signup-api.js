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
      return publicMember(user);
    });
  }
  function blankStore(now) {
    return { users: [], links: [], signups: rules().createModel(now || new Date()) };
  }
  function linkAdmin(store, actor) {
    if (!rules().isLeader(actor)) return null;
    return (store.links || []).filter(function (link) {
      var person = findMemberById(store, link.memberId);
      return link.memberId === actor.id || canManageMember(actor, person);
    }).map(function (link) {
      return { id: link.id, memberId: link.memberId, status: link.status };
    });
  }
  function applyLinkChange(store, actor, body) {
    var next = clone(store);
    if (!next.links) next.links = [];
    if (body.op === "revoke-link") {
      var row = null;
      for (var i = 0; i < next.links.length; i++) if (next.links[i].id === body.linkId) row = next.links[i];
      if (!row) return fail("validation", "That Link Is Not There.");
      var person = findMemberById(next, row.memberId);
      if (row.memberId !== actor.id && !canManageMember(actor, person)) return fail("forbidden", "You Cannot Turn Off That Link.");
      row.status = "revoked";
      return { ok: true, store: next, message: "Private Link Turned Off." };
    }
    var target = findMemberById(next, body.memberId);
    if (!target) return fail("validation", "Choose A Person On The List.");
    if (!canManageMember(actor, target)) return fail("forbidden", "A Leader Makes Private Links.");
    var tokenHash = String(body.tokenHash || "");
    if (tokenHash.length < 32) return fail("validation", "The Link Could Not Be Created.");
    if (next.links.some(function (link) { return link.tokenHash === tokenHash; })) return fail("validation", "The Link Could Not Be Created.");
    next.links.push({
      id: "lk-" + Math.random().toString(36).slice(2, 10),
      memberId: target.id,
      tokenHash: tokenHash,
      status: "active",
      createdAt: new Date().toISOString()
    });
    return { ok: true, store: next, message: "Private Link Created. Copy It Now. It Is Not Shown Again." };
  }
  function countModerators(users, exceptId) {
    return (users || []).filter(function (user) {
      return user.id !== exceptId && user.role === "moderator" && user.kind !== "youth" && !user.removed && user.status !== "removed";
    }).length;
  }
  function hashesEqual(a, b) {
    if (!a || !b || a.length !== b.length) return false;
    var diff = 0;
    for (var i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
    return diff === 0;
  }
  function findActiveLink(store, hash) {
    var found = null;
    (store.links || []).forEach(function (link) {
      if (link.status === "active" && hashesEqual(link.tokenHash, hash)) found = link;
    });
    return found;
  }
  function findMemberById(store, id) {
    var users = store.users || [];
    for (var i = 0; i < users.length; i++) if (users[i].id === id) return users[i];
    return null;
  }
  function canManageMember(actor, target) {
    if (!target || target.removed) return false;
    if (rules().isPresidency(actor)) return true;
    return actor.role === "adviser" && target.kind === "youth" && target.classId && target.classId === actor.classId;
  }
  function applyMemberChange(store, actor, body) {
    var next = clone(store);
    var users = next.users || (next.users = []);
    var role = body.role;
    var allowed = { youth: 1, adviser: 1, moderator: 1, bishopric: 1, parent: 1 };
    if (body.op === "add-member") {
      if (!rules().isPresidency(actor) && !(actor.role === "adviser" && role === "youth" && body.classId === actor.classId)) {
        return fail("forbidden", "A Leader Adds People For The Classes They Serve.");
      }
      if (!body.name || String(body.name).trim().length < 2) return fail("validation", "Enter The Name To Show.");
      if (!allowed[role]) return fail("validation", "Choose A Role.");
      if ((role === "youth" || role === "adviser") && !rules().CLASSES.some(function (c) { return c.id === body.classId; })) {
        return fail("validation", "Choose A Class.");
      }
      if (!rules().isPresidency(actor) && role !== "youth") return fail("forbidden", "Only A Moderator Adds Leaders.");
      var status = body.status === "active" ? "active" : "pending";
      users.push({
        id: body.id || ("m-" + Math.random().toString(36).slice(2, 10)),
        name: String(body.name).trim().slice(0, 80),
        role: role,
        kind: kindFor(role),
        classId: body.classId || null,
        status: status,
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
    if (!canManageMember(actor, current)) return fail("forbidden", "A Leader Changes People For The Classes They Serve.");
    if (body.name) current.name = String(body.name).trim().slice(0, 80);
    if (allowed[role]) {
      if (!rules().isPresidency(actor) && role !== "youth") return fail("forbidden", "Only A Moderator Changes Leader Roles.");
      current.role = role;
      current.kind = kindFor(role);
    }
    if (body.classId && body.classId !== current.classId && !rules().isPresidency(actor)) {
      return fail("forbidden", "Only A Moderator Moves Someone To Another Class.");
    }
    if (body.classId) current.classId = body.classId;
    if (body.status) current.status = body.status;
    if (body.status === "removed") current.removed = true;
    if (body.childIds) current.childIds = body.childIds;
    return { ok: true, store: next, message: "Ward List Updated." };
  }

  function cleanDisplayName(value) {
    var name = String(value || "").replace(/\s+/g, " ").trim();
    if (name.length < 2 || name.length > 40) return "";
    if (/[<>@]/.test(name) || /https?:/i.test(name) || /www\./i.test(name)) return "";
    if (!/^[A-Za-z][A-Za-z .'-]*$/.test(name)) return "";
    return name;
  }
  function findEntry(model, id) {
    var entries = (model && model.entries) || [];
    for (var i = 0; i < entries.length; i++) if (entries[i].id === id) return entries[i];
    return null;
  }
  function findSlot(entry, id) {
    if (!entry) return null;
    for (var i = 0; i < entry.slots.length; i++) if (entry.slots[i].id === id) return entry.slots[i];
    return null;
  }
  function slotFilled(slot) { return !!(slot && (slot.userId || slot.displayName)); }
  function publicBoard(store, now) {
    var model = store.signups || rules().createModel(now);
    var today = rules().denverYmd(now);
    var entries = (model.entries || []).map(function (entry) {
      var type = null;
      (model.types || []).forEach(function (item) { if (item.id === entry.typeId) type = item; });
      var className = "Class";
      rules().CLASSES.forEach(function (item) { if (item.id === entry.classId) className = item.name; });
      return {
        id: entry.id,
        date: entry.date,
        className: className,
        task: type ? type.name : "Sign-Up",
        cancelled: !!entry.cancelled,
        spots: (entry.slots || []).map(function (slot) {
          return {
            id: slot.id,
            open: !slotFilled(slot) && !entry.cancelled && entry.date >= today,
            displayName: slot.displayName || "",
            version: slot.version || 0
          };
        })
      };
    }).sort(function (a, b) { return a.date < b.date ? -1 : a.date > b.date ? 1 : 0; });
    return {
      ok: true,
      rotationSet: !!(model.rotation && model.rotation.startMonth && model.rotation.startClassId),
      today: today,
      entries: entries
    };
  }
  function publicClaim(store, body, now) {
    var next = clone(store);
    var model = next.signups;
    var entry = findEntry(model, body.entryId);
    var slot = findSlot(entry, body.slotId);
    if (!entry || !slot) return fail("validation", "That Spot Is Not On The Sheet.");
    if (slot.version !== Number(body.expectedSlotVersion)) return fail("conflict", "Someone Else Just Took That Spot.");
    if (entry.cancelled) return fail("forbidden", "That Date Was Cancelled.");
    if (entry.date < rules().denverYmd(now)) return fail("forbidden", "That Date Has Passed.");
    if (slotFilled(slot)) return fail(entry.slots.some(function (item) { return !slotFilled(item); }) ? "conflict" : "full", slotFilled(slot) && entry.slots.some(function (item) { return !slotFilled(item); }) ? "Someone Else Just Took That Spot." : "Those Spots Are Full.");
    var name = cleanDisplayName(body.displayName);
    if (!name) return fail("validation", "Enter A Name, Up To 40 Letters.");
    var releaseHash = String(body.releaseHash || "");
    if (releaseHash.length < 32) return fail("validation", "Sign-Up Could Not Be Saved.");
    slot.displayName = name;
    slot.releaseHash = releaseHash;
    slot.version += 1;
    model.version = (model.version || 0) + 1;
    return { ok: true, store: next, message: "You’re Signed Up." };
  }
  function publicRelease(store, body) {
    var next = clone(store);
    var entry = findEntry(next.signups, body.entryId);
    var slot = findSlot(entry, body.slotId);
    if (!entry || !slot || !slot.displayName) return fail("validation", "That Sign-Up Is Not There.");
    var hash = body.releaseHash ? String(body.releaseHash) : "";
    if (!hash || !hashesEqual(hash, slot.releaseHash || "")) return fail("forbidden", "This Phone Cannot Remove That Sign-Up.");
    slot.displayName = "";
    slot.releaseHash = "";
    slot.version += 1;
    next.signups.version = (next.signups.version || 0) + 1;
    return { ok: true, store: next, message: "Removed From The Sheet." };
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
    var store = opts.loadStore() || blankStore(now);
    if (!store.signups) store.signups = rules().createModel(now);
    if (!store.users) store.users = [];
    if (!store.links) store.links = [];
    if (body.op === "public-view") {
      return reply(200, publicBoard(store, now));
    }
    if (body.op === "public-claim" || body.op === "public-release") {
      var pub = body.op === "public-claim" ? publicClaim(store, body, now) : publicRelease(store, body);
      if (!pub.ok) {
        var pubStatus = pub.error === "conflict" || pub.error === "full" ? 409 : (pub.error === "forbidden" ? 403 : 400);
        return reply(pubStatus, pub);
      }
      opts.saveStore(pub.store);
      var board = publicBoard(pub.store, now);
      board.message = pub.message;
      return reply(200, board);
    }
    var linkToken = String(body.linkToken || "");
    if (linkToken.length < 20 || !opts.hashToken) return reply(401, fail("unauthorized", "Open The Private Link A Leader Gave You."));
    var link = findActiveLink(store, opts.hashToken(linkToken));
    if (!link) return reply(401, fail("unauthorized", "This Private Link Does Not Work."));
    var member = findMemberById(store, link.memberId);
    if (!member || member.removed || member.status === "removed") {
      return reply(403, fail("not-member", "This Private Link Is Not On The List."));
    }
    function answer(result, status) {
      var bodyOut = {
        ok: true,
        message: result.message,
        view: present(result.store || store, member, now, options),
        members: memberAdmin(result.store || store, member),
        links: linkAdmin(result.store || store, member)
      };
      if (result.privateLink) bodyOut.privateLink = result.privateLink;
      return reply(status || 200, bodyOut);
    }
    if (body.op === "view") return answer({ store: store, message: "" });
    if (body.op === "add-member" || body.op === "update-member") {
      var changed = applyMemberChange(store, member, body);
      if (!changed.ok) return reply(changed.error === "forbidden" ? 403 : 400, changed);
      opts.saveStore(changed.store);
      return answer(changed);
    }
    if (body.op === "create-link" || body.op === "revoke-link") {
      var linked = applyLinkChange(store, member, body);
      if (!linked.ok) return reply(linked.error === "forbidden" ? 403 : 400, linked);
      opts.saveStore(linked.store);
      return answer(linked);
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
      return answer(result);
    }
    return reply(400, fail("validation", "That Action Is Not Available."));
  }

  return {
    handleSignupRequest: handleSignupRequest,
    blankStore: blankStore,
    emailOf: emailOf
  };
});
