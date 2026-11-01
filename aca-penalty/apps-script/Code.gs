/**
 * DK Benefits ACA calculator leads. One row per visitor.
 *
 * Container-bound to a spreadsheet. The leads tab is named DK ACA Leads.
 * Deploy as a web app: Execute as Me (dan@dkbenefits.net), Who has access: Anyone.
 * Run setupAcaLeads once from the editor so the tab and the 5-minute trigger
 * belong to that account.
 *
 * The page reads the /exec URL from aca-penalty/config.js. Until that value
 * is a real URL, the calculator does not post.
 *
 * calculation_run emails dan@dkbenefits.net once, with inputs and results
 * and no contact information. Recalculations update the same row and do not
 * email again. lead_submitted emails Dan once with the contact and the latest
 * results. The visitor gets one delayed check-in, about 10 minutes later,
 * during Eastern business hours, with the results summary.
 */
var ACA_NOTIFY_EMAIL = 'dan@dkbenefits.net';
var ACA_SHEET_NAME = 'DK ACA Leads';
var ACA_FOLLOWUP_HANDLER = 'acaSendDueFollowUps';
var ACA_FOLLOWUP_DELAY_MS = 10 * 60 * 1000;
var ACA_DAILY_CALC_CAP = 200;
var ACA_DAILY_LEAD_CAP = 50;
var ACA_MIN_ELAPSED_MS = 3000;
var ACA_TEST_NOW = null;
var ACA_SESSION_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

var ACA_HEADERS = [
  'Visitor ID', 'First seen', 'Last updated', 'Status', 'Test',
  'Year', 'ALE status', 'Prior-year full-time', 'Prior-year FTE',
  'Prior-year average', 'Prior-year rounded', 'Seasonal exception',
  'Controlled group', 'Reduction', 'Offer result', 'PTC count',
  'Months affected', 'A penalty monthly', 'A penalty annual',
  'B penalty monthly', 'B penalty annual', 'B capped',
  'Scenario offer nothing', 'Scenario unaffordable', 'Scenario affordable',
  'Safe harbor', 'Affordability result', 'Premium',
  'Actual result', 'Actual amount', 'Report',
  'Name', 'Company', 'Email', 'Phone', 'Form employee count', 'Consent',
  'Page URL', 'Referrer', 'Notifications',
  'Calc emailed at', 'Lead emailed at', 'Contact submitted at',
  'Follow-up status', 'Follow-up sent at'
];

var ACA_SUMMARY_COLUMNS = {
  year: 'Year',
  aleStatus: 'ALE status',
  priorFullTime: 'Prior-year full-time',
  priorFte: 'Prior-year FTE',
  priorAverage: 'Prior-year average',
  priorRounded: 'Prior-year rounded',
  seasonal: 'Seasonal exception',
  controlledGroup: 'Controlled group',
  reduction: 'Reduction',
  offerResult: 'Offer result',
  ptcCount: 'PTC count',
  monthsAffected: 'Months affected',
  aMonthly: 'A penalty monthly',
  aAnnual: 'A penalty annual',
  bMonthly: 'B penalty monthly',
  bAnnual: 'B penalty annual',
  bCapped: 'B capped',
  scenarioNothing: 'Scenario offer nothing',
  scenarioUnaffordable: 'Scenario unaffordable',
  scenarioAffordable: 'Scenario affordable',
  safeHarbor: 'Safe harbor',
  affordabilityResult: 'Affordability result',
  premium: 'Premium',
  actualLabel: 'Actual result',
  actualAnnual: 'Actual amount'
};

var ACA_CONTACT_COLUMNS = ['Name', 'Company', 'Email', 'Phone', 'Form employee count', 'Consent'];

function doGet() {
  return ContentService
    .createTextOutput('DK Benefits ACA lead service is deployed.')
    .setMimeType(ContentService.MimeType.TEXT);
}

