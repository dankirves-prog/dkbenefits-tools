const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const test = require('node:test');

const ROOT = path.join(__dirname, '../..');
const JS = fs.readFileSync(path.join(__dirname, '../print-report.js'), 'utf8');
const CSS = fs.readFileSync(path.join(__dirname, '../print-report.css'), 'utf8');

test('print report source has no em dashes, prices, or hard-coded years', () => {
  const source = JS + '\n' + CSS;
  assert.equal(source.includes('\u2014'), false);
  assert.equal(source.includes('\u2013'), false);
  assert.equal(source.includes('$'), false);
  assert.equal(/\b20\d{2}\b/.test(source), false);
  assert.match(CSS, /size:\s*letter portrait/);
  assert.match(CSS, /DK Benefits Benefits Compliance Checkup \| Page " counter\(page\) " of " counter\(pages\)/);
  const preview = fs.readFileSync(path.join(ROOT, 'compliance-assessment-preview.html'), 'utf8');
  assert.match(preview, /print-report\.js/);
  assert.match(preview, /print-report\.css/);
});

function contentType(file) {
  if (file.endsWith('.html')) return 'text/html; charset=utf-8';
  if (file.endsWith('.js')) return 'text/javascript; charset=utf-8';
  if (file.endsWith('.css')) return 'text/css; charset=utf-8';
  return 'text/plain; charset=utf-8';
}

function startServer() {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      const urlPath = decodeURIComponent(req.url.split('?')[0]);
      const file = path.join(ROOT, urlPath === '/' ? 'index.html' : urlPath);
      fs.readFile(file, (err, data) => {
        if (err) {
          res.statusCode = 404;
          res.end('missing');
          return;
        }
        res.setHeader('Content-Type', contentType(file));
        res.end(data);
      });
    });
    server.listen(0, '127.0.0.1', () => resolve(server));
  });
}

function repoRoot() {
  let dir = __dirname;
  while (true) {
    if (fs.existsSync(path.join(dir, '.git'))) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) return path.join(__dirname, '../..');
    dir = parent;
  }
}

function loadPuppeteer() {
  try {
    return require('puppeteer-core');
  } catch (err) {
    // Look through this repo instead of a machine-specific install path.
  }
  const root = repoRoot();
  const candidates = [path.join(root, 'node_modules', 'puppeteer-core')];
  fs.readdirSync(root, { withFileTypes: true }).forEach((entry) => {
    if (entry.isDirectory()) candidates.push(path.join(root, entry.name, 'node_modules', 'puppeteer-core'));
  });
  for (let i = 0; i < candidates.length; i += 1) {
    if (fs.existsSync(path.join(candidates[i], 'package.json'))) return require(candidates[i]);
  }
  return null;
}

function commandOnPath(name) {
  const finder = process.platform === 'win32' ? 'where' : 'which';
  try {
    return execFileSync(finder, [name], { encoding: 'utf8' }).trim().split(/\r?\n/)[0] || '';
  } catch (err) {
    return '';
  }
}

function findChrome() {
  if (process.env.CHROME_PATH) return process.env.CHROME_PATH;
  if (process.env.PUPPETEER_EXECUTABLE_PATH) return process.env.PUPPETEER_EXECUTABLE_PATH;
  const names = ['google-chrome', 'google-chrome-stable', 'chromium', 'chromium-browser', 'chrome'];
  for (let i = 0; i < names.length; i += 1) {
    const found = commandOnPath(names[i]);
    if (found) return found;
  }
  return '';
}

async function choose(page, label) {
  const missing = await page.evaluate((wanted) => {
    const buttons = Array.from(document.querySelectorAll('.option'));
    const exact = buttons.find((btn) => btn.textContent.trim() === wanted);
    const hit = exact || buttons.find((btn) => btn.textContent.trim().includes(wanted));
    if (!hit) return buttons.map((btn) => btn.textContent.trim());
    hit.click();
    return null;
  }, label);
  if (missing) throw new Error('Missing "' + label + '" :: ' + missing.join(' | '));
}

