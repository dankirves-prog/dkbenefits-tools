const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.join(__dirname, '..', '..');

function read(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8');
}

test('the preview page spells out ATNE and points ALE results at the penalty calculator', function () {
  const html = read('aca-workforce-calculator.html');
  const ui = read('aca-workforce/atne-ui.js');
  const config = read('aca-workforce/config.js');
  const css = read('aca-workforce/atne.css');
  assert.match(html, /ACA Workforce Size Calculator/);
  assert.match(html, /average total number of employees/i);
  assert.match(html, /full-time equivalents/i);
  assert.match(html, /Seasonal worker exception/);
  assert.match(html, /120 days/);
  assert.match(html, /noindex, indexifembedded/);
  assert.match(config, /https:\/\/www\.dkbenefits\.net\/aca-penalty-calculator/);
  assert.match(config, /contactUrl: 'https:\/\/www\.dkbenefits\.net\/contact'/);
  assert.match(ui, /penaltyCalculatorUrl/);
  assert.match(ui, /Talk to our team/);
  assert.match(ui, /aca-workforce/);
  assert.match(css, /#1a2e4a/);
  assert.match(css, /#c8a951/);
  assert.match(css, /#16233A/);
  assert.doesNotMatch(config, /endpoint/);
  assert.doesNotMatch(config, /script\.google\.com/);
  assert.doesNotMatch(html, /lead-form|id="lead"/);
  assert.doesNotMatch(ui, /lead-form|endpointOf|script\.google/);
});

test('the new tool copy has no phone number', function () {
  const files = [
    'aca-workforce-calculator.html',
    'aca-workforce/atne-ui.js',
    'aca-workforce/atne-model.js',
    'aca-workforce/config.js',
    'aca-workforce/atne.css',
    'docs/aca-workforce-wix-copy.md'
  ];
  const phone = /\b\d{3}[-.)\s]\d{3}[-.)\s]\d{4}\b|tel:/i;
  files.forEach(function (rel) {
    const text = read(rel);
    assert.equal(phone.test(text), false, rel);
  });
});
