/* Two-way sync between the Bay 6 Hub sister-lesson Nights tab and the stake
   "Missionary/Member Lessons Schedule" Google Doc (month-grid tables).
   Pure planning logic: no Google calls here. Runs in Node (box CLI + tests)
   and in Apps Script (DocSync wrapper). Given the doc (simplified
   read_document shape) and the Nights rows, it returns the exact doc inserts,
   sheet row updates, conflicts, and notified-log additions.

   Nights columns: A date, B time, C status, D name, E phone, F claimedAt,
                   G source ("hub" | "doc" | ""), H docSync (state note).
   The existing web app (saveNights_) only rewrites A:F, row order is fixed,
   so G:H survive claims.

   Rules
   - Doc -> Hub: a doc night with a Name reserves the Hub night (source doc,
     no phone, never an address). Those rows go into the notified log so no
     new-sign-up text fires. If the doc entry is later cleared, a doc-sourced
     Hub night reopens.
   - Hub -> Doc: a Hub family's night is written into the doc cell only when
     Name is empty and Ward is empty or 6th: Time 7:30 (only if empty), Name,
     Ward 6th. Address is never touched. Inserted text inherits the label's
     style, so "Time: 7:30" stays bold/underlined like the stake's entries.
   - Conflict: doc already has another family -> keep the doc, keep the Hub
     night Reserved, flag H once and report it.
   - Idempotent: H records "in-doc" after a write; a rerun that finds our own
     name already in the doc just records it, never writes twice. */
