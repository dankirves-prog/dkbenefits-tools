const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const http = require('node:http');
const os = require('node:os');
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
  assert.match(CSS, /\.print-keep[\s\S]*break-inside:\s*avoid/);
  assert.match(CSS, /\.print-keep[\s\S]*page-break-inside:\s*avoid/);
  assert.match(CSS, /page-break-after:\s*avoid/);
  assert.match(CSS, /display:\s*table-header-group/);
  const live = fs.readFileSync(path.join(ROOT, 'compliance-assessment.html'), 'utf8');
  assert.match(live, /print-report\.js/);
  assert.match(live, /print-report\.css/);
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

const HEADING_LINES = new Set([
  'Readiness',
  'Top 3 priorities',
  'Findings checklist',
  'Action needed',
  'Confirm',
  'In place',
  'Notes',
  'Notice and filing calendar',
  'Next steps',
  'Talk with DK Benefits',
  'When',
  'When Notice or filing'
]);

function pageIndex(pages, needle) {
  return pages.findIndex((page) => page.includes(needle));
}

function assertHeadingsStay(text, label) {
  const pages = text.split('\f');
  if (pages.length && !pages[pages.length - 1].trim()) pages.pop();
  pages.forEach((page, index) => {
    const lines = page.split('\n').map((line) => line.replace(/\s+/g, ' ').trim()).filter((line) => {
      return line && line.indexOf('DK Benefits Benefits Compliance Checkup | Page') !== 0;
    });
    const last = lines[lines.length - 1] || '';
    assert.equal(HEADING_LINES.has(last), false, label + ' page ' + (index + 1) + ' ends on a heading: ' + last);
  });
  return pages;
}

async function printPdf(page, pdfPath) {
  await page.emulateMediaType('print');
  await page.pdf({ path: pdfPath, printBackground: true, preferCSSPageSize: true });
  return execFileSync('pdftotext', ['-layout', pdfPath, '-'], { encoding: 'utf8' });
}

