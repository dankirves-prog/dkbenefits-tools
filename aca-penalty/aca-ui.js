(function () {
  var form = document.getElementById('aca');
  if (!form || !window.ACA) return;
  var cfg = window.ACA_CONFIG || {};
  var resultsEl = document.getElementById('results');
  var leadEl = document.getElementById('lead');
  var leadForm = document.getElementById('lead-form');
  var startedAt = new Date().toISOString();
  var lastResult = null;
  var endpoint = window.AcaLeads ? AcaLeads.endpointOf(cfg.endpoint || '') : '';
  var tracker = window.AcaLeads ? AcaLeads.createAcaTracker({
    storage: AcaLeads.createSafeWebStorage(),
    post: postLead,
    endpoint: endpoint,
    pageUrl: location.href,
    referrer: document.referrer || '',
    test: /(?:^|[?&])test=1(?:&|$)/.test(location.search),
    startedAt: startedAt,
    now: function () { return new Date(); }
  }) : null;
  var openTip = null;
  var pop = document.createElement('div');
  pop.id = 'info-pop';
  pop.className = 'info-pop';
  pop.hidden = true;
  pop.setAttribute('role', 'note');
  document.body.appendChild(pop);

  function val(id) {
    var el = document.getElementById(id);
    return el ? String(el.value || '').trim() : '';
  }

  function checked(name) {
    var el = form.querySelector('input[name="' + name + '"]:checked');
    return el ? el.value : '';
  }

  function esc(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function yearNum() { return Number(val('year') || 2026); }

  function rates() { return ACA.YEARS[yearNum()] || ACA.YEARS[2026]; }

  function fplCents() {
    var table = rates().fpl[val('planStart')] || rates().fpl.calendar;
    var place = val('location') || 'mainland';
    return ACA.fplMaxMonthlyCents(table[place], rates().rateNum, rates().rateDen);
  }

  function tipText(key) {
    var r = rates();
    var a = ACA.money(r.aAnnual * 100);
    var b = ACA.money(r.bAnnual * 100);
    var rate = r.rateLabel;
    var fpl = ACA.money(fplCents());
    var where = { mainland: 'the 48 states and DC', alaska: 'Alaska', hawaii: 'Hawaii' }[val('location')] || 'the 48 states and DC';
    var plan = val('planStart') === 'later' ? 'a plan year that starts February 1 or later' : 'calendar-year plans';
    var tips = {
      year: 'The year you might owe a penalty for. Whether the rules apply depends on your headcount the year before. IRS penalty letters often arrive more than a year later.',
      ale: 'An employer that averaged 50 or more full-time employees last year, counting part-time hours as equivalents. Only ALEs can owe these penalties.',
      ftPrior: 'Anyone with 130 or more hours of service in a month (about 30 a week). Paid time off counts as hours: vacation, holidays, sick days.',
      partTime: 'Add the monthly hours of everyone who isn\'t full-time, including seasonal and variable-hour staff. Count no more than 120 hours per person. Every 120 hours = one full-time equivalent.',
      newCompany: 'Check this only if the business didn\'t exist on any business day last year. Then enter the average you expect this year. You\'re an ALE if you expect 50 or more and actually reach it.',
      group: 'Companies under common ownership or control (often 80% or more) count as one employer for the 50-employee test. Each company still figures its own penalty. The rules are technical, so confirm with your CPA.',
      otherAverage: 'The other companies\' combined full-time employees plus equivalents, averaged over last year, before rounding.',
      otherFt: 'Their full-time employees only, not equivalents, for this year. Used to split the 30-employee reduction between the companies.',
      seasonal: 'If you went over 50 for 120 days or fewer last year, and the extra people were seasonal workers, you\'re not an ALE. Four calendar months count as 120 days, and they don\'t have to be in a row. Examples: harvest crews, holiday-only retail staff.',
      ftNow: 'Full-time employees in a typical month this year. If you use a look-back measurement period, count everyone treated as full-time in their stability period. Part-time equivalents don\'t count here.',
      waiting: 'Generally a new full-time hire\'s first three full calendar months, if you offer coverage by the start of month four. Some other new and variable-hour employees qualify too. Leave 0 if unsure; the estimate just runs a bit high.',
      notOffered: 'Count full-time employees who weren\'t offered coverage, or whose children under 26 weren\'t offered coverage. Spouses don\'t have to be offered. You can miss 5% (or 5 people, if more) before the A penalty, but anyone missed who gets a credit can still trigger the B penalty.',
      credit: 'A federal subsidy for insurance bought on HealthCare.gov or a state Marketplace. An employee generally can\'t get one if enrolled in your plan or offered coverage that\'s affordable for them and meets minimum value. You usually find out from IRS Letter 226-J.',
      credits: 'Count full-time employees who got a credit and either weren\'t offered coverage or were offered coverage that fails your affordability test or minimum value. Not sure? Even one credit triggers the A penalty if you missed the 95% offer test.',
      months: 'Penalties are figured month by month, at 1/12 of the yearly amount. Uncheck any month the situation above didn\'t apply.',
      premium: 'What the employee pays each month for employee-only coverage on your cheapest plan that meets minimum value. Use this even if they chose family or a richer plan. Subtract flex credits only if they can\'t be taken as cash and can only be used for health benefits.',
      mv: 'The plan pays at least 60% of total covered costs and covers hospital and doctor services. Your plan\'s Summary of Benefits and Coverage (SBC) says whether it meets minimum value.',
      harbor: 'Three IRS shortcuts for proving coverage was affordable without knowing an employee\'s household income. Pass one for an employee and you owe no B penalty for them, even if they got a credit. The poverty-line test is simplest and covers everyone.',
      poverty: 'Coverage is affordable for everyone if the employee\'s monthly cost is at or below ' + fpl + ' for ' + yearNum() + ' ' + plan + ' in ' + where + '. That\'s ' + rate + ' of the single-person poverty line, divided by 12.',
      location: 'Alaska and Hawaii have higher poverty lines. Use the state where the employee works, not where they live.',
      planStart: 'You can use a poverty line in effect within six months before your plan year starts. New figures come out each January, so a January 1 plan uses the prior year\'s.',
      w2: 'Affordable if the employee\'s yearly cost is no more than ' + rate + ' of their W-2 Box 1 wages. Box 1 is reduced by 401(k) and pre-tax deductions. It can only be confirmed after year-end, and it\'s prorated for partial years.',
      rate: 'Hourly: rate x 130 hours x ' + rate + '. Salaried: monthly salary x ' + rate + '. Use the rate on the first day of the plan year; if an hourly rate drops, use the lowest rate that month. Not available if a salary is cut.',
      reduction: 'Your first 30 full-time employees are subtracted before the A penalty is figured. In a controlled group, the 30 is split among the companies by full-time headcount, rounded up.',
      penalties: 'A: you missed the 95% offer test and at least one full-time employee got a credit; (full-time - 30) x ' + a + ' a year. B: you met the test, but some full-time employees got credits; ' + b + ' a year each, never more than A. Both are figured monthly.',
      letter: 'The IRS letter that proposes the penalty, based on your 1094-C and 1095-C filings. Your response is generally due 30 days from the letter\'s date.'
    };
    return tips[key] || '';
  }

  function closeTip() {
    pop.hidden = true;
    if (openTip) {
      openTip.setAttribute('aria-expanded', 'false');
      openTip = null;
    }
  }

  function openTipFor(btn) {
    var key = btn.getAttribute('data-tip');
    pop.textContent = tipText(key);
    pop.hidden = false;
    btn.setAttribute('aria-expanded', 'true');
    openTip = btn;
    var rect = btn.getBoundingClientRect();
    var width = Math.min(320, window.innerWidth - 24);
    var left = Math.max(12, Math.min(rect.left, window.innerWidth - width - 12));
    pop.style.width = width + 'px';
    pop.style.left = left + 'px';
    var top = rect.bottom + 8;
    pop.style.top = top + 'px';
    var popRect = pop.getBoundingClientRect();
    if (popRect.bottom > window.innerHeight - 8) pop.style.top = Math.max(8, rect.top - popRect.height - 8) + 'px';
  }

  function buildGrids() {
    var months = document.getElementById('months');
    var prior = document.getElementById('prior-months');
    var penalty = document.getElementById('penalty-months');
    var monthHtml = '';
    var priorHtml = '';
    var penHtml = '';
    ACA.MONTHS.forEach(function (name, i) {
      monthHtml += '<label class="month"><input id="month' + i + '" type="checkbox" checked> ' + name.slice(0, 3) + '</label>';
      priorHtml += '<div class="month-card"><strong>' + name + '</strong><label>Full-time<input id="priorFt' + i + '" type="number" min="0" step="1" value="0"></label><label>Part-time hours<input id="priorHours' + i + '" type="number" min="0" step="1" value="0"></label></div>';
      penHtml += '<div class="month-card"><label class="month"><input id="penOn' + i + '" type="checkbox"> ' + name + '</label><label>Full-time<input id="penFt' + i + '" type="number" min="0" step="1" value="0"></label><label>Not offered<input id="penMiss' + i + '" type="number" min="0" step="1" value="0"></label><label>Credits<input id="penPtc' + i + '" type="number" min="0" step="1" value="0"></label><label>Credits among not offered<input id="penMissCredits' + i + '" type="number" min="0" step="1" value="0"></label></div>';
    });
    months.innerHTML = monthHtml;
    prior.innerHTML = priorHtml;
    penalty.innerHTML = penHtml;
  }

  function readForm() {
    var months = [];
    var priorMonths = [];
    var penaltyMonths = [];
    var offerCoverage = checked('offerCoverage') || 'all';
    for (var i = 0; i < 12; i++) {
      months.push(document.getElementById('month' + i).checked);
      priorMonths.push({ fullTime: val('priorFt' + i), partTimeHours: val('priorHours' + i) });
      penaltyMonths.push({
        include: document.getElementById('penOn' + i).checked,
        fullTime: val('penFt' + i),
        notOffered: val('penMiss' + i),
        ptcCount: val('penPtc' + i),
        creditsNotOffered: val('penMissCredits' + i)
      });
    }
    var exactOpen = !document.getElementById('exact-hours').classList.contains('hidden');
    return {
      year: val('year'),
      priorMode: document.getElementById('priorVary').checked ? 'months' : 'average',
      averageFullTime: val('averageFullTime'),
      partTimeCount: val('partTimeCount'),
      hoursPerWeek: val('hoursPerWeek'),
      useExactHours: exactOpen,
      exactHours: val('exactHours'),
      priorMonths: priorMonths,
      newEmployer: document.getElementById('newEmployer').checked,
      seasonalAttest: document.getElementById('seasonalAttest').checked,
      controlledGroup: document.getElementById('controlledGroup').checked,
      otherMembersAverage: val('otherMembersAverage'),
      otherMembersFullTime: val('otherMembersFullTime'),
      penaltyMode: document.getElementById('penaltyVary').checked ? 'months' : 'same',
      fullTime: val('fullTime'),
      nonAssessment: val('nonAssessment'),
      offerCoverage: offerCoverage,
      offer: '',
      notOffered: offerCoverage === 'most' ? val('notOffered') : '',
      ptcCount: val('ptcCount'),
      creditsNotOffered: offerCoverage === 'most' ? val('creditsNotOffered') : '',
      creditUnsure: document.getElementById('creditUnsure').checked,
      anyCredit: false,
      months: months,
      penaltyMonths: penaltyMonths,
      affordUse: val('premium') !== '',
      premium: val('premium'),
      harbor: val('harbor'),
      minimumValue: checked('minimumValue') || 'yes',
      w2Wages: val('w2Wages'),
      payType: checked('payType') || 'hourly',
      hourlyRate: val('hourlyRate'),
      monthlySalary: val('monthlySalary'),
      location: val('location'),
      planStart: val('planStart')
    };
  }

  function syncChrome() {
    var year = yearNum();
    var prior = year - 1;
    var label = document.getElementById('ft-prior-label');
    var newCo = document.getElementById('newEmployer').checked;
    label.firstChild.nodeValue = newCo ? 'Expected average this year ' : ('Full-time employees in a typical month of ' + prior + ' ');
    document.getElementById('group-fields').classList.toggle('hidden', !document.getElementById('controlledGroup').checked);
    document.getElementById('prior-months').classList.toggle('hidden', !document.getElementById('priorVary').checked);
    document.getElementById('penalty-months').classList.toggle('hidden', !document.getElementById('penaltyVary').checked);
    var harbor = val('harbor');
    document.getElementById('w2-fields').classList.toggle('hidden', harbor !== 'w2');
    document.getElementById('rate-fields').classList.toggle('hidden', harbor !== 'rate');
    document.getElementById('fpl-fields').classList.toggle('hidden', harbor !== 'fpl');
    document.getElementById('salary-wrap').classList.toggle('hidden', checked('payType') !== 'salary');
    document.getElementById('hourly-wrap').classList.toggle('hidden', checked('payType') === 'salary');
    if (harbor === 'w2' || harbor === 'rate') document.getElementById('less-common').open = true;
    var later = document.querySelector('#planStart option[value="later"]');
    later.disabled = String(year) === '2027';
    if (String(year) === '2027' && val('planStart') === 'later') document.getElementById('planStart').value = 'calendar';
    var table = (rates().fpl[val('planStart')] || rates().fpl.calendar);
    document.getElementById('fpl-note').textContent = table.note + ' Poverty-line limit this month: ' + ACA.money(fplCents()) + '.';
    document.getElementById('rate-line').textContent = year + ' indexed amounts: no-offer penalty (A) ' + ACA.money(rates().aAnnual * 100) + ' a year, unaffordable-offer penalty (B) ' + ACA.money(rates().bAnnual * 100) + ' a year. Affordability is ' + rates().rateLabel + '.';
    var offerCoverage = checked('offerCoverage');
    var missed = Number(val('notOffered') || 0);
    document.getElementById('not-offered-wrap').classList.toggle('hidden', offerCoverage !== 'most');
    document.getElementById('credits-not-wrap').classList.toggle('hidden', offerCoverage !== 'most' || !(missed > 0));
    document.getElementById('step-3').classList.toggle('hidden', offerCoverage === 'none');
    var counted = Math.max(0, Number(val('fullTime') || 0) - Number(val('nonAssessment') || 0));
    document.getElementById('offer-hint').textContent = ACA.offerHint(counted);
    var preview = ACA.calculate(readForm());
    var live = document.getElementById('ale-live');
    var small = document.getElementById('small-group');
    if (preview.ok) {
      live.textContent = preview.summary.aleStatus + '. Rounded average: ' + preview.prior.rounded + '.';
      var under = !preview.prior.isAle;
      small.classList.toggle('hidden', !under);
      document.getElementById('step-2').classList.toggle('hidden', under);
      if (under) document.getElementById('step-3').classList.add('hidden');
      if (preview.prior.groupMonthsNote) live.textContent += ' ' + preview.prior.groupMonthsNote;
    }
    postHeight();
  }

  function clearInvalid() {
    form.querySelectorAll('[aria-invalid="true"]').forEach(function (el) { el.removeAttribute('aria-invalid'); });
  }

  function showErrors(errors) {
    clearInvalid();
    var box = document.getElementById('form-error');
    if (!errors || !errors.length) { box.textContent = ''; return; }
    box.textContent = errors[0].message;
    var field = document.getElementById(errors[0].field);
    if (field) { field.setAttribute('aria-invalid', 'true'); field.focus(); }
  }

  function activeScenario(result) {
    if (result.kind === 'a' || result.kind === 'unsure') return 'nothing';
    if (result.kind === 'b' || result.kind === 'mixed') return 'unaffordable';
    if (result.kind === 'zero') return 'affordable';
    return '';
  }

  function formulaLine(result) {
    if (!result.identical || !result.monthRows.length || !result.prior.isAle) return '';
    var row = result.monthRows[0];
    var span = result.monthCount === 12 ? 'for the full year' : 'for ' + result.monthCount + ' of 12 months';
    if (result.kind === 'b') {
      var line = row.bCount + ' employee' + (row.bCount === 1 ? '' : 's') + ' × ' + ACA.money(result.rates.bAnnual * 100) + ' ' + span;
      if (result.bCapped) line += ', capped at the no-offer penalty';
      return line + ' = ' + ACA.money(result.actualCents) + '.';
    }
    return row.assessed + ' full-time employees after the reduction × ' + ACA.money(result.rates.aAnnual * 100) + ' ' + span + ' = ' + ACA.money(result.aAnnualCents) + '.';
  }

  function renderResults(result) {
    var prompt = result.kind === 'needCredits' || (result.kind === 'needPremium' && !result.actualCents);
    var monthlyNote = !prompt && result.monthCount && result.actualCents
      ? '<p>' + esc(ACA.money(Math.round(result.actualCents / result.monthCount))) + ' in a typical selected month.</p>'
      : '';
    var hero = prompt
      ? '<div class="prompt-hero"><strong>' + esc(result.why) + '</strong></div>'
      : '<div class="hero"><strong class="hero-amount">' + esc(ACA.money(result.actualCents)) + '</strong><p>' + esc(result.why) + '</p>' + monthlyNote + '</div>';
    var aleLine = result.prior.isAle
      ? '<p>The employer mandate likely applies.</p>'
      : '';
    var harborLine = result.afford && result.afford.used
      ? '<p>' + (result.afford.passes ? 'This premium meets this safe harbor.' : 'This premium does not meet this safe harbor.') + '</p>'
      : '';
    var unsure = '';
    if (result.kind === 'unsure') {
      unsure = '<p><strong>Unaffordable-offer penalty (B): ' + esc(ACA.money(result.rates.bAnnual * 100)) + ' a year per employee who gets a credit.</strong></p>';
    }
    var extra = '';
    if (result.kind === 'needPremium' && result.actualCents) extra = '<p>' + esc(result.why) + '</p>';
    if (result.afford && result.afford.mvNote) extra += '<p>' + esc(result.afford.mvNote) + '</p>';
    if (result.needPremium && result.kind === 'b') extra += '<p>Enter the employee\'s monthly cost to check affordability. The amount above is only the credits for employees who were not offered coverage.</p>';
    var active = activeScenario(result);
    var soft = !result.prior.isAle
      ? '<div class="soft"><p>Small-group coverage can still be a fit.</p><p><a class="btn btn-gold" href="' + esc(cfg.ratesUrl || 'https://www.dkbenefits.net/instant-group-quote') + '" target="_blank" rel="noopener">See small-group rates</a></p></div>'
      : '';
    resultsEl.hidden = false;
    resultsEl.innerHTML =
      '<section class="card" id="result-card">' + hero + aleLine + harborLine + unsure + extra +
        '<div class="scenarios">' +
          scenarioCard('nothing', 'Miss the 95% offer test', result.scenarioNothingCents, 'No-offer penalty (A), if at least one employee got a credit.', active) +
          scenarioCard('unaffordable', 'Unaffordable-offer penalty (B)', result.scenarioUnaffordableCents, 'Credits for people who were left out, plus credits for an offer that fails, capped at the A amount.', active) +
          scenarioCard('affordable', 'Affordable minimum-value coverage', 0, 'No B penalty for employees whose offer passes a safe harbor.', active) +
        '</div>' +
        '<p>' + esc(formulaLine(result)) + '</p>' +
        '<p>No-offer penalty (A) and unaffordable-offer penalty (B) <button type="button" class="info-btn" data-tip="penalties" aria-label="More about A and B penalty (results)" aria-expanded="false">i</button></p>' +
        '<p>30-employee reduction <button type="button" class="info-btn" data-tip="reduction" aria-label="More about 30-employee reduction (results)" aria-expanded="false">i</button></p>' +
        '<h2>Letter 226-J <button type="button" class="info-btn" data-tip="letter" aria-label="More about Letter 226-J (results)" aria-expanded="false">i</button></h2>' +
        '<p>Letter 226-J is the IRS letter that proposes the penalty. The response is generally due 30 days from the date of the letter. Forms 1094-C and 1095-C are how an applicable large employer reports the offer.</p>' +
        soft +
        '<div class="actions"><button type="button" class="btn-secondary" id="print-btn">Print / Save as PDF</button><button type="button" class="btn-gold" id="download-btn">Download summary</button></div>' +
      '</section>';
    leadEl.hidden = false;
    if (!val('lead-employees')) document.getElementById('lead-employees').value = val('fullTime');
    if (!endpoint) {
      document.getElementById('lead-status').textContent = 'This form is not connected yet. Call or text 407-476-5076 or email dan@dkbenefits.net. You can still print or download the estimate.';
    }
    document.getElementById('print-btn').addEventListener('click', function () { if (lastResult) window.print(); });
    document.getElementById('download-btn').addEventListener('click', downloadSummary);
    fillPrint(result);
    postHeight();
  }

  function scenarioCard(key, title, cents, note, active) {
    return '<article class="scenario' + (key === active ? ' active' : '') + '"><span class="lab">' + esc(title) + '</span><strong>' + esc(ACA.money(cents)) + '</strong><p class="hint">' + esc(note) + '</p></article>';
  }

  function fillPrint(result) {
    var paragraphs = result.report.split('\n').map(function (line) {
      return line ? '<p>' + esc(line) + '</p>' : '';
    }).join('');
    document.getElementById('print-report').innerHTML =
      '<div class="print-banner"><p class="print-brand">DK Benefits LLC</p><h1>ACA Employer Penalty Calculator</h1><p>' + esc(result.summary.aleStatus) + '</p></div>' +
      '<p>' + esc(result.why) + '</p>' + paragraphs +
      '<h2>Contact</h2><p>DK Benefits LLC · 407-476-5076 · www.dkbenefits.net</p><p>Serving employers in Florida and Georgia.</p><p>6000 Metrowest Blvd #200, Orlando, FL 32835</p>';
  }

  function downloadSummary() {
    if (!lastResult) return;
    var blob = new Blob([lastResult.why + '\n\n' + lastResult.report + '\n'], { type: 'text/plain;charset=utf-8' });
    var link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'dk-benefits-aca-estimate.txt';
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(function () { URL.revokeObjectURL(link.href); }, 1000);
  }

  function calculate(event) {
    if (event) event.preventDefault();
    var result = ACA.calculate(readForm());
    if (!result.ok) { showErrors(result.errors); return; }
    showErrors([]);
    lastResult = result;
    renderResults(result);
    if (tracker) tracker.onCalculated(result);
    var card = document.getElementById('result-card');
    if (card && card.scrollIntoView) card.scrollIntoView({ block: 'start', behavior: 'auto' });
  }

  function setAllMonths(on) {
    for (var i = 0; i < 12; i++) document.getElementById('month' + i).checked = on;
  }

  function loadExample(kind) {
    document.getElementById('year').value = '2026';
    document.getElementById('priorVary').checked = false;
    document.getElementById('penaltyVary').checked = false;
    document.getElementById('controlledGroup').checked = false;
    document.getElementById('seasonalAttest').checked = false;
    document.getElementById('newEmployer').checked = false;
    document.getElementById('nonAssessment').value = '0';
    document.getElementById('creditUnsure').checked = false;
    document.getElementById('partTimeCount').value = '0';
    document.getElementById('hoursPerWeek').value = '0';
    document.getElementById('exact-hours').classList.add('hidden');
    document.getElementById('exactHours').value = '0';
    setAllMonths(true);
    form.querySelector('input[name="minimumValue"][value="yes"]').checked = true;
    document.getElementById('harbor').value = 'fpl';
    document.getElementById('location').value = 'mainland';
    document.getElementById('planStart').value = 'calendar';
    document.getElementById('premium').value = '';
    document.getElementById('notOffered').value = '0';
    document.getElementById('creditsNotOffered').value = '0';
    if (kind === '120') {
      document.getElementById('averageFullTime').value = '120';
      document.getElementById('fullTime').value = '120';
      document.getElementById('ptcCount').value = '1';
      form.querySelector('input[name="offerCoverage"][value="none"]').checked = true;
    } else if (kind === '80') {
      document.getElementById('averageFullTime').value = '80';
      document.getElementById('fullTime').value = '80';
      document.getElementById('ptcCount').value = '6';
      form.querySelector('input[name="offerCoverage"][value="all"]').checked = true;
      document.getElementById('premium').value = '450';
    } else {
      document.getElementById('averageFullTime').value = '30';
      document.getElementById('exact-hours').classList.remove('hidden');
      document.getElementById('exactHours').value = '1200';
      document.getElementById('fullTime').value = '30';
      document.getElementById('ptcCount').value = '1';
      form.querySelector('input[name="offerCoverage"][value="none"]').checked = true;
    }
    syncChrome();
    calculate();
  }

  function postLead(payload) {
    return fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(payload)
    }).then(function (response) {
      if (!response.ok) throw new Error('status');
      return response.json();
    });
  }

  function submitLead(event) {
    event.preventDefault();
    var status = document.getElementById('lead-status');
    if (!lastResult) { status.textContent = 'Calculate an estimate first.'; return; }
    if (leadForm.elements.company_website.value.trim()) {
      status.textContent = 'Thanks. Your note is on its way.';
      return;
    }
    var contact = {
      name: leadForm.elements.name.value.trim(),
      company: leadForm.elements.company.value.trim(),
      email: leadForm.elements.email.value.trim(),
      phone: leadForm.elements.phone.value.trim(),
      employees: leadForm.elements.employees.value.trim(),
      consent: leadForm.elements.consent.checked
    };
    if (!contact.name || !contact.company || !contact.email || !contact.consent) {
      status.textContent = 'Enter your name, company, and email, and check the consent line.';
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact.email)) {
      status.textContent = 'Enter a valid email.';
      return;
    }
    if (!endpoint || !tracker) {
      status.textContent = 'This form is not connected yet. Call or text 407-476-5076 or email dan@dkbenefits.net. You can still print or download the estimate.';
      return;
    }
    status.textContent = 'Sending...';
    tracker.onLead(lastResult, contact).then(function (response) {
      status.textContent = response && response.ok
        ? 'Thanks. Dan has the estimate, and a copy is on its way to you. Your results stay on this page.'
        : ((response && response.error) || 'We could not send that just now. Call or text 407-476-5076 or email dan@dkbenefits.net.');
    }).catch(function () {
      status.textContent = 'We could not send that just now. Call or text 407-476-5076 or email dan@dkbenefits.net.';
    });
  }

  function postHeight() {
    if (!window.parent || window.parent === window) return;
    var height = Math.ceil(Math.max(document.body.scrollHeight, document.documentElement.scrollHeight));
    window.parent.postMessage({ type: 'resize', height: height, tool: 'aca-penalty' }, '*');
  }

  buildGrids();
  document.getElementById('exact-toggle').addEventListener('click', function () {
    document.getElementById('exact-hours').classList.toggle('hidden');
    syncChrome();
  });
  form.addEventListener('submit', calculate);
  form.addEventListener('change', syncChrome);
  form.addEventListener('input', syncChrome);
  leadForm.addEventListener('submit', submitLead);
  document.getElementById('ex-120').addEventListener('click', function () { loadExample('120'); });
  document.getElementById('ex-80').addEventListener('click', function () { loadExample('80'); });
  document.getElementById('ex-40').addEventListener('click', function () { loadExample('40'); });
  document.addEventListener('click', function (event) {
    var btn = event.target.closest ? event.target.closest('.info-btn') : null;
    if (btn) {
      event.preventDefault();
      event.stopPropagation();
      if (openTip === btn) closeTip();
      else {
        closeTip();
        openTipFor(btn);
      }
      return;
    }
    if (openTip && !pop.contains(event.target)) closeTip();
  });
  document.addEventListener('keydown', function (event) {
    if (event.key === 'Escape') closeTip();
  });
  var ratesLink = document.getElementById('rates-link');
  if (ratesLink && cfg.ratesUrl) ratesLink.href = cfg.ratesUrl;
  syncChrome();
  window.addEventListener('load', function () {
    window.scrollTo(0, 0);
    postHeight();
  });
})();
