/**
 * DK Benefits quote leads. One row per visitor session.
 *
 * Paste this whole file into a new Apps Script project bound to a spreadsheet
 * owned by dan@dkbenefits.net. Deploy a web app that executes as you and
 * allows anyone to access it. Run setup() once from the editor while logged
 * in as dan@dkbenefits.net so the sheet headers and the 5-minute follow-up
 * trigger belong to that account. GmailApp then sends the prospect note as
 * the script owner.
 *
 * The live pages keep posting to the previous endpoint until
 * QuoteActivity.WEBHOOK_URL in quote-tool-demo/quote-activity.js is changed
 * to this web app's /exec URL.
 *
 * Accepted events match the quote tool: quote_accessed, group_size,
 * contribution_identified, lead_submitted, plus quote_started and
 * rates_displayed. Activity posts use firstName as an event label
 * ("Quote page accessed", "Group size", "Contribution identified"). Those
 * labels are not the visitor's name. The group-size post is already debounced
 * about 20 seconds in the browser, and this script emails that event only once.
 */

var QL_SHEET_NAME = 'Quote Leads';
var QL_NOTIFY_EMAIL = 'dan@dkbenefits.net';
var QL_FOLLOWUP_HANDLER = 'qlSendDueFollowUps';
var QL_FOLLOWUP_DELAY_MS = 10 * 60 * 1000;
var QL_SESSION_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
var QL_HEADERS = [
  'Session ID',
  'First seen',
  'Last updated',
  'Status',
  'Eligible count',
  'Expected enrolling',
  'Pay cycle',
  'Contribution settings',
  'Carriers/plans viewed or saved',
  'Features used',
  'Name',
  'Email',
  'Phone',
  'State',
  'Group size',
  'Message',
  'Page URL',
  'Referrer',
  'Follow-up status',
  'Follow-up sent at',
  'Notifications',
  'Contact submitted at'
];
var QL_STATUS_RANK = {
  '': 0,
  'Page accessed': 1,
  'Engaged': 2,
  'Group size entered': 3,
  'Contact submitted': 4
};
var QL_ACTIVITY_LABELS = {
  'Quote page accessed': true,
  'Group size': true,
  'Contribution identified': true,
  'Quote process started': true,
  'Rates displayed': true
};
var QL_TEST_NOW = null;
var QL_PAY_LABELS = {
  '12': 'Monthly',
  '24': 'Semi-monthly',
  '26': 'Bi-weekly',
  '52': 'Weekly'
};

function doGet() {
  return qlJson_({ ok: true, service: 'quote-leads' });
}

function doPost(e) {
  var payload;
  try {
    payload = JSON.parse((e && e.postData && e.postData.contents) || '{}');
  } catch (err) {
    return qlJson_({ ok: false, error: 'invalid payload' });
  }
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return qlJson_({ ok: false, error: 'invalid payload' });
  }
  if (!payload.event) payload.event = 'lead_submitted';
  if (!qlIsSessionId_(payload.sessionId)) {
    return qlJson_({ ok: false, error: 'invalid session id' });
  }

  try {
    return qlWithLock_(function () {
      var sheet = qlEnsureSheet_();
      var values = sheet.getDataRange().getValues();
      var header = values.length ? values[0] : QL_HEADERS.slice();
      var index = qlHeaderIndex_(header);
      var found = qlFindSessionRow_(values, index, payload.sessionId);
      var current = found ? qlRowFromValues_(header, values[found - 1]) : null;
      var applied = qlApplyEvent(current, payload, new Date(qlNowMs_()).toISOString());
      qlWriteRow_(sheet, header, found, applied.row);
      var emailed = qlSendDanEmails_(sheet, header, applied.row, applied.emails);
      return qlJson_({
        ok: true,
        sessionId: payload.sessionId,
        status: applied.row.Status,
        emailed: emailed
      });
    });
  } catch (err) {
    return qlJson_({ ok: false, error: String(err && err.message ? err.message : err) });
  }
}

