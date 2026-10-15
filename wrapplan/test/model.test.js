const test = require('node:test');
const assert = require('node:assert/strict');
const { loadBrowserScripts, baseInput } = require('./helpers');

function model() { return loadBrowserScripts().WpModel; }

test('(a) 85 + 10 + 3 = 98 and a fully insured after-tax plan may state the exemption', function () {
  const Wp = model();
  const result = Wp.validate(baseInput({
    benefits: ['medical', 'dental'],
    carriers: { medical: 'Florida Blue', dental: 'Sun Life' },
    tax: { medical: 'aftertax', dental: 'aftertax' },
    section125: 'no',
    employee_contributions: 'yes',
    remitted: 'yes',
    trust: 'no',
    funding: 'insured',
    census: { a: '85', b: '10', c: '3', d: '0' },
    employee_count: '90'
  }));
  assert.equal(Wp.countParticipants(result.plan), 98);
  assert.equal(result.filing.code, 'exempt');
  assert.match(result.findings.join(' '), /small-plan filing exemption may apply/);
});

test('(a) 113 participants with a prior small-plan filing still requires Form 5500', function () {
  const Wp = model();
  const result = Wp.validate(baseInput({
    census: { a: '100', b: '0', c: '10', d: '3' },
    prior_small_filing: 'yes',
    employee_count: '120',
    cobra: 'yes'
  }));
  assert.equal(Wp.countParticipants(result.plan), 113);
  assert.equal(result.filing.code, 'required');
  assert.match(result.filing.text, /A Form 5500 is required/);
  assert.match(result.findings.join(' '), /prior small-plan filing does not change this/);
});

test('(a) a count of 90 is not treated as an 80-120 excuse, and a trust blocks the exemption', function () {
  const Wp = model();
  const under = Wp.filingResult(Wp.normalize(baseInput({ census: { a: '90', b: '0', c: '0', d: '0' }, trust: 'no' })));
  assert.equal(under.code, 'exempt');
  const trust = Wp.filingResult(Wp.normalize(baseInput({ census: { a: '98', b: '0', c: '0', d: '0' }, trust: 'yes', trustee_name: 'First Bank' })));
  assert.equal(trust.code, 'required');
});

test('(b) governmental, church, and owner-only explain and do not build an ERISA plan mode', function () {
  const Wp = model();
  ['governmental', 'church', 'owner-only'].forEach(function (path) {
    const result = Wp.validate(baseInput({ erisa_path: path }));
    assert.equal(result.ok, true);
    assert.equal(result.mode, 'explain');
    assert.equal(result.lead.contact_email, 'hr@harbordental.example');
  });
  const employed = Wp.validate(baseInput({ erisa_path: 'private' }));
  assert.equal(employed.mode, 'plan');
});

test('plan number 500 fails and 501 passes; phone is optional; name and email are required', function () {
  const Wp = model();
  const bad = Wp.validate(baseInput({ plan_number: '500' }));
  assert.equal(bad.ok, false);
  assert.ok(bad.errors.some(function (error) { return error.field === 'plan_number'; }));
  const good = Wp.validate(baseInput({ plan_number: '501', contact_phone: '' }));
  assert.equal(good.ok, true);
  const junk = Wp.validate(baseInput({ plan_number: '501a' }));
  assert.equal(junk.ok, false);
  assert.ok(junk.errors.some(function (error) { return error.field === 'plan_number'; }));
  const missing = Wp.validate(baseInput({ contact_name: '', contact_email: '' }));
  assert.equal(missing.ok, false);
  const census = Wp.validate(baseInput({ census: { a: '', b: '0', c: '0', d: '0' } }));
  assert.equal(census.ok, false);
  assert.ok(census.errors.some(function (error) { return error.field === 'census_a'; }));
});

