const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const FILES = [
  'index.html', 'wrapplan.js', 'wrapplan.css', 'embed.html', 'config.js',
  'wp-model.js', 'wp-docgen.js', 'wp-pdf.js', 'wp-terms.js', 'wp-tips.js'
];

test('visitor copy has no stale years or dollar amounts beyond the allowed model sentence', function () {
  const hits = [];
  FILES.forEach(function (file) {
    const text = fs.readFileSync(path.join(root, file), 'utf8')
      .replace(/https?:\/\/[^\s"'<>]+/g, '');
    const years = text.match(/\b(19|20)\d{2}\b/g) || [];
    years.forEach(function (year) {
      if (year !== '1974') hits.push(file + ' year ' + year);
    });
    if (text.indexOf('\u2014') !== -1 || text.indexOf('\u2013') !== -1) hits.push(file + ' dash');
    const dollars = text.match(/\$\d[\d,]*/g) || [];
    dollars.forEach(function (amount) {
      if (amount !== '$110') hits.push(file + ' dollar ' + amount);
    });
  });
  assert.deepEqual(hits, []);
});
