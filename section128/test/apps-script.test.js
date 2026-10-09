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
  Sheet.prototype.getLastColumn = function () {
    return this.rows.reduce(function (max, row) { return Math.max(max, row.length); }, 0);
  };
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
  context.triggers = [];
  context.ScriptApp = {
    getProjectTriggers: function () {
      return context.triggers.map(function (name) {
        return { getHandlerFunction: function () { return name; } };
      });
    },
    newTrigger: function (name) {
      return {
        timeBased: function () {
          return {
            everyMinutes: function () {
              return { create: function () { context.triggers.push(name); } };
            }
          };
        }
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
    templateVersion: 's128-v0.5.1-2026-10-09',
    test: true,
    hp: '',
    lead: checked.lead,
    plan: checked.plan,
    review: checked.review,
    acknowledgement: {
      accepted: true,
      acceptedAt: '2026-10-08T15:00:10.000Z',
      termsVersion: 's128-terms-2026-10-08b'
    },
    sendVisitorCopy: true
  }, overrides && overrides.payload || {});
}

test('a valid lead emails Dan immediately and queues a follow-up with no visitor attachments', function () {
  const ctx = boot();
  ctx.S128_TEST_NOW = Date.parse('2026-10-08T15:00:00.000Z');
  const body = ctx.post(payload());
  assert.equal(body.ok, true);
  assert.equal(body.leadEmailed, true);
  assert.equal(body.visitorEmailed, false);
  assert.equal(body.followUpQueued, true);
  assert.equal(ctx.sent.length, 1);
  assert.equal(ctx.sent[0].to, 'dan@dkbenefits.net');
  assert.match(ctx.sent[0].subject, /\[TEST\]/);
  assert.match(ctx.sent[0].body, /Northwind Benefits LLC/);
  assert.match(ctx.sent[0].body, /State: FL/);
  assert.match(ctx.sent[0].body, /Employees: 25/);
  assert.match(ctx.sent[0].body, /Employer grant only/);
  assert.equal(ctx.sent[0].attachments.length, 2);
  assert.match(ctx.sent[0].attachments[0].name, /Section_128_Plan/);
  assert.match(ctx.sent[0].attachments[1].name, /Implementation_Guide/);
  assert.equal(ctx.sent[0].attachments[0].data[0], 0x50);
  assert.equal(ctx.sent[0].attachments[0].data[1], 0x4b);
  assert.match(ctx.sent[0].body, /s128-terms-2026-10-08b/);
  assert.match(ctx.sent[0].body, /2026-10-08T15:00:10.000Z/);
  assert.equal(ctx.sheets.Submissions.rows[1][2], 'sent');
  assert.equal(ctx.sheets.Submissions.rows[1][17], 'no');
  assert.equal(ctx.sheets.Submissions.rows[1][20], 's128-terms-2026-10-08b');
  assert.equal(ctx.sheets.Submissions.rows[1][21], '2026-10-08T15:00:10.000Z');
  assert.equal(ctx.sheets.FollowUps.rows[1][5], 'pending');
  assert.equal(ctx.sheets.FollowUps.rows[1][1], 'ada@northwind.example');
  assert.equal(ctx.triggers.length, 1);
  ctx.setupFollowUpTrigger();
  assert.equal(ctx.triggers.length, 1);
  ctx.s128SendDueFollowUps();
  assert.equal(ctx.sent.length, 1);
  assert.equal(ctx.sheets.FollowUps.rows[1][5], 'pending');
});

