(function (root, factory) {
  var activity = typeof module !== 'undefined' && module.exports
    ? require('../quote-activity.js')
    : root.QuoteActivity;
  var math = typeof module !== 'undefined' && module.exports
    ? require('./quote-math.js')
    : root.QuoteMath;
  var api = factory(activity, math);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.QuotePreview = api;
})(typeof window !== 'undefined' ? window : globalThis, function (QuoteActivity, QuoteMath) {
  var WEBHOOK_URL = 'https://script.google.com/macros/s/AKfycby4-ZxTQfsAgIBO0JYSngccVoj5HRKtNshy6N2XlJhbxaEk2oW7b_xIRBGlcSq0CZ0z/exec';
  var ACTIVITY_TRACKING_ENABLED = true;
  var PREVIEW_UTM_SOURCE = 'preview';
  var QUESTIONS = [
    { key: 'state', title: 'What state is your business located in?', kind: 'choice', options: [{ label: 'Florida', value: 'Florida' }, { label: 'Georgia', value: 'Georgia' }] },
    { key: 'employees', title: 'How many full-time employees are benefits eligible?', kind: 'number', placeholder: 'Example: 12' },
    { key: 'enrolling', title: 'How many do you expect to enroll?', kind: 'number', placeholder: 'Example: 8' },
    { key: 'priority', title: 'What matters most right now?', kind: 'choice', options: [{ label: 'Lower monthly cost', value: 'cost' }, { label: 'Balanced value', value: 'balanced' }, { label: 'Broad network access', value: 'network' }, { label: 'HSA-friendly option', value: 'hsa' }] },
    { key: 'coverage', title: 'Do you currently offer a group health plan?', kind: 'choice', options: [{ label: 'Yes', value: 'yes' }, { label: 'No', value: 'no' }] },
    { key: 'timeline', title: 'When are you hoping to start?', kind: 'choice', options: [{ label: 'Next 30 days', value: '30' }, { label: '1-3 months', value: '90' }, { label: '3+ months', value: 'later' }] }
  ];
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
    ['rx', 'RX summary']
  ];

  var PREVIEW_BASE = '';
  if (typeof document !== 'undefined' && document.currentScript && document.currentScript.src) {
    PREVIEW_BASE = document.currentScript.src.replace(/[^/]*$/, '');
  }

  function previewAsset(file) {
    if (!PREVIEW_BASE) return file;
    return new URL(file, PREVIEW_BASE).href;
  }

  function onPreviewPath(pathname) {
    return /\/preview(?:\/|$)/.test(String(pathname || ''));
  }

  function attributionSearch(search, pathname) {
    var parsed = QuoteActivity.parseUtms(search || '');
    if (parsed && Object.keys(parsed).length > 0) {
      var query = search || '';
      if (query.charAt(0) !== '?') return '?' + query;
      return query;
    }
    var path = pathname;
    if (path == null && typeof location !== 'undefined') path = location.pathname;
    if (onPreviewPath(path)) return '?utm_source=' + PREVIEW_UTM_SOURCE;
    return search || '';
  }

  function postActivityPayload(payload) {
    if (!ACTIVITY_TRACKING_ENABLED) {
      return Promise.resolve({ ok: true, body: { skipped: 'activity_disabled' } });
    }
    return fetch(WEBHOOK_URL, {
      method: 'POST',
      body: JSON.stringify(payload)
    }).then(function (response) {
      return response.text().then(function (responseText) {
        var body = null;
        try { body = JSON.parse(responseText); } catch (error) { body = null; }
        if (!response.ok || (body && body.ok === false)) {
          throw new Error('Activity webhook failed with status ' + response.status + ': ' + responseText);
        }
        return { ok: true, body: body };
      });
    });
  }

  function defaultContribution() {
    return {
      model: 'percent',
      employerPercent: 50,
      dependentPercent: 0,
      flatSelect: '300',
      flatCustom: '',
      payPeriods: 26
    };
  }

  function blankAnswers() {
    return {
      state: 'Florida',
      employees: '',
      enrolling: '',
      priority: '',
      coverage: '',
      timeline: ''
    };
  }

  function countLabel(question) {
    return question.key === 'employees' ? 'eligible employees' : 'people enrolling';
  }

  function validateStep(answers, step) {
    var question = QUESTIONS[step];
    var value = answers[question.key];
    if (question.kind === 'number') {
      var parsed = QuoteMath.parseWholeCount(value, { min: 1, label: countLabel(question) });
      if (!parsed.ok) return parsed.message;
      var amount = parsed.value;
      var eligible = QuoteMath.parseWholeCount(answers.employees, { min: 1, label: 'eligible employees' });
      var enrolling = QuoteMath.parseWholeCount(answers.enrolling, { min: 1, label: 'people enrolling' });
      if (question.key === 'enrolling' && eligible.ok && amount > eligible.value) {
        return 'Enrollment can\u2019t be higher than the number of eligible employees. Update one of these numbers to continue.';
      }
      if (question.key === 'employees' && enrolling.ok && enrolling.value > amount) {
        return 'Eligible employees can\u2019t be lower than the number you expect to enroll.';
      }
      return '';
    }
    if (!value) return 'Choose an answer to continue.';
    return '';
  }

  function createModel(options) {
    var settings = options || {};
    var plans = settings.plans || [];
    var tracker = settings.tracker;
    var now = settings.now || function () { return new Date(); };
    var pageUrl = settings.pageUrl || '';
    var ratesAsOfLabel = settings.ratesAsOfLabel || '';
    var answers = blankAnswers();
    var step = 0;
    var phase = 'questions';
    var error = '';
    var contribution = defaultContribution();
    var mix = { employeeOnly: 0, employeeSpouse: 0, employeeChildren: 0, family: 0 };
    var appliedMix = { employeeOnly: 0, employeeSpouse: 0, employeeChildren: 0, family: 0 };
    var mixStatus = { ok: true, total: 0, message: '' };
    var sortMode = 'price';
    var carrier = 'All';
    var mecOpen = false;
    var saved = new Map();
    var reviewDraft = null;

    function resolvedContribution() {
      return {
        model: contribution.model,
        employerPercent: Number(contribution.employerPercent),
        dependentPercent: Number(contribution.dependentPercent),
        flatAmount: QuoteMath.resolveFlatAmount(contribution.flatSelect, contribution.flatCustom),
        payPeriods: Number(contribution.payPeriods)
      };
    }

    function enrollingCount() {
      return Number(answers.enrolling || 1);
    }

    function copyMix(source) {
      return {
        employeeOnly: Number(source.employeeOnly || 0),
        employeeSpouse: Number(source.employeeSpouse || 0),
        employeeChildren: Number(source.employeeChildren || 0),
        family: Number(source.family || 0)
      };
    }

    function commitMix(nextMix) {
      mix = copyMix(nextMix);
      mixStatus = QuoteMath.mixCheck(mix, Number(answers.enrolling || 0), Number(answers.employees || 0));
      if (!mixStatus.ok) return;
      appliedMix = mixStatus.total === 0 ? QuoteMath.estimateSmartMix(enrollingCount()) : copyMix(mix);
    }

    function usedMix() {
      return appliedMix;
    }

    function resetMixToEnrolling() {
      commitMix(QuoteMath.estimateSmartMix(enrollingCount()));
    }

    function visibleGroups() {
      var groups = ['top', 'low'];
      if (mecOpen) groups.push('mec');
      return groups;
    }

    function quoteStartedDetails() {
      return { firstName: 'Quote process started', email: '', phone: '' };
    }

    function ratesDisplayedDetails() {
      var resolved = resolvedContribution();
      var tierMix = usedMix();
      var shaped = QuoteMath.buildLeadPayload({
        firstName: 'Rates displayed',
        email: '',
        phone: '',
        answers: answers,
        tierMix: tierMix,
        contribution: resolved,
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

    function notifyRates() {
      if (!tracker || phase !== 'results') return;
      tracker.onRatesRendered({
        plans: plans,
        visibleGroups: visibleGroups(),
        details: ratesDisplayedDetails()
      });
    }

    function plansInGroup(groupId, options) {
      var list = plans.filter(function (plan) { return plan.group === groupId; });
      var prefs = options || {};
      if (prefs.savedOnly) {
        list = list.filter(function (plan) { return saved.has(plan.id); });
      } else if (carrier !== 'All') {
        list = list.filter(function (plan) { return QuoteMath.carrierOf(plan) === carrier; });
      }
      if (prefs.skipMec && groupId === 'mec' && !mecOpen) return [];
      return QuoteMath.sortPlans(list, sortMode, usedMix(), resolvedContribution());
    }

    function sections() {
      var empty = true;
      var out = GROUP_META.map(function (group) {
        var list = plansInGroup(group.id, { skipMec: true });
        if (list.length) empty = false;
        return { id: group.id, title: group.title, plans: list };
      });
      return { groups: out, empty: empty };
    }

    function plansForPrint(mode) {
      var useSaved = mode === 'saved' || (mode !== 'all' && saved.size > 0);
      var list = [];
      GROUP_META.forEach(function (group) {
        var plansIn = useSaved
          ? plansInGroup(group.id, { savedOnly: true })
          : plansInGroup(group.id, { skipMec: true });
        plansIn.forEach(function (plan) {
          list.push({ plan: plan, section: group.title });
        });
      });
      return list;
    }

    function enterResults() {
      resetMixToEnrolling();
      phase = 'results';
      error = '';
      notifyRates();
    }

    function getState() {
      var resolved = resolvedContribution();
      var enrolling = Number(answers.enrolling || 0);
      var eligible = Number(answers.employees || 0);
      return {
        step: step,
        phase: phase,
        error: error,
        question: QUESTIONS[step],
        answers: answers,
        contribution: contribution,
        resolvedContribution: resolved,
        mix: mix,
        mixUsed: phase === 'results' || phase === 'review' ? usedMix() : mix,
        mixOk: mixStatus.ok,
        mixNote: phase === 'results' ? mixStatus.message : '',
        mixSummary: phase === 'results' ? QuoteMath.mixSummary(usedMix()) : '',
        summaryLine: QuoteMath.summaryLine(answers, phase === 'results' ? mixStatus : null),
        participation: QuoteMath.participationNote(eligible, enrolling),
        sortMode: sortMode,
        carrier: carrier,
        carriers: QuoteMath.listCarriers(plans),
        mecOpen: mecOpen,
        mecAvailable: plans.some(function (plan) { return plan.group === 'mec'; }),
        saved: Array.from(saved.values()),
        savedFull: Array.from(saved.values()).map(function (item) {
          return plans.filter(function (plan) { return plan.id === item.id; })[0] || item;
        }),
        sections: phase === 'results' ? sections() : null,
        printPlans: phase === 'results' ? plansForPrint('auto') : [],
        ratesAsOfLabel: ratesAsOfLabel,
        contributionSummary: QuoteMath.contributionSummary(resolved),
        payrollLabel: QuoteMath.payrollLabel(resolved.payPeriods),
        reviewDraft: reviewDraft
      };
    }

    return {
      questions: QUESTIONS,
      getState: getState,
      setAnswer: function (value) {
        answers[QUESTIONS[step].key] = value;
        error = '';
      },
      next: function (rawValue) {
        var question = QUESTIONS[step];
        if (question.kind === 'number') {
          answers[question.key] = String(rawValue == null ? '' : rawValue).trim();
        }
        var message = validateStep(answers, step);
        if (message) {
          error = message;
          return { ok: false, error: message };
        }
        error = '';
        if (tracker) tracker.onQuoteStarted(quoteStartedDetails());
        if (step === QUESTIONS.length - 1) {
          enterResults();
          return { ok: true, phase: 'results' };
        }
        step += 1;
        return { ok: true, phase: 'questions', step: step };
      },
      back: function () {
        error = '';
        if (phase !== 'questions') return;
        if (step > 0) step -= 1;
      },
      editAnswers: function () {
        phase = 'review';
        error = '';
        reviewDraft = null;
      },
      cancelReview: function () {
        phase = 'results';
        error = '';
        reviewDraft = null;
      },
      applyReview: function (nextAnswers) {
        var draft = Object.assign({}, answers, nextAnswers || {});
        QUESTIONS.forEach(function (question) {
          if (draft[question.key] != null) draft[question.key] = String(draft[question.key]);
        });
        for (var index = 0; index < QUESTIONS.length; index += 1) {
          var message = validateStep(draft, index);
          if (message) {
            error = message;
            reviewDraft = draft;
            return { ok: false, error: message, step: index };
          }
        }
        var enrollingChanged = String(answers.enrolling) !== String(draft.enrolling);
        answers = draft;
        reviewDraft = null;
        error = '';
        if (enrollingChanged || !QuoteMath.mixCheck(mix, Number(answers.enrolling || 0), Number(answers.employees || 0)).ok) {
          resetMixToEnrolling();
        } else {
          commitMix(mix);
        }
        phase = 'results';
        notifyRates();
        return { ok: true };
      },
      startOver: function () {
        answers = blankAnswers();
        step = 0;
        phase = 'questions';
        error = '';
        contribution = defaultContribution();
        mix = { employeeOnly: 0, employeeSpouse: 0, employeeChildren: 0, family: 0 };
        appliedMix = { employeeOnly: 0, employeeSpouse: 0, employeeChildren: 0, family: 0 };
        mixStatus = { ok: true, total: 0, message: '' };
        sortMode = 'price';
        carrier = 'All';
        mecOpen = false;
        saved = new Map();
      },
      setContribution: function (partial) {
        var next = Object.assign({}, partial);
        if (next.flatSelect === 'custom') {
          var incoming = next.flatCustom != null ? String(next.flatCustom).trim() : String(contribution.flatCustom || '').trim();
          if (!/^\d+$/.test(incoming) || Number(incoming) <= 0) {
            var prior = contribution.flatSelect !== 'custom' && /^\d+$/.test(String(contribution.flatSelect))
              ? String(contribution.flatSelect)
              : '300';
            next.flatCustom = prior;
          }
        }
        Object.assign(contribution, next);
        if (phase === 'results') notifyRates();
      },
      setMixField: function (field, value) {
        var tier = QuoteMath.TIER_LABELS.filter(function (item) { return item[0] === field; })[0];
        var parsed = QuoteMath.parseWholeCount(value, { min: 0, label: tier ? tier[1] : 'this tier' });
        if (!parsed.ok) {
          mixStatus = { ok: false, total: QuoteMath.mixTotal(appliedMix), message: parsed.message };
          return { ok: false, error: parsed.message };
        }
        var nextMix = copyMix(mix);
        nextMix[field] = parsed.value;
        commitMix(nextMix);
        if (phase === 'results') notifyRates();
        return { ok: true };
      },
      plansForPrint: plansForPrint,
      setSort: function (mode) {
        sortMode = mode;
        if (phase === 'results') notifyRates();
      },
      setCarrier: function (next) {
        carrier = next || 'All';
        if (phase === 'results') notifyRates();
      },
      toggleMec: function (open) {
        mecOpen = open;
        if (phase === 'results') notifyRates();
      },
      toggleSaved: function (planId, checked) {
        var plan = plans.filter(function (item) { return item.id === planId; })[0];
        if (!plan) return;
        if (checked) {
          saved.set(plan.id, {
            id: plan.id,
            name: plan.name,
            network: plan.network,
            typeBadge: plan.typeBadge,
            rates: plan.rates
          });
        } else {
          saved.delete(plan.id);
        }
      },
      leadPayload: function (contact) {
        var resolved = resolvedContribution();
        var tierMix = usedMix();
        var undecorated = QuoteMath.buildLeadPayload({
          firstName: contact.firstName,
          email: contact.email,
          phone: contact.phone,
          answers: answers,
          tierMix: tierMix,
          contribution: resolved,
          selectedPlans: Array.from(saved.values()),
          visiblePlans: QuoteMath.getVisiblePlans(plans, {
            sortMode: sortMode,
            mix: tierMix,
            contribution: resolved,
            mecVisible: mecOpen
          }),
          submittedAt: now().toISOString(),
          pageUrl: pageUrl
        });
        return tracker ? tracker.decorateLeadPayload(undecorated) : undecorated;
      },
      reportLoadError: function (loadError) {
        if (tracker) tracker.onRatesRendered({ plans: null, error: loadError });
      }
    };
  }

  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function badgeHtml(plan) {
    if (!plan || !plan.typeBadge) return '';
    return '<p class="badge">' + escapeHtml(plan.typeBadge) + '</p>';
  }

  function detailValue(plan, key) {
    return (plan.details && plan.details[key]) || '';
  }

  function notesBlock(plan) {
    var notes = Array.isArray(plan.notes) ? plan.notes : [];
    var limits = Array.isArray(plan.limitedNotes) ? plan.limitedNotes : [];
    var html = '';
    if (notes.length) {
      html += '<div class="notes"><h4>Notes</h4>' + notes.map(function (note) {
        return '<p>' + escapeHtml(note) + '</p>';
      }).join('') + '</div>';
    }
    if (limits.length) {
      html += '<div class="notes limitations"><h4>Limitations</h4>' + limits.map(function (note) {
        return '<p>' + escapeHtml(note) + '</p>';
      }).join('') + '</div>';
    }
    return html;
  }

  function planArticle(plan, state) {
    var totals = QuoteMath.planTotals(plan, state.mixUsed, state.resolvedContribution);
    var paycheck = totals.paycheck;
    var saved = state.saved.some(function (item) { return item.id === plan.id; });
    var detailsId = 'details-' + plan.id;
    var lowNote = QuoteMath.majorMedicalNote(plan);
    var tierRows = QuoteMath.TIER_LABELS.map(function (tier) {
      return '<tr><th scope="row">' + tier[1] + '</th><td>' + QuoteMath.money(plan.rates[tier[0]]) + '</td><td>' + QuoteMath.money(paycheck[tier[0]]) + '</td></tr>';
    }).join('');
    var keyRows = [
      ['deductible', 'Deductible'],
      ['oopMax', 'Out-of-pocket max'],
      ['pcp', 'PCP copay'],
      ['rx', 'Rx']
    ].map(function (row) {
      return '<div><dt>' + row[1] + '</dt><dd>' + escapeHtml(detailValue(plan, row[0])) + '</dd></div>';
    }).join('');
    var fullDetails = DETAIL_ROWS.filter(function (row) {
      if (row[0] === 'deductible' || row[0] === 'oopMax') return false;
      if ((row[0] === 'inpatientHospital' || row[0] === 'outpatientSurgery') && !detailValue(plan, row[0])) return false;
      return true;
    }).map(function (row) {
      return '<div class="detail-row"><dt>' + row[1] + '</dt><dd>' + escapeHtml(detailValue(plan, row[0])) + '</dd></div>';
    }).join('');
    var legend = legendHtml([plan]);
    return '<article class="plan-card" data-plan-id="' + escapeHtml(plan.id) + '">' +
      '<header class="plan-head"><div><p class="carrier">' + escapeHtml(QuoteMath.carrierOf(plan)) + '</p>' +
      '<h3>' + escapeHtml(QuoteMath.displayName(plan)) + '</h3>' +
      '<p class="network">' + escapeHtml(plan.network || '') + '</p>' +
      badgeHtml(plan) +
      '</div><button type="button" class="btn btn-secondary save-toggle" data-plan-id="' + escapeHtml(plan.id) + '" aria-pressed="' + (saved ? 'true' : 'false') + '">' + (saved ? 'Saved \u2713' : 'Save plan') + '</button></header>' +
      (lowNote ? '<p class="low-callout">' + escapeHtml(lowNote) + '</p>' : '') +
      '<section class="group-cost"><h4>Your group\u2019s cost</h4><dl class="cost-grid">' +
      '<div><dt>Total monthly premium</dt><dd>' + QuoteMath.money(totals.gross) + '</dd></div>' +
      '<div><dt>Employer monthly contribution</dt><dd>' + QuoteMath.money(totals.employer) + '</dd></div>' +
      '<div class="cost-ee"><dt>Employee per paycheck</dt><dd>' + QuoteMath.money(paycheck.employeeOnly) + '</dd></div>' +
      '</dl><p class="hint">Employee per paycheck shown here is employee-only, ' + escapeHtml(state.payrollLabel) + '.</p></section>' +
      '<table class="tier-table"><caption>Monthly rate and employee cost per paycheck</caption><thead><tr><th scope="col">Tier</th><th scope="col">Monthly rate</th><th scope="col">Per paycheck</th></tr></thead><tbody>' +
      tierRows + '</tbody></table>' +
      '<section class="key-benefits"><h4>Key benefits</h4><dl class="key-grid">' + keyRows + '</dl></section>' +
      legend +
      '<button type="button" class="btn btn-secondary details-toggle" aria-expanded="false" aria-controls="' + detailsId + '">View plan details</button>' +
      '<div id="' + detailsId + '" class="plan-more" hidden><div class="details">' + fullDetails + '</div>' + notesBlock(plan) + '</div>' +
      '</article>';
  }

  function legendHtml(plans) {
    var items = QuoteMath.visitLimitLegend(plans);
    if (!items.length) return '';
    return '<p class="abbrev-legend">' + items.map(function (item) { return escapeHtml(item); }).join('<br>') + '</p>';
  }

  var PRINT_TIER_ROWS = [
    ['employeeOnly', 'Employee Only'],
    ['employeeSpouse', 'Employee + Spouse'],
    ['employeeChildren', 'Employee + Child(ren)'],
    ['family', 'Family']
  ];

  function payrollCaption(contribution) {
    var periods = String((contribution && contribution.payPeriods) || 26);
    var label = 'Bi-weekly';
    QuoteMath.PAYROLL_OPTIONS.forEach(function (option) {
      if (option.value === periods) label = option.label;
    });
    return 'PPP = per pay period (' + label + ', ' + periods + ')';
  }

  function printTierTable(plan, state, compact) {
    var contribution = state.resolvedContribution;
    var rows = PRINT_TIER_ROWS.map(function (tier) {
      return '<tr><th scope="row">' + tier[1] + '</th><td>' +
        QuoteMath.money(plan.rates[tier[0]]) + '</td><td>' +
        QuoteMath.money(QuoteMath.perPaycheck(plan, tier[0], contribution)) + '</td></tr>';
    }).join('');
    var cols = compact
      ? '<col style="width:36%"><col style="width:32%"><col style="width:32%">'
      : '<col style="width:44%"><col style="width:28%"><col style="width:28%">';
    return '<table class="print-tier' + (compact ? ' is-compact' : '') + '"><colgroup>' + cols + '</colgroup><thead><tr><th scope="col"></th><th scope="col">Premium</th><th scope="col">EE Cost PPP</th></tr></thead><tbody>' +
      rows + '</tbody></table>';
  }

  function comparisonRows(state, plans, includePaycheck) {
    var flat = state.resolvedContribution && state.resolvedContribution.model === 'flat';
    var rows = [
      ['Plan type', function (plan) { return QuoteMath.planType(plan); }, false],
      ['Network', function (plan) { return plan.network || ''; }, false],
      ['Badge', function (plan) { return plan.typeBadge || ''; }, false],
      ['Total monthly premium', function (plan, totals) { return QuoteMath.money(totals.gross); }, false],
      [flat ? 'Employer contribution (flat)' : 'Employer monthly contribution', function (plan, totals) { return QuoteMath.money(totals.employer); }, false]
    ];
    if (includePaycheck !== false) {
      QuoteMath.TIER_LABELS.forEach(function (tier) {
        rows.push(['Employee paycheck \u2014 ' + tier[1], function (plan, totals) { return QuoteMath.money(totals.paycheck[tier[0]]); }, true]);
      });
    }
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
      if ((row[0] === 'inpatientHospital' || row[0] === 'outpatientSurgery') &&
          !(plans || []).some(function (plan) { return detailValue(plan, row[0]); })) return;
      rows.push([row[1], function (plan) { return detailValue(plan, row[0]); }, false]);
    });
    if ((plans || []).some(function (plan) { return QuoteMath.majorMedicalNote(plan); })) {
      rows.splice(3, 0, ['Coverage note', function (plan) { return QuoteMath.majorMedicalNote(plan); }, false]);
    }
    return rows;
  }

  function comparisonTable(plans, state, interactive) {
    var rows = comparisonRows(state, plans, interactive);
    var share = plans.length ? (84 / plans.length).toFixed(3) : '84';
    var cols = '<col style="width:16%">';
    plans.forEach(function () { cols += '<col style="width:' + share + '%">'; });
    var head = plans.map(function (plan) {
      var note = QuoteMath.majorMedicalNote(plan);
      var callout = note ? '<p class="low-callout">' + escapeHtml(note) + '</p>' : '';
      var tier = interactive ? '' : printTierTable(plan, state, plans.length >= 6);
      var action = interactive ? '<button type="button" class="btn btn-secondary" data-remove="' + escapeHtml(plan.id) + '">Remove</button>' : '';
      return '<th scope="col"><span class="compare-name">' + escapeHtml(QuoteMath.displayName(plan)) + '</span>' + badgeHtml(plan) +
        (interactive ? callout + action : tier + callout) +
        '</th>';
    }).join('');
    var body = rows.map(function (row) {
      var cells = plans.map(function (plan) {
        var totals = QuoteMath.planTotals(plan, state.mixUsed, state.resolvedContribution);
        var text = row[1](plan, totals);
        var warning = row[0] === 'Coverage note' && text;
        return '<td' + (warning ? ' class="coverage-warning"' : '') + '>' + escapeHtml(text) + '</td>';
      }).join('');
      return '<tr class="' + (row[2] ? 'compare-emph' : '') + '"><th scope="row">' + escapeHtml(row[0]) + '</th>' + cells + '</tr>';
    }).join('');
    var tableClass = interactive ? 'compare-table' : 'print-table';
    return '<table class="' + tableClass + '"><colgroup>' + cols + '</colgroup><thead><tr><th scope="col">Compare</th>' + head + '</tr></thead><tbody>' + body + '</tbody></table>' + legendHtml(plans);
  }

  function compareHtml(state) {
    var list = state.savedFull || [];
    if (!list.length) return '<p>Save a plan to compare it here.</p>';
    var flat = state.resolvedContribution.model === 'flat';
    var note = flat ? '<p class="compare-note">The employer amount is the same flat contribution on each plan. Compare the employee paycheck rows.</p>' : '';
    return note + '<div class="compare-wrap">' + comparisonTable(list, state, true) + '</div>';
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

  function printHtml(state) {
    var items = state.printPlans || [];
    var savedLayout = state.printLayout === 'saved' || (state.printLayout !== 'all' && state.saved && state.saved.length > 0);
    var perPage = savedLayout ? Math.max(items.length, 1) : 6;
    var chunks = printChunks(items, { perPage: perPage });
    var tables = chunks.map(function (chunk, index) {
      return '<section class="print-sheet' + (index ? ' print-next' : ' print-first') + '">' +
        comparisonTable(chunk.plans, state, false) + '</section>';
    }).join('');
    var which = state.saved.length ? 'Saved plans only.' : 'All plans in the current sort and carrier filter.';
    return '<header class="print-header"><p class="print-brand">DK Benefits</p>' +
      '<p>Daniel Kirves · Call/Text 407-476-5076 · dan@dkbenefits.net</p>' +
      '<p class="print-license">DK Benefits LLC owns and operates this tool. DK Benefits LLC Florida Agency License #L109331. Daniel Kirves Florida Resident Agent License #W588866. Georgia Agent License #3366904.</p></header>' +
      '<section class="print-summary"><h2>Group rate proposal</h2><p>' + escapeHtml(state.summaryLine) +
      (state.ratesAsOfLabel ? ' ' + escapeHtml(state.ratesAsOfLabel) + '.' : '') +
      ' Enrollment mix: ' + escapeHtml(state.mixSummary) + '.</p>' +
      '<p>' + escapeHtml(state.contributionSummary) + ' ' + which + '</p>' +
      '<p class="print-ppp">' + escapeHtml(payrollCaption(state.resolvedContribution)) + '</p></section>' +
      tables +
      '<section class="print-disclaimer"><h2>Important information</h2>' +
      '<p>Rates shown are based on current published pricing and the answers provided. Final eligibility, participation, underwriting, plan availability, effective dates, and carrier/program approval may change pricing or options. Benefits are governed by official plan documents.</p>' +
      '<p>Plan availability may vary by state. If your business is outside Florida or Georgia, Daniel can let you know whether DK Benefits can assist directly or connect you with an appropriate resource.</p>' +
      '<p>Use of this tool does not create a broker-client relationship or guarantee coverage.</p></section>';
  }

  function launcherLabel(state) {
    var contribution = state.resolvedContribution;
    if (contribution.model === 'flat') return 'Employer pays ' + QuoteMath.money(contribution.flatAmount) + ' per employee';
    return 'Employer pays ' + contribution.employerPercent + '% of employee-only';
  }

  function reducedMotion(win) {
    return win.matchMedia && win.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  function mount(doc) {
    var document = doc || window.document;
    var win = (doc && doc.defaultView) || window;
    var tracker = QuoteActivity.createQuoteActivityTracker({
      storage: QuoteActivity.createSafeWebStorage(),
      post: postActivityPayload
    });
    tracker.captureLandingUtms(attributionSearch(win.location.search, win.location.pathname));

    var questionSection = document.getElementById('question-section');
    var reviewSection = document.getElementById('review-section');
    var intro = document.getElementById('intro');
    var results = document.getElementById('results');
    var loadError = document.getElementById('load-error');
    var advanceTimer = 0;
    var showAllPlans = false;
    var myPlansPlace = 'header';
    var leadPlace = 'home';
    var MOBILE_FEATURED_LIMIT = 4;
    var advanceToken = 0;
    var printMode = 'auto';
    var model = null;

    function $(id) { return document.getElementById(id); }

    function showLoadError(error) {
      tracker.onRatesRendered({ plans: null, error: error });
      questionSection.hidden = true;
      if (reviewSection) reviewSection.hidden = true;
      intro.hidden = true;
      loadError.hidden = false;
      loadError.innerHTML = '<h2>We\u2019re having trouble loading plan options right now.</h2>' +
        '<p>Please refresh and try again, or call/text Daniel at <a href="tel:4074765076">407-476-5076</a>.</p>';
    }

    function scrollInside() {
      win.scrollTo(0, 0);
    }

    function narrowResults() {
      return win.matchMedia && win.matchMedia('(max-width: 859px)').matches;
    }

    function parkMyPlans() {
      var panel = $('my-plans-panel');
      var slot = $('my-plans-slot');
      if (panel && slot && panel.parentElement !== slot) slot.appendChild(panel);
    }

    function parkLead() {
      var lead = $('lead');
      var home = $('lead-home');
      if (lead && home && lead.parentElement !== home) home.appendChild(lead);
    }

    function anchorFor() {
      return $('results-actions');
    }

    function placeMyPlans() {
      var panel = $('my-plans-panel');
      if (!panel || panel.hidden) return;
      anchorFor(myPlansPlace).insertAdjacentElement('afterend', panel);
    }

    function placeLead() {
      if (!leadPlace || leadPlace === 'home') {
        parkLead();
        return;
      }
      var anchor = anchorFor(leadPlace);
      var panel = $('my-plans-panel');
      if (panel && !panel.hidden && panel.previousElementSibling === anchor) anchor = panel;
      anchor.insertAdjacentElement('afterend', $('lead'));
    }

    function plansMarkup(plans, state, deferAfter) {
      var html = '';
      var deferred = 0;
      plans.forEach(function (plan, index) {
        var hide = deferAfter != null && index >= deferAfter;
        if (hide) {
          deferred += 1;
          html += planArticle(plan, state).replace('class="plan-card"', 'class="plan-card is-deferred" hidden');
          return;
        }
        html += planArticle(plan, state);
      });
      return { html: html, deferred: deferred };
    }

    function renderQuestion() {
      var state = model.getState();
      var question = state.question;
      advanceToken += 1;
      intro.hidden = state.step !== 0;
      questionSection.hidden = false;
      if (reviewSection) reviewSection.hidden = true;
      results.hidden = true;
      document.body.classList.remove('is-results', 'is-review');
      $('assist').hidden = state.step !== 0;
      $('progress-text').textContent = 'Question ' + (state.step + 1) + ' of ' + QUESTIONS.length;
      $('progress').setAttribute('aria-valuenow', String(state.step + 1));
      $('progress').setAttribute('aria-valuetext', 'Question ' + (state.step + 1) + ' of ' + QUESTIONS.length);
      $('progress-bar').style.width = (((state.step + 1) / QUESTIONS.length) * 100) + '%';
      $('question-heading').textContent = question.title;
      $('back-btn').disabled = state.step === 0;
      var typed = question.kind !== 'choice';
      $('next-btn').hidden = !typed;
      $('next-btn').disabled = !typed;
      $('next-btn').textContent = state.step === QUESTIONS.length - 1 ? 'See Real Rates Now' : 'Continue';
      var errorEl = $('question-error');
      errorEl.hidden = !state.error;
      errorEl.textContent = state.error || '';
      var host = $('question-control');
      if (question.kind === 'choice') {
        host.innerHTML = '<div class="choices">' + question.options.map(function (option) {
          var pressed = state.answers[question.key] === option.value;
          return '<button type="button" class="choice" data-value="' + escapeHtml(option.value) + '" aria-pressed="' + (pressed ? 'true' : 'false') + '">' + escapeHtml(option.label) + '</button>';
        }).join('') + '</div>';
      } else {
        host.innerHTML = '<div class="number-field"><input id="q-number" type="number" min="1" step="1" inputmode="numeric" aria-labelledby="question-heading" value="' + escapeHtml(state.answers[question.key] || '') + '" placeholder="' + escapeHtml(question.placeholder || '') + '"' +
          (state.error ? ' aria-invalid="true" aria-describedby="question-error"' : '') + ' /></div>';
      }
      $('question-heading').focus({ preventScroll: true });
    }

    function syncContributionControls() {
      var contribution = model.getState().contribution;
      $('model-percent').setAttribute('aria-pressed', contribution.model === 'percent' ? 'true' : 'false');
      $('model-flat').setAttribute('aria-pressed', contribution.model === 'flat' ? 'true' : 'false');
      $('percent-fields').hidden = contribution.model !== 'percent';
      $('flat-fields').hidden = contribution.model !== 'flat';
      $('employer-contribution').value = String(contribution.employerPercent);
      $('dependent-contribution').value = String(contribution.dependentPercent);
      $('employer-percent-readout').textContent = contribution.employerPercent + '%';
      $('dependent-percent-readout').textContent = contribution.dependentPercent + '%';
      $('employer-contribution').setAttribute('aria-valuetext', 'Employer pays ' + contribution.employerPercent + ' percent of employee-only');
      $('dependent-contribution').setAttribute('aria-valuetext', 'Employer pays ' + contribution.dependentPercent + ' percent of the dependent portion');
      document.querySelectorAll('[data-ee]').forEach(function (button) {
        button.setAttribute('aria-pressed', Number(button.dataset.ee) === Number(contribution.employerPercent) ? 'true' : 'false');
      });
      document.querySelectorAll('[data-dep]').forEach(function (button) {
        button.setAttribute('aria-pressed', Number(button.dataset.dep) === Number(contribution.dependentPercent) ? 'true' : 'false');
      });
      document.querySelectorAll('[data-flat]').forEach(function (button) {
        button.setAttribute('aria-pressed', button.dataset.flat === String(contribution.flatSelect) ? 'true' : 'false');
      });
      var custom = $('flat-custom-amount');
      custom.hidden = contribution.flatSelect !== 'custom';
      custom.parentElement.hidden = contribution.flatSelect !== 'custom';
      custom.value = contribution.flatCustom || '';
      var flatAmount = QuoteMath.resolveFlatAmount(contribution.flatSelect, contribution.flatCustom);
      $('flat-readout').textContent = QuoteMath.money(flatAmount) + ' per enrolled employee';
      $('payroll-schedule').value = String(contribution.payPeriods);
    }

    function syncMixInputs() {
      var mix = model.getState().mix;
      $('mix-ee').value = mix.employeeOnly;
      $('mix-es').value = mix.employeeSpouse;
      $('mix-ec').value = mix.employeeChildren;
      $('mix-fam').value = mix.family;
    }

    function renderDynamic() {
      var state = model.getState();
      $('results-summary').textContent = state.summaryLine;
      $('mix-note').hidden = !state.mixNote;
      $('mix-note').textContent = state.mixNote || '';
      $('mix-note').classList.toggle('message-error', state.mixOk === false);
      var asOf = $('rates-as-of');
      asOf.hidden = !state.ratesAsOfLabel;
      asOf.textContent = state.ratesAsOfLabel || '';
      var note = $('participation-note');
      note.hidden = !state.participation;
      note.textContent = state.participation || '';
      $('contrib-summary').textContent = launcherLabel(state);
      var mixLine = $('mix-summary-line');
      if (mixLine) mixLine.textContent = state.mixSummary || '';
      parkMyPlans();
      parkLead();
      var sections = state.sections;
      var any = false;
      var deferred = 0;
      var narrow = narrowResults() && !showAllPlans;
      sections.groups.forEach(function (group) {
        if (group.id === 'mec') return;
        var section = $('section-' + group.id);
        var host = $(group.id + '-plans');
        var limit = narrow && group.id === 'top' ? MOBILE_FEATURED_LIMIT : null;
        var built = plansMarkup(group.plans, state, limit);
        host.innerHTML = built.html;
        deferred += built.deferred;
        var show = group.plans.length > 0;
        section.hidden = !show;
        if (show) any = true;
      });
      var mecSection = $('section-mec');
      mecSection.hidden = !state.mecAvailable;
      $('mec-wrap').hidden = !state.mecOpen;
      $('mec-toggle').textContent = state.mecOpen ? 'Hide MEC Section' : 'Show MEC Section';
      $('mec-toggle').setAttribute('aria-expanded', state.mecOpen ? 'true' : 'false');
      var mecGroup = sections.groups.filter(function (group) { return group.id === 'mec'; })[0];
      $('mec-plans').innerHTML = state.mecOpen ? mecGroup.plans.map(function (plan) { return planArticle(plan, state); }).join('') : '';
      if (state.mecOpen && mecGroup.plans.length) any = true;
      var showEmpty = !any && sections.empty;
      $('filter-empty').hidden = !showEmpty;
      if (showEmpty) {
        $('filter-empty').textContent = state.carrier === 'All'
          ? 'No plans to show right now.'
          : 'No plans match this carrier.';
      }
      $('my-plans-btn').textContent = 'My Plans (' + state.saved.length + ')';
      var showAllBtn = $('show-all-plans');
      var canFold = narrowResults() && sections.groups.some(function (group) {
        return group.id === 'top' && group.plans.length > MOBILE_FEATURED_LIMIT;
      });
      showAllBtn.hidden = !canFold;
      showAllBtn.textContent = showAllPlans ? 'Show fewer plans' : 'Show all ' + (deferred + MOBILE_FEATURED_LIMIT) + ' featured plans';
      showAllBtn.setAttribute('aria-expanded', showAllPlans ? 'true' : 'false');
      var savedNote = $('lead-saved-note');
      if (savedNote) {
        savedNote.textContent = state.saved.length
          ? 'Your ' + state.saved.length + ' saved plan' + (state.saved.length === 1 ? '' : 's') + ' will be included with this request.'
          : 'All plans shown will be included with this request.';
      }
      var planList = $('lead-plan-list');
      if (planList) {
        planList.innerHTML = state.saved.length
          ? state.saved.map(function (plan) { return '<li>' + escapeHtml(plan.name) + '</li>'; }).join('')
          : '<li>All plans shown</li>';
      }
      $('print-help').textContent = state.saved.length
        ? 'Printing will include the ' + state.saved.length + ' saved plan' + (state.saved.length === 1 ? '' : 's') + ' only. Clear saved plans to print the full list.'
        : 'Prints every plan in the current list. Save plans to print just those.';
      if (!$('my-plans-panel').hidden) $('drawer-body').innerHTML = compareHtml(state);
      placeMyPlans();
      placeLead();
      $('drawer-print').disabled = state.saved.length === 0;
      $('print-root').innerHTML = printHtml(state);
      $('sort-mode').value = state.sortMode;
      document.querySelectorAll('#carrier-filters [data-carrier]').forEach(function (chip) {
        chip.setAttribute('aria-checked', chip.dataset.carrier === state.carrier ? 'true' : 'false');
      });
      syncContributionControls();
    }

    function renderChips() {
      var state = model.getState();
      var carriers = ['All'].concat(state.carriers);
      $('carrier-filters').innerHTML = carriers.map(function (name) {
        var checked = name === state.carrier;
        return '<button type="button" class="chip" role="radio" data-carrier="' + escapeHtml(name) + '" aria-checked="' + (checked ? 'true' : 'false') + '">' + escapeHtml(name) + '</button>';
      }).join('');
    }

    function showResults(scroll) {
      intro.hidden = true;
      questionSection.hidden = true;
      if (reviewSection) reviewSection.hidden = true;
      results.hidden = false;
      document.body.classList.add('is-results');
      document.body.classList.remove('is-review');
      closeContrib();
      syncMixInputs();
      renderChips();
      renderDynamic();
      if (scroll) scrollInside();
    }

    function renderReview() {
      var state = model.getState();
      intro.hidden = true;
      questionSection.hidden = true;
      reviewSection.hidden = false;
      results.hidden = true;
      document.body.classList.remove('is-results');
      document.body.classList.add('is-review');
      closeContrib();
      var source = state.reviewDraft || state.answers;
      var fields = QUESTIONS.map(function (question) {
        var current = source[question.key] || '';
        var control = question.kind === 'number'
          ? '<input data-review="' + question.key + '" type="number" min="1" step="1" inputmode="numeric" value="' + escapeHtml(current) + '" aria-label="' + escapeHtml(question.title) + '" />'
          : '<div class="choices">' + question.options.map(function (option) {
            var pressed = current === option.value;
            return '<button type="button" class="choice" data-review="' + question.key + '" data-value="' + escapeHtml(option.value) + '" aria-pressed="' + (pressed ? 'true' : 'false') + '">' + escapeHtml(option.label) + '</button>';
          }).join('') + '</div>';
        return '<div><h3>' + escapeHtml(question.title) + '</h3>' + control + '</div>';
      }).join('');
      $('review-fields').innerHTML = '<div class="review-grid">' + fields + '</div>';
      $('review-error').hidden = !state.error;
      $('review-error').textContent = state.error || '';
    }

    function readReview() {
      var next = {};
      QUESTIONS.forEach(function (question) {
        if (question.kind === 'number') {
          var input = document.querySelector('#review-fields [data-review="' + question.key + '"]');
          next[question.key] = input ? input.value.trim() : '';
        } else {
          var pressed = document.querySelector('#review-fields [data-review="' + question.key + '"][aria-pressed="true"]');
          next[question.key] = pressed ? pressed.getAttribute('data-value') : '';
        }
      });
      return next;
    }

    function render() {
      var state = model.getState();
      if (state.phase === 'results') showResults(true);
      else if (state.phase === 'review') renderReview();
      else renderQuestion();
    }

    function openMyPlans(place) {
      myPlansPlace = place || 'header';
      $('my-plans-panel').hidden = false;
      $('my-plans-btn').setAttribute('aria-expanded', 'true');
      $('drawer-body').innerHTML = compareHtml(model.getState());
      $('drawer-print').disabled = model.getState().saved.length === 0;
      placeMyPlans();
      $('drawer-close').focus({ preventScroll: true });
    }

    function closeMyPlans() {
      $('my-plans-panel').hidden = true;
      $('my-plans-btn').setAttribute('aria-expanded', 'false');
      parkMyPlans();
    }

    function toggleMyPlans(place) {
      var panel = $('my-plans-panel');
      if (!panel.hidden && myPlansPlace === (place || 'header')) {
        closeMyPlans();
        return;
      }
      openMyPlans(place || 'header');
    }

    function revealLead(place) {
      closeMyPlans();
      leadPlace = place || 'header';
      placeLead();
      var back = $('lead-back');
      if (back) back.hidden = false;
      $('first-name').focus({ preventScroll: true });
    }

    function closeLead() {
      leadPlace = 'home';
      parkLead();
      $('goto-lead').focus({ preventScroll: true });
    }

    function layoutFor(mode, state) {
      if (mode === 'all') return 'all';
      if (mode === 'saved') return 'saved';
      return state.saved.length ? 'saved' : 'all';
    }

    function printPlans(mode) {
      printMode = mode;
      var state = model.getState();
      state.printLayout = layoutFor(mode, state);
      state.printPlans = model.plansForPrint(mode === 'auto' ? state.printLayout : mode);
      $('print-root').innerHTML = printHtml(state);
      win.print();
    }

    function readControlValue() {
      var input = document.querySelector('#question-control input');
      return input ? input.value : undefined;
    }

    function goNext() {
      if (!model) return;
      advanceToken += 1;
      clearTimeout(advanceTimer);
      var result = model.next(readControlValue());
      if (!result.ok) {
        renderQuestion();
        var input = document.getElementById('q-number');
        if (input) input.focus({ preventScroll: true });
        return;
      }
      render();
    }

    function scheduleAdvance() {
      var token = ++advanceToken;
      var delay = reducedMotion(win) ? 0 : 160;
      clearTimeout(advanceTimer);
      advanceTimer = setTimeout(function () {
        if (token !== advanceToken) return;
        goNext();
      }, delay);
    }

    function openContrib() {
      $('contrib').classList.add('is-open');
      $('contrib-toggle').setAttribute('aria-expanded', 'true');
      $('contrib-toggle').textContent = 'Done';
    }

    function closeContrib() {
      $('contrib').classList.remove('is-open');
      $('contrib-toggle').setAttribute('aria-expanded', 'false');
      $('contrib-toggle').textContent = 'Change';
    }

    var choiceFromKey = false;

    function chooseOption(choice) {
      model.setAnswer(choice.dataset.value);
      if (model.getState().step === QUESTIONS.length - 1) goNext();
      else {
        renderQuestion();
        scheduleAdvance();
      }
    }

    function wire() {
      $('question-control').addEventListener('click', function (event) {
        var choice = event.target.closest('.choice[data-value]');
        if (!choice) return;
        if (choiceFromKey) return;
        chooseOption(choice);
      });
      $('question-control').addEventListener('keydown', function (event) {
        if (event.key === 'Enter' && event.target.id === 'q-number') {
          event.preventDefault();
          goNext();
          return;
        }
        if (event.repeat) return;
        if (event.key !== 'Enter' && event.key !== ' ' && event.key !== 'Spacebar') return;
        var choice = event.target.closest && event.target.closest('.choice[data-value]');
        if (!choice) return;
        event.preventDefault();
        choiceFromKey = true;
        chooseOption(choice);
        setTimeout(function () { choiceFromKey = false; }, 0);
      });
      $('next-btn').addEventListener('click', goNext);
      $('back-btn').addEventListener('click', function () {
        if (!model) return;
        advanceToken += 1;
        clearTimeout(advanceTimer);
        model.back();
        renderQuestion();
      });
      $('edit-btn').addEventListener('click', function () {
        closeMyPlans();
        model.editAnswers();
        renderReview();
        scrollInside();
      });
      $('review-fields').addEventListener('click', function (event) {
        var choice = event.target.closest('[data-review][data-value]');
        if (!choice) return;
        document.querySelectorAll('#review-fields [data-review="' + choice.getAttribute('data-review') + '"]').forEach(function (button) {
          button.setAttribute('aria-pressed', button === choice ? 'true' : 'false');
        });
      });
      $('review-cancel').addEventListener('click', function () {
        model.cancelReview();
        showResults(true);
      });
      $('review-save').addEventListener('click', function () {
        var result = model.applyReview(readReview());
        if (!result.ok) {
          renderReview();
          return;
        }
        showResults(true);
      });
      function resetQuote() {
        model.startOver();
        $('start-over-confirm').hidden = true;
        $('lead-form').hidden = false;
        $('lead-form').reset();
        $('lead-success').hidden = true;
        $('lead-error').hidden = true;
        $('lead-submit').disabled = false;
        leadPlace = 'home';
        showAllPlans = false;
        closeContrib();
        closeMyPlans();
        parkLead();
        renderQuestion();
        scrollInside();
      }
      $('start-over-btn').addEventListener('click', function () {
        var count = model.getState().saved.length;
        $('start-over-message').textContent = count
          ? 'Start over? This clears your answers and your ' + count + ' saved plan' + (count === 1 ? '' : 's') + '.'
          : 'Start over? This clears your answers.';
        $('start-over-confirm').hidden = false;
        $('start-over-no').focus({ preventScroll: true });
      });
      $('start-over-no').addEventListener('click', function () {
        $('start-over-confirm').hidden = true;
        $('start-over-btn').focus({ preventScroll: true });
      });
      $('start-over-yes').addEventListener('click', resetQuote);
      $('print-btn').addEventListener('click', function () {
        printPlans('auto');
      });
      $('drawer-print').addEventListener('click', function () {
        printPlans('saved');
      });
      win.addEventListener('beforeprint', function () {
        if (model && model.getState().phase === 'results') {
          var state = model.getState();
          var layout = layoutFor(printMode, state);
          state.printLayout = layout;
          state.printPlans = model.plansForPrint(layout === 'saved' ? 'saved' : 'all');
          $('print-root').innerHTML = printHtml(state);
        }
      });
      win.addEventListener('afterprint', function () {
        printMode = 'auto';
      });
      $('sort-mode').addEventListener('change', function () {
        model.setSort($('sort-mode').value);
        renderDynamic();
      });
      $('carrier-filters').addEventListener('click', function (event) {
        var chip = event.target.closest('[data-carrier]');
        if (!chip) return;
        model.setCarrier(chip.dataset.carrier);
        renderDynamic();
      });
      $('model-percent').addEventListener('click', function () {
        model.setContribution({ model: 'percent' });
        renderDynamic();
      });
      $('model-flat').addEventListener('click', function () {
        model.setContribution({ model: 'flat' });
        renderDynamic();
      });
      document.querySelectorAll('[data-ee]').forEach(function (button) {
        button.addEventListener('click', function () {
          model.setContribution({ employerPercent: Number(button.dataset.ee) });
          renderDynamic();
        });
      });
      document.querySelectorAll('[data-dep]').forEach(function (button) {
        button.addEventListener('click', function () {
          model.setContribution({ dependentPercent: Number(button.dataset.dep) });
          renderDynamic();
        });
      });
      document.querySelectorAll('[data-flat]').forEach(function (button) {
        button.addEventListener('click', function () {
          model.setContribution({ flatSelect: button.dataset.flat });
          renderDynamic();
        });
      });
      $('employer-contribution').addEventListener('input', function () {
        model.setContribution({ employerPercent: Number($('employer-contribution').value) });
        renderDynamic();
      });
      $('dependent-contribution').addEventListener('input', function () {
        model.setContribution({ dependentPercent: Number($('dependent-contribution').value) });
        renderDynamic();
      });
      $('flat-custom-amount').addEventListener('input', function () {
        model.setContribution({ flatCustom: $('flat-custom-amount').value });
        renderDynamic();
      });
      $('payroll-schedule').addEventListener('change', function () {
        model.setContribution({ payPeriods: Number($('payroll-schedule').value) });
        renderDynamic();
      });
      ['mix-ee', 'mix-es', 'mix-ec', 'mix-fam'].forEach(function (id) {
        $(id).addEventListener('input', function () {
          model.setMixField($(id).dataset.mix, $(id).value);
          renderDynamic();
        });
      });
      document.body.addEventListener('click', function (event) {
        var save = event.target.closest('.save-toggle');
        if (save) {
          var on = save.getAttribute('aria-pressed') === 'true';
          model.toggleSaved(save.getAttribute('data-plan-id'), !on);
          renderDynamic();
          return;
        }
        var details = event.target.closest('.details-toggle');
        if (!details) return;
        var panel = document.getElementById(details.getAttribute('aria-controls'));
        var open = details.getAttribute('aria-expanded') === 'true';
        details.setAttribute('aria-expanded', open ? 'false' : 'true');
        details.textContent = open ? 'View plan details' : 'Hide plan details';
        if (panel) panel.hidden = open;
      });
      $('drawer-body').addEventListener('click', function (event) {
        var button = event.target.closest('[data-remove]');
        if (!button) return;
        model.toggleSaved(button.getAttribute('data-remove'), false);
        renderDynamic();
      });
      $('my-plans-btn').addEventListener('click', function () {
        toggleMyPlans('header');
      });
      $('drawer-close').addEventListener('click', function () {
        closeMyPlans();
        $('my-plans-btn').focus({ preventScroll: true });
      });
      $('drawer-send').addEventListener('click', function () {
        revealLead(myPlansPlace || 'header');
      });
      $('mec-toggle').addEventListener('click', function () {
        model.toggleMec(!model.getState().mecOpen);
        renderDynamic();
      });
      $('contrib-toggle').addEventListener('click', function () {
        if ($('contrib').classList.contains('is-open')) closeContrib();
        else openContrib();
      });
      if ($('mix-toggle')) {
        $('mix-toggle').addEventListener('click', function () {
          var panel = document.querySelector('.mix-panel');
          var open = panel.classList.toggle('is-open');
          $('mix-toggle').setAttribute('aria-expanded', open ? 'true' : 'false');
          $('mix-toggle').textContent = open ? 'Done' : 'Adjust';
        });
      }
      if ($('lead-back')) {
        $('lead-back').addEventListener('click', function () {
          closeLead();
        });
      }
      $('show-all-plans').addEventListener('click', function () {
        showAllPlans = !showAllPlans;
        renderDynamic();
      });
      document.addEventListener('keydown', function (event) {
        if (event.key !== 'Escape') return;
        closeContrib();
        closeMyPlans();
      });
      $('goto-lead').addEventListener('click', function () {
        revealLead('header');
      });
      if (win.matchMedia) {
        var narrowMedia = win.matchMedia('(max-width: 859px)');
        var onNarrowChange = function () {
          if (model && model.getState().phase === 'results') renderDynamic();
        };
        if (narrowMedia.addEventListener) narrowMedia.addEventListener('change', onNarrowChange);
      }
      $('lead-form').addEventListener('submit', function (event) {
        event.preventDefault();
        var firstName = $('first-name').value.trim();
        var email = $('email').value.trim();
        var phone = $('phone').value.trim();
        if (!firstName || !email) return;
        var payload = model.leadPayload({ firstName: firstName, email: email, phone: phone });
        $('lead-error').hidden = true;
        $('lead-submit').disabled = true;
        fetch(WEBHOOK_URL, { method: 'POST', body: JSON.stringify(payload) })
          .then(function (response) {
            return response.text().then(function (responseText) {
              if (!response.ok) throw new Error('Webhook failed with status ' + response.status + ': ' + responseText);
              $('lead-form').hidden = true;
              if ($('lead-next')) $('lead-next').hidden = true;
              if ($('lead-saved-note')) $('lead-saved-note').hidden = true;
              if ($('lead-plan-list')) $('lead-plan-list').hidden = true;
              $('lead-success').hidden = false;
              $('lead-success').innerHTML = '<h3>Thanks, ' + escapeHtml(firstName) + '.</h3>' +
                '<p>Daniel has your request and will follow up about these plans.</p>' +
                '<p>Next, call or text him at <a href="tel:4074765076">407-476-5076</a>.</p>';
            });
          })
          .catch(function (error) {
            console.error('Lead webhook error:', error);
            $('lead-error').hidden = false;
            $('lead-submit').disabled = false;
          });
      });
    }

    wire();
    return Promise.all([
      fetch(previewAsset('../plans.json'), { cache: 'no-store' }).then(function (response) {
        if (!response.ok) throw new Error('Failed to load plans.json (' + response.status + ')');
        return response.json();
      }),
      fetch(previewAsset('preview-config.json'), { cache: 'no-store' }).then(function (response) {
        if (!response.ok) throw new Error('config');
        return response.json();
      }).catch(function () { return {}; })
    ]).then(function (loaded) {
      var plans = loaded[0];
      var config = loaded[1] || {};
      if (!Array.isArray(plans)) throw new Error('plans.json did not return an array');
      model = createModel({
        plans: plans,
        tracker: tracker,
        pageUrl: win.location.href,
        ratesAsOfLabel: config.ratesAsOfLabel || ''
      });
      renderQuestion();
    }).catch(showLoadError);
  }

  if (typeof window !== 'undefined' && window.document && window.document.getElementById('quote-app')) {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { mount(); });
    else mount();
  }

  return {
    WEBHOOK_URL: WEBHOOK_URL,
    ACTIVITY_TRACKING_ENABLED: ACTIVITY_TRACKING_ENABLED,
    PREVIEW_UTM_SOURCE: PREVIEW_UTM_SOURCE,
    QUESTIONS: QUESTIONS,
    attributionSearch: attributionSearch,
    previewAsset: previewAsset,
    onPreviewPath: onPreviewPath,
    createModel: createModel,
    validateStep: validateStep,
    postActivityPayload: postActivityPayload,
    mount: mount,
    escapeHtml: escapeHtml,
    planArticle: planArticle,
    compareHtml: compareHtml,
    printHtml: printHtml,
    printChunks: printChunks
  };
});
