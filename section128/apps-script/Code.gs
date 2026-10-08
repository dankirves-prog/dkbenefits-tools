/**
 * DK Benefits Section 128 lead service.
 * Container-bound to a new spreadsheet. Do not paste this into the quote-tool script.
 *
 * Also add two script files, pasted from the repo with no edits:
 *   S128Model.gs  = section128/s128-model.js
 *   S128Docgen.gs = section128/s128-docgen.js
 *
 * Deploy as a web app: Execute as Me, Who has access: Anyone.
 * See README.md in this folder.
 */
var S128_NOTIFY_EMAIL = 'dan@dkbenefits.net';
var S128_SUBMISSIONS_SHEET = 'Submissions';
var S128_EVENTS_SHEET = 'Events';
var S128_VISITOR_HOURLY_LIMIT = 3;
var S128_MIN_ELAPSED_MS = 3000;
var S128_DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

var S128_SUBMISSION_HEADERS = [
  'timestamp', 'submission_id', 'status', 'test', 'company', 'state', 'contact_name',
  'contact_email', 'contact_phone', 'employees', 'funding_mode', 'effective_date',
  'review_required', 'review_reasons', 'page_url', 'template_version',
  'lead_emailed', 'visitor_emailed', 'error', 'payload_json'
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
    return s128Json_({ ok: false, error: 'The lead could not be sent.' });
  }
}

function s128Handle_(payload) {
  if (payload.hp) {
    s128LogEvent_('rejected_honeypot', payload.submissionId || '', 'honeypot');
    return { ok: false, error: 'The lead could not be sent.' };
  }
  var started = Date.parse(payload.startedAt || '');
  var submitted = Date.parse(payload.submittedAt || '') || Date.now();
  if (!started || submitted - started < S128_MIN_ELAPSED_MS) {
    s128LogEvent_('rejected_fast', payload.submissionId || '', 'too fast');
    return { ok: false, error: 'The lead could not be sent.' };
  }
  if (!payload.submissionId || String(payload.submissionId).length < 8 || String(payload.submissionId).length > 80) {
    return { ok: false, error: 'The submission id is missing.' };
  }

  var checked = S128Model.validateSubmission(payload, { asOf: s128Today_() });
  if (!checked.ok) {
    s128LogEvent_('rejected_validation', payload.submissionId, checked.errors.map(function (item) { return item.field; }).join(','));
    return { ok: false, error: checked.errors[0] ? checked.errors[0].message : 'Check the form and try again.', fields: checked.errors };
  }

  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  var existing;
  try {
    existing = s128FindSubmission_(String(payload.submissionId));
    if (existing && existing.status === 'sent') {
      return { ok: true, duplicate: true, leadEmailed: true, visitorEmailed: false };
    }
    if (existing && existing.status === 'pending') {
      return { ok: false, error: 'This submission is already being sent. Wait a moment and retry.' };
    }
    s128UpsertSubmission_(existing, payload, checked, 'pending', '', false, false);
  } finally {
    lock.releaseLock();
  }

  var files;
  try {
    files = s128BuildFiles_(checked.plan);
  } catch (buildErr) {
    s128Mark_(String(payload.submissionId), 'failed', buildErr.message || 'document error', false, false);
    return { ok: false, error: 'The draft could not be prepared for email.' };
  }

  var quota = 0;
  try { quota = MailApp.getRemainingDailyQuota(); } catch (ignoreQuota) { quota = 0; }
  if (quota < 1) {
    s128Mark_(String(payload.submissionId), 'failed', 'mail quota', false, false);
    return { ok: false, error: 'Email delivery is temporarily unavailable.' };
  }

  var leadSent = false;
  try {
    MailApp.sendEmail(s128LeadMessage_(payload, checked, files));
    leadSent = true;
  } catch (mailErr) {
    s128Mark_(String(payload.submissionId), 'failed', mailErr.message || 'mail failed', false, false);
    return { ok: false, error: 'The lead could not be emailed.' };
  }

  var visitorSent = false;
  var visitorLimited = false;
  var visitorEmail = checked.lead.contact_email;
  if (payload.sendVisitorCopy !== false && quota >= 2) {
    if (!s128VisitorAllowed_(visitorEmail)) {
      visitorLimited = true;
    } else {
      try {
        MailApp.sendEmail(s128VisitorMessage_(checked, files));
        visitorSent = true;
      } catch (visitorErr) {
        visitorSent = false;
      }
    }
  } else if (payload.sendVisitorCopy !== false) {
    visitorLimited = true;
  }

  s128Mark_(String(payload.submissionId), 'sent', '', true, visitorSent);
  s128LogEvent_('sent', payload.submissionId, visitorSent ? 'lead+visitor' : 'lead');
  return {
    ok: true,
    leadEmailed: leadSent,
    visitorEmailed: visitorSent,
    visitorRateLimited: visitorLimited,
    duplicate: false
  };
}

