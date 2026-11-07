/* Bay 6 Hub · Young Women sign-ups.
   Deploy as a Web App: Execute as me, Anyone. Do not publish the spreadsheet.
   Access is a private link. The script stores only a hash of each link.
   Do not run setupYwSignups again. It creates another spreadsheet. */
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
  return { users: readMembers_(ss), links: readLinks_(ss), signups: signups };
}
function saveStore_(store) {
  var ss = sheet_();
  writeMembers_(ss, store.users || []);
  writeLinks_(ss, store.links || []);
  var json = JSON.stringify(store.signups || {});
  if (json.length > 45000) throw new Error("too large");
  ss.getSheetByName("Document").getRange("A1").setValue(json);
}
function ensureLinks_(ss) {
  var sh = ss.getSheetByName("Links");
  if (!sh) {
    sh = ss.insertSheet("Links");
    sh.appendRow(["id", "memberId", "tokenHash", "status", "createdAt"]);
  }
  return sh;
}
function readLinks_(ss) {
  var sh = ss.getSheetByName("Links");
  if (!sh) return [];
  var values = sh.getDataRange().getValues();
  var links = [];
  for (var i = 1; i < values.length; i++) {
    if (!values[i][0] || !values[i][2]) continue;
    links.push({
      id: String(values[i][0]),
      memberId: String(values[i][1] || ""),
      tokenHash: String(values[i][2] || ""),
      status: String(values[i][3] || "active"),
      createdAt: String(values[i][4] || "")
    });
  }
  return links;
}
function writeLinks_(ss, links) {
  var sh = ensureLinks_(ss);
  var rows = [["id", "memberId", "tokenHash", "status", "createdAt"]];
  (links || []).forEach(function (link) {
    if (!link || !link.tokenHash) return;
    rows.push([link.id, link.memberId, link.tokenHash, link.status || "active", link.createdAt || ""]);
  });
  sh.clearContents();
  sh.getRange(1, 1, rows.length, 5).setValues(rows);
}
function newToken_() {
  return (Utilities.getUuid() + Utilities.getUuid()).replace(/-/g, "");
}
function hashToken_(token) {
  var bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, String(token), Utilities.Charset.UTF_8);
  var out = "";
  for (var i = 0; i < bytes.length; i++) {
    var v = bytes[i] < 0 ? bytes[i] + 256 : bytes[i];
    var hex = v.toString(16);
    out += hex.length === 1 ? "0" + hex : hex;
  }
  return out;
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
function doGet() {
  return json_({ ok: true, service: "yw-signups", auth: "link" });
}
function doPost(e) {
  var body;
  try { body = JSON.parse(e.postData && e.postData.contents ? e.postData.contents : "{}"); }
  catch (err) { return json_({ ok: false, error: "validation", message: "Sign-Ups Could Not Read That Request." }); }
  var plain = "";
  if (body.op === "create-link") {
    plain = newToken_();
    body.tokenHash = hashToken_(plain);
  }
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
      hashToken: hashToken_
    });
    if (result.body && result.body.ok && plain) {
      result.body.privateLink = "https://farmingtonbay6th.github.io/fb6-ward-links/orgs/young-women/chat/#su=" + plain;
    }
    return json_(result.body);
  } catch (err) {
    return json_({ ok: false, error: "validation", message: "Sign-Ups Could Not Be Saved." });
  } finally {
    try { lock.releaseLock(); } catch (ignore) {}
  }
}

/* Run from the script editor after the private sheet already exists.
   Does not create a spreadsheet and does not erase sign-ups.
   Copy the link from the Link Once sheet, then delete that row.
   The execution log does not receive the link. */
function issueOwnerLeaderLink() {
  var id = props_().getProperty("SHEET_ID");
  if (!id) throw new Error("SHEET_ID is missing. Do not run setupYwSignups again.");
  var ss = SpreadsheetApp.openById(id);
  if (!ss.getSheetByName("Members") || !ss.getSheetByName("Document")) {
    throw new Error("The sign-up sheet is missing Members or Document. Do not run setupYwSignups.");
  }
  var store = loadStore_();
  var owner = null;
  (store.users || []).forEach(function (user) {
    if (!owner && user.role === "moderator" && user.kind !== "youth" && !user.removed) owner = user;
  });
  if (!owner) throw new Error("No moderator is on the list. Do not run setupYwSignups.");
  var token = newToken_();
  if (!store.links) store.links = [];
  store.links.push({
    id: "lk-owner-" + new Date().getTime(),
    memberId: owner.id,
    tokenHash: hashToken_(token),
    status: "active",
    createdAt: new Date().toISOString()
  });
  saveStore_(store);
  var once = ss.getSheetByName("Link Once") || ss.insertSheet("Link Once");
  once.clearContents();
  once.getRange("A1").setValue("Delete rows 1 and 2 after you copy the link. Only a hash is kept for sign-ups.");
  once.getRange("A2").setValue("https://farmingtonbay6th.github.io/fb6-ward-links/orgs/young-women/chat/#su=" + token);
  once.getRange("A3").setValue("Do not publish this spreadsheet.");
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
