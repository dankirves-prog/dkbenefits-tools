/**
 * ACA workforce size (ATNE) and applicable large employer status.
 * Treas. Reg. § 54.4980H-2 and the IRS page
 * "Determining if an employer is an applicable large employer."
 *
 * Monthly FTEs: hours of service of employees who are not full-time,
 * not more than 120 hours for any one employee, divided by 120.
 * Fractions count. Each month's FTE count is rounded to the nearest hundredth,
 * which the regulation permits.
 * The 12 monthly totals (full-time + FTEs) are averaged and rounded down
 * to the next lowest whole number. 50 or more is an ALE unless the
 * seasonal-worker exception applies.
 *
 * The page, the tests, and the downloaded summary all use this file.
 */
(function (root, factory) {
  var api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.ATNE = api;
})(typeof window !== 'undefined' ? window : globalThis, function () {
  var MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  var HOURS_CAP = 120;
  var FULL_TIME_MONTH_HOURS = 130;
  var FULL_TIME_WEEK_HOURS = 30;
  var ALE_THRESHOLD = 50;
  var SEASONAL_MONTH_LIMIT = 4;
  var WEEKS_PER_MONTH = 52 / 12;

  function roundHundredth(n) {
    if (!isFinite(n) || n <= 0) return 0;
    return Math.round(n * 100 + 1e-8) / 100;
  }

  function floorAverage(exact) {
    if (!isFinite(exact) || exact < 0) return 0;
    return Math.floor(exact + 1e-9);
  }

  function formatNum(n) {
    if (!isFinite(n)) return '';
    var hundredths = Math.round(n * 100 + 1e-8);
    var whole = Math.floor(Math.abs(hundredths) / 100);
    var frac = Math.abs(hundredths) % 100;
    var body = String(whole);
    if (frac === 0) return body;
    if (frac % 10 === 0) return body + '.' + String(frac / 10);
    return body + '.' + String(frac).padStart(2, '0');
  }

  function formatHoursInput(n) {
    if (!isFinite(n) || n <= 0) return '0';
    return String(Math.round(n * 10000 + 1e-8) / 10000);
  }

  function readNumber(value) {
    if (value == null) return { empty: true };
    var s = String(value).trim();
    if (s === '') return { empty: true };
    var n = Number(s.replace(/[,\s]/g, ''));
    if (!isFinite(n) || n < 0 || n > 100000000) return { empty: false, invalid: true };
    return { empty: false, invalid: false, value: n };
  }

  function readWhole(value) {
    var parsed = readNumber(value);
    if (parsed.empty || parsed.invalid) return parsed;
    if (Math.round(parsed.value) !== parsed.value) return { empty: false, invalid: true };
    return parsed;
  }

  function capEmployeeHours(hours) {
    var n = Number(hours);
    if (!isFinite(n) || n <= 0) return 0;
    return Math.min(n, HOURS_CAP);
  }

  function classifyHours(hoursEach, basis) {
    var entered = Number(hoursEach);
    if (!isFinite(entered) || entered < 0) entered = 0;
    var monthly = basis === 'week' ? entered * WEEKS_PER_MONTH : entered;
    return {
      monthly: monthly,
      capped: capEmployeeHours(monthly),
      fullTime: basis === 'week' ? entered >= FULL_TIME_WEEK_HOURS : monthly >= FULL_TIME_MONTH_HOURS
    };
  }

  function aggregateFromHeadcount(count, hoursEach, basis) {
    var n = Math.max(0, Math.round(Number(count) || 0));
    var classified = classifyHours(hoursEach, basis === 'week' ? 'week' : 'month');
    return {
      count: n,
      monthlyEach: classified.monthly,
      cappedEach: classified.capped,
      cappedHours: n * classified.capped,
      looksFullTime: n > 0 && classified.fullTime
    };
  }

  function fteHundredths(cappedHours) {
    var n = Number(cappedHours);
    if (!isFinite(n) || n <= 0) return 0;
    return Math.round((n / HOURS_CAP) * 100 + 1e-8);
  }

  function fteFromHours(cappedHours) {
    return fteHundredths(cappedHours) / 100;
  }

  function monthFigure(fullTime, cappedHours) {
    var ft = Number(fullTime);
    if (!isFinite(ft) || ft < 0) ft = 0;
    var hours = Number(cappedHours);
    if (!isFinite(hours) || hours < 0) hours = 0;
    var hundredths = fteHundredths(hours);
    var totalHundredths = Math.round(ft * 100) + hundredths;
    return {
      fullTime: ft,
      hours: hours,
      fteHundredths: hundredths,
      fte: hundredths / 100,
      totalHundredths: totalHundredths,
      total: totalHundredths / 100,
      exceeds50: totalHundredths > ALE_THRESHOLD * 100
    };
  }

  function seasonalDecision(floored, monthsOver, attest, controlledGroup) {
    var overLimit = monthsOver > SEASONAL_MONTH_LIMIT;
    var inWindow = monthsOver >= 1 && monthsOver <= SEASONAL_MONTH_LIMIT;
    var applied = false;
    var note = '';
    if (overLimit) {
      applied = false;
      note = 'The seasonal-worker exception does not apply. The count is over 50 for ' + monthsOver + ' months. The exception stops at four calendar months, which count as 120 days.';
    } else if (attest && inWindow && !controlledGroup && floored >= ALE_THRESHOLD) {
      applied = true;
      note = 'The count is over 50 for ' + monthsOver + ' month' + (monthsOver === 1 ? '' : 's') + ', and you said the employees above 50 in those months were seasonal workers. The seasonal-worker exception applies.';
    } else if (attest && controlledGroup && floored >= ALE_THRESHOLD && monthsOver <= SEASONAL_MONTH_LIMIT) {
      applied = true;
      note = 'You said the combined group was over 50 for 120 days or fewer, and that the employees above 50 were seasonal workers. This adds the average you entered for the other companies. It does not see their monthly payroll.';
    } else if (inWindow && floored >= ALE_THRESHOLD) {
      note = 'The count is over 50 for ' + monthsOver + ' month' + (monthsOver === 1 ? '' : 's') + '. If the employees who put you over 50 were seasonal workers, the exception can apply. The four months do not have to be in a row.';
    } else if (controlledGroup && monthsOver === 0 && floored >= ALE_THRESHOLD) {
      note = 'These months do not go over 50. The combined average still meets 50. Check the box only if the whole group was over 50 for 120 days or fewer and the people over 50 were seasonal workers.';
    } else if (monthsOver === 0 && floored >= ALE_THRESHOLD) {
      note = 'No month is over 50. The seasonal exception is for a workforce that does go over 50, for a short stretch, because of seasonal workers. An average of 50 or more with no month over 50 is still an applicable large employer.';
    } else if (floored < ALE_THRESHOLD) {
      note = monthsOver > 0
        ? 'The count goes over 50 in ' + monthsOver + ' month' + (monthsOver === 1 ? '' : 's') + ', and the rounded average is still under 50. The seasonal exception is not needed.'
        : 'The rounded average is under 50, so the seasonal exception is not needed.';
    }
    return { applied: applied, note: note };
  }

  function headlineOf(state) {
    var core;
    if (state.seasonalApplied) core = 'Not an applicable large employer, because the seasonal-worker exception applies';
    else if (state.isAle && state.controlledGroup && state.ownFloored < ALE_THRESHOLD) {
      core = state.floored === ALE_THRESHOLD
        ? 'Applicable large employer, on the line at 50, because the controlled group is combined'
        : 'Applicable large employer, because the controlled group is combined';
    } else if (state.outcome === 'borderline' && state.isAle) core = 'Applicable large employer, on the line at 50';
    else if (state.outcome === 'borderline') core = 'Borderline: not an applicable large employer on these numbers';
    else if (state.isAle) core = 'Applicable large employer';
    else core = 'Not an applicable large employer';
    return state.newEmployer ? 'Expected result: ' + core : core;
  }

  function nextStepsOf(state) {
    var year = state.year;
    var steps = [];
    if (state.newEmployer) {
      steps.push('This company was not in business on any day last year. ALE status uses the workforce you reasonably expect in ' + year + ', and you are an ALE only if you also actually average at least 50 in ' + year + '.');
    }
    if (state.seasonalApplied) {
      steps.push('On these facts the seasonal-worker exception applies, so the employer is not an ALE for ' + year + '.');
      steps.push('Keep payroll that shows the count was over 50 for four calendar months or fewer, and that the people above 50 were seasonal workers.');
      steps.push('If that description is wrong, the employer is an ALE. The penalty calculator is the next step.');
      return steps;
    }
    if (state.outcome === 'borderline' && !state.isAle) {
      steps.push('The rounded average is ' + state.floored + ', just under 50. Recheck anyone near 30 hours a week, the 120-hour cap, and any related companies.');
      steps.push('If the recount lands at 50 or more, estimate the employer penalty. If it stays at 49 or under, the employer mandate does not apply for ' + year + '.');
      return steps;
    }
    if (state.isAle) {
      steps.push('The employer shared responsibility rules apply for ' + year + ', along with Forms 1094-C and 1095-C.');
      steps.push('Full-time equivalents are used for this size test. An ALE does not have to offer coverage to part-time employees to avoid the penalty.');
      steps.push('Estimate what a shared-responsibility payment could look like if the offer is missing, unaffordable, or below minimum value.');
      steps.push('If this is the first year as an ALE, offering minimum-value coverage by April 1 to full-time employees who got no offer last year can excuse January through March.');
      return steps;
    }
    steps.push('The employer mandate does not apply for ' + year + ' on these numbers. A small-group plan can still be a fit.');
    steps.push('If a related company belongs in a controlled group, add that workforce before relying on this result.');
    steps.push('A benefits compliance checkup is a useful next look.');
    return steps;
  }

  function buildReport(state) {
    var lines = [];
    lines.push('ACA workforce size (ATNE) for ' + state.year);
    lines.push(state.headline);
    lines.push('');
    if (state.newEmployer) {
      lines.push('Basis: reasonable expectation for ' + state.year + ', because the company was not in business on any day in ' + (state.year - 1) + '.');
    } else {
      lines.push('Basis: ' + state.priorYear + ' workforce, used for ' + state.year + ' ALE status.');
    }
    lines.push('Average total number of employees (full-time plus full-time equivalents): ' + formatNum(state.exact) + '.');
    lines.push('Rounded down: ' + state.floored + '.');
    lines.push('Full-time average: ' + formatNum(state.fullTimeAverage) + '. Full-time-equivalent average: ' + formatNum(state.fteAverage) + '.');
    if (state.controlledGroup) {
      lines.push('This company before the other companies: ' + formatNum(state.ownExact) + ', rounded down to ' + state.ownFloored + '. Other companies\' average added before rounding: ' + formatNum(state.otherAverage) + '.');
    }
    lines.push('Months over 50: ' + state.monthsOver + '.');
    if (state.seasonalNote) lines.push(state.seasonalNote);
    if (state.looksFullTime) {
      lines.push('Some people entered with the non-full-time hours work 30 or more hours a week, or 130 or more hours in the month. They are full-time. The 120-hour cap still counts each of them as 1.0 in the total.');
    }
    lines.push('');
    lines.push('Month-by-month');
    state.months.forEach(function (row) {
      lines.push(row.name + ': ' + formatNum(row.fullTime) + ' full-time, ' + formatNum(row.hours) + ' non-full-time hours, ' + formatNum(row.fte) + ' FTEs, total ' + formatNum(row.total) + (row.exceeds50 ? ' (over 50)' : '') + '.');
    });
    lines.push('');
    state.nextSteps.forEach(function (step) { lines.push(step); });
    lines.push('');
    lines.push('Employees with TRICARE or Veterans Administration coverage are left out of the ALE count for a month in which they have that coverage. That exclusion is only for this size test. Remove them from the numbers you enter.');
    lines.push('Companies treated as one employer under Internal Revenue Code sections 414(b), (c), (m), and (o) combine their employees before the 50 test.');
    lines.push('Monthly full-time equivalents use hours of service of employees who are not full-time, capped at 120 hours each, divided by 120, then rounded to the nearest hundredth. The 12 monthly totals are averaged and rounded down. A full-time employee averages at least 30 hours a week, or 130 hours in the month.');
    lines.push('');
    lines.push('This is an educational estimate, not legal, tax, or accounting advice. DK Benefits is a licensed insurance agency, not a tax advisor.');
    return lines.join('\n');
  }

  function notReady(extra) {
    return Object.assign({ ok: true, ready: false, errors: [], partial: false, filled: 0, needsHours: false }, extra || {});
  }

  function fail(errors) {
    return { ok: false, ready: false, errors: errors, partial: false };
  }

  function buildMonthsFromQuick(ft, count, hoursEach, basis) {
    var agg = aggregateFromHeadcount(count, hoursEach, basis);
    var row = monthFigure(ft, agg.cappedHours);
    var months = [];
    for (var i = 0; i < 12; i++) {
      months.push(Object.assign({ index: i, name: MONTHS[i] }, row));
    }
    return { months: months, looksFullTime: agg.looksFullTime };
  }

  function buildMonthsFromGrid(src, errors) {
    var months = [];
    var filled = 0;
    var touched = 0;
    var looksFullTime = false;
    var needsHours = false;
    var basis = src.hoursBasis === 'week' ? 'week' : 'month';
    for (var m = 0; m < 12; m++) {
      var raw = (src.months && src.months[m]) || {};
      var ft = readWhole(raw.fullTime);
      var hours = readNumber(raw.hours);
      var count = readWhole(raw.nonFtCount);
      var each = readNumber(raw.hoursEach);
      var rowBasis = raw.hoursBasis === 'week' || raw.hoursBasis === 'month' ? raw.hoursBasis : basis;
      if (ft.invalid) errors.push({ field: 'ft' + m, message: MONTHS[m] + ': enter full-time employees as a whole number, 0 or more.' });
      if (hours.invalid) errors.push({ field: 'hours' + m, message: MONTHS[m] + ': enter non-full-time hours as a number, 0 or more.' });
      if (count.invalid) errors.push({ field: 'nonFt' + m, message: MONTHS[m] + ': enter non-full-time employees as a whole number, 0 or more.' });
      if (each.invalid) errors.push({ field: 'hoursEach' + m, message: MONTHS[m] + ': enter hours as a number, 0 or more.' });
      var rowTouched = !ft.empty || !hours.empty || !count.empty || !each.empty;
      if (rowTouched) touched += 1;
      if (!ft.empty || !hours.empty || !count.empty) filled += 1;
      var capped = 0;
      if (!count.empty) {
        if (count.value > 0 && each.empty) needsHours = true;
        var agg = aggregateFromHeadcount(count.empty ? 0 : count.value, each.empty ? 0 : each.value, rowBasis);
        if (agg.looksFullTime) looksFullTime = true;
        capped = agg.cappedHours;
      } else {
        capped = hours.empty ? 0 : hours.value;
      }
      var figure = monthFigure(ft.empty ? 0 : ft.value, capped);
      months.push(Object.assign({ index: m, name: MONTHS[m] }, figure));
    }
    return { months: months, filled: filled, touched: touched, looksFullTime: looksFullTime, needsHours: needsHours };
  }

  function finish(src, months, looksFullTime, errors) {
    if (errors.length) return fail(errors);
    var controlledGroup = !!src.controlledGroup;
    var other = 0;
    if (controlledGroup) {
      var parsedOther = readNumber(src.otherAverage);
      if (parsedOther.empty) {
        return fail([{ field: 'otherAverage', message: 'Enter the other companies\' average of full-time plus full-time equivalents, before rounding down. Use 0 if they have no employees.' }]);
      }
      if (parsedOther.invalid) {
        return fail([{ field: 'otherAverage', message: 'Enter the other companies\' average as a number, 0 or more.' }]);
      }
      other = parsedOther.value;
    }
    var totalHundredths = 0;
    var ftSum = 0;
    var fteHundredthSum = 0;
    var monthsOver = 0;
    for (var i = 0; i < 12; i++) {
      totalHundredths += months[i].totalHundredths;
      ftSum += months[i].fullTime;
      fteHundredthSum += months[i].fteHundredths;
      if (months[i].exceeds50) monthsOver += 1;
    }
    var ownExact = totalHundredths / 100 / 12;
    var exact = ownExact + other;
    var floored = floorAverage(exact);
    var ownFloored = floorAverage(ownExact);
    var year = Number(src.year || 2026);
    var seasonal = seasonalDecision(floored, monthsOver, !!src.seasonalAttest, controlledGroup);
    var isAle = floored >= ALE_THRESHOLD && !seasonal.applied;
    var outcome = 'not-ale';
    if (!seasonal.applied && (floored === 49 || floored === 50)) outcome = 'borderline';
    else if (isAle) outcome = 'ale';
    var state = {
      ok: true,
      ready: true,
      errors: [],
      year: year,
      priorYear: year - 1,
      newEmployer: !!src.newEmployer,
      controlledGroup: controlledGroup,
      otherAverage: other,
      mode: src.mode === 'months' ? 'months' : 'quick',
      months: months,
      ownExact: ownExact,
      exact: exact,
      floored: floored,
      ownFloored: ownFloored,
      fullTimeAverage: ftSum / 12,
      fteAverage: (fteHundredthSum / 100) / 12,
      monthsOver: monthsOver,
      seasonalApplied: seasonal.applied,
      seasonalNote: seasonal.note,
      looksFullTime: !!looksFullTime,
      isAle: isAle,
      outcome: outcome,
      showPenaltyCta: isAle || outcome === 'borderline'
    };
    state.headline = headlineOf(state);
    state.nextSteps = nextStepsOf(state);
    state.report = buildReport(state);
    return state;
  }

  function calculate(input) {
    var src = input || {};
    var errors = [];
    var year = Number(src.year || 2026);
    if (src.year != null && String(src.year).trim() !== '' && [2025, 2026, 2027].indexOf(year) === -1) {
      return fail([{ field: 'year', message: 'Choose 2025, 2026, or 2027.' }]);
    }
    src.year = year;
    var mode = src.mode === 'months' ? 'months' : 'quick';
    if (mode === 'quick') {
      var ft = readWhole(src.fullTime);
      var count = readWhole(src.nonFtCount);
      var each = readNumber(src.hoursEach);
      var started = !ft.empty || !count.empty || !each.empty;
      if (!started) return notReady();
      if (ft.invalid) errors.push({ field: 'fullTime', message: 'Enter full-time employees as a whole number, 0 or more.' });
      if (count.invalid) errors.push({ field: 'nonFtCount', message: 'Enter non-full-time employees as a whole number, 0 or more.' });
      if (each.invalid) errors.push({ field: 'hoursEach', message: 'Enter hours as a number, 0 or more.' });
      if (errors.length) return fail(errors);
      if (ft.empty && count.empty) return notReady({ needsCount: true });
      if (!count.empty && count.value > 0 && each.empty) return notReady({ needsHours: true });
      var built = buildMonthsFromQuick(ft.empty ? 0 : ft.value, count.empty ? 0 : count.value, each.empty ? 0 : each.value, src.hoursBasis);
      return finish(src, built.months, built.looksFullTime, errors);
    }
    var grid = buildMonthsFromGrid(src, errors);
    if (errors.length) return fail(errors);
    if (!grid.touched) return notReady();
    if (grid.needsHours) return notReady({ needsHours: true, filled: grid.filled });
    var blankZero = src.blankMonthsZero === true || src.blankMonthsZero === 'yes' || src.blankMonthsZero === '1';
    if (grid.filled < 12 && !blankZero) {
      return notReady({ partial: true, filled: grid.filled });
    }
    return finish(src, grid.months, grid.looksFullTime, errors);
  }

  return {
    MONTHS: MONTHS,
    HOURS_CAP: HOURS_CAP,
    FULL_TIME_MONTH_HOURS: FULL_TIME_MONTH_HOURS,
    FULL_TIME_WEEK_HOURS: FULL_TIME_WEEK_HOURS,
    ALE_THRESHOLD: ALE_THRESHOLD,
    SEASONAL_MONTH_LIMIT: SEASONAL_MONTH_LIMIT,
    capEmployeeHours: capEmployeeHours,
    classifyHours: classifyHours,
    aggregateFromHeadcount: aggregateFromHeadcount,
    fteHundredths: fteHundredths,
    fteFromHours: fteFromHours,
    roundHundredth: roundHundredth,
    floorAverage: floorAverage,
    monthFigure: monthFigure,
    formatNum: formatNum,
    formatHoursInput: formatHoursInput,
    readNumber: readNumber,
    readWhole: readWhole,
    calculate: calculate
  };
});
