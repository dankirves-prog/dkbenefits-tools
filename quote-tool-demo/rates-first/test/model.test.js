const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

global.fetch = function refuseNetwork() {
  throw new Error('refusing network: tests must not call the live quote endpoint');
};

const math = require('../quote-math.js');
const rates = require('../rates-first.js');

const PLANS = JSON.parse(fs.readFileSync(path.join(__dirname, '../../plans.json'), 'utf8'));
const SAVED_IDS = [
  'cigna-ppo-8300-hsa',
  'cigna-epo-1750-hsa',
  'UHC-PPO-2000-Deductible',
  'phcs-visit-limit-1750-HSA',
  'cigna-epo-1000',
  'uhc-ppo-3000-hsa'
];
const FULL_MIX = { employeeOnly: '4', employeeSpouse: '1', employeeChildren: '1', family: '1' };

function model(extra) {
  return rates.createModel(Object.assign({ plans: PLANS, live: false }, extra || {}));
}

function featured(instance) {
  return instance.getState().sections.groups.find((group) => group.id === 'top').plans;
}

function applyMix(instance, mix) {
  Object.keys(mix).forEach((field) => {
    assert.equal(instance.setMixField(field, mix[field]).ok, true);
  });
}

function applyFull(instance) {
  assert.equal(instance.setEligible('10').ok, true);
  assert.equal(instance.setEnrolling('7').ok, true);
  applyMix(instance, FULL_MIX);
  instance.setContribution({ model: 'percent', employerPercent: 50, dependentPercent: 0 });
  instance.setPayCycle('26');
}

function printState(instance, mode) {
  const state = instance.getState();
  state.printMode = mode;
  state.printPlans = instance.plansForPrint(mode);
  return state;
}

test('landing state shows tier rates only, cheapest employee-only first', () => {
  const quote = model();
  const state = quote.getState();
  assert.equal(state.showGross, false);
  assert.equal(state.showEmployer, false);
  assert.equal(state.showPaycheck, false);
  assert.equal(state.sortMode, 'price');
  assert.equal(state.eligible, '');
  assert.equal(state.enrolling, '');
  assert.deepEqual(state.mix, { employeeOnly: '', employeeSpouse: '', employeeChildren: '', family: '' });
  assert.equal(state.contribution.model, '');
  assert.equal(state.contribution.employerPercent, null);
  assert.equal(state.contribution.payPeriods, null);
  assert.equal(state.leadState, '');
  assert.equal(featured(quote)[0].id, 'cigna-epo-1750-hsa');
  assert.equal(featured(quote)[0].rates.employeeOnly, 459);
  const ids = featured(quote).map((plan) => plan.rates.employeeOnly);
  assert.deepEqual(ids, ids.slice().sort((a, b) => a - b));
  const card = rates.planArticle(featured(quote)[0], state);
  assert.match(card, /Employee Only/);
  assert.match(card, /Employee \+ Spouse/);
  assert.match(card, /Employee \+ Child\(ren\)/);
  assert.match(card, /Family/);
  assert.match(card, /\$459/);
  assert.doesNotMatch(card, /EE Cost PPP|Total monthly premium|Employer monthly contribution|Per paycheck|You save/i);
  const html = rates.printHtml(printState(quote, 'all'));
  assert.match(html, /Published monthly tier rates/);
  assert.match(html, /Important information/);
  assert.match(html, /Notes and Limitations/);
  assert.match(html, /class="coverage-warning"/);
  assert.match(html, /This is not traditional major medical coverage\./);
  assert.doesNotMatch(html, /EE Cost PPP|Total monthly premium|Employer monthly contribution|per pay period/i);
  const sheets = html.match(/class="print-sheet/g) || [];
  assert.equal(sheets.length, 3);
  const columns = [...html.matchAll(/<section class="print-sheet[\s\S]*?<\/section>/g)].map((match) => (match[0].match(/class="print-tier/g) || []).length);
  assert.deepEqual(columns, [6, 6, 6]);
});

