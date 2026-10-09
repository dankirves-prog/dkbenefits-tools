const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { loadBrowserScripts, baseInput, ASOF, LINKS } = require('./helpers');

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
      return { data: data, mime: mime, name: name };
    },
    base64Decode: function (b64) {
      const buf = Buffer.from(String(b64), 'base64');
      const out = [];
      for (let i = 0; i < buf.length; i++) out.push(buf[i]);
      return out;
    }
  };
  context.fetch = function () { throw new Error('live fetch is not allowed'); };
  context.UrlFetchApp = { fetch: function () { throw new Error('live fetch is not allowed'); } };
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'apps-script', 'Code.gs'), 'utf8'), context, { filename: 'Code.gs' });
  context.post = function (payload) {
    return JSON.parse(context.doPost({ postData: { contents: JSON.stringify(payload) } }).getContent());
  };
  return context;
}

function payload(overrides, id) {
  const flat = baseInput(overrides);
  const checked = loadBrowserScripts().S125Model.validate(flat, { asOf: ASOF });
  if (!checked.ok) throw new Error(JSON.stringify(checked.errors));
  return {
    event: 's125_submission',
    submissionId: id || '11111111-1111-4111-8111-111111111111',
    sessionId: '22222222-2222-4222-8222-222222222222',
    startedAt: '2026-10-09T15:00:00.000Z',
    submittedAt: '2026-10-09T15:00:10.000Z',
    pageUrl: 'http://127.0.0.1/section125/index.html',
    templateVersion: 's125-v1.0.0-2026-10-09',
    test: true,
    hp: '',
    lead: checked.lead,
    plan: checked.plan,
    review: checked.review,
    acknowledgement: {
      accepted: true,
      acceptedAt: '2026-10-09T15:00:10.000Z',
      termsVersion: 's125-terms-2026-10-09'
    },
    sendVisitorCopy: true
  };
}

test('the script source does not call a live endpoint', function () {
  const source = fs.readFileSync(path.join(__dirname, '..', 'apps-script', 'Code.gs'), 'utf8');
  const page = fs.readFileSync(path.join(__dirname, '..', 'config.js'), 'utf8');
  assert.doesNotMatch(source + page, /section125pdf|AKfycb|script\.google\.com\/macros/);
  assert.match(page, /endpoint: ''/);
});

test('a valid lead emails Dan immediately and queues a follow-up with no visitor email', function () {
  const ctx = boot();
  ctx.S125_TEST_NOW = Date.parse('2026-10-09T15:00:00.000Z');
  const body = ctx.post(payload());
  assert.equal(body.ok, true);
  assert.equal(body.leadEmailed, true);
  assert.equal(body.visitorEmailed, false);
  assert.equal(body.followUpQueued, true);
  assert.equal(ctx.sent.length, 1);
  assert.equal(ctx.sent[0].to, 'dan@dkbenefits.net');
  assert.match(ctx.sent[0].subject, /^\[TEST\] New Section 125 Lead: Northwind Benefits Inc$/);
  assert.equal(ctx.sent[0].attachments.length, 2);
  assert.match(ctx.sent[0].attachments[0].name, /Section_125_Plan_v1\.0\.docx$/);
  assert.match(ctx.sent[0].attachments[1].name, /Implementation_Guide_v1\.0\.docx$/);
  assert.equal(ctx.sent[0].attachments[0].data[0], 0x50);
  assert.equal(ctx.sent[0].attachments[0].data[1], 0x4b);
  assert.equal(ctx.sheets.Submissions.rows[1][14], 'yes');
  assert.equal(ctx.sheets.Submissions.rows[1][15], 'no');
  assert.equal(ctx.sheets.Submissions.rows[1][18], 's125-terms-2026-10-09');
  assert.equal(ctx.sheets.FollowUps.rows[1][5], 'pending');
  assert.equal(ctx.triggers[0], 's125SendDueFollowUps');
  ctx.setupFollowUpTrigger();
  assert.equal(ctx.triggers.length, 1);
  ctx.s125SendDueFollowUps();
  assert.equal(ctx.sent.length, 1);
});

