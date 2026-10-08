const test = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const puppeteer = require('puppeteer-core');

const repoRoot = path.join(__dirname, '..', '..');
const chrome = process.env.CHROME_PATH || '/usr/local/bin/google-chrome';
const artifactDir = '/opt/cursor/artifacts/section128';
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
      request.respond({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
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
  assert.match(await page.$eval('#stepTitle', function (el) { return el.textContent; }), /Review/);
  assert.match(await page.$eval('#reviewSummary', function (el) { return el.textContent; }), /Harbor & Co/);
  assert.match(await page.$eval('#reviewSummary', function (el) { return el.textContent; }), /\$1,500|1,500/);
  await page.click('[data-edit="1"]');
  assert.match(await page.$eval('#stepTitle', function (el) { return el.textContent; }), /Company/);
  await page.click('#btnNext');
  await page.click('#btnNext');
  await page.click('#btnNext');
  await page.click('#btnNext');
  assert.match(await page.$eval('#err_draft_ack', function (el) { return el.textContent; }), /draft/);
  await page.click('#draft_ack');
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
  assert.equal(posts[0].lead.contact_email, 'mia@harbor.example');
  assert.equal(posts[0].plan.funding_mode, 'combined');
  assert.equal(posts[0].hp, '');
  await page.screenshot({ path: path.join(artifactDir, 'desktop-confirmation.png'), fullPage: true });
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
  await fillCompany(page);
  await page.click('#btnNext');
  await fillDesign(page, 'employer_only');
  await page.click('#btnNext');
  await fillAdmin(page, 'employer_only');
  await page.click('#btnNext');
  await page.click('#draft_ack');
  await page.evaluate(function () { window.__s128SetStartedAt(Date.now() - 10000); });
  await page.click('#btnNext');
  await page.waitForFunction(function () {
    return /could not be emailed yet/i.test(document.getElementById('emailStatus').textContent);
  });
  const text = await page.$eval('#emailStatus', function (el) { return el.textContent; });
  assert.match(text, /not connected/);
  assert.doesNotMatch(text, /A copy was emailed/);
  assert.equal(posts.length, 0);
  await page.screenshot({ path: path.join(artifactDir, 'phone-confirmation.png'), fullPage: true });
  await page.close();
});
