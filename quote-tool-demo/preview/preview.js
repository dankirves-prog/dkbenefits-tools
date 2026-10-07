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
    ['rx', 'RX summary']
  ];

  function attributionSearch(search) {
    var parsed = QuoteActivity.parseUtms(search || '');
    if (!parsed || Object.keys(parsed).length === 0) return '?utm_source=' + PREVIEW_UTM_SOURCE;
    var query = search || '';
    if (query.charAt(0) !== '?') return '?' + query;
    return query;
  }

  function postActivityPayload(payload) {
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

  function validateStep(answers, step) {
    var question = QUESTIONS[step];
    var value = answers[question.key];
    if (question.kind === 'number') {
      var amount = Number(value);
      if (!value || !Number.isFinite(amount) || amount <= 0) return 'Enter a number greater than zero.';
      if (question.key === 'enrolling' && answers.employees && amount > Number(answers.employees)) {
        return 'Enrollment can\u2019t be higher than the number of eligible employees. Update one of these numbers to continue.';
      }
      if (question.key === 'employees' && answers.enrolling && Number(answers.enrolling) > amount) {
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

    function notifyRates() {
      if (!tracker || phase !== 'results') return;
      tracker.onRatesRendered({ plans: plans, visibleGroups: visibleGroups() });
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
        payrollLabel: QuoteMath.payrollLabel(resolved.payPeriods)
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
        if (tracker) tracker.onQuoteStarted();
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
      },
      cancelReview: function () {
        phase = 'results';
        error = '';
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
            return { ok: false, error: message, step: index };
          }
        }
        var enrollingChanged = String(answers.enrolling) !== String(draft.enrolling);
        answers = draft;
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
        Object.assign(contribution, partial);
        if (phase === 'results') notifyRates();
      },
      setMixField: function (field, value) {
        var next = copyMix(mix);
        next[field] = Math.max(0, Number(value || 0));
        commitMix(next);
        if (phase === 'results') notifyRates();
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
    var fullDetails = DETAIL_ROWS.map(function (row) {
      return '<div class="detail-row"><dt>' + row[1] + '</dt><dd>' + escapeHtml(detailValue(plan, row[0])) + '</dd></div>';
    }).join('');
    return '<article class="plan-card" data-plan-id="' + escapeHtml(plan.id) + '">' +
      '<header class="plan-head"><div><p class="carrier">' + escapeHtml(QuoteMath.carrierOf(plan)) + '</p>' +
      '<h3>' + escapeHtml(QuoteMath.displayName(plan)) + '</h3>' +
      '<p class="network">' + escapeHtml(plan.network || '') + '</p>' +
      badgeHtml(plan) +
      '</div><button type="button" class="btn btn-secondary save-toggle" data-plan-id="' + escapeHtml(plan.id) + '" aria-pressed="' + (saved ? 'true' : 'false') + '">' + (saved ? 'Saved \u2713' : 'Save plan') + '</button></header>' +
      (lowNote ? '<p class="low-callout">' + escapeHtml(lowNote) + '</p>' : '') +
      '<section class="group-cost"><h4>Your group\u2019s cost</h4><dl class="cost-grid">' +
      '<div><dt>Total monthly premium</dt><dd>' + QuoteMath.money(totals.gross) + '</dd></div>' +
      '<div><dt>Employer monthly</dt><dd>' + QuoteMath.money(totals.employer) + '</dd></div>' +
      '<div class="cost-ee"><dt>Employee per paycheck</dt><dd>' + QuoteMath.money(paycheck.employeeOnly) + '</dd></div>' +
      '</dl><p class="hint">Employee per paycheck shown here is employee-only, ' + escapeHtml(state.payrollLabel) + '.</p></section>' +
      '<table class="tier-table"><caption>Monthly rate and employee cost per paycheck</caption><thead><tr><th scope="col">Tier</th><th scope="col">Monthly rate</th><th scope="col">Per paycheck</th></tr></thead><tbody>' +
      tierRows + '</tbody></table>' +
      '<section class="key-benefits"><h4>Key benefits</h4><dl class="key-grid">' + keyRows + '</dl></section>' +
      '<button type="button" class="btn btn-secondary details-toggle" aria-expanded="false" aria-controls="' + detailsId + '">View plan details</button>' +
      '<div id="' + detailsId + '" class="plan-more" hidden><div class="details">' + fullDetails + '</div>' + notesBlock(plan) + '</div>' +
      '</article>';
  }

  function comparisonRows(state) {
    var flat = state.resolvedContribution && state.resolvedContribution.model === 'flat';
    var rows = [
      ['Plan type', function (plan) { return plan.typeBadge || ''; }, false],
      ['Network', function (plan) { return plan.network || ''; }, false],
      ['Total monthly', function (plan, totals) { return QuoteMath.money(totals.gross); }, false],
      [flat ? 'Employer contribution (flat)' : 'Employer monthly', function (plan, totals) { return QuoteMath.money(totals.employer); }, false]
    ];
    QuoteMath.TIER_LABELS.forEach(function (tier) {
      rows.push(['Employee paycheck \u2014 ' + tier[1], function (plan, totals) { return QuoteMath.money(totals.paycheck[tier[0]]); }, true]);
    });
    [
      ['deductible', 'Deductible'],
      ['oopMax', 'Out-of-pocket max'],
      ['pcp', 'PCP'],
      ['specialist', 'Specialist'],
      ['urgentCare', 'Urgent care'],
      ['emergencyRoom', 'Emergency room'],
      ['rx', 'Rx']
    ].forEach(function (row) {
      rows.push([row[1], function (plan) { return detailValue(plan, row[0]); }, false]);
    });
    return rows;
  }

  function comparisonTable(plans, state, interactive) {
    var rows = comparisonRows(state);
    var head = plans.map(function (plan) {
      return '<th scope="col"><span class="compare-name">' + escapeHtml(QuoteMath.displayName(plan)) + '</span>' + badgeHtml(plan) +
        (interactive ? '<button type="button" class="btn btn-secondary" data-remove="' + escapeHtml(plan.id) + '">Remove</button>' : '') +
        '</th>';
    }).join('');
    var body = rows.map(function (row) {
      var cells = plans.map(function (plan) {
        var totals = QuoteMath.planTotals(plan, state.mixUsed, state.resolvedContribution);
        return '<td>' + escapeHtml(row[1](plan, totals)) + '</td>';
      }).join('');
      return '<tr class="' + (row[2] ? 'compare-emph' : '') + '"><th scope="row">' + escapeHtml(row[0]) + '</th>' + cells + '</tr>';
    }).join('');
    return '<table class="' + (interactive ? 'compare-table' : 'print-table') + '"><thead><tr><th scope="col">Compare</th>' + head + '</tr></thead><tbody>' + body + '</tbody></table>';
  }

  function compareHtml(state) {
    var list = state.savedFull || [];
    if (!list.length) return '<p>Save a plan to compare it here.</p>';
    var flat = state.resolvedContribution.model === 'flat';
    var note = flat ? '<p class="compare-note">The employer amount is the same flat contribution on each plan. Compare the employee paycheck rows.</p>' : '';
    return note + '<div class="compare-wrap">' + comparisonTable(list, state, true) + '</div>';
  }

  function printChunks(items) {
    var chunks = [];
    var section = '';
    var bucket = [];
    function flush() {
      if (!bucket.length) return;
      chunks.push({ section: section, plans: bucket.slice() });
      bucket = [];
    }
    (items || []).forEach(function (item) {
      if (item.section !== section) {
        flush();
        section = item.section;
      }
      bucket.push(item.plan);
      if (bucket.length === 4) flush();
    });
    flush();
    return chunks;
  }

  function printHtml(state) {
    var chunks = printChunks(state.printPlans || []);
    var tables = chunks.map(function (chunk, index) {
      return '<section class="' + (index ? 'print-block print-next' : 'print-first') + '"><h2 class="print-section">' + escapeHtml(chunk.section) + '</h2>' +
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
      '<p>Tiers: Employee, Employee + Spouse, Employee + Child, Family.</p></section>' +
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
    tracker.captureLandingUtms(attributionSearch(win.location.search));

    var questionSection = document.getElementById('question-section');
    var reviewSection = document.getElementById('review-section');
    var intro = document.getElementById('intro');
    var results = document.getElementById('results');
    var loadError = document.getElementById('load-error');
    var dock = document.getElementById('dock');
    var advanceTimer = 0;
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
        '<p>Please refresh and try again, or call/text Daniel at <a href="tel:4074765076">407-476-5076</a>.</p>' +
        '<p class="hint">Technical detail: ' + escapeHtml(error && error.message ? error.message : error) + '</p>';
    }

    function scrollTo(el) {
      if (!el) return;
      var behavior = reducedMotion(win) ? 'auto' : 'smooth';
      el.scrollIntoView({ behavior: behavior, block: 'start' });
    }

    function renderQuestion() {
      var state = model.getState();
      var question = state.question;
      advanceToken += 1;
      intro.hidden = state.step !== 0;
      questionSection.hidden = false;
      if (reviewSection) reviewSection.hidden = true;
      results.hidden = true;
      dock.hidden = true;
      document.body.classList.remove('is-results');
      $('assist').hidden = state.step !== 0;
      $('progress-text').textContent = 'Question ' + (state.step + 1) + ' of ' + QUESTIONS.length;
      $('progress').setAttribute('aria-valuenow', String(state.step + 1));
      $('progress').setAttribute('aria-valuetext', 'Question ' + (state.step + 1) + ' of ' + QUESTIONS.length);
      $('progress-bar').style.width = (((state.step + 1) / QUESTIONS.length) * 100) + '%';
      $('question-heading').textContent = question.title;
      $('back-btn').disabled = state.step === 0;
      $('next-btn').disabled = false;
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
      $('contrib-launcher-label').textContent = launcherLabel(state);
      var sections = state.sections;
      var any = false;
      sections.groups.forEach(function (group) {
        if (group.id === 'mec') return;
        var section = $('section-' + group.id);
        var host = $(group.id + '-plans');
        host.innerHTML = group.plans.map(function (plan) { return planArticle(plan, state); }).join('');
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
      $('print-help').textContent = state.saved.length
        ? 'Printing will include the ' + state.saved.length + ' saved plan' + (state.saved.length === 1 ? '' : 's') + ' only. Clear saved plans to print the full list.'
        : 'Prints every plan in the current list. Save plans to print just those.';
      if (!$('plans-drawer').hidden) $('drawer-body').innerHTML = compareHtml(state);
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
      dock.hidden = false;
      document.body.classList.add('is-results');
      closeContrib();
      syncMixInputs();
      renderChips();
      renderDynamic();
      if (scroll) scrollTo(results);
    }

    function renderReview() {
      var state = model.getState();
      intro.hidden = true;
      questionSection.hidden = true;
      reviewSection.hidden = false;
      results.hidden = true;
      dock.hidden = true;
      document.body.classList.remove('is-results');
      closeContrib();
      var fields = QUESTIONS.map(function (question) {
        var current = state.answers[question.key] || '';
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

    function openDrawer() {
      $('plans-drawer').hidden = false;
      $('my-plans-btn').setAttribute('aria-expanded', 'true');
      $('drawer-body').innerHTML = compareHtml(model.getState());
      $('drawer-print').disabled = model.getState().saved.length === 0;
      $('drawer-close').focus();
    }

    function closeDrawer() {
      $('plans-drawer').hidden = true;
      $('my-plans-btn').setAttribute('aria-expanded', 'false');
    }

    function printPlans(mode) {
      printMode = mode;
      var state = model.getState();
      state.printPlans = model.plansForPrint(mode);
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
        if (input) input.focus();
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
      $('contrib-launcher').setAttribute('aria-expanded', 'true');
      $('contrib-backdrop').hidden = false;
      $('contrib-close').focus();
    }

    function closeContrib() {
      $('contrib').classList.remove('is-open');
      $('contrib-launcher').setAttribute('aria-expanded', 'false');
      $('contrib-backdrop').hidden = true;
    }

    function wire() {
      $('question-control').addEventListener('click', function (event) {
        var choice = event.target.closest('[data-value]');
        if (!choice) return;
        model.setAnswer(choice.dataset.value);
        if (model.getState().step === QUESTIONS.length - 1) goNext();
        else {
          renderQuestion();
          scheduleAdvance();
        }
      });
      $('question-control').addEventListener('keydown', function (event) {
        if (event.key === 'Enter' && event.target.id === 'q-number') {
          event.preventDefault();
          goNext();
        }
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
        closeDrawer();
        model.editAnswers();
        renderReview();
        scrollTo(reviewSection);
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
      $('start-over-btn').addEventListener('click', function () {
        model.startOver();
        $('lead-form').hidden = false;
        $('lead-form').reset();
        $('lead-success').hidden = true;
        $('lead-error').hidden = true;
        $('lead-submit').disabled = false;
        closeContrib();
        closeDrawer();
        renderQuestion();
        scrollTo(intro);
      });
      $('print-btn').addEventListener('click', function () {
        printPlans('auto');
      });
      $('drawer-print').addEventListener('click', function () {
        printPlans('saved');
      });
      win.addEventListener('beforeprint', function () {
        if (model && model.getState().phase === 'results') {
          var state = model.getState();
          state.printPlans = model.plansForPrint(printMode);
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
      $('my-plans-btn').addEventListener('click', openDrawer);
      $('drawer-close').addEventListener('click', function () {
        closeDrawer();
        $('my-plans-btn').focus();
      });
      $('drawer-backdrop').addEventListener('click', closeDrawer);
      $('drawer-send').addEventListener('click', function () {
        closeDrawer();
        closeContrib();
        scrollTo($('lead'));
        $('first-name').focus();
      });
      $('mec-toggle').addEventListener('click', function () {
        model.toggleMec(!model.getState().mecOpen);
        renderDynamic();
      });
      $('contrib-launcher').addEventListener('click', openContrib);
      $('contrib-close').addEventListener('click', function () {
        closeContrib();
        $('contrib-launcher').focus();
      });
      $('contrib-backdrop').addEventListener('click', closeContrib);
      document.addEventListener('keydown', function (event) {
        if (event.key !== 'Escape') return;
        closeContrib();
        closeDrawer();
      });
      $('goto-lead').addEventListener('click', function () {
        closeContrib();
        closeDrawer();
        scrollTo($('lead'));
        $('first-name').focus();
      });
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
              $('lead-success').hidden = false;
              $('lead-success').innerHTML = '<h3>Thanks, ' + escapeHtml(firstName) + '. Daniel has your information.</h3>' +
                '<p>He will follow up about these plans for your group. You can also call or text him at <a href="tel:4074765076">407-476-5076</a>.</p>';
              scrollTo($('lead-success'));
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
      fetch('../plans.json', { cache: 'no-store' }).then(function (response) {
        if (!response.ok) throw new Error('Failed to load plans.json (' + response.status + ')');
        return response.json();
      }),
      fetch('preview-config.json', { cache: 'no-store' }).then(function (response) {
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
    PREVIEW_UTM_SOURCE: PREVIEW_UTM_SOURCE,
    QUESTIONS: QUESTIONS,
    attributionSearch: attributionSearch,
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
