const test = require('node:test');
const assert = require('node:assert/strict');
const { loadBrowserScripts, baseInput, ASOF } = require('./helpers');

const { S125Model } = loadBrowserScripts();

function check(overrides) {
  return S125Model.validate(baseInput(overrides), { asOf: ASOF });
}

test('a premium-only C corporation on a calendar year is a full year with a start-up enrollment window', function () {
  const result = check();
  assert.equal(result.ok, true);
  assert.equal(result.plan.owner_rule, 'none');
  assert.equal(result.plan.short_plan_year, false);
  assert.equal(result.plan.plan_year_end_month, 12);
  assert.equal(result.plan.plan_year_end_day, 31);
  assert.equal(result.plan.oe_start_date, '2026-12-02');
  assert.equal(result.plan.oe_end_date, '2026-12-31');
  assert.equal(result.plan.oe_before_effective, true);
  assert.equal(result.plan.employer_address, '100 King Street, Tampa, FL 33602');
  assert.equal(result.plan.plan_name, 'Northwind Benefits Inc Section 125 Cafeteria Plan');
  assert.equal(result.lead.contact_email, 'ada@northwind.example');
});

test('a July plan year that starts in November is a short year ending the day before the next July 1', function () {
  const result = check({
    effective_date: '2026-11-01',
    plan_year_type: 'custom',
    plan_year_start_month: '7',
    plan_year_start_day: '1',
    prior_plan: 'no'
  });
  assert.equal(result.ok, true);
  assert.equal(result.plan.short_plan_year, true);
  assert.equal(result.plan.short_plan_year_end, '2027-06-30');
  assert.equal(result.plan.next_plan_year_start, '2027-07-01');
  assert.equal(result.plan.plan_year_end_month, 6);
  assert.equal(result.plan.plan_year_end_day, 30);
  assert.equal(result.plan.oe_start_date, '2027-06-01');
  assert.equal(result.plan.oe_end_date, '2027-06-30');
  assert.equal(result.plan.oe_before_effective, false);
});

test('a restatement that keeps the plan year is not a short year', function () {
  const result = check({
    effective_date: '2026-11-01',
    plan_year_type: 'custom',
    plan_year_start_month: '7',
    plan_year_start_day: '1',
    prior_plan: 'yes',
    prior_adoption: '01/2018',
    plan_year_change: 'no'
  });
  assert.equal(result.ok, true);
  assert.equal(result.plan.short_plan_year, false);
  assert.equal(result.plan.oe_start_date, '2027-06-01');
  assert.equal(result.plan.oe_end_date, '2027-06-30');
});

test('a restatement that changes the plan year is a short year', function () {
  const result = check({
    effective_date: '2026-11-01',
    plan_year_type: 'custom',
    plan_year_start_month: '7',
    plan_year_start_day: '1',
    prior_plan: 'yes',
    prior_adoption: '01/2018',
    plan_year_change: 'yes'
  });
  assert.equal(result.ok, true);
  assert.equal(result.plan.short_plan_year, true);
  assert.equal(result.plan.short_plan_year_end, '2027-06-30');
});

test('February 29 is not a plan-year start, and the 28th is', function () {
  const bad = check({ plan_year_type: 'custom', plan_year_start_month: '2', plan_year_start_day: '29' });
  assert.equal(bad.ok, false);
  assert.ok(bad.errors.some(function (err) { return err.field === 'plan_year_start'; }));
  const good = check({ plan_year_type: 'custom', plan_year_start_month: '2', plan_year_start_day: '28' });
  assert.equal(good.ok, true);
  assert.equal(good.plan.plan_year_end_month, 2);
  assert.equal(good.plan.plan_year_end_day, 27);
});

test('an effective date before the as-of date is rejected', function () {
  const result = check({ effective_date: '2026-10-08' });
  assert.equal(result.ok, false);
  assert.ok(result.errors.some(function (err) { return err.field === 'effective_date'; }));
});

