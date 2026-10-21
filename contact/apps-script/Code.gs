/**
 * DK Benefits contact form lead service.
 * Container-bound to the spreadsheet "DK Benefits Contact Leads".
 * Do not paste this into the quote tool or the Section 128 script.
 *
 * Deploy the single file contact/apps-script/ContactCombined.gs
 * (this file plus contact-validate.js). See README.md.
 *
 * Web app: Execute as Me, Who has access: Anyone.
 * The lead alert goes to dan@dkbenefits.net and nowhere else.
 */
var CONTACT_NOTIFY_EMAIL = 'dan@dkbenefits.net';
var CONTACT_SUBMISSIONS_SHEET = 'Submissions';
var CONTACT_EVENTS_SHEET = 'Events';
var CONTACT_FOLLOWUPS_SHEET = 'FollowUps';
var CONTACT_VISITOR_HOURLY_LIMIT = 3;
var CONTACT_FOLLOWUP_HOURLY_LIMIT = 3;
var CONTACT_DAILY_LEAD_CAP = 50;
var CONTACT_MIN_ELAPSED_MS = 3000;
var CONTACT_PENDING_STALE_MS = 45000;
var CONTACT_FOLLOWUP_DELAY_MS = 10 * 60 * 1000;
var CONTACT_FOLLOWUP_HANDLER = 'contactSendDueFollowUps';

var CONTACT_FOLLOWUP_HEADERS = [
  'timestamp', 'email', 'first_name', 'last_name', 'company', 'status', 'test', 'submission_id', 'error', 'sent_at'
];

var CONTACT_SUBMISSION_HEADERS = [
  'timestamp', 'submission_id', 'status', 'test', 'first_name', 'last_name', 'company',
  'email', 'phone', 'message', 'page_url', 'lead_emailed', 'reply_queued', 'error'
];

function doGet() {
  return ContentService
    .createTextOutput('DK Benefits contact form is deployed. Submit the form to send a message.')
    .setMimeType(ContentService.MimeType.TEXT);
}

function doPost(e) {
  var payload;
  try {
    payload = JSON.parse((e && e.postData && e.postData.contents) || '{}');
  } catch (err) {
    return contactJson_({ ok: false, error: 'The message could not be read.' });
  }
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return contactJson_({ ok: false, error: 'The message could not be read.' });
  }
  if (payload.event !== 'contact_submission') {
    return contactJson_({ ok: false, error: 'Unrecognized submission.' });
  }
  try {
    return contactJson_(contactHandle_(payload));
  } catch (err) {
    try { contactLogEvent_('failed', payload.submissionId || '', err && err.message ? err.message : 'failed'); } catch (ignore) {}
    return contactJson_({ ok: false, error: 'Your message could not be sent. Call or text 407-476-5076 or email dan@dkbenefits.net.' });
  }
}

