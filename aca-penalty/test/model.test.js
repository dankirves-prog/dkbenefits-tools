const assert = require('node:assert/strict');
const test = require('node:test');
const ACA = require('../aca-model');

const ALL = [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1];

function base(extra) {
  return Object.assign({
    year: 2026,
    priorMode: 'average',
    averageFullTime: 120,
    averagePartTimeHours: 0,
    newEmployer: false,
    seasonalAttest: false,
    controlledGroup: false,
    penaltyMode: 'same',
    fullTime: 120,
    nonAssessment: 0,
    offer: 'below',
    anyCredit: true,
    ptcCount: 1,
    months: ALL.slice(),
    affordUse: false,
    minimumValue: true
  }, extra || {});
}

test('2026 indexed amounts and the FPL safe-harbor cent', function () {
  assert.equal(ACA.YEARS[2026].aAnnual, 3340);
  assert.equal(ACA.YEARS[2026].bAnnual, 5010);
  assert.equal(ACA.YEARS[2026].rateLabel, '9.96%');
  assert.equal(ACA.fplMaxMonthlyCents(15650, 996, 10000), 12989);
  assert.equal(ACA.money(12989), '$129.89');
  assert.equal(ACA.fplMaxMonthlyCents(15960, 996, 10000), 13246);
  assert.equal(ACA.money(13246), '$132.46');
});

test('120 full-time employees with no offer owe the 2026 A penalty', function () {
  const result = ACA.calculate(base());
  assert.equal(result.ok, true);
  assert.equal(result.prior.isAle, true);
  assert.equal(result.kind, 'a');
  assert.equal(result.actualCents, 30060000);
  assert.equal(ACA.money(result.actualCents), '$300,600');
  assert.equal(result.aMonthlyCents, 2505000);
  assert.equal(ACA.money(result.aMonthlyCents), '$25,050');
  assert.equal(result.scenarioNothingCents, 30060000);
  assert.match(result.report, /\$300,600/);
  assert.match(result.report, /Section 4980H\(a\)/);
});

test('80 full-time employees and 6 credits use the B penalty under the A cap', function () {
  const result = ACA.calculate(base({
    averageFullTime: 80,
    fullTime: 80,
    offer: 'unaffordable',
    ptcCount: 6,
    premium: '450',
    affordUse: true,
    harbor: 'fpl',
    location: 'mainland',
    planStart: 'calendar'
  }));
  assert.equal(result.ok, true);
  assert.equal(result.kind, 'b');
  assert.equal(result.actualCents, 3006000);
  assert.equal(ACA.money(result.actualCents), '$30,060');
  assert.equal(ACA.money(result.bMonthlyCents), '$2,505');
  assert.equal(result.bCapped, false);
  assert.equal(result.scenarioNothingCents, 16700000);
  assert.equal(ACA.money(result.scenarioNothingCents), '$167,000');
  assert.equal(result.afford.passes, false);
  assert.match(result.summary.affordabilityResult, /does not meet/i);
});

test('an under-50 company is not an ALE and has no 4980H estimate', function () {
  const result = ACA.calculate(base({
    averageFullTime: 30,
    averagePartTimeHours: 1200,
    fullTime: 30,
    offer: 'below',
    ptcCount: 1
  }));
  assert.equal(result.ok, true);
  assert.equal(result.prior.fteRounded, 10);
  assert.equal(result.prior.rounded, 40);
  assert.equal(result.prior.isAle, false);
  assert.equal(result.kind, 'notAle');
  assert.equal(result.actualCents, 0);
  assert.equal(result.aAnnualCents, 0);
  assert.equal(result.bAnnualCents, 0);
  assert.match(result.report, /does not apply/i);
  assert.match(result.report, /\$3,340/);
  assert.match(result.report, /\$5,010/);
});

test('the IRS full-time-equivalent example reaches exactly 50', function () {
  const result = ACA.calculate(base({
    averageFullTime: 40,
    averagePartTimeHours: 1200,
    fullTime: 40
  }));
  assert.equal(result.prior.rounded, 50);
  assert.equal(result.prior.isAle, true);
});

