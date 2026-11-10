"use strict";
var test = require("node:test");
var assert = require("node:assert/strict");
var fs = require("fs");
var S = require("./SisterDocSync.js");
var NOW = new Date("2026-11-10T20:45:00Z");
var REAL = JSON.parse(fs.readFileSync(__dirname + "/real-doc.json", "utf8"));

function header() { return ["date", "time", "status", "name", "phone", "claimedAt", "source", "docSync"]; }
function openValues() { return [header()].concat(S.catalogDates().map(function (d) { return [d, "7:30 PM", "open", "", "", "", "", ""]; })); }
function setRow(values, date, patch) {
  var i = values.findIndex(function (r) { return r[0] === date; });
  var cols = header();
  Object.keys(patch).forEach(function (k) { values[i][cols.indexOf(k)] = patch[k]; });
}
function clone(x) { return JSON.parse(JSON.stringify(x)); }
/* Apply planned inserts to the simplified doc the way the Docs API would. */
function applyInserts(doc, inserts) {
  doc = clone(doc);
  inserts.forEach(function (ins) {
    doc.elements.forEach(function (el) {
      (el.cells || []).forEach(function (c) {
        if (ins.index >= c.start && ins.index <= c.end) {
          var k = ins.index - c.start;
          c.text = c.text.slice(0, k) + ins.text + c.text.slice(k);
          c.end += ins.text.length;
        } else if (c.start > ins.index) { c.start += ins.text.length; c.end += ins.text.length; }
      });
    });
  });
  return doc;
}
function cellText(doc, date) { return S.parseDoc(doc).nights[date].text; }
function bookDoc(doc, date, name, ward) {
  doc = clone(doc);
  var m = S.parseDoc(doc).nights[date];
  return applyInserts(doc, [ { index: m.fields.ward.lineEnd, text: (m.fields.ward.endsWithSpace ? "" : " ") + ward }, { index: m.fields.name.lineEnd, text: " " + name } ]);
}

test("dry run against the real doc: 37 open nights, no writes", function () {
  var p = S.plan({ doc: REAL, values: openValues(), now: NOW });
  assert.equal(p.summary.catalogNights, 37);
  assert.equal(p.summary.upcoming, 37);
  assert.equal(p.summary.docBookedUpcoming, 0);
  assert.equal(p.docInserts.length + p.sheetUpdates.length + p.conflicts.length, 0);
  assert.deepEqual(p.warnings, []);
});

test("doc -> hub: another ward's booking reserves the hub night, no phone, no address, logged as notified", function () {
  var doc = bookDoc(REAL, "2026-11-18", "Smith Family", "3rd");
  var p = S.plan({ doc: doc, values: openValues(), now: NOW });
  assert.equal(p.sheetUpdates.length, 1);
  var v = p.sheetUpdates[0].values;
  assert.deepEqual([v[0], v[2], v[3], v[4], v[6]], ["2026-11-18", "reserved", "Smith Family", "", "doc"]);
  assert.ok(JSON.stringify(p.sheetUpdates).indexOf("Address") < 0);
  assert.equal(p.notifiedAdds.length, 1);
  assert.equal(p.docInserts.length, 0);
});

test("doc -> hub is idempotent and reopens when the doc entry is cleared", function () {
  var doc = bookDoc(REAL, "2026-11-18", "Smith Family", "3rd");
  var vals = openValues();
  var p = S.plan({ doc: doc, values: vals, now: NOW });
  vals[p.sheetUpdates[0].sheetRow - 1] = p.sheetUpdates[0].values;
  var again = S.plan({ doc: doc, values: vals, now: NOW });
  assert.equal(again.sheetUpdates.length, 0);
  assert.equal(again.notifiedAdds.length, 0);
  var cleared = S.plan({ doc: REAL, values: vals, now: NOW });
  assert.equal(cleared.sheetUpdates.length, 1);
  assert.equal(cleared.sheetUpdates[0].values[2], "open");
  assert.equal(cleared.sheetUpdates[0].values[3], "");
});

test("hub -> doc: fills Time 7:30, Name, Ward 6th into an empty cell, address untouched, then idempotent", function () {
  var vals = openValues();
  setRow(vals, "2026-11-12", { status: "reserved", name: "Jones Family", phone: "801-555-0100", claimedAt: "2026-11-10T20:00:00Z" });
  var p = S.plan({ doc: REAL, values: vals, now: NOW });
  assert.equal(p.docInserts.length, 3);
  for (var i = 1; i < p.docInserts.length; i++) assert.ok(p.docInserts[i - 1].index > p.docInserts[i].index);
  var doc2 = applyInserts(REAL, p.docInserts);
  assert.equal(cellText(doc2, "2026-11-12"), "12\nTime: 7:30\nName: Jones Family\nWard: 6th\nAddress: ");
  assert.ok(JSON.stringify(doc2).indexOf("801-555-0100") < 0);
  assert.equal(cellText(doc2, "2026-11-11"), cellText(REAL, "2026-11-11"));
  assert.equal(cellText(doc2, "2026-11-13"), cellText(REAL, "2026-11-13"));
  assert.equal(p.sheetUpdates[0].values[6], "hub");
  assert.match(p.sheetUpdates[0].values[7], /^in-doc/);
  vals[p.sheetUpdates[0].sheetRow - 1] = p.sheetUpdates[0].values;
  var again = S.plan({ doc: doc2, values: vals, now: NOW });
  assert.equal(again.docInserts.length + again.sheetUpdates.length + again.conflicts.length, 0);
});

