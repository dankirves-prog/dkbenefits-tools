const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const QE = require('../qe-model');

const root = path.join(__dirname, '..');
const paths = QE.enumerate();

function go(event, benefits, answers, timing) {
  return { event: event, benefits: benefits, answers: answers, timing: timing };
}

test('every path is unique and returns a known result', function () {
  assert.equal(paths.length, 6892);
  const ids = new Set();
  const codes = ['allowed', 'late', 'plan', 'eligibility', 'not_permitted', 'need_fact', 'carrier', 'split'];
  paths.forEach(function (state) {
    assert.equal(ids.has(state.id), false, state.id);
    ids.add(state.id);
    assert.equal(QE.pathId(state), state.id);
    const result = QE.evaluate(state);
    assert.ok(codes.indexOf(result.code) !== -1, state.id + ' ' + result.code);
    assert.equal(result.title, QE.TITLES[result.code]);
    assert.equal(result.parts.length, state.benefits.length);
    result.parts.forEach(function (part) {
      assert.ok(state.benefits.indexOf(part.benefit) !== -1);
    });
    const packed = JSON.stringify(result);
    assert.equal(packed.indexOf('\u2014'), -1, state.id);
    assert.equal(packed.indexOf('\u2013'), -1, state.id);
    assert.equal(/illegal/i.test(packed), false, state.id);
    if (result.code === 'late') {
      assert.ok(result.summary === QE.LATE30 || result.summary === QE.LATE60, result.summary);
    }
  });
});

test('a closed window stays a window, and a forbidden change stays forbidden', function () {
  const groups = new Map();
  paths.forEach(function (state) {
    const key = state.id.slice(0, state.id.lastIndexOf('~'));
    if (!groups.has(key)) groups.set(key, {});
    groups.get(key)[state.timing] = state;
  });
  groups.forEach(function (group) {
    compare(group.within_30, group.over_30);
    compare(group.within_60, group.over_60);
    compareUnknown(group.within_30, group.unknown);
    compareUnknown(group.within_60, group.unknown);
  });
});

function partMode(benefit, mode) {
  if (benefit === 'hsa' || benefit === 'aftertax') return 'none';
  if (mode === 'gate60' && benefit !== 'medical') return 'gate30from60';
  return mode;
}

function compare(early, late) {
  if (!early || !late) return;
  const before = QE.evaluate(early);
  const after = QE.evaluate(late);
  const mode = QE.windowMode(early);
  before.parts.forEach(function (part, index) {
    const other = after.parts[index];
    assert.equal(other.benefit, part.benefit, early.id);
    if (part.code === 'not_permitted' || part.code === 'need_fact' || part.code === 'carrier' || part.code === 'eligibility') {
      assert.equal(other.code, part.code, early.id + ' ' + part.benefit);
      return;
    }
    const modeForPart = partMode(part.benefit, mode);
    if (modeForPart === 'none' || modeForPart === 'record') {
      assert.equal(other.code, part.code, early.id + ' ' + part.benefit);
      return;
    }
    if (part.code === 'allowed' || part.code === 'plan') {
      assert.equal(other.code, 'late', early.id + ' ' + part.benefit);
      assert.equal(other.text, modeForPart === 'gate60' ? QE.LATE60 : QE.LATE30);
    }
  });
}

function compareUnknown(early, unknown) {
  if (!early || !unknown) return;
  const before = QE.evaluate(early);
  const after = QE.evaluate(unknown);
  const mode = QE.windowMode(early);
  before.parts.forEach(function (part, index) {
    const modeForPart = partMode(part.benefit, mode);
    if (modeForPart === 'none' || modeForPart === 'record') return;
    if (part.code === 'allowed' || part.code === 'plan') {
      assert.equal(after.parts[index].code, 'need_fact', early.id + ' ' + part.benefit);
    }
  });
}