test('49.9 rounds down and is not an ALE; 50.0 is', function () {
  const under = ACA.calculate(base({ averageFullTime: 49, averagePartTimeHours: 108, fullTime: 49 }));
  assert.ok(Math.abs(under.prior.exact - 49.9) < 0.001);
  assert.equal(under.prior.rounded, 49);
  assert.equal(under.prior.isAle, false);
  const at = ACA.calculate(base({ averageFullTime: 49, averagePartTimeHours: 120, fullTime: 49 }));
  assert.equal(at.prior.rounded, 50);
  assert.equal(at.prior.isAle, true);
});

test('the seasonal-worker exception follows the regulation examples', function () {
  const seasonal = [];
  const over = [];
  for (let i = 0; i < 12; i++) {
    seasonal.push({ fullTime: i < 8 ? 40 : 120, partTimeHours: 0 });
    over.push({ fullTime: i < 7 ? 40 : (i === 7 ? 40 : 120), partTimeHours: i === 7 ? 2400 : 0 });
  }
  const excused = ACA.calculate(base({
    priorMode: 'months',
    priorMonths: seasonal,
    seasonalAttest: true,
    fullTime: 40
  }));
  assert.equal(excused.prior.rounded, 66);
  assert.equal(excused.prior.monthsOver, 4);
  assert.equal(excused.prior.seasonalApplied, true);
  assert.equal(excused.prior.isAle, false);

  const still = ACA.calculate(base({
    priorMode: 'months',
    priorMonths: over,
    seasonalAttest: true,
    fullTime: 40
  }));
  assert.equal(still.prior.rounded, 68);
  assert.equal(still.prior.monthsOver, 5);
  assert.equal(still.prior.seasonalApplied, false);
  assert.equal(still.prior.isAle, true);
  assert.match(still.report, /does not apply/i);
});

test('a controlled group combines before rounding and rounds the 30-employee share up', function () {
  assert.equal(ACA.allocableReduction(40, 35), 16);
  assert.equal(ACA.allocableReduction(10, 100), 3);
  const result = ACA.calculate(base({
    averageFullTime: 20,
    fullTime: 20,
    controlledGroup: true,
    otherMembersAverage: 31,
    otherMembersFullTime: 40,
    offer: 'below',
    anyCredit: true,
    ptcCount: 1
  }));
  assert.equal(result.prior.ownRounded, 20);
  assert.equal(result.prior.rounded, 51);
  assert.equal(result.prior.isAle, true);
  assert.equal(result.monthRows[0].reduction, 10);
  assert.equal(result.actualCents, 10 * 3340 * 100);
  assert.match(result.summary.aleStatus, /controlled group/i);
});

test('the offer test uses 95 percent or all but five, whichever allows more misses', function () {
  assert.equal(ACA.meetsOffer(5, 80), true);
  assert.equal(ACA.meetsOffer(6, 80), false);
  assert.equal(ACA.meetsOffer(10, 200), true);
  assert.equal(ACA.meetsOffer(11, 200), false);
  assert.equal(ACA.meetsOffer(5, 90), true);
  assert.equal(ACA.meetsOffer(5, 110), true);
  assert.equal(ACA.meetsOffer(6, 110), false);
  const passed = ACA.calculate(base({ fullTime: 80, averageFullTime: 80, notOffered: 5, offer: 'below' }));
  assert.equal(passed.offerMet, true);
  assert.notEqual(passed.kind, 'a');
});

