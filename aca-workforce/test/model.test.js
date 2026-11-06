const assert = require('node:assert/strict');
const test = require('node:test');
const ATNE = require('../atne-model');

function monthsOf(fullTimes, hoursList) {
  const months = [];
  for (let i = 0; i < 12; i++) {
    months.push({
      fullTime: fullTimes[i],
      hours: hoursList ? hoursList[i] : 0
    });
  }
  return months;
}

function repeat(value) {
  return Array.from({ length: 12 }, function () { return value; });
}

test('the 120-hour cap applies per employee, then hours divide by 120', function () {
  assert.equal(ATNE.HOURS_CAP, 120);
  assert.equal(ATNE.capEmployeeHours(200), 120);
  assert.equal(ATNE.capEmployeeHours(120), 120);
  assert.equal(ATNE.capEmployeeHours(119.5), 119.5);
  assert.equal(ATNE.capEmployeeHours(0), 0);

  const threeModest = ATNE.aggregateFromHeadcount(3, 100, 'month');
  assert.equal(threeModest.cappedHours, 300);
  assert.equal(ATNE.fteFromHours(threeModest.cappedHours), 2.5);

  const threeHeavy = ATNE.aggregateFromHeadcount(3, 150, 'month');
  assert.equal(threeHeavy.cappedEach, 120);
  assert.equal(threeHeavy.cappedHours, 360);
  assert.equal(ATNE.fteFromHours(threeHeavy.cappedHours), 3);

  const quick = ATNE.calculate({
    mode: 'quick',
    fullTime: 0,
    nonFtCount: 5,
    hoursEach: 200,
    hoursBasis: 'month'
  });
  assert.equal(quick.ready, true);
  assert.equal(quick.months[0].hours, 600);
  assert.equal(quick.months[0].fte, 5);
  assert.equal(quick.floored, 5);
  assert.equal(quick.isAle, false);
});

test('monthly FTEs may round to the nearest hundredth, half up', function () {
  assert.equal(ATNE.roundHundredth(30.544), 30.54);
  assert.equal(ATNE.roundHundredth(30.545), 30.55);
  assert.equal(ATNE.fteFromHours(30.544 * 120), 30.54);
  assert.equal(ATNE.fteFromHours(30.545 * 120), 30.55);
  assert.equal(ATNE.fteFromHours(0.48), 0);
  assert.equal(ATNE.fteFromHours(6), 0.05);
});

test('weekly hours use 52/12 and then the 120-hour cap', function () {
  const ten = ATNE.aggregateFromHeadcount(10, 25, 'week');
  assert.ok(Math.abs(ten.cappedEach - (25 * 52 / 12)) < 1e-9);
  assert.equal(ten.looksFullTime, false);
  assert.equal(ATNE.fteFromHours(ten.cappedHours), 9.03);

  const heavy = ATNE.aggregateFromHeadcount(10, 35, 'week');
  assert.equal(heavy.cappedEach, 120);
  assert.equal(heavy.cappedHours, 1200);
  assert.equal(heavy.looksFullTime, true);
  assert.equal(ATNE.fteFromHours(heavy.cappedHours), 10);

  const justUnder = ATNE.aggregateFromHeadcount(1, 29, 'week');
  assert.equal(justUnder.looksFullTime, false);
  assert.equal(justUnder.cappedEach, 120);
  assert.equal(ATNE.fteFromHours(justUnder.cappedHours), 1);

  assert.equal(ATNE.classifyHours(125, 'month').fullTime, false);
  assert.equal(ATNE.classifyHours(130, 'month').fullTime, true);
  assert.equal(ATNE.classifyHours(30, 'week').fullTime, true);
  assert.equal(ATNE.monthFigure(0, ATNE.aggregateFromHeadcount(1, 125, 'month').cappedHours).fte, 1);
});

test('IRS example 2: 20 full-time and 40 people at 90 hours is exactly 50', function () {
  const result = ATNE.calculate({
    year: 2026,
    mode: 'quick',
    fullTime: 20,
    nonFtCount: 40,
    hoursEach: 90,
    hoursBasis: 'month'
  });
  assert.equal(result.ready, true);
  assert.equal(result.months[0].fte, 30);
  assert.equal(result.months[0].total, 50);
  assert.equal(result.months[0].exceeds50, false);
  assert.equal(result.exact, 50);
  assert.equal(result.floored, 50);
  assert.equal(result.isAle, true);
  assert.equal(result.outcome, 'borderline');
  assert.equal(result.showPenaltyCta, true);
  assert.equal(result.monthsOver, 0);
  assert.match(result.headline, /applicable large employer/i);
  assert.match(result.report, /Rounded down: 50/);
});

