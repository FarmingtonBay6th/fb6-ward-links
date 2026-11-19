/* Bay 6 Hub · Family History Challenge counts (private Google Sheet).
   Lives in the Bay 6 Hub Usage script so it reuses that script's existing
   Google Sheets permission and its public web app address. No new sign-in.

   What is stored per row: a random row id, the month (YYYY-MM), the group
   (adults, youth, or kids), and a whole number. Nothing else: no names, phone
   numbers, emails, IP addresses, times, or device details.

   Endpoints on the same web app as usage beacons
     GET  ?fh=totals                         → {ok, live, totals:{ "2027-03": {adults, youth, kids} }}
     POST {fh:"add", month, group, n}        → {ok, id}   (n is 1-20)
     POST {fh:"set", id, n}                  → {ok}       (change this browser's own row)
     POST {fh:"del", id}                     → {ok}       (undo this browser's own row)
     POST {fh:"import", key, rows, live}     → owner only; copies rows (keeps their ids)
     POST {fh:"live", key, on}               → owner only; turns the Hub page over to this store
   The private spreadsheet "Bay 6 Family History Counts (Private)" is created the
   first time it is needed. Its id is kept in Script Properties as FH_SHEET_ID. */
var FH_SHEET_TITLE = "Bay 6 Family History Counts (Private)";
var FH_TAB = "Counts";
var FH_HEADER = ["Id", "Month", "Group", "Count"];
var FH_GROUPS = ["adults", "youth", "kids"];
var FH_MAX_N = 20;
var FH_MAX_ROWS = 20000;
var FH_MAX_WRITES_PER_MINUTE = 120;

function fhSheet_() {
  var p = props_();
  var id = p.getProperty("FH_SHEET_ID");
  if (id) {
    try { return SpreadsheetApp.openById(id).getSheetByName(FH_TAB); } catch (err) { return null; }
  }
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    id = p.getProperty("FH_SHEET_ID");
    if (id) return SpreadsheetApp.openById(id).getSheetByName(FH_TAB);
    var ss = SpreadsheetApp.create(FH_SHEET_TITLE);
    var sh = ss.getSheets()[0];
    sh.setName(FH_TAB);
    sh.getRange(1, 1, 1, FH_HEADER.length).setValues([FH_HEADER]).setFontWeight("bold");
    sh.setFrozenRows(1);
    sh.getRange("A:C").setNumberFormat("@");
    p.setProperty("FH_SHEET_ID", ss.getId());
    return sh;
  } finally {
    lock.releaseLock();
  }
}
function fhRows_(sh) {
  if (!sh || sh.getLastRow() < 2) return [];
  return sh.getRange(2, 1, sh.getLastRow() - 1, FH_HEADER.length).getDisplayValues();
}
function fhMonth_(m) {
  m = String(m == null ? "" : m);
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(m)) return "";
  var y = Number(m.slice(0, 4));
  return y >= 2026 && y <= 2030 ? m : "";
}
function fhGroup_(g) { return FH_GROUPS.indexOf(String(g)) >= 0 ? String(g) : ""; }
function fhN_(n) {
  var x = Number(n);
  return isFinite(x) && Math.floor(x) === x && x >= 1 && x <= FH_MAX_N ? x : 0;
}
function fhId_(id) {
  id = String(id == null ? "" : id);
  return /^[A-Za-z0-9_-]{8,40}$/.test(id) ? id : "";
}
function fhNewId_() { return Utilities.getUuid().replace(/-/g, "").slice(0, 24); }
function fhLive_() { return props_().getProperty("FH_LIVE") === "1"; }
function fhThrottle_() {
  var cache = CacheService.getScriptCache();
  var bucket = "fh" + Math.floor(Date.now() / 60000);
  var n = Number(cache.get(bucket) || 0);
  if (n >= FH_MAX_WRITES_PER_MINUTE) return false;
  cache.put(bucket, String(n + 1), 120);
  return true;
}
function fhTotals_() {
  var totals = {};
  fhRows_(fhSheet_()).forEach(function (r) {
    var m = fhMonth_(r[1]), g = fhGroup_(r[2]), n = fhN_(r[3]);
    if (!m || !g || !n) return;
    if (!totals[m]) totals[m] = { adults: 0, youth: 0, kids: 0 };
    totals[m][g] += n;
  });
  return { ok: true, live: fhLive_(), totals: totals };
}
function fhFind_(sh, id) {
  var rows = fhRows_(sh);
  for (var i = 0; i < rows.length; i++) if (rows[i][0] === id) return i + 2;
  return 0;
}
function fhWrite_(b) {
  if (!fhThrottle_()) return { ok: false, error: "busy" };
  var sh = fhSheet_();
  if (!sh) return { ok: false, error: "store" };
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    if (b.fh === "add") {
      var m = fhMonth_(b.month), g = fhGroup_(b.group), n = fhN_(b.n);
      if (!m || !g || !n) return { ok: false, error: "validation" };
      if (sh.getLastRow() - 1 >= FH_MAX_ROWS) return { ok: false, error: "full" };
      var id = fhNewId_();
      sh.appendRow([id, m, g, n]);
      return { ok: true, id: id };
    }
    var rid = fhId_(b.id);
    if (!rid) return { ok: false, error: "validation" };
    var row = fhFind_(sh, rid);
    if (b.fh === "set") {
      var nn = fhN_(b.n);
      if (!nn) return { ok: false, error: "validation" };
      if (!row) return { ok: false, error: "missing" };
      sh.getRange(row, 4).setValue(nn);
      return { ok: true };
    }
    if (b.fh === "del") {
      if (row) sh.deleteRow(row);
      return { ok: true };
    }
    return { ok: false, error: "action" };
  } finally {
    lock.releaseLock();
  }
}
function fhImport_(b) {
  var sh = fhSheet_();
  if (!sh) return { ok: false, error: "store" };
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  var added = 0, skipped = 0;
  try {
    var have = {};
    fhRows_(sh).forEach(function (r) { have[r[0]] = true; });
    var out = [];
    (Array.isArray(b.rows) ? b.rows : []).slice(0, 5000).forEach(function (r) {
      var id = fhId_(r && r.id) || fhNewId_();
      var m = fhMonth_(r && r.month), g = fhGroup_(r && r.group), n = fhN_(r && r.n);
      if (!m || !g || !n || have[id]) { skipped++; return; }
      have[id] = true;
      out.push([id, m, g, n]);
    });
    if (out.length) sh.getRange(sh.getLastRow() + 1, 1, out.length, FH_HEADER.length).setValues(out);
    added = out.length;
    if (b.live === true) props_().setProperty("FH_LIVE", "1");
  } finally {
    lock.releaseLock();
  }
  return { ok: true, added: added, skipped: skipped, live: fhLive_() };
}
function fhPost_(b) {
  if (b.fh === "import") return keyOk_(b.key) ? fhImport_(b) : { ok: false, error: "key" };
  if (b.fh === "live") {
    if (!keyOk_(b.key)) return { ok: false, error: "key" };
    if (b.on === true) props_().setProperty("FH_LIVE", "1"); else props_().deleteProperty("FH_LIVE");
    return { ok: true, live: fhLive_() };
  }
  return fhWrite_(b);
}
