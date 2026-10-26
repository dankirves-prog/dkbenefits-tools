/**
 * DK Benefits qualifying event question form.
 * Container-bound to the spreadsheet "DK Benefits Qualifying Event Questions".
 * Do not paste this into the contact form, the quote tool, Section 125, Section 128, or the wrap plan.
 *
 * Deploy: Web app, Execute as Me, Who has access: Anyone.
 * The alert goes to dan@dkbenefits.net and nowhere else.
 * The visitor does not get an email from this script.
 * See SETUP.md.
 */
var QE_NOTIFY_EMAIL = 'dan@dkbenefits.net';
var QE_SHEET = 'Questions';
var QE_MIN_ELAPSED_MS = 3000;
var QE_HEADERS = [
  'timestamp',
  'name',
  'email',
  'phone',
  'company',
  'question',
  'scenario summary',
  'scenario JSON',
  'page URL',
  'include scenario'
];

function doGet() {
  return ContentService
    .createTextOutput('DK Benefits qualifying event questions are deployed. Submit the form to send a question.')
    .setMimeType(ContentService.MimeType.TEXT);
}

function doPost(e) {
  var payload;
  try {
    payload = JSON.parse((e && e.postData && e.postData.contents) || '{}');
  } catch (err) {
    return qeJson_({ ok: false, error: 'Your question could not be read.' });
  }
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return qeJson_({ ok: false, error: 'Your question could not be read.' });
  }
  try {
    return qeJson_(qeHandle_(payload));
  } catch (err) {
    return qeJson_({ ok: false, error: 'Your question could not be sent. Call or text 407-476-5076 or email dan@dkbenefits.net.' });
  }
}

function setup() {
  qeSheet_();
}

function qeHandle_(payload) {
  if (qeFilled_(payload.hp) || qeFilled_(payload.company_website) || qeFilled_(payload.website)) {
    return { ok: false, error: 'Your question could not be sent.' };
  }
  if (payload.event !== 'qe_question') {
    return { ok: false, error: 'Unrecognized submission.' };
  }
  var started = Date.parse(payload.startedAt || '');
  var submitted = Date.parse(payload.submittedAt || '');
  if (!submitted || isNaN(submitted)) submitted = Date.now();
  if (!started || isNaN(started) || submitted - started < QE_MIN_ELAPSED_MS) {
    return { ok: false, error: 'Your question could not be sent.' };
  }

  var checked = qeValidate_(payload);
  if (!checked.ok) {
    return { ok: false, error: checked.errors[0].message, fields: checked.errors };
  }

  var include = payload.includeScenario === true && payload.scenario && typeof payload.scenario === 'object' && !Array.isArray(payload.scenario);
  var summary = '';
  var raw = '';
  if (include) {
    summary = String(payload.scenarioSummary || '').replace(/\r\n/g, '\n').trim();
    if (summary.length > 5000) summary = summary.slice(0, 5000);
    try {
      raw = JSON.stringify(payload.scenario);
    } catch (ignore) {
      raw = '';
    }
    if (raw.length > 45000) raw = raw.slice(0, 45000);
  }

  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    qeSheet_().appendRow([
      new Date().toISOString(),
      qeSafe_(checked.fields.name),
      qeSafe_(checked.fields.email),
      qeSafe_(checked.fields.phone),
      qeSafe_(checked.fields.company),
      qeSafe_(checked.fields.question),
      qeSafe_(summary),
      qeSafe_(raw),
      qeSafe_(checked.pageUrl),
      include ? 'yes' : 'no'
    ]);
  } finally {
    lock.releaseLock();
  }

  try {
    MailApp.sendEmail(qeLeadMessage_(checked.fields, summary, checked.pageUrl));
  } catch (mailErr) {
    return { ok: false, emailed: false, error: 'Your question could not be emailed just now. Call or text 407-476-5076 or email dan@dkbenefits.net.' };
  }
  return { ok: true, emailed: true };
}

