const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { combinedSource } = require('./combined-source');

const root = path.join(__dirname, '..');
const combinedPath = path.join(root, 'apps-script', 'ContactCombined.gs');

function boot() {
  const context = { console: console };
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
      sent.push(JSON.parse(JSON.stringify(message)));
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
  context.triggerMinutes = null;
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
            everyMinutes: function (minutes) {
              return {
                create: function () {
                  context.triggers.push(name);
                  context.triggerMinutes = minutes;
                }
              };
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
    formatDate: function (date, zone, pattern) {
      if (zone !== 'America/New_York') return '';
      const shifted = new Date(date.getTime() - 4 * 60 * 60 * 1000);
      const iso = shifted.toISOString();
      if (pattern === 'yyyy-MM-dd') return iso.slice(0, 10);
      if (pattern === 'yyyy-MM-dd HH:mm') return iso.slice(0, 16).replace('T', ' ');
      return iso;
    }
  };
  context.Logger = { log: function () {} };
  vm.createContext(context);
  vm.runInContext(fs.readFileSync(combinedPath, 'utf8'), context, { filename: 'ContactCombined.gs' });
  context.post = function (body) {
    return JSON.parse(context.doPost({ postData: { contents: JSON.stringify(body) } }).getContent());
  };
  return context;
}

function payload(overrides, id) {
  overrides = overrides || {};
  const lead = Object.assign({
    firstName: 'Ada',
    lastName: 'Lovelace',
    company: 'Northwind Benefits',
    email: 'ada@northwind.example',
    phone: '4075550123',
    message: 'We need help reviewing our group health plan.'
  }, overrides.lead || {});
  const body = Object.assign({
    event: 'contact_submission',
    submissionId: id || '11111111-1111-4111-8111-111111111111',
    visitorId: '22222222-2222-4222-8222-222222222222',
    startedAt: '2026-10-08T15:00:00.000Z',
    submittedAt: '2026-10-08T15:00:10.000Z',
    pageUrl: 'https://dankirves-prog.github.io/dkbenefits-tools/contact/',
    test: true,
    hp: ''
  }, overrides);
  body.lead = lead;
  if (id) body.submissionId = id;
  return body;
}

function danMessages(ctx) {
  return ctx.sent.filter(function (message) { return message.to === 'dan@dkbenefits.net'; });
}

test('the combined script is the validate file plus Code.gs', function () {
  assert.equal(fs.readFileSync(combinedPath, 'utf8'), combinedSource());
  const text = fs.readFileSync(combinedPath, 'utf8');
  assert.match(text, /function doPost/);
  assert.match(text, /function contactSendDueFollowUps/);
  assert.doesNotMatch(text, /S128|docx|pdf-lib|DocumentApp/);
});

test('doGet confirms the service is deployed', function () {
  const ctx = boot();
  assert.match(ctx.doGet().getContent(), /DK Benefits contact form is deployed/);
});

