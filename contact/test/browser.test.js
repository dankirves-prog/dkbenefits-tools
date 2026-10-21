const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('http');
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer-core');

const repoRoot = path.join(__dirname, '..', '..');
const chrome = process.env.CHROME_PATH || '/usr/bin/google-chrome';
const artifactDir = process.env.CONTACT_ARTIFACT_DIR || '/opt/cursor/artifacts/contact';
const port = 8777;
const origin = 'http://127.0.0.1:' + port;

let server;
let browser;

function startStatic() {
  const types = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8'
  };
  server = http.createServer(function (req, res) {
    const url = new URL(req.url, origin);
    let rel = decodeURIComponent(url.pathname);
    if (rel === '/') rel = '/contact/index.html';
    const file = path.resolve(repoRoot, '.' + rel);
    if (file !== repoRoot && !file.startsWith(repoRoot + path.sep)) {
      res.writeHead(403);
      res.end();
      return;
    }
    const target = fs.existsSync(file) && fs.statSync(file).isDirectory() ? path.join(file, 'index.html') : file;
    fs.readFile(target, function (err, data) {
      if (err) {
        res.writeHead(404);
        res.end('not found');
        return;
      }
      res.writeHead(200, { 'Content-Type': types[path.extname(target)] || 'application/octet-stream' });
      res.end(data);
    });
  });
  return new Promise(function (resolve) {
    server.listen(port, '127.0.0.1', resolve);
  });
}

async function shot(page, name) {
  fs.mkdirSync(artifactDir, { recursive: true });
  await page.screenshot({ path: path.join(artifactDir, name), fullPage: true });
}

async function openForm(width, height) {
  const page = await browser.newPage();
  await page.setViewport({ width: width, height: height, deviceScaleFactor: 1 });
  await page.goto(origin + '/contact/', { waitUntil: 'networkidle0', timeout: 20000 });
  await page.waitForSelector('#sendButton');
  return page;
}

async function ageForm(page) {
  await page.evaluate(function () {
    sessionStorage.setItem('dkbContactStartedAt', String(Date.now() - 20000));
  });
  await page.reload({ waitUntil: 'networkidle0', timeout: 20000 });
  await page.waitForSelector('#sendButton');
}

async function installFetch(page, body) {
  await page.evaluate(function (responseBody) {
    window.__posts = [];
    window.__fetchBody = responseBody;
    window.fetch = function (url, opts) {
      window.__posts.push({ url: String(url), body: opts && opts.body });
      return Promise.resolve({
        json: function () { return Promise.resolve(window.__fetchBody); }
      });
    };
  }, body);
}

async function fillValid(page) {
  await page.$eval('#firstName', function (el) { el.value = 'Ada'; });
  await page.$eval('#lastName', function (el) { el.value = 'Lovelace'; });
  await page.$eval('#company', function (el) { el.value = 'Northwind'; });
  await page.$eval('#email', function (el) { el.value = 'ada@northwind.example'; });
  await page.$eval('#phone', function (el) { el.value = '4075550123'; });
  await page.$eval('#message', function (el) { el.value = 'We need help with our group health plan.'; });
  await page.$eval('#phone', function (el) { el.dispatchEvent(new Event('blur')); });
}

test.before(async function () {
  fs.mkdirSync(artifactDir, { recursive: true });
  await startStatic();
  browser = await puppeteer.launch({
    executablePath: chrome,
    headless: 'new',
    args: ['--no-sandbox', '--disable-dev-shm-usage']
  });
});

test.after(async function () {
  if (browser) await browser.close();
  if (server) await new Promise(function (resolve) { server.close(resolve); });
});

