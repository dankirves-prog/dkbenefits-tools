/**
 * DK Benefits Section 125 lead service.
 * Container-bound to a spreadsheet named DK Benefits Section 125 Leads.
 * Do not paste this into the Section 128 script or the quote-tool script.
 *
 * Paste section125/apps-script/S125Combined.gs as the only script file,
 * or paste s125-model.js, s125-terms.js, s125-docgen.js, and this file.
 *
 * Deploy as a web app: Execute as Me (dan@dkbenefits.net), Who has access: Anyone.
 * Run setupSection125 once from the editor.
 */
var S125_NOTIFY_EMAIL = 'dan@dkbenefits.net';
var S125_SUBMISSIONS_SHEET = 'Submissions';
var S125_EVENTS_SHEET = 'Events';
var S125_FOLLOWUPS_SHEET = 'FollowUps';
var S125_VISITOR_HOURLY_LIMIT = 3;
var S125_DAILY_LEAD_CAP = 50;
var S125_MIN_ELAPSED_MS = 3000;
var S125_PENDING_STALE_MS = 45000;
var S125_MAX_FILE_BYTES = 1500000;
var S125_MAX_FILES = 8;
var S125_DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
var S125_PDF_MIME = 'application/pdf';
var S125_FOLLOWUP_DELAY_MS = 10 * 60 * 1000;
var S125_FOLLOWUP_HANDLER = 's125SendDueFollowUps';
var SECTION128_URL = 'https://www.dkbenefits.net/section-128-tool';
var RATES_URL = 'https://www.dkbenefits.net/instant-group-quote';

var S125_FOLLOWUP_HEADERS = [
  'timestamp', 'email', 'name', 'company', 'plan_json', 'status', 'test', 'submission_id', 'error', 'sent_at'
];
var S125_SUBMISSION_HEADERS = [
  'timestamp', 'submission_id', 'status', 'test', 'company', 'state', 'contact_name',
  'contact_email', 'contact_phone', 'employees', 'benefits', 'effective_date',
  'page_url', 'template_version', 'lead_emailed', 'visitor_emailed', 'error', 'payload_json',
  'terms_version', 'terms_accepted_at'
];
var S125_EVENT_HEADERS = ['timestamp', 'kind', 'submission_id', 'detail'];

function doGet() {
  return ContentService
    .createTextOutput('DK Benefits Section 125 lead service is deployed. Submit the form to deliver a lead.')
    .setMimeType(ContentService.MimeType.TEXT);
}

function doPost(e) {
  var payload;
  try {
    payload = JSON.parse((e && e.postData && e.postData.contents) || '{}');
  } catch (err) {
    return s125Json_({ ok: false, error: 'The submission could not be read.' });
  }
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return s125Json_({ ok: false, error: 'The submission could not be read.' });
  }
  if (payload.event !== 's125_submission') {
    return s125Json_({ ok: false, error: 'Unrecognized submission.' });
  }
  try {
    return s125Json_(s125Handle_(payload));
  } catch (err) {
    try { s125LogEvent_('failed', payload.submissionId || '', err && err.message ? err.message : 'failed'); } catch (ignore) {}
    return s125Json_({ ok: false, error: 'The sample could not be sent.' });
  }
}

function setupSection125() {
  s125Sheet_(S125_SUBMISSIONS_SHEET, S125_SUBMISSION_HEADERS);
  s125Sheet_(S125_EVENTS_SHEET, S125_EVENT_HEADERS);
  s125Sheet_(S125_FOLLOWUPS_SHEET, S125_FOLLOWUP_HEADERS);
  setupFollowUpTrigger();
}

function setupFollowUpTrigger() {
  var triggers = ScriptApp.getProjectTriggers();
  for (var i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === S125_FOLLOWUP_HANDLER) return;
  }
  ScriptApp.newTrigger(S125_FOLLOWUP_HANDLER).timeBased().everyMinutes(5).create();
}

function s125EnsureFollowUpTrigger_() {
  try { setupFollowUpTrigger(); } catch (err) {}
}