test('the annual average divides by 12 and rounds down, never half up', function () {
  const under = ATNE.calculate({
    mode: 'quick',
    fullTime: 49,
    nonFtCount: 1,
    hoursEach: 108,
    hoursBasis: 'month'
  });
  assert.equal(under.months[0].fte, 0.9);
  assert.equal(under.exact, 49.9);
  assert.equal(under.floored, 49);
  assert.equal(under.isAle, false);
  assert.equal(under.outcome, 'borderline');
  assert.equal(under.showPenaltyCta, true);

  const at = ATNE.calculate({
    mode: 'quick',
    fullTime: 49,
    nonFtCount: 1,
    hoursEach: 120,
    hoursBasis: 'month'
  });
  assert.equal(at.floored, 50);
  assert.equal(at.isAle, true);
  assert.equal(at.outcome, 'borderline');

  const notHalfUp = ATNE.calculate({
    mode: 'quick',
    fullTime: 50,
    nonFtCount: 1,
    hoursEach: 108,
    hoursBasis: 'month'
  });
  assert.equal(notHalfUp.exact, 50.9);
  assert.equal(notHalfUp.floored, 50);
  assert.notEqual(notHalfUp.floored, 51);

  const clear = ATNE.calculate({ mode: 'quick', fullTime: 51, nonFtCount: 0 });
  assert.equal(clear.outcome, 'ale');
  assert.equal(clear.isAle, true);
  assert.equal(clear.showPenaltyCta, true);

  const comfortable = ATNE.calculate({ mode: 'quick', fullTime: 80 });
  assert.equal(comfortable.floored, 80);
  assert.equal(comfortable.outcome, 'ale');
  assert.equal(comfortable.isAle, true);

  const low = ATNE.calculate({
    mode: 'quick',
    fullTime: 47,
    nonFtCount: 1,
    hoursEach: 108,
    hoursBasis: 'month'
  });
  assert.equal(low.floored, 47);
  assert.equal(low.outcome, 'not-ale');
  assert.equal(low.isAle, false);
  assert.equal(low.showPenaltyCta, false);
});

test('a single heavy month is still divided by 12', function () {
  const months = monthsOf(repeat(0));
  months[0].fullTime = 600;
  const open = ATNE.calculate({ mode: 'months', months: months });
  assert.equal(open.exact, 50);
  assert.equal(open.floored, 50);
  assert.equal(open.monthsOver, 1);
  assert.equal(open.isAle, true);
  assert.equal(open.seasonalApplied, false);

  const excused = ATNE.calculate({ mode: 'months', months: months, seasonalAttest: true });
  assert.equal(excused.seasonalApplied, true);
  assert.equal(excused.isAle, false);
  assert.match(excused.headline, /seasonal-worker exception/i);
});

test('IRS example 3: four seasonal months are not an ALE when the extra people are seasonal', function () {
  const fullTimes = [];
  for (let i = 0; i < 12; i++) fullTimes.push(i < 8 ? 40 : 120);
  const base = {
    mode: 'months',
    months: monthsOf(fullTimes),
    year: 2026
  };
  const open = ATNE.calculate(base);
  assert.equal(ATNE.formatNum(open.exact), '66.67');
  assert.equal(open.floored, 66);
  assert.equal(open.monthsOver, 4);
  assert.equal(open.seasonalApplied, false);
  assert.equal(open.isAle, true);

  const excused = ATNE.calculate(Object.assign({}, base, { seasonalAttest: true }));
  assert.equal(excused.seasonalApplied, true);
  assert.equal(excused.isAle, false);
  assert.equal(excused.outcome, 'not-ale');
  assert.match(excused.seasonalNote, /exception applies/i);
});

test('IRS example 4: a fifth month over 50 blocks the seasonal exception', function () {
  const fullTimes = [];
  const hours = [];
  for (let i = 0; i < 12; i++) {
    fullTimes.push(i < 8 ? 40 : 120);
    hours.push(i === 7 ? 2400 : 0);
  }
  const result = ATNE.calculate({
    mode: 'months',
    months: monthsOf(fullTimes, hours),
    seasonalAttest: true
  });
  assert.equal(result.months[7].fte, 20);
  assert.equal(result.months[7].total, 60);
  assert.equal(ATNE.formatNum(result.exact), '68.33');
  assert.equal(result.floored, 68);
  assert.equal(result.monthsOver, 5);
  assert.equal(result.seasonalApplied, false);
  assert.equal(result.isAle, true);
  assert.match(result.seasonalNote, /does not apply/i);
});