async function answerPlan(page, plan) {
  for (let step = 0; step < 40; step += 1) {
    if (await page.$('#results-title')) return;
    const question = await page.$eval('#q-text', (el) => el.textContent);
    const match = plan.find((item) => question.includes(item.q));
    if (!match) throw new Error('No answer for: ' + question);
    for (let i = 0; i < match.picks.length; i += 1) await choose(page, match.picks[i]);
    await page.click('[data-action="next"]');
    await new Promise((resolve) => setTimeout(resolve, 40));
  }
  throw new Error('Quiz did not reach results');
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
    assert.match(fixture.html, /<section class="print-section print-keep"><h2>Notice and filing calendar<\/h2><table class="print-calendar">/);
    assert.match(fixture.html, /<div class="print-keep"><h2>Findings checklist<\/h2><section class="print-group print-keep">/);
    assert.match(fixture.withCompany, /<section class="print-section print-keep"><h2>Notice and filing calendar<\/h2><p class="print-empty">/);
    const longItems = [];
    for (let n = 1; n <= 5; n += 1) {
      longItems.push({ title: 'Action item ' + n, status: 'actionNeeded', action: 'Do the work for item ' + n + '.' });
    }
    const longCalendar = [];
    for (let n = 1; n <= 9; n += 1) {
      longCalendar.push({ when: 'Day ' + n, text: 'Filing row ' + n + ' stays with its own line.' });
    }
    const longHtml = await page.evaluate((items, calendar) => {
      return window.DKPrint.render({
        company: '',
        printed: window.DKPrint.printedDate(),
        score: '2',
        label: 'Significant gaps',
        sub: 'Several items need action.',
        priorities: [{ title: 'Action item 1', finding: 'This one comes first.', status: 'Action needed' }],
        items: items,
        calendar: calendar
      });
    }, longItems, longCalendar);
    assert.match(longHtml, /<div class="print-keep"><h2>Findings checklist<\/h2><h3>Action needed<\/h3><ul class="print-checks"><li class="print-item">[\s\S]*Action item 1[\s\S]*<\/ul><\/div><ul class="print-checks">[\s\S]*Action item 5/);
    assert.match(longHtml, /<div class="print-keep"><h2>Notice and filing calendar<\/h2><table class="print-calendar">[\s\S]*Filing row 1[\s\S]*Filing row 3[\s\S]*<\/table><\/div><table class="print-calendar">[\s\S]*Filing row 4[\s\S]*Filing row 9/);
    assert.doesNotMatch(longHtml.split('print-calendar-long')[1].split('</table>')[0], /Filing row 4/);
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

    if (commandOnPath('pdftotext')) {
      const pdfDir = fs.mkdtempSync(path.join(os.tmpdir(), 'print-report-'));
      const smallText = await printPdf(page, path.join(pdfDir, 'small.pdf'));
      const smallPages = assertHeadingsStay(smallText, 'no benefits');
      assert.equal(pageIndex(smallPages, 'Notice and filing calendar'), pageIndex(smallPages, 'No dated notices'));

      await page.evaluate(() => {
        const calendar = Array.from(document.querySelectorAll('h2')).find((heading) => heading.textContent === 'Notice and filing calendar');
        const block = calendar.closest('section');
        const spacer = document.createElement('p');
        spacer.className = 'print-spacer';
        spacer.textContent = 'File note. '.repeat(230);
        block.parentNode.insertBefore(spacer, block);
        const html = document.getElementById('print-report').innerHTML;
        // Printing rebuilds the report from the quiz, so restore the filler after that.
        window.addEventListener('beforeprint', () => {
          document.getElementById('print-report').innerHTML = html;
        });
      });
      const squeezed = assertHeadingsStay(await printPdf(page, path.join(pdfDir, 'squeezed.pdf')), 'squeezed calendar');
      const calendarPage = pageIndex(squeezed, 'Notice and filing calendar');
      assert.equal(calendarPage, pageIndex(squeezed, 'No dated notices'));
      assert.ok(calendarPage > 0, 'calendar heading stayed on page 1 beside a spacer that should have moved the section');

      const benefits = await browser.newPage();
      await benefits.goto('http://127.0.0.1:' + port + '/compliance-assessment-preview.html', { waitUntil: 'networkidle0' });
      await answerPlan(benefits, [
        { q: 'currently offer', picks: ['Yes. We currently offer benefits'] },
        { q: 'full-time employees', picks: ['50 or more'] },
        { q: 'kind of employer', picks: ['Private or other employer'] },
        { q: 'Which benefits', picks: ['Medical', 'Dental/Vision', 'Health FSA'] },
        { q: 'medical plan funded', picks: ['Fully insured through a carrier'] },
        { q: 'written ERISA plan document', picks: ['No. We do not have one'] },
        { q: 'Summary Plan Description', picks: ['No. Employees have not received an SPD'] },
        { q: 'Summary of Benefits', picks: ['No. Employees have not received an SBC'] },
        { q: 'contribute toward benefits', picks: ['Yes. Employees contribute through payroll'] },
        { q: 'taken pre-tax', picks: ['Yes. Deductions are pre-tax'] },
        { q: 'cafeteria plan', picks: ['No. We do not have one'] },
        { q: 'Notices and filings', picks: ['None of these yet'] },
        { q: 'Marketplace coverage notice', picks: ['No. We do not provide this notice'] },
        { q: 'RxDC', picks: ['No'] },
        { q: 'gag clause', picks: ['No'] },
        { q: 'COBRA notices', picks: ['No one is handling it'] },
        { q: 'following apply', picks: ['None of these apply'] },
        { q: 'enrolled in at least one benefit', picks: ['Fewer than 100 enrolled'] }
      ]);
      await benefits.waitForSelector('#results-title');
      await benefits.evaluate(() => window.DKPrint.mount());
      const benefitsText = await printPdf(benefits, path.join(pdfDir, 'benefits.pdf'));
      const benefitsPages = assertHeadingsStay(benefitsText, 'benefits 50+');
      assert.equal(pageIndex(benefitsPages, 'Notice and filing calendar'), pageIndex(benefitsPages, 'NOTICE OR FILING'));
      await benefits.close();
    }
  } finally {
    await browser.close();
    await new Promise((resolve) => server.close(resolve));
  }
});
