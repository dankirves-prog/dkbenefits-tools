/**
 * DK Benefits compliance checkup leads.
 * Paste this file into a new Apps Script project, run setup once, then deploy
 * as a web app (execute as you, anyone). Put the /exec URL in compliance-quiz/config.js.
 *
 * Sheet name: DK Compliance Leads
 * Dan is emailed immediately. A visitor check-in goes out about 12 minutes later,
 * only from 7:00 through 18:59 ET, once per email per day. Phone-only leads skip
 * the visitor note.
 */
var CL_SHEET_NAME = 'DK Compliance Leads';
var CL_NOTIFY_EMAIL = 'dan@dkbenefits.net';
var CL_FROM_NAME = 'Daniel Kirves';
var CL_REPLY_TO = 'dan@dkbenefits.net';
var CL_FOLLOWUP_DELAY_MS = 12 * 60 * 1000;
var CL_FOLLOWUP_HANDLER = 'processComplianceFollowUps';
var CL_SUBJECT = 'Thanks for using my compliance checkup!';
var CL_HEADERS = [
  'Submitted at',
  'First name',
  'Company',
  'Email',
  'Phone',
  'Answer summary',
  'Top findings',
  'Page URL',
  'Follow-up status',
  'Follow-up due at',
  'Follow-up sent at'
];

function setup() {
  clEnsureSheet_();
  clInstallTrigger_();
}

function doPost(e) {
  try {
    var payload = {};
    if (e && e.postData && e.postData.contents) payload = JSON.parse(e.postData.contents);
    if (clText_(payload.company_website) || clText_(payload.website)) {
      return clJson_({ ok: true, followUp: 'skipped' });
    }
    var checked = clValidateLead(payload);
    if (!checked.ok) return clJson_({ ok: false, error: checked.error });
    var saved = clWithLock_(function () { return clAppendLead_(checked.lead); });
    clEmailDan_(saved);
    return clJson_({ ok: true, followUp: saved.followUpStatus });
  } catch (err) {
    return clJson_({ ok: false, error: String(err && err.message ? err.message : err) });
  }
}

function processComplianceFollowUps() {
  var now = clNow_();
  var sheet = clEnsureSheet_();
  var values = sheet.getDataRange().getValues();
  if (values.length < 2) return;
  var header = values[0];
  var sentToday = {};
  for (var i = 1; i < values.length; i++) {
    var prior = clRowToObject_(header, values[i]);
    if (prior['Follow-up status'] === 'sent' && prior.Email && prior['Follow-up sent at']) {
      var sentAt = Date.parse(prior['Follow-up sent at']);
      if (!isNaN(sentAt) && clSameEtDay_(sentAt, now)) sentToday[String(prior.Email).toLowerCase()] = true;
    }
  }
  for (var r = 1; r < values.length; r++) {
    var row = clRowToObject_(header, values[r]);
    if (row['Follow-up status'] !== 'pending') continue;
    if (!clFilled_(row.Email)) {
      row['Follow-up status'] = 'skipped';
      clWriteRow_(sheet, r + 1, header, row);
      continue;
    }
    var dueAt = Date.parse(row['Follow-up due at']);
    if (isNaN(dueAt)) dueAt = clFollowUpDue(now);
    var emailKey = String(row.Email).toLowerCase();
    var decision = clFollowUpDecision(dueAt, now, !!sentToday[emailKey]);
    if (decision.action === 'wait') {
      row['Follow-up due at'] = new Date(decision.nextAt).toISOString();
      clWriteRow_(sheet, r + 1, header, row);
      continue;
    }
    clSendFollowUp_(row);
    row['Follow-up status'] = 'sent';
    row['Follow-up sent at'] = new Date(now).toISOString();
    clWriteRow_(sheet, r + 1, header, row);
    sentToday[emailKey] = true;
  }
}

