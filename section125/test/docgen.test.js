const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { loadBrowserScripts, loadPdf, baseInput, ASOF, LINKS, artifactDir } = require('./helpers');

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

const banned = /compliant, defensible|2% or greater|5% or greater|owners participating|FSA plan materials|after-tax coverage by default/i;

test('the premium-only C corporation plan states the start-up enrollment and leaves the signature blank', function () {
  const plan = planFor();
  const text = textOf(plan);
  assert.match(text, /Northwind Benefits Inc Section 125 Cafeteria Plan/);
  assert.match(text, /C corporation/);
  assert.match(text, /common-law employee of a C corporation/);
  assert.match(text, /It is the enrollment to start the Plan/);
  assert.match(text, /December 2, 2026 through December 31, 2026/);
  assert.match(text, /By: ________________________________/);
  assert.match(text, /Date: ________________________________/);
  assert.match(text, /The date line is blank/);
  assert.match(text, /not named personally as the fiduciary/);
  assert.match(text, /If a provision of this Plan is held invalid/);
  assert.doesNotMatch(text, /The Health FSA under this Plan|Dependent Care FSA\. A Participant|HSA contributions\. A Participant|FSA claims procedures|administration of an FSA/);
  assert.doesNotMatch(text, banned);
  assert.equal(S125Docgen.planFileName(plan), 'Northwind_Benefits_Inc_Section_125_Plan_v1.0.docx');
  assert.equal(S125Docgen.planFileName({ employer_name: 'Łódź Cafe' }), 'Lodz_Cafe_Section_125_Plan_v1.0.docx');
  const bytes = S125Docgen.buildPlanDocx(plan);
  assert.equal(bytes[0], 0x50);
  assert.equal(bytes[1], 0x4B);
});

