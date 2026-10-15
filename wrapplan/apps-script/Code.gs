/**
 * DK Benefits wrap plan lead service.
 * Container-bound to a spreadsheet named DK Benefits Wrap Plan Leads.
 * Do not paste this into the Section 125, Section 128, or quote-tool script.
 * Deploy as a web app: Execute as Me (dan@dkbenefits.net), Who has access: Anyone.
 * Run setupWrapPlan once from the editor.
 */
var WP_NOTIFY_EMAIL = 'dan@dkbenefits.net';
var WP_SUBMISSIONS = 'Submissions';
var WP_EVENTS = 'Events';
var WP_FOLLOWUPS = 'FollowUps';
var WP_FOLLOWUP_DELAY_MS = 12 * 60 * 1000;
var WP_MIN_ELAPSED_MS = 3000;
var WP_DAILY_CAP = 50;
var WP_HOURLY_VISITOR = 3;
var WP_SUBMISSION_HEADERS = [
  'timestamp', 'submission_id', 'status', 'test', 'company', 'state', 'contact_name',
  'contact_email', 'contact_phone', 'employee_count', 'role', 'utm', 'referrer',
  'erisa_path', 'funding', 'benefits', 'plan_number', 'covered_participants', 'filing_result',
  'cobra', 'phi', 'lead_score', 'findings_summary', 'renewal_reminder_on', 'renewal_emailed_dan',
  'page_url', 'template_version', 'lead_emailed', 'visitor_emailed', 'error', 'payload_json',
  'terms_version', 'terms_accepted_at'
];
var WP_EVENT_HEADERS = ['timestamp', 'kind', 'submission_id', 'detail'];
var WP_FOLLOWUP_HEADERS = ['timestamp', 'email', 'name', 'company', 'status', 'test', 'submission_id', 'error', 'sent_at', 'not_before'];

function doGet() {
  return ContentService.createTextOutput('DK Benefits wrap plan lead service is deployed. Submit the form to deliver a lead.')
    .setMimeType(ContentService.MimeType.TEXT);
}

function doPost(e) {
  var payload;
  try { payload = JSON.parse((e && e.postData && e.postData.contents) || '{}'); }
  catch (err) { return wpJson_({ ok: false, error: 'The submission could not be read.' }); }
  if (!payload || payload.event !== 'wp_submission') return wpJson_({ ok: false, error: 'Unrecognized submission.' });
  try { return wpJson_(wpHandle_(payload)); }
  catch (err2) { return wpJson_({ ok: false, error: 'The sample could not be sent.' }); }
}

function setupWrapPlan() {
  wpSheet_(WP_SUBMISSIONS, WP_SUBMISSION_HEADERS);
  wpSheet_(WP_EVENTS, WP_EVENT_HEADERS);
  wpSheet_(WP_FOLLOWUPS, WP_FOLLOWUP_HEADERS);
  setupFollowUpTrigger();
}

function setupFollowUpTrigger() {
  var triggers = ScriptApp.getProjectTriggers();
  for (var i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === 'wpSendDueFollowUps') return;
  }
  ScriptApp.newTrigger('wpSendDueFollowUps').timeBased().everyMinutes(5).create();
}

function wpCountToday_() {
  var sheet = wpSheet_(WP_SUBMISSIONS, WP_SUBMISSION_HEADERS);
  var rows = sheet.getDataRange().getValues();
  var day = new Date().toISOString().slice(0, 10);
  var n = 0;
  for (var i = 1; i < rows.length; i++) {
    if (String(rows[i][0] || '').slice(0, 10) === day) n++;
  }
  return n;
}

