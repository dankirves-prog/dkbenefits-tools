const assert = require('node:assert/strict');
const { spawn, execFileSync } = require('node:child_process');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const test = require('node:test');

const ROOT = path.join(__dirname, '../../..');
const ARTIFACTS = '/opt/cursor/artifacts';
const PORT = 8781;
const DEBUG_PORT = 9355;
const ORIGIN = `http://127.0.0.1:${PORT}`;
const PAGE = `${ORIGIN}/quote-tool-demo/rates-first/index.html`;
const WEBHOOK = 'script.google.com';
const SAVED_IDS = [
  'cigna-ppo-8300-hsa',
  'cigna-epo-1750-hsa',
  'UHC-PPO-2000-Deductible',
  'phcs-visit-limit-1750-HSA',
  'cigna-epo-1000',
  'uhc-ppo-3000-hsa'
];

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

function flat(text) {
  return String(text || '').replace(/\s+/g, ' ').trim();
}

function pdfInfo(file) {
  const out = execFileSync('pdfinfo', [file], { encoding: 'utf8' });
  const pages = Number((out.match(/Pages:\s+(\d+)/) || [])[1]);
  const size = (out.match(/Page size:\s+(.+)/) || [])[1] || '';
  return { pages, size: size.trim() };
}

function pageText(file, page) {
  return execFileSync('pdftotext', ['-layout', '-f', String(page), '-l', String(page), file, '-'], { encoding: 'utf8' });
}

