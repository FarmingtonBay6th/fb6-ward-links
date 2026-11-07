/* Bay 6 Hub · Young Women sign-ups.
   Deploy as a Web App: Execute as me, Anyone. Do not publish the spreadsheet.
   The browser sends a Google ID token in the body. This script checks it,
   then checks the private ward list. Demo personas are ignored. */
function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
function props_() { return PropertiesService.getScriptProperties(); }
function sheet_() {
  var id = props_().getProperty("SHEET_ID");
  if (!id) throw new Error("missing sheet");
  return SpreadsheetApp.openById(id);
}
function readMembers_(ss) {
  var sh = ss.getSheetByName("Members");
  var values = sh.getDataRange().getValues();
  var users = [];
  for (var i = 1; i < values.length; i++) {
    if (!values[i][0]) continue;
    users.push({
      id: String(values[i][0]),
      email: String(values[i][1] || "").toLowerCase(),
      name: String(values[i][2] || ""),
      role: String(values[i][3] || ""),
      kind: String(values[i][4] || ""),
      classId: values[i][5] ? String(values[i][5]) : null,
      status: String(values[i][6] || "active"),
      childIds: values[i][7] ? String(values[i][7]).split(",").filter(Boolean) : [],
      removed: String(values[i][6] || "") === "removed"
    });
  }
  return users;
}
function writeMembers_(ss, users) {
  var sh = ss.getSheetByName("Members");
  var rows = [["id", "email", "name", "role", "kind", "classId", "status", "childIds"]];
  (users || []).forEach(function (user) {
    rows.push([
      user.id, String(user.email || "").toLowerCase(), user.name || "", user.role || "", user.kind || "",
      user.classId || "", user.removed ? "removed" : (user.status || "active"),
      (user.childIds || []).join(",")
    ]);
  });
  sh.clearContents();
  sh.getRange(1, 1, rows.length, 8).setValues(rows);
}
function loadStore_() {
  var ss = sheet_();
  var raw = ss.getSheetByName("Document").getRange("A1").getValue();
  var signups = raw ? JSON.parse(raw) : YWSignups.createModel(new Date());
  return { users: readMembers_(ss), signups: signups };
}
function saveStore_(store) {
  var ss = sheet_();
  writeMembers_(ss, store.users || []);
  var json = JSON.stringify(store.signups || {});
  if (json.length > 45000) throw new Error("too large");
  ss.getSheetByName("Document").getRange("A1").setValue(json);
}
function roster_() {
  var cache = CacheService.getScriptCache();
  var hit = cache.get("yw-roster");
  if (hit) {
    try { return JSON.parse(hit); } catch (e) {}
  }
  var res = UrlFetchApp.fetch("https://farmingtonbay6th.github.io/fb6-ward-links/data/yw-classes.json", { muteHttpExceptions: true });
  if (res.getResponseCode() !== 200) return null;
  var text = res.getContentText();
  cache.put("yw-roster", text, 3600);
  return JSON.parse(text);
}
function verifyGoogleIdToken_(idToken) {
  var clientId = props_().getProperty("GOOGLE_CLIENT_ID");
  if (!clientId) throw new Error("unconfigured");
  var res = UrlFetchApp.fetch("https://oauth2.googleapis.com/tokeninfo?id_token=" + encodeURIComponent(idToken), { muteHttpExceptions: true });
  if (res.getResponseCode() !== 200) throw new Error("bad token");
  var body = JSON.parse(res.getContentText());
  if (body.aud !== clientId) throw new Error("aud");
  if (String(body.email_verified) !== "true") throw new Error("unverified");
  if (!body.email) throw new Error("email");
  return { email: String(body.email).toLowerCase() };
}
function doGet() {
  var clientId = props_().getProperty("GOOGLE_CLIENT_ID") || "";
  return json_({ ok: !!clientId, service: "yw-signups", clientId: clientId });
}
function doPost(e) {
  var body;
  try { body = JSON.parse(e.postData && e.postData.contents ? e.postData.contents : "{}"); }
  catch (err) { return json_({ ok: false, error: "validation", message: "Sign-Ups Could Not Read That Request." }); }
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(20000);
    var roster = null;
    try { roster = roster_(); } catch (ignore) { roster = null; }
    var result = YWSignupApi.handleSignupRequest({
      body: body,
      now: new Date(),
      roster: roster,
      loadStore: loadStore_,
      saveStore: saveStore_,
      verifyToken: verifyGoogleIdToken_
    });
    return json_(result.body);
  } catch (err) {
    return json_({ ok: false, error: "validation", message: "Sign-Ups Could Not Be Saved." });
  } finally {
    try { lock.releaseLock(); } catch (ignore) {}
  }
}

/* Run once from the script editor, signed in as the Google account that owns the Hub scripts.
   Do not publish the spreadsheet to the web. */
function setupYwSignups() {
  var ss = SpreadsheetApp.create("Bay 6 YW Sign-Ups (Private)");
  var members = ss.getSheets()[0];
  members.setName("Members");
  members.appendRow(["id", "email", "name", "role", "kind", "classId", "status", "childIds"]);
  members.getRange("1:1").setFontWeight("bold");
  var doc = ss.insertSheet("Document");
  var email = "";
  try { email = Session.getActiveUser().getEmail() || Session.getEffectiveUser().getEmail() || ""; } catch (e) {}
  email = String(email || "").toLowerCase();
  if (!email) throw new Error("Google did not share the account email. Run this while signed in.");
  var store = {
    users: [{ id: "m-owner", email: email, name: "Ward Leader", role: "moderator", kind: "adult", classId: null, status: "active", childIds: [] }],
    signups: YWSignups.createModel(new Date())
  };
  writeMembers_(ss, store.users);
  doc.getRange("A1").setValue(JSON.stringify(store.signups));
  props_().setProperty("SHEET_ID", ss.getId());
  Logger.log("Private sheet created. Do not use File > Share > Publish to web.");
  Logger.log(ss.getUrl());
}
