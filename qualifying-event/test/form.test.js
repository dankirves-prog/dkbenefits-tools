const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const QE = require('../qe-model');
const Form = require('../qe-form');

const root = path.join(__dirname, '..');
const scriptPath = path.join(root, 'apps-script', 'Code.gs');

function fields(overrides) {
  return Object.assign({
    name: 'Ada Lovelace',
    email: 'ada@northwind.example',
    phone: '(407) 476-5076',
    company: 'Northwind Benefits',
    question: 'Can we add the spouse this month?'
  }, overrides || {});
}

function marriage() {
  return QE.scenario({
    event: 'marriage',
    benefits: ['medical'],
    answers: { change: 'add_family' },
    timing: 'within_30'
  });
}

function childLoss() {
  return QE.scenario({
    event: 'lost_coverage',
    benefits: ['medical'],
    answers: { who: 'child', reason: 'eligibility', change: 'enroll' },
    timing: 'within_30'
  });
}

function boot() {
  const context = { console: console };
  const sheets = {};
  function Sheet(name) {
    this.name = name;
    this.rows = [];
  }
  Sheet.prototype.appendRow = function (row) { this.rows.push(row.slice()); };
  Sheet.prototype.getLastRow = function () { return this.rows.length; };
  Sheet.prototype.getRange = function (r, c, numRows, numCols) {
    const sheet = this;
    return {
      setValues: function (matrix) {
        matrix.forEach(function (line, i) {
          if (!sheet.rows[r - 1 + i]) sheet.rows[r - 1 + i] = [];
          line.forEach(function (value, j) { sheet.rows[r - 1 + i][c - 1 + j] = value; });
        });
      },
      getValues: function () {
        const height = numRows || 1;
        const width = numCols || 1;
        const values = [];
        for (let i = 0; i < height; i++) {
          const source = sheet.rows[r - 1 + i] || [];
          const line = [];
          for (let j = 0; j < width; j++) line.push(source[c - 1 + j] == null ? '' : source[c - 1 + j]);
          values.push(line);
        }
        return values;
      }
    };
  };
  const sent = [];
  context.sent = sent;
  context.sheets = sheets;
  context.SpreadsheetApp = {
    getActiveSpreadsheet: function () {
      return {
        getSheetByName: function (name) { return sheets[name] || null; },
        insertSheet: function (name) {
          sheets[name] = new Sheet(name);
          return sheets[name];
        }
      };
    }
  };
  context.MailApp = {
    sendEmail: function (message) {
      if (context.failMail) throw new Error('mail down');
      sent.push(JSON.parse(JSON.stringify(message)));
    }
  };
  context.LockService = {
    getScriptLock: function () {
      return { waitLock: function () {}, releaseLock: function () {} };
    }
  };
  context.ContentService = {
    MimeType: { JSON: 'application/json', TEXT: 'text/plain' },
    createTextOutput: function (text) {
      return {
        setMimeType: function () { return this; },
        getContent: function () { return text; }
      };
    }
  };
  vm.createContext(context);
  vm.runInContext(fs.readFileSync(scriptPath, 'utf8'), context, { filename: 'Code.gs' });
  context.post = function (body) {
    return JSON.parse(context.doPost({ postData: { contents: JSON.stringify(body) } }).getContent());
  };
  return context;
}