function contactHandle_(payload) {
  if (contactFilled_(payload.hp) || contactFilled_(payload.company_website) || contactFilled_(payload.website)) {
    contactLogEvent_('rejected_honeypot', payload.submissionId || '', 'honeypot');
    return { ok: false, error: 'Your message could not be sent.' };
  }
  var started = Date.parse(payload.startedAt || '');
  var submitted = Date.parse(payload.submittedAt || '');
  if (!submitted) submitted = contactNow_();
  if (!started || submitted - started < CONTACT_MIN_ELAPSED_MS) {
    contactLogEvent_('rejected_fast', payload.submissionId || '', 'too fast');
    return { ok: false, error: 'Your message could not be sent.' };
  }
  var submissionId = String(payload.submissionId || '');
  if (submissionId.length < 8 || submissionId.length > 80) {
    return { ok: false, error: 'The message could not be sent. Refresh the page and try again.' };
  }

  var checked = ContactModel.validate(payload.lead || {});
  if (!checked.ok) {
    contactLogEvent_('rejected_validation', submissionId, checked.errors.map(function (item) { return item.field; }).join(','));
    return { ok: false, error: checked.errors[0].message, fields: checked.errors };
  }

  contactEnsureFollowUpTrigger_();

  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  var existing;
  try {
    existing = contactFindSubmission_(submissionId);
    if (existing && existing.leadEmailed) {
      return {
        ok: true,
        duplicate: true,
        leadEmailed: true,
        followUpQueued: contactAppendFollowUp_(payload, checked)
      };
    }
    if (existing && existing.status === 'pending' && !existing.leadEmailed) {
      var age = contactNow_() - contactCellTime_(existing.timestamp);
      if (!isNaN(age) && age >= 0 && age < CONTACT_PENDING_STALE_MS) {
        return { ok: false, error: 'This message is already being sent. Wait a moment and try again.' };
      }
    }
    if (contactCountLeadsToday_(submissionId) >= CONTACT_DAILY_LEAD_CAP) {
      contactLogEvent_('rejected_daily_cap', submissionId, 'cap');
      return { ok: false, error: 'The form has reached its daily limit. Please call or text 407-476-5076 or email dan@dkbenefits.net.' };
    }
    if (!existing && !contactVisitorAllowed_(checked.lead.email, payload.visitorId)) {
      contactLogEvent_('rejected_rate', submissionId, 'hourly');
      return { ok: false, error: 'You have sent a few messages already. Please wait about an hour, or call or text 407-476-5076.' };
    }
    contactUpsertSubmission_(existing, payload, checked, 'pending', '', !!(existing && existing.leadEmailed), false);
  } finally {
    lock.releaseLock();
  }

  var quota = 0;
  try { quota = MailApp.getRemainingDailyQuota(); } catch (ignoreQuota) { quota = 0; }
  if (quota < 1) {
    contactMark_(submissionId, 'failed', 'mail quota', false, false);
    contactLogEvent_('failed', submissionId, 'mail quota');
    return { ok: false, error: 'Email delivery is temporarily unavailable. Call or text 407-476-5076.' };
  }

  var leadSent = false;
  try {
    MailApp.sendEmail(contactLeadMessage_(checked.lead, payload));
    leadSent = true;
    contactMark_(submissionId, 'partial', '', true, false);
  } catch (mailErr) {
    contactMark_(submissionId, 'failed', mailErr && mailErr.message ? mailErr.message : 'mail failed', false, false);
    contactLogEvent_('failed', submissionId, 'mail');
    return { ok: false, error: 'Your message could not be sent. Call or text 407-476-5076 or email dan@dkbenefits.net.' };
  }

  var followQueued = false;
  var queueLock = LockService.getScriptLock();
  queueLock.waitLock(20000);
  try {
    followQueued = contactAppendFollowUp_(payload, checked);
  } catch (queueErr) {
    followQueued = false;
  } finally {
    queueLock.releaseLock();
  }

  contactMark_(submissionId, 'sent', '', leadSent, followQueued);
  contactLogEvent_('sent', submissionId, followQueued ? 'dan+queued' : 'dan');
  return {
    ok: true,
    leadEmailed: leadSent,
    followUpQueued: followQueued,
    duplicate: false
  };
}

function contactLeadMessage_(lead, payload) {
  var name = lead.firstName || '';
  if (lead.lastName) name += ' ' + lead.lastName;
  var subject = 'New contact form message: ' + name;
  if (lead.company) subject += ' (' + lead.company + ')';
  if (payload.test) subject = '[TEST] ' + subject;
  var lines = [
    'New message from the DK Benefits contact form',
    'Submitted: ' + contactStamp_(),
    'Page: ' + contactPage_(payload.pageUrl),
    'Submission id: ' + payload.submissionId,
    '',
    'Name: ' + name,
    'Company: ' + (lead.company || ''),
    'Email: ' + lead.email,
    'Phone: ' + (lead.phone || ''),
    '',
    'Message:',
    lead.message
  ];
  var message = {
    to: CONTACT_NOTIFY_EMAIL,
    subject: subject.slice(0, 180),
    body: lines.join('\n'),
    name: 'DK Benefits website',
    replyTo: lead.email
  };
  contactAssertLeadRecipient_(message);
  return message;
}