test('safe harbors use the greatest cent that does not exceed 9.96 percent', function () {
  const pass = ACA.calculate(base({
    offer: 'affordable',
    ptcCount: 2,
    anyCredit: true,
    premium: '129.89',
    affordUse: true,
    harbor: 'fpl',
    location: 'mainland',
    planStart: 'calendar'
  }));
  assert.equal(pass.afford.passes, true);
  assert.equal(pass.kind, 'zero');
  assert.equal(pass.actualCents, 0);

  const fail = ACA.calculate(base({
    offer: 'affordable',
    ptcCount: 2,
    premium: '129.90',
    affordUse: true,
    harbor: 'fpl'
  }));
  assert.equal(fail.afford.passes, false);
  assert.equal(fail.kind, 'b');
  assert.equal(fail.actualCents, 2 * 5010 * 100);

  const w2 = ACA.calculate(base({
    offer: 'affordable',
    premium: '332.00',
    affordUse: true,
    harbor: 'w2',
    w2Wages: '40000'
  }));
  assert.equal(w2.afford.passes, true);
  const w2fail = ACA.calculate(base({
    offer: 'affordable',
    premium: '332.01',
    affordUse: true,
    harbor: 'w2',
    w2Wages: '40000'
  }));
  assert.equal(w2fail.afford.passes, false);

  const rate = ACA.calculate(base({
    offer: 'affordable',
    premium: '258.96',
    affordUse: true,
    harbor: 'rate',
    payType: 'hourly',
    hourlyRate: '20'
  }));
  assert.equal(rate.afford.passes, true);
  assert.equal(rate.afford.maxCents, 25896);
  const salary = ACA.calculate(base({
    offer: 'affordable',
    premium: '398.40',
    affordUse: true,
    harbor: 'rate',
    payType: 'salary',
    monthlySalary: '4000'
  }));
  assert.equal(salary.afford.passes, true);
});

test('the B penalty is capped at the A penalty', function () {
  const result = ACA.calculate(base({
    averageFullTime: 60,
    fullTime: 40,
    offer: 'unaffordable',
    ptcCount: 10
  }));
  assert.equal(result.bCapped, true);
  assert.equal(result.actualCents, 10 * 3340 * 100);
  assert.equal(ACA.money(result.actualCents), '$33,400');
});

test('six months is half of a full-year A penalty, and months can differ', function () {
  const months = [1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0];
  const half = ACA.calculate(base({ months: months }));
  assert.equal(half.monthCount, 6);
  assert.equal(half.actualCents, 15030000);
  assert.equal(ACA.money(half.aMonthlyCents), '$25,050');
  assert.match(half.summary.monthsAffected, /January/);
  assert.doesNotMatch(half.summary.monthsAffected, /July/);

  const penaltyMonths = [];
  for (let i = 0; i < 12; i++) {
    penaltyMonths.push({
      include: i < 2,
      fullTime: i === 0 ? 120 : 100,
      ptcCount: 1
    });
  }
  const varied = ACA.calculate(base({ penaltyMode: 'months', penaltyMonths: penaltyMonths }));
  assert.equal(varied.identical, false);
  assert.equal(varied.monthRows.length, 2);
  assert.equal(varied.monthRows[0].aCents, 2505000);
  assert.equal(varied.actualCents, varied.monthRows[0].aCents + varied.monthRows[1].aCents);
  assert.match(varied.report, /January/);
  assert.match(varied.report, /February/);
});

test('no premium tax credit means no payment, and 2027 uses the later indexed amounts', function () {
  const none = ACA.calculate(base({ anyCredit: false, ptcCount: 0 }));
  assert.equal(none.kind, 'noCredit');
  assert.equal(none.actualCents, 0);
  const y2027 = ACA.calculate(base({ year: 2027 }));
  assert.equal(y2027.actualCents, 90 * 3780 * 100);
  assert.equal(ACA.money(y2027.actualCents), '$340,200');
  assert.equal(ACA.money(y2027.aMonthlyCents), '$28,350');
  const fpl2027 = ACA.calculate(base({
    year: 2027,
    offer: 'affordable',
    premium: '135.92',
    affordUse: true,
    harbor: 'fpl',
    planStart: 'calendar',
    location: 'mainland'
  }));
  assert.equal(fpl2027.afford.passes, true);
  assert.equal(fpl2027.afford.maxCents, 13592);
});

test('a 200-employee no-offer example matches the full-year formula', function () {
  const result = ACA.calculate(base({ averageFullTime: 200, fullTime: 200, ptcCount: 1 }));
  assert.equal(result.actualCents, 170 * 3340 * 100);
  assert.equal(ACA.money(result.actualCents), '$567,800');
  assert.equal(ACA.money(result.aMonthlyCents), '$47,316.67');
});

test('minimum value is required before a safe harbor can pass', function () {
  const result = ACA.calculate(base({
    offer: 'affordable',
    premium: '100',
    affordUse: true,
    harbor: 'fpl',
    minimumValue: false,
    ptcCount: 1
  }));
  assert.equal(result.afford.passes, false);
  assert.equal(result.kind, 'b');
});