function clValidateLead(payload) {
  payload = payload || {};
  var firstName = clText_(payload.firstName);
  var company = clText_(payload.company);
  var email = clText_(payload.email);
  var phone = clText_(payload.phone);
  if (!firstName) return { ok: false, error: 'First name is required.' };
  if (!company) return { ok: false, error: 'Company is required.' };
  if (!email && !phone) return { ok: false, error: 'Email or phone is required.' };
  if (email && !clEmailOk_(email)) return { ok: false, error: 'Enter a valid email.' };
  if (phone && String(phone).replace(/\D/g, '').length < 7) return { ok: false, error: 'Enter a valid phone number.' };
  return {
    ok: true,
    lead: {
      firstName: firstName,
      company: company,
      email: email,
      phone: phone,
      summary: clBlock_(payload.summary),
      findings: clBlock_(payload.findings),
      pageUrl: clText_(payload.pageUrl)
    }
  };
}

function clFollowUpDue(contactAtMs) {
  var due = contactAtMs + CL_FOLLOWUP_DELAY_MS;
  if (!clInBusinessHours(due)) return clNextOpen(due);
  return due;
}

function clInBusinessHours(utcMs) {
  var parts = clZonedParts_(utcMs);
  return parts.hour >= 7 && parts.hour <= 18;
}

function clNextOpen(utcMs) {
  if (clInBusinessHours(utcMs)) return utcMs;
  var parts = clZonedParts_(utcMs);
  var when = parts.hour >= 19
    ? clAddDays_(parts.year, parts.month, parts.day, 1)
    : { year: parts.year, month: parts.month, day: parts.day };
  return clLocalToUtc_(when.year, when.month, when.day, 7, 0);
}

function clFollowUpDecision(dueAtMs, nowMs, sentToday) {
  if (sentToday) {
    var parts = clZonedParts_(nowMs);
    var nextDay = clAddDays_(parts.year, parts.month, parts.day, 1);
    return {
      action: 'wait',
      reason: 'already sent today',
      nextAt: clLocalToUtc_(nextDay.year, nextDay.month, nextDay.day, 7, 0)
    };
  }
  if (nowMs < dueAtMs) return { action: 'wait', reason: 'not due', nextAt: dueAtMs };
  if (!clInBusinessHours(nowMs)) return { action: 'wait', reason: 'after hours', nextAt: clNextOpen(nowMs) };
  return { action: 'send', reason: 'due', nextAt: nowMs };
}

function clFollowUpBody(name) {
  return [
    clGreeting_(name),
    '',
    'Thanks for running the benefits compliance checkup. I hope it gave you a clear picture of where things stand.',
    '',
    'By the way, I\'m an independent employee benefits broker, and I help employers get these items in order and shop group benefits across the full market. If you want a second set of eyes on your results, call or text me at 407-476-5076 or email me.',
    '',
    'Daniel Kirves',
    'Benefits Broker | 20 Years Exp | DK Benefits',
    '407-476-5076 | www.dkbenefits.net',
    '6000 Metrowest Blvd #200 Orlando, FL 32835',
    '',
    'Agency Lic# L109331'
  ].join('\n');
}

function clGreeting_(name) {
  var text = clText_(name);
  if (!text) return 'Hi there,';
  return 'Hi ' + text.split(/\s+/)[0] + ',';
}

function clAppendLead_(lead) {
  var sheet = clEnsureSheet_();
  var now = clNow_();
  var hasEmail = clFilled_(lead.email);
  var status = hasEmail ? 'pending' : 'skipped';
  var due = hasEmail ? new Date(clFollowUpDue(now)).toISOString() : '';
  var record = {
    'Submitted at': new Date(now).toISOString(),
    'First name': lead.firstName,
    'Company': lead.company,
    'Email': lead.email,
    'Phone': lead.phone,
    'Answer summary': lead.summary,
    'Top findings': lead.findings,
    'Page URL': lead.pageUrl,
    'Follow-up status': status,
    'Follow-up due at': due,
    'Follow-up sent at': ''
  };
  sheet.appendRow(CL_HEADERS.map(function (key) { return record[key] || ''; }));
  record.followUpStatus = status;
  return record;
}

function clEmailDan_(record) {
  var body = [
    'First name: ' + (record['First name'] || ''),
    'Company: ' + (record.Company || ''),
    'Email: ' + (record.Email || ''),
    'Phone: ' + (record.Phone || ''),
    'Page: ' + (record['Page URL'] || ''),
    '',
    'Answers:',
    record['Answer summary'] || '',
    '',
    'Top findings:',
    record['Top findings'] || ''
  ].join('\n');
  GmailApp.sendEmail(CL_NOTIFY_EMAIL, 'Compliance checkup lead', body, {
    name: CL_FROM_NAME,
    replyTo: CL_REPLY_TO
  });
}

