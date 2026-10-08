(function (root, factory) {
  var api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.RatesFirst = api;
})(typeof window !== 'undefined' ? window : globalThis, function () {
  var WEBHOOK_URL = 'https://script.google.com/macros/s/AKfycby4-ZxTQfsAgIBO0JYSngccVoj5HRKtNshy6N2XlJhbxaEk2oW7b_xIRBGlcSq0CZ0z/exec';
  var GROUP_META = [
    { id: 'top', title: 'Featured Plan Options' },
    { id: 'low', title: 'Lower Cost Options' },
    { id: 'mec', title: 'Minimum Essential Coverage Option' }
  ];
  var DETAIL_ROWS = [
    ['deductible', 'Deductible'],
    ['oopMax', 'Out-of-pocket max'],
    ['pcp', 'PCP'],
    ['specialist', 'Specialist'],
    ['urgentCare', 'Urgent care'],
    ['emergencyRoom', 'Emergency room'],
    ['inpatientHospital', 'Inpatient Hospital'],
    ['outpatientSurgery', 'Outpatient Surgery'],
    ['rx', 'Rx']
  ];
  var CARD_TIERS = [
    ['employeeOnly', 'Employee Only'],
    ['employeeSpouse', 'Employee + Spouse'],
    ['employeeChildren', 'Employee + Child(ren)'],
    ['family', 'Family']
  ];
  var EMPTY_MIX = { employeeOnly: '', employeeSpouse: '', employeeChildren: '', family: '' };

  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function copyMix(mix) {
    return {
      employeeOnly: mix.employeeOnly,
      employeeSpouse: mix.employeeSpouse,
      employeeChildren: mix.employeeChildren,
      family: mix.family
    };
  }

  function numericMix(mix) {
    return {
      employeeOnly: Number(mix.employeeOnly || 0),
      employeeSpouse: Number(mix.employeeSpouse || 0),
      employeeChildren: Number(mix.employeeChildren || 0),
      family: Number(mix.family || 0)
    };
  }

  function sortMix(hasMix, mix) {
    if (hasMix) return numericMix(mix);
    return { employeeOnly: 1, employeeSpouse: 0, employeeChildren: 0, family: 0 };
  }

  function createModel(options) {
    var settings = options || {};
    var plans = settings.plans || [];
    var tracker = settings.tracker || null;
    var live = !!settings.live;
    var now = settings.now || function () { return new Date(); };
    var pageUrl = settings.pageUrl || '';
    var ratesAsOfLabel = settings.ratesAsOfLabel || '';
    var sortMode = 'price';
    var carrier = 'All';
    var mecOpen = false;
    var saved = new Map();
    var eligible = '';
    var enrolling = '';
    var mix = copyMix(EMPTY_MIX);
    var mixError = '';
    var mixManual = false;
    var leadState = '';
    var helpWith = '';
    var contribution = {
      model: '',
      employerPercent: null,
      dependentPercent: null,
      flatAmount: null,
      payPeriods: null
    };
    var started = false;
    var ratesNotified = false;

    function parsedCount(raw) {
      if (String(raw || '').trim() === '') return null;
      var parsed = QuoteMath.parseWholeCount(raw, { min: 1, label: 'this number' });
      return parsed.ok ? parsed.value : null;
    }

    function eligibleCount() { return parsedCount(eligible); }
    function enrollingCount() { return parsedCount(enrolling); }

    function mixStatus() {
      var numbers = numericMix(mix);
      var total = QuoteMath.mixTotal(numbers);
      var allowed = eligibleCount();
      var enrolled = enrollingCount();
      if (mixError) return { ok: false, total: total, message: mixError };
      if (allowed && total > allowed) {
        return { ok: false, total: total, message: 'This mix totals ' + total + '. It can’t be higher than the ' + allowed + ' eligible employees.' };
      }
      if (total > 0 && enrolled && total !== enrolled) {
        return { ok: true, total: total, message: 'This mix totals ' + total + '. You said about ' + enrolled + ' will enroll. Estimates below use this mix.' };
      }
      if (!mixManual && enrolled) {
        return { ok: true, total: total, message: 'Estimated mix, edit any number' };
      }
      return { ok: true, total: total, message: '' };
    }

    function writeMix(numbers) {
      mix = {
        employeeOnly: String(numbers.employeeOnly),
        employeeSpouse: String(numbers.employeeSpouse),
        employeeChildren: String(numbers.employeeChildren),
        family: String(numbers.family)
      };
    }

    function fillEstimate() {
      var count = enrollingCount();
      if (count == null) {
        mix = copyMix(EMPTY_MIX);
        return;
      }
      writeMix(QuoteMath.estimateSmartMix(count));
    }

    function hasValidMix() {
      var status = mixStatus();
      return status.ok && status.total > 0 && enrollingCount() != null;
    }

    function contributionReady() {
      if (contribution.model === 'percent') return contribution.employerPercent != null;
      if (contribution.model === 'flat') return Number(contribution.flatAmount) > 0;
      return false;
    }

    function resolvedContribution() {
      return {
        model: contribution.model || 'percent',
        employerPercent: contribution.employerPercent == null ? 0 : Number(contribution.employerPercent),
        dependentPercent: contribution.dependentPercent == null ? 0 : Number(contribution.dependentPercent),
        flatAmount: Number(contribution.flatAmount || 0),
        payPeriods: Number(contribution.payPeriods || 0)
      };
    }

    function flags() {
      var showGross = hasValidMix();
      var showEmployer = showGross && contributionReady();
      var showPaycheck = showEmployer && Number(contribution.payPeriods) > 0;
      return { showGross: showGross, showEmployer: showEmployer, showPaycheck: showPaycheck };
    }

    function usedMix() {
      return hasValidMix() ? numericMix(mix) : { employeeOnly: 0, employeeSpouse: 0, employeeChildren: 0, family: 0 };
    }

    function noteInteraction() {
      if (started) return;
      started = true;
      if (live && tracker) tracker.onQuoteStarted({ firstName: 'Quote process started', email: '', phone: '' });
    }

    function maybeNotifyRates() {
      if (!live || !tracker || ratesNotified) return;
      if (enrollingCount() == null || !contributionReady()) return;
      ratesNotified = true;
      tracker.onRatesRendered({
        plans: plans,
        visibleGroups: visibleGroups(),
        details: ratesDisplayedDetails()
      });
    }

    function answerBag(stateValue) {
      return {
        state: stateValue,
        employees: eligible,
        enrolling: enrolling,
        priority: '',
        coverage: '',
        timeline: ''
      };
    }

    function payloadContribution() {
      return {
        model: contribution.model,
        employerPercent: contribution.employerPercent,
        dependentPercent: contribution.dependentPercent,
        flatAmount: contribution.flatAmount,
        payPeriods: contribution.payPeriods
      };
    }

    function ratesDisplayedDetails() {
      var shaped = QuoteMath.buildLeadPayload({
        firstName: 'Rates displayed',
        email: '',
        phone: '',
        answers: answerBag(''),
        tierMix: numericMix(mix),
        contribution: payloadContribution(),
        selectedPlans: [],
        visiblePlans: [],
        submittedAt: '',
        pageUrl: ''
      });
      return {
        firstName: shaped.firstName,
        email: shaped.email,
        phone: shaped.phone,
        answers: shaped.answers,
        contribution: shaped.contribution,
        tierMix: {
          employeeOnly: shaped.tierMix.employeeOnly,
          employeeSpouse: shaped.tierMix.employeeSpouse,
          employeeChildren: shaped.tierMix.employeeChildren,
          family: shaped.tierMix.family
        },
        selectedPlans: []
      };
    }

    function visibleGroups() {
      var groups = ['top', 'low'];
      if (mecOpen) groups.push('mec');
      return groups;
    }

    function sortList(list) {
      var mode = sortMode;
      var readyMix = hasValidMix();
      var sortingMix = sortMix(readyMix, mix);
      var resolved = resolvedContribution();
      if (mode === 'lowestCost' && !contributionReady()) mode = 'price';
      return QuoteMath.sortPlans(list, mode, sortingMix, resolved);
    }

    function plansInGroup(groupId, savedOnly) {
      var list = plans.filter(function (plan) { return plan.group === groupId; });
      if (savedOnly) list = list.filter(function (plan) { return saved.has(plan.id); });
      else if (carrier !== 'All') list = list.filter(function (plan) { return QuoteMath.carrierOf(plan) === carrier; });
      if (!savedOnly && groupId === 'mec' && !mecOpen) return [];
      return sortList(list);
    }

    function sections() {
      return {
        groups: GROUP_META.map(function (group) {
          return { id: group.id, title: group.title, plans: plansInGroup(group.id, false) };
        })
      };
    }

    function plansForPrint(mode) {
      var list = [];
      GROUP_META.forEach(function (group) {
        var groupPlans = mode === 'saved'
          ? sortList(plans.filter(function (plan) { return plan.group === group.id && saved.has(plan.id); }))
          : plansInGroup(group.id, false);
        groupPlans.forEach(function (plan) {
          list.push({ plan: plan, section: group.title });
        });
      });
      return list;
    }

    function visiblePlanRecords() {
      var records = [];
      sections().groups.forEach(function (group) {
        if (group.id === 'mec' && !mecOpen) return;
        group.plans.forEach(function (plan) {
          records.push({ id: plan.id, name: plan.name, network: plan.network, typeBadge: plan.typeBadge });
        });
      });
      return records;
    }

    function summaryLine() {
      var parts = [];
      if (eligibleCount() != null) parts.push(eligibleCount() + ' eligible employees');
      if (enrollingCount() != null) parts.push('about ' + enrollingCount() + ' enrolling');
      if (!parts.length) return 'Published monthly tier rates.';
      return parts.join(' · ') + '.';
    }

    function getState() {
      var view = flags();
      var status = mixStatus();
      return {
        live: live,
        carrier: carrier,
        sortMode: sortMode,
        mecOpen: mecOpen,
        mecAvailable: plans.some(function (plan) { return plan.group === 'mec'; }),
        eligible: eligible,
        enrolling: enrolling,
        mix: copyMix(mix),
        mixNote: status.message,
        mixOk: status.ok,
        mixManual: mixManual,
        contribution: {
          model: contribution.model,
          employerPercent: contribution.employerPercent,
          dependentPercent: contribution.dependentPercent,
          flatAmount: contribution.flatAmount,
          payPeriods: contribution.payPeriods
        },
        showGross: view.showGross,
        showEmployer: view.showEmployer,
        showPaycheck: view.showPaycheck,
        mixUsed: usedMix(),
        resolvedContribution: resolvedContribution(),
        saved: Array.from(saved.values()),
        sections: sections(),
        leadState: leadState,
        helpWith: helpWith,
        summaryLine: summaryLine(),
        ratesAsOfLabel: ratesAsOfLabel,
        carriers: ['All'].concat(QuoteMath.listCarriers(plans)),
        participation: QuoteMath.participationNote(eligibleCount() || 0, enrollingCount() || 0)
      };
    }

    function setCount(which, raw) {
      noteInteraction();
      var text = String(raw == null ? '' : raw).trim();
      if (text === '') {
        if (which === 'eligible') eligible = '';
        else {
          enrolling = '';
          if (!mixManual) fillEstimate();
        }
        mixError = '';
        maybeNotifyRates();
        return { ok: true };
      }
      var parsed = QuoteMath.parseWholeCount(text, { min: 1, label: which === 'eligible' ? 'eligible employees' : 'people enrolling' });
      if (!parsed.ok) return { ok: false, error: parsed.message };
      if (which === 'enrolling' && eligibleCount() != null && parsed.value > eligibleCount()) {
        return { ok: false, error: 'Enrollment can’t be higher than the number of eligible employees.' };
      }
      if (which === 'eligible' && enrollingCount() != null && enrollingCount() > parsed.value) {
        return { ok: false, error: 'Eligible employees can’t be lower than the number you expect to enroll.' };
      }
      if (which === 'eligible') eligible = String(parsed.value);
      else {
        enrolling = String(parsed.value);
        if (!mixManual) fillEstimate();
      }
      maybeNotifyRates();
      return { ok: true };
    }

    return {
      noteInteraction: noteInteraction,
      getState: getState,
      plansForPrint: plansForPrint,
      setSort: function (mode) {
        noteInteraction();
        sortMode = mode || 'price';
      },
      setCarrier: function (next) {
        noteInteraction();
        carrier = next || 'All';
      },
      toggleMec: function (open) {
        noteInteraction();
        mecOpen = !!open;
      },
      toggleSaved: function (planId, checked) {
        noteInteraction();
        var plan = plans.filter(function (item) { return item.id === planId; })[0];
        if (!plan) return;
        if (checked) {
          saved.set(plan.id, { id: plan.id, name: plan.name, network: plan.network, typeBadge: plan.typeBadge, rates: plan.rates });
        } else saved.delete(plan.id);
      },
      setEligible: function (raw) { return setCount('eligible', raw); },
      setEnrolling: function (raw) { return setCount('enrolling', raw); },
      setMixField: function (field, raw) {
        noteInteraction();
        mixManual = true;
        var text = String(raw == null ? '' : raw).trim();
        if (text === '') {
          mix[field] = '';
          mixError = '';
          return { ok: true };
        }
        var parsed = QuoteMath.parseWholeCount(text, { min: 0, label: 'this tier' });
        if (!parsed.ok) {
          mixError = parsed.message;
          return { ok: false, error: parsed.message };
        }
        mix[field] = String(parsed.value);
        mixError = '';
        return { ok: true };
      },
      setPayCycle: function (value) {
        noteInteraction();
        contribution.payPeriods = String(value || '');
      },
      setContribution: function (partial) {
        noteInteraction();
        if (partial.model != null) contribution.model = partial.model;
        if (partial.employerPercent != null) contribution.employerPercent = Number(partial.employerPercent);
        if (partial.dependentPercent != null) contribution.dependentPercent = Number(partial.dependentPercent);
        if (partial.flatAmount != null) contribution.flatAmount = Number(partial.flatAmount);
        if (partial.clear) {
          contribution.model = '';
          contribution.employerPercent = null;
          contribution.dependentPercent = null;
          contribution.flatAmount = null;
        }
        maybeNotifyRates();
      },
      resetMix: function () {
        noteInteraction();
        mixManual = false;
        mixError = '';
        fillEstimate();
      },
      clearGroup: function () {
        eligible = '';
        enrolling = '';
        mix = copyMix(EMPTY_MIX);
        mixError = '';
        mixManual = false;
        contribution.model = '';
        contribution.employerPercent = null;
        contribution.dependentPercent = null;
        contribution.flatAmount = null;
        contribution.payPeriods = null;
      },
      setLeadState: function (value) { leadState = value || ''; },
      setHelp: function (value) { helpWith = value || ''; },
      setRatesAsOfLabel: function (label) { ratesAsOfLabel = label || ''; },
      leadPayload: function (contact) {
        var payload = QuoteMath.buildLeadPayload({
          firstName: contact.firstName,
          email: contact.email,
          phone: contact.phone,
          answers: answerBag(leadState),
          tierMix: numericMix(mix),
          contribution: payloadContribution(),
          selectedPlans: Array.from(saved.values()),
          visiblePlans: visiblePlanRecords(),
          submittedAt: now().toISOString(),
          pageUrl: pageUrl
        });
        payload.helpWith = helpWith || '';
        ['notes', 'comments', 'comment', 'message'].forEach(function (key) {
          if (typeof payload[key] !== 'string' || !payload.helpWith) return;
          var current = payload[key].trim();
          payload[key] = current
            ? current + ' What can we help with? ' + payload.helpWith
            : 'What can we help with? ' + payload.helpWith;
        });
        return tracker ? tracker.decorateLeadPayload(payload) : payload;
      }
    };
  }

  function badgeHtml(plan) {
    if (!plan || !plan.typeBadge) return '';
    return '<p class="badge">' + escapeHtml(plan.typeBadge) + '</p>';
  }

  function detailValue(plan, key) {
    return (plan.details && plan.details[key]) || '';
  }

  function legendHtml(plans) {
    var items = QuoteMath.visitLimitLegend(plans);
    if (!items.length) return '';
    return '<p class="abbrev-legend">' + items.map(function (item) { return escapeHtml(item); }).join('<br>') + '</p>';
  }

  function notesBlock(plan) {
    var notes = Array.isArray(plan.notes) ? plan.notes : [];
    var limits = Array.isArray(plan.limitedNotes) ? plan.limitedNotes : [];
    var html = '';
    if (notes.length) html += '<div class="notes"><h4>Notes</h4>' + notes.map(function (note) { return '<p>' + escapeHtml(note) + '</p>'; }).join('') + '</div>';
    if (limits.length) html += '<div class="notes limitations"><h4>Limitations</h4>' + limits.map(function (note) { return '<p>' + escapeHtml(note) + '</p>'; }).join('') + '</div>';
    return html;
  }

  function planArticle(plan, state) {
    var savedOn = state.saved.some(function (item) { return item.id === plan.id; });
    var detailsId = 'details-' + plan.id;
    var lowNote = QuoteMath.majorMedicalNote(plan);
    var tierRows = CARD_TIERS.map(function (tier) {
      var monthly = '<td>' + QuoteMath.money(plan.rates[tier[0]]) + '</td>';
      var paycheck = '';
      if (state.showPaycheck) {
        paycheck = '<td>' + QuoteMath.money(QuoteMath.perPaycheck(plan, tier[0], state.resolvedContribution)) + '</td>';
      }
      return '<tr><th scope="row">' + tier[1] + '</th>' + monthly + paycheck + '</tr>';
    }).join('');
    var head = state.showPaycheck
      ? '<tr><th scope="col">Tier</th><th scope="col">Monthly rate</th><th scope="col">Per paycheck</th></tr>'
      : '<tr><th scope="col">Tier</th><th scope="col">Monthly rate</th></tr>';
    var costs = '';
    if (state.showGross || state.showEmployer || state.showPaycheck) {
      var totals = QuoteMath.planTotals(plan, state.mixUsed, state.resolvedContribution);
      costs = '<section class="group-cost"><h4>Your group’s cost</h4><dl class="cost-grid">';
      if (state.showGross) costs += '<div><dt>Total monthly premium</dt><dd>' + QuoteMath.money(totals.gross) + '</dd></div>';
      if (state.showEmployer) costs += '<div><dt>Employer monthly contribution</dt><dd>' + QuoteMath.money(totals.employer) + '</dd></div>';
      if (state.showPaycheck) costs += '<div class="cost-ee"><dt>Employee per paycheck</dt><dd>' + QuoteMath.money(totals.paycheck.employeeOnly) + '</dd></div>';
      costs += '</dl></section>';
    }
    var keyRows = [['deductible', 'Deductible'], ['oopMax', 'Out-of-pocket max'], ['pcp', 'PCP copay'], ['rx', 'Rx']].map(function (row) {
      return '<div><dt>' + row[1] + '</dt><dd>' + escapeHtml(detailValue(plan, row[0])) + '</dd></div>';
    }).join('');
    var fullDetails = DETAIL_ROWS.filter(function (row) {
      if (row[0] === 'deductible' || row[0] === 'oopMax') return false;
      if ((row[0] === 'inpatientHospital' || row[0] === 'outpatientSurgery') && !detailValue(plan, row[0])) return false;
      return true;
    }).map(function (row) {
      return '<div class="detail-row"><dt>' + row[1] + '</dt><dd>' + escapeHtml(detailValue(plan, row[0])) + '</dd></div>';
    }).join('');
    return '<article class="plan-card" data-plan-id="' + escapeHtml(plan.id) + '">' +
      '<header class="plan-head"><div><p class="carrier">' + escapeHtml(QuoteMath.carrierOf(plan)) + '</p>' +
      '<h3>' + escapeHtml(QuoteMath.displayName(plan)) + '</h3>' +
      '<p class="network">' + escapeHtml(plan.network || '') + '</p>' + badgeHtml(plan) +
      '</div><button type="button" class="btn btn-secondary save-toggle" data-plan-id="' + escapeHtml(plan.id) + '" aria-pressed="' + (savedOn ? 'true' : 'false') + '">' + (savedOn ? 'Saved ✓' : 'Save plan') + '</button></header>' +
      (lowNote ? '<p class="low-callout">' + escapeHtml(lowNote) + '</p>' : '') +
      '<table class="tier-table' + (state.showPaycheck ? '' : ' is-rates-only') + '"><caption>Monthly tier rates</caption><thead>' + head + '</thead><tbody>' + tierRows + '</tbody></table>' +
      costs +
      '<section class="key-benefits"><h4>Key benefits</h4><dl class="key-grid">' + keyRows + '</dl></section>' +
      legendHtml([plan]) +
      '<button type="button" class="btn btn-secondary details-toggle" aria-expanded="false" aria-controls="' + detailsId + '">View plan details</button>' +
      '<div id="' + detailsId + '" class="plan-more" hidden><div class="details">' + fullDetails + '</div>' + notesBlock(plan) + '</div></article>';
  }

  function payrollCaption(contribution) {
    var periods = String(contribution && contribution.payPeriods || '');
    var label = '';
    QuoteMath.PAYROLL_OPTIONS.forEach(function (option) {
      if (option.value === periods) label = option.label;
    });
    return 'PPP = per pay period (' + label + ', ' + periods + ')';
  }

  function printTierTable(plan, state, compact) {
    var showPpp = state.showPaycheck;
    var rows = CARD_TIERS.map(function (tier) {
      var cells = '<td>' + QuoteMath.money(plan.rates[tier[0]]) + '</td>';
      if (showPpp) cells += '<td>' + QuoteMath.money(QuoteMath.perPaycheck(plan, tier[0], state.resolvedContribution)) + '</td>';
      return '<tr><th scope="row">' + tier[1] + '</th>' + cells + '</tr>';
    }).join('');
    var cols = showPpp
      ? (compact ? '<col style="width:36%"><col style="width:32%"><col style="width:32%">' : '<col style="width:44%"><col style="width:28%"><col style="width:28%">')
      : '<col style="width:58%"><col style="width:42%">';
    var head = showPpp
      ? '<th scope="col"></th><th scope="col">Premium</th><th scope="col">EE Cost PPP</th>'
      : '<th scope="col"></th><th scope="col">Premium</th>';
    return '<table class="print-tier' + (compact ? ' is-compact' : '') + '"><colgroup>' + cols + '</colgroup><thead><tr>' + head + '</tr></thead><tbody>' + rows + '</tbody></table>';
  }

  function benefitRows(plans) {
    var rows = [
      ['Plan type', function (plan) { return QuoteMath.planType(plan); }],
      ['Network', function (plan) { return plan.network || ''; }],
      ['Badge', function (plan) { return plan.typeBadge || ''; }]
    ];
    [
      ['deductible', 'Deductible'],
      ['oopMax', 'Out-of-pocket max'],
      ['pcp', 'PCP'],
      ['specialist', 'Specialist'],
      ['urgentCare', 'Urgent care'],
      ['emergencyRoom', 'Emergency room'],
      ['inpatientHospital', 'Inpatient Hospital'],
      ['outpatientSurgery', 'Outpatient Surgery'],
      ['rx', 'Rx']
    ].forEach(function (row) {
      if ((row[0] === 'inpatientHospital' || row[0] === 'outpatientSurgery') && !(plans || []).some(function (plan) { return detailValue(plan, row[0]); })) return;
      rows.push([row[1], function (plan) { return detailValue(plan, row[0]); }]);
    });
    if ((plans || []).some(function (plan) { return QuoteMath.majorMedicalNote(plan); })) {
      rows.splice(3, 0, ['Coverage note', function (plan) { return QuoteMath.majorMedicalNote(plan); }]);
    }
    return rows;
  }

  function printPlanHead(plans, state) {
    var compact = plans.length >= 6;
    return '<tr class="print-name-row"><th scope="col">Compare</th>' + plans.map(function (plan) {
      return '<th scope="col"><span class="compare-name">' + escapeHtml(QuoteMath.displayName(plan)) + '</span></th>';
    }).join('') + '</tr><tr class="print-badge-row"><th scope="col"></th>' + plans.map(function (plan) {
      return '<th scope="col">' + badgeHtml(plan) + '</th>';
    }).join('') + '</tr><tr class="print-rates-row"><th scope="col"></th>' + plans.map(function (plan) {
      return '<th scope="col">' + printTierTable(plan, state, compact) + '</th>';
    }).join('') + '</tr>';
  }

  function comparisonTable(plans, state, interactive) {
    var rows = benefitRows(plans).map(function (row, index) {
      return [row[0], row[1], index === 0 ? 'print-info-start' : ''];
    });
    var pricing = [];
    if (state.showGross) pricing.push(['Total monthly premium', function (plan) { return QuoteMath.money(QuoteMath.planTotals(plan, state.mixUsed, state.resolvedContribution).gross); }, 'print-pricing']);
    if (state.showEmployer) {
      var flat = state.resolvedContribution.model === 'flat';
      pricing.push([flat ? 'Employer contribution (flat)' : 'Employer monthly contribution', function (plan) {
        return QuoteMath.money(QuoteMath.planTotals(plan, state.mixUsed, state.resolvedContribution).employer);
      }, 'print-pricing']);
    }
    if (!interactive) rows = pricing.concat(rows);
    else {
      var extra = CARD_TIERS.map(function (tier) {
        return [tier[1] + ' monthly', function (plan) { return QuoteMath.money(plan.rates[tier[0]]); }, ''];
      });
      if (state.showPaycheck) {
        QuoteMath.TIER_LABELS.forEach(function (tier) {
          extra.push(['Employee paycheck — ' + tier[1], function (plan) {
            return QuoteMath.money(QuoteMath.perPaycheck(plan, tier[0], state.resolvedContribution));
          }, 'compare-emph']);
        });
      }
      rows = extra.concat(pricing.map(function (row) { return [row[0], row[1], 'compare-emph']; })).concat(rows);
    }
    var share = plans.length ? (84 / plans.length).toFixed(3) : '84';
    var cols = '<col style="width:16%">';
    plans.forEach(function () { cols += '<col style="width:' + share + '%">'; });
    var head = interactive
      ? '<tr><th scope="col">Compare</th>' + plans.map(function (plan) {
          var note = QuoteMath.majorMedicalNote(plan);
          return '<th scope="col"><span class="compare-name">' + escapeHtml(QuoteMath.displayName(plan)) + '</span>' + badgeHtml(plan) +
            (note ? '<p class="low-callout">' + escapeHtml(note) + '</p>' : '') +
            '<button type="button" class="btn btn-secondary" data-remove="' + escapeHtml(plan.id) + '">Remove</button></th>';
        }).join('') + '</tr>'
      : printPlanHead(plans, state);
    var body = rows.map(function (row) {
      var cells = plans.map(function (plan) {
        var text = row[1](plan);
        var warning = row[0] === 'Coverage note' && text;
        return '<td' + (warning ? ' class="coverage-warning"' : '') + '>' + escapeHtml(text) + '</td>';
      }).join('');
      return '<tr class="' + (row[2] || '') + '"><th scope="row">' + escapeHtml(row[0]) + '</th>' + cells + '</tr>';
    }).join('');
    return '<table class="' + (interactive ? 'compare-table' : 'print-table') + '"><colgroup>' + cols + '</colgroup><thead>' + head + '</thead><tbody>' + body + '</tbody></table>' + legendHtml(plans);
  }

  function compareHtml(state) {
    var list = state.savedFull || [];
    if (!list.length) return '<p>Save a plan to compare it here.</p>';
    return '<div class="compare-wrap">' + comparisonTable(list, state, true) + '</div>';
  }

  function printChunks(items, options) {
    var perPage = options && options.perPage ? options.perPage : 6;
    var chunks = [];
    var bucket = [];
    (items || []).forEach(function (item) {
      bucket.push(item.plan);
      if (bucket.length === perPage) {
        chunks.push({ plans: bucket.slice() });
        bucket = [];
      }
    });
    if (bucket.length) chunks.push({ plans: bucket.slice() });
    return chunks;
  }

  function filledNoteLines(list) {
    return (list || []).map(function (line) { return String(line || '').trim(); }).filter(Boolean);
  }

  function planHasPrintNotes(plan) {
    return filledNoteLines(plan && plan.notes).length > 0 || filledNoteLines(plan && plan.limitedNotes).length > 0;
  }

  function notesRowUnits(plan) {
    function linesFor(text, charsPerLine) {
      return Math.max(1, Math.ceil(String(text).length / charsPerLine));
    }
    var notes = filledNoteLines(plan.notes);
    var limits = filledNoteLines(plan.limitedNotes);
    var noteLines = notes.length ? 1 : 0;
    notes.forEach(function (line) { noteLines += linesFor(line, 68); });
    var limitLines = limits.length ? 1 : 0;
    limits.forEach(function (line) { limitLines += linesFor(line, 58); });
    var name = QuoteMath.displayName(plan);
    var left = 1 + Math.max(1, Math.ceil(name.length / 20)) + (plan.typeBadge ? 1 : 0);
    return Math.max(left, noteLines, limitLines, 1);
  }

  function notesPageGroups(planList) {
    var budget = 52;
    var pages = [];
    var bucket = [];
    var used = 0;
    planList.forEach(function (plan) {
      var units = notesRowUnits(plan);
      if (bucket.length && used + units > budget) {
        pages.push(bucket);
        bucket = [];
        used = 0;
      }
      bucket.push(plan);
      used += units;
    });
    if (bucket.length) pages.push(bucket);
    return pages;
  }

  function highlightMajorMedical(line) {
    var text = String(line || '');
    var match = text.match(/This is not traditional major medical coverage\./i);
    if (!match) return escapeHtml(text);
    var start = match.index;
    var end = start + match[0].length;
    return escapeHtml(text.slice(0, start)) + '<span class="coverage-warning">' + escapeHtml(text.slice(start, end)) + '</span>' + escapeHtml(text.slice(end));
  }

  function printNotesColumn(label, lines, asList) {
    if (!lines.length) return '<td></td>';
    var renderLine = label === 'Notes' ? highlightMajorMedical : escapeHtml;
    var body = asList
      ? '<ul class="print-notes-list">' + lines.map(function (line) { return '<li>' + renderLine(line) + '</li>'; }).join('') + '</ul>'
      : lines.map(function (line) { return '<p>' + renderLine(line) + '</p>'; }).join('');
    return '<td><p class="print-notes-label">' + label + '</p>' + body + '</td>';
  }

  function printNotesSection(planList, continued) {
    var rows = planList.map(function (plan) {
      var limits = filledNoteLines(plan.limitedNotes);
      return '<tr><th scope="row"><span class="print-notes-carrier">' + escapeHtml(QuoteMath.carrierOf(plan)) + '</span><span class="print-notes-name">' +
        escapeHtml(QuoteMath.displayName(plan)) + '</span>' + badgeHtml(plan) + '</th>' +
        printNotesColumn('Notes', filledNoteLines(plan.notes), false) +
        printNotesColumn('Limitations', limits, limits.length > 1) + '</tr>';
    }).join('');
    var title = continued ? 'Notes and Limitations (continued)' : 'Notes and Limitations';
    return '<section class="print-notes-page"><header class="print-notes-head"><p class="print-brand">DK Benefits</p><p>Daniel Kirves · Call/Text 407-476-5076 · dan@dkbenefits.net</p></header><h2>' +
      escapeHtml(title) + '</h2><table class="print-notes-table"><colgroup><col style="width:18%"><col style="width:41%"><col style="width:41%"></colgroup><tbody>' +
      rows + '</tbody></table></section>';
  }

  function printNotesHtml(items) {
    var planList = (items || []).map(function (item) { return item.plan || item; }).filter(Boolean);
    if (!planList.some(planHasPrintNotes)) return '';
    return notesPageGroups(planList).map(function (page, index) { return printNotesSection(page, index > 0); }).join('');
  }

  function contributionSentence(state) {
    if (!state.showEmployer) return '';
    var contribution = state.resolvedContribution;
    if (contribution.model === 'flat') return 'Employer pays ' + QuoteMath.money(contribution.flatAmount) + ' per enrolled employee, capped at each plan’s monthly premium.';
    var dependent = contribution.dependentPercent;
    return 'Employer pays ' + Number(contribution.employerPercent) + '% of the employee-only premium and ' + Number(dependent) + '% of the dependent portion.';
  }

  function printHtml(state) {
    var items = state.printPlans || [];
    var chunks = printChunks(items, { perPage: 6 });
    var tables = chunks.map(function (chunk, index) {
      return '<section class="print-sheet' + (index ? ' print-next' : ' print-first') + '">' + comparisonTable(chunk.plans, state, false) + '</section>';
    }).join('');
    var which = state.printMode === 'saved' ? 'Saved plans only.' : 'All plans in the current sort and carrier filter.';
    var summary = '<section class="print-summary"><h2>Group rate proposal</h2><p>' + escapeHtml(state.summaryLine) +
      (state.ratesAsOfLabel ? ' ' + escapeHtml(state.ratesAsOfLabel) + '.' : '') + '</p>';
    if (state.showGross) summary += '<p>Enrollment mix: ' + escapeHtml(QuoteMath.mixSummary(state.mixUsed)) + '.</p>';
    var contribution = contributionSentence(state);
    summary += '<p>' + (contribution ? escapeHtml(contribution) + ' ' : '') + escapeHtml(which) + '</p>';
    if (state.showPaycheck) summary += '<p class="print-ppp">' + escapeHtml(payrollCaption(state.resolvedContribution)) + '</p>';
    summary += '</section>';
    return '<header class="print-header"><p class="print-brand">DK Benefits</p><p>Daniel Kirves · Call/Text 407-476-5076 · dan@dkbenefits.net</p>' +
      '<p class="print-license">DK Benefits LLC owns and operates this tool. DK Benefits LLC Florida Agency License #L109331. Daniel Kirves Florida Resident Agent License #W588866. Georgia Agent License #3366904.</p></header>' +
      summary + tables +
      '<section class="print-disclaimer"><h2>Important information</h2>' +
      '<p>Rates shown are based on current published pricing and the answers provided. Final eligibility, participation, underwriting, plan availability, effective dates, and carrier/program approval may change pricing or options. Benefits are governed by official plan documents.</p>' +
      '<p>Plan availability may vary by state. If your business is outside Florida or Georgia, Daniel can let you know whether DK Benefits can assist directly or connect you with an appropriate resource.</p>' +
      '<p>Use of this tool does not create a broker-client relationship or guarantee coverage.</p></section>' +
      printNotesHtml(items);
  }

  function mount(doc) {
    var document = doc || window.document;
    var win = (doc && doc.defaultView) || window;
    var live = /(?:^|[?&])live=1(?:&|$)/.test(win.location.search);
    var tracker = null;
    if (live && win.QuoteActivity) {
      tracker = win.QuoteActivity.createQuoteActivityTracker({
        storage: win.QuoteActivity.createSafeWebStorage(),
        post: function (payload) {
          return fetch(WEBHOOK_URL, { method: 'POST', body: JSON.stringify(payload) }).then(function (response) {
            if (!response.ok) throw new Error('request failed');
            return { ok: true };
          });
        }
      });
      tracker.captureLandingUtms(win.location.search);
    }
    var model = null;

    function $(id) { return document.getElementById(id); }

    function renderCarriers(state) {
      $('carrier-filters').innerHTML = state.carriers.map(function (name) {
        var on = state.carrier === name;
        return '<button type="button" class="chip" role="radio" data-carrier="' + escapeHtml(name) + '" aria-checked="' + (on ? 'true' : 'false') + '">' + escapeHtml(name) + '</button>';
      }).join('');
    }

    function renderCustomize(state) {
      $('eligible').value = state.eligible;
      $('enrolling').value = state.enrolling;
      $('mix-ee').value = state.mix.employeeOnly;
      $('mix-es').value = state.mix.employeeSpouse;
      $('mix-ec').value = state.mix.employeeChildren;
      $('mix-fam').value = state.mix.family;
      $('mix-note').hidden = !state.mixNote;
      $('mix-note').textContent = state.mixNote || '';
      $('mix-note').classList.toggle('message-error', state.mixOk === false);
      $('participation-note').hidden = !state.participation;
      $('participation-note').textContent = state.participation || '';
      document.querySelectorAll('[data-pay]').forEach(function (button) {
        var on = String(state.contribution.payPeriods || '') === button.getAttribute('data-pay');
        button.setAttribute('aria-checked', on ? 'true' : 'false');
        button.tabIndex = on ? 0 : -1;
      });
      $('model-percent').setAttribute('aria-pressed', state.contribution.model === 'percent' ? 'true' : 'false');
      $('model-flat').setAttribute('aria-pressed', state.contribution.model === 'flat' ? 'true' : 'false');
      $('percent-fields').hidden = state.contribution.model !== 'percent';
      $('flat-fields').hidden = state.contribution.model !== 'flat';
      document.querySelectorAll('[data-ee]').forEach(function (button) {
        button.setAttribute('aria-pressed', String(state.contribution.employerPercent) === button.getAttribute('data-ee') ? 'true' : 'false');
      });
      document.querySelectorAll('[data-dep]').forEach(function (button) {
        button.setAttribute('aria-pressed', state.contribution.dependentPercent != null && String(state.contribution.dependentPercent) === button.getAttribute('data-dep') ? 'true' : 'false');
      });
      var eeSlider = $('employer-contribution');
      var depSlider = $('dependent-contribution');
      eeSlider.disabled = state.contribution.employerPercent == null;
      depSlider.disabled = state.contribution.dependentPercent == null;
      if (state.contribution.employerPercent != null) eeSlider.value = String(state.contribution.employerPercent);
      if (state.contribution.dependentPercent != null) depSlider.value = String(state.contribution.dependentPercent);
      $('employer-percent-readout').textContent = state.contribution.employerPercent == null ? '—' : state.contribution.employerPercent + '%';
      $('dependent-percent-readout').textContent = state.contribution.dependentPercent == null ? '—' : state.contribution.dependentPercent + '%';
      document.querySelectorAll('[data-flat]').forEach(function (button) {
        var amount = state.contribution.flatAmount;
        var match = button.getAttribute('data-flat') === 'custom'
          ? state.contribution.model === 'flat' && amount != null && ['200', '300', '400'].indexOf(String(amount)) === -1
          : String(amount) === button.getAttribute('data-flat');
        button.setAttribute('aria-pressed', match ? 'true' : 'false');
      });
      var custom = $('flat-custom-amount');
      var customOn = state.contribution.model === 'flat' && state.contribution.flatAmount != null && ['200', '300', '400'].indexOf(String(state.contribution.flatAmount)) === -1;
      custom.hidden = !customOn;
      custom.parentElement.hidden = !customOn;
      $('flat-readout').textContent = state.contribution.model === 'flat' && state.contribution.flatAmount
        ? QuoteMath.money(state.contribution.flatAmount) + ' per enrolled employee'
        : '';
      document.querySelectorAll('[data-state]').forEach(function (button) {
        var on = state.leadState === button.getAttribute('data-state');
        button.setAttribute('aria-checked', on ? 'true' : 'false');
      });
      document.querySelectorAll('[data-help]').forEach(function (button) {
        var on = state.helpWith === button.getAttribute('data-help');
        button.setAttribute('aria-checked', on ? 'true' : 'false');
      });
    }

    function renderPlans(state) {
      var marked = false;
      state.sections.groups.forEach(function (group) {
        if (group.id === 'mec') return;
        var host = $(group.id + '-plans');
        host.innerHTML = group.plans.map(function (plan) { return planArticle(plan, state); }).join('');
        host.removeAttribute('aria-busy');
        $('section-' + group.id).hidden = group.plans.length === 0;
        if (!marked && group.plans.length && win.performance && win.performance.mark) {
          marked = true;
          if (!win.__rfFirstCardMs) {
            win.__rfFirstCardMs = win.performance.now();
            win.performance.mark('rf-first-card');
          }
        }
      });
      var mec = state.sections.groups.filter(function (group) { return group.id === 'mec'; })[0];
      $('section-mec').hidden = !state.mecAvailable;
      $('mec-wrap').hidden = !state.mecOpen;
      $('mec-toggle').textContent = state.mecOpen ? 'Hide MEC Section' : 'Show MEC Section';
      $('mec-toggle').setAttribute('aria-expanded', state.mecOpen ? 'true' : 'false');
      $('mec-plans').innerHTML = state.mecOpen && mec ? mec.plans.map(function (plan) { return planArticle(plan, state); }).join('') : '';
      var any = state.sections.groups.some(function (group) { return group.id !== 'mec' && group.plans.length; });
      $('filter-empty').hidden = any;
      $('my-plans-btn').textContent = 'My Plans (' + state.saved.length + ')';
      var asOf = $('rates-as-of');
      asOf.hidden = !state.ratesAsOfLabel;
      asOf.textContent = state.ratesAsOfLabel || '';
    }

    function renderSaved(state) {
      var full = model.plansForPrint('saved').map(function (item) { return item.plan; });
      $('drawer-body').innerHTML = compareHtml(Object.assign({}, state, { savedFull: full }));
      $('drawer-print').disabled = !state.saved.length;
      $('lead-saved-note').textContent = state.saved.length
        ? 'Your ' + state.saved.length + ' saved plan' + (state.saved.length === 1 ? '' : 's') + ' will be included with this request.'
        : 'All plans shown will be included with this request.';
      $('lead-plan-list').innerHTML = state.saved.length
        ? state.saved.map(function (plan) { return '<li>' + escapeHtml(plan.name) + '</li>'; }).join('')
        : '<li>All plans currently shown</li>';
    }

    function render() {
      var state = model.getState();
      if (!$('carrier-filters').children.length || $('carrier-filters').getAttribute('data-carrier') !== state.carrier) {
        renderCarriers(state);
        $('carrier-filters').setAttribute('data-carrier', state.carrier);
      }
      $('sort-mode').value = state.sortMode;
      renderCustomize(state);
      renderPlans(state);
      renderSaved(state);
    }

    var pendingPrint = 'all';

    function fillPrint(mode) {
      var state = model.getState();
      state.printMode = mode;
      state.printPlans = model.plansForPrint(mode);
      $('print-root').innerHTML = printHtml(state);
    }

    function printMode(mode) {
      pendingPrint = mode;
      model.noteInteraction();
      fillPrint(mode);
      win.print();
    }

    function openLead() {
      var lead = $('lead');
      lead.hidden = false;
      $('lead-success').hidden = true;
      $('lead-form').hidden = false;
      lead.scrollIntoView({ behavior: 'smooth', block: 'start' });
      win.setTimeout(function () {
        var field = $('first-name');
        if (field && field.focus) field.focus({ preventScroll: true });
      }, 0);
    }

    function showLoadError() {
      $('load-error').hidden = false;
      $('load-error').innerHTML = '<h2>We’re having trouble loading plan options right now.</h2><p>Please refresh and try again, or call/text Daniel at <a href="tel:4074765076">407-476-5076</a>.</p>';
    }

    document.addEventListener('click', function (event) {
      var carrierBtn = event.target.closest('[data-carrier]');
      if (carrierBtn) {
        model.setCarrier(carrierBtn.getAttribute('data-carrier'));
        render();
        return;
      }
      var save = event.target.closest('.save-toggle');
      if (save) {
        model.toggleSaved(save.getAttribute('data-plan-id'), save.getAttribute('aria-pressed') !== 'true');
        render();
        return;
      }
      var details = event.target.closest('.details-toggle');
      if (details) {
        var panel = document.getElementById(details.getAttribute('aria-controls'));
        var open = panel.hidden;
        panel.hidden = !open;
        details.setAttribute('aria-expanded', open ? 'true' : 'false');
        details.textContent = open ? 'Hide plan details' : 'View plan details';
        return;
      }
      var remove = event.target.closest('[data-remove]');
      if (remove) {
        model.toggleSaved(remove.getAttribute('data-remove'), false);
        render();
      }
    });

    $('sort-mode').addEventListener('change', function () {
      model.setSort($('sort-mode').value);
      render();
    });
    $('print-all-btn').addEventListener('click', function () { printMode('all'); });
    $('drawer-print').addEventListener('click', function () { printMode('saved'); });
    $('my-plans-btn').addEventListener('click', function () {
      var panel = $('my-plans-panel');
      panel.hidden = !panel.hidden;
      $('my-plans-btn').setAttribute('aria-expanded', panel.hidden ? 'false' : 'true');
    });
    $('drawer-close').addEventListener('click', function () {
      $('my-plans-panel').hidden = true;
      $('my-plans-btn').setAttribute('aria-expanded', 'false');
    });
    function desktopCustomize() {
      return win.matchMedia('(min-width: 1024px)').matches;
    }

    function setCustomizeOpen(open) {
      document.body.classList.toggle('is-customizing', !!open);
      $('customize-btn').setAttribute('aria-expanded', open ? 'true' : 'false');
    }

    function syncCustomize() {
      if (desktopCustomize()) {
        document.body.classList.remove('is-customizing');
        $('customize-btn').setAttribute('aria-expanded', 'true');
      } else {
        setCustomizeOpen(false);
      }
    }

    syncCustomize();
    win.matchMedia('(min-width: 1024px)').addEventListener('change', syncCustomize);

    $('customize-btn').addEventListener('click', function () {
      model.noteInteraction();
      if (desktopCustomize()) return;
      setCustomizeOpen(!document.body.classList.contains('is-customizing'));
    });
    $('contact-btn').addEventListener('click', openLead);
    $('drawer-send').addEventListener('click', openLead);
    $('clear-group').addEventListener('click', function () {
      model.clearGroup();
      render();
    });
    $('reset-mix').addEventListener('click', function () {
      model.resetMix();
      render();
    });
    function onField(el, fn) {
      el.addEventListener('input', fn);
      el.addEventListener('change', fn);
    }
    onField($('eligible'), function () {
      var result = model.setEligible($('eligible').value);
      $('mix-note').hidden = !!result.ok;
      if (!result.ok) {
        $('mix-note').hidden = false;
        $('mix-note').textContent = result.error;
        $('mix-note').classList.add('message-error');
        return;
      }
      render();
    });
    onField($('enrolling'), function () {
      var result = model.setEnrolling($('enrolling').value);
      if (!result.ok) {
        $('mix-note').hidden = false;
        $('mix-note').textContent = result.error;
        $('mix-note').classList.add('message-error');
        return;
      }
      render();
    });
    document.querySelectorAll('[data-mix]').forEach(function (input) {
      onField(input, function () {
        var result = model.setMixField(input.getAttribute('data-mix'), input.value);
        if (!result.ok) {
          $('mix-note').hidden = false;
          $('mix-note').textContent = result.error;
          $('mix-note').classList.add('message-error');
          return;
        }
        render();
      });
    });
    document.querySelectorAll('[data-pay]').forEach(function (button) {
      button.addEventListener('click', function () {
        model.setPayCycle(button.getAttribute('data-pay'));
        render();
      });
    });
    $('model-percent').addEventListener('click', function () {
      model.setContribution({ model: 'percent' });
      render();
    });
    $('model-flat').addEventListener('click', function () {
      model.setContribution({ model: 'flat' });
      render();
    });
    document.querySelectorAll('[data-ee]').forEach(function (button) {
      button.addEventListener('click', function () {
        model.setContribution({ model: 'percent', employerPercent: Number(button.getAttribute('data-ee')) });
        $('employer-contribution').disabled = false;
        render();
      });
    });
    document.querySelectorAll('[data-dep]').forEach(function (button) {
      button.addEventListener('click', function () {
        model.setContribution({ model: 'percent', dependentPercent: Number(button.getAttribute('data-dep')) });
        $('dependent-contribution').disabled = false;
        render();
      });
    });
    $('employer-contribution').addEventListener('input', function () {
      model.setContribution({ model: 'percent', employerPercent: Number($('employer-contribution').value) });
      render();
    });
    $('dependent-contribution').addEventListener('input', function () {
      model.setContribution({ model: 'percent', dependentPercent: Number($('dependent-contribution').value) });
      render();
    });
    document.querySelectorAll('[data-flat]').forEach(function (button) {
      button.addEventListener('click', function () {
        var value = button.getAttribute('data-flat');
        if (value === 'custom') {
          model.setContribution({ model: 'flat', flatAmount: Number($('flat-custom-amount').value || 0) || null });
          $('flat-custom-amount').hidden = false;
          $('flat-custom-amount').parentElement.hidden = false;
          render();
          return;
        }
        model.setContribution({ model: 'flat', flatAmount: Number(value) });
        render();
      });
    });
    $('flat-custom-amount').addEventListener('change', function () {
      model.setContribution({ model: 'flat', flatAmount: Number($('flat-custom-amount').value || 0) });
      render();
    });
    $('mec-toggle').addEventListener('click', function () {
      model.toggleMec(!model.getState().mecOpen);
      render();
    });
    document.querySelectorAll('[data-state]').forEach(function (button) {
      button.addEventListener('click', function () {
        model.setLeadState(button.getAttribute('data-state'));
        renderCustomize(model.getState());
      });
    });
    document.querySelectorAll('[data-help]').forEach(function (button) {
      button.addEventListener('click', function () {
        model.setHelp(button.getAttribute('data-help'));
        renderCustomize(model.getState());
      });
    });
    $('lead-form').addEventListener('submit', function (event) {
      event.preventDefault();
      var state = model.getState();
      if (!state.leadState) {
        $('lead-error').hidden = false;
        $('lead-error').textContent = 'Choose Florida, Georgia, or Other.';
        return;
      }
      $('lead-error').hidden = true;
      var contact = {
        firstName: $('first-name').value,
        email: $('email').value,
        phone: $('phone').value
      };
      var payload = model.leadPayload(contact);
      var success = $('lead-success');
      if (!live) {
        $('lead-form').hidden = true;
        success.hidden = false;
        success.innerHTML = '<h3>Demo mode, not sent</h3><p>This demo did not email Daniel or write to the sheet.</p>';
        return;
      }
      fetch(WEBHOOK_URL, { method: 'POST', body: JSON.stringify(payload) }).then(function (response) {
        if (!response.ok) throw new Error('request failed');
        $('lead-form').hidden = true;
        success.hidden = false;
        success.innerHTML = '<h3>Sent</h3><p>Daniel has your request.</p>';
      }).catch(function () {
        $('lead-error').hidden = false;
        $('lead-error').textContent = 'Something went wrong sending your request. Please call or text Daniel directly at 407-476-5076.';
      });
    });
    win.addEventListener('beforeprint', function () {
      if (!model) return;
      fillPrint(pendingPrint);
    });

    var pending = win.__rfPlans || fetch('../plans.json', { cache: 'no-store' });
    pending.then(function (response) { return response.json(); }).then(function (plans) {
      if (!Array.isArray(plans)) throw new Error('plans');
      model = createModel({
        plans: plans,
        tracker: tracker,
        live: live,
        pageUrl: win.location.href
      });
      render();
      fetch('../preview/preview-config.json', { cache: 'no-store' }).then(function (response) {
        if (!response.ok) return {};
        return response.json();
      }).then(function (config) {
        if (!model || !config || !config.ratesAsOfLabel) return;
        model.setRatesAsOfLabel(config.ratesAsOfLabel);
        render();
      }).catch(function () {});
    }).catch(showLoadError);
  }

  if (typeof window !== 'undefined' && window.document && window.document.getElementById('quote-app')) {
    mount();
  }

  return {
    WEBHOOK_URL: WEBHOOK_URL,
    createModel: createModel,
    printHtml: printHtml,
    printChunks: printChunks,
    planArticle: planArticle,
    escapeHtml: escapeHtml,
    compareHtml: function (state) {
      return comparisonTable(state.savedFull || [], state, true);
    }
  };
});
