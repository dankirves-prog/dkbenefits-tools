const test = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const puppeteer = require('puppeteer-core');

const { artifactDir: resolveArtifactDir } = require('./helpers');
const repoRoot = path.join(__dirname, '..', '..');
const chrome = process.env.CHROME_PATH || '/usr/local/bin/google-chrome';
const artifactDir = resolveArtifactDir();
let server;
let browser;

async function waitForServer() {
  for (let i = 0; i < 50; i++) {
    try {
      const res = await fetch('http://127.0.0.1:8765/section128/');
      if (res.ok) return;
    } catch (err) {}
    await new Promise(function (resolve) { setTimeout(resolve, 100); });
  }
  throw new Error('local page did not start');
}

test.before(async function () {
  fs.mkdirSync(artifactDir, { recursive: true });
  server = spawn('python3', ['-m', 'http.server', '8765', '--bind', '127.0.0.1'], {
    cwd: repoRoot,
    stdio: 'ignore'
  });
  await waitForServer();
  browser = await puppeteer.launch({
    executablePath: chrome,
    headless: 'new',
    args: ['--no-sandbox', '--disable-dev-shm-usage']
  });
});

test.after(async function () {
  if (browser) await browser.close();
  if (server) server.kill();
});

async function openPage(width) {
  const page = await browser.newPage();
  await page.setViewport({ width: width, height: 900, deviceScaleFactor: 1 });
  await page.goto('http://127.0.0.1:8765/section128/', { waitUntil: 'domcontentloaded' });
  return page;
}

async function setField(page, id, value) {
  await page.$eval('#' + id, function (el, next) {
    el.value = next;
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  }, value);
}

async function choose(page, name, value) {
  await page.click('input[name="' + name + '"][value="' + value + '"]');
}

async function fillCompany(page) {
  await setField(page, 'employer_name', 'Harbor & Co');
  await setField(page, 'employer_ein', '12-3456789');
  await setField(page, 'total_employee_count', '18');
  await setField(page, 'street', '10 Bay Street');
  await setField(page, 'city', 'Tampa');
  await setField(page, 'state', 'FL');
  await setField(page, 'zip', '33602');
  await setField(page, 'contact_name', 'Mia Chen');
  await setField(page, 'contact_title', 'HR Director');
  await setField(page, 'contact_email', 'mia@harbor.example');
  await setField(page, 'contact_phone', '813-555-0199');
}

async function fillDesign(page, mode) {
  await choose(page, 'funding_mode', mode);
  if (mode !== 'salary_reduction_only') {
    await setField(page, 'employer_annual_grant', '1000');
    await choose(page, 'allow_employee_account', 'no');
  }
  await choose(page, 'annual_cap_mode', 'statutory');
  await choose(page, 'eligibility_class_choice', 'all');
  await setField(page, 'waiting_days', '30');
  await setField(page, 'effective_date', '2027-01-01');
  await setField(page, 'entity_type', 'c_corp');
  await setField(page, 'related_businesses', 'no');
  await setField(page, 'owners_or_family_want_to_participate', 'no');
  await setField(page, 'collectively_bargained_employees', 'no');
  if (mode !== 'employer_only') await setField(page, 'has_existing_125_plan', 'yes');
}

async function fillAdmin(page, mode) {
  await setField(page, 'administrator_name', 'Payroll Desk');
  await setField(page, 'administrator_contact', 'payroll@harbor.example');
  await setField(page, 'signer_name', 'Mia Chen');
  await setField(page, 'signer_title', 'HR Director');
  if (mode !== 'employer_only') {
    await setField(page, 'cafeteria_plan_name', 'Harbor Cafeteria Plan');
    await setField(page, 'cafeteria_amendment_date', '2027-01-01');
    await setField(page, 'election_cutoff_days', '5');
  }
}

