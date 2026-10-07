/**
 * DK Benefits quote tool — full-file replacement.
 * Container-bound. Paste over the whole script, then deploy a new version
 * of the existing web app so the /exec URL does not change.
 *
 * Lead submissions (event "lead_submitted", or a legacy body with no event)
 * still append to Sheet1 and email dan@dkbenefits.net with the existing
 * subject and body. The only lead-email text change is removal of a stray
 * "a" line that sat between Flat Dollar and Enrollment Mix.
 *
 * quote_started and rates_displayed never touch Sheet1. They append to
 * Quote Events (created with headers if missing) before any email.
 * rates_displayed is deduped by session id with a sheet lookup, not
 * CacheService or PropertiesService: cache entries expire, and script
 * properties are size-capped, so either one would eventually email twice.
 * The events tab is the durable log. LockService makes the check-and-send
 * atomic so two overlapping posts cannot both miss the row.
 */

const SHEET_NAME = 'Sheet1';
const EVENTS_SHEET_NAME = 'Quote Events';
const NOTIFY_EMAIL = 'dan@dkbenefits.net';
const ANONYMOUS_ACTIVITY_SUBJECT = 'Anonymous quote activity';
const EVENT_HEADERS = [
  'timestamp',
  'event',
  'session_id',
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_term',
  'utm_content',
  'email_attempted',
  'email_result'
];
const SESSION_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function doPost(e) {
  let payload;
  try {
    payload = JSON.parse(e.postData.contents || '{}');
  } catch (err) {
    return sendLeadError_(err);
  }

  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return sendLeadError_(new Error('invalid payload'));
  }

  if (payload.event === 'quote_started' || payload.event === 'rates_displayed') {
    return handleActivityEvent_(payload);
  }

  if (payload.event && payload.event !== 'lead_submitted') {
    return jsonResponse_({ ok: false, error: 'unrecognized event' });
  }

  return handleLeadSubmission_(payload);
}

function handleLeadSubmission_(payload) {
  let eventRowNumber = null;
  if (payload.event === 'lead_submitted') {
    try {
      eventRowNumber = recordLeadEvent_(payload);
    } catch (logErr) {
      eventRowNumber = null;
    }
  }

  try {
    appendLeadAndNotify_(payload);
    if (eventRowNumber) {
      try {
        updateEmailResult_(ensureEventsSheet_(), eventRowNumber, 'yes', 'sent');
      } catch (ignore) {}
    }
    return jsonResponse_({ ok: true });
  } catch (err) {
    if (eventRowNumber) {
      try {
        updateEmailResult_(ensureEventsSheet_(), eventRowNumber, 'yes', 'failed');
      } catch (ignore) {}
    }
    return sendLeadError_(err);
  }
}

function appendLeadAndNotify_(payload) {
  const sheet = SpreadsheetApp
    .getActiveSpreadsheet()
    .getSheetByName(SHEET_NAME);

  if (!sheet) {
    throw new Error(`Sheet named "${SHEET_NAME}" not found.`);
  }

  const answers = payload.answers || {};
  const contribution = payload.contribution || {};
  const tierMix = payload.tierMix || {};
  const selectedPlans = payload.selectedPlans || [];

  const selectedPlanText = selectedPlans.length
    ? selectedPlans.map(p => `${p.name || ''} (${p.network || ''})`).join(', ')
    : 'None selected';

  const enrollmentMixText =
    `EE: ${tierMix.employeeOnly || 0}, ` +
    `ES: ${tierMix.employeeSpouse || 0}, ` +
    `EC: ${tierMix.employeeChildren || 0}, ` +
    `Family: ${tierMix.family || 0}`;

  const row = [
    new Date(),
    payload.firstName || '',
    payload.email || '',
    payload.phone || '',
    answers.state || '',
    answers.employees || '',
    answers.enrolling || '',
    answers.priority || '',
    answers.coverage || '',
    answers.timeline || '',
    contribution.model || '',
    contribution.percent || '',
    contribution.flatDollar || '',
    enrollmentMixText,
    selectedPlanText,
    JSON.stringify(payload)
  ];

  sheet.appendRow(row);

  const subject = `New Quote Tool Lead: ${answers.state || 'State?'} | ${answers.employees || '?'} Eligible | ${answers.enrolling || '?'} Enrolling`;

  const body =
`New DK Benefits Quote Tool Lead

Name: ${payload.firstName || ''}
Email: ${payload.email || ''}
Phone: ${payload.phone || ''}

State: ${answers.state || ''}
Eligible Employees: ${answers.employees || ''}
Expected Enrolling: ${answers.enrolling || ''}
Priority: ${answers.priority || ''}
Current Coverage: ${answers.coverage || ''}
Timeline: ${answers.timeline || ''}

Contribution:
Model: ${contribution.model || ''}
Percent: ${contribution.percent || ''}
Flat Dollar: ${contribution.flatDollar || ''}
Enrollment Mix:
${enrollmentMixText}

Selected Plans:
${selectedPlans.length ? selectedPlans.map(p => `- ${p.name || ''} (${p.network || ''})`).join('\n') : 'None selected'}

Google Sheet:
${SpreadsheetApp.getActiveSpreadsheet().getUrl()}
`;

  MailApp.sendEmail(NOTIFY_EMAIL, subject, body);
}

