const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { loadBrowserScripts, baseInput, ASOF } = require('./helpers');

function boot() {
  const context = loadBrowserScripts();
  const sheets = {};
  function Sheet(name) {
    this.name = name;
    this.rows = [];
  }
  Sheet.prototype.appendRow = function (row) { this.rows.push(row.slice()); };
  Sheet.prototype.getLastRow = function () { return this.rows.length; };
  Sheet.prototype.getDataRange = function () {
    const rows = this.rows;
    return { getValues: function () { return rows.map(function (row) { return row.slice(); }); } };
  };
  Sheet.prototype.getRange = function (r, c, numRows, numCols) {
    const sheet = this;
    return {
      setValue: function (value) {
        while (sheet.rows[r - 1].length < c) sheet.rows[r - 1].push('');
        sheet.rows[r - 1][c - 1] = value;
      },
      setValues: function (matrix) {
        matrix.forEach(function (line, i) {
          line.forEach(function (value, j) { sheet.rows[r - 1 + i][c - 1 + j] = value; });
        });
      }
    };
  };
  const cacheStore = {};
  const sent = [];
  context.sent = sent;
  context.sheets = sheets;
  context.SpreadsheetApp = {
    getActiveSpreadsheet: function () {
      return {
        getSheetByName: function (name) { return sheets[name] || null; },
        insertSheet: function (name) { sheets[name] = new Sheet(name); return sheets[name]; }
      };
    }
  };
  context.MailApp = {
    getRemainingDailyQuota: function () { return context.quota == null ? 50 : context.quota; },
    sendEmail: function (message) {
      if (context.failMail) throw new Error('mail down');
      if (context.failVisitor && message.to !== 'dan@dkbenefits.net') throw new Error('visitor down');
      sent.push(message);
    }
  };
  context.CacheService = {
    getScriptCache: function () {
      return {
        get: function (key) { return Object.prototype.hasOwnProperty.call(cacheStore, key) ? cacheStore[key] : null; },
        put: function (key, value) { cacheStore[key] = String(value); }
      };
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
      return { setMimeType: function () { return this; }, getContent: function () { return text; } };
    }
  };
  context.Utilities = {
    newBlob: function (data, mime, name) {
      return { data: data, mime: mime, name: name, setName: function (next) { this.name = next; return this; } };
    },
    formatDate: function (date, zone, pattern) {
      if (pattern === 'yyyy-MM-dd') return ASOF;
      return ASOF + ' 12:00 ET';
    },
    base64Decode: function (b64) {
      const buf = Buffer.from(String(b64), 'base64');
      const out = [];
      for (let i = 0; i < buf.length; i++) out.push(buf[i]);
      return out;
    }
  };
  context.Session = { getScriptTimeZone: function () { return 'America/New_York'; } };
  context.Drive = undefined;
  context.DriveApp = {};
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'apps-script', 'Code.gs'), 'utf8'), context, { filename: 'Code.gs' });
  context.post = function (payload) {
    return JSON.parse(context.doPost({ postData: { contents: JSON.stringify(payload) } }).getContent());
  };
  return context;
}

function payload(overrides, id) {
  const flat = baseInput(overrides);
  const checked = loadBrowserScripts().S128Model.validate(flat, { asOf: ASOF });
  if (!checked.ok) throw new Error(JSON.stringify(checked.errors));
  return Object.assign({
    event: 's128_submission',
    submissionId: id || '11111111-1111-4111-8111-111111111111',
    sessionId: '22222222-2222-4222-8222-222222222222',
    startedAt: '2026-10-08T15:00:00.000Z',
    submittedAt: '2026-10-08T15:00:10.000Z',
    pageUrl: 'https://dankirves-prog.github.io/dkbenefits-tools/section128/',
    templateVersion: 's128-v0.2-2026-10-08',
    test: true,
    hp: '',
    lead: checked.lead,
    plan: checked.plan,
    review: checked.review,
    sendVisitorCopy: true
  }, overrides && overrides.payload || {});
}

