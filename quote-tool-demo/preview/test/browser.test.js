const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const test = require('node:test');

const ROOT = path.join(__dirname, '../../..');
const PLANS_PATH = path.join(ROOT, 'quote-tool-demo/plans.json');
const math = require(path.join(ROOT, 'quote-tool-demo/preview/quote-math.js'));
const CIGNA_1000 = JSON.parse(fs.readFileSync(PLANS_PATH, 'utf8')).find((plan) => plan.id === 'cigna-epo-1000');
const SEVEN_MIX = { employeeOnly: 4, employeeSpouse: 1, employeeChildren: 1, family: 1 };

function cignaTotals(employerPercent, dependentPercent) {
  const totals = math.planTotals(CIGNA_1000, SEVEN_MIX, {
    model: 'percent',
    employerPercent: employerPercent,
    dependentPercent: dependentPercent,
    payPeriods: 26
  });
  return {
    gross: math.money(totals.gross),
    employer: math.money(totals.employer),
    employeeOnly: math.money(totals.paycheck.employeeOnly),
    employeeSpouse: math.money(totals.paycheck.employeeSpouse),
    employeeChildren: math.money(totals.paycheck.employeeChildren),
    family: math.money(totals.paycheck.family)
  };
}

function quoted(amount) {
  return new RegExp(amount.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
}

const DEFAULT_CIGNA = cignaTotals(50, 0);
const FULL_SHARE_CIGNA = cignaTotals(100, 50);

function cignaEmployeePay(payPeriods) {
  return math.money(math.perPaycheck(CIGNA_1000, 'employeeOnly', {
    model: 'percent',
    employerPercent: 50,
    dependentPercent: 0,
    flatAmount: 300,
    payPeriods
  }));
}
const ARTIFACTS = '/opt/cursor/artifacts';
const PORT = 8765;
const DEBUG_PORT = 9333;
const ORIGIN = `http://127.0.0.1:${PORT}`;
const PREVIEW_URL = `${ORIGIN}/quote-tool-demo/preview/index.html`;
const WEBHOOK = 'script.google.com';

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function httpGet(url) {
  return new Promise((resolve, reject) => {
    const request = http.get(url, (response) => {
      let data = '';
      response.on('data', (chunk) => { data += chunk; });
      response.on('end', () => resolve({ status: response.statusCode, body: data }));
    });
    request.on('error', reject);
  });
}

function chromePath() {
  for (const candidate of ['/usr/bin/google-chrome-stable', '/usr/local/bin/google-chrome', '/usr/bin/google-chrome']) {
    if (fs.existsSync(candidate)) return candidate;
  }
  throw new Error('Chrome was not found');
}

test('preview page matches live rates, posts once, and renders the proposal', { timeout: 180000 }, async () => {
  fs.mkdirSync(ARTIFACTS, { recursive: true });
  const userData = '/tmp/chrome-quote-preview-8705';
  fs.rmSync(userData, { recursive: true, force: true });
  const server = spawn('python3', ['-m', 'http.server', String(PORT), '--bind', '127.0.0.1'], {
    cwd: ROOT,
    stdio: 'ignore'
  });
  const chrome = spawn(chromePath(), [
    '--headless=new',
    '--no-sandbox',
    '--disable-dev-shm-usage',
    '--disable-gpu',
    `--remote-debugging-port=${DEBUG_PORT}`,
    `--user-data-dir=${userData}`,
    '--host-resolver-rules=MAP script.google.com 127.0.0.1, MAP script.googleusercontent.com 127.0.0.1',
    'about:blank'
  ], { stdio: 'ignore' });

  const posts = [];
  let plansMode = 'live';
  let leaked = false;
  let ws;
  let sessionId;

  function send(method, params, targetSession) {
    return new Promise((resolve, reject) => {
      const id = send.nextId = (send.nextId || 0) + 1;
      send.pending.set(id, { resolve, reject });
      const message = { id, method, params: params || {} };
      if (targetSession) message.sessionId = targetSession;
      ws.send(JSON.stringify(message));
    });
  }
  send.pending = new Map();

  async function evaluate(expression) {
    const result = await send('Runtime.evaluate', {
      expression,
      awaitPromise: true,
      returnByValue: true
    }, sessionId);
    if (result.exceptionDetails) {
      throw new Error('page error: ' + JSON.stringify(result.exceptionDetails.exception || result.exceptionDetails));
    }
    return result.result ? result.result.value : undefined;
  }

  async function waitFor(predicate, label) {
    const start = Date.now();
    while (Date.now() - start < 10000) {
      if (await predicate()) return;
      await sleep(40);
    }
    throw new Error('timed out waiting for ' + label);
  }

  async function shot(name, clip) {
    const params = { format: 'png' };
    if (clip) {
      params.clip = clip;
      params.captureBeyondViewport = true;
    }
    const result = await send('Page.captureScreenshot', params, sessionId);
    const file = path.join(ARTIFACTS, name);
    fs.writeFileSync(file, Buffer.from(result.data, 'base64'));
    assert.ok(fs.statSync(file).size > 5000, name + ' screenshot was empty');
    return file;
  }

  async function setViewport(width, height) {
    await send('Emulation.setDeviceMetricsOverride', {
      width,
      height,
      deviceScaleFactor: 1,
      mobile: false
    }, sessionId);
  }

  async function setContentWidth(width, height) {
    await setViewport(width, height);
    const gutter = await evaluate('innerWidth - document.documentElement.clientWidth');
    if (gutter > 0) await setViewport(width + gutter, height);
  }

  async function pressKey(key) {
    const enter = key === 'Enter';
    const code = enter ? 'Enter' : 'Space';
    const virtual = enter ? 13 : 32;
    await send('Input.dispatchKeyEvent', {
      type: 'keyDown',
      key: enter ? 'Enter' : ' ',
      code,
      windowsVirtualKeyCode: virtual,
      nativeVirtualKeyCode: virtual,
      text: enter ? '\r' : ' '
    }, sessionId);
    await send('Input.dispatchKeyEvent', {
      type: 'keyUp',
      key: enter ? 'Enter' : ' ',
      code,
      windowsVirtualKeyCode: virtual,
      nativeVirtualKeyCode: virtual
    }, sessionId);
  }

  async function openPreview() {
    posts.length = 0;
    await send('Page.navigate', { url: PREVIEW_URL }, sessionId);
    await waitFor(async () => {
      const state = await evaluate('document.readyState');
      const heading = await evaluate('document.getElementById("question-heading") && document.getElementById("question-heading").textContent');
      const error = await evaluate('document.getElementById("load-error") && !document.getElementById("load-error").hidden');
      return state === 'complete' && (heading && heading !== 'Loading plan options…' || error);
    }, 'preview load');
    await evaluate('document.fonts && document.fonts.ready');
  }

  try {
    await waitFor(async () => {
      try {
        const page = await httpGet(`http://127.0.0.1:${PORT}/quote-tool-demo/preview/index.html`);
        return page.status === 200;
      } catch (error) {
        return false;
      }
    }, 'local server').catch(() => { throw new Error('preview server did not start'); });

    let version;
    for (let attempt = 0; attempt < 40; attempt += 1) {
      try {
        version = JSON.parse((await httpGet(`http://127.0.0.1:${DEBUG_PORT}/json/version`)).body);
        break;
      } catch (error) {
        await sleep(100);
      }
    }
    if (!version) throw new Error('Chrome debugging port did not open');
    ws = new WebSocket(version.webSocketDebuggerUrl);
    await new Promise((resolve, reject) => {
      ws.addEventListener('open', resolve);
      ws.addEventListener('error', reject);
    });
    ws.addEventListener('message', (event) => {
      const message = JSON.parse(event.data);
      if (message.id && send.pending.has(message.id)) {
        const pending = send.pending.get(message.id);
        send.pending.delete(message.id);
        if (message.error) pending.reject(new Error(JSON.stringify(message.error)));
        else pending.resolve(message.result);
      } else if (message.method === 'Fetch.requestPaused') {
        handlePaused(message).catch((error) => {
          console.error(error);
        });
      }
    });

    async function handlePaused(message) {
      const { requestId, request } = message.params;
      const url = request.url || '';
      const targetSession = message.sessionId;
      if (url.includes(WEBHOOK) || url.includes('script.googleusercontent.com')) {
        posts.push({ url, method: request.method, body: request.postData || '' });
        const body = Buffer.from('{"ok":true}').toString('base64');
        await send('Fetch.fulfillRequest', {
          requestId,
          responseCode: 200,
          responseHeaders: [
            { name: 'Content-Type', value: 'application/json' },
            { name: 'Access-Control-Allow-Origin', value: '*' }
          ],
          body
        }, targetSession);
        return;
      }
      if (url.includes('plans.json') && plansMode !== 'live') {
        if (plansMode === 'error') {
          await send('Fetch.fulfillRequest', {
            requestId,
            responseCode: 500,
            responseHeaders: [{ name: 'Content-Type', value: 'text/plain' }],
            body: Buffer.from('unavailable').toString('base64')
          }, targetSession);
          return;
        }
        const zero = JSON.parse(fs.readFileSync(PLANS_PATH, 'utf8')).map((plan) => ({
          ...plan,
          rates: { employeeOnly: 0, employeeSpouse: 0, employeeChildren: 0, family: 0 }
        }));
        await send('Fetch.fulfillRequest', {
          requestId,
          responseCode: 200,
          responseHeaders: [{ name: 'Content-Type', value: 'application/json' }],
          body: Buffer.from(JSON.stringify(zero)).toString('base64')
        }, targetSession);
        return;
      }
      if (url.includes(WEBHOOK)) leaked = true;
      await send('Fetch.continueRequest', { requestId }, targetSession);
    }

    const created = await send('Target.createTarget', { url: 'about:blank' });
    const attached = await send('Target.attachToTarget', { targetId: created.targetId, flatten: true });
    sessionId = attached.sessionId;
    await send('Page.enable', {}, sessionId);
    await send('Runtime.enable', {}, sessionId);
    await send('Fetch.enable', { patterns: [{ urlPattern: '*', requestStage: 'Request' }] }, sessionId);
    await setViewport(1440, 900);

    plansMode = 'error';
    await openPreview();
    await sleep(200);
    const errorText = await evaluate('document.getElementById("load-error").innerText');
    assert.match(errorText, /trouble loading plan options/i);
    assert.equal(posts.filter((post) => post.body.includes('rates_displayed')).length, 0);
    assert.equal(leaked, false);

    plansMode = 'zero';
    await evaluate('sessionStorage.clear()');
    await openPreview();
    assert.equal(await evaluate('document.getElementById("next-btn").hidden'), true);
    assert.equal(await evaluate('document.getElementById("back-btn").hidden'), false);
    await evaluate('document.querySelector(\'[data-value="Florida"]\').click()');
    await waitFor(async () => (await evaluate('document.getElementById("question-heading").textContent')).includes('benefits eligible'), 'eligible question');
    await evaluate('document.getElementById("q-number").value = "10"; document.getElementById("next-btn").click();');
    await waitFor(async () => (await evaluate('document.getElementById("question-heading").textContent')).includes('expect to enroll'), 'enrolling question');
    await evaluate('document.getElementById("q-number").value = "12"; document.getElementById("next-btn").click();');
    await sleep(80);
    const inlineError = await evaluate('document.getElementById("question-error").textContent');
    assert.match(inlineError, /higher than the number of eligible/i);
    await evaluate('document.getElementById("q-number").value = "7"; document.getElementById("next-btn").click();');
    await waitFor(async () => (await evaluate('document.getElementById("question-heading").textContent')).includes('What matters most'), 'priority question');
    await evaluate('document.querySelector(\'[data-value="cost"]\').click()');
    await waitFor(async () => (await evaluate('document.getElementById("question-heading").textContent')).includes('group health plan'), 'coverage question');
    await evaluate('document.querySelector(\'[data-value="no"]\').click()');
    await waitFor(async () => (await evaluate('document.getElementById("question-heading").textContent')).includes('hoping to start'), 'timeline question');
    await evaluate('document.querySelector(\'[data-value="30"]\').click()');
    await waitFor(async () => !(await evaluate('document.getElementById("results").hidden')), 'zero-rate results');
    await sleep(250);
    assert.equal(posts.filter((post) => post.body.includes('"event":"rates_displayed"')).length, 0);
    assert.equal(posts.filter((post) => post.body.includes('"event":"quote_started"')).length, 1);
    assert.equal(posts.length, 1);
    const zeroStarted = JSON.parse(posts[0].body);
    assert.equal(zeroStarted.firstName, 'Quote process started');
    assert.equal(zeroStarted.email, '');
    assert.equal(zeroStarted.phone, '');

    plansMode = 'live';
    await evaluate('sessionStorage.clear()');
    await openPreview();
    await setViewport(1440, 900);
    await waitFor(async () => (await evaluate('document.getElementById("question-heading").textContent')).includes('What state'), 'state question');
    const choiceHeight = await evaluate('document.querySelector(".choice").getBoundingClientRect().height');
    assert.ok(choiceHeight >= 60, 'choice options should be large tap targets');
    assert.equal(await evaluate('document.getElementById("assist").hidden'), false);
    assert.equal(await evaluate('document.getElementById("next-btn").hidden'), true);
    assert.equal(await evaluate('document.getElementById("back-btn").hidden'), false);
    await shot('question_choice_r3.png');

    await evaluate('document.querySelector(\'[data-value="Florida"]\').focus()');
    await pressKey('Enter');
    await waitFor(async () => (await evaluate('document.getElementById("question-heading").textContent')).includes('benefits eligible'), 'eligible after Florida');
    assert.equal(await evaluate('document.getElementById("assist").hidden'), true);
    assert.equal(await evaluate('document.getElementById("next-btn").hidden'), false);
    assert.equal(await evaluate('document.getElementById("next-btn").textContent'), 'Continue');
    await shot('question_number_r3.png');
    await evaluate('document.getElementById("q-number").value = "10"; document.getElementById("next-btn").click();');
    await waitFor(async () => (await evaluate('document.getElementById("question-heading").textContent')).includes('expect to enroll'), 'enrolling');
    assert.equal(await evaluate('document.getElementById("next-btn").hidden'), false);
    await evaluate('const input = document.getElementById("q-number"); input.value = "7"; input.focus();');
    await pressKey('Enter');
    await waitFor(async () => (await evaluate('document.getElementById("question-heading").textContent')).includes('What matters most'), 'priority');
    assert.equal(await evaluate('document.getElementById("next-btn").hidden'), true);
    assert.equal(await evaluate('document.getElementById("back-btn").disabled'), false);
    await evaluate('document.querySelector(\'[data-value="balanced"]\').focus()');
    await pressKey(' ');
    await waitFor(async () => (await evaluate('document.getElementById("question-heading").textContent')).includes('group health plan'), 'coverage');
    assert.equal(await evaluate('document.getElementById("next-btn").hidden'), true);
    await evaluate('document.querySelector(\'[data-value="yes"]\').click()');
    await waitFor(async () => (await evaluate('document.getElementById("question-heading").textContent')).includes('hoping to start'), 'timeline');
    assert.equal(await evaluate('document.getElementById("next-btn").hidden'), true);
    await evaluate('document.querySelector(\'[data-value="later"]\').focus()');
    await pressKey('Enter');
    await waitFor(async () => !(await evaluate('document.getElementById("results").hidden')), 'results');
    await evaluate('document.fonts && document.fonts.ready');
    await sleep(200);

    const summary = await evaluate('document.getElementById("results-summary").textContent');
    assert.match(summary, /Florida/);
    assert.match(summary, /10 eligible/);
    assert.match(summary, /about 7 enrolling/);
    const asOf = await evaluate('document.getElementById("rates-as-of").textContent');
    assert.equal(asOf, 'Rates as of October 2026');
    const mix = await evaluate('[...document.querySelectorAll(".mix-grid input")].map((input) => input.value).join(",")');
    assert.equal(mix, '4,1,1,1');
    const card = await evaluate('document.querySelector(\'[data-plan-id="cigna-epo-1000"]\').innerText');
    assert.match(card, quoted(DEFAULT_CIGNA.gross));
    assert.match(card, quoted(DEFAULT_CIGNA.employer));
    assert.match(card, quoted(DEFAULT_CIGNA.employeeOnly));
    assert.match(card, quoted(DEFAULT_CIGNA.employeeSpouse));
    assert.match(card, quoted(DEFAULT_CIGNA.employeeChildren));
    assert.match(card, quoted(DEFAULT_CIGNA.family));
    assert.match(card, /Excellent Value/);
    assert.match(card, /Total monthly premium/);
    assert.match(card, /Employer monthly contribution/);
    assert.doesNotMatch(card, /Total monthly(?! premium)/);
    assert.doesNotMatch(card, /Employer monthly(?! contribution)/);
    assert.match(card, /Save plan/);
    assert.match(card, /View plan details/);
    const lowText = await evaluate('document.querySelector("#low-plans [data-plan-id=\\"phcs-visit-limit-1000\\"]").innerText');
    assert.match(lowText, /not traditional major medical/i);
    assert.match(lowText, /Lower Cost/);
    assert.match(lowText, /VL\* —/);
    assert.match(lowText, /10 visits per year/);
    const payState = await evaluate(`(() => {
      const mix = document.querySelector('.mix-panel').getBoundingClientRect();
      const pay = document.querySelector('.pay-cycle').getBoundingClientRect();
      const contrib = document.getElementById('contrib').getBoundingClientRect();
      const cardBox = document.querySelector('#top-plans .plan-card').getBoundingClientRect();
      const radios = [...document.querySelectorAll('#pay-cycle-options [role="radio"]')];
      return {
        scrollY: window.scrollY,
        height: window.innerHeight,
        mixTop: mix.top,
        payTop: pay.top,
        contribTop: contrib.top,
        contribBottom: contrib.bottom,
        cardTop: cardBox.top,
        labels: radios.map((button) => button.textContent),
        values: radios.map((button) => button.getAttribute('data-pay')),
        checked: radios.filter((button) => button.getAttribute('aria-checked') === 'true').map((button) => button.getAttribute('data-pay')),
        tabs: radios.map((button) => button.tabIndex),
        group: document.getElementById('pay-cycle-options').getAttribute('role'),
        classes: document.getElementById('pay-cycle-options').className,
        buttonClass: radios[0].className,
        select: !!document.getElementById('payroll-schedule')
      };
    })()`);
    assert.equal(payState.scrollY, 0);
    assert.equal(payState.group, 'radiogroup');
    assert.equal(payState.classes, 'mode-switch');
    assert.equal(payState.buttonClass, 'mode-btn');
    assert.deepEqual(payState.values, ['26', '52', '24', '12']);
    assert.deepEqual(payState.labels, ['Bi-weekly', 'Weekly', 'Semi-monthly', 'Monthly']);
    assert.deepEqual(payState.checked, ['26']);
    assert.deepEqual(payState.tabs, [0, -1, -1, -1]);
    assert.equal(payState.select, false);
    assert.ok(payState.mixTop >= 0 && payState.mixTop < payState.payTop && payState.payTop < payState.contribTop);
    assert.ok(payState.contribBottom <= payState.height + 1, 'side column should fit, contribution ends at ' + payState.contribBottom + ' of ' + payState.height);
    assert.ok(payState.cardTop >= 0 && payState.cardTop < payState.height, 'first cards should share the desktop screen, top=' + payState.cardTop);
    await shot('paycycle_desktop.png');
    await evaluate(`(() => {
      const group = document.getElementById('pay-cycle-options');
      group.querySelector('[data-pay="26"]').focus();
      group.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    })()`);
    await sleep(40);
    assert.equal(await evaluate('document.querySelector(\'[data-plan-id="cigna-epo-1000"] .cost-ee dd\').textContent'), cignaEmployeePay(52));
    assert.equal(await evaluate('document.querySelector(\'[data-pay="52"]\').getAttribute("aria-checked")'), 'true');
    assert.equal(await evaluate('document.querySelector(\'[data-pay="26"]\').getAttribute("aria-checked")'), 'false');
    assert.match(await evaluate('document.querySelector(\'[data-plan-id="cigna-epo-1000"]\').innerText'), /employee-only, weekly/);
    await evaluate('document.querySelector(\'[data-pay="12"]\').click()');
    await sleep(40);
    assert.equal(await evaluate('document.querySelector(\'[data-plan-id="cigna-epo-1000"] .cost-ee dd\').textContent'), cignaEmployeePay(12));
    await evaluate('document.querySelector(\'[data-pay="24"]\').click()');
    await sleep(40);
    assert.equal(await evaluate('document.querySelector(\'[data-plan-id="cigna-epo-1000"] .cost-ee dd\').textContent'), cignaEmployeePay(24));
    await evaluate('document.querySelector(\'[data-pay="26"]\').click()');
    await sleep(40);
    assert.equal(await evaluate('document.querySelector(\'[data-plan-id="cigna-epo-1000"] .cost-ee dd\').textContent'), DEFAULT_CIGNA.employeeOnly);
    assert.equal(await evaluate('getComputedStyle(document.querySelector(".skip")).display'), 'none');
    assert.match(await evaluate('document.querySelector("#percent-fields .hint").textContent'), /Most carriers require the employer to pay at least 50%/);
    assert.doesNotMatch(await evaluate('document.getElementById("flat-note").textContent'), /including dependents|request sends/i);
    assert.match(await evaluate('document.getElementById("flat-note").textContent'), /per enrolled employee, per month/);
    const lowInFeatured = await evaluate('!!document.querySelector("#top-plans [data-plan-id=\\"phcs-visit-limit-1000\\"]")');
    const lowInSection = await evaluate('!!document.querySelector("#low-plans [data-plan-id=\\"phcs-visit-limit-1000\\"]")');
    assert.equal(lowInFeatured, false);
    assert.equal(lowInSection, true);
    assert.equal(posts.filter((post) => post.body.includes('"event":"rates_displayed"')).length, 1);
    assert.equal(posts.filter((post) => post.body.includes('"event":"quote_started"')).length, 1);
    assert.equal(posts.length, 2);
    const shownRates = JSON.parse(posts.find((post) => post.body.includes('"event":"rates_displayed"')).body);
    assert.equal(shownRates.firstName, 'Rates displayed');
    assert.equal(shownRates.email, '');
    assert.equal(shownRates.phone, '');
    assert.deepEqual(shownRates.answers, {
      state: 'Florida',
      employees: '10',
      enrolling: '7',
      priority: 'balanced',
      coverage: 'yes',
      timeline: 'later'
    });
    assert.deepEqual(shownRates.contribution, { model: 'percent', percent: 50, flatDollar: null });
    assert.deepEqual(shownRates.tierMix, { employeeOnly: 4, employeeSpouse: 1, employeeChildren: 1, family: 1 });
    assert.deepEqual(shownRates.selectedPlans, []);
    assert.equal(shownRates.utm_source, 'preview');

    await setViewport(1440, 1100);
    const columns = await evaluate('getComputedStyle(document.querySelector("#top-plans")).gridTemplateColumns');
    assert.ok(columns.split(" ").filter(Boolean).length >= 2, 'desktop cards should be two per row: ' + columns);
    await evaluate('document.querySelector("#top-plans").scrollIntoView({ behavior: "instant", block: "start" })');
    await sleep(80);
    const cardTop = await evaluate('document.querySelector("#top-plans .plan-card").getBoundingClientRect().top');
    assert.ok(cardTop > 0 && cardTop < 500, 'first plan card should be visible, top=' + cardTop);
    await shot('desktop_cards_r2.png');
    const desktopCard = await evaluate(`(() => {
      const card = document.querySelector('[data-plan-id="cigna-epo-1000"]');
      card.scrollIntoView({ behavior: 'instant', block: 'start' });
      const box = card.getBoundingClientRect();
      return { x: Math.max(0, box.left), y: Math.max(0, box.top + window.scrollY), width: Math.ceil(box.width), height: Math.ceil(box.height), scale: 1 };
    })()`);
    await shot('desktop_card_labels.png', desktopCard);

    async function shotPlanCard(id, filename) {
      const found = await evaluate(`(() => {
        let card = document.querySelector('[data-plan-id="${id}"]');
        if (!card) return { missing: true };
        const show = document.getElementById('show-all-plans');
        if (show && (card.hidden || getComputedStyle(card).display === 'none')) show.click();
        card = document.querySelector('[data-plan-id="${id}"]');
        card.scrollIntoView({ behavior: 'instant', block: 'center' });
        const box = card.getBoundingClientRect();
        const root = document.documentElement;
        return {
          text: card.innerText,
          client: root.clientWidth,
          scroll: Math.max(root.scrollWidth, document.body.scrollWidth),
          cardWidth: Math.ceil(box.width),
          clip: {
            x: Math.max(0, box.left),
            y: Math.max(0, box.top + window.scrollY),
            width: Math.ceil(Math.min(box.width, root.clientWidth - Math.max(0, box.left))),
            height: Math.ceil(box.height),
            scale: 1
          }
        };
      })()`);
      assert.notEqual(found.missing, true, id + ' card missing');
      assert.match(found.text, /Incl \$25 Monthly HSA/);
      assert.ok(found.cardWidth <= found.client + 1, id + ' card wider than the viewport: ' + found.cardWidth);
      assert.ok(found.scroll <= found.client + 1, id + ' page overflow ' + found.scroll + ' > ' + found.client);
      await shot(filename, found.clip);
    }
    await shotPlanCard('cigna-ppo-8300-hsa', 'card_8300_desktop.png');
    await evaluate('document.querySelector(\'[data-plan-id="cigna-epo-1000"] .details-toggle\').click()');
    await sleep(40);
    assert.equal(await evaluate('document.getElementById("details-cigna-epo-1000").hidden'), false);
    const expandedText = await evaluate('document.getElementById("details-cigna-epo-1000").innerText');
    assert.match(expandedText, /Inpatient Hospital/);
    assert.match(expandedText, /\$2,500 copay per admission after deductible/);
    assert.match(expandedText, /Outpatient Surgery/);
    assert.match(expandedText, /\$2,500 copay per surgery after deductible/);
    assert.match(expandedText, /\$0 copay/);
    const expanded = await evaluate(`(() => {
      const card = document.querySelector('[data-plan-id="cigna-epo-1000"]');
      const box = card.getBoundingClientRect();
      return { x: Math.max(0, box.left - 8), y: Math.max(0, box.top + window.scrollY - 8), width: Math.ceil(box.width + 16), height: Math.min(1400, Math.ceil(box.height + 16)) };
    })()`);
    await shot('expanded_card_r2.png', { x: expanded.x, y: expanded.y, width: expanded.width, height: expanded.height, scale: 1 });

    function pdfPageCount(bytes) {
      const matches = bytes.toString('latin1').match(/\/Type\s*\/Page(?!s)/g);
      return matches ? matches.length : 0;
    }

    async function shotPrintPreview(name) {
      const size = await evaluate('({ w: innerWidth, h: innerHeight })');
      await setViewport(1056, 816);
      await sleep(80);
      const clip = await evaluate(`(() => {
        const root = document.getElementById('print-root');
        const box = root.getBoundingClientRect();
        return {
          x: 0,
          y: Math.max(0, box.top + window.scrollY),
          width: 1056,
          height: Math.min(816, Math.max(400, Math.ceil(box.height))),
          scale: 1
        };
      })()`);
      await shot(name, clip);
      await setViewport(size.w, size.h);
    }

    async function savePdf(filename, shotName) {
      await send('Emulation.setEmulatedMedia', { media: 'print' }, sessionId);
      await sleep(120);
      const printText = await evaluate('document.getElementById("print-root").innerText');
      assert.match(printText, /Total monthly premium/);
      assert.match(printText, /Employer monthly contribution|Employer contribution \(flat\)/);
      assert.match(printText, /Employee Only/);
      assert.match(printText, /Employee \+ Spouse/);
      assert.match(printText, /Employee \+ Child\(ren\)/);
      assert.match(printText, /Family/);
      assert.match(printText, /Premium/);
      assert.match(printText, /EE Cost PPP/);
      assert.match(printText, /PPP = per pay period \(Bi-weekly, 26\)/);
      assert.match(printText, /Notes and Limitations/);
      assert.doesNotMatch(printText, /Employee paycheck/);
      if (shotName) await shotPrintPreview(shotName);
      const pdf = await send('Page.printToPDF', {
        printBackground: true,
        landscape: true,
        preferCSSPageSize: true
      }, sessionId);
      const pdfPath = path.join(ARTIFACTS, filename);
      fs.writeFileSync(pdfPath, Buffer.from(pdf.data, 'base64'));
      await send('Emulation.setEmulatedMedia', { media: 'screen' }, sessionId);
      const bytes = fs.readFileSync(pdfPath);
      assert.equal(bytes.subarray(0, 5).toString(), '%PDF-');
      assert.ok(bytes.length > 20000, filename + ' was unexpectedly small');
      return pdfPageCount(bytes);
    }
    const allPages = await savePdf('proposal_all_plans_r3.pdf', 'proposal_print_all_page1.png');
    assert.ok(allPages >= 2, 'print-all should keep paginating, pages=' + allPages);

    await evaluate('document.getElementById("sort-mode").value = "carrier"; document.getElementById("sort-mode").dispatchEvent(new Event("change", { bubbles: true }));');
    await evaluate('document.querySelector(\'[data-carrier="Cigna"]\').click()');
    await evaluate('document.getElementById("employer-contribution").value = "100"; document.getElementById("employer-contribution").dispatchEvent(new Event("input", { bubbles: true }));');
    await evaluate('document.querySelector(\'[data-dep="50"]\').click()');
    await sleep(150);
    const filteredUhc = await evaluate('document.querySelector(\'[data-plan-id="uhc-ppo-3000-hsa"]\')');
    assert.equal(filteredUhc, null);
    const updated = await evaluate('document.querySelector(\'[data-plan-id="cigna-epo-1000"]\').innerText');
    assert.match(updated, quoted(FULL_SHARE_CIGNA.employer));
    assert.equal(posts.filter((post) => post.body.includes('"event":"rates_displayed"')).length, 1);
    assert.equal(posts.filter((post) => post.body.includes('"event":"quote_started"')).length, 1);
    assert.equal(posts.length, 2);

    await evaluate('document.querySelector(\'[data-carrier="All"]\').click()');
    await evaluate('document.getElementById("sort-mode").value = "price"; document.getElementById("sort-mode").dispatchEvent(new Event("change", { bubbles: true }));');
    await evaluate('document.querySelector(\'[data-ee="50"]\').click(); document.querySelector(\'[data-carrier="All"]\').click();');
    await evaluate('document.getElementById("dependent-contribution").value = "0"; document.getElementById("dependent-contribution").dispatchEvent(new Event("input", { bubbles: true }));');
    await sleep(100);

    await setViewport(390, 844);
    await evaluate('window.scrollTo(0, 0)');
    await sleep(100);
    const fixedUi = await evaluate('[...document.querySelectorAll("body *")].filter((el) => getComputedStyle(el).position === "fixed").map((el) => el.id || el.className).join(",")');
    assert.equal(fixedUi, '', 'no screen-fixed controls: ' + fixedUi);
    const actionsText = await evaluate('document.getElementById("results-actions").innerText');
    assert.match(actionsText, /Call or text Daniel/);
    assert.match(actionsText, /407-476-5076/);
    assert.match(actionsText, /My Plans/);
    assert.match(actionsText, /Get my plan details/);
    assert.equal(await evaluate('document.getElementById("contrib").classList.contains("is-open")'), false);
    assert.equal(await evaluate('getComputedStyle(document.getElementById("contrib-body")).display'), 'none');
    await evaluate('document.getElementById("contrib-toggle").click()');
    assert.equal(await evaluate('document.getElementById("contrib").classList.contains("is-open")'), true);
    assert.notEqual(await evaluate('getComputedStyle(document.getElementById("contrib-body")).display'), 'none');
    await evaluate('document.getElementById("contrib-toggle").click()');
    const stripCount = await evaluate('document.querySelectorAll(".cta-strip").length');
    assert.equal(stripCount, 0);
    const repeatedCall = await evaluate('[...document.querySelectorAll("body *")].filter((el) => el.childNodes.length && [...el.childNodes].some((node) => node.nodeType === 3 && node.textContent.includes("Questions? Call or text Daniel")) && !el.closest("#results-actions")).length');
    assert.equal(repeatedCall, 0);
    await evaluate('document.querySelector("#top-plans").scrollIntoView({ behavior: "instant", block: "start" })');
    await sleep(80);
    const plansClip = await evaluate(`(() => {
      const el = document.getElementById('top-plans');
      const box = el.getBoundingClientRect();
      return {
        x: Math.max(0, box.x),
        y: Math.max(0, box.y + window.scrollY),
        width: Math.ceil(box.width),
        height: Math.ceil(box.height),
        scale: 1
      };
    })()`);
    await shot('mobile_results_no_strip.png', plansClip);
    await evaluate('document.getElementById("mix-fam").value = "20"; document.getElementById("mix-fam").dispatchEvent(new Event("input", { bubbles: true }));');
    await sleep(40);
    const mixError = await evaluate('document.getElementById("mix-note").innerText');
    assert.match(mixError, /higher than the 10 eligible/);
    const still = await evaluate('document.querySelector(\'[data-plan-id="cigna-epo-1000"]\').innerText');
    assert.match(still, quoted(DEFAULT_CIGNA.gross));
    await evaluate('document.getElementById("mix-fam").value = "1.5"; document.getElementById("mix-fam").dispatchEvent(new Event("input", { bubbles: true }));');
    await sleep(40);
    const decimalNote = await evaluate('document.getElementById("mix-note").innerText');
    assert.match(decimalNote, /Decimals/);
    assert.match(await evaluate('document.querySelector(\'[data-plan-id="cigna-epo-1000"]\').innerText'), quoted(DEFAULT_CIGNA.gross));
    await evaluate('document.getElementById("mix-ee").scrollIntoView({ behavior: "instant", block: "center" })');
    await shot('validation_mix_r3.png');
    await evaluate('document.getElementById("mix-fam").value = "1"; document.getElementById("mix-fam").dispatchEvent(new Event("input", { bubbles: true }));');
    await evaluate('document.getElementById("mix-ee").value = "-3"; document.getElementById("mix-ee").dispatchEvent(new Event("input", { bubbles: true }));');
    assert.match(await evaluate('document.getElementById("mix-note").innerText'), /0 or more/);
    assert.match(await evaluate('document.querySelector(\'[data-plan-id="cigna-epo-1000"]\').innerText'), quoted(DEFAULT_CIGNA.gross));
    await evaluate('document.getElementById("mix-ee").value = "4"; document.getElementById("mix-ee").dispatchEvent(new Event("input", { bubbles: true }));');

    await setViewport(1440, 1000);
    await evaluate('document.querySelector(\'[data-plan-id="cigna-epo-1000"] .save-toggle\').click()');
    await evaluate('document.querySelector(\'[data-plan-id="UHC-PPO-2000-Deductible"] .save-toggle\').click()');
    await evaluate('document.querySelector(\'[data-plan-id="cigna-epo-1750-hsa"] .save-toggle\').click()');
    await evaluate('document.querySelector(\'[data-plan-id="phcs-visit-limit-1750-HSA"] .save-toggle\').click()');
    await sleep(50);
    assert.match(await evaluate('document.getElementById("my-plans-btn").textContent'), /My Plans \(4\)/);
    await evaluate('document.getElementById("my-plans-btn").click()');
    await sleep(80);
    assert.equal(await evaluate('getComputedStyle(document.getElementById("my-plans-panel")).position'), 'static');
    await evaluate('document.getElementById("my-plans-panel").scrollIntoView({ behavior: "instant", block: "start" })');
    await sleep(40);
    const compare = await evaluate('document.getElementById("drawer-body").innerText');
    assert.match(compare, /Cigna EPO 1000/);
    assert.match(compare, /UHC PPO 2000/);
    assert.match(compare, /Cigna EPO 1750 HSA/);
    assert.match(compare, /PHCS Visit Limit 1750 HSA/);
    assert.match(compare, /Excellent Value/);
    assert.match(compare, /Top Rated Network/);
    assert.match(compare, /Incl \$25 Monthly HSA/);
    assert.match(compare, /not traditional major medical/i);
    assert.match(compare, /Plan type/);
    assert.match(compare, /Visit Limit/);
    assert.match(compare, /VL\*/);
    assert.match(compare, /Total monthly premium/);
    assert.match(compare, /Employer monthly contribution/);
    assert.match(compare, /Employee paycheck/);
    assert.match(compare, /Out-of-pocket max/);
    assert.match(compare, /Inpatient Hospital/);
    assert.match(compare, /Outpatient Surgery/);
    assert.match(compare, /limit 2 ICU \+ 2 non-ICU admissions\/yr/);
    assert.match(compare, /Remove/);
    await shot('my_plans_warning_r3.png');
    const savedPages = await savePdf('proposal_saved_plans_r3.pdf', 'proposal_print_saved.png');
    assert.ok(savedPages >= 2, 'saved plans keep the proposal page and add a notes page, pages=' + savedPages);
    await evaluate('document.getElementById("drawer-close").click()');
    await evaluate('document.querySelector(\'[data-plan-id="phcs-visit-limit-1750-HSA"] .save-toggle\').click()');
    assert.match(await evaluate('document.getElementById("my-plans-btn").textContent'), /My Plans \(3\)/);
    await evaluate('document.getElementById("edit-btn").click()');
    await waitFor(async () => !(await evaluate('document.getElementById("review-section").hidden')), 'edit answers');
    const reviewText = await evaluate('document.getElementById("review-section").innerText');
    assert.match(reviewText, /What state is your business located in/);
    assert.match(reviewText, /When are you hoping to start/);
    assert.equal(await evaluate('document.querySelector(\'#review-fields [data-review="employees"]\').value'), '10');
    const selectedFlorida = await evaluate('getComputedStyle(document.querySelector(\'#review-fields [data-value="Florida"]\')).backgroundColor');
    const idleGeorgia = await evaluate('getComputedStyle(document.querySelector(\'#review-fields [data-value="Georgia"]\')).backgroundColor');
    assert.notEqual(selectedFlorida, idleGeorgia);
    await shot('edit_answers_r3.png');
    await evaluate('document.getElementById("review-cancel").click()');
    await waitFor(async () => !(await evaluate('document.getElementById("results").hidden')), 'back to results');

    await setViewport(1280, 1100);
    await evaluate('document.documentElement.style.scrollBehavior = "auto"');
    await evaluate('document.getElementById("goto-lead").click()');
    const leadGeom = await evaluate(`(() => {
      document.documentElement.style.scrollBehavior = 'auto';
      const lead = document.getElementById('lead');
      const y = lead.getBoundingClientRect().top + window.scrollY - 12;
      window.scrollTo(0, y);
      const box = lead.getBoundingClientRect();
      const name = document.getElementById('first-name').getBoundingClientRect();
      return {
        nameTop: name.top,
        x: Math.max(0, box.left - 20),
        y: Math.max(0, box.top + window.scrollY - 20),
        width: Math.ceil(box.width + 40),
        height: Math.ceil(box.height + 40)
      };
    })()`);
    assert.ok(leadGeom.nameTop > 0 && leadGeom.nameTop < 1000, 'lead form should scroll into view, top=' + leadGeom.nameTop);
    assert.match(await evaluate('document.getElementById("lead-saved-note").textContent'), /3 saved plans will be included/);
    await shot('lead_form_r3.png', { x: leadGeom.x, y: leadGeom.y, width: leadGeom.width, height: leadGeom.height, scale: 1 });
    assert.equal(posts.length, 2, 'quote started and rates displayed post once before the lead form');
    await evaluate(`
      document.getElementById('first-name').value = 'Ada';
      document.getElementById('email').value = 'ada@example.com';
      document.getElementById('phone').value = '407-555-0199';
      document.getElementById('lead-form').requestSubmit();
    `);
    await waitFor(async () => !(await evaluate('document.getElementById("lead-success").hidden')), 'success');
    const success = await evaluate('document.getElementById("lead-success").innerText');
    assert.match(success, /Thanks, Ada/);
    assert.match(success, /407-476-5076/);
    const successGeom = await evaluate(`(() => {
      document.documentElement.style.scrollBehavior = 'auto';
      const success = document.getElementById('lead-success');
      const y = success.getBoundingClientRect().top + window.scrollY - 24;
      window.scrollTo(0, Math.max(0, y));
      const box = success.getBoundingClientRect();
      return {
        top: box.top,
        x: Math.max(0, box.left - 20),
        y: Math.max(0, box.top + window.scrollY - 20),
        width: Math.ceil(box.width + 40),
        height: Math.ceil(box.height + 80)
      };
    })()`);
    assert.ok(successGeom.top >= 0 && successGeom.top < 1000, 'success message should be in view, top=' + successGeom.top);
    await shot('success_state_r2.png', { x: successGeom.x, y: successGeom.y, width: successGeom.width, height: successGeom.height, scale: 1 });

    const lead = JSON.parse(posts.find((post) => post.body.includes('"event":"lead_submitted"')).body);
    assert.deepEqual(Object.keys(lead), [
      'firstName', 'email', 'phone', 'answers', 'tierMix', 'contribution',
      'selectedPlans', 'visiblePlans', 'submittedAt', 'pageUrl', 'event',
      'sessionId', 'timestamp', 'utm_source'
    ]);
    assert.equal(lead.firstName, 'Ada');
    assert.equal(lead.email, 'ada@example.com');
    assert.equal(lead.phone, '407-555-0199');
    assert.equal(lead.answers.state, 'Florida');
    assert.equal(lead.answers.employees, '10');
    assert.equal(lead.answers.enrolling, '7');
    assert.equal(lead.answers.priority, 'balanced');
    assert.equal(lead.answers.coverage, 'yes');
    assert.equal(lead.answers.timeline, 'later');
    assert.deepEqual(lead.tierMix, { employeeOnly: 4, employeeSpouse: 1, employeeChildren: 1, family: 1 });
    assert.equal(lead.contribution.model, 'percent');
    assert.equal(lead.contribution.percent, 50);
    assert.equal(lead.contribution.flatDollar, null);
    assert.equal(Object.hasOwn(lead.contribution, 'dependentPercent'), false);
    assert.equal(Object.hasOwn(lead.contribution, 'payPeriods'), false);
    assert.deepEqual(Object.keys(lead.contribution).sort(), ['flatDollar', 'model', 'percent']);
    assert.deepEqual(lead.selectedPlans.map((plan) => plan.name), ['Cigna EPO 1000', 'UHC PPO 2000', 'Cigna EPO 1750 HSA']);
    assert.deepEqual(lead.selectedPlans.map((plan) => plan.typeBadge), ['Excellent Value', 'Top Rated Network', 'Incl $25 Monthly HSA']);
    assert.deepEqual(Object.keys(lead.selectedPlans[0]), ['id', 'name', 'network', 'typeBadge', 'rates']);
    assert.equal(lead.utm_source, 'preview');
    assert.equal(lead.event, 'lead_submitted');
    assert.equal(posts.filter((post) => post.url.includes(WEBHOOK)).length, 3);
    assert.equal(posts.filter((post) => post.body.includes('"event":"lead_submitted"')).length, 1);
    assert.equal(posts.filter((post) => post.body.includes('"event":"rates_displayed"')).length, 1);
    assert.equal(posts.filter((post) => post.body.includes('"event":"quote_started"')).length, 1);
    assert.equal(JSON.stringify(lead).includes('Quote process started'), false);
    assert.equal(JSON.stringify(lead).includes('Rates displayed'), false);
    assert.match(await evaluate('document.getElementById("lead-saved-note").textContent'), /3 saved plans will be included/);

    await evaluate('document.getElementById("start-over-btn").click()');
    assert.equal(await evaluate('document.getElementById("start-over-confirm").hidden'), false);
    assert.match(await evaluate('document.getElementById("start-over-message").textContent'), /3 saved plans/);
    await evaluate('document.getElementById("start-over-no").click()');
    assert.equal(await evaluate('document.getElementById("results").hidden'), false);
    assert.match(await evaluate('document.getElementById("my-plans-btn").textContent'), /My Plans \(3\)/);

    await evaluate('document.getElementById("edit-btn").click()');
    await waitFor(async () => !(await evaluate('document.getElementById("review-section").hidden')), 'edit answers after validation setup');
    await evaluate(`
      document.querySelector('#review-fields [data-value="Georgia"]').click();
      document.querySelector('#review-fields [data-review="employees"]').value = '3';
      document.querySelector('#review-fields [data-review="enrolling"]').value = '8';
      document.getElementById('review-save').click();
    `);
    await waitFor(async () => (await evaluate('document.getElementById("review-error").textContent')).length > 0, 'review validation error');
    assert.match(await evaluate('document.getElementById("review-error").textContent'), /eligible/i);
    assert.equal(await evaluate('document.querySelector(\'#review-fields [data-review="employees"]\').value'), '3');
    assert.equal(await evaluate('document.querySelector(\'#review-fields [data-review="enrolling"]\').value'), '8');
    assert.equal(await evaluate('document.querySelector(\'#review-fields [data-value="Georgia"]\').getAttribute("aria-pressed")'), 'true');
    assert.equal(await evaluate('document.querySelector(\'#review-fields [data-value="Florida"]\').getAttribute("aria-pressed")'), 'false');
    await shot('edit_validation_r3.png');
    await evaluate(`
      document.querySelector('#review-fields [data-review="enrolling"]').value = '2';
      document.getElementById('review-save').click();
    `);
    await waitFor(async () => !(await evaluate('document.getElementById("results").hidden')), 'results after corrected edit');
    const corrected = await evaluate('document.getElementById("results-summary").textContent');
    assert.match(corrected, /Georgia/);
    assert.match(corrected, /3 eligible/);
    assert.doesNotMatch(corrected, /Florida/);
    assert.doesNotMatch(corrected, /12 eligible/);

    const beforeReload = posts.length;
    await send('Page.reload', {}, sessionId);
    await waitFor(async () => (await evaluate('document.getElementById("question-heading").textContent')).includes('What state'), 'question after refresh');
    await evaluate('document.querySelector(\'[data-value="Florida"]\').click()');
    await waitFor(async () => (await evaluate('document.getElementById("question-heading").textContent')).includes('benefits eligible'), 'eligible after refresh');
    await evaluate('document.getElementById("q-number").value = "10"; document.getElementById("next-btn").click();');
    await waitFor(async () => (await evaluate('document.getElementById("question-heading").textContent')).includes('expect to enroll'), 'enrolling after refresh');
    await evaluate('document.getElementById("q-number").value = "7"; document.getElementById("next-btn").click();');
    await waitFor(async () => (await evaluate('document.getElementById("question-heading").textContent')).includes('What matters most'), 'priority after refresh');
    await evaluate('document.querySelector(\'[data-value="cost"]\').click()');
    await waitFor(async () => (await evaluate('document.getElementById("question-heading").textContent')).includes('group health plan'), 'coverage after refresh');
    await evaluate('document.querySelector(\'[data-value="no"]\').click()');
    await waitFor(async () => (await evaluate('document.getElementById("question-heading").textContent')).includes('hoping to start'), 'timeline after refresh');
    await evaluate('document.querySelector(\'[data-value="30"]\').click()');
    await waitFor(async () => !(await evaluate('document.getElementById("results").hidden')), 'results after refresh');
    await sleep(300);
    assert.equal(posts.filter((post) => post.body.includes('"event":"rates_displayed"')).length, 1);
    assert.equal(posts.filter((post) => post.body.includes('"event":"quote_started"')).length, 1);
    assert.equal(posts.length, beforeReload);
    assert.equal(leaked, false);
    assert.ok(posts.every((post) => post.url.includes(WEBHOOK)));

    await evaluate('sessionStorage.clear()');
    await send('Page.navigate', { url: `${ORIGIN}/quote-tool-demo/quote-tool-classic.html` }, sessionId);
    await waitFor(async () => String(await evaluate('document.getElementById("questionHost") && document.getElementById("questionHost").innerText')).includes('What state'), 'classic question');
    const classicScripts = await evaluate('[...document.scripts].map((script) => script.getAttribute("src")).join(" ")');
    assert.match(classicScripts, /quote-activity\.js/);
    assert.match(classicScripts, /quote-tool\.js/);

    await evaluate('sessionStorage.clear()');
    const beforeLive = posts.length;
    await send('Page.navigate', { url: `${ORIGIN}/quote-tool-demo/preview-legacy/index.html` }, sessionId);
    await waitFor(async () => String(await evaluate('document.getElementById("question-heading") && document.getElementById("question-heading").textContent')).includes('What state'), 'live question');
    const liveCheck = await evaluate(`(() => {
      const scripts = [...document.scripts].map((script) => script.getAttribute('src') || '').join(' ');
      const sheets = [...document.styleSheets].map((sheet) => sheet.href || '').join(' ');
      const resources = performance.getEntriesByType('resource').map((entry) => entry.name + ' ' + (entry.responseStatus || 0));
      return {
        scripts,
        sheets,
        overflow: getComputedStyle(document.body).overflow,
        resources
      };
    })()`);
    assert.match(liveCheck.scripts, /quote-activity\.js/);
    assert.match(liveCheck.scripts, /preview\/quote-math\.js/);
    assert.match(liveCheck.scripts, /preview\/preview\.js/);
    assert.doesNotMatch(liveCheck.scripts, /quote-tool\.js/);
    assert.match(liveCheck.sheets, /preview\/preview\.css/);
    assert.notEqual(liveCheck.overflow, 'hidden');
    ['plans.json', 'preview/preview.css', 'preview/preview.js', 'preview/quote-math.js', 'quote-activity.js', 'preview/preview-config.json'].forEach((asset) => {
      const hit = liveCheck.resources.find((line) => line.includes(asset));
      assert.ok(hit, 'missing asset ' + asset);
      assert.match(hit, / 200$/, asset + ' did not load: ' + hit);
    });
    await evaluate('document.querySelector(\'[data-value="Florida"]\').click()');
    await waitFor(async () => String(await evaluate('document.getElementById("question-heading").textContent')).includes('benefits eligible'), 'live eligible');
    await evaluate('document.getElementById("q-number").value = "10"; document.getElementById("next-btn").click();');
    await waitFor(async () => String(await evaluate('document.getElementById("question-heading").textContent')).includes('expect to enroll'), 'live enrolling');
    await evaluate('document.getElementById("q-number").value = "7"; document.getElementById("next-btn").click();');
    await waitFor(async () => String(await evaluate('document.getElementById("question-heading").textContent')).includes('What matters most'), 'live priority');
    await evaluate('document.querySelector(\'[data-value="cost"]\').click()');
    await waitFor(async () => String(await evaluate('document.getElementById("question-heading").textContent')).includes('group health plan'), 'live coverage');
    await evaluate('document.querySelector(\'[data-value="no"]\').click()');
    await waitFor(async () => String(await evaluate('document.getElementById("question-heading").textContent')).includes('hoping to start'), 'live timeline');
    await evaluate('document.querySelector(\'[data-value="30"]\').click()');
    await waitFor(async () => !(await evaluate('document.getElementById("results").hidden')), 'live results');
    await sleep(250);
    const livePosts = posts.slice(beforeLive);
    assert.equal(livePosts.length, 2);
    assert.equal(livePosts.filter((post) => post.body.includes('"event":"quote_started"')).length, 1);
    assert.equal(livePosts.filter((post) => post.body.includes('"event":"rates_displayed"')).length, 1);
    const liveStarted = JSON.parse(livePosts.find((post) => post.body.includes('"event":"quote_started"')).body);
    const liveRates = JSON.parse(livePosts.find((post) => post.body.includes('"event":"rates_displayed"')).body);
    assert.equal(liveStarted.firstName, 'Quote process started');
    assert.equal(liveRates.firstName, 'Rates displayed');
    assert.equal(Object.hasOwn(liveStarted, 'utm_source'), false);
    assert.equal(Object.hasOwn(liveRates, 'utm_source'), false);
    assert.deepEqual(liveRates.selectedPlans, []);
    assert.equal(await evaluate('document.getElementById("load-error").hidden'), true);
    assert.match(await evaluate('document.getElementById("results-summary").textContent'), /Florida/);

    async function openHarness(query, width, height) {
      await setViewport(width, height);
      await send('Page.navigate', { url: `${ORIGIN}/quote-tool-demo/preview/test/wix-harness.html${query}` }, sessionId);
      await waitFor(async () => {
        const ready = await evaluate(`(() => {
          const frame = document.getElementById('tool');
          if (!frame || !frame.contentDocument) return false;
          const heading = frame.contentDocument.getElementById('question-heading');
          return !!(heading && heading.textContent && heading.textContent !== 'Loading plan options…');
        })()`);
        return ready;
      }, 'harness preview ' + query);
      await setContentWidth(width, height);
      await sleep(200);
    }

    async function frameEval(expression) {
      return evaluate(`(() => { const doc = document.getElementById('tool').contentDocument; const win = doc.defaultView; return eval(${JSON.stringify(expression)}); })()`);
    }

    await openHarness('?layout=320', 320, 693);
    const harnessFit = await evaluate(`(() => {
      const root = document.documentElement;
      return { client: root.clientWidth, scroll: root.scrollWidth };
    })()`);
    assert.equal(harnessFit.client, 320);
    assert.ok(harnessFit.scroll <= harnessFit.client + 1, 'harness page added a horizontal scrollbar: ' + harnessFit.scroll + ' > ' + harnessFit.client);
    await shot('wix_mobile_questions.png');
    const mobileFrame = await evaluate(`(() => {
      const frame = document.getElementById('tool').getBoundingClientRect();
      return { width: Math.round(frame.width), height: Math.round(frame.height), top: Math.round(frame.top) };
    })()`);
    assert.equal(mobileFrame.width, 320);
    assert.equal(mobileFrame.height, 929);
    assert.equal(mobileFrame.top, 122);
    const parentBefore = await evaluate('document.scrollingElement.scrollTop');
    await frameEval(`doc.querySelector('[data-value="Florida"]').click()`);
    await sleep(250);
    await frameEval(`doc.getElementById('q-number').value = '10'; doc.getElementById('next-btn').click();`);
    await sleep(200);
    await frameEval(`doc.getElementById('q-number').value = '7'; doc.getElementById('next-btn').click();`);
    await sleep(200);
    await frameEval(`doc.querySelector('[data-value="balanced"]').click()`);
    await sleep(220);
    await frameEval(`doc.querySelector('[data-value="yes"]').click()`);
    await sleep(220);
    await frameEval(`doc.querySelector('[data-value="later"]').click()`);
    await waitFor(async () => frameEval(`doc.getElementById('results').hidden === false`), 'harness mobile results');
    await sleep(200);
    const parentAfterQuestions = await evaluate('document.scrollingElement.scrollTop');
    assert.equal(parentAfterQuestions, parentBefore, 'answering questions should not scroll the Wix page');
    const mobileFixed = await frameEval(`[...doc.querySelectorAll('body *')].filter((el) => win.getComputedStyle(el).position === 'fixed').map((el) => el.id || String(el.className)).join(',')`);
    assert.equal(mobileFixed, '');
    const actionsTop = await frameEval(`doc.getElementById('results-actions').getBoundingClientRect().top`);
    assert.ok(actionsTop >= 0 && actionsTop < 929, 'results actions should sit inside the iframe, top=' + actionsTop);
    assert.match(await frameEval(`doc.getElementById('results-actions').innerText`), /Call or text Daniel/);
    const overflowX = await frameEval(`doc.documentElement.scrollWidth <= win.innerWidth + 1`);
    assert.equal(overflowX, true);
    const mobilePay = await frameEval(`(() => {
      const mix = doc.querySelector('.mix-panel').getBoundingClientRect();
      const pay = doc.querySelector('.pay-cycle').getBoundingClientRect();
      const contrib = doc.getElementById('contrib').getBoundingClientRect();
      const root = doc.documentElement;
      return {
        mixTop: mix.top,
        payTop: pay.top,
        contribTop: contrib.top,
        contribBottom: contrib.bottom,
        payRight: Math.ceil(pay.right),
        client: root.clientWidth,
        scroll: Math.max(root.scrollWidth, doc.body.scrollWidth),
        checked: doc.querySelector('#pay-cycle-options [aria-checked="true"]').textContent,
        pinned: [...doc.querySelectorAll('body *')].some((el) => {
          const pos = win.getComputedStyle(el).position;
          return pos === 'fixed' || pos === 'sticky';
        })
      };
    })()`);
    assert.equal(mobilePay.checked, 'Bi-weekly');
    assert.ok(mobilePay.mixTop < mobilePay.payTop && mobilePay.payTop < mobilePay.contribTop);
    assert.ok(mobilePay.payRight <= mobilePay.client + 1, 'pay cycle wider than 320: ' + mobilePay.payRight);
    assert.ok(mobilePay.scroll <= mobilePay.client + 1, '320 page overflow ' + mobilePay.scroll);
    assert.equal(mobilePay.pinned, false);
    const frameBox = await evaluate(`(() => {
      const box = document.getElementById('tool').getBoundingClientRect();
      return { left: box.left, top: box.top, width: box.width };
    })()`);
    await shot('paycycle_mobile320.png', {
      x: Math.max(0, frameBox.left),
      y: Math.max(0, frameBox.top + mobilePay.mixTop),
      width: Math.ceil(frameBox.width),
      height: Math.ceil(mobilePay.contribBottom - mobilePay.mixTop),
      scale: 1
    });
    await frameEval(`doc.querySelector('[data-pay="52"]').click()`);
    await sleep(40);
    assert.equal(await frameEval(`doc.querySelector('[data-plan-id="cigna-epo-1000"] .cost-ee dd').textContent`), cignaEmployeePay(52));
    await frameEval(`doc.querySelector('[data-pay="26"]').click()`);
    await sleep(40);
    await shot('wix_mobile_results.png');
    await frameEval(`doc.getElementById('goto-lead').click()`);
    await sleep(80);
    const leadTop = await frameEval(`doc.getElementById('lead').getBoundingClientRect().top`);
    assert.ok(leadTop >= 0 && leadTop < 929, 'lead form should open inside the iframe, top=' + leadTop);
    assert.equal(await evaluate('document.scrollingElement.scrollTop'), parentBefore);
    await shot('wix_mobile_lead.png');
    await frameEval(`doc.querySelector('[data-plan-id="cigna-epo-1000"] .save-toggle').click()`);
    await sleep(80);
    await frameEval(`(() => { const el = doc.getElementById('results-actions'); const top = el.getBoundingClientRect().top + win.scrollY - 8; win.scrollTo(0, Math.max(0, top)); return true; })()`);
    await frameEval(`doc.getElementById('my-plans-btn').click()`);
    await sleep(80);
    const panelInFrame = await frameEval(`doc.getElementById('my-plans-panel').getBoundingClientRect().top`);
    assert.ok(panelInFrame >= 0 && panelInFrame < 929, 'My Plans should open inside the iframe, top=' + panelInFrame);
    assert.equal(await evaluate('document.scrollingElement.scrollTop'), parentBefore);
    await shot('wix_mobile_my_plans.png');

    await openHarness('', 390, 844);
    await frameEval(`doc.querySelector('[data-value="Florida"]').click()`);
    await sleep(250);
    await frameEval(`doc.getElementById('q-number').value = '10'; doc.getElementById('next-btn').click();`);
    await sleep(180);
    await frameEval(`doc.getElementById('q-number').value = '7'; doc.getElementById('next-btn').click();`);
    await sleep(180);
    await frameEval(`doc.querySelector('[data-value="cost"]').click()`);
    await sleep(200);
    await frameEval(`doc.querySelector('[data-value="no"]').click()`);
    await sleep(200);
    await frameEval(`doc.querySelector('[data-value="30"]').click()`);
    await waitFor(async () => frameEval(`doc.getElementById('results').hidden === false`), '390 results');
    await sleep(200);
    assert.equal(await evaluate('document.scrollingElement.scrollTop'), 0);
    await shot('wix_mobile_390_start_results.png');

    await openHarness('?desktop=1', 1440, 900);
    const desktopFrame = await evaluate(`(() => {
      const frame = document.getElementById('tool').getBoundingClientRect();
      return { height: Math.round(frame.height), top: Math.round(frame.top) };
    })()`);
    assert.equal(desktopFrame.height, 8153);
    assert.equal(desktopFrame.top, 156);
    await frameEval(`doc.querySelector('[data-value="Florida"]').click()`);
    await sleep(250);
    await frameEval(`doc.getElementById('q-number').value = '10'; doc.getElementById('next-btn').click();`);
    await sleep(180);
    await frameEval(`doc.getElementById('q-number').value = '7'; doc.getElementById('next-btn').click();`);
    await sleep(180);
    await frameEval(`doc.querySelector('[data-value="balanced"]').click()`);
    await sleep(200);
    await frameEval(`doc.querySelector('[data-value="yes"]').click()`);
    await sleep(200);
    await frameEval(`doc.querySelector('[data-value="later"]').click()`);
    await waitFor(async () => frameEval(`doc.getElementById('results').hidden === false`), 'desktop harness results');
    await sleep(250);
    assert.equal(await evaluate('document.scrollingElement.scrollTop'), 0, 'results should not push the Wix header away');
    const headerStillVisible = await evaluate('document.getElementById("wix-header").getBoundingClientRect().top');
    assert.equal(headerStillVisible, 0);
    const desktopActions = await frameEval(`doc.getElementById('results-actions').getBoundingClientRect().top`);
    assert.ok(desktopActions >= 0 && desktopActions < 900, 'desktop CTA should be in the first screen, top=' + desktopActions);
    assert.equal(await frameEval(`[...doc.querySelectorAll('body *')].some((el) => win.getComputedStyle(el).position === 'fixed' || win.getComputedStyle(el).position === 'sticky')`), false);
    await shot('wix_desktop_inline_cta.png');

    async function assertNoOverflow(label) {
      const report = await evaluate(`(() => {
        const root = document.documentElement;
        const vw = root.clientWidth;
        const sw = Math.max(root.scrollWidth, document.body.scrollWidth);
        const offenders = [];
        if (sw > vw + 1) {
          for (const el of document.querySelectorAll('body *')) {
            const style = getComputedStyle(el);
            if (style.display === 'none' || style.visibility === 'hidden') continue;
            const rect = el.getBoundingClientRect();
            if (rect.width > 0 && (rect.right > vw + 1 || rect.left < -1)) {
              offenders.push((el.id || String(el.className).slice(0, 40) || el.tagName) + ' right=' + Math.round(rect.right));
            }
          }
        }
        return { vw, sw, offenders: offenders.slice(0, 8) };
      })()`);
      assert.ok(report.sw <= report.vw + 1, label + ' horizontal overflow ' + (report.sw - report.vw) + 'px at ' + report.vw + ': ' + report.offenders.join(', '));
    }

    const widths = [320, 360, 375, 390, 414];
    await openPreview();
    for (const width of widths) {
      await setContentWidth(width, 800);
      await sleep(40);
      assert.equal(await evaluate('document.documentElement.clientWidth'), width);
      assert.match(await evaluate('document.querySelector(".header-phone").innerText'), /Call\/Text Daniel/);
      assert.equal(await evaluate('document.querySelector(".header-phone").getAttribute("href")'), 'tel:4074765076');
      await assertNoOverflow('questions ' + width);
    }
    await evaluate('document.querySelector(\'[data-value="Florida"]\').click()');
    await waitFor(async () => (await evaluate('document.getElementById("question-heading").textContent')).includes('benefits eligible'), 'overflow eligible');
    await evaluate('document.getElementById("q-number").value = "10"; document.getElementById("next-btn").click();');
    await waitFor(async () => (await evaluate('document.getElementById("question-heading").textContent')).includes('expect to enroll'), 'overflow enrolling');
    await evaluate('document.getElementById("q-number").value = "7"; document.getElementById("next-btn").click();');
    await waitFor(async () => (await evaluate('document.getElementById("question-heading").textContent')).includes('What matters most'), 'overflow priority');
    await evaluate('document.querySelector(\'[data-value="balanced"]\').click()');
    await waitFor(async () => (await evaluate('document.getElementById("question-heading").textContent')).includes('group health plan'), 'overflow coverage');
    await evaluate('document.querySelector(\'[data-value="yes"]\').click()');
    await waitFor(async () => (await evaluate('document.getElementById("question-heading").textContent')).includes('hoping to start'), 'overflow timeline');
    await evaluate('document.querySelector(\'[data-value="later"]\').click()');
    await waitFor(async () => !(await evaluate('document.getElementById("results").hidden')), 'overflow results');
    await sleep(200);
    await evaluate('document.querySelector(\'[data-plan-id="cigna-epo-1000"] .save-toggle\').click()');
    await evaluate('document.getElementById("goto-lead").click()');
    let capturedMobileCard = false;
    for (const width of widths) {
      await setContentWidth(width, 800);
      await sleep(40);
      await assertNoOverflow('results ' + width);
      if (width === 320 && !capturedMobileCard) {
        capturedMobileCard = true;
        const mobileCardText = await evaluate('document.querySelector(\'[data-plan-id="cigna-epo-1000"]\').innerText');
        assert.match(mobileCardText, /Total monthly premium/);
        assert.match(mobileCardText, /Employer monthly contribution/);
        const mobileFit = await evaluate(`(() => {
          const root = document.documentElement;
          const card = document.querySelector('[data-plan-id="cigna-epo-1000"]');
          card.scrollIntoView({ behavior: 'instant', block: 'center' });
          const box = card.getBoundingClientRect();
          return {
            scroll: root.scrollWidth,
            client: root.clientWidth,
            clip: { x: Math.max(0, box.left), y: Math.max(0, box.top + window.scrollY), width: Math.ceil(box.width), height: Math.ceil(box.height), scale: 1 }
          };
        })()`);
        assert.ok(mobileFit.scroll <= mobileFit.client + 1, '320 card page overflow ' + mobileFit.scroll);
        assert.ok(mobileFit.clip.width <= 320, 'card wider than 320: ' + mobileFit.clip.width);
        await shot('mobile_card_labels.png', mobileFit.clip);
        await shotPlanCard('cigna-ppo-8300-hsa', 'card_8300_mobile320.png');
      }
      await evaluate('document.querySelector(\'[data-plan-id="cigna-epo-1000"] .details-toggle\').click()');
      await sleep(30);
      await assertNoOverflow('expanded card ' + width);
      await evaluate('document.querySelector(\'[data-plan-id="cigna-epo-1000"] .details-toggle\').click()');
      if (await evaluate('document.getElementById("contrib").classList.contains("is-open")') === false) {
        await evaluate('document.getElementById("contrib-toggle").click()');
      }
      await assertNoOverflow('contribution ' + width);
      if (await evaluate('document.getElementById("my-plans-panel").hidden') === true) {
        await evaluate('document.getElementById("my-plans-btn").click()');
      }
      await assertNoOverflow('my plans ' + width);
      await assertNoOverflow('lead form ' + width);
    }
  } finally {
    if (ws) ws.close();
    chrome.kill('SIGKILL');
    server.kill('SIGKILL');
  }
});
