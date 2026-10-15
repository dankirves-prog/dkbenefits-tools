const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const test = require('node:test');

const quiz = require('../quiz-engine.js');
const ROOT = path.join(__dirname, '../..');

function card(scored, key) {
  return (scored.cards || []).find((item) => item.key === key);
}

function line(scored, label) {
  return (scored.snapshot.lines || []).find((item) => item.label === label);
}

test('1. no benefits under 20 with no part-time is a short path, last step N of N', () => {
  const answers = {
    offerBenefits: 'no',
    employeeCount: 'under20',
    partTime: 'no',
    employerType: 'private',
    exchangeNotice: 'yes',
    nobenGrowth: 'no',
    nobenCompetition: 'no'
  };
  const visible = quiz.visibleQuestions(answers);
  assert.equal(visible.length, 7);
  const last = quiz.stepProgress(answers, visible.length - 1);
  assert.equal(last.exact, true);
  assert.equal(last.step, last.total);
  assert.equal(last.total, 7);
  const start = quiz.stepProgress({}, 0);
  assert.equal(start.step, 1);
  assert.equal(start.showTotal, false);
  assert.equal(start.total, 0);
  const early = quiz.stepProgress({ offerBenefits: 'no' }, 0);
  assert.equal(early.showTotal, true);
  assert.equal(early.exact, false);
  assert.equal(early.total, 7);
  const benefitsAbout = quiz.stepProgress({ offerBenefits: 'yes' }, 0);
  assert.equal(benefitsAbout.exact, false);
  assert.ok(benefitsAbout.total > early.total);
  const partialVisible = quiz.visibleQuestions({ offerBenefits: 'yes' });
  const partialLast = quiz.stepProgress({ offerBenefits: 'yes' }, partialVisible.length - 1);
  assert.equal(partialLast.exact, true);
  assert.equal(partialLast.step, partialVisible.length);
  assert.equal(partialLast.total, partialVisible.length);
  assert.deepEqual(quiz.contactHref(false), { href: '#contact-box', target: '' });
  assert.deepEqual(quiz.contactHref(true), { href: 'https://www.dkbenefits.net/contact', target: '_top' });
  const forward = quiz.progressPercent(0, quiz.stepProgress({ offerBenefits: 'yes' }, 4));
  const back = quiz.progressPercent(forward, quiz.stepProgress({ offerBenefits: 'yes' }, 1));
  assert.equal(back, forward);
  assert.ok(quiz.progressPercent(back, last) >= back);
  assert.equal(quiz.visibleQuestions({}).some((q) => q.id === 'benefitsOffered'), false);
  assert.equal(quiz.visibleQuestions({}).some((q) => q.id === 'enrolledCount'), false);
  assert.equal(quiz.visibleQuestions({}).some((q) => q.id === 'noticesSent'), false);
});

test('2. no benefits 20 to 49 with part-time confirms ALE', () => {
  const scored = quiz.scoreAnswers({
    offerBenefits: 'no',
    employeeCount: '20to49',
    partTime: 'yes',
    employerType: 'private',
    exchangeNotice: 'yes',
    nobenGrowth: 'no',
    nobenCompetition: 'no'
  });
  assert.equal(scored.flags.ale, 'confirmAle');
  assert.equal(line(scored, 'ACA employer mandate').value, 'Confirm ALE status');
  assert.equal(card(scored, 'confirm_ale').status, 'confirm');
});

test('3. no benefits 50 or more shows ACA cards and a low or blank score', () => {
  const scored = quiz.scoreAnswers({
    offerBenefits: 'no',
    employeeCount: '50plus',
    employerType: 'private',
    exchangeNotice: 'no',
    nobenGrowth: 'no',
    nobenCompetition: 'no'
  });
  assert.ok(card(scored, 'aca_no_coverage'));
  assert.ok(card(scored, 'aca_reporting'));
  assert.ok(scored.readiness.score == null || scored.readiness.score <= 3);
  assert.equal(quiz.visibleQuestions(scored.flags && {
    offerBenefits: 'no',
    employeeCount: '50plus'
  }).some((q) => q.id === 'partTime'), false);
});

test('4. benefits at 50 or more with dental only skips affordability and caps the score', () => {
  const scored = quiz.scoreAnswers({
    offerBenefits: 'yes',
    employeeCount: '50plus',
    employerType: 'private',
    benefitsOffered: ['dentalVision'],
    wrapPlanInPlace: 'yes',
    wrapPlanAge: 'within1year',
    spdDistributed: 'yes',
    employeeContrib: 'no',
    exchangeNotice: 'yes',
    planStructure: ['none'],
    enrolledCount: 'under100'
  });
  assert.equal(card(scored, 'aca_4980h_b'), undefined);
  assert.ok(scored.readiness.score <= 3);
  assert.equal(scored.priorities[0].status, 'actionNeeded');
});