function doPost(e) {
  var payload;
  try {
    payload = JSON.parse((e && e.postData && e.postData.contents) || '{}');
  } catch (err) {
    return acaJson_({ ok: false, error: 'invalid payload' });
  }
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return acaJson_({ ok: false, error: 'invalid payload' });
  }
  if (payload.hp) return acaJson_({ ok: true, ignored: true });
  if (!acaIsSessionId_(payload.sessionId)) return acaJson_({ ok: false, error: 'invalid session id' });
  if (payload.event !== 'calculation_run' && payload.event !== 'calculation_update' && payload.event !== 'lead_submitted') {
    return acaJson_({ ok: false, error: 'unrecognized event' });
  }
  var leadError = payload.event === 'lead_submitted' ? acaLeadError_(payload) : '';
  if (leadError) return acaJson_({ ok: false, error: leadError });

  try {
    return acaWithLock_(function () {
      var sheet = acaEnsureSheet_();
      var values = sheet.getDataRange().getValues();
      var header = values.length ? values[0] : ACA_HEADERS.slice();
      var index = acaHeaderIndex_(header);
      var found = acaFindVisitorRow_(values, index, payload.sessionId);
      var current = found ? acaRowFromValues_(header, values[found - 1]) : null;
      var nowIso = new Date(acaNowMs_()).toISOString();
      var applied = acaApplyEvent(current, payload, nowIso, values, header);
      acaWriteRow_(sheet, header, found, applied.row);
      var emailed = acaSendDanEmails_(sheet, header, applied.row, applied.emails);
      return acaJson_({
        ok: true,
        sessionId: payload.sessionId,
        status: applied.row.Status,
        emailed: emailed,
        alreadyNotified: applied.alreadyNotified,
        retry: applied.retry
      });
    });
  } catch (err) {
    return acaJson_({ ok: false, error: String(err && err.message ? err.message : err) });
  }
}

function setupAcaLeads() {
  var sheet = acaEnsureSheet_();
  acaInstallTrigger_();
  return 'ACA leads ready on ' + sheet.getName();
}

function acaSendDueFollowUps() {
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    var sheet = acaEnsureSheet_();
    var values = sheet.getDataRange().getValues();
    if (!values.length) return;
    var header = values[0];
    var now = acaNowMs_();
    var rows = [];
    for (var i = 1; i < values.length; i++) rows.push(acaRowFromValues_(header, values[i]));
    for (var r = 0; r < rows.length; r++) {
      var row = rows[r];
      var status = String(row['Follow-up status'] || '');
      if (status !== 'pending' && status !== 'failed') continue;
      var contactAt = acaCellTime_(row['Contact submitted at']);
      if (isNaN(contactAt)) continue;
      var plan = acaFollowUpDecision(contactAt, now);
      if (plan.action !== 'send') continue;
      var email = String(row.Email || '').trim();
      if (!email) {
        row['Follow-up status'] = 'skipped';
        acaWriteRow_(sheet, header, r + 2, row);
        rows[r] = row;
        continue;
      }
      var testRow = String(row.Test || '') === 'yes';
      if (!testRow && acaAlreadyFollowed_(rows, email, row['Visitor ID'])) {
        row['Follow-up status'] = 'skipped';
        acaWriteRow_(sheet, header, r + 2, row);
        rows[r] = row;
        continue;
      }
      try {
        acaSendVisitor_(acaFollowUpMessage(row));
        row['Follow-up status'] = 'sent';
        row['Follow-up sent at'] = new Date(now).toISOString();
        acaWriteRow_(sheet, header, r + 2, row);
        rows[r] = row;
      } catch (err) {
        row['Follow-up status'] = 'failed';
        acaWriteRow_(sheet, header, r + 2, row);
        rows[r] = row;
      }
    }
  } finally {
    lock.releaseLock();
  }
}

