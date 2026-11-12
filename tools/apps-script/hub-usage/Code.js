/* Bay 6 Hub · Usage counter (private).
   Receives anonymous usage beacons from usage.js on the Hub and appends them to a
   private Google Sheet owned by the account that deploys this script.

   What is stored per event: server time, type (view or click), link id, page path,
   the browser's own timestamp, and a tag column (blank, or "test" for test rows).
   Nothing else: no names, phone numbers, cookies, IP addresses, or device details.
   Apps Script never exposes the visitor's IP address to the script.

   Endpoints (one web app, Execute as Me, Who has access: Anyone)
     POST {t:"view"|"click", id, p, ts}           → append one event, returns {ok:true}
     POST {action:"summary", key}                 → counts only, never raw rows
     POST {action:"tagTest", key, idPrefix}       → tag matching rows as "test"
   First run: open the project in the Apps Script editor, select setupHubUsage, Run,
   and allow Google Sheets. That creates the private spreadsheet. Then deploy a new version.
   The summary key is checked against SUMMARY_KEY_SHA256 in Secret.js, which is kept
   out of the public repo. The spreadsheet id is saved in Script Properties on first use. */
var TZ = "America/Denver";
var SHEET_NAME = "Events";
var HEADER = ["Time", "Type", "Link", "Path", "Client Time", "Tag"];
var MAX_PER_MINUTE = 400;

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
function props_() { return PropertiesService.getScriptProperties(); }

/* Storage. The Sheet is the event log once the owner has run setupHubUsage in the
   Apps Script editor (that one run grants Sheets permission and creates the private
   spreadsheet). Until then, and if the Sheet is ever unreachable, events wait in a small
   private buffer in Script Properties and are moved into the Sheet automatically. */
var BUF_PREFIX = "buf:";
var BUF_CHUNK = 8000;      // bytes per property value (limit 9 KB)
var BUF_MAX_CHUNKS = 48;   // about 380 KB, under the 500 KB property store limit

function sheet_() {
  var id = props_().getProperty("SHEET_ID");
  if (!id) return null;
  try { return SpreadsheetApp.openById(id).getSheetByName(SHEET_NAME); } catch (err) { return null; }
}
function setupHubUsage() {
  var id = props_().getProperty("SHEET_ID");
  var ss;
  if (id) ss = SpreadsheetApp.openById(id);
  else {
    ss = SpreadsheetApp.create("Bay 6 Hub Usage (Private)");
    var sh = ss.getSheets()[0];
    sh.setName(SHEET_NAME);
    sh.getRange(1, 1, 1, HEADER.length).setValues([HEADER]).setFontWeight("bold");
    sh.setFrozenRows(1);
    sh.getRange("A:A").setNumberFormat("@");
    sh.getRange("E:E").setNumberFormat("@");
    props_().setProperty("SHEET_ID", ss.getId());
  }
  var moved = drainBuffer_();
  Logger.log("Bay 6 Hub Usage sheet ready. Moved " + moved + " buffered events.");
  return moved;
}
function bufKeys_() {
  var all = props_().getKeys().filter(function (k) { return k.indexOf(BUF_PREFIX) === 0; });
  all.sort(function (a, b) { return Number(a.slice(BUF_PREFIX.length)) - Number(b.slice(BUF_PREFIX.length)); });
  return all;
}
function bufRows_() {
  var p = props_(), rows = [];
  bufKeys_().forEach(function (k) {
    String(p.getProperty(k) || "").split("\n").forEach(function (line) {
      if (line) rows.push(line.split("\t"));
    });
  });
  return rows;
}
function bufAppend_(row) {
  var p = props_(), keys = bufKeys_(), line = row.join("\t");
  var lastKey = keys.length ? keys[keys.length - 1] : "";
  var cur = lastKey ? String(p.getProperty(lastKey) || "") : "";
  if (lastKey && cur.length + line.length + 1 <= BUF_CHUNK) {
    p.setProperty(lastKey, cur + "\n" + line);
    return;
  }
  var next = lastKey ? Number(lastKey.slice(BUF_PREFIX.length)) + 1 : 1;
  p.setProperty(BUF_PREFIX + next, line);
  keys.push(BUF_PREFIX + next);
  while (keys.length > BUF_MAX_CHUNKS) p.deleteProperty(keys.shift());
}
function bufRewrite_(rows) {
  var p = props_();
  bufKeys_().forEach(function (k) { p.deleteProperty(k); });
  var n = 1, cur = "";
  rows.forEach(function (r) {
    var line = r.join("\t");
    if (cur && cur.length + line.length + 1 > BUF_CHUNK) { p.setProperty(BUF_PREFIX + n, cur); n++; cur = ""; }
    cur = cur ? cur + "\n" + line : line;
  });
  if (cur) p.setProperty(BUF_PREFIX + n, cur);
}
function drainBuffer_() {
  var sh = sheet_();
  if (!sh) return 0;
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var rows = bufRows_().map(function (r) { while (r.length < HEADER.length) r.push(""); return r.slice(0, HEADER.length); });
    if (!rows.length) return 0;
    sh.getRange(sh.getLastRow() + 1, 1, rows.length, HEADER.length).setNumberFormat("@").setValues(rows);
    bufRewrite_([]);
    return rows.length;
  } finally {
    lock.releaseLock();
  }
}