test('critical headlines match the rules', function () {
  const cases = [
    ['marriage add', go('marriage', ['medical'], { change: 'add_family' }, 'within_30'), 'allowed', /first day of the next month/],
    ['marriage late', go('marriage', ['medical'], { change: 'add_family' }, 'over_30'), 'late', new RegExp(escapeRe(QE.LATE30))],
    ['marriage drop none', go('marriage', ['medical'], { change: 'drop_to_spouse', covered: 'no' }, 'within_30'), 'not_permitted', /not permitted/],
    ['marriage drop family', go('marriage', ['medical'], { change: 'drop_to_spouse', covered: 'family' }, 'within_30'), 'allowed', /family members/],
    ['marriage drop employee only', go('marriage', ['medical'], { change: 'drop_to_spouse', covered: 'employee_only' }, 'within_30'), 'plan', /Do not drop/],
    ['marriage switch', go('marriage', ['medical'], { change: 'switch_plan' }, 'within_30'), 'allowed', /benefit package/],
    ['birth add', go('birth', ['medical'], { change: 'add_or_switch' }, 'within_30'), 'allowed', /date of birth/],
    ['birth drop', go('birth', ['medical'], { change: 'drop' }, 'within_30'), 'not_permitted', /not a reason to drop/],
    ['divorce spouse late', go('divorce', ['medical'], { change: 'drop_spouse' }, 'over_30'), 'eligibility', /rescission|COBRA/],
    ['divorce drop all', go('divorce', ['medical'], { change: 'drop_all' }, 'within_30'), 'not_permitted', /does not let the employee drop/],
    ['divorce child stays', go('divorce', ['medical'], { change: 'drop_child', child_reason: 'still_eligible' }, 'within_30'), 'not_permitted', /still eligible/],
    ['divorce child order', go('divorce', ['medical'], { change: 'drop_child', child_reason: 'other_parent' }, 'within_30'), 'allowed', /actually in place/],
    ['divorce child ineligible', go('divorce', ['medical'], { change: 'drop_child', child_reason: 'not_eligible' }, 'over_30'), 'eligibility', /age 26/],
    ['loss eligibility', go('lost_coverage', ['medical'], { who: 'employee', reason: 'eligibility', change: 'enroll' }, 'within_30'), 'allowed', /special enrollment/],
    ['loss voluntary', go('lost_coverage', ['medical'], { who: 'employee', reason: 'voluntary', change: 'enroll' }, 'within_30'), 'not_permitted', /nonpayment or fraud/],
    ['loss COBRA exhausted', go('lost_coverage', ['medical'], { who: 'employee', reason: 'cobra_exhausted', change: 'enroll' }, 'within_30'), 'allowed', /COBRA/],
    ['loss contributions', go('lost_coverage', ['medical'], { who: 'employee', reason: 'contributions', change: 'enroll' }, 'within_30'), 'allowed', /stopped contributing|contribut/],
    ['loss chip', go('lost_coverage', ['medical'], { who: 'employee', reason: 'chip_or_medicaid', change: 'enroll' }, 'within_60'), 'allowed', /60 days/],
    ['loss chip late', go('lost_coverage', ['medical'], { who: 'employee', reason: 'chip_or_medicaid', change: 'enroll' }, 'over_60'), 'late', new RegExp(escapeRe(QE.LATE60))],
    ['loss drop', go('lost_coverage', ['medical'], { who: 'employee', reason: 'eligibility', change: 'drop' }, 'within_30'), 'not_permitted', /not a reason to drop/],
    ['gained match', go('gained_coverage', ['medical'], { who: 'everyone', change: 'drop_all' }, 'within_30'), 'allowed', /match/],
    ['gained mismatch', go('gained_coverage', ['medical'], { who: 'employee_only', change: 'drop_spouse' }, 'within_30'), 'not_permitted', /does not cover/],
    ['hours notice', go('job_leave', ['medical'], { situation: 'hours_under_30', change: 'revoke' }, 'within_30'), 'plan', /2014-55/],
    ['lost eligibility late', go('job_leave', ['medical'], { situation: 'lost_eligibility', change: 'end_coverage' }, 'over_30'), 'eligibility', /no longer eligible/],
    ['FMLA', go('job_leave', ['medical'], { situation: 'fmla', change: 'revoke' }, 'not_applicable'), 'allowed', /FMLA/],
    ['new eligibility', go('job_leave', ['medical'], { situation: 'gained_eligibility', change: 'enroll' }, 'within_30'), 'allowed', /waiting period/],
    ['new eligibility drop', go('job_leave', ['medical'], { situation: 'gained_eligibility', change: 'drop' }, 'within_30'), 'not_permitted', /not a reason to drop/],
    ['other leave', go('job_leave', ['medical'], { situation: 'other_leave', change: 'drop' }, 'within_30'), 'not_permitted', /eligibility stays the same/],
    ['USERRA continue', go('job_leave', ['medical'], { situation: 'userra', change: 'continue' }, 'not_applicable'), 'allowed', /24 months/],
    ['Medicare gain', go('medicare', ['medical'], { what: 'gained', who: 'employee', change: 'reduce_person' }, 'within_30'), 'allowed', /Part A or Part B/],
    ['Medicare late', go('medicare', ['medical'], { what: 'gained', who: 'employee', change: 'reduce_person' }, 'over_30'), 'late', new RegExp(escapeRe(QE.LATE30))],
    ['Medicare others', go('medicare', ['medical'], { what: 'gained', who: 'employee', change: 'drop_others' }, 'within_30'), 'not_permitted', /only for the person/],
    ['Medicaid loss', go('medicaid_chip', ['medical'], { what: 'lost_eligibility', who: 'employee', change: 'enroll_person' }, 'within_60'), 'allowed', /60 days/],
    ['Medicaid gain drop', go('medicaid_chip', ['medical'], { what: 'gained_medicaid', who: 'employee', change: 'drop_person' }, 'within_30'), 'allowed', /prospective|cancel or reduce/],
    ['Medicaid gain enroll', go('medicaid_chip', ['medical'], { what: 'gained_medicaid', who: 'employee', change: 'enroll_person' }, 'within_30'), 'not_permitted', /does not match/],
    ['premium assistance drop', go('medicaid_chip', ['medical'], { what: 'premium_assistance', who: 'employee', change: 'drop_person' }, 'within_60'), 'not_permitted', /reasons to enroll/],
    ['court enroll', go('court_order', ['medical'], { change: 'enroll' }, 'not_applicable'), 'eligibility', /QMCSO/],
    ['court drop missing', go('court_order', ['medical'], { change: 'drop', covered_elsewhere: 'no' }, 'within_30'), 'not_permitted', /actually in place/],
    ['court drop covered', go('court_order', ['medical'], { change: 'drop', covered_elsewhere: 'yes' }, 'within_30'), 'allowed', /actually in place/],
    ['move still covered', go('move', ['medical'], { effect: 'still', change: 'drop' }, 'within_30'), 'not_permitted', /still covers/],
    ['death of child drop others', go('death', ['medical'], { who: 'child', change: 'drop_others' }, 'over_30'), 'not_permitted', /still living/],
    ['employee death late', go('death', ['medical'], { who: 'employee', change: 'remove_deceased' }, 'over_30'), 'eligibility', /36 months/],
    ['marketplace revoke', go('marketplace', ['medical'], { change: 'revoke' }, 'within_30'), 'plan', /2014-55/],
    ['marketplace join', go('marketplace', ['medical'], { change: 'join_here' }, 'within_30'), 'not_permitted', /does not create a right/],
    ['pretax marriage', go('marriage', ['pretax_other'], { change: 'add_family' }, 'within_30'), 'plan', /Section 125 still applies/],
    ['still eligible dependent', go('aged_out', ['medical'], { status: 'still' }, 'within_30'), 'not_permitted', /still meets/],
    ['partial curtailment drop', go('coverage_change', ['medical'], { kind: 'partial', change: 'drop' }, 'within_30'), 'not_permitted', /does not let the employee drop/],
    ['small cost', go('cost_change', ['medical'], { size: 'small' }, 'not_applicable'), 'allowed', /does not get a new choice/],
    ['significant drop with similar', go('cost_change', ['medical'], { size: 'increase', change: 'drop', similar: 'yes' }, 'within_30'), 'not_permitted', /cannot simply drop/],
    ['relative daycare', go('cost_change', ['dcap'], { size: 'daycare', relative: 'yes' }, 'within_30'), 'not_permitted', /relative/],
    ['nonrelative daycare', go('cost_change', ['dcap'], { size: 'daycare', relative: 'no' }, 'within_30'), 'allowed', /not a relative/],
    ['child turned 13', go('aged_out', ['dcap'], { status: 'turned_13' }, 'over_30'), 'allowed', /Turning 13/]
  ];
  cases.forEach(function (row) {
    const result = QE.evaluate(row[1]);
    assert.equal(result.code, row[2], row[0] + ' ' + result.summary);
    assert.match(result.summary, row[3], row[0]);
  });
});