test('owner exclusions follow the entity and the LLC tax election', function () {
  assert.equal(check({ entity_type: 's-corp' }).plan.owner_rule, 's-corp');
  assert.equal(check({ entity_type: 'llc', llc_tax: 's-corp' }).plan.owner_rule, 's-corp');
  assert.equal(check({ entity_type: 'llc', llc_tax: 'partnership' }).plan.owner_rule, 'self-employed');
  assert.equal(check({ entity_type: 'llc', llc_tax: 'disregarded' }).plan.owner_rule, 'self-employed');
  assert.equal(check({ entity_type: 'llc', llc_tax: 'c-corp' }).plan.owner_rule, 'none');
  assert.equal(check({ entity_type: 'partnership' }).plan.owner_rule, 'self-employed');
  assert.equal(check({ entity_type: 'sole-prop' }).plan.owner_rule, 'self-employed');
  assert.equal(check({ entity_type: 'nonprofit' }).plan.owner_rule, 'none');
  const missing = check({ entity_type: 'llc', llc_tax: '' });
  assert.equal(missing.ok, false);
  assert.ok(missing.errors.some(function (err) { return err.field === 'llc_tax'; }));
});

test('health FSA and dependent care unused-funds choices are required only when those benefits are selected', function () {
  const bare = check({ benefits: ['hsa'] });
  assert.equal(bare.ok, true);
  assert.equal(bare.plan.health_fsa_design, '');
  assert.equal(bare.plan.dcap_unused, '');
  const health = check({ benefits: ['health_fsa'] });
  assert.equal(health.ok, false);
  assert.ok(health.errors.some(function (err) { return err.field === 'health_fsa_design'; }));
  assert.ok(health.errors.some(function (err) { return err.field === 'health_fsa_unused'; }));
  const dcap = check({ benefits: ['dcap'], dcap_unused: 'carryover' });
  assert.equal(dcap.ok, false);
  const ok = check({
    benefits: ['health_fsa', 'dcap', 'hsa'],
    health_fsa_design: 'limited',
    health_fsa_unused: 'carryover',
    dcap_unused: 'grace'
  });
  assert.equal(ok.ok, true);
});

test('other eligible class needs a description, and an EIN cannot start with 00', function () {
  const other = check({ eligible_classes: ['other'], eligible_class_other: 'no' });
  assert.equal(other.ok, false);
  const ein = check({ employer_ein: '00-1234567' });
  assert.equal(ein.ok, false);
});

test('posted booleans revalidate, including a plan object from Apps Script', function () {
  const built = check({
    prior_plan: 'yes',
    prior_adoption: '01/2018',
    plan_year_change: 'yes',
    multi_state: 'yes',
    effective_date: '2026-11-01',
    plan_year_type: 'custom',
    plan_year_start_month: '7',
    plan_year_start_day: '1'
  });
  assert.equal(built.ok, true);
  const posted = S125Model.validateSubmission({
    plan: Object.assign({}, built.plan, {
      prior_plan: true,
      plan_year_change: true,
      multi_state: true
    }),
    lead: built.lead
  }, { asOf: ASOF });
  assert.equal(posted.ok, true, JSON.stringify(posted.errors));
  assert.equal(posted.plan.short_plan_year, true);
  assert.equal(posted.plan.multi_state, true);
});

test('dollar limits and the 90-day waiting label stay on the published figures', function () {
  assert.equal(S125Model.HEALTH_FSA_LIMIT_2026, 3400);
  assert.equal(S125Model.CARRYOVER_FROM_2026, 680);
  assert.equal(S125Model.CARRYOVER_INTO_2026, 660);
  assert.equal(S125Model.DCAP_LIMIT_2026, 7500);
  assert.equal(S125Model.DCAP_MFS_2026, 3750);
  assert.equal(S125Model.WAITING.days_90, 'The 91st day of employment.');
  assert.equal(S125Model.TEMPLATE_VERSION, 's125-v1.1.0-2026-10-09');
});
