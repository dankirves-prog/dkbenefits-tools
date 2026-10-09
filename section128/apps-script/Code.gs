/**
 * DK Benefits Section 128 lead service.
 * Container-bound to a new spreadsheet. Do not paste this into the quote-tool script.
 *
 * Also add these script files, pasted from the repo with no edits:
 *   S128Model.gs  = section128/s128-model.js
 *   S128Terms.gs  = section128/s128-terms.js
 *   S128Docgen.gs = section128/s128-docgen.js
 * Or paste section128/apps-script/S128Combined.gs as the only script file.
 *
 * Deploy as a web app: Execute as Me, Who has access: Anyone.
 * See README.md in this folder.
 */
var S128_NOTIFY_EMAIL = 'dan@dkbenefits.net';
var S128_SUBMISSIONS_SHEET = 'Submissions';
var S128_EVENTS_SHEET = 'Events';
var S128_VISITOR_HOURLY_LIMIT = 3;
var S128_DAILY_LEAD_CAP = 50;
var S128_MIN_ELAPSED_MS = 3000;
var S128_PENDING_STALE_MS = 45000;
var S128_MAX_FILE_BYTES = 1500000;
var S128_MAX_FILES = 8;
var S128_DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
var S128_PDF_MIME = 'application/pdf';
var S128_FOLLOWUPS_SHEET = 'FollowUps';
var S128_FOLLOWUP_DELAY_MS = 10 * 60 * 1000;
var S128_FOLLOWUP_HANDLER = 's128SendDueFollowUps';
var SECTION125_URL = 'https://www.dkbenefits.net/section125plantool';
var RATES_URL = 'https://dankirves-prog.github.io/dkbenefits-tools/quote-tool-demo/';

var S128_FOLLOWUP_HEADERS = [
  'timestamp', 'email', 'name', 'company', 'plan_json', 'status', 'test', 'submission_id', 'error', 'sent_at'
];

var S128_SUBMISSION_HEADERS = [
  'timestamp', 'submission_id', 'status', 'test', 'company', 'state', 'contact_name',
  'contact_email', 'contact_phone', 'employees', 'funding_mode', 'effective_date',
  'review_required', 'review_reasons', 'page_url', 'template_version',
  'lead_emailed', 'visitor_emailed', 'error', 'payload_json',
  'terms_version', 'terms_accepted_at'
];

function doGet() {
  return ContentService
    .createTextOutput('DK Benefits Section 128 lead service is deployed. Submit the form to deliver a lead.')
    .setMimeType(ContentService.MimeType.TEXT);
}

function doPost(e) {
  var payload;
  try {
    payload = JSON.parse((e && e.postData && e.postData.contents) || '{}');
  } catch (err) {
    return s128Json_({ ok: false, error: 'The submission could not be read.' });
  }
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return s128Json_({ ok: false, error: 'The submission could not be read.' });
  }
  if (payload.event !== 's128_submission') {
    return s128Json_({ ok: false, error: 'Unrecognized submission.' });
  }
  try {
    return s128Json_(s128Handle_(payload));
  } catch (err) {
    try { s128LogEvent_('failed', payload.submissionId || '', err && err.message ? err.message : 'failed'); } catch (ignore) {}
    return s128Json_({ ok: false, error: 'The sample could not be sent.' });
  }
}