test('the question form payload includes the scenario summary and the raw scenario', function () {
  const view = marriage();
  const lost = childLoss();
  const summary = Form.scenarioSummary(lost);
  assert.equal(summary, [
    'Event: ' + lost.event.label,
    'Who: A child',
    'Change: ' + lost.change.label,
    'Timing: ' + lost.timing.label,
    'Result: ' + lost.result.title
  ].join('\n'));
  assert.match(summary, /Event: Lost other health coverage/);
  assert.match(summary, /Result: /);

  const on = Form.buildPayload({
    fields: fields(),
    scenario: view,
    includeScenario: true,
    hp: '',
    company_website: '',
    startedAt: '2026-10-26T15:00:00.000Z',
    submittedAt: '2026-10-26T15:00:10.000Z',
    pageUrl: 'https://dankirves-prog.github.io/dkbenefits-tools/qualifying-event/'
  });
  assert.equal(on.event, 'qe_question');
  assert.equal(on.name, 'Ada Lovelace');
  assert.equal(on.email, 'ada@northwind.example');
  assert.equal(on.phone, '(407) 476-5076');
  assert.equal(on.company, 'Northwind Benefits');
  assert.equal(on.question, 'Can we add the spouse this month?');
  assert.equal(on.includeScenario, true);
  assert.equal(on.scenarioSummary, Form.scenarioSummary(view));
  assert.match(on.scenarioSummary, /Event: Marriage/);
  assert.match(on.scenarioSummary, /Who: Not specified/);
  assert.match(on.scenarioSummary, /Timing: Within 30 days/);
  assert.match(on.scenarioSummary, /Result: Generally allowed/);
  assert.equal(on.scenario, view);
  assert.equal(on.scenario.result.code, 'allowed');

  const off = Form.buildPayload({
    fields: fields({ phone: '', company: '' }),
    scenario: view,
    includeScenario: false,
    startedAt: '2026-10-26T15:00:00.000Z',
    submittedAt: '2026-10-26T15:00:10.000Z',
    pageUrl: 'https://example.test/tool'
  });
  assert.equal(off.includeScenario, false);
  assert.equal(off.scenarioSummary, '');
  assert.equal(off.scenario, null);
  assert.equal(off.phone, '');
  assert.equal(off.company, '');
  assert.equal(off.question, 'Can we add the spouse this month?');

  const none = Form.buildPayload({
    fields: fields(),
    scenario: null,
    includeScenario: true
  });
  assert.equal(none.includeScenario, false);
  assert.equal(none.scenario, null);
  assert.equal(none.scenarioSummary, '');
});

test('the question form rejects a missing question, a bad email, and a short phone', function () {
  assert.equal(Form.validate(fields({ name: '  ' })).ok, false);
  assert.equal(Form.validate(fields({ email: 'not-an-email' })).ok, false);
  assert.equal(Form.validate(fields({ question: '   ' })).ok, false);
  assert.equal(Form.validate(fields({ phone: '123' })).ok, false);
  const optional = Form.validate(fields({ phone: '', company: '' }));
  assert.equal(optional.ok, true);
  assert.equal(optional.fields.phone, '');
});

test('the page keeps one empty endpoint constant', function () {
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  assert.equal((html.match(/var QE_QUESTION_ENDPOINT = '';/g) || []).length, 1);
  assert.match(html, /qualifying-event\/apps-script\/SETUP\.md/);
  assert.match(html, /id="questionForm"/);
  assert.match(html, /src="qe-form\.js"/);
});

test('the script emails only Dan and does not reply to the visitor', function () {
  const script = fs.readFileSync(scriptPath, 'utf8');
  assert.equal((script.match(/MailApp\.sendEmail/g) || []).length, 1);
  assert.equal(script.indexOf('GmailApp'), -1);
  assert.equal(script.indexOf('followUp'), -1);
  assert.equal(script.indexOf('FollowUp'), -1);
  assert.match(script, /QE_NOTIFY_EMAIL = 'dan@dkbenefits\.net'/);
  assert.doesNotMatch(script, /to:\s*fields\.email/);
  const ctx = boot();
  assert.throws(function () {
    ctx.qeAssertRecipient_({ to: 'other@example.com', subject: 'x', body: 'y' });
  });
  assert.throws(function () {
    ctx.qeAssertRecipient_({ to: 'dan@dkbenefits.net', cc: 'ada@northwind.example', subject: 'x', body: 'y' });
  });
});

test('doGet confirms the qualifying event question service', function () {
  const ctx = boot();
  assert.match(ctx.doGet().getContent(), /DK Benefits qualifying event questions are deployed/);
});

test('setup creates the Questions headers once', function () {
  const ctx = boot();
  ctx.setup();
  ctx.setup();
  const sheet = ctx.sheets.Questions;
  assert.equal(sheet.rows.length, 1);
  assert.deepEqual(sheet.rows[0], ctx.QE_HEADERS);
});

