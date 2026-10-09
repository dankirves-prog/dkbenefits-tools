const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('http');
const fs = require('fs');
const path = require('path');
const { chromium, webkit } = require(path.join(__dirname, '..', '..', 'section128', 'node_modules', 'playwright'));

const repoRoot = path.join(__dirname, '..', '..');
const harnessRoot = __dirname;
const toolOrigin = 'http://127.0.0.1:8802';
const parentOrigin = 'http://127.0.0.1:8801';
const artifactDir = process.env.S125_ARTIFACT_DIR || '/opt/cursor/artifacts/section125';
const sizes = [
  { name: 'desktop', width: 980, height: 800 },
  { name: 'mobile', width: 390, height: 780 }
];

function startStatic(root, port) {
  const base = path.resolve(root);
  const types = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8'
  };
  const server = http.createServer(function (req, res) {
    const url = new URL(req.url, 'http://127.0.0.1');
    const rel = decodeURIComponent(url.pathname).replace(/^\/+/, '');
    let file = path.resolve(base, rel || 'index.html');
    if (file !== base && !file.startsWith(base + path.sep)) {
      res.writeHead(403);
      res.end();
      return;
    }
    try {
      if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
    } catch (err) {}
    fs.readFile(file, function (err, data) {
      if (err) {
        res.writeHead(404);
        res.end('not found');
        return;
      }
      res.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream' });
      res.end(data);
    });
  });
  return new Promise(function (resolve) {
    server.listen(port, '127.0.0.1', function () { resolve(server); });
  });
}

async function elementInParent(page, frame, selector) {
  const inner = await frame.locator(selector).evaluate(function (el) {
    const rect = el.getBoundingClientRect();
    return { top: rect.top, bottom: rect.bottom, height: rect.height };
  });
  const frameTop = await page.locator('#tool').evaluate(function (el) {
    return el.getBoundingClientRect().top;
  });
  return {
    top: frameTop + inner.top,
    bottom: frameTop + inner.bottom,
    height: inner.height
  };
}

async function fitIframe(page, frame) {
  let height = 0;
  for (let i = 0; i < 4; i++) {
    height = await frame.evaluate(function () {
      return Math.ceil(document.body.getBoundingClientRect().height);
    });
    await page.locator('#tool').evaluate(function (el, px) { el.style.height = px + 'px'; }, height);
  }
  const scrollable = await frame.evaluate(function () {
    return document.documentElement.scrollHeight - document.documentElement.clientHeight;
  });
  if (scrollable > 1) {
    height += scrollable + 2;
    await page.locator('#tool').evaluate(function (el, px) { el.style.height = px + 'px'; }, height);
  }
  return height;
}

async function waitForScrollMessage(page, step) {
  await page.waitForFunction(function (expected) {
    var list = window.__s125Messages || [];
    var last = list[list.length - 1];
    return !!(last && last.step === expected);
  }, step);
}

async function toolFrame(page) {
  await page.locator('#tool').waitFor();
  let frame = null;
  for (let i = 0; i < 50; i++) {
    const handle = await page.locator('#tool').elementHandle();
    frame = handle ? await handle.contentFrame() : null;
    if (frame && frame.url().indexOf('/section125/') !== -1) break;
    frame = null;
    await page.waitForTimeout(100);
  }
  if (!frame) throw new Error('tool frame missing');
  await frame.locator('#employer_name').waitFor({ timeout: 15000 });
  return frame;
}

async function placeInView(page, frame, selector, viewportHeight) {
  const box = await elementInParent(page, frame, selector);
  const target = Math.max(0, box.top - 120);
  await page.evaluate(function (y) { window.scrollTo(0, y); }, target);
  await page.waitForTimeout(50);
  const again = await elementInParent(page, frame, selector);
  if (again.top > viewportHeight || again.bottom < 0) {
    await page.evaluate(function (y) { window.scrollTo(0, y); }, Math.max(0, again.top - 80));
  }
}

