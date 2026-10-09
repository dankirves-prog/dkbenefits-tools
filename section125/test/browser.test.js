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
    assert.equal(await page.locator('#state option[value="FL"]').textContent(), 'Florida');
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
    await page.locator('input[name="funding_type"][value="insured"]').check();
    await page.locator('input[name="multi_state"][value="no"]').check();
    await page.locator('#btnNext').click();
    await page.locator('#stepTitle', { hasText: 'Plan year' }).waitFor();

    await setField(page, 'effective_date', '01/01/2027');
    await setField(page, 'plan_year_type', 'calendar');
    await page.locator('input[name="prior_plan"][value="no"]').check();
    await setField(page, 'oe_window_days', '30');
    await setField(page, 'new_hire_window', '30');
    await page.locator('#btnNext').click();
    await page.locator('#stepTitle', { hasText: 'Eligibility' }).waitFor();

    await page.locator('input[name="entity_type"][value="c-corp"]').check();
    await setField(page, 'employee_count', '40');
    await setField(page, 'waiting_period', 'none');
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
    const termsFocus = await page.evaluate(function () {
      var el = document.activeElement;
      return el ? el.tagName + ' ' + (el.getAttribute('tabindex') || '') : '';
    });
    assert.equal(termsFocus, 'H2 -1');
    const terms = await page.locator('#termsDialogBody').innerText();
    assert.match(terms, /not legal advice/);
    assert.match(terms, /s125-terms-2026-10-10/);
    assert.match(terms, /The tool and the documents are free/);
    await page.locator('#closeTerms').click();
    await page.locator('#terms_ack').check();
    await page.locator('#btnNext').click();
    await page.locator('#stepTitle', { hasText: 'Your documents' }).waitFor();
    await page.locator('#downloadList button', { hasText: 'Plan document (PDF)' }).waitFor();
    const status = await page.locator('#emailStatus').innerText();
    assert.match(status, /ready to download/i);
    assert.match(status, /not turned on/i);
    const names = await page.locator('#downloadList button').allTextContents();
    assert.ok(names.some(function (name) { return /Section_125_Plan_v1\.0\.docx/.test(name); }));
    assert.ok(names.some(function (name) { return /Implementation_Checklist_v1\.0\.docx/.test(name); }));
    assert.ok(names.some(function (name) { return /Section_125_Plan_v1\.0\.pdf/.test(name); }));
    assert.ok(names.some(function (name) { return /Implementation_Checklist_v1\.0\.pdf/.test(name); }));
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

test('typed fields format themselves and numeric gates keep whole numbers in range', async function () {
  const server = await startStatic(8816);
  const browser = await chromium.launch({
    channel: 'chrome',
    headless: true,
    args: ['--no-sandbox', '--disable-dev-shm-usage']
  });
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    await page.goto('http://127.0.0.1:8816/index.html', { waitUntil: 'domcontentloaded' });
    await page.locator('#employer_name').waitFor();
    const placeholders = await page.locator('input, textarea').evaluateAll(function (nodes) {
      return nodes.map(function (node) { return node.getAttribute('placeholder') || ''; });
    });
    placeholders.forEach(function (value) { assert.equal(value, ''); });
    assert.equal(await page.locator('#hint_employer_ein').innerText(), 'e.g. 12-3456789');
    assert.equal(await page.locator('#hint_phone').innerText(), 'e.g. 407-476-5076');
    assert.equal(await page.locator('#hint_signer_email').innerText(), 'e.g. name@company.com');
    await setField(page, 'employer_ein', '1234567890');
    assert.equal(await page.locator('#employer_ein').inputValue(), '12-3456789');
    await setField(page, 'phone', '1 (813) 555-0199 x123');
    assert.equal(await page.locator('#phone').inputValue(), '813-555-0199 ext. 123');
    await setField(page, 'zip', '336021234');
    assert.equal(await page.locator('#zip').inputValue(), '33602-1234');
    await setField(page, 'plan_number', '1000');
    assert.equal(await page.locator('#plan_number').inputValue(), '501');
    assert.match(await page.locator('#err_plan_number').innerText(), /501 to 999/);
    await setField(page, 'plan_number', '500');
    assert.equal(await page.locator('#plan_number').inputValue(), '501');
    await page.locator('#plan_number').focus();
    await page.keyboard.press('End');
    await page.keyboard.type('a');
    assert.equal(await page.locator('#plan_number').inputValue(), '501');
    assert.match(await page.locator('#err_plan_number').innerText(), /whole number/);
    await setField(page, 'employer_name', 'Northwind Benefits Inc');
    await setField(page, 'street', '100 King Street');
    await setField(page, 'city', 'Tampa');
    await setField(page, 'state', 'FL');
    await page.locator('input[name="funding_type"][value="insured"]').check();
    await page.locator('input[name="multi_state"][value="no"]').check();
    await page.locator('#btnNext').click();
    await page.locator('#stepTitle', { hasText: 'Plan year' }).waitFor();
    await setField(page, 'effective_date', '01012027');
    assert.equal(await page.locator('#effective_date').inputValue(), '01/01/2027');
    await page.locator('#effective_date').blur();
    assert.equal(await page.locator('#effective_date').inputValue(), '01/01/2027');
    await page.locator('input[name="prior_plan"][value="yes"]').check();
    await setField(page, 'prior_adoption', '1/2020');
    await page.locator('#prior_adoption').blur();
    assert.equal(await page.locator('#prior_adoption').inputValue(), '01/2020');
    await setField(page, 'oe_window_days', '91');
    assert.equal(await page.locator('#oe_window_days').inputValue(), '');
    assert.match(await page.locator('#err_oe_window_days').innerText(), /1 to 90/);
    await setField(page, 'oe_window_days', '12.5');
    assert.equal(await page.locator('#oe_window_days').inputValue(), '12');
    assert.match(await page.locator('#err_oe_window_days').innerText(), /whole number/);
    await setField(page, 'new_hire_window', '60');
    assert.equal(await page.locator('#new_hire_window').inputValue(), '');
    assert.match(await page.locator('#err_new_hire_window').innerText(), /1 to 30/);
    await setField(page, 'new_hire_window', '30');
    assert.equal(await page.locator('#err_new_hire_window').innerText(), '');
    await setField(page, 'plan_year_type', 'calendar');
    await setField(page, 'oe_window_days', '30');
    await page.locator('#btnNext').click();
    await page.locator('#stepTitle', { hasText: 'Eligibility' }).waitFor();
    await setField(page, 'employee_count', '100001');
    assert.equal(await page.locator('#employee_count').inputValue(), '');
    assert.match(await page.locator('#err_employee_count').innerText(), /1 to 100,000/);
    await setField(page, 'employee_count', '1,000');
    assert.equal(await page.locator('#employee_count').inputValue(), '1000');
    await setField(page, 'full_time_hours', '41');
    assert.equal(await page.locator('#full_time_hours').inputValue(), '30');
    assert.match(await page.locator('#err_full_time_hours').innerText(), /1 to 40/);
    await setField(page, 'full_time_hours', '12.5');
    assert.equal(await page.locator('#full_time_hours').inputValue(), '12');
    assert.match(await page.locator('#err_full_time_hours').innerText(), /whole number/);
    await page.screenshot({ path: path.join(artifactDir, 'input-polish-1280.png'), fullPage: true });
    await page.close();
  } finally {
    await browser.close();
    server.close();
  }
});