test('step 2 Next registers on the first click at 390px', async function () {
  const page = await openPage(390);
  assert.equal(await page.evaluate(function () { return getComputedStyle(document.documentElement).scrollBehavior; }), 'auto');
  assert.match(await page.$eval('#err_effective_date', function (el) { return el.previousElementSibling.textContent; }), /e\.g\. 01\/01\/2027/);
  assert.doesNotMatch(await page.content(), /YYYY-MM-DD/);
  await fillCompany(page);
  await page.click('#btnNext');
  assert.match(await page.$eval('#stepTitle', function (el) { return el.textContent; }), /Benefit design/);
  await page.evaluate(function () {
    document.getElementById('btnNext').scrollIntoView({ block: 'end', behavior: 'auto' });
  });
  await page.click('#btnNext');
  assert.match(await page.$eval('#err_funding_mode', function (el) { return el.textContent; }), /funded/);
  await page.close();
});

test('labels, invalid EIN, and back navigation keep answers', async function () {
  const page = await openPage(1440);
  const label = await page.$eval('label[for="employer_name"]', function (el) { return el.textContent; });
  assert.match(label, /Employer legal name/);
  await page.click('#btnNext');
  const einError = await page.$eval('#err_employer_name', function (el) { return el.textContent; });
  assert.match(einError, /legal name/);
  assert.match(await page.$eval('#stepTitle', function (el) { return el.textContent; }), /Company/);
  await fillCompany(page);
  await setField(page, 'employer_ein', '12');
  await page.click('#btnNext');
  assert.match(await page.$eval('#err_employer_ein', function (el) { return el.textContent; }), /EIN/);
  await setField(page, 'employer_ein', '12-3456789');
  await page.click('#btnNext');
  assert.match(await page.$eval('#stepTitle', function (el) { return el.textContent; }), /Benefit design/);
  assert.equal(await page.$eval('#employer_name', function (el) { return el.value; }), 'Harbor & Co');
  await page.click('#btnBack');
  assert.equal(await page.$eval('#employer_name', function (el) { return el.value; }), 'Harbor & Co');
  assert.match(await page.$eval('#plan_name', function (el) { return el.value; }), /Harbor & Co Trump Account/);
  await page.screenshot({ path: path.join(artifactDir, 'desktop-company.png'), fullPage: true });
  await page.close();
});

test('funding is not preselected and salary fields stay hidden until chosen', async function () {
  const page = await openPage(390);
  await fillCompany(page);
  await page.click('#btnNext');
  const selected = await page.$$eval('input[name="funding_mode"]', function (nodes) {
    return nodes.filter(function (node) { return node.checked; }).length;
  });
  assert.equal(selected, 0);
  await page.click('#btnNext');
  assert.match(await page.$eval('#err_funding_mode', function (el) { return el.textContent; }), /funded/);
  const cafeteriaHidden = await page.$eval('.only-salary', function (el) { return el.classList.contains('hidden'); });
  assert.equal(cafeteriaHidden, true);
  await page.screenshot({ path: path.join(artifactDir, 'phone-design.png'), fullPage: true });
  await page.setViewport({ width: 320, height: 800 });
  const overflow = await page.evaluate(function () {
    return document.documentElement.scrollWidth > document.documentElement.clientWidth + 1;
  });
  assert.equal(overflow, false);
  await page.screenshot({ path: path.join(artifactDir, 'phone-320-design.png'), fullPage: true });
  await page.close();
});