test('5. a governmental employer with 100 enrolled does not get Form 5500', () => {
  const answers = {
    offerBenefits: 'yes',
    employeeCount: '50plus',
    employerType: 'governmental',
    benefitsOffered: ['medical'],
    medicalFunding: 'fullyInsured',
    wrapPlanInPlace: 'yes',
    spdDistributed: 'yes',
    sbcDistributed: 'yes',
    employeeContrib: 'no',
    noticesSent: ['partD', 'partDCms', 'chip', 'whcra', 'hipaaSpecial'],
    exchangeNotice: 'yes',
    rxdcStatus: 'carrierFiled',
    gagClause: 'carrierFiled',
    cobraAdmin: 'thirdParty',
    planStructure: ['none'],
    enrolledCount: '100plus'
  };
  const scored = quiz.scoreAnswers(answers);
  assert.equal(scored.form5500.status, 'notApplicable');
  assert.equal(card(scored, 'form5500'), undefined);
  const ids = quiz.visibleQuestions(answers).map((q) => q.id);
  assert.equal(ids.indexOf('enrolledCount'), -1);
  assert.equal(ids.indexOf('planStructure'), -1);
});

test('6. 50 or more that already files Form 5500 is in place, with no filing deduction', () => {
  const base = {
    offerBenefits: 'yes',
    employeeCount: '50plus',
    employerType: 'private',
    benefitsOffered: ['medical'],
    medicalFunding: 'fullyInsured',
    wrapPlanInPlace: 'yes',
    wrapPlanAge: 'within1year',
    spdDistributed: 'yes',
    sbcDistributed: 'yes',
    employeeContrib: 'no',
    noticesSent: ['partD', 'partDCms', 'chip', 'whcra', 'hipaaSpecial'],
    exchangeNotice: 'yes',
    rxdcStatus: 'carrierFiled',
    gagClause: 'carrierFiled',
    cobraAdmin: 'thirdParty',
    enrolledCount: '100plus'
  };
  const filed = quiz.scoreAnswers(Object.assign({}, base, { planStructure: ['prior5500'] }));
  const missing = quiz.scoreAnswers(Object.assign({}, base, { planStructure: ['none'] }));
  assert.equal(filed.form5500.status, 'required');
  assert.equal(card(filed, 'form5500').status, 'inPlace');
  assert.equal(card(filed, 'cobra').cta.type, 'contact');
  assert.equal(card(filed, 'cobra').cta.label, 'Talk to our team');
  [filed, missing].forEach((scored) => {
    (scored.cards || []).forEach((item) => {
      if (!item.cta || item.cta.type === 'contact') return;
      assert.match(item.cta.label, /\bfree\b/);
    });
  });
  assert.equal(card(missing, 'form5500').status, 'actionNeeded');
  assert.ok(filed.readiness.score > missing.readiness.score);
  for (let i = 1; i < filed.priorities.length; i += 1) {
    const rank = { actionNeeded: 0, confirm: 1 };
    const prev = rank[filed.priorities[i - 1].status];
    const current = rank[filed.priorities[i].status];
    assert.ok(prev < current || (prev === current && filed.priorities[i - 1].exposure >= filed.priorities[i].exposure));
  }
});

test('7. Marketplace notice No is action needed on both paths', () => {
  const benefits = quiz.scoreAnswers({
    offerBenefits: 'yes',
    employeeCount: '20to49',
    partTime: 'no',
    employerType: 'private',
    benefitsOffered: ['medical'],
    medicalFunding: 'fullyInsured',
    wrapPlanInPlace: 'yes',
    wrapPlanAge: 'within1year',
    spdDistributed: 'yes',
    sbcDistributed: 'yes',
    employeeContrib: 'no',
    noticesSent: ['partD', 'partDCms', 'chip', 'whcra', 'hipaaSpecial'],
    exchangeNotice: 'no',
    rxdcStatus: 'carrierFiled',
    gagClause: 'carrierFiled',
    cobraAdmin: 'thirdParty',
    planStructure: ['none'],
    enrolledCount: 'under100'
  });
  const none = quiz.scoreAnswers({
    offerBenefits: 'no',
    employeeCount: 'under20',
    partTime: 'no',
    employerType: 'private',
    exchangeNotice: 'no',
    nobenGrowth: 'no',
    nobenCompetition: 'no'
  });
  assert.equal(card(benefits, 'exchange_notice').status, 'actionNeeded');
  assert.equal(card(none, 'exchange_notice').status, 'actionNeeded');
});

test('8. level-funded under 20 gets a parity note', () => {
  const scored = quiz.scoreAnswers({
    offerBenefits: 'yes',
    employeeCount: 'under20',
    partTime: 'no',
    employerType: 'private',
    benefitsOffered: ['medical'],
    medicalFunding: 'levelFunded',
    wrapPlanInPlace: 'yes',
    wrapPlanAge: 'within1year',
    spdDistributed: 'yes',
    sbcDistributed: 'yes',
    employeeContrib: 'no',
    noticesSent: ['partD', 'partDCms', 'chip', 'whcra', 'hipaaSpecial'],
    exchangeNotice: 'yes',
    rxdcStatus: 'weFiled',
    gagClause: 'weFiled',
    hipaaPrivacy: 'yes',
    employerState: 'FL',
    planStructure: ['none']
  });
  assert.equal(card(scored, 'parity').status, 'note');
});