function setup() {
  var sheet = qlEnsureSheet_();
  qlInstallTrigger_();
  return 'Quote leads ready on ' + sheet.getName();
}

function qlSendDueFollowUps() {
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    var sheet = qlEnsureSheet_();
    var values = sheet.getDataRange().getValues();
    if (!values.length) return;
    var header = values[0];
    var now = qlNowMs_();
    var rows = [];
    for (var i = 1; i < values.length; i++) rows.push(qlRowFromValues_(header, values[i]));
    for (var r = 0; r < rows.length; r++) {
      var row = rows[r];
      var testRow = qlIsTestLead(row.Name, row.Email);
      var status = String(row['Follow-up status'] || '');
      if (status !== 'pending' && status !== 'failed' && !(testRow && status === 'skipped')) continue;
      var contactAt = qlCellTime_(row['Contact submitted at']);
      if (isNaN(contactAt)) continue;
      var plan = qlFollowUpDecision(contactAt, now);
      if (plan.action !== 'send') continue;
      var email = String(row.Email || '').trim();
      if (!email) {
        row['Follow-up status'] = 'skipped';
        qlWriteRow_(sheet, header, r + 2, row);
        rows[r] = row;
        continue;
      }
      if (!testRow && qlAlreadyFollowed_(rows, email, row['Session ID'])) {
        row['Follow-up status'] = 'skipped';
        qlWriteRow_(sheet, header, r + 2, row);
        rows[r] = row;
        continue;
      }
      try {
        var message = qlFollowUpMessage(row.Name, email);
        qlSendProspect_(message);
        row['Follow-up status'] = 'sent';
        row['Follow-up sent at'] = new Date(now).toISOString();
        qlWriteRow_(sheet, header, r + 2, row);
        rows[r] = row;
      } catch (err) {
        row['Follow-up status'] = 'failed';
        qlWriteRow_(sheet, header, r + 2, row);
        rows[r] = row;
      }
    }
  } finally {
    lock.releaseLock();
  }
}

function qlApplyEvent(previous, payload, nowIso) {
  var row = {};
  var key;
  for (key in (previous || {})) row[key] = previous[key];
  var eventName = payload.event || 'lead_submitted';
  var answers = payload.answers || {};
  var contribution = payload.contribution || {};
  if (!qlFilled_(row['Session ID'])) row['Session ID'] = String(payload.sessionId || '');
  if (!qlFilled_(row['First seen'])) row['First seen'] = nowIso;
  row['Last updated'] = nowIso;
  row.Status = qlForwardStatus_(row.Status, qlTargetStatus_(eventName, payload));

  qlLock_(row, 'Eligible count', answers.employees);
  qlLock_(row, 'Expected enrolling', answers.enrolling);
  qlLock_(row, 'Pay cycle', qlPayLabel_(contribution.payPeriods));
  qlLock_(row, 'Contribution settings', qlContributionText_(contribution));
  qlLockList_(row, 'Carriers/plans viewed or saved', qlPlanLines_(payload));
  qlLockList_(row, 'Features used', qlFeatureLabels_(eventName, payload));
  qlLock_(row, 'Page URL', payload.pageUrl);
  qlLock_(row, 'Referrer', payload.referrer);
  qlLock_(row, 'State', answers.state);
  qlLock_(row, 'Message', payload.helpWith || payload.message);

  if (eventName === 'lead_submitted') {
    var person = qlText_(payload.firstName);
    if (QL_ACTIVITY_LABELS[person]) person = '';
    qlLock_(row, 'Name', person);
    qlLock_(row, 'Email', payload.email);
    qlLock_(row, 'Phone', payload.phone);
    qlLock_(row, 'Group size', payload.groupSize || answers.employees);
    if (!qlFilled_(row['Contact submitted at'])) row['Contact submitted at'] = nowIso;
    if (!qlFilled_(row['Follow-up status'])) {
      row['Follow-up status'] = qlFilled_(row.Email) ? 'pending' : 'skipped';
    }
  }

  var notes = qlNoteSet_(row.Notifications);
  var emails = [];
  if (eventName === 'quote_accessed' && !notes.page && row.Status !== 'Contact submitted') {
    notes.page = true;
    emails.push(qlPageEmail_(row));
  }
  if (eventName === 'group_size' && !notes.group && (qlFilled_(row['Eligible count']) || qlFilled_(row['Expected enrolling']))) {
    notes.group = true;
    emails.push(qlGroupEmail_(row));
  }
  if (eventName === 'lead_submitted' && !notes.contact) {
    notes.contact = true;
    emails.push(qlContactEmail_(row));
  }
  row.Notifications = qlNoteJoin_(notes);
  return { row: row, emails: emails };
}

