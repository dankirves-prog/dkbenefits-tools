const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');
const activity = require('../../quote-activity.js');
const math = require('../quote-math.js');
const preview = require('../preview.js');

global.fetch = function refuseNetwork() {
  throw new Error('refusing network: tests must not call the live quote endpoint');
};

const ROOT = path.join(__dirname, '../..');
const PLANS = JSON.parse(fs.readFileSync(path.join(ROOT, 'plans.json'), 'utf8'));
const LIVE_SOURCE = fs.readFileSync(path.join(ROOT, 'quote-tool.js'), 'utf8');
const PAGE = 'https://example.test/quote-tool.html';
const FIXED = '2026-10-07T15:04:00.000Z';
const UUID = '11111111-1111-4111-8111-111111111111';
const UTM = '?utm_source=google&utm_medium=cpc&utm_campaign=oct&utm_term=group-health&utm_content=hero';
const WEBHOOK = 'https://script.google.com/macros/s/AKfycby4-ZxTQfsAgIBO0JYSngccVoj5HRKtNshy6N2XlJhbxaEk2oW7b_xIRBGlcSq0CZ0z/exec';

function memoryStorage() {
  const map = new Map();
  return {
    getItem(key) { return map.has(key) ? map.get(key) : null; },
    setItem(key, value) { map.set(String(key), String(value)); },
    removeItem(key) { map.delete(key); }
  };
}

function classList(initial) {
  const set = new Set(initial || []);
  return {
    contains(name) { return set.has(name); },
    add() { Array.from(arguments).forEach((name) => set.add(name)); },
    remove() { Array.from(arguments).forEach((name) => set.delete(name)); },
    toggle(name, force) {
      const next = force === undefined ? !set.has(name) : !!force;
      if (next) set.add(name);
      else set.delete(name);
      return next;
    }
  };
}

function makeEl(initial) {
  const el = {
    value: '',
    textContent: '',
    innerHTML: '',
    disabled: false,
    style: {},
    dataset: {},
    options: [],
    classList: classList(initial),
    listeners: {},
    addEventListener(type, fn) {
      this.listeners[type] = this.listeners[type] || [];
      this.listeners[type].push(fn);
    },
    removeEventListener() {},
    querySelector() { return null; },
    querySelectorAll() { return []; },
    getBoundingClientRect() { return { top: 0, height: 0, width: 0, bottom: 0, left: 0, right: 0 }; },
    closest() { return null; },
    reset() {},
    focus() {},
    setAttribute() {},
    getAttribute() { return null; },
    click() {}
  };
  return el;
}

function fixedDate() {
  const fixed = new Date(FIXED);
  function FakeDate() {
    if (arguments.length === 0) return new Date(fixed.getTime());
    return new Date(...arguments);
  }
  FakeDate.now = () => fixed.getTime();
  FakeDate.parse = Date.parse;
  FakeDate.UTC = Date.UTC;
  FakeDate.prototype = Date.prototype;
  return FakeDate;
}

function loadLive(search) {
  const posts = [];
  const elements = new Map();
  function byId(id, extra) {
    const el = makeEl(extra && extra.hidden ? ['hidden'] : []);
    if (extra && extra.value != null) el.value = extra.value;
    elements.set(id, el);
    return el;
  }

  [
    'questionHost', 'progressBar', 'progressText', 'backBtn', 'nextBtn', 'heroStartBtn',
    'heroSection', 'funnelSection', 'resultsSummary', 'contributionLabel',
    'dependentContributionLabel', 'flatLabel', 'percentControl', 'mixNote',
    'topPlansGrid', 'lowCostPlansGrid', 'mecPlansGrid', 'toggleMecBtn',
    'editAnswersBtn', 'startOverBtn', 'heroAsideTitle', 'heroAsideList', 'heroAsideLinks'
  ].forEach((id) => byId(id));
  ['resultsSection', 'participationNote', 'flatModeNote', 'mecPlansWrap', 'leadSuccess', 'leadError'].forEach((id) => byId(id, { hidden: true }));
  byId('flatControl', { hidden: true });
  byId('flatContributionCustom', { hidden: true, value: '' });
  byId('employerContribution', { value: '50' });
  byId('dependentContribution', { value: '0' });
  byId('flatContributionSelect', { value: '300' });
  const payroll = byId('payrollSchedule', { value: '26' });
  payroll.options = [
    { value: '26', text: 'Bi-weekly' },
    { value: '52', text: 'Weekly' },
    { value: '24', text: 'Semi-monthly' },
    { value: '12', text: 'Monthly' }
  ];
  Object.defineProperty(payroll, 'selectedIndex', {
    get() { return Math.max(0, payroll.options.findIndex((option) => option.value === payroll.value)); }
  });
  ['mixEe', 'mixEs', 'mixEc', 'mixFam', 'firstName', 'email', 'phone'].forEach((id) => byId(id));
  const leadForm = byId('leadForm');
  const sortOptions = byId('sortOptions', { value: 'recommended' });
  const percentBtn = makeEl(['model-btn', 'active']);
  percentBtn.dataset.model = 'percent';
  const flatBtn = makeEl(['model-btn']);
  flatBtn.dataset.model = 'flat';
  const contribModelWrap = byId('contribModelWrap');
  contribModelWrap.querySelectorAll = (selector) => (selector === '.model-btn' ? [percentBtn, flatBtn] : []);

  const document = {
    getElementById(id) {
      if (!elements.has(id)) elements.set(id, makeEl());
      return elements.get(id);
    },
    querySelector() { return null; },
    querySelectorAll() { return []; }
  };

  const sandbox = {
    console: { log() {}, error() {}, warn() {}, info() {} },
    URLSearchParams,
    document,
    sessionStorage: memoryStorage(),
    crypto: { randomUUID: () => UUID },
    Date: fixedDate(),
    location: { search: search || '', href: PAGE },
    alert() {},
    requestAnimationFrame(fn) { return fn(); },
    matchMedia() { return { matches: false }; },
    scrollTo() {},
    pageYOffset: 0,
    fetch(url, opts) {
      const href = String(url);
      if (href.indexOf('plans.json') !== -1) {
        const body = fs.readFileSync(path.join(ROOT, 'plans.json'), 'utf8');
        return Promise.resolve({
          ok: true,
          status: 200,
          text: () => Promise.resolve(body)
        });
      }
      posts.push({ url: href, method: opts && opts.method, body: opts && opts.body });
      return Promise.resolve({
        ok: true,
        status: 200,
        text: () => Promise.resolve('{"ok":true}')
      });
    }
  };
  sandbox.window = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'quote-activity.js'), 'utf8'), sandbox, { filename: 'quote-activity.js' });
  const startup = 'answers[questions[0].key] = questions[0].options[0].value;\nupdateModelUI();';
  const injected = LIVE_SOURCE.replace(
    startup,
    `globalThis.__live = {
      get answers() { return answers; },
      get selectedPlans() { return selectedPlans; },
      get plans() { return plans; },
      get contributionModel() { return contributionModel; },
      set contributionModel(value) { contributionModel = value; updateModelUI(); },
      get sortMode() { return sortMode; },
      set sortMode(value) { sortMode = value; },
      estimateSmartMix, calcGrossPremium, calculateEmployerCost, calculateEmployerContributionForTier,
      getTierMix, getFlatAmount, getCurrentTierMix, getVisiblePlans, money, sortPlansByMode, questions,
      elements: { employerContribution, dependentContribution, flatContributionSelect, flatContributionCustom, payrollSchedule, mixEe, mixEs, mixEc, mixFam, firstName, email, phone, leadForm, mecPlansWrap, sortOptions }
    };
    ${startup}`
  );
  if (injected === LIVE_SOURCE) throw new Error('could not inject live quote tool test hook');
  vm.runInContext(injected, sandbox, { filename: 'quote-tool.js' });
  return { sandbox, posts, elements, leadForm, sortOptions };
}