function acaApplyEvent(previous, payload, nowIso, allValues, header) {
  var row = {};
  var key;
  for (key in (previous || {})) row[key] = previous[key];
  var eventName = payload.event;
  var summary = payload.summary || {};
  if (!acaFilled_(row['Visitor ID'])) row['Visitor ID'] = String(payload.sessionId || '');
  if (!acaFilled_(row['First seen'])) row['First seen'] = nowIso;
  row['Last updated'] = nowIso;
  if (!acaFilled_(row.Test)) row.Test = payload.test ? 'yes' : 'no';
  if (!acaFilled_(row.Status)) row.Status = 'Calculated';
  if (eventName === 'lead_submitted') row.Status = 'Contact submitted';
  else if (row.Status !== 'Contact submitted') row.Status = 'Calculated';

  for (key in ACA_SUMMARY_COLUMNS) {
    if (summary[key] != null && String(summary[key]).trim() !== '') {
      row[ACA_SUMMARY_COLUMNS[key]] = acaText_(summary[key], key === 'aleStatus' ? 500 : 300);
    }
  }
  if (payload.report) row.Report = String(payload.report).slice(0, 45000);
  if (payload.pageUrl && !acaFilled_(row['Page URL'])) row['Page URL'] = acaText_(payload.pageUrl, 500);
  if (payload.referrer && !acaFilled_(row.Referrer)) row.Referrer = acaText_(payload.referrer, 500);

  if (eventName === 'lead_submitted') {
    var contact = payload.contact || {};
    row.Name = acaText_(contact.name, 120);
    row.Company = acaText_(contact.company, 160);
    row.Email = acaText_(contact.email, 160);
    row.Phone = acaText_(contact.phone, 40);
    row['Form employee count'] = acaText_(contact.employees, 40);
    row.Consent = 'yes';
    if (!acaFilled_(row['Contact submitted at'])) row['Contact submitted at'] = nowIso;
    if (acaFilled_(row.Email) && (!acaFilled_(row['Follow-up status']) || row['Follow-up status'] === 'skipped')) {
      row['Follow-up status'] = 'pending';
    } else if (!acaFilled_(row.Email) && !acaFilled_(row['Follow-up status'])) {
      row['Follow-up status'] = 'skipped';
    }
  }

  var notes = acaNoteSet_(row.Notifications);
  var emails = [];
  var alreadyNotified = false;
  var retry = false;
  var rows = acaRows_(allValues, header);
  if (eventName === 'calculation_run') {
    if (notes.calc) {
      alreadyNotified = true;
    } else if (acaCountToday_(rows, 'Calc emailed at', row['Visitor ID']) >= ACA_DAILY_CALC_CAP) {
      retry = true;
    } else {
      notes.calc = true;
      row['Calc emailed at'] = nowIso;
      emails.push(acaCalcEmail_(row));
    }
  }
  if (eventName === 'lead_submitted') {
    if (notes.lead) {
      alreadyNotified = true;
    } else if (acaCountToday_(rows, 'Lead emailed at', row['Visitor ID']) >= ACA_DAILY_LEAD_CAP) {
      retry = true;
    } else {
      notes.lead = true;
      row['Lead emailed at'] = nowIso;
      emails.push(acaLeadEmail_(row));
    }
  }
  row.Notifications = acaNoteJoin_(notes);
  return { row: row, emails: emails, alreadyNotified: alreadyNotified, retry: retry };
}

function acaLeadError_(payload) {
  var started = Date.parse(payload.startedAt || '');
  var submitted = Date.parse(payload.submittedAt || '') || acaNowMs_();
  if (!started || submitted - started < ACA_MIN_ELAPSED_MS) return 'Please wait a moment and try the form again.';
  var contact = payload.contact || {};
  if (!acaText_(contact.name, 120) || !acaText_(contact.company, 160)) return 'Enter your name and company.';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(acaText_(contact.email, 160))) return 'Enter a valid email.';
  if (contact.phone && String(contact.phone).replace(/\D/g, '').length < 7) return 'Enter a valid phone number or leave it blank.';
  if (contact.consent !== true) return 'The consent line is required.';
  return '';
}

function acaCalcEmail_(row) {
  return {
    kind: 'calc',
    to: ACA_NOTIFY_EMAIL,
    subject: acaSubject_(row, 'ACA calculation run'),
    body: [
      'ACA calculation run',
      'No contact information. This visitor has not submitted the form.',
      '',
      acaResultsBody_(row),
      '',
      'Page: ' + (row['Page URL'] || ''),
      'Visitor ID: ' + (row['Visitor ID'] || '')
    ].join('\n')
  };
}

