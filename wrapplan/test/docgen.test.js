const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { loadBrowserScripts, loadPdf, baseInput, root } = require('./helpers');

function boot() {
  const context = loadBrowserScripts();
  loadPdf(context);
  return context;
}

function planText(context, input) {
  const result = context.WpModel.validate(input);
  assert.equal(result.ok, true);
  return {
    result: result,
    wrap: context.WpDocgen.plainText(context.WpDocgen.planParagraphs(result.plan)),
    spd: context.WpDocgen.plainText(context.WpDocgen.spdParagraphs(result.plan)),
    findings: context.WpDocgen.plainText(context.WpDocgen.findingsParagraphs(result.plan, result.findings))
  };
}

test('(c) insured and level-funded samples have no watermark, and stop-loss terms are not printed', function () {
  const context = boot();
  const insured = planText(context, baseInput());
  assert.doesNotMatch(insured.spd, /watermark|DRAFT ONLY|do not use until/i);
  assert.doesNotMatch(insured.findings, /broker of record/);
  const level = planText(context, baseInput({
    funding: 'level',
    employee_count: '150',
    census: { a: '140', b: '0', c: '0', d: '0' },
    benefits: ['medical', 'dental', 'vision', 'hra', 'health_fsa'],
    carriers: { medical: 'Allied', dental: 'Sun Life', vision: 'VSP', hra: 'Allied', health_fsa: 'WEX' },
    tpa_name: 'Allied',
    tpa_document: 'Allied level-funded booklet',
    stop_loss: 'yes',
    hra_type: 'integrated',
    phi: 'yes',
    phi_classes: 'Benefits staff',
    cobra: 'yes',
    cobra_admin: 'WEX',
    network: 'traditional'
  }));
  assert.match(level.findings, /broker of record/);
  assert.doesNotMatch(level.spd, /deductible|stop-loss carrier/i);
  assert.deepEqual(level.spd.match(/\$\d[\d,]*/g), ['$110']);
  assert.match(level.spd, /level-funded/i);
  assert.match(level.spd, /integrated/);
});

test('(c) mixed tax treatment still generates, and COBRA no with 113 participants still generates', function () {
  const context = boot();
  const mixed = context.WpModel.validate(baseInput({
    tax: { medical: 'pretax', dental: 'aftertax', vision: 'pretax', life: 'aftertax' }
  }));
  assert.equal(mixed.ok, true);
  const odd = planText(context, baseInput({
    census: { a: '113', b: '0', c: '0', d: '0' },
    cobra: 'no',
    funding: 'aso',
    employee_count: '130',
    tpa_name: 'Allied',
    tpa_document: 'ASO booklet',
    stop_loss: 'yes',
    phi: 'yes'
  }));
  assert.equal(odd.result.ok, true);
  assert.match(odd.findings, /usually do not belong together/);
});

test('(c) insured COBRA no mentions state continuation and does not print a number of months', function () {
  const context = boot();
  const pack = planText(context, baseInput({ cobra: 'no', funding: 'insured' }));
  assert.match(pack.spd, /State continuation coverage may be available/);
  assert.doesNotMatch(pack.spd, /\d+ months/);
  assert.doesNotMatch(pack.spd, /This document does not state a number of months of continuation/);
  assert.doesNotMatch(pack.spd, /Continue Group Health Plan Coverage/);
});