async function readyLive(search) {
  const loaded = loadLive(search);
  for (let i = 0; i < 10; i += 1) {
    if (loaded.sandbox.__live && loaded.sandbox.__live.plans.length) return loaded;
    await new Promise((resolve) => setImmediate(resolve));
  }
  throw new Error('live quote tool did not finish loading plans');
}

function same(actual, expected, message) {
  assert.equal(JSON.stringify(actual), JSON.stringify(expected), message);
}

function applyMix(live, mix) {
  live.elements.mixEe.value = String(mix.employeeOnly);
  live.elements.mixEs.value = String(mix.employeeSpouse);
  live.elements.mixEc.value = String(mix.employeeChildren);
  live.elements.mixFam.value = String(mix.family);
}

function applyLiveContribution(live, scenario) {
  live.contributionModel = scenario.model;
  live.elements.employerContribution.value = String(scenario.employerPercent);
  live.elements.dependentContribution.value = String(scenario.dependentPercent);
  live.elements.flatContributionSelect.value = scenario.flatSelect;
  live.elements.flatContributionCustom.value = scenario.flatCustom || '';
  live.elements.payrollSchedule.value = String(scenario.payPeriods);
}

function previewContribution(scenario) {
  return {
    model: scenario.model,
    employerPercent: scenario.employerPercent,
    dependentPercent: scenario.dependentPercent,
    flatAmount: math.resolveFlatAmount(scenario.flatSelect, scenario.flatCustom || ''),
    payPeriods: scenario.payPeriods
  };
}

const SCENARIOS = [
  { name: 'FL 10 eligible / 7 enrolling, 50/0 bi-weekly', state: 'Florida', employees: 10, enrolling: 7, model: 'percent', employerPercent: 50, dependentPercent: 0, flatSelect: '300', payPeriods: 26 },
  { name: 'GA 5 eligible / 3 enrolling, 100/50 weekly', state: 'Georgia', employees: 5, enrolling: 3, model: 'percent', employerPercent: 100, dependentPercent: 50, flatSelect: '300', payPeriods: 52 },
  { name: 'FL 20 eligible / 15 enrolling, flat $300 semi-monthly', state: 'Florida', employees: 20, enrolling: 15, model: 'flat', employerPercent: 50, dependentPercent: 0, flatSelect: '300', payPeriods: 24, mix: { employeeOnly: 8, employeeSpouse: 3, employeeChildren: 2, family: 2 } },
  { name: 'GA 8 eligible / 6 enrolling, custom flat $250 monthly', state: 'Georgia', employees: 8, enrolling: 6, model: 'flat', employerPercent: 75, dependentPercent: 25, flatSelect: 'custom', flatCustom: '250', payPeriods: 12 },
  { name: 'FL 12 eligible / 8 enrolling, 75/25 bi-weekly', state: 'Florida', employees: 12, enrolling: 8, model: 'percent', employerPercent: 75, dependentPercent: 25, flatSelect: '400', payPeriods: 26 },
  { name: 'FL 1 enrolling, flat above premium', state: 'Florida', employees: 2, enrolling: 1, model: 'flat', employerPercent: 50, dependentPercent: 0, flatSelect: 'custom', flatCustom: '100000', payPeriods: 26 }
];

