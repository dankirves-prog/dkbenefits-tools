const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const test = require('node:test');

const ROOT = path.join(__dirname, '../../..');
const PLANS_PATH = path.join(ROOT, 'quote-tool-demo/plans.json');
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
    await evaluate('document.getElementById("next-btn").click()');
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

    plansMode = 'live';
    await evaluate('sessionStorage.clear()');
    await openPreview();
    await setViewport(1440, 900);
    await waitFor(async () => (await evaluate('document.getElementById("question-heading").textContent')).includes('What state'), 'state question');
    const choiceHeight = await evaluate('document.querySelector(".choice").getBoundingClientRect().height');
    assert.ok(choiceHeight >= 60, 'choice options should be large tap targets');
    await shot('desktop_question_v2.png');

    await evaluate('document.querySelector(\'[data-value="Florida"]\').click()');
    await waitFor(async () => (await evaluate('document.getElementById("question-heading").textContent')).includes('benefits eligible'), 'eligible after Florida');
    await evaluate('document.getElementById("q-number").value = "10"; document.getElementById("next-btn").click();');
    await waitFor(async () => (await evaluate('document.getElementById("question-heading").textContent')).includes('expect to enroll'), 'enrolling');
    await evaluate('document.getElementById("q-number").value = "7"; document.getElementById("next-btn").click();');
    await waitFor(async () => (await evaluate('document.getElementById("question-heading").textContent')).includes('What matters most'), 'priority');
    await evaluate('document.querySelector(\'[data-value="balanced"]\').click()');
    await waitFor(async () => (await evaluate('document.getElementById("question-heading").textContent')).includes('group health plan'), 'coverage');
    await evaluate('document.querySelector(\'[data-value="yes"]\').click()');
    await waitFor(async () => (await evaluate('document.getElementById("question-heading").textContent')).includes('hoping to start'), 'timeline');
    await evaluate('document.querySelector(\'[data-value="later"]\').click()');
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
    assert.match(card, /\$4,858/);
    assert.match(card, /\$1,764/);
    assert.match(card, /\$116/);
    assert.match(card, /\$273/);
    assert.match(card, /\$269/);
    assert.match(card, /\$421/);
    const lowInFeatured = await evaluate('!!document.querySelector("#top-plans [data-plan-id=\\"phcs-visit-limit-1000\\"]")');
    const lowInSection = await evaluate('!!document.querySelector("#low-plans [data-plan-id=\\"phcs-visit-limit-1000\\"]")');
    assert.equal(lowInFeatured, false);
    assert.equal(lowInSection, true);
    assert.equal(posts.filter((post) => post.body.includes('"event":"rates_displayed"')).length, 1);
    assert.equal(posts.filter((post) => post.body.includes('"event":"quote_started"')).length, 1);
    const ratesPost = JSON.parse(posts.find((post) => post.body.includes('"event":"rates_displayed"')).body);
    assert.equal(ratesPost.utm_source, 'preview');

    await setViewport(1440, 1100);
    const cardTop = await evaluate('document.querySelector("#top-plans .plan-card").getBoundingClientRect().top');
    assert.ok(cardTop > 0 && cardTop < 1000, 'first plan card should be visible beside the contribution panel, top=' + cardTop);
    await shot('desktop_results_v2.png');

    await evaluate('document.getElementById("sort-mode").value = "carrier"; document.getElementById("sort-mode").dispatchEvent(new Event("change", { bubbles: true }));');
    await evaluate('document.querySelector(\'[data-carrier="Cigna"]\').click()');
    await evaluate('document.getElementById("employer-contribution").value = "100"; document.getElementById("employer-contribution").dispatchEvent(new Event("input", { bubbles: true }));');
    await evaluate('document.querySelector(\'[data-dep="50"]\').click()');
    await sleep(150);
    const filteredUhc = await evaluate('document.querySelector(\'[data-plan-id="uhc-ppo-3000-hsa"]\')');
    assert.equal(filteredUhc, null);
    const updated = await evaluate('document.querySelector(\'[data-plan-id="cigna-epo-1000"]\').innerText');
    assert.match(updated, /\$4,193/);
    assert.equal(posts.filter((post) => post.body.includes('"event":"rates_displayed"')).length, 1);

    await evaluate('document.querySelector(\'[data-carrier="All"]\').click()');
    await evaluate('document.getElementById("sort-mode").value = "price"; document.getElementById("sort-mode").dispatchEvent(new Event("change", { bubbles: true }));');
    await evaluate('document.querySelector(\'[data-ee="50"]\').click(); document.querySelector(\'[data-carrier="All"]\').click();');
    await evaluate('document.getElementById("dependent-contribution").value = "0"; document.getElementById("dependent-contribution").dispatchEvent(new Event("input", { bubbles: true }));');
    await sleep(100);

    await setViewport(390, 844);
    await evaluate('window.scrollTo(0, 0)');
    await sleep(100);
    const launcher = await evaluate('getComputedStyle(document.getElementById("contrib-launcher")).display');
    assert.equal(launcher, 'flex');
    const dockText = await evaluate('document.getElementById("dock").innerText');
    assert.match(dockText, /Call or text Daniel/);
    assert.match(dockText, /407-476-5076/);
    assert.match(dockText, /Adjust/);
    await shot('mobile_results_v2.png');

    await evaluate('document.getElementById("contrib-launcher").click()');
    await sleep(100);
    const sheetOpen = await evaluate('document.getElementById("contrib").classList.contains("is-open")');
    assert.equal(sheetOpen, true);
    await evaluate('document.getElementById("contrib-close").click()');

    await setViewport(1280, 900);
    await evaluate('document.querySelector(\'[data-plan-id="cigna-epo-1000"] .save-plan\').click()');
    await evaluate('document.querySelector(\'[data-plan-id="UHC-PPO-2000-Deductible"] .save-plan\').click()');
    await sleep(50);
    const compare = await evaluate('document.getElementById("compare").innerText');
    assert.match(compare, /Cigna EPO 1000/);
    assert.match(compare, /UHC PPO 2000/);

    await send('Emulation.setEmulatedMedia', { media: 'print' }, sessionId);
    await sleep(100);
    await shot('print_proposal_v2.png', { x: 0, y: 0, width: 900, height: 1400, scale: 1 });
    const pdf = await send('Page.printToPDF', {
      printBackground: true,
      paperWidth: 8.5,
      paperHeight: 11,
      marginTop: 0.5,
      marginBottom: 0.5,
      marginLeft: 0.5,
      marginRight: 0.5,
      preferCSSPageSize: true
    }, sessionId);
    const pdfPath = path.join(ARTIFACTS, 'proposal_sample_v2.pdf');
    fs.writeFileSync(pdfPath, Buffer.from(pdf.data, 'base64'));
    const pdfBytes = fs.readFileSync(pdfPath);
    assert.equal(pdfBytes.subarray(0, 5).toString(), '%PDF-');
    assert.ok(pdfBytes.length > 20000, 'proposal PDF was unexpectedly small');
    await send('Emulation.setEmulatedMedia', { media: 'screen' }, sessionId);

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
    await shot('lead_form_v2.png', { x: leadGeom.x, y: leadGeom.y, width: leadGeom.width, height: leadGeom.height, scale: 1 });
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
    await shot('success_state_v2.png', { x: successGeom.x, y: successGeom.y, width: successGeom.width, height: successGeom.height, scale: 1 });

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
    assert.deepEqual(lead.selectedPlans.map((plan) => plan.name), ['Cigna EPO 1000', 'UHC PPO 2000']);
    assert.deepEqual(Object.keys(lead.selectedPlans[0]), ['id', 'name', 'network', 'typeBadge', 'rates']);
    assert.equal(lead.utm_source, 'preview');
    assert.equal(lead.event, 'lead_submitted');
    assert.equal(posts.filter((post) => post.body.includes('"event":"rates_displayed"')).length, 1);

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
  } finally {
    if (ws) ws.close();
    chrome.kill('SIGKILL');
    server.kill('SIGKILL');
  }
});