function qlInBusinessHours(utcMs) {
  var parts = qlZonedParts_(utcMs);
  return parts.hour >= 7 && parts.hour <= 18;
}

function qlNextOpen(utcMs) {
  if (qlInBusinessHours(utcMs)) return utcMs;
  var parts = qlZonedParts_(utcMs);
  var when = parts.hour >= 19
    ? qlAddDays_(parts.year, parts.month, parts.day, 1)
    : { year: parts.year, month: parts.month, day: parts.day };
  return qlLocalToUtc_(when.year, when.month, when.day, 7, 0);
}

function qlFollowUpDecision(contactAtMs, nowMs) {
  var due = contactAtMs + QL_FOLLOWUP_DELAY_MS;
  if (nowMs < due) return { action: 'wait', reason: 'not due', nextAt: due };
  if (!qlInBusinessHours(nowMs)) {
    return { action: 'wait', reason: 'after hours', nextAt: qlNextOpen(nowMs) };
  }
  return { action: 'send', reason: 'due', nextAt: nowMs };
}

function qlIsTestLead(name, email) {
  return String(name || '').indexOf('[TEST]') !== -1 || String(email || '').indexOf('[TEST]') !== -1;
}

function qlFollowUpMessage(name, email) {
  return {
    to: String(email || '').trim(),
    subject: 'Saw you checking out rates',
    body: qlFollowUpBody_(name)
  };
}

function qlFollowUpBody_(name) {
  return [
    qlGreeting_(name),
    '',
    'I saw you were checking out the group rates on my site. Thanks for taking a look!',
    '',
    'Those are live rates on a handful of plans I can quote instantly. If you\'re interested, I can take your group to the full market. With underwriting there are often more options and sometimes better rates, no promises, but it\'s usually worth a look.',
    '',
    'If you want to chat, call or text me anytime, or let me know a good time to connect.',
    '',
    'Daniel Kirves',
    'Benefits Broker | 20 Years Exp | DK Benefits',
    '407-476-5076 | www.dkbenefits.net',
    '6000 Metrowest Blvd #200 Orlando, FL 32835',
    'Agency Lic# L109331'
  ].join('\n');
}

function qlGreeting_(name) {
  var text = qlText_(name);
  if (!text || QL_ACTIVITY_LABELS[text]) return 'Hi there,';
  return 'Hi ' + text.split(/\s+/)[0] + ',';
}

function qlPageEmail_(row) {
  return {
    kind: 'page',
    to: QL_NOTIFY_EMAIL,
    subject: 'Quote tool: page accessed',
    body: [
      'Session ID: ' + (row['Session ID'] || ''),
      'First seen: ' + (row['First seen'] || ''),
      'Page: ' + (row['Page URL'] || ''),
      'Referrer: ' + (row.Referrer || '')
    ].join('\n')
  };
}

function qlGroupEmail_(row) {
  var lines = ['Session ID: ' + (row['Session ID'] || '')];
  if (qlFilled_(row['Eligible count'])) lines.push('Eligible employees: ' + row['Eligible count']);
  if (qlFilled_(row['Expected enrolling'])) lines.push('Expected enrolling: ' + row['Expected enrolling']);
  if (qlFilled_(row['Page URL'])) lines.push('Page: ' + row['Page URL']);
  return {
    kind: 'group',
    to: QL_NOTIFY_EMAIL,
    subject: 'Quote tool: group size entered',
    body: lines.join('\n')
  };
}

