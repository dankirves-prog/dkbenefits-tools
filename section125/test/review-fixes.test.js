const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { loadBrowserScripts, loadPdf, baseInput, ASOF, artifactDir } = require('./helpers');

const scripts = loadBrowserScripts();
const { S125Model, S125Docgen, S125Terms } = scripts;

function planFor(overrides) {
  const result = S125Model.validate(baseInput(overrides), { asOf: ASOF });
  assert.equal(result.ok, true, JSON.stringify(result.errors));
  return result.plan;
}

function textOf(plan) {
  return S125Docgen.plainText(S125Docgen.planParagraphs(plan));
}

function guideOf(plan) {
  return S125Docgen.plainText(S125Docgen.guideParagraphs(plan));
}

const s02 = {
  entity_type: 's-corp',
  effective_date: '2026-11-01',
  plan_year_type: 'calendar',
  prior_plan: 'no',
  funding_type: 'level',
  benefits: ['medical', 'health_fsa', 'dcap', 'hsa'],
  health_fsa_design: 'general',
  health_fsa_unused: 'carryover',
  dcap_unused: 'grace'
};
const s03 = {
  entity_type: 'llc',
  llc_tax: 'partnership',
  effective_date: '2026-11-15',
  plan_year_type: 'custom',
  plan_year_start_month: '7',
  plan_year_start_day: '1',
  funding_type: 'insured',
  waiting_period: 'none',
  new_hire_window: '30',
  eligible_classes: ['full-time', 'part-time'],
  benefits: ['medical', 'dental', 'health_fsa', 'hsa'],
  health_fsa_design: 'limited',
  health_fsa_unused: 'grace'
};
const s04 = {
  entity_type: 'nonprofit',
  prior_plan: 'yes',
  prior_adoption: '01/2020',
  plan_year_change: 'no',
  effective_date: '2027-01-01',
  plan_year_type: 'calendar',
  funding_type: 'self',
  employee_count: '120',
  eligible_classes: ['full-time', 'other'],
  eligible_class_other: 'Employees at the main office',
  benefits: ['medical', 'dental', 'vision', 'health_fsa', 'dcap', 'hsa'],
  health_fsa_design: 'both',
  health_fsa_unused: 'carryover',
  dcap_unused: 'forfeit'
};
const s05 = {
  entity_type: 'llc',
  llc_tax: 's-corp',
  prior_plan: 'yes',
  prior_adoption: '03/2018',
  plan_year_change: 'yes',
  effective_date: '2027-07-01',
  plan_year_type: 'custom',
  plan_year_start_month: '7',
  plan_year_start_day: '1',
  benefits: ['medical', 'health_fsa'],
  health_fsa_design: 'general',
  health_fsa_unused: 'forfeit'
};
const s08 = {
  entity_type: 'llc',
  llc_tax: 'disregarded',
  effective_date: '2026-10-09',
  benefits: ['health_fsa'],
  health_fsa_design: 'general',
  health_fsa_unused: 'forfeit',
  eligible_classes: ['full-time', 'part-time'],
  funding_type: 'insured'
};
const s09 = {
  effective_date: '2027-03-01',
  plan_year_type: 'calendar',
  funding_type: 'insured',
  benefits: ['medical', 'health_fsa'],
  health_fsa_design: 'general',
  health_fsa_unused: 'carryover'
};

