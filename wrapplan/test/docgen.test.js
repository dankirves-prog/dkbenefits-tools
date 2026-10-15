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
    spd: context.WpDocgen.plainText(context.WpDocgen.planParagraphs(result.plan)),
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
  assert.match(pack.spd, /Authorized signature: ________________________________/);
  assert.match(pack.spd, /Date: ________________________________/);
  assert.match(pack.spd, /Name: Alex Rivera/);
  assert.match(pack.spd, /Title: Managing Member/);
  assert.match(pack.spd, /originally effective July 1, 2019/);
  assert.match(pack.spd, /restatement is effective July 1, 2026/);
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

test('COBRA not sure prints the federal paragraph and a findings flag', function () {
  const context = boot();
  const pack = planText(context, baseInput({ cobra: 'unsure' }));
  assert.match(pack.spd, /Federal COBRA continuation coverage applies/);
  assert.match(pack.findings, /Confirm the federal COBRA employee count/);
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
  const footer = context.WpDocgen.footerFor(result.plan, 'Wrap Plan Document and SPD');
  assert.equal(footer, 'Harbor Dental Group LLC Wrap Plan Document and SPD');
  const docx = context.WpDocgen.buildDocx(context.WpDocgen.planParagraphs(result.plan), { title: 'Wrap', footer: footer });
  const xml = Buffer.from(docx).toString('utf8');
  assert.match(xml, /Harbor Dental Group LLC Wrap Plan Document and SPD \| Page /);
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
  assert.match(js, /btn-gold/);
  assert.match(html, /wrapplan\.js/);
  const page = js + '\n' + html;
  assert.doesNotMatch(page, /we will email|we'll email|check your inbox/i);
  const embed = fs.readFileSync(path.join(root, 'embed.html'), 'utf8');
  assert.match(embed, /www-dkbenefits-net\.filesusr\.com/);
});