test('desktop and phone render at the top, and validation errors stay in the form', async function () {
  const desktop = await openForm(1280, 900);
  const desktopStyle = await desktop.$eval('#sendButton', function (el) {
    const style = getComputedStyle(el);
    return {
      text: el.textContent,
      background: style.backgroundColor,
      color: style.color,
      borderTopWidth: style.borderTopWidth,
      outlineStyle: style.outlineStyle
    };
  });
  assert.equal(desktopStyle.text, 'Send Message');
  assert.equal(desktopStyle.background, 'rgb(201, 162, 39)');
  assert.equal(desktopStyle.color, 'rgb(22, 35, 58)');
  assert.equal(desktopStyle.borderTopWidth, '0px');
  await desktop.hover('#sendButton');
  const hovered = await desktop.$eval('#sendButton', function (el) { return getComputedStyle(el).color; });
  assert.equal(hovered, 'rgb(22, 35, 58)');
  const desktopHeight = await desktop.evaluate(function () {
    return {
      scrollTop: document.scrollingElement.scrollTop,
      height: Math.ceil(document.body.getBoundingClientRect().height),
      active: document.activeElement.tagName
    };
  });
  assert.equal(desktopHeight.scrollTop, 0);
  assert.equal(desktopHeight.active, 'BODY');
  console.log('DESKTOP_EMPTY ' + JSON.stringify(desktopHeight));
  await shot(desktop, 'contact_desktop_form.png');

  await desktop.click('#sendButton');
  await desktop.waitForSelector('#err_firstName:not(:empty)');
  const emptyErrors = await desktop.$$eval('.field-error', function (nodes) {
    return nodes.map(function (node) { return node.textContent; }).filter(Boolean);
  });
  assert.deepEqual(emptyErrors, ['Enter your first name.', 'Enter your email.', 'Enter a message.']);
  assert.equal(await desktop.$eval('#successCard', function (el) { return el.hidden; }), true);
  await desktop.type('#email', 'not-an-email');
  await desktop.type('#phone', '555');
  await desktop.click('#sendButton');
  await desktop.waitForFunction(function () {
    return document.getElementById('err_email').textContent.indexOf('valid email') !== -1;
  });
  const invalid = await desktop.$eval('#err_phone', function (el) { return el.textContent; });
  assert.match(invalid, /10-digit/);
  const banner = await desktop.$eval('#formBanner', function (el) { return el.textContent; });
  assert.match(banner, /highlighted fields/);
  const validationHeight = await desktop.evaluate(function () {
    return Math.ceil(document.body.getBoundingClientRect().height);
  });
  console.log('DESKTOP_ERRORS ' + validationHeight);
  await shot(desktop, 'contact_desktop_validation.png');
  await desktop.close();

  const phone = await openForm(390, 844);
  const phoneTop = await phone.evaluate(function () {
    return {
      scrollTop: document.scrollingElement.scrollTop,
      height: Math.ceil(document.body.getBoundingClientRect().height),
      active: document.activeElement.tagName,
      overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1
    };
  });
  assert.equal(phoneTop.scrollTop, 0);
  assert.equal(phoneTop.active, 'BODY');
  assert.equal(phoneTop.overflow, false);
  console.log('PHONE_EMPTY ' + JSON.stringify(phoneTop));
  await shot(phone, 'contact_phone_form.png');
  await phone.click('#sendButton');
  await phone.waitForSelector('#err_email:not(:empty)');
  await phone.type('#email', 'ada@');
  await phone.click('#sendButton');
  const phoneErrors = await phone.evaluate(function () {
    return Math.ceil(document.body.getBoundingClientRect().height);
  });
  console.log('PHONE_ERRORS ' + phoneErrors);
  await shot(phone, 'contact_phone_validation.png');
  const visible = await phone.evaluate(function () { return document.body.innerText; });
  assert.equal(visible.indexOf('\u2014'), -1);
  assert.equal(visible.indexOf('\u2013'), -1);
  await phone.close();
});

test('an unconfigured form does not claim success, and a configured form shows the success note', async function () {
  const page = await openForm(1280, 900);
  await ageForm(page);
  await installFetch(page, { ok: true, leadEmailed: true, followUpQueued: true });
  await fillValid(page);
  await page.click('#sendButton');
  await page.waitForFunction(function () {
    return document.getElementById('formBanner').textContent.indexOf('not connected') !== -1;
  });
  const posts = await page.evaluate(function () { return window.__posts.length; });
  assert.equal(posts, 0);
  assert.equal(await page.$eval('#successCard', function (el) { return el.hidden; }), true);

  await page.evaluate(function () {
    window.CONTACT_ENDPOINT = 'https://script.google.com/macros/s/TEST_DEPLOYMENT_ID/exec';
  });
  await page.click('#sendButton');
  await page.waitForSelector('#successCard:not([hidden])');
  const success = await page.$eval('#successText', function (el) { return el.textContent; });
  assert.equal(success, 'Thanks! Your message is on its way. I\'ll be in touch within one business day.');
  const sent = await page.evaluate(function () { return window.__posts; });
  assert.equal(sent.length, 1);
  const body = JSON.parse(sent[0].body);
  assert.equal(body.event, 'contact_submission');
  assert.equal(body.hp, '');
  assert.equal(body.lead.firstName, 'Ada');
  assert.equal(body.lead.email, 'ada@northwind.example');
  assert.equal(body.lead.phone, '(407) 555-0123');
  assert.ok(Date.parse(body.submittedAt) - Date.parse(body.startedAt) >= 3000);
  const successHeight = await page.evaluate(function () {
    return {
      scrollTop: document.scrollingElement.scrollTop,
      height: Math.ceil(document.body.getBoundingClientRect().height)
    };
  });
  assert.equal(successHeight.scrollTop, 0);
  console.log('DESKTOP_SUCCESS ' + JSON.stringify(successHeight));
  await shot(page, 'contact_desktop_success.png');
  await page.close();

  const phone = await openForm(390, 844);
  await ageForm(phone);
  await installFetch(phone, { ok: true, leadEmailed: true, followUpQueued: true });
  await phone.evaluate(function () {
    window.CONTACT_ENDPOINT = 'https://script.google.com/macros/s/TEST_DEPLOYMENT_ID/exec';
  });
  await fillValid(phone);
  await phone.click('#sendButton');
  await phone.waitForSelector('#successCard:not([hidden])');
  await shot(phone, 'contact_phone_success.png');
  const phoneSuccess = await phone.evaluate(function () {
    return Math.ceil(document.body.getBoundingClientRect().height);
  });
  console.log('PHONE_SUCCESS ' + phoneSuccess);
  await phone.close();
});