function clean_(s, max, re) {
  s = String(s == null ? "" : s).slice(0, max);
  return re.test(s) ? s : "";
}
function stamp_(d) { return Utilities.formatDate(d, TZ, "yyyy-MM-dd'T'HH:mm:ss"); }

function record_(b) {
  var t = b.t === "view" || b.t === "click" ? b.t : "";
  if (!t) return { ok: false, error: "type" };
  var id = clean_(b.id, 120, /^[A-Za-z0-9._~:\/#@+=,-]*$/);
  var p = clean_(b.p, 160, /^\/[A-Za-z0-9._~\/-]*$/);
  if (!p) return { ok: false, error: "path" };
  if (t === "click" && !id) return { ok: false, error: "link" };
  var cache = CacheService.getScriptCache();
  var bucket = "n" + Math.floor(Date.now() / 60000);
  var n = Number(cache.get(bucket) || 0);
  if (n >= MAX_PER_MINUTE) return { ok: false, error: "busy" };
  cache.put(bucket, String(n + 1), 120);
  var now = new Date();
  var cts = "";
  var c = Number(b.ts);
  if (isFinite(c) && Math.abs(c - now.getTime()) < 86400000) cts = stamp_(new Date(c));
  var row = [stamp_(now), t, t === "click" ? id : "", p, cts, ""];
  var sh = sheet_();
  if (sh) {
    try { sh.appendRow(row); return { ok: true }; } catch (err) {}
  }
  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try { bufAppend_(row); } finally { lock.releaseLock(); }
  return { ok: true };
}

function keyOk_(key) {
  if (typeof SUMMARY_KEY_SHA256 === "undefined" || !SUMMARY_KEY_SHA256 || !key) return false;
  var d = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, String(key), Utilities.Charset.UTF_8);
  var hex = d.map(function (x) { return ("0" + (x & 255).toString(16)).slice(-2); }).join("");
  return hex === SUMMARY_KEY_SHA256;
}

function rows_() {
  var rows = [];
  var sh = sheet_();
  if (sh && sh.getLastRow() >= 2) rows = sh.getRange(2, 1, sh.getLastRow() - 1, HEADER.length).getDisplayValues();
  return rows.concat(bufRows_());
}
function day_(v) {
  if (Object.prototype.toString.call(v) === "[object Date]") return Utilities.formatDate(v, TZ, "yyyy-MM-dd");
  return String(v || "").slice(0, 10);
}
function hour_(v) {
  if (Object.prototype.toString.call(v) === "[object Date]") return Number(Utilities.formatDate(v, TZ, "H"));
  var m = String(v || "").match(/[T ](\d{1,2}):/);
  return m ? Number(m[1]) : -1;
}

function summary_() {
  drainBuffer_();
  var now = new Date();
  var today = Utilities.formatDate(now, TZ, "yyyy-MM-dd");
  function back(n) { return Utilities.formatDate(new Date(now.getTime() - n * 86400000), TZ, "yyyy-MM-dd"); }
  var d7 = back(6), d30 = back(29);
  var out = {
    ok: true, generated: stamp_(now), timeZone: TZ,
    today: { views: 0, clicks: 0 }, last7: { views: 0, clicks: 0 }, last30: { views: 0, clicks: 0 },
    allTime: { views: 0, clicks: 0 }, clicks30ByLink: {}, views30ByPath: {},
    byHour30: [], byWeekday30: [0, 0, 0, 0, 0, 0, 0], byWeekdayHour30: {},
    firstEventDay: "", testRowsExcluded: 0,
    store: sheet_() ? "sheet" : "buffer"
  };
  for (var h = 0; h < 24; h++) out.byHour30.push(0);
  var rows = rows_();
  for (var i = 0; i < rows.length; i++) {
    var r = rows[i];
    if (String(r[5] || "")) { out.testRowsExcluded++; continue; }
    var type = r[1] === "click" ? "clicks" : r[1] === "view" ? "views" : "";
    if (!type) continue;
    var day = day_(r[0]);
    if (!out.firstEventDay || day < out.firstEventDay) out.firstEventDay = day;
    out.allTime[type]++;
    if (day === today) out.today[type]++;
    if (day >= d7) out.last7[type]++;
    if (day >= d30) {
      out.last30[type]++;
      if (type === "clicks") { var id = String(r[2] || ""); out.clicks30ByLink[id] = (out.clicks30ByLink[id] || 0) + 1; }
      else { var p = String(r[3] || ""); out.views30ByPath[p] = (out.views30ByPath[p] || 0) + 1; }
      var hr = hour_(r[0]);
      var wd = new Date(day + "T12:00:00Z").getUTCDay();
      if (hr >= 0) {
        out.byHour30[hr]++;
        out.byWeekday30[wd]++;
        var k = wd + "-" + hr;
        out.byWeekdayHour30[k] = (out.byWeekdayHour30[k] || 0) + 1;
      }
    }
  }
  return out;
}

function tagTest_(prefix) {
  prefix = String(prefix || "");
  if (prefix.length < 6) return { ok: false, error: "prefix" };
  function hit(r) {
    var id = String(r[2] || ""), p = String(r[3] || "");
    return !r[5] && (id.indexOf(prefix) === 0 || p.indexOf("/" + prefix) === 0);
  }
  var tagged = 0;
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var sh = sheet_();
    if (sh && sh.getLastRow() >= 2) {
      var vals = sh.getRange(2, 1, sh.getLastRow() - 1, HEADER.length).getDisplayValues();
      for (var i = 0; i < vals.length; i++) if (hit(vals[i])) { sh.getRange(i + 2, 6).setValue("test"); tagged++; }
    }
    var buf = bufRows_(), changed = false;
    buf.forEach(function (r) { while (r.length < HEADER.length) r.push(""); if (hit(r)) { r[5] = "test"; tagged++; changed = true; } });
    if (changed) bufRewrite_(buf);
  } finally {
    lock.releaseLock();
  }
  return { ok: true, tagged: tagged };
}

function doPost(e) {
  var b = {};
  try { b = JSON.parse((e && e.postData && e.postData.contents) || "{}") || {}; } catch (err) { return json_({ ok: false, error: "json" }); }
  try {
    if (b.action === "summary") return json_(keyOk_(b.key) ? summary_() : { ok: false, error: "key" });
    if (b.action === "tagTest") return json_(keyOk_(b.key) ? tagTest_(b.idPrefix) : { ok: false, error: "key" });
    return json_(record_(b));
  } catch (err) {
    return json_({ ok: false, error: "server" });
  }
}
function doGet() { return json_({ ok: true, service: "Bay 6 Hub Usage" }); }