test('self-funded contributions need a Section 125 plan before the exemption is stated', function () {
  const Wp = model();
  const missing = Wp.filingResult(Wp.normalize(baseInput({
    funding: 'level',
    section125: 'no',
    employee_contributions: 'yes',
    census: { a: '40', b: '0', c: '0', d: '0' },
    trust: 'no'
  })));
  assert.equal(missing.code, 'unconfirmed');
  const ok = Wp.filingResult(Wp.normalize(baseInput({
    funding: 'level',
    section125: 'yes',
    employee_contributions: 'yes',
    census: { a: '40', b: '0', c: '0', d: '0' },
    trust: 'no'
  })));
  assert.equal(ok.code, 'exempt');
});

test('parity prints for insured medical at any size, and for level-funded only above 50 employees', function () {
  const Wp = model();
  assert.equal(Wp.parityMode(Wp.normalize(baseInput({ funding: 'insured', employee_count: '10' }))), 'print');
  assert.equal(Wp.parityMode(Wp.normalize(baseInput({ funding: 'level', employee_count: '40' }))), 'booklet');
  assert.equal(Wp.parityMode(Wp.normalize(baseInput({ funding: 'aso', employee_count: '60' }))), 'print');
});

test('payroll-practice disability and safe-harbor voluntary benefits are left out; pre-tax voluntary benefits are wrapped', function () {
  const Wp = model();
  const payroll = Wp.normalize(baseInput({ benefits: ['std'], std_type: 'general-assets', carriers: { std: 'Employer' } }));
  assert.equal(Wp.wrappedBenefits(payroll).indexOf('std'), -1);
  const trustStd = Wp.normalize(baseInput({ benefits: ['std'], std_type: 'trust', carriers: { std: 'Trust Co' } }));
  assert.ok(Wp.wrappedBenefits(trustStd).indexOf('std') !== -1);
  const safe = Wp.normalize(baseInput({
    benefits: ['vol_life'],
    carriers: { vol_life: 'Aflac' },
    vol_pretax: 'no',
    vol_contrib: 'no',
    vol_voluntary: 'yes',
    vol_endorse: 'no',
    vol_payroll_only: 'yes',
    vol_consideration: 'no'
  }));
  assert.equal(Wp.voluntaryWrapped(safe).include, false);
  const pretax = Wp.normalize(Object.assign({}, safe, { vol_pretax: 'yes' }));
  assert.equal(Wp.voluntaryWrapped(pretax).include, true);
  assert.match(Wp.voluntaryWrapped(pretax).reason, /Pre-tax/);
});

test('renewal date moves to the next business morning when the 90-day mark has passed', function () {
  const Wp = model();
  const asOf = new Date(2026, 9, 15, 15, 0, 0);
  const when = Wp.renewalReminderOn(Wp.normalize(baseInput({ plan_year_type: 'calendar' })), asOf);
  assert.equal(when, '2026-10-16');
});

test('lead score awards a phone and does not award points for a required name or email', function () {
  const Wp = model();
  const noPhone = Wp.leadScore(Wp.normalize(baseInput({ contact_phone: '', employee_count: '10', census: { a: '10', b: '0', c: '0', d: '0' } })));
  const withPhone = Wp.leadScore(Wp.normalize(baseInput({ contact_phone: '4075550100', employee_count: '10', census: { a: '10', b: '0', c: '0', d: '0' } })));
  assert.equal(noPhone, 0);
  assert.equal(withPhone, 20);
});

test('self-funded nondiscrimination warning does not depend on employee contributions', function () {
  const Wp = model();
  const notes = Wp.findingsFor(Wp.normalize(baseInput({
    funding: 'aso',
    employee_count: '60',
    employee_contributions: 'no',
    census: { a: '40', b: '0', c: '0', d: '0' },
    phi: 'yes',
    phi_classes: 'Benefits staff'
  })));
  assert.match(notes.join(' '), /nondiscrimination/);
});

test('allowlist includes the Wix filesusr parent and the editor preview origins', function () {
  const Wp = model();
  assert.ok(Wp.originAllowed('https://www-dkbenefits-net.filesusr.com'));
  assert.ok(Wp.originAllowed('https://editor.wix.com'));
  assert.equal(Wp.originAllowed('https://evil.example'), false);
});