function acaLeadEmail_(row) {
  return {
    kind: 'lead',
    to: ACA_NOTIFY_EMAIL,
    subject: acaSubject_(row, 'ACA compliance review request: ' + (row.Company || 'new lead')),
    body: [
      'ACA compliance review request',
      '',
      'Name: ' + (row.Name || ''),
      'Company: ' + (row.Company || ''),
      'Email: ' + (row.Email || ''),
      'Phone: ' + (row.Phone || ''),
      'Employee count on the form: ' + (row['Form employee count'] || ''),
      'Consent: ' + (row.Consent || ''),
      '',
      acaResultsBody_(row),
      '',
      'Page: ' + (row['Page URL'] || ''),
      'Visitor ID: ' + (row['Visitor ID'] || '')
    ].join('\n')
  };
}

function acaResultsBody_(row) {
  var lines = [
    'Year: ' + (row.Year || ''),
    'ALE status: ' + (row['ALE status'] || ''),
    'Prior-year full-time: ' + (row['Prior-year full-time'] || ''),
    'Prior-year full-time equivalents: ' + (row['Prior-year FTE'] || ''),
    'Prior-year average, before rounding: ' + (row['Prior-year average'] || ''),
    'Prior-year average, rounded down: ' + (row['Prior-year rounded'] || ''),
    'Seasonal-worker exception: ' + (row['Seasonal exception'] || ''),
    'Controlled group: ' + (row['Controlled group'] || ''),
    '30-employee reduction: ' + (row.Reduction || ''),
    'Offer test: ' + (row['Offer result'] || ''),
    'Premium tax credit count: ' + (row['PTC count'] || ''),
    'Months affected: ' + (row['Months affected'] || ''),
    'A penalty, monthly: ' + (row['A penalty monthly'] || ''),
    'A penalty, for the selected months: ' + (row['A penalty annual'] || ''),
    'B penalty, monthly: ' + (row['B penalty monthly'] || ''),
    'B penalty, for the selected months: ' + (row['B penalty annual'] || ''),
    'B penalty capped at the A penalty: ' + (row['B capped'] || ''),
    'Scenario, offer nothing: ' + (row['Scenario offer nothing'] || ''),
    'Scenario, offer but unaffordable: ' + (row['Scenario unaffordable'] || ''),
    'Scenario, offer affordable coverage: ' + (row['Scenario affordable'] || ''),
    'Safe harbor: ' + (row['Safe harbor'] || ''),
    'Affordability result: ' + (row['Affordability result'] || ''),
    'Lowest-cost self-only premium: ' + (row.Premium || ''),
    'Result shown: ' + (row['Actual result'] || '') + ' ' + (row['Actual amount'] || ''),
    '',
    'Estimate narrative:',
    row.Report || ''
  ];
  return lines.join('\n');
}

function acaFollowUpMessage(row) {
  var test = String(row.Test || '') === 'yes';
  return {
    to: String(row.Email || '').trim(),
    subject: (test ? '[TEST] ' : '') + 'Your ACA estimate',
    body: acaFollowUpBody_(row)
  };
}

function acaFollowUpBody_(row) {
  return [
    acaGreeting_(row.Name),
    '',
    'Thanks for using the ACA penalty calculator. Here is the estimate from your visit.',
    '',
    row.Report || '',
    '',
    'I am an independent employee benefits broker, and I can shop group health and benefits across the full market. If you want to look at this together, call or text me at 407-476-5076.',
    '',
    'Daniel Kirves',
    'Benefits Broker | 20 Years Exp | DK Benefits',
    '407-476-5076 | www.dkbenefits.net',
    '6000 Metrowest Blvd #200 Orlando, FL 32835',
    '',
    'Agency Lic# L109331'
  ].join('\n');
}

function acaGreeting_(name) {
  var text = acaText_(name, 80);
  if (!text) return 'Hi there,';
  return 'Hi ' + text.split(/\s+/)[0] + ',';
}

function acaSubject_(row, text) {
  return (String(row.Test || '') === 'yes' ? '[TEST] ' : '') + text;
}

