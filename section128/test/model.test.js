const test = require('node:test');
const assert = require('node:assert/strict');
const { loadBrowserScripts, baseInput, ASOF } = require('./helpers');

const { S128Model } = loadBrowserScripts();

function check(overrides) {
  return S128Model.validate(baseInput(overrides), { asOf: ASOF });
}

function fields(result) {
  return result.errors.map(function (err) { return err.field; });
}

test('funding method is required and has no default', function () {
  const result = check({ funding_mode: '' });
  assert.equal(result.ok, false);
  assert.ok(fields(result).includes('funding_mode'));
  assert.equal(S128Model.fundingLabel(''), '');
});

test('employer grant only, statutory cap', function () {
  const result = check();
  assert.equal(result.ok, true, JSON.stringify(result.errors));
  assert.equal(result.plan.employer_annual_grant, 1000);
  assert.equal(result.plan.employer_ein, '12-3456789');
  assert.equal(result.review.required, false);
  assert.match(S128Model.capText(result.plan), /\$2,500 for 2026 and 2027/);
});

test('employer grant only, fixed cap', function () {
  const result = check({ annual_cap_mode: 'fixed', fixed_annual_cap: '1500', employer_annual_grant: '1500' });
  assert.equal(result.ok, true, JSON.stringify(result.errors));
  assert.match(S128Model.capText(result.plan), /fixed cap of \$1,500/);
});

test('salary reduction only, statutory and fixed', function () {
  const salary = {
    funding_mode: 'salary_reduction_only',
    employer_annual_grant: '',
    cafeteria_plan_name: 'Northwind Cafeteria Plan',
    cafeteria_amendment_date: '2027-01-01',
    election_cutoff_days: '5',
    has_existing_125_plan: 'yes'
  };
  const statutory = check(salary);
  assert.equal(statutory.ok, true, JSON.stringify(statutory.errors));
  assert.equal(statutory.plan.employer_annual_grant, null);
  assert.match(S128Model.capacityMessage(statutory.plan), /\$2,500/);
  const fixed = check(Object.assign({}, salary, { annual_cap_mode: 'fixed', fixed_annual_cap: '800' }));
  assert.equal(fixed.ok, true, JSON.stringify(fixed.errors));
  assert.match(S128Model.capacityMessage(fixed.plan), /\$800/);
});

test('combined funding shows remaining salary reduction room', function () {
  const result = check({
    funding_mode: 'combined',
    employer_annual_grant: '1000',
    annual_cap_mode: 'fixed',
    fixed_annual_cap: '2500',
    cafeteria_plan_name: 'Northwind Cafeteria Plan',
    cafeteria_amendment_date: '2027-01-15',
    election_cutoff_days: '5',
    has_existing_125_plan: 'yes'
  });
  assert.equal(result.ok, true, JSON.stringify(result.errors));
  assert.equal(S128Model.salaryCapacity(result.plan).room, 1500);
  assert.match(S128Model.capacityMessage(result.plan), /\$1,500/);
});

test('grant above the cap, combined grant equal to the cap, and a fixed cap above $2,500 fail', function () {
  assert.ok(fields(check({ employer_annual_grant: '2600' })).includes('employer_annual_grant'));
  assert.ok(fields(check({ annual_cap_mode: 'fixed', fixed_annual_cap: '2600' })).includes('fixed_annual_cap'));
  assert.ok(fields(check({ annual_cap_mode: 'fixed', fixed_annual_cap: '1000', employer_annual_grant: '1200' })).includes('employer_annual_grant'));
  const combined = check({
    funding_mode: 'combined',
    employer_annual_grant: '2500',
    cafeteria_plan_name: 'Northwind Cafeteria Plan',
    cafeteria_amendment_date: '2027-01-01',
    election_cutoff_days: '5',
    has_existing_125_plan: 'yes'
  });
  assert.ok(fields(combined).includes('employer_annual_grant'));
});

test('effective date before July 4 2026 is rejected and a past date is only a review flag', function () {
  assert.ok(fields(check({ effective_date: '2026-07-03' })).includes('effective_date'));
  const past = check({ effective_date: '2026-08-01' });
  assert.equal(past.ok, true, JSON.stringify(past.errors));
  assert.equal(past.review.required, true);
  assert.match(past.review.reasons.join(' '), /before today/);
});

test('2028 does not invent an indexed limit', function () {
  const result = check({ effective_date: '2028-01-01', employer_annual_grant: '1000' });
  assert.equal(result.ok, true, JSON.stringify(result.errors));
  assert.match(S128Model.capText(result.plan), /not been published|not stated/i);
  assert.doesNotMatch(S128Model.capText(result.plan), /\$2,500/);
  assert.equal(result.review.required, true);
  assert.match(result.review.reasons.join(' '), /has not been published/);
  assert.ok(fields(check({ effective_date: '2028-01-01', employer_annual_grant: '2600' })).includes('employer_annual_grant'));
});

