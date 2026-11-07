/* Handler tests for private-link sign-ups. Not live Google calls.
   Run: node --test orgs/young-women/chat/signup-api.test.js */
"use strict";

var test = require("node:test");
var assert = require("node:assert/strict");
var crypto = require("crypto");
var fs = require("fs");
var path = require("path");
require("./signups.js");
var Api = require("./signup-api.js");

function hashToken(token) {
  return crypto.createHash("sha256").update(String(token)).digest("hex");
}

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
function call(db, who, body) {
  return Api.handleSignupRequest({
    body: Object.assign({ linkToken: TOKENS[who] || who }, body || {}),
    now: NOW,
    loadStore: db.loadStore,
    saveStore: db.saveStore,
    hashToken: hashToken
  });
}
var TOKENS = {
  leader: "leader-token-0123456789abcdef",
  presley: "presley-token-0123456789abcdef",
  two: "youth-two-token-0123456789abcdef",
  lucy: "lucy-token-0123456789abcdef",
  parent: "parent-token-0123456789abcdef",
  stranger: "stranger-token-0123456789abcdef",
  revoked: "revoked-token-0123456789abcdef"
};
function seed() {
  var store = Api.blankStore(NOW);
  store.users = [
    { id: "m-owner", email: "leader@example.test", name: "Ward Leader", role: "moderator", kind: "adult", status: "active" },
    { id: "m-presley", email: "presley@example.test", name: "Presley P.", role: "youth", kind: "youth", classId: "gatherers", status: "active", phone: "555-0199" },
    { id: "m-two", email: "two@example.test", name: "Test Youth Two", role: "youth", kind: "youth", classId: "gatherers", status: "active" },
    { id: "m-lucy", email: "lucy@example.test", name: "Lucy", role: "youth", kind: "youth", classId: "messengers", status: "active" },
    { id: "m-parent", email: "parent@example.test", name: "Parent of Presley", role: "parent", kind: "adult", status: "active", childIds: ["m-presley"] }
  ];
  store.links = ["leader", "presley", "two", "lucy", "parent"].map(function (who, i) {
    return { id: "lk-" + who, memberId: store.users[i].id, tokenHash: hashToken(TOKENS[who]), status: "active" };
  });
  store.links.push({ id: "lk-revoked", memberId: "m-presley", tokenHash: hashToken(TOKENS.revoked), status: "revoked" });
  return store;
}

test("a stranger and a missing token are rejected and nothing is saved", function () {
  var db = memory(seed());
  assert.equal(call(db, "", { op: "view" }, TOKENS).status, 401);
  var stranger = call(db, "stranger", { op: "view" });
  assert.equal(stranger.status, 401);
  var revoked = call(db, "revoked", { op: "view" });
  assert.equal(revoked.status, 401);
  assert.equal(db.saves(), 0);
  assert.equal(JSON.stringify(stranger.body).indexOf("@"), -1);
});

test("youth see only their class and no email addresses", function () {
  var db = memory(seed());
  var res = call(db, "presley", { op: "view" });
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
  var first = call(db, "presley", { op: "view" });
  var lesson = first.body.view.prominent.groups.find(function (g) { return g.typeId === "lesson"; });
  var slot = lesson.slots[0];
  var denied = call(db, "lucy", { op: "mutate", version: first.body.view.version, action: {
    type: "claim", entryId: lesson.entryId, slotId: slot.id, expectedUserId: null, expectedSlotVersion: slot.version
  } });
  assert.equal(denied.status, 403);
  assert.equal(db.saves(), 0);
  var claimed = call(db, "presley", { op: "mutate", version: first.body.view.version, action: {
    type: "claim", entryId: lesson.entryId, slotId: slot.id, expectedUserId: null, expectedSlotVersion: slot.version
  } });
  assert.equal(claimed.status, 200);
  var again = call(db, "parent", { op: "view" }, TOKENS);
  var seen = JSON.stringify(again.body.view);
  assert.ok(seen.indexOf("Presley P.") >= 0);
  assert.equal(seen.indexOf("@"), -1);
  var parentClaim = call(db, "parent", { op: "mutate", version: again.body.view.version, action: {
    type: "claim", entryId: lesson.entryId, slotId: slot.id, expectedUserId: null, expectedSlotVersion: 0
  } });
  assert.equal(parentClaim.status, 403);
});