test('the four months over 50 do not have to be consecutive', function () {
  const fullTimes = repeat(40);
  fullTimes[0] = 120;
  fullTimes[2] = 120;
  fullTimes[5] = 120;
  fullTimes[10] = 120;
  const excused = ATNE.calculate({
    mode: 'months',
    months: monthsOf(fullTimes),
    seasonalAttest: true
  });
  assert.equal(excused.monthsOver, 4);
  assert.equal(excused.floored, 66);
  assert.equal(excused.seasonalApplied, true);
  assert.equal(excused.isAle, false);

  fullTimes[1] = 120;
  const blocked = ATNE.calculate({
    mode: 'months',
    months: monthsOf(fullTimes),
    seasonalAttest: true
  });
  assert.equal(blocked.monthsOver, 5);
  assert.equal(blocked.seasonalApplied, false);
  assert.equal(blocked.isAle, true);
});

test('exactly 50 in a month does not exceed 50, and 50.01 does', function () {
  const even = ATNE.monthFigure(50, 0);
  assert.equal(even.total, 50);
  assert.equal(even.exceeds50, false);
  const pennies = ATNE.monthFigure(50, 1.2);
  assert.equal(pennies.fte, 0.01);
  assert.equal(pennies.total, 50.01);
  assert.equal(pennies.exceeds50, true);

  const flat = ATNE.calculate({
    mode: 'quick',
    fullTime: 50,
    seasonalAttest: true
  });
  assert.equal(flat.monthsOver, 0);
  assert.equal(flat.seasonalApplied, false);
  assert.equal(flat.isAle, true);
  assert.match(flat.seasonalNote, /still an applicable large employer/i);
});

test('a checkbox alone does not erase a year-round workforce over 50', function () {
  const result = ATNE.calculate({
    mode: 'quick',
    fullTime: 80,
    seasonalAttest: true
  });
  assert.equal(result.monthsOver, 12);
  assert.equal(result.seasonalApplied, false);
  assert.equal(result.isAle, true);
  assert.match(result.seasonalNote, /12 months/);
});

test('month-mode hour totals are already capped; a headcount applies the cap', function () {
  const pasted = ATNE.calculate({
    mode: 'months',
    blankMonthsZero: true,
    months: monthsOf(repeat(0), repeat(200))
  });
  assert.equal(pasted.months[0].fte, 1.67);
  assert.equal(pasted.floored, 1);

  const counted = ATNE.calculate({
    mode: 'months',
    months: Array.from({ length: 12 }, function () {
      return { fullTime: 10, nonFtCount: 2, hoursEach: 200, hours: 9999 };
    })
  });
  assert.equal(counted.months[0].hours, 240);
  assert.equal(counted.months[0].fte, 2);
  assert.equal(counted.months[0].total, 12);
  assert.equal(counted.floored, 12);
});

test('blank months stay unresolved until every month is entered or marked zero', function () {
  const empty = ATNE.calculate({ mode: 'months', months: [] });
  assert.equal(empty.ready, false);
  assert.equal(empty.ok, true);

  const partial = ATNE.calculate({
    mode: 'months',
    months: [{ fullTime: 80, hours: 0 }]
  });
  assert.equal(partial.ready, false);
  assert.equal(partial.partial, true);
  assert.equal(partial.filled, 1);
  assert.equal(partial.isAle, undefined);

  const withZeros = ATNE.calculate({
    mode: 'months',
    blankMonthsZero: true,
    months: [{ fullTime: 80, hours: 0 }]
  });
  assert.equal(withZeros.ready, true);
  assert.equal(withZeros.floored, 6);
  assert.equal(withZeros.isAle, false);

  assert.equal(ATNE.calculate({}).ready, false);
  assert.equal(ATNE.calculate({ mode: 'quick', nonFtCount: 4 }).needsHours, true);
  assert.equal(ATNE.calculate({ mode: 'quick', hoursEach: 20 }).needsCount, true);
});

