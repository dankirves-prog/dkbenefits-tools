const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const quiz = require('../quiz-engine.js');

function noBenefits(extra) {
  return Object.assign({
    offerBenefits: 'no',
    employeeCount: '20to49',
    partTime: 'no',
    employerType: 'private',
    exchangeNotice: 'yes',
    nobenGrowth: 'no',
    nobenCompetition: 'no'
  }, extra || {});
}

function benefits(extra) {
  return Object.assign({
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
    exchangeNotice: 'yes',
    rxdcStatus: 'carrierFiled',
    gagClause: 'carrierFiled',
    cobraAdmin: 'thirdParty',
    planStructure: ['none'],
    enrolledCount: 'under100'
  }, extra || {});
}

function line(scored, label) {
  return (scored.snapshot.lines || []).find((item) => item.label === label);
}

function card(scored, key) {
  return (scored.cards || []).find((item) => item.key === key);
}

function blob(scored) {
  return JSON.stringify(scored);
}

test('no-benefits 20 to 49 with part-time confirms ALE and scores lower', () => {
  const flagged = quiz.scoreAnswers(noBenefits({ partTime: 'yes' }));
  const clear = quiz.scoreAnswers(noBenefits({ partTime: 'no' }));
  assert.equal(flagged.flags.ale, 'confirmAle');
  assert.equal(line(flagged, 'ACA employer mandate').value, 'Confirm ALE status');
  assert.equal(clear.flags.ale, 'unlikely');
  assert.ok(flagged.readiness.score < clear.readiness.score);
  assert.ok(clear.readiness.score - flagged.readiness.score >= 1);
});

test('not sure headcount confirms size and keeps COBRA in view', () => {
  const scored = quiz.scoreAnswers(noBenefits({ employeeCount: 'notSure', partTime: 'no' }));
  assert.equal(scored.flags.ale, 'confirmSize');
  assert.equal(line(scored, 'ACA employer mandate').value, 'Confirm your size');
  assert.ok(card(scored, 'cobra_consideration'));
  assert.equal(card(scored, 'confirm_size').status, 'confirm');
});

test('level-funded medical is self-funded for PCORI and 105(h)', () => {
  const scored = quiz.scoreAnswers(benefits({
    medicalFunding: 'levelFunded',
    gagClause: 'notSure',
    hipaaPrivacy: 'notSure'
  }));
  assert.equal(scored.flags.selfOrLevel, true);
  assert.equal(scored.flags.levelFunded, true);
  const pcori = card(scored, 'pcori');
  assert.ok(pcori);
  assert.match(pcori.summary + pcori.description, /TPA/);
  assert.ok(card(scored, 'nd_105h'));
  assert.match(card(scored, 'nd_105h').summary, /level-funded/);
});

test('dental only skips medical notices and the medical calendar', () => {
  const scored = quiz.scoreAnswers(benefits({
    employeeCount: 'under20',
    benefitsOffered: ['dentalVision'],
    medicalFunding: undefined,
    sbcDistributed: undefined,
    noticesSent: undefined,
    rxdcStatus: undefined,
    gagClause: undefined,
    cobraAdmin: undefined
  }));
  assert.equal(scored.flags.medicalOffered, false);
  ['annual_notices', 'rxdc', 'gag_clause', 'sbc', 'parity', 'pcori', 'nd_105h'].forEach((key) => {
    assert.equal(card(scored, key), undefined, key);
  });
  assert.deepEqual(scored.calendar, []);
  assert.equal(blob(scored).includes('WHCRA'), false);
});

test('Form 5500 follows trust, MEWA, and enrolled count, not headcount', () => {
  const trust = quiz.scoreAnswers(benefits({
    employeeCount: 'under20',
    enrolledCount: 'under100',
    planStructure: ['trust'],
    cobraAdmin: undefined
  }));
  assert.equal(trust.form5500.status, 'required');
  assert.equal(trust.form5500.reason, 'trust');

  const mewa = quiz.scoreAnswers(benefits({
    employeeCount: 'under20',
    enrolledCount: 'under100',
    planStructure: ['mewa'],
    cobraAdmin: undefined
  }));
  assert.equal(mewa.form5500.status, 'required');
  assert.match(mewa.form5500.note, /Form M-1 and Form 5500/);

  const largeHeadcount = quiz.scoreAnswers(benefits({
    employeeCount: '50plus',
    enrolledCount: 'under100',
    planStructure: ['none']
  }));
  assert.equal(largeHeadcount.form5500.status, 'notRequired');
  assert.equal(card(largeHeadcount, 'form5500'), undefined);
});

test('readiness label, color, and subtext come from one table', () => {
  [1, 3, 4.5, 5, 7, 8.5, 9, 10].forEach((score) => {
    const band = quiz.readinessFor(score);
    const expected = quiz.READINESS_BANDS.find((item) => band.score >= item.min);
    assert.equal(band.label, expected.label);
    assert.equal(band.className, expected.className);
    assert.equal(band.sub, expected.sub);
  });
  const unsure = quiz.scoreAnswers(benefits({ wrapPlanInPlace: 'notSure', wrapPlanAge: undefined }));
  const sure = quiz.scoreAnswers(benefits());
  assert.ok(sure.readiness.score - unsure.readiness.score >= 1);
});

test('top priorities are the three highest action or confirm items', () => {
  const scored = quiz.scoreAnswers(benefits({
    wrapPlanInPlace: 'no',
    spdDistributed: 'no',
    sbcDistributed: 'no',
    noticesSent: ['none'],
    rxdcStatus: 'no',
    gagClause: 'no'
  }));
  assert.ok(scored.priorities.length <= 3);
  assert.ok(scored.priorities.length > 0);
  scored.priorities.forEach((item) => {
    assert.ok(item.status === 'actionNeeded' || item.status === 'confirm');
  });
  const exposures = scored.priorities.map((item) => item.exposure);
  const sorted = exposures.slice().sort((a, b) => b - a);
  assert.deepEqual(exposures, sorted);
});

test('visitor copy has no em dashes, prices, indexed percentages, or calendar years', () => {
  const files = [
    'quiz-engine.js',
    'quiz-ui.js',
    'quiz.css',
    '../compliance-assessment.html',
    '../compliance-assessment-preview.html',
    'apps-script/ComplianceLeads.gs'
  ];
  const scored = quiz.scoreAnswers(benefits({
    medicalFunding: 'levelFunded',
    employeeCount: '50plus',
    partTime: 'notSure',
    pretax: 'no',
    employeeContrib: 'yes',
    benefitsOffered: ['medical', 'healthFsa', 'hra', 'dcap'],
    hraNotice: 'notSure',
    hipaaPrivacy: 'no',
    employerState: 'FL',
    noticesSent: ['none']
  }));
  const source = files.map((file) => fs.readFileSync(path.join(__dirname, '..', file), 'utf8')).join('\n');
  const visitor = quiz.copyBlob() + '\n' + blob(scored) + '\n' + source;
  assert.equal(visitor.includes('\u2014'), false);
  assert.equal(visitor.includes('\u2013'), false);
  assert.equal(visitor.includes('95%'), false);
  assert.equal(/\b20\d{2}\b/.test(visitor), false);
  const prices = (quiz.copyBlob() + '\n' + blob(scored)).includes('$');
  assert.equal(prices, false);
});
