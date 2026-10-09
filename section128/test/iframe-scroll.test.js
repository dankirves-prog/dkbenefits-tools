const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('http');
const fs = require('fs');
const path = require('path');
const { chromium, webkit } = require('playwright');

const repoRoot = path.join(__dirname, '..', '..');
const harnessRoot = __dirname;
const toolOrigin = 'http://127.0.0.1:8792';
const parentOrigin = 'http://127.0.0.1:8791';
const artifactDir = process.env.S128_ARTIFACT_DIR || '/opt/cursor/artifacts/section128';
const sizes = [
  { name: 'desktop', width: 980, height: 800 },
  { name: 'mobile', width: 390, height: 780 }
];

function startStatic(root, port) {
  const base = path.resolve(root);
  const types = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.png': 'image/png',
    '.svg': 'image/svg+xml'
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
    var list = window.__s128Messages || [];
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
    if (frame && frame.url().indexOf('/section128/') !== -1) break;
    frame = null;
    await page.waitForTimeout(100);
  }
  if (!frame) {
    const urls = page.frames().map(function (item) { return item.url(); });
    throw new Error('tool frame missing: ' + urls.join(' | '));
  }
  await frame.locator('#employer_name').waitFor({ timeout: 15000 });
  await frame.evaluate(function () {
    if (!document.fonts || !document.fonts.ready) return null;
    return Promise.race([
      document.fonts.ready,
      new Promise(function (resolve) { setTimeout(resolve, 1500); })
    ]);
  });
  return frame;
}

async function placeInView(page, frame, selector, viewportHeight) {
  const place = await elementInParent(page, frame, selector);
  const delta = place.top - (viewportHeight - 90);
  if (Math.abs(delta) > 1) await page.evaluate(function (dy) { window.scrollBy(0, dy); }, delta);
}

async function fillCompany(frame) {
  const fields = {
    employer_name: 'Harbor & Co',
    employer_ein: '12-3456789',
    total_employee_count: '18',
    street: '10 Bay Street',
    city: 'Tampa',
    state: 'FL',
    zip: '33602',
    contact_name: 'Mia Chen',
    contact_title: 'HR Director',
    contact_email: 'mia@harbor.example',
    contact_phone: '813-555-0199'
  };
  const names = Object.keys(fields);
  for (let i = 0; i < names.length; i++) {
    await frame.locator('#' + names[i]).evaluate(function (el, next) {
      el.value = next;
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
    }, fields[names[i]]);
  }
}

function messageOk(messages, step) {
  const last = messages[messages.length - 1];
  if (!last) return false;
  const keys = last.keys.slice().sort().join(',');
  return last.type === 's128-scroll' &&
    last.step === step &&
    Number.isFinite(last.top) &&
    keys === 'step,top,type' &&
    !JSON.stringify(last).includes('Harbor');
}

async function runEmbedded(browser, engine, size) {
  const page = await browser.newPage({ viewport: { width: size.width, height: size.height } });
  const src = toolOrigin + '/section128/';
  await page.goto(parentOrigin + '/iframe-harness.html?src=' + encodeURIComponent(src), { waitUntil: 'domcontentloaded' });
  const frame = await toolFrame(page);
  const iframeHeight = await fitIframe(page, frame);
  const headerBottom = await page.locator('#siteHeader').evaluate(function (el) {
    return el.getBoundingClientRect().bottom;
  });
  await page.evaluate(function () { window.__s128Messages = []; });
  await placeInView(page, frame, '#btnNext', size.height);
  const before = await elementInParent(page, frame, '#stepTitle');
  await frame.locator('#btnNext').click();
  await waitForScrollMessage(page, 1);
  const errorBox = await elementInParent(page, frame, '#employer_name');
  const errorMessages = await page.evaluate(function () { return window.__s128Messages; });
  const errorText = await frame.locator('#err_employer_name').textContent();
  const focused = await frame.evaluate(function () { return document.activeElement && document.activeElement.id; });
  const errorVisible = errorBox.top < size.height - 8 && errorBox.bottom > headerBottom + 4;
  if (engine === 'chromium') {
    await page.screenshot({ path: path.join(artifactDir, 'iframe-error-' + size.width + '.png') });
  }

  await fillCompany(frame);
  await page.evaluate(function () { window.__s128Messages = []; });
  await placeInView(page, frame, '#btnNext', size.height);
  const beforeNext = await elementInParent(page, frame, '#stepTitle');
  await frame.locator('#btnNext').click();
  await frame.locator('#stepTitle', { hasText: 'Benefit design' }).waitFor();
  await waitForScrollMessage(page, 2);
  const after = await elementInParent(page, frame, '#stepTitle');
  const stepMessages = await page.evaluate(function () { return window.__s128Messages; });
  const margin = await frame.locator('#stepTitle').evaluate(function (el) {
    return getComputedStyle(el).scrollMarginTop;
  });
  const headingVisible = after.top >= headerBottom - 4 && after.top <= 150;
  if (engine === 'chromium') {
    await page.screenshot({ path: path.join(artifactDir, 'iframe-next-' + size.width + '.png') });
  }
  await page.close();
  return {
    engine: engine,
    size: size.name,
    width: size.width,
    viewportHeight: size.height,
    iframeHeight: iframeHeight,
    headerBottom: headerBottom,
    scrollMarginTop: margin,
    beforeErrorHeadingTop: Math.round(before.top),
    error: {
      top: Math.round(errorBox.top),
      bottom: Math.round(errorBox.bottom),
      visible: errorVisible,
      text: errorText,
      focused: focused,
      messageOk: messageOk(errorMessages, 1)
    },
    beforeNextHeadingTop: Math.round(beforeNext.top),
    next: {
      top: Math.round(after.top),
      visible: headingVisible,
      messageOk: messageOk(stepMessages, 2)
    }
  };
}