test('partial group info reveals only the figures that can be computed', () => {
  const quote = model();
  const plan = PLANS.find((item) => item.id === 'cigna-epo-1000');
  quote.setEnrolling('7');
  let state = quote.getState();
  assert.equal(state.showGross, true);
  assert.deepEqual(state.mixUsed, math.estimateSmartMix(7));
  assert.equal(state.mixNote, 'Estimated mix, edit any number');
  assert.equal(state.showEmployer, false);
  assert.equal(state.showPaycheck, false);
  const enrollingOnly = rates.printHtml(printState(quote, 'all'));
  assert.match(enrollingOnly, /Total monthly premium/);
  assert.match(enrollingOnly, /Enrollment mix: 4 employee only/);
  assert.doesNotMatch(enrollingOnly, /EE Cost PPP|Employer monthly/);
  applyMix(quote, FULL_MIX);
  state = quote.getState();
  assert.equal(state.enrolling, '7');
  const grossOnly = rates.planArticle(plan, state);
  const expectedGross = math.money(math.planTotals(plan, state.mixUsed, state.resolvedContribution).gross);
  assert.match(grossOnly, /Total monthly premium/);
  assert.match(grossOnly, new RegExp(expectedGross.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  assert.doesNotMatch(grossOnly, /Employer monthly contribution|Per paycheck/);
  quote.setContribution({ model: 'percent', employerPercent: 50 });
  state = quote.getState();
  assert.equal(state.showEmployer, true);
  assert.equal(state.showPaycheck, false);
  assert.equal(state.contribution.dependentPercent, null);
  const split = rates.planArticle(plan, state);
  assert.match(split, /Employer monthly contribution/);
  assert.doesNotMatch(split, /Per paycheck|EE Cost PPP/);
  quote.setPayCycle('26');
  state = quote.getState();
  assert.equal(state.showPaycheck, true);
  const full = rates.planArticle(plan, state);
  const totals = math.planTotals(plan, { employeeOnly: 4, employeeSpouse: 1, employeeChildren: 1, family: 1 }, {
    model: 'percent',
    employerPercent: 50,
    dependentPercent: 0,
    flatAmount: 0,
    payPeriods: 26
  });
  assert.match(full, new RegExp(math.money(totals.paycheck.employeeOnly).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  const printed = rates.printHtml(printState(quote, 'all'));
  assert.match(printed, /Total monthly premium/);
  assert.match(printed, /Employer monthly contribution/);
  assert.match(printed, /EE Cost PPP/);
  assert.match(printed, /Enrollment mix: 4 employee only/);
  assert.match(printed, /Employer pays 50% of the employee-only premium and 0% of the dependent portion/);
  assert.match(printed, /PPP = per pay period \(Bi-weekly, 26\)/);
  quote.clearGroup();
  state = quote.getState();
  assert.equal(state.showGross, false);
  assert.equal(state.showPaycheck, false);
  assert.doesNotMatch(rates.printHtml(printState(quote, 'all')), /EE Cost PPP|Total monthly premium/);
});

test('a hand-edited mix stays put until reset to the estimate', () => {
  const quote = model();
  quote.setEnrolling('7');
  assert.equal(quote.setMixField('family', '2').ok, true);
  quote.setEnrolling('9');
  const held = quote.getState();
  assert.equal(held.mix.family, '2');
  assert.equal(held.mixManual, true);
  assert.match(held.mixNote, /This mix totals/);
  assert.equal(held.showGross, true);
  quote.resetMix();
  const reset = quote.getState();
  assert.equal(reset.mixManual, false);
  assert.deepEqual(reset.mixUsed, math.estimateSmartMix(9));
  assert.equal(reset.mixNote, 'Estimated mix, edit any number');
  quote.setEnrolling('');
  assert.equal(quote.getState().showGross, false);
  assert.equal(quote.getState().mix.employeeOnly, '');
});

test('save, compare, carrier filter, and print work before any group info', () => {
  const quote = model();
  SAVED_IDS.forEach((id) => quote.toggleSaved(id, true));
  quote.setCarrier('Cigna');
  const visible = quote.getState().sections.groups.flatMap((group) => group.plans);
  assert.ok(visible.length > 0);
  assert.ok(visible.every((plan) => math.carrierOf(plan) === 'Cigna'));
  const saved = quote.plansForPrint('saved').map((item) => item.plan.id);
  assert.deepEqual(saved.slice().sort(), SAVED_IDS.slice().sort());
  assert.equal(saved[0], 'cigna-epo-1750-hsa');
  assert.equal(saved[saved.length - 1], 'phcs-visit-limit-1750-HSA');
  const all = quote.plansForPrint('all').map((item) => item.plan.id);
  assert.ok(all.every((id) => math.carrierOf(PLANS.find((plan) => plan.id === id)) === 'Cigna'));
  assert.ok(!all.includes('phcs-visit-limit-1750-HSA'));
  const compared = rates.compareHtml(Object.assign(quote.getState(), {
    savedFull: quote.plansForPrint('saved').map((item) => item.plan)
  }));
  assert.match(compared, /phcs-visit-limit-1750-HSA|Visit Limit/);
  assert.doesNotMatch(compared, /Total monthly premium|EE Cost PPP/);
  assert.equal(quote.getState().toolbarPrint.label, 'Print selected (6)');
  assert.equal(quote.getState().toolbarPrint.mode, 'saved');
  quote.setCarrier('All');
  SAVED_IDS.forEach((id) => quote.toggleSaved(id, false));
  assert.equal(quote.getState().toolbarPrint.label, 'Print all');
  assert.equal(quote.getState().toolbarPrint.mode, 'all');
  quote.setCarrier('Cigna');
  assert.equal(quote.getState().toolbarPrint.label, 'Print Cigna');
  quote.setCarrier('PHCS');
  assert.equal(quote.getState().toolbarPrint.label, 'Print PHCS');
  quote.setCarrier('UHC');
  assert.equal(quote.getState().toolbarPrint.label, 'Print UHC');
  assert.ok(quote.plansForPrint('all').every((item) => math.carrierOf(item.plan) === 'UHC'));
  quote.toggleSaved('cigna-epo-1750-hsa', true);
  quote.toggleSaved('UHC-PPO-2000-Deductible', true);
  quote.toggleSaved('phcs-visit-limit-1750-HSA', true);
  assert.equal(quote.getState().toolbarPrint.label, 'Print selected (3)');
  assert.equal(quote.getState().toolbarPrint.mode, 'saved');
  const selected = quote.plansForPrint(quote.getState().toolbarPrint.mode).map((item) => item.plan.id);
  assert.deepEqual(selected.slice().sort(), ['UHC-PPO-2000-Deductible', 'cigna-epo-1750-hsa', 'phcs-visit-limit-1750-HSA'].sort());
  selected.forEach((id) => quote.toggleSaved(id, false));
  assert.equal(quote.getState().toolbarPrint.label, 'Print UHC');
  quote.setCarrier('All');
  quote.setSort('strongestCoverage');
  assert.equal(featured(quote)[0].id, 'uhc-ppo-3500');
  quote.setSort('lowestCost');
  assert.equal(featured(quote)[0].id, 'cigna-epo-1750-hsa');
});

function activityCalls() {
  const calls = [];
  const queue = [];
  const tracker = {
    onQuoteAccessed(details) { calls.push(['accessed', details]); },
    onGroupSize(details) { calls.push(['group', details]); },
    onContributionIdentified(details) { calls.push(['contribution', details]); },
    decorateLeadPayload(payload) { return Object.assign({ event: 'lead_submitted' }, payload); }
  };
  const clock = {
    schedule(fn) {
      const id = queue.length + 1;
      queue.push({ id, fn });
      return id;
    },
    cancel(id) {
      const index = queue.findIndex((item) => item.id === id);
      if (index >= 0) queue.splice(index, 1);
    },
    flush() {
      queue.splice(0).forEach((item) => item.fn());
    },
    pending() { return queue.length; }
  };
  return { calls, tracker, clock };
}

test('lead state is collected on the form and activity stays off unless live', () => {
  const quietLog = activityCalls();
  const tracker = quietLog.tracker;
  const calls = quietLog.calls;
  const quiet = model({ tracker, live: false, schedule: quietLog.clock.schedule, cancel: quietLog.clock.cancel });
  quiet.setCarrier('UHC');
  quiet.setSort('price');
  quiet.toggleSaved('cigna-epo-1000', true);
  quiet.noteInteraction();
  quiet.setEligible('12');
  quiet.settleGroupSize();
  quietLog.clock.flush();
  quiet.setEnrolling('7');
  quiet.setContribution({ model: 'percent', employerPercent: 50 });
  assert.equal(calls.length, 0);
  quiet.setLeadState('Georgia');
  quiet.setHelp('Talk through these plans');
  const silentLead = quiet.leadPayload({ firstName: 'Pat', email: 'pat@example.com', phone: '' });
  assert.equal(silentLead.answers.state, 'Georgia');
  assert.equal(silentLead.helpWith, 'Talk through these plans');
  assert.equal(silentLead.notes, undefined);
  assert.equal(silentLead.comments, undefined);
  assert.equal(silentLead.comment, undefined);
  assert.equal(silentLead.message, undefined);
  assert.equal(silentLead.contribution.model, 'percent');
  assert.equal(silentLead.contribution.percent, 50);
  assert.equal(silentLead.contribution.flatDollar, null);
  assert.equal(silentLead.selectedPlans[0].id, 'cigna-epo-1000');

  const blank = model();
  const emptyLead = blank.leadPayload({ firstName: 'Pat', email: 'pat@example.com', phone: '' });
  assert.equal(emptyLead.answers.state, '');
  assert.equal(emptyLead.helpWith, '');
  assert.equal(emptyLead.contribution.percent, null);
  assert.equal(emptyLead.contribution.flatDollar, null);
  assert.equal(emptyLead.answers.priority, '');
  assert.equal(emptyLead.answers.coverage, '');
  assert.equal(emptyLead.answers.timeline, '');

  const liveLog = activityCalls();
  const live = model({
    tracker: liveLog.tracker,
    live: true,
    schedule: liveLog.clock.schedule,
    cancel: liveLog.clock.cancel
  });
  const liveCalls = liveLog.calls;
  live.setSort('carrier');
  live.setCarrier('PHCS');
  assert.equal(liveCalls.length, 1);
  assert.equal(liveCalls[0][0], 'accessed');
  assert.equal(liveCalls[0][1].firstName, 'Quote page accessed');
  assert.equal(liveCalls[0][1].email, '');
  assert.equal(liveCalls[0][1].phone, '');
  assert.equal(liveCalls[0][1].answers.employees, '');
  assert.equal(liveCalls[0][1].answers.enrolling, '');
  live.setEnrolling('7');
  assert.equal(liveCalls.length, 1);
  live.settleGroupSize();
  assert.equal(liveCalls.length, 2);
  assert.equal(liveCalls[1][0], 'group');
  assert.equal(liveCalls[1][1].firstName, 'Group size');
  assert.equal(liveCalls[1][1].answers.state, '');
  assert.equal(liveCalls[1][1].answers.employees, '');
  assert.equal(liveCalls[1][1].answers.enrolling, '7');
  assert.equal(liveCalls[1][1].answers.priority, '');
  assert.deepEqual(liveCalls[1][1].tierMix, math.estimateSmartMix(7));
  live.setEnrolling('8');
  live.settleGroupSize();
  liveLog.clock.flush();
  assert.equal(liveCalls.filter((call) => call[0] === 'group').length, 1);
  live.setPayCycle('26');
  live.setContribution({ model: 'percent', employerPercent: 75, dependentPercent: 0 });
  assert.equal(liveCalls.length, 3);
  assert.equal(liveCalls[2][0], 'contribution');
  assert.equal(liveCalls[2][1].firstName, 'Contribution identified');
  assert.equal(liveCalls[2][1].answers.enrolling, '8');
  assert.equal(liveCalls[2][1].contribution.percent, 75);
  assert.equal(liveCalls[2][1].contribution.dependentPercent, 0);
  assert.equal(liveCalls[2][1].contribution.payPeriods, 26);
  assert.deepEqual(liveCalls[2][1].tierMix, math.estimateSmartMix(8));
  live.setContribution({ employerPercent: 50 });
  assert.equal(liveCalls.filter((call) => call[0] === 'contribution').length, 1);
  live.setLeadState('Other');
  live.setHelp('Ready to enroll');
  const lead = live.leadPayload({ firstName: 'Pat', email: 'pat@example.com', phone: '407-555-0100' });
  assert.equal(lead.event, 'lead_submitted');
  assert.equal(lead.answers.state, 'Other');
  assert.equal(lead.helpWith, 'Ready to enroll');
  assert.equal(lead.email, 'pat@example.com');
  assert.equal(liveCalls.length, 3);
  assert.equal(Object.hasOwn(lead.contribution, 'payPeriods'), false);
  assert.equal(Object.hasOwn(lead.contribution, 'dependentPercent'), false);
});

test('group size and contribution wait for a settled value and send once', () => {
  const log = activityCalls();
  const quote = model({
    tracker: log.tracker,
    live: true,
    schedule: log.clock.schedule,
    cancel: log.clock.cancel
  });
  quote.setCarrier('Cigna');
  quote.setEligible('1');
  quote.setEligible('12');
  assert.equal(log.calls.filter((call) => call[0] === 'group').length, 0);
  assert.equal(log.clock.pending(), 1);
  log.clock.flush();
  const group = log.calls.find((call) => call[0] === 'group')[1];
  assert.equal(group.firstName, 'Group size');
  assert.equal(group.answers.employees, '12');
  assert.equal(group.answers.enrolling, '');
  assert.equal(Object.hasOwn(group, 'tierMix'), false);
  quote.setEligible('15');
  quote.settleGroupSize();
  log.clock.flush();
  assert.equal(log.calls.filter((call) => call[0] === 'group').length, 1);

  quote.setEnrolling('7');
  quote.settleGroupSize();
  quote.setPayCycle('26');
  quote.setContribution({ model: 'flat', flatAmount: 4, defer: true, entry: 'custom' });
  quote.setContribution({ model: 'flat', flatAmount: 40, defer: true, entry: 'custom' });
  quote.setContribution({ model: 'flat', flatAmount: 400, defer: true, entry: 'custom' });
  assert.equal(log.calls.filter((call) => call[0] === 'contribution').length, 0);
  log.clock.flush();
  const contribution = log.calls.find((call) => call[0] === 'contribution')[1];
  assert.equal(contribution.firstName, 'Contribution identified');
  assert.equal(contribution.answers.employees, '15');
  assert.equal(contribution.answers.enrolling, '7');
  assert.equal(contribution.contribution.model, 'flat');
  assert.equal(contribution.contribution.flatDollar, 400);
  assert.equal(contribution.contribution.percent, null);
  assert.equal(contribution.contribution.payPeriods, 26);
  assert.deepEqual(contribution.tierMix, math.estimateSmartMix(7));
  quote.setContribution({ model: 'flat', flatAmount: 500, defer: true, entry: 'custom' });
  log.clock.flush();
  assert.deepEqual(log.calls.map((call) => call[0]), ['accessed', 'group', 'contribution']);

  const immediate = activityCalls();
  const percent = model({
    tracker: immediate.tracker,
    live: true,
    schedule: immediate.clock.schedule,
    cancel: immediate.clock.cancel
  });
  percent.setContribution({ model: 'percent', employerPercent: 60 });
  assert.deepEqual(immediate.calls.map((call) => call[0]), ['accessed', 'contribution']);
  assert.equal(immediate.calls[1][1].answers.employees, '');
  assert.equal(immediate.calls[1][1].answers.enrolling, '');
  assert.equal(immediate.calls[1][1].contribution.percent, 60);
  assert.equal(immediate.clock.pending(), 0);
});

test('custom flat replaces a preset and the math matches the typed amount', () => {
  const quote = model();
  const plan = PLANS.find((item) => item.id === 'cigna-epo-1750-hsa');
  quote.setEligible('10');
  quote.setEnrolling('7');
  quote.setContribution({ model: 'flat', flatAmount: 400, entry: 'preset' });
  let state = quote.getState();
  assert.equal(state.contribution.flatAmount, 400);
  assert.equal(state.flatEntry, 'preset');
  assert.equal(state.showEmployer, true);
  quote.openCustomFlat();
  state = quote.getState();
  assert.equal(state.flatEntry, 'custom');
  assert.equal(state.flatDraft, '');
  assert.equal(state.contribution.flatAmount, null);
  assert.equal(state.showEmployer, false);
  assert.doesNotMatch(rates.planArticle(plan, state), /Employer monthly contribution|\$2,800/);
  assert.doesNotMatch(rates.printHtml(printState(quote, 'all')), /Employer monthly contribution/);
  quote.setCustomFlatText('250');
  state = quote.getState();
  assert.equal(state.flatDraft, '250');
  assert.equal(state.contribution.flatAmount, 250);
  assert.equal(state.flatError, '');
  assert.equal(state.showEmployer, true);
  assert.equal(state.resolvedContribution.flatAmount, 250);
  const priced = rates.planArticle(plan, state);
  assert.match(priced, /\$1,750/);
  assert.doesNotMatch(priced, /\$2,800/);
  quote.setCustomFlatText('2.5');
  state = quote.getState();
  assert.equal(state.flatDraft, '2.5');
  assert.equal(state.contribution.flatAmount, null);
  assert.match(state.flatError, /whole number/);
  assert.equal(state.showEmployer, false);
  quote.setCustomFlatText('');
  assert.equal(quote.getState().contribution.flatAmount, null);
  assert.equal(quote.getState().flatDraft, '');
});

test('invalid enrolling clears calculated output and group size sends only a settled number', () => {
  const quote = model();
  const plan = PLANS.find((item) => item.id === 'cigna-epo-1750-hsa');
  quote.setEligible('10');
  quote.setEnrolling('7');
  assert.equal(quote.getState().showGross, true);
  const tooMany = quote.setEnrolling('12');
  assert.equal(tooMany.ok, false);
  assert.match(tooMany.error, /higher than/);
  let state = quote.getState();
  assert.equal(state.enrolling, '12');
  assert.equal(state.showGross, false);
  assert.equal(state.showEmployer, false);
  assert.doesNotMatch(rates.planArticle(plan, state), /Total monthly premium|Employer monthly contribution/);
  assert.doesNotMatch(rates.printHtml(printState(quote, 'all')), /Total monthly premium|Employer monthly contribution/);
  const decimal = quote.setEnrolling('2.5');
  assert.equal(decimal.ok, false);
  state = quote.getState();
  assert.equal(state.enrolling, '2.5');
  assert.notEqual(state.enrolling, '52');
  assert.notEqual(state.enrolling, '2');
  assert.equal(state.showGross, false);
  assert.match(state.mixNote, /Decimals/);
  quote.setEnrolling('7');
  assert.equal(quote.getState().enrolling, '7');
  assert.equal(quote.getState().showGross, true);

  const stale = activityCalls();
  const live = model({
    tracker: stale.tracker,
    live: true,
    schedule: stale.clock.schedule,
    cancel: stale.clock.cancel
  });
  live.setEnrolling('2');
  live.setEnrolling('2.5');
  assert.equal(stale.clock.pending(), 0);
  stale.clock.flush();
  live.settleGroupSize();
  assert.equal(stale.calls.filter((call) => call[0] === 'group').length, 0);
  assert.equal(live.getState().enrolling, '2.5');
  assert.equal(live.getState().showGross, false);
  live.setEnrolling('8');
  live.settleGroupSize();
  const settled = stale.calls.find((call) => call[0] === 'group')[1];
  assert.equal(settled.answers.enrolling, '8');
  assert.equal(settled.answers.employees, '');

  const crossed = activityCalls();
  const group = model({
    tracker: crossed.tracker,
    live: true,
    schedule: crossed.clock.schedule,
    cancel: crossed.clock.cancel
  });
  group.setEligible('10');
  group.setEnrolling('7');
  group.setEnrolling('12');
  assert.equal(group.getState().showGross, false);
  crossed.clock.flush();
  const sent = crossed.calls.find((call) => call[0] === 'group')[1];
  assert.equal(sent.answers.employees, '10');
  assert.equal(sent.answers.enrolling, '');
  assert.equal(crossed.calls.filter((call) => call[0] === 'group').length, 1);

  const typed = activityCalls();
  const flat = model({
    tracker: typed.tracker,
    live: true,
    schedule: typed.clock.schedule,
    cancel: typed.clock.cancel
  });
  flat.setCustomFlatText('4');
  flat.setCustomFlatText('2.5');
  assert.equal(typed.clock.pending(), 0);
  typed.clock.flush();
  assert.equal(typed.calls.filter((call) => call[0] === 'contribution').length, 0);
  flat.setCustomFlatText('4');
  flat.setCustomFlatText('40');
  flat.setCustomFlatText('400');
  assert.equal(typed.calls.filter((call) => call[0] === 'contribution').length, 0);
  typed.clock.flush();
  const contribution = typed.calls.find((call) => call[0] === 'contribution')[1];
  assert.equal(contribution.contribution.flatDollar, 400);
  assert.equal(typed.calls.filter((call) => call[0] === 'contribution').length, 1);
});

test('the page does not gate rates behind the questionnaire', () => {
  const page = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');
  assert.match(page, /Group health rates for small businesses/);
  assert.match(page, /No company info needed\. No spam\./);
  assert.match(page, /fetch\('\.\.\/plans\.json'/);
  assert.match(page, /Customize for your group/);
  assert.match(page, /data-state="Florida"/);
  assert.match(page, /data-state="Georgia"/);
  assert.match(page, /data-state="Other"/);
  assert.match(page, /id="contact-btn"[^>]*>Let's Talk</);
  assert.match(page, /id="lead-submit"[^>]*>Let's Talk</);
  assert.match(page, /id="drawer-send"[^>]*>Let's Talk</);
  assert.doesNotMatch(page, /Send these|send these rates/i);
  assert.match(page, /id="lead-heading">Let's Talk</);
  assert.match(page, /Questions, more options, or ready to enroll\? Daniel will reach out personally\./);
  assert.match(page, /data-help="Talk through these plans"/);
  assert.match(page, /data-help="See more plan options"/);
  assert.match(page, /data-help="Ready to enroll"/);
  assert.match(page, /data-help="Just learning more"/);
  assert.doesNotMatch(page, /id="lead"[^>]*\shidden/);
  assert.doesNotMatch(page, /id="question-heading"|What state is your business in\?[\s\S]{0,80}question-panel/);
  const source = fs.readFileSync(path.join(__dirname, '../rates-first.js'), 'utf8');
  assert.match(source, /live=1/);
  assert.match(source, /Demo mode, not sent/);
  assert.match(source, /Thanks! Daniel will reach out soon\./);
  assert.doesNotMatch(source, /Send these|send these rates|has your request|with this request/i);
  assert.match(source, /QuoteMath\.estimateSmartMix\(/);
  assert.equal(rates.ACTIVITY_TRACKING_ENABLED, true);
  assert.equal(rates.WEBHOOK_URL.endsWith('lcSq0CZ0z/exec'), true);
});

test('the live entry posts without ?live=1 and the demo folder stays quiet', () => {
  assert.equal(rates.shouldPostLive({ __rfLive: true, location: { search: '' } }), true);
  assert.equal(rates.shouldPostLive({ location: { search: '' } }), false);
  assert.equal(rates.shouldPostLive({ location: { search: '?utm_source=google' } }), false);
  assert.equal(rates.shouldPostLive({ location: { search: '?live=1' } }), true);
  assert.equal(rates.shouldPostLive({ __rfLive: true, location: { search: '?utm_source=google&live=1' } }), true);
  assert.equal(rates.shouldPostLive({ __rfLive: true, location: { search: '?live=0' } }), false);
  assert.equal(rates.shouldPostLive({ __rfLive: true, location: { search: '?live=0&utm_source=google' } }), false);
  assert.equal(rates.shouldPostLive({ location: { search: '?live=0' } }), false);
  const livePage = fs.readFileSync(path.join(__dirname, '../../quote-tool.html'), 'utf8');
  const demoPage = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');
  assert.match(livePage, /window\.__rfLive\s*=\s*true/);
  assert.match(livePage, /fetch\('plans\.json'/);
  assert.match(livePage, /__rfConfigUrl\s*=\s*'preview\/preview-config\.json'/);
  assert.match(livePage, /src="rates-first\/rates-first\.js"/);
  assert.match(livePage, /src="quote-activity\.js"/);
  assert.match(livePage, /id="enrolling"[^>]*type="text"[^>]*inputmode="numeric"/);
  assert.match(livePage, /id="flat-custom-amount"[^>]*type="text"[^>]*inputmode="numeric"/);
  assert.match(livePage, /id="lead-state"/);
  assert.doesNotMatch(livePage, /id="enrolling"[^>]*type="number"/);
  assert.match(demoPage, /id="enrolling"[^>]*type="text"[^>]*inputmode="numeric"/);
  assert.match(demoPage, /id="flat-custom-amount"[^>]*type="text"[^>]*inputmode="numeric"/);
  assert.doesNotMatch(livePage, /utm_source=preview|noindex/);
  assert.doesNotMatch(demoPage, /__rfLive/);
  assert.match(demoPage, /fetch\('\.\.\/plans\.json'/);
  assert.match(demoPage, /noindex/);
});
