const assert = require('node:assert/strict');
const { spawn, execFileSync } = require('node:child_process');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const test = require('node:test');

const ROOT = path.join(__dirname, '../../..');
const ARTIFACTS = '/opt/cursor/artifacts';
const PORT = 8774;
const DEBUG_PORT = 9346;
const ORIGIN = `http://127.0.0.1:${PORT}`;
const WEBHOOK = 'script.google.com';
const PLAN_IDS = [
  'phcs-visit-limit-1750-HSA',
  'cigna-epo-1000',
  'UHC-PPO-2000-Deductible',
  'cigna-epo-1750-hsa'
];
const DISCLAIMER_HTML = [
  'Important information',
  'Rates shown are based on current published pricing and the answers provided. Final eligibility, participation, underwriting, plan availability, effective dates, and carrier/program approval may change pricing or options. Benefits are governed by official plan documents.',
  'Plan availability may vary by state. If your business is outside Florida or Georgia, Daniel can let you know whether DK Benefits can assist directly or connect you with an appropriate resource.',
  'Use of this tool does not create a broker-client relationship or guarantee coverage.'
];
const DISCLAIMER_PDF = [
  'Important information',
  'Rates shown are based on current published pricing and the answers provided.',
  'Benefits are governed by official plan documents.',
  'Plan availability may vary by state.',
  'connect you with an appropriate resource.',
  'broker-client relationship or guarantee coverage.'
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

function hasPlanContent(text) {
  return /Total monthly premium/.test(text) && /EE Cost PPP/.test(text);
}

test('printed proposals keep Important information on the last plan page', { timeout: 240000 }, async () => {
  fs.mkdirSync(ARTIFACTS, { recursive: true });
  const work = '/tmp/print-pages-8705';
  fs.rmSync(work, { recursive: true, force: true });
  fs.mkdirSync(work, { recursive: true });
  const userData = '/tmp/chrome-print-pages-8705';
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

  let ws;
  let sessionId;
  const counts = [];

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

  async function frameEval(expression) {
    return evaluate(`(() => { const doc = document.getElementById('tool').contentDocument; const win = doc.defaultView; return eval(${JSON.stringify(expression)}); })()`);
  }

  async function waitFor(predicate, label) {
    const start = Date.now();
    while (Date.now() - start < 12000) {
      if (await predicate()) return;
      await sleep(40);
    }
    throw new Error('timed out waiting for ' + label);
  }

  async function openHarness(query, width, height) {
    await send('Emulation.setDeviceMetricsOverride', {
      width,
      height,
      deviceScaleFactor: 1,
      mobile: false
    }, sessionId);
    await send('Page.navigate', { url: `${ORIGIN}/quote-tool-demo/preview/test/wix-harness.html${query}` }, sessionId);
    await waitFor(async () => evaluate(`(() => {
      const frame = document.getElementById('tool');
      if (!frame || !frame.contentDocument) return false;
      const heading = frame.contentDocument.getElementById('question-heading');
      return !!(heading && heading.textContent && heading.textContent !== 'Loading plan options…');
    })()`), 'harness ' + query);
    await sleep(150);
    const gutter = await evaluate('innerWidth - document.documentElement.clientWidth');
    if (gutter > 0) {
      await send('Emulation.setDeviceMetricsOverride', {
        width: width + gutter,
        height,
        deviceScaleFactor: 1,
        mobile: false
      }, sessionId);
      await sleep(80);
    }
  }

  async function reachResults() {
    await frameEval(`doc.querySelector('[data-value="Florida"]').click()`);
    await waitFor(async () => String(await frameEval(`doc.getElementById('question-heading').textContent`)).includes('benefits eligible'), 'eligible');
    await frameEval(`doc.getElementById('q-number').value = '10'; doc.getElementById('next-btn').click();`);
    await waitFor(async () => String(await frameEval(`doc.getElementById('question-heading').textContent`)).includes('expect to enroll'), 'enrolling');
    await frameEval(`doc.getElementById('q-number').value = '7'; doc.getElementById('next-btn').click();`);
    await waitFor(async () => String(await frameEval(`doc.getElementById('question-heading').textContent`)).includes('What matters most'), 'priority');
    await frameEval(`doc.querySelector('[data-value="cost"]').click()`);
    await waitFor(async () => String(await frameEval(`doc.getElementById('question-heading').textContent`)).includes('group health plan'), 'coverage');
    await frameEval(`doc.querySelector('[data-value="no"]').click()`);
    await waitFor(async () => String(await frameEval(`doc.getElementById('question-heading').textContent`)).includes('hoping to start'), 'timeline');
    await frameEval(`doc.querySelector('[data-value="30"]').click()`);
    await waitFor(async () => frameEval(`doc.getElementById('results').hidden === false`), 'results');
    await frameEval(`(doc.fonts && doc.fonts.ready) || true`);
    await sleep(180);
  }

  async function printIframe(filename) {
    const html = await frameEval(`(() => {
      win.dispatchEvent(new Event('beforeprint'));
      const clone = doc.documentElement.cloneNode(true);
      clone.querySelectorAll('script').forEach((node) => node.remove());
      const base = doc.createElement('base');
      base.setAttribute('href', doc.baseURI);
      clone.querySelector('head').insertBefore(base, clone.querySelector('head').firstChild);
      return '<!DOCTYPE html>' + clone.outerHTML;
    })()`);
    DISCLAIMER_HTML.forEach((sentence) => {
      assert.ok(html.includes(sentence), 'print HTML dropped disclaimer wording: ' + sentence);
    });
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
          if (link && link.sheet) resolve({ sheet: true, href: link.href });
          else if (Date.now() - start > 4000) resolve({ sheet: !!(link && link.sheet), href: link ? link.href : '' });
          else setTimeout(tick, 30);
        };
        tick();
      })`, printSession);
      assert.equal(styled.sheet, true, 'print document did not load preview.css from ' + styled.href);
      await send('Emulation.setEmulatedMedia', { media: 'print' }, printSession);
      await sleep(80);
      const fontPx = parseFloat(await evaluate(`getComputedStyle(document.querySelector('.print-root')).fontSize`, printSession));
      assert.ok(fontPx >= 10.4 && fontPx <= 11, 'proposal body should stay about 8pt, got ' + fontPx + 'px');
      const disclaimer = await evaluate(`(() => {
        const el = document.querySelector('.print-disclaimer');
        const style = getComputedStyle(el);
        return { font: style.fontSize, columns: style.columnCount };
      })()`, printSession);
      assert.equal(disclaimer.columns, '2');
      const disclaimerPx = parseFloat(disclaimer.font);
      assert.ok(disclaimerPx >= 9.5 && disclaimerPx <= 11, 'disclaimer should stay about 7.5–8pt, got ' + disclaimer.font);
      const pdf = await send('Page.printToPDF', {
        printBackground: true,
        preferCSSPageSize: true,
        landscape: true
      }, printSession);
      const file = path.join(work, filename);
      fs.writeFileSync(file, Buffer.from(pdf.data, 'base64'));
      return file;
    } finally {
      await send('Target.closeTarget', { targetId: created.targetId }).catch(() => {});
    }
  }

  function assertProposal(file, expectedPages, label) {
    const info = pdfInfo(file);
    assert.equal(info.pages, expectedPages, label + ' page count');
    assert.match(info.size, /792(\.\d+)? x 612(\.\d+)? pts/, label + ' should be US Letter landscape, got ' + info.size);
    const pages = [];
    for (let page = 1; page <= info.pages; page += 1) pages.push(flat(pageText(file, page)));
    const last = pages[pages.length - 1];
    assert.match(last, /Important information/, label + ' last page lost the disclaimer');
    assert.equal(hasPlanContent(last), true, label + ' last page is disclaimer-only spillover');
    pages.forEach((text, index) => {
      if (/Important information/.test(text)) {
        assert.equal(hasPlanContent(text), true, label + ' page ' + (index + 1) + ' holds only the disclaimer');
      }
    });
    DISCLAIMER_PDF.forEach((sentence) => {
      assert.ok(last.includes(sentence), label + ' dropped disclaimer wording: ' + sentence);
    });
    counts.push({ label, pages: info.pages, size: info.size, spill: false });
    return pages;
  }

  function renderPage(file, page, outName) {
    const prefix = path.join(work, 'render');
    execFileSync('pdftoppm', ['-png', '-r', '120', '-f', String(page), '-l', String(page), '-singlefile', file, prefix]);
    const dest = path.join(ARTIFACTS, outName);
    fs.copyFileSync(prefix + '.png', dest);
    assert.ok(fs.statSync(dest).size > 20000, outName + ' was empty');
  }

  try {
    await waitFor(async () => {
      try {
        return (await httpGet(`${ORIGIN}/quote-tool-demo/preview/index.html`)).status === 200;
      } catch (error) {
        return false;
      }
    }, 'local server').catch(() => { throw new Error('preview server did not start'); });

    let version;
    for (let attempt = 0; attempt < 80; attempt += 1) {
      try {
        version = JSON.parse((await httpGet(`http://127.0.0.1:${DEBUG_PORT}/json/version`)).body);
        break;
      } catch (error) {
        await sleep(250);
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
        const { requestId, request } = message.params;
        const url = request.url || '';
        if (url.includes(WEBHOOK) || url.includes('script.googleusercontent.com') || url.includes('/exec')) {
          send('Fetch.fulfillRequest', {
            requestId,
            responseCode: 200,
            responseHeaders: [
              { name: 'Content-Type', value: 'application/json' },
              { name: 'Access-Control-Allow-Origin', value: '*' }
            ],
            body: Buffer.from('{"ok":true}').toString('base64')
          }, message.sessionId).catch((error) => console.error(error));
          return;
        }
        send('Fetch.continueRequest', { requestId }, message.sessionId).catch((error) => console.error(error));
      }
    });

    const created = await send('Target.createTarget', { url: 'about:blank' });
    const attached = await send('Target.attachToTarget', { targetId: created.targetId, flatten: true });
    sessionId = attached.sessionId;
    await send('Page.enable', {}, sessionId);
    await send('Runtime.enable', {}, sessionId);
    await send('Fetch.enable', { patterns: [{ urlPattern: '*script.google*', requestStage: 'Request' }] }, sessionId);

    const paths = [
      { id: 'iframe-desktop', query: '?desktop=1', width: 1440, height: 900, minFrame: 1000 },
      { id: 'iframe-320', query: '?layout=320', width: 320, height: 800, minFrame: 320, maxFrame: 320 }
    ];

    for (const launch of paths) {
      await openHarness(launch.query, launch.width, launch.height);
      const frameWidth = await evaluate(`document.getElementById('tool').clientWidth`);
      assert.ok(frameWidth >= launch.minFrame, launch.id + ' iframe width ' + frameWidth);
      if (launch.maxFrame) assert.equal(frameWidth, launch.maxFrame, launch.id + ' iframe width');
      await reachResults();
      assert.equal(await frameEval(`win.getComputedStyle(doc.getElementById('print-root')).display`), 'none', 'print layout must stay off screen');
      assert.equal(await frameEval(`doc.body.classList.contains('is-results')`), true);

      const allFile = await printIframe(launch.id + '-all.pdf');
      const allPages = assertProposal(allFile, 3, launch.id + ' print-all');
      assert.match(allPages[0], /Premium/);
      assert.match(allPages[0], /EE Cost PPP/);
      assert.doesNotMatch(allPages[0], /Important information/);
      if (launch.id === 'iframe-desktop') renderPage(allFile, 3, 'print-all-last-page.png');

      for (let count = 1; count <= PLAN_IDS.length; count += 1) {
        const id = PLAN_IDS[count - 1];
        const saved = await frameEval(`(() => {
          const btn = doc.querySelector('[data-plan-id="${id}"] .save-toggle');
          if (!btn) return 'missing';
          btn.click();
          return doc.getElementById('my-plans-btn').textContent;
        })()`);
        assert.match(saved, new RegExp('My Plans \\(' + count + '\\)'), launch.id + ' save ' + id + ' -> ' + saved);
        const file = await printIframe(launch.id + '-saved-' + count + '.pdf');
        const pages = assertProposal(file, 1, launch.id + ' saved-' + count);
        assert.match(pages[0], /Inpatient Hospital/);
        assert.match(pages[0], /Outpatient Surgery/);
        assert.match(pages[0], /EE Cost PPP/);
        assert.match(pages[0], /Saved plans only/);
        if (launch.id === 'iframe-desktop' && count === 4) renderPage(file, 1, '4-saved-plans-page-1.png');
      }
    }

    console.log(JSON.stringify(counts, null, 2));
  } finally {
    if (ws) ws.close();
    chrome.kill('SIGKILL');
    server.kill('SIGKILL');
  }
});