test('a valid lead emails only Dan and queues a plain-text reply', function () {
  const ctx = boot();
  const base = Date.parse('2026-10-08T15:00:00.000Z');
  ctx.CONTACT_TEST_NOW = base;
  const body = ctx.post(payload());
  assert.equal(body.ok, true);
  assert.equal(body.leadEmailed, true);
  assert.equal(body.followUpQueued, true);
  assert.equal(body.duplicate, false);
  assert.equal(ctx.sent.length, 1);
  assert.equal(ctx.sent[0].to, 'dan@dkbenefits.net');
  assert.equal(ctx.sent[0].cc, undefined);
  assert.equal(ctx.sent[0].bcc, undefined);
  assert.equal(ctx.sent[0].replyTo, 'ada@northwind.example');
  assert.match(ctx.sent[0].subject, /^\[TEST\] New contact form message: Ada Lovelace \(Northwind Benefits\)$/);
  assert.match(ctx.sent[0].body, /Email: ada@northwind\.example/);
  assert.match(ctx.sent[0].body, /Phone: \(407\) 555-0123/);
  assert.match(ctx.sent[0].body, /We need help reviewing our group health plan\./);
  assert.equal(ctx.sent[0].attachments, undefined);
  assert.equal(ctx.sent[0].htmlBody, undefined);
  assert.equal(ctx.sheets.Submissions.rows[1][2], 'sent');
  assert.equal(ctx.sheets.Submissions.rows[1][7], 'ada@northwind.example');
  assert.equal(ctx.sheets.Submissions.rows[1][11], 'yes');
  assert.equal(ctx.sheets.Submissions.rows[1][12], 'yes');
  assert.equal(ctx.sheets.FollowUps.rows[1][1], 'ada@northwind.example');
  assert.equal(ctx.sheets.FollowUps.rows[1][5], 'pending');
  assert.equal(ctx.sheets.Events.rows[1][1], 'sent');
  assert.deepEqual(ctx.triggers, ['contactSendDueFollowUps']);
  assert.equal(ctx.triggerMinutes, 5);
  ctx.setupFollowUpTrigger();
  assert.equal(ctx.triggers.length, 1);

  ctx.contactSendDueFollowUps();
  assert.equal(ctx.sent.length, 1);
  assert.equal(ctx.sheets.FollowUps.rows[1][5], 'pending');

  ctx.CONTACT_TEST_NOW = base + 11 * 60 * 1000;
  ctx.contactSendDueFollowUps();
  assert.equal(ctx.sent.length, 2);
  const note = ctx.sent[1];
  assert.equal(note.to, 'ada@northwind.example');
  assert.equal(note.name, 'Daniel Kirves');
  assert.equal(note.replyTo, 'dan@dkbenefits.net');
  assert.equal(note.subject, '[TEST] Thanks for reaching out to DK Benefits');
  assert.equal(note.htmlBody, undefined);
  assert.equal(note.attachments, undefined);
  assert.equal(note.body, ctx.ContactModel.replyBody('Ada'));
  assert.match(note.body, /^Hi Ada,/);
  assert.equal(ctx.sheets.FollowUps.rows[1][5], 'sent');
  assert.equal(danMessages(ctx).length, 1);
});

test('a real reply uses the exact subject and is not sent before ten minutes', function () {
  const ctx = boot();
  const base = Date.parse('2026-10-08T15:00:00.000Z');
  ctx.CONTACT_TEST_NOW = base;
  const body = payload(null, '14141414-1414-4414-8414-141414141414');
  body.test = false;
  body.lead = { email: 'pat@example.com', firstName: 'Pat', message: 'Please call me about our renewal.' };
  assert.equal(ctx.post(body).ok, true);
  assert.match(ctx.sent[0].subject, /^New contact form message: Pat$/);
  assert.equal(ctx.sent[0].to, 'dan@dkbenefits.net');
  ctx.CONTACT_TEST_NOW = base + 9 * 60 * 1000;
  ctx.contactSendDueFollowUps();
  assert.equal(ctx.sent.length, 1);
  ctx.CONTACT_TEST_NOW = base + 10 * 60 * 1000;
  ctx.contactSendDueFollowUps();
  assert.equal(ctx.sent.length, 2);
  assert.equal(ctx.sent[1].to, 'pat@example.com');
  assert.equal(ctx.sent[1].subject, 'Thanks for reaching out to DK Benefits');
  assert.equal(ctx.sent[1].body, ctx.ContactModel.replyBody('Pat'));
});

test('duplicate submission id does not send a second lead email', function () {
  const ctx = boot();
  const first = payload();
  assert.equal(ctx.post(first).ok, true);
  const again = ctx.post(first);
  assert.equal(again.ok, true);
  assert.equal(again.duplicate, true);
  assert.equal(again.followUpQueued, true);
  assert.equal(ctx.sent.length, 1);
  assert.equal(ctx.sheets.FollowUps.rows.length, 2);
  assert.equal(ctx.sheets.Submissions.rows.length, 2);
});

