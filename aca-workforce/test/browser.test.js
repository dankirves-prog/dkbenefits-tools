const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('http');
const path = require('node:path');
const test = require('node:test');
const puppeteer = require('puppeteer-core');

const root = path.join(__dirname, '../..');
const outDir = '/opt/cursor/artifacts/aca-workforce';

function startStatic(port) {
  const types = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8'
  };
  const server = http.createServer(function (req, res) {
    const url = new URL(req.url, 'http://127.0.0.1');
    const rel = decodeURIComponent(url.pathname).replace(/^\/+/, '');
    const file = path.resolve(root, rel || 'aca-workforce-calculator.html');
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

async function overflow(page) {
  return page.evaluate(function () {
    return document.documentElement.scrollWidth - document.documentElement.clientWidth;
  });
}

test('workforce calculator: empty start, months, ALE, and seasonal exception', async function () {
  fs.mkdirSync(outDir, { recursive: true });
  const server = await startStatic(8766);
  const browser = await puppeteer.launch({
    executablePath: '/usr/local/bin/google-chrome',
    headless: true,
    args: ['--no-sandbox', '--disable-dev-shm-usage']
  });
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 900 });
    await page.goto('http://127.0.0.1:8766/aca-workforce-calculator.html', { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(function () {
      var line = document.getElementById('year-line');
      return line && /average total number of employees/i.test(line.textContent);
    });

    const robots = await page.$eval('meta[name="robots"]', function (el) { return el.content; });
    assert.equal(robots, 'noindex, indexifembedded');
    const hidden = await page.$eval('#results', function (el) { return el.hidden; });
    assert.equal(hidden, true);
    assert.equal(await page.$('#result-card'), null);
    const gold = await page.$eval('.btn-gold', function (el) {
      const style = getComputedStyle(el);
      return { background: style.backgroundColor, color: style.color };
    });
    assert.equal(gold.background, 'rgb(200, 169, 81)');
    assert.equal(gold.color, 'rgb(22, 35, 58)');
    const banner = await page.$eval('.site-header', function (el) {
      return getComputedStyle(el).backgroundColor;
    });
    assert.equal(banner, 'rgb(26, 46, 74)');
    assert.equal(await overflow(page), 0);
    await page.screenshot({ path: path.join(outDir, 'screenshot_start_empty.png') });

    await page.click('.info-btn');
    await page.waitForSelector('#info-pop:not([hidden])');
    const tip = await page.$eval('#info-pop', function (el) { return el.textContent; });
    assert.match(tip, /average total number of employees/i);
    await page.keyboard.press('Escape');
    const tipHidden = await page.$eval('#info-pop', function (el) { return el.hidden; });
    assert.equal(tipHidden, true);
    await page.click('h2 .info-btn[data-tip="seasonal"]');
    await page.waitForSelector('#info-pop:not([hidden])');
    await page.click('h1');
    assert.equal(await page.$eval('#info-pop', function (el) { return el.hidden; }), true);

    await page.click('#ex-ale');
    await page.waitForSelector('#result-card');
    let text = await page.$eval('#result-card', function (el) { return el.innerText; });
    assert.match(text, /80/);
    assert.match(text, /ALE — yes/i);
    assert.match(text, /Applicable large employer/);
    const penalty = await page.$eval('#result-card a.btn-gold', function (el) { return el.href; });
    assert.equal(penalty, 'https://www.dkbenefits.net/aca-penalty-calculator');
    assert.match(text, /GitHub Pages/);
    assert.match(text, /Talk to our team/);
    const aleContact = await page.$eval('#result-actions a[href="https://www.dkbenefits.net/contact"]', function (el) {
      return { target: el.getAttribute('target'), text: el.textContent };
    });
    assert.equal(aleContact.target, '_top');
    assert.equal(aleContact.text, 'Talk to our team');
    assert.equal(await page.$('#lead'), null);
    await (await page.$('#result-actions')).screenshot({ path: path.join(outDir, 'screenshot_contact_ale.png') });

    await page.click('#ex-seasonal');
    await page.waitForSelector('#result-card');
    text = await page.$eval('#result-card', function (el) { return el.innerText; });
    assert.match(text, /seasonal exception/i);
    assert.match(text, /seasonal-worker exception/i);
    assert.match(text, /66/);
    const goldContact = await page.$eval('#result-card a.btn-gold', function (el) {
      return { href: el.href, target: el.getAttribute('target'), text: el.textContent };
    });
    assert.equal(goldContact.href, 'https://www.dkbenefits.net/contact');
    assert.equal(goldContact.target, '_top');
    assert.equal(goldContact.text, 'Talk to our team');
    assert.match(text, /Benefits compliance checkup/);
    const seasonalPenalty = await page.$eval('#result-card a.text-link', function (el) { return el.href; });
    assert.equal(seasonalPenalty, 'https://www.dkbenefits.net/aca-penalty-calculator');
    const september = await page.$eval('#ft8', function (el) { return el.value; });
    const january = await page.$eval('#ft0', function (el) { return el.value; });
    assert.equal(january, '40');
    assert.equal(september, '120');
    const grid = await page.$('#month-grid');
    await grid.screenshot({ path: path.join(outDir, 'screenshot_months_filled.png') });
    await (await page.$('#result-actions')).screenshot({ path: path.join(outDir, 'screenshot_contact_seasonal.png') });

    await page.click('#ex-under');
    await page.waitForSelector('#result-card');
    text = await page.$eval('#result-card', function (el) { return el.innerText; });
    assert.match(text, /Not an applicable large employer/);
    assert.match(text, /40/);
    const underContact = await page.$eval('#result-card a.btn-gold', function (el) {
      return { href: el.href, target: el.getAttribute('target'), text: el.textContent };
    });
    assert.equal(underContact.href, 'https://www.dkbenefits.net/contact');
    assert.equal(underContact.target, '_top');
    assert.equal(underContact.text, 'Talk to our team');
    const checkup = await page.$eval('#result-actions a[href*="compliance-assessment"]', function (el) { return el.textContent; });
    assert.equal(checkup, 'Benefits compliance checkup');
    await (await page.$('#result-actions')).screenshot({ path: path.join(outDir, 'screenshot_contact_under_50.png') });

    await page.setViewport({ width: 390, height: 844 });
    assert.equal(await overflow(page), 0);
  } finally {
    await browser.close();
    server.close();
  }
});
