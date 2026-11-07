/* Rules for the Sister Missionary lesson form. No network and no live Google call. */
var assert = require("node:assert/strict");
var fs = require("node:fs");
var path = require("node:path");
var test = require("node:test");
var Lesson = require("./lesson.js");
var availability = require("./availability.js");

var TODAY = "2026-11-07";
var schedule = Lesson.expandSchedule(availability);

function good(over) {
  return Object.assign({
    date: "2026-11-11",
    time: "7:30",
    name: "Layout Test",
    ward: "6th",
    address: "100 Test Street"
  }, over || {});
}

function memory() {
  var box = {};
  return {
    getItem: function (key) { return Object.prototype.hasOwnProperty.call(box, key) ? box[key] : null; },
    setItem: function (key, value) { box[key] = String(value); },
    removeItem: function (key) { delete box[key]; }
  };
}

test("the snapshot is weekdays only and hides every personal field", function () {
  assert.equal(availability.checkedOn, "2026-11-07");
  assert.deepEqual(availability.taken, ["2026-11-09", "2026-11-10"]);
  assert.equal(JSON.stringify(availability).indexOf("name"), -1);
  assert.equal(JSON.stringify(availability).indexOf("address"), -1);
  assert.equal(schedule.slots.length, 39);
  schedule.slots.forEach(function (slot) {
    assert.ok(Lesson.weekday(slot.date) >= 1 && Lesson.weekday(slot.date) <= 5);
    assert.deepEqual(Object.keys(slot).sort(), ["date", "status"]);
    assert.ok(slot.status === "open" || slot.status === "taken");
  });
  assert.equal(schedule.slots.filter(function (s) { return s.status === "taken"; }).length, 2);
  assert.equal(schedule.slots.filter(function (s) { return s.status === "open"; }).length, 37);
});

test("open choices omit taken evenings, past evenings, and weekends", function () {
  var groups = Lesson.choiceGroups(schedule, TODAY);
  var dates = groups.flatMap(function (g) { return g.slots.map(function (s) { return s.date; }); });
  assert.equal(dates.indexOf("2026-11-09"), -1);
  assert.equal(dates.indexOf("2026-11-10"), -1);
  assert.equal(dates.indexOf("2026-11-08"), -1);
  assert.ok(dates.indexOf("2026-11-11") >= 0);
  assert.equal(dates.length, 37);
  assert.equal(groups[0].title, "Week Of November 9");
  assert.deepEqual(groups[0].slots.map(function (s) { return s.date; }), ["2026-11-11", "2026-11-12", "2026-11-13"]);
  assert.equal(groups[0].slots[0].label, "Wednesday, November 11");
  var later = Lesson.choiceGroups(schedule, "2026-11-12").flatMap(function (g) { return g.slots.map(function (s) { return s.date; }); });
  assert.equal(later.indexOf("2026-11-11"), -1);
  assert.ok(later.indexOf("2026-11-12") >= 0);
});

test("validation asks for an open evening, a time, a name, a ward, and a numbered address", function () {
  var slots = schedule.slots;
  function error(input, today) {
    return Lesson.validate(input, { slots: slots, today: today || TODAY }).error;
  }
  assert.equal(error({}), "Choose An Open Evening.");
  assert.equal(error(good({ date: "" })), "Choose An Open Evening.");
  assert.equal(error(good({ date: "2026-11-09" })), "That Evening Is Already Taken.");
  assert.equal(error(good({ date: "2026-11-08" })), "That Evening Is Not On The Schedule.");
  assert.equal(error(good({ date: "2026-11-11" }), "2026-11-12"), "That Evening Has Passed.");
  assert.equal(error(good({ time: "" })), "Choose A Time.");
  assert.equal(error(good({ time: "9:15" })), "Choose A Time.");
  assert.equal(error(good({ name: "A" })), "Enter Your Name.");
  assert.equal(error(good({ name: "A".repeat(81) })), "Use 80 Characters Or Fewer For Your Name.");
  assert.equal(error(good({ ward: " " })), "Enter Your Ward.");
  assert.equal(error(good({ address: "Farmington" })), "Enter The Home Address, Including The Number.");
  assert.equal(error(good({ website: "https://spam.example" })), "Could Not Save.");
  var ok = Lesson.validate(good(), { slots: slots, today: TODAY });
  assert.equal(ok.ok, true);
  assert.equal(ok.value.name, "Layout Test");
  assert.equal(ok.value.address, "100 Test Street");
});

