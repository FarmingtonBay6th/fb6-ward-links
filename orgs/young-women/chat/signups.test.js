/* Behavioral tests for Young Women sign-ups. Run: node --test orgs/young-women/chat/signups.test.js */
"use strict";

var test = require("node:test");
var assert = require("node:assert/strict");
var fs = require("fs");
var path = require("path");
var S = require("./signups.js");

var NOW = new Date("2026-11-06T18:00:00Z");
var ROSTER = JSON.parse(fs.readFileSync(path.join(__dirname, "../../../data/yw-classes.json"), "utf8"));

function users() {
  return [
    { id: "u-traci", name: "Traci Harward", role: "moderator", kind: "adult", status: "active" },
    { id: "u-bishop", name: "Bishopric Adviser", role: "bishopric", kind: "adult", status: "active" },
    { id: "u-chandra", name: "Chandra Draxler", role: "adviser", kind: "adult", classId: "gatherers", status: "active" },
    { id: "u-denise", name: "Denise Evans", role: "adviser", kind: "adult", classId: "messengers", status: "active" },
    { id: "u-parent", name: "Parent of Presley", role: "parent", kind: "adult", status: "active", childIds: ["u-presley"], phone: "555-0100" },
    { id: "u-presley", name: "Presley P.", role: "youth", kind: "youth", classId: "gatherers", status: "active", phone: "555-0199", email: "presley@example.test" },
    { id: "u-brooke", name: "Brooke", role: "youth", kind: "youth", classId: "gatherers", status: "muted", phone: "555-0111" },
    { id: "u-youth-2", name: "Test Youth Two", role: "youth", kind: "youth", classId: "gatherers", status: "active" },
    { id: "u-youth-3", name: "Test Youth Three", role: "youth", kind: "youth", classId: "gatherers", status: "active" },
    { id: "u-youth-4", name: "Test Youth Four", role: "youth", kind: "youth", classId: "gatherers", status: "active" },
    { id: "u-youth-5", name: "Test Youth Five", role: "youth", kind: "youth", classId: "gatherers", status: "active" },
    { id: "u-lucy", name: "Lucy", role: "youth", kind: "youth", classId: "messengers", status: "active", phone: "555-0177" },
    { id: "u-emma", name: "Emma H.", role: "youth", kind: "youth", classId: "gatherers", status: "pending_parent" },
    { id: "u-anna", name: "Anna B.", role: "youth", kind: "youth", classId: "messengers", status: "invited" },
    { id: "u-builder", name: "Builders Pres.", role: "youth", kind: "youth", classId: "builders", status: "active" },
    { id: "u-removed", name: "Gone Youth", role: "youth", kind: "youth", classId: "gatherers", status: "active", removed: true }
  ];
}
function fresh() { return { users: users(), signups: S.createModel(NOW) }; }
function act(box, actor, action) {
  var copy = JSON.parse(JSON.stringify(action));
  copy.baseVersion = box.signups.version;
  var result = S.applyAction(box, actor, copy, NOW);
  if (result.ok) {
    box.users = result.store.users;
    box.signups = result.store.signups;
  }
  return result;
}
function entry(box, typeId, classId, date) {
  return box.signups.entries.find(function (e) {
    return e.typeId === typeId && e.classId === classId && (!date || e.date === date);
  });
}
function claim(box, actor, spotEntry, slotIndex) {
  var spot = spotEntry.slots[slotIndex || 0];
  return act(box, actor, {
    type: "claim", entryId: spotEntry.id, slotId: spot.id,
    expectedUserId: spot.userId, expectedSlotVersion: spot.version
  });
}
function ids(box) {
  var out = [];
  box.signups.entries.forEach(function (e) {
    e.slots.forEach(function (s) { if (s.userId) out.push(e.id + "=" + s.userId); });
  });
  return out;
}

test("upcoming week is the next Sunday in Denver, including Sunday itself", function () {
  assert.equal(S.denverYmd(NOW), "2026-11-06");
  assert.equal(S.upcomingSunday(NOW), "2026-11-08");
  assert.equal(S.upcomingSunday(new Date("2026-11-08T18:00:00Z")), "2026-11-08");
});