function contactAssertLeadRecipient_(message) {
  if (CONTACT_NOTIFY_EMAIL !== 'dan@dkbenefits.net') throw new Error('lead recipient');
  if (!message || message.to !== 'dan@dkbenefits.net') throw new Error('lead recipient');
  if (message.cc || message.bcc || message.htmlBody || message.attachments) throw new Error('lead recipient');
}

function contactAppendFollowUp_(payload, checked) {
  var email = checked.lead && checked.lead.email;
  if (!email) return false;
  var sheet = contactSheet_(CONTACT_FOLLOWUPS_SHEET, CONTACT_FOLLOWUP_HEADERS);
  var values = sheet.getDataRange().getValues();
  var id = String(payload.submissionId);
  for (var i = 1; i < values.length; i++) {
    if (String(values[i][7]) === id) return true;
  }
  var lead = checked.lead;
  sheet.appendRow([
    new Date(contactNow_()).toISOString(),
    email,
    lead.firstName || '',
    lead.lastName || '',
    lead.company || '',
    'pending',
    payload.test ? 'yes' : 'no',
    id,
    '',
    ''
  ]);
  return true;
}

function contactFollowUpMessage_(row) {
  var subject = ContactModel.REPLY_SUBJECT;
  if (String(row[6]) === 'yes') subject = '[TEST] ' + subject;
  var message = {
    to: String(row[1] || ''),
    subject: subject,
    body: ContactModel.replyBody(String(row[2] || '')),
    name: 'Daniel Kirves',
    replyTo: CONTACT_NOTIFY_EMAIL
  };
  if (message.attachments) delete message.attachments;
  if (message.htmlBody) delete message.htmlBody;
  return message;
}

function contactCellTime_(value) {
  if (value && typeof value.getTime === 'function') {
    var ms = value.getTime();
    if (typeof ms === 'number' && isFinite(ms)) return ms;
  }
  if (typeof value === 'number' && isFinite(value) && value > 20000 && value < 100000) {
    return Math.round((value - 25569) * 86400 * 1000);
  }
  return Date.parse(String(value || ''));
}

function contactCellDay_(value) {
  var ms = contactCellTime_(value);
  if (!isNaN(ms)) return new Date(ms).toISOString().slice(0, 10);
  return String(value || '').slice(0, 10);
}

function contactLog_(message) {
  var line = String(message);
  try {
    if (typeof Logger !== 'undefined' && Logger && Logger.log) Logger.log(line);
  } catch (err) {}
  try {
    if (typeof console !== 'undefined' && console && console.log) console.log(line);
  } catch (err) {}
}

function contactTsPreview_(value) {
  var kind = 'empty';
  if (value && typeof value.getTime === 'function') kind = 'Date';
  else if (value != null && value !== '') kind = typeof value;
  var text = '';
  try { text = String(value == null ? '' : value); } catch (err) { text = ''; }
  if (text.length > 80) text = text.slice(0, 80);
  return kind + ':' + text;
}

function contactFollowUpSentToday_(values, email) {
  var day = contactToday_();
  var target = String(email || '').toLowerCase();
  for (var i = 1; i < values.length; i++) {
    if (String(values[i][1] || '').toLowerCase() !== target) continue;
    if (String(values[i][6] || '') === 'yes') continue;
    if (String(values[i][5]) !== 'sent') continue;
    if (contactTodayOf_(values[i][9]) === day) return true;
  }
  return false;
}

function contactTodayOf_(value) {
  var ms = contactCellTime_(value);
  if (isNaN(ms)) return String(value || '').slice(0, 10);
  return contactZonedDay_(ms);
}

