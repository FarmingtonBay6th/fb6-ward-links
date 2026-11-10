/* Bay 6 Hub · Sister missionary lesson sign-up.
   Private Google Sheet behind a web app. Paste this file and SisterLesson.js
   into a new Apps Script project. Do not add this to the Young Women project.

   Deploy
   1. https://script.google.com → New project → name it Bay 6 Sister Lesson Sign-Ups.
      Use the Google account that owns the other Hub scripts.
   2. Add SisterLesson.js and replace Code.gs with this file. Show the manifest
      and replace it with appsscript.json from this folder.
   3. Select setupSisterLessons → Run → allow Sheets. It creates one private
      spreadsheet and saves SHEET_ID. Do not run it again. Do not use
      File → Share → Publish to the web.
   4. Project Settings → Script properties:
      SHEET_ID     set by setup
      WEBHOOK_URL  https endpoint that texts the sisters and the Ward Mission Leader
      WEBHOOK_KEY  sent as the X-Webhook-Key header when it is set
      Leave the webhook properties empty until texting is ready. Claims still save.
   5. Deploy → New deployment → Web app → Execute as Me → Who has access: Anyone.
      Copy the URL that ends in /exec.
   6. Put that URL in orgs/ward-missionaries/sister-lesson-config.js (scriptUrl).
      A new script version is Deploy → Manage deployments → Edit → New version.
      The /exec URL stays the same.
   Do not put the spreadsheet id, WEBHOOK_URL, or WEBHOOK_KEY in the repo. */
function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
function props_() { return PropertiesService.getScriptProperties(); }
function nightsSheet_() {
  var id = props_().getProperty("SHEET_ID");
  if (!id) throw new Error("missing sheet");
  var sh = SpreadsheetApp.openById(id).getSheetByName("Nights");
  if (!sh) throw new Error("missing nights");
  return sh;
}
function ymdCell_(value) {
  if (Object.prototype.toString.call(value) === "[object Date]" && !isNaN(value.getTime())) {
    return Utilities.formatDate(value, "America/Denver", "yyyy-MM-dd");
  }
  var match = String(value || "").trim().match(/^(\d{4}-\d{2}-\d{2})/);
  return match ? match[1] : "";
}
function textCell_(value) {
  if (value == null || value === "") return "";
  if (Object.prototype.toString.call(value) === "[object Date]" && !isNaN(value.getTime())) {
    return Utilities.formatDate(value, "America/Denver", "yyyy-MM-dd'T'HH:mm:ss");
  }
  return String(value);
}
function loadNights_() {
  var values = nightsSheet_().getDataRange().getValues();
  var nights = [];
  for (var i = 1; i < values.length; i++) {
    var date = ymdCell_(values[i][0]);
    if (!date) continue;
    nights.push({
      date: date,
      time: textCell_(values[i][1]),
      status: textCell_(values[i][2]),
      name: textCell_(values[i][3]),
      phone: textCell_(values[i][4]),
      claimedAt: textCell_(values[i][5])
    });
  }
  return nights;
}
function saveNights_(nights) {
  var sh = nightsSheet_();
  var rows = [["date", "time", "status", "name", "phone", "claimedAt"]];
  (nights || []).forEach(function (night) {
    var taken = night && night.status === "reserved";
    rows.push([
      night.date,
      SisterLesson.TIME,
      taken ? "reserved" : "open",
      taken ? (night.name || "") : "",
      taken ? (night.phone || "") : "",
      taken ? (night.claimedAt || "") : ""
    ]);
  });
  var last = sh.getLastRow();
  var range = sh.getRange(1, 1, rows.length, 6);
  range.setNumberFormat("@");
  range.setValues(rows);
  if (last > rows.length) sh.getRange(rows.length + 1, 1, last - rows.length, 6).clearContent();
  sh.getRange("1:1").setFontWeight("bold");
  sh.setFrozenRows(1);
}
function notify_(payload) {
  try {
    var url = String(props_().getProperty("WEBHOOK_URL") || "").trim();
    if (url.indexOf("https://") !== 0) return;
    var key = String(props_().getProperty("WEBHOOK_KEY") || "");
    var headers = {};
    if (key) headers["X-Webhook-Key"] = key;
    UrlFetchApp.fetch(url, {
      method: "post",
      contentType: "application/json",
      headers: headers,
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    });
  } catch (err) {}
}
function handle_(body) {
  return SisterLesson.handle({
    body: body || {},
    now: new Date(),
    loadNights: loadNights_,
    saveNights: saveNights_,
    notify: notify_
  });
}
function doGet() {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(20000);
    return json_(handle_({ op: "list" }).body);
  } catch (err) {
    return json_({ ok: false, error: "unavailable", message: "Sign-Up Could Not Be Loaded." });
  } finally {
    try { lock.releaseLock(); } catch (ignore) {}
  }
}
function doPost(e) {
  var body;
  try { body = JSON.parse(e.postData && e.postData.contents ? e.postData.contents : "{}"); }
  catch (err) { return json_({ ok: false, error: "validation", message: "Sign-Up Could Not Read That Request." }); }
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(20000);
    return json_(handle_(body).body);
  } catch (err) {
    return json_({ ok: false, error: "unavailable", message: "Sign-Up Could Not Be Saved." });
  } finally {
    try { lock.releaseLock(); } catch (ignore) {}
  }
}

/* Run once from the script editor. Creates the private sheet. Do not run again. */
function setupSisterLessons() {
  if (typeof SisterLesson === "undefined" || !SisterLesson.buildNights) {
    throw new Error("Paste SisterLesson.js into this project before running setup.");
  }
  if (props_().getProperty("SHEET_ID")) {
    throw new Error("SHEET_ID is already set. Do not create another spreadsheet.");
  }
  var ss = SpreadsheetApp.create("Bay 6 Sister Lesson Sign-Ups (Private)");
  var sh = ss.getSheets()[0];
  sh.setName("Nights");
  var nights = SisterLesson.buildNights();
  props_().setProperty("SHEET_ID", ss.getId());
  saveNights_(nights);
  Logger.log("Private sheet created. Do not use File > Share > Publish to the web.");
  Logger.log("Add WEBHOOK_URL and WEBHOOK_KEY in Script properties when texting is ready.");
}