test("a new schedule has lesson dates and no greeting dates or paper names", function () {
  var box = fresh();
  var lessons = box.signups.entries.filter(function (e) { return e.typeId === "lesson"; });
  var greetings = box.signups.entries.filter(function (e) { return e.typeId === "door-greeting"; });
  assert.ok(lessons.length >= 8);
  assert.equal(greetings.length, 0);
  assert.equal(box.signups.rotation.startClassId, null);
  assert.deepEqual(ids(box), []);
  assert.equal(JSON.stringify(box.signups).indexOf("Brooklin"), -1);
  assert.equal(JSON.stringify(box.signups).indexOf("Brynnlee"), -1);
});

test("legacy ward-wide rows are not copied onto a guessed class", function () {
  var legacy = [{
    date: "2026-11-08",
    greeters: [{ slot: "door1", label: "Door Greeter 1", userId: "u-presley" }],
    lessons: [{ classId: "gatherers", teacherId: "u-presley", topic: "Faith" }]
  }];
  var model = S.ensureModel(legacy, NOW);
  assert.equal(model.migration.greetingClassGuessed, false);
  assert.equal(model.migration.legacyRowsIgnored, 1);
  assert.equal(model.entries.some(function (e) { return e.typeId === "door-greeting"; }), false);
  assert.equal(model.entries.some(function (e) { return e.slots.some(function (s) { return s.userId; }); }), false);
  var again = S.ensureModel(model, NOW);
  assert.equal(again.version, model.version);
  assert.equal(again.entries.length, model.entries.length);
});

test("rotation follows the leader's starting month and class, every third month", function () {
  var order = ["gatherers", "messengers", "builders"];
  var rotation = { startMonth: "2026-11", startClassId: "gatherers", classOrder: order };
  assert.equal(S.classForMonth(rotation, "2026-11"), "gatherers");
  assert.equal(S.classForMonth(rotation, "2026-12"), "messengers");
  assert.equal(S.classForMonth(rotation, "2027-01"), "builders");
  assert.equal(S.classForMonth(rotation, "2027-02"), "gatherers");
  assert.equal(S.classForMonth(rotation, "2026-10"), "builders");
  var messengersFirst = { startMonth: "2026-11", startClassId: "messengers", classOrder: order };
  assert.equal(S.classForMonth(messengersFirst, "2026-11"), "messengers");
  assert.equal(S.classForMonth(messengersFirst, "2026-12"), "builders");
  assert.equal(S.classForMonth(messengersFirst, "2027-01"), "gatherers");
  assert.equal(S.classForMonth({ startMonth: null, startClassId: null, classOrder: order }, "2026-11"), null);
  assert.equal(S.classForMonth({ startMonth: "2026-11", startClassId: null, classOrder: order }, "2026-11"), null);
});

test("youth can claim and release a future opening in their own class", function () {
  var box = fresh();
  var lesson = entry(box, "lesson", "gatherers", "2026-11-08");
  var claimed = claim(box, "u-presley", lesson, 0);
  assert.equal(claimed.ok, true);
  lesson = entry(box, "lesson", "gatherers", "2026-11-08");
  assert.equal(lesson.slots[0].userId, "u-presley");
  var released = act(box, "u-presley", {
    type: "release", entryId: lesson.id, slotId: lesson.slots[0].id,
    expectedUserId: "u-presley", expectedSlotVersion: lesson.slots[0].version
  });
  assert.equal(released.ok, true);
  assert.equal(entry(box, "lesson", "gatherers", "2026-11-08").slots[0].userId, null);
});

test("permissions block cross-class, parents, pending youth, muted youth, and outsiders", function () {
  var box = fresh();
  var lesson = entry(box, "lesson", "gatherers", "2026-11-08");
  assert.equal(claim(box, "u-lucy", lesson, 0).error, "forbidden");
  assert.equal(claim(box, "u-parent", lesson, 0).error, "forbidden");
  assert.equal(claim(box, "u-emma", lesson, 0).error, "forbidden");
  assert.equal(claim(box, "u-brooke", lesson, 0).error, "forbidden");
  assert.equal(claim(box, "u-anna", lesson, 0).error, "forbidden");
  assert.equal(claim(box, "u-removed", lesson, 0).error, "not-member");
  assert.equal(claim(box, "u-missing", lesson, 0).error, "not-member");
  assert.deepEqual(ids(box), []);
  claim(box, "u-presley", entry(box, "lesson", "gatherers", "2026-11-08"), 0);
  var taken = entry(box, "lesson", "gatherers", "2026-11-08");
  assert.equal(act(box, "u-lucy", {
    type: "release", entryId: taken.id, slotId: taken.slots[0].id,
    expectedUserId: "u-presley", expectedSlotVersion: taken.slots[0].version
  }).error, "forbidden");
  assert.equal(entry(box, "lesson", "gatherers", "2026-11-08").slots[0].userId, "u-presley");
});