function wpHandle_(payload) {
  if (payload.hp) return { ok: false, error: 'The sample could not be sent.' };
  var started = Date.parse(payload.startedAt || '');
  var submitted = Date.parse(payload.submittedAt || '') || Date.now();
  if (!started || submitted - started < WP_MIN_ELAPSED_MS) return { ok: false, error: 'The sample could not be sent.' };
  var ack = payload.acknowledgement || {};
  if (ack.accepted !== true || ack.termsVersion !== WpTerms.VERSION) return { ok: false, error: 'The terms acknowledgement is missing.' };
  var checked = WpModel.validateSubmission(payload);
  if (!checked.ok) return { ok: false, error: checked.errors[0].message };
  if (wpCountToday_() >= WP_DAILY_CAP) return { ok: false, error: 'The daily email limit has been reached. Questions about DK Benefits services? 407-476-5076.' };
  var plan = checked.plan;
  var lead = checked.lead;
  wpSheet_(WP_SUBMISSIONS, WP_SUBMISSION_HEADERS).appendRow([
    new Date().toISOString(), payload.submissionId, 'sent', payload.test ? 'yes' : 'no', plan.employer_name, plan.state,
    lead.contact_name, lead.contact_email, lead.contact_phone || '', plan.employee_count, plan.role || '',
    plan.utm || '', plan.referrer || '', plan.erisa_path, plan.funding || '', (plan.benefits || []).join('|'),
    plan.plan_number, WpModel.countParticipants(plan), checked.filing ? checked.filing.code : '',
    plan.cobra || '', plan.phi || '', lead.score, (checked.findings || []).join(' '),
    WpModel.renewalReminderOn(plan, new Date(submitted)), '',
    payload.pageUrl || '', payload.templateVersion || WpModel.TEMPLATE_VERSION, 'yes', 'no', '',
    '', ack.termsVersion, ack.acceptedAt
  ]);
  wpSheet_(WP_EVENTS, WP_EVENT_HEADERS).appendRow([new Date().toISOString(), 'sent', payload.submissionId, 'dan']);
  MailApp.sendEmail(wpLeadMessage_(payload, checked));
  var notBefore = wpFollowUpWhen_(submitted + WP_FOLLOWUP_DELAY_MS);
  wpSheet_(WP_FOLLOWUPS, WP_FOLLOWUP_HEADERS).appendRow([
    new Date(submitted).toISOString(), lead.contact_email, lead.contact_name, plan.employer_name,
    'pending', payload.test ? 'yes' : 'no', payload.submissionId, '', '', new Date(notBefore).toISOString()
  ]);
  return { ok: true, leadEmailed: true, visitorEmailed: false };
}

function wpLeadMessage_(payload, checked) {
  var plan = checked.plan;
  var lead = checked.lead;
  var subject = (payload.test ? '[TEST] ' : '') + 'New Wrap Plan Lead: ' + plan.employer_name;
  var lines = [
    subject,
    'Role: ' + WpModel.roleLabel(plan.role),
    'Email: ' + lead.contact_email,
    'Phone: ' + (lead.contact_phone || ''),
    'Employees last year: ' + plan.employee_count,
    'Covered participants: ' + WpModel.countParticipants(plan),
    'Lead score: ' + lead.score,
    'Renewal reminder for Dan: ' + WpModel.renewalReminderOn(plan, new Date()),
    '',
    'Findings',
    (checked.findings || []).join('\n')
  ];
  return { to: WP_NOTIFY_EMAIL, subject: subject, body: lines.join('\n'), attachments: wpFiles_(payload) };
}

function wpFiles_(payload) {
  var out = [];
  var files = payload.files || [];
  for (var i = 0; i < files.length && out.length < 8; i++) {
    var file = files[i];
    if (!file || (file.mime !== 'application/pdf' && file.mime.indexOf('wordprocessingml') === -1)) continue;
    try {
      var bytes = Utilities.base64Decode(String(file.dataBase64 || ''));
      if (!bytes || !bytes.length) continue;
      if (file.mime === 'application/pdf' && (bytes[0] !== 0x25 || bytes[1] !== 0x50)) continue;
      if (file.mime !== 'application/pdf' && (bytes[0] !== 0x50 || bytes[1] !== 0x4B)) continue;
      out.push(Utilities.newBlob(bytes, file.mime, file.name || 'wrap'));
    } catch (err) {}
  }
  return out;
}

function wpHourEt_(ms) {
  var parts = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date(ms));
  var hour = 0;
  var minute = 0;
  parts.forEach(function (part) {
    if (part.type === 'hour') hour = parseInt(part.value, 10);
    if (part.type === 'minute') minute = parseInt(part.value, 10);
  });
  return { hour: hour, minute: minute };
}