test('benefit-specific blocks', function () {
  const gained = QE.evaluate(go('gained_coverage', ['medical', 'hfsa'], { who: 'everyone', change: 'drop_all' }, 'within_30'));
  assert.equal(gained.code, 'split');
  assert.equal(gained.parts[1].code, 'not_permitted');

  const hoursFsa = QE.evaluate(go('job_leave', ['hfsa'], { situation: 'hours_under_30', change: 'revoke' }, 'within_30'));
  assert.equal(hoursFsa.code, 'not_permitted');
  assert.match(hoursFsa.summary, /health FSA/);

  const costFsa = QE.evaluate(go('cost_change', ['hfsa'], { size: 'increase', change: 'pay_more' }, 'within_30'));
  assert.equal(costFsa.code, 'not_permitted');

  const moveFsa = QE.evaluate(go('move', ['medical', 'hfsa'], { effect: 'out_other', change: 'switch' }, 'within_30'));
  assert.equal(moveFsa.code, 'split');
  assert.equal(moveFsa.parts.find(function (part) { return part.benefit === 'hfsa'; }).code, 'not_permitted');

  const marketFsa = QE.evaluate(go('marketplace', ['hfsa'], { change: 'revoke' }, 'within_30'));
  assert.equal(marketFsa.code, 'not_permitted');

  const otherPlan = QE.evaluate(go('coverage_change', ['medical', 'hfsa'], { kind: 'other_employer', direction: 'add_there' }, 'within_30'));
  assert.equal(otherPlan.code, 'split');

  const hsa = QE.evaluate(go('marriage', ['hsa'], { hsa_change: 'change_amount' }, 'not_applicable'));
  assert.equal(hsa.code, 'allowed');
  assert.equal(hsa.window, 'none');
  assert.match(hsa.summary, /prospective/i);

  const aftertax = QE.evaluate(go('birth', ['aftertax'], { change: 'drop' }, 'not_applicable'));
  assert.equal(aftertax.code, 'carrier');
  assert.equal(aftertax.window, 'none');
  assert.equal(aftertax.nudge, false);
});