test("a youth cannot claim a past date, and a leader can still assign it", function () {
  var box = fresh();
  assert.equal(act(box, "u-traci", {
    type: "add-date", typeId: "lesson", classId: "gatherers", date: "2026-10-25", capacity: 1
  }).ok, true);
  var past = entry(box, "lesson", "gatherers", "2026-10-25");
  assert.equal(claim(box, "u-presley", past, 0).error, "forbidden");
  assert.equal(act(box, "u-traci", {
    type: "assign", entryId: past.id, slotId: past.slots[0].id, userId: "u-presley",
    expectedUserId: null, expectedSlotVersion: 0
  }).ok, true);
  past = entry(box, "lesson", "gatherers", "2026-10-25");
  assert.equal(act(box, "u-presley", {
    type: "release", entryId: past.id, slotId: past.slots[0].id,
    expectedUserId: "u-presley", expectedSlotVersion: past.slots[0].version
  }).error, "forbidden");
});

test("leaders assign within their class, and advisers cannot cross classes", function () {
  var box = fresh();
  var lesson = entry(box, "lesson", "gatherers", "2026-11-08");
  assert.equal(act(box, "u-chandra", {
    type: "assign", entryId: lesson.id, slotId: lesson.slots[0].id, userId: "u-lucy",
    expectedUserId: null, expectedSlotVersion: 0
  }).error, "forbidden");
  assert.equal(act(box, "u-denise", {
    type: "assign", entryId: lesson.id, slotId: lesson.slots[0].id, userId: "u-presley",
    expectedUserId: null, expectedSlotVersion: 0
  }).error, "forbidden");
  assert.equal(act(box, "u-chandra", {
    type: "assign", entryId: lesson.id, slotId: lesson.slots[0].id, userId: "u-brooke",
    expectedUserId: null, expectedSlotVersion: 0
  }).ok, true);
  lesson = entry(box, "lesson", "gatherers", "2026-11-08");
  assert.equal(act(box, "u-traci", {
    type: "assign", entryId: lesson.id, slotId: lesson.slots[0].id, userId: "u-presley",
    expectedUserId: "u-brooke", expectedSlotVersion: lesson.slots[0].version
  }).ok, true);
  assert.equal(entry(box, "lesson", "gatherers", "2026-11-08").slots[0].userId, "u-presley");
  assert.equal(act(box, "u-presley", {
    type: "set-rotation", startMonth: "2026-11", startClassId: "gatherers",
    classOrder: ["gatherers", "messengers", "builders"]
  }).error, "forbidden");
  assert.equal(act(box, "u-chandra", {
    type: "set-rotation", startMonth: "2026-11", startClassId: "gatherers",
    classOrder: ["gatherers", "messengers", "builders"]
  }).error, "forbidden");
});

test("capacity, cancelled dates, and a second spot on the same date", function () {
  var box = fresh();
  act(box, "u-traci", {
    type: "set-rotation", startMonth: "2026-11", startClassId: "gatherers",
    classOrder: ["gatherers", "messengers", "builders"]
  });
  var greet = entry(box, "door-greeting", "gatherers", "2026-11-08");
  assert.equal(greet.capacity, 4);
  ["u-presley", "u-youth-2", "u-youth-3", "u-youth-4"].forEach(function (id, i) {
    greet = entry(box, "door-greeting", "gatherers", "2026-11-08");
    assert.equal(claim(box, id, greet, i).ok, true);
  });
  greet = entry(box, "door-greeting", "gatherers", "2026-11-08");
  assert.equal(act(box, "u-youth-5", {
    type: "claim", entryId: greet.id, slotId: greet.slots[0].id,
    expectedUserId: null, expectedSlotVersion: greet.slots[0].version
  }).error, "full");
  assert.equal(act(box, "u-chandra", {
    type: "set-capacity", entryId: greet.id, capacity: 3
  }).error, "validation");
  assert.equal(act(box, "u-traci", { type: "cancel-date", entryId: greet.id }).ok, true);
  greet = entry(box, "door-greeting", "gatherers", "2026-11-08");
  assert.equal(greet.cancelled, true);
  assert.equal(claim(box, "u-youth-5", greet, 0).error, "forbidden");
  var lesson = entry(box, "lesson", "gatherers", "2026-11-15");
  assert.equal(claim(box, "u-presley", lesson, 0).ok, true);
  assert.equal(act(box, "u-traci", { type: "set-capacity", entryId: lesson.id, capacity: 2 }).ok, true);
  lesson = entry(box, "lesson", "gatherers", "2026-11-15");
  assert.equal(claim(box, "u-presley", lesson, 1).error, "validation");
});