function s128Handle_(payload) {
  if (payload.hp) {
    s128LogEvent_('rejected_honeypot', payload.submissionId || '', 'honeypot');
    return { ok: false, error: 'The sample could not be sent.' };
  }
  var started = Date.parse(payload.startedAt || '');
  var submitted = Date.parse(payload.submittedAt || '') || Date.now();
  if (!started || submitted - started < S128_MIN_ELAPSED_MS) {
    s128LogEvent_('rejected_fast', payload.submissionId || '', 'too fast');
    return { ok: false, error: 'The sample could not be sent.' };
  }
  if (!payload.submissionId || String(payload.submissionId).length < 8 || String(payload.submissionId).length > 80) {
    return { ok: false, error: 'The submission id is missing.' };
  }

  var ack = payload.acknowledgement || {};
  if (ack.accepted !== true || !ack.acceptedAt || !Date.parse(ack.acceptedAt) || ack.termsVersion !== S128Terms.VERSION) {
    s128LogEvent_('rejected_terms', payload.submissionId, 'terms');
    return { ok: false, error: 'The terms acknowledgement is missing.' };
  }

  var checked = S128Model.validateSubmission(payload, { asOf: s128Today_() });
  if (!checked.ok) {
    s128LogEvent_('rejected_validation', payload.submissionId, checked.errors.map(function (item) { return item.field; }).join(','));
    return { ok: false, error: checked.errors[0] ? checked.errors[0].message : 'Check the form and try again.', fields: checked.errors };
  }

  s128EnsureFollowUpTrigger_();

  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  var existing;
  var sendLead = true;
  try {
    existing = s128FindSubmission_(String(payload.submissionId));
    if (existing && existing.leadEmailed) {
      return {
        ok: true,
        duplicate: true,
        leadEmailed: true,
        visitorEmailed: false,
        followUpQueued: s128AppendFollowUp_(payload, checked)
      };
    }
    if (existing && existing.status === 'pending' && !existing.leadEmailed) {
      var age = Date.now() - Date.parse(existing.timestamp || '');
      if (!isNaN(age) && age >= 0 && age < S128_PENDING_STALE_MS) {
        return { ok: false, error: 'This submission is already being sent. Wait a moment and retry.' };
      }
    }
    sendLead = !(existing && existing.leadEmailed);
    if (sendLead && s128CountLeadsToday_(String(payload.submissionId)) >= S128_DAILY_LEAD_CAP) {
      s128LogEvent_('rejected_daily_cap', payload.submissionId, 'cap');
      return { ok: false, error: 'The daily email limit has been reached. Questions about DK Benefits’ services? 407-476-5076 · dan@dkbenefits.net' };
    }
    s128UpsertSubmission_(
      existing,
      payload,
      checked,
      'pending',
      '',
      !!(existing && existing.leadEmailed),
      !!(existing && existing.visitorEmailed)
    );
  } finally {
    lock.releaseLock();
  }

  var files;
  try {
    files = s128AttachmentFiles_(payload, checked.plan);
  } catch (buildErr) {
    s128Mark_(String(payload.submissionId), 'failed', buildErr.message || 'document error', !!(existing && existing.leadEmailed), !!(existing && existing.visitorEmailed));
    return { ok: false, error: 'The sample could not be prepared for email.' };
  }

  var quota = 0;
  try { quota = MailApp.getRemainingDailyQuota(); } catch (ignoreQuota) { quota = 0; }
  if (sendLead && quota < 1) {
    s128Mark_(String(payload.submissionId), 'failed', 'mail quota', false, !!(existing && existing.visitorEmailed));
    return { ok: false, error: 'Email delivery is temporarily unavailable.' };
  }

  var leadSent = !!(existing && existing.leadEmailed);
  if (sendLead) {
    try {
      MailApp.sendEmail(s128LeadMessage_(payload, checked, files));
      leadSent = true;
      s128Mark_(String(payload.submissionId), 'partial', '', true, false);
    } catch (mailErr) {
      s128Mark_(String(payload.submissionId), 'failed', mailErr.message || 'mail failed', false, false);
      return { ok: false, error: 'The request could not be sent.' };
    }
  }

  var followQueued = false;
  if (leadSent && payload.sendVisitorCopy !== false) {
    var queueLock = LockService.getScriptLock();
    queueLock.waitLock(20000);
    try {
      followQueued = s128AppendFollowUp_(payload, checked);
    } catch (queueErr) {
      followQueued = false;
    } finally {
      queueLock.releaseLock();
    }
  }

  s128Mark_(String(payload.submissionId), 'sent', '', leadSent, false);
  s128LogEvent_('sent', payload.submissionId, (leadSent ? 'dan' : '') + (followQueued ? '+queued' : ''));
  return {
    ok: true,
    leadEmailed: leadSent,
    visitorEmailed: false,
    followUpQueued: followQueued,
    duplicate: false
  };
}