test('the S corporation plan carries the HSA, limited-purpose FSA, carryover, and dependent care grace rules', function () {
  const plan = planFor({
    entity_type: 's-corp',
    effective_date: '2026-11-01',
    plan_year_type: 'custom',
    plan_year_start_month: '7',
    plan_year_start_day: '1',
    prior_plan: 'yes',
    prior_adoption: '01/2018',
    plan_year_change: 'no',
    funding_type: 'self',
    employee_count: '80',
    waiting_period: 'days_90',
    eligible_classes: ['full-time', 'part-time', 'other'],
    eligible_class_other: 'Salaried employees at the Orlando office',
    benefits: ['medical', 'dental', 'vision', 'health_fsa', 'dcap', 'hsa'],
    health_fsa_design: 'limited',
    health_fsa_unused: 'carryover',
    dcap_unused: 'grace'
  });
  const text = textOf(plan);
  assert.match(text, /more than 2 percent/);
  assert.match(text, /Code §318/);
  assert.match(text, /does not include stock owned only by a sibling/);
  assert.match(text, /more than 5 percent/);
  assert.match(text, /“Five percent or greater” is not the test/);
  assert.match(text, /at least monthly/);
  assert.match(text, /limited-purpose health FSA/);
  assert.match(text, /dental, vision, and preventive care/);
  assert.match(text, /\$680/);
  assert.match(text, /\$660/);
  assert.match(text, /\$3,400/);
  assert.match(text, /\$7,500/);
  assert.match(text, /\$3,750/);
  assert.match(text, /age 27/);
  assert.match(text, /Code §105\(h\)/);
  assert.match(text, /15th day of the third month/);
  assert.match(text, /Carryover does not apply to the Dependent Care FSA/);
  assert.match(text, /The 91st day of employment/);
  assert.match(text, /does not default to after-tax coverage/);
  assert.match(text, /This restatement continues the existing plan year/);
  assert.match(text, /Salaried employees at the Orlando office/);
  assert.match(text, /nonforfeitable once deposited/);
  assert.match(text, /55 percent average benefits test/);
  assert.match(text, /Family and Medical Leave Act/);
  assert.doesNotMatch(text, /short plan year beginning/);
  assert.doesNotMatch(text, banned);
  assert.doesNotMatch(text, /coverage begins on the 91st day \(ACA/);
});

test('an LLC taxed as a partnership with only dependent care excludes self-employed members and rejects carryover', function () {
  const plan = planFor({
    employer_name: 'Harbor Partners LLC',
    entity_type: 'llc',
    llc_tax: 'partnership',
    benefits: ['dcap'],
    dcap_unused: 'forfeit'
  });
  const text = textOf(plan);
  assert.match(text, /Code §401\(c\)/);
  assert.match(text, /LLC taxed as a partnership/);
  assert.match(text, /Carryover does not apply to the Dependent Care FSA/);
  assert.match(text, /\$7,500/);
  assert.match(text, /forfeited at the end of the plan year/);
  assert.doesNotMatch(text, /Health FSA carryover|grace period for the Dependent Care/);
  assert.doesNotMatch(text, banned);
  assert.match(S125Model.entitySentence(plan), /LLC taxed as a partnership/);
});

test('the follow-up note has exactly two links and a plain-text signature', function () {
  const plan = planFor({
    entity_type: 's-corp',
    benefits: ['medical', 'health_fsa', 'dcap', 'hsa'],
    health_fsa_design: 'limited',
    health_fsa_unused: 'carryover',
    dcap_unused: 'grace'
  });
  const lead = { contact_name: 'Ada Lopez' };
  const email = S125Docgen.followUpEmailText(plan, lead, LINKS);
  const html = S125Docgen.followUpEmailHtml(plan, lead, LINKS);
  assert.match(email, /^Hi Ada,/);
  assert.match(email, /Section 125 plan for Northwind Benefits Inc/);
  assert.match(email, /Oh, and if you're looking at contributing to your employees' kids' new child savings accounts \(the Section 128 accounts, officially called "Trump accounts"\), I have a free tool that creates that plan too\. I don't sell or administer the accounts themselves, but the tool is there if you need it:\nhttps:\/\/www\.dkbenefits\.net\/section-128-tool/);
  assert.match(email, /I'd be happy to help you shop and negotiate your group health and other benefits/);
  assert.match(email, /Just so it's clear, legally I have to mention that the tool is educational and isn't legal or tax advice\.\n\nDaniel Kirves\n/);
  assert.doesNotMatch(email, /I don't sell, market, open, or administer Trump accounts/);
  assert.match(email, /Benefits Broker \| 20 Years Exp \| DK Benefits\n407-476-5076 \| www\.dkbenefits\.net\n6000 Metrowest Blvd #200 Orlando, FL 32835\n\nAgency Lic# L109331$/);
  assert.match(email, /\$680 from a 2026 plan year/);
  assert.match(email, /at least once a month/);
  assert.doesNotMatch(email, /Thanks again|P\.S\.|dan@dkbenefits\.net/);
  assert.deepEqual(email.match(/https?:\/\/\S+/g), [
    'https://www.dkbenefits.net/section-128-tool',
    'https://www.dkbenefits.net/instant-group-quote'
  ]);
  assert.equal((html.match(/<a /g) || []).length, 2);
  assert.match(html, /<a href="https:\/\/www\.dkbenefits\.net\/section-128-tool">https:\/\/www\.dkbenefits\.net\/section-128-tool<\/a>/);
  assert.match(html, /<a href="https:\/\/www\.dkbenefits\.net\/instant-group-quote">https:\/\/www\.dkbenefits\.net\/instant-group-quote<\/a>/);
  assert.match(html, /407-476-5076 \| www\.dkbenefits\.net/);
  assert.doesNotMatch(html, /<a [^>]*>[^<]*www\.dkbenefits\.net<\/a>/);
  assert.doesNotMatch(html, /mailto:|tel:|<img|utm_|bit\.ly/i);
  assert.match(S125Docgen.followUpEmailText(plan, { contact_name: '   ' }, LINKS), /^Hi there,/);
  assert.equal(S125Terms.VERSION, 's125-terms-2026-10-09');
  assert.equal(S125Docgen.FOOTER, 'Prepared with DK Benefits\' educational tool. Not effective until signed by the employer.');
  fs.writeFileSync(path.join(artifactDir(), 'follow-up-email.txt'), email);
});

test('sample PDFs build for the three designs', async function () {
  loadPdf(scripts);
  const designs = [
    { name: 'pop-ccorp', plan: planFor() },
    {
      name: 'scorp-full',
      plan: planFor({
        entity_type: 's-corp',
        effective_date: '2026-11-01',
        plan_year_type: 'custom',
        plan_year_start_month: '7',
        plan_year_start_day: '1',
        prior_plan: 'yes',
        prior_adoption: '01/2018',
        funding_type: 'self',
        employee_count: '80',
        waiting_period: 'days_90',
        eligible_classes: ['full-time', 'part-time', 'other'],
        eligible_class_other: 'Salaried employees at the Orlando office',
        benefits: ['medical', 'dental', 'vision', 'health_fsa', 'dcap', 'hsa'],
        health_fsa_design: 'limited',
        health_fsa_unused: 'carryover',
        dcap_unused: 'grace'
      })
    },
    {
      name: 'llc-dcap',
      plan: planFor({
        employer_name: 'Harbor Partners LLC',
        entity_type: 'llc',
        llc_tax: 'partnership',
        benefits: ['dcap'],
        dcap_unused: 'forfeit'
      })
    }
  ];
  const dir = artifactDir();
  for (const design of designs) {
    const rows = S125Docgen.planParagraphs(design.plan);
    const bytes = await scripts.S125Pdf.buildPdf(rows, { title: design.plan.plan_name });
    const file = path.join(dir, design.name + '.pdf');
    fs.writeFileSync(file, Buffer.from(bytes));
    const saved = fs.readFileSync(file);
    assert.equal(saved.slice(0, 4).toString(), '%PDF');
    assert.ok(saved.length > 2000, design.name);
  }
});