function reach(model, employees, enrolling, priority, coverage, timeline) {
  assert.equal(model.next().ok, true);
  assert.equal(model.next(String(employees)).ok, true);
  assert.equal(model.next(String(enrolling)).ok, true);
  model.setAnswer(priority || 'cost');
  assert.equal(model.next().ok, true);
  model.setAnswer(coverage || 'no');
  assert.equal(model.next().ok, true);
  model.setAnswer(timeline || '30');
  assert.equal(model.next().ok, true);
  assert.equal(model.getState().phase, 'results');
}

async function flushActivity() {
  await new Promise((resolve) => setImmediate(resolve));
  await new Promise((resolve) => setImmediate(resolve));
}

function trackerFor(storage, posts, search, pathname) {
  const tracker = activity.createQuoteActivityTracker({
    storage,
    post: (payload) => {
      posts.push(payload);
      return Promise.resolve({ ok: true });
    },
    now: () => new Date(FIXED)
  });
  const path = pathname == null ? '/quote-tool-demo/quote-tool.html' : pathname;
  tracker.captureLandingUtms(preview.attributionSearch(search || '', path));
  return tracker;
}

test('questions and answer values match the live tool', async () => {
  const { sandbox } = await readyLive('');
  const liveQuestions = sandbox.__live.questions;
  assert.equal(preview.QUESTIONS.length, liveQuestions.length);
  preview.QUESTIONS.forEach((question, index) => {
    assert.equal(question.key, liveQuestions[index].key);
    assert.equal(question.title, liveQuestions[index].title);
      if (liveQuestions[index].options) {
      same(question.options, liveQuestions[index].options, question.key);
    }
    if (liveQuestions[index].placeholder) {
      assert.equal(question.placeholder, liveQuestions[index].placeholder);
    }
  });
});

test('same inputs produce identical rates and totals for every plan', async () => {
  const { sandbox } = await readyLive('');
  const live = sandbox.__live;
  for (const scenario of SCENARIOS) {
    const mix = scenario.mix || math.estimateSmartMix(scenario.enrolling);
    applyMix(live, mix);
    applyLiveContribution(live, scenario);
    const resolved = previewContribution(scenario);
    same(math.estimateSmartMix(scenario.enrolling), live.estimateSmartMix(scenario.enrolling), scenario.name);
    for (const plan of PLANS) {
      const gross = live.calcGrossPremium(plan.rates, mix);
      const employer = live.calculateEmployerCost(plan, mix, gross);
      const previewTotals = math.planTotals(plan, mix, resolved);
      assert.equal(previewTotals.gross, gross, scenario.name + ' ' + plan.id + ' gross');
      assert.equal(previewTotals.employer, employer, scenario.name + ' ' + plan.id + ' employer');
      assert.equal(math.money(previewTotals.gross), live.money(gross));
      assert.equal(math.money(previewTotals.employer), live.money(employer));
      for (const tier of math.TIER_KEYS) {
        const livePay = Math.max(0, (plan.rates[tier] - live.calculateEmployerContributionForTier(plan, tier)) * 12 / scenario.payPeriods);
        assert.equal(previewTotals.paycheck[tier], livePay, scenario.name + ' ' + plan.id + ' ' + tier);
        assert.equal(math.money(previewTotals.paycheck[tier]), live.money(livePay));
      }
    }
  }
});

test('sort modes that exist on the live tool keep the same plan order', async () => {
  const { sandbox } = await readyLive('');
  const live = sandbox.__live;
  const mix = math.estimateSmartMix(10);
  applyMix(live, mix);
  const scenario = { model: 'percent', employerPercent: 60, dependentPercent: 20, flatSelect: '300', payPeriods: 26 };
  applyLiveContribution(live, scenario);
  const resolved = previewContribution(scenario);
  for (const mode of ['recommended', 'lowestCost', 'strongestCoverage']) {
    live.sortMode = mode;
    for (const group of ['top', 'low', 'mec']) {
      const list = PLANS.filter((plan) => plan.group === group);
      const liveIds = live.sortPlansByMode(list, mix).map((plan) => plan.id);
      const previewIds = math.sortPlans(list, mode, mix, resolved).map((plan) => plan.id);
      same(previewIds, liveIds, mode + ' ' + group);
    }
  }
});

test('default order is lowest total monthly premium, with low and MEC kept in their sections', async () => {
  const posts = [];
  const model = preview.createModel({
    plans: PLANS,
    tracker: trackerFor(memoryStorage(), posts, ''),
    pageUrl: PAGE,
    now: () => new Date(FIXED)
  });
  reach(model, 10, 7);
  const state = model.getState();
  assert.equal(state.sortMode, 'price');
  const top = state.sections.groups.find((group) => group.id === 'top').plans;
  const low = state.sections.groups.find((group) => group.id === 'low').plans;
  const premiums = top.map((plan) => math.calcGrossPremium(plan.rates, state.mixUsed));
  const sorted = premiums.slice().sort((a, b) => a - b);
  assert.deepEqual(premiums, sorted);
  assert.ok(top.length > 1);
  assert.ok(low.every((plan) => plan.group === 'low'));
  assert.ok(top.every((plan) => plan.group === 'top'));
  assert.equal(state.sections.groups.find((group) => group.id === 'mec').plans.length, 0);
  assert.deepEqual(math.listCarriers(PLANS), ['Cigna', 'UHC', 'PHCS']);
  model.setCarrier('Cigna');
  const filtered = model.getState().sections.groups.flatMap((group) => group.plans);
  assert.ok(filtered.length > 0);
  assert.ok(filtered.every((plan) => math.carrierOf(plan) === 'Cigna'));
});