function qlContactEmail_(row) {
  return {
    kind: 'contact',
    to: QL_NOTIFY_EMAIL,
    subject: 'Quote tool: contact submitted',
    body: [
      'Name: ' + (row.Name || ''),
      'Email: ' + (row.Email || ''),
      'Phone: ' + (row.Phone || ''),
      'State: ' + (row.State || ''),
      'Group size: ' + (row['Group size'] || ''),
      'Eligible employees: ' + (row['Eligible count'] || ''),
      'Expected enrolling: ' + (row['Expected enrolling'] || ''),
      'Pay cycle: ' + (row['Pay cycle'] || ''),
      'Contribution: ' + (row['Contribution settings'] || ''),
      'Plans: ' + (row['Carriers/plans viewed or saved'] || ''),
      'Features: ' + (row['Features used'] || ''),
      'Message: ' + (row.Message || ''),
      'Page: ' + (row['Page URL'] || ''),
      'Referrer: ' + (row.Referrer || ''),
      'Session ID: ' + (row['Session ID'] || '')
    ].join('\n')
  };
}

function qlTargetStatus_(eventName, payload) {
  if (eventName === 'lead_submitted') return 'Contact submitted';
  if (eventName === 'group_size') return 'Group size entered';
  if (qlLooksEngaged_(eventName, payload)) return 'Engaged';
  return 'Page accessed';
}

function qlLooksEngaged_(eventName, payload) {
  if (eventName === 'contribution_identified' || eventName === 'quote_started') return true;
  if (payload.selectedPlans && payload.selectedPlans.length) return true;
  var contribution = payload.contribution || {};
  if (contribution.model) return true;
  if (contribution.payPeriods) return true;
  if (payload.carrier && payload.carrier !== 'All') return true;
  return false;
}

function qlForwardStatus_(current, target) {
  var nowRank = QL_STATUS_RANK[current] || 0;
  var nextRank = QL_STATUS_RANK[target] || 0;
  if (nextRank > nowRank) return target;
  return current || target || '';
}

function qlPayLabel_(value) {
  var key = qlText_(value);
  if (!key) return '';
  return QL_PAY_LABELS[key] || (key + ' pay periods');
}

function qlContributionText_(contribution) {
  if (!contribution || !contribution.model) return '';
  if (contribution.model === 'percent') {
    var text = 'Percent of premium';
    var employer = contribution.percent != null ? contribution.percent : contribution.employerPercent;
    if (qlFilled_(employer)) text += ', ' + employer + '% of employee-only';
    if (qlFilled_(contribution.dependentPercent)) text += ', ' + contribution.dependentPercent + '% of the dependent portion';
    return text;
  }
  if (contribution.model === 'flat') {
    var dollars = contribution.flatDollar != null ? contribution.flatDollar : contribution.flatAmount;
    return qlFilled_(dollars) ? 'Flat $' + dollars + ' per enrolled employee' : 'Flat dollar';
  }
  return qlText_(contribution.model);
}

function qlPlanLines_(payload) {
  var lines = [];
  var plans = payload.selectedPlans || [];
  for (var i = 0; i < plans.length; i++) {
    var plan = plans[i] || {};
    var name = qlText_(plan.name || plan.id);
    if (!name) continue;
    lines.push(plan.network ? name + ' (' + plan.network + ')' : name);
  }
  if (payload.carrier && payload.carrier !== 'All') lines.push('Viewed carrier: ' + qlText_(payload.carrier));
  return lines;
}