test("simultaneous claims: the stale save loses and a retry sees the taken spot", function () {
  var box = fresh();
  var lesson = entry(box, "lesson", "gatherers", "2026-11-08");
  var action = {
    type: "claim", entryId: lesson.id, slotId: lesson.slots[0].id,
    expectedUserId: null, expectedSlotVersion: 0
  };
  var shared = JSON.parse(JSON.stringify(box));
  var saves = 0;
  function load() { return JSON.parse(JSON.stringify(shared)); }
  function save(next) { shared = JSON.parse(JSON.stringify(next)); saves += 1; }
  var first = S.commitStored({ load: load, save: save, actorId: "u-presley", action: action, now: NOW });
  var second = S.commitStored({ load: load, save: save, actorId: "u-youth-2", action: action, now: NOW });
  assert.equal(first.ok, true);
  assert.equal(second.ok, false);
  assert.ok(second.error === "conflict" || second.error === "full");
  assert.equal(saves, 1);
  assert.equal(shared.signups.entries.find(function (e) { return e.id === lesson.id; }).slots[0].userId, "u-presley");

  var raced = JSON.parse(JSON.stringify(box));
  var loads = 0;
  var racedResult = S.commitStored({
    load: function () {
      loads += 1;
      if (loads === 2) raced.signups.version += 1;
      return JSON.parse(JSON.stringify(raced));
    },
    save: function () { throw new Error("stale save should not land"); },
    actorId: "u-presley",
    action: action,
    now: NOW
  });
  assert.equal(racedResult.error, "conflict");
});

test("lesson dates and greeting dates stay independent", function () {
  var box = fresh();
  var guessed = act(box, "u-traci", {
    type: "add-date", typeId: "door-greeting", classId: "gatherers", date: "2026-11-08", capacity: 4
  });
  assert.equal(guessed.error, "validation");
  assert.ok(guessed.message.indexOf("Not Guessed") >= 0);
  assert.equal(act(box, "u-traci", {
    type: "add-date", typeId: "door-greeting", classId: "gatherers", date: "2026-11-01", capacity: 4, exception: true
  }).ok, true);
  assert.equal(act(box, "u-traci", {
    type: "add-date", typeId: "door-greeting", classId: "gatherers", date: "2026-11-01", capacity: 4
  }).error, "validation");
  assert.equal(act(box, "u-traci", {
    type: "add-date", typeId: "lesson", classId: "gatherers", date: "2027-01-10", capacity: 1
  }).ok, true);
  var greeting = entry(box, "door-greeting", "gatherers", "2026-11-01");
  var lesson = entry(box, "lesson", "gatherers", "2027-01-10");
  assert.ok(greeting);
  assert.ok(lesson);
  assert.equal(entry(box, "lesson", "gatherers", "2026-11-01"), undefined);
  assert.equal(entry(box, "door-greeting", "gatherers", "2027-01-10"), undefined);
  assert.equal(act(box, "u-traci", { type: "remove-date", entryId: lesson.id }).ok, true);
  assert.ok(entry(box, "door-greeting", "gatherers", "2026-11-01"));
  assert.equal(entry(box, "lesson", "gatherers", "2027-01-10"), undefined);
  act(box, "u-traci", {
    type: "set-rotation", startMonth: "2026-11", startClassId: "messengers",
    classOrder: ["gatherers", "messengers", "builders"]
  });
  assert.equal(entry(box, "door-greeting", "gatherers", "2026-11-08"), undefined);
  assert.ok(entry(box, "door-greeting", "messengers", "2026-11-08"));
  assert.ok(entry(box, "lesson", "gatherers", "2026-11-08"));
  assert.equal(act(box, "u-traci", {
    type: "add-date", typeId: "door-greeting", classId: "gatherers", date: "2026-11-15", capacity: 2
  }).error, "validation");
  assert.equal(act(box, "u-traci", {
    type: "add-date", typeId: "door-greeting", classId: "gatherers", date: "2026-11-15", capacity: 2, exception: true
  }).ok, true);
});