test("an empty script url saves a draft and does not claim the schedule accepted it", function () {
  var plan = Lesson.planSubmit(good(), { schedule: schedule, today: TODAY, scriptUrl: "" });
  assert.equal(plan.state, "draft");
  assert.equal(plan.ok, false);
  assert.match(plan.error, /Not On The Stake Schedule/);
  assert.equal(plan.body, undefined);
  var store = memory();
  Lesson.writeDraft(store, plan.draft);
  var raw = store.getItem(Lesson.STORAGE_KEY);
  assert.equal(JSON.parse(raw).sent, false);
  assert.deepEqual(Lesson.readDraft(store), plan.draft);
  store.setItem(Lesson.STORAGE_KEY, JSON.stringify({ sent: true, draft: plan.draft }));
  assert.equal(Lesson.readDraft(store), null);
});

test("the announcement and Young Women scripts are not used for lesson requests", function () {
  var yw = "https://script.google.com/macros/s/AKfycbx9tx5QhPB5vXaAXvwTNNalymcP9YCJaxDQbQEsnbCQts-dSQho0jETdl_AuK_w_K93/exec";
  var announce = "https://script.google.com/macros/s/AKfycbwAsUucP-s5V1ILI8EzNPh4UuhqowJh8-J7V3K6knDXCkmU2UuW0DNpgieYCPc7D1pr/exec";
  [yw, announce, "javascript:alert(1)", "https://example.com/exec"].forEach(function (url) {
    var plan = Lesson.planSubmit(good(), { schedule: schedule, today: TODAY, scriptUrl: url });
    assert.equal(plan.state, "draft");
    assert.equal(plan.url, undefined);
  });
  var ready = Lesson.planSubmit(good(), {
    schedule: schedule,
    today: TODAY,
    scriptUrl: "https://script.google.com/macros/s/AKfycbLessonScheduleOnlyForDeploy/exec"
  });
  assert.equal(ready.state, "send");
  assert.equal(ready.body.website, undefined);
  assert.equal(ready.body.date, "2026-11-11");
});

test("only an explicit ok from the schedule counts as saved", function () {
  assert.equal(Lesson.interpretResponse(null).state, "error");
  assert.equal(Lesson.interpretResponse({}).state, "error");
  assert.equal(Lesson.interpretResponse({ ok: false, error: "That Evening Is Already Taken." }).error, "That Evening Is Already Taken.");
  assert.equal(Lesson.interpretResponse({ ok: "true" }).state, "error");
  assert.equal(Lesson.interpretResponse({ ok: true }).state, "saved");
});

test("writing a cell refuses a filled name and does not echo it", function () {
  var empty = "11\nTime:\nName:\nWard:\nAddress:";
  var filled = "9\nTime:\nName: Private Person\nWard: 5th\nAddress: 1 Secret Road";
  var refused = Lesson.applySlotText(filled, good());
  assert.equal(refused.ok, false);
  assert.equal(refused.error, "That Evening Is Already Taken.");
  assert.equal(JSON.stringify(refused).indexOf("Private Person"), -1);
  assert.equal(JSON.stringify(refused).indexOf("Secret Road"), -1);
  var wrote = Lesson.applySlotText(empty, good());
  assert.equal(wrote.ok, true);
  assert.match(wrote.text, /^11\nTime: 7:30\nName: Layout Test\nWard: 6th\nAddress: 100 Test Street$/);
  assert.equal(Lesson.applySlotText("8", good()).error, "That Evening Is Not On The Schedule.");
  var stripped = Lesson.publicSlots([{ date: "2026-11-11", status: "open", name: "Private Person", address: "1 Secret Road" }]);
  assert.deepEqual(stripped, [{ date: "2026-11-11", status: "open" }]);
});

test("member pages no longer send people to the shared schedule document", function () {
  var root = path.join(__dirname, "..", "..");
  ["index.html", "orgs/ward-missionaries/index.html", "missionaries/lesson/index.html", "missionaries/lesson/config.js"].forEach(function (file) {
    var text = fs.readFileSync(path.join(root, file), "utf8");
    assert.equal(text.indexOf("docs.google.com"), -1, file);
    assert.equal(text.indexOf("1ty2rlUhx5cjsyA8UPWuL36PUtyH1O0ZIKVZHEuuYnHQ"), -1, file);
  });
  var config = fs.readFileSync(path.join(__dirname, "config.js"), "utf8");
  assert.match(config, /scriptUrl:\s*""/);
  var page = fs.readFileSync(path.join(__dirname, "index.html"), "utf8");
  assert.match(page, /Save Draft On This Phone|LessonForm\.mount/);
  var hub = fs.readFileSync(path.join(root, "index.html"), "utf8");
  assert.match(hub, /href="missionaries\/lesson\/"/);
  var ward = fs.readFileSync(path.join(root, "orgs/ward-missionaries/index.html"), "utf8");
  assert.match(ward, /href="\.\.\/\.\.\/missionaries\/lesson\/"/);
});