test("two clients cannot both win the same spot", function () {
  var db = memory(seed());
  var view = call(db, "presley", { op: "view" }).body.view;
  var lesson = view.prominent.groups.find(function (g) { return g.typeId === "lesson"; });
  var slot = lesson.slots[0];
  var action = { type: "claim", entryId: lesson.entryId, slotId: slot.id, expectedUserId: null, expectedSlotVersion: slot.version };
  var a = call(db, "presley", { op: "mutate", version: view.version, action: action });
  var b = call(db, "two", { op: "mutate", version: view.version, action: action });
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
  var added = call(db, "presley", { op: "add-member", name: "New Youth", role: "youth", classId: "gatherers" });
  assert.equal(added.status, 403);
  assert.equal(db.saves(), 0);
  var leader = call(db, "leader", { op: "add-member", name: "New Youth", role: "youth", classId: "builders", status: "pending" });
  assert.equal(leader.status, 200);
  assert.equal(JSON.stringify(leader.body).indexOf("@"), -1);
  assert.ok(leader.body.members.some(function (m) { return m.name === "New Youth" && m.status === "pending"; }));
  assert.equal(JSON.stringify(db.read().signups).indexOf("Brooke"), -1);
});

test("a pending young woman cannot claim, and the public class list is not access", function () {
  var store = seed();
  store.users.push({ id: "m-wait", email: "wait@example.test", name: "Waiting Youth", role: "youth", kind: "youth", classId: "gatherers", status: "pending" });
  var tokensWait = "waiting-token-0123456789abcdef";
  store.links.push({ id: "lk-wait", memberId: "m-wait", tokenHash: hashToken(tokensWait), status: "active" });
  TOKENS.wait = tokensWait;
  var db = memory(store);
  var view = call(db, "wait", { op: "view" });
  assert.equal(view.status, 200);
  assert.equal(view.body.view.allowed, false);
  assert.equal(JSON.stringify(view.body).indexOf("@"), -1);
  var leader = call(db, "leader", { op: "view" });
  var lesson = leader.body.view.prominent.groups.find(function (g) { return g.classId === "gatherers" && g.typeId === "lesson"; });
  var denied = call(db, "wait", { op: "mutate", version: leader.body.view.version, action: {
    type: "claim", entryId: lesson.entryId, slotId: lesson.slots[0].id, expectedUserId: null, expectedSlotVersion: lesson.slots[0].version
  } });
  assert.notEqual(denied.status, 200);
  assert.equal(db.read().signups.entries.some(function (e) { return e.slots.some(function (s) { return s.userId === "m-wait"; }); }), false);
  var allowed = call(db, "leader", { op: "update-member", memberId: "m-wait", status: "active" });
  assert.equal(allowed.status, 200);
  assert.equal(db.read().users.find(function (u) { return u.id === "m-wait"; }).status, "active");
});

test("invalid and revoked links save nothing, and a youth link cannot take leader power", function () {
  var db = memory(seed());
  assert.equal(call(db, "nope-token-0123456789abcdef", { op: "view" }).status, 401);
  assert.equal(call(db, "revoked", { op: "revoke-link", linkId: "lk-leader" }).status, 401);
  var steal = call(db, "presley", { op: "create-link", memberId: "m-owner", tokenHash: hashToken("stolen-leader-token-0123456789") });
  assert.equal(steal.status, 403);
  var releaseOther = call(db, "presley", { op: "mutate", action: { type: "release", entryId: "none", slotId: "none", expectedUserId: "m-lucy", expectedSlotVersion: 0 } });
  assert.notEqual(releaseOther.status, 200);
  assert.equal(db.saves(), 0);
  var made = call(db, "leader", { op: "create-link", memberId: "m-presley", tokenHash: hashToken("fresh-youth-token-0123456789abcd") });
  assert.equal(made.status, 200);
  assert.equal(JSON.stringify(made.body).indexOf("fresh-youth-token"), -1);
  assert.equal(JSON.stringify(made.body).indexOf(hashToken("fresh-youth-token-0123456789abcd")), -1);
  var stored = db.read().links.filter(function (link) { return link.memberId === "m-presley" && link.status === "active"; });
  assert.ok(stored.some(function (link) { return link.tokenHash === hashToken("fresh-youth-token-0123456789abcd"); }));
  var off = call(db, "leader", { op: "revoke-link", linkId: "lk-presley" });
  assert.equal(off.status, 200);
  assert.equal(call(db, "presley", { op: "view" }).status, 401);
});