test('a short 2026 Health FSA year is prorated and later years are not given the 2026 dollar limit', function () {
  const nov = textOf(planFor(s02));
  assert.match(nov, /For a plan year beginning in 2026, the limit is \$3,400/);
  assert.match(nov, /November 1, 2026 through December 31, 2026/);
  assert.match(nov, /Notice 2012-40 requires: \$566/);
  assert.equal(S125Model.shortYearMonths('2026-11-01', '2026-12-31'), 2);

  const march = textOf(planFor(s09));
  assert.match(march, /10\/12 of the §125\(i\) limit for 2027/);
  assert.doesNotMatch(march, /short plan year from March 1, 2027 through December 31, 2027, the limit is prorated by the number of months in that short plan year, as Notice 2012-40 requires: \$3,400/);
  assert.doesNotMatch(march, /\$660/);

  const full = textOf(planFor({
    effective_date: '2027-01-01',
    benefits: ['health_fsa'],
    health_fsa_design: 'general',
    health_fsa_unused: 'carryover'
  }));
  assert.match(full, /For a plan year beginning in 2026, the limit is \$3,400/);
  assert.doesNotMatch(full, /For the short plan year/);
  assert.doesNotMatch(full, /\$660/);
  assert.match(nov, /\$680 from a plan year beginning in 2026/);
  assert.match(nov, /\$660/);
});

test('the 60-day new-hire window is gone and late elections are prospective', function () {
  const rejected = S125Model.validate(baseInput({ new_hire_window: '60' }), { asOf: ASOF });
  assert.equal(rejected.ok, false);
  assert.ok(rejected.errors.some(function (item) { return item.field === 'new_hire_window'; }));
  const text = textOf(planFor({ new_hire_window: '30' }));
  assert.match(text, /takes effect prospectively, on the first day of the first pay period/);
  assert.match(text, /within 30 days after the date of hire/);
  assert.match(text, /rehired within 30 days/);
  assert.doesNotMatch(text, /within 60 days after becoming eligible/);
  assert.doesNotMatch(text, /An election takes effect on the date coverage begins under that waiting period/);
});

test('new plans enroll current employees and a restatement continues elections', function () {
  [s02, s03, s09].forEach(function (input) {
    const text = textOf(planFor(input));
    assert.match(text, /Initial enrollment\./);
    assert.match(guideOf(planFor(input)), /Hold enrollment for current employees before/);
  });
  const restated = textOf(planFor(s04));
  assert.match(restated, /Elections in effect under the plan being restated continue/);
  assert.doesNotMatch(restated, /Initial enrollment\./);
  const short = textOf(planFor(s02));
  assert.match(short, /The first annual open enrollment period/);
  assert.match(guideOf(planFor(s02)), /Sign and date the plan on or before November 1, 2026/);
  const soon = S125Model.stepTwoNotices(planFor({ effective_date: '2026-10-09' }), ASOF);
  assert.ok(soon.some(function (line) { return /Leave time to sign the plan and enroll employees before this date/.test(line); }));
  const tiny = S125Model.validate(baseInput({ effective_date: '2026-12-20' }), { asOf: ASOF });
  assert.equal(tiny.ok, true, JSON.stringify(tiny.errors));
  assert.equal(S125Model.shortYearMonths('2026-12-20', tiny.plan.short_plan_year_end), 0);
  assert.ok(S125Model.stepTwoNotices(tiny.plan, ASOF).some(function (line) {
    return line === 'The first plan year is less than a month. Consider an effective date on the plan-year start.';
  }));
});

test('a restatement that moves the plan year does not say the old year continues', function () {
  const plan = planFor(s05);
  const text = textOf(plan);
  assert.doesNotMatch(text, /continues the existing plan year/);
  assert.match(text, /This restatement changes the plan year/);
  assert.match(text, /ends on June 30, 2027/);
  assert.match(S125Model.planYearNote(plan), /This restatement changes the plan year/);
  assert.doesNotMatch(S125Model.planYearNote(plan), /continues the existing plan year/);
  assert.match(guideOf(plan), /Changing the plan year needs a valid business reason \(Notice 2012-40\)/);
  const kept = planFor({ prior_plan: 'yes', prior_adoption: '01/2020', plan_year_change: 'no' });
  assert.match(textOf(kept), /This restatement continues the existing plan year/);
});