function messageOk(messages, step) {
  const last = messages[messages.length - 1];
  if (!last) return false;
  const keys = last.keys.slice().sort().join(',');
  return last.type === 's125-scroll' &&
    last.step === step &&
    Number.isFinite(last.top) &&
    keys === 'step,top,type';
}

async function fillCompany(frame) {
  const fields = {
    employer_name: 'Northwind Benefits Inc',
    employer_ein: '12-3456789',
    street: '100 King Street',
    city: 'Tampa',
    state: 'FL',
    zip: '33602',
    phone: '8135550199'
  };
  const names = Object.keys(fields);
  for (let i = 0; i < names.length; i++) {
    await frame.locator('#' + names[i]).evaluate(function (el, next) {
      el.value = next;
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
    }, fields[names[i]]);
  }
  await frame.locator('input[name="entity_type"][value="c-corp"]').check();
}

async function runInitialLoad(browser, engine, size) {
  const page = await browser.newPage({ viewport: { width: size.width, height: size.height } });
  const src = toolOrigin + '/section125/index.html';
  await page.goto(parentOrigin + '/iframe-harness.html?src=' + encodeURIComponent(src), { waitUntil: 'domcontentloaded' });
  const frame = await toolFrame(page);
  await page.waitForTimeout(400);
  const state = await page.evaluate(function () {
    var messages = window.__s125Messages || [];
    var frameEl = document.getElementById('tool');
    var frameTop = frameEl.getBoundingClientRect().top + window.scrollY;
    if (messages.length) {
      var top = messages[messages.length - 1].top;
      window.scrollTo(0, Math.max(0, frameTop + top - 90));
    }
    return { scrollY: window.scrollY, messages: messages.length };
  });
  const focused = await frame.evaluate(function () {
    var el = document.activeElement;
    if (!el || el === document.body || el === document.documentElement) return '';
    return el.id || el.tagName;
  });
  await page.close();
  return {
    engine: engine,
    size: size.name,
    initialLoad: true,
    scrollY: state.scrollY,
    messages: state.messages,
    focused: focused
  };
}

async function runEmbedded(browser, engine, size) {
  const page = await browser.newPage({ viewport: { width: size.width, height: size.height } });
  const src = toolOrigin + '/section125/index.html';
  await page.goto(parentOrigin + '/iframe-harness.html?src=' + encodeURIComponent(src), { waitUntil: 'domcontentloaded' });
  const frame = await toolFrame(page);
  const iframeHeight = await fitIframe(page, frame);
  const headerBottom = await page.locator('#siteHeader').evaluate(function (el) {
    return el.getBoundingClientRect().bottom;
  });
  await page.evaluate(function () { window.__s125Messages = []; });
  await placeInView(page, frame, '#btnNext', size.height);
  await frame.locator('#btnNext').click();
  await waitForScrollMessage(page, 1);
  const errorBox = await elementInParent(page, frame, '#employer_name');
  const errorMessages = await page.evaluate(function () { return window.__s125Messages; });
  const errorText = await frame.locator('#err_employer_name').textContent();
  const focused = await frame.evaluate(function () { return document.activeElement && document.activeElement.id; });
  const errorVisible = errorBox.top < size.height - 8 && errorBox.bottom > headerBottom + 4;

  await fillCompany(frame);
  await page.evaluate(function () { window.__s125Messages = []; });
  await placeInView(page, frame, '#btnNext', size.height);
  const beforeNext = await elementInParent(page, frame, '#stepTitle');
  await frame.locator('#btnNext').click();
  await frame.locator('#stepTitle', { hasText: 'Plan year' }).waitFor();
  await waitForScrollMessage(page, 2);
  const after = await elementInParent(page, frame, '#stepTitle');
  const stepMessages = await page.evaluate(function () { return window.__s125Messages; });
  const margin = await frame.locator('#stepTitle').evaluate(function (el) {
    return getComputedStyle(el).scrollMarginTop;
  });
  const headingVisible = after.top >= headerBottom - 4 && after.top <= 150;
  if (engine === 'chromium' && size.name === 'desktop') {
    fs.mkdirSync(artifactDir, { recursive: true });
    await page.screenshot({ path: path.join(artifactDir, 'iframe-step2.png') });
  }
  await page.close();
  return {
    engine: engine,
    size: size.name,
    iframeHeight: iframeHeight,
    scrollMarginTop: margin,
    beforeNextHeadingTop: Math.round(beforeNext.top),
    error: {
      visible: errorVisible,
      text: errorText,
      focused: focused,
      messageOk: messageOk(errorMessages, 1)
    },
    next: {
      top: Math.round(after.top),
      visible: headingVisible,
      messageOk: messageOk(stepMessages, 2)
    }
  };
}

