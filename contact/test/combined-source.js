const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');

function combinedSource() {
  const header = [
    '/**',
    ' * DK Benefits contact form lead service.',
    ' * Paste this whole file into Apps Script as Code.gs.',
    ' * Spreadsheet: DK Benefits Contact Leads.',
    ' * Built from contact-validate.js and apps-script/Code.gs.',
    ' * Do not paste this into the quote tool or the Section 128 script.',
    ' * The lead alert is sent only to dan@dkbenefits.net.',
    ' */',
    ''
  ].join('\n');
  const validate = fs.readFileSync(path.join(root, 'contact-validate.js'), 'utf8').trim();
  const code = fs.readFileSync(path.join(root, 'apps-script', 'Code.gs'), 'utf8').trim();
  return header + '\n' + validate + '\n\n' + code + '\n';
}

module.exports = { combinedSource };