function contactSendDueFollowUps() {
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    var sheet = contactSheet_(CONTACT_FOLLOWUPS_SHEET, CONTACT_FOLLOWUP_HEADERS);
    var values = sheet.getDataRange().getValues();
    var now = contactNow_();
    var found = Math.max(0, values.length - 1);
    var sent = 0;
    var skipped = 0;
    var waiting = 0;
    var ignored = 0;
    var header = values.length ? values[0] : [];
    var headerText = [];
    var headerOk = true;
    for (var h = 0; h < CONTACT_FOLLOWUP_HEADERS.length; h++) {
      headerText.push(String(header[h] || ''));
      if (headerText[h] !== CONTACT_FOLLOWUP_HEADERS[h]) headerOk = false;
    }
    contactLog_('contactSendDueFollowUps: found ' + found + ' follow-up row(s)');
    if (!headerOk) {
      contactLog_('contactSendDueFollowUps: header is [' + headerText.join(', ') + '] expected [' + CONTACT_FOLLOWUP_HEADERS.join(', ') + ']');
    }
    for (var i = 1; i < values.length; i++) {
      var status = String(values[i][5] || '');
      var testRow = String(values[i][6] || '') === 'yes';
      var retryTest = testRow && status === 'skipped' && String(values[i][8] || '') === 'already sent today';
      var rowNumber = i + 1;
      var label = 'row ' + rowNumber + ' ' + String(values[i][1] || '(no email)') + ' id=' + String(values[i][7] || '') + ' status=' + (status || '(blank)') + ' test=' + (testRow ? 'yes' : 'no');
      if (status !== 'pending' && !retryTest) {
        ignored++;
        contactLog_(label + ' reason=not pending');
        continue;
      }
      var ts = contactCellTime_(values[i][0]);
      if (isNaN(ts)) {
        waiting++;
        contactLog_(label + ' reason=timestamp not readable value=' + contactTsPreview_(values[i][0]));
        continue;
      }
      var ageMs = now - ts;
      if (ageMs < CONTACT_FOLLOWUP_DELAY_MS) {
        waiting++;
        contactLog_(label + ' reason=not due for ' + Math.ceil((CONTACT_FOLLOWUP_DELAY_MS - ageMs) / 60000) + ' more minute(s)');
        continue;
      }
      var email = String(values[i][1] || '');
      if (!testRow && contactFollowUpSentToday_(values, email)) {
        sheet.getRange(rowNumber, 6).setValue('skipped');
        sheet.getRange(rowNumber, 9).setValue('already sent today');
        values[i][5] = 'skipped';
        values[i][8] = 'already sent today';
        skipped++;
        contactLog_(label + ' reason=already sent today');
        continue;
      }
      if (!contactFollowUpAllowed_(email)) {
        sheet.getRange(rowNumber, 6).setValue('skipped');
        sheet.getRange(rowNumber, 9).setValue('hourly limit');
        values[i][5] = 'skipped';
        values[i][8] = 'hourly limit';
        skipped++;
        contactLog_(label + ' reason=hourly limit');
        continue;
      }
      try {
        var message = contactFollowUpMessage_(values[i]);
        if (message.to !== email || message.replyTo !== CONTACT_NOTIFY_EMAIL || message.name !== 'Daniel Kirves') {
          throw new Error('reply recipient');
        }
        if (message.attachments) delete message.attachments;
        if (message.htmlBody) delete message.htmlBody;
        MailApp.sendEmail(message);
        var sentAt = new Date(contactNow_()).toISOString();
        sheet.getRange(rowNumber, 6).setValue('sent');
        sheet.getRange(rowNumber, 9).setValue('');
        sheet.getRange(rowNumber, 10).setValue(sentAt);
        values[i][5] = 'sent';
        values[i][8] = '';
        values[i][9] = sentAt;
        sent++;
        contactLog_(label + ' reason=sent');
      } catch (err) {
        var mailError = err && err.message ? String(err.message).slice(0, 300) : 'mail failed';
        sheet.getRange(rowNumber, 6).setValue('failed');
        sheet.getRange(rowNumber, 9).setValue(mailError);
        values[i][5] = 'failed';
        skipped++;
        contactLog_(label + ' reason=mail failed ' + mailError);
      }
    }
    contactLog_('contactSendDueFollowUps: sent=' + sent + ' skipped=' + skipped + ' waiting=' + waiting + ' ignored=' + ignored);
  } catch (err) {
    contactLog_('contactSendDueFollowUps: failed ' + (err && err.message ? String(err.message) : err));
    throw err;
  } finally {
    lock.releaseLock();
  }
}