test('lead POST payload matches the live tool byte for byte', async () => {
  async function compare(scenario, contact) {
    const loaded = await readyLive(UTM);
    const live = loaded.sandbox.__live;
    loaded.sandbox.sessionStorage.setItem('dkb_quote_session_id', UUID);
    live.answers.employees = String(scenario.employees);
    live.answers.enrolling = String(scenario.enrolling);
    live.answers.priority = 'cost';
    live.answers.coverage = 'no';
    live.answers.timeline = '30';
    live.answers.state = scenario.state;
    const mix = scenario.mix || math.estimateSmartMix(scenario.enrolling);
    applyMix(live, mix);
    applyLiveContribution(live, scenario);
    live.sortMode = 'recommended';
    const plan = live.plans.find((item) => item.id === 'cigna-epo-1000');
    live.selectedPlans.set(plan.id, {
      id: plan.id,
      name: plan.name,
      network: plan.network,
      typeBadge: plan.typeBadge,
      rates: plan.rates
    });
    live.elements.firstName.value = contact.firstName;
    live.elements.email.value = contact.email;
    live.elements.phone.value = contact.phone;
    await live.elements.leadForm.listeners.submit[0]({ preventDefault() {} });
    const lead = loaded.posts.map((post) => JSON.parse(post.body)).find((body) => body.event === 'lead_submitted');
    assert.ok(lead, 'live submit did not post a lead');
    assert.equal(loaded.posts.filter((post) => String(post.url).indexOf('script.google.com') !== -1).length, 1);

    const storage = memoryStorage();
    storage.setItem('dkb_quote_session_id', UUID);
    const model = preview.createModel({
      plans: PLANS,
      tracker: trackerFor(storage, [], UTM),
      pageUrl: PAGE,
      now: () => new Date(FIXED)
    });
    model.setAnswer(scenario.state);
    reach(model, scenario.employees, scenario.enrolling);
    if (scenario.mix) {
      model.setMixField('employeeOnly', scenario.mix.employeeOnly);
      model.setMixField('employeeSpouse', scenario.mix.employeeSpouse);
      model.setMixField('employeeChildren', scenario.mix.employeeChildren);
      model.setMixField('family', scenario.mix.family);
    }
    model.setContribution({
      model: scenario.model,
      employerPercent: scenario.employerPercent,
      dependentPercent: scenario.dependentPercent,
      flatSelect: scenario.flatSelect,
      flatCustom: scenario.flatCustom || '',
      payPeriods: scenario.payPeriods
    });
    model.setSort('recommended');
    model.toggleSaved('cigna-epo-1000', true);
    const payload = model.leadPayload(contact);
    assert.equal(JSON.stringify(payload), JSON.stringify(lead));
    assert.deepEqual(Object.keys(payload.contribution).sort(), ['flatDollar', 'model', 'percent']);
    assert.equal(Object.prototype.hasOwnProperty.call(payload, 'dependentPercent'), false);
    assert.deepEqual(Object.keys(payload.selectedPlans[0]), ['id', 'name', 'network', 'typeBadge', 'rates']);
  }

  await compare(SCENARIOS[0], { firstName: 'Ada', email: 'ada@example.com', phone: '407-555-0100' });
  await compare(SCENARIOS[2], { firstName: 'Grace', email: 'grace@example.com', phone: '' });
});

test('live visitors keep the old attribution, and only the preview path adds utm_source=preview', async () => {
  const livePath = '/quote-tool-demo/quote-tool.html';
  const previewPath = '/quote-tool-demo/preview/index.html';
  assert.equal(preview.attributionSearch('', livePath), '');
  assert.equal(preview.attributionSearch('?', livePath), '?');
  assert.equal(preview.attributionSearch('', previewPath), '?utm_source=preview');
  assert.equal(preview.attributionSearch('?', '/quote-tool-demo/preview/'), '?utm_source=preview');
  assert.equal(preview.attributionSearch('?utm_source=not-an-email', livePath), '?utm_source=not-an-email');
  assert.equal(preview.attributionSearch(UTM, livePath), UTM);
  assert.equal(preview.attributionSearch(UTM, previewPath), UTM);
  assert.equal(preview.WEBHOOK_URL, WEBHOOK);
  assert.equal(LIVE_SOURCE.indexOf(WEBHOOK) !== -1, true);

  const barePosts = [];
  const bare = preview.createModel({
    plans: PLANS,
    tracker: trackerFor(memoryStorage(), barePosts, '', livePath),
    pageUrl: PAGE,
    now: () => new Date(FIXED)
  });
  reach(bare, 10, 7);
  await flushActivity();
  assert.equal(barePosts.filter((post) => post.event === 'rates_displayed').length, 1);
  assert.equal(Object.hasOwn(barePosts.find((post) => post.event === 'rates_displayed'), 'utm_source'), false);
  assert.equal(barePosts.find((post) => post.event === 'rates_displayed').utm_medium, undefined);

  const previewPosts = [];
  const previewVisit = preview.createModel({
    plans: PLANS,
    tracker: trackerFor(memoryStorage(), previewPosts, '', previewPath),
    pageUrl: 'https://example.test/quote-tool-demo/preview/index.html',
    now: () => new Date(FIXED)
  });
  reach(previewVisit, 10, 7);
  await flushActivity();
  assert.equal(previewPosts.find((post) => post.event === 'rates_displayed').utm_source, 'preview');

  const taggedPosts = [];
  const tagged = preview.createModel({
    plans: PLANS,
    tracker: trackerFor(memoryStorage(), taggedPosts, UTM),
    pageUrl: PAGE,
    now: () => new Date(FIXED)
  });
  reach(tagged, 10, 7);
  await flushActivity();
  const rates = taggedPosts.find((post) => post.event === 'rates_displayed');
  assert.equal(rates.utm_source, 'google');
  assert.equal(rates.utm_medium, 'cpc');
  assert.equal(rates.utm_campaign, 'oct');
});

