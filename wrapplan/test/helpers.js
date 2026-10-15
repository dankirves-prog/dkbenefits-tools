const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');

function loadBrowserScripts() {
  const context = { console, TextEncoder, Uint8Array, Uint32Array, ArrayBuffer, Buffer, setTimeout, clearTimeout };
  context.globalThis = context;
  context.window = context;
  context.self = context;
  vm.createContext(context);
  ['wp-model.js', 'wp-terms.js', 'wp-docgen.js'].forEach(function (file) {
    vm.runInContext(fs.readFileSync(path.join(root, file), 'utf8'), context, { filename: file });
  });
  return context;
}

function loadPdf(context) {
  vm.runInContext(fs.readFileSync(path.join(root, 'vendor', 'pdf-lib.min.js'), 'utf8'), context, { filename: 'pdf-lib.min.js' });
  vm.runInContext(fs.readFileSync(path.join(root, 'wp-pdf.js'), 'utf8'), context, { filename: 'wp-pdf.js' });
  return context;
}

function baseInput(overrides) {
  return Object.assign({
    erisa_path: 'private',
    employer_name: 'Harbor Dental Group LLC',
    employer_ein: '59-1234567',
    phone: '4075550148',
    street: '100 Colonial Drive',
    city: 'Orlando',
    state: 'FL',
    zip: '32801',
    plan_number: '501',
    original_effective_date: '2026-06-01',
    is_restatement: 'no',
    plan_year_type: 'calendar',
    waiting_period: 'date-of-hire',
    employee_count: '22',
    benefits: ['medical', 'dental', 'vision', 'life'],
    carriers: { medical: 'Florida Blue', dental: 'Sun Life', vision: 'VSP', life: 'Sun Life' },
    carrier_addresses: {
      medical: '4800 Deerwood Campus Parkway, Jacksonville, FL 32246',
      dental: '1 Sun Life Executive Park, Wellesley Hills, MA 02481',
      vision: '3333 Quality Drive, Rancho Cordova, CA 95670'
    },
    funding: 'insured',
    network: 'traditional',
    stop_loss: 'no',
    classes: 'Full-time employees',
    hours: '30 hours a week',
    dependents: 'Spouse and children to age 26',
    census: { a: '22', b: '0', c: '0', d: '0' },
    employee_contributions: 'yes',
    remitted: 'yes',
    section125: 'yes',
    tax: { medical: 'pretax', dental: 'pretax', vision: 'pretax', life: 'pretax' },
    trust: 'no',
    cobra: 'no',
    cobra_admin: 'Employer',
    appeals: 'carrier',
    bargaining: 'no',
    phi: 'no',
    certificates: 'yes',
    signer_name: 'Alex Rivera',
    signer_title: 'Managing Member',
    governing_body: 'LLC members',
    contact_name: 'Alex Rivera',
    contact_email: 'hr@harbordental.example',
    contact_phone: '',
    role: 'employer',
    prior_small_filing: 'no'
  }, overrides || {});
}

module.exports = { loadBrowserScripts, loadPdf, baseInput, root };