test('a valid lead emails Dan and the visitor and returns ok only after MailApp accepts it', function () {
  const ctx = boot();
  const body = ctx.post(payload());
  assert.equal(body.ok, true);
  assert.equal(body.leadEmailed, true);
  assert.equal(body.visitorEmailed, true);
  assert.equal(ctx.sent.length, 2);
  assert.equal(ctx.sent[0].to, 'dan@dkbenefits.net');
  assert.match(ctx.sent[0].subject, /\[TEST\]/);
  assert.match(ctx.sent[0].body, /Northwind Benefits LLC/);
  assert.match(ctx.sent[0].body, /State: FL/);
  assert.match(ctx.sent[0].body, /Employees: 25/);
  assert.match(ctx.sent[0].body, /Employer grant only/);
  assert.equal(ctx.sent[0].attachments.length, 1);
  assert.match(ctx.sent[0].attachments[0].name, /\.docx$/);
  assert.equal(ctx.sent[0].attachments[0].data[0], 0x50);
  assert.equal(ctx.sent[0].attachments[0].data[1], 0x4b);
  assert.equal(ctx.sent[1].to, 'ada@northwind.example');
  assert.match(ctx.sent[1].body, /draft for review/i);
  assert.equal(ctx.sheets.Submissions.rows[1][2], 'sent');
});

test('duplicate submission id does not send a second email', function () {
  const ctx = boot();
  const first = payload();
  assert.equal(ctx.post(first).ok, true);
  const again = ctx.post(first);
  assert.equal(again.ok, true);
  assert.equal(again.duplicate, true);
  assert.equal(ctx.sent.length, 2);
});

test('honeypot, fast submit, invalid grant, and mail failure do not report success', function () {
  const ctx = boot();
  const honey = payload();
  honey.hp = 'https://spam.example';
  honey.submissionId = '33333333-3333-4333-8333-333333333333';
  const honeyBody = ctx.post(honey);
  assert.equal(honeyBody.ok, false);
  assert.equal(ctx.sent.length, 0);

  const fast = payload();
  fast.submissionId = '44444444-4444-4444-8444-444444444444';
  fast.startedAt = '2026-10-08T15:00:00.000Z';
  fast.submittedAt = '2026-10-08T15:00:01.000Z';
  assert.equal(ctx.post(fast).ok, false);
  assert.equal(ctx.sent.length, 0);

  const bad = payload();
  bad.submissionId = '55555555-5555-4555-8555-555555555555';
  bad.plan.employer_annual_grant = 9000;
  const badBody = ctx.post(bad);
  assert.equal(badBody.ok, false);
  assert.match(badBody.error, /\$2,500|indexed/);
  assert.equal(ctx.sent.length, 0);

  ctx.failMail = true;
  const mail = payload();
  mail.submissionId = '66666666-6666-4666-8666-666666666666';
  const mailBody = ctx.post(mail);
  assert.equal(mailBody.ok, false);
  assert.equal(ctx.sent.length, 0);
});

test('visitor copies are limited to three an hour and salary reduction attaches the amendment', function () {
  const ctx = boot();
  const salary = {
    funding_mode: 'combined',
    employer_annual_grant: '1000',
    cafeteria_plan_name: 'Northwind Cafeteria Plan',
    cafeteria_amendment_date: '2027-01-01',
    election_cutoff_days: '5',
    has_existing_125_plan: 'yes',
    state: 'NC',
    city: 'Charlotte',
    zip: '28202'
  };
  for (let i = 0; i < 4; i++) {
    const body = ctx.post(payload(salary, '7777777' + i + '-7777-4777-8777-777777777777'));
    assert.equal(body.ok, true);
    assert.equal(body.leadEmailed, true);
    if (i < 3) assert.equal(body.visitorEmailed, true);
    else {
      assert.equal(body.visitorEmailed, false);
      assert.equal(body.visitorRateLimited, true);
    }
  }
  const danMessages = ctx.sent.filter(function (message) { return message.to === 'dan@dkbenefits.net'; });
  assert.equal(danMessages.length, 4);
  assert.match(danMessages[0].subject, /\[TEST\]/);
  assert.match(danMessages[0].subject, /\[REVIEW\]/);
  assert.match(danMessages[0].body, /State: NC/);
  assert.equal(danMessages[0].attachments.length, 2);
  assert.match(danMessages[0].attachments[1].name, /Section_125_Amendment/);
  assert.equal(ctx.sent.filter(function (message) { return message.to === 'ada@northwind.example'; }).length, 3);
});

