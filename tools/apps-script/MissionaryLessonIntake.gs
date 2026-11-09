/**
 * Bay 6 Hub · Sister Missionary lesson requests.
 *
 * This is not deployed. missionaries/lesson/config.js scriptUrl is empty, so
 * the Hub page keeps a draft on the phone and does not call this file.
 *
 * The schedule of record is the existing Google Doc
 * "Farmington Bay Stake Member/Missionary Lessons"
 * (id below, already used by the Hub). An editor of that doc deploys this
 * script. Do not publish the doc to the web, and do not add a public sheet.
 *
 * Deploy, from the Google account that can edit the doc:
 * 1. Open the doc → Extensions → Apps Script.
 * 2. Paste this file. Leave DOC_ID as the existing doc.
 * 3. Deploy → New deployment → Web app.
 *    Execute as: Me. Who has access: Anyone.
 * 4. Paste only the /exec URL into missionaries/lesson/config.js scriptUrl.
 * 5. Do not paste the announcement intake URL or the Young Women sign-up URL.
 *
 * doGet returns weekday dates and open/taken only. It does not return names,
 * wards, or addresses. doPost writes Time, Name, Ward, and Address into an
 * empty weekday cell and refuses a cell whose Name line is already filled.
 * Nothing is emailed or texted.
 */
var DOC_ID = "1ty2rlUhx5cjsyA8UPWuL36PUtyH1O0ZIKVZHEuuYnHQ";
var TIMES = { "6:30": true, "7:00": true, "7:30": true, "8:00": true };
var MONTHS = {
  january: 1, february: 2, march: 3, april: 4, may: 5, june: 6,
  july: 7, august: 8, september: 9, october: 10, november: 11, december: 12
};

function doGet() {
  try {
    var found = findSlots_(DocumentApp.openById(DOC_ID).getBody());
    var slots = found.map(function (slot) {
      return { date: slot.date, status: slot.hasName ? "taken" : "open" };
    });
    return json_({ ok: true, service: "sister-lesson", slots: slots });
  } catch (err) {
    return json_({ ok: false, error: "The Stake Schedule Could Not Be Read." });
  }
}

function doPost(e) {
  try {
    var input = JSON.parse(e && e.postData && e.postData.contents || "{}");
    if (String(input.website || "").trim()) return json_({ ok: false, error: "Could Not Save." });
    var lock = LockService.getScriptLock();
    lock.waitLock(20000);
    try {
      var doc = DocumentApp.openById(DOC_ID);
      var found = findSlots_(doc.getBody());
      var today = Utilities.formatDate(new Date(), "America/Denver", "yyyy-MM-dd");
      var check = validate_(input, found, today);
      if (!check.ok) return json_({ ok: false, error: check.error });
      var slot = slotByDate_(found, check.value.date);
      if (!slot || !slot.bookable) return json_({ ok: false, error: "That Evening Is Not On The Schedule." });
      if (slot.hasName) return json_({ ok: false, error: "That Evening Is Already Taken." });
      writeCell_(slot.cell, [
        String(slot.day),
        "Time: " + check.value.time,
        "Name: " + check.value.name,
        "Ward: " + check.value.ward,
        "Address: " + check.value.address
      ]);
      doc.saveAndClose();
      return json_({ ok: true });
    } finally {
      lock.releaseLock();
    }
  } catch (err) {
    return json_({ ok: false, error: "The Stake Schedule Did Not Save This Request." });
  }
}

function findSlots_(body) {
  var month = 0;
  var year = 0;
  var slots = [];
  var count = body.getNumChildren();
  for (var i = 0; i < count; i++) {
    var child = body.getChild(i);
    var type = child.getType();
    if (type === DocumentApp.ElementType.PARAGRAPH || type === DocumentApp.ElementType.LIST_ITEM) {
      var heading = child.getText();
      var match = String(heading || "").match(/^(January|February|March|April|May|June|July|August|September|October|November|December)\s+(20\d\d)\b/i);
      if (match) {
        month = MONTHS[match[1].toLowerCase()];
        year = Number(match[2]);
      }
    } else if (type === DocumentApp.ElementType.TABLE && month && year) {
      var table = child.asTable();
      for (var r = 1; r < table.getNumRows(); r++) {
        var row = table.getRow(r);
        for (var c = 0; c < row.getNumCells(); c++) {
          var parsed = parseCell_(row.getCell(c), year, month);
          if (parsed && parsed.bookable) slots.push(parsed);
        }
      }
    }
  }
  return slots;
}

function parseCell_(cell, year, month) {
  var lines = [];
  for (var i = 0; i < cell.getNumChildren(); i++) {
    var child = cell.getChild(i);
    if (child.getType() !== DocumentApp.ElementType.PARAGRAPH) continue;
    var text = child.asParagraph().getText().trim();
    if (text) lines.push(text);
  }
  if (!lines.length) return null;
  var dayMatch = lines[0].match(/^(\d{1,2})\b/);
  if (!dayMatch) return null;
  var day = Number(dayMatch[1]);
  var bookable = false;
  var hasName = false;
  for (var n = 0; n < lines.length; n++) {
    if (/^time\s*:/i.test(lines[n])) bookable = true;
    if (/^name\s*:/i.test(lines[n]) && lines[n].split(":").slice(1).join(":").trim()) hasName = true;
  }
  if (!bookable) return null;
  return {
    cell: cell,
    day: day,
    date: iso_(year, month, day),
    bookable: true,
    hasName: hasName
  };
}

function validate_(input, slots, today) {
  var date = String(input.date || "").trim();
  var slot = slotByDate_(slots, date);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !slot) return fail_("That Evening Is Not On The Schedule.");
  if (slot.hasName) return fail_("That Evening Is Already Taken.");
  if (today && date < today) return fail_("That Evening Has Passed.");
  var time = String(input.time || "").trim();
  if (!TIMES[time]) return fail_("Choose A Time.");
  var name = oneLine_(input.name);
  if (name.length < 2) return fail_("Enter Your Name.");
  if (name.length > 80) return fail_("Use 80 Characters Or Fewer For Your Name.");
  var ward = oneLine_(input.ward);
  if (!ward) return fail_("Enter Your Ward.");
  if (ward.length > 40) return fail_("Use 40 Characters Or Fewer For Your Ward.");
  var address = oneLine_(input.address);
  if (address.length < 5 || !/\d/.test(address)) return fail_("Enter The Home Address, Including The Number.");
  if (address.length > 120) return fail_("Use 120 Characters Or Fewer For The Address.");
  return { ok: true, value: { date: date, time: time, name: name, ward: ward, address: address } };
}

function writeCell_(cell, lines) {
  cell.clear();
  if (cell.getNumChildren() === 0) cell.appendParagraph("");
  var first = cell.getChild(0).asParagraph();
  first.setText(lines[0]);
  for (var i = 1; i < lines.length; i++) cell.appendParagraph(lines[i]);
}

function slotByDate_(slots, date) {
  for (var i = 0; i < slots.length; i++) if (slots[i].date === date) return slots[i];
  return null;
}

function oneLine_(value) {
  return String(value == null ? "" : value).replace(/[\r\n\t]+/g, " ").replace(/\s+/g, " ").trim();
}

function iso_(year, month, day) {
  var m = month < 10 ? "0" + month : String(month);
  var d = day < 10 ? "0" + day : String(day);
  return year + "-" + m + "-" + d;
}

function fail_(error) { return { ok: false, error: error }; }

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