function setup() {
  contactSheet_(CONTACT_SUBMISSIONS_SHEET, CONTACT_SUBMISSION_HEADERS);
  contactSheet_(CONTACT_FOLLOWUPS_SHEET, CONTACT_FOLLOWUP_HEADERS);
  contactSheet_(CONTACT_EVENTS_SHEET, ['timestamp', 'kind', 'submission_id', 'detail']);
  setupFollowUpTrigger();
}

function setupFollowUpTrigger() {
  var triggers = ScriptApp.getProjectTriggers();
  for (var i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === CONTACT_FOLLOWUP_HANDLER) return;
  }
  ScriptApp.newTrigger(CONTACT_FOLLOWUP_HANDLER).timeBased().everyMinutes(5).create();
}

function contactEnsureFollowUpTrigger_() {
  try { setupFollowUpTrigger(); } catch (err) {}
}

function contactNow_() {
  if (typeof CONTACT_TEST_NOW === 'number' && isFinite(CONTACT_TEST_NOW)) return CONTACT_TEST_NOW;
  return Date.now();
}

function contactVisitorAllowed_(email, visitorId) {
  return contactRateAllow_('ctc:', [String(email || '').toLowerCase(), contactVisitorKey_(visitorId)], CONTACT_VISITOR_HOURLY_LIMIT);
}

function contactFollowUpAllowed_(email) {
  return contactRateAllow_('ctf:', [String(email || '').toLowerCase()], CONTACT_FOLLOWUP_HOURLY_LIMIT);
}

function contactVisitorKey_(visitorId) {
  var id = String(visitorId || '');
  if (!/^[A-Za-z0-9-]{8,80}$/.test(id)) return '';
  return id.toLowerCase();
}

function contactRateAllow_(prefix, parts, limit) {
  var cache = CacheService.getScriptCache();
  var keys = [];
  var i;
  for (i = 0; i < parts.length; i++) {
    if (!parts[i]) continue;
    keys.push(prefix + parts[i]);
  }
  if (!keys.length) return false;
  for (i = 0; i < keys.length; i++) {
    if (Number(cache.get(keys[i]) || '0') >= limit) return false;
  }
  for (i = 0; i < keys.length; i++) {
    cache.put(keys[i], String(Number(cache.get(keys[i]) || '0') + 1), 3600);
  }
  return true;
}

function contactSheet_(name, headers) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
    sheet.appendRow(headers);
    return sheet;
  }
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(headers);
    return sheet;
  }
  var width = headers.length;
  if (sheet.getLastColumn) width = Math.max(sheet.getLastColumn(), headers.length);
  var current = sheet.getRange(1, 1, 1, width).getValues()[0];
  var changed = false;
  for (var i = 0; i < headers.length; i++) {
    if (current[i] === '' || current[i] == null) {
      current[i] = headers[i];
      changed = true;
    }
  }
  if (changed) sheet.getRange(1, 1, 1, headers.length).setValues([current.slice(0, headers.length)]);
  return sheet;
}

function contactFindSubmission_(id) {
  var sheet = contactSheet_(CONTACT_SUBMISSIONS_SHEET, CONTACT_SUBMISSION_HEADERS);
  var values = sheet.getDataRange().getValues();
  for (var i = 1; i < values.length; i++) {
    if (String(values[i][1]) === id) {
      return {
        rowNumber: i + 1,
        status: String(values[i][2] || ''),
        timestamp: values[i][0],
        leadEmailed: String(values[i][11] || '') === 'yes',
        replyQueued: String(values[i][12] || '') === 'yes'
      };
    }
  }
  return null;
}