test('one rates_displayed per session across rerenders, and none for empty or error results', async () => {
  const posts = [];
  const storage = memoryStorage();
  const model = preview.createModel({
    plans: PLANS,
    tracker: trackerFor(storage, posts, ''),
    pageUrl: PAGE,
    now: () => new Date(FIXED)
  });
  reach(model, 10, 7);
  model.setSort('carrier');
  model.setSort('lowestCost');
  model.setSort('strongestCoverage');
  model.setSort('price');
  model.setCarrier('UHC');
  model.setCarrier('PHCS');
  model.setCarrier('All');
  model.setContribution({ employerPercent: 75 });
  model.setContribution({ employerPercent: 100, dependentPercent: 50 });
  model.setContribution({ model: 'flat', flatSelect: '400' });
  model.setContribution({ model: 'percent', employerPercent: 50, dependentPercent: 0 });
  model.setMixField('employeeOnly', 5);
  model.toggleMec(true);
  model.toggleMec(false);
  model.toggleSaved('cigna-epo-1000', true);
  await flushActivity();
  const ratesPosts = () => posts.filter((post) => post.event === 'rates_displayed');
  assert.equal(ratesPosts().length, 1);
  assert.equal(posts.filter((post) => post.event === 'quote_started').length, 1);

  const refreshed = preview.createModel({
    plans: PLANS,
    tracker: trackerFor(storage, posts, ''),
    pageUrl: PAGE,
    now: () => new Date(FIXED)
  });
  reach(refreshed, 10, 7);
  refreshed.setSort('carrier');
  refreshed.setContribution({ employerPercent: 80 });
  await flushActivity();
  assert.equal(ratesPosts().length, 1);
  assert.equal(posts.filter((post) => post.event === 'quote_started').length, 1);

  const emptyPosts = [];
  const zeroPlans = PLANS.map((plan) => ({
    ...plan,
    rates: { employeeOnly: 0, employeeSpouse: 0, employeeChildren: 0, family: 0 }
  }));
  const empty = preview.createModel({
    plans: zeroPlans,
    tracker: trackerFor(memoryStorage(), emptyPosts, ''),
    pageUrl: PAGE,
    now: () => new Date(FIXED)
  });
  reach(empty, 10, 7);
  empty.setSort('price');
  empty.setCarrier('Cigna');
  await flushActivity();
  assert.equal(emptyPosts.filter((post) => post.event === 'rates_displayed').length, 0);
  assert.equal(emptyPosts.filter((post) => post.event === 'quote_started').length, 1);

  const blankPosts = [];
  const blank = preview.createModel({
    plans: [],
    tracker: trackerFor(memoryStorage(), blankPosts, ''),
    pageUrl: PAGE,
    now: () => new Date(FIXED)
  });
  reach(blank, 4, 3);
  await flushActivity();
  assert.equal(blankPosts.filter((post) => post.event === 'rates_displayed').length, 0);

  const errorPosts = [];
  const errorModel = preview.createModel({
    plans: PLANS,
    tracker: trackerFor(memoryStorage(), errorPosts, ''),
    pageUrl: PAGE,
    now: () => new Date(FIXED)
  });
  errorModel.reportLoadError(new Error('Failed to load plans.json (500)'));
  await flushActivity();
  assert.equal(errorPosts.filter((post) => post.event === 'rates_displayed').length, 0);
});

test('enrolling cannot exceed eligible, and back keeps answers', () => {
  const model = preview.createModel({
    plans: PLANS,
    tracker: trackerFor(memoryStorage(), [], ''),
    pageUrl: PAGE,
    now: () => new Date(FIXED)
  });
  assert.equal(model.next().ok, true);
  assert.equal(model.next('10').ok, true);
  const blocked = model.next('11');
  assert.equal(blocked.ok, false);
  assert.match(blocked.error, /can’t be higher/i);
  assert.equal(model.getState().step, 2);
  assert.equal(model.next('10').ok, true);
  model.back();
  model.back();
  assert.equal(model.getState().answers.enrolling, '10');
  assert.equal(model.getState().answers.employees, '10');
  assert.equal(model.getState().question.key, 'employees');
  const lowered = model.next('9');
  assert.equal(lowered.ok, false);
  assert.match(lowered.error, /can’t be lower/i);
  assert.equal(model.next('12').ok, true);
  assert.equal(model.next('10').ok, true);
  model.setAnswer('balanced');
  assert.equal(model.next().ok, true);
  model.back();
  assert.equal(model.getState().question.key, 'priority');
  assert.equal(model.getState().answers.priority, 'balanced');
  assert.equal(model.getState().answers.employees, '12');
});