function s128AttachmentFiles_(payload, plan) {
  var accepted = [];
  var sawDocx = false;
  var incoming = payload.files;
  if (incoming && incoming.length) {
    for (var i = 0; i < incoming.length && accepted.length < S128_MAX_FILES; i++) {
      var file = s128CheckedFile_(incoming[i]);
      if (!file) continue;
      if (file.mime === S128_DOCX_MIME) sawDocx = true;
      accepted.push(file.blob);
    }
  }
  if (!sawDocx) {
    accepted.unshift(s128BytesBlob_(S128Docgen.buildPlanDocx(plan), S128_DOCX_MIME, S128Docgen.planFileName(plan)));
    var amendmentBytes = S128Docgen.buildAmendmentDocx(plan);
    if (amendmentBytes && accepted.length < S128_MAX_FILES) {
      accepted.push(s128BytesBlob_(amendmentBytes, S128_DOCX_MIME, S128Docgen.amendmentFileName(plan)));
    }
    if (accepted.length < S128_MAX_FILES) {
      accepted.push(s128BytesBlob_(S128Docgen.buildGuideDocx(plan), S128_DOCX_MIME, S128Docgen.guideFileName(plan)));
    }
  }
  return accepted.slice(0, S128_MAX_FILES);
}

function s128CheckedFile_(file) {
  if (!file || typeof file !== 'object') return null;
  var mime = String(file.mime || '');
  if (mime !== S128_DOCX_MIME && mime !== S128_PDF_MIME) return null;
  var raw = String(file.dataBase64 || '').replace(/\s+/g, '');
  if (!raw || raw.length > Math.ceil(S128_MAX_FILE_BYTES * 4 / 3) + 16) return null;
  var bytes;
  try { bytes = Utilities.base64Decode(raw); } catch (err) { return null; }
  if (!bytes || !bytes.length || bytes.length > S128_MAX_FILE_BYTES) return null;
  if (mime === S128_PDF_MIME) {
    if (bytes[0] !== 0x25 || bytes[1] !== 0x50 || bytes[2] !== 0x44 || bytes[3] !== 0x46) return null;
  } else if (bytes[0] !== 0x50 || bytes[1] !== 0x4B) {
    return null;
  }
  var ext = mime === S128_PDF_MIME ? '.pdf' : '.docx';
  var name = String(file.name || 'Section128').replace(/[^A-Za-z0-9._-]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 80);
  if (!name) name = 'Section128';
  if (!new RegExp(ext + '$', 'i').test(name)) name += ext;
  return { mime: mime, blob: s128BytesBlob_(bytes, mime, name) };
}

function s128BytesBlob_(bytes, mime, name) {
  var data = [];
  for (var i = 0; i < bytes.length; i++) data.push(bytes[i]);
  return Utilities.newBlob(data, mime, name);
}

