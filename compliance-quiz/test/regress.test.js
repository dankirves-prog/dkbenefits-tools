const assert = require('node:assert/strict');
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
  assert.equal(last.step, last.total);
  assert.equal(last.total, 7);
  const start = quiz.stepProgress({}, 0);
  assert.equal(start.step, 1);
  assert.equal(start.total, quiz.visibleQuestions({}).length);
  assert.ok(start.total < quiz.questions.length);
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

test('10. iframe Start over shrinks the measured height', async () => {
  const puppeteer = require('/workspace/section128/node_modules/puppeteer-core');
  const server = await startServer();
  const port = server.address().port;
  const browser = await puppeteer.launch({
    executablePath: '/usr/local/bin/google-chrome',
    headless: 'new',
    args: ['--no-sandbox', '--disable-dev-shm-usage']
  });
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
    for (const label of steps) {
      await choose(frame, label);
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

test('11. Enter on Back goes back', async () => {
  const puppeteer = require('/workspace/section128/node_modules/puppeteer-core');
  const server = await startServer();
  const port = server.address().port;
  const browser = await puppeteer.launch({
    executablePath: '/usr/local/bin/google-chrome',
    headless: 'new',
    args: ['--no-sandbox', '--disable-dev-shm-usage']
  });
  try {
    const page = await browser.newPage();
    await page.goto('http://127.0.0.1:' + port + '/compliance-assessment-preview.html', { waitUntil: 'networkidle0' });
    await choose(page, 'Yes. We currently offer benefits');
    await page.click('[data-action="next"]');
    await page.waitForFunction(() => document.getElementById('q-text').textContent.indexOf('full-time') !== -1);
    await page.focus('[data-action="back"]');
    await page.keyboard.press('Enter');
    await page.waitForFunction(() => document.getElementById('q-text').textContent.indexOf('currently offer') !== -1);
    const text = await page.$eval('#q-text', (el) => el.textContent);
    assert.match(text, /currently offer/);
  } finally {
    await browser.close();
    await new Promise((resolve) => server.close(resolve));
  }
});