test('carrier filter does not change the lead visiblePlans fields', () => {
  const model = preview.createModel({
    plans: PLANS,
    tracker: trackerFor(memoryStorage(), [], UTM),
    pageUrl: PAGE,
    now: () => new Date(FIXED)
  });
  reach(model, 10, 7);
  model.setSort('price');
  const before = model.leadPayload({ firstName: 'Ada', email: 'ada@example.com', phone: '' }).visiblePlans;
  model.setCarrier('UHC');
  const after = model.leadPayload({ firstName: 'Ada', email: 'ada@example.com', phone: '' }).visiblePlans;
  assert.deepEqual(after, before);
  assert.ok(before.length > after.filter((plan) => /uhc|united/i.test(plan.name + plan.network)).length);
});

test('display names are normalized and badges stay exactly as written', () => {
  const united = PLANS.find((plan) => plan.id === 'uhc-ppo-3000-hsa');
  const epo = PLANS.find((plan) => plan.id === 'cigna-epo-1000');
  assert.equal(united.name, 'United Healthcare PPO 3000 HSA');
  assert.equal(math.displayName(united), 'UHC PPO 3000 HSA');
  assert.equal(math.displayName(epo), 'Cigna EPO 1000');
  assert.equal(epo.typeBadge, 'Excellent Value');
  const model = preview.createModel({ plans: PLANS, pageUrl: PAGE, now: () => new Date(FIXED) });
  reach(model, 10, 7);
  const card = preview.planArticle(epo, model.getState());
  assert.match(card, /Excellent Value/);
  assert.match(card, /Save plan/);
  assert.match(card, /View plan details/);
  assert.match(card, /Employee \+ Spouse/);
  const hsa = preview.planArticle(PLANS.find((plan) => plan.id === 'cigna-epo-1750-hsa'), model.getState());
  assert.match(hsa, /Incl \$25 Monthly HSA/);
  const low = preview.planArticle(PLANS.find((plan) => plan.id === 'phcs-visit-limit-1000'), model.getState());
  assert.match(low, /not traditional major medical/i);
  assert.match(low, /Lower Cost/);
  model.toggleSaved('uhc-ppo-3000-hsa', true);
  const saved = model.leadPayload({ firstName: 'Ada', email: 'ada@example.com', phone: '' }).selectedPlans[0];
  assert.equal(saved.name, 'United Healthcare PPO 3000 HSA');
  assert.equal(saved.typeBadge, 'Strong Network');
  const sorted = math.sortPlans(PLANS.filter((plan) => math.carrierOf(plan) === 'UHC'), 'carrier', math.estimateSmartMix(7), {
    model: 'percent', employerPercent: 50, dependentPercent: 0, flatAmount: 300, payPeriods: 26
  }).map(math.displayName);
  const ordered = sorted.slice().sort((a, b) => a.localeCompare(b));
  assert.deepEqual(sorted, ordered);
});

test('enrollment mix cannot exceed eligible and a different total is called out', () => {
  const model = preview.createModel({ plans: PLANS, pageUrl: PAGE, now: () => new Date(FIXED) });
  reach(model, 10, 7);
  const before = Object.assign({}, model.getState().mixUsed);
  assert.equal(math.mixTotal(before), 7);
  assert.equal(model.getState().mixNote, '');
  model.setMixField('family', 9);
  const blocked = model.getState();
  assert.equal(blocked.mixOk, false);
  assert.match(blocked.mixNote, /can’t be higher/);
  assert.deepEqual(blocked.mixUsed, before);
  const grossBefore = math.planTotals(PLANS[0], before, blocked.resolvedContribution).gross;
  const grossAfter = math.planTotals(PLANS[0], blocked.mixUsed, blocked.resolvedContribution).gross;
  assert.equal(grossAfter, grossBefore);
  model.setMixField('family', 0);
  const warned = model.getState();
  assert.equal(warned.mixOk, true);
  assert.equal(math.mixTotal(warned.mixUsed), 6);
  assert.match(warned.mixNote, /about 7/);
  assert.match(warned.summaryLine, /Estimates use a mix of 6/);
});

test('saved plans compare and print selection', () => {
  const model = preview.createModel({ plans: PLANS, pageUrl: PAGE, now: () => new Date(FIXED) });
  reach(model, 10, 7);
  const all = model.plansForPrint('all');
  assert.ok(all.length > 4);
  assert.equal(model.plansForPrint('saved').length, 0);
  assert.equal(model.plansForPrint('auto').length, all.length);
  model.toggleSaved('cigna-epo-1000', true);
  model.toggleSaved('UHC-PPO-2000-Deductible', true);
  model.toggleSaved('cigna-epo-1750-hsa', true);
  const saved = model.plansForPrint('saved').map((item) => item.plan.id);
  assert.deepEqual(saved, model.plansForPrint('auto').map((item) => item.plan.id));
  assert.equal(saved.length, 3);
  assert.ok(model.plansForPrint('all').length > saved.length);
  const state = model.getState();
  const compare = preview.compareHtml(state);
  assert.match(compare, /Excellent Value/);
  assert.match(compare, /Top Rated Network/);
  assert.match(compare, /Incl \$25 Monthly HSA/);
  assert.match(compare, /Employee paycheck/);
  assert.match(compare, /Out-of-pocket max/);
  assert.match(compare, /Inpatient Hospital/);
  assert.match(compare, /\$2,500 copay per admission after deductible/);
  assert.match(compare, /Outpatient Surgery/);
  assert.match(compare, /\$2,500 copay per surgery after deductible/);
  assert.match(compare, /data-remove="cigna-epo-1000"/);
  model.setContribution({ model: 'flat', flatSelect: '300' });
  const flatCompare = preview.compareHtml(model.getState());
  assert.match(flatCompare, /Employer contribution \(flat\)/);
  assert.match(flatCompare, /employee paycheck rows/);
  const printed = preview.printHtml(model.getState());
  assert.equal((printed.match(/Important information/g) || []).length, 1);
  assert.match(printed, /Cigna EPO 1000/);
  assert.match(printed, /Inpatient Hospital/);
  assert.match(printed, /Outpatient Surgery/);
  assert.doesNotMatch(printed, /United Healthcare PPO/);
  const chunks = preview.printChunks(model.plansForPrint('all'));
  assert.ok(chunks.every((chunk) => chunk.plans.length <= 6));
  assert.ok(chunks.length > 1);
  assert.match(compare, /<th scope="row">Plan type<\/th><td>EPO<\/td>/);
  assert.match(compare, /<th scope="row">Badge<\/th><td>Excellent Value<\/td>/);
});