test('a controlled group is added before rounding down', function () {
  const ale = ATNE.calculate({
    mode: 'quick',
    fullTime: 20,
    controlledGroup: true,
    otherAverage: 30.5
  });
  assert.equal(ale.ownExact, 20);
  assert.equal(ale.ownFloored, 20);
  assert.equal(ale.exact, 50.5);
  assert.equal(ale.floored, 50);
  assert.equal(ale.isAle, true);
  assert.match(ale.headline, /controlled group/i);

  const under = ATNE.calculate({
    mode: 'quick',
    fullTime: 20,
    controlledGroup: true,
    otherAverage: 29.1
  });
  assert.equal(under.exact, 49.1);
  assert.equal(under.floored, 49);
  assert.equal(under.isAle, false);
  assert.equal(under.outcome, 'borderline');

  const missing = ATNE.calculate({
    mode: 'quick',
    fullTime: 20,
    controlledGroup: true
  });
  assert.equal(missing.ok, false);
  assert.equal(missing.errors[0].field, 'otherAverage');
});

test('the group seasonal exception cannot survive five months over 50 at this company', function () {
  const result = ATNE.calculate({
    mode: 'quick',
    fullTime: 60,
    controlledGroup: true,
    otherAverage: 10,
    seasonalAttest: true
  });
  assert.equal(result.monthsOver, 12);
  assert.equal(result.seasonalApplied, false);
  assert.equal(result.isAle, true);
});

test('a new employer uses the same count on the current year and says so', function () {
  const result = ATNE.calculate({
    year: 2026,
    mode: 'quick',
    fullTime: 55,
    newEmployer: true
  });
  assert.equal(result.priorYear, 2025);
  assert.equal(result.floored, 55);
  assert.equal(result.isAle, true);
  assert.match(result.headline, /Expected result/);
  assert.match(result.report, /reasonable expectation for 2026/);
  assert.match(result.nextSteps[0], /actually average at least 50/);
});

test('quick mode and a filled grid agree for a stable workforce', function () {
  const quick = ATNE.calculate({
    mode: 'quick',
    fullTime: 30,
    nonFtCount: 15,
    hoursEach: 80,
    hoursBasis: 'month'
  });
  const grid = ATNE.calculate({
    mode: 'months',
    months: monthsOf(repeat(30), repeat(15 * 80))
  });
  assert.equal(quick.floored, 40);
  assert.equal(grid.floored, 40);
  assert.equal(quick.months[0].fte, grid.months[0].fte);
  assert.equal(quick.isAle, false);
  assert.equal(grid.isAle, false);
});

test('copied weekly hours keep the same full-time-equivalent hundredths', function () {
  const hours = ATNE.aggregateFromHeadcount(10, 20, 'week').cappedHours;
  const back = Number(ATNE.formatHoursInput(hours));
  assert.equal(ATNE.fteHundredths(back), ATNE.fteHundredths(hours));
});

test('the seasonal exception is not applied when the rounded average is already under 50', function () {
  const fullTimes = repeat(10);
  fullTimes[0] = 60;
  fullTimes[1] = 60;
  fullTimes[2] = 60;
  fullTimes[3] = 60;
  const result = ATNE.calculate({
    mode: 'months',
    months: monthsOf(fullTimes),
    seasonalAttest: true
  });
  assert.equal(result.monthsOver, 4);
  assert.equal(result.floored, 26);
  assert.equal(result.seasonalApplied, false);
  assert.match(result.seasonalNote, /not needed/i);
});

test('a controlled group seasonal attestation is available only when this company is over 50 for four months or fewer', function () {
  const excused = ATNE.calculate({
    mode: 'quick',
    fullTime: 40,
    controlledGroup: true,
    otherAverage: 20,
    seasonalAttest: true
  });
  assert.equal(excused.monthsOver, 0);
  assert.equal(excused.floored, 60);
  assert.equal(excused.seasonalApplied, true);
  assert.equal(excused.isAle, false);

  const open = ATNE.calculate({
    mode: 'quick',
    fullTime: 40,
    controlledGroup: true,
    otherAverage: 20
  });
  assert.equal(open.seasonalApplied, false);
  assert.equal(open.isAle, true);
});

test('TRICARE and the controlled-group rule are stated and not invented as a quiz', function () {
  const result = ATNE.calculate({ mode: 'quick', fullTime: 10 });
  assert.match(result.report, /TRICARE/);
  assert.match(result.report, /414\(b\)/);
  assert.equal(result.floored, 10);
});
