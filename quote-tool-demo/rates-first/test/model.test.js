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

test('lead state is collected on the form and activity stays off unless live', () => {
  const calls = [];
  const tracker = {
    onQuoteStarted(details) { calls.push(['started', details]); },
    onRatesRendered(input) { calls.push(['rates', input.details]); },
    decorateLeadPayload(payload) { return Object.assign({ event: 'lead_submitted' }, payload); }
  };
  const quiet = model({ tracker, live: false });
  quiet.setCarrier('UHC');
  quiet.setSort('price');
  quiet.toggleSaved('cigna-epo-1000', true);
  quiet.noteInteraction();
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

  const live = model({ tracker, live: true });
  live.setSort('carrier');
  live.setCarrier('PHCS');
  assert.equal(calls.length, 1);
  assert.equal(calls[0][0], 'started');
  assert.equal(calls[0][1].firstName, 'Quote process started');
  live.setEnrolling('7');
  assert.equal(calls.length, 1);
  live.setContribution({ model: 'percent', employerPercent: 75, dependentPercent: 0 });
  assert.equal(calls.length, 2);
  assert.equal(calls[1][0], 'rates');
  assert.equal(calls[1][1].firstName, 'Rates displayed');
  assert.equal(calls[1][1].answers.state, '');
  assert.equal(calls[1][1].answers.enrolling, '7');
  assert.equal(calls[1][1].answers.priority, '');
  assert.equal(calls[1][1].contribution.percent, 75);
  assert.deepEqual(calls[1][1].tierMix, math.estimateSmartMix(7));
  live.setPayCycle('26');
  live.setContribution({ employerPercent: 50 });
  assert.equal(calls.length, 2);
  live.setLeadState('Other');
  live.setHelp('Ready to enroll');
  const lead = live.leadPayload({ firstName: 'Pat', email: 'pat@example.com', phone: '407-555-0100' });
  assert.equal(lead.event, 'lead_submitted');
  assert.equal(lead.answers.state, 'Other');
  assert.equal(lead.helpWith, 'Ready to enroll');
  assert.equal(lead.email, 'pat@example.com');
  assert.equal(calls.length, 2);
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
  assert.match(rates.WEBHOOK_URL, /lSq0CZ0z\/exec$/);
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
  assert.doesNotMatch(livePage, /utm_source=preview|noindex/);
  assert.doesNotMatch(demoPage, /__rfLive/);
  assert.match(demoPage, /fetch\('\.\.\/plans\.json'/);
  assert.match(demoPage, /noindex/);
});
