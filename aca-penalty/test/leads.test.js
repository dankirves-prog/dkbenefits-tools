const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');
const ACA = require('../aca-model');
const Leads = require('../aca-leads');

const SCRIPT = path.join(__dirname, '../apps-script/Code.gs');
const SESSION = '11111111-1111-4111-8111-111111111111';
const OTHER = '22222222-2222-4222-8222-222222222222';

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
        }
      };
    },
    setFrozenRows() {},
    getName() { return 'DK ACA Leads'; }
  };
}

function world() {
  const sheets = {};
  const mail = [];
  const gmail = [];
  const triggers = [];
  let held = false;
  let locks = 0;
  const api = {
    ACA_TEST_NOW: null,
    mail,
    gmail,
    triggers,
    locks: () => locks,
    _sheets: sheets,
    SpreadsheetApp: {
      getActiveSpreadsheet() {
        return {
          getSheetByName(name) { return sheets[name] || null; },
          insertSheet(name) {
            sheets[name] = sheet();
            return sheets[name];
          }
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
        gmail.push({ to, subject, body, options: options || null });
      }
    },
    LockService: {
      getScriptLock() {
        return {
          waitLock() {
            if (held) throw new Error('lock overlap');
            held = true;
            locks += 1;
          },
          releaseLock() { held = false; }
        };
      }
    },
    ScriptApp: {
      getProjectTriggers() {
        return triggers.map((name) => ({ getHandlerFunction() { return name; } }));
      },
      newTrigger(name) {
        return { timeBased() { return { everyMinutes() { return { create() { triggers.push(name); } }; } }; } };
      }
    },
    ContentService: {
      MimeType: { JSON: 'application/json', TEXT: 'text/plain' },
      createTextOutput(text) {
        const output = { setMimeType() { return output; }, getContent() { return text; } };
        return output;
      }
    }
  };
  const original = api.SpreadsheetApp.getActiveSpreadsheet;
  api.SpreadsheetApp.getActiveSpreadsheet = function () {
    const ss = original();
    const rawName = ss.getSheetByName;
    ss.getSheetByName = function (name) {
      if (!held) throw new Error('sheet read outside lock');
      return rawName.call(ss, name);
    };
    return ss;
  };
  vm.createContext(api);
  vm.runInContext(fs.readFileSync(SCRIPT, 'utf8'), api, { filename: 'Code.gs' });
  return api;
}

function post(api, payload) {
  const output = api.doPost({ postData: { contents: JSON.stringify(payload) } });
  return JSON.parse(output.getContent());
}

function resultFor(extra) {
  const all = [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1];
  return ACA.calculate(Object.assign({
    year: 2026,
    averageFullTime: 120,
    averagePartTimeHours: 0,
    fullTime: 120,
    offer: 'below',
    anyCredit: true,
    ptcCount: 1,
    months: all
  }, extra || {}));
}

function calcPayload(result, sessionId) {
  return Leads.buildPayload({
    event: 'calculation_run',
    sessionId: sessionId || SESSION,
    result: result,
    pageUrl: 'https://dankirves-prog.github.io/dkbenefits-tools/aca-penalty-calculator.html',
    startedAt: '2026-07-15T17:00:00.000Z',
    submittedAt: '2026-07-15T18:00:00.000Z',
    contact: { name: 'Should Not Appear', email: 'hidden@example.com', company: 'Hidden Co' }
  });
}

function leadPayload(result, sessionId) {
  return Leads.buildPayload({
    event: 'lead_submitted',
    sessionId: sessionId || SESSION,
    result: result,
    pageUrl: 'https://dankirves-prog.github.io/dkbenefits-tools/aca-penalty-calculator.html',
    startedAt: '2026-07-15T17:00:00.000Z',
    submittedAt: '2026-07-15T18:00:00.000Z',
    contact: {
      name: 'Pat Employer',
      company: 'Harbor Grill',
      email: 'pat@harborgrill.example',
      phone: '407-555-0100',
      employees: '120',
      consent: true
    }
  });
}

test('config leaves the endpoint blank and the page does not link from live tools', function () {
  const config = fs.readFileSync(path.join(__dirname, '../config.js'), 'utf8');
  assert.match(config, /endpoint:\s*''/);
  const root = path.join(__dirname, '../..');
  const files = ['rbp-decision-tool.html', 'section125.html', 'compliance-assessment.html', 'knowledge-base.html', 'qualifying-event/index.html', 'section128/index.html', 'wrapplan/index.html'];
  files.forEach(function (file) {
    const text = fs.readFileSync(path.join(root, file), 'utf8');
    assert.equal(text.includes('aca-penalty-calculator'), false, file);
  });
});

test('one visitor gets one calculation email, one lead email, and one check-in', function () {
  const api = world();
  api.ACA_TEST_NOW = Date.parse('2026-07-15T18:00:00.000Z');
  const result = resultFor();
  const first = post(api, calcPayload(result));
  assert.equal(first.ok, true);
  assert.deepEqual(first.emailed, ['calc']);
  assert.equal(api.mail.length, 1);
  assert.equal(api.mail[0].to, 'dan@dkbenefits.net');
  assert.equal(api.mail[0].subject, 'ACA calculation run');
  assert.match(api.mail[0].body, /No contact information/);
  assert.match(api.mail[0].body, /\$300,600/);
  assert.match(api.mail[0].body, /\$25,050/);
  assert.match(api.mail[0].body, /January through December/);
  assert.doesNotMatch(api.mail[0].body, /Pat Employer|Should Not Appear|hidden@example|\{/);

  const again = post(api, Object.assign(calcPayload(resultFor({ fullTime: 100, averageFullTime: 100 })), { event: 'calculation_run' }));
  assert.deepEqual(again.emailed, []);
  assert.equal(again.alreadyNotified, true);
  assert.equal(api.mail.length, 1);

  const updated = post(api, Object.assign(calcPayload(result), { event: 'calculation_update' }));
  assert.deepEqual(updated.emailed, []);
  assert.equal(api.mail.length, 1);

  const lead = post(api, leadPayload(result));
  assert.equal(lead.ok, true);
  assert.deepEqual(lead.emailed, ['lead']);
  assert.equal(api.mail.length, 2);
  assert.match(api.mail[1].subject, /ACA compliance review request: Harbor Grill/);
  assert.match(api.mail[1].body, /Pat Employer/);
  assert.match(api.mail[1].body, /Harbor Grill/);
  assert.match(api.mail[1].body, /pat@harborgrill\.example/);
  assert.match(api.mail[1].body, /407-555-0100/);
  assert.match(api.mail[1].body, /\$300,600/);
  assert.match(api.mail[1].body, /Likely an applicable large employer/);
  assert.doesNotMatch(api.mail[1].body, /^\{/m);

  const resubmit = post(api, leadPayload(result));
  assert.deepEqual(resubmit.emailed, []);
  assert.equal(api.mail.length, 2);

  const tab = api._sheets['DK ACA Leads']._rows;
  assert.equal(tab.length, 2);
  assert.equal(tab[1][0], SESSION);
  assert.equal(String(tab[1].join('\n')).split(SESSION).length - 1, 1);

  api.ACA_TEST_NOW += 9 * 60 * 1000;
  api.acaSendDueFollowUps();
  assert.equal(api.gmail.length, 0);

  api.ACA_TEST_NOW += 3 * 60 * 1000;
  api.acaSendDueFollowUps();
  assert.equal(api.gmail.length, 1);
  assert.equal(api.gmail[0].to, 'pat@harborgrill.example');
  assert.equal(api.gmail[0].subject, 'Your ACA estimate');
  assert.match(api.gmail[0].body, /Hi Pat,/);
  assert.match(api.gmail[0].body, /\$300,600/);
  assert.match(api.gmail[0].body, /407-476-5076/);
  assert.doesNotMatch(api.gmail[0].body, /dan@dkbenefits\.net/);
  assert.equal(api.gmail[0].options.replyTo, 'dan@dkbenefits.net');
  api.acaSendDueFollowUps();
  assert.equal(api.gmail.length, 1);
  assert.ok(api.locks() >= 4);
});

test('a different visitor is a new row, and a fast or honeypot lead sends nothing', function () {
  const api = world();
  api.ACA_TEST_NOW = Date.parse('2026-07-15T18:00:00.000Z');
  post(api, calcPayload(resultFor(), SESSION));
  post(api, calcPayload(resultFor({ averageFullTime: 80, fullTime: 80, offer: 'unaffordable', ptcCount: 6 }), OTHER));
  const rows = api._sheets['DK ACA Leads']._rows;
  assert.equal(rows.length, 3);
  assert.equal(api.mail.length, 2);
  assert.match(api.mail[1].body, /\$30,060/);

  const fast = post(api, Object.assign(leadPayload(resultFor(), OTHER), {
    startedAt: '2026-07-15T18:00:00.000Z',
    submittedAt: '2026-07-15T18:00:01.000Z'
  }));
  assert.equal(fast.ok, false);
  assert.equal(api.mail.length, 2);

  const honey = post(api, Object.assign(calcPayload(resultFor(), SESSION), { hp: 'https://spam.example' }));
  assert.equal(honey.ignored, true);
  assert.equal(api._sheets['DK ACA Leads']._rows.length, 3);
});

test('the check-in waits until Eastern business hours', function () {
  const api = world();
  api.ACA_TEST_NOW = Date.parse('2026-07-15T23:00:00.000Z');
  const lead = post(api, leadPayload(resultFor()));
  assert.equal(lead.ok, true);
  api.ACA_TEST_NOW = Date.parse('2026-07-15T23:30:00.000Z');
  api.acaSendDueFollowUps();
  assert.equal(api.gmail.length, 0);
  api.ACA_TEST_NOW = Date.parse('2026-07-16T15:00:00.000Z');
  api.acaSendDueFollowUps();
  assert.equal(api.gmail.length, 1);
});

test('the browser posts the calculation once per visit and skips a blank endpoint', async function () {
  const sent = [];
  const storage = Leads.memoryStorage();
  const tracker = Leads.createAcaTracker({
    storage: storage,
    endpoint: 'https://script.google.com/macros/s/example/exec',
    post: function (payload) {
      sent.push(payload.event);
      return Promise.resolve({ ok: true, emailed: payload.event === 'calculation_run' ? ['calc'] : [] });
    }
  });
  const result = resultFor();
  await tracker.onCalculated(result);
  await tracker.onCalculated(result);
  assert.deepEqual(sent, ['calculation_run', 'calculation_update']);
  assert.equal(storage.getItem(Leads.CALC_KEY), '1');

  const quiet = [];
  const blank = Leads.createAcaTracker({
    storage: Leads.memoryStorage(),
    endpoint: '',
    post: function () { quiet.push('posted'); return Promise.resolve({ ok: true }); }
  });
  const skipped = await blank.onCalculated(result);
  const skippedLead = await blank.onLead(result, { name: 'Pat', company: 'Co', email: 'pat@example.com', consent: true });
  assert.equal(skipped.reason, 'no_endpoint');
  assert.equal(skippedLead.reason, 'no_endpoint');
  assert.equal(quiet.length, 0);
  assert.equal(Leads.endpointOf(''), '');
  assert.equal(Leads.endpointOf('not a url'), '');
});