function acaFollowUpDecision(contactAtMs, nowMs) {
  var due = contactAtMs + ACA_FOLLOWUP_DELAY_MS;
  if (nowMs < due) return { action: 'wait', reason: 'not due', nextAt: due };
  if (!acaInBusinessHours(nowMs)) return { action: 'wait', reason: 'after hours', nextAt: acaNextOpen(nowMs) };
  return { action: 'send', reason: 'due', nextAt: nowMs };
}

function acaInBusinessHours(utcMs) {
  var parts = acaZonedParts_(utcMs);
  return parts.hour >= 7 && parts.hour <= 18;
}

function acaNextOpen(utcMs) {
  if (acaInBusinessHours(utcMs)) return utcMs;
  var parts = acaZonedParts_(utcMs);
  var when = parts.hour >= 19
    ? acaAddDays_(parts.year, parts.month, parts.day, 1)
    : { year: parts.year, month: parts.month, day: parts.day };
  return acaLocalToUtc_(when.year, when.month, when.day, 7, 0);
}

function acaNoteSet_(value) {
  var notes = { calc: false, lead: false };
  String(value || '').split(',').forEach(function (part) {
    var key = part.trim();
    if (notes.hasOwnProperty(key)) notes[key] = true;
  });
  return notes;
}

function acaNoteJoin_(notes) {
  var parts = [];
  if (notes.calc) parts.push('calc');
  if (notes.lead) parts.push('lead');
  return parts.join(',');
}

function acaRows_(values, header) {
  var rows = [];
  if (!values) return rows;
  for (var i = 1; i < values.length; i++) rows.push(acaRowFromValues_(header, values[i]));
  return rows;
}

function acaCountToday_(rows, column, exceptId) {
  var day = new Date(acaNowMs_()).toISOString().slice(0, 10);
  var count = 0;
  for (var i = 0; i < rows.length; i++) {
    if (String(rows[i]['Visitor ID'] || '') === String(exceptId || '')) continue;
    var stamp = String(rows[i][column] || '');
    if (stamp.slice(0, 10) === day) count += 1;
  }
  return count;
}

function acaAlreadyFollowed_(rows, email, exceptId) {
  var target = String(email || '').trim().toLowerCase();
  if (!target) return false;
  for (var i = 0; i < rows.length; i++) {
    if (String(rows[i]['Visitor ID'] || '') === String(exceptId || '')) continue;
    if (String(rows[i].Email || '').trim().toLowerCase() !== target) continue;
    if (String(rows[i]['Follow-up status'] || '') === 'sent') return true;
  }
  return false;
}

function acaIsSessionId_(value) {
  return typeof value === 'string' && ACA_SESSION_PATTERN.test(value);
}

function acaFilled_(value) {
  return value != null && String(value).trim() !== '';
}

function acaText_(value, max) {
  if (value == null) return '';
  return String(value).replace(/[\r\n\t]/g, ' ').trim().slice(0, max || 300);
}

function acaEnsureSheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(ACA_SHEET_NAME);
  if (!sheet) sheet = ss.insertSheet(ACA_SHEET_NAME);
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(ACA_HEADERS);
    if (typeof sheet.setFrozenRows === 'function') sheet.setFrozenRows(1);
  }
  return sheet;
}

function acaInstallTrigger_() {
  var triggers = ScriptApp.getProjectTriggers();
  for (var i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === ACA_FOLLOWUP_HANDLER) return;
  }
  ScriptApp.newTrigger(ACA_FOLLOWUP_HANDLER).timeBased().everyMinutes(5).create();
}

function acaHeaderIndex_(header) {
  var index = {};
  for (var i = 0; i < header.length; i++) index[String(header[i] || '')] = i;
  return index;
}

function acaFindVisitorRow_(values, index, visitorId) {
  var column = index['Visitor ID'];
  if (column == null) return 0;
  for (var i = 1; i < values.length; i++) {
    if (String(values[i][column] || '') === String(visitorId)) return i + 1;
  }
  return 0;
}