test("anyone can read the sheet and claim a spot without a link or account", function () {
  var db = memory(seed());
  function pub(body) {
    return Api.handleSignupRequest({ body: body, now: NOW, loadStore: db.loadStore, saveStore: db.saveStore, hashToken: hashToken });
  }
  var view = pub({ op: "public-view" });
  assert.equal(view.status, 200);
  var text = JSON.stringify(view.body);
  assert.equal(text.indexOf("Ward Leader"), -1);
  assert.equal(text.indexOf("@"), -1);
  assert.equal(text.indexOf("555-"), -1);
  assert.equal(text.indexOf("tokenHash"), -1);
  assert.equal(text.indexOf("releaseHash"), -1);
  assert.equal(view.body.rotationSet, false);
  var entry = view.body.entries.find(function (item) { return item.className === "Gatherers of Light" && item.task === "Lessons" && item.spots[0].open; });
  assert.ok(entry);
  assert.equal(pub({ op: "public-claim", entryId: entry.id, slotId: entry.spots[0].id, expectedSlotVersion: 0, displayName: "a@b.com", releaseHash: hashToken("release-one-0123456789abcdef") }).status, 400);
  assert.equal(db.saves(), 0);
  var hash = hashToken("release-one-0123456789abcdef");
  var claim = pub({ op: "public-claim", entryId: entry.id, slotId: entry.spots[0].id, expectedSlotVersion: 0, displayName: "Sam", releaseHash: hash });
  assert.equal(claim.status, 200);
  assert.ok(JSON.stringify(claim.body).indexOf("Sam") >= 0);
  assert.equal(JSON.stringify(claim.body).indexOf(hash), -1);
  assert.equal(JSON.stringify(claim.body).indexOf("Ward Leader"), -1);
  var clash = pub({ op: "public-claim", entryId: entry.id, slotId: entry.spots[0].id, expectedSlotVersion: 0, displayName: "Other", releaseHash: hashToken("release-two-0123456789abcdef") });
  assert.equal(clash.status, 409);
  assert.equal(pub({ op: "public-release", entryId: entry.id, slotId: entry.spots[0].id, releaseHash: hashToken("wrong-release-0123456789abcdef") }).status, 403);
  assert.equal(pub({ op: "create-link", memberId: "m-owner", tokenHash: hashToken("public-escalation-token-0123456789") }).status, 401);
  assert.equal(db.read().users.length, seed().users.length);
  var slot = db.read().signups.entries.find(function (item) { return item.id === entry.id; }).slots[0];
  assert.equal(slot.displayName, "Sam");
  assert.equal(slot.releaseHash, hash);
  var after = pub({ op: "public-view" });
  assert.equal(JSON.stringify(after.body).indexOf("releaseHash"), -1);
  assert.ok(JSON.stringify(after.body).indexOf("Sam") >= 0);
});

test("a moderator link can add another moderator and a separate link", function () {
  var db = memory(seed());
  var added = call(db, "leader", { op: "add-member", name: "Traci Harward", role: "moderator", status: "active" });
  assert.equal(added.status, 200);
  var traci = db.read().users.filter(function (user) { return user.name === "Traci Harward" && user.role === "moderator"; });
  assert.equal(traci.length, 1);
  var hash = hashToken("traci-leader-token-0123456789abcd");
  var made = call(db, "leader", { op: "create-link", memberId: traci[0].id, tokenHash: hash });
  assert.equal(made.status, 200);
  assert.equal(JSON.stringify(made.body).indexOf(hash), -1);
  assert.equal(JSON.stringify(made.body).indexOf("traci-leader-token"), -1);
  var youth = call(db, "presley", { op: "add-member", name: "Traci Harward", role: "moderator", status: "active" });
  assert.equal(youth.status, 403);
  var stored = db.read().links.filter(function (link) { return link.memberId === traci[0].id && link.status === "active"; });
  assert.equal(stored.length, 1);
  assert.equal(stored[0].tokenHash, hash);
});

test("the leader form is on the sign-up page and the public sheet stays first for everyone else", function () {
  var html = fs.readFileSync(path.join(__dirname, "signup-client.js"), "utf8");
  assert.ok(html.indexOf("Make Private Link") >= 0);
  assert.ok(html.indexOf("Traci Harward") >= 0);
  assert.ok(html.indexOf("afterbegin") >= 0);
  assert.ok(html.indexOf("public-view") >= 0);
  assert.ok(html.indexOf("afterbegin") < html.lastIndexOf("public-view") || html.indexOf("adminHtml()") > 0);
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
