const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { loadBrowserScripts, baseInput, root } = require('./helpers');

function boot() { return loadBrowserScripts(); }

test('business phone is required and the SPD does not use a records fallback', function () {
  const context = boot();
  const missing = context.WpModel.validate(baseInput({ phone: '' }));
  assert.equal(missing.ok, false);
  assert.ok(missing.errors.some(function (error) { return error.field === 'phone'; }));
  const pack = context.WpModel.validate(baseInput());
  const spd = context.WpDocgen.plainText(context.WpDocgen.spdParagraphs(pack.plan));
  assert.match(spd, /407-555-0148/);
  assert.doesNotMatch(spd, /the number on the employer's records/);
  const blank = context.WpDocgen.plainText(context.WpDocgen.spdParagraphs(context.WpModel.normalize(baseInput({
    phone: '',
    carrier_addresses: { medical: '', dental: '', vision: '' }
  }))));
  assert.match(blank, /Address: ________________ \(copy it from your certificate\)/);
  assert.doesNotMatch(blank, /the number on the employer's records/);
});

test('January is a calendar year and July ends in June', function () {
  const Wp = boot().WpModel;
  const january = Wp.planYearFromStart(1);
  assert.equal(january.plan_year_type, 'calendar');
  assert.equal(january.plan_year_end_month, '12');
  const july = Wp.planYearFromStart(7);
  assert.equal(july.plan_year_type, 'fiscal');
  assert.equal(july.plan_year_end_month, '6');
  const plan = Wp.normalize(baseInput({ plan_year_start_month: '7' }));
  assert.equal(plan.plan_year_type, 'fiscal');
  assert.equal(plan.plan_year_end_month, '6');
});

test('effective date choices stay correct in the last month of the plan year', function () {
  const Wp = boot().WpModel;
  for (var month = 1; month <= 12; month++) {
    const mid = Wp.effectiveDateChoices(month, new Date(2026, month - 1, 15));
    assert.equal(mid.current, '2026-' + String(month).padStart(2, '0') + '-01');
    assert.equal(mid.next.slice(0, 4), '2027');
    const lastMonth = month === 1 ? 12 : month - 1;
    const lastYear = month === 1 ? 2026 : 2026;
    const asOf = new Date(lastYear, lastMonth - 1, 20);
    const edge = Wp.effectiveDateChoices(month, asOf);
    if (month === 1) {
      assert.equal(edge.current, '2026-01-01');
      assert.equal(edge.next, '2027-01-01');
    } else {
      assert.equal(edge.current, '2025-' + String(month).padStart(2, '0') + '-01');
      assert.equal(edge.next, '2026-' + String(month).padStart(2, '0') + '-01');
    }
  }
});

test('voluntary benefits can be included, left out, or forced in by tax treatment', function () {
  const context = boot();
  const Wp = context.WpModel;
  const base = {
    benefits: ['vol_life'],
    carriers: { vol_life: 'Aflac' },
    tax: { vol_life: 'aftertax' },
    vol_contrib: '',
    vol_voluntary: '',
    vol_endorse: '',
    vol_payroll_only: '',
    vol_consideration: ''
  };
  const left = Wp.normalize(baseInput(Object.assign({}, base, { vol_include: 'no' })));
  assert.equal(Wp.wrappedBenefits(left).indexOf('vol_life'), -1);
  const included = Wp.normalize(baseInput(Object.assign({}, base, { vol_include: 'yes' })));
  assert.ok(Wp.wrappedBenefits(included).indexOf('vol_life') !== -1);
  const forced = Wp.normalize(baseInput(Object.assign({}, base, { tax: { vol_life: 'pretax' }, vol_include: 'no' })));
  assert.ok(Wp.wrappedBenefits(forced).indexOf('vol_life') !== -1);
  const paid = Wp.normalize(baseInput(Object.assign({}, base, { tax: { vol_life: 'none' } })));
  assert.ok(Wp.wrappedBenefits(paid).indexOf('vol_life') !== -1);
  const spd = context.WpDocgen.plainText(context.WpDocgen.spdParagraphs(left));
  const schedule = context.WpDocgen.plainText(context.WpDocgen.scheduleParagraphs(left));
  assert.doesNotMatch(spd, /Voluntary life/);
  assert.doesNotMatch(schedule, /Voluntary life/);
});

test('guide calendar rows follow funding, size, and the Form 5500 month', function () {
  const Wp = boot().WpModel;
  const small = Wp.normalize(baseInput({
    employee_count: '12',
    census: { a: '10', b: '0', c: '0', d: '0' },
    benefits: ['medical'],
    carriers: { medical: 'Florida Blue' },
    funding: 'insured',
    cobra: 'yes'
  }));
  assert.equal(small.cobra, 'no');
  const smallRows = Wp.guideCalendar(small);
  const smallText = smallRows.yearly.concat(smallRows.hire, smallRows.changes).join(' ');
  assert.doesNotMatch(smallText, /PCORI|COBRA|5500|ACA/);
  const level = Wp.normalize(baseInput({
    employer_name: 'Northwind Manufacturing Inc',
    employee_count: '150',
    census: { a: '140', b: '0', c: '0', d: '0' },
    funding: 'level',
    benefits: ['medical', 'dental', 'hra', 'health_fsa'],
    carriers: { medical: 'Allied', dental: 'Sun Life', hra: 'Allied', health_fsa: 'WEX' },
    tpa_name: 'Allied',
    tpa_document: 'Allied booklet',
    stop_loss: 'yes',
    hra_type: 'integrated',
    cobra: 'yes',
    phi: 'yes'
  }));
  const levelRows = Wp.guideCalendar(level);
  const levelText = levelRows.yearly.join(' ');
  assert.match(levelText, /PCORI/);
  assert.match(levelText, /5500/);
  assert.match(levelText, /summary annual report/);
  assert.match(levelText, /ACA/);
  const calendar = Wp.form5500Due(Wp.normalize(baseInput({ plan_year_type: 'calendar' })));
  assert.equal(calendar.label, 'July 31');
  const fiscal = Wp.form5500Due(Wp.normalize(baseInput({ plan_year_start_month: '7' })));
  assert.equal(fiscal.label, 'the following January 31');
});

test('the SPD file has its own cover and a certificate page', function () {
  const context = boot();
  const result = context.WpModel.validate(baseInput());
  const cover = context.WpDocgen.plainText(context.WpDocgen.spdCoverParagraphs(result.plan));
  const spd = context.WpDocgen.plainText(context.WpDocgen.spdParagraphs(result.plan));
  assert.match(cover, /Summary Plan Description/);
  assert.match(cover, /Keep this with your benefit certificates/);
  assert.match(cover, /407-555-0148/);
  assert.match(spd, /Your benefit certificates/);
  assert.match(spd, /Your employer attaches these behind this page/);
  assert.match(spd, /Medical: Florida Blue certificate of coverage/);
  const bytes = context.WpDocgen.buildPacketDocx([
    { rows: context.WpDocgen.spdCoverParagraphs(result.plan), footer: 'SPD' },
    { rows: context.WpDocgen.spdParagraphs(result.plan), footer: 'SPD' }
  ], { title: 'SPD' });
  assert.ok(bytes.length > 100);
});

test('the page has no hover tips', function () {
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  const js = fs.readFileSync(path.join(root, 'wrapplan.js'), 'utf8');
  const css = fs.readFileSync(path.join(root, 'wrapplan.css'), 'utf8');
  const blob = html + js + css;
  assert.doesNotMatch(blob, /class="info"|class="bubble"|role="tooltip"|wp-tips/);
  assert.equal(fs.existsSync(path.join(root, 'wp-tips.js')), false);
});
