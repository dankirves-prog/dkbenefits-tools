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
  const email = S128Docgen.followUpEmailText(checked.plan, checked.lead, {
    section125Url: 'https://dankirves-prog.github.io/dkbenefits-tools/section125.html',
    ratesUrl: 'https://dankirves-prog.github.io/dkbenefits-tools/quote-tool-demo/'
  });
  BANNED.forEach(function (pattern) { assert.doesNotMatch(email, pattern); });
  assert.doesNotMatch(email, /attorney|does not review|attached|lowest/i);
  assert.match(email, /Your tax advisor can help/);
  assert.match(email, /Thanks for using our Section 128 tool/);
  assert.match(email, /section125\.html/);
  assert.match(email, /quote-tool-demo/);
  assert.equal(S128Terms.CHECKBOX, 'I understand this is an educational tool, not legal or tax advice, and my company is responsible for what it adopts. I agree to the Terms of use.');
  assert.match(S128Terms.PARAGRAPHS.join('\n'), /hold harmless/);
  assert.match(S128Terms.PARAGRAPHS.join('\n'), /attorney-client/);
  assert.equal(S128Terms.VERSION, 's128-terms-2026-10-08b');
  assert.match(S128Docgen.FOOTER, /Prepared with DK Benefits/);
  assert.match(S128Docgen.FOOTER, /Not effective until signed by the employer/);
});
