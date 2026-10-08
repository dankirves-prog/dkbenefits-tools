const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { loadBrowserScripts, baseInput, ASOF } = require('./helpers');

const root = path.join(__dirname, '..');
const ctx = loadBrowserScripts();
const { S128Model, S128Docgen, S128Terms } = ctx;

const BANNED = [
  /received your draft/i,
  /will follow up/i,
  /follow-up/i,
  /we'll review/i,
  /we will review/i,
  /Daniel Kirves will/i,
  /Daniel will review/i,
  /Daniel reviews/i,
  /DK Benefits reviews/i,
  /draft for review/i,
  /Daniel at DK Benefits received/i
];

const FILES = [
  'index.html',
  'section128.js',
  's128-terms.js',
  's128-tips.js',
  's128-docgen.js',
  's128-pdf.js'
];

test('visitor-facing files do not say DK Benefits reviews or follows up on the draft', function () {
  FILES.forEach(function (file) {
    const text = fs.readFileSync(path.join(root, file), 'utf8');
    BANNED.forEach(function (pattern) {
      assert.doesNotMatch(text, pattern, file + ' matched ' + pattern);
    });
  });
});

test('combined visitor email and guide stay educational', function () {
  const input = baseInput({
    funding_mode: 'combined',
    employer_annual_grant: '1000',
    cafeteria_plan_name: 'Northwind Cafeteria Plan',
    cafeteria_amendment_date: '2027-01-01',
    election_cutoff_days: '5',
    has_existing_125_plan: 'yes'
  });
  const checked = S128Model.validate(input, { asOf: ASOF });
  assert.equal(checked.ok, true, JSON.stringify(checked.errors));
  const email = S128Docgen.visitorEmailText(checked.plan, checked.lead);
  BANNED.forEach(function (pattern) { assert.doesNotMatch(email, pattern); });
  assert.match(email, /for the employer’s review with its own advisors/);
  assert.match(email, /as is/i);
  assert.match(S128Terms.CHECKBOX, /hold harmless and indemnify/);
  assert.match(S128Terms.CHECKBOX, /as is/i);
  assert.match(S128Terms.CHECKBOX, /attorney-client/);
  assert.equal(S128Terms.VERSION, 's128-terms-2026-10-08');
  assert.match(S128Docgen.HEADER, /SAMPLE DRAFT/);
  assert.doesNotMatch(S128Docgen.HEADER, /draft for review/i);
});
