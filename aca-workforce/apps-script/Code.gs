/**
 * Optional lead catcher for the ACA workforce size calculator.
 *
 * Do not deploy this until Dan wants the form to send.
 * Leave the endpoint in aca-workforce/config.js as an empty string until then.
 * The calculator still runs with a blank endpoint. This file has no secrets.
 *
 * Container-bound to a spreadsheet. Deploy as a web app:
 * Execute as Me (dan@dkbenefits.net), Who has access: Anyone.
 * Paste the /exec URL into config.js after that deploy.
 */
var ATNE_SHEET_NAME = 'Workforce leads';

function doGet() {
  return ContentService
    .createTextOutput('DK Benefits workforce-size lead service is deployed.')
    .setMimeType(ContentService.MimeType.TEXT);
}

function doPost(e) {
  var body = {};
  try {
    body = JSON.parse((e.postData && e.postData.contents) || '{}');
  } catch (err) {
    return json_({ ok: false, error: 'bad json' });
  }
  if (body.company_website) return json_({ ok: true });
  if (!body.consent) return json_({ ok: false, error: 'Consent is required.' });
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(ATNE_SHEET_NAME) || ss.insertSheet(ATNE_SHEET_NAME);
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(['When', 'Name', 'Company', 'Email', 'Year', 'ATNE rounded', 'Headline', 'Summary', 'Page']);
  }
  sheet.appendRow([
    new Date(),
    body.name || '',
    body.company || '',
    body.email || '',
    body.year || '',
    body.floored || '',
    body.headline || '',
    body.report || '',
    body.pageUrl || ''
  ]);
  return json_({ ok: true });
}

function json_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