test('duplicate submission id does not send a second email', function () {
  const ctx = boot();
  const first = payload();
  assert.equal(ctx.post(first).ok, true);
  const again = ctx.post(first);
  assert.equal(again.ok, true);
  assert.equal(again.duplicate, true);
  assert.equal(again.visitorEmailed, false);
  assert.equal(ctx.sent.length, 1);
  assert.equal(ctx.sheets.FollowUps.rows.length, 2);
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

test('salary reduction attaches the amendment for Dan, and one follow-up goes out after ten minutes', function () {
  const ctx = boot();
  const base = Date.parse('2026-10-08T15:00:00.000Z');
  ctx.S128_TEST_NOW = base;
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
  for (let i = 0; i < 2; i++) {
    const body = ctx.post(payload(salary, '7777777' + i + '-7777-4777-8777-777777777777'));
    assert.equal(body.ok, true);
    assert.equal(body.leadEmailed, true);
    assert.equal(body.visitorEmailed, false);
    assert.equal(body.followUpQueued, true);
  }
  const danMessages = ctx.sent.filter(function (message) { return message.to === 'dan@dkbenefits.net'; });
  assert.equal(danMessages.length, 2);
  assert.match(danMessages[0].subject, /\[TEST\]/);
  assert.match(danMessages[0].subject, /\[REVIEW\]/);
  assert.match(danMessages[0].body, /State: NC/);
  assert.equal(danMessages[0].attachments.length, 3);
  assert.match(danMessages[0].attachments[1].name, /Section_125_Amendment/);
  assert.match(danMessages[0].attachments[2].name, /Implementation_Guide/);
  assert.equal(ctx.sent.filter(function (message) { return message.to === 'ada@northwind.example'; }).length, 0);
  ctx.s128SendDueFollowUps();
  assert.equal(ctx.sent.filter(function (message) { return message.to === 'ada@northwind.example'; }).length, 0);
  ctx.S128_TEST_NOW = base + 11 * 60 * 1000;
  ctx.s128SendDueFollowUps();
  const notes = ctx.sent.filter(function (message) { return message.to === 'ada@northwind.example'; });
  assert.equal(notes.length, 1);
  assert.equal(notes[0].attachments, undefined);
  assert.equal(notes[0].name, 'Daniel Kirves');
  assert.equal(notes[0].replyTo, 'dan@dkbenefits.net');
  assert.equal(notes[0].subject, '[TEST] Thanks for using my Section 128 tool');
  assert.match(notes[0].body, /^Hi Ada,/);
  assert.match(notes[0].body, /A few quick reminders to make the plan official/);
  assert.match(notes[0].body, /Pay the \$1,000 grant/);
  assert.match(notes[0].body, /\$2,500 per employee per year/);
  assert.match(notes[0].body, /Add the Section 125 amendment/);
  assert.match(notes[0].body, /shop and negotiate your group health/);
  assert.match(notes[0].body, /some rates you can see online right now/);
  assert.deepEqual(notes[0].body.match(/https?:\/\/\S+/g), [
    'https://www.dkbenefits.net/section125plantool',
    'https://www.dkbenefits.net/instant-group-quote'
  ]);
  assert.doesNotMatch(notes[0].body, /attorney|lowest|attached|savings|quote-tool-demo|dan@dkbenefits\.net/i);
  assert.equal((notes[0].htmlBody.match(/<a /g) || []).length, 2);
  assert.match(notes[0].htmlBody, /<a href="https:\/\/www\.dkbenefits\.net\/section125plantool">https:\/\/www\.dkbenefits\.net\/section125plantool<\/a>/);
  assert.match(notes[0].htmlBody, /<a href="https:\/\/www\.dkbenefits\.net\/instant-group-quote">https:\/\/www\.dkbenefits\.net\/instant-group-quote<\/a>/);
  assert.doesNotMatch(notes[0].htmlBody, /mailto:|tel:|<img|utm_|bit\.ly|dan@dkbenefits\.net/i);
  assert.match(notes[0].htmlBody, /407-476-5076/);
  assert.doesNotMatch(notes[0].htmlBody, /<a [^>]*>407-476-5076<\/a>/);
  assert.equal(ctx.sheets.FollowUps.rows[1][5], 'sent');
  assert.equal(ctx.sheets.FollowUps.rows[2][5], 'skipped');
  assert.match(String(ctx.sheets.FollowUps.rows[2][8]), /already sent today/);
});

test('a follow-up is skipped when the address already used the hourly limit', function () {
  const ctx = boot();
  const base = Date.parse('2026-10-08T16:00:00.000Z');
  ctx.S128_TEST_NOW = base;
  assert.equal(ctx.post(payload(null, '78787878-7878-4787-8787-787878787878')).followUpQueued, true);
  assert.equal(ctx.s128VisitorAllowed_('ada@northwind.example'), true);
  assert.equal(ctx.s128VisitorAllowed_('ada@northwind.example'), true);
  assert.equal(ctx.s128VisitorAllowed_('ada@northwind.example'), true);
  assert.equal(ctx.s128VisitorAllowed_('ada@northwind.example'), false);
  ctx.S128_TEST_NOW = base + 11 * 60 * 1000;
  ctx.s128SendDueFollowUps();
  assert.equal(ctx.sent.filter(function (message) { return message.to === 'ada@northwind.example'; }).length, 0);
  assert.equal(ctx.sheets.FollowUps.rows[1][5], 'skipped');
  assert.match(String(ctx.sheets.FollowUps.rows[1][8]), /hourly limit/);
});

test('checked client files are attached only to Dan, never to the visitor address', function () {
  const ctx = boot();
  const base = Date.parse('2026-10-08T17:00:00.000Z');
  ctx.S128_TEST_NOW = base;
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
  const first = ctx.post(body);
  assert.equal(first.ok, true);
  assert.equal(first.leadEmailed, true);
  assert.equal(first.visitorEmailed, false);
  assert.equal(first.followUpQueued, true);
  const dan = ctx.sent.filter(function (message) { return message.to === 'dan@dkbenefits.net'; });
  assert.equal(dan.length, 1);
  assert.equal(dan[0].attachments.length, 2);
  assert.equal(dan[0].attachments[1].data[0], 0x25);
  assert.match(dan[0].attachments[1].name, /\.pdf$/);
  const second = ctx.post(body);
  assert.equal(second.ok, true);
  assert.equal(second.duplicate, true);
  assert.equal(second.visitorEmailed, false);
  assert.equal(ctx.sent.filter(function (message) { return message.to === 'dan@dkbenefits.net'; }).length, 1);
  assert.equal(ctx.sent.filter(function (message) { return message.to === 'ada@northwind.example'; }).length, 0);
  ctx.S128_TEST_NOW = base + 11 * 60 * 1000;
  ctx.s128SendDueFollowUps();
  const note = ctx.sent.filter(function (message) { return message.to === 'ada@northwind.example'; });
  assert.equal(note.length, 1);
  assert.equal(note[0].attachments, undefined);
  assert.doesNotMatch(JSON.stringify(note[0]), /dataBase64|Plan\.pdf/);
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
  assert.equal(resumed.duplicate, true);
  assert.equal(resumed.leadEmailed, true);
  assert.equal(resumed.visitorEmailed, false);
  assert.equal(resumed.followUpQueued, true);
  assert.equal(ctx.sent.filter(function (message) { return message.to === 'dan@dkbenefits.net'; }).length, 1);
  assert.equal(ctx.sent.filter(function (message) { return message.to === 'ada@northwind.example'; }).length, 0);

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

test('a submission without the terms acknowledgement is rejected', function () {
  const ctx = boot();
  const missing = payload(null, '12121212-1212-4212-8212-121212121212');
  delete missing.acknowledgement;
  const rejected = ctx.post(missing);
  assert.equal(rejected.ok, false);
  assert.match(rejected.error, /acknowledgement/i);
  assert.equal(ctx.sent.length, 0);
});

test('an existing sheet header gains only the acknowledgement columns', function () {
  const ctx = boot();
  const sheet = ctx.SpreadsheetApp.getActiveSpreadsheet().insertSheet('Submissions');
  const old = ctx.S128_SUBMISSION_HEADERS.slice(0, 20);
  sheet.appendRow(old);
  const prior = old.map(function () { return ''; });
  prior[1] = 'kept-id';
  prior[16] = 'yes';
  sheet.appendRow(prior);
  const body = ctx.post(payload(null, '13131313-1313-4313-8313-131313131313'));
  assert.equal(body.ok, true);
  assert.equal(sheet.rows[0][16], 'lead_emailed');
  assert.equal(sheet.rows[0][17], 'visitor_emailed');
  assert.equal(sheet.rows[0][20], 'terms_version');
  assert.equal(sheet.rows[0][21], 'terms_accepted_at');
  assert.equal(sheet.rows[1][1], 'kept-id');
  assert.equal(sheet.rows[1][16], 'yes');
});