test('submission requires body.ok, blocks a double post, and retries with the same id', async function () {
  const page = await openPage(1440);
  const posts = [];
  await page.setRequestInterception(true);
  page.on('request', function (request) {
    if (request.url().indexOf('s128.test') !== -1) {
      posts.push(JSON.parse(request.postData()));
      const body = posts.length === 1
        ? { ok: false, error: 'mailbox unavailable' }
        : { ok: true, leadEmailed: true, visitorEmailed: true };
      request.respond({
        status: 200,
        contentType: 'application/json',
        headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      return;
    }
    request.continue();
  });
  await fillCompany(page);
  await page.click('#btnNext');
  await fillDesign(page, 'combined');
  await page.click('#btnNext');
  await fillAdmin(page, 'combined');
  await page.click('#btnNext');
  assert.match(await page.$eval('#stepTitle', function (el) { return el.textContent; }), /Check/);
  assert.match(await page.$eval('#reviewSummary', function (el) { return el.textContent; }), /Harbor & Co/);
  assert.match(await page.$eval('#reviewSummary', function (el) { return el.textContent; }), /\$1,500|1,500/);
  await page.click('[data-edit="1"]');
  assert.match(await page.$eval('#stepTitle', function (el) { return el.textContent; }), /Company/);
  await page.click('#btnNext');
  await page.click('#btnNext');
  await page.click('#btnNext');
  await page.click('#btnNext');
  assert.match(await page.$eval('#err_terms_ack', function (el) { return el.textContent; }), /Terms of use/);
  await page.click('#terms_ack');
  await page.screenshot({ path: path.join(artifactDir, 'acknowledgement-1440.png'), fullPage: true });
  await page.screenshot({ path: path.join(artifactDir, 'check-step-1440.png'), fullPage: true });
  await page.evaluate(function () {
    window.S128_CONFIG.endpoint = 'https://s128.test/exec';
    window.__s128Live = true;
    window.__s128SetStartedAt(Date.now() - 10000);
  });
  await page.screenshot({ path: path.join(artifactDir, 'desktop-review.png'), fullPage: true });
  await page.evaluate(function () {
    document.getElementById('btnNext').click();
    document.getElementById('btnNext').click();
  });
  await page.waitForFunction(function () {
    return /could not be emailed/i.test(document.getElementById('emailStatus').textContent);
  });
  const failureText = await page.$eval('#emailStatus', function (el) { return el.textContent; });
  assert.match(failureText, /could not be emailed/i);
  assert.doesNotMatch(failureText, /A copy was emailed/);
  assert.equal(posts.length, 1);
  const firstId = posts[0].submissionId;
  await page.click('#btnRetry');
  await page.waitForFunction(function () {
    return /A copy was emailed to you/.test(document.getElementById('emailStatus').textContent);
  });
  assert.equal(posts.length, 2);
  assert.equal(posts[1].submissionId, firstId);
  assert.ok(posts[0].files.some(function (file) {
    return file.mime === 'application/pdf' && String(file.dataBase64).indexOf('JVBERi') === 0;
  }));
  assert.ok(posts[0].files.some(function (file) { return /wordprocessingml/.test(file.mime); }));
  assert.equal(posts[0].acknowledgement.accepted, true);
  assert.equal(posts[0].acknowledgement.termsVersion, 's128-terms-2026-10-08b');
  assert.ok(posts[0].files.some(function (file) { return /Implementation_Guide/.test(file.name) && /pdf/.test(file.mime); }));
  assert.equal(posts[0].lead.contact_email, 'mia@harbor.example');
  assert.equal(posts[0].lead.contact_phone, '(813) 555-0199');
  assert.equal(posts[0].plan.funding_mode, 'combined');
  assert.equal(posts[0].hp, '');
  await page.screenshot({ path: path.join(artifactDir, 'desktop-confirmation.png'), fullPage: true });
  await page.screenshot({ path: path.join(artifactDir, 'confirmation-1440.png'), fullPage: true });
  await page.setViewport({ width: 390, height: 900 });
  await page.screenshot({ path: path.join(artifactDir, 'confirmation-390.png'), fullPage: true });
  const quoteHits = posts.filter(function (body) { return JSON.stringify(body).indexOf('AKfycby4-') !== -1; });
  assert.equal(quoteHits.length, 0);
  await page.close();
});

test('without an endpoint the page does not claim the draft was emailed', async function () {
  const page = await openPage(390);
  const posts = [];
  page.on('request', function (request) {
    if (request.method() === 'POST') posts.push(request.url());
  });
  const outline = await page.$eval('#stepTitle', function (el) { return getComputedStyle(el).outlineStyle; });
  assert.equal(outline, 'none');
  await page.$eval('#employer_ein', function (el) { el.value = '00'; });
  await page.click('#btnNext');
  assert.match(await page.$eval('#err_employer_ein', function (el) { return el.textContent; }), /EIN/);
  await page.$eval('#employer_ein', function (el) {
    el.value = '12-3456789';
    el.dispatchEvent(new Event('input', { bubbles: true }));
  });
  assert.equal(await page.$eval('#err_employer_ein', function (el) { return el.textContent; }), '');
  await fillCompany(page);
  await page.click('#btnNext');
  await fillDesign(page, 'employer_only');
  await page.click('#btnNext');
  await fillAdmin(page, 'employer_only');
  await page.click('#btnNext');
  await page.click('#terms_ack');
  await page.screenshot({ path: path.join(artifactDir, 'acknowledgement-390.png'), fullPage: true });
  await page.screenshot({ path: path.join(artifactDir, 'check-step-390.png'), fullPage: true });
  await page.evaluate(function () { window.__s128SetStartedAt(Date.now() - 10000); });
  await page.click('#btnNext');
  await page.waitForFunction(function () {
    return /ready to download/i.test(document.getElementById('emailStatus').textContent);
  });
  const text = await page.$eval('#emailStatus', function (el) { return el.textContent; });
  const statusClass = await page.$eval('#emailStatus', function (el) { return el.className; });
  assert.match(text, /ready to download/i);
  assert.match(statusClass, /neutral/);
  assert.doesNotMatch(statusClass, /failed|unsent/);
  assert.doesNotMatch(text, /could not be emailed|Retry email|not connected/i);
  assert.equal(await page.$eval('#btnRetry', function (el) { return el.classList.contains('hidden'); }), true);
  assert.equal(posts.length, 0);
  assert.match(await page.$eval('#employeeFormsNote', function (el) { return el.textContent; }), /About employee forms/);
  assert.doesNotMatch(await page.$eval('#employeeFormsNote', function (el) { return el.textContent; }), /prepared separately/);
  await page.screenshot({ path: path.join(artifactDir, 'phone-confirmation.png'), fullPage: true });
  await page.reload();
  assert.equal(await page.$eval('#savedBanner', function (el) { return el.classList.contains('hidden'); }), true);
  await page.close();
});

test('tooltips open from the keyboard and from a tap, and close on Escape or an outside tap', async function () {
  const page = await openPage(1440);
  const coverage = await page.evaluate(function () {
    const ids = Object.keys(window.S128Tips.TEXT);
    const mounted = Array.from(document.querySelectorAll('.tip-btn')).map(function (el) { return el.dataset.tipId; });
    return {
      missing: ids.filter(function (id) { return mounted.indexOf(id) === -1; }),
      slots: document.querySelectorAll('.tip-slot').length,
      count: mounted.length
    };
  });
  assert.deepEqual(coverage.missing, []);
  assert.equal(coverage.slots, 0);
  assert.ok(coverage.count >= 40);
  await page.focus('button[data-tip-id="employer_name"]');
  const focused = await page.evaluate(function () {
    const button = document.querySelector('button[data-tip-id="employer_name"]');
    const panel = document.getElementById(button.getAttribute('aria-describedby'));
    const rect = panel.getBoundingClientRect();
    return {
      expanded: button.getAttribute('aria-expanded'),
      role: panel.getAttribute('role'),
      hidden: panel.hidden,
      text: panel.textContent,
      left: rect.left,
      right: rect.right,
      width: rect.width
    };
  });
  assert.equal(focused.expanded, 'true');
  assert.equal(focused.role, 'tooltip');
  assert.equal(focused.hidden, false);
  assert.match(focused.text, /separate written plan/);
  assert.ok(focused.left >= 0);
  assert.ok(focused.right <= 1440);
  assert.ok(focused.width <= 280);
  await page.keyboard.press('Escape');
  assert.equal(await page.$eval('button[data-tip-id="employer_name"]', function (el) { return el.getAttribute('aria-expanded'); }), 'false');
  await page.click('button[data-tip-id="employer_name"]');
  assert.equal(await page.$eval('#employer_name', function (el) { return el.value; }), '');
  assert.equal(await page.$eval('button[data-tip-id="employer_name"]', function (el) { return el.getAttribute('aria-expanded'); }), 'true');
  await page.screenshot({ path: path.join(artifactDir, 'tooltip-open-1440.png'), fullPage: false });
  await page.click('h1');
  assert.equal(await page.$eval('button[data-tip-id="employer_name"]', function (el) { return el.getAttribute('aria-expanded'); }), 'false');
  await page.setViewport({ width: 390, height: 800 });
  await page.click('button[data-tip-id="employer_name"]');
  const phone = await page.evaluate(function () {
    const button = document.querySelector('button[data-tip-id="employer_name"]');
    const panel = document.getElementById(button.getAttribute('aria-describedby'));
    const rect = panel.getBoundingClientRect();
    return {
      expanded: button.getAttribute('aria-expanded'),
      left: rect.left,
      right: rect.right,
      width: rect.width,
      overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1
    };
  });
  assert.equal(phone.expanded, 'true');
  assert.equal(phone.overflow, false);
  assert.ok(phone.left >= 0);
  assert.ok(phone.right <= 390);
  assert.ok(phone.width <= 374);
  await page.screenshot({ path: path.join(artifactDir, 'tooltip-open-390.png'), fullPage: false });
  await page.setViewport({ width: 320, height: 700 });
  await page.click('button[data-tip-id="contact_phone"]');
  const narrow = await page.evaluate(function () {
    const button = document.querySelector('button[data-tip-id="contact_phone"]');
    const panel = document.getElementById(button.getAttribute('aria-describedby'));
    const rect = panel.getBoundingClientRect();
    return {
      left: rect.left,
      right: rect.right,
      overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1
    };
  });
  assert.ok(narrow.left >= 0);
  assert.ok(narrow.right <= 320);
  assert.equal(narrow.overflow, false);
  await page.keyboard.press('Escape');
  assert.equal(await page.$eval('button[data-tip-id="contact_phone"]', function (el) { return el.getAttribute('aria-expanded'); }), 'false');
  await page.close();
});

test('EIN and phone format while typing, and the v0.5 screens show the default, tooltip, wait, and forms note', async function () {
  const page = await openPage(1440);
  await page.focus('#employer_ein');
  await page.keyboard.type('123456789');
  assert.equal(await page.$eval('#employer_ein', function (el) { return el.value; }), '12-3456789');
  await page.keyboard.press('Backspace');
  assert.equal(await page.$eval('#employer_ein', function (el) { return el.value; }), '12-345678');
  await page.$eval('#employer_ein', function (el) { el.setSelectionRange(3, 3); });
  await page.keyboard.press('Backspace');
  assert.equal(await page.$eval('#employer_ein', function (el) { return el.value; }), '13-45678');
  await page.$eval('#employer_ein', function (el) {
    el.value = '98-76543210';
    el.setSelectionRange(el.value.length, el.value.length);
    el.dispatchEvent(new Event('input', { bubbles: true }));
  });
  assert.equal(await page.$eval('#employer_ein', function (el) { return el.value; }), '98-7654321');
  await page.focus('#contact_phone');
  await page.keyboard.type('4074765076123');
  assert.equal(await page.$eval('#contact_phone', function (el) { return el.value; }), '(407) 476-5076 ext. 123');
  await page.keyboard.type('9999');
  assert.equal(await page.$eval('#contact_phone', function (el) { return el.value; }), '(407) 476-5076 ext. 123999');
  await page.keyboard.press('Backspace');
  assert.equal(await page.$eval('#contact_phone', function (el) { return el.value; }), '(407) 476-5076 ext. 12399');
  await setField(page, 'employer_ein', '123456789');
  await setField(page, 'contact_phone', '4074765076123');
  assert.equal(await page.$eval('#employer_ein', function (el) { return el.value; }), '12-3456789');
  assert.equal(await page.$eval('#contact_phone', function (el) { return el.value; }), '(407) 476-5076 ext. 123');
  await page.screenshot({ path: path.join(artifactDir, 'step1-formatted-1440.png'), fullPage: true });
  await page.setViewport({ width: 390, height: 900 });
  await page.screenshot({ path: path.join(artifactDir, 'step1-formatted-390.png'), fullPage: true });
  await page.setViewport({ width: 1440, height: 900 });
  await fillCompany(page);
  await page.click('#btnNext');
  const fundingSelected = await page.$$eval('input[name="funding_mode"]', function (nodes) {
    return nodes.filter(function (node) { return node.checked; }).length;
  });
  assert.equal(fundingSelected, 0);
  assert.equal(await page.$eval('input[name="allow_employee_account"][value="no"]', function (el) { return el.checked; }), true);
  await choose(page, 'funding_mode', 'combined');
  const grantLabel = await page.$eval('.choice-default', function (el) { return el.textContent; });
  assert.match(grantLabel, /\(Default\)/);
  assert.match(grantLabel, /Recommended default/);
  await page.screenshot({ path: path.join(artifactDir, 'grant-recipients-default.png'), fullPage: true });
  await page.click('button[data-tip-id="funding_combined"]');
  const combinedTip = await page.evaluate(function () {
    const button = document.querySelector('button[data-tip-id="funding_combined"]');
    const panel = document.getElementById(button.getAttribute('aria-describedby'));
    button.scrollIntoView({ block: 'center' });
    return { expanded: button.getAttribute('aria-expanded'), text: panel.textContent, hidden: panel.hidden };
  });
  assert.equal(combinedTip.expanded, 'true');
  assert.equal(combinedTip.hidden, false);
  assert.match(combinedTip.text, /together can't exceed the \$2,500 annual limit per employee/);
  assert.match(combinedTip.text, /with a \$1,000 grant, an employee can elect up to \$1,500 through payroll/);
  assert.doesNotMatch(combinedTip.text, /reserved for the grant/);
  const pilotTip = await page.evaluate(function () { return window.S128Tips.TEXT.grant_dependents; });
  assert.match(pilotTip, /\$1,000 Treasury contribution is only for children born in 2025 through 2028/);
  assert.match(pilotTip, /can still have a Trump account and can still receive employer Section 128 contributions/);
  assert.match(pilotTip, /under 18 and the account is opened and active/);
  assert.match(pilotTip, /December 31 of the year the child turns 17/);
  await page.screenshot({ path: path.join(artifactDir, 'tooltip-combined.png'), fullPage: false });
  await page.keyboard.press('Escape');
  await setField(page, 'waiting_days', '400');
  assert.equal(await page.$eval('#waiting_days', function (el) { return el.value; }), '0');
  assert.match(await page.$eval('#err_waiting_days', function (el) { return el.textContent; }), /0 to 365/);
  await page.screenshot({ path: path.join(artifactDir, 'waiting-period-error.png'), fullPage: true });
  await page.focus('#waiting_days');
  await page.keyboard.type('a');
  assert.match(await page.$eval('#err_waiting_days', function (el) { return el.textContent; }), /whole number/);
  assert.equal(await page.$eval('#waiting_days', function (el) { return el.value; }), '0');
  await setField(page, 'waiting_days', '12.5');
  assert.equal(await page.$eval('#waiting_days', function (el) { return el.value; }), '12');
  assert.match(await page.$eval('#err_waiting_days', function (el) { return el.textContent; }), /whole number/);
  await setField(page, 'waiting_days', '0');
  assert.equal(await page.$eval('#err_waiting_days', function (el) { return el.textContent; }), '');
  await fillDesign(page, 'combined');
  await page.click('#btnNext');
  await fillAdmin(page, 'combined');
  await page.click('#btnNext');
  await page.click('#terms_ack');
  await page.click('#btnNext');
  await page.waitForFunction(function () {
    return /ready to download/i.test(document.getElementById('emailStatus').textContent);
  });
  const note = await page.$eval('#employeeFormsNote', function (el) { return el.textContent; });
  assert.match(note, /About employee forms: Employee notices, salary-reduction election forms, and account designation forms aren't included/);
  assert.match(note, /DK Benefits does not sell, market, open, or administer Trump accounts, and does not prepare these forms/);
  await page.screenshot({ path: path.join(artifactDir, 'download-note.png'), fullPage: true });
  await page.close();
});

test('examples sit below the fields, and payroll notice cannot be typed above 30', async function () {
  const page = await openPage(1440);
  const placeholders = await page.$$eval('input, textarea', function (nodes) {
    return nodes.map(function (node) { return node.getAttribute('placeholder') || ''; });
  });
  placeholders.forEach(function (value) {
    assert.doesNotMatch(value, /e\.g\./i);
  });
  assert.equal(await page.$eval('#employer_ein', function (el) { return el.getAttribute('aria-describedby'); }), 'hint_employer_ein');
  assert.equal(await page.$eval('#hint_employer_ein', function (el) { return el.textContent; }), 'e.g. 12-3456789');
  assert.equal(await page.$eval('#hint_contact_email', function (el) { return el.textContent; }), 'e.g. name@company.com');
  assert.match(await page.$eval('#contactEmailHint', function (el) { return el.textContent; }), /emailed to this address/);
  await page.screenshot({ path: path.join(artifactDir, 'hints-step1-1440.png'), fullPage: true });
  await page.setViewport({ width: 390, height: 844 });
  await page.screenshot({ path: path.join(artifactDir, 'hints-step1-390.png'), fullPage: true });
  await page.setViewport({ width: 1440, height: 900 });
  await fillCompany(page);
  await page.click('#btnNext');
  await fillDesign(page, 'salary_reduction_only');
  await page.click('#btnNext');
  assert.match(await page.$eval('#stepTitle', function (el) { return el.textContent; }), /Administration/);
  const cutoff = await page.$eval('#election_cutoff_days', function (el) {
    return {
      placeholder: el.getAttribute('placeholder'),
      min: el.getAttribute('min'),
      max: el.getAttribute('max'),
      described: el.getAttribute('aria-describedby')
    };
  });
  assert.equal(cutoff.placeholder, null);
  assert.equal(cutoff.min, '0');
  assert.equal(cutoff.max, '30');
  assert.equal(cutoff.described, 'hint_election_cutoff_example hint_election_cutoff_days');
  assert.equal(await page.$eval('#hint_election_cutoff_example', function (el) { return el.textContent; }), 'e.g. 5');
  assert.equal(await page.$eval('#election_cutoff_days', function (el) { return el.value; }), '');
  await page.$eval('#election_cutoff_days', function (el) { el.scrollIntoView({ block: 'center', behavior: 'auto' }); });
  await page.screenshot({ path: path.join(artifactDir, 'hints-payroll-1440.png') });
  await page.setViewport({ width: 390, height: 844 });
  await page.$eval('#election_cutoff_days', function (el) { el.scrollIntoView({ block: 'center', behavior: 'auto' }); });
  await page.screenshot({ path: path.join(artifactDir, 'hints-payroll-390.png') });
  await page.setViewport({ width: 1440, height: 900 });
  await setField(page, 'election_cutoff_days', '45');
  assert.equal(await page.$eval('#election_cutoff_days', function (el) { return el.value; }), '0');
  assert.match(await page.$eval('#err_election_cutoff_days', function (el) { return el.textContent; }), /0 to 30/);
  await setField(page, 'election_cutoff_days', '12.5');
  assert.equal(await page.$eval('#election_cutoff_days', function (el) { return el.value; }), '12');
  assert.match(await page.$eval('#err_election_cutoff_days', function (el) { return el.textContent; }), /whole number/);
  await setField(page, 'election_cutoff_days', '30');
  assert.equal(await page.$eval('#election_cutoff_days', function (el) { return el.value; }), '30');
  assert.equal(await page.$eval('#err_election_cutoff_days', function (el) { return el.textContent; }), '');
  await setField(page, 'election_cutoff_days', '0');
  assert.equal(await page.$eval('#election_cutoff_days', function (el) { return el.value; }), '0');
  await page.focus('#election_cutoff_days');
  await page.keyboard.type('a');
  assert.equal(await page.$eval('#election_cutoff_days', function (el) { return el.value; }), '0');
  assert.match(await page.$eval('#err_election_cutoff_days', function (el) { return el.textContent; }), /whole number/);
  await page.close();
});