function qlFeatureLabels_(eventName, payload) {
  var labels = [];
  if (eventName === 'quote_accessed') labels.push('Opened the quote tool');
  if (eventName === 'quote_started') labels.push('Started a quote');
  if (eventName === 'rates_displayed') labels.push('Viewed rates');
  if (eventName === 'group_size') labels.push('Entered group size');
  if (eventName === 'contribution_identified') labels.push('Set a contribution');
  if (eventName === 'lead_submitted') labels.push('Submitted contact');
  if (payload.selectedPlans && payload.selectedPlans.length) labels.push('Saved plans');
  if (payload.contribution && payload.contribution.payPeriods) labels.push('Set pay cycle');
  if (payload.carrier && payload.carrier !== 'All') labels.push('Filtered by carrier');
  return labels;
}

function qlLock_(row, key, value) {
  if (!qlFilled_(value)) return;
  row[key] = qlText_(value);
}

function qlLockList_(row, key, incoming) {
  if (!incoming || !incoming.length) return;
  var seen = {};
  var merged = [];
  var existing = qlFilled_(row[key]) ? String(row[key]).split('\n') : [];
  var all = existing.concat(incoming);
  for (var i = 0; i < all.length; i++) {
    var item = qlText_(all[i]);
    if (!item || seen[item]) continue;
    seen[item] = true;
    merged.push(item);
  }
  if (merged.length) row[key] = merged.join('\n');
}

function qlFilled_(value) {
  if (value == null) return false;
  return String(value).trim() !== '';
}

function qlText_(value) {
  if (value == null) return '';
  return String(value).replace(/[\r\n\t]/g, ' ').trim();
}

function qlNoteSet_(value) {
  var notes = { page: false, group: false, contact: false };
  String(value || '').split(',').forEach(function (part) {
    var key = part.trim();
    if (notes.hasOwnProperty(key)) notes[key] = true;
  });
  return notes;
}

function qlNoteJoin_(notes) {
  var parts = [];
  if (notes.page) parts.push('page');
  if (notes.group) parts.push('group');
  if (notes.contact) parts.push('contact');
  return parts.join(',');
}

function qlIsSessionId_(value) {
  return typeof value === 'string' && QL_SESSION_PATTERN.test(value);
}

function qlEnsureSheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(QL_SHEET_NAME);
  if (!sheet) sheet = ss.insertSheet(QL_SHEET_NAME);
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(QL_HEADERS);
    if (typeof sheet.setFrozenRows === 'function') sheet.setFrozenRows(1);
  }
  return sheet;
}

function qlInstallTrigger_() {
  var triggers = ScriptApp.getProjectTriggers();
  for (var i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === QL_FOLLOWUP_HANDLER) return;
  }
  ScriptApp.newTrigger(QL_FOLLOWUP_HANDLER).timeBased().everyMinutes(5).create();
}

function qlHeaderIndex_(header) {
  var index = {};
  for (var i = 0; i < header.length; i++) index[String(header[i] || '')] = i;
  return index;
}

function qlFindSessionRow_(values, index, sessionId) {
  var column = index['Session ID'];
  if (column == null) return 0;
  for (var i = 1; i < values.length; i++) {
    if (String(values[i][column] || '') === String(sessionId)) return i + 1;
  }
  return 0;
}

function qlRowFromValues_(header, values) {
  var row = {};
  for (var i = 0; i < header.length; i++) row[String(header[i] || '')] = values[i] == null ? '' : values[i];
  return row;
}

function qlValuesFromRow_(header, row) {
  var values = [];
  for (var i = 0; i < header.length; i++) {
    var value = row[String(header[i] || '')];
    values.push(value == null ? '' : value);
  }
  return values;
}

function qlWriteRow_(sheet, header, rowNumber, row) {
  var values = qlValuesFromRow_(header, row);
  if (!rowNumber) {
    sheet.appendRow(values);
    return sheet.getLastRow();
  }
  sheet.getRange(rowNumber, 1, 1, header.length).setValues([values]);
  return rowNumber;
}