test('checked client files are attached, and a missing visitor copy can be retried without emailing Dan again', function () {
  const ctx = boot();
  const pdf = Buffer.from('%PDF-1.4\n%test\n').toString('base64');
  const docx = Buffer.from('PK\u0003\u0004not-a-real-zip').toString('base64');
  const id = '88888888-8888-4888-8888-888888888888';
  const body = Object.assign(payload(null, id), {
    files: [
      { name: 'Plan.docx', mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', dataBase64: docx },
      { name: 'Plan.pdf', mime: 'application/pdf', dataBase64: pdf },
      { name: 'evil.exe', mime: 'application/octet-stream', dataBase64: pdf },
      { name: 'bad.pdf', mime: 'application/pdf', dataBase64: Buffer.from('not a pdf').toString('base64') }
    ]
  });
  ctx.failVisitor = true;
  const first = ctx.post(body);
  assert.equal(first.ok, true);
  assert.equal(first.leadEmailed, true);
  assert.equal(first.visitorEmailed, false);
  assert.equal(first.duplicate, false);
  const dan = ctx.sent.filter(function (message) { return message.to === 'dan@dkbenefits.net'; });
  assert.equal(dan.length, 1);
  assert.equal(dan[0].attachments.length, 2);
  assert.equal(dan[0].attachments[1].data[0], 0x25);
  assert.match(dan[0].attachments[1].name, /\.pdf$/);
  ctx.failVisitor = false;
  const second = ctx.post(body);
  assert.equal(second.ok, true);
  assert.equal(second.leadEmailed, true);
  assert.equal(second.visitorEmailed, true);
  assert.equal(second.duplicate, false);
  assert.equal(ctx.sent.filter(function (message) { return message.to === 'dan@dkbenefits.net'; }).length, 1);
  assert.equal(ctx.sent.filter(function (message) { return message.to === 'ada@northwind.example'; }).length, 1);
  const third = ctx.post(body);
  assert.equal(third.ok, true);
  assert.equal(third.duplicate, true);
  assert.equal(third.visitorEmailed, true);
  assert.equal(ctx.sent.length, 2);
});

test('the daily lead cap stops a new email and a recent pending row is not stuck after Dan was already sent', function () {
  const ctx = boot();
  ctx.S128_DAILY_LEAD_CAP = 1;
  assert.equal(ctx.post(payload(null, '99999999-9999-4999-8999-999999999991')).ok, true);
  const blocked = ctx.post(payload(null, '99999999-9999-4999-8999-999999999992'));
  assert.equal(blocked.ok, false);
  assert.match(blocked.error, /daily email limit/i);
  assert.equal(ctx.sent.filter(function (message) { return message.to === 'dan@dkbenefits.net'; }).length, 1);

  const sheet = ctx.sheets.Submissions;
  const pending = sheet.rows[1].slice();
  pending[0] = new Date().toISOString();
  pending[1] = '99999999-9999-4999-8999-999999999993';
  pending[2] = 'pending';
  pending[16] = 'yes';
  pending[17] = 'no';
  sheet.rows.push(pending);
  const resumed = ctx.post(payload(null, pending[1]));
  assert.equal(resumed.ok, true);
  assert.equal(resumed.leadEmailed, true);
  assert.equal(resumed.visitorEmailed, true);
  assert.equal(ctx.sent.filter(function (message) { return message.to === 'dan@dkbenefits.net'; }).length, 1);

  const fresh = sheet.rows[1].slice();
  fresh[0] = new Date().toISOString();
  fresh[1] = '99999999-9999-4999-8999-999999999994';
  fresh[2] = 'pending';
  fresh[16] = 'no';
  fresh[17] = 'no';
  sheet.rows.push(fresh);
  const busy = ctx.post(payload(null, fresh[1]));
  assert.equal(busy.ok, false);
  assert.match(busy.error, /already being sent/);
});
