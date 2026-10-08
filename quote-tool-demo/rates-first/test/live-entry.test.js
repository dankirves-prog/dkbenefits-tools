const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const test = require('node:test');

const ROOT = path.join(__dirname, '../../..');
const ARTIFACTS = '/opt/cursor/artifacts';
const PORT = 8783;
const DEBUG_PORT = 9357;
const ORIGIN = `http://127.0.0.1:${PORT}`;
const LIVE = `${ORIGIN}/quote-tool-demo/quote-tool.html`;
const DEMO = `${ORIGIN}/quote-tool-demo/rates-first/index.html`;
const HARNESS = `${ORIGIN}/quote-tool-demo/rates-first/test/live-harness.html`;
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

test('live quote entry posts without ?live=1 and still fits the Wix iframe', { timeout: 180000 }, async () => {
  fs.mkdirSync(ARTIFACTS, { recursive: true });
  const userData = '/tmp/chrome-rates-first-live-8705';
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

  async function evaluate(expression, targetSession) {
    const result = await send('Runtime.evaluate', {
      expression,
      awaitPromise: true,
      returnByValue: true
    }, targetSession || sessionId);
    if (result.exceptionDetails) {
      throw new Error('page error: ' + JSON.stringify(result.exceptionDetails.exception || result.exceptionDetails));
    }
    return result.result ? result.result.value : undefined;
  }

  async function waitFor(predicate, label) {
    const start = Date.now();
    while (Date.now() - start < 12000) {
      if (await predicate()) return;
      await sleep(40);
    }
    throw new Error('timed out waiting for ' + label);
  }

  async function setViewport(width, height) {
    await send('Emulation.setDeviceMetricsOverride', {
      width,
      height,
      deviceScaleFactor: 1,
      mobile: width < 500
    }, sessionId);
    const gutter = await evaluate('innerWidth - document.documentElement.clientWidth');
    if (gutter > 0) {
      await send('Emulation.setDeviceMetricsOverride', {
        width: width + gutter,
        height,
        deviceScaleFactor: 1,
        mobile: width < 500
      }, sessionId);
    }
  }

  async function shot(name) {
    const result = await send('Page.captureScreenshot', { format: 'png' }, sessionId);
    const file = path.join(ARTIFACTS, name);
    fs.writeFileSync(file, Buffer.from(result.data, 'base64'));
    assert.ok(fs.statSync(file).size > 5000, name + ' screenshot was empty');
  }

  async function openTop(url) {
    posts.length = 0;
    await evaluate('sessionStorage.clear(); localStorage.clear();');
    await send('Page.navigate', { url }, sessionId);
    await waitFor(async () => evaluate(`(() => {
      const card = document.querySelector('#top-plans .plan-card:not(.skeleton)');
      const error = document.getElementById('load-error') && !document.getElementById('load-error').hidden;
      return !!(card || error);
    })()`), 'rates ' + url);
    const failed = await evaluate(`document.getElementById('load-error') && !document.getElementById('load-error').hidden`);
    assert.equal(failed, false, 'plans failed to load for ' + url);
    await waitFor(async () => evaluate(`document.getElementById('rates-as-of').textContent.includes('October 2026')`), 'rates as of ' + url);
  }

  const frameProbe = `(() => {
    const frame = document.getElementById('tool');
    const doc = frame && frame.contentDocument;
    const win = doc && doc.defaultView;
    if (!doc || !win) return null;
    const card = doc.querySelector('#top-plans .plan-card:not(.skeleton)');
    if (!card) {
      const error = doc.getElementById('load-error');
      return { error: !!(error && !error.hidden) };
    }
    const cardRect = card.getBoundingClientRect();
    const frameRect = frame.getBoundingClientRect();
    const tools = ['#carrier-filters', '#sort-mode', '#my-plans-btn', '#print-all-btn', '#customize-btn', '#contact-btn'].map((sel) => {
      const el = doc.querySelector(sel);
      const rect = el.getBoundingClientRect();
      const style = win.getComputedStyle(el);
      return {
        sel,
        top: rect.top,
        bottom: rect.bottom,
        height: rect.height,
        display: style.display,
        parentTop: frameRect.top + rect.top,
        parentBottom: frameRect.top + rect.bottom
      };
    });
    const panel = doc.getElementById('customize-panel');
    const panelStyle = win.getComputedStyle(panel);
    const lead = doc.getElementById('lead');
    const mark = win.performance.getEntriesByName('rf-first-card')[0];
    return {
      error: false,
      href: win.location.href,
      liveFlag: win.__rfLive === true,
      search: win.location.search,
      innerWidth: win.innerWidth,
      innerHeight: win.innerHeight,
      parentHeight: win.parent.innerHeight,
      scrollWidth: doc.documentElement.scrollWidth,
      clientWidth: doc.documentElement.clientWidth,
      cardId: card.getAttribute('data-plan-id'),
      cardTop: cardRect.top,
      cardBottom: cardRect.bottom,
      parentCardTop: frameRect.top + cardRect.top,
      tools,
      sideDisplay: panelStyle.display,
      sidePosition: panelStyle.position,
      sideLeft: panel.getBoundingClientRect().left,
      cardLeft: cardRect.left,
      leadHidden: lead.hidden,
      leadHeading: doc.getElementById('lead-heading').textContent,
      mark: mark ? mark.startTime : null
    };
  })()`;

  try {
    await waitFor(async () => {
      try {
        return (await httpGet(LIVE)).status === 200;
      } catch (error) {
        return false;
      }
    }, 'server');

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
        const paused = message;
        const { requestId, request } = paused.params;
        const url = request.url || '';
        const targetSession = paused.sessionId;
        const finish = url.includes(WEBHOOK) || url.includes('script.googleusercontent.com')
          ? (async () => {
            posts.push({ url, method: request.method, body: request.postData || '' });
            await send('Fetch.fulfillRequest', {
              requestId,
              responseCode: 200,
              responseHeaders: [
                { name: 'Content-Type', value: 'application/json' },
                { name: 'Access-Control-Allow-Origin', value: '*' }
              ],
              body: Buffer.from('{"ok":true}').toString('base64')
            }, targetSession);
          })()
          : send('Fetch.continueRequest', { requestId }, targetSession);
        finish.catch((error) => {
          leaked = true;
          console.error(error);
        });
      }
    });

    const created = await send('Target.createTarget', { url: 'about:blank' });
    const attached = await send('Target.attachToTarget', { targetId: created.targetId, flatten: true });
    sessionId = attached.sessionId;
    await send('Page.enable', {}, sessionId);
    await send('Runtime.enable', {}, sessionId);
    await send('Fetch.enable', { patterns: [{ urlPattern: '*', requestStage: 'Request' }] }, sessionId);
    await setViewport(1280, 900);

    await openTop(LIVE);
    const liveBoot = await evaluate(`({ href: location.href, live: window.__rfLive === true, search: location.search })`);
    assert.equal(liveBoot.live, true);
    assert.equal(liveBoot.search, '');
    assert.doesNotMatch(liveBoot.href, /[?&]live=/);
    await evaluate(`document.querySelector('[data-carrier="UHC"]').click()`);
    await waitFor(async () => posts.some((post) => post.body.includes('"event":"quote_started"')), 'live quote started');
    await evaluate(`(() => {
      document.querySelector('.save-toggle[data-plan-id="cigna-epo-1750-hsa"]').click();
      const set = (id, value) => {
        const el = document.getElementById(id);
        el.value = value;
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
      };
      set('enrolling', '7');
      document.querySelector('[data-ee="50"]').click();
    })()`);
    await waitFor(async () => posts.some((post) => post.body.includes('"event":"rates_displayed"')), 'live rates displayed');
    await evaluate(`(() => {
      document.querySelector('[data-state="Georgia"]').click();
      document.querySelector('[data-help="Ready to enroll"]').click();
      document.getElementById('first-name').value = 'Pat';
      document.getElementById('email').value = 'pat@example.com';
      document.getElementById('phone').value = '407-555-0100';
      document.getElementById('lead-form').requestSubmit();
    })()`);
    await waitFor(async () => posts.some((post) => post.body.includes('"event":"lead_submitted"')), 'live lead');
    await waitFor(async () => evaluate(`document.getElementById('lead-success').textContent.includes('Daniel will reach out soon')`), 'live thanks');
    const started = JSON.parse(posts.find((post) => post.body.includes('"event":"quote_started"')).body);
    const displayed = JSON.parse(posts.find((post) => post.body.includes('"event":"rates_displayed"')).body);
    const lead = JSON.parse(posts.find((post) => post.body.includes('"event":"lead_submitted"')).body);
    assert.equal(started.firstName, 'Quote process started');
    assert.equal(displayed.firstName, 'Rates displayed');
    assert.equal(displayed.answers.state, '');
    assert.equal(displayed.answers.enrolling, '7');
    assert.equal(lead.firstName, 'Pat');
    assert.equal(lead.email, 'pat@example.com');
    assert.equal(lead.phone, '407-555-0100');
    assert.equal(lead.answers.state, 'Georgia');
    assert.equal(lead.answers.enrolling, '7');
    assert.equal(lead.contribution.model, 'percent');
    assert.equal(lead.contribution.percent, 50);
    assert.equal(lead.helpWith, 'Ready to enroll');
    assert.equal(lead.selectedPlans[0].id, 'cigna-epo-1750-hsa');
    assert.equal(lead.notes, undefined);
    assert.ok(posts.every((post) => post.url.includes('lSq0CZ0z')));
    assert.equal(posts.filter((post) => post.method === 'POST').length, 3);
    assert.equal(leaked, false);

    await openTop(DEMO);
    await evaluate(`(() => {
      document.querySelector('[data-carrier="Cigna"]').click();
      const set = (id, value) => {
        const el = document.getElementById(id);
        el.value = value;
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
      };
      set('enrolling', '7');
      document.querySelector('[data-ee="50"]').click();
      document.querySelector('[data-state="Florida"]').click();
      document.querySelector('[data-help="Just learning more"]').click();
      document.getElementById('first-name').value = 'Pat';
      document.getElementById('email').value = 'pat@example.com';
      document.getElementById('lead-form').requestSubmit();
    })()`);
    await waitFor(async () => evaluate(`document.getElementById('lead-success').textContent.includes('Demo mode, not sent')`), 'demo confirmation');
    await sleep(500);
    assert.equal(posts.length, 0, 'demo folder posted without ?live=1');

    async function assertHarness(width, height, phone) {
      await setViewport(width, height);
      posts.length = 0;
      await send('Page.navigate', { url: HARNESS }, sessionId);
      await waitFor(async () => {
        const probe = await evaluate(frameProbe);
        return !!(probe && (probe.cardId || probe.error));
      }, 'harness ' + width);
      const layout = await evaluate(frameProbe);
      assert.equal(layout.error, false, 'live iframe failed to load plans');
      assert.match(layout.href, /\/quote-tool\.html$/);
      assert.equal(layout.liveFlag, true);
      assert.equal(layout.search, '');
      assert.equal(layout.cardId, 'cigna-epo-1750-hsa');
      assert.ok(typeof layout.mark === 'number' && layout.mark < 5000, 'first card was slow: ' + layout.mark);
      assert.ok(layout.scrollWidth <= layout.clientWidth + 1, 'iframe overflow ' + layout.scrollWidth);
      assert.ok(layout.cardTop >= 0 && layout.cardTop < layout.innerHeight - 48, 'first card is outside the iframe, top ' + layout.cardTop + ' of ' + layout.innerHeight);
      assert.ok(layout.parentCardTop < layout.parentHeight - 24, 'first card is below the Wix fold');
      assert.equal(layout.leadHidden, false);
      assert.equal(layout.leadHeading, "Let's Talk");
      layout.tools.forEach((tool) => {
        const expectVisible = phone || tool.sel !== '#customize-btn';
        if (!expectVisible) {
          assert.equal(tool.display, 'none');
          return;
        }
        assert.notEqual(tool.display, 'none', tool.sel);
        assert.ok(tool.top >= -1 && tool.bottom <= layout.innerHeight + 1 && tool.height >= 28, tool.sel + ' is off the iframe ' + JSON.stringify(tool));
        assert.ok(tool.parentTop >= 100 && tool.parentBottom <= layout.parentHeight + 1, tool.sel + ' is outside the Wix viewport');
      });
      if (phone) {
        assert.equal(layout.sideDisplay, 'none');
      } else {
        assert.notEqual(layout.sideDisplay, 'none');
        assert.equal(layout.sidePosition, 'sticky');
        assert.ok(layout.innerWidth >= 1024);
        assert.ok(layout.sideLeft > layout.cardLeft, 'side panel is not beside the cards');
      }
      const printed = await evaluate(`(() => {
        const doc = document.getElementById('tool').contentDocument;
        const win = doc.defaultView;
        win.print = () => {};
        doc.getElementById('print-all-btn').click();
        const root = doc.getElementById('print-root').innerHTML;
        return {
          sheet: root.includes('print-sheet'),
          important: root.includes('Important information'),
          notes: root.includes('Notes and Limitations'),
          name: root.includes('Cigna')
        };
      })()`);
      assert.equal(printed.sheet, true);
      assert.equal(printed.important, true);
      assert.equal(printed.notes, true);
      assert.equal(printed.name, true);
      assert.equal(posts.length, 0, 'harness load posted before a visitor action');
      return layout;
    }

    const mobile = await assertHarness(390, 844, true);
    await shot('rf-live_mobile390.png');
    await assertHarness(360, 740, true);
    const desktop = await assertHarness(1440, 900, false);
    await shot('rf-live_desktop1440.png');
    const contact = await evaluate(`(() => {
      const doc = document.getElementById('tool').contentDocument;
      const win = doc.defaultView;
      const lead = doc.getElementById('lead');
      const maxScroll = doc.documentElement.scrollHeight - win.innerHeight;
      win.scrollTo(0, Math.min(Math.max(0, lead.offsetTop - 8), Math.max(0, maxScroll)));
      const heading = doc.getElementById('lead-heading').getBoundingClientRect();
      const submit = doc.getElementById('lead-submit');
      return {
        heading: doc.getElementById('lead-heading').textContent,
        top: heading.top,
        bottom: heading.bottom,
        innerHeight: win.innerHeight,
        submit: submit.textContent.trim(),
        hidden: lead.hidden,
        formHidden: doc.getElementById('lead-form').hidden
      };
    })()`);
    assert.equal(contact.heading, "Let's Talk");
    assert.equal(contact.submit, "Let's Talk");
    assert.equal(contact.hidden, false);
    assert.equal(contact.formHidden, false);
    assert.ok(contact.top >= -2 && contact.top < contact.innerHeight - 28, 'contact card is not open on screen');
    fs.writeFileSync(path.join(ARTIFACTS, 'rf-live-report.json'), JSON.stringify({
      mobileFirstCardMs: mobile.mark,
      desktopFirstCardMs: desktop.mark,
      postsIntercepted: true
    }, null, 2));
  } finally {
    if (ws) ws.close();
    chrome.kill('SIGKILL');
    server.kill('SIGKILL');
  }
});