test("an added assignment type keeps its own dates", function () {
  var box = fresh();
  assert.equal(act(box, "u-chandra", { type: "add-type", name: "Opening Prayer", mode: "per-class", capacity: 1 }).error, "forbidden");
  assert.equal(act(box, "u-traci", { type: "add-type", name: "Opening Prayer", mode: "per-class", capacity: 1 }).ok, true);
  assert.equal(act(box, "u-traci", {
    type: "add-date", typeId: "opening-prayer", classId: "builders", date: "2026-11-22", capacity: 1
  }).ok, true);
  var prayer = entry(box, "opening-prayer", "builders", "2026-11-22");
  assert.equal(claim(box, "u-builder", prayer, 0).ok, true);
  assert.equal(claim(box, "u-presley", prayer, 0).error, "forbidden");
  assert.equal(entry(box, "lesson", "builders", "2026-11-22").slots[0].userId, null);
});

test("views stay inside the viewer's class and omit contact fields", function () {
  var box = fresh();
  claim(box, "u-presley", entry(box, "lesson", "gatherers", "2026-11-08"), 0);
  claim(box, "u-lucy", entry(box, "lesson", "messengers", "2026-11-08"), 0);
  var before = box.signups.version;
  var youth = S.buildView(box, "u-presley", NOW, { roster: ROSTER });
  assert.equal(box.signups.version, before);
  assert.equal(youth.allowed, true);
  assert.equal(youth.review, null);
  var seen = JSON.stringify(youth);
  assert.equal(seen.indexOf("555-"), -1);
  assert.equal(seen.indexOf("example.test"), -1);
  assert.equal(seen.indexOf("Lucy"), -1);
  assert.equal(seen.indexOf("messengers"), -1);
  assert.equal(seen.indexOf("Brooklin"), -1);
  assert.ok(seen.indexOf("Presley P.") >= 0);
  var parent = S.buildView(box, "u-parent", NOW, { roster: ROSTER });
  assert.equal(parent.review, null);
  assert.equal(JSON.stringify(parent).indexOf("Lucy"), -1);
  assert.equal(JSON.stringify(parent).indexOf("555-"), -1);
  var pending = S.buildView(box, "u-emma", NOW, { roster: ROSTER });
  assert.equal(pending.allowed, false);
  assert.equal(JSON.stringify(pending).indexOf("Presley"), -1);
  var html = S.renderHtml(youth);
  assert.equal(html.indexOf("Brooklin"), -1);
  assert.equal(html.indexOf("Paper Sheet"), -1);
  assert.ok(html.indexOf("This Week") >= 0);
  assert.ok(html.indexOf("Sunday, Nov 8, 2026") >= 0);
  assert.ok(html.indexOf(">Sign Up<") >= 0 || html.indexOf(">Release<") >= 0);
});

