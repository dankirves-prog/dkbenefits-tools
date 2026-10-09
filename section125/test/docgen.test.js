const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
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
const planBanned = /sample|educational|not legal|not tax advice|date line is blank|not effective until|generating this file does not adopt|five percent or greater|it is not postponed|already passed|part of every form|does not create the duty/i;

function normalizedSentences(text) {
  return text
    .split(/\n+/)
    .join(' ')
    .split(/(?<=[.])\s+/)
    .map(function (sentence) { return sentence.replace(/\s+/g, ' ').trim().toLowerCase(); })
    .filter(function (sentence) { return sentence.length > 40; });
}

function duplicateSentences(text) {
  const seen = new Map();
  normalizedSentences(text).forEach(function (sentence) {
    seen.set(sentence, (seen.get(sentence) || 0) + 1);
  });
  return [...seen.entries()].filter(function (entry) { return entry[1] > 1; }).map(function (entry) { return entry[0]; });
}

test('the premium-only C corporation plan states the start-up enrollment and leaves the signature blank', function () {
  const plan = planFor();
  const text = textOf(plan);
  assert.match(text, /Northwind Benefits Inc Section 125 Cafeteria Plan/);
  assert.match(text, /Plan Name: Northwind Benefits Inc Section 125 Cafeteria Plan/);
  assert.match(text, /EIN: 12-3456789/);
  assert.match(text, /Plan Number: 501/);
  assert.match(text, /a Florida corporation/);
  assert.match(text, /common-law employee of a C corporation/);
  assert.match(text, /December 2, 2026 through December 31, 2026/);
  assert.match(text, /Article 20\. Execution/);
  assert.match(text, /By: ________________________________/);
  assert.match(text, /Date: ________________________________/);
  assert.match(text, /not named personally as the fiduciary/);
  assert.match(text, /If a provision of this Plan is held invalid/);
  assert.match(text, /Article 10\. Continuation coverage/);
  assert.match(text, /Article 15\. No right to employment/);
  assert.match(text, /laws of the State of Florida/);
  assert.doesNotMatch(text, /The Health FSA is limited|Dependent Care FSA has a grace|health savings account by pre-tax/);
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
  assert.doesNotMatch(text, /Five percent or greater/);
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
  assert.match(text, /The 91st day of employment/);
  assert.match(text, /does not default to after-tax coverage/);
  assert.match(text, /This restatement continues the existing plan year/);
  assert.match(text, /Salaried employees at the Orlando office/);
  assert.match(text, /nonforfeitable once deposited/);
  assert.match(text, /55 percent average-benefits test/);
  assert.match(text, /Family and Medical Leave Act/);
  assert.match(text, /The Dependent Care FSA does not have a carryover/);
  assert.equal((text.match(/The Dependent Care FSA does not have a carryover/g) || []).length, 1);
  assert.match(text, /a Florida corporation that has elected to be taxed as an S corporation/);
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
  assert.match(text, /The Dependent Care FSA does not have a carryover/);
  assert.equal((text.match(/The Dependent Care FSA does not have a carryover/g) || []).length, 1);
  assert.match(text, /\$7,500/);
  assert.match(text, /forfeited to the Employer/);
  assert.doesNotMatch(text, /Health FSA is limited|grace period that ends on the 15th day of the third month after the plan year\. A Health FSA/);
  assert.doesNotMatch(text, banned);
  assert.match(S125Model.entitySentence(plan), /a Florida limited liability company taxed as a partnership/);
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
  assert.match(S125Terms.FOOTER, /educational tool/);
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
    const bytes = await scripts.S125Pdf.buildPdf(rows, { title: design.plan.plan_name, footer: design.plan.plan_name });
    const file = path.join(dir, design.name + '.pdf');
    fs.writeFileSync(file, Buffer.from(bytes));
    const saved = fs.readFileSync(file);
    assert.equal(saved.slice(0, 4).toString(), '%PDF');
    assert.ok(saved.length > 2000, design.name);
    const loaded = await scripts.PDFLib.PDFDocument.load(saved);
    design.pages = loaded.getPageCount();
    const text = execFileSync('pdftotext', ['-layout', file, '-'], { encoding: 'utf8' });
    assert.doesNotMatch(text, planBanned);
    assert.match(text, new RegExp('Page 1 of ' + design.pages));
    const last = execFileSync('pdftotext', ['-f', String(design.pages), '-l', String(design.pages), '-layout', file, '-'], { encoding: 'utf8' });
    assert.match(last, /Article 20\. Execution/);
    assert.match(last, /By: ________________________________/);
    assert.match(last, /Name:/);
    assert.match(last, /Title:/);
    assert.match(last, /Date: ________________________________/);
    assert.ok(last.replace(/\s+/g, ' ').trim().length > 180, design.name + ' last page is thin');
  }
  fs.writeFileSync(path.join(dir, 'page-counts.json'), JSON.stringify(designs.map(function (design) {
    return { name: design.name, pages: design.pages };
  }), null, 2));
  assert.ok(designs[0].pages >= 5, 'pop pages ' + designs[0].pages);
  assert.ok(designs[1].pages >= 6, 'scorp pages ' + designs[1].pages);
  assert.ok(designs[2].pages >= 5, 'llc pages ' + designs[2].pages);
});