test('print report is a checklist document, not a copy of the screen', async (t) => {
  const puppeteer = loadPuppeteer();
  const executablePath = findChrome();
  if (!puppeteer || !executablePath) {
    t.skip('A Chrome binary and puppeteer-core are required for this browser check.');
    return;
  }
  const server = await startServer();
  const port = server.address().port;
  const browser = await puppeteer.launch({
    executablePath: executablePath,
    headless: 'new',
    args: ['--no-sandbox', '--disable-dev-shm-usage']
  });
  try {
    const page = await browser.newPage();
    await page.goto('http://127.0.0.1:' + port + '/compliance-assessment-preview.html', { waitUntil: 'networkidle0' });
    const fixture = await page.evaluate(() => {
      const html = window.DKPrint.render({
        company: '',
        printed: window.DKPrint.printedDate(),
        score: '',
        label: 'Not applicable',
        sub: 'A readiness score starts once a plan is in place.',
        priorities: [],
        items: [
          { title: 'Marketplace notice', status: 'actionNeeded', action: 'Put the notice in the new-hire packet.' },
          { title: 'Size', status: 'confirm', action: 'Confirm the headcount.' },
          { title: 'SPD', status: 'inPlace', action: 'Keep a copy of the SPD.' },
          { title: 'Hiring', status: 'note', action: 'Recheck size if hiring picks up.' }
        ],
        calendar: [{ when: 'Mar 31', text: 'IRS e-file for Forms 1094-C and 1095-C.' }]
      });
      const withCompany = window.DKPrint.render({
        company: 'Harbor Group',
        printed: window.DKPrint.printedDate(),
        score: '4',
        label: 'Action recommended',
        sub: 'Several items need action.',
        priorities: [{ title: 'Wrap document', finding: 'No wrap document is in place.', status: 'Action needed' }],
        items: [{ title: 'Wrap document', status: 'actionNeeded', action: 'Put a wrap document in place.' }],
        calendar: []
      });
      return { html: html, withCompany: withCompany };
    });
    assert.match(fixture.html, /Benefits Compliance Checkup/);
    assert.doesNotMatch(fixture.html, /Prepared for/);
    assert.match(fixture.html, /Action needed/);
    assert.match(fixture.html, /Confirm/);
    assert.match(fixture.html, /In place/);
    assert.match(fixture.html, /Notes/);
    assert.match(fixture.html, /print-box/);
    assert.match(fixture.html, /Put the notice in the new-hire packet/);
    assert.match(fixture.html, /<table class="print-calendar">/);
    assert.match(fixture.html, /Mar 31/);
    assert.match(fixture.html, /Daniel Kirves, Benefits Broker \| DK Benefits/);
    assert.match(fixture.html, /407-476-5076/);
    assert.match(fixture.html, /dan@dkbenefits\.net/);
    assert.match(fixture.html, /www\.dkbenefits\.net/);
    assert.match(fixture.html, /6000 Metrowest Blvd #200 Orlando, FL 32835/);
    assert.match(fixture.html, /Agency Lic# L109331/);
    assert.match(fixture.html, /you keep the 2% admin fee/);
    assert.match(fixture.html, /not legal, tax, or ERISA advice/);
    assert.match(fixture.html, /Next steps/);
    assert.equal(fixture.html.includes('\u2014'), false);
    assert.equal(fixture.html.includes('$'), false);
    assert.doesNotMatch(fixture.html, /<(a|button|input|form)\b/i);
    assert.match(fixture.withCompany, /Prepared for Harbor Group/);

    const steps = [
      'No. We do not currently offer benefits',
      'Fewer than 20',
      'No. Most employees are full-time',
      'Private or other employer',
      'Yes. It is in our new-hire packet',
      'No. Headcount will stay about the same',
      'No. Benefits are not a hiring factor'
    ];
    for (const label of steps) {
      await choose(page, label);
      await page.click('[data-action="next"]');
      await new Promise((r) => setTimeout(r, 30));
    }
    await page.waitForSelector('#results-title');
    const button = await page.$eval('[data-action="print"]', (el) => el.textContent.trim());
    assert.equal(button, 'Print or save as PDF');
    const report = await page.evaluate(() => {
      window.DKPrint.mount();
      return document.getElementById('print-report').innerHTML;
    });
    assert.match(report, /Benefits Compliance Checkup/);
    assert.doesNotMatch(report, /Prepared for/);
    assert.match(report, /Daniel Kirves/);
    await page.type('input[name="company"]', 'Harbor Group');
    const named = await page.evaluate(() => {
      window.DKPrint.mount();
      return document.getElementById('print-report').innerHTML;
    });
    assert.match(named, /Prepared for Harbor Group/);
    await page.emulateMediaType('print');
    const shown = await page.evaluate(() => {
      const reportStyle = window.getComputedStyle(document.getElementById('print-report')).display;
      const quizStyle = window.getComputedStyle(document.getElementById('quiz')).display;
      const buttonStyle = window.getComputedStyle(document.querySelector('[data-action="print"]')).display;
      return { reportStyle: reportStyle, quizStyle: quizStyle, buttonStyle: buttonStyle };
    });
    assert.equal(shown.reportStyle, 'block');
    assert.equal(shown.quizStyle, 'none');
    assert.equal(shown.buttonStyle, 'none');
  } finally {
    await browser.close();
    await new Promise((resolve) => server.close(resolve));
  }
});