test('a fresh pending row is not emailed twice', function () {
  const ctx = boot();
  const base = Date.parse('2026-10-08T15:00:00.000Z');
  ctx.CONTACT_TEST_NOW = base;
  const body = payload(null, '15151515-1515-4515-8515-151515151515');
  assert.equal(ctx.post(body).ok, true);
  ctx.sheets.Submissions.rows[1][2] = 'pending';
  ctx.sheets.Submissions.rows[1][11] = 'no';
  ctx.CONTACT_TEST_NOW = base + 1000;
  const again = ctx.post(body);
  assert.equal(again.ok, false);
  assert.match(again.error, /already being sent/);
  assert.equal(ctx.sent.length, 1);
});

test('honeypot, fast submit, invalid email, and mail failure do not report success', function () {
  const ctx = boot();
  const honey = payload(null, '33333333-3333-4333-8333-333333333333');
  honey.hp = 'https://spam.example';
  assert.equal(ctx.post(honey).ok, false);
  assert.equal(ctx.sent.length, 0);
  assert.equal(ctx.sheets.Submissions, undefined);
  assert.equal(ctx.sheets.Events.rows[1][1], 'rejected_honeypot');

  const fast = payload(null, '44444444-4444-4444-8444-444444444444');
  fast.startedAt = '2026-10-08T15:00:00.000Z';
  fast.submittedAt = '2026-10-08T15:00:01.000Z';
  assert.equal(ctx.post(fast).ok, false);
  assert.equal(ctx.sent.length, 0);

  const bad = payload(null, '55555555-5555-4555-8555-555555555555');
  bad.lead = { email: 'nope', firstName: 'Ada', message: 'Hello there' };
  const badBody = ctx.post(bad);
  assert.equal(badBody.ok, false);
  assert.equal(badBody.fields[0].field, 'email');
  assert.equal(ctx.sent.length, 0);

  ctx.failMail = true;
  const mail = payload(null, '66666666-6666-4666-8666-666666666666');
  const mailBody = ctx.post(mail);
  assert.equal(mailBody.ok, false);
  assert.match(mailBody.error, /could not be sent/);
  assert.equal(ctx.sent.length, 0);
  assert.equal(ctx.sheets.Submissions.rows[1][2], 'failed');
  assert.equal(ctx.sheets.Submissions.rows[1][11], 'no');
});

test('the fourth message from one visitor is rate limited, and the daily cap stops the lead email', function () {
  const ctx = boot();
  ctx.CONTACT_TEST_NOW = Date.parse('2026-10-08T15:00:00.000Z');
  for (let i = 0; i < 3; i++) {
    const body = payload({
      visitorId: '88888888-8888-4888-8888-88888888888' + i,
      lead: { email: 'ada@northwind.example', firstName: 'Ada', message: 'Message number ' + i }
    }, '1717171' + i + '-1717-4717-8717-171717171717');
    assert.equal(ctx.post(body).ok, true, 'message ' + i);
  }
  const blocked = ctx.post(payload({
    visitorId: '99999999-9999-4999-8999-999999999999',
    lead: { email: 'ada@northwind.example', firstName: 'Ada', message: 'One more' }
  }, '18181818-1818-4818-8818-181818181818'));
  assert.equal(blocked.ok, false);
  assert.match(blocked.error, /wait about an hour/);
  assert.equal(danMessages(ctx).length, 3);

  const other = boot();
  other.CONTACT_DAILY_LEAD_CAP = 1;
  other.CONTACT_TEST_NOW = Date.parse('2026-10-08T16:00:00.000Z');
  assert.equal(other.post(payload(null, '19191919-1919-4919-8919-191919191919')).ok, true);
  const capped = other.post(payload({
    visitorId: '28282828-2828-4828-8828-282828282828',
    lead: { email: 'sam@example.com', firstName: 'Sam', message: 'Second company today' }
  }, '20202020-2020-4202-8202-202020202020'));
  assert.equal(capped.ok, false);
  assert.match(capped.error, /daily limit/);
  assert.equal(danMessages(other).length, 1);
});