function qeValidate_(payload) {
  var name = qeClean_(payload.name, 120);
  var email = qeClean_(payload.email, 254);
  var phone = qeClean_(payload.phone, 24);
  var company = qeClean_(payload.company, 120);
  var question = String(payload.question == null ? '' : payload.question).replace(/\r\n/g, '\n').trim();
  if (question.length > 4000) question = question.slice(0, 4000);
  var pageUrl = qeClean_(payload.pageUrl, 500);
  var errors = [];
  if (!name) errors.push({ field: 'name', message: 'Enter your name.' });
  if (!email) errors.push({ field: 'email', message: 'Enter your email.' });
  else if (!qeEmailOk_(email)) errors.push({ field: 'email', message: 'Enter an email Dan can reply to.' });
  if (phone && qeDigits_(phone).length < 7) errors.push({ field: 'phone', message: 'Enter a phone number with at least 7 digits, or leave it blank.' });
  if (!question) errors.push({ field: 'question', message: 'Enter your question.' });
  return {
    ok: errors.length === 0,
    errors: errors,
    pageUrl: pageUrl,
    fields: { name: name, email: email, phone: phone, company: company, question: question }
  };
}

function qeLeadMessage_(fields, summary, pageUrl) {
  var subject = 'Qualifying event question from ' + fields.name;
  if (fields.company) subject += ' (' + fields.company + ')';
  var lines = [
    'Qualifying event question',
    'Page: ' + (pageUrl || ''),
    '',
    'Name: ' + fields.name,
    'Email: ' + fields.email,
    'Phone: ' + (fields.phone || ''),
    'Company: ' + (fields.company || ''),
    '',
    'Question:',
    fields.question,
    '',
    'Scenario:',
    summary || 'No scenario included.'
  ];
  var message = {
    to: QE_NOTIFY_EMAIL,
    replyTo: fields.email,
    subject: subject.slice(0, 180),
    body: lines.join('\n'),
    name: 'DK Benefits website'
  };
  qeAssertRecipient_(message);
  return message;
}

function qeAssertRecipient_(message) {
  if (QE_NOTIFY_EMAIL !== 'dan@dkbenefits.net') throw new Error('lead recipient');
  if (!message || message.to !== 'dan@dkbenefits.net') throw new Error('lead recipient');
  if (message.cc || message.bcc || message.htmlBody || message.attachments) throw new Error('lead recipient');
}

function qeSheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) throw new Error('Open this script from the questions spreadsheet.');
  var sheet = ss.getSheetByName(QE_SHEET);
  if (!sheet) sheet = ss.insertSheet(QE_SHEET);
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(QE_HEADERS);
    return sheet;
  }
  var headers = sheet.getRange(1, 1, 1, QE_HEADERS.length).getValues()[0];
  if (headers.join('') === '') sheet.getRange(1, 1, 1, QE_HEADERS.length).setValues([QE_HEADERS]);
  return sheet;
}

function qeJson_(body) {
  return ContentService
    .createTextOutput(JSON.stringify(body))
    .setMimeType(ContentService.MimeType.JSON);
}

function qeClean_(value, max) {
  var text = String(value == null ? '' : value).replace(/[ \t\f\v]+/g, ' ').trim();
  if (max && text.length > max) text = text.slice(0, max);
  return text;
}

function qeDigits_(value) {
  return String(value || '').replace(/\D/g, '');
}

function qeEmailOk_(email) {
  if (!email || email.length > 254) return false;
  if (/\s/.test(email) || email.indexOf('..') !== -1) return false;
  var at = email.indexOf('@');
  if (at < 1 || at !== email.lastIndexOf('@')) return false;
  var domain = email.slice(at + 1);
  if (domain.indexOf('.') < 1 || domain.charAt(0) === '.' || domain.charAt(domain.length - 1) === '.') return false;
  return true;
}

function qeFilled_(value) {
  return String(value == null ? '' : value).trim() !== '';
}

function qeSafe_(value) {
  var text = String(value == null ? '' : value);
  if (/^[=+\-@]/.test(text)) return "'" + text;
  return text;
}