test('a Health FSA follows major medical eligibility and section 105(h) even when medical is insured', function () {
  const only = planFor(s08);
  const text = textOf(only);
  assert.match(text, /Only an Eligible Employee who is eligible for the Employer's group major medical plan/);
  assert.match(guideOf(only), /Offer the Health FSA only to employees eligible for your major medical plan/);
  const insured = textOf(planFor(s09));
  assert.match(insured, /including the Health FSA and any level-funded medical arrangement that is self-insured for tax purposes, must also satisfy Code §105\(h\)/);
});

test('the template version is v1.0 and file names are derived from it', function () {
  assert.equal(S125Model.TEMPLATE_VERSION, 's125-v1.0-2026-10-10');
  assert.equal(S125Terms.VERSION, 's125-terms-2026-10-10');
  const plan = planFor();
  assert.equal(S125Docgen.planFileName(plan), 'Northwind_Benefits_Inc_Section_125_Plan_v1.0.docx');
  assert.equal(S125Docgen.guideFileName(plan), 'Northwind_Benefits_Inc_Section_125_Implementation_Checklist_v1.0.docx');
  assert.match(S125Terms.PARAGRAPHS.join('\n'), /The tool and the documents are free/);
  assert.match(S125Terms.PARAGRAPHS[1], /asking DK Benefits LLC for a copy/);
  const email = S125Docgen.followUpEmailText(plan, { contact_name: 'Ada Lopez' }, {
    section128Url: 'https://www.dkbenefits.net/section-128-tool',
    ratesUrl: 'https://www.dkbenefits.net/instant-group-quote'
  });
  assert.match(email, /If you'd rather not get these emails from me, let me know and I'll take you off the list\./);
  assert.doesNotMatch(email, /just reply|just hit reply/i);
});

test('a name that already ends with a period does not gain a second one', function () {
  const plan = planFor({ employer_name: 'Northwind Supply Inc.' });
  const text = textOf(plan);
  const guide = guideOf(plan);
  assert.match(text, /Employer means Northwind Supply Inc\./);
  assert.doesNotMatch(text, /Northwind Supply Inc\.\./);
  assert.match(guide, /Northwind Supply Inc\. — Northwind Supply Inc\. Section 125 Cafeteria Plan\./);
  assert.doesNotMatch(guide, /Inc\.\./);
});

test('a plan year that starts March 1 ends on the last day of February', function () {
  const plan = planFor({
    plan_year_type: 'custom',
    plan_year_start_month: '3',
    plan_year_start_day: '1',
    effective_date: '2028-03-01'
  });
  const sentence = S125Model.planYearSentence(plan);
  assert.match(sentence, /beginning March 1 and ending on the last day of February/);
  assert.doesNotMatch(sentence, /February 28|February 29/);
  assert.match(textOf(plan), /ending on the last day of February/);
});

test('dependent care uses the post-2025 exclusion and a plan-year election cap', function () {
  const text = textOf(planFor({ benefits: ['dcap'], dcap_unused: 'forfeit' }));
  assert.match(text, /For taxable years beginning after December 31, 2025/);
  assert.doesNotMatch(text, /For a taxable year beginning in 2026/);
  assert.match(text, /A Participant’s Dependent Care FSA election for a plan year may not exceed \$7,500, or \$3,750 for a married Participant filing separately\./);
  assert.doesNotMatch(text, /remitting the elected premium/);
  const selfFunded = textOf(planFor({ funding_type: 'self', benefits: ['medical'] }));
  assert.match(selfFunded, /group medical plan/);
  assert.match(selfFunded, /If the Employer changes that share/);
  assert.doesNotMatch(selfFunded, /group medical contract|If the insurer changes/);
  const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  assert.match(html, /Dependent care FSA<small>\$7,500 a year, not indexed<\/small>/);
});

test('prior adoption is printed as a month name and cannot be before 1978 or after the effective date', function () {
  const plan = planFor({ prior_plan: 'yes', prior_adoption: '01/2020', effective_date: '2027-01-01' });
  assert.equal(plan.prior_adoption, '01/2020');
  assert.match(textOf(plan), /originally adopted in January 2020\./);
  assert.doesNotMatch(textOf(plan), /adopted in 01\/2020|adopted 01\/2020/);
  const early = S125Model.validate(baseInput({ prior_plan: 'yes', prior_adoption: '12/1977' }), { asOf: ASOF });
  assert.ok(early.errors.some(function (item) { return item.field === 'prior_adoption' && /1978/.test(item.message); }));
  const later = S125Model.validate(baseInput({ prior_plan: 'yes', prior_adoption: '02/2027', effective_date: '2027-01-01' }), { asOf: ASOF });
  assert.ok(later.errors.some(function (item) { return item.field === 'prior_adoption' && /after the effective date/.test(item.message); }));
  const sameMonth = S125Model.validate(baseInput({ prior_plan: 'yes', prior_adoption: '01/2027', effective_date: '2027-01-15' }), { asOf: ASOF });
  assert.equal(sameMonth.ok, true, JSON.stringify(sameMonth.errors));
});

test('the plan number stays a whole number from 501 to 999', function () {
  assert.equal(planFor({ plan_number: '501' }).plan_number, '501');
  assert.equal(planFor({ plan_number: '999' }).plan_number, '999');
  ['500', '1000', '50', ''].forEach(function (value) {
    const result = S125Model.validate(baseInput({ plan_number: value }), { asOf: ASOF });
    const hit = result.errors.filter(function (item) { return item.field === 'plan_number'; });
    assert.equal(hit.length, 1, value);
    assert.match(hit[0].message, /501 to 999/);
  });
});

test('review flags name the cases Dan should see, and a plain plan has none', function () {
  const plain = S125Model.validate(baseInput(), { asOf: ASOF });
  assert.equal(plain.review.required, false);
  assert.equal(plain.review.reasons.length, 0);
  const flagged = S125Model.validate(baseInput({
    effective_date: '2026-10-20',
    plan_year_type: 'custom',
    plan_year_start_month: '11',
    plan_year_start_day: '1',
    prior_plan: 'yes',
    prior_adoption: '01/2020',
    plan_year_change: 'yes',
    funding_type: 'level',
    eligible_classes: ['part-time', 'other'],
    eligible_class_other: 'Employees at the Tampa office',
    benefits: ['health_fsa'],
    health_fsa_design: 'general',
    health_fsa_unused: 'forfeit'
  }), { asOf: ASOF });
  assert.equal(flagged.ok, true, JSON.stringify(flagged.errors));
  assert.equal(flagged.review.required, true);
  const reasons = flagged.review.reasons.join('\n');
  assert.match(reasons, /Health FSA is offered without a medical benefit/);
  assert.match(reasons, /part-time employees or another class/);
  assert.match(reasons, /shorter than one month/);
  assert.match(reasons, /within 14 days/);
  assert.match(reasons, /changes the plan year/);
  assert.match(reasons, /self-funded or level-funded/);
});

test('S02, S04, and S09 plan PDFs report a page count', async function () {
  loadPdf(scripts);
  const cases = [
    ['S02', s02],
    ['S04', s04],
    ['S09', s09]
  ];
  const counts = {};
  for (const pair of cases) {
    const plan = planFor(pair[1]);
    const bytes = await scripts.S125Pdf.buildPdf(S125Docgen.planParagraphs(plan), { title: plan.plan_name, footer: plan.plan_name });
    const loaded = await scripts.PDFLib.PDFDocument.load(Buffer.from(bytes));
    counts[pair[0]] = loaded.getPageCount();
    assert.ok(counts[pair[0]] >= 4, pair[0] + ' pages ' + counts[pair[0]]);
  }
  fs.mkdirSync(artifactDir(), { recursive: true });
  fs.writeFileSync(path.join(artifactDir(), 'review-page-counts.json'), JSON.stringify(counts, null, 2));
});
