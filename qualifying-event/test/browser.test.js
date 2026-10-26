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
  assert.match(meta.text, /Questions about this change/);
  assert.match(meta.text, /Send question/);
  assert.equal(await page.$eval('#qeScenarioBox', function (el) { return el.hidden; }), true);
  const sendStyle = await page.$eval('#questionSend', function (el) {
    var style = getComputedStyle(el);
    return { color: style.color, outlineStyle: style.outlineStyle, background: style.backgroundColor };
  });
  assert.equal(sendStyle.color, 'rgb(22, 35, 58)');
  assert.equal(sendStyle.outlineStyle, 'none');
  assert.equal(sendStyle.background, 'rgb(201, 162, 39)');
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
  const summaryText = await page.$eval('#qeScenarioSummary', function (el) { return el.innerText; });
  assert.match(summaryText, /Marriage/);
  assert.match(summaryText, /Not specified/);
  assert.match(summaryText, /Within 30 days/);
  assert.match(summaryText, /Generally allowed/);
  assert.equal(await page.$eval('#includeScenario', function (el) { return el.checked; }), true);
  assert.equal(await page.$eval('#qeScenarioBox', function (el) { return el.hidden; }), false);
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
  assert.equal(await page.$eval('#qeScenarioBox', function (el) { return el.hidden; }), true);
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

async function typeQuestion(page) {
  await page.click('#qeName');
  await page.type('#qeName', 'Ada Lovelace');
  await page.click('#qeEmail');
  await page.type('#qeEmail', 'ada@northwind.example');
  await page.click('#qeQuestion');
  await page.type('#qeQuestion', 'Can we add the spouse this month?');
}

function watchQuestionPosts(page, state) {
  return page.setRequestInterception(true).then(function () {
    page.on('request', function (request) {
      var url = request.url();
      if (url.indexOf('script.google.com') !== -1) {
        request.abort('failed').catch(function () {});
        state.live = true;
        return;
      }
      if (url.indexOf('/qe-question-result') !== -1) {
        request.respond({
          status: 200,
          contentType: 'text/plain;charset=utf-8',
          body: JSON.stringify(state.body)
        }).catch(function () {});
        return;
      }
      if (url.indexOf('/qe-question') === -1) {
        request.continue().catch(function () {});
        return;
      }
      if (state.mode === 'abort') {
        request.abort('failed').catch(function () {});
        return;
      }
      state.hits.push(JSON.parse(request.postData()));
      state.methods.push(request.method());
      state.types.push((request.headers()['content-type'] || ''));
      if (state.mode === 'redirect') {
        request.respond({
          status: 302,
          headers: { Location: new URL('/qe-question-result', url).href }
        }).catch(function () {});
        return;
      }
      request.respond({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(state.body)
      }).catch(function () {});
    });
  });
}

