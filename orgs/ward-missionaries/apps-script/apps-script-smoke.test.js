"use strict";
var test = require("node:test"), assert = require("node:assert/strict"), fs = require("fs"), vm = require("vm");
test("Apps Script wrapper: one guarded batch, sheet rows written, no notify", function () {
  var S = require("./SisterDocSync.js");
  var dates = S.catalogDates();
  var grid = [["date","time","status","name","phone","claimedAt","",""]].concat(dates.map(function (d) { return [d,"7:30 PM","open","","","","",""]; }));
  grid[2] = [dates[1],"7:30 PM","reserved","Jones","801-555-0100","x","",""];
  var p12 = { startIndex: 0 };
  /* REST doc with one November table holding the 11th and 12th */
  function cell(start, lines) { var idx = start, content = lines.map(function (l) { var s = idx; idx += l.length + 1; return { startIndex: s, endIndex: idx, paragraph: { elements: [{ textRun: { content: l + "\n" } }] } }; }); return { content: content }; }
  var c11 = cell(20, ["11","Time:","Name:","Ward: ","Address:"]);
  var c12 = cell(c11.content[4].endIndex + 1, ["12","Time:","Name:","Ward: ","Address:"]);
  var rest = { revisionId: "rev1", body: { content: [ { startIndex: 1, endIndex: 15, paragraph: { elements: [{ textRun: { content: "November 2026\n" } }] } },
    { startIndex: 16, endIndex: 200, table: { tableRows: [{ tableCells: [c11, c12] }] } } ] } };
  var batches = [], writes = [], notified = 0;
  function range(r, c, nr, nc) { return {
    getValues: function () { return grid.slice(r - 1, r - 1 + nr).map(function (row) { return row.slice(c - 1, c - 1 + nc); }); },
    getValue: function () { return grid[r - 1][c - 1]; },
    setValues: function (v) { writes.push([r, c, v]); v.forEach(function (row, i) { row.forEach(function (x, j) { grid[r - 1 + i][c - 1 + j] = x; }); }); },
    setNumberFormat: function () {} }; }
  var sheet = { getRange: range, getLastRow: function () { return grid.length; }, getParent: function () { return { getSheetByName: function () { return null; }, insertSheet: function () { return { getLastRow: function () { return 0; }, appendRow: function () {} }; } }; } };
  var ctx = { SisterDocSync: S, Intl: Intl, JSON: JSON, Date: Date, Logger: { log: function () {} },
    LockService: { getScriptLock: function () { return { tryLock: function () { return true; }, releaseLock: function () {} }; } },
    Docs: { Documents: { get: function () { return rest; }, batchUpdate: function (b) { batches.push(b); } } },
    props_: function () { return { getProperty: function () { return "DOCID"; } }; },
    nightsSheet_: function () { return sheet; }, textCell_: function (v) { return v == null ? "" : String(v); },
    ymdCell_: function (v) { return String(v).slice(0, 10); }, notify_: function () { notified++; } };
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(__dirname + "/DocSync.js", "utf8"), ctx);
  ctx.syncSisterDoc();
  assert.equal(batches.length, 1);
  assert.equal(batches[0].writeControl.requiredRevisionId, "rev1");
  assert.deepEqual(batches[0].requests.map(function (r) { return r.insertText.text; }), ["6th", " Jones", " 7:30"]);
  assert.equal(grid[2][6], "hub");
  assert.match(grid[2][7], /^in-doc/);
  assert.equal(notified, 0);
});