test('a fast submit asks the visitor to wait, and a failed send stays on the form', async function () {
  const page = await openForm(980, 800);
  await page.evaluate(function () {
    window.CONTACT_ENDPOINT = 'https://script.google.com/macros/s/TEST_DEPLOYMENT_ID/exec';
    window.__posts = [];
    window.fetch = function () {
      window.__posts.push(1);
      return Promise.resolve({ json: function () { return Promise.resolve({ ok: true, leadEmailed: true }); } });
    };
  });
  await fillValid(page);
  await page.click('#sendButton');
  await page.waitForFunction(function () {
    return document.getElementById('formBanner').textContent.indexOf('take a moment') !== -1;
  });
  assert.equal(await page.evaluate(function () { return window.__posts.length; }), 0);

  await ageForm(page);
  await page.evaluate(function () {
    window.CONTACT_ENDPOINT = 'https://script.google.com/macros/s/TEST_DEPLOYMENT_ID/exec';
    window.fetch = function () { return Promise.reject(new Error('offline')); };
  });
  await fillValid(page);
  await page.click('#sendButton');
  await page.waitForFunction(function () {
    return document.getElementById('formBanner').textContent.indexOf('could not be sent') !== -1;
  });
  assert.equal(await page.$eval('#formCard', function (el) { return el.hidden; }), false);
  assert.equal(await page.$eval('#sendButton', function (el) { return el.textContent; }), 'Send Message');
  await page.close();
});

test('the iframe loads at the top of the parent page', async function () {
  const page = await browser.newPage();
  await page.setViewport({ width: 1100, height: 800 });
  await page.goto(origin + '/contact/test/iframe-harness.html?src=' + encodeURIComponent(origin + '/contact/'), {
    waitUntil: 'networkidle0',
    timeout: 20000
  });
  const frame = page.frames().find(function (item) { return item.url().indexOf('/contact/') !== -1 && item.url().indexOf('harness') === -1; });
  await frame.waitForSelector('#firstName');
  await new Promise(function (resolve) { setTimeout(resolve, 200); });
  const parent = await page.evaluate(function () {
    const heading = document.querySelector('h1').getBoundingClientRect();
    return {
      scrollTop: document.scrollingElement.scrollTop,
      headingTop: Math.round(heading.top)
    };
  });
  const inner = await frame.evaluate(function () {
    return {
      scrollTop: document.scrollingElement.scrollTop,
      active: document.activeElement.tagName,
      framed: document.documentElement.classList.contains('is-framed'),
      introHidden: getComputedStyle(document.querySelector('.intro')).display === 'none',
      height: Math.ceil(document.body.getBoundingClientRect().height)
    };
  });
  assert.equal(parent.scrollTop, 0);
  assert.ok(parent.headingTop >= 0 && parent.headingTop < 80, JSON.stringify(parent));
  assert.equal(inner.scrollTop, 0);
  assert.equal(inner.active, 'BODY');
  assert.equal(inner.framed, true);
  assert.equal(inner.introHidden, true);
  console.log('IFRAME_DESKTOP ' + JSON.stringify(inner));

  await page.setViewport({ width: 390, height: 780 });
  await new Promise(function (resolve) { setTimeout(resolve, 100); });
  const phoneInner = await frame.evaluate(function () {
    return Math.ceil(document.body.getBoundingClientRect().height);
  });
  const phoneParent = await page.evaluate(function () { return document.scrollingElement.scrollTop; });
  assert.equal(phoneParent, 0);
  console.log('IFRAME_PHONE ' + phoneInner);
  await page.close();
});