function s128LeadMessage_(payload, checked, files) {
  var lead = checked.lead;
  var plan = checked.plan;
  var review = checked.review;
  var bits = [];
  if (payload.test) bits.push('[TEST]');
  if (review.required) bits.push('[REVIEW]');
  bits.push('New Section 128 Lead: ' + plan.employer_name + ' | ' + S128Model.fundingLabel(plan.funding_mode) + ' | ' + lead.total_employee_count + ' employees');
  var lines = [
    'Section 128 Trump Account Contribution Program — draft lead',
    'Template: ' + (payload.templateVersion || S128Model.TEMPLATE_VERSION),
    'Submitted: ' + s128Stamp_(),
    'Source page: ' + (payload.pageUrl || ''),
    'Submission id: ' + payload.submissionId,
    '',
    'Company',
    'Legal name: ' + plan.employer_name,
    'EIN: ' + plan.employer_ein,
    'Address: ' + plan.employer_address,
    'State: ' + plan.state,
    'Entity: ' + S128Model.entityLabel(lead.entity_type),
    'Employees: ' + lead.total_employee_count,
    'Additional employers: ' + ((plan.participating_employers || []).join('; ') || 'None'),
    '',
    'Contact',
    'Name: ' + lead.contact_name,
    'Title: ' + lead.contact_title,
    'Email: ' + lead.contact_email,
    'Phone: ' + lead.contact_phone,
    '',
    'Design',
    'Program: ' + plan.plan_name,
    'Effective date: ' + S128Model.formatLongDate(plan.effective_date),
    'Funding: ' + S128Model.fundingLabel(plan.funding_mode),
    'Employer grant: ' + (plan.employer_annual_grant ? S128Model.formatMoney(plan.employer_annual_grant) : 'None'),
    'Cap: ' + S128Model.capText(plan),
    'Salary reduction room: ' + (S128Model.capacityMessage(plan) || 'Not used'),
    'Grant recipients: ' + (plan.allow_employee_account ? 'Dependents and employee own account' : 'Dependent accounts only'),
    'Eligible class: ' + plan.eligibility_class,
    'Waiting days: ' + plan.waiting_days,
    'Administrator: ' + plan.administrator_name,
    'Administrator contact: ' + plan.administrator_contact,
    'Representative: ' + plan.signer_name + ', ' + plan.signer_title,
    'Section 125 plan: ' + (plan.cafeteria_plan_name || 'Not used'),
    'Amendment date: ' + (plan.cafeteria_amendment_date ? S128Model.formatLongDate(plan.cafeteria_amendment_date) : 'Not used'),
    'Processing notice days: ' + (plan.election_cutoff_days == null ? 'Not used' : plan.election_cutoff_days),
    'Related businesses: ' + (lead.related_businesses || ''),
    'Owner or family participation: ' + (lead.owners_or_family_want_to_participate || ''),
    'Collectively bargained: ' + (lead.collectively_bargained_employees || ''),
    'Existing Section 125 plan: ' + (lead.has_existing_125_plan || 'Not asked'),
    '',
    'Review',
    review.required ? review.reasons.map(function (reason) { return '- ' + reason; }).join('\n') : 'No extra review flags.',
    '',
    'Acknowledgement',
    'Terms version: ' + ((payload.acknowledgement && payload.acknowledgement.termsVersion) || ''),
    'Accepted at: ' + ((payload.acknowledgement && payload.acknowledgement.acceptedAt) || ''),
    '',
    'The attached files are sample drafts for the employer. They are not adopted until the employer signs them.'
  ];
  return {
    to: S128_NOTIFY_EMAIL,
    subject: bits.join(' '),
    body: lines.join('\n'),
    name: 'DK Benefits LLC',
    attachments: files
  };
}

function s128FollowUpPlan_(plan) {
  return {
    employer_name: plan.employer_name,
    funding_mode: plan.funding_mode,
    employer_annual_grant: plan.employer_annual_grant,
    annual_cap_mode: plan.annual_cap_mode,
    fixed_annual_cap: plan.fixed_annual_cap,
    effective_date: plan.effective_date,
    cafeteria_plan_name: plan.cafeteria_plan_name || '',
    allow_employee_account: !!plan.allow_employee_account
  };
}

function s128AppendFollowUp_(payload, checked) {
  if (payload.sendVisitorCopy === false) return false;
  var email = checked.lead && checked.lead.contact_email;
  if (!email) return false;
  var sheet = s128Sheet_(S128_FOLLOWUPS_SHEET, S128_FOLLOWUP_HEADERS);
  var values = sheet.getDataRange().getValues();
  var id = String(payload.submissionId);
  for (var i = 1; i < values.length; i++) {
    if (String(values[i][7]) === id) return true;
  }
  sheet.appendRow([
    new Date(s128Now_()).toISOString(),
    email,
    checked.lead.contact_name || '',
    checked.plan.employer_name || '',
    JSON.stringify(s128FollowUpPlan_(checked.plan)),
    'pending',
    payload.test ? 'yes' : 'no',
    id,
    '',
    ''
  ]);
  return true;
}

function s128FollowUpMessage_(row) {
  var plan = {};
  try { plan = JSON.parse(String(row[4] || '{}')); } catch (err) { plan = {}; }
  var subject = 'Thanks for using our Section 128 tool';
  if (String(row[6]) === 'yes') subject = '[TEST] ' + subject;
  return {
    to: String(row[1] || ''),
    subject: subject,
    body: S128Docgen.followUpEmailText(plan, { contact_name: String(row[2] || '') }, {
      section125Url: SECTION125_URL,
      ratesUrl: RATES_URL
    }),
    name: 'Daniel Kirves',
    replyTo: S128_NOTIFY_EMAIL
  };
}

function s128FollowUpSentToday_(values, email) {
  var day = s128Today_();
  var target = String(email || '').toLowerCase();
  for (var i = 1; i < values.length; i++) {
    if (String(values[i][1] || '').toLowerCase() !== target) continue;
    if (String(values[i][5]) !== 'sent') continue;
    if (String(values[i][9] || '').slice(0, 10) === day) return true;
  }
  return false;
}

function s128SendDueFollowUps() {
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    var sheet = s128Sheet_(S128_FOLLOWUPS_SHEET, S128_FOLLOWUP_HEADERS);
    var values = sheet.getDataRange().getValues();
    var now = s128Now_();
    for (var i = 1; i < values.length; i++) {
      if (String(values[i][5]) !== 'pending') continue;
      var ts = Date.parse(String(values[i][0] || ''));
      if (isNaN(ts) || now - ts < S128_FOLLOWUP_DELAY_MS) continue;
      var email = String(values[i][1] || '');
      var rowNumber = i + 1;
      if (s128FollowUpSentToday_(values, email)) {
        sheet.getRange(rowNumber, 6).setValue('skipped');
        sheet.getRange(rowNumber, 9).setValue('already sent today');
        values[i][5] = 'skipped';
        continue;
      }
      if (!s128VisitorAllowed_(email)) {
        sheet.getRange(rowNumber, 6).setValue('skipped');
        sheet.getRange(rowNumber, 9).setValue('hourly limit');
        values[i][5] = 'skipped';
        continue;
      }
      try {
        var message = s128FollowUpMessage_(values[i]);
        if (message.attachments) delete message.attachments;
        MailApp.sendEmail(message);
        var sentAt = new Date(s128Now_()).toISOString();
        sheet.getRange(rowNumber, 6).setValue('sent');
        sheet.getRange(rowNumber, 9).setValue('');
        sheet.getRange(rowNumber, 10).setValue(sentAt);
        values[i][5] = 'sent';
        values[i][9] = sentAt;
      } catch (err) {
        sheet.getRange(rowNumber, 6).setValue('failed');
        sheet.getRange(rowNumber, 9).setValue(err && err.message ? String(err.message).slice(0, 300) : 'mail failed');
        values[i][5] = 'failed';
      }
    }
  } finally {
    lock.releaseLock();
  }
}

function setupFollowUpTrigger() {
  var triggers = ScriptApp.getProjectTriggers();
  for (var i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === S128_FOLLOWUP_HANDLER) return;
  }
  ScriptApp.newTrigger(S128_FOLLOWUP_HANDLER).timeBased().everyMinutes(5).create();
}

function s128EnsureFollowUpTrigger_() {
  try { setupFollowUpTrigger(); } catch (err) {}
}

function s128Now_() {
  if (typeof S128_TEST_NOW === 'number' && isFinite(S128_TEST_NOW)) return S128_TEST_NOW;
  return Date.now();
}

function s128VisitorAllowed_(email) {
  var cache = CacheService.getScriptCache();
  var key = 's128v:' + String(email || '').toLowerCase();
  var count = Number(cache.get(key) || '0');
  if (count >= S128_VISITOR_HOURLY_LIMIT) return false;
  cache.put(key, String(count + 1), 3600);
  return true;
}