test('rates-first demo shows rates immediately and prints with or without group info', { timeout: 240000 }, async () => {
  fs.mkdirSync(ARTIFACTS, { recursive: true });
  const userData = '/tmp/chrome-rates-first-8705';
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
  const report = { timing: null, pages: [] };

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
    return file;
  }

  async function openPage(url) {
    posts.length = 0;
    await send('Page.navigate', { url }, sessionId);
    await waitFor(async () => evaluate(`(() => {
      const card = document.querySelector('#top-plans .plan-card:not(.skeleton)');
      const error = document.getElementById('load-error') && !document.getElementById('load-error').hidden;
      return !!(card || error);
    })()`), 'rates ' + url);
    const failed = await evaluate(`document.getElementById('load-error') && !document.getElementById('load-error').hidden`);
    assert.equal(failed, false, 'plans failed to load');
    await waitFor(async () => evaluate(`document.getElementById('rates-as-of').textContent.includes('October 2026')`), 'rates as of');
  }

  function layoutExpression() {
    return `(() => {
      const card = document.querySelector('#top-plans .plan-card:not(.skeleton)');
      const cardRect = card.getBoundingClientRect();
      const tools = ['#carrier-filters', '#sort-mode', '#my-plans-btn', '#print-all-btn', '#customize-btn', '#contact-btn'].map((sel) => {
        const el = document.querySelector(sel);
        const rect = el.getBoundingClientRect();
        const style = getComputedStyle(el);
        return { sel, top: rect.top, bottom: rect.bottom, width: rect.width, height: rect.height, display: style.display };
      });
      const fixed = [];
      document.querySelectorAll('body *').forEach((el) => {
        const style = getComputedStyle(el);
        if (style.position !== 'fixed' && style.position !== 'sticky') return;
        const rect = el.getBoundingClientRect();
        if (rect.width < 8 || rect.height < 8) return;
        if (rect.right > innerWidth - 72 && rect.bottom > innerHeight - 96) {
          fixed.push((el.id || el.className || el.tagName).toString().slice(0, 60));
        }
      });
      const mark = performance.getEntriesByName('rf-first-card')[0];
      return {
        innerWidth, innerHeight,
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth,
        cardTop: cardRect.top,
        cardBottom: cardRect.bottom,
        cardId: card.getAttribute('data-plan-id'),
        headline: document.querySelector('h1').textContent,
        trust: document.querySelector('.trust').textContent,
        trustDisplay: getComputedStyle(document.querySelector('.trust')).display,
        headers: document.querySelectorAll('header.site-header').length,
        h1: document.querySelectorAll('h1').length,
        tools, fixed,
        skeleton: !!document.querySelector('.skeleton'),
        eligible: document.getElementById('eligible').value,
        enrolling: document.getElementById('enrolling').value,
        payPressed: [...document.querySelectorAll('[data-pay]')].filter((el) => el.getAttribute('aria-checked') === 'true').length,
        contribPressed: [...document.querySelectorAll('#model-percent, #model-flat, [data-ee], [data-dep], [data-flat]')].filter((el) => el.getAttribute('aria-pressed') === 'true').length,
        sideDisplay: getComputedStyle(document.getElementById('customize-panel')).display,
        mark: mark ? mark.startTime : null
      };
    })()`;
  }

  function assertLanding(layout, phone) {
    assert.equal(layout.headline, 'Group health rates for small businesses');
    assert.equal(layout.trust, 'No company info needed. No spam.');
    assert.notEqual(layout.trustDisplay, 'none');
    assert.equal(layout.headers, 1);
    assert.equal(layout.h1, 1);
    assert.equal(layout.cardId, 'cigna-epo-1750-hsa');
    assert.equal(layout.skeleton, false);
    assert.equal(layout.eligible, '');
    assert.equal(layout.enrolling, '');
    assert.equal(layout.payPressed, 0);
    assert.equal(layout.contribPressed, 0);
    assert.equal(layout.fixed.length, 0, 'controls overlap the chat corner: ' + layout.fixed.join(','));
    assert.ok(layout.scrollWidth <= layout.clientWidth + 1, 'horizontal overflow ' + layout.scrollWidth + ' > ' + layout.clientWidth);
    assert.ok(layout.cardTop >= 0, 'first card starts above the viewport');
    assert.ok(layout.cardTop < layout.innerHeight - 72, 'first card is not visibly on screen, top ' + layout.cardTop + ' of ' + layout.innerHeight);
    assert.ok(layout.cardBottom > layout.cardTop + 40, 'first card is too short to read');
    layout.tools.forEach((tool) => {
      const expectVisible = phone || tool.sel !== '#customize-btn';
      if (!expectVisible) {
        assert.equal(tool.display, 'none', 'desktop should hide the customize button');
        return;
      }
      assert.notEqual(tool.display, 'none', tool.sel + ' is hidden');
      assert.ok(tool.top >= -1 && tool.bottom <= layout.innerHeight + 1 && tool.height >= 28, tool.sel + ' is off the landing screen ' + JSON.stringify(tool));
    });
    if (phone) assert.equal(layout.sideDisplay, 'none');
    else assert.notEqual(layout.sideDisplay, 'none');
  }

  async function clickPrint(id) {
    await evaluate(`(() => {
      window.print = () => {};
      document.getElementById(${JSON.stringify(id)}).click();
    })()`);
  }

  async function printPdf(filename) {
    const html = await evaluate(`(() => {
      const clone = document.documentElement.cloneNode(true);
      clone.querySelectorAll('script').forEach((node) => node.remove());
      const base = document.createElement('base');
      base.setAttribute('href', document.baseURI);
      clone.querySelector('head').insertBefore(base, clone.querySelector('head').firstChild);
      return '<!DOCTYPE html>' + clone.outerHTML;
    })()`);
    const sheets = [...html.matchAll(/<section class="print-sheet[\s\S]*?<\/section>/g)];
    const notes = (html.match(/class="print-notes-page"/g) || []).length;
    assert.ok(sheets.length >= 1, filename + ' has no plan sheet');
    sheets.forEach((sheet, index) => {
      const columns = (sheet[0].match(/class="print-tier/g) || []).length;
      assert.ok(columns >= 1 && columns <= 6, filename + ' sheet ' + (index + 1) + ' has ' + columns + ' plans');
    });
    assert.ok(html.includes('Important information'));
    assert.ok(html.includes('Notes and Limitations'));
    const created = await send('Target.createTarget', { url: 'about:blank' });
    const attached = await send('Target.attachToTarget', { targetId: created.targetId, flatten: true });
    const printSession = attached.sessionId;
    try {
      await send('Page.enable', {}, printSession);
      await send('Runtime.enable', {}, printSession);
      const tree = await send('Page.getFrameTree', {}, printSession);
      await send('Page.setDocumentContent', { frameId: tree.frameTree.frame.id, html }, printSession);
      const styled = await evaluate(`new Promise((resolve) => {
        const start = Date.now();
        const tick = () => {
          const link = [...document.querySelectorAll('link[rel="stylesheet"]')].find((node) => /preview\\.css/.test(node.getAttribute('href') || ''));
          if (link && link.sheet) resolve(true);
          else if (Date.now() - start > 4000) resolve(false);
          else setTimeout(tick, 30);
        };
        tick();
      })`, printSession);
      assert.equal(styled, true, 'print document did not load preview.css');
      await send('Emulation.setEmulatedMedia', { media: 'print' }, printSession);
      await sleep(60);
      const pdf = await send('Page.printToPDF', {
        printBackground: true,
        preferCSSPageSize: true,
        landscape: true
      }, printSession);
      const file = path.join(ARTIFACTS, filename);
      fs.writeFileSync(file, Buffer.from(pdf.data, 'base64'));
      return { file, sheets: sheets.length, notes };
    } finally {
      await send('Target.closeTarget', { targetId: created.targetId }).catch(() => {});
    }
  }

  function assertPdf(file, expectedSheets, expectedNotes, mode) {
    const info = pdfInfo(file);
    assert.match(info.size, /792(\.\d+)? x 612(\.\d+)? pts/, file + ' should be letter landscape, got ' + info.size);
    assert.equal(info.pages, expectedSheets + expectedNotes, file + ' page count ' + info.pages);
    const pages = [];
    for (let page = 1; page <= info.pages; page += 1) pages.push(flat(pageText(file, page)));
    const proposal = pages.slice(0, expectedSheets);
    const notes = pages.slice(expectedSheets);
    const last = proposal[proposal.length - 1];
    assert.match(last, /Important information/);
    assert.match(last, /Premium/);
    assert.match(last, /Family/);
    proposal.forEach((text) => assert.doesNotMatch(text, /Notes and Limitations/));
    notes.forEach((text, index) => {
      assert.match(text, /Notes and Limitations/);
      if (index === 0) assert.doesNotMatch(text, /continued/);
    });
    const blob = proposal.join('\n');
    if (mode === 'plain') {
      assert.doesNotMatch(blob, /EE Cost/);
      assert.doesNotMatch(blob, /Total monthly premium/);
      assert.doesNotMatch(blob, /Employer monthly/);
    } else if (mode === 'enrolling') {
      assert.match(blob, /Total monthly premium/);
      assert.doesNotMatch(blob, /EE Cost/);
      assert.doesNotMatch(blob, /Employer monthly/);
    } else {
      assert.match(blob, /EE Cost/);
      assert.match(blob, /\bPPP\b/);
      assert.match(blob, /Total monthly premium/);
      assert.match(blob, /Employer monthly/);
    }
    report.pages.push({ file: path.basename(file), pages: info.pages, proposal: expectedSheets, notes: expectedNotes, size: info.size, mode });
  }

  try {
    await waitFor(async () => {
      try {
        return (await httpGet(PAGE)).status === 200;
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

    await setViewport(390, 844);
    await openPage(PAGE);
    let layout = await evaluate(layoutExpression());
    report.timing = { viewport: '390x844', firstCardMs: layout.mark };
    assert.ok(typeof layout.mark === 'number' && layout.mark < 5000, 'first card was slow or missing: ' + layout.mark);
    assertLanding(layout, true);
    await shot('rf_mobile390_landing.png');
    await shot('rf3_mobile390_landing.png');

    await setViewport(360, 740);
    layout = await evaluate(layoutExpression());
    assertLanding(layout, true);
    await shot('rf_mobile360_landing.png');

    await setViewport(320, 800);
    await send('Page.navigate', { url: `${ORIGIN}/quote-tool-demo/rates-first/test/wix-harness.html` }, sessionId);
    await waitFor(async () => evaluate(`(() => {
      const frame = document.getElementById('tool');
      const doc = frame && frame.contentDocument;
      return !!(doc && doc.querySelector('#top-plans .plan-card:not(.skeleton)'));
    })()`), '320 iframe');
    const embedded = await evaluate(`(() => {
      const frame = document.getElementById('tool');
      const doc = frame.contentDocument;
      const win = doc.defaultView;
      const card = doc.querySelector('#top-plans .plan-card:not(.skeleton)');
      const cardRect = card.getBoundingClientRect();
      const frameRect = frame.getBoundingClientRect();
      const tools = ['#carrier-filters', '#my-plans-btn', '#print-all-btn', '#customize-btn', '#contact-btn'].map((sel) => {
        const rect = doc.querySelector(sel).getBoundingClientRect();
        return { sel, top: frameRect.top + rect.top, bottom: frameRect.top + rect.bottom, height: rect.height };
      });
      return {
        client: doc.documentElement.clientWidth,
        scroll: doc.documentElement.scrollWidth,
        cardId: card.getAttribute('data-plan-id'),
        cardTop: frameRect.top + cardRect.top,
        cardBottom: frameRect.top + cardRect.bottom,
        innerHeight: win.parent.innerHeight,
        tools
      };
    })()`);
    assert.equal(embedded.client, 320);
    assert.ok(embedded.scroll <= embedded.client + 1, '320 iframe overflow ' + embedded.scroll);
    assert.equal(embedded.cardId, 'cigna-epo-1750-hsa');
    assert.ok(embedded.cardTop < embedded.innerHeight - 48, 'first card is below the 320 iframe fold, top ' + embedded.cardTop);
    embedded.tools.forEach((tool) => {
      assert.ok(tool.top >= 0 && tool.bottom <= embedded.innerHeight && tool.height >= 28, tool.sel + ' is outside the 320 iframe ' + JSON.stringify(tool));
    });

    await setViewport(1440, 900);
    await openPage(PAGE);
    layout = await evaluate(layoutExpression());
    assertLanding(layout, false);
    const place = await evaluate(`(() => {
      const bar = document.querySelector('.rf-toolbar').getBoundingClientRect();
      const panel = document.getElementById('customize-panel').getBoundingClientRect();
      const card = document.querySelector('#top-plans .plan-card').getBoundingClientRect();
      const cols = getComputedStyle(document.querySelector('#top-plans')).gridTemplateColumns.split(' ').filter(Boolean);
      return {
        bar: bar.bottom,
        panelTop: panel.top,
        panelLeft: panel.left,
        panelBottom: panel.bottom,
        panelWidth: panel.width,
        cardTop: card.top,
        cardBottom: card.bottom,
        cardLeft: card.left,
        cardRight: card.right,
        cols: cols.length,
        btn: getComputedStyle(document.getElementById('customize-btn')).display,
        sticky: getComputedStyle(document.getElementById('customize-panel')).position,
        wrap: document.getElementById('quote-app').getBoundingClientRect().width,
        innerHeight: innerHeight
      };
    })()`);
    assert.ok(place.panelTop >= place.bar - 2, 'customize panel starts above the toolbar');
    assert.ok(place.panelLeft > place.cardRight - 2, 'customize panel is not beside the plan cards');
    assert.ok(place.cardTop < place.panelBottom && place.panelTop < place.cardBottom, 'panel and first card do not share the landing screen');
    assert.ok(place.cardTop < place.innerHeight - 72, 'first card is below the fold beside the panel');
    assert.ok(place.panelWidth < place.wrap * 0.5, 'side panel is too wide: ' + place.panelWidth);
    assert.ok(place.panelWidth >= 280, 'side panel is too narrow: ' + place.panelWidth);
    assert.equal(place.sticky, 'sticky', 'side panel should stay in view while the cards scroll');
    assert.equal(place.cols, 2, 'desktop cards should be two-up');
    assert.equal(place.btn, 'none', 'desktop hides the customize toggle');
    await evaluate(`window.scrollTo(0, 0)`);
    await shot('rf_desktop_landing.png');
    await shot('rf3_desktop_1440_landing.png');

    await evaluate(`(() => {
      const enrolling = document.getElementById('enrolling');
      enrolling.value = '7';
      enrolling.dispatchEvent(new Event('input', { bubbles: true }));
    })()`);
    await waitFor(async () => evaluate(`document.getElementById('mix-note').textContent.includes('Estimated mix') && document.querySelector('#top-plans .plan-card').innerText.includes('Total monthly premium')`), 'auto mix totals');
    const estimated = await evaluate(`(() => ({
      ee: document.getElementById('mix-ee').value,
      es: document.getElementById('mix-es').value,
      ec: document.getElementById('mix-ec').value,
      fam: document.getElementById('mix-fam').value,
      note: document.getElementById('mix-note').textContent,
      card: document.querySelector('#top-plans .plan-card').innerText
    }))()`);
    assert.equal(estimated.ee, '4');
    assert.equal(estimated.es, '1');
    assert.equal(estimated.ec, '1');
    assert.equal(estimated.fam, '1');
    assert.match(estimated.note, /Estimated mix, edit any number/);
    assert.match(estimated.card, /Total monthly premium/);
    assert.doesNotMatch(estimated.card, /Per paycheck|Employer monthly contribution/);
    await evaluate(`window.scrollTo(0, 0)`);
    await shot('rf2_desktop_customize_open.png');
    await clickPrint('print-all-btn');
    const enrollingPrint = await printPdf('rf-print-enrolling-only.pdf');
    assertPdf(enrollingPrint.file, enrollingPrint.sheets, enrollingPrint.notes, 'enrolling');
    execFileSync('pdftoppm', ['-png', '-r', '80', '-f', '1', '-l', '1', enrollingPrint.file, path.join(ARTIFACTS, 'rf2_print_enrolling_only_page1')]);
    fs.renameSync(path.join(ARTIFACTS, 'rf2_print_enrolling_only_page1-1.png'), path.join(ARTIFACTS, 'rf2_print_enrolling_only_page1.png'));

    await evaluate(`(() => {
      const set = (id, value) => {
        const el = document.getElementById(id);
        el.value = value;
        el.dispatchEvent(new Event('change', { bubbles: true }));
      };
      set('eligible', '10');
      set('enrolling', '7');
      set('mix-ee', '4');
      set('mix-es', '1');
      set('mix-ec', '1');
      set('mix-fam', '1');
      document.querySelector('[data-ee="50"]').click();
      document.querySelector('[data-dep="0"]').click();
      document.querySelector('[data-pay="26"]').click();
    })()`);
    await waitFor(async () => evaluate(`document.querySelector('#top-plans .plan-card').innerText.includes('Total monthly premium')`), 'custom totals');
    const customized = await evaluate(`(() => {
      const text = document.querySelector('#top-plans .plan-card').innerText;
      return {
        text,
        paycheck: text.includes('Per paycheck') || text.includes('Employee per paycheck'),
        eligible: document.getElementById('eligible').value,
        pay: document.querySelector('[data-pay="26"]').getAttribute('aria-checked')
      };
    })()`);
    assert.match(customized.text, /Total monthly premium/);
    assert.match(customized.text, /Employer monthly contribution/);
    assert.equal(customized.paycheck, true);
    assert.equal(customized.eligible, '10');
    assert.equal(customized.pay, 'true');
    await evaluate(`window.scrollTo(0, 0)`);
    await shot('rf_desktop_customized.png');
    await shot('rf3_desktop_1440_entered.png');

    await setViewport(390, 844);
    await evaluate(`document.getElementById('clear-group').click()`);
    await evaluate(`window.scrollTo(0, 0)`);
    await evaluate(`(() => {
      const panel = document.getElementById('customize-panel');
      if (getComputedStyle(panel).display === 'none') document.getElementById('customize-btn').click();
    })()`);
    await waitFor(async () => evaluate(`getComputedStyle(document.getElementById('customize-panel')).display !== 'none'`), 'customize panel');
    const dropped = await evaluate(`(() => {
      const button = document.getElementById('customize-btn').getBoundingClientRect();
      const panel = document.getElementById('customize-panel').getBoundingClientRect();
      const card = document.querySelector('#top-plans .plan-card').getBoundingClientRect();
      return {
        buttonBottom: button.bottom,
        panelTop: panel.top,
        panelBottom: panel.bottom,
        cardTop: card.top,
        display: getComputedStyle(document.getElementById('customize-panel')).display
      };
    })()`);
    assert.notEqual(dropped.display, 'none');
    assert.ok(dropped.panelTop >= dropped.buttonBottom - 4, 'customize box is not directly under the button');
    assert.ok(dropped.cardTop >= dropped.panelBottom - 4, 'plan cards are not below the customize box');
    await shot('rf3_mobile390_customize.png');
    await evaluate(`(() => {
      const enrolling = document.getElementById('enrolling');
      enrolling.value = '7';
      enrolling.dispatchEvent(new Event('input', { bubbles: true }));
    })()`);
    await waitFor(async () => evaluate(`document.getElementById('mix-ee').value === '4' && document.querySelector('#top-plans .group-cost')`), 'mobile auto mix');
    await evaluate(`(() => {
      const mixTop = document.getElementById('mix-ee').getBoundingClientRect().top + window.scrollY;
      window.scrollTo(0, Math.max(0, mixTop - 12));
    })()`);
    await shot('rf2_mobile_customize_open.png');
    await shot('rf_mobile_customize_panel.png');
    const panel = await evaluate(`(() => {
      const el = document.getElementById('customize-panel');
      const rect = el.getBoundingClientRect();
      return { top: rect.top, value: document.getElementById('eligible').value, display: getComputedStyle(el).display };
    })()`);
    assert.notEqual(panel.display, 'none');
    assert.equal(panel.value, '');
    assert.ok(panel.top < 844, 'customize panel is not on screen');

    await evaluate(`document.getElementById('contact-btn').click()`);
    await waitFor(async () => evaluate(`document.getElementById('lead').hidden === false`), 'lead form');
    const lead = await evaluate(`(() => {
      const states = [...document.querySelectorAll('[data-state]')].map((el) => ({
        label: el.textContent.trim(),
        checked: el.getAttribute('aria-checked')
      }));
      const rect = document.getElementById('lead').getBoundingClientRect();
      return { states, top: rect.top };
    })()`);
    assert.deepEqual(lead.states.map((item) => item.label), ['Florida', 'Georgia', 'Other']);
    assert.ok(lead.states.every((item) => item.checked === 'false'));
    await shot('rf_lead_form_state.png');
    await evaluate(`(() => {
      document.querySelector('[data-state="Florida"]').click();
      document.getElementById('first-name').value = 'Pat';
      document.getElementById('email').value = 'pat@example.com';
      document.getElementById('lead-form').requestSubmit();
    })()`);
    await waitFor(async () => evaluate(`document.getElementById('lead-success').textContent.includes('Demo mode, not sent')`), 'demo confirmation');
    assert.equal(posts.filter((post) => post.method === 'POST').length, 0);
    assert.equal(leaked, false);

    await evaluate(`document.getElementById('clear-group').click()`);
    await evaluate(`window.scrollTo(0, 0)`);
    await clickPrint('print-all-btn');
    const allPrint = await printPdf('rf-print-all-noinfo.pdf');
    assert.equal(allPrint.sheets, 3);
    assertPdf(allPrint.file, allPrint.sheets, allPrint.notes, 'plain');
    execFileSync('pdftoppm', ['-png', '-r', '80', '-f', '1', '-l', '1', allPrint.file, path.join(ARTIFACTS, 'rf_print_noinfo_page1')]);
    fs.renameSync(path.join(ARTIFACTS, 'rf_print_noinfo_page1-1.png'), path.join(ARTIFACTS, 'rf_print_noinfo_page1.png'));

    for (const id of SAVED_IDS) {
      await evaluate(`document.querySelector('.save-toggle[data-plan-id="${id}"]').click()`);
    }
    await evaluate(`document.querySelector('[data-carrier="Cigna"]').click()`);
    const filtered = await evaluate(`(() => {
      window.print = () => {};
      document.getElementById('drawer-print').click();
      return document.getElementById('print-root').innerText.includes('Visit Limit');
    })()`);
    assert.equal(filtered, true, 'print saved dropped a saved plan while a carrier filter was on');
    const savedPlain = await printPdf('rf-print-saved6-noinfo.pdf');
    assert.equal(savedPlain.sheets, 1);
    assertPdf(savedPlain.file, 1, savedPlain.notes, 'plain');

    await evaluate(`(() => {
      const set = (id, value) => {
        const el = document.getElementById(id);
        el.value = value;
        el.dispatchEvent(new Event('change', { bubbles: true }));
      };
      set('eligible', '10');
      set('enrolling', '7');
      set('mix-ee', '4');
      set('mix-es', '1');
      set('mix-ec', '1');
      set('mix-fam', '1');
      document.querySelector('[data-ee="50"]').click();
      document.querySelector('[data-dep="0"]').click();
      document.querySelector('[data-pay="26"]').click();
      window.print = () => {};
      document.getElementById('drawer-print').click();
    })()`);
    const savedFull = await printPdf('rf-print-saved6-full.pdf');
    assert.equal(savedFull.sheets, 1);
    assertPdf(savedFull.file, 1, savedFull.notes, 'full');
    execFileSync('pdftoppm', ['-png', '-r', '80', '-f', '1', '-l', '1', savedFull.file, path.join(ARTIFACTS, 'rf_print_withinfo_page1')]);
    fs.renameSync(path.join(ARTIFACTS, 'rf_print_withinfo_page1-1.png'), path.join(ARTIFACTS, 'rf_print_withinfo_page1.png'));
    execFileSync('pdftoppm', ['-png', '-r', '80', '-f', '1', '-l', '1', savedFull.file, path.join(ARTIFACTS, 'rf3_print_withdata_page1')]);
    fs.renameSync(path.join(ARTIFACTS, 'rf3_print_withdata_page1-1.png'), path.join(ARTIFACTS, 'rf3_print_withdata_page1.png'));
    assert.equal(posts.filter((post) => post.method === 'POST').length, 0);

    await openPage(PAGE + '?live=1');
    await evaluate(`document.querySelector('[data-carrier="UHC"]').click()`);
    await waitFor(async () => posts.some((post) => post.body.includes('"event":"quote_started"')), 'quote started');
    await evaluate(`(() => {
      const set = (id, value) => {
        const el = document.getElementById(id);
        el.value = value;
        el.dispatchEvent(new Event('change', { bubbles: true }));
      };
      set('enrolling', '7');
      document.querySelector('[data-ee="50"]').click();
    })()`);
    await waitFor(async () => posts.some((post) => post.body.includes('"event":"rates_displayed"')), 'rates displayed');
    const started = JSON.parse(posts.find((post) => post.body.includes('"event":"quote_started"')).body);
    const displayed = JSON.parse(posts.find((post) => post.body.includes('"event":"rates_displayed"')).body);
    assert.equal(started.firstName, 'Quote process started');
    assert.equal(displayed.firstName, 'Rates displayed');
    assert.equal(displayed.answers.state, '');
    assert.equal(displayed.answers.enrolling, '7');
    assert.equal(displayed.contribution.percent, 50);
    assert.equal(posts.filter((post) => post.body.includes('"event":"rates_displayed"')).length, 1);
    await evaluate(`(() => {
      document.querySelector('[data-state="Georgia"]').click();
      document.getElementById('contact-btn').click();
      document.getElementById('first-name').value = 'Pat';
      document.getElementById('email').value = 'pat@example.com';
      document.getElementById('lead-form').requestSubmit();
    })()`);
    await waitFor(async () => posts.some((post) => post.body.includes('"event":"lead_submitted"')), 'lead');
    const leadPost = JSON.parse(posts.find((post) => post.body.includes('"event":"lead_submitted"')).body);
    assert.equal(leadPost.answers.state, 'Georgia');
    assert.equal(leaked, false);
    assert.ok(posts.every((post) => post.url.includes('script.google.com') || post.url.includes('script.googleusercontent.com')));
    fs.writeFileSync(path.join(ARTIFACTS, 'rf-report.json'), JSON.stringify(report, null, 2));
  } finally {
    if (ws) ws.close();
    chrome.kill('SIGKILL');
    server.kill('SIGKILL');
  }
});
