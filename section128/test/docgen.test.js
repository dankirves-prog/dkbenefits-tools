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
    if (line.includes('____')) assert.match(line, /Signature:|Date:/);
  });
  assert.match(text, /Employer signature/);
  assert.match(text, /Authorized representative: Ada Lopez/);
  assert.match(text, /\nTitle: Owner/);
  assert.match(text, /Signature: _{10,}/);
  assert.match(text, /Date: _{8,}/);
  assert.doesNotMatch(text, /Signature:[^\n]*Date:/);
  assert.doesNotMatch(text, /Authorized representative:[^\n]*Title:/);
  assert.doesNotMatch(text, /Signature:[^\n]*October|Signature:[^\n]*2027/);
  let order = -1;
  for (let n = 1; n <= 12; n++) {
    const idx = text.indexOf('Article ' + n);
    assert.ok(idx > order, 'Article ' + n);
    order = idx;
  }
  assert.match(text, /Articles 1 through 12/);
  assert.match(text, /on or before January 31/);
  assert.match(text, /\(an auto account\) cannot receive Program contributions/);
  assert.match(text, /only to the claimed Trump account that receives its balance, once that account is activated/);
  assert.doesNotMatch(text, /SAMPLE DRAFT|signature and date above are blank/i);
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
    assert.doesNotMatch(packed.header, /SAMPLE|DRAFT|Prepared with/);
    assert.match(packed.footer, /Prepared with DK Benefits/);
    assert.match(packed.footer, /Not effective until signed by the employer/);
    assert.match(packed.footer, /PAGE/);
    assert.doesNotMatch(packed.footer, /Sample draft/);
    assert.match(packed.core, /s128-v0\.5\.1-2026-10-09/);
    assert.doesNotMatch(S128Docgen.planFileName(plan), /DRAFT/);
    assert.match(S128Docgen.planFileName(plan), /_v0\.5\.docx$/);
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
    assert.match(plain(packed.document), /cannot receive Program contributions; after a parent or guardian claims it, contributions can go only to the claimed account/);
    const capLine = plain(packed.document).split('\n').find(function (line) { return line.indexOf('The program annual cap is') === 0; });
    assert.equal((capLine.match(/\$2,500/g) || []).length, 1);
    if (overrides.annual_cap_mode === 'fixed') assert.match(capLine, /fixed employer cap does not increase automatically/);
    else assert.doesNotMatch(capLine, /fixed employer cap does not increase automatically/);
    if (mode === 'combined') assert.match(plain(packed.document), /together cannot exceed the annual limit per employee/);
    if (overrides.annual_cap_mode === 'fixed') assert.match(plain(packed.document), /\$1,500|\$900|\$2,500/);
    const amendment = S128Docgen.buildAmendmentDocx(plan);
    if (mode === 'employer_only') {
      assert.equal(amendment, null);
    } else {
      const amendText = plain(textOf(amendment).document);
      assert.match(amendText, /Amendment to Northwind Cafeteria Plan/);
      assert.doesNotMatch(amendText, /Sample amendment|SAMPLE DRAFT/);
      assert.match(amendText, /Employer signature/);
      assert.match(amendText, /Authorized representative: Ada Lopez/);
      assert.match(amendText, /Signature: _{10,}/);
      assert.match(amendText, /Date: _{8,}/);
      assert.doesNotMatch(amendText, /Signature:[^\n]*Date:/);
      assert.doesNotMatch(amendText, /Authorized representative:[^\n]*Title:/);
      assert.doesNotMatch(amendText, /\{\{|\[\s*\]/);
      if (mode === 'combined') {
        assert.match(amendText, /With a \$1,000 grant/);
        assert.match(amendText, /\$1,500 through payroll/);
      }
      if (mode === 'salary_reduction_only') {
        assert.doesNotMatch(amendText, /reservation of the annual employer grant/);
        assert.doesNotMatch(plain(packed.document), /cash substitute for an employer grant/);
      }
      if (mode === 'combined') assert.match(plain(packed.document), /cash substitute for an employer grant/);
      assert.match(amendText, /Payment, tax treatment, and compliance/);
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
  assert.doesNotMatch(text, /has not been published|not stated until|none has been published/i);
  assert.match(text, /as adjusted under Section 128\(b\)\(2\)/);
  assert.match(text, /The base amount is adjusted after 2027/);
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
  assert.match(text, /cannot receive Program contributions; after a parent or guardian claims it, contributions can go only to the claimed account/);
});

test('amendment signature stays on one page, including a long employer and plan name', function () {
  const employer = 'Northwind Regional Benefits Cooperative LLC of Greater Orlando';
  const planName = 'Northwind Regional Trump Account Contribution Program';
  assert.ok(employer.length >= 60 && employer.length <= 70, employer.length);
  assert.ok(planName.length >= 50 && planName.length <= 60, planName.length);
  const plan = planFor(Object.assign({
    funding_mode: 'combined',
    employer_name: employer,
    plan_name: planName,
    employer_annual_grant: '1000'
  }, salaryFields));
  const bytes = S128Docgen.buildAmendmentDocx(plan);
  const packed = textOf(bytes);
  const xmlDoc = packed.document;
  const at = xmlDoc.indexOf('Employer signature');
  const signatureXml = xmlDoc.slice(Math.max(0, at - 500));
  assert.ok(at > 0, 'signature heading');
  assert.ok((signatureXml.match(/<w:keepNext\/>/g) || []).length >= 4);
  assert.ok((signatureXml.match(/<w:keepLines\/>/g) || []).length >= 5);
  assert.match(signatureXml, /w:spacing w:before="120"/);
  assert.doesNotMatch(signatureXml.split('Date:')[0], /<w:p\/>|<w:p><\/w:p>/);
  const planDoc = textOf(S128Docgen.buildPlanDocx(plan)).document;
  const planAt = planDoc.indexOf('Employer signature');
  const planXml = planDoc.slice(Math.max(0, planAt - 500), planAt + 1200);
  assert.ok((planXml.match(/<w:keepNext\/>/g) || []).length >= 4);
  assert.ok((planXml.match(/<w:keepLines\/>/g) || []).length >= 5);
  const docx = path.join(outDir, 'long-name-amendment.docx');
  fs.writeFileSync(docx, Buffer.from(bytes));
  execFileSync('soffice', ['--headless', '--convert-to', 'pdf', '--outdir', outDir, docx], { timeout: 120000 });
  const pdf = path.join(outDir, 'long-name-amendment.pdf');
  const info = execFileSync('pdfinfo', [pdf], { encoding: 'utf8' });
  assert.equal(Number((info.match(/Pages:\s+(\d+)/) || [])[1]), 1);
  const page1 = execFileSync('pdftotext', ['-f', '1', '-l', '1', '-layout', pdf, '-'], { encoding: 'utf8' });
  assert.match(page1, /Employer signature/);
  assert.match(page1, /Authorized representative/);
  assert.match(page1, /Title:/);
  assert.match(page1, /Signature:/);
  assert.match(page1, /Date:/);
  const signatureAt = page1.indexOf('Signature:');
  const dateAt = page1.indexOf('Date:');
  assert.ok(signatureAt > -1 && dateAt > signatureAt);
  const between = page1.slice(signatureAt, dateAt);
  assert.doesNotMatch(between, /\f/);
});

test('pdf keeps a long-name signature block together', async function () {
  const employer = 'Northwind Regional Benefits Cooperative LLC of Greater Orlando';
  const cafeteria = 'Northwind Regional Employees Cafeteria and Welfare Benefits Plan for Hourly and Salaried Staff';
  const title = 'Senior Vice President of Human Resources, Benefits Administration, and Payroll';
  assert.ok(employer.length >= 60);
  assert.ok(cafeteria.length >= 80);
  assert.ok(title.length >= 70);
  const plan = planFor(Object.assign({}, salaryFields, {
    funding_mode: 'combined',
    employer_name: employer,
    plan_name: 'Northwind Regional Trump Account Contribution Program',
    cafeteria_plan_name: cafeteria,
    signer_title: title,
    employer_annual_grant: '1000'
  }));
  async function assertTogether(bytes, label) {
    const pdfPath = path.join(outDir, label + '.pdf');
    fs.writeFileSync(pdfPath, Buffer.from(bytes));
    const info = execFileSync('pdfinfo', [pdfPath], { encoding: 'utf8' });
    const pageTotal = Number((info.match(/Pages:\s+(\d+)/) || [])[1] || 1);
    let together = 0;
    for (let n = 1; n <= pageTotal; n++) {
      const slice = execFileSync('pdftotext', ['-f', String(n), '-l', String(n), '-layout', pdfPath, '-'], { encoding: 'utf8' });
      const hasHeading = /Employer signature/.test(slice);
      const hasSignature = /Signature:/.test(slice);
      const hasDate = /Date:/.test(slice);
      if (!hasHeading && !hasSignature && !hasDate) continue;
      assert.equal(hasHeading, true, label + ' page ' + n + ' is missing the signature heading');
      assert.equal(hasSignature, true, label + ' page ' + n + ' is missing the signature line');
      assert.equal(hasDate, true, label + ' page ' + n + ' is missing the date line');
      assert.ok(slice.indexOf('Employer signature') < slice.indexOf('Signature:'));
      assert.ok(slice.indexOf('Signature:') < slice.indexOf('Date:'));
      together++;
    }
    assert.equal(together, 1, label);
  }
  await assertTogether(await S128Pdf.buildPdf(S128Docgen.amendmentParagraphs(plan), { title: 'amendment' }), 'long-amendment-pdf');
  await assertTogether(await S128Pdf.buildPdf(S128Docgen.planParagraphs(plan), { title: plan.plan_name }), 'long-plan-pdf');
});

test('implementation guide matches the funding design and the visitor email', function () {
  const combined = planFor(Object.assign({ funding_mode: 'combined', employer_annual_grant: '1000' }, salaryFields));
  const guide = S128Docgen.plainText(S128Docgen.guideParagraphs(combined));
  const links = {
    section125Url: 'https://www.dkbenefits.net/section125plantool',
    ratesUrl: 'https://www.dkbenefits.net/instant-group-quote'
  };
  const email = S128Docgen.followUpEmailText(combined, { contact_name: 'Ada Lopez' }, links);
  const html = S128Docgen.followUpEmailHtml(combined, { contact_name: 'Ada Lopez' }, links);
  const lines = S128Docgen.checklistLines(combined);
  assert.equal(lines.length, 6);
  assert.match(guide, /1\. Sign and date the plan \(page 1\) before the effective date \(January 1, 2027\)\./);
  assert.match(guide, /2\. Add the Section 125 amendment to your cafeteria plan and sign it/);
  assert.match(guide, /box 12 code TA/);
  assert.match(guide, /Collect each employee’s child’s Trump account information and make sure the account is active\. Accounts the Treasury opened automatically must be claimed by a parent first\./);
  assert.match(guide, /Pay the \$1,000 grant once a year and start payroll deductions once the cafeteria plan permits them\. Together they can’t exceed \$2,500 per employee per year\./);
  assert.doesNotMatch(guide, /Start contributions through payroll/);
  assert.doesNotMatch(guide, /July 4, 2026/);
  assert.doesNotMatch(guide, /Who:|What:|When:|REG-101355|attorney|SAMPLE DRAFT/);
  lines.forEach(function (line) { assert.ok(email.indexOf(line) !== -1, line); });
  assert.match(email, /^Hi Ada,/);
  assert.match(email, /I just saw you finished the Section 128 document builder for Northwind Benefits LLC/);
  assert.match(email, /Just a reminder that the program isn't final until your company adopts it/);
  assert.match(email, /Your tax advisor can help with anything specific to your situation/);
  assert.match(email, /It builds either a premium-only plan or a full cafeteria plan/);
  assert.equal((email.match(/premium-only/g) || []).length, 1);
  assert.match(email, /shop and negotiate their group health and other benefits/);
  assert.match(email, /Employee Navigator connected to your carriers and payroll/);
  assert.match(email, /just reply to this email\. I'm happy to help/);
  assert.match(email, /Thanks,/);
  assert.match(email, /Daniel Kirves/);
  assert.match(email, /407-476-5076/);
  assert.match(email, /dan@dkbenefits.net/);
  assert.match(email, /The Section 128 tool is educational and isn't legal or tax advice/);
  assert.match(email, /doesn't sell, market, open, or administer Trump accounts/);
  assert.doesNotMatch(email, /attorney|SAMPLE DRAFT|does not review|received your draft|attached|lowest|savings|cheapest|guarantee|instant-group-quote|quote-tool-demo/i);
  assert.deepEqual(email.match(/https?:\/\/\S+/g), [
    'https://www.dkbenefits.net/section125plantool'
  ]);
  assert.match(S128Docgen.followUpEmailText(combined, { contact_name: '   ' }, links), /^Hi there,/);
  assert.equal((html.match(/<a /g) || []).length, 1);
  assert.match(html, /<a href="https:\/\/www\.dkbenefits\.net\/section125plantool">https:\/\/www\.dkbenefits\.net\/section125plantool<\/a>/);
  assert.doesNotMatch(html, /instant-group-quote/);
  assert.doesNotMatch(html, /mailto:|tel:|<img|utm_|bit\.ly|tinyurl/i);
  assert.match(html, /407-476-5076/);
  assert.match(html, /dan@dkbenefits\.net/);
  assert.doesNotMatch(html, /<a [^>]*>407-476-5076<\/a>/);
  assert.doesNotMatch(html, /<a [^>]*>dan@dkbenefits\.net<\/a>/);
  const grantOnly = planFor({ funding_mode: 'employer_only' });
  assert.equal(S128Docgen.checklistLines(grantOnly).length, 5);
  assert.doesNotMatch(S128Docgen.plainText(S128Docgen.guideParagraphs(grantOnly)), /Section 125 amendment/);
  assert.match(S128Docgen.guideFileName(combined), /Northwind_Benefits_LLC_Section_128_Implementation_Guide_v0\.5\.docx/);
  assert.doesNotMatch(S128Docgen.guideFileName(combined), /DRAFT/);
  fs.writeFileSync(path.join(outDir, 'combined-guide.docx'), Buffer.from(S128Docgen.buildGuideDocx(combined)));
  fs.writeFileSync(path.join(artifactDir(), 'visitor-email-combined.txt'), email);
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
    assert.match(rendered, /Prepared with DK Benefits/);
    assert.match(rendered, /Page\s+1/);
    assert.doesNotMatch(rendered, /SAMPLE DRAFT/);
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
  assert.match(pdfText, /together cannot\s+exceed the annual limit/);
  assert.match(pdfText, /Prepared with DK Benefits/);
  assert.match(pdfText, /Not effective until signed by the employer/);
  assert.match(pdfText, /Page 1/);
  assert.doesNotMatch(pdfText, /SAMPLE DRAFT/);
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
  assert.match(amendmentText, /With a\s+\$1,000 grant/);
  assert.match(amendmentText, /Employer signature/);
  assert.match(amendmentText, /Authorized representative/);
  assert.match(amendmentText, /Signature:/);
  assert.match(amendmentText, /Date:/);
  assert.match(amendmentText, /Page 1/);
  const guidePdf = await S128Pdf.buildPdf(S128Docgen.guideParagraphs(plan), { title: 'Section 128 implementation guide' });
  const guidePath = path.join(artifacts, 'combined-guide-pdflib.pdf');
  fs.writeFileSync(guidePath, Buffer.from(guidePdf));
  const guideText = execFileSync('pdftotext', ['-layout', guidePath, '-'], { encoding: 'utf8' });
  assert.match(guideText, /Add the Section 125 amendment/);
  assert.match(guideText, /Prepared with DK Benefits/);
  assert.doesNotMatch(guideText, /SAMPLE DRAFT|Who:|REG-101355/);
  [
    ['combined-plan-page', pdfPath],
    ['combined-amendment-page', amendmentPath],
    ['combined-guide-page', guidePath]
  ].forEach(function (pair) {
    execFileSync('pdftoppm', ['-png', '-r', '110', pair[1], path.join(artifacts, pair[0])]);
  });
  fs.copyFileSync(path.join(artifacts, 'combined-plan-page-1.png'), path.join(artifacts, 'plan-page-1.png'));
  fs.copyFileSync(path.join(artifacts, 'combined-guide-page-1.png'), path.join(artifacts, 'guide-page-1.png'));
  const page1 = execFileSync('pdftotext', ['-f', '1', '-l', '1', pdfPath, '-'], { encoding: 'utf8' });
  assert.match(page1, /Employer signature/);
  assert.match(page1, /Signature:/);
  assert.match(page1, /Date:/);
  const info = execFileSync('pdfinfo', [pdfPath], { encoding: 'utf8' });
  const pageTotal = Number((info.match(/Pages:\s+(\d+)/) || [])[1] || 1);
  let signaturePage = 1;
  for (let n = 1; n <= pageTotal; n++) {
    const slice = execFileSync('pdftotext', ['-f', String(n), '-l', String(n), pdfPath, '-'], { encoding: 'utf8' });
    if (/Signature:/.test(slice)) {
      signaturePage = n;
      break;
    }
  }
  assert.equal(signaturePage, 1);
  fs.copyFileSync(path.join(artifacts, 'combined-plan-page-' + signaturePage + '.png'), path.join(artifacts, 'plan-signature-page.png'));
  const amendInfo = execFileSync('pdfinfo', [amendmentPath], { encoding: 'utf8' });
  const amendPages = Number((amendInfo.match(/Pages:\s+(\d+)/) || [])[1] || 1);
  let amendSignaturePage = amendPages;
  for (let n = 1; n <= amendPages; n++) {
    const slice = execFileSync('pdftotext', ['-f', String(n), '-l', String(n), amendmentPath, '-'], { encoding: 'utf8' });
    if (/Employer signature/.test(slice)) amendSignaturePage = n;
  }
  fs.copyFileSync(path.join(artifacts, 'combined-amendment-page-' + amendSignaturePage + '.png'), path.join(artifacts, 'amendment-signature.png'));
});

test('documents do not state a payroll notice above 30 days', function () {
  const plan = planFor(Object.assign({
    funding_mode: 'salary_reduction_only',
    employer_annual_grant: ''
  }, salaryFields, { election_cutoff_days: '30' }));
  function joined(source) {
    return S128Docgen.planParagraphs(source).concat(S128Docgen.amendmentParagraphs(source)).map(function (row) {
      return row.text || '';
    }).join('\n');
  }
  const okText = joined(plan);
  assert.match(okText, /30 calendar days before payday/);
  assert.match(okText, /subject to 30 calendar days of payroll processing notice/);
  assert.match(okText, /provide 30 calendar days of payroll processing notice/);
  const overText = joined(Object.assign({}, plan, { election_cutoff_days: 45 }));
  assert.doesNotMatch(overText, /45 calendar days/);
  assert.match(overText, /30 calendar days before payday/);
  assert.match(overText, /subject to 30 calendar days of payroll processing notice/);
});

test('checklist states the plan’s own amounts and only mentions an amendment that was prepared', function () {
  const lastLine = function (plan) { const lines = S128Docgen.checklistLines(plan); return lines[lines.length - 1]; };
  const grantOnly = planFor({ funding_mode: 'employer_only', employer_annual_grant: '500', annual_cap_mode: 'fixed', fixed_annual_cap: '500' });
  assert.equal(lastLine(grantOnly), 'Pay the $500 grant once a year for each participating employee, directly to the verified Trump account.');
  const salaryFixed = planFor(Object.assign({ funding_mode: 'salary_reduction_only', employer_annual_grant: '', annual_cap_mode: 'fixed', fixed_annual_cap: '2000' }, salaryFields));
  assert.match(lastLine(salaryFixed), /up to \$2,000 per employee per year\.$/);
  const salary2028 = planFor(Object.assign({ funding_mode: 'salary_reduction_only', employer_annual_grant: '', effective_date: '2028-01-01' }, salaryFields, { cafeteria_amendment_date: '2028-01-01' }));
  assert.match(lastLine(salary2028), /the per-employee Section 128 limit the IRS publishes for that year\.$/);
  S128Docgen.checklistLines(salary2028).forEach(function (line) { assert.doesNotMatch(line, /\$2,500/); });
  const noCafeteria = planFor({ funding_mode: 'combined', employer_annual_grant: '1000', has_existing_125_plan: 'no', election_cutoff_days: '5' });
  assert.equal(S128Docgen.amendmentParagraphs(noCafeteria), null);
  const guide = S128Docgen.plainText(S128Docgen.guideParagraphs(noCafeteria));
  assert.doesNotMatch(guide, /Add the Section 125 amendment/);
  assert.match(guide, /Adopt or confirm a Section 125 cafeteria plan and amend it for this benefit before any payroll deductions start\. No amendment was prepared\./);
  const ownAccount = planFor({ funding_mode: 'employer_only', allow_employee_account: 'yes' });
  assert.match(S128Docgen.plainText(S128Docgen.guideParagraphs(ownAccount)), /or the employee’s own account, if the employee is 17 or younger/);
});

test('a past effective date tells the employer to sign promptly', function () {
  const past = planFor({ effective_date: '2026-08-01' });
  const line = S128Docgen.checklistLines(past)[0];
  assert.match(line, /promptly, as soon as possible/);
  assert.match(line, /August 1, 2026/);
  assert.doesNotMatch(line, /before the effective date/);
});

test('a name outside the PDF font still produces a PDF', async function () {
  const plan = planFor({
    employer_name: 'Łukasz Café LLC',
    signer_name: 'Łukasz Café',
    plan_name: 'Łukasz Café Trump Account Program'
  });
  assert.equal(S128Docgen.planFileName(plan), 'Lukasz_Cafe_LLC_Section_128_Plan_v0.5.docx');
  const bytes = await S128Pdf.buildPdf(S128Docgen.planParagraphs(plan), { title: plan.plan_name });
  const pdfPath = path.join(outDir, 'lukasz.pdf');
  fs.writeFileSync(pdfPath, Buffer.from(bytes));
  const text = execFileSync('pdftotext', ['-layout', pdfPath, '-'], { encoding: 'utf8' });
  assert.match(text, /Lukasz Café LLC/);
  assert.match(text, /Authorized representative: Lukasz Café/);
  assert.match(text, /Page 1/);
});

test('file names keep accented and special letters readable', function () {
  const plan = planFor({ employer_name: 'Café Łódź & Søn, Inc.', plan_name: 'Café Łódź Trump Account Program' });
  assert.equal(S128Docgen.planFileName(plan), 'Cafe_Lodz_Son_Inc_Section_128_Plan_v0.5.docx');
});
