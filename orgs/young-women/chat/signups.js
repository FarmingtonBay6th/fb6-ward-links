/* Young Women Sign-Ups
   Door Greeting and Lessons for each class. Greeting months rotate only after a
   leader sets the starting month and class. Lesson dates are a separate list.
   Every change goes through applyAction / commitStored, which re-read the user
   record. This file is the rules module for Demo Mode and for tests. It does
   not send messages or notifications. A prepared SQL migration lives beside it
   and is not applied. */
(function (root, factory) {
  var api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.YWSignups = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  var CLASSES = [
    { id: "gatherers", rosterId: "gatherers-of-light", name: "Gatherers of Light" },
    { id: "messengers", rosterId: "messengers-of-hope", name: "Messengers of Hope" },
    { id: "builders", rosterId: "builders-of-faith", name: "Builders of Faith" }
  ];

  var PAPER_SHEET = {
    status: "unapplied",
    source: "Handwritten class sheet. Dates are read as November and December 2026. The class and some spellings were not verified, so these rows are a review queue, not live assignments.",
    greetingDates: ["2026-11-01", "2026-11-08", "2026-11-15", "2026-11-22", "2026-11-29"],
    lessonDates: ["2026-11-08", "2026-11-15", "2026-11-22", "2026-12-06", "2026-12-13"],
    rows: [
      { key: "g-2026-11-01", schedule: "door-greeting", date: "2026-11-01", names: ["Brooke", "Brinley"] },
      { key: "g-2026-11-08", schedule: "door-greeting", date: "2026-11-08", names: ["Brooklin", "Kate"] },
      { key: "g-2026-11-15", schedule: "door-greeting", date: "2026-11-15", names: ["Brooklin", "Brooke", "Brynnlee"] },
      { key: "g-2026-11-22", schedule: "door-greeting", date: "2026-11-22", names: ["Brooke", "Kate"] },
      { key: "g-2026-11-29", schedule: "door-greeting", date: "2026-11-29", names: ["Brinley"] },
      { key: "l-2026-11-08", schedule: "lesson", date: "2026-11-08", names: [], note: "Teaching column was blank." },
      { key: "l-2026-11-15", schedule: "lesson", date: "2026-11-15", names: ["Kate"] },
      { key: "l-2026-11-22", schedule: "lesson", date: "2026-11-22", names: ["Brooke"] },
      { key: "l-2026-12-06", schedule: "lesson", date: "2026-12-06", names: ["Brinley"] },
      { key: "l-2026-12-13", schedule: "lesson", date: "2026-12-13", names: [], cancelled: true, note: "Crossed out on the sheet." }
    ]
  };

  function clone(x) { return JSON.parse(JSON.stringify(x)); }
  function pad(n) { return (n < 10 ? "0" : "") + n; }
  function fail(error, message) { return { ok: false, error: error, message: message }; }
  function ok(store, message) { return { ok: true, store: store, message: message }; }

  function classById(id) {
    for (var i = 0; i < CLASSES.length; i++) if (CLASSES[i].id === id) return CLASSES[i];
    return null;
  }
  function className(id) {
    var c = classById(id);
    return c ? c.name : "Class";
  }
  function chatClassForRoster(rosterId) {
    for (var i = 0; i < CLASSES.length; i++) if (CLASSES[i].rosterId === rosterId) return CLASSES[i].id;
    return null;
  }

  function denverYmd(now) {
    var parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/Denver", year: "numeric", month: "2-digit", day: "2-digit"
    }).formatToParts(now);
    var y, m, d;
    for (var i = 0; i < parts.length; i++) {
      if (parts[i].type === "year") y = parts[i].value;
      if (parts[i].type === "month") m = parts[i].value;
      if (parts[i].type === "day") d = parts[i].value;
    }
    return y + "-" + m + "-" + d;
  }
  function utcNoon(ymd) {
    var p = String(ymd).split("-");
    return new Date(Date.UTC(+p[0], +p[1] - 1, +p[2], 12, 0, 0));
  }
  function ymdFromUtc(date) {
    return date.getUTCFullYear() + "-" + pad(date.getUTCMonth() + 1) + "-" + pad(date.getUTCDate());
  }
  function addDays(ymd, days) {
    var d = utcNoon(ymd);
    d.setUTCDate(d.getUTCDate() + days);
    return ymdFromUtc(d);
  }
  function upcomingSunday(now) {
    var ymd = denverYmd(now);
    var day = utcNoon(ymd).getUTCDay();
    return addDays(ymd, day === 0 ? 0 : 7 - day);
  }
  function isYmd(value) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value || "")) return false;
    var d = utcNoon(value);
    return ymdFromUtc(d) === value;
  }
  function isYm(value) { return /^\d{4}-\d{2}$/.test(value || "") && +value.slice(5) >= 1 && +value.slice(5) <= 12; }
  function monthIndex(ym) { return (+ym.slice(0, 4)) * 12 + (+ym.slice(5) - 1); }
  function ymFromIndex(index) {
    var year = Math.floor(index / 12);
    var month = index % 12;
    if (month < 0) { month += 12; year -= 1; }
    return year + "-" + pad(month + 1);
  }
  function formatLong(ymd) {
    return utcNoon(ymd).toLocaleDateString("en-US", {
      timeZone: "UTC", weekday: "long", month: "short", day: "numeric", year: "numeric"
    });
  }
  function formatMonth(ym) {
    return utcNoon(ym + "-01").toLocaleDateString("en-US", { timeZone: "UTC", month: "long", year: "numeric" });
  }
  function esc(t) {
    return String(t == null ? "" : t).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  function findUser(store, id) {
    var users = (store && store.users) || [];
    for (var i = 0; i < users.length; i++) if (users[i].id === id) return users[i];
    return null;
  }
  function isPresidency(user) {
    return !!(user && !user.removed && user.kind !== "youth" && (user.role === "moderator" || user.role === "bishopric"));
  }
  function isLeader(user) {
    return isPresidency(user) || !!(user && !user.removed && user.kind !== "youth" && user.role === "adviser");
  }
  function managedClassIds(user) {
    if (isPresidency(user)) return CLASSES.map(function (c) { return c.id; });
    if (user && user.role === "adviser" && !user.removed && user.kind !== "youth") {
      return user.classId ? [user.classId] : CLASSES.map(function (c) { return c.id; });
    }
    return [];
  }
  function viewClassIds(store, user) {
    var managed = managedClassIds(user);
    if (managed.length) return managed;
    if (user && user.role === "parent" && !user.removed) {
      var ids = {};
      (user.childIds || []).forEach(function (id) {
        var child = findUser(store, id);
        if (child && child.classId && !child.removed) ids[child.classId] = true;
      });
      (store.users || []).forEach(function (u) {
        if (u.parentId === user.id && u.classId && !u.removed) ids[u.classId] = true;
      });
      return Object.keys(ids);
    }
    if (user && user.kind === "youth" && !user.removed && user.classId &&
      (user.status === "active" || user.status === "muted")) return [user.classId];
    return [];
  }
  function displayName(user) { return user && user.name ? String(user.name) : "Young Woman"; }
  function publicUser(user) { return user ? { id: user.id, name: displayName(user), status: user.status || "" } : null; }

  function classYouth(store, classId) {
    return (store.users || []).filter(function (u) {
      return u.kind === "youth" && u.classId === classId && !u.removed &&
        (u.status === "active" || u.status === "muted");
    }).map(publicUser).sort(function (a, b) { return a.name < b.name ? -1 : a.name > b.name ? 1 : 0; });
  }

  function defaultTypes() {
    return [
      { id: "door-greeting", name: "Door Greeting", mode: "rotation", defaultCapacity: 4 },
      { id: "lesson", name: "Lessons", mode: "per-class", defaultCapacity: 1 }
    ];
  }
  function typeById(model, id) {
    var types = model.types || [];
    for (var i = 0; i < types.length; i++) if (types[i].id === id) return types[i];
    return null;
  }
  function slot(entryId, n) { return { id: entryId + ":" + n, userId: null, version: 0 }; }
  function makeSlots(entryId, capacity) {
    var slots = [];
    for (var i = 1; i <= capacity; i++) slots.push(slot(entryId, i));
    return slots;
  }
  function blankModel() {
    return {
      schema: 2,
      version: 0,
      rotation: { startMonth: null, startClassId: null, classOrder: ["gatherers", "messengers", "builders"] },
      types: defaultTypes(),
      entries: [],
      review: { status: "unapplied", appliedKeys: [] }
    };
  }
  function pushEntry(model, typeId, classId, date, capacity) {
    var id = typeId + ":" + classId + ":" + date;
    model.entries.push({
      id: id, typeId: typeId, classId: classId, date: date, capacity: capacity,
      cancelled: false, exception: false, topic: "", slots: makeSlots(id, capacity)
    });
  }
  function createModel(now) {
    var model = blankModel();
    var start = upcomingSunday(now || new Date());
    var lesson = typeById(model, "lesson");
    for (var c = 0; c < CLASSES.length; c++) {
      for (var i = 0; i < 8; i++) pushEntry(model, "lesson", CLASSES[c].id, addDays(start, i * 7), lesson.defaultCapacity);
    }
    return model;
  }
  function ensureModel(signups, now) {
    if (signups && signups.schema === 2 && Array.isArray(signups.entries) && signups.rotation && Array.isArray(signups.types)) {
      if (typeof signups.version !== "number") signups.version = 0;
      if (!signups.review) signups.review = { status: "unapplied", appliedKeys: [] };
      return signups;
    }
    var model = createModel(now || new Date());
    model.migration = {
      from: Array.isArray(signups) ? "legacy-rows" : "empty",
      legacyRowsIgnored: Array.isArray(signups) ? signups.length : 0,
      greetingClassGuessed: false,
      note: "Older ward-wide greeter rows had no class, so they were not copied and no class was guessed."
    };
    return model;
  }

  function classForMonth(rotation, ym) {
    if (!rotation || !isYm(rotation.startMonth) || !rotation.startClassId) return null;
    var order = rotation.classOrder || [];
    var startIdx = order.indexOf(rotation.startClassId);
    if (startIdx < 0 || !isYm(ym)) return null;
    var diff = monthIndex(ym) - monthIndex(rotation.startMonth);
    var idx = (startIdx + diff) % order.length;
    if (idx < 0) idx += order.length;
    return order[idx];
  }
  function validOrder(order) {
    if (!order || order.length !== CLASSES.length) return false;
    var seen = {};
    for (var i = 0; i < order.length; i++) {
      if (!classById(order[i]) || seen[order[i]]) return false;
      seen[order[i]] = true;
    }
    return true;
  }
  function nextSlotNumber(entry) {
    var max = 0;
    (entry.slots || []).forEach(function (s) {
      var n = +(String(s.id).split(":").pop());
      if (n > max) max = n;
    });
    return max + 1;
  }
  function findEntry(model, id) {
    for (var i = 0; i < model.entries.length; i++) if (model.entries[i].id === id) return model.entries[i];
    return null;
  }
  function findSlot(entry, id) {
    for (var i = 0; i < entry.slots.length; i++) if (entry.slots[i].id === id) return entry.slots[i];
    return null;
  }
  function userOnEntry(entry, userId) {
    if (!userId) return false;
    for (var i = 0; i < entry.slots.length; i++) if (entry.slots[i].userId === userId) return true;
    return false;
  }
  function entryByKey(model, typeId, classId, date) {
    var id = typeId + ":" + classId + ":" + date;
    return findEntry(model, id);
  }
  function addEntry(model, type, classId, date, capacity, exception) {
    var existing = entryByKey(model, type.id, classId, date);
    if (existing) return existing;
    var id = type.id + ":" + classId + ":" + date;
    var entry = {
      id: id, typeId: type.id, classId: classId, date: date,
      capacity: capacity, cancelled: false, exception: !!exception, topic: "",
      slots: makeSlots(id, capacity)
    };
    model.entries.push(entry);
    return entry;
  }
  function sundaysThrough(startYmd, endYm) {
    var out = [];
    var ymd = startYmd;
    while (ymd.slice(0, 7) <= endYm && out.length < 40) {
      out.push(ymd);
      ymd = addDays(ymd, 7);
    }
    return out;
  }
  function fillGreetingDates(model, now) {
    var rotation = model.rotation;
    if (!classForMonth(rotation, denverYmd(now).slice(0, 7))) return 0;
    var type = typeById(model, "door-greeting");
    if (!type) return 0;
    var end = ymFromIndex(monthIndex(denverYmd(now).slice(0, 7)) + 5);
    var added = 0;
    sundaysThrough(upcomingSunday(now), end).forEach(function (date) {
      var classId = classForMonth(rotation, date.slice(0, 7));
      if (!classId) return;
      if (!entryByKey(model, type.id, classId, date)) {
        addEntry(model, type, classId, date, type.defaultCapacity, false);
        added++;
      }
    });
    return added;
  }
  function fillLessonDates(model, classId, now) {
    var type = typeById(model, "lesson");
    if (!type || !classById(classId)) return 0;
    var start = upcomingSunday(now);
    var added = 0;
    for (var i = 0; i < 8; i++) {
      var date = addDays(start, i * 7);
      if (!entryByKey(model, "lesson", classId, date)) {
        addEntry(model, type, classId, date, type.defaultCapacity, false);
        added++;
      }
    }
    return added;
  }

  function firstToken(value) { return String(value || "").trim().split(/\s+/)[0]; }
  function letters(value) { return firstToken(value).toLowerCase().replace(/[^a-z]/g, ""); }
  function editDistance(a, b) {
    var dp = [];
    for (var i = 0; i <= a.length; i++) {
      dp[i] = [i];
      for (var j = 1; j <= b.length; j++) {
        if (i === 0) dp[0][j] = j;
        else {
          var cost = a.charAt(i - 1) === b.charAt(j - 1) ? 0 : 1;
          dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost);
        }
      }
    }
    return dp[a.length][b.length];
  }
  function rosterYouth(roster) {
    var out = [];
    ((roster && roster.classes) || []).forEach(function (c) {
      var names = [];
      (c.presidency || []).forEach(function (p) { if (p && p.name) names.push(p.name); });
      (c.members || []).forEach(function (n) { if (n) names.push(n); });
      names.forEach(function (n) {
        out.push({ name: n, rosterId: c.id, className: c.name, chatClassId: chatClassForRoster(c.id) });
      });
    });
    return out;
  }
  function chatYouth(users) {
    return (users || []).filter(function (u) { return u && u.kind === "youth" && !u.removed; });
  }
  function paperNameItems() {
    var items = [];
    PAPER_SHEET.rows.forEach(function (row) {
      (row.names || []).forEach(function (name, index) {
        items.push({
          nameKey: row.key + "#" + index,
          rowKey: row.key,
          schedule: row.schedule,
          date: row.date,
          handwritten: name
        });
      });
    });
    return items;
  }
  function paperItem(nameKey) {
    var items = paperNameItems();
    for (var i = 0; i < items.length; i++) if (items[i].nameKey === nameKey) return items[i];
    return null;
  }
  function suggestName(handwritten, roster, users) {
    var token = letters(handwritten);
    var exact = rosterYouth(roster).filter(function (r) { return letters(r.name) === token; });
    var variants = [];
    if (!exact.length && token.length >= 6) {
      variants = rosterYouth(roster).filter(function (r) {
        var other = letters(r.name);
        return other && other !== token && editDistance(token, other) === 1;
      });
    }
    var chats = chatYouth(users).filter(function (u) { return letters(u.name) === token; }).map(publicUser);
    var status = "none";
    if (exact.length === 1) status = "unique";
    else if (exact.length > 1 || variants.length) status = "ambiguous";
    return {
      handwritten: handwritten,
      status: status,
      needsConfirm: true,
      autoApply: false,
      spelling: !exact.length && variants.length > 0,
      rosterMatches: exact,
      spellingVariants: variants,
      chatUsers: chats
    };
  }
  function suggestSheetClass(roster) {
    var counts = {};
    var counted = 0;
    paperNameItems().forEach(function (item) {
      var matches = rosterYouth(roster).filter(function (r) { return letters(r.name) === letters(item.handwritten); });
      var ids = [];
      matches.forEach(function (m) { if (m.chatClassId && ids.indexOf(m.chatClassId) < 0) ids.push(m.chatClassId); });
      if (ids.length === 1) {
        counts[ids[0]] = (counts[ids[0]] || 0) + 1;
        counted++;
      }
    });
    var likely = null;
    var best = 0;
    Object.keys(counts).forEach(function (id) {
      if (counts[id] > best) { best = counts[id]; likely = id; }
    });
    return {
      status: "unverified",
      verified: false,
      likelyClassId: likely,
      likelyClassName: likely ? className(likely) : null,
      exactNameCount: counted,
      reason: likely
        ? "Every exact name match is in " + className(likely) + ". Brooklin does not match one stored spelling. This does not verify the sheet's class."
        : "Existing class lists do not verify which class this sheet belongs to."
    };
  }
  function suggestMatches(roster, users) {
    return paperNameItems().map(function (item) {
      var suggestion = suggestName(item.handwritten, roster, users);
      suggestion.nameKey = item.nameKey;
      suggestion.date = item.date;
      suggestion.schedule = item.schedule;
      return suggestion;
    });
  }

  function bump(model) { model.version += 1; }
  function requireFresh(model, action) {
    if (!action || action.baseVersion !== model.version) {
      return fail("conflict", "Someone Else Just Updated Sign-Ups. Look Again And Retry.");
    }
    return null;
  }
  function manages(user, classId) { return managedClassIds(user).indexOf(classId) >= 0; }
  function slotStale(entry, slotRec, action) {
    var expectedUser = action.expectedUserId || null;
    if ((slotRec.userId || null) !== expectedUser) {
      if (slotRec.userId && !expectedUser) {
        var anyOpen = (entry.slots || []).some(function (s) { return !s.userId; });
        return anyOpen
          ? fail("conflict", "That Spot Was Just Taken.")
          : fail("full", "Those Spots Are Full.");
      }
      return fail("conflict", "Someone Else Just Updated That Spot. Look Again And Retry.");
    }
    if (slotRec.version !== Number(action.expectedSlotVersion)) {
      return fail("conflict", "Someone Else Just Updated That Spot. Look Again And Retry.");
    }
    return null;
  }

  function applyAction(store, actorId, action, now) {
    now = now || new Date();
    action = action || {};
    var today = denverYmd(now);
    if (!store || !store.signups) return fail("validation", "Sign-Ups Are Not Ready.");
    var next = clone(store);
    next.signups = ensureModel(next.signups, now);
    var model = next.signups;
    var stale = requireFresh(model, action);
    if (stale) return stale;
    var actor = findUser(next, actorId);
    if (!actor || actor.removed) return fail("not-member", "That Account Is Not On The Ward Young Women List.");

    function touch(message) { bump(model); return ok(next, message); }

    if (action.type === "claim") {
      if (!(actor.kind === "youth" && actor.status === "active")) {
        return fail("forbidden", "Active Young Women Can Sign Up. Leaders Use Assign.");
      }
      var entry = findEntry(model, action.entryId);
      var spot = entry && findSlot(entry, action.slotId);
      if (!entry || !spot) return fail("validation", "That Spot Is No Longer There.");
      if (actor.classId !== entry.classId) return fail("forbidden", "You Can Only Sign Up For Your Own Class.");
      if (entry.date < today) return fail("forbidden", "That Date Has Passed.");
      if (entry.cancelled) return fail("forbidden", "This Date Was Cancelled.");
      var raced = slotStale(entry, spot, action);
      if (raced) return raced;
      if (spot.userId) return fail("conflict", "That Spot Was Just Taken.");
      if (userOnEntry(entry, actor.id)) return fail("validation", "You Already Have A Spot On This Date.");
      spot.userId = actor.id;
      spot.version += 1;
      return touch("You’re Signed Up. Thank You!");
    }

    if (action.type === "release" || action.type === "assign") {
      var targetEntry = findEntry(model, action.entryId);
      var targetSlot = targetEntry && findSlot(targetEntry, action.slotId);
      if (!targetEntry || !targetSlot) return fail("validation", "That Spot Is No Longer There.");
      var racedSlot = slotStale(targetEntry, targetSlot, action);
      if (racedSlot) return racedSlot;
      if (action.type === "release") {
        var leaderRelease = isLeader(actor) && manages(actor, targetEntry.classId);
        if (!leaderRelease) {
          if (!(actor.kind === "youth" && actor.status === "active" && targetSlot.userId === actor.id)) {
            return fail("forbidden", "You Can Release Only Your Own Spot.");
          }
          if (targetEntry.date < today) return fail("forbidden", "Past Dates Stay As They Are.");
        }
        targetSlot.userId = null;
        targetSlot.version += 1;
        return touch("Released.");
      }
      if (!isLeader(actor) || !manages(actor, targetEntry.classId)) {
        return fail("forbidden", "A Leader For This Class Can Assign Spots.");
      }
      var chosen = action.userId || null;
      if (chosen) {
        var youth = findUser(next, chosen);
        if (!youth || youth.removed || youth.kind !== "youth" || youth.classId !== targetEntry.classId ||
          (youth.status !== "active" && youth.status !== "muted")) {
          return fail("forbidden", "Choose A Young Woman In This Class.");
        }
        if (userOnEntry(targetEntry, chosen) && targetSlot.userId !== chosen) {
          return fail("validation", "That Young Woman Is Already On This Date.");
        }
      }
      targetSlot.userId = chosen;
      targetSlot.version += 1;
      return touch(chosen ? "Assigned." : "Spot Cleared.");
    }

    if (action.type === "set-rotation") {
      if (!isPresidency(actor)) return fail("forbidden", "The Presidency Sets The Greeting Rotation.");
      if (!isYm(action.startMonth) || !classById(action.startClassId) || !validOrder(action.classOrder)) {
        return fail("validation", "Choose A Starting Month, A Starting Class, And All Three Classes.");
      }
      model.rotation.startMonth = action.startMonth;
      model.rotation.startClassId = action.startClassId;
      model.rotation.classOrder = action.classOrder.slice();
      var added = fillGreetingDates(model, now);
      bump(model);
      return ok(next, added ? "Greeting Rotation Saved. Empty Sundays Were Added." : "Greeting Rotation Saved.");
    }

    if (action.type === "fill-greetings") {
      if (!isPresidency(actor)) return fail("forbidden", "The Presidency Adds Greeting Sundays.");
      if (!model.rotation.startMonth || !model.rotation.startClassId) {
        return fail("validation", "Set The Greeting Rotation First. The Class Is Not Guessed.");
      }
      var greetAdded = fillGreetingDates(model, now);
      if (!greetAdded) return fail("validation", "Greeting Sundays Are Already Posted.");
      return touch("Greeting Sundays Added.");
    }

    if (action.type === "fill-lessons") {
      if (!isLeader(actor) || !manages(actor, action.classId)) return fail("forbidden", "A Leader For This Class Can Add Lesson Dates.");
      var lessonAdded = fillLessonDates(model, action.classId, now);
      if (!lessonAdded) return fail("validation", "Lesson Sundays Are Already Posted.");
      return touch("Lesson Sundays Added.");
    }

    if (action.type === "add-date") {
      var addType = typeById(model, action.typeId);
      if (!addType) return fail("validation", "Choose An Assignment Type.");
      if (!isLeader(actor) || !manages(actor, action.classId)) return fail("forbidden", "A Leader For This Class Can Add Dates.");
      if (!isYmd(action.date)) return fail("validation", "Choose A Real Date.");
      var cap = +action.capacity;
      if (!(cap >= 1 && cap <= 12)) return fail("validation", "Capacity Must Be From 1 To 12.");
      if (entryByKey(model, addType.id, action.classId, action.date)) return fail("validation", "That Date Is Already There.");
      if (addType.mode === "rotation") {
        var monthClass = classForMonth(model.rotation, action.date.slice(0, 7));
        if (monthClass !== action.classId && !action.exception) {
          return fail("validation", monthClass
            ? "That Class Does Not Greet In This Month. Mark An Exception Or Change The Rotation."
            : "Set The Greeting Rotation Or Mark An Exception. The Class Is Not Guessed.");
        }
      }
      var created = addEntry(model, addType, action.classId, action.date, cap, addType.mode === "rotation" && !!action.exception);
      created.capacity = cap;
      return touch("Date Added.");
    }

    if (action.type === "set-capacity") {
      var capEntry = findEntry(model, action.entryId);
      if (!capEntry) return fail("validation", "That Date Is No Longer There.");
      if (!isLeader(actor) || !manages(actor, capEntry.classId)) return fail("forbidden", "A Leader For This Class Can Change Capacity.");
      var nextCap = +action.capacity;
      if (!(nextCap >= 1 && nextCap <= 12)) return fail("validation", "Capacity Must Be From 1 To 12.");
      if (nextCap === capEntry.slots.length) return ok(next, "Capacity Unchanged.");
      if (nextCap > capEntry.slots.length) {
        var n = nextSlotNumber(capEntry);
        while (capEntry.slots.length < nextCap) capEntry.slots.push(slot(capEntry.id, n++));
      } else {
        for (var i = nextCap; i < capEntry.slots.length; i++) {
          if (capEntry.slots[i].userId) return fail("validation", "Clear A Spot Before Lowering Capacity.");
        }
        capEntry.slots = capEntry.slots.slice(0, nextCap);
      }
      capEntry.capacity = nextCap;
      return touch("Capacity Saved.");
    }

    if (action.type === "remove-date" || action.type === "cancel-date" || action.type === "restore-date") {
      var dateEntry = findEntry(model, action.entryId);
      if (!dateEntry) return fail("validation", "That Date Is No Longer There.");
      if (!isLeader(actor) || !manages(actor, dateEntry.classId)) return fail("forbidden", "A Leader For This Class Can Change Dates.");
      if (action.type === "remove-date") {
        if (dateEntry.slots.some(function (s) { return s.userId; })) return fail("validation", "Clear Sign-Ups Before Removing This Date.");
        model.entries = model.entries.filter(function (e) { return e.id !== dateEntry.id; });
        return touch("Date Removed.");
      }
      dateEntry.cancelled = action.type === "cancel-date";
      return touch(dateEntry.cancelled ? "Date Cancelled." : "Date Restored.");
    }

    if (action.type === "set-topic") {
      var topicEntry = findEntry(model, action.entryId);
      if (!topicEntry) return fail("validation", "That Date Is No Longer There.");
      if (!isLeader(actor) || !manages(actor, topicEntry.classId)) return fail("forbidden", "A Leader For This Class Can Edit The Topic.");
      topicEntry.topic = String(action.topic || "").trim().slice(0, 120);
      return touch("Topic Saved.");
    }

    if (action.type === "add-type") {
      if (!isPresidency(actor)) return fail("forbidden", "The Presidency Can Add Assignment Types.");
      var name = String(action.name || "").trim().replace(/\s+/g, " ");
      if (name.length < 2 || name.length > 40) return fail("validation", "Give The Assignment Type A Short Name.");
      if (action.mode !== "per-class" && action.mode !== "rotation") return fail("validation", "Choose Per Class Or Greeting Rotation.");
      var typeCap = +action.capacity;
      if (!(typeCap >= 1 && typeCap <= 12)) return fail("validation", "Capacity Must Be From 1 To 12.");
      var slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
      if (!slug || typeById(model, slug) || model.types.some(function (t) { return t.name.toLowerCase() === name.toLowerCase(); })) {
        return fail("validation", "That Assignment Type Already Exists.");
      }
      model.types.push({ id: slug, name: name, mode: action.mode, defaultCapacity: typeCap });
      return touch("Assignment Type Added.");
    }

    if (action.type === "apply-review") {
      if (!isLeader(actor) || !manages(actor, action.classId)) return fail("forbidden", "A Leader For The Reviewed Class Can Apply Confirmed Rows.");
      if (!classById(action.classId)) return fail("validation", "Choose The Class After Review.");
      if (action.setRotation && !isPresidency(actor)) return fail("forbidden", "The Presidency Sets The Greeting Rotation.");
      var assignments = action.assignments || [];
      var cancellations = action.cancellations || [];
      if (!assignments.length && !cancellations.length && !action.setRotation) {
        return fail("validation", "Nothing Confirmed Yet. Live Sign-Ups Were Left Unchanged.");
      }
      for (var a = 0; a < assignments.length; a++) {
        var item = paperItem(assignments[a].nameKey);
        if (!item || assignments[a].reviewed !== true || !assignments[a].userId) {
          return fail("validation", "Confirm Each Row And Choose A Young Woman. Names Are Not Applied On Their Own.");
        }
        if (cancellations.indexOf(item.rowKey) >= 0) return fail("validation", "A Cancelled Date Cannot Also Be Assigned.");
        var picked = findUser(next, assignments[a].userId);
        if (!picked || picked.kind !== "youth" || picked.classId !== action.classId || picked.removed ||
          (picked.status !== "active" && picked.status !== "muted")) {
          return fail("forbidden", "Confirmed Names Must Be Young Women In The Reviewed Class.");
        }
      }
      for (var k = 0; k < cancellations.length; k++) {
        var cancelRow = null;
        for (var r = 0; r < PAPER_SHEET.rows.length; r++) if (PAPER_SHEET.rows[r].key === cancellations[k]) cancelRow = PAPER_SHEET.rows[r];
        if (!cancelRow || !cancelRow.cancelled) return fail("validation", "Only The Crossed-Out Date Can Be Recorded As Cancelled.");
      }
      if (action.setRotation) {
        if (!isYm(action.setRotation.startMonth) || action.setRotation.startClassId !== action.classId) {
          return fail("validation", "The Rotation Must Start With The Reviewed Class And A Real Month.");
        }
        model.rotation.startMonth = action.setRotation.startMonth;
        model.rotation.startClassId = action.classId;
        if (!validOrder(model.rotation.classOrder)) model.rotation.classOrder = ["gatherers", "messengers", "builders"];
      }
      assignments.forEach(function (decision) {
        var paper = paperItem(decision.nameKey);
        var t = typeById(model, paper.schedule);
        var monthClass = classForMonth(model.rotation, paper.date.slice(0, 7));
        var exception = t.mode === "rotation" && monthClass !== action.classId;
        var entryRec = addEntry(model, t, action.classId, paper.date, t.defaultCapacity, exception);
        if (entryRec.slots.length < t.defaultCapacity && t.mode === "rotation") {
          var startN = nextSlotNumber(entryRec);
          while (entryRec.slots.length < t.defaultCapacity) entryRec.slots.push(slot(entryRec.id, startN++));
          entryRec.capacity = entryRec.slots.length;
        }
        if (!userOnEntry(entryRec, decision.userId)) {
          var open = null;
          for (var s = 0; s < entryRec.slots.length; s++) if (!entryRec.slots[s].userId) { open = entryRec.slots[s]; break; }
          if (!open) {
            var extra = nextSlotNumber(entryRec);
            open = slot(entryRec.id, extra);
            entryRec.slots.push(open);
            entryRec.capacity = entryRec.slots.length;
          }
          open.userId = decision.userId;
          open.version += 1;
        }
        if (model.review.appliedKeys.indexOf(decision.nameKey) < 0) model.review.appliedKeys.push(decision.nameKey);
      });
      cancellations.forEach(function (key) {
        var row = null;
        for (var i = 0; i < PAPER_SHEET.rows.length; i++) if (PAPER_SHEET.rows[i].key === key) row = PAPER_SHEET.rows[i];
        var lessonType = typeById(model, row.schedule);
        var cancelledEntry = addEntry(model, lessonType, action.classId, row.date, lessonType.defaultCapacity, false);
        cancelledEntry.cancelled = true;
        if (model.review.appliedKeys.indexOf(key) < 0) model.review.appliedKeys.push(key);
      });
      if (action.setRotation) fillGreetingDates(model, now);
      model.review.status = "partial";
      return touch("Confirmed Rows Applied. Unconfirmed Names Were Left Off.");
    }

    return fail("validation", "That Action Is Not Available.");
  }

  function commitStored(opts) {
    opts = opts || {};
    var current = opts.load();
    if (!current.signups || current.signups.schema !== 2) current.signups = ensureModel(current.signups, opts.now || new Date());
    if (opts.action && opts.action.baseVersion != null && opts.action.baseVersion !== current.signups.version) {
      return fail("conflict", "Someone Else Just Updated Sign-Ups. Look Again And Retry.");
    }
    var action = clone(opts.action || {});
    action.baseVersion = current.signups.version;
    var result = applyAction(current, opts.actorId, action, opts.now || new Date());
    if (!result.ok) return result;
    var again = opts.load();
    if (!again.signups || again.signups.version !== current.signups.version) {
      return fail("conflict", "Someone Else Just Updated Sign-Ups. Look Again And Retry.");
    }
    opts.save(result.store);
    return result;
  }

  function yourNextGreeting(rotation, classId, ym) {
    if (!classId || !classForMonth(rotation, ym)) return null;
    for (var i = 0; i < 12; i++) {
      var check = ymFromIndex(monthIndex(ym) + i);
      if (classForMonth(rotation, check) === classId) return check;
    }
    return null;
  }

  function buildView(store, actorId, now, options) {
    now = now || new Date();
    options = options || {};
    var today = denverYmd(now);
    var sunday = upcomingSunday(now);
    var actor = findUser(store, actorId);
    if (!actor || actor.removed) {
      return { allowed: false, message: "Sign-Ups Are For The Ward Young Women List." };
    }
    var visible = viewClassIds(store, actor);
    var managed = managedClassIds(actor);
    if (!visible.length) {
      return {
        allowed: false,
        message: actor.kind === "youth"
          ? "Finish Joining Before You Sign Up."
          : "Sign-Ups For Your Young Women’s Class Will Show Here."
      };
    }
    var model = ensureModel(clone(store && store.signups ? store.signups : null), now);
    var filter = options.classFilter && visible.indexOf(options.classFilter) >= 0 ? options.classFilter : "";
    var classes = visible.map(classById).filter(Boolean);
    var month = today.slice(0, 7);
    var greetingClass = classForMonth(model.rotation, month);
    var personalClass = actor.classId && visible.indexOf(actor.classId) >= 0 ? actor.classId : (visible.length === 1 ? visible[0] : null);
    var nextYm = personalClass ? yourNextGreeting(model.rotation, personalClass, month) : null;
    var rotationSummary;
    if (!greetingClass) rotationSummary = "A Leader Has Not Chosen Which Class Greets Each Month.";
    else if (personalClass && greetingClass === personalClass) rotationSummary = "Your Class Greets This Month.";
    else if (personalClass && nextYm) {
      rotationSummary = className(greetingClass) + " Greet This Month. Your Class Greets In " + formatMonth(nextYm) + ".";
    } else rotationSummary = className(greetingClass) + " Greet In " + formatMonth(month) + ".";

    function slotView(entry, spot, index) {
      var who = spot.userId ? findUser(store, spot.userId) : null;
      var open = !spot.userId;
      var future = entry.date >= today && !entry.cancelled;
      var mine = !!(who && actor.id === who.id);
      var canAssign = isLeader(actor) && manages(actor, entry.classId);
      return {
        id: spot.id,
        label: entry.capacity === 1 && entry.typeId === "lesson" ? "Teacher" : (entry.capacity === 1 ? "Spot" : "Spot " + (index + 1)),
        open: open,
        display: open ? (entry.cancelled ? "Closed" : (future ? "Open" : "Unfilled")) : displayName(who),
        mine: mine,
        expectedUserId: spot.userId || "",
        version: spot.version,
        canClaim: future && open && actor.kind === "youth" && actor.status === "active" && actor.classId === entry.classId && !userOnEntry(entry, actor.id),
        canRelease: mine && actor.kind === "youth" && actor.status === "active" && entry.date >= today,
        canAssign: canAssign,
        choices: canAssign ? classYouth(store, entry.classId) : []
      };
    }
    function groupFor(entry) {
      var type = typeById(model, entry.typeId) || { name: entry.typeId, mode: "per-class" };
      return {
        entryId: entry.id,
        typeId: entry.typeId,
        typeName: type.name,
        classId: entry.classId,
        className: className(entry.classId),
        date: entry.date,
        dateLabel: formatLong(entry.date),
        cancelled: !!entry.cancelled,
        exception: !!entry.exception,
        topic: entry.topic || "",
        capacity: entry.capacity,
        canEdit: isLeader(actor) && manages(actor, entry.classId),
        showClass: visible.length > 1,
        slots: entry.slots.map(function (s, i) { return slotView(entry, s, i); })
      };
    }
    var entries = model.entries.filter(function (e) {
      if (visible.indexOf(e.classId) < 0) return false;
      if (filter && e.classId !== filter) return false;
      return true;
    }).sort(function (a, b) {
      if (a.date !== b.date) return a.date < b.date ? -1 : 1;
      if (a.typeId !== b.typeId) return a.typeId < b.typeId ? -1 : 1;
      return a.classId < b.classId ? -1 : a.classId > b.classId ? 1 : 0;
    });
    function pack(list) {
      var dates = [];
      list.forEach(function (entry) {
        var last = dates[dates.length - 1];
        if (!last || last.date !== entry.date) {
          last = { date: entry.date, dateLabel: formatLong(entry.date), groups: [] };
          dates.push(last);
        }
        last.groups.push(groupFor(entry));
      });
      return dates;
    }
    var prominentEntries = entries.filter(function (e) { return e.date === sunday; });
    var later = pack(entries.filter(function (e) { return e.date > sunday; }));
    var earlier = pack(entries.filter(function (e) { return e.date < sunday; }));

    var review = null;
    if (managed.length) {
      var suggestions = suggestMatches(options.roster || null, store.users || []);
      var sheetClass = suggestSheetClass(options.roster || null);
      review = {
        status: model.review.status || "unapplied",
        source: PAPER_SHEET.source,
        sheetClass: sheetClass,
        selectedClassId: options.reviewClassId || "",
        canSetRotation: isPresidency(actor),
        names: suggestions.map(function (s) {
          return reviewLine(s, actor, options.reviewClassId || "");
        }),
        cancellations: PAPER_SHEET.rows.filter(function (r) { return r.cancelled; }).map(function (r) {
          return { key: r.key, label: formatLong(r.date) + " · " + (r.note || "Cancelled") };
        }),
        choices: options.reviewClassId ? classYouth(store, options.reviewClassId) : []
      };
    }

    return {
      allowed: true,
      demo: !!options.demo,
      shared: !!options.shared,
      version: model.version,
      actor: { id: actor.id, name: displayName(actor), classId: actor.classId || null, leader: isLeader(actor), presidency: isPresidency(actor) },
      rotation: {
        configured: !!greetingClass,
        startMonth: model.rotation.startMonth || "",
        startClassId: model.rotation.startClassId || "",
        classOrder: isPresidency(actor) ? (model.rotation.classOrder || []).slice() : [],
        summary: rotationSummary,
        canSet: isPresidency(actor)
      },
      filters: managed.length > 1 ? [{ id: "", name: "All Classes" }].concat(classes.map(function (c) {
        return { id: c.id, name: c.name };
      })) : [],
      filter: filter,
      types: model.types.map(function (t) { return { id: t.id, name: t.name, mode: t.mode, defaultCapacity: t.defaultCapacity }; }),
      managedClasses: managed.map(classById).filter(Boolean),
      prominent: { date: sunday, dateLabel: formatLong(sunday), groups: prominentEntries.map(groupFor) },
      later: later,
      earlier: earlier,
      review: review
    };
  }

  function reviewLine(suggestion, actor, selectedClassId) {
    var presidency = isPresidency(actor);
    var bits = [];
    if (!suggestion.rosterMatches.length && !suggestion.spellingVariants.length) {
      bits.push("No exact class-list match. Not assigned.");
    } else if (suggestion.status === "unique") {
      var one = suggestion.rosterMatches[0];
      var sameClass = !selectedClassId || one.chatClassId === selectedClassId;
      if (presidency || sameClass) {
        bits.push("One class-list match: " + one.name + ", " + one.className + ". Not assigned until you confirm.");
      } else bits.push("The class-list match is outside the class you selected. Not assigned.");
    } else if (presidency) {
      var names = suggestion.rosterMatches.concat(suggestion.spellingVariants).map(function (m) {
        return m.name + " (" + m.className + ")";
      });
      bits.push((suggestion.spelling ? "Spelling differs. " : "More than one match. ") + names.join("; ") + ". Not assigned.");
    } else {
      bits.push("This handwritten name needs the presidency to review it. Not assigned.");
    }
    var ownChat = (suggestion.chatUsers || []).filter(function (u) {
      return !selectedClassId || true;
    });
    if (suggestion.status === "unique" && ownChat.length === 1) {
      bits.push("Chat account: " + ownChat[0].name + ".");
    } else if (!ownChat.length) bits.push("No matching chat account yet.");
    return {
      nameKey: suggestion.nameKey,
      date: suggestion.date,
      dateLabel: formatLong(suggestion.date),
      schedule: suggestion.schedule,
      scheduleLabel: suggestion.schedule === "door-greeting" ? "Door Greeting" : "Lessons",
      handwritten: suggestion.handwritten,
      status: suggestion.status,
      spelling: !!suggestion.spelling,
      ambiguous: suggestion.status !== "unique",
      note: bits.join(" ")
    };
  }

  function renderSlots(group) {
    var html = "";
    group.slots.forEach(function (s) {
      var openCls = s.open ? " open" : "";
      var label = s.canClaim
        ? "Sign Up For " + group.typeName + " On " + group.dateLabel
        : (s.canRelease ? "Release Your " + group.typeName + " Spot On " + group.dateLabel : s.label);
      html += "<div class=\"signup-slot" + openCls + "\"><div class=\"label\">" + esc(s.label) +
        "<span>" + (s.open ? (s.display === "Open" ? "Open Spot" : esc(s.display)) : "Filled") + "</span></div>" +
        "<div class=\"who" + (s.open ? " open" : "") + "\">" + esc(s.display) + "</div>";
      if (s.canAssign) {
        html += "<label class=\"field assign\">Assign <select data-su-assign data-entry=\"" + esc(group.entryId) +
          "\" data-slot=\"" + esc(s.id) + "\" data-ver=\"" + esc(s.version) + "\" data-occ=\"" + esc(s.expectedUserId) +
          "\" aria-label=\"Assign " + esc(group.typeName) + " " + esc(s.label) + " on " + esc(group.dateLabel) + "\">" +
          "<option value=\"\">Open</option>";
        s.choices.forEach(function (c) {
          html += "<option value=\"" + esc(c.id) + "\"" + (c.id === s.expectedUserId ? " selected" : "") + ">" + esc(c.name) +
            (c.status === "muted" ? " (Muted)" : "") + "</option>";
        });
        if (s.expectedUserId && !s.choices.some(function (c) { return c.id === s.expectedUserId; })) {
          html += "<option value=\"" + esc(s.expectedUserId) + "\" selected>" + esc(s.display) + "</option>";
        }
        html += "</select></label>";
      } else if (s.canClaim || s.canRelease) {
        html += "<button type=\"button\" class=\"btn mini" + (s.canRelease ? " alt" : "") + "\" data-su-action=\"" +
          (s.canRelease ? "release" : "claim") + "\" data-entry=\"" + esc(group.entryId) + "\" data-slot=\"" + esc(s.id) +
          "\" data-ver=\"" + esc(s.version) + "\" data-occ=\"" + esc(s.expectedUserId) + "\" aria-label=\"" + esc(label) + "\">" +
          (s.canRelease ? "Release" : "Sign Up") + "</button>";
      }
      html += "</div>";
    });
    return html;
  }
  function renderGroup(group) {
    var html = "<article class=\"signup-entry\"><h4>" + esc(group.typeName) +
      (group.showClass ? " · " + esc(group.className) : "") + "</h4>";
    if (group.cancelled) html += "<p class=\"signup-note\">Cancelled</p>";
    if (group.exception) html += "<p class=\"signup-note\">Exception To The Rotation</p>";
    if (group.topic) html += "<p class=\"signup-note\">" + esc(group.topic) + "</p>";
    html += renderSlots(group);
    if (group.canEdit) {
      html += "<label class=\"field\">Topic <input data-su-topic data-entry=\"" + esc(group.entryId) +
        "\" value=\"" + esc(group.topic) + "\" maxlength=\"120\" aria-label=\"Topic for " + esc(group.typeName) + " on " + esc(group.dateLabel) + "\"></label>";
      html += "<div class=\"row-acts\"><label class=\"field inline\">Capacity <input data-su-cap type=\"number\" min=\"1\" max=\"12\" value=\"" +
        esc(group.capacity) + "\" aria-label=\"Capacity for " + esc(group.dateLabel) + "\"></label>" +
        "<button type=\"button\" class=\"btn mini alt\" data-su-action=\"set-capacity\" data-entry=\"" + esc(group.entryId) + "\">Save Capacity</button>";
      if (group.cancelled) {
        html += "<button type=\"button\" class=\"btn mini alt\" data-su-action=\"restore-date\" data-entry=\"" + esc(group.entryId) + "\">Restore Date</button>";
      } else {
        html += "<button type=\"button\" class=\"btn mini alt\" data-su-action=\"cancel-date\" data-entry=\"" + esc(group.entryId) + "\">Cancel Date</button>";
      }
      html += "<button type=\"button\" class=\"btn mini alt\" data-su-action=\"remove-date\" data-entry=\"" + esc(group.entryId) + "\">Remove Date</button></div>";
    }
    html += "</article>";
    return html;
  }
  function renderDateBlock(block) {
    var html = "<section class=\"signup-week\"><h3>" + esc(block.dateLabel) + "</h3>";
    if (!block.groups.length) html += "<p class=\"signup-note\">Nothing Posted.</p>";
    block.groups.forEach(function (g) { html += renderGroup(g); });
    html += "</section>";
    return html;
  }

  function renderHtml(view) {
    if (!view || !view.allowed) {
      return "<div class=\"panel-head\"><h2>Sign-Ups</h2><p>" + esc(view && view.message ? view.message : "Sign-Ups Are Unavailable.") + "</p></div>";
    }
    var html = "<div class=\"panel-head\"><h2>Sign-Ups</h2><p>Door Greeting And Lessons For Your Class. Open Spots Stay Open Until Someone Claims Them.</p>";
    if (view.shared) html += "<p class=\"signup-note\">Saved For The Ward. Your Class Sees These Names.</p>";
    else if (view.demo) html += "<p class=\"signup-note\">Demo: Saved On This Device Only. Nothing Is Sent To Anyone.</p>";
    html += "</div>";
    if (view.filters.length) {
      html += "<div class=\"signup-filters\" role=\"group\" aria-label=\"Class\">";
      view.filters.forEach(function (f) {
        var pressed = (view.filter || "") === f.id;
        html += "<button type=\"button\" data-su-filter=\"" + esc(f.id) + "\" aria-pressed=\"" + (pressed ? "true" : "false") + "\">" + esc(f.name) + "</button>";
      });
      html += "</div>";
    }
    html += "<section class=\"signup-week this\" aria-label=\"This Week\"><p class=\"signup-kicker\">This Week</p><h3>" +
      esc(view.prominent.dateLabel) + "</h3><p class=\"signup-note\">" + esc(view.rotation.summary) + "</p>";
    if (!view.prominent.groups.length) html += "<p class=\"signup-note\">Nothing Is Posted For This Sunday Yet.</p>";
    view.prominent.groups.forEach(function (g) { html += renderGroup(g); });
    html += "</section>";
    if (view.later.length) {
      html += "<p class=\"signup-kicker\">Later Dates</p>";
      view.later.forEach(function (block) { html += renderDateBlock(block); });
    }
    if (view.earlier.length) {
      html += "<details class=\"signup-earlier\"><summary>Earlier Dates</summary>";
      view.earlier.forEach(function (block) { html += renderDateBlock(block); });
      html += "</details>";
    }
    if (view.actor.leader) html += renderLeader(view);
    return html;
  }

  function renderLeader(view) {
    var html = "<div class=\"leader-tools\"><h3 class=\"signup-kicker\">Leader Tools</h3>";
    html += "<section class=\"signup-week\"><h3>Greeting Rotation</h3><p class=\"signup-note\">Each class greets every third month. Pick the starting month and class. Nothing is guessed.</p>";
    if (view.rotation.canSet) {
      html += "<label class=\"field\">Starting Month <input id=\"su-start-month\" type=\"month\" value=\"" + esc(view.rotation.startMonth) + "\"></label>";
      html += "<label class=\"field\">Starting Class <select id=\"su-start-class\"><option value=\"\">Choose Starting Class</option>";
      CLASSES.forEach(function (c) {
        html += "<option value=\"" + esc(c.id) + "\"" + (view.rotation.startClassId === c.id ? " selected" : "") + ">" + esc(c.name) + "</option>";
      });
      html += "</select></label>";
      for (var i = 0; i < 3; i++) {
        html += "<label class=\"field\">Order " + (i + 1) + " <select id=\"su-order-" + i + "\">";
        CLASSES.forEach(function (c) {
          var selected = (view.rotation.classOrder[i] || CLASSES[i].id) === c.id;
          html += "<option value=\"" + esc(c.id) + "\"" + (selected ? " selected" : "") + ">" + esc(c.name) + "</option>";
        });
        html += "</select></label>";
      }
      html += "<div class=\"row-acts\"><button type=\"button\" class=\"btn mini\" data-su-action=\"set-rotation\">Save Greeting Rotation</button>" +
        "<button type=\"button\" class=\"btn mini alt\" data-su-action=\"fill-greetings\">Add Greeting Sundays</button></div>";
    } else html += "<p class=\"signup-note\">The presidency sets the rotation for every class.</p>";
    html += "</section>";

    html += "<details class=\"signup-week\"><summary>Dates And Capacity</summary>";
    html += "<label class=\"field\">Assignment <select id=\"su-add-type\">";
    view.types.forEach(function (t) {
      html += "<option value=\"" + esc(t.id) + "\">" + esc(t.name) + "</option>";
    });
    html += "</select></label><label class=\"field\">Class <select id=\"su-add-class\">";
    view.managedClasses.forEach(function (c) {
      html += "<option value=\"" + esc(c.id) + "\">" + esc(c.name) + "</option>";
    });
    html += "</select></label><label class=\"field\">Date <input id=\"su-add-date\" type=\"date\"></label>" +
      "<label class=\"field\">Capacity <input id=\"su-add-cap\" type=\"number\" min=\"1\" max=\"12\" value=\"1\"></label>" +
      "<label class=\"check\"><input id=\"su-add-exception\" type=\"checkbox\"> Exception To The Rotation</label>" +
      "<div class=\"row-acts\"><button type=\"button\" class=\"btn mini\" data-su-action=\"add-date\">Add Date</button>" +
      "<button type=\"button\" class=\"btn mini alt\" data-su-action=\"fill-lessons\">Add Lesson Sundays</button></div></details>";

    if (view.rotation.canSet) {
      html += "<details class=\"signup-week\"><summary>Assignment Types</summary>" +
        "<label class=\"field\">Name <input id=\"su-type-name\" maxlength=\"40\" placeholder=\"Opening Prayer\"></label>" +
        "<label class=\"field\">Schedule <select id=\"su-type-mode\"><option value=\"per-class\">Per Class</option><option value=\"rotation\">Greeting Rotation</option></select></label>" +
        "<label class=\"field\">Capacity <input id=\"su-type-cap\" type=\"number\" min=\"1\" max=\"12\" value=\"1\"></label>" +
        "<button type=\"button\" class=\"btn mini\" data-su-action=\"add-type\">Add Assignment Type</button></details>";
    }

    if (view.review) {
      html += "<details class=\"signup-week\" id=\"su-review\"" + (view.review.selectedClassId ? " open" : "") + "><summary>Paper Sheet Review</summary>" +
        "<p class=\"review-flag\">Not Applied</p><p class=\"signup-note\">" + esc(view.review.source) + "</p>" +
        "<p class=\"signup-note\">" + esc(view.review.sheetClass.reason) + "</p>" +
        "<label class=\"field\">Sheet Class <select id=\"su-review-class\"><option value=\"\">Choose Class After Review</option>";
      view.managedClasses.forEach(function (c) {
        html += "<option value=\"" + esc(c.id) + "\"" + (view.review.selectedClassId === c.id ? " selected" : "") + ">" + esc(c.name) + "</option>";
      });
      html += "</select></label>";
      view.review.names.forEach(function (n) {
        html += "<div class=\"review-row\" data-name-key=\"" + esc(n.nameKey) + "\"" + (n.ambiguous ? " data-ambiguous=\"true\"" : "") + ">" +
          "<p><b>" + esc(n.dateLabel) + " · " + esc(n.scheduleLabel) + "</b><br>Handwritten: " + esc(n.handwritten) + "</p>" +
          "<p class=\"signup-note\">" + esc(n.note) + "</p>" +
          "<label class=\"check\"><input type=\"checkbox\" data-review-include> Confirm After Review</label>" +
          "<label class=\"field\">Assign Only If Confirmed <select data-review-user><option value=\"\">Do Not Assign</option>";
        (view.review.choices || []).forEach(function (c) {
          html += "<option value=\"" + esc(c.id) + "\">" + esc(c.name) + "</option>";
        });
        html += "</select></label></div>";
      });
      view.review.cancellations.forEach(function (c) {
        html += "<label class=\"check\"><input type=\"checkbox\" data-cancel-key=\"" + esc(c.key) + "\"> Record " + esc(c.label) + "</label>";
      });
      if (view.review.canSetRotation) {
        html += "<label class=\"check\"><input id=\"su-review-rotation\" type=\"checkbox\"> Also Set The Greeting Rotation To This Class In November 2026</label>";
      }
      html += "<button type=\"button\" class=\"btn mini\" data-su-action=\"apply-review\">Apply Confirmed Rows Only</button></details>";
    }
    html += "</div>";
    return html;
  }

  function val(doc, id) {
    var el = doc && doc.getElementById(id);
    return el ? el.value : "";
  }
  function actionFromControl(el, doc) {
    if (!el || !el.getAttribute) return null;
    var type = el.getAttribute("data-su-action");
    if (!type && el.hasAttribute("data-su-assign")) type = "assign";
    if (!type && el.hasAttribute("data-su-topic")) type = "set-topic";
    if (!type) return null;
    if (type === "claim" || type === "release" || type === "assign") {
      var occ = el.getAttribute("data-occ");
      return {
        type: type,
        entryId: el.getAttribute("data-entry"),
        slotId: el.getAttribute("data-slot"),
        expectedUserId: occ || null,
        expectedSlotVersion: Number(el.getAttribute("data-ver") || 0),
        userId: type === "assign" ? (el.value || null) : null
      };
    }
    if (type === "set-capacity") {
      var box = el.closest ? el.closest(".signup-entry") : null;
      var input = box ? box.querySelector("[data-su-cap]") : null;
      return { type: type, entryId: el.getAttribute("data-entry"), capacity: input ? Number(input.value) : NaN };
    }
    if (type === "set-topic") return { type: type, entryId: el.getAttribute("data-entry"), topic: el.value };
    if (type === "remove-date" || type === "cancel-date" || type === "restore-date") {
      return { type: type, entryId: el.getAttribute("data-entry") };
    }
    if (type === "set-rotation") {
      return {
        type: type,
        startMonth: val(doc, "su-start-month"),
        startClassId: val(doc, "su-start-class"),
        classOrder: [val(doc, "su-order-0"), val(doc, "su-order-1"), val(doc, "su-order-2")]
      };
    }
    if (type === "add-date") {
      return {
        type: type,
        typeId: val(doc, "su-add-type"),
        classId: val(doc, "su-add-class"),
        date: val(doc, "su-add-date"),
        capacity: Number(val(doc, "su-add-cap")),
        exception: !!(doc.getElementById("su-add-exception") && doc.getElementById("su-add-exception").checked)
      };
    }
    if (type === "fill-lessons") return { type: type, classId: val(doc, "su-add-class") };
    if (type === "fill-greetings") return { type: type };
    if (type === "add-type") {
      return { type: type, name: val(doc, "su-type-name"), mode: val(doc, "su-type-mode"), capacity: Number(val(doc, "su-type-cap")) };
    }
    if (type === "apply-review") {
      var assignments = [];
      var rows = doc.querySelectorAll ? doc.querySelectorAll("[data-name-key]") : [];
      for (var i = 0; i < rows.length; i++) {
        var include = rows[i].querySelector("[data-review-include]");
        var sel = rows[i].querySelector("[data-review-user]");
        if (include && include.checked && (!sel || !sel.value)) return { invalid: true, message: "Choose A Young Woman For Each Confirmed Row, Or Leave It Unconfirmed." };
        if (include && include.checked && sel && sel.value) {
          assignments.push({ nameKey: rows[i].getAttribute("data-name-key"), userId: sel.value, reviewed: true });
        }
      }
      var cancellations = [];
      var boxes = doc.querySelectorAll ? doc.querySelectorAll("[data-cancel-key]") : [];
      for (var j = 0; j < boxes.length; j++) if (boxes[j].checked) cancellations.push(boxes[j].getAttribute("data-cancel-key"));
      var action = { type: type, classId: val(doc, "su-review-class"), assignments: assignments, cancellations: cancellations };
      var rot = doc.getElementById("su-review-rotation");
      if (rot && rot.checked) action.setRotation = { startMonth: "2026-11", startClassId: action.classId };
      return action;
    }
    return { type: type };
  }

  return {
    CLASSES: CLASSES,
    PAPER_SHEET: PAPER_SHEET,
    createModel: createModel,
    ensureModel: ensureModel,
    classForMonth: classForMonth,
    upcomingSunday: upcomingSunday,
    denverYmd: denverYmd,
    suggestMatches: suggestMatches,
    suggestSheetClass: suggestSheetClass,
    applyAction: applyAction,
    commitStored: commitStored,
    buildView: buildView,
    renderHtml: renderHtml,
    actionFromControl: actionFromControl,
    isPresidency: isPresidency,
    isLeader: isLeader,
    managedClassIds: managedClassIds
  };
});
