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
