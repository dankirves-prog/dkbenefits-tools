const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { loadBrowserScripts, baseInput, root } = require('./helpers');

function boot() {
  const context = loadBrowserScripts();
  const sheets = {};
  function Sheet(name) { this.name = name; this.rows = []; }
  Sheet.prototype.appendRow = function (row) { this.rows.push(row.slice()); };
  Sheet.prototype.getDataRange = function () {
    const rows = this.rows;
    return { getValues: function () { return rows.map(function (row) { return row.slice(); }); } };
  };
  Sheet.prototype.getRange = function (r, c) {
    const sheet = this;
    return { setValue: function (value) { sheet.rows[r - 1][c - 1] = value; } };
  };
  const sent = [];
  context.sent = sent;
  context.SpreadsheetApp = {
    getActiveSpreadsheet: function () {
      return {
        getSheetByName: function (name) { return sheets[name] || null; },
        insertSheet: function (name) { sheets[name] = new Sheet(name); return sheets[name]; }
      };
    }
  };
  context.MailApp = { sendEmail: function (message) { sent.push(message); } };
  context.ScriptApp = {
    getProjectTriggers: function () { return []; },
    newTrigger: function () {
      return { timeBased: function () { return { everyMinutes: function () { return { create: function () {} }; } }; } };
    }
  };
  context.ContentService = { MimeType: { TEXT: 'text', JSON: 'json' }, createTextOutput: function (text) { return { setMimeType: function () { return text; } }; } };
  context.Utilities = {
    base64Decode: function (raw) { return Uint8Array.from(Buffer.from(raw, 'base64')); },
    newBlob: function (bytes, mime, name) { return { bytes: bytes, mime: mime, name: name }; }
  };
  context.sheets = sheets;
  vm.runInContext(fs.readFileSync(path.join(root, 'apps-script', 'Code.gs'), 'utf8'), context, { filename: 'Code.gs' });
  return context;
}

function payload(overrides) {
  const started = Date.now() - 10000;
  return Object.assign({
    event: 'wp_submission',
    submissionId: 'wp-test-12345678',
    startedAt: new Date(started).toISOString(),
    submittedAt: new Date().toISOString(),
    test: true,
    hp: '',
    plan: baseInput(),
    acknowledgement: { accepted: true, acceptedAt: new Date().toISOString(), termsVersion: 'wp-terms-1' },
    files: []
  }, overrides || {});
}

test('(e) a honeypot and a fast submit send no mail', function () {
  const context = boot();
  assert.equal(context.wpHandle_(payload({ hp: 'https://spam.example' })).ok, false);
  assert.equal(context.sent.length, 0);
  const fast = payload();
  fast.startedAt = fast.submittedAt;
  assert.equal(context.wpHandle_(fast).ok, false);
  assert.equal(context.sent.length, 0);
});

test('(e) a good submit emails Dan with findings, and the visitor note waits for business hours', function () {
  const context = boot();
  const result = context.wpHandle_(payload());
  assert.equal(result.ok, true);
  assert.equal(result.visitorEmailed, false);
  assert.equal(context.sent.length, 1);
  assert.equal(context.sent[0].to, 'dan@dkbenefits.net');
  assert.match(context.sent[0].body, /Findings/);
  assert.match(context.sent[0].subject, /\[TEST\] New Wrap Plan Lead/);
  const due = Date.parse('2026-10-15T23:05:00Z');
  const when = new Date(context.wpFollowUpWhen_(due));
  const hour = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', hour: '2-digit', hourCycle: 'h23' }).format(when);
  assert.equal(hour, '07');
  const follow = context.sheets.FollowUps.rows[1];
  assert.equal(follow[4], 'pending');
  follow[9] = new Date(Date.now() - 60000).toISOString();
  context.wpSendDueFollowUps();
  const note = context.sent[context.sent.length - 1];
  assert.notEqual(note.to, 'dan@dkbenefits.net');
  assert.match(note.body, /Hi Alex,/);
  assert.match(note.body, /I noticed you created your wrap plan document, and I hope it's useful for you\./);
  assert.match(note.body, /I'm an independent employee benefits broker/);
  assert.match(note.body, /If you don't want to hear from me that's fine too just let me know\./);
  assert.match(note.body, /Florida Agency Lic# L109331/);
  assert.match(note.htmlBody, /<strong>Daniel Kirves<\/strong>/);
  assert.match(note.htmlBody, /<em>Expert Guidance\. Smarter Benefits\. Better Savings\.<\/em>/);
  assert.doesNotMatch(note.body, /Thanks, Dan/);
});

test('(e) the renewal reminder goes to Dan and is not a visitor follow-up', function () {
  const context = boot();
  context.wpHandle_(payload());
  const followRows = context.sheets.FollowUps.rows.length;
  const subs = context.sheets.Submissions;
  subs.rows[1][23] = '2020-01-01';
  context.wpSendDueRenewals();
  const renewal = context.sent.filter(function (message) { return /renewal reminder/i.test(message.subject); });
  assert.equal(renewal.length, 1);
  assert.equal(renewal[0].to, 'dan@dkbenefits.net');
  assert.equal(context.sheets.FollowUps.rows.length, followRows);
});

test('submission headers include employee count, role, utm, and referrer', function () {
  const text = fs.readFileSync(path.join(root, 'apps-script', 'Code.gs'), 'utf8');
  assert.match(text, /employee_count/);
  assert.match(text, /'role'/);
  assert.match(text, /'utm'/);
  assert.match(text, /'referrer'/);
});
