const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const SCRIPT = path.join(__dirname, '../apps-script/QuoteLeads.gs');
const SESSION = '11111111-1111-4111-8111-111111111111';
const OTHER = '22222222-2222-4222-8222-222222222222';
const PAGE = 'https://dkbenefits.net/quote-tool.html';

function sheet() {
  const rows = [];
  return {
    _rows: rows,
    appendRow(row) { rows.push(row.slice()); },
    getLastRow() { return rows.length; },
    getDataRange() {
      return { getValues() { return rows.map((row) => row.slice()); } };
    },
    getRange(row, column, numRows, numColumns) {
      return {
        setValues(matrix) {
          for (let r = 0; r < matrix.length; r += 1) {
            if (!rows[row - 1 + r]) rows[row - 1 + r] = [];
            for (let c = 0; c < matrix[r].length; c += 1) rows[row - 1 + r][column - 1 + c] = matrix[r][c];
          }
        },
        getValues() {
          const out = [];
          for (let r = 0; r < numRows; r += 1) {
            const source = rows[row - 1 + r] || [];
            const line = [];
            for (let c = 0; c < numColumns; c += 1) line.push(source[column - 1 + c] == null ? '' : source[column - 1 + c]);
            out.push(line);
          }
          return out;
        }
      };
    },
    setFrozenRows() {},
    getName() { return 'Quote Leads'; }
  };
}

function world() {
  const sheets = {};
  const mail = [];
  const gmail = [];
  const triggers = [];
  const api = {
    QL_TEST_NOW: null,
    mail,
    gmail,
    triggers,
    sheets,
    SpreadsheetApp: {
      getActiveSpreadsheet() {
        return {
          getSheetByName(name) { return sheets[name] || null; },
          insertSheet(name) {
            sheets[name] = sheet();
            return sheets[name];
          },
          getUrl() { return 'https://docs.google.com/spreadsheets/d/quote-leads'; }
        };
      }
    },
    MailApp: {
      sendEmail(to, subject, body) {
        if (api.failMail) throw new Error('smtp down');
        mail.push({ to, subject, body });
      }
    },
    GmailApp: {
      sendEmail(to, subject, body, options) {
        if (api.failGmail) throw new Error('gmail down');
        gmail.push({ to, subject, body, options: options || null });
      }
    },
    Session: {
      getActiveUser() {
        return { getEmail() { return 'dan@dkbenefits.net'; } };
      }
    },
    LockService: {
      getScriptLock() {
        return { waitLock() {}, releaseLock() {} };
      }
    },
    ScriptApp: {
      getProjectTriggers() {
        return triggers.map((name) => ({ getHandlerFunction() { return name; } }));
      },
      newTrigger(name) {
        return {
          timeBased() {
            return {
              everyMinutes() {
                return { create() { triggers.push(name); } };
              }
            };
          }
        };
      }
    },
    ContentService: {
      MimeType: { JSON: 'application/json' },
      createTextOutput(text) {
        const output = {
          setMimeType() { return output; },
          getContent() { return text; }
        };
        return output;
      }
    }
  };
  vm.createContext(api);
  vm.runInContext(fs.readFileSync(SCRIPT, 'utf8'), api, { filename: 'QuoteLeads.gs' });
  return api;
}

function post(api, payload) {
  const output = api.doPost({ postData: { contents: JSON.stringify(payload) } });
  return JSON.parse(output.getContent());
}

function rows(api) {
  const tab = api.sheets['Quote Leads'];
  if (!tab) return [];
  const header = tab._rows[0];
  return tab._rows.slice(1).map((row) => {
    const record = {};
    header.forEach((key, index) => { record[key] = row[index] == null ? '' : row[index]; });
    return record;
  });
}

function eventPayload(eventName, extra) {
  return Object.assign({
    event: eventName,
    sessionId: SESSION,
    pageUrl: PAGE,
    referrer: 'https://www.google.com/',
    firstName: '',
    email: '',
    phone: '',
    answers: { state: '', employees: '', enrolling: '' },
    contribution: {},
    selectedPlans: []
  }, extra || {});
}