function sendLeadError_(err) {
  MailApp.sendEmail(
    NOTIFY_EMAIL,
    'Quote Tool Lead Error',
    String(err)
  );

  return jsonResponse_({ ok: false, error: String(err) });
}

function handleActivityEvent_(payload) {
  let sheet = null;
  let rowNumber = null;
  try {
    return withLock_(function () {
      if (!isValidSessionId_(payload.sessionId)) {
        return jsonResponse_({ ok: false, error: 'invalid session id' });
      }

      sheet = ensureEventsSheet_();
      const existing = findEvent_(sheet, payload.sessionId, payload.event);
      if (existing && (payload.event !== 'rates_displayed' || existing.emailResult === 'sent')) {
        return jsonResponse_({ ok: true, recorded: true, duplicate: true, emailed: false });
      }

      if (!existing) {
        const attempted = payload.event === 'rates_displayed' ? 'yes' : 'no';
        const result = payload.event === 'rates_displayed' ? 'pending' : 'not_requested';
        rowNumber = appendEventRow_(sheet, payload, attempted, result);
        if (typeof SpreadsheetApp.flush === 'function') SpreadsheetApp.flush();
      } else {
        rowNumber = existing.rowNumber;
      }

      if (payload.event !== 'rates_displayed') {
        return jsonResponse_({ ok: true, recorded: true, emailed: false });
      }

      const values = sheet.getRange(rowNumber, 1, 1, EVENT_HEADERS.length).getValues()[0];
      MailApp.sendEmail(NOTIFY_EMAIL, ANONYMOUS_ACTIVITY_SUBJECT, buildActivityBody_(values));
      updateEmailResult_(sheet, rowNumber, 'yes', 'sent');
      if (typeof SpreadsheetApp.flush === 'function') SpreadsheetApp.flush();
      return jsonResponse_({ ok: true, recorded: true, emailed: true });
    });
  } catch (err) {
    try {
      if (sheet && rowNumber) updateEmailResult_(sheet, rowNumber, 'yes', 'failed');
    } catch (ignore) {}
    return jsonResponse_({ ok: false, recorded: !!rowNumber, error: String(err) });
  }
}

function recordLeadEvent_(payload) {
  if (!isValidSessionId_(payload.sessionId)) return null;
  return withLock_(function () {
    const sheet = ensureEventsSheet_();
    const rowNumber = appendEventRow_(sheet, payload, 'yes', 'pending');
    if (typeof SpreadsheetApp.flush === 'function') SpreadsheetApp.flush();
    return rowNumber;
  });
}

function ensureEventsSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(EVENTS_SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(EVENTS_SHEET_NAME);
  }
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(EVENT_HEADERS);
    if (typeof sheet.setFrozenRows === 'function') sheet.setFrozenRows(1);
  }
  return sheet;
}

function appendEventRow_(sheet, payload, emailAttempted, emailResult) {
  sheet.appendRow([
    new Date().toISOString(),
    payload.event,
    payload.sessionId,
    sanitizeUtm_(payload.utm_source),
    sanitizeUtm_(payload.utm_medium),
    sanitizeUtm_(payload.utm_campaign),
    sanitizeUtm_(payload.utm_term),
    sanitizeUtm_(payload.utm_content),
    emailAttempted,
    emailResult
  ]);
  return sheet.getLastRow();
}

function updateEmailResult_(sheet, rowNumber, emailAttempted, emailResult) {
  sheet.getRange(rowNumber, 9, 1, 2).setValues([[emailAttempted, emailResult]]);
}

function findEvent_(sheet, sessionId, eventName) {
  const last = sheet.getLastRow();
  if (last < 2) return null;
  const values = sheet.getRange(2, 1, last - 1, EVENT_HEADERS.length).getValues();
  for (let i = 0; i < values.length; i++) {
    if (String(values[i][2]) === String(sessionId) && String(values[i][1]) === eventName) {
      return {
        rowNumber: i + 2,
        emailResult: String(values[i][9] || ''),
        values: values[i]
      };
    }
  }
  return null;
}

function buildActivityBody_(values) {
  function cell(index, emptyLabel) {
    const value = values[index];
    return value ? String(value) : emptyLabel;
  }
  return [
    'Anonymous quote activity',
    '',
    'Timestamp: ' + cell(0, ''),
    'Quote session ID: ' + cell(2, ''),
    'utm_source: ' + cell(3, '(none)'),
    'utm_medium: ' + cell(4, '(none)'),
    'utm_campaign: ' + cell(5, '(none)'),
    'utm_term: ' + cell(6, '(none)'),
    'utm_content: ' + cell(7, '(none)')
  ].join('\n');
}

function sanitizeUtm_(value) {
  if (value == null) return '';
  const text = String(value)
    .replace(/[\r\n\t]/g, ' ')
    .replace(/new\s+quote\s+tool\s+lead/ig, '')
    .replace(/quote\s+tool\s+lead\s+error/ig, '')
    .replace(/new\s+lead/ig, '')
    .trim();
  if (!text || text.indexOf('@') !== -1) return '';
  return text.slice(0, 120);
}

function isValidSessionId_(value) {
  return typeof value === 'string' && SESSION_ID_PATTERN.test(value);
}

function withLock_(fn) {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    return fn();
  } finally {
    lock.releaseLock();
  }
}

function jsonResponse_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