test('a question with a scenario is stored and emailed only to Dan', function () {
  const ctx = boot();
  const view = marriage();
  const body = Form.buildPayload({
    fields: fields(),
    scenario: view,
    includeScenario: true,
    hp: '',
    company_website: '',
    startedAt: '2026-10-26T15:00:00.000Z',
    submittedAt: '2026-10-26T15:00:10.000Z',
    pageUrl: 'https://dankirves-prog.github.io/dkbenefits-tools/qualifying-event/'
  });
  const result = ctx.post(body);
  assert.deepEqual(result, { ok: true, emailed: true });
  assert.equal(ctx.sent.length, 1);
  assert.equal(ctx.sent[0].to, 'dan@dkbenefits.net');
  assert.equal(ctx.sent[0].replyTo, 'ada@northwind.example');
  assert.equal(ctx.sent[0].htmlBody, undefined);
  assert.equal(ctx.sent[0].cc, undefined);
  assert.match(ctx.sent[0].subject, /Qualifying event question from Ada Lovelace/);
  assert.match(ctx.sent[0].body, /Can we add the spouse this month\?/);
  assert.match(ctx.sent[0].body, /Event: Marriage/);
  assert.match(ctx.sent[0].body, /Result: Generally allowed/);
  const sheet = ctx.sheets.Questions;
  assert.equal(sheet.rows.length, 2);
  assert.deepEqual(sheet.rows[0], ctx.QE_HEADERS);
  const row = sheet.rows[1];
  assert.match(row[0], /^\d{4}-\d{2}-\d{2}T/);
  assert.equal(row[1], 'Ada Lovelace');
  assert.equal(row[2], 'ada@northwind.example');
  assert.equal(row[3], '(407) 476-5076');
  assert.equal(row[4], 'Northwind Benefits');
  assert.equal(row[5], 'Can we add the spouse this month?');
  assert.equal(row[6], Form.scenarioSummary(view));
  assert.deepEqual(JSON.parse(row[7]), JSON.parse(JSON.stringify(view)));
  assert.equal(row[8], 'https://dankirves-prog.github.io/dkbenefits-tools/qualifying-event/');
  assert.equal(row[9], 'yes');
});

test('a question with the scenario left off still sends, without the scenario', function () {
  const ctx = boot();
  const body = Form.buildPayload({
    fields: fields({ phone: '', company: '' }),
    scenario: marriage(),
    includeScenario: false,
    startedAt: '2026-10-26T15:00:00.000Z',
    submittedAt: '2026-10-26T15:05:00.000Z',
    pageUrl: 'https://example.test/tool'
  });
  const result = ctx.post(body);
  assert.equal(result.ok, true);
  assert.equal(result.emailed, true);
  assert.equal(ctx.sent.length, 1);
  assert.match(ctx.sent[0].body, /No scenario included\./);
  assert.equal(ctx.sent[0].body.indexOf('Event: Marriage'), -1);
  const row = ctx.sheets.Questions.rows[1];
  assert.equal(row[6], '');
  assert.equal(row[7], '');
  assert.equal(row[9], 'no');
});

test('honeypot, a fast submit, and a bad email do not write a row or send mail', function () {
  const ctx = boot();
  const base = Form.buildPayload({
    fields: fields(),
    scenario: null,
    includeScenario: false,
    startedAt: '2026-10-26T15:00:00.000Z',
    submittedAt: '2026-10-26T15:00:10.000Z',
    pageUrl: 'https://example.test/tool'
  });
  const honey = Object.assign({}, base, { company_website: 'https://spam.example' });
  assert.equal(ctx.post(honey).ok, false);
  const fast = Object.assign({}, base, { submittedAt: '2026-10-26T15:00:01.000Z' });
  assert.equal(ctx.post(fast).ok, false);
  const bad = Object.assign({}, base, { email: 'not-an-email' });
  const rejected = ctx.post(bad);
  assert.equal(rejected.ok, false);
  assert.equal(rejected.fields[0].field, 'email');
  assert.equal(ctx.sent.length, 0);
  assert.equal(ctx.sheets.Questions, undefined);
});

test('a mail failure does not tell the visitor the question was sent', function () {
  const ctx = boot();
  ctx.failMail = true;
  const body = Form.buildPayload({
    fields: fields({ question: '=HYPERLINK("https://evil.example","click")' }),
    scenario: null,
    includeScenario: false,
    startedAt: '2026-10-26T15:00:00.000Z',
    submittedAt: '2026-10-26T15:00:10.000Z',
    pageUrl: 'https://example.test/tool'
  });
  const result = ctx.post(body);
  assert.equal(result.ok, false);
  assert.equal(result.emailed, false);
  assert.equal(ctx.sent.length, 0);
  assert.match(ctx.sheets.Questions.rows[1][5], /^'=HYPERLINK/);
});