test('9. Florida insured under 20 continuation is a note and not a top priority', () => {
  const scored = quiz.scoreAnswers({
    offerBenefits: 'yes',
    employeeCount: 'under20',
    partTime: 'no',
    employerType: 'private',
    benefitsOffered: ['medical'],
    medicalFunding: 'fullyInsured',
    wrapPlanInPlace: 'no',
    spdDistributed: 'no',
    sbcDistributed: 'no',
    employeeContrib: 'no',
    noticesSent: ['none'],
    exchangeNotice: 'no',
    rxdcStatus: 'no',
    gagClause: 'no',
    employerState: 'FL',
    planStructure: ['none']
  });
  assert.equal(card(scored, 'state_cobra').status, 'note');
  assert.equal(scored.priorities.some((item) => item.key === 'state_cobra'), false);
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
    const found = execFileSync(finder, [name], { encoding: 'utf8' }).trim().split(/\r?\n/)[0];
    return found || '';
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

async function openBrowser(t) {
  const puppeteer = loadPuppeteer();
  const executablePath = findChrome();
  if (!puppeteer || !executablePath) {
    t.skip('A Chrome binary and puppeteer-core are required for this browser check.');
    return null;
  }
  return puppeteer.launch({
    executablePath: executablePath,
    headless: 'new',
    args: ['--no-sandbox', '--disable-dev-shm-usage']
  });
}

test('10. iframe Start over shrinks the measured height', async (t) => {
  const browser = await openBrowser(t);
  if (!browser) return;
  const server = await startServer();
  const port = server.address().port;
  try {
    const page = await browser.newPage();
    await page.setContent('<!DOCTYPE html><iframe id="frame" style="width:800px;height:4000px;border:0" src="http://127.0.0.1:' + port + '/compliance-assessment-preview.html"></iframe><script>window.heights=[];window.addEventListener("message",function(e){if(e.data&&e.data.type==="resize")window.heights.push(e.data.height);});</script>', { waitUntil: 'load' });
    const frame = page.frames().find((item) => item.url().indexOf('compliance-assessment-preview') !== -1);
    await frame.waitForSelector('.option');
    const steps = [
      'No. We do not currently offer benefits',
      'Fewer than 20',
      'No. Most employees are full-time',
      'Private or other employer',
      'Yes. It is in our new-hire packet',
      'No. Headcount will stay about the same',
      'No. Benefits are not a hiring factor'
    ];
    for (let i = 0; i < steps.length; i += 1) {
      await choose(frame, steps[i]);
      if (i === steps.length - 1) {
        const label = await frame.$eval('.progress-label span', (el) => el.textContent);
        const button = await frame.$eval('[data-action="next"]', (el) => el.textContent.trim());
        assert.equal(button, 'See results');
        assert.equal(label, 'Step ' + steps.length + ' of ' + steps.length);
      }
      await frame.click('[data-action="next"]');
      await new Promise((r) => setTimeout(r, 40));
    }
    await frame.waitForSelector('#top3');
    await new Promise((r) => setTimeout(r, 80));
    const tall = await page.evaluate(() => window.heights[window.heights.length - 1]);
    await frame.click('[data-action="restart"]');
    await frame.waitForSelector('.option');
    await new Promise((r) => setTimeout(r, 80));
    const short = await page.evaluate(() => window.heights[window.heights.length - 1]);
    assert.ok(short < tall, 'start over height ' + short + ' should be below results ' + tall);
    assert.ok(short < 1200, 'start over still matched the tall iframe: ' + short);
  } finally {
    await browser.close();
    await new Promise((resolve) => server.close(resolve));
  }
});

test('11. Enter on Back goes back', async (t) => {
  const browser = await openBrowser(t);
  if (!browser) return;
  const server = await startServer();
  const port = server.address().port;
  try {
    const page = await browser.newPage();
    await page.goto('http://127.0.0.1:' + port + '/compliance-assessment-preview.html', { waitUntil: 'networkidle0' });
    const opening = await page.$eval('.progress-label span', (el) => el.textContent);
    assert.equal(opening, 'Step 1');
    await choose(page, 'Yes. We currently offer benefits');
    const about = await page.$eval('.progress-label span', (el) => el.textContent);
    assert.equal(about, 'Step 1 of about 22');
    await page.click('[data-action="next"]');
    await page.waitForFunction(() => document.getElementById('q-text').textContent.indexOf('full-time') !== -1);
    const advanced = Number((await page.$eval('.progress-fill', (el) => el.style.width)).replace('%', ''));
    await page.focus('[data-action="back"]');
    await page.keyboard.press('Enter');
    await page.waitForFunction(() => document.getElementById('q-text').textContent.indexOf('currently offer') !== -1);
    const text = await page.$eval('#q-text', (el) => el.textContent);
    const returned = Number((await page.$eval('.progress-fill', (el) => el.style.width)).replace('%', ''));
    assert.match(text, /currently offer/);
    assert.ok(returned >= advanced, 'progress fell from ' + advanced + ' to ' + returned);
  } finally {
    await browser.close();
    await new Promise((resolve) => server.close(resolve));
  }
});
