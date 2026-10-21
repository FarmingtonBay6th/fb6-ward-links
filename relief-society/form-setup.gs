/**
 * One-time setup: creates the "Post to Relief Society" Google Form and connects it
 * to the "DRAFT – FB6 Relief Society Page Content" sheet.
 *
 * How to use (about 2 minutes, done once by Adam):
 *   1. Open the sheet. Menu: Extensions > Apps Script.
 *   2. Delete what's in the editor, paste this whole file, click Save.
 *   3. Pick createPostToReliefSocietyForm at the top, click Run, and allow access
 *      (Google warns because it's your own unpublished script; choose Advanced > Go to project).
 *   4. The form's links are written to the START HERE tab (rows 27-28) and to the log.
 *
 * Question titles and order matter: the page reads "Form Responses 1" by column position
 * (A Timestamp, B What kind?, C Title, D Date, E Start, F End, G Place, H Details,
 *  I Link, J Show until, K Hide? (Yes)). Add new questions only at the end.
 */
function createPostToReliefSocietyForm() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var form = FormApp.create('Post to Relief Society');
  form.setDescription('Farmington Bay 6th Ward Relief Society (DRAFT). What you send here shows on the ' +
    'Relief Society page in about 5 minutes. Please no home addresses, health news, or private details.');
  form.setConfirmationMessage('Thank you! It will show on the Relief Society page in about 5 minutes. ' +
    'To fix or hide it, text Adam or open the sheet.');
  form.setShowLinkToRespondAgain(true);
  form.setCollectEmail(false);

  form.addMultipleChoiceItem().setTitle('What kind?')
    .setChoiceValues(['Event', 'Announcement', 'Sign-Up', 'Lesson', 'Newsletter']).setRequired(true);
  form.addTextItem().setTitle('Title').setRequired(true)
    .setHelpText('A few words, like "Fall Activity", "Meals for the Smith family", or "November Newsletter".');
  form.addDateItem().setTitle('Date (optional)')
    .setHelpText('For an event or lesson. Skip it for most announcements and sign-ups.');
  form.addTimeItem().setTitle('Start time (optional)');
  form.addTimeItem().setTitle('End time (optional)');
  form.addTextItem().setTitle('Place (optional)').setHelpText('Like "Relief Society Room". Never a home address.');
  form.addParagraphTextItem().setTitle('Details')
    .setHelpText('What sisters should know or bring. For a lesson, write "Taught by Sister ...".');
  form.addTextItem().setTitle('Link (optional)').setHelpText('A sign-up, newsletter, or read-ahead link.');
  form.addDateItem().setTitle('Show until (optional)').setHelpText('It hides itself after this date.');

  form.setDestination(FormApp.DestinationType.SPREADSHEET, ss.getId());
  SpreadsheetApp.flush();
  Utilities.sleep(4000);

  var sheet = null;
  ss.getSheets().forEach(function (s) {
    var u = s.getFormUrl();
    if (u && !sheet) { try { if (FormApp.openByUrl(u).getId() === form.getId()) sheet = s; } catch (e) {} }
  });
  if (!sheet) throw new Error('Form created but its response tab was not found. Check the tabs at the bottom.');
  if (sheet.getName() !== 'Form Responses 1') sheet.setName('Form Responses 1');

  sheet.getRange('K1').setValue('Hide? (Yes)');
  sheet.getRange('K2:K500').setDataValidation(
    SpreadsheetApp.newDataValidation().requireValueInList(['Yes', 'No'], true).setAllowInvalid(true).build());
  sheet.setFrozenRows(1);
  sheet.getRange('A:K').setFontSize(13).setWrap(true).setVerticalAlignment('middle');
  sheet.getRange('1:1').setFontWeight('bold').setBackground('#005175').setFontColor('#ffffff');
  sheet.setColumnWidths(1, 11, 190);
  sheet.setColumnWidth(3, 280); sheet.setColumnWidth(8, 320);
  sheet.getRange('D2:D500').setNumberFormat('ddd, mmm d, yyyy');
  sheet.getRange('J2:J500').setNumberFormat('ddd, mmm d, yyyy');
  sheet.getRange('E2:F500').setNumberFormat('h:mm am/pm');

  var start = ss.getSheetByName('START HERE');
  if (start) {
    start.getRange('A27').setValue('Form link to give the Presidency (post from a phone): ' + form.getPublishedUrl());
    start.getRange('A28').setValue('Form editing link (Adam only): ' + form.getEditUrl());
  }
  Logger.log('Post form: ' + form.getPublishedUrl());
  Logger.log('Edit form: ' + form.getEditUrl());
}

/**
 * Newsletter upload (DRAFT). Creates a short "Upload Newsletter" form.
 *
 * IMPORTANT: Apps Script's FormApp has NO way to create a File upload question
 * (there is no addFileUploadItem; file-upload items can only be read, not made).
 * So this script makes the form, its instructions, and links it to the sheet;
 * then the Presidency/Adam adds the File upload question by hand (5 clicks, see README):
 *   1. Open the form's edit link (START HERE row 30).
 *   2. Click the (+) "Add question" button on the right.
 *   3. Click the question-type menu (says "Multiple choice") and pick "File upload". Click "Continue".
 *   4. Title it "Your newsletter". Turn on "Allow only specific file types" and check
 *      Document, PDF, Image. Set "Maximum number of files" = 1, "Maximum file size" = 10 MB. Turn on Required.
 *   5. Nothing to save; Google saves it. Uploads go to the form's own Drive folder
 *      ("Upload Newsletter (File responses)") in Adam's Drive.
 * Note: Google requires people to sign in with a Google account to upload a file.
 * Run createUploadNewsletterForm once. It does not share the form with anyone.
 */
function createUploadNewsletterForm() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var form = FormApp.create('Upload Newsletter');
  form.setDescription(
    'Farmington Bay 6th Ward Relief Society (DRAFT).\n\n' +
    '1. Tap \u2018Add file\u2019.\n2. Pick your newsletter.\n3. Tap \u2018Submit\u2019.\n\n' +
    'A PDF works best. Word (.doc, .docx), Google Docs, and pictures (.jpg, .png) also work.\n\n' +
    'Google may ask you to sign in with your Google account first. That\u2019s normal.\n\n' +
    'Can\u2019t upload? Just email it to [Newsletter helper] and she\u2019ll post it.');
  form.setConfirmationMessage('Thank you! Your newsletter was sent. It will be posted soon.');
  form.setCollectEmail(false);
  form.addTextItem().setTitle('Which month? (optional)').setHelpText('Like "November 2026".');
  // File upload question: must be added by hand in the Form editor (see steps above).
  form.setDestination(FormApp.DestinationType.SPREADSHEET, ss.getId());
  var start = ss.getSheetByName('START HERE');
  if (start) {
    start.getRange('A29').setValue('Upload Newsletter form link (for the Presidency): ' + form.getPublishedUrl());
    start.getRange('A30').setValue('Upload Newsletter form editing link (Adam only; add the File upload question here): ' + form.getEditUrl());
  }
  Logger.log('Upload form: ' + form.getPublishedUrl());
  Logger.log('Edit upload form: ' + form.getEditUrl());
}