async function runInitialLoad(browser, engine, size) {
  const page = await browser.newPage({ viewport: { width: size.width, height: size.height } });
  const src = toolOrigin + '/section128/';
  await page.goto(parentOrigin + '/iframe-harness.html?src=' + encodeURIComponent(src), { waitUntil: 'domcontentloaded' });
  const frame = await toolFrame(page);
  await page.waitForTimeout(400);
  const state = await page.evaluate(function () {
    var messages = window.__s128Messages || [];
    var frameEl = document.getElementById('tool');
    var frameTop = frameEl.getBoundingClientRect().top + window.scrollY;
    // The Wix page scrolls when it receives s128-scroll. WebKit does not move the
    // parent on scrollIntoView, so apply that parent scroll here before measuring.
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

async function runStandalone(browser) {
  const page = await browser.newPage({ viewport: { width: 980, height: 800 } });
  await page.goto(toolOrigin + '/section128/', { waitUntil: 'domcontentloaded' });
  await page.locator('#employer_name').waitFor();
  await page.evaluate(function () {
    window.__s128Messages = [];
    window.addEventListener('message', function (event) {
      if (event.data && event.data.type === 's128-scroll') window.__s128Messages.push(event.data);
    });
    window.scrollTo(0, 900);
  });
  const fields = {
    employer_name: 'Harbor & Co',
    employer_ein: '12-3456789',
    total_employee_count: '18',
    street: '10 Bay Street',
    city: 'Tampa',
    state: 'FL',
    zip: '33602',
    contact_name: 'Mia Chen',
    contact_title: 'HR Director',
    contact_email: 'mia@harbor.example',
    contact_phone: '813-555-0199'
  };
  const names = Object.keys(fields);
  for (let i = 0; i < names.length; i++) {
    await page.locator('#' + names[i]).evaluate(function (el, next) {
      el.value = next;
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
    }, fields[names[i]]);
  }
  await page.locator('#btnNext').click();
  const state = await page.evaluate(function () {
    return { scrollY: window.scrollY, messages: window.__s128Messages.length, title: document.getElementById('stepTitle').textContent };
  });
  await page.close();
  return state;
}

test('embedded step and error scrolling', async function () {
  fs.mkdirSync(artifactDir, { recursive: true });
  const toolServer = await startStatic(repoRoot, 8792);
  const parentServer = await startStatic(harnessRoot, 8791);
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
    results.push({ engine: 'chromium', size: 'standalone', standalone: await runStandalone(chrome) });
    try {
      webkitBrowser = await webkit.launch({ headless: true });
    } catch (err) {
      webkitError = err && err.message ? err.message : String(err);
      results.push({ engine: 'webkit', available: false, error: webkitError });
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
      if (row.initialLoad || row.engine !== 'chromium' || row.size === 'standalone') return;
      assert.equal(row.scrollMarginTop, '90px', JSON.stringify(row));
      assert.ok(row.iframeHeight > row.viewportHeight, JSON.stringify(row));
      assert.ok(row.beforeNextHeadingTop < 0, JSON.stringify(row));
      assert.equal(row.next.visible, true, JSON.stringify(row));
      assert.equal(row.next.messageOk, true, JSON.stringify(row));
      assert.ok(row.next.top >= 0 && row.next.top <= 150, JSON.stringify(row));
      assert.equal(row.error.visible, true, JSON.stringify(row));
      assert.equal(row.error.messageOk, true, JSON.stringify(row));
      assert.equal(row.error.focused, 'employer_name', JSON.stringify(row));
      assert.match(row.error.text, /legal name/);
    });
    const standalone = results.find(function (row) { return row.size === 'standalone'; });
    assert.match(standalone.standalone.title, /Benefit design/);
    assert.ok(standalone.standalone.scrollY < 5, JSON.stringify(standalone));
    assert.equal(standalone.standalone.messages, 0);
      const webkitRows = results.filter(function (row) { return row.engine === 'webkit' && !row.initialLoad && row.size !== 'standalone'; });
    if (!webkitRows.length || webkitRows[0].available === false) {
      console.log('WebKit unavailable: ' + webkitError);
    } else {
      webkitRows.forEach(function (row) {
        assert.equal(row.next.messageOk, true, JSON.stringify(row));
        assert.equal(row.error.messageOk, true, JSON.stringify(row));
      });
      const propagated = webkitRows.every(function (row) { return row.next.visible && row.error.visible; });
      console.log('WebKit scrollIntoView propagated to the parent: ' + (propagated ? 'yes' : 'no'));
      if (!propagated) console.log('WebKit did not move the parent viewport with scrollIntoView. postMessage still fired.');
    }
  } finally {
    if (webkitBrowser) await webkitBrowser.close();
    if (chrome) await chrome.close();
    toolServer.close();
    parentServer.close();
  }
});