test('Medicare is not the 60-day CHIP window, and CHIP loss is', function () {
  const medicare = go('medicare', ['medical'], { what: 'gained', who: 'employee', change: 'reduce_person' }, 'within_30');
  assert.notEqual(QE.windowMode(medicare), 'gate60');
  const chip = go('medicaid_chip', ['medical'], { what: 'lost_eligibility', who: 'employee', change: 'enroll_person' }, 'within_60');
  assert.equal(QE.windowMode(chip), 'gate60');
  const gained = go('medicaid_chip', ['medical'], { what: 'gained_medicaid', who: 'employee', change: 'drop_person' }, 'within_30');
  assert.equal(QE.windowMode(gained), 'gate30');
  const court = go('court_order', ['medical'], { change: 'enroll' }, 'not_applicable');
  assert.equal(QE.windowMode(court), 'none');
  const fmla = go('job_leave', ['medical'], { situation: 'fmla', change: 'keep' }, 'not_applicable');
  assert.equal(QE.windowMode(fmla), 'none');
});

test('scenario object is one place a later form can read', function () {
  const state = go('marriage', ['medical'], { change: 'add_family' }, 'within_30');
  const view = QE.scenario(state);
  assert.deepEqual(Object.keys(view), ['event', 'change', 'timing', 'coverage', 'followups', 'result']);
  assert.equal(view.event.id, 'marriage');
  assert.equal(view.change.id, 'add_family');
  assert.equal(view.timing.id, 'within_30');
  assert.deepEqual(view.coverage.map(function (item) { return item.id; }), ['medical']);
  assert.equal(view.followups.length, 0);
  assert.equal(view.result.code, 'allowed');
  assert.equal(view.result.nudgeUrl, 'https://www.dkbenefits.net/section125plantool');
  const lost = QE.scenario(go('lost_coverage', ['medical', 'dental_vision'], { who: 'child', reason: 'eligibility', change: 'enroll' }, 'within_30'));
  assert.deepEqual(lost.followups.map(function (item) { return item.id; }), ['who', 'reason']);
  assert.equal(lost.coverage.length, 2);
});

test('source and scenario matrix have no em dashes and the matrix matches the engine', function () {
  ['qe-model.js', 'qe-ui.js', 'qe.css', 'index.html', 'embed.html', 'SCENARIOS.md'].forEach(function (name) {
    const text = fs.readFileSync(path.join(root, name), 'utf8');
    assert.equal(text.indexOf('\u2014'), -1, name);
    assert.equal(text.indexOf('\u2013'), -1, name);
    assert.equal(/postMessage\(\s*[^)]*['"]\*['"]\s*\)/.test(text), false, name);
  });
  const embed = fs.readFileSync(path.join(root, 'embed.html'), 'utf8');
  assert.match(embed, /https:\/\/dankirves-prog\.github\.io\/dkbenefits-tools\/qualifying-event\/index\.html/);
  assert.match(embed, /data\.type === 'resize'/);
  assert.match(embed, /qualifying-event/);
  const matrix = fs.readFileSync(path.join(root, 'SCENARIOS.md'), 'utf8');
  assert.equal(matrix, QE.scenariosMarkdown(paths));
  assert.match(matrix, /Path count: 6892/);
});

function escapeRe(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
