const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');

function artifactDir() {
  if (process.env.S125_ARTIFACT_DIR) return process.env.S125_ARTIFACT_DIR;
  const preferred = '/opt/cursor/artifacts/section125';
  try {
    fs.mkdirSync(preferred, { recursive: true });
    fs.accessSync(preferred, fs.constants.W_OK);
    return preferred;
  } catch (err) {
    const os = require('os');
    return fs.mkdtempSync(path.join(os.tmpdir(), 's125-artifacts-'));
  }
}

function loadBrowserScripts(extra) {
  const context = {
    console,
    TextEncoder,
    Uint8Array,
    Uint32Array,
    ArrayBuffer,
    Buffer
  };
  context.globalThis = context;
  context.window = context;
  context.self = context;
  if (extra) Object.assign(context, extra);
  vm.createContext(context);
  ['s125-model.js', 's125-terms.js', 's125-docgen.js'].forEach(function (file) {
    vm.runInContext(fs.readFileSync(path.join(root, file), 'utf8'), context, { filename: file });
  });
  return context;
}

function loadPdf(context) {
  vm.runInContext(fs.readFileSync(path.join(root, 'vendor', 'pdf-lib.min.js'), 'utf8'), context, { filename: 'pdf-lib.min.js' });
  vm.runInContext(fs.readFileSync(path.join(root, 's125-pdf.js'), 'utf8'), context, { filename: 's125-pdf.js' });
  return context;
}

function baseInput(overrides) {
  return Object.assign({
    employer_name: 'Northwind Benefits Inc',
    employer_ein: '12-3456789',
    plan_number: '501',
    street: '100 King Street',
    city: 'Tampa',
    state: 'FL',
    zip: '33602',
    phone: '8135550199',
    entity_type: 'c-corp',
    llc_tax: '',
    effective_date: '2027-01-01',
    plan_year_type: 'calendar',
    plan_year_start_month: '',
    plan_year_start_day: '',
    prior_plan: 'no',
    prior_adoption: '',
    plan_year_change: 'no',
    oe_window_days: '30',
    new_hire_window: '30',
    employee_count: '40',
    funding_type: 'insured',
    full_time_hours: '30',
    waiting_period: 'none',
    eligible_classes: ['full-time'],
    eligible_class_other: '',
    multi_state: 'no',
    benefits: ['medical', 'dental', 'vision'],
    health_fsa_design: '',
    health_fsa_unused: '',
    dcap_unused: '',
    signer_name: 'Ada Lopez',
    signer_title: 'President',
    signer_email: 'ada@northwind.example'
  }, overrides || {});
}

const ASOF = '2026-10-09';
const LINKS = {
  section128Url: 'https://www.dkbenefits.net/section-128-tool',
  ratesUrl: 'https://www.dkbenefits.net/instant-group-quote'
};

module.exports = { loadBrowserScripts, loadPdf, baseInput, ASOF, LINKS, root, artifactDir };