test('the follow-up waits ten minutes, has two links, and has no attachments', function () {
  const ctx = boot();
  const base = Date.parse('2026-10-09T15:00:00.000Z');
  ctx.S125_TEST_NOW = base;
  const rich = {
    entity_type: 's-corp',
    benefits: ['medical', 'health_fsa', 'dcap', 'hsa'],
    health_fsa_design: 'limited',
    health_fsa_unused: 'carryover',
    dcap_unused: 'grace'
  };
  assert.equal(ctx.post(payload(rich, '77777770-7777-4777-8777-777777777777')).ok, true);
  assert.equal(ctx.post(payload(rich, '77777771-7777-4777-8777-777777777777')).ok, true);
  ctx.s125SendDueFollowUps();
  assert.equal(ctx.sent.filter(function (message) { return message.to === 'ada@northwind.example'; }).length, 0);
  ctx.S125_TEST_NOW = base + 11 * 60 * 1000;
  ctx.s125SendDueFollowUps();
  const notes = ctx.sent.filter(function (message) { return message.to === 'ada@northwind.example'; });
  assert.equal(notes.length, 1);
  assert.equal(notes[0].attachments, undefined);
  assert.equal(notes[0].name, 'Daniel Kirves');
  assert.equal(notes[0].replyTo, 'dan@dkbenefits.net');
  assert.equal(notes[0].subject, '[TEST] Thanks for using my Section 125 tool!');
  assert.match(notes[0].body, /^Hi Ada,/);
  assert.match(notes[0].body, /officially called "Trump accounts"/);
  assert.match(notes[0].body, /Just so it's clear, legally I have to mention that the tool is educational and isn't legal or tax advice\./);
  assert.doesNotMatch(notes[0].body, /I don't sell, market, open, or administer Trump accounts/);
  assert.deepEqual(notes[0].body.match(/https?:\/\/\S+/g), [LINKS.section128Url, LINKS.ratesUrl]);
  assert.equal((notes[0].htmlBody.match(/<a /g) || []).length, 2);
  assert.match(notes[0].htmlBody, /407-476-5076 \| www\.dkbenefits\.net/);
  assert.doesNotMatch(notes[0].htmlBody, /<a [^>]*>[^<]*www\.dkbenefits\.net<\/a>/);
  assert.doesNotMatch(notes[0].body, /dan@dkbenefits\.net|Thanks again|P\.S\./);
  assert.equal(ctx.sheets.FollowUps.rows[1][5], 'sent');
  assert.equal(ctx.sheets.FollowUps.rows[2][5], 'skipped');
});

test('a honeypot, a fast submit, and a wrong terms version are rejected without email', function () {
  const ctx = boot();
  const honey = payload();
  honey.hp = 'https://spam.example';
  assert.equal(ctx.post(honey).ok, false);
  const fast = payload(null, '33333333-3333-4333-8333-333333333333');
  fast.submittedAt = fast.startedAt;
  assert.equal(ctx.post(fast).ok, false);
  const terms = payload(null, '44444444-4444-4444-8444-444444444444');
  terms.acknowledgement.termsVersion = 's128-terms-2026-10-08b';
  assert.equal(ctx.post(terms).ok, false);
  assert.equal(ctx.sent.length, 0);
  assert.match(ctx.doGet().getContent(), /Section 125 lead service is deployed/);
});

test('client files that fail the signature check are dropped and the script rebuilds the Word plan', function () {
  const ctx = boot();
  const pdf = Buffer.from('%PDF-1.4\n%test\n').toString('base64');
  const bad = Buffer.from('not a pdf').toString('base64');
  const body = Object.assign(payload(null, '88888888-8888-4888-8888-888888888888'), {
    files: [
      { name: 'evil.exe', mime: 'application/octet-stream', dataBase64: pdf },
      { name: 'bad.pdf', mime: 'application/pdf', dataBase64: bad },
      { name: 'Plan.pdf', mime: 'application/pdf', dataBase64: pdf }
    ]
  });
  const first = ctx.post(body);
  assert.equal(first.ok, true);
  assert.equal(first.visitorEmailed, false);
  const dan = ctx.sent[0];
  assert.equal(dan.to, 'dan@dkbenefits.net');
  assert.ok(dan.attachments.length >= 2);
  assert.equal(dan.attachments[0].data[0], 0x50);
  assert.equal(dan.attachments[0].data[1], 0x4b);
  assert.ok(dan.attachments.some(function (file) { return file.data[0] === 0x25; }));
  const again = ctx.post(body);
  assert.equal(again.duplicate, true);
  assert.equal(again.visitorEmailed, false);
  assert.equal(ctx.sent.length, 1);
});

test('the daily cap blocks a new lead and a fresh pending row is left alone', function () {
  const ctx = boot();
  ctx.S125_DAILY_LEAD_CAP = 1;
  assert.equal(ctx.post(payload(null, '99999999-9999-4999-8999-999999999991')).ok, true);
  const blocked = ctx.post(payload(null, '99999999-9999-4999-8999-999999999992'));
  assert.equal(blocked.ok, false);
  assert.match(blocked.error, /daily email limit/i);
  const sheet = ctx.sheets.Submissions;
  const fresh = sheet.rows[1].slice();
  fresh[0] = new Date().toISOString();
  fresh[1] = '99999999-9999-4999-8999-999999999994';
  fresh[2] = 'pending';
  fresh[14] = 'no';
  fresh[15] = 'no';
  sheet.rows.push(fresh);
  const busy = ctx.post(payload(null, fresh[1]));
  assert.equal(busy.ok, false);
  assert.match(busy.error, /already being sent/);
  assert.equal(ctx.sent.length, 1);
});
