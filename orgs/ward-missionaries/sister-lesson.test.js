/* Sister lesson rules. Not a live Google call.
   Run: node --test orgs/ward-missionaries/sister-lesson.test.js */
"use strict";

var test = require("node:test");
var assert = require("node:assert/strict");
var fs = require("fs");
var path = require("path");
var Lesson = require("./apps-script/SisterLesson.js");

var NOW = new Date("2026-11-10T18:00:00Z");

function expectedDates() {
  var out = [];
  var d = new Date(Date.UTC(2026, 10, 11));
  var end = Date.UTC(2026, 11, 31);
  while (d.getTime() <= end) {
    var day = d.getUTCDay();
    if (day >= 1 && day <= 5) {
      var m = String(d.getUTCMonth() + 1).padStart(2, "0");
      var dayNum = String(d.getUTCDate()).padStart(2, "0");
      out.push(d.getUTCFullYear() + "-" + m + "-" + dayNum);
    }
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return out;
}
function memory(seed) {
  var data = JSON.parse(JSON.stringify(seed || []));
  var saves = 0;
  return {
    saves: function () { return saves; },
    read: function () { return JSON.parse(JSON.stringify(data)); },
    loadNights: function () { return JSON.parse(JSON.stringify(data)); },
    saveNights: function (next) { data = JSON.parse(JSON.stringify(next)); saves += 1; }
  };
}
function call(db, body, now, notify) {
  return Lesson.handle({
    body: body,
    now: now || NOW,
    loadNights: db.loadNights,
    saveNights: db.saveNights,
    notify: notify
  });
}
function publicText(body) { return JSON.stringify(body); }

test("weeknights run Monday through Friday from 11 November through 31 December 2026", function () {
  var nights = Lesson.buildNights();
  var dates = nights.map(function (night) { return night.date; });
  assert.deepEqual(dates, expectedDates());
  assert.equal(dates[0], "2026-11-11");
  assert.equal(dates[dates.length - 1], "2026-12-31");
  assert.equal(dates.indexOf("2026-11-14"), -1);
  assert.equal(dates.indexOf("2026-11-15"), -1);
  assert.ok(dates.indexOf("2026-11-16") >= 0);
  assert.ok(dates.indexOf("2026-11-18") >= 0);
  nights.forEach(function (night) {
    assert.equal(night.status, "open");
    assert.equal(night.time, "7:30 PM");
    assert.equal(night.name, "");
    assert.equal(night.phone, "");
    var day = new Date(night.date + "T12:00:00Z").getUTCDay();
    assert.ok(day >= 1 && day <= 5);
  });
  assert.equal(Lesson.formatDate("2026-11-11"), "Wednesday, November 11");
  assert.equal(Lesson.formatDate("2026-11-18"), "Wednesday, November 18");
});

test("Denver time decides which nights are still upcoming", function () {
  assert.equal(Lesson.denverYmd(new Date("2026-11-11T06:30:00Z")), "2026-11-10");
  assert.equal(Lesson.denverYmd(new Date("2026-11-11T07:30:00Z")), "2026-11-11");
  var before = Lesson.publicNights(Lesson.buildNights(), new Date("2026-11-12T06:30:00Z"));
  var after = Lesson.publicNights(Lesson.buildNights(), new Date("2026-11-12T07:30:00Z"));
  assert.equal(before[0].date, "2026-11-11");
  assert.equal(after[0].date, "2026-11-12");
});

test("the public list is date, time, and status even when the sheet has a family", function () {
  var db = memory([{
    date: "2026-11-12",
    status: "reserved",
    name: "Hidden Family",
    phone: "801-555-0199",
    address: "742 Evergreen Terrace",
    claimedAt: "2026-11-10T00:00:00.000Z"
  }]);
  var res = call(db, { op: "list" });
  assert.equal(res.status, 200);
  var text = publicText(res.body);
  assert.equal(text.indexOf("Hidden Family"), -1);
  assert.equal(text.indexOf("801-555-0199"), -1);
  assert.equal(text.indexOf("Evergreen"), -1);
  assert.equal(text.indexOf("address"), -1);
  res.body.nights.forEach(function (night) {
    assert.deepEqual(Object.keys(night).sort(), ["date", "status", "time"]);
    assert.equal(night.time, "7:30 PM");
    assert.ok(night.status === "open" || night.status === "reserved");
  });
  var taken = res.body.nights.find(function (night) { return night.date === "2026-11-12"; });
  assert.equal(taken.status, "reserved");
  assert.equal(db.saves(), 0);
});

test("a claim stores the name and phone privately and tells the webhook", function () {
  var db = memory([]);
  var notified = null;
  var res = call(db, {
    op: "claim",
    date: "2026-11-11",
    name: "  Patricia   Quinn ",
    phone: "(801) 555-0142",
    address: "742 Evergreen Terrace"
  }, NOW, function (payload) {
    assert.equal(db.saves(), 1);
    notified = payload;
  });
  assert.equal(res.status, 200);
  assert.equal(res.body.message, "You're Signed Up.");
  var text = publicText(res.body);
  assert.equal(text.indexOf("Patricia"), -1);
  assert.equal(text.indexOf("555-0142"), -1);
  assert.equal(text.indexOf("Evergreen"), -1);
  var shown = res.body.nights.find(function (night) { return night.date === "2026-11-11"; });
  assert.equal(shown.status, "reserved");
  var stored = db.read().find(function (night) { return night.date === "2026-11-11"; });
  assert.equal(stored.name, "Patricia Quinn");
  assert.equal(stored.phone, "801-555-0142");
  assert.equal(stored.status, "reserved");
  assert.equal(stored.address, undefined);
  assert.deepEqual(notified, {
    type: "sister-lesson-signup",
    name: "Patricia Quinn",
    phone: "801-555-0142",
    date: "2026-11-11",
    time: "7:30 PM"
  });
  assert.equal(db.read().some(function (night) { return night.date === "2026-11-18" && night.status !== "open"; }), false);
});

test("a second family cannot take a reserved night and a failed claim does not text", function () {
  var db = memory([]);
  var texts = 0;
  function notify() { texts += 1; }
  assert.equal(call(db, { op: "claim", date: "2026-11-13", name: "Jane", phone: "801-555-0100" }, NOW, notify).status, 200);
  var again = call(db, { op: "claim", date: "2026-11-13", name: "Someone Else", phone: "801-555-0111" }, NOW, notify);
  assert.equal(again.status, 409);
  assert.equal(again.body.error, "reserved");
  assert.equal(publicText(again.body).indexOf("Jane"), -1);
  assert.equal(publicText(again.body).indexOf("Someone Else"), -1);
  assert.equal(db.read().find(function (night) { return night.date === "2026-11-13"; }).phone, "801-555-0100");
  assert.equal(texts, 1);
  assert.equal(db.saves(), 1);
});

test("weekends, past nights, addresses, and missing phones are refused", function () {
  var db = memory([]);
  var texts = 0;
  function notify() { texts += 1; }
  assert.equal(call(db, { op: "claim", date: "2026-11-14", name: "Jane", phone: "801-555-0100" }, NOW, notify).status, 400);
  assert.equal(call(db, { op: "claim", date: "2026-11-15", name: "Jane", phone: "801-555-0100" }, NOW, notify).status, 400);
  assert.equal(call(db, { op: "claim", date: "2026-11-11", name: "Jane", phone: "801-555-0100" }, new Date("2026-11-12T08:00:00Z"), notify).status, 400);
  assert.equal(call(db, { op: "claim", date: "2026-11-11", name: "742 Evergreen Terrace", phone: "801-555-0100" }, NOW, notify).body.message, "Leave Your Address Off This Page.");
  assert.equal(call(db, { op: "claim", date: "2026-11-11", name: "J", phone: "801-555-0100" }, NOW, notify).body.message, "Enter Your Name.");
  assert.equal(call(db, { op: "claim", date: "2026-11-11", name: "Jane", phone: "555-0100" }, NOW, notify).status, 400);
  assert.equal(call(db, { op: "claim", date: "2027-01-01", name: "Jane", phone: "801-555-0100" }, NOW, notify).status, 400);
  assert.equal(db.saves(), 0);
  assert.equal(texts, 0);
});

test("a webhook failure still keeps the reservation", function () {
  var db = memory([]);
  var res = call(db, { op: "claim", date: "2026-11-16", name: "Jane", phone: "8015550100" }, NOW, function () {
    throw new Error("https://webhook.example/secret");
  });
  assert.equal(res.status, 200);
  assert.equal(publicText(res.body).indexOf("webhook.example"), -1);
  assert.equal(db.read().find(function (night) { return night.date === "2026-11-16"; }).status, "reserved");
  assert.equal(db.read().find(function (night) { return night.date === "2026-11-16"; }).phone, "801-555-0100");
});

test("a claim with no notify function still saves", function () {
  var db = memory([]);
  var res = Lesson.handle({
    body: { op: "claim", date: "2026-11-17", name: "Jane", phone: "801-555-0100" },
    now: NOW,
    loadNights: db.loadNights,
    saveNights: db.saveNights
  });
  assert.equal(res.status, 200);
  assert.equal(db.saves(), 1);
});

test("the public page and config do not carry the old doc, a webhook, or a sheet id", function () {
  var dir = __dirname;
  ["index.html", "sister-lesson.js", "sister-lesson-config.js"].forEach(function (file) {
    var text = fs.readFileSync(path.join(dir, file), "utf8");
    assert.equal(text.indexOf("1ty2rlUhx5cjsyA8UPWuL36PUtyH1O0ZIKVZHEuuYnHQ"), -1, file);
    assert.equal(text.indexOf("WEBHOOK_URL"), -1, file);
    assert.equal(text.indexOf("WEBHOOK_KEY"), -1, file);
    assert.equal(text.indexOf("SHEET_ID"), -1, file);
    assert.equal(text.indexOf("localStorage"), -1, file);
    assert.equal(text.indexOf("innerHTML"), -1, file);
  });
  var config = fs.readFileSync(path.join(dir, "sister-lesson-config.js"), "utf8");
  var scriptUrl = (config.match(/scriptUrl:\s*"([^"]*)"/) || [])[1];
  assert.match(scriptUrl, /^https:\/\/script\.google\.com\/macros\/s\/[A-Za-z0-9_-]+\/exec$/);
  assert.equal(config.indexOf("YOUR_SISTER_LESSON_WEB_APP_EXEC_URL"), -1);
  var home = fs.readFileSync(path.join(dir, "../../index.html"), "utf8");
  assert.equal(home.indexOf("1ty2rlUhx5cjsyA8UPWuL36PUtyH1O0ZIKVZHEuuYnHQ"), -1);
  assert.equal(home.indexOf("President Larsen"), -1);
  assert.ok(home.indexOf('href="orgs/ward-missionaries/"') >= 0);
  assert.equal(home.indexOf("Sister Pettingill"), -1);
  assert.equal(home.indexOf("Sister Faku"), -1);
  var page = fs.readFileSync(path.join(dir, "index.html"), "utf8");
  assert.ok(page.indexOf('id="sister-lesson"') >= 0);
  assert.ok(page.indexOf("Have the Missionaries Over") >= 0);
  assert.equal(page.indexOf("Sister Pettingill"), -1);
  assert.equal(page.indexOf("Sister Faku"), -1);
  assert.ok(page.indexOf("The missionaries would love to share a gospel lesson in your home") >= 0);
  assert.ok(page.indexOf("Your address stays off the public page.") >= 0);
  assert.ok(page.indexOf("Sign Up For This Night") >= 0);
  assert.equal(page.indexOf('name="address"'), -1);
  assert.equal(page.indexOf("placeholder=\"801-555-0100\""), page.lastIndexOf("placeholder=\"801-555-0100\""));
  var code = fs.readFileSync(path.join(dir, "apps-script/Code.js"), "utf8");
  assert.ok(code.indexOf('getProperty("WEBHOOK_URL")') >= 0);
  assert.ok(code.indexOf('getProperty("WEBHOOK_KEY")') >= 0);
  assert.ok(code.indexOf('getProperty("SHEET_ID")') >= 0);
  assert.ok(code.indexOf('url.indexOf("https://")') >= 0);
  assert.equal(code.indexOf("docs.google.com"), -1);
  assert.equal(code.indexOf("script.google.com/macros"), -1);
  assert.equal(code.indexOf("localStorage"), -1);
});