function contactCountLeadsToday_(exceptId) {
  var sheet = contactSheet_(CONTACT_SUBMISSIONS_SHEET, CONTACT_SUBMISSION_HEADERS);
  var values = sheet.getDataRange().getValues();
  var day = new Date(contactNow_()).toISOString().slice(0, 10);
  var count = 0;
  for (var i = 1; i < values.length; i++) {
    if (String(values[i][1]) === exceptId) continue;
    if (String(values[i][11] || '') !== 'yes') continue;
    if (contactCellDay_(values[i][0]) === day) count++;
  }
  return count;
}

function contactRow_(payload, checked, status, error, leadEmailed, replyQueued) {
  var lead = checked.lead;
  return [
    new Date(contactNow_()).toISOString(),
    String(payload.submissionId),
    status,
    payload.test ? 'yes' : 'no',
    lead.firstName,
    lead.lastName,
    lead.company,
    lead.email,
    lead.phone,
    lead.message,
    contactPage_(payload.pageUrl),
    leadEmailed ? 'yes' : 'no',
    replyQueued ? 'yes' : 'no',
    String(error || '').slice(0, 300)
  ];
}

function contactUpsertSubmission_(existing, payload, checked, status, error, leadEmailed, replyQueued) {
  var sheet = contactSheet_(CONTACT_SUBMISSIONS_SHEET, CONTACT_SUBMISSION_HEADERS);
  var row = contactRow_(payload, checked, status, error, leadEmailed, replyQueued);
  if (!existing) {
    sheet.appendRow(row);
    return;
  }
  sheet.getRange(existing.rowNumber, 1, 1, row.length).setValues([row]);
}

function contactMark_(id, status, error, leadEmailed, replyQueued) {
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var found = contactFindSubmission_(id);
    if (!found) return;
    var sheet = contactSheet_(CONTACT_SUBMISSIONS_SHEET, CONTACT_SUBMISSION_HEADERS);
    sheet.getRange(found.rowNumber, 3).setValue(status);
    sheet.getRange(found.rowNumber, 12).setValue(leadEmailed ? 'yes' : 'no');
    sheet.getRange(found.rowNumber, 13).setValue(replyQueued ? 'yes' : 'no');
    sheet.getRange(found.rowNumber, 14).setValue(String(error || '').slice(0, 300));
  } finally {
    lock.releaseLock();
  }
}

function contactLogEvent_(kind, submissionId, detail) {
  var sheet = contactSheet_(CONTACT_EVENTS_SHEET, ['timestamp', 'kind', 'submission_id', 'detail']);
  sheet.appendRow([new Date(contactNow_()).toISOString(), kind, submissionId || '', String(detail || '').slice(0, 500)]);
}

function contactZonedDay_(ms) {
  var instant = new Date(ms);
  try {
    if (typeof Utilities !== 'undefined' && Utilities.formatDate) {
      return Utilities.formatDate(instant, 'America/New_York', 'yyyy-MM-dd');
    }
  } catch (err) {}
  var shifted = new Date(instant.getTime() - 4 * 60 * 60 * 1000);
  return shifted.toISOString().slice(0, 10);
}

function contactToday_() {
  return contactZonedDay_(contactNow_());
}

function contactStamp_() {
  var instant = new Date(contactNow_());
  try {
    if (typeof Utilities !== 'undefined' && Utilities.formatDate) {
      return Utilities.formatDate(instant, 'America/New_York', 'yyyy-MM-dd HH:mm') + ' ET';
    }
  } catch (err) {}
  return instant.toISOString();
}

function contactPage_(value) {
  var text = ContactModel.cleanLine(value, 500);
  if (!/^https:\/\/[^\s]+$/.test(text)) return '';
  return text;
}

function contactFilled_(value) {
  return String(value == null ? '' : value).trim() !== '';
}

function contactJson_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
