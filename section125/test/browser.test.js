const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('http');
const fs = require('fs');
const path = require('path');
const { chromium } = require(path.join(__dirname, '..', '..', 'section128', 'node_modules', 'playwright'));

const root = path.join(__dirname, '..');
const artifactDir = process.env.S125_ARTIFACT_DIR || '/opt/cursor/artifacts/section125';

function startStatic(port) {
  const types = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8'
  };
  const server = http.createServer(function (req, res) {
    const url = new URL(req.url, 'http://127.0.0.1');
    let file = path.resolve(root, decodeURIComponent(url.pathname).replace(/^\/+/, '') || 'index.html');
    if (file !== root && !file.startsWith(root + path.sep)) {
      res.writeHead(403);
      res.end();
      return;
    }
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

async function setField(page, id, value) {
  await page.locator('#' + id).evaluate(function (el, next) {
    el.value = next;
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  }, value);
}

test('the wizard builds a premium-only plan in the browser and does not post', async function () {
  fs.mkdirSync(artifactDir, { recursive: true });
  const server = await startStatic(8815);
  const browser = await chromium.launch({
    channel: 'chrome',
    headless: true,
    args: ['--no-sandbox', '--disable-dev-shm-usage']
  });
  const blocked = [];
  try {
    const page = await browser.newPage({ viewport: { width: 1100, height: 900 } });
    page.on('request', function (request) {
      const url = request.url();
      if (/script\.google\.com|_functions\/section125pdf|AKfycb/i.test(url)) blocked.push(url);
    });
    await page.goto('http://127.0.0.1:8815/index.html', { waitUntil: 'domcontentloaded' });
    await page.locator('#employer_name').waitFor();
    await page.waitForTimeout(400);
    const loaded = await page.evaluate(function () {
      var el = document.activeElement;
      var focused = !el || el === document.body || el === document.documentElement ? '' : (el.id || el.tagName);
      return {
        scrollY: window.scrollY,
        focused: focused,
        text: document.body.innerText
      };
    });
    assert.equal(loaded.scrollY, 0);
    assert.equal(loaded.focused, '');
    assert.doesNotMatch(loaded.text, /compliant, defensible/i);
    assert.equal(await page.locator('[name="owners_participating"], [name="owners"]').count(), 0);
    await page.screenshot({ path: path.join(artifactDir, 'wizard-step1.png') });

    await setField(page, 'employer_name', 'Northwind Benefits Inc');
    await setField(page, 'employer_ein', '123456789');
    await setField(page, 'street', '100 King Street');
    await setField(page, 'city', 'Tampa');
    await setField(page, 'state', 'FL');
    await setField(page, 'zip', '33602');
    await setField(page, 'phone', '8135550199');
    await page.locator('input[name="entity_type"][value="c-corp"]').check();
    await page.locator('#btnNext').click();
    await page.locator('#stepTitle', { hasText: 'Plan year' }).waitFor();

    await setField(page, 'effective_date', '2027-01-01');
    await setField(page, 'plan_year_type', 'calendar');
    await page.locator('input[name="prior_plan"][value="no"]').check();
    await page.locator('input[name="oe_window_days"][value="30"]').check();
    await page.locator('input[name="new_hire_window"][value="30"]').check();
    await page.locator('#btnNext').click();
    await page.locator('#stepTitle', { hasText: 'Eligibility' }).waitFor();

    await setField(page, 'employee_count', '40');
    await page.locator('input[name="funding_type"][value="insured"]').check();
    await setField(page, 'waiting_period', 'none');
    await page.locator('input[name="multi_state"][value="no"]').check();
    await page.locator('#btnNext').click();
    await page.locator('#stepTitle', { hasText: 'Benefits' }).waitFor();

    await page.locator('input[name="benefits"][value="medical"]').check();
    await page.locator('input[name="benefits"][value="dental"]').check();
    await page.locator('input[name="benefits"][value="vision"]').check();
    await page.locator('#btnNext').click();
    await page.locator('#stepTitle', { hasText: 'Check and create' }).waitFor();
    await setField(page, 'signer_name', 'Ada Lopez');
    await setField(page, 'signer_title', 'President');
    await setField(page, 'signer_email', 'ada@northwind.example');
    const review = await page.locator('#reviewSummary').innerText();
    assert.match(review, /Northwind Benefits Inc/);
    assert.match(review, /Medical, Dental, Vision/);
    await page.locator('#openTerms').click();
    await page.locator('#termsDialog').waitFor();
    const terms = await page.locator('#termsDialogBody').innerText();
    assert.match(terms, /not legal advice/);
    assert.match(terms, /s125-terms-2026-10-09/);
    await page.locator('#closeTerms').click();
    await page.locator('#terms_ack').check();
    await page.locator('#btnNext').click();
    await page.locator('#stepTitle', { hasText: 'Your documents' }).waitFor();
    await page.locator('#downloadList button', { hasText: 'Section_125_Plan_v1.0.pdf' }).waitFor();
    const status = await page.locator('#emailStatus').innerText();
    assert.match(status, /ready to download/i);
    assert.match(status, /not turned on/i);
    const names = await page.locator('#downloadList button').allTextContents();
    assert.ok(names.some(function (name) { return /Section_125_Plan_v1\.0\.docx/.test(name); }));
    assert.ok(names.some(function (name) { return /Implementation_Guide_v1\.0\.docx/.test(name); }));
    assert.ok(names.some(function (name) { return /Section_125_Plan_v1\.0\.pdf/.test(name); }));
    assert.ok(names.some(function (name) { return /Implementation_Guide_v1\.0\.pdf/.test(name); }));
    assert.equal(names.length, 4);
    assert.deepEqual(blocked, []);
    await page.screenshot({ path: path.join(artifactDir, 'wizard-download.png') });

    const mobile = await browser.newPage({ viewport: { width: 390, height: 780 } });
    await mobile.goto('http://127.0.0.1:8815/index.html', { waitUntil: 'domcontentloaded' });
    await mobile.locator('#employer_name').waitFor();
    await mobile.waitForTimeout(200);
    const mobileTop = await mobile.evaluate(function () { return window.scrollY; });
    assert.equal(mobileTop, 0);
    await mobile.screenshot({ path: path.join(artifactDir, 'wizard-mobile.png') });
    await mobile.close();
    await page.close();
  } finally {
    await browser.close();
    server.close();
  }
});