function s128BuildFiles_(plan) {
  var files = [];
  var planName = S128Docgen.planFileName(plan);
  var planBytes = S128Docgen.buildPlanDocx(plan);
  files.push(s128BytesBlob_(planBytes, S128_DOCX_MIME, planName));
  var planPdf = s128MaybePdf_(planBytes, planName);
  if (planPdf) files.push(planPdf);
  var amendmentBytes = S128Docgen.buildAmendmentDocx(plan);
  if (amendmentBytes) {
    var amendmentName = S128Docgen.amendmentFileName(plan);
    files.push(s128BytesBlob_(amendmentBytes, S128_DOCX_MIME, amendmentName));
    var amendmentPdf = s128MaybePdf_(amendmentBytes, amendmentName);
    if (amendmentPdf) files.push(amendmentPdf);
  }
  return files;
}

function s128BytesBlob_(bytes, mime, name) {
  var data = [];
  for (var i = 0; i < bytes.length; i++) data.push(bytes[i]);
  return Utilities.newBlob(data, mime, name);
}

function s128MaybePdf_(docxBytes, filename) {
  try {
    if (typeof Drive === 'undefined' || !Drive.Files || !Drive.Files.insert) return null;
    var docxBlob = s128BytesBlob_(docxBytes, S128_DOCX_MIME, filename);
    var inserted = Drive.Files.insert({
      title: filename,
      mimeType: 'application/vnd.google-apps.document'
    }, docxBlob, { convert: true });
    var pdf = DriveApp.getFileById(inserted.id).getAs('application/pdf');
    pdf.setName(String(filename).replace(/\.docx$/i, '.pdf'));
    DriveApp.getFileById(inserted.id).setTrashed(true);
    return pdf;
  } catch (err) {
    return null;
  }
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
    'The attached plan is a draft for review. It is not adopted until the employer signs it.'
  ];
  return {
    to: S128_NOTIFY_EMAIL,
    subject: bits.join(' '),
    body: lines.join('\n'),
    name: 'DK Benefits LLC',
    attachments: files
  };
}

function s128VisitorMessage_(checked, files) {
  var plan = checked.plan;
  var body = [
    'Hello ' + checked.lead.contact_name + ',',
    '',
    'Attached is the draft Section 128 Trump Account contribution program for ' + plan.employer_name + '.',
    'It is a draft for review. It is not an IRS determination, an attorney opinion, or a guarantee of compliance.',
    'Downloading it does not establish the program. The signature and date are blank for the employer to sign.',
    '',
    'Daniel Kirves at DK Benefits will follow up. Call or text 407-476-5076 or email dan@dkbenefits.net.',
    '',
    'DK Benefits LLC'
  ].join('\n');
  return {
    to: checked.lead.contact_email,
    subject: 'Your draft Section 128 program — ' + plan.employer_name,
    body: body,
    name: 'DK Benefits LLC',
    replyTo: S128_NOTIFY_EMAIL,
    attachments: files
  };
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
  } else if (sheet.getLastRow() === 0) {
    sheet.appendRow(headers);
  }
  return sheet;
}

function s128FindSubmission_(id) {
  var sheet = s128Sheet_(S128_SUBMISSIONS_SHEET, S128_SUBMISSION_HEADERS);
  var values = sheet.getDataRange().getValues();
  for (var i = 1; i < values.length; i++) {
    if (String(values[i][1]) === id) return { rowNumber: i + 1, status: String(values[i][2] || '') };
  }
  return null;
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
    JSON.stringify({ lead: lead, plan: plan, review: checked.review, utm: payload.utm || {} })
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