function acaRowFromValues_(header, values) {
  var row = {};
  for (var i = 0; i < header.length; i++) row[String(header[i] || '')] = values[i] == null ? '' : values[i];
  return row;
}

function acaValuesFromRow_(header, row) {
  var values = [];
  for (var i = 0; i < header.length; i++) {
    var value = row[String(header[i] || '')];
    values.push(value == null ? '' : value);
  }
  return values;
}

function acaWriteRow_(sheet, header, rowNumber, row) {
  var values = acaValuesFromRow_(header, row);
  if (!rowNumber) {
    sheet.appendRow(values);
    return sheet.getLastRow();
  }
  sheet.getRange(rowNumber, 1, 1, header.length).setValues([values]);
  return rowNumber;
}

function acaSendDanEmails_(sheet, header, row, emails) {
  var sent = [];
  var notes = acaNoteSet_(row.Notifications);
  var changed = false;
  for (var i = 0; i < emails.length; i++) {
    try {
      MailApp.sendEmail(emails[i].to, emails[i].subject, emails[i].body);
      sent.push(emails[i].kind);
    } catch (err) {
      notes[emails[i].kind] = false;
      if (emails[i].kind === 'calc') row['Calc emailed at'] = '';
      if (emails[i].kind === 'lead') row['Lead emailed at'] = '';
      changed = true;
    }
  }
  if (changed) {
    row.Notifications = acaNoteJoin_(notes);
    var values = sheet.getDataRange().getValues();
    var found = acaFindVisitorRow_(values, acaHeaderIndex_(header), row['Visitor ID']);
    if (found) acaWriteRow_(sheet, header, found, row);
  }
  return sent;
}

function acaSendVisitor_(message) {
  GmailApp.sendEmail(message.to, message.subject, message.body, {
    name: 'Daniel Kirves',
    replyTo: ACA_NOTIFY_EMAIL
  });
}

function acaNowMs_() {
  if (typeof ACA_TEST_NOW === 'number' && isFinite(ACA_TEST_NOW)) return ACA_TEST_NOW;
  return Date.now();
}

function acaCellTime_(value) {
  if (value && typeof value.getTime === 'function') {
    var ms = value.getTime();
    if (typeof ms === 'number' && isFinite(ms)) return ms;
  }
  return Date.parse(String(value || ''));
}

function acaWithLock_(fn) {
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    return fn();
  } finally {
    lock.releaseLock();
  }
}

function acaJson_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function acaNthSunday_(year, monthIndex, n) {
  var first = new Date(Date.UTC(year, monthIndex, 1));
  var day = first.getUTCDay();
  return 1 + ((7 - day) % 7) + (n - 1) * 7;
}

function acaDstStartUtc_(year) {
  return Date.UTC(year, 2, acaNthSunday_(year, 2, 2), 7, 0, 0);
}

function acaDstEndUtc_(year) {
  return Date.UTC(year, 10, acaNthSunday_(year, 10, 1), 6, 0, 0);
}

function acaIsEdt_(utcMs) {
  var year = new Date(utcMs).getUTCFullYear();
  return utcMs >= acaDstStartUtc_(year) && utcMs < acaDstEndUtc_(year);
}

function acaZonedParts_(utcMs) {
  var shifted = new Date(utcMs + (acaIsEdt_(utcMs) ? -4 : -5) * 3600000);
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
    hour: shifted.getUTCHours(),
    minute: shifted.getUTCMinutes()
  };
}

function acaLocalToUtc_(year, month, day, hour, minute) {
  var candidates = [
    Date.UTC(year, month - 1, day, hour + 4, minute),
    Date.UTC(year, month - 1, day, hour + 5, minute)
  ];
  for (var i = 0; i < candidates.length; i++) {
    var parts = acaZonedParts_(candidates[i]);
    if (parts.year === year && parts.month === month && parts.day === day && parts.hour === hour && parts.minute === minute) {
      return candidates[i];
    }
  }
  return candidates[1];
}

function acaAddDays_(year, month, day, days) {
  var shifted = new Date(Date.UTC(year, month - 1, day) + days * 86400000);
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate()
  };
}