function s125Handle_(payload) {
  if (payload.hp) {
    s125LogEvent_('rejected_honeypot', payload.submissionId || '', 'honeypot');
    return { ok: false, error: 'The sample could not be sent.' };
  }
  var started = Date.parse(payload.startedAt || '');
  var submitted = Date.parse(payload.submittedAt || '') || s125Now_();
  if (!started || submitted - started < S125_MIN_ELAPSED_MS) {
    s125LogEvent_('rejected_fast', payload.submissionId || '', 'too fast');
    return { ok: false, error: 'The sample could not be sent.' };
  }
  if (!payload.submissionId || String(payload.submissionId).length < 8 || String(payload.submissionId).length > 80) {
    return { ok: false, error: 'The submission id is missing.' };
  }
  var ack = payload.acknowledgement || {};
  var termsOk = ack.termsVersion === S125Terms.VERSION || ack.termsVersion === 's125-terms-2026-10-09';
  if (ack.accepted !== true || !ack.acceptedAt || !Date.parse(ack.acceptedAt) || !termsOk) {
    s125LogEvent_('rejected_terms', payload.submissionId, 'terms');
    return { ok: false, error: 'The terms acknowledgement is missing.' };
  }
  var checked = S125Model.validateSubmission(payload, { asOf: s125AsOf_() });
  if (!checked.ok) {
    s125LogEvent_('rejected_validation', payload.submissionId, checked.errors.map(function (item) { return item.field; }).join(','));
    return { ok: false, error: checked.errors[0] ? checked.errors[0].message : 'Check the form and try again.' };
  }

  s125EnsureFollowUpTrigger_();
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  var existing;
  try {
    existing = s125FindSubmission_(String(payload.submissionId));
    if (existing && existing.leadEmailed) {
      return {
        ok: true,
        duplicate: true,
        leadEmailed: true,
        visitorEmailed: false,
        followUpQueued: s125AppendFollowUp_(payload, checked)
      };
    }
    if (existing && existing.status === 'pending' && !existing.leadEmailed) {
      var age = s125Now_() - Date.parse(existing.timestamp || '');
      if (!isNaN(age) && age >= 0 && age < S125_PENDING_STALE_MS) {
        return { ok: false, error: 'This submission is already being sent. Wait a moment and retry.' };
      }
    }
    if (s125CountLeadsToday_(String(payload.submissionId)) >= S125_DAILY_LEAD_CAP) {
      s125LogEvent_('rejected_daily_cap', payload.submissionId, 'cap');
      return { ok: false, error: 'The daily email limit has been reached. Questions about DK Benefits’ services? 407-476-5076 · dan@dkbenefits.net' };
    }
    s125UpsertSubmission_(existing, payload, checked, 'pending', '', false, false);
  } finally {
    lock.releaseLock();
  }

  var files;
  try {
    files = s125AttachmentFiles_(payload, checked.plan);
  } catch (buildErr) {
    s125Mark_(String(payload.submissionId), 'failed', buildErr.message || 'document error', false, false);
    return { ok: false, error: 'The sample could not be prepared for email.' };
  }
  var quota = 0;
  try { quota = MailApp.getRemainingDailyQuota(); } catch (ignoreQuota) { quota = 0; }
  if (quota < 1) {
    s125Mark_(String(payload.submissionId), 'failed', 'mail quota', false, false);
    return { ok: false, error: 'Email delivery is temporarily unavailable.' };
  }
  try {
    MailApp.sendEmail(s125LeadMessage_(payload, checked, files));
  } catch (mailErr) {
    s125Mark_(String(payload.submissionId), 'failed', mailErr.message || 'mail failed', false, false);
    return { ok: false, error: 'The request could not be sent.' };
  }

  var followQueued = false;
  if (payload.sendVisitorCopy !== false) {
    var queueLock = LockService.getScriptLock();
    queueLock.waitLock(20000);
    try { followQueued = s125AppendFollowUp_(payload, checked); } catch (queueErr) { followQueued = false; }
    finally { queueLock.releaseLock(); }
  }
  s125Mark_(String(payload.submissionId), 'sent', '', true, false);
  s125LogEvent_('sent', payload.submissionId, 'dan' + (followQueued ? '+queued' : ''));
  return { ok: true, leadEmailed: true, visitorEmailed: false, followUpQueued: followQueued, duplicate: false };
}

