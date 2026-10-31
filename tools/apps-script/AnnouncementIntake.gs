/**
 * Ward Links "Submit an Announcement" no-login intake (Google Apps Script web app).
 * Deploy from adamandshalisa@gmail.com: Extensions > Apps Script in the response sheet (or script.new),
 * paste this file, then Deploy > New deployment > Web app: Execute as "Me", Who has access "Anyone".
 * Paste the /exec URL into announce/index.html (GAS_URL). Nothing is published until Adam approves each row, EXCEPT Young Women class-tab flyers (Where = "YW:<class>", source=yw), which the intake routine posts automatically.
 */
const SHEET_ID  = '1IYZeE7NEQkc_36PGjaX3qKj9PfuUsKt8l3S8Xwj8k3s';   // Ward Links Announcement Submissions (SacramentMeeting)
const FOLDER_ID = '1AgH3EXbsLHPqB3_XMQxHt3Wqc5-qv4DU';             // SacramentMeeting / Announcement Flyers (private)
const MAX_BYTES = 10 * 1024 * 1024;
const OK_EXT = ['jpg', 'jpeg', 'png', 'heic', 'heif', 'pdf'];

function doPost(e) {
  try {
    const d = JSON.parse(e.postData.contents);
    if (d.website) return out({ ok: true });                       // honeypot: bots fill the hidden field
    const clip = (s, n) => String(s || '').trim().slice(0, n);
    const hasAnn = clip(d.title, 140) && clip(d.details, 3000), hasFile = d.file && d.file.data;
    if (!clip(d.name, 100) || !(hasAnn || hasFile)) return out({ ok: false, error: 'Please add your name and an announcement or a flyer.' });
    let fileName = '', fileUrl = '';
    if (d.file && d.file.data) {
      const ext = String(d.file.name || '').split('.').pop().toLowerCase();
      if (OK_EXT.indexOf(ext) < 0) return out({ ok: false, error: 'Flyer must be JPG, PNG, HEIC or PDF.' });
      const bytes = Utilities.base64Decode(d.file.data);
      if (bytes.length > MAX_BYTES) return out({ ok: false, error: 'Flyer must be 10 MB or smaller.' });
      const stamp = Utilities.formatDate(new Date(), 'America/Denver', 'yyyy-MM-dd HHmm');
      const blob = Utilities.newBlob(bytes, d.file.type || 'application/octet-stream', stamp + ' ' + clip(d.file.name, 80));
      const f = DriveApp.getFolderById(FOLDER_ID).createFile(blob);   // stays private to Adam
      fileName = f.getName(); fileUrl = f.getUrl();
    }
    const lock = LockService.getScriptLock(); lock.waitLock(20000);
    SpreadsheetApp.openById(SHEET_ID).getSheets()[0].appendRow([
      new Date(), clip(d.name, 100), clip(d.contact, 120), clip(d.title, 140), clip(d.details, 3000),
      clip(d.start, 10), clip(d.end, 10), clip(d.where, 20), clip(d.link, 500), fileName, fileUrl, 'New', '', clip(d.source, 10), clip(d.ywClass, 40)]);  // source=yw rows (Where = 'YW:<class>') are auto-posted, no approval
    lock.releaseLock();
    return out({ ok: true });
  } catch (err) {
    return out({ ok: false, error: 'Something went wrong. Please try again.' });
  }
}
function out(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }
