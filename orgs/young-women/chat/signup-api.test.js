/* Handler tests for the sign-up API. These are not live Google tests.
   They call the same function the Apps Script wrapper calls, with a fake token
   check and an in-memory sheet. Run: node --test orgs/young-women/chat/signup-api.test.js */
"use strict";

var test = require("node:test");
var assert = require("node:assert/strict");
var fs = require("fs");
var path = require("path");
require("./signups.js");
var Api = require("./signup-api.js");

var NOW = new Date("2026-11-06T18:00:00Z");

function memory(seed) {
  var data = JSON.parse(JSON.stringify(seed));
  var saves = 0;
  return {
    saves: function () { return saves; },
    read: function () { return JSON.parse(JSON.stringify(data)); },
    loadStore: function () { return JSON.parse(JSON.stringify(data)); },
    saveStore: function (next) { data = JSON.parse(JSON.stringify(next)); saves += 1; }
  };
}
function verify(map) {
  return function (token) {
    if (!map[token]) throw new Error("bad");
    return { email: map[token] };
  };
}
function call(db, token, body, map) {
  return Api.handleSignupRequest({
    body: Object.assign({ idToken: token }, body),
    now: NOW,
    loadStore: db.loadStore,
    saveStore: db.saveStore,
    verifyToken: verify(map)
  });
}
function seed() {
  var store = Api.blankStore(NOW);
  store.users = [
    { id: "m-owner", email: "leader@example.test", name: "Ward Leader", role: "moderator", kind: "adult", status: "active" },
    { id: "m-presley", email: "presley@example.test", name: "Presley P.", role: "youth", kind: "youth", classId: "gatherers", status: "active", phone: "555-0199" },
    { id: "m-two", email: "two@example.test", name: "Test Youth Two", role: "youth", kind: "youth", classId: "gatherers", status: "active" },
    { id: "m-lucy", email: "lucy@example.test", name: "Lucy", role: "youth", kind: "youth", classId: "messengers", status: "active" },
    { id: "m-parent", email: "parent@example.test", name: "Parent of Presley", role: "parent", kind: "adult", status: "active", childIds: ["m-presley"] }
  ];
  return store;
}
var TOKENS = {
  leader: "leader@example.test",
  presley: "presley@example.test",
  two: "two@example.test",
  lucy: "lucy@example.test",
  parent: "parent@example.test",
  stranger: "stranger@example.test"
};

test("a stranger and a missing token are rejected and nothing is saved", function () {
  var db = memory(seed());
  assert.equal(call(db, "", { op: "view" }, TOKENS).status, 401);
  var stranger = call(db, "stranger", { op: "view" }, TOKENS);
  assert.equal(stranger.status, 403);
  assert.equal(db.saves(), 0);
  assert.equal(JSON.stringify(stranger.body).indexOf("@"), -1);
});

test("youth see only their class and no email addresses", function () {
  var db = memory(seed());
  var res = call(db, "presley", { op: "view" }, TOKENS);
  assert.equal(res.status, 200);
  assert.equal(res.body.members, null);
  var text = JSON.stringify(res.body);
  assert.equal(text.indexOf("@"), -1);
  assert.equal(text.indexOf("555-"), -1);
  assert.equal(text.indexOf("Lucy"), -1);
  assert.equal(text.indexOf("messengers"), -1);
  assert.equal(res.body.view.shared, true);
  var html = require("./signups.js").renderHtml(res.body.view);
  assert.ok(html.indexOf("Saved For The Ward") >= 0);
  assert.equal(html.indexOf("localStorage"), -1);
  assert.equal(res.body.view.review, null);
});

test("cross-class claim is forbidden and a same-class claim persists for the next reader", function () {
  var db = memory(seed());
  var first = call(db, "presley", { op: "view" }, TOKENS);
  var lesson = first.body.view.prominent.groups.find(function (g) { return g.typeId === "lesson"; });
  var slot = lesson.slots[0];
  var denied = call(db, "lucy", { op: "mutate", version: first.body.view.version, action: {
    type: "claim", entryId: lesson.entryId, slotId: slot.id, expectedUserId: null, expectedSlotVersion: slot.version
  } }, TOKENS);
  assert.equal(denied.status, 403);
  assert.equal(db.saves(), 0);
  var claimed = call(db, "presley", { op: "mutate", version: first.body.view.version, action: {
    type: "claim", entryId: lesson.entryId, slotId: slot.id, expectedUserId: null, expectedSlotVersion: slot.version
  } }, TOKENS);
  assert.equal(claimed.status, 200);
  var again = call(db, "parent", { op: "view" }, TOKENS);
  var seen = JSON.stringify(again.body.view);
  assert.ok(seen.indexOf("Presley P.") >= 0);
  assert.equal(seen.indexOf("@"), -1);
  var parentClaim = call(db, "parent", { op: "mutate", version: again.body.view.version, action: {
    type: "claim", entryId: lesson.entryId, slotId: slot.id, expectedUserId: null, expectedSlotVersion: 0
  } }, TOKENS);
  assert.equal(parentClaim.status, 403);
});

test("two clients cannot both win the same spot", function () {
  var db = memory(seed());
  var view = call(db, "presley", { op: "view" }, TOKENS).body.view;
  var lesson = view.prominent.groups.find(function (g) { return g.typeId === "lesson"; });
  var slot = lesson.slots[0];
  var action = { type: "claim", entryId: lesson.entryId, slotId: slot.id, expectedUserId: null, expectedSlotVersion: slot.version };
  var a = call(db, "presley", { op: "mutate", version: view.version, action: action }, TOKENS);
  var b = call(db, "two", { op: "mutate", version: view.version, action: action }, TOKENS);
  assert.equal(a.status, 200);
  assert.equal(b.status, 409);
  var stored = db.read().signups.entries.find(function (e) { return e.id === lesson.entryId; }).slots[0].userId;
  assert.equal(stored, "m-presley");
});

test("the paper sheet is not applied and youth cannot edit the ward list", function () {
  var db = memory(seed());
  var text = JSON.stringify(db.read().signups);
  assert.equal(text.indexOf("Brooke"), -1);
  assert.equal(text.indexOf("Brooklin"), -1);
  assert.equal(db.read().signups.review.status, "unapplied");
  var added = call(db, "presley", { op: "add-member", name: "Brooke", email: "brooke@example.test", role: "youth", classId: "gatherers" }, TOKENS);
  assert.equal(added.status, 403);
  assert.equal(db.saves(), 0);
  var leader = call(db, "leader", { op: "add-member", name: "New Youth", email: "new@example.test", role: "youth", classId: "builders" }, TOKENS);
  assert.equal(leader.status, 200);
  assert.ok(leader.body.members.some(function (m) { return m.email === "new@example.test"; }));
  assert.equal(JSON.stringify(db.read().signups).indexOf("Brooke"), -1);
});

test("the not-connected page does not call this phone the sign-up store", function () {
  var html = fs.readFileSync(path.join(__dirname, "signup-client.js"), "utf8");
  assert.ok(html.indexOf("Sign-Ups Are Not Connected") >= 0);
  assert.ok(html.indexOf("Nothing is saved on this phone") >= 0);
  assert.equal(html.indexOf("localStorage"), -1);
});

test("apps script copies match the tested rules and handler", function () {
  function same(a, b) {
    assert.equal(fs.readFileSync(path.join(__dirname, a), "utf8"), fs.readFileSync(path.join(__dirname, b), "utf8"));
  }
  same("signups.js", "apps-script/Signups.js");
  same("signup-api.js", "apps-script/SignupApi.js");
});