function s125AttachmentFiles_(payload, plan) {
  var accepted = [];
  var sawDocx = false;
  var incoming = payload.files || [];
  for (var i = 0; i < incoming.length && accepted.length < S125_MAX_FILES; i++) {
    var file = s125CheckedFile_(incoming[i]);
    if (!file) continue;
    if (file.mime === S125_DOCX_MIME) sawDocx = true;
    accepted.push(file.blob);
  }
  if (!sawDocx) {
    accepted.unshift(s125BytesBlob_(S125Docgen.buildPlanDocx(plan), S125_DOCX_MIME, S125Docgen.planFileName(plan)));
    if (accepted.length < S125_MAX_FILES) {
      accepted.push(s125BytesBlob_(S125Docgen.buildGuideDocx(plan), S125_DOCX_MIME, S125Docgen.guideFileName(plan)));
    }
  }
  return accepted.slice(0, S125_MAX_FILES);
}

function s125CheckedFile_(file) {
  if (!file || typeof file !== 'object') return null;
  var mime = String(file.mime || '');
  if (mime !== S125_DOCX_MIME && mime !== S125_PDF_MIME) return null;
  var raw = String(file.dataBase64 || '').replace(/\s+/g, '');
  if (!raw || raw.length > Math.ceil(S125_MAX_FILE_BYTES * 4 / 3) + 16) return null;
  var bytes;
  try { bytes = Utilities.base64Decode(raw); } catch (err) { return null; }
  if (!bytes || !bytes.length || bytes.length > S125_MAX_FILE_BYTES) return null;
  if (mime === S125_PDF_MIME) {
    if (bytes[0] !== 0x25 || bytes[1] !== 0x50 || bytes[2] !== 0x44 || bytes[3] !== 0x46) return null;
  } else if (bytes[0] !== 0x50 || bytes[1] !== 0x4B) return null;
  var ext = mime === S125_PDF_MIME ? '.pdf' : '.docx';
  var name = String(file.name || 'Section125').replace(/[^A-Za-z0-9._-]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 80);
  if (!name) name = 'Section125';
  if (!new RegExp(ext + '$', 'i').test(name)) name += ext;
  return { mime: mime, blob: s125BytesBlob_(bytes, mime, name) };
}

function s125BytesBlob_(bytes, mime, name) {
  var data = [];
  for (var i = 0; i < bytes.length; i++) data.push(bytes[i]);
  return Utilities.newBlob(data, mime, name);
}

function s125Has_(plan, code) {
  return (plan.benefits || []).indexOf(code) !== -1;
}

function s125LeadMessage_(payload, checked, files) {
  var plan = checked.plan;
  var lead = checked.lead;
  var health = s125Has_(plan, 'health_fsa');
  var dcap = s125Has_(plan, 'dcap');
  var hsa = s125Has_(plan, 'hsa');
  var benefits = (plan.benefits || []).map(function (code) { return S125Model.benefitLabel(code); }).join(', ');
  var year = S125Model.planYearSentence(plan);
  if (year) year = year.charAt(0).toUpperCase() + year.slice(1);
  var bits = [];
  if (payload.test) bits.push('[TEST]');
  bits.push('New Section 125 Lead: ' + plan.employer_name + ' | ' + S125Model.entityLabel(plan) + ' | ' + plan.employee_count + ' employees');
  var lines = [
    'Section 125 cafeteria plan — sample lead',
    'Template: ' + (payload.templateVersion || S125Model.TEMPLATE_VERSION),
    'Submission id: ' + payload.submissionId,
    'Source page: ' + (payload.pageUrl || ''),
    '',
    'Company',
    'Legal name: ' + plan.employer_name,
    'EIN: ' + plan.employer_ein,
    'Address: ' + plan.employer_address,
    'State: ' + S125Model.stateName(plan.state),
    'Entity: ' + S125Model.entityLabel(plan),
    'Employees: ' + plan.employee_count,
    '',
    'Contact',
    'Name: ' + (lead.contact_name || plan.signer_name),
    'Title: ' + (lead.contact_title || plan.signer_title),
    'Email: ' + (lead.contact_email || plan.signer_email),
    'Phone: ' + (lead.contact_phone || plan.phone),
    '',
    'Design',
    'Plan: ' + plan.plan_name,
    'Plan number: ' + plan.plan_number,
    'Effective date: ' + S125Model.formatLongDate(plan.effective_date),
    'Plan year: ' + year,
    'Funding: ' + S125Model.fundingLabel(plan.funding_type),
    'Eligible classes: ' + S125Model.classSentence(plan),
    'Waiting period: ' + S125Model.waitingText(plan.waiting_period),
    'Full-time hours: ' + plan.full_time_hours,
    'New-hire enrollment: ' + plan.new_hire_window + ' days',
    'Open enrollment: ' + plan.oe_window_days + ' days',
    'Employees in more than one state: ' + (plan.multi_state ? 'Yes' : 'No'),
    'Existing Section 125 plan: ' + (plan.prior_plan ? 'Yes, originally adopted ' + plan.prior_adoption : 'No'),
    'Benefits: ' + benefits,
    'Health FSA: ' + (health ? S125Model.healthFsaDesignLabel(plan.health_fsa_design) : 'Not offered'),
    'Unused Health FSA amounts: ' + (health ? S125Model.unusedLabel(plan.health_fsa_unused) : 'Not offered'),
    'Dependent Care FSA: ' + (dcap ? 'Offered' : 'Not offered'),
    'Unused dependent care amounts: ' + (dcap ? S125Model.unusedLabel(plan.dcap_unused) : 'Not offered'),
    'HSA: ' + (hsa ? 'Offered. The election can be changed at least monthly.' : 'Not offered'),
    'Authorized officer: ' + plan.signer_name,
    'Officer title: ' + plan.signer_title,
    'Officer email: ' + plan.signer_email,
    '',
    'Acknowledgement',
    'Terms version: ' + ((payload.acknowledgement && payload.acknowledgement.termsVersion) || ''),
    'Accepted at: ' + ((payload.acknowledgement && payload.acknowledgement.acceptedAt) || ''),
    '',
    'The attached files are sample drafts. They are not adopted until the employer signs them. They are not stored on a public link.'
  ];
  if (plan.short_plan_year) {
    lines.splice(lines.indexOf('Plan year: ' + year) + 1, 0, 'First plan year: short year ending ' + S125Model.formatLongDate(plan.short_plan_year_end));
  }
  return {
    to: S125_NOTIFY_EMAIL,
    subject: bits.join(' '),
    body: lines.join('\n'),
    name: 'DK Benefits LLC',
    attachments: files
  };
}

function s125FollowUpPlan_(plan) {
  return {
    employer_name: plan.employer_name,
    effective_date: plan.effective_date,
    benefits: plan.benefits || [],
    health_fsa_unused: plan.health_fsa_unused || '',
    dcap_unused: plan.dcap_unused || '',
    owner_rule: plan.owner_rule || ''
  };
}

function s125AppendFollowUp_(payload, checked) {
  if (payload.sendVisitorCopy === false) return false;
  var email = checked.lead && checked.lead.contact_email;
  if (!email) return false;
  var sheet = s125Sheet_(S125_FOLLOWUPS_SHEET, S125_FOLLOWUP_HEADERS);
  var values = sheet.getDataRange().getValues();
  var id = String(payload.submissionId);
  for (var i = 1; i < values.length; i++) {
    if (String(values[i][7]) === id) return true;
  }
  sheet.appendRow([
    new Date(s125Now_()).toISOString(),
    email,
    checked.lead.contact_name || '',
    checked.plan.employer_name || '',
    JSON.stringify(s125FollowUpPlan_(checked.plan)),
    'pending',
    payload.test ? 'yes' : 'no',
    id,
    '',
    ''
  ]);
  return true;
}

function s125FollowUpMessage_(row) {
  var plan = {};
  try { plan = JSON.parse(String(row[4] || '{}')); } catch (err) { plan = {}; }
  var subject = 'Thanks for using my Section 125 tool!';
  if (String(row[6]) === 'yes') subject = '[TEST] ' + subject;
  var links = { section128Url: SECTION128_URL, ratesUrl: RATES_URL };
  var lead = { contact_name: String(row[2] || '') };
  return {
    to: String(row[1] || ''),
    subject: subject,
    body: S125Docgen.followUpEmailText(plan, lead, links),
    htmlBody: S125Docgen.followUpEmailHtml(plan, lead, links),
    name: 'Daniel Kirves',
    replyTo: S125_NOTIFY_EMAIL
  };
}

function s125FollowUpSentToday_(values, email) {
  var day = s125Today_();
  var target = String(email || '').toLowerCase();
  for (var i = 1; i < values.length; i++) {
    if (String(values[i][1] || '').toLowerCase() !== target) continue;
    if (String(values[i][5]) !== 'sent') continue;
    if (String(values[i][9] || '').slice(0, 10) === day) return true;
  }
  return false;
}

function s125SendDueFollowUps() {
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    var sheet = s125Sheet_(S125_FOLLOWUPS_SHEET, S125_FOLLOWUP_HEADERS);
    var values = sheet.getDataRange().getValues();
    var now = s125Now_();
    for (var i = 1; i < values.length; i++) {
      if (String(values[i][5]) !== 'pending') continue;
      var ts = Date.parse(String(values[i][0] || ''));
      if (isNaN(ts) || now - ts < S125_FOLLOWUP_DELAY_MS) continue;
      var email = String(values[i][1] || '');
      var rowNumber = i + 1;
      if (s125FollowUpSentToday_(values, email)) {
        sheet.getRange(rowNumber, 6).setValue('skipped');
        sheet.getRange(rowNumber, 9).setValue('already sent today');
        values[i][5] = 'skipped';
        continue;
      }
      if (!s125VisitorAllowed_(email)) {
        sheet.getRange(rowNumber, 6).setValue('skipped');
        sheet.getRange(rowNumber, 9).setValue('hourly limit');
        values[i][5] = 'skipped';
        continue;
      }
      try {
        var message = s125FollowUpMessage_(values[i]);
        if (message.attachments) delete message.attachments;
        MailApp.sendEmail(message);
        var sentAt = new Date(s125Now_()).toISOString();
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

function s125Now_() {
  if (typeof S125_TEST_NOW === 'number' && isFinite(S125_TEST_NOW)) return S125_TEST_NOW;
  return Date.now();
}
function s125AsOf_() {
  try {
    if (typeof Utilities !== 'undefined' && Utilities.formatDate) {
      return Utilities.formatDate(new Date(s125Now_()), 'Pacific/Honolulu', 'yyyy-MM-dd');
    }
  } catch (err) {}
  var shifted = new Date(s125Now_() - 10 * 60 * 60 * 1000);
  var month = shifted.getUTCMonth() + 1;
  var day = shifted.getUTCDate();
  return shifted.getUTCFullYear() + '-' + (month < 10 ? '0' : '') + month + '-' + (day < 10 ? '0' : '') + day;
}
function s125Today_() {
  var dt = new Date(s125Now_());
  var m = dt.getUTCMonth() + 1;
  var d = dt.getUTCDate();
  return dt.getUTCFullYear() + '-' + (m < 10 ? '0' : '') + m + '-' + (d < 10 ? '0' : '') + d;
}
function s125Json_(body) {
  return ContentService.createTextOutput(JSON.stringify(body)).setMimeType(ContentService.MimeType.JSON);
}
function s125VisitorAllowed_(email) {
  var cache = CacheService.getScriptCache();
  var key = 's125v:' + String(email || '').toLowerCase();
  var count = Number(cache.get(key) || '0');
  if (count >= S125_VISITOR_HOURLY_LIMIT) return false;
  cache.put(key, String(count + 1), 3600);
  return true;
}
function s125Sheet_(name, headers) {
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
  var width = Math.max(sheet.getLastColumn(), headers.length);
  var current = sheet.getRange(1, 1, 1, width).getValues()[0];
  var changed = false;
  for (var i = 0; i < headers.length; i++) {
    if (!current[i]) { current[i] = headers[i]; changed = true; }
  }
  if (changed) sheet.getRange(1, 1, 1, headers.length).setValues([current.slice(0, headers.length)]);
  return sheet;
}
function s125FindSubmission_(id) {
  var sheet = s125Sheet_(S125_SUBMISSIONS_SHEET, S125_SUBMISSION_HEADERS);
  var values = sheet.getDataRange().getValues();
  for (var i = 1; i < values.length; i++) {
    if (String(values[i][1]) === id) {
      return { row: i + 1, timestamp: values[i][0], status: values[i][2], leadEmailed: values[i][14] === true || values[i][14] === 'yes' };
    }
  }
  return null;
}
function s125CountLeadsToday_(exceptId) {
  var sheet = s125Sheet_(S125_SUBMISSIONS_SHEET, S125_SUBMISSION_HEADERS);
  var values = sheet.getDataRange().getValues();
  var day = s125Today_();
  var count = 0;
  for (var i = 1; i < values.length; i++) {
    if (String(values[i][1]) === exceptId) continue;
    if (values[i][14] !== true && values[i][14] !== 'yes') continue;
    if (String(values[i][0] || '').slice(0, 10) === day) count++;
  }
  return count;
}
function s125UpsertSubmission_(existing, payload, checked, status, error, leadEmailed, visitorEmailed) {
  var sheet = s125Sheet_(S125_SUBMISSIONS_SHEET, S125_SUBMISSION_HEADERS);
  var plan = checked.plan;
  var lead = checked.lead;
  var stored = Object.assign({}, payload);
  delete stored.files;
  var row = [
    new Date(s125Now_()).toISOString(),
    String(payload.submissionId),
    status,
    payload.test ? 'yes' : 'no',
    plan.employer_name,
    plan.state,
    lead.contact_name,
    lead.contact_email,
    lead.contact_phone,
    plan.employee_count,
    (plan.benefits || []).join(', '),
    plan.effective_date,
    payload.pageUrl || '',
    payload.templateVersion || S125Model.TEMPLATE_VERSION,
    leadEmailed ? 'yes' : 'no',
    visitorEmailed ? 'yes' : 'no',
    error || '',
    JSON.stringify(stored).slice(0, 40000),
    (payload.acknowledgement && payload.acknowledgement.termsVersion) || '',
    (payload.acknowledgement && payload.acknowledgement.acceptedAt) || ''
  ];
  if (existing) sheet.getRange(existing.row, 1, 1, row.length).setValues([row]);
  else sheet.appendRow(row);
}
function s125Mark_(id, status, error, leadEmailed, visitorEmailed) {
  var existing = s125FindSubmission_(id);
  if (!existing) return;
  var sheet = s125Sheet_(S125_SUBMISSIONS_SHEET, S125_SUBMISSION_HEADERS);
  sheet.getRange(existing.row, 3).setValue(status);
  sheet.getRange(existing.row, 15).setValue(leadEmailed ? 'yes' : 'no');
  sheet.getRange(existing.row, 16).setValue(visitorEmailed ? 'yes' : 'no');
  sheet.getRange(existing.row, 17).setValue(error || '');
}
function s125LogEvent_(kind, id, detail) {
  var sheet = s125Sheet_(S125_EVENTS_SHEET, S125_EVENT_HEADERS);
  sheet.appendRow([new Date(s125Now_()).toISOString(), kind, id || '', detail || '']);
}