test("crash between doc write and sheet mark: rerun records, never writes twice", function () {
  var vals = openValues();
  setRow(vals, "2026-11-12", { status: "reserved", name: "Jones Family", phone: "801-555-0100" });
  var p = S.plan({ doc: REAL, values: vals, now: NOW });
  var doc2 = applyInserts(REAL, p.docInserts);
  var again = S.plan({ doc: doc2, values: vals, now: NOW });
  assert.equal(again.docInserts.length, 0);
  assert.equal(again.sheetUpdates.length, 1);
  assert.match(again.sheetUpdates[0].values[7], /^in-doc/);
});

test("conflict: doc has another ward's family -> keep doc, hub stays reserved, flag once", function () {
  var doc = bookDoc(REAL, "2026-11-12", "Brown", "4th");
  var vals = openValues();
  setRow(vals, "2026-11-12", { status: "reserved", name: "Jones Family", phone: "801-555-0100" });
  var p = S.plan({ doc: doc, values: vals, now: NOW });
  assert.equal(p.docInserts.length, 0);
  assert.equal(p.newConflicts.length, 1);
  assert.equal(p.newConflicts[0].docName, "Brown");
  assert.equal(p.sheetUpdates[0].values[2], "reserved");
  assert.equal(p.sheetUpdates[0].values[3], "Jones Family");
  assert.match(p.sheetUpdates[0].values[7], /^conflict/);
  vals[p.sheetUpdates[0].sheetRow - 1] = p.sheetUpdates[0].values;
  var again = S.plan({ doc: doc, values: vals, now: NOW });
  assert.equal(again.newConflicts.length, 0);
  assert.equal(again.sheetUpdates.length, 0);
});

test("multiple hub writes in one run land in the right cells", function () {
  var vals = openValues();
  ["2026-11-11", "2026-11-25", "2026-12-31"].forEach(function (d, i) { setRow(vals, d, { status: "reserved", name: "Fam " + "ABC".charAt(i) }); });
  var p = S.plan({ doc: REAL, values: vals, now: NOW });
  var doc2 = applyInserts(REAL, p.docInserts);
  assert.equal(cellText(doc2, "2026-11-11"), "11\nTime: 7:30\nName: Fam A\nWard: 6th\nAddress:");
  assert.equal(cellText(doc2, "2026-11-25"), "25\nTime: 7:30\nName: Fam B\nWard: 6th\nAddress:\n");
  assert.equal(cellText(doc2, "2026-12-31"), "31\nTime: 7:30\nName: Fam C\nWard: 6th\nAddress:");
  var m = S.parseDoc(doc2);
  assert.equal(Object.keys(m.nights).filter(function (d) { return m.nights[d].fields.name && m.nights[d].fields.name.value; }).length,
    Object.keys(S.parseDoc(REAL).nights).filter(function (d) { var f = S.parseDoc(REAL).nights[d].fields.name; return f && f.value; }).length + 3);
});

test("Docs REST adapter produces the same model", function () {
  var rest = { revisionId: "r1", body: { content: [
    { startIndex: 1, endIndex: 15, paragraph: { elements: [{ textRun: { content: "November 2026\n" } }] } },
    { startIndex: 15, endIndex: 60, table: { tableRows: [{ tableCells: [{ startIndex: 17, endIndex: 50, content: [
      { startIndex: 18, endIndex: 21, paragraph: { elements: [{ textRun: { content: "11\n" } }] } },
      { startIndex: 21, endIndex: 27, paragraph: { elements: [{ textRun: { content: "Time:\n" } }] } },
      { startIndex: 27, endIndex: 33, paragraph: { elements: [{ textRun: { content: "Name:\n" } }] } },
      { startIndex: 33, endIndex: 40, paragraph: { elements: [{ textRun: { content: "Ward: \n" } }] } },
      { startIndex: 40, endIndex: 49, paragraph: { elements: [{ textRun: { content: "Address:\n" } }] } }
    ] }] }] } }
  ] } };
  var m = S.parseDoc(S.fromDocsApi(rest));
  var n = m.nights["2026-11-11"];
  assert.equal(n.start, 18);
  assert.equal(n.fields.time.lineEnd, 26);
  assert.equal(n.fields.name.lineEnd, 32);
  assert.equal(n.fields.ward.lineEnd, 39);
});