test('the embed stays at the top on load and scrolls only after a step or an error', async function () {
  fs.mkdirSync(artifactDir, { recursive: true });
  const toolServer = await startStatic(repoRoot, 8802);
  const parentServer = await startStatic(harnessRoot, 8801);
  const results = [];
  let chrome = null;
  let webkitBrowser = null;
  let webkitError = '';
  try {
    chrome = await chromium.launch({
      channel: 'chrome',
      headless: true,
      args: ['--no-sandbox', '--disable-dev-shm-usage']
    });
    for (let i = 0; i < sizes.length; i++) results.push(await runInitialLoad(chrome, 'chromium', sizes[i]));
    for (let i = 0; i < sizes.length; i++) results.push(await runEmbedded(chrome, 'chromium', sizes[i]));
    try {
      webkitBrowser = await webkit.launch({ headless: true });
    } catch (err) {
      webkitError = err && err.message ? err.message : String(err);
    }
    if (webkitBrowser) {
      for (let i = 0; i < sizes.length; i++) results.push(await runInitialLoad(webkitBrowser, 'webkit', sizes[i]));
      for (let i = 0; i < sizes.length; i++) results.push(await runEmbedded(webkitBrowser, 'webkit', sizes[i]));
    }
    console.log(JSON.stringify(results, null, 2));
    results.forEach(function (row) {
      if (!row.initialLoad) return;
      assert.equal(row.messages, 0, JSON.stringify(row));
      assert.equal(row.scrollY, 0, JSON.stringify(row));
      assert.equal(row.focused, '', JSON.stringify(row));
    });
    results.forEach(function (row) {
      if (row.initialLoad || row.engine !== 'chromium') return;
      assert.equal(row.scrollMarginTop, '90px', JSON.stringify(row));
      assert.ok(row.iframeHeight > 800, JSON.stringify(row));
      assert.ok(row.beforeNextHeadingTop < 0, JSON.stringify(row));
      assert.equal(row.next.visible, true, JSON.stringify(row));
      assert.equal(row.next.messageOk, true, JSON.stringify(row));
      assert.equal(row.error.visible, true, JSON.stringify(row));
      assert.equal(row.error.messageOk, true, JSON.stringify(row));
      assert.equal(row.error.focused, 'employer_name', JSON.stringify(row));
      assert.match(row.error.text, /legal name/);
    });
    const webkitRows = results.filter(function (row) { return row.engine === 'webkit' && !row.initialLoad; });
    if (!webkitRows.length) {
      console.log('WebKit unavailable: ' + webkitError);
    } else {
      webkitRows.forEach(function (row) {
        assert.equal(row.next.messageOk, true, JSON.stringify(row));
        assert.equal(row.error.messageOk, true, JSON.stringify(row));
      });
    }
  } finally {
    if (webkitBrowser) await webkitBrowser.close();
    if (chrome) await chrome.close();
    toolServer.close();
    parentServer.close();
  }
});
