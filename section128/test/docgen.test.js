const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');
const { loadBrowserScripts, baseInput, ASOF, artifactDir } = require('./helpers');

const ctx = loadBrowserScripts();
vmPdf(ctx);
const { S128Model, S128Docgen, S128Pdf } = ctx;
const outDir = fs.mkdtempSync(path.join(os.tmpdir(), 's128-docs-'));

function vmPdf(context) {
  const vm = require('vm');
  const pdfPath = path.join(__dirname, '..', 'vendor', 'pdf-lib.min.js');
  vm.runInContext(fs.readFileSync(pdfPath, 'utf8'), context, { filename: 'pdf-lib.min.js' });
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 's128-pdf.js'), 'utf8'), context, { filename: 's128-pdf.js' });
}

function planFor(overrides) {
  const result = S128Model.validate(baseInput(overrides), { asOf: ASOF });
  assert.equal(result.ok, true, JSON.stringify(result.errors));
  return result.plan;
}

const salaryFields = {
  cafeteria_plan_name: 'Northwind Cafeteria Plan',
  cafeteria_amendment_date: '2027-01-01',
  election_cutoff_days: '5',
  has_existing_125_plan: 'yes'
};

function textOf(bytes) {
  const stamp = Math.random().toString(16).slice(2);
  const file = path.join(outDir, 'one-' + stamp + '.docx');
  fs.writeFileSync(file, Buffer.from(bytes));
  const unzipDir = path.join(outDir, 'unzip-' + stamp);
  fs.mkdirSync(unzipDir);
  execFileSync('python3', ['-c', 'import zipfile,sys; zipfile.ZipFile(sys.argv[1]).extractall(sys.argv[2])', file, unzipDir]);
  return {
    document: fs.readFileSync(path.join(unzipDir, 'word', 'document.xml'), 'utf8'),
    header: fs.readFileSync(path.join(unzipDir, 'word', 'header1.xml'), 'utf8'),
    footer: fs.readFileSync(path.join(unzipDir, 'word', 'footer1.xml'), 'utf8'),
    core: fs.readFileSync(path.join(unzipDir, 'docProps', 'core.xml'), 'utf8')
  };
}

function plain(xml) {
  return xml.replace(/<w:p[ >]/g, '\n').replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
}

function assertClean(xml, mode) {
  const text = plain(xml);
  assert.doesNotMatch(text, /\{\{|\}\}|\[\[|\]\]|\[\s*\]/);
  text.split('\n').forEach(function (line) {
    if (line.includes('____')) assert.match(line, /Signature:/);
  });
  assert.match(text, /Signature: _{10,}\s+Date: _{8,}/);
  assert.doesNotMatch(text, /Signature:[^\n]*October|Signature:[^\n]*2027/);
  let order = -1;
  for (let n = 1; n <= 12; n++) {
    const idx = text.indexOf('Article ' + n);
    assert.ok(idx > order, 'Article ' + n);
    order = idx;
  }
  assert.match(text, /Articles 1 through 12/);
  assert.match(text, /on or before January 31/);
  assert.match(text, /claimed and activated cannot receive Program contributions/);
  assert.match(text, /DRAFT FOR REVIEW/);
  if (mode === 'employer_only') {
    const rest = text.split('\n').filter(function (line) { return line.indexOf('Reserved:') === -1; }).join('\n');
    assert.doesNotMatch(rest, /\bsalary\b|\bdeduction\b|\bwithheld\b|\bcafeteria\b|section 125/i);
  }
  if (mode === 'salary_reduction_only') {
    assert.doesNotMatch(text, /Annual employer grant per employee:/);
    assert.doesNotMatch(text, /uniform annual grant of \$/);
    assert.doesNotMatch(text, /grant is paid/i);
    assert.match(text, /No employer grant is provided/);
  }
}