test('invalid counts are rejected and edit drafts survive a validation error', () => {
  const model = preview.createModel({ plans: PLANS, pageUrl: PAGE, now: () => new Date(FIXED) });
  assert.equal(model.next().ok, true);
  assert.equal(model.next('10.5').ok, false);
  assert.match(model.getState().error, /Decimals/);
  assert.equal(model.getState().step, 1);
  assert.equal(model.next('-4').ok, false);
  assert.match(model.getState().error, /at least 1/);
  assert.equal(model.next('0').ok, false);
  assert.equal(model.next('12').ok, true);
  assert.equal(model.next('3.2').ok, false);
  assert.equal(model.getState().step, 2);
  assert.equal(model.next('8').ok, true);
  model.setAnswer('balanced');
  assert.equal(model.next().ok, true);
  model.setAnswer('yes');
  assert.equal(model.next().ok, true);
  model.setAnswer('later');
  assert.equal(model.next().ok, true);
  const priced = model.getState();
  const gross = math.planTotals(PLANS[0], priced.mixUsed, priced.resolvedContribution).gross;
  assert.equal(model.setMixField('family', '1.5').ok, false);
  assert.match(model.getState().mixNote, /Decimals/);
  assert.equal(model.setMixField('employeeOnly', '-2').ok, false);
  assert.match(model.getState().mixNote, /0 or more/);
  assert.deepEqual(model.getState().mixUsed, priced.mixUsed);
  assert.equal(math.planTotals(PLANS[0], model.getState().mixUsed, model.getState().resolvedContribution).gross, gross);
  model.setMixField('family', 1);
  model.editAnswers();
  const blocked = model.applyReview({ state: 'Georgia', employees: '3', enrolling: '8' });
  assert.equal(blocked.ok, false);
  assert.match(blocked.error, /eligible/i);
  assert.equal(model.getState().answers.state, 'Florida');
  assert.equal(model.getState().answers.employees, '12');
  assert.equal(model.getState().reviewDraft.state, 'Georgia');
  assert.equal(model.getState().reviewDraft.employees, '3');
  assert.equal(model.getState().reviewDraft.enrolling, '8');
  const fixed = model.applyReview({
    state: 'Georgia',
    employees: '3',
    enrolling: '2',
    priority: 'balanced',
    coverage: 'yes',
    timeline: 'later'
  });
  assert.equal(fixed.ok, true);
  assert.equal(model.getState().reviewDraft, null);
  assert.equal(model.getState().answers.state, 'Georgia');
  assert.equal(model.getState().answers.employees, '3');
  assert.equal(model.getState().answers.enrolling, '2');
  assert.match(model.getState().summaryLine, /Georgia/);
  assert.match(model.getState().summaryLine, /3 eligible/);
  assert.doesNotMatch(model.getState().summaryLine, /Florida/);
  assert.doesNotMatch(model.getState().summaryLine, /12 eligible/);
});

test('saved plans print in one table and visit-limit wording stays attached', () => {
  const visit = PLANS.find((plan) => plan.id === 'phcs-visit-limit-1750-HSA');
  assert.equal(visit.name, 'PHCS Visit Limit 1750 HSA');
  assert.equal(math.planType(visit), 'Visit Limit');
  const legend = math.visitLimitLegend(visit).join(' ');
  assert.match(legend, /VL\* —/);
  assert.match(legend, /10 visits per year/);
  assert.match(legend, /ERVL\* —/);
  assert.match(legend, /accident-related/);
  const model = preview.createModel({ plans: PLANS, pageUrl: PAGE, now: () => new Date(FIXED) });
  reach(model, 10, 7);
  const card = preview.planArticle(visit, model.getState());
  assert.match(card, /PHCS Visit Limit 1750 HSA/);
  assert.match(card, /not traditional major medical/i);
  assert.match(card, /VL\* —/);
  assert.match(card, /Labs, X-rays and imaging are each limited to 3 per year/);
  assert.match(card, /Inpatient Hospital/);
  assert.match(card, /limit 2 ICU \+ 2 non-ICU admissions\/yr/);
  assert.match(card, /Outpatient Surgery/);
  assert.match(card, /limit 3 surgeries\/yr/);
  assert.equal((card.match(/<dt>Deductible<\/dt>/g) || []).length, 1);
  assert.equal((card.match(/<dt>Out-of-pocket max<\/dt>/g) || []).length, 1);
  model.toggleSaved('cigna-epo-1000', true);
  model.toggleSaved('UHC-PPO-2000-Deductible', true);
  model.toggleSaved('phcs-visit-limit-1750-HSA', true);
  const savedState = model.getState();
  savedState.printLayout = 'saved';
  savedState.printPlans = model.plansForPrint('saved');
  const savedHtml = preview.printHtml(savedState);
  assert.equal((savedHtml.match(/<table/g) || []).length, 1);
  assert.doesNotMatch(savedHtml, /print-next/);
  assert.match(savedHtml, /not traditional major medical/i);
  assert.match(savedHtml, /PHCS Visit Limit 1750 HSA/);
  assert.match(savedHtml, /<th scope="row">Plan type<\/th>/);
  assert.match(savedHtml, />Visit Limit</);
  assert.match(savedHtml, /<th scope="row">Badge<\/th>/);
  assert.match(savedHtml, /Incl \$25 Monthly HSA/);
  assert.match(savedHtml, /VL\* —/);
  assert.match(savedHtml, /Inpatient Hospital/);
  assert.match(savedHtml, /Outpatient Surgery/);
  const compare = preview.compareHtml(model.getState());
  assert.match(compare, /not traditional major medical/i);
  assert.match(compare, /VL\* —/);
  assert.match(compare, /coverage-warning/);
  const allState = model.getState();
  allState.printLayout = 'all';
  allState.printPlans = model.plansForPrint('all');
  const allHtml = preview.printHtml(allState);
  assert.match(allHtml, /<colgroup>/);
  assert.match(allHtml, /not traditional major medical/i);
  const allChunks = preview.printChunks(allState.printPlans);
  assert.equal(allChunks.length, Math.ceil(allState.printPlans.length / 6));
  assert.ok(allChunks.every((chunk) => chunk.plans.length <= 6));
});

