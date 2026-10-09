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
  const links = {
    section125Url: 'https://www.dkbenefits.net/section125plantool',
    ratesUrl: 'https://www.dkbenefits.net/instant-group-quote'
  };
  const email = S128Docgen.followUpEmailText(checked.plan, checked.lead, links);
  const html = S128Docgen.followUpEmailHtml(checked.plan, checked.lead, links);
  BANNED.forEach(function (pattern) { assert.doesNotMatch(email, pattern); });
  assert.doesNotMatch(email, /attorney|does not review|attached|lowest|savings/i);
  assert.match(email, /^Hi Ada,/);
  assert.match(email, /ready on the download page/);
  assert.match(email, /Your tax advisor can help/);
  assert.match(email, /Thank you for using the DK Benefits Section 128 tool/);
  assert.match(email, /You can see instant rates for your group here/);
  assert.match(email, /When we take a group to market with full underwriting, we can often find better options/);
  assert.equal((email.match(/premium-only/g) || []).length, 1);
  assert.deepEqual(email.match(/https?:\/\/\S+/g), [
    'https://www.dkbenefits.net/instant-group-quote',
    'https://www.dkbenefits.net/section125plantool'
  ]);
  assert.equal((html.match(/<a /g) || []).length, 2);
  assert.doesNotMatch(html, /mailto:|tel:|<img|utm_/i);
  assert.equal(S128Terms.CHECKBOX, 'I understand this is an educational tool, not legal or tax advice, and my company is responsible for what it adopts. I agree to the Terms of use.');
  assert.match(S128Terms.PARAGRAPHS.join('\n'), /hold harmless/);
  assert.match(S128Terms.PARAGRAPHS.join('\n'), /attorney-client/);
  assert.equal(S128Terms.VERSION, 's128-terms-2026-10-08b');
  assert.match(S128Docgen.FOOTER, /Prepared with DK Benefits/);
  assert.match(S128Docgen.FOOTER, /Not effective until signed by the employer/);
});
