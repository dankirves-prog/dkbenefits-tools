(function (root, factory) {
  var api = factory();
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
  if (root) {
    root.QuoteMath = api;
  }
})(typeof window !== 'undefined' ? window : globalThis, function () {
  var PAYROLL_OPTIONS = [
    { value: '26', label: 'Bi-weekly' },
    { value: '52', label: 'Weekly' },
    { value: '24', label: 'Semi-monthly' },
    { value: '12', label: 'Monthly' }
  ];
  var CARRIER_PREFERENCE = ['Cigna', 'UHC', 'PHCS'];
  var TIER_KEYS = ['employeeOnly', 'employeeSpouse', 'employeeChildren', 'family'];
  var TIER_LABELS = [
    ['employeeOnly', 'Employee'],
    ['employeeSpouse', 'Employee + Spouse'],
    ['employeeChildren', 'Employee + Child'],
    ['family', 'Family']
  ];

  function money(n) {
    return '$' + Math.round(n).toLocaleString();
  }

  function estimateSmartMix(enrolling) {
    var employeeOnly = Math.max(1, Math.round(enrolling * 0.55));
    var employeeSpouse = Math.round(enrolling * 0.15);
    var employeeChildren = Math.round(enrolling * 0.2);
    var family = Math.max(0, enrolling - employeeOnly - employeeSpouse - employeeChildren);
    return { employeeOnly: employeeOnly, employeeSpouse: employeeSpouse, employeeChildren: employeeChildren, family: family };
  }

  function calcGrossPremium(rates, mix) {
    return (
      mix.employeeOnly * rates.employeeOnly +
      mix.employeeSpouse * rates.employeeSpouse +
      mix.employeeChildren * rates.employeeChildren +
      mix.family * rates.family
    );
  }

  function resolveFlatAmount(selectValue, customValue) {
    return selectValue === 'custom' ? Number(customValue || 0) : Number(selectValue || 0);
  }

  function calculateEmployerContributionForTier(plan, tierKey, contribution) {
    var tierRate = Number(plan.rates[tierKey] || 0);
    if (contribution.model === 'flat') {
      return Math.min(contribution.flatAmount, tierRate);
    }

    var employeeOnlyRate = Number(plan.rates.employeeOnly || 0);
    var dependentPortion = Math.max(tierRate - employeeOnlyRate, 0);
    var employeePct = Number(contribution.employerPercent || 0) / 100;
    var dependentPct = Number(contribution.dependentPercent || 0) / 100;
    var employerTierContribution = employeeOnlyRate * employeePct + dependentPortion * dependentPct;
    return Math.min(employerTierContribution, tierRate);
  }

  function calculateEmployerCost(plan, mix, grossPremium, contribution) {
    var employer =
      mix.employeeOnly * calculateEmployerContributionForTier(plan, 'employeeOnly', contribution) +
      mix.employeeSpouse * calculateEmployerContributionForTier(plan, 'employeeSpouse', contribution) +
      mix.employeeChildren * calculateEmployerContributionForTier(plan, 'employeeChildren', contribution) +
      mix.family * calculateEmployerContributionForTier(plan, 'family', contribution);
    return Math.min(employer, grossPremium);
  }

  function perPaycheck(plan, tierKey, contribution) {
    var payPeriods = Number(contribution.payPeriods || 26);
    var rate = Number(plan.rates[tierKey] || 0);
    var employer = calculateEmployerContributionForTier(plan, tierKey, contribution);
    return Math.max(0, (rate - employer) * 12 / payPeriods);
  }

  function paycheckByTier(plan, contribution) {
    return {
      employeeOnly: perPaycheck(plan, 'employeeOnly', contribution),
      employeeSpouse: perPaycheck(plan, 'employeeSpouse', contribution),
      employeeChildren: perPaycheck(plan, 'employeeChildren', contribution),
      family: perPaycheck(plan, 'family', contribution)
    };
  }

  function planTotals(plan, mix, contribution) {
    var gross = calcGrossPremium(plan.rates, mix);
    return {
      gross: gross,
      employer: calculateEmployerCost(plan, mix, gross, contribution),
      annual: gross * 12,
      paycheck: paycheckByTier(plan, contribution)
    };
  }

  function carrierOf(plan) {
    var blob = ((plan && plan.name) || '') + ' ' + ((plan && plan.network) || '');
    var text = blob.toLowerCase();
    if (text.indexOf('cigna') !== -1) return 'Cigna';
    if (text.indexOf('united healthcare') !== -1 || text.indexOf('unitedhealthcare') !== -1 || text.indexOf('uhc') !== -1) return 'UHC';
    if (text.indexOf('phcs') !== -1) return 'PHCS';
    return 'Other';
  }

  function listCarriers(plans) {
    var found = [];
    (plans || []).forEach(function (plan) {
      var key = carrierOf(plan);
      if (found.indexOf(key) === -1) found.push(key);
    });
    found.sort(function (a, b) {
      var ia = CARRIER_PREFERENCE.indexOf(a);
      var ib = CARRIER_PREFERENCE.indexOf(b);
      if (ia === -1 && ib === -1) return a.localeCompare(b);
      if (ia === -1) return 1;
      if (ib === -1) return -1;
      return ia - ib;
    });
    return found;
  }

  function sortPlans(planList, sortMode, mix, contribution) {
    var list = (planList || []).slice();
    if (!sortMode || sortMode === 'recommended') return list;
    list.sort(function (a, b) {
      if (sortMode === 'carrier') {
        var byCarrier = carrierOf(a).localeCompare(carrierOf(b));
        if (byCarrier !== 0) return byCarrier;
        return displayName(a).localeCompare(displayName(b));
      }
      var grossA = calcGrossPremium(a.rates, mix);
      var grossB = calcGrossPremium(b.rates, mix);
      if (sortMode === 'price') return grossA - grossB;
      if (sortMode === 'strongestCoverage') return grossB - grossA;
      if (sortMode === 'lowestCost') {
        return calculateEmployerCost(a, mix, grossA, contribution) - calculateEmployerCost(b, mix, grossB, contribution);
      }
      return 0;
    });
    return list;
  }

  function mixTotal(mix) {
    return Number(mix.employeeOnly || 0) + Number(mix.employeeSpouse || 0) + Number(mix.employeeChildren || 0) + Number(mix.family || 0);
  }

  function mixUsed(entered, enrolling) {
    var total = mixTotal(entered);
    if (total === 0) return estimateSmartMix(enrolling);
    return {
      employeeOnly: Number(entered.employeeOnly || 0),
      employeeSpouse: Number(entered.employeeSpouse || 0),
      employeeChildren: Number(entered.employeeChildren || 0),
      family: Number(entered.family || 0)
    };
  }

  function mixNote(entered, enrolling) {
    var total = mixTotal(entered);
    if (total === 0) {
      var smart = estimateSmartMix(enrolling);
      return 'Using smart estimated mix because no tier mix was entered (' + smart.employeeOnly + '/' + smart.employeeSpouse + '/' + smart.employeeChildren + '/' + smart.family + ').';
    }
    if (total !== enrolling) {
      return 'Tier mix totals ' + total + '. Expected enrolling is ' + enrolling + '; estimates use your entered mix.';
    }
    return 'Based on estimated enrollment mix entered above.';
  }

  function mixSummary(mix) {
    return mix.employeeOnly + ' employee only, ' + mix.employeeSpouse + ' employee + spouse, ' + mix.employeeChildren + ' employee + child, ' + mix.family + ' family';
  }

  function payrollLabel(value) {
    var found = null;
    PAYROLL_OPTIONS.forEach(function (option) {
      if (option.value === String(value)) found = option;
    });
    return (found ? found.label : 'Bi-weekly').toLowerCase();
  }

  function contributionSummary(contribution) {
    var pay = payrollLabel(contribution.payPeriods);
    if (contribution.model === 'flat') {
      return 'Employer pays ' + money(contribution.flatAmount) + ' per enrolled employee, capped at each plan\'s monthly premium. Employee payroll deductions are estimated ' + pay + '.';
    }
    return 'Employer pays ' + Number(contribution.employerPercent) + '% of the employee-only premium and ' + Number(contribution.dependentPercent) + '% of the dependent portion. Employee payroll deductions are estimated ' + pay + '.';
  }

  function participationNote(eligible, enrolling) {
    if (!eligible || !enrolling) return '';
    var minParticipation = Math.max(3, Math.ceil(eligible * 0.5));
    if (enrolling <= minParticipation) {
      return 'Based on your entries, some options may need additional review or additional enrollment to qualify. We\u2019ll still show useful starting points and can help you identify the best path.';
    }
    return '';
  }

  function getVisiblePlans(plans, options) {
    var settings = options || {};
    var groups = ['top', 'low'];
    if (settings.mecVisible) groups.push('mec');
    var visible = [];
    groups.forEach(function (group) {
      sortPlans(
        (plans || []).filter(function (plan) { return plan && plan.group === group; }),
        settings.sortMode || 'recommended',
        settings.mix,
        settings.contribution
      ).forEach(function (plan) {
        visible.push({
          id: plan.id,
          name: plan.name,
          network: plan.network,
          typeBadge: plan.typeBadge
        });
      });
    });
    return visible;
  }

  function buildLeadPayload(input) {
    var contribution = input.contribution || {};
    var selected = input.selectedPlans || [];
    return {
      firstName: String(input.firstName || '').trim(),
      email: String(input.email || '').trim(),
      phone: String(input.phone || '').trim(),
      answers: Object.assign({}, input.answers || {}),
      tierMix: input.tierMix,
      contribution: {
        model: contribution.model,
        percent: contribution.model === 'percent' ? Number(contribution.employerPercent) : null,
        flatDollar: contribution.model === 'flat' ? Number(contribution.flatAmount) : null
      },
      selectedPlans: selected.map(function (plan) {
        return {
          id: plan.id,
          name: plan.name,
          network: plan.network,
          typeBadge: plan.typeBadge,
          rates: plan.rates
        };
      }),
      visiblePlans: input.visiblePlans,
      submittedAt: input.submittedAt,
      pageUrl: input.pageUrl
    };
  }

  function displayName(plan) {
    return String((plan && plan.name) || '').replace(/^United\s*Healthcare\b/i, 'UHC');
  }

  function majorMedicalNote(plan) {
    var notes = (plan && plan.notes) || [];
    for (var i = 0; i < notes.length; i += 1) {
      if (/not traditional major medical/i.test(notes[i])) {
        return 'This is not traditional major medical coverage. Benefits are limited.';
      }
    }
    return '';
  }

  function mixCheck(entered, enrolling, eligible) {
    var total = mixTotal(entered);
    var enrolled = Number(enrolling || 0);
    var allowed = Number(eligible || 0);
    if (allowed && total > allowed) {
      return {
        ok: false,
        total: total,
        message: 'This mix totals ' + total + '. It can\u2019t be higher than the ' + allowed + ' eligible employees.'
      };
    }
    if (total > 0 && enrolled && total !== enrolled) {
      return {
        ok: true,
        total: total,
        message: 'This mix totals ' + total + '. You said about ' + enrolled + ' will enroll. Estimates below use this mix.'
      };
    }
    return { ok: true, total: total, message: '' };
  }

  function summaryLine(answers, mixInfo) {
    var employees = Number(answers.employees || 0);
    var enrolling = Number(answers.enrolling || 0);
    var line = (answers.state || 'Your state') + ' \u00b7 ' + employees + ' eligible employees \u00b7 about ' + enrolling + ' enrolling.';
    if (mixInfo && mixInfo.ok && mixInfo.total > 0 && mixInfo.total !== enrolling) {
      line += ' Estimates use a mix of ' + mixInfo.total + '.';
    }
    return line;
  }

  function chunkPlans(list, size) {
    var groups = [];
    var count = size || 4;
    for (var i = 0; i < (list || []).length; i += count) {
      groups.push(list.slice(i, i + count));
    }
    return groups;
  }

  return {
    PAYROLL_OPTIONS: PAYROLL_OPTIONS,
    TIER_KEYS: TIER_KEYS,
    TIER_LABELS: TIER_LABELS,
    displayName: displayName,
    majorMedicalNote: majorMedicalNote,
    mixCheck: mixCheck,
    chunkPlans: chunkPlans,
    money: money,
    estimateSmartMix: estimateSmartMix,
    calcGrossPremium: calcGrossPremium,
    resolveFlatAmount: resolveFlatAmount,
    calculateEmployerContributionForTier: calculateEmployerContributionForTier,
    calculateEmployerCost: calculateEmployerCost,
    perPaycheck: perPaycheck,
    paycheckByTier: paycheckByTier,
    planTotals: planTotals,
    carrierOf: carrierOf,
    listCarriers: listCarriers,
    sortPlans: sortPlans,
    mixTotal: mixTotal,
    mixUsed: mixUsed,
    mixNote: mixNote,
    mixSummary: mixSummary,
    payrollLabel: payrollLabel,
    contributionSummary: contributionSummary,
    participationNote: participationNote,
    getVisiblePlans: getVisiblePlans,
    buildLeadPayload: buildLeadPayload,
    summaryLine: summaryLine
  };
});
