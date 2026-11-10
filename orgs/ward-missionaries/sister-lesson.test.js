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

test("the public list shows a reserved family's name and never phone, address, source, or docSync", function () {
  var db = memory([{
    date: "2026-11-12",
    status: "reserved",
    name: "Hidden Family",
    phone: "801-555-0199",
    address: "742 Evergreen Terrace",
    source: "doc",
    docSync: "from-doc 3rd secret-sync",
    claimedAt: "2026-11-10T00:00:00.000Z"
  }, {
    date: "2026-11-13",
    status: "reserved",
    name: "801-555-0177",
    phone: "801-555-0177",
    address: "15 Oak Street",
    source: "hub",
    docSync: "in-doc secret-sync"
  }, {
    date: "2026-11-16",
    status: "reserved",
    name: "15 Elm Street",
    phone: "801-555-0133",
    address: "15 Elm Street",
    source: "doc",
    docSync: "from-doc secret-sync"
  }, {
    date: "2026-11-17",
    status: "open",
    name: "",
    phone: "",
    address: "9 Pine Road",
    source: "hub",
    docSync: "pending-secret-sync"
  }]);
  var res = call(db, { op: "list" });
  assert.equal(res.status, 200);
  var text = publicText(res.body);
  ["801-555-0199", "801-555-0177", "801-555-0133", "Evergreen", "Oak Street", "Elm Street", "Pine Road",
    "secret-sync", "from-doc", "in-doc", "pending-secret", "claimedAt", "\"phone\"", "\"address\"", "\"source\"", "\"docSync\""
  ].forEach(function (secret) {
    assert.equal(text.indexOf(secret), -1, secret);
  });
  res.body.nights.forEach(function (night) {
    assert.equal(night.phone, undefined);
    assert.equal(night.address, undefined);
    assert.equal(night.source, undefined);
    assert.equal(night.docSync, undefined);
    assert.equal(night.time, "7:30 PM");
    assert.ok(night.status === "open" || night.status === "reserved");
    if (night.status !== "reserved") {
      assert.equal(night.name, undefined);
      assert.deepEqual(Object.keys(night).sort(), ["date", "status", "time"]);
    }
  });
  var taken = res.body.nights.find(function (night) { return night.date === "2026-11-12"; });
  assert.equal(taken.status, "reserved");
  assert.equal(taken.name, "Hidden Family");
  assert.deepEqual(Object.keys(taken).sort(), ["date", "name", "status", "time"]);
  ["2026-11-13", "2026-11-16"].forEach(function (date) {
    var poisoned = res.body.nights.find(function (night) { return night.date === date; });
    assert.equal(poisoned.status, "reserved");
    assert.equal(poisoned.name, undefined);
    assert.deepEqual(Object.keys(poisoned).sort(), ["date", "status", "time"]);
  });
  var open = res.body.nights.find(function (night) { return night.date === "2026-11-17"; });
  assert.equal(open.status, "open");
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
  assert.equal(text.indexOf("555-0142"), -1);
  assert.equal(text.indexOf("Evergreen"), -1);
  assert.equal(text.indexOf("\"phone\""), -1);
  assert.equal(text.indexOf("\"address\""), -1);
  assert.equal(text.indexOf("\"source\""), -1);
  assert.equal(text.indexOf("\"docSync\""), -1);
  var shown = res.body.nights.find(function (night) { return night.date === "2026-11-11"; });
  assert.equal(shown.status, "reserved");
  assert.equal(shown.name, "Patricia Quinn");
  assert.deepEqual(Object.keys(shown).sort(), ["date", "name", "status", "time"]);
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
  var againText = publicText(again.body);
  assert.equal(againText.indexOf("Someone Else"), -1);
  assert.equal(againText.indexOf("555-0100"), -1);
  assert.equal(againText.indexOf("555-0111"), -1);
  assert.equal(againText.indexOf("\"phone\""), -1);
  assert.equal(againText.indexOf("\"address\""), -1);
  var reservedNight = again.body.nights.find(function (night) { return night.date === "2026-11-13"; });
  assert.equal(reservedNight.name, "Jane");
  assert.deepEqual(Object.keys(reservedNight).sort(), ["date", "name", "status", "time"]);
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
  assert.ok(home.indexOf('href="orgs/ward-missionaries/#sister-lesson"') >= 0);
  var page = fs.readFileSync(path.join(dir, "index.html"), "utf8");
  assert.ok(page.indexOf('id="sister-lesson"') >= 0);
  assert.ok(page.indexOf("Have the Sister Missionaries Over") >= 0);
  assert.ok(page.indexOf("Sister Pettingill and Sister Faku") >= 0);
  assert.ok(page.indexOf("The family's name shows on the list once a night is reserved.") >= 0);
  assert.ok(page.indexOf("Phone numbers and addresses are never shown.") >= 0);
  assert.equal(page.indexOf("Your address stays off the public page."), -1);
  assert.equal(page.indexOf("names stay private"), -1);
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

test("public nights keep a display name through a second pass and still drop phone and address", function () {
  var first = Lesson.publicNights([{
    date: "2026-11-18",
    status: "reserved",
    name: "  Ada   Family ",
    phone: "801-555-0182",
    address: "742 Evergreen Terrace",
    source: "hub",
    docSync: "in-doc secret-sync",
    claimedAt: "2026-11-10T00:00:00.000Z"
  }, {
    date: "2026-11-19",
    status: "open",
    name: "Should Stay Hidden",
    phone: "801-555-0183",
    address: "1 Secret Road",
    source: "doc",
    docSync: "from-doc secret-sync"
  }], NOW);
  first[0].phone = "801-555-0182";
  first[0].address = "742 Evergreen Terrace";
  first[0].source = "hub";
  first[0].docSync = "in-doc secret-sync";
  var second = Lesson.publicNights(first, NOW);
  var text = JSON.stringify(second);
  ["801-555-0182", "801-555-0183", "Evergreen", "Secret Road", "Should Stay Hidden", "secret-sync", "\"phone\"", "\"address\"", "\"source\"", "\"docSync\""].forEach(function (secret) {
    assert.equal(text.indexOf(secret), -1, secret);
  });
  assert.equal(second.find(function (night) { return night.date === "2026-11-18"; }).name, "Ada Family");
  assert.equal(second.find(function (night) { return night.date === "2026-11-19"; }).name, undefined);
});

test("the page shows the reserved family's name under Reserved and never a phone or address", function () {
  var vm = require("vm");
  var fixed = Date.parse("2026-11-10T20:00:00Z");
  function FakeDate(y, m, d, h, min, s, ms) {
    if (!(this instanceof FakeDate)) return new Date();
    var inst = arguments.length === 0 ? new Date(fixed)
      : arguments.length === 1 ? new Date(y)
      : new Date(y, m, d, h || 0, min || 0, s || 0, ms || 0);
    return inst;
  }
  FakeDate.UTC = Date.UTC;
  FakeDate.parse = Date.parse;
  FakeDate.now = function () { return fixed; };
  FakeDate.prototype = Date.prototype;

  function makeEl(tag) {
    var el = {
      tag: tag,
      id: "",
      hidden: false,
      className: "",
      value: "",
      disabled: false,
      type: "",
      children: [],
      attributes: {},
      listeners: {},
      _text: "",
      parent: null,
      appendChild: function (child) { this.children.push(child); child.parent = this; return child; },
      setAttribute: function (key, value) { this.attributes[key] = String(value); },
      getAttribute: function (key) { return Object.prototype.hasOwnProperty.call(this.attributes, key) ? this.attributes[key] : null; },
      addEventListener: function (type, fn) { (this.listeners[type] = this.listeners[type] || []).push(fn); },
      focus: function () {},
      scrollIntoView: function () {}
    };
    Object.defineProperty(el, "textContent", {
      get: function () { return el._text; },
      set: function (value) { el._text = value == null ? "" : String(value); el.children = []; }
    });
    return el;
  }
  var ids = {};
  ["sister-list-msg", "sister-form-error", "sister-nights", "sister-form", "sister-list", "sister-picked-date", "sister-name", "sister-phone", "sister-submit"].forEach(function (id) {
    ids[id] = makeEl("div");
    ids[id].id = id;
  });
  var document = {
    getElementById: function (id) { return ids[id] || null; },
    createElement: function (tag) { return makeEl(tag); },
    addEventListener: function () {}
  };
  var sandbox = {
    console: console,
    document: document,
    fetch: function () {
      return Promise.resolve({
        json: function () {
          return Promise.resolve({ ok: true, nights: [{ date: "2026-11-12", status: "reserved" }] });
        }
      });
    },
    SISTER_LESSON_CONFIG: { scriptUrl: "https://script.google.com/macros/s/TEST/exec" }
  };
  vm.createContext(sandbox);
  sandbox.Date = FakeDate;
  sandbox.window = sandbox;
  vm.runInContext(fs.readFileSync(path.join(__dirname, "apps-script/SisterLesson.js"), "utf8"), sandbox);
  sandbox.SisterLesson.publicNights = function () {
    return [
      { date: "2026-11-12", time: "7:30 PM", status: "reserved", name: "Nora Family", phone: "801-555-0148", address: "742 Evergreen Terrace", source: "hub", docSync: "in-doc secret-sync" },
      { date: "2026-11-13", time: "7:30 PM", status: "open", name: "Open Family", phone: "801-555-0166", address: "15 Oak Street", source: "doc", docSync: "from-doc secret-sync" },
      { date: "2026-11-16", time: "7:30 PM", status: "reserved", name: "801-555-0191", phone: "801-555-0191", address: "9 Pine Road" },
      { date: "2026-11-17", time: "7:30 PM", status: "reserved", name: "15 Elm Street", phone: "801-555-0130", address: "15 Elm Street" }
    ];
  };
  vm.runInContext(fs.readFileSync(path.join(__dirname, "sister-lesson.js"), "utf8"), sandbox);
  return new Promise(function (resolve) { setTimeout(resolve, 30); }).then(function () {
    var names = [];
    var dumped = [];
    function walk(node) {
      if (!node || typeof node !== "object") return;
      dumped.push(node._text || "");
      Object.keys(node.attributes || {}).forEach(function (key) { dumped.push(node.attributes[key]); });
      if (node.className === "sl-who") names.push(node._text);
      (node.children || []).forEach(walk);
    }
    walk(ids["sister-nights"]);
    var blob = dumped.join("\n");
    ["801-555-0148", "801-555-0166", "801-555-0191", "801-555-0130", "Evergreen", "Oak Street", "Pine Road", "Elm Street",
      "Open Family", "secret-sync", "in-doc", "from-doc", "hub", "phone", "address", "docSync"
    ].forEach(function (secret) {
      assert.equal(blob.indexOf(secret), -1, secret);
    });
    assert.deepEqual(names, ["Nora Family"]);
    assert.ok(blob.indexOf("Reserved, Nora Family,") >= 0);
    var reserved = 0;
    var signup = 0;
    function count(node) {
      if (!node || typeof node !== "object") return;
      if (node.tag === "button" && node._text === "Reserved") reserved += 1;
      if (node.tag === "button" && node._text === "Sign Up") signup += 1;
      (node.children || []).forEach(count);
    }
    count(ids["sister-nights"]);
    assert.equal(reserved, 3);
    assert.equal(signup, 1);
  });
});
