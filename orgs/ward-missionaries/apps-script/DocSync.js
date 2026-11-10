/* Bay 6 Hub · stake lesson doc <-> Nights tab sync (Apps Script wrapper).
   Add this file and SisterDocSync.js to the existing "Bay 6 Sister Lesson
   Sign-Ups" project (next to Code.js and SisterLesson.js).
   Setup (once, in the script editor):
   1. Services (+) -> Google Docs API -> Add (identifier "Docs").
   2. Project Settings -> Script properties -> LESSON_DOC_ID = the stake doc id.
   3. Run installDocSyncTrigger once and approve the new Docs + triggers access.
   It then runs every 5 minutes as the script owner. No texts are sent here:
   doc-sourced rows never call notify_, and they carry no phone. */
var DOC_SYNC_LOG_TAB = "Sync Log";

function docSyncLog_(ss, rows) {
  if (!rows.length) return;
  var sh = ss.getSheetByName(DOC_SYNC_LOG_TAB) || ss.insertSheet(DOC_SYNC_LOG_TAB);
  if (sh.getLastRow() === 0) sh.appendRow(["loggedAt", "date", "kind", "hubName", "docName", "docWard", "surfacedToAdam"]);
  rows.forEach(function (c) { sh.appendRow([new Date().toISOString(), c.date, c.kind, c.hubName, c.docName, c.docWard, ""]); });
}

function syncSisterDoc() {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(20000)) return;
  try {
    var docId = props_().getProperty("LESSON_DOC_ID");
    if (!docId) throw new Error("missing LESSON_DOC_ID");
    var sh = nightsSheet_();
    var head = sh.getRange(1, 7, 1, 2).getValues()[0];
    if (head[0] !== "source" || head[1] !== "docSync") sh.getRange(1, 7, 1, 2).setValues([["source", "docSync"]]);
    var values = sh.getRange(1, 1, Math.max(sh.getLastRow(), 1), 8).getValues().map(function (r) { return r.map(textCell_); });
    for (var i = 1; i < values.length; i++) values[i][0] = ymdCell_(sh.getRange(i + 1, 1).getValue()) || values[i][0];

    var rest = Docs.Documents.get(docId);
    var plan = SisterDocSync.plan({ doc: SisterDocSync.fromDocsApi(rest), values: values, now: new Date() });

    if (plan.docInserts.length) {
      /* One atomic batch, highest index first, guarded by the revision we read.
         If anyone edited the doc in between, nothing is written and the next
         run replans. */
      Docs.Documents.batchUpdate({
        requests: plan.docInserts.map(function (x) { return { insertText: { location: { index: x.index }, text: x.text } }; }),
        writeControl: { requiredRevisionId: rest.revisionId }
      }, docId);
    }
    plan.sheetUpdates.forEach(function (u) {
      var range = sh.getRange(u.sheetRow, 1, 1, 8);
      range.setNumberFormat("@");
      range.setValues([u.values]);
    });
    docSyncLog_(sh.getParent(), plan.newConflicts);
    Logger.log(JSON.stringify(plan.summary));
  } finally {
    try { lock.releaseLock(); } catch (ignore) {}
  }
}

function installDocSyncTrigger() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === "syncSisterDoc") ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger("syncSisterDoc").timeBased().everyMinutes(5).create();
}

/* Read-only check from the editor: logs what a run would do. */
function dryRunSisterDoc() {
  var sh = nightsSheet_();
  var values = sh.getRange(1, 1, Math.max(sh.getLastRow(), 1), 8).getValues().map(function (r) { return r.map(textCell_); });
  var rest = Docs.Documents.get(props_().getProperty("LESSON_DOC_ID"));
  var plan = SisterDocSync.plan({ doc: SisterDocSync.fromDocsApi(rest), values: values, now: new Date() });
  Logger.log(JSON.stringify({ summary: plan.summary, docInserts: plan.docInserts, newConflicts: plan.newConflicts, warnings: plan.warnings }));
}
