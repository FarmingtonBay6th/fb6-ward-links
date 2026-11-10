/* Young Men calendar filtering. Run: node --test tools/ym-cal.test.js */
"use strict";

var test = require("node:test");
var assert = require("node:assert/strict");
var cal = require("../orgs/young-men/activities.js");

var EVENTS = [
  { id: "past", title: "Nerf", date: "2026-01-28", quorums: ["deacons-quorum"], start: "2026-01-28T19:00:00-07:00", status: "activity" },
  { id: "wed", title: "Engineering Challenge", date: "2026-11-11", quorums: ["deacons-quorum"], start: "2026-11-11T19:00:00-07:00", status: "activity" },
  { id: "priests", title: "Open DDD", date: "2026-11-11", quorums: ["priests-quorum"], start: "2026-11-11T19:00:00-07:00", status: "activity" },
  { id: "all", title: "Combined Young Men: Gameshow", date: "2026-02-04", quorums: cal.ALL.slice(), combined: "ym", start: "2026-02-04T19:00:00-07:00", status: "activity" }
];

test("upcoming filter hides past rows and other quorums", function () {
  var deacons = cal.filterEvents(EVENTS, "deacons-quorum", "2026-11-10", false);
  assert.deepEqual(deacons.map(function (event) { return event.id; }), ["wed"]);
  var everyone = cal.filterEvents(EVENTS, "all", "2026-11-10", false);
  assert.deepEqual(everyone.map(function (event) { return event.id; }), ["wed", "priests"]);
});

test("a combined night is one event for All and still shows for each quorum", function () {
  var all = cal.filterEvents(EVENTS, "all", "2026-02-01", false).filter(function (event) { return event.date === "2026-02-04"; });
  assert.equal(all.length, 1);
  var teachers = cal.filterEvents(EVENTS, "teachers-quorum", "2026-02-01", false);
  assert.equal(teachers.length, 1);
  assert.equal(teachers[0].id, "all");
});

test("this Wednesday is the Wednesday still in the current week", function () {
  assert.equal(cal.highlightLabel({ date: "2026-11-11" }, "2026-11-10"), "This Wednesday");
  assert.equal(cal.highlightLabel({ date: "2026-11-18" }, "2026-11-12"), "Next Wednesday");
  assert.equal(cal.highlightLabel({ date: "2026-11-14" }, "2026-11-10"), "Up Next");
  assert.equal(cal.weekStart("2026-11-11"), "2026-11-08");
});

test("church calendar rows fill gaps and do not duplicate the sheet", function () {
  var church = [{
    id: "c1",
    title: "Deacons: Engineering Challenge",
    calendar: "Young Men",
    start: "2026-11-11T19:00:00-07:00",
    end: "2026-11-11T20:00:00-07:00",
    allDay: false,
    location: ""
  }, {
    id: "c2",
    title: "Teachers: Scripture Training",
    calendar: "Young Men",
    ymQuorum: "teachers-quorum",
    start: "2026-12-01T19:00:00-07:00",
    end: "2026-12-01T20:00:00-07:00",
    allDay: false,
    location: ""
  }];
  var merged = cal.mergeChurch(EVENTS, church);
  var titles = merged.map(function (event) { return event.title; });
  assert.equal(titles.filter(function (title) { return title.indexOf("Engineering") >= 0; }).length, 1);
  assert.ok(titles.indexOf("Teachers: Scripture Training") >= 0);
  var added = merged.filter(function (event) { return event.title === "Teachers: Scripture Training"; })[0];
  assert.deepEqual(added.quorums, ["teachers-quorum"]);
});