test("paper review suggests matches but does not assign them", function () {
  var suggestions = S.suggestMatches(ROSTER, users());
  function one(name) { return suggestions.find(function (s) { return s.handwritten === name; }); }
  assert.equal(one("Brooke").status, "unique");
  assert.equal(one("Brooke").autoApply, false);
  assert.equal(one("Brooke").needsConfirm, true);
  assert.equal(one("Brooke").rosterMatches[0].name, "Brooke");
  assert.equal(one("Kate").status, "unique");
  assert.equal(one("Kate").chatUsers.length, 0);
  assert.equal(one("Brinley").rosterMatches.length, 1);
  assert.equal(one("Brinley").rosterMatches[0].name, "Brinley R.");
  assert.equal(one("Brynnlee").status, "unique");
  assert.equal(one("Brynnlee").rosterMatches[0].name, "Brynnlee B.");
  assert.equal(one("Brooklin").status, "ambiguous");
  assert.equal(one("Brooklin").spelling, true);
  assert.equal(one("Brooklin").autoApply, false);
  assert.equal(one("Brooklin").chatUsers.length, 0);
  var variantNames = one("Brooklin").spellingVariants.map(function (v) { return v.name; }).sort();
  assert.deepEqual(variantNames, ["Brooklyn M.", "Brooklyn R."]);
  var sheet = S.suggestSheetClass(ROSTER);
  assert.equal(sheet.verified, false);
  assert.equal(sheet.likelyClassId, "gatherers");
  assert.ok(sheet.reason.indexOf("does not verify") >= 0);
  assert.notDeepEqual(S.PAPER_SHEET.greetingDates, S.PAPER_SHEET.lessonDates);
  assert.ok(S.PAPER_SHEET.greetingDates.indexOf("2026-11-01") >= 0);
  assert.equal(S.PAPER_SHEET.lessonDates.indexOf("2026-11-01"), -1);
  assert.ok(S.PAPER_SHEET.lessonDates.indexOf("2026-12-06") >= 0);
  assert.equal(S.PAPER_SHEET.greetingDates.indexOf("2026-12-06"), -1);

  var box = fresh();
  var before = ids(box);
  var empty = act(box, "u-traci", { type: "apply-review", classId: "gatherers", assignments: [], cancellations: [] });
  assert.equal(empty.ok, false);
  assert.deepEqual(ids(box), before);
  var unreviewed = act(box, "u-traci", {
    type: "apply-review", classId: "gatherers",
    assignments: [{ nameKey: "g-2026-11-01#0", userId: "u-brooke" }]
  });
  assert.equal(unreviewed.ok, false);
  assert.deepEqual(ids(box), before);
  var wrongClass = act(box, "u-traci", {
    type: "apply-review", classId: "gatherers",
    assignments: [{ nameKey: "g-2026-11-08#0", userId: "u-lucy", reviewed: true }]
  });
  assert.equal(wrongClass.ok, false);
  var applied = act(box, "u-traci", {
    type: "apply-review", classId: "gatherers",
    assignments: [{ nameKey: "g-2026-11-01#0", userId: "u-brooke", reviewed: true }],
    cancellations: ["l-2026-12-13"]
  });
  assert.equal(applied.ok, true);
  var greeting = entry(box, "door-greeting", "gatherers", "2026-11-01");
  assert.equal(greeting.slots[0].userId, "u-brooke");
  assert.equal(greeting.slots.filter(function (s) { return s.userId; }).length, 1);
  assert.equal(entry(box, "door-greeting", "gatherers", "2026-11-08"), undefined);
  var cancelled = entry(box, "lesson", "gatherers", "2026-12-13");
  assert.equal(cancelled.cancelled, true);
  assert.equal(cancelled.slots.some(function (s) { return s.userId; }), false);
  assert.equal(JSON.stringify(box.signups).indexOf("Brinley"), -1);
  assert.equal(JSON.stringify(box.signups).indexOf("Brooklin"), -1);
  var adviser = S.renderHtml(S.buildView(fresh(), "u-chandra", NOW, { roster: ROSTER }));
  assert.ok(adviser.indexOf("Paper Sheet Review") >= 0);
  assert.ok(adviser.indexOf("Not Applied") >= 0);
  assert.equal(adviser.indexOf("Brooklyn R."), -1);
  var presidency = S.renderHtml(S.buildView(fresh(), "u-traci", NOW, { roster: ROSTER }));
  assert.ok(presidency.indexOf("Brooklyn R.") >= 0);
  assert.ok(presidency.indexOf("Choose Class After Review") >= 0);
  assert.equal(presidency.indexOf("selected\">Gatherers of Light"), -1);
});

test("prepared database migration is present and marked unapplied", function () {
  var sql = fs.readFileSync(path.join(__dirname, "migrations/001_yw_signups.sql"), "utf8");
  assert.ok(sql.indexOf("NOT APPLIED") >= 0);
  assert.ok(sql.indexOf("yw_claim_slot") >= 0);
  assert.ok(sql.indexOf("row level security") >= 0 || sql.indexOf("ROW LEVEL SECURITY") >= 0);
});