function clSendFollowUp_(row) {
  var body = clFollowUpBody(row['First name']);
  GmailApp.sendEmail(row.Email, CL_SUBJECT, body, {
    name: CL_FROM_NAME,
    replyTo: CL_REPLY_TO,
    htmlBody: clPlainHtml_(body)
  });
}

function clPlainHtml_(body) {
  return clEscape_(body).replace(/\n/g, '<br>');
}

function clEscape_(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function clEnsureSheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(CL_SHEET_NAME);
  if (!sheet) sheet = ss.insertSheet(CL_SHEET_NAME);
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(CL_HEADERS);
    if (typeof sheet.setFrozenRows === 'function') sheet.setFrozenRows(1);
  }
  return sheet;
}

function clInstallTrigger_() {
  var triggers = ScriptApp.getProjectTriggers();
  for (var i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === CL_FOLLOWUP_HANDLER) return;
  }
  ScriptApp.newTrigger(CL_FOLLOWUP_HANDLER).timeBased().everyMinutes(5).create();
}

function clWriteRow_(sheet, rowNumber, header, row) {
  var values = header.map(function (key) { return row[key] == null ? '' : row[key]; });
  sheet.getRange(rowNumber, 1, 1, header.length).setValues([values]);
}

function clRowToObject_(header, values) {
  var row = {};
  for (var i = 0; i < header.length; i++) row[header[i]] = values[i] == null ? '' : values[i];
  return row;
}

function clWithLock_(fn) {
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    return fn();
  } finally {
    lock.releaseLock();
  }
}

function clJson_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function clNow_() {
  if (typeof CL_TEST_NOW === 'number') return CL_TEST_NOW;
  return Date.now();
}

function clEmailOk_(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function clFilled_(value) {
  if (value == null) return false;
  return String(value).trim() !== '';
}

function clText_(value) {
  if (value == null) return '';
  return String(value).replace(/[\r\n\t]/g, ' ').trim();
}

function clBlock_(value) {
  if (value == null) return '';
  return String(value).replace(/\r/g, '').replace(/[\t\f\v]/g, ' ').trim();
}

function clSameEtDay_(msA, msB) {
  var a = clZonedParts_(msA);
  var b = clZonedParts_(msB);
  return a.year === b.year && a.month === b.month && a.day === b.day;
}

function clNthSunday_(year, monthIndex, n) {
  var first = new Date(Date.UTC(year, monthIndex, 1));
  var day = first.getUTCDay();
  return 1 + ((7 - day) % 7) + (n - 1) * 7;
}

function clDstStartUtc_(year) {
  return Date.UTC(year, 2, clNthSunday_(year, 2, 2), 7, 0, 0);
}

function clDstEndUtc_(year) {
  return Date.UTC(year, 10, clNthSunday_(year, 10, 1), 6, 0, 0);
}

function clIsEdt_(utcMs) {
  var year = new Date(utcMs).getUTCFullYear();
  return utcMs >= clDstStartUtc_(year) && utcMs < clDstEndUtc_(year);
}

function clZonedParts_(utcMs) {
  var shifted = new Date(utcMs + (clIsEdt_(utcMs) ? -4 : -5) * 3600000);
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
    hour: shifted.getUTCHours(),
    minute: shifted.getUTCMinutes(),
    weekday: shifted.getUTCDay()
  };
}

function clLocalToUtc_(year, month, day, hour, minute) {
  var candidates = [
    Date.UTC(year, month - 1, day, hour + 4, minute),
    Date.UTC(year, month - 1, day, hour + 5, minute)
  ];
  for (var i = 0; i < candidates.length; i++) {
    var parts = clZonedParts_(candidates[i]);
    if (parts.year === year && parts.month === month && parts.day === day && parts.hour === hour && parts.minute === minute) {
      return candidates[i];
    }
  }
  return candidates[1];
}

function clAddDays_(year, month, day, days) {
  var shifted = new Date(Date.UTC(year, month - 1, day) + days * 86400000);
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate()
  };
}