test('the same browser is limited even when the email changes', function () {
  const ctx = boot();
  ctx.CONTACT_TEST_NOW = Date.parse('2026-10-08T15:00:00.000Z');
  const visitorId = '30303030-3030-4303-8303-303030303030';
  for (let i = 0; i < 3; i++) {
    assert.equal(ctx.post(payload({
      visitorId: visitorId,
      lead: { email: 'person' + i + '@example.com', firstName: 'Pat', message: 'Hello from browser' }
    }, '3131313' + i + '-3131-4313-8313-313131313131')).ok, true);
  }
  const blocked = ctx.post(payload({
    visitorId: visitorId,
    lead: { email: 'person9@example.com', firstName: 'Pat', message: 'Hello again' }
  }, '32323232-3232-4323-8323-323232323232'));
  assert.equal(blocked.ok, false);
  assert.match(blocked.error, /wait about an hour/);
});

test('a second real follow-up to the same address is skipped the same day, and a test note still sends', function () {
  const ctx = boot();
  const base = Date.parse('2026-10-08T18:00:00.000Z');
  ctx.CONTACT_TEST_NOW = base;
  for (let i = 0; i < 2; i++) {
    const body = payload({
      test: false,
      visitorId: '34343434-3434-4343-8343-34343434343' + i,
      lead: { email: 'pat@example.com', firstName: 'Pat', message: 'Please call me back today.' }
    }, '3535353' + i + '-3535-4353-8353-353535353535');
    assert.equal(ctx.post(body).followUpQueued, true);
  }
  ctx.CONTACT_TEST_NOW = base + 11 * 60 * 1000;
  ctx.contactSendDueFollowUps();
  const notes = ctx.sent.filter(function (message) { return message.to === 'pat@example.com'; });
  assert.equal(notes.length, 1);
  assert.equal(notes[0].subject, 'Thanks for reaching out to DK Benefits');
  assert.equal(ctx.sheets.FollowUps.rows[1][5], 'sent');
  assert.equal(ctx.sheets.FollowUps.rows[2][5], 'skipped');
  assert.equal(ctx.sheets.FollowUps.rows[2][8], 'already sent today');

  ctx.CONTACT_TEST_NOW = base + 12 * 60 * 1000;
  const testBody = payload({
    test: true,
    visitorId: '36363636-3636-4363-8363-363636363636',
    lead: { email: 'pat@example.com', firstName: 'Pat', message: 'This is only a test.' }
  }, '37373737-3737-4373-8373-373737373737');
  assert.equal(ctx.post(testBody).followUpQueued, true);
  ctx.CONTACT_TEST_NOW = base + 23 * 60 * 1000;
  ctx.contactSendDueFollowUps();
  const later = ctx.sent.filter(function (message) { return message.to === 'pat@example.com'; });
  assert.equal(later.length, 2);
  assert.equal(later[1].subject, '[TEST] Thanks for reaching out to DK Benefits');
  assert.equal(danMessages(ctx).every(function (message) { return message.to === 'dan@dkbenefits.net'; }), true);
});

test('a test row already skipped for today is sent on the next trigger', function () {
  const ctx = boot();
  const base = Date.parse('2026-10-08T19:56:00.000Z');
  ctx.CONTACT_TEST_NOW = base;
  const body = payload({
    test: true,
    lead: { email: 'dan@dkbenefits.net', firstName: 'Daniel', message: 'Checking the test note.' }
  }, '40404040-4040-4404-8404-404040404040');
  assert.equal(ctx.post(body).followUpQueued, true);
  ctx.sheets.FollowUps.rows[1][0] = new Date(base);
  ctx.sheets.FollowUps.rows[1][5] = 'skipped';
  ctx.sheets.FollowUps.rows[1][8] = 'already sent today';
  ctx.CONTACT_TEST_NOW = base + 11 * 60 * 1000;
  ctx.contactSendDueFollowUps();
  const notes = ctx.sent.filter(function (message) { return message.subject.indexOf('Thanks for reaching out') !== -1; });
  assert.equal(notes.length, 1);
  assert.equal(notes[0].to, 'dan@dkbenefits.net');
  assert.equal(notes[0].subject, '[TEST] Thanks for reaching out to DK Benefits');
  assert.equal(ctx.sheets.FollowUps.rows[1][5], 'sent');
});