function qlSendDanEmails_(sheet, header, row, emails) {
  var sent = [];
  var notes = qlNoteSet_(row.Notifications);
  for (var i = 0; i < emails.length; i++) {
    try {
      MailApp.sendEmail(emails[i].to, emails[i].subject, emails[i].body);
      sent.push(emails[i].kind);
    } catch (err) {
      notes[emails[i].kind] = false;
    }
  }
  var joined = qlNoteJoin_(notes);
  if (joined !== String(row.Notifications || '')) {
    row.Notifications = joined;
    var values = sheet.getDataRange().getValues();
    var found = qlFindSessionRow_(values, qlHeaderIndex_(header), row['Session ID']);
    if (found) qlWriteRow_(sheet, header, found, row);
  }
  return sent;
}

function qlAlreadyFollowed_(rows, email, exceptSession) {
  var target = String(email || '').trim().toLowerCase();
  if (!target) return false;
  for (var i = 0; i < rows.length; i++) {
    if (String(rows[i]['Session ID'] || '') === String(exceptSession || '')) continue;
    if (String(rows[i].Email || '').trim().toLowerCase() !== target) continue;
    if (String(rows[i]['Follow-up status'] || '') === 'sent') return true;
  }
  return false;
}

function qlSendProspect_(message) {
  var owner = '';
  try {
    if (typeof Session !== 'undefined' && Session.getActiveUser) owner = String(Session.getActiveUser().getEmail() || '');
  } catch (err) {
    owner = '';
  }
  var options = { name: 'Daniel Kirves' };
  if (owner) options.replyTo = owner;
  GmailApp.sendEmail(message.to, message.subject, message.body, options);
}

function qlNowMs_() {
  if (typeof QL_TEST_NOW === 'number' && isFinite(QL_TEST_NOW)) return QL_TEST_NOW;
  return Date.now();
}

function qlCellTime_(value) {
  if (value && typeof value.getTime === 'function') {
    var ms = value.getTime();
    if (typeof ms === 'number' && isFinite(ms)) return ms;
  }
  if (typeof value === 'number' && isFinite(value) && value > 20000 && value < 100000) {
    return Math.round((value - 25569) * 86400 * 1000);
  }
  var parsed = Date.parse(String(value || ''));
  return parsed;
}

function qlWithLock_(fn) {
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    return fn();
  } finally {
    lock.releaseLock();
  }
}

function qlJson_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function qlNthSunday_(year, monthIndex, n) {
  var first = new Date(Date.UTC(year, monthIndex, 1));
  var day = first.getUTCDay();
  return 1 + ((7 - day) % 7) + (n - 1) * 7;
}

function qlDstStartUtc_(year) {
  return Date.UTC(year, 2, qlNthSunday_(year, 2, 2), 7, 0, 0);
}

function qlDstEndUtc_(year) {
  return Date.UTC(year, 10, qlNthSunday_(year, 10, 1), 6, 0, 0);
}

function qlIsEdt_(utcMs) {
  var year = new Date(utcMs).getUTCFullYear();
  return utcMs >= qlDstStartUtc_(year) && utcMs < qlDstEndUtc_(year);
}

function qlZonedParts_(utcMs) {
  var shifted = new Date(utcMs + (qlIsEdt_(utcMs) ? -4 : -5) * 3600000);
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
    hour: shifted.getUTCHours(),
    minute: shifted.getUTCMinutes(),
    weekday: shifted.getUTCDay()
  };
}

function qlLocalToUtc_(year, month, day, hour, minute) {
  var candidates = [
    Date.UTC(year, month - 1, day, hour + 4, minute),
    Date.UTC(year, month - 1, day, hour + 5, minute)
  ];
  for (var i = 0; i < candidates.length; i++) {
    var parts = qlZonedParts_(candidates[i]);
    if (parts.year === year && parts.month === month && parts.day === day && parts.hour === hour && parts.minute === minute) {
      return candidates[i];
    }
  }
  return candidates[1];
}

function qlAddDays_(year, month, day, days) {
  var shifted = new Date(Date.UTC(year, month - 1, day) + days * 86400000);
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate()
  };
}
