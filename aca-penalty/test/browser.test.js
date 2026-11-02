const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('http');
const path = require('path');
const test = require('node:test');
const puppeteer = require('puppeteer-core');

const root = path.join(__dirname, '../..');
const outDir = '/opt/cursor/artifacts/aca-penalty';

function startStatic(port) {
  const types = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8'
  };
  const server = http.createServer(function (req, res) {
    const url = new URL(req.url, 'http://127.0.0.1');
    const rel = decodeURIComponent(url.pathname).replace(/^\/+/, '');
    const file = path.resolve(root, rel || 'aca-penalty-calculator.html');
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

test('calculator examples, blank endpoint, and both viewports', async function () {
  fs.mkdirSync(outDir, { recursive: true });
  const server = await startStatic(8765);
  const browser = await puppeteer.launch({
    executablePath: '/usr/local/bin/google-chrome',
    headless: true,
    args: ['--no-sandbox', '--disable-dev-shm-usage']
  });
  const requests = [];
  try {
    const page = await browser.newPage();
    page.on('request', function (request) { requests.push(request.url()); });
    await page.setViewport({ width: 1280, height: 900 });
    await page.goto('http://127.0.0.1:8765/aca-penalty-calculator.html', { waitUntil: 'networkidle0' });
    const robots = await page.$eval('meta[name="robots"]', function (el) { return el.content; });
    const googlebot = await page.$eval('meta[name="googlebot"]', function (el) { return el.content; });
    assert.equal(robots, 'noindex, indexifembedded');
    assert.equal(googlebot, 'noindex, indexifembedded');
    const gold = await page.$eval('.btn-gold', function (el) {
      const style = getComputedStyle(el);
      return { background: style.backgroundColor, color: style.color };
    });
    assert.equal(gold.background, 'rgb(200, 169, 81)');
    assert.equal(gold.color, 'rgb(22, 35, 58)');
    const banner = await page.$eval('.site-header', function (el) {
      return getComputedStyle(el).borderBottomColor;
    });
    assert.equal(banner, 'rgb(200, 169, 81)');

    await page.click('#ex-120');
    await page.waitForSelector('#result-card');
    let text = await page.$eval('#result-card', function (el) { return el.innerText; });
    assert.match(text, /\$300,600/);
    assert.match(text, /\$25,050/);
    assert.match(text, /employer mandate likely applies/i);
    await page.screenshot({ path: path.join(outDir, 'desktop-120-no-offer.png'), fullPage: true });

    await page.click('#ex-40');
    await page.waitForFunction(function () {
      return document.getElementById('result-card').innerText.indexOf('does not apply') !== -1;
    });
    text = await page.$eval('#result-card', function (el) { return el.innerText; });
    assert.match(text, /\$0/);
    assert.match(text, /small-group/i);

    await page.click('#ex-80');
    await page.waitForFunction(function () {
      return document.getElementById('result-card').innerText.indexOf('$30,060') !== -1;
    });
    text = await page.$eval('#result-card', function (el) { return el.innerText; });
    assert.match(text, /\$30,060/);
    assert.match(text, /does not meet/i);
    assert.match(text, /\$167,000/);

    await page.type('#lead-name', 'Pat Employer');
    await page.type('#lead-company', 'Harbor Grill');
    await page.type('#lead-email', 'pat@harborgrill.example');
    await page.click('#lead-consent');
    await page.click('#lead-form button');
    const lead = await page.$eval('#lead-status', function (el) { return el.textContent; });
    assert.match(lead, /not connected yet/);
    assert.equal(requests.some(function (url) { return /script\.google\.com/.test(url); }), false);

    await page.setViewport({ width: 390, height: 844 });
    await page.waitForSelector('#result-card');
    const extra = await overflow(page);
    assert.ok(extra <= 1, 'horizontal overflow ' + extra);
    await page.screenshot({ path: path.join(outDir, 'mobile-390-results.png'), fullPage: true });
    const buttonWidth = await page.$eval('#lead-form .btn-gold', function (el) { return el.getBoundingClientRect().width; });
    assert.ok(buttonWidth > 300, 'gold button should be full width on a phone');
  } finally {
    await browser.close();
    server.close();
  }
});