const cases = [
  ['employer-statutory', { funding_mode: 'employer_only', annual_cap_mode: 'statutory' }, 'employer_only'],
  ['employer-fixed', { funding_mode: 'employer_only', annual_cap_mode: 'fixed', fixed_annual_cap: '1500', employer_annual_grant: '1000' }, 'employer_only'],
  ['salary-statutory', Object.assign({ funding_mode: 'salary_reduction_only', employer_annual_grant: '', annual_cap_mode: 'statutory' }, salaryFields), 'salary_reduction_only'],
  ['salary-fixed', Object.assign({ funding_mode: 'salary_reduction_only', employer_annual_grant: '', annual_cap_mode: 'fixed', fixed_annual_cap: '900' }, salaryFields), 'salary_reduction_only'],
  ['combined-statutory', Object.assign({ funding_mode: 'combined', employer_annual_grant: '1000', annual_cap_mode: 'statutory' }, salaryFields), 'combined'],
  ['combined-fixed', Object.assign({ funding_mode: 'combined', employer_annual_grant: '1000', annual_cap_mode: 'fixed', fixed_annual_cap: '2500' }, salaryFields), 'combined']
];

for (const [name, overrides, mode] of cases) {
  test('docx ' + name, function () {
    const plan = planFor(overrides);
    const bytes = S128Docgen.buildPlanDocx(plan);
    const packed = textOf(bytes);
    assertClean(packed.document, mode);
    assert.match(packed.header, /DRAFT FOR REVIEW/);
    assert.match(packed.footer, /PAGE/);
    assert.match(packed.footer, /Draft for review/);
    assert.match(packed.core, /DK Benefits LLC/);
    assert.doesNotMatch(packed.core, /python-docx/);
    assert.match(packed.core, new RegExp(plan.plan_name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
    assert.match(plain(packed.document), new RegExp(plan.employer_name));
    assert.match(plain(packed.document), /12-3456789/);
    assert.match(plain(packed.document), /Orlando, FL 32801/);
    assert.doesNotMatch(plain(packed.document), /Orlando, FL, 32801/);
    assert.match(plain(packed.document), /January 1, 2027/);
    assert.match(plain(packed.document), /Plan purpose, definitions, and participation/);
    assert.match(plain(packed.document), /Employee notices, tax treatment, and records/);
    assert.match(plain(packed.document), /Testing, corrections, and employer authority/);
    assert.match(plain(packed.document), /Designation, certification, and verification/);
    assert.match(plain(packed.document), /Amendment, termination, and individual ownership/);
    assert.match(plain(packed.document), /cannot receive Program contributions until a parent or guardian claims it/);
    const capLine = plain(packed.document).split('\n').find(function (line) { return line.indexOf('The program annual cap is') === 0; });
    assert.equal((capLine.match(/\$2,500/g) || []).length, 1);
    if (overrides.annual_cap_mode === 'fixed') assert.match(capLine, /fixed employer cap does not increase automatically/);
    else assert.doesNotMatch(capLine, /fixed employer cap does not increase automatically/);
    if (mode === 'combined') assert.match(plain(packed.document), /Salary reduction cannot consume the amount reserved/);
    if (overrides.annual_cap_mode === 'fixed') assert.match(plain(packed.document), /\$1,500|\$900|\$2,500/);
    const amendment = S128Docgen.buildAmendmentDocx(plan);
    if (mode === 'employer_only') {
      assert.equal(amendment, null);
    } else {
      const amendText = plain(textOf(amendment).document);
      assert.match(amendText, /Draft Amendment to Northwind Cafeteria Plan/);
      assert.match(amendText, /Signature: _{10,}/);
      assert.doesNotMatch(amendText, /\{\{|\[\s*\]/);
      if (mode === 'combined') assert.match(amendText, /reservation of the annual employer grant of \$1,000/);
      if (mode === 'salary_reduction_only') {
        assert.doesNotMatch(amendText, /reservation of the annual employer grant/);
        assert.doesNotMatch(plain(packed.document), /cash substitute for an employer grant/);
      }
      if (mode === 'combined') assert.match(plain(packed.document), /cash substitute for an employer grant/);
      assert.match(amendText, /Payment, tax treatment, and compliance/);
      assert.match(amendText, /does not amend Northwind Cafeteria Plan/);
      assert.doesNotMatch(amendText, /does not establish the Program/);
      assert.doesNotMatch(amendText, /subject to the statutory maximum/);
    }
    fs.writeFileSync(path.join(outDir, name + '.docx'), Buffer.from(bytes));
  });
}

test('2028 plan does not print unpublished indexed amounts', function () {
  const plan = planFor({ effective_date: '2028-01-01', employer_annual_grant: '1000' });
  const text = plain(textOf(S128Docgen.buildPlanDocx(plan)).document);
  assert.doesNotMatch(text, /\$2,500/);
  assert.doesNotMatch(text, /\$5,000/);
  assert.match(text, /has not been published|not been published|none has been published/i);
  assert.match(text, /\$1,000/);
});

test('salary reduction without a confirmed cafeteria plan does not build an amendment', function () {
  const plan = planFor({
    funding_mode: 'salary_reduction_only',
    employer_annual_grant: '',
    election_cutoff_days: '5',
    has_existing_125_plan: 'no'
  });
  const text = plain(textOf(S128Docgen.buildPlanDocx(plan)).document);
  assert.match(text, /cafeteria plan was not confirmed/);
  assert.match(text, /Salary reduction/);
  assert.doesNotMatch(text, /Section 125 plan name:/);
  assert.equal(S128Docgen.buildAmendmentDocx(plan), null);
  assert.match(text, /cannot receive Program contributions until a parent or guardian claims it/);
});

test('LibreOffice renders each funding method and pdf-lib matches the text', async function () {
  const artifacts = artifactDir();
  fs.mkdirSync(artifacts, { recursive: true });
  const sampleMap = {
    'employer-statutory': cases[0][1],
    'salary-statutory': cases[2][1],
    'combined-fixed': cases[5][1]
  };
  const samples = Object.keys(sampleMap);
  for (const name of samples) {
    const docx = path.join(outDir, name + '-render.docx');
    fs.writeFileSync(docx, Buffer.from(S128Docgen.buildPlanDocx(planFor(sampleMap[name]))));
    execFileSync('soffice', ['--headless', '--convert-to', 'pdf', '--outdir', outDir, docx], { timeout: 120000 });
    const renderedPdf = path.join(outDir, name + '-render.pdf');
    const rendered = execFileSync('pdftotext', ['-layout', renderedPdf, '-'], { encoding: 'utf8' });
    assert.match(rendered, /Northwind Benefits LLC/);
    assert.match(rendered, /DRAFT FOR REVIEW/);
    assert.match(rendered, /Article 12/);
    assert.match(rendered, /January 31/);
    assert.doesNotMatch(rendered, /\{\{|\[\s*\]/);
    execFileSync('pdftoppm', ['-png', '-f', '1', '-l', '1', '-r', '80', renderedPdf, path.join(artifacts, name)]);
    fs.copyFileSync(docx, path.join(artifacts, name + '.docx'));
    fs.copyFileSync(renderedPdf, path.join(artifacts, name + '-libreoffice.pdf'));
  }
  const plan = planFor(Object.assign({ funding_mode: 'combined', employer_annual_grant: '1000' }, salaryFields));
  const pdfBytes = await S128Pdf.buildPdf(S128Docgen.planParagraphs(plan), { title: plan.plan_name });
  const pdfPath = path.join(artifacts, 'combined-statutory-pdflib.pdf');
  fs.writeFileSync(pdfPath, Buffer.from(pdfBytes));
  const pdfText = execFileSync('pdftotext', ['-layout', pdfPath, '-'], { encoding: 'utf8' });
  assert.match(pdfText, /Northwind Benefits LLC/);
  assert.match(pdfText, /Salary reduction cannot consume/);
  assert.match(pdfText, /Draft for review\s+\|\s+1/);
  assert.match(pdfText, /Ada Lopez/);
  const einLine = pdfText.split('\n').find(function (line) { return line.indexOf('Employer EIN:') !== -1; });
  assert.ok(einLine);
  assert.match(einLine, /12-3456789/);
  assert.doesNotMatch(einLine, /Effective date/);
  assert.match(pdfText, /Effective date: January 1, 2027/);
  const amendmentPdf = await S128Pdf.buildPdf(S128Docgen.amendmentParagraphs(plan), { title: 'amendment' });
  const amendmentPath = path.join(artifacts, 'combined-amendment-pdflib.pdf');
  fs.writeFileSync(amendmentPath, Buffer.from(amendmentPdf));
  const amendmentText = execFileSync('pdftotext', ['-layout', amendmentPath, '-'], { encoding: 'utf8' });
  assert.match(amendmentText, /reservation of the annual employer grant of\s+\$1,000/);
  assert.match(amendmentText, /Signature:/);
});