function s128Sheet_(name, headers) {
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

function s128FindSubmission_(id) {
  var sheet = s128Sheet_(S128_SUBMISSIONS_SHEET, S128_SUBMISSION_HEADERS);
  var values = sheet.getDataRange().getValues();
  for (var i = 1; i < values.length; i++) {
    if (String(values[i][1]) === id) {
      return {
        rowNumber: i + 1,
        status: String(values[i][2] || ''),
        timestamp: String(values[i][0] || ''),
        leadEmailed: String(values[i][16] || '') === 'yes',
        visitorEmailed: String(values[i][17] || '') === 'yes'
      };
    }
  }
  return null;
}

function s128CountLeadsToday_(exceptId) {
  var sheet = s128Sheet_(S128_SUBMISSIONS_SHEET, S128_SUBMISSION_HEADERS);
  var values = sheet.getDataRange().getValues();
  var day = new Date().toISOString().slice(0, 10);
  var count = 0;
  for (var i = 1; i < values.length; i++) {
    if (String(values[i][1]) === exceptId) continue;
    if (String(values[i][16] || '') !== 'yes') continue;
    if (String(values[i][0] || '').slice(0, 10) === day) count++;
  }
  return count;
}

function s128Row_(payload, checked, status, error, leadEmailed, visitorEmailed) {
  var plan = checked.plan;
  var lead = checked.lead;
  return [
    new Date().toISOString(),
    String(payload.submissionId),
    status,
    payload.test ? 'yes' : 'no',
    plan.employer_name,
    plan.state,
    lead.contact_name,
    lead.contact_email,
    lead.contact_phone,
    lead.total_employee_count,
    plan.funding_mode,
    plan.effective_date,
    checked.review.required ? 'yes' : 'no',
    (checked.review.reasons || []).join(' | '),
    payload.pageUrl || '',
    payload.templateVersion || '',
    leadEmailed ? 'yes' : 'no',
    visitorEmailed ? 'yes' : 'no',
    error || '',
    JSON.stringify({ lead: lead, plan: plan, review: checked.review, acknowledgement: payload.acknowledgement || {}, utm: payload.utm || {} }),
    (payload.acknowledgement && payload.acknowledgement.termsVersion) || '',
    (payload.acknowledgement && payload.acknowledgement.acceptedAt) || ''
  ];
}

function s128UpsertSubmission_(existing, payload, checked, status, error, leadEmailed, visitorEmailed) {
  var sheet = s128Sheet_(S128_SUBMISSIONS_SHEET, S128_SUBMISSION_HEADERS);
  var row = s128Row_(payload, checked, status, error, leadEmailed, visitorEmailed);
  if (!existing) {
    sheet.appendRow(row);
    return;
  }
  sheet.getRange(existing.rowNumber, 1, 1, row.length).setValues([row]);
}

function s128Mark_(id, status, error, leadEmailed, visitorEmailed) {
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var found = s128FindSubmission_(id);
    if (!found) return;
    var sheet = s128Sheet_(S128_SUBMISSIONS_SHEET, S128_SUBMISSION_HEADERS);
    sheet.getRange(found.rowNumber, 3).setValue(status);
    sheet.getRange(found.rowNumber, 17).setValue(leadEmailed ? 'yes' : 'no');
    sheet.getRange(found.rowNumber, 18).setValue(visitorEmailed ? 'yes' : 'no');
    sheet.getRange(found.rowNumber, 19).setValue(error || '');
  } finally {
    lock.releaseLock();
  }
}

function s128LogEvent_(kind, submissionId, detail) {
  var sheet = s128Sheet_(S128_EVENTS_SHEET, ['timestamp', 'kind', 'submission_id', 'detail']);
  sheet.appendRow([new Date().toISOString(), kind, submissionId || '', String(detail || '').slice(0, 500)]);
}

function s128Today_() {
  try {
    if (typeof Session !== 'undefined' && Session.getScriptTimeZone) {
      return Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd');
    }
  } catch (err) {}
  return S128Model.todayIso(new Date());
}

function s128Stamp_() {
  try {
    if (typeof Session !== 'undefined' && Session.getScriptTimeZone) {
      return Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm z');
    }
  } catch (err) {}
  return new Date().toISOString();
}

function s128Json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
