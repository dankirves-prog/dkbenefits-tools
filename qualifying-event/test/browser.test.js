const test = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const puppeteer = require('puppeteer-core');

const repoRoot = path.join(__dirname, '..', '..');
const chrome = process.env.CHROME_PATH || '/usr/bin/google-chrome';
const artifactDir = '/opt/cursor/artifacts/qualifying-event';
const port = 8771;
let server;
let browser;

async function waitForServer() {
  for (let i = 0; i < 50; i++) {
    try {
      const res = await fetch('http://127.0.0.1:' + port + '/qualifying-event/');
      if (res.ok) return;
    } catch (err) {}
    await new Promise(function (resolve) { setTimeout(resolve, 100); });
  }
  throw new Error('local page did not start');
}

test.before(async function () {
  fs.mkdirSync(artifactDir, { recursive: true });
  server = spawn('python3', ['-m', 'http.server', String(port), '--bind', '127.0.0.1'], {
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

async function openPage(width, height) {
  const page = await browser.newPage();
  await page.setViewport({ width: width, height: height, deviceScaleFactor: 1 });
  await page.goto('http://127.0.0.1:' + port + '/qualifying-event/', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#stepCount');
  return page;
}

async function shot(page, name) {
  await page.screenshot({ path: path.join(artifactDir, name), fullPage: true });
}

async function stepMeta(page) {
  return page.evaluate(function () {
    var count = document.getElementById('stepCount').textContent.trim();
    var buttons = document.querySelectorAll('#progressList button').length;
    var overflow = document.documentElement.scrollWidth > document.documentElement.clientWidth + 1;
    var scrollers = Array.prototype.filter.call(document.querySelectorAll('body *'), function (el) {
      var style = getComputedStyle(el);
      return (style.overflowY === 'auto' || style.overflowY === 'scroll') && el.scrollHeight > el.clientHeight + 2;
    }).map(function (el) { return el.id || el.className || el.tagName; });
    return {
      count: count,
      buttons: buttons,
      overflow: overflow,
      scrollers: scrollers,
      text: document.body.innerText
    };
  });
}

function assertStep(meta) {
  assert.match(meta.count, new RegExp('^Step \\d+ of ' + meta.buttons + '$'));
  assert.equal(meta.overflow, false, meta.count);
  assert.deepEqual(meta.scrollers, []);
  assert.equal(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u.test(meta.text), false);
  assert.equal(meta.text.indexOf('\u2014'), -1);
  assert.equal(meta.text.indexOf('\u2013'), -1);
}

async function walk(page, prefix) {
  let meta = await stepMeta(page);
  assert.equal(meta.count, 'Step 1 of 5');
  assert.equal(meta.buttons, 5);
  assert.match(meta.text, /DK BENEFITS LLC/);
  assert.match(meta.text, /These are general rules/);
  assertStep(meta);
  await shot(page, prefix + '-start.png');

  await page.click('input[name="event"][value="marriage"]');
  await page.click('#nextBtn');
  await page.waitForSelector('input[name="benefit"][value="medical"]');
  await page.click('input[name="benefit"][value="medical"]');
  await page.click('#nextBtn');
  await page.waitForSelector('input[name="q-change"][value="add_family"]');
  meta = await stepMeta(page);
  assert.equal(meta.count, 'Step 3 of 5');
  assert.match(meta.text, /What change is being requested/);
  assertStep(meta);
  await shot(page, prefix + '-change.png');

  await page.click('input[name="q-change"][value="drop_to_spouse"]');
  await page.waitForSelector('input[name="q-covered"]');
  await page.click('input[name="q-change"][value="add_family"]');
  await page.waitForFunction(function () { return !document.querySelector('input[name="q-covered"]'); });
  await page.click('#nextBtn');
  await page.waitForSelector('input[name="timing"][value="within_30"]');
  await page.click('input[name="timing"][value="within_30"]');
  await page.click('#nextBtn');
  await page.waitForSelector('.btn-gold');
  meta = await stepMeta(page);
  assert.match(meta.count, /^Step \d+ of \d+$/);
  assert.match(meta.text, /Generally allowed/);
  assert.match(meta.text, /first day of the next month/);
  assertStep(meta);
  const gold = await page.$eval('.btn-gold', function (el) {
    var style = getComputedStyle(el);
    return { color: style.color, outlineStyle: style.outlineStyle, background: style.backgroundColor };
  });
  assert.equal(gold.color, 'rgb(22, 35, 58)');
  assert.equal(gold.outlineStyle, 'none');
  assert.equal(gold.background, 'rgb(201, 162, 39)');
  const scenario = await page.evaluate(function () { return window.QE.scenario; });
  assert.equal(scenario.event.id, 'marriage');
  assert.equal(scenario.change.id, 'add_family');
  assert.equal(scenario.timing.id, 'within_30');
  assert.deepEqual(scenario.coverage.map(function (item) { return item.id; }), ['medical']);
  assert.equal(scenario.result.code, 'allowed');
  assert.equal(scenario.result.nudgeUrl, 'https://www.dkbenefits.net/section125plantool');
  await shot(page, prefix + '-allowed.png');

  await page.click('#backBtn');
  await page.waitForSelector('input[name="timing"][value="over_30"]');
  await page.click('input[name="timing"][value="over_30"]');
  await page.click('#nextBtn');
  await page.waitForFunction(function () {
    return window.QE.scenario && window.QE.scenario.result && window.QE.scenario.result.code === 'late';
  });
  meta = await stepMeta(page);
  assert.match(meta.text, /Past the standard 30-day window\. Generally not allowed unless your plan document allows a longer window\./);
  assert.equal(/illegal/i.test(meta.text), false);
  assertStep(meta);
  await shot(page, prefix + '-late.png');
  await page.click('#startOver');
  await page.waitForFunction(function () {
    return window.QE.scenario === null && document.getElementById('stepCount').textContent.trim() === 'Step 1 of 5';
  });
  await page.close();
}

test('desktop flow', { timeout: 120000 }, async function () {
  const page = await openPage(1280, 900);
  await walk(page, 'desktop');
});

test('phone flow', { timeout: 120000 }, async function () {
  const page = await openPage(390, 844);
  await walk(page, 'phone');
});

test('iframe height follows the tool', { timeout: 60000 }, async function () {
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 900, deviceScaleFactor: 1 });
  await page.goto('http://127.0.0.1:' + port + '/qualifying-event/test/harness.html', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(function () {
    return window.__messages.some(function (message) { return message.type === 'resize' && message.height > 400; });
  });
  const box = await page.$eval('#tool', function (frame) {
    return { height: frame.getBoundingClientRect().height, messages: window.__messages.filter(function (message) { return message.type === 'resize'; }).length };
  });
  assert.ok(box.height > 400);
  assert.ok(box.messages >= 1);
  const posted = await page.evaluate(function () {
    return window.__messages.filter(function (message) { return message.type === 'resize'; }).pop().height;
  });
  assert.ok(Math.abs(box.height - posted) < 2);
  await page.close();
});
