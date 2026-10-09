const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');

function artifactDir() {
  var dir = process.env.S128_ARTIFACT_DIR || '/opt/cursor/artifacts/section128';
  try {
    fs.mkdirSync(dir, { recursive: true });
    fs.accessSync(dir, fs.constants.W_OK);
    return dir;
  } catch (err) {
    const os = require('os');
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 's128-artifacts-'));
    fs.mkdirSync(dir, { recursive: true });
    return dir;
  }
}

function loadBrowserScripts(extra) {
  const context = {
    console,
    TextEncoder,
    Uint8Array,
    Uint32Array
  };
  context.globalThis = context;
  if (extra) Object.assign(context, extra);
  vm.createContext(context);
  ['s128-model.js', 's128-terms.js', 's128-docgen.js'].forEach(function (file) {
    vm.runInContext(fs.readFileSync(path.join(root, file), 'utf8'), context, { filename: file });
  });
  return context;
}

function baseInput(overrides) {
  return Object.assign({
    employer_name: 'Northwind Benefits LLC',
    employer_ein: '12-3456789',
    street: '100 King Street',
    city: 'Orlando',
    state: 'FL',
    zip: '32801',
    contact_name: 'Ada Lopez',
    contact_title: 'Owner',
    contact_email: 'ada@northwind.example',
    contact_phone: '(407) 555-0100',
    total_employee_count: '25',
    funding_mode: 'employer_only',
    employer_annual_grant: '1000',
    annual_cap_mode: 'statutory',
    allow_employee_account: 'no',
    eligibility_class_choice: 'all',
    waiting_days: '0',
    plan_name: 'Northwind Trump Account Contribution Program',
    effective_date: '2027-01-01',
    participating_employers: '',
    entity_type: 'c_corp',
    related_businesses: 'no',
    owners_or_family_want_to_participate: 'no',
    collectively_bargained_employees: 'no',
    administrator_name: 'HR Manager',
    administrator_contact: 'hr@northwind.example',
    signer_name: 'Ada Lopez',
    signer_title: 'Owner'
  }, overrides || {});
}

const ASOF = '2026-10-08';

module.exports = { loadBrowserScripts, baseInput, ASOF, root, artifactDir };