(function (root, factory) {
  var api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.SisterDocSync = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  var START = "2026-11-11";
  var END = "2026-12-31";
  var DOC_TIME = "7:30";
  var HUB_TIME = "7:30 PM";
  var WARD = "6th";
  var MONTHS = ["january", "february", "march", "april", "may", "june", "july",
    "august", "september", "october", "november", "december"];

  function pad(n) { return (n < 10 ? "0" : "") + n; }
  function ymd(y, m, d) { return y + "-" + pad(m) + "-" + pad(d); }
  function isWeekday(date) {
    var p = date.split("-");
    var day = new Date(Date.UTC(+p[0], +p[1] - 1, +p[2], 12)).getUTCDay();
    return day >= 1 && day <= 5;
  }
  function catalogDates() {
    var out = [];
    var d = new Date(Date.UTC(2026, 10, 11, 12));
    while (true) {
      var s = ymd(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
      if (s > END) break;
      if (isWeekday(s)) out.push(s);
      d.setUTCDate(d.getUTCDate() + 1);
    }
    return out;
  }
  function denverYmd(now) {
    var parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/Denver", year: "numeric", month: "2-digit", day: "2-digit"
    }).formatToParts(now);
    var o = {};
    parts.forEach(function (p) { o[p.type] = p.value; });
    return o.year + "-" + o.month + "-" + o.day;
  }
  function clean(v) { return String(v == null ? "" : v).replace(/\s+/g, " ").trim(); }
  function nameKey(v) { return clean(v).toLowerCase().replace(/[^a-z]/g, ""); }
  function sameName(a, b) {
    var x = nameKey(a), y = nameKey(b);
    return !!x && !!y && (x === y || x.indexOf(y) >= 0 || y.indexOf(x) >= 0);
  }
  function isSixth(ward) {
    var w = clean(ward).toLowerCase().replace(/[^a-z0-9]/g, "");
    return /^(6|6th|fb6|fb6th|bay6|bay6th|farmingtonbay6|farmingtonbay6th)$/.test(w);
  }

  /* ---------- doc parsing ---------- */
  var LABELS = { time: /^\s*time\s*:/i, name: /^\s*name\s*:/i, ward: /^\s*ward\s*:/i, address: /^\s*address\s*:/i };

  function parseCell(cell, year, month) {
    var text = String(cell.text || "");
    var lines = text.split("\n");
    var first = clean(lines[0]);
    if (!/^\d{1,2}$/.test(first)) return null;
    var day = +first;
    var out = { date: ymd(year, month, day), start: cell.start, end: cell.end, text: text, fields: {} };
    var offset = 0;
    for (var i = 0; i < lines.length; i++) {
      var line = lines[i];
      for (var key in LABELS) {
        if (!out.fields[key] && LABELS[key].test(line)) {
          var value = line.replace(LABELS[key], "");
          out.fields[key] = {
            value: clean(value),
            lineEnd: cell.start + offset + line.length, /* UTF-16 index just before the line's newline */
            endsWithSpace: /\s$/.test(line)
          };
        }
      }
      offset += line.length + 1;
    }
    return out;
  }

  function parseDoc(doc) {
    var nights = {};
    var dupes = [];
    var heading = null;
    (doc.elements || []).forEach(function (el) {
      if (!el.table) {
        var m = clean(el.text).toLowerCase().match(/^([a-z]+)\s+(\d{4})$/);
        if (m && MONTHS.indexOf(m[1]) >= 0) heading = { month: MONTHS.indexOf(m[1]) + 1, year: +m[2] };
        return;
      }
      if (!heading) return;
      (el.cells || []).forEach(function (cell) {
        var n = parseCell(cell, heading.year, heading.month);
        if (!n) return;
        if (nights[n.date]) dupes.push(n.date);
        else nights[n.date] = n;
      });
      heading = null;
    });
    return { revisionId: doc.revisionId || "", nights: nights, duplicateDates: dupes };
  }

  /* Docs REST (Docs.Documents.get) -> the simplified read_document shape. */
  function fromDocsApi(doc) {
    function paraText(p) {
      return (p.elements || []).map(function (e) { return e.textRun ? e.textRun.content : ""; }).join("");
    }
    var elements = [];
    var content = (doc.body && doc.body.content) || (doc.tabs && doc.tabs[0].documentTab.body.content) || [];
    content.forEach(function (c) {
      if (c.paragraph) {
        elements.push({ start: c.startIndex, end: c.endIndex, text: paraText(c.paragraph).replace(/\n$/, "") });
      } else if (c.table) {
        var cells = [];
        (c.table.tableRows || []).forEach(function (row) {
          (row.tableCells || []).forEach(function (tc) {
            var parts = tc.content || [];
            var text = parts.map(function (p) { return p.paragraph ? paraText(p.paragraph) : ""; }).join("");
            cells.push({
              start: parts.length ? parts[0].startIndex : tc.startIndex,
              end: parts.length ? parts[parts.length - 1].endIndex : tc.endIndex,
              text: text.replace(/\n$/, "")
            });
          });
        });
        elements.push({ start: c.startIndex, end: c.endIndex, table: "table", cells: cells });
      }
    });
    return { revisionId: doc.revisionId, elements: elements };
  }

  /* ---------- sheet rows ---------- */
  var COLS = ["date", "time", "status", "name", "phone", "claimedAt", "source", "docSync"];
  function rowsFromValues(values) {
    /* values: 2D array including header row */
    var rows = [];
    for (var i = 1; i < (values || []).length; i++) {
      var v = values[i] || [];
      var date = String(v[0] || "").trim().slice(0, 10);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;
      var r = { sheetRow: i + 1 };
      COLS.forEach(function (c, j) { r[c] = v[j] == null ? "" : String(v[j]); });
      r.date = date;
      rows.push(r);
    }
    return rows;
  }
  function parseCsv(text) {
    var rows = [], row = [], field = "", q = false;
    text = String(text || "");
    for (var i = 0; i < text.length; i++) {
      var ch = text.charAt(i);
      if (q) {
        if (ch === '"' && text.charAt(i + 1) === '"') { field += '"'; i++; }
        else if (ch === '"') q = false;
        else field += ch;
      } else if (ch === '"') q = true;
      else if (ch === ",") { row.push(field); field = ""; }
      else if (ch === "\n") { row.push(field); rows.push(row); row = []; field = ""; }
      else if (ch !== "\r") field += ch;
    }
    if (field !== "" || row.length) { row.push(field); rows.push(row); }
    return rows;
  }
  function reserved(r) {
    return clean(r.status).toLowerCase() === "reserved" || !!clean(r.name) || !!clean(r.phone);
  }
  function rowValues(r) { return COLS.map(function (c) { return r[c] == null ? "" : String(r[c]); }); }

  /* ---------- planning ---------- */
  function insertFor(field, value) {
    return { index: field.lineEnd, text: (field.endsWithSpace ? "" : " ") + value };
  }

  function plan(opts) {
    var now = opts.now || new Date();
    var iso = now.toISOString();
    var today = denverYmd(now);
    var doc = opts.docModel || parseDoc(opts.doc);
    var rows = opts.rows || rowsFromValues(opts.values);
    var byDate = {};
    rows.forEach(function (r) { byDate[r.date] = r; });

    var out = {
      revisionId: doc.revisionId,
      docInserts: [], sheetUpdates: [], conflicts: [], newConflicts: [],
      notifiedAdds: [], warnings: [], nights: []
    };
    if (doc.duplicateDates.length) out.warnings.push("Doc has duplicate cells for " + doc.duplicateDates.join(", "));

    catalogDates().forEach(function (date) {
      var r = byDate[date];
      var cell = doc.nights[date];
      var docName = cell && cell.fields.name ? cell.fields.name.value : "";
      var docWard = cell && cell.fields.ward ? cell.fields.ward.value : "";
      var state = { date: date, doc: docName ? "booked" : "open", hub: r && reserved(r) ? "reserved" : "open", action: "none" };
      out.nights.push(state);
      if (date < today) { state.action = "past"; return; }
      if (!r) { out.warnings.push(date + ": no Nights row"); state.action = "no-row"; return; }
      if (!cell) { out.warnings.push(date + ": no doc cell"); state.action = "no-cell"; return; }

      var src = clean(r.source).toLowerCase();
      var sync = clean(r.docSync);
      var hubTaken = reserved(r);
      var next = JSON.parse(JSON.stringify(r));
      var changed = false;
      function set(k, v) { if (String(next[k] || "") !== String(v)) { next[k] = v; changed = true; } }

      if (docName) {
        if (!hubTaken) {
          set("time", r.time || HUB_TIME); set("status", "reserved"); set("name", docName);
          set("phone", ""); set("claimedAt", iso); set("source", "doc");
          set("docSync", "from-doc" + (docWard ? " " + docWard : ""));
          out.notifiedAdds.push({ date: date, name: docName, source: "doc", ward: docWard, at: iso });
          state.action = "doc->hub reserve";
        } else if (src === "doc") {
          if (clean(r.name) !== docName) { set("name", docName); state.action = "doc->hub rename"; }
          set("docSync", "from-doc" + (docWard ? " " + docWard : ""));
        } else if (sameName(docName, r.name) && (!docWard || isSixth(docWard))) {
          set("source", "hub");
          if (!/^in-doc/.test(sync)) { set("docSync", "in-doc " + iso); state.action = "hub already in doc"; }
        } else {
          set("source", "hub");
          var c = { date: date, hubName: clean(r.name), docName: docName, docWard: docWard, kind: "doc-has-other-family" };
          out.conflicts.push(c);
          if (!/^conflict/.test(sync)) {
            set("docSync", "conflict: doc has " + docName + (docWard ? " (" + docWard + ")" : "") + " " + iso);
            out.newConflicts.push(c);
          }
          state.action = "conflict";
        }
      } else if (hubTaken) {
        if (src === "doc") {
          ["status", "name", "phone", "claimedAt", "source", "docSync"].forEach(function (k) { set(k, k === "status" ? "open" : ""); });
          state.action = "doc cleared -> hub reopen";
        } else if (/^conflict/.test(sync)) {
          out.conflicts.push({ date: date, hubName: clean(r.name), docName: "", docWard: "", kind: "unresolved-conflict-doc-now-empty" });
          state.action = "conflict (doc now empty, left for Adam)";
        } else if (/^in-doc/.test(sync)) {
          var cc = { date: date, hubName: clean(r.name), docName: "", docWard: "", kind: "doc-entry-cleared" };
          out.conflicts.push(cc);
          out.newConflicts.push(cc);
          set("docSync", "conflict: doc entry cleared " + iso);
          state.action = "conflict (doc cleared our entry)";
        } else if (/^cleared/.test(sync)) {
          state.action = "none";
        } else {
          var f = cell.fields;
          if (!f.time || !f.name || !f.ward) {
            out.warnings.push(date + ": doc cell missing Time/Name/Ward labels, not written");
            state.action = "skip (cell format)";
            return;
          }
          if (f.ward.value && !isSixth(f.ward.value)) {
            var c2 = { date: date, hubName: clean(r.name), docName: "", docWard: f.ward.value, kind: "doc-ward-set-without-name" };
            out.conflicts.push(c2);
            if (!/^conflict/.test(sync)) { out.newConflicts.push(c2); set("docSync", "conflict: doc ward " + f.ward.value + " " + iso); }
            state.action = "conflict";
          } else {
            var ins = [];
            if (!f.ward.value) ins.push(insertFor(f.ward, WARD));
            ins.push(insertFor(f.name, clean(r.name)));
            if (!f.time.value) ins.push(insertFor(f.time, DOC_TIME));
            ins.forEach(function (x) { x.date = date; out.docInserts.push(x); });
            set("source", "hub");
            set("docSync", "in-doc " + iso);
            state.action = "hub->doc write";
          }
        }
      }
      if (changed) out.sheetUpdates.push({ sheetRow: r.sheetRow, date: date, values: rowValues(next), before: rowValues(r) });
    });
    out.docInserts.sort(function (a, b) { return b.index - a.index; });
    out.summary = {
      today: today,
      catalogNights: out.nights.length,
      upcoming: out.nights.filter(function (n) { return n.date >= today; }).length,
      docBookedUpcoming: out.nights.filter(function (n) { return n.date >= today && n.doc === "booked"; }).length,
      hubReservedUpcoming: out.nights.filter(function (n) { return n.date >= today && n.hub === "reserved"; }).length,
      docInserts: out.docInserts.length,
      sheetUpdates: out.sheetUpdates.length,
      conflicts: out.conflicts.length,
      newConflicts: out.newConflicts.length
    };
    return out;
  }

  return {
    START: START, END: END, DOC_TIME: DOC_TIME, WARD: WARD, COLS: COLS,
    catalogDates: catalogDates, parseDoc: parseDoc, parseCell: parseCell, fromDocsApi: fromDocsApi,
    rowsFromValues: rowsFromValues, parseCsv: parseCsv, plan: plan, isSixth: isSixth, sameName: sameName
  };
});