test('question form sends the scenario only when the box stays on', { timeout: 120000 }, async function () {
  const page = await openPage(1280, 900);
  await page.evaluate(function () { window.QE_QUESTION_ENDPOINT = ''; });
  await typeQuestion(page);
  await page.click('#questionSend');
  await page.waitForFunction(function () {
    var banner = document.getElementById('questionBanner');
    return banner && !banner.hidden && /not connected yet/.test(banner.textContent);
  });
  assert.equal(await page.$eval('#questionForm', function (el) { return el.hidden; }), false);

  const state = { mode: 'error', hits: [], methods: [], types: [], live: false, body: { ok: false, error: 'The sheet could not be reached.' } };
  await watchQuestionPosts(page, state);
  await page.evaluate(function () {
    window.QE_QUESTION_ENDPOINT = window.location.origin + '/qe-question';
  });
  await new Promise(function (resolve) { setTimeout(resolve, 3200); });
  await page.click('#questionSend');
  await page.waitForFunction(function () {
    return /could not be reached/.test(document.getElementById('questionBanner').textContent || '');
  });
  assert.equal(state.hits.length, 1);
  assert.equal(state.hits[0].event, 'qe_question');
  assert.equal(state.hits[0].includeScenario, false);
  assert.equal(state.hits[0].scenario, null);
  assert.equal(state.hits[0].question, 'Can we add the spouse this month?');
  assert.equal(state.methods[0], 'POST');
  assert.match(state.types[0], /^text\/plain/i);
  assert.equal(state.live, false);
  assert.equal(await page.$eval('#questionForm', function (el) { return el.hidden; }), false);

  await page.evaluate(function () {
    window.QE.scenario = window.QEModel.scenario({
      event: 'marriage',
      benefits: ['medical'],
      answers: { change: 'add_family' },
      timing: 'within_30'
    });
    window.QEForm.refresh();
  });
  assert.match(await page.$eval('#qeScenarioSummary', function (el) { return el.innerText; }), /Marriage/);
  assert.equal(await page.$eval('#includeScenario', function (el) { return el.checked; }), true);
  await page.click('#includeScenario');
  state.body = { ok: true, emailed: true };
  state.mode = 'redirect';
  await page.click('#questionSend');
  await page.waitForFunction(function () {
    var card = document.getElementById('questionSuccess');
    return card && !card.hidden && /Dan will reply by email/.test(document.getElementById('questionSuccessText').textContent);
  });
  assert.equal(state.hits.length, 2);
  assert.equal(state.hits[1].includeScenario, false);
  assert.equal(state.hits[1].scenario, null);
  assert.equal(state.hits[1].scenarioSummary, '');
  assert.equal(state.hits[1].name, 'Ada Lovelace');
  assert.equal(state.hits[1].email, 'ada@northwind.example');
  await page.close();

  const again = await openPage(390, 844);
  await typeQuestion(again);
  const phoneState = { mode: 'abort', hits: [], methods: [], types: [], live: false, body: { ok: true, emailed: true } };
  await watchQuestionPosts(again, phoneState);
  await again.evaluate(function () {
    window.QE_QUESTION_ENDPOINT = window.location.origin + '/qe-question';
    window.QE.scenario = window.QEModel.scenario({
      event: 'marriage',
      benefits: ['medical'],
      answers: { change: 'add_family' },
      timing: 'within_30'
    });
    window.QEForm.refresh();
  });
  assert.equal(await again.$eval('#includeScenario', function (el) { return el.checked; }), true);
  await new Promise(function (resolve) { setTimeout(resolve, 3200); });
  await again.click('#questionSend');
  await again.waitForFunction(function () {
    var banner = document.getElementById('questionBanner');
    return banner && !banner.hidden && /could not be sent/.test(banner.textContent || '');
  });
  assert.equal(await again.$eval('#questionForm', function (el) { return el.hidden; }), false);
  assert.equal(await again.$eval('#qeScenarioBox', function (el) { return el.hidden; }), false);
  phoneState.mode = 'redirect';
  await again.click('#questionSend');
  await again.waitForFunction(function () {
    var card = document.getElementById('questionSuccess');
    return card && !card.hidden && /Dan will reply by email/.test(document.getElementById('questionSuccessText').textContent);
  });
  assert.equal(phoneState.hits.length, 1);
  assert.equal(phoneState.hits[0].includeScenario, true);
  assert.equal(phoneState.hits[0].scenario.event.id, 'marriage');
  assert.equal(phoneState.hits[0].scenario.change.id, 'add_family');
  assert.equal(phoneState.hits[0].scenario.result.code, 'allowed');
  assert.match(phoneState.hits[0].scenarioSummary, /Event: Marriage/);
  assert.match(phoneState.hits[0].scenarioSummary, /Who: Not specified/);
  assert.match(phoneState.hits[0].scenarioSummary, /Timing: Within 30 days/);
  assert.match(phoneState.hits[0].scenarioSummary, /Result: Generally allowed/);
  assert.equal(phoneState.methods[0], 'POST');
  assert.match(phoneState.types[0], /^text\/plain/i);
  assert.equal(phoneState.live, false);
  await again.close();
});
