/**
 * 2026 and 2027 ACA employer shared responsibility estimate.
 * The page, the tests, and the lead report all use this file.
 * Dollar math stays in integer cents.
 */
(function (root, factory) {
  var api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.ACA = api;
})(typeof window !== 'undefined' ? window : globalThis, function () {
  var MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

  // Rev. Proc. 2025-26 (2026) and Rev. Proc. 2026-22 (2027).
  // Affordability: Rev. Proc. 2025-25 (9.96%) and Rev. Proc. 2026-26 (10.22%).
  var YEARS = {
    2026: {
      aAnnual: 3340,
      bAnnual: 5010,
      rateNum: 996,
      rateDen: 10000,
      rateLabel: '9.96%',
      fpl: {
        calendar: {
          guidelineYear: 2025,
          mainland: 15650,
          alaska: 19550,
          hawaii: 17990,
          note: 'A plan year that starts January 1, 2026 uses the 2025 HHS poverty guidelines, the guidelines in effect six months earlier.'
        },
        later: {
          guidelineYear: 2026,
          mainland: 15960,
          alaska: 19950,
          hawaii: 18360,
          note: 'A plan year that starts February 1, 2026 or later may use the 2026 HHS poverty guidelines.'
        }
      }
    },
    2027: {
      aAnnual: 3780,
      bAnnual: 5670,
      rateNum: 1022,
      rateDen: 10000,
      rateLabel: '10.22%',
      fpl: {
        calendar: {
          guidelineYear: 2026,
          mainland: 15960,
          alaska: 19950,
          hawaii: 18360,
          note: 'A plan year that starts January 1, 2027 uses the 2026 HHS poverty guidelines, the guidelines in effect six months earlier. The 2027 guidelines are not published yet.'
        },
        later: null
      }
    }
  };

  var LOCATIONS = {
    mainland: '48 states and DC',
    alaska: 'Alaska',
    hawaii: 'Hawaii'
  };

  function money(cents) {
    var neg = cents < 0;
    var abs = Math.abs(Math.round(Number(cents) || 0));
    var dollars = Math.floor(abs / 100);
    var rem = abs % 100;
    var body = String(dollars).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    var text = '$' + body + (rem ? '.' + String(rem).padStart(2, '0') : '');
    return neg ? '-' + text : text;
  }

  function parseCents(value) {
    if (value == null || String(value).trim() === '') return null;
    var s = String(value).replace(/[$,\s]/g, '');
    if (!/^\d+(\.\d+)?$/.test(s)) return null;
    var parts = s.split('.');
    var dollars = Number(parts[0]);
    if (dollars > 100000000) return null;
    var extra = parts[1] || '';
    var cents = Number(extra.slice(0, 2).padEnd(2, '0'));
    if (extra.charAt(2) >= '5') cents += 1;
    if (cents >= 100) {
      dollars += 1;
      cents -= 100;
    }
    return dollars * 100 + cents;
  }

  function optionalNumber(value) {
    if (value == null || String(value).trim() === '') return null;
    var n = Number(String(value).replace(/[,\s]/g, ''));
    if (!isFinite(n)) return null;
    return n;
  }

  function whole(value, label, errors, field, opts) {
    opts = opts || {};
    if ((value == null || String(value).trim() === '') && opts.blankZero) return 0;
    if ((value == null || String(value).trim() === '') && opts.optional) return null;
    var n = optionalNumber(value);
    if (n == null || n < 0 || Math.round(n) !== n || n > 1000000) {
      errors.push({ field: field, message: 'Enter ' + label + ' as a whole number, 0 or more.' });
      return 0;
    }
    return n;
  }

  function hoursOf(value, errors, field) {
    if (value == null || String(value).trim() === '') return 0;
    var n = optionalNumber(value);
    if (n == null || n < 0 || n > 100000000) {
      errors.push({ field: field, message: 'Enter part-time hours as a number, 0 or more.' });
      return 0;
    }
    return n;
  }

  function averageOf(value, errors, field, label) {
    if (value == null || String(value).trim() === '') return 0;
    var n = optionalNumber(value);
    if (n == null || n < 0 || n > 1000000) {
      errors.push({ field: field, message: 'Enter ' + label + ' as a number, 0 or more.' });
      return 0;
    }
    return n;
  }

  function fteFromHours(hours) {
    return Math.round((hours / 120) * 100) / 100;
  }

  function floorAverage(exact) {
    if (!isFinite(exact) || exact < 0) return 0;
    return Math.floor(exact + 1e-9);
  }

  function allocableReduction(memberFt, otherFt) {
    var member = Math.max(0, memberFt);
    var group = member + Math.max(0, otherFt);
    if (!member || !group) return 0;
    var raw = 30 * member / group;
    var rounded = Math.ceil(raw - 1e-9);
    return rounded;
  }

  function offerAllowance(counted) {
    var ft = Math.max(0, Math.round(counted) || 0);
    if (!ft) return { counted: 0, percent: 0, allowed: 0, allowedWhole: 0, fiveGreater: false };
    var percent = ft * 0.05;
    var floored = Math.floor(percent + 1e-9);
    var allowedWhole = Math.max(5, floored);
    var fiveGreater = 5 > floored;
    return { counted: ft, percent: percent, allowed: allowedWhole, allowedWhole: allowedWhole, fiveGreater: fiveGreater };
  }

  function offerHint(counted) {
    var allowance = offerAllowance(counted);
    if (!allowance.counted) return '';
    return 'You can miss up to ' + allowance.allowedWhole + '.';
  }

  function meetsOffer(notOffered, counted) {
    var allowance = offerAllowance(counted);
    if (!allowance.counted) return true;
    return notOffered <= allowance.allowedWhole;
  }

  function monthlyFromWeekly(count, hoursPerWeek) {
    var each = Math.min(hoursPerWeek * 52 / 12, 120);
    return count * each;
  }

  function periodCents(count, annualDollars, monthCount) {
    if (count <= 0 || monthCount <= 0) return 0;
    return Math.round(count * annualDollars * monthCount * 100 / 12);
  }

  function oneMonthCents(count, annualDollars) {
    return periodCents(count, annualDollars, 1);
  }

  function maxNotExceedingCents(basisCents, rateNum, rateDen) {
    if (basisCents <= 0) return 0;
    return Math.floor((basisCents * rateNum) / rateDen + 1e-8);
  }

  function fplMaxMonthlyCents(fplDollars, rateNum, rateDen) {
    return Math.floor((fplDollars * rateNum * 100) / (rateDen * 12) + 1e-8);
  }

  function blankMonths() {
    var rows = [];
    for (var i = 0; i < 12; i++) rows.push(false);
    return rows;
  }

  function normalize(input) {
    var errors = [];
    var src = input || {};
    var year = Number(src.year || 2026);
    if (!YEARS[year]) {
      errors.push({ field: 'year', message: 'Choose 2026 or 2027.' });
      year = 2026;
    }
    var priorMode = src.priorMode === 'months' ? 'months' : 'average';
    var priorMonths = [];
    for (var m = 0; m < 12; m++) {
      var row = (src.priorMonths && src.priorMonths[m]) || {};
      priorMonths.push({
        fullTime: whole(row.fullTime, 'each month\'s full-time count', errors, 'priorFt' + m, { blankZero: true }),
        partTimeHours: hoursOf(row.partTimeHours, errors, 'priorHours' + m)
      });
    }
    var penaltyMode = src.penaltyMode === 'months' ? 'months' : 'same';
    var selected = blankMonths();
    var penaltyMonths = [];
    for (var p = 0; p < 12; p++) {
      var picked = !src.months || src.months[p] !== false && src.months[p] !== '0' && src.months[p] !== 0;
      if (src.months && src.months.length === 12) {
        picked = src.months[p] === true || src.months[p] === '1' || src.months[p] === 1 || src.months[p] === 'on';
      }
      selected[p] = !!picked;
      var pen = (src.penaltyMonths && src.penaltyMonths[p]) || {};
      penaltyMonths.push({
        include: pen.include === true || pen.include === '1' || pen.include === 1 || pen.include === 'on',
        fullTime: whole(pen.fullTime, 'each penalty month\'s full-time count', errors, 'penFt' + p, { blankZero: true }),
        ptcCount: whole(pen.ptcCount, 'each month\'s credit count', errors, 'penPtc' + p, { optional: true }),
        notOffered: whole(pen.notOffered, 'each month\'s not-offered count', errors, 'penMiss' + p, { optional: true }),
        creditsNotOffered: whole(pen.creditsNotOffered, 'each month\'s credits among those not offered', errors, 'penMissCredits' + p, { optional: true })
      });
    }
    var offer = src.offer === 'unaffordable' || src.offer === 'affordable' || src.offer === 'below' ? src.offer : '';
    var offerCoverage = src.offerCoverage === 'all' || src.offerCoverage === 'most' || src.offerCoverage === 'none' ? src.offerCoverage : '';
    var mvChoice = 'yes';
    if (src.minimumValue === false || src.minimumValue === 'no' || src.minimumValue === '0') mvChoice = 'no';
    else if (src.minimumValue === 'unsure') mvChoice = 'unsure';
    var useWeekly = (src.partTimeCount != null && String(src.partTimeCount).trim() !== '') || (src.hoursPerWeek != null && String(src.hoursPerWeek).trim() !== '');
    var useExact = src.useExactHours === true || src.useExactHours === 'yes' || src.useExactHours === '1';
    var partTimeCount = whole(src.partTimeCount, 'part-time employees', errors, 'partTimeCount', { blankZero: true });
    var hoursPerWeek = averageOf(src.hoursPerWeek, errors, 'hoursPerWeek', 'hours a week');
    var monthlyHours = useExact
      ? hoursOf(src.exactHours != null ? src.exactHours : src.averagePartTimeHours, errors, 'exactHours')
      : (useWeekly ? monthlyFromWeekly(partTimeCount, hoursPerWeek) : hoursOf(src.averagePartTimeHours, errors, 'averagePartTimeHours'));
    var creditUnsure = src.creditUnsure === true || src.creditUnsure === 'yes' || src.creditUnsure === '1';
    var ptcBlank = src.ptcCount == null || String(src.ptcCount).trim() === '';
    var harbor = src.harbor === 'w2' || src.harbor === 'rate' ? src.harbor : 'fpl';
    var location = LOCATIONS[src.location] ? src.location : 'mainland';
    var planStart = src.planStart === 'later' ? 'later' : 'calendar';
    var value = {
      year: year,
      priorMode: priorMode,
      averageFullTime: averageOf(src.averageFullTime, errors, 'averageFullTime', 'the prior-year full-time average'),
      averagePartTimeHours: monthlyHours,
      partTimeCount: partTimeCount,
      hoursPerWeek: hoursPerWeek,
      useExactHours: useExact,
      priorMonths: priorMonths,
      newEmployer: !!src.newEmployer,
      seasonalAttest: !!src.seasonalAttest,
      controlledGroup: !!src.controlledGroup,
      otherMembersAverage: averageOf(src.otherMembersAverage, errors, 'otherMembersAverage', 'the other companies\' average'),
      otherMembersFullTime: whole(src.otherMembersFullTime, 'the other companies\' full-time employees', errors, 'otherMembersFullTime', { optional: true, blankZero: !src.controlledGroup }),
      penaltyMode: penaltyMode,
      fullTime: whole(src.fullTime, 'full-time employees', errors, 'fullTime', { blankZero: true }),
      nonAssessment: whole(src.nonAssessment, 'employees in a limited non-assessment period', errors, 'nonAssessment', { blankZero: true }),
      notOffered: whole(src.notOffered, 'the number not offered coverage', errors, 'notOffered', { optional: true }),
      offer: offer,
      offerCoverage: offerCoverage,
      anyCredit: src.anyCredit === true || src.anyCredit === 'yes' || src.anyCredit === '1',
      creditUnsure: creditUnsure,
      ptcCount: ptcBlank ? null : whole(src.ptcCount, 'the premium tax credit count', errors, 'ptcCount'),
      creditsNotOffered: whole(src.creditsNotOffered, 'credits among employees not offered coverage', errors, 'creditsNotOffered', { optional: true }),
      months: selected,
      penaltyMonths: penaltyMonths,
      affordability: {
        use: src.affordUse === true || src.affordUse === 'yes' || src.affordUse === '1' || !!src.premium,
        premiumCents: parseCents(src.premium),
        harbor: harbor,
        minimumValue: mvChoice !== 'no',
        mvChoice: mvChoice,
        w2Cents: parseCents(src.w2Wages),
        payType: src.payType === 'salary' ? 'salary' : 'hourly',
        hourlyCents: parseCents(src.hourlyRate),
        salaryCents: parseCents(src.monthlySalary),
        location: location,
        planStart: planStart
      }
    };
    if (value.controlledGroup && (src.otherMembersAverage == null || String(src.otherMembersAverage).trim() === '')) {
      errors.push({ field: 'otherMembersAverage', message: 'Enter the other companies\' full-time plus full-time-equivalent average. Use 0 if they have no employees.' });
    }
    if (value.controlledGroup && value.otherMembersFullTime == null) {
      errors.push({ field: 'otherMembersFullTime', message: 'Enter the other companies\' full-time employees so the 30-employee reduction can be split. Use 0 if they have none.' });
      value.otherMembersFullTime = 0;
    }
    if (value.otherMembersFullTime == null) value.otherMembersFullTime = 0;
    if (value.notOffered != null && value.notOffered > value.fullTime && value.penaltyMode !== 'months') {
      errors.push({ field: 'notOffered', message: 'The number not offered coverage cannot be larger than the full-time count.' });
    }
    if (value.nonAssessment > value.fullTime && value.penaltyMode !== 'months') {
      errors.push({ field: 'nonAssessment', message: 'The limited non-assessment count cannot be larger than the full-time count.' });
    }
    if (value.ptcCount != null && value.ptcCount > value.fullTime && value.penaltyMode !== 'months') {
      errors.push({ field: 'ptcCount', message: 'The credit count cannot be larger than the full-time count.' });
    }
    if (value.creditsNotOffered != null && value.ptcCount != null && value.creditsNotOffered > value.ptcCount) {
      errors.push({ field: 'creditsNotOffered', message: 'The credits among employees not offered coverage cannot be more than the total credit count.' });
    }
    var aff = value.affordability;
    if (aff.use) {
      if (aff.premiumCents == null) errors.push({ field: 'premium', message: 'Enter the lowest-cost self-only monthly premium.' });
      if (aff.harbor === 'w2' && aff.w2Cents == null) errors.push({ field: 'w2Wages', message: 'Enter Form W-2, Box 1 wages.' });
      if (aff.harbor === 'rate' && aff.payType === 'hourly' && aff.hourlyCents == null) errors.push({ field: 'hourlyRate', message: 'Enter the hourly rate of pay.' });
      if (aff.harbor === 'rate' && aff.payType === 'salary' && aff.salaryCents == null) errors.push({ field: 'monthlySalary', message: 'Enter the monthly salary.' });
      if (year === 2027 && aff.planStart === 'later') {
        errors.push({ field: 'planStart', message: 'The 2027 poverty guidelines are not published yet. A calendar-year 2027 plan uses the 2026 guidelines.' });
      }
    }
    return { ok: errors.length === 0, errors: errors, value: value };
  }

  function priorYear(value) {
    var months = [];
    var i;
    if (value.priorMode === 'months') {
      for (i = 0; i < 12; i++) {
        var row = value.priorMonths[i];
        var fte = fteFromHours(row.partTimeHours);
        months.push({ fullTime: row.fullTime, fte: fte, hours: row.partTimeHours, total: row.fullTime + fte });
      }
    } else {
      var fteAvg = fteFromHours(value.averagePartTimeHours);
      for (i = 0; i < 12; i++) {
        months.push({
          fullTime: value.averageFullTime,
          fte: fteAvg,
          hours: value.averagePartTimeHours,
          total: value.averageFullTime + fteAvg
        });
      }
    }
    var exact = 0;
    var hours = 0;
    var fullTime = 0;
    for (i = 0; i < 12; i++) {
      exact += months[i].total;
      hours += months[i].hours;
      fullTime += months[i].fullTime;
    }
    exact = exact / 12;
    var ownRounded = floorAverage(exact);
    var combinedExact = exact + (value.controlledGroup ? value.otherMembersAverage : 0);
    var rounded = floorAverage(combinedExact);
    var monthsOver = 0;
    for (i = 0; i < 12; i++) if (months[i].total > 50) monthsOver += 1;
    var seasonalApplied = false;
    var seasonalNote = '';
    if (value.seasonalAttest && rounded >= 50) {
      if (value.priorMode === 'months') {
        if (monthsOver > 0 && monthsOver <= 4) {
          seasonalApplied = true;
          seasonalNote = 'The monthly counts are over 50 for ' + monthsOver + ' month' + (monthsOver === 1 ? '' : 's') + ', and you said the employees above 50 in that stretch were seasonal workers. Four months or fewer can qualify for the seasonal-worker exception.';
        } else if (monthsOver > 4) {
          seasonalNote = 'The seasonal-worker exception does not apply. The count is over 50 for ' + monthsOver + ' months, and the exception stops after four months (120 days).';
        } else {
          seasonalNote = 'The count never goes over 50 in these months, so the seasonal-worker exception is not what decides ALE status.';
        }
      } else {
        seasonalApplied = true;
        seasonalNote = 'You said the workforce was over 50 for 120 days or fewer, and that everyone above 50 in that stretch was a seasonal worker. This estimate cannot see the monthly payroll behind that answer.';
      }
    }
    var groupMonthsNote = '';
    if (value.priorMode === 'months' && value.controlledGroup) {
      groupMonthsNote = 'This seasonal check only uses this company\'s months. It does not include the other companies in the controlled group.';
      seasonalNote = seasonalNote ? (seasonalNote + ' ' + groupMonthsNote) : groupMonthsNote;
    }
    var isAle = rounded >= 50 && !seasonalApplied;
    return {
      months: months,
      exact: exact,
      fullTimeAverage: fullTime / 12,
      fteAverage: hours / 12 / 120,
      fteRounded: fteFromHours(value.priorMode === 'months' ? hours / 12 : value.averagePartTimeHours),
      ownRounded: ownRounded,
      combinedExact: combinedExact,
      rounded: rounded,
      monthsOver: monthsOver,
      seasonalApplied: seasonalApplied,
      seasonalNote: seasonalNote,
      groupMonthsNote: groupMonthsNote,
      isAle: isAle
    };
  }

  function resolveOffer(value) {
    if (value.offerCoverage) return value.offerCoverage;
    if (value.offer === 'below' && value.notOffered == null) return 'none';
    if (value.offer === 'below') return 'most';
    return 'all';
  }

  function coverageFails(value, afford) {
    if (value.affordability.mvChoice === 'no') return true;
    if (value.offer === 'unaffordable') return true;
    if (afford.used) return afford.passes === false;
    if (value.offer === 'affordable') return false;
    return false;
  }

  function classifyHeadcount(ft, nonAssessment, notOffered, ptcCount, creditsNotOffered, value, afford) {
    var counted = Math.max(0, ft - (nonAssessment || 0));
    var level = resolveOffer(value);
    var missed = level === 'none' ? counted : (level === 'all' ? 0 : (notOffered == null ? 0 : notOffered));
    var offerMet = level === 'none' ? counted === 0 : meetsOffer(missed, counted);
    var unsure = !!value.creditUnsure;
    var credits = ptcCount == null ? null : ptcCount;
    var hasCredit = unsure || value.anyCredit || (credits != null && credits > 0);
    if (unsure) {
      return { offerMet: offerMet, missed: missed, kind: 'unsure', bCount: 0, needPremium: false };
    }
    if (credits == null && !value.anyCredit) {
      return { offerMet: offerMet, missed: missed, kind: 'needCredits', bCount: 0, needPremium: false };
    }
    if (!hasCredit) {
      return { offerMet: offerMet, missed: missed, kind: 'noCredit', bCount: 0, needPremium: false };
    }
    if (!offerMet) {
      return { offerMet: false, missed: missed, kind: 'a', bCount: 0, needPremium: false };
    }
    var amongNot = 0;
    var unknownSplit = false;
    if (missed > 0) {
      if (creditsNotOffered == null) unknownSplit = true;
      else amongNot = Math.min(creditsNotOffered, credits || 0, missed);
    }
    var amongOffered = Math.max(0, (credits || 0) - amongNot);
    var fails = coverageFails(value, afford);
    var judged = afford.used || value.offer === 'unaffordable' || value.offer === 'affordable' || value.affordability.mvChoice === 'no';
    var bCount = amongNot + (fails ? amongOffered : 0);
    var needPremium = !judged && amongOffered > 0;
    if (unknownSplit && !judged) {
      return { offerMet: true, missed: missed, kind: 'needCredits', bCount: 0, needPremium: true };
    }
    if (needPremium && bCount === 0) {
      return { offerMet: true, missed: missed, kind: 'needPremium', bCount: 0, needPremium: true };
    }
    if (bCount > 0) {
      return { offerMet: true, missed: missed, kind: 'b', bCount: bCount, needPremium: needPremium };
    }
    return { offerMet: true, missed: missed, kind: 'zero', bCount: 0, needPremium: false };
  }

  function assessMonth(spec, rates, controlled, otherFt) {
    var ft = Math.max(0, spec.fullTime - (spec.nonAssessment || 0));
    var reduction = controlled ? allocableReduction(spec.fullTime, otherFt) : 30;
    var assessed = Math.max(0, ft - reduction);
    var bCount = Math.max(0, spec.bCount || 0);
    var a = oneMonthCents(assessed, rates.aAnnual);
    var bRaw = oneMonthCents(bCount, rates.bAnnual);
    var b = Math.min(bRaw, a);
    return {
      fullTime: spec.fullTime,
      counted: ft,
      reduction: reduction,
      assessed: assessed,
      ptc: spec.ptcCount || 0,
      bCount: bCount,
      kind: spec.kind,
      aCents: a,
      bRawCents: bRaw,
      bCents: b,
      capped: bRaw > a && bCount > 0
    };
  }

  function affordabilityOf(value) {
    var aff = value.affordability;
    var rates = YEARS[value.year];
    if (!aff.use || aff.premiumCents == null) {
      return { used: false, passes: null, harborLabel: 'Not checked', detail: 'No premium was entered.', maxCents: null, premiumCents: null };
    }
    var harborLabel = 'Federal poverty line';
    var maxCents = null;
    var detail = '';
    var passes = false;
    if (!aff.minimumValue) {
      return {
        used: true,
        passes: false,
        harborBlocked: true,
        harborLabel: 'Not available',
        detail: 'The safe harbors apply only when the plan pays at least 60 percent of total allowed costs and covers hospital and doctor services. This plan was marked as not meeting minimum value, so every credit counts toward the unaffordable-offer penalty.',
        maxCents: null,
        premiumCents: aff.premiumCents
      };
    }
    if (aff.harbor === 'w2') {
      harborLabel = 'Form W-2';
      maxCents = maxNotExceedingCents(aff.w2Cents, rates.rateNum, rates.rateDen);
      passes = aff.premiumCents * 12 <= maxCents;
      detail = 'Box 1 wages of ' + money(aff.w2Cents) + ' support an annual self-only contribution of up to ' + money(maxCents) + ' (' + rates.rateLabel + '). The entered premium is ' + money(aff.premiumCents * 12) + ' a year.';
    } else if (aff.harbor === 'rate') {
      harborLabel = 'Rate of pay';
      var basis = aff.payType === 'salary' ? aff.salaryCents : aff.hourlyCents * 130;
      maxCents = maxNotExceedingCents(basis, rates.rateNum, rates.rateDen);
      passes = aff.premiumCents <= maxCents;
      detail = aff.payType === 'salary'
        ? 'Monthly salary of ' + money(aff.salaryCents) + ' supports a self-only premium of up to ' + money(maxCents) + ' a month.'
        : 'The hourly rate of ' + money(aff.hourlyCents) + ' times 130 hours supports a self-only premium of up to ' + money(maxCents) + ' a month.';
    } else {
      var table = rates.fpl[aff.planStart] || rates.fpl.calendar;
      var fpl = table[aff.location];
      maxCents = fplMaxMonthlyCents(fpl, rates.rateNum, rates.rateDen);
      passes = aff.premiumCents <= maxCents;
      detail = LOCATIONS[aff.location] + ', ' + table.guidelineYear + ' one-person guideline ' + money(fpl * 100) + '. ' + rates.rateLabel + ' of that guideline, divided by 12, is ' + money(maxCents) + ' a month. ' + table.note;
    }
    return {
      used: true,
      passes: passes,
      harborBlocked: false,
      harborLabel: harborLabel,
      detail: detail,
      maxCents: maxCents,
      premiumCents: aff.premiumCents,
      rateLabel: rates.rateLabel
    };
  }

  function monthList(flags) {
    var names = [];
    for (var i = 0; i < 12; i++) if (flags[i]) names.push(MONTHS[i]);
    if (!names.length) return 'None';
    if (names.length === 12) return 'January through December';
    return names.join(', ');
  }

  function calculate(input) {
    var parsed = normalize(input);
    if (!parsed.ok) return { ok: false, errors: parsed.errors };
    var value = parsed.value;
    var rates = YEARS[value.year];
    var prior = priorYear(value);
    var flags = [];
    var specs = [];
    var i;
    for (i = 0; i < 12; i++) {
      var include = value.penaltyMode === 'months' ? value.penaltyMonths[i].include : value.months[i];
      flags.push(!!include);
      if (!include) continue;
      if (value.penaltyMode === 'months') {
        specs.push({
          index: i,
          fullTime: value.penaltyMonths[i].fullTime,
          nonAssessment: 0,
          ptcCount: value.penaltyMonths[i].ptcCount,
          notOffered: value.penaltyMonths[i].notOffered,
          creditsNotOffered: value.penaltyMonths[i].creditsNotOffered
        });
      } else {
        specs.push({
          index: i,
          fullTime: value.fullTime,
          nonAssessment: value.nonAssessment,
          ptcCount: value.ptcCount
        });
      }
    }
    var afford = affordabilityOf(value);
    if (value.affordability.mvChoice === 'unsure') afford.mvNote = 'Minimum value was marked not sure, so this estimate treats the plan as meeting minimum value.';
    var countedForOffer = value.penaltyMode === 'months'
      ? specs.reduce(function (max, row) { return Math.max(max, row.fullTime); }, 0)
      : Math.max(0, value.fullTime - value.nonAssessment);
    for (i = 0; i < specs.length; i++) {
      var spec = specs[i];
      var monthNot = value.penaltyMode === 'months' ? spec.notOffered : value.notOffered;
      var monthCreditsNot = value.penaltyMode === 'months' ? spec.creditsNotOffered : value.creditsNotOffered;
      var monthPtc = spec.ptcCount;
      if (value.penaltyMode !== 'months') monthPtc = value.ptcCount;
      else if (monthPtc == null) monthPtc = value.ptcCount;
      var classified = classifyHeadcount(spec.fullTime, spec.nonAssessment, monthNot, monthPtc, monthCreditsNot, value, afford);
      spec.kind = classified.kind;
      spec.bCount = classified.bCount;
      spec.ptcCount = monthPtc || 0;
      spec.offerMet = classified.offerMet;
      spec.needPremium = classified.needPremium;
    }
    var offerMet = specs.length ? specs.every(function (row) { return row.offerMet; }) : meetsOffer(value.notOffered || 0, countedForOffer);
    var anyCredit = value.creditUnsure || value.anyCredit || (value.ptcCount != null && value.ptcCount > 0) || specs.some(function (row) { return row.ptcCount > 0; });
    var kind = 'zero';
    if (!prior.isAle) kind = 'notAle';
    else if (!flags.some(Boolean)) kind = 'noMonths';
    else if (value.creditUnsure) kind = 'unsure';
    else if (specs.some(function (row) { return row.kind === 'needCredits'; })) kind = 'needCredits';
    else if (specs.every(function (row) { return row.kind === 'noCredit'; })) kind = 'noCredit';
    else if (specs.some(function (row) { return row.kind === 'a'; })) kind = specs.every(function (row) { return row.kind === 'a' || row.kind === 'noCredit'; }) ? 'a' : 'mixed';
    else if (specs.some(function (row) { return row.kind === 'needPremium' && row.bCount === 0; }) && specs.every(function (row) { return row.kind === 'needPremium' || row.kind === 'zero' || row.kind === 'noCredit'; })) kind = 'needPremium';
    else if (specs.some(function (row) { return row.kind === 'b'; })) kind = 'b';
    else kind = 'zero';

    var monthRows = [];
    var aTotal = 0;
    var scenarioBTotal = 0;
    var actualB = 0;
    var identical = true;
    var first = null;
    for (i = 0; i < specs.length; i++) {
      var assessed = assessMonth(specs[i], rates, value.controlledGroup, value.otherMembersFullTime);
      if (!first) first = assessed;
      else if (assessed.assessed !== first.assessed || assessed.bCount !== first.bCount || assessed.ptc !== first.ptc || assessed.reduction !== first.reduction || assessed.kind !== first.kind) identical = false;
      aTotal += assessed.aCents;
      actualB += assessed.bCents;
      scenarioBTotal += assessed.bCents;
      monthRows.push({
        index: specs[i].index,
        name: MONTHS[specs[i].index],
        fullTime: assessed.fullTime,
        reduction: assessed.reduction,
        assessed: assessed.assessed,
        ptc: assessed.ptc,
        bCount: assessed.bCount,
        kind: assessed.kind,
        aCents: assessed.aCents,
        bCents: assessed.bCents,
        capped: assessed.capped
      });
    }
    var bCapped = monthRows.some(function (row) { return row.capped; });
    if (identical && specs.length && first) {
      aTotal = periodCents(first.assessed, rates.aAnnual, specs.length);
      var actualUncapped = periodCents(first.bCount, rates.bAnnual, specs.length);
      var scenarioUncapped = periodCents(first.ptc, rates.bAnnual, specs.length);
      actualB = Math.min(actualUncapped, aTotal);
      scenarioBTotal = Math.min(scenarioUncapped, aTotal);
      bCapped = actualUncapped > aTotal && first.bCount > 0;
    }
    if (!prior.isAle) {
      aTotal = 0;
      scenarioBTotal = 0;
      actualB = 0;
      bCapped = false;
      kind = 'notAle';
    }
    var actual = 0;
    var actualLabel = 'No section 4980H payment on these inputs';
    var why = '';
    if (kind === 'a' || kind === 'unsure') {
      actual = aTotal;
      actualLabel = 'No-offer penalty (A)';
      why = kind === 'unsure'
        ? 'The credit count is not sure. This is the no-offer penalty if at least one employee got a credit and the 95% offer test was missed.'
        : 'You missed the 95% offer test and at least one employee got a credit.';
    } else if (kind === 'b' || kind === 'mixed') {
      actual = kind === 'mixed' ? monthRows.reduce(function (sum, row) {
        return sum + (row.kind === 'a' ? row.aCents : row.bCents);
      }, 0) : actualB;
      actualLabel = 'Unaffordable-offer penalty (B)';
      why = 'Some full-time employees who got a credit were not offered affordable, minimum-value coverage.';
    } else if (kind === 'needCredits') {
      why = 'Enter how many full-time employees got a premium tax credit.';
    } else if (kind === 'needPremium') {
      why = 'Enter the employee\'s monthly cost to check affordability.';
    } else if (kind === 'noCredit') {
      why = 'No full-time employee got a premium tax credit, so neither penalty applies.';
    } else if (kind === 'notAle') {
      why = 'The employer mandate does not apply. The rounded average is under 50.';
    } else if (kind === 'zero') {
      why = 'The offer passes the safe harbor, so these credits do not trigger the unaffordable-offer penalty.';
    }
    var monthlyDivisor = specs.length || 1;
    var result = {
      ok: true,
      errors: [],
      year: value.year,
      rates: rates,
      value: value,
      prior: prior,
      afford: afford,
      offerMet: offerMet,
      offerAllowance: offerAllowance(countedForOffer),
      anyCredit: anyCredit,
      kind: kind,
      monthsLabel: monthList(flags),
      monthCount: specs.length,
      monthRows: monthRows,
      identical: identical,
      aAnnualCents: aTotal,
      aMonthlyCents: specs.length ? Math.round(aTotal / monthlyDivisor) : 0,
      bAnnualCents: scenarioBTotal,
      bMonthlyCents: specs.length ? Math.round(scenarioBTotal / monthlyDivisor) : 0,
      bCapped: bCapped,
      scenarioNothingCents: aTotal,
      scenarioUnaffordableCents: scenarioBTotal,
      scenarioAffordableCents: 0,
      actualCents: actual,
      actualLabel: actualLabel,
      why: why,
      needPremium: specs.some(function (row) { return row.needPremium; }),
      reductionLabel: value.controlledGroup && first ? String(first.reduction) + ' (this company\'s share of 30)' : '30'
    };
    result.report = buildReport(result);
    result.summary = buildSummary(result);
    return result;
  }

  function aleLabel(prior, value) {
    if (prior.seasonalApplied) return 'Likely not an applicable large employer, because of the seasonal-worker exception';
    if (prior.isAle && value.controlledGroup && prior.ownRounded < 50) return 'Likely an applicable large employer, because the controlled group is combined';
    if (prior.isAle) return 'Likely an applicable large employer';
    return 'Likely not an applicable large employer';
  }

  function buildSummary(result) {
    var prior = result.prior;
    var afford = result.afford;
    return {
      year: String(result.year),
      aleStatus: aleLabel(prior, result.value),
      priorFullTime: trimNum(prior.fullTimeAverage),
      priorFte: trimNum(prior.fteRounded),
      priorAverage: trimNum(prior.combinedExact),
      priorRounded: String(prior.rounded),
      seasonal: prior.seasonalApplied ? 'Yes' : (result.value.seasonalAttest ? 'Claimed, not applied' : 'No'),
      controlledGroup: result.value.controlledGroup ? 'Yes' : 'No',
      reduction: result.reductionLabel,
      offerResult: result.offerMet ? 'Offer test met' : 'Below the offer test',
      ptcCount: String(result.value.penaltyMode === 'months' ? 'See months' : result.value.ptcCount),
      monthsAffected: result.monthsLabel,
      aMonthly: money(result.aMonthlyCents),
      aAnnual: money(result.aAnnualCents),
      bMonthly: money(result.bMonthlyCents),
      bAnnual: money(result.bAnnualCents),
      bCapped: result.bCapped ? 'Yes' : 'No',
      scenarioNothing: money(result.scenarioNothingCents),
      scenarioUnaffordable: money(result.scenarioUnaffordableCents),
      scenarioAffordable: money(0),
      safeHarbor: afford.harborLabel,
      affordabilityResult: !afford.used ? 'Not checked' : (afford.passes ? 'Meets this safe harbor' : 'Does not meet this safe harbor'),
      premium: afford.premiumCents == null ? '' : money(afford.premiumCents),
      actualMonthly: money(result.monthCount ? Math.round(result.actualCents / result.monthCount) : 0),
      actualAnnual: money(result.actualCents),
      actualLabel: result.actualLabel
    };
  }

  function trimNum(n) {
    var rounded = Math.round(n * 100) / 100;
    return String(rounded);
  }

  function buildReport(result) {
    var v = result.value;
    var prior = result.prior;
    var lines = [];
    lines.push(result.year + ' ACA employer penalty estimate');
    lines.push('Indexed amounts for ' + result.year + ': section 4980H(a) ' + money(result.rates.aAnnual * 100) + ' a year, section 4980H(b) ' + money(result.rates.bAnnual * 100) + ' a year. Affordability percentage ' + result.rates.rateLabel + '.');
    lines.push('');
    lines.push('ALE status: ' + aleLabel(prior, v));
    lines.push('Prior-year full-time average: ' + trimNum(prior.fullTimeAverage));
    lines.push('Prior-year full-time equivalents: ' + trimNum(prior.fteRounded));
    lines.push('Average used for the 50 threshold: ' + trimNum(prior.combinedExact) + ', rounded down to ' + prior.rounded);
    if (v.newEmployer) lines.push('The company did not exist last year, so these figures are the current-year workforce rather than the prior year.');
    if (v.controlledGroup) {
      lines.push('Controlled or affiliated group: yes. Other companies\' average full-time plus equivalents: ' + trimNum(v.otherMembersAverage) + '. Other companies\' full-time employees used to split the 30: ' + v.otherMembersFullTime + '.');
    } else {
      lines.push('Controlled or affiliated group: no. The full 30-employee reduction is used.');
    }
    if (prior.seasonalNote) lines.push(prior.seasonalNote);
    if (!prior.isAle) {
      lines.push('The employer mandate does not apply on these numbers. No section 4980H payment is estimated. A small-group plan can still be worth a look.');
      lines.push('');
    }
    lines.push('Offer test: ' + (result.offerMet ? 'met' : 'not met') + '.');
    if (v.notOffered != null) lines.push('Full-time employees not offered coverage, including dependents: ' + v.notOffered + '.');
    lines.push('Premium tax credit trigger: ' + (result.anyCredit ? 'at least one full-time employee' : 'none entered') + '.');
    lines.push('Months in this estimate: ' + result.monthsLabel + ' (' + result.monthCount + ').');
    lines.push('30-employee reduction used: ' + result.reductionLabel + '.');
    lines.push('');
    lines.push('Result: ' + result.actualLabel + ', ' + money(result.actualCents) + ' for the months selected' + (result.monthCount && result.actualCents ? ' (' + money(Math.round(result.actualCents / result.monthCount)) + ' in a typical selected month).' : '.'));
    lines.push('Section 4980H(a) for these months: ' + money(result.aMonthlyCents) + ' a month, ' + money(result.aAnnualCents) + ' for the selected months.');
    lines.push('Section 4980H(b) for these months: ' + money(result.bMonthlyCents) + ' a month, ' + money(result.bAnnualCents) + ' for the selected months.' + (result.bCapped ? ' The B amount is capped at the A amount.' : ''));
    lines.push('');
    lines.push('Scenario comparison');
    lines.push('Offer nothing, or miss the offer test: ' + money(result.scenarioNothingCents) + '.');
    lines.push('Offer coverage that is unaffordable or not minimum value: ' + money(result.scenarioUnaffordableCents) + '.');
    lines.push('Offer affordable minimum-value coverage: ' + money(0) + '.');
    lines.push('');
    if (result.afford.used) {
      lines.push('Affordability: ' + result.afford.harborLabel + '. ' + (result.afford.passes ? 'The premium meets this safe harbor.' : 'The premium does not meet this safe harbor.'));
      lines.push(result.afford.detail);
      lines.push('Lowest-cost self-only monthly premium entered: ' + money(result.afford.premiumCents) + '.');
    } else {
      lines.push('Affordability safe harbor: not checked.');
    }
    if (result.monthRows.length && !result.identical) {
      lines.push('');
      lines.push('Months calculated separately:');
      result.monthRows.forEach(function (row) {
        lines.push(row.name + ': ' + row.fullTime + ' full-time, reduction ' + row.reduction + ', A ' + money(row.aCents) + ', B ' + money(row.bCents) + (row.capped ? ' (B capped)' : '') + ', credits ' + row.ptc + '.');
      });
    }
    lines.push('');
    lines.push('Letter 226-J is the IRS letter that proposes an employer shared responsibility payment. The response date on the letter is generally 30 days from the date of the letter. Forms 1094-C and 1095-C are how an applicable large employer reports the offer of coverage. A separate information-return penalty can apply for not filing those forms with the IRS and for not furnishing the employee statement.');
    lines.push('');
    lines.push('This is an estimate, not a tax bill and not legal or tax advice. DK Benefits is a licensed insurance agency, not a tax advisor.');
    return lines.join('\n');
  }

  return {
    MONTHS: MONTHS,
    YEARS: YEARS,
    LOCATIONS: LOCATIONS,
    money: money,
    parseCents: parseCents,
    fteFromHours: fteFromHours,
    floorAverage: floorAverage,
    allocableReduction: allocableReduction,
    offerAllowance: offerAllowance,
    offerHint: offerHint,
    monthlyFromWeekly: monthlyFromWeekly,
    meetsOffer: meetsOffer,
    periodCents: periodCents,
    fplMaxMonthlyCents: fplMaxMonthlyCents,
    calculate: calculate,
    normalize: normalize
  };
});