test('formats and conditional fields', function () {
  assert.ok(fields(check({ employer_ein: '00-1234567' })).includes('employer_ein'));
  assert.ok(fields(check({ employer_ein: '123456789' })).length === 0 || check({ employer_ein: '123456789' }).plan.employer_ein === '12-3456789');
  assert.equal(check({ employer_ein: '123456789' }).plan.employer_ein, '12-3456789');
  assert.ok(fields(check({ zip: '3280' })).includes('zip'));
  assert.ok(fields(check({ contact_email: 'not-an-email' })).includes('contact_email'));
  assert.ok(fields(check({ contact_phone: '555-0100' })).includes('contact_phone'));
  assert.ok(fields(check({ waiting_days: '400' })).includes('waiting_days'));
  assert.ok(fields(check({ waiting_days: '-1' })).includes('waiting_days'));
  const salaryMissing = check({ funding_mode: 'salary_reduction_only', employer_annual_grant: '' });
  assert.ok(fields(salaryMissing).includes('cafeteria_plan_name'));
  assert.ok(fields(salaryMissing).includes('election_cutoff_days'));
  assert.ok(fields(check({
    funding_mode: 'salary_reduction_only',
    employer_annual_grant: '',
    cafeteria_plan_name: 'Plan',
    cafeteria_amendment_date: '2026-01-02',
    election_cutoff_days: '45',
    has_existing_125_plan: 'yes'
  })).includes('election_cutoff_days'));
  const retro = check({
    funding_mode: 'salary_reduction_only',
    employer_annual_grant: '',
    cafeteria_plan_name: 'Plan',
    cafeteria_amendment_date: '2026-10-01',
    election_cutoff_days: '5',
    has_existing_125_plan: 'yes'
  });
  assert.ok(fields(retro).includes('cafeteria_amendment_date'));
});

test('name-based eligibility is blocked', function () {
  const result = check({
    eligibility_class_choice: 'other',
    eligibility_class_other: 'Ada Lopez, Ben Cho'
  });
  assert.ok(fields(result).includes('eligibility_class_other'));
  const okClass = check({
    eligibility_class_choice: 'other',
    eligibility_class_other: 'Full-time employees at the Orlando office'
  });
  assert.equal(okClass.ok, true, JSON.stringify(okClass.errors));
  assert.equal(okClass.review.required, true);
});

test('each review flag can be raised', function () {
  function reasons(overrides) {
    const result = check(overrides);
    assert.equal(result.ok, true, JSON.stringify(result.errors));
    return result.review.reasons.join(' ');
  }
  assert.match(reasons({ participating_employers: 'Sister Company LLC' }), /participating employers/i);
  assert.match(reasons({ related_businesses: 'unsure' }), /Related businesses/i);
  assert.match(reasons({ eligibility_class_choice: 'other', eligibility_class_other: 'Full-time employees' }), /narrower/);
  assert.match(reasons({ entity_type: 's_corp', owners_or_family_want_to_participate: 'yes' }), /2-percent/);
  assert.match(reasons({ entity_type: 'sole_prop', owners_or_family_want_to_participate: 'yes' }), /sole proprietors/i);
  assert.match(reasons({ entity_type: 'c_corp', owners_or_family_want_to_participate: 'yes' }), /highly compensated/i);
  assert.match(reasons({ allow_employee_account: 'yes' }), /own account/i);
  assert.match(reasons({
    funding_mode: 'salary_reduction_only',
    employer_annual_grant: '',
    cafeteria_plan_name: 'Plan',
    cafeteria_amendment_date: '2027-01-01',
    election_cutoff_days: '5',
    has_existing_125_plan: 'no'
  }), /Section 125/);
  assert.match(reasons({ collectively_bargained_employees: 'yes' }), /Collectively bargained/);
  assert.match(reasons({ state: 'TX', city: 'Austin', zip: '78701' }), /Business review: the employer is in TX/);
});

test('Georgia and Florida are not out-of-market flags by themselves', function () {
  assert.equal(check({ state: 'GA', city: 'Savannah', zip: '31401' }).review.required, false);
  assert.equal(check().review.required, false);
});

test('server wrapper accepts plan and lead objects', function () {
  const flat = baseInput();
  const result = S128Model.validateSubmission({ plan: flat, lead: flat }, { asOf: ASOF });
  assert.equal(result.ok, true, JSON.stringify(result.errors));
  assert.equal(result.templateVersion, 's128-v0.2-2026-10-08');
});