test('(d) filing status stays in the findings report and out of the SPD', function () {
  const context = boot();
  const pack = planText(context, baseInput({
    census: { a: '85', b: '10', c: '3', d: '0' },
    section125: 'no',
    tax: { medical: 'aftertax', dental: 'aftertax', vision: 'aftertax', life: 'aftertax' }
  }));
  assert.match(pack.findings, /small-plan filing exemption may apply/);
  assert.doesNotMatch(pack.spd, /small-plan filing exemption|A Form 5500 is required/);
  assert.match(pack.spd, /summary of the plan's annual financial report if the plan is required to file an annual report/);
});

test('(d) signature lines are blank, the signer is printed, and a restatement keeps both dates', function () {
  const context = boot();
  const pack = planText(context, baseInput({
    is_restatement: 'yes',
    restatement_date: '2026-07-01',
    original_effective_date: '2019-07-01',
    intended_signature_date: '2026-08-15'
  }));
  assert.match(pack.wrap, /Authorized signature: ________________________________/);
  assert.match(pack.wrap, /Date: ________________________________/);
  assert.match(pack.wrap, /Name: Alex Rivera/);
  assert.match(pack.wrap, /Title: Managing Member/);
  assert.match(pack.wrap, /originally effective July 1, 2019/);
  assert.match(pack.wrap, /restatement is effective July 1, 2026/);
  const resolution = context.WpDocgen.plainText(context.WpDocgen.resolutionParagraphs(pack.result.plan));
  assert.match(resolution, /Authorized signature: ________________________________/);
  assert.match(pack.findings, /after the effective date/);
});

test('(d) administrator and agent default to the employer', function () {
  const context = boot();
  const pack = planText(context, baseInput());
  assert.match(pack.spd, /The plan administrator is Harbor Dental Group LLC/);
  assert.match(pack.spd, /The agent for service of legal process is Harbor Dental Group LLC/);
});

test('Medicare, newborns, reversion, QMCSO notice, and HIPAA certification use the approved sentences', function () {
  const context = boot();
  const pack = planText(context, baseInput({ phi: 'yes', phi_classes: 'Benefits staff' }));
  assert.match(pack.spd, new RegExp(context.WpModel.MSP_SENTENCE.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  assert.match(pack.spd, /48 hours following a vaginal delivery/);
  assert.match(pack.spd, /96 hours following a cesarean section/);
  assert.match(pack.spd, /If state law governs the length of a hospital stay/);
  assert.match(pack.spd, /will not revert to the employer/);
  const hipaa = context.WpDocgen.plainText(context.WpDocgen.hipaaParagraphs(pack.result.plan));
  assert.match(hipaa, /plan sponsor certifies/);
  const qmcso = context.WpDocgen.plainText(context.WpDocgen.qmcsoParagraphs(pack.result.plan));
  assert.match(qmcso, /National Medical Support Notice/);
});

test('COBRA yes prints the federal paragraph, and not sure is not a path', function () {
  const context = boot();
  const pack = planText(context, baseInput({ cobra: 'yes', cobra_admin: 'WEX' }));
  assert.match(pack.spd, /Federal COBRA continuation coverage applies/);
  assert.match(pack.spd, /Continue Group Health Plan Coverage/);
  assert.doesNotMatch(pack.findings, /not sure/i);
  const unsureResult = context.WpModel.validate(baseInput({ cobra: 'unsure' }));
  assert.equal(unsureResult.ok, false);
  const unsureSpd = context.WpDocgen.plainText(context.WpDocgen.spdParagraphs(unsureResult.plan));
  const unsureFindings = context.WpDocgen.plainText(context.WpDocgen.findingsParagraphs(unsureResult.plan, unsureResult.findings));
  assert.doesNotMatch(unsureSpd, /Federal COBRA continuation coverage applies/);
  assert.doesNotMatch(unsureFindings, /Confirm the federal COBRA employee count/);
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  assert.doesNotMatch(html, /value="unsure"|Not sure/);
});

test('QSEHRA with medical and ICHRA on the same class are findings, and dependent care is absent from the wrap', function () {
  const context = boot();
  const qsehra = planText(context, baseInput({
    benefits: ['medical', 'hra'],
    carriers: { medical: 'Florida Blue', hra: 'Employer' },
    hra_type: 'qsehra'
  }));
  assert.match(qsehra.findings, /qualified small employer HRA/i);
  assert.equal(qsehra.result.ok, true);
  const ichra = planText(context, baseInput({
    benefits: ['medical', 'hra'],
    carriers: { medical: 'Florida Blue', hra: 'Employer' },
    hra_type: 'ichra',
    ichra_same_class: 'yes'
  }));
  assert.match(ichra.findings, /same/);
  const dcap = context.WpModel.wrappedBenefits(context.WpModel.normalize(baseInput({ dcap_interest: 'yes', benefits: ['medical', 'dcap'] })));
  assert.equal(dcap.indexOf('dcap'), -1);
});

test('referral-only EAP is omitted, and the plan footer is Company title | Page', function () {
  const context = boot();
  const eap = context.WpModel.wrappedBenefits(context.WpModel.normalize(baseInput({
    benefits: ['medical', 'eap'],
    eap_type: 'referral',
    carriers: { medical: 'Florida Blue', eap: 'Guidance' }
  })));
  assert.equal(eap.indexOf('eap'), -1);
  const result = context.WpModel.validate(baseInput());
  const footer = context.WpDocgen.footerFor(result.plan, 'Wrap Plan Document');
  assert.equal(footer, 'Harbor Dental Group LLC Wrap Plan Document');
  const docx = context.WpDocgen.buildDocx(context.WpDocgen.planParagraphs(result.plan), { title: 'Wrap', footer: footer });
  const xml = Buffer.from(docx).toString('utf8');
  assert.match(xml, /Harbor Dental Group LLC Wrap Plan Document \| Page /);
  assert.match(xml, /PAGE/);
  assert.match(xml, /NUMPAGES/);
});

test('check-in copy matches Dan\'s close and has no Thanks, Dan line', function () {
  const context = boot();
  const text = context.WpDocgen.followUpEmailText({ employer_name: 'Harbor' }, { contact_name: 'Alex Rivera' });
  assert.match(text, /Since this is a free tool, it's always a good idea to have your own counsel take a quick look before you sign\./);
  assert.match(text, /If you don't want to hear from me that's fine too just let me know\./);
  assert.match(text, /Daniel Kirves/);
  assert.match(text, /Agency Lic# L109331/);
  assert.doesNotMatch(text, /Thanks, Dan/);
});

test('download labels and the page do not promise an email', function () {
  const js = fs.readFileSync(path.join(root, 'wrapplan.js'), 'utf8');
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  assert.match(js, /Download Plan \(Word\)/);
  assert.match(js, /Download Plan \(PDF\)/);
  assert.match(js, /Download Findings Report \(Word\)/);
  assert.match(js, /Download Findings Report \(PDF\)/);
  assert.match(html, /Create My Documents/);
  assert.doesNotMatch(html, /Build the sample/);
  assert.doesNotMatch(html, /can sit in one wrap/);
  assert.match(js, /btn-gold/);
  assert.ok(js.indexOf('list.appendChild(wordCol)') < js.indexOf('list.appendChild(pdfCol)'));
  assert.match(js, /slice\(0, 14\)/);
  assert.match(html, /wrapplan\.js/);
  assert.doesNotMatch(html, /draft-banner/);
  assert.match(html, /Since this is a free tool, it's a good idea to have your own counsel take a quick look before you sign\./);
  const page = js + '\n' + html;
  assert.doesNotMatch(page, /we will email|we'll email|check your inbox/i);
  const embed = fs.readFileSync(path.join(root, 'embed.html'), 'utf8');
  assert.match(embed, /www-dkbenefits-net\.filesusr\.com/);
});

test('participant documents do not use You has, form-answer wording, or tool narration', function () {
  const context = boot();
  const pack = planText(context, baseInput({
    benefits: ['medical', 'dental', 'vision', 'life', 'std', 'ltd'],
    carriers: { medical: 'Florida Blue', dental: 'Sun Life', vision: 'VSP', life: 'Sun Life', std: 'Sun Life', ltd: 'Sun Life' },
    std_type: 'insured'
  }));
  const resolution = context.WpDocgen.plainText(context.WpDocgen.resolutionParagraphs(pack.result.plan));
  const hipaa = context.WpDocgen.plainText(context.WpDocgen.hipaaParagraphs(pack.result.plan));
  const output = [pack.wrap, pack.spd, resolution, hipaa].join('\n');
  assert.doesNotMatch(output, /You has|You generally has/);
  assert.match(pack.spd, /You have at least 180 days/);
  assert.match(pack.spd, /You generally have four months/);
  assert.match(pack.spd, /review and respond to new evidence or a new rationale/);
  assert.match(pack.spd, /contractual limitations period/);
  assert.doesNotMatch(output, /The employer reported|The employer answered|The employer marked|The plan sponsor has said/);
  assert.doesNotMatch(pack.wrap, /does not ask for, and this plan does not state/);
  assert.doesNotMatch(pack.spd, /does not say the plan always pays second/);
  assert.doesNotMatch(resolution, /the tool|After it is signed/);
  assert.match(resolution, /The LLC members of Harbor Dental Group LLC adopt the following action/);
  assert.doesNotMatch(pack.wrap, /participant receive |dependent receive /);
  assert.match(pack.wrap, /funded through premiums/);
  assert.match(pack.wrap, /policy year/);
  assert.doesNotMatch(pack.wrap, /limitation year/);
  assert.match(pack.spd, /407-555-0148/);
  assert.match(pack.spd, /administrator's business address is 100 Colonial Drive, Orlando, FL, 32801/);
  assert.match(pack.spd, /Benefits are guaranteed under the insurance policy/);
  assert.match(pack.spd, /Type of administration: insurer administration/);
  assert.match(pack.wrap, /by written action of the LLC members/);
  assert.equal(context.WpDocgen.needsHipaa(pack.result.plan), false);
  assert.match(pack.findings, /before the sponsor ever receives/);
  assert.match(pack.findings, /Some states bar discretionary clauses/);
  assert.doesNotMatch(pack.findings, /Nothing in this note tells you to wait/);
  assert.doesNotMatch(pack.findings, /starts on its own/);
  const schedule = context.WpDocgen.plainText(context.WpDocgen.scheduleParagraphs(pack.result.plan));
  assert.match(schedule, /Fully insured/);
  const qmcso = context.WpDocgen.plainText(context.WpDocgen.qmcsoParagraphs(pack.result.plan));
  assert.match(qmcso, /40 business days/);
  const level = planText(context, baseInput({
    funding: 'level',
    employee_count: '80',
    employee_contributions: 'no',
    benefits: ['medical', 'hra', 'health_fsa'],
    carriers: { medical: 'Allied', hra: 'Allied', health_fsa: 'WEX' },
    carrier_addresses: { medical: '200 West Adams Street, Chicago, IL 60606' },
    tpa_name: 'Allied',
    tpa_document: 'Level booklet',
    stop_loss: 'yes',
    hra_type: 'integrated',
    phi: 'yes',
    phi_classes: 'Benefits staff',
    cobra: 'yes'
  }));
  assert.match(level.spd, /integrated HRA/);
  assert.doesNotMatch(level.spd, /Benefits are guaranteed under the insurance policy/);
  assert.match(level.findings, /nondiscrimination/);
  assert.doesNotMatch(level.findings, /discretionary clauses/);
  const scheduleLevel = context.WpDocgen.plainText(context.WpDocgen.scheduleParagraphs(level.result.plan));
  assert.match(scheduleLevel, /Paid from the employer's general assets/);
  assert.equal(context.WpDocgen.needsHipaa(level.result.plan), true);
  const omitted = planText(context, baseInput({ discretion: 'no' }));
  assert.doesNotMatch(omitted.wrap, /full discretionary authority/);
  assert.doesNotMatch(omitted.findings, /discretionary clauses/);
});

test('limited purpose FSA is wrapped from general assets', function () {
  const context = boot();
  const pack = planText(context, baseInput({
    benefits: ['lpfsa'],
    carriers: { lpfsa: 'WEX' },
    cobra: 'no'
  }));
  assert.match(pack.wrap, /covers dental and vision expenses, and preventive care if the plan allows/);
  assert.match(pack.wrap, /compatible with a health savings account/);
  assert.match(pack.wrap, /general assets/);
  const schedule = context.WpDocgen.plainText(context.WpDocgen.scheduleParagraphs(pack.result.plan));
  assert.match(schedule, /Limited purpose FSA/);
  assert.match(schedule, /Separate limited purpose FSA plan document/);
  assert.doesNotMatch(pack.wrap, /Dependent care/);
});

test('a plan packet gives each document its own footer and page count', function () {
  const context = boot();
  const result = context.WpModel.validate(baseInput({ phi: 'yes', phi_classes: 'Benefits staff', cobra: 'yes' }));
  const sections = [
    { rows: context.WpDocgen.planParagraphs(result.plan), footer: 'Harbor Dental Group LLC Wrap Plan Document' },
    { rows: context.WpDocgen.spdParagraphs(result.plan), footer: 'Harbor Dental Group LLC Summary Plan Description' },
    { rows: context.WpDocgen.qmcsoParagraphs(result.plan), footer: 'Harbor Dental Group LLC QMCSO Procedures' },
    { rows: context.WpDocgen.hipaaParagraphs(result.plan), footer: 'Harbor Dental Group LLC HIPAA Amendment' }
  ];
  const bytes = context.WpDocgen.buildPacketDocx(sections, { title: 'Plan packet' });
  const xml = Buffer.from(bytes).toString('latin1');
  assert.doesNotMatch(xml, /SECTIONPAGES/);
  assert.doesNotMatch(xml, /NUMPAGES/);
  assert.match(xml, /PAGE/);
  assert.match(xml, /w:start="1"/);
  assert.match(xml, /nextPage/);
  assert.match(xml, /Harbor Dental Group LLC Wrap Plan Document \| Page /);
  assert.match(xml, /Harbor Dental Group LLC HIPAA Amendment \| Page /);
  assert.match(xml, /Qualified medical child support order procedures/);
});

test('an HRA never describes employee contributions as pre-tax, and the packet cover names who receives each part', function () {
  const context = boot();
  const pack = planText(context, baseInput({
    benefits: ['medical', 'hra'],
    carriers: { medical: 'Florida Blue', hra: 'Employer' },
    hra_type: 'integrated',
    tax: { medical: 'pretax', hra: 'pretax' }
  }));
  const hraLine = pack.wrap.split('\n').filter(function (line) { return /Health reimbursement arrangement/.test(line); })[0];
  assert.match(hraLine, /The employer pays the HRA/);
  assert.doesNotMatch(hraLine, /pre-tax/);
  const cover = context.WpDocgen.plainText(context.WpDocgen.coverParagraphs(pack.result.plan, [
    { title: 'Wrap Plan Document', pages: 10 },
    { title: 'Summary Plan Description', pages: 8 },
    { title: 'Schedule A', pages: 2 },
    { title: 'Adoption Resolution', pages: 1 },
    { title: 'QMCSO Procedures', pages: 2 },
    { title: 'HIPAA Amendment', pages: 2 }
  ]));
  assert.match(cover, /Wrap Plan Document, pages 1-10/);
  assert.match(cover, /Adoption Resolution, page 1/);
  assert.match(cover, /Employees receive the summary plan description and the certificates/);
  assert.match(cover, /The employer keeps the signed wrap, the adoption resolution, Schedule A, and the HIPAA amendment/);
  assert.match(cover, /available on request/);
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  const js = fs.readFileSync(path.join(root, 'wrapplan.js'), 'utf8');
  assert.doesNotMatch(html, /id="vol_pretax"/);
  assert.match(html, /id="section125"[\s\S]{0,220}<option value="">Choose<\/option>/);
  assert.match(html, /id="employee_contributions"[\s\S]{0,180}<option value="">Choose<\/option>/);
  assert.match(html, /id="remitted"[\s\S]{0,160}<option value="">Choose<\/option>/);
  assert.match(html, /id="certificates"[\s\S]{0,120}<option value="">Choose<\/option>/);
  assert.ok(js.indexOf("[['', 'Choose']].concat(waitingPairs(false))") !== -1);
  assert.match(js, /\['', 'Choose'\],\s*\['insured', 'Fully insured'\]/);
  assert.match(js, /if \(code === 'hra'\) return;/);
  assert.match(html, /Coverage must start no later than the 91st day/);
});