test('the follow-up sender logs why each row waited or was skipped', function () {
  const ctx = boot();
  const lines = [];
  ctx.console = { log: function (line) { lines.push(String(line)); } };
  ctx.Logger = { log: function (line) { lines.push(String(line)); } };
  const base = Date.parse('2026-10-08T15:56:43.000Z');
  ctx.CONTACT_TEST_NOW = base;
  const body = payload({
    test: true,
    lead: { email: 'ada@northwind.example', firstName: 'Ada', message: 'Log this follow-up.' }
  }, '41414141-4141-4414-8414-414141414141');
  assert.equal(ctx.post(body).followUpQueued, true);
  lines.length = 0;
  ctx.contactSendDueFollowUps();
  assert.match(lines.join('\n'), /found 1 follow-up row\(s\)/);
  assert.match(lines.join('\n'), /reason=not due for \d+ more minute\(s\)/);
  ctx.sheets.FollowUps.rows[1][0] = 'not-a-time';
  ctx.CONTACT_TEST_NOW = base + 11 * 60 * 1000;
  lines.length = 0;
  ctx.contactSendDueFollowUps();
  assert.match(lines.join('\n'), /reason=timestamp not readable/);
  assert.equal(ctx.sheets.FollowUps.rows[1][5], 'pending');
});

test('a follow-up is skipped when the address already used the hourly limit', function () {
  const ctx = boot();
  const base = Date.parse('2026-10-08T16:00:00.000Z');
  ctx.CONTACT_TEST_NOW = base;
  assert.equal(ctx.post(payload()).followUpQueued, true);
  assert.equal(ctx.contactFollowUpAllowed_('ada@northwind.example'), true);
  assert.equal(ctx.contactFollowUpAllowed_('ada@northwind.example'), true);
  assert.equal(ctx.contactFollowUpAllowed_('ada@northwind.example'), true);
  assert.equal(ctx.contactFollowUpAllowed_('ada@northwind.example'), false);
  ctx.CONTACT_TEST_NOW = base + 11 * 60 * 1000;
  ctx.contactSendDueFollowUps();
  assert.equal(ctx.sent.filter(function (message) { return message.to === 'ada@northwind.example'; }).length, 0);
  assert.equal(ctx.sheets.FollowUps.rows[1][5], 'skipped');
  assert.equal(ctx.sheets.FollowUps.rows[1][8], 'hourly limit');
});

test('setup creates the three tabs and one five-minute trigger', function () {
  const ctx = boot();
  ctx.setup();
  ctx.setup();
  assert.ok(ctx.sheets.Submissions);
  assert.ok(ctx.sheets.FollowUps);
  assert.ok(ctx.sheets.Events);
  assert.equal(ctx.sheets.Submissions.rows[0].slice(0, 4).join('|'), 'timestamp|submission_id|status|test');
  assert.equal(ctx.triggers.length, 1);
  assert.equal(ctx.triggerMinutes, 5);
});

test('an extra notify address on the payload cannot change who gets the lead', function () {
  const ctx = boot();
  const body = payload(null, '42424242-4242-4424-8424-424242424242');
  body.notifyEmail = 'other@example.com';
  body.to = 'other@example.com';
  body.lead.email = 'visitor@example.com';
  assert.equal(ctx.post(body).ok, true);
  assert.equal(ctx.sent.length, 1);
  assert.equal(ctx.sent[0].to, 'dan@dkbenefits.net');
  assert.equal(ctx.sent[0].replyTo, 'visitor@example.com');
  ctx.sent.forEach(function (message) {
    if (String(message.body || '').indexOf('New message from the DK Benefits contact form') === 0) {
      assert.equal(message.to, 'dan@dkbenefits.net');
    }
  });
});

test('unrecognized and unreadable posts are rejected', function () {
  const ctx = boot();
  assert.equal(ctx.post({ event: 'other' }).ok, false);
  const raw = ctx.doPost({ postData: { contents: '{' } });
  assert.equal(JSON.parse(raw.getContent()).ok, false);
  assert.equal(ctx.sent.length, 0);
});