const FOLLOW_UP = [
  'Hi Pat,',
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

test('one session stays on one row, blanks do not wipe filled values, and status only moves forward', () => {
  const api = world();
  const seen = '2026-07-15T18:00:00.000Z';
  let result = api.qlApplyEvent(null, eventPayload('quote_accessed', { firstName: 'Quote page accessed' }), seen);
  assert.equal(result.emails.length, 1);
  assert.equal(result.emails[0].kind, 'page');
  assert.equal(result.row.Status, 'Page accessed');
  assert.equal(result.row.Name || '', '');
  assert.equal(result.row['First seen'], seen);
  assert.match(result.row['Features used'], /Opened the quote tool/);

  result = api.qlApplyEvent(result.row, eventPayload('contribution_identified', {
    firstName: 'Contribution identified',
    contribution: { model: 'percent', employerPercent: 50, dependentPercent: 0, payPeriods: '26' }
  }), '2026-07-15T18:05:00.000Z');
  assert.equal(result.emails.length, 0);
  assert.equal(result.row.Status, 'Engaged');
  assert.equal(result.row['Pay cycle'], 'Bi-weekly');
  assert.match(result.row['Contribution settings'], /50% of employee-only/);
  assert.match(result.row['Features used'], /Opened the quote tool/);
  assert.match(result.row['Features used'], /Set a contribution/);

  result = api.qlApplyEvent(result.row, eventPayload('group_size', {
    firstName: 'Group size',
    answers: { employees: '12', enrolling: '' }
  }), '2026-07-15T18:06:00.000Z');
  assert.equal(result.emails.length, 1);
  assert.equal(result.emails[0].subject, 'Quote tool: group size entered');
  assert.match(result.emails[0].body, /Eligible employees: 12/);
  assert.doesNotMatch(result.emails[0].body, /Expected enrolling/);
  assert.equal(result.row.Status, 'Group size entered');

  result = api.qlApplyEvent(result.row, eventPayload('group_size', {
    answers: { employees: '', enrolling: '7' },
    selectedPlans: [{ name: 'Cigna EPO 1000', network: 'Utilizes Cigna network' }]
  }), '2026-07-15T18:07:00.000Z');
  assert.equal(result.emails.length, 0);
  assert.equal(result.row['Eligible count'], '12');
  assert.equal(result.row['Expected enrolling'], '7');
  assert.match(result.row['Carriers/plans viewed or saved'], /Cigna EPO 1000/);
  assert.equal(result.row['First seen'], seen);

  result = api.qlApplyEvent(result.row, eventPayload('rates_displayed', {
    answers: { employees: '20' },
    carrier: 'Cigna'
  }), '2026-07-15T18:08:00.000Z');
  assert.equal(result.emails.length, 0);
  assert.equal(result.row['Eligible count'], '20');
  assert.match(result.row['Carriers/plans viewed or saved'], /Viewed carrier: Cigna/);
  assert.match(result.row['Carriers/plans viewed or saved'], /Cigna EPO 1000/);
  assert.equal(result.row.Status, 'Group size entered');

  result = api.qlApplyEvent(result.row, eventPayload('lead_submitted', {
    firstName: 'Pat Smith',
    email: 'pat@example.com',
    phone: '407-555-0100',
    helpWith: 'Get a full-market review',
    answers: { state: 'Georgia', employees: '20', enrolling: '7' }
  }), '2026-07-15T18:20:00.000Z');
  assert.equal(result.emails.length, 1);
  assert.equal(result.emails[0].kind, 'contact');
  assert.equal(result.row.Status, 'Contact submitted');
  assert.equal(result.row.Name, 'Pat Smith');
  assert.equal(result.row.Email, 'pat@example.com');
  assert.equal(result.row['Group size'], '20');
  assert.equal(result.row.Message, 'Get a full-market review');
  assert.equal(result.row['Follow-up status'], 'pending');
  ['Name:', 'Email:', 'Phone:', 'State:', 'Group size:', 'Eligible employees:', 'Expected enrolling:', 'Pay cycle:', 'Contribution:', 'Plans:', 'Features:', 'Message:', 'Page:', 'Referrer:', 'Session ID:'].forEach((label) => {
    assert.match(result.emails[0].body, new RegExp(label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  });
  assert.match(result.emails[0].body, /Pat Smith/);
  assert.match(result.emails[0].body, /Georgia/);
  assert.match(result.emails[0].body, /Get a full-market review/);

  const late = api.qlApplyEvent(result.row, eventPayload('quote_accessed', {
    firstName: 'Quote page accessed',
    email: '',
    answers: { employees: '', state: '' }
  }), '2026-07-15T18:30:00.000Z');
  assert.equal(late.emails.length, 0);
  assert.equal(late.row.Status, 'Contact submitted');
  assert.equal(late.row.Name, 'Pat Smith');
  assert.equal(late.row.Email, 'pat@example.com');
  assert.equal(late.row['Eligible count'], '20');
  assert.equal(late.row.Notifications.split(',').length, 3);
});

test('a session emails Dan at most three times', () => {
  const api = world();
  api.QL_TEST_NOW = Date.parse('2026-07-15T18:00:00.000Z');
  assert.deepEqual(post(api, eventPayload('quote_accessed', { firstName: 'Quote page accessed' })).emailed, ['page']);
  api.QL_TEST_NOW += 1000;
  assert.deepEqual(post(api, eventPayload('quote_accessed')).emailed, []);
  api.QL_TEST_NOW += 1000;
  assert.deepEqual(post(api, eventPayload('contribution_identified', {
    contribution: { model: 'flat', flatDollar: 400, payPeriods: '26' }
  })).emailed, []);
  api.QL_TEST_NOW += 1000;
  assert.deepEqual(post(api, eventPayload('rates_displayed')).emailed, []);
  api.QL_TEST_NOW += 1000;
  assert.deepEqual(post(api, eventPayload('quote_started')).emailed, []);
  api.QL_TEST_NOW += 1000;
  const group = post(api, eventPayload('group_size', { answers: { employees: '10', enrolling: '4' } }));
  assert.deepEqual(group.emailed, ['group']);
  api.QL_TEST_NOW += 1000;
  assert.deepEqual(post(api, eventPayload('group_size', { answers: { employees: '10', enrolling: '4' } })).emailed, []);
  api.QL_TEST_NOW += 1000;
  const lead = post(api, eventPayload('lead_submitted', {
    firstName: 'Pat Smith',
    email: 'pat@example.com',
    phone: '407-555-0100',
    helpWith: 'Get a full-market review',
    answers: { state: 'Florida', employees: '10', enrolling: '4' }
  }));
  assert.deepEqual(lead.emailed, ['contact']);
  api.QL_TEST_NOW += 1000;
  assert.deepEqual(post(api, eventPayload('lead_submitted', {
    firstName: 'Pat Smith',
    email: 'pat@example.com'
  })).emailed, []);
  assert.equal(api.mail.length, 3);
  assert.deepEqual(api.mail.map((message) => message.subject), [
    'Quote tool: page accessed',
    'Quote tool: group size entered',
    'Quote tool: contact submitted'
  ]);
  assert.equal(rows(api).length, 1);
  assert.equal(rows(api)[0]['Session ID'], SESSION);
  assert.equal(rows(api)[0].Status, 'Contact submitted');
});

test('a failed Dan email is not replaced with an error email and can be retried', () => {
  const api = world();
  api.failMail = true;
  const first = post(api, eventPayload('quote_accessed', { firstName: 'Quote page accessed' }));
  assert.deepEqual(first.emailed, []);
  assert.equal(api.mail.length, 0);
  assert.equal(rows(api)[0].Notifications, '');
  api.failMail = false;
  const second = post(api, eventPayload('quote_accessed'));
  assert.deepEqual(second.emailed, ['page']);
  assert.equal(api.mail.length, 1);
  assert.equal(api.mail[0].to, 'dan@dkbenefits.net');
});

test('bad posts do not email', () => {
  const api = world();
  assert.equal(post(api, { event: 'quote_accessed' }).ok, false);
  assert.equal(api.doPost({ postData: { contents: '{' } }).getContent().includes('"ok":false'), true);
  assert.equal(api.mail.length, 0);
  assert.equal(rows(api).length, 0);
});

test('setup creates the header row and one 5-minute trigger', () => {
  const api = world();
  assert.match(api.setup(), /Quote leads ready/);
  assert.match(api.setup(), /Quote leads ready/);
  assert.deepEqual(api.triggers, ['qlSendDueFollowUps']);
  assert.deepEqual(api.sheets['Quote Leads']._rows[0], api.QL_HEADERS);
});

test('follow-up waits 10 minutes, stays inside 7am to 7pm Eastern, and treats weekends the same', () => {
  const api = world();
  const wednesday = Date.parse('2026-07-15T18:00:00.000Z');
  assert.equal(api.qlInBusinessHours(wednesday), true);
  assert.equal(api.qlFollowUpDecision(wednesday, wednesday + 9 * 60 * 1000).action, 'wait');
  assert.equal(api.qlFollowUpDecision(wednesday, wednesday + 11 * 60 * 1000).action, 'send');

  const sevenAm = Date.parse('2026-01-15T12:00:00.000Z');
  const beforeSeven = Date.parse('2026-01-15T11:59:00.000Z');
  const sixFiftyNinePm = Date.parse('2026-07-15T22:59:00.000Z');
  const sevenPm = Date.parse('2026-07-15T23:00:00.000Z');
  assert.equal(api.qlInBusinessHours(sevenAm), true);
  assert.equal(api.qlInBusinessHours(beforeSeven), false);
  assert.equal(api.qlInBusinessHours(sixFiftyNinePm), true);
  assert.equal(api.qlInBusinessHours(sevenPm), false);
  assert.equal(api.qlNextOpen(beforeSeven), sevenAm);
  assert.equal(api.qlNextOpen(sevenPm), Date.parse('2026-07-16T11:00:00.000Z'));

  const saturday = Date.parse('2026-07-18T14:00:00.000Z');
  const saturdayNight = Date.parse('2026-01-17T00:30:00.000Z');
  assert.equal(new Date(saturday).getUTCDay(), 6);
  assert.equal(api.qlInBusinessHours(saturday), true);
  assert.equal(api.qlFollowUpDecision(saturday, saturday + 11 * 60 * 1000).action, 'send');
  assert.equal(api.qlInBusinessHours(saturdayNight), false);
  assert.equal(api.qlNextOpen(saturdayNight), Date.parse('2026-01-17T12:00:00.000Z'));
  const sundayMorning = Date.parse('2026-07-19T15:00:00.000Z');
  assert.equal(new Date(sundayMorning).getUTCDay(), 0);
  assert.equal(api.qlInBusinessHours(sundayMorning), true);

  const dueAfterClose = Date.parse('2026-07-15T22:55:00.000Z');
  const after = api.qlFollowUpDecision(dueAfterClose, dueAfterClose + 11 * 60 * 1000);
  assert.equal(after.action, 'wait');
  assert.equal(after.reason, 'after hours');
  assert.equal(after.nextAt, Date.parse('2026-07-16T11:00:00.000Z'));
});

test('Eastern scheduling follows daylight saving time', () => {
  const api = world();
  assert.equal(api.qlInBusinessHours(Date.parse('2026-07-15T19:00:00.000Z')), true);
  assert.equal(api.qlInBusinessHours(Date.parse('2026-01-15T20:00:00.000Z')), true);
  const springNight = Date.parse('2026-03-08T01:00:00.000Z');
  assert.equal(api.qlInBusinessHours(springNight), false);
  assert.equal(api.qlNextOpen(springNight), Date.parse('2026-03-08T11:00:00.000Z'));
  assert.equal(api.qlInBusinessHours(Date.parse('2026-03-08T11:00:00.000Z')), true);
  const fallNight = Date.parse('2026-11-01T00:00:00.000Z');
  assert.equal(api.qlInBusinessHours(fallNight), false);
  assert.equal(api.qlNextOpen(fallNight), Date.parse('2026-11-01T12:00:00.000Z'));
  assert.equal(api.qlInBusinessHours(Date.parse('2026-11-01T12:00:00.000Z')), true);
});

test('the prospect note is plain text, once per email, and test rows retry inside the same hours', () => {
  const api = world();
  api.QL_TEST_NOW = Date.parse('2026-07-15T18:00:00.000Z');
  post(api, eventPayload('lead_submitted', {
    firstName: 'Pat Smith',
    email: 'pat@example.com',
    phone: '407-555-0100',
    helpWith: 'Get a full-market review',
    answers: { state: 'Georgia', employees: '8' }
  }));
  api.qlSendDueFollowUps();
  assert.equal(api.gmail.length, 0);
  api.QL_TEST_NOW += 11 * 60 * 1000;
  api.qlSendDueFollowUps();
  assert.equal(api.gmail.length, 1);
  assert.equal(api.gmail[0].to, 'pat@example.com');
  assert.equal(api.gmail[0].subject, 'Saw you checking out rates');
  assert.equal(api.gmail[0].body, FOLLOW_UP);
  assert.equal(api.gmail[0].options.htmlBody, undefined);
  assert.equal(api.gmail[0].options.name, 'Daniel Kirves');
  assert.equal(api.gmail[0].options.replyTo, 'dan@dkbenefits.net');
  assert.doesNotMatch(api.gmail[0].body, /unsubscribe|<html|<!DOCTYPE/i);
  assert.equal(rows(api)[0]['Follow-up status'], 'sent');
  assert.ok(rows(api)[0]['Follow-up sent at']);

  post(api, eventPayload('lead_submitted', {
    sessionId: OTHER,
    firstName: 'Pat Smith',
    email: 'Pat@Example.com',
    answers: { employees: '8' }
  }));
  api.QL_TEST_NOW += 11 * 60 * 1000;
  api.qlSendDueFollowUps();
  assert.equal(api.gmail.length, 1);
  assert.equal(rows(api)[1]['Follow-up status'], 'skipped');

  const testSession = '33333333-3333-4333-8333-333333333333';
  post(api, eventPayload('lead_submitted', {
    sessionId: testSession,
    firstName: 'Pat [TEST]',
    email: 'pat@example.com',
    answers: { employees: '8' }
  }));
  api.QL_TEST_NOW += 11 * 60 * 1000;
  api.qlSendDueFollowUps();
  assert.equal(api.gmail.length, 2);
  assert.equal(api.gmail[1].body.startsWith('Hi Pat,'), true);
  assert.equal(rows(api)[2]['Follow-up status'], 'sent');

  const blank = api.qlFollowUpMessage('', 'ada@example.com');
  assert.equal(blank.body.startsWith('Hi there,'), true);
  assert.equal(blank.subject, 'Saw you checking out rates');

  api.gmail.length = 0;
  api.QL_TEST_NOW = Date.parse('2026-07-15T23:30:00.000Z');
  const nightSession = '44444444-4444-4444-8444-444444444444';
  post(api, eventPayload('lead_submitted', {
    sessionId: nightSession,
    firstName: 'Night [TEST]',
    email: 'night@example.com',
    answers: { employees: '3' }
  }));
  api.sheets['Quote Leads']._rows[4][api.QL_HEADERS.indexOf('Contact submitted at')] = '2026-07-15T22:00:00.000Z';
  api.qlSendDueFollowUps();
  assert.equal(api.gmail.length, 0);
  assert.equal(rows(api)[3]['Follow-up status'], 'pending');

  api.failGmail = true;
  api.QL_TEST_NOW = Date.parse('2026-07-16T15:00:00.000Z');
  api.qlSendDueFollowUps();
  assert.equal(rows(api)[3]['Follow-up status'], 'failed');
  api.failGmail = false;
  api.qlSendDueFollowUps();
  assert.equal(api.gmail.length, 1);
  assert.equal(rows(api)[3]['Follow-up status'], 'sent');
  assert.equal(api.gmail[0].body.startsWith('Hi Night,'), true);
});

test('the live pages share one endpoint setting and still point at the current web app', () => {
  const activity = require('../quote-activity.js');
  const ratesSource = fs.readFileSync(path.join(__dirname, '../rates-first/rates-first.js'), 'utf8');
  const livePage = fs.readFileSync(path.join(__dirname, '../quote-tool.html'), 'utf8');
  const demoPage = fs.readFileSync(path.join(__dirname, '../rates-first/index.html'), 'utf8');
  assert.equal(activity.WEBHOOK_URL, 'https://script.google.com/macros/s/AKfycbweIqu-mNXn_JEH4gYffTNU2zkcAyOQIWlC2QE__JLunaOaKy4m72SJO27JPDch5WZI/exec');
  assert.equal(ratesSource.includes('lcSq0CZ0z'), false);
  assert.match(ratesSource, /QuoteActivity\.WEBHOOK_URL/);
  assert.match(ratesSource, /GROUP_SETTLE_MS = 20000/);
  assert.match(livePage, /src="quote-activity\.js"/);
  assert.match(demoPage, /src="\.\.\/quote-activity\.js"/);
});