test('custom flat amount starts at the current amount and visitor copy stays plain', () => {
  const page = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');
  assert.match(page, /Most carriers require the employer to pay at least 50% of employee-only coverage/);
  assert.doesNotMatch(page, /matching the current quote tool/);
  assert.match(page, /Flat amount per enrolled employee, per month/);
  assert.doesNotMatch(page, /The request sends this single amount/);
  assert.doesNotMatch(page, /including dependents/);
  const model = preview.createModel({ plans: PLANS, pageUrl: PAGE, now: () => new Date(FIXED) });
  reach(model, 10, 7);
  model.setContribution({ flatSelect: 'custom' });
  assert.equal(model.getState().contribution.flatCustom, '300');
  assert.equal(model.getState().resolvedContribution.flatAmount, 300);
  model.setContribution({ flatSelect: '400' });
  model.setContribution({ flatSelect: 'custom', flatCustom: '' });
  assert.equal(model.getState().contribution.flatCustom, '400');
  assert.equal(model.getState().resolvedContribution.flatAmount, 400);
});

test('edit answers keeps the six answers on one screen', () => {
  const model = preview.createModel({ plans: PLANS, pageUrl: PAGE, now: () => new Date(FIXED) });
  reach(model, 10, 7, 'balanced', 'yes', 'later');
  model.editAnswers();
  assert.equal(model.getState().phase, 'review');
  assert.equal(model.getState().answers.priority, 'balanced');
  const blocked = model.applyReview({ employees: '6', enrolling: '7' });
  assert.equal(blocked.ok, false);
  assert.equal(model.getState().phase, 'review');
  const updated = model.applyReview({ priority: 'hsa', timeline: '30' });
  assert.equal(updated.ok, true);
  assert.equal(model.getState().phase, 'results');
  assert.equal(model.getState().answers.priority, 'hsa');
  assert.equal(model.getState().answers.timeline, '30');
  assert.equal(model.getState().answers.coverage, 'yes');
  assert.equal(math.mixTotal(model.getState().mixUsed), 7);
});

test('preview layout does not pin controls to the screen', () => {
  const js = fs.readFileSync(path.join(__dirname, '../preview.js'), 'utf8');
  const css = fs.readFileSync(path.join(__dirname, '../preview.css'), 'utf8');
  const page = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');
  assert.equal(js.includes('scrollIntoView'), false);
  assert.equal(css.includes('position: fixed'), false);
  assert.equal(css.includes('position: sticky'), false);
  assert.equal(css.includes('100vh'), false);
  assert.match(page, /id="results-actions"/);
  assert.match(page, /class="header-phone"/);
  assert.match(page, /Get your plan details from Daniel/);
  assert.match(page, /Back to plans/);
  assert.match(page, /class="results-grid"/);
  assert.equal((page.match(/Questions\? Call or text Daniel/g) || []).length, 1);
  const live = fs.readFileSync(path.join(ROOT, 'quote-tool.html'), 'utf8');
  assert.match(live, /Get your plan details from Daniel/);
  assert.match(live, /preview\/preview\.css/);
  assert.match(live, /preview\/preview\.js/);
  assert.match(css, /results-grid/);
  assert.equal(css.includes('position: sticky'), false);
  assert.equal(js.includes('cta-strip'), false);
  assert.doesNotMatch(page, /id="dock"/);
  assert.doesNotMatch(page, /id="plans-drawer"/);
});

test('rates-as-of label lives in the preview config, not plans.json', () => {
  const config = JSON.parse(fs.readFileSync(path.join(__dirname, '../preview-config.json'), 'utf8'));
  assert.equal(config.ratesAsOfLabel, 'Rates as of October 2026');
  assert.equal(JSON.stringify(PLANS).indexOf('Rates as of October 2026'), -1);
  const plansSource = fs.readFileSync(path.join(ROOT, 'plans.json'), 'utf8');
  assert.equal(plansSource.indexOf('ratesAsOf'), -1);
});