test('plan text has no repeated sentences and no sample disclaimers', function () {
  const designs = [
    planFor(),
    planFor({
      entity_type: 's-corp',
      benefits: ['medical', 'dental', 'vision', 'health_fsa', 'dcap', 'hsa'],
      health_fsa_design: 'both',
      health_fsa_unused: 'grace',
      dcap_unused: 'grace',
      funding_type: 'level',
      employee_count: '80'
    }),
    planFor({
      employer_name: 'Harbor Partners LLC',
      entity_type: 'llc',
      llc_tax: 's-corp',
      state: 'OH',
      benefits: ['health_fsa', 'hsa'],
      health_fsa_design: 'general',
      health_fsa_unused: 'forfeit'
    }),
    planFor({
      entity_type: 'nonprofit',
      benefits: ['dcap'],
      dcap_unused: 'forfeit',
      multi_state: 'yes'
    })
  ];
  designs.forEach(function (plan) {
    const text = textOf(plan);
    assert.deepEqual(duplicateSentences(text), [], plan.employer_name);
    assert.doesNotMatch(text, planBanned, plan.employer_name);
    assert.match(text, /Article 20\. Execution/);
    assert.equal((text.match(/^Article \d+\. /gm) || []).length, 20);
  });
  const ohio = designs[2];
  assert.match(textOf(ohio), /an Ohio limited liability company taxed as an S corporation/);
});

test('the execution block stays together in the Word plan and on the last PDF page', function () {
  const plan = planFor({
    entity_type: 's-corp',
    benefits: ['medical', 'dental', 'vision', 'health_fsa', 'dcap', 'hsa'],
    health_fsa_design: 'limited',
    health_fsa_unused: 'carryover',
    dcap_unused: 'grace'
  });
  const bytes = S125Docgen.buildPlanDocx(plan);
  const dir = fs.mkdtempSync(path.join(artifactDir(), 'docx-'));
  fs.writeFileSync(path.join(dir, 'plan.docx'), Buffer.from(bytes));
  execFileSync('unzip', ['-o', 'plan.docx', '-d', 'unzipped'], { cwd: dir });
  const xml = fs.readFileSync(path.join(dir, 'unzipped', 'word', 'document.xml'), 'utf8');
  const footer = fs.readFileSync(path.join(dir, 'unzipped', 'word', 'footer1.xml'), 'utf8');
  const signature = xml.slice(xml.indexOf('Article 20. Execution'));
  assert.ok((signature.match(/<w:keepNext\/>/g) || []).length >= 5);
  assert.ok((signature.match(/<w:keepLines\/>/g) || []).length >= 6);
  assert.match(xml, /<w:tbl>/);
  assert.match(xml, /Plan Name/);
  assert.doesNotMatch(xml, planBanned);
  assert.match(footer, /NUMPAGES/);
  assert.match(footer, /Page /);
  assert.doesNotMatch(footer, /educational|Not effective until/i);
});
