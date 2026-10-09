const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { loadBrowserScripts, baseInput, ASOF } = require('./helpers');

const scripts = loadBrowserScripts();
const { S125Model } = scripts;

function check(overrides) {
  return S125Model.validate(baseInput(overrides), { asOf: ASOF });
}
function fields(result) {
  return result.errors.map(function (err) { return err.field; });
}

test('EIN, phone, ZIP, and dates format as they are typed', function () {
  assert.equal(S125Model.formatEinLive('1234567890'), '12-3456789');
  assert.equal(S125Model.formatEinLive('12-3456789'), '12-3456789');
  assert.equal(S125Model.formatEinLive('ab12'), '12');
  assert.equal(S125Model.formatPhoneLive('4074765076'), '407-476-5076');
  assert.equal(S125Model.formatPhoneLive('4074765076123999'), '407-476-5076 ext. 123999');
  assert.equal(S125Model.formatPhoneLive('1 (407) 476-5076 x123'), '407-476-5076 ext. 123');
  assert.equal(S125Model.formatZipLive('32801'), '32801');
  assert.equal(S125Model.formatZipLive('3280112349'), '32801-1234');
  assert.equal(S125Model.formatDateLive('01012027'), '01/01/2027');
  assert.equal(S125Model.formatDateLive('1/15/2027'), '01/15/2027');
  assert.equal(S125Model.formatDateCanonical('1/5/2027'), '01/05/2027');
  assert.equal(S125Model.formatMonthYearLive('012020'), '01/2020');
  assert.equal(S125Model.canonicalMonthYear('1/2020'), '01/2020');
});

test('formatted values are accepted and bad ones are rejected', function () {
  assert.equal(check({ employer_ein: '123456789' }).plan.employer_ein, '12-3456789');
  assert.ok(fields(check({ employer_ein: '12345678' })).includes('employer_ein'));
  assert.ok(fields(check({ employer_ein: '00-1234567' })).includes('employer_ein'));
  assert.equal(check({ phone: '8135550199' }).plan.phone, '813-555-0199');
  assert.equal(check({ phone: '18135550199' }).lead.contact_phone, '813-555-0199');
  assert.equal(check({ phone: '8135550199123' }).plan.phone, '813-555-0199 ext. 123');
  assert.ok(fields(check({ phone: '555-0100' })).includes('phone'));
  assert.equal(check({ zip: '336021234' }).plan.zip, '33602-1234');
  assert.ok(fields(check({ zip: '3360' })).includes('zip'));
  assert.ok(fields(check({ zip: '33602-12' })).includes('zip'));
  assert.equal(check({ effective_date: '01/01/2027' }).plan.effective_date, '2027-01-01');
  assert.equal(check({ effective_date: '1/5/2027' }).plan.effective_date, '2027-01-05');
  assert.ok(fields(check({ effective_date: '02/31/2027' })).includes('effective_date'));
  assert.ok(fields(check({ effective_date: '13/01/2027' })).includes('effective_date'));
  const adopted = check({ prior_plan: 'yes', prior_adoption: '1/2020', effective_date: '2027-01-01' });
  assert.equal(adopted.ok, true, JSON.stringify(adopted.errors));
  assert.equal(adopted.plan.prior_adoption, '01/2020');
  assert.ok(fields(check({ signer_email: 'not-an-email' })).includes('signer_email'));
  assert.ok(fields(check({ signer_email: 'a@b.c' })).includes('signer_email'));
  assert.equal(check({ signer_email: 'ada@northwind.example' }).ok, true);
});

test('numeric fields accept only whole numbers inside their min and max', function () {
  assert.equal(check({ plan_number: '501' }).plan.plan_number, '501');
  assert.equal(check({ plan_number: '999' }).plan.plan_number, '999');
  ['500', '1000', '501.5', 'abc', ''].forEach(function (value) {
    assert.ok(fields(check({ plan_number: value })).includes('plan_number'), value);
  });
  assert.equal(check({ employee_count: '1,000' }).plan.employee_count, 1000);
  assert.equal(check({ employee_count: '100000' }).plan.employee_count, 100000);
  ['0', '100001', '12.5', '40 employees'].forEach(function (value) {
    assert.ok(fields(check({ employee_count: value })).includes('employee_count'), value);
  });
  assert.equal(check({ full_time_hours: '1' }).plan.full_time_hours, 1);
  assert.equal(check({ full_time_hours: '40' }).plan.full_time_hours, 40);
  ['0', '41', '30.5'].forEach(function (value) {
    assert.ok(fields(check({ full_time_hours: value })).includes('full_time_hours'), value);
  });
  assert.equal(check({ oe_window_days: '1' }).plan.oe_window_days, 1);
  assert.equal(check({ oe_window_days: '90' }).plan.oe_window_days, 90);
  assert.equal(check({ oe_window_days: '20' }).plan.oe_start_date, '2026-12-12');
  ['0', '91', '15 days'].forEach(function (value) {
    assert.ok(fields(check({ oe_window_days: value })).includes('oe_window_days'), value);
  });
  assert.equal(check({ new_hire_window: '1' }).plan.new_hire_window, 1);
  assert.equal(check({ new_hire_window: '30' }).plan.new_hire_window, 30);
  ['0', '31', '60', '14.5'].forEach(function (value) {
    assert.ok(fields(check({ new_hire_window: value })).includes('new_hire_window'), value);
  });
});

test('sample formats are hint lines, not field placeholders', function () {
  const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  assert.doesNotMatch(html, /placeholder=/);
  assert.match(html, /id="hint_employer_ein">e\.g\. 12-3456789</);
  assert.match(html, /id="hint_phone">e\.g\. 407-476-5076</);
  assert.match(html, /id="hint_zip">e\.g\. 32801 or 32801-1234</);
  assert.match(html, /id="hint_effective_date">e\.g\. 01\/01\/2027/);
  assert.match(html, /id="hint_prior_adoption">e\.g\. 01\/2020</);
  assert.match(html, /id="hint_signer_email">e\.g\. name@company\.com</);
  assert.match(html, /id="hint_plan_number">e\.g\. 501/);
  assert.match(html, /id="plan_number"[^>]*min="501"/);
  assert.match(html, /id="plan_number"[^>]*max="999"/);
  assert.match(html, /id="employee_count"[^>]*min="1"/);
  assert.match(html, /id="employee_count"[^>]*max="100000"/);
  assert.match(html, /id="full_time_hours"[^>]*min="1"/);
  assert.match(html, /id="full_time_hours"[^>]*max="40"/);
  assert.match(html, /id="oe_window_days"[^>]*min="1"/);
  assert.match(html, /id="oe_window_days"[^>]*max="90"/);
  assert.match(html, /id="new_hire_window"[^>]*min="1"/);
  assert.match(html, /id="new_hire_window"[^>]*max="30"/);
});