function wpInWindow_(ms) {
  var clock = wpHourEt_(ms);
  return clock.hour >= 7 && clock.hour <= 18;
}

function wpFollowUpWhen_(dueMs) {
  if (wpInWindow_(dueMs)) return dueMs;
  var cursor = dueMs;
  for (var i = 0; i < 96; i++) {
    cursor += 15 * 60 * 1000;
    var clock = wpHourEt_(cursor);
    if (clock.hour === 7) return cursor - clock.minute * 60 * 1000;
  }
  return dueMs;
}

function wpSendDueFollowUps() {
  try { wpSendDueRenewals(); } catch (ignoreRenewal) {}
  var sheet = wpSheet_(WP_FOLLOWUPS, WP_FOLLOWUP_HEADERS);
  var rows = sheet.getDataRange().getValues();
  var now = Date.now();
  var sentThisHour = 0;
  for (var r = 1; r < rows.length; r++) {
    if (rows[r][4] !== 'pending') continue;
    var due = Date.parse(rows[r][9] || '');
    if (!due || due > now) continue;
    if (!wpInWindow_(now)) continue;
    var email = String(rows[r][1] || '');
    if (wpAlreadyToday_(rows, email, r)) {
      sheet.getRange(r + 1, 5).setValue('skipped');
      continue;
    }
    if (sentThisHour >= WP_HOURLY_VISITOR) continue;
    var plan = { employer_name: rows[r][3] };
    var lead = { contact_name: rows[r][2], contact_email: email };
    var subject = (rows[r][5] === 'yes' ? '[TEST] ' : '') + 'Your wrap plan sample';
    MailApp.sendEmail({
      to: email,
      replyTo: WP_NOTIFY_EMAIL,
      name: 'Daniel Kirves',
      subject: subject,
      body: WpDocgen.followUpEmailText(plan, lead),
      htmlBody: WpDocgen.followUpEmailHtml(plan, lead)
    });
    sheet.getRange(r + 1, 5).setValue('sent');
    sheet.getRange(r + 1, 9).setValue(new Date().toISOString());
    wpMarkVisitorEmailed_(rows[r][6]);
    sentThisHour++;
  }
}

function wpMarkVisitorEmailed_(submissionId) {
  if (!submissionId) return;
  var sheet = wpSheet_(WP_SUBMISSIONS, WP_SUBMISSION_HEADERS);
  var rows = sheet.getDataRange().getValues();
  for (var i = 1; i < rows.length; i++) {
    if (String(rows[i][1]) === String(submissionId)) sheet.getRange(i + 1, 29).setValue('yes');
  }
}

function wpSendDueRenewals() {
  var sheet = wpSheet_(WP_SUBMISSIONS, WP_SUBMISSION_HEADERS);
  var rows = sheet.getDataRange().getValues();
  var today = new Date().toISOString().slice(0, 10);
  for (var r = 1; r < rows.length; r++) {
    var when = String(rows[r][23] || '');
    var sent = String(rows[r][24] || '');
    if (!when || sent || when > today) continue;
    MailApp.sendEmail({
      to: WP_NOTIFY_EMAIL,
      subject: 'Wrap renewal reminder: ' + rows[r][4],
      body: 'Internal reminder for Dan only. ' + rows[r][4] + ' reminder date ' + when + '.'
    });
    sheet.getRange(r + 1, 25).setValue('yes');
  }
}

function wpAlreadyToday_(rows, email, index) {
  var day = new Date().toISOString().slice(0, 10);
  for (var i = 1; i < rows.length; i++) {
    if (i === index) continue;
    if (String(rows[i][1] || '').toLowerCase() !== email.toLowerCase()) continue;
    if (rows[i][4] === 'sent' && String(rows[i][8] || '').slice(0, 10) === day) return true;
  }
  return false;
}

function wpSheet_(name, headers) {
  var book = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = book.getSheetByName(name);
  if (!sheet) {
    sheet = book.insertSheet(name);
    sheet.appendRow(headers);
  }
  return sheet;
}

function wpJson_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
