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

  function buildGrids() {
    var months = document.getElementById('months');
    var prior = document.getElementById('prior-months');
    var penalty = document.getElementById('penalty-months');
    var monthHtml = '';
    var priorHtml = '';
    var penHtml = '';
    ACA.MONTHS.forEach(function (name, i) {
      var short = name.slice(0, 3);
      monthHtml += '<label class="month"><input id="month' + i + '" type="checkbox" checked> ' + short + '</label>';
      priorHtml += '<div class="month-card"><strong>' + name + '</strong><label>Full-time<input id="priorFt' + i + '" type="number" min="0" step="1" value="0"></label><label>Part-time hours<input id="priorHours' + i + '" type="number" min="0" step="1" value="0"></label></div>';
      penHtml += '<div class="month-card"><label class="month"><input id="penOn' + i + '" type="checkbox"> ' + name + '</label><label>Full-time<input id="penFt' + i + '" type="number" min="0" step="1" value="0"></label><label>Credits<input id="penPtc' + i + '" type="number" min="0" step="1" value="0"></label></div>';
    });
    months.innerHTML = monthHtml;
    prior.innerHTML = priorHtml;
    penalty.innerHTML = penHtml;
  }

  function syncChrome() {
    document.getElementById('group-fields').classList.toggle('hidden', !document.getElementById('controlledGroup').checked);
    document.getElementById('prior-months').classList.toggle('hidden', !document.getElementById('priorVary').checked);
    document.getElementById('penalty-months').classList.toggle('hidden', !document.getElementById('penaltyVary').checked);
    var harbor = val('harbor');
    document.getElementById('w2-fields').classList.toggle('hidden', harbor !== 'w2');
    document.getElementById('rate-fields').classList.toggle('hidden', harbor !== 'rate');
    document.getElementById('fpl-fields').classList.toggle('hidden', harbor !== 'fpl');
    document.getElementById('salary-wrap').classList.toggle('hidden', checked('payType') !== 'salary');
    document.getElementById('hourly-wrap').classList.toggle('hidden', checked('payType') === 'salary');
    var year = val('year') || '2026';
    var rates = ACA.YEARS[year];
    document.getElementById('rate-line').textContent = year + ' indexed amounts: section 4980H(a) ' + ACA.money(rates.aAnnual * 100) + ' a year, and section 4980H(b) ' + ACA.money(rates.bAnnual * 100) + ' a year. The affordability percentage is ' + rates.rateLabel + '.';
    var later = document.querySelector('#planStart option[value="later"]');
    later.disabled = year === '2027';
    if (year === '2027' && val('planStart') === 'later') document.getElementById('planStart').value = 'calendar';
    var table = (ACA.YEARS[year].fpl[val('planStart')] || ACA.YEARS[year].fpl.calendar);
    document.getElementById('fpl-note').textContent = table.note;
    var ft = Number(val('fullTime') || 0);
    var non = Number(val('nonAssessment') || 0);
    var counted = Math.max(0, Math.round(ft - non));
    var allowance = ACA.offerAllowance(counted);
    var hint = document.getElementById('offer-hint');
    if (!counted) hint.textContent = '';
    else if (allowance.fiveGreater) hint.textContent = 'With ' + counted + ' full-time employees in this count, an offer to all but five still avoids the A penalty. Five is more than 5 percent.';
    else hint.textContent = 'With ' + counted + ' full-time employees, the offer test is 95 percent. You can miss up to ' + (Math.round(allowance.percent * 10) / 10) + '.';
    postHeight();
  }

  function readForm() {
    var months = [];
    var priorMonths = [];
    var penaltyMonths = [];
    for (var i = 0; i < 12; i++) {
      months.push(document.getElementById('month' + i).checked);
      priorMonths.push({ fullTime: val('priorFt' + i), partTimeHours: val('priorHours' + i) });
      penaltyMonths.push({
        include: document.getElementById('penOn' + i).checked,
        fullTime: val('penFt' + i),
        ptcCount: val('penPtc' + i)
      });
    }
    return {
      year: val('year'),
      priorMode: document.getElementById('priorVary').checked ? 'months' : 'average',
      averageFullTime: val('averageFullTime'),
      averagePartTimeHours: val('averagePartTimeHours'),
      priorMonths: priorMonths,
      newEmployer: document.getElementById('newEmployer').checked,
      seasonalAttest: document.getElementById('seasonalAttest').checked,
      controlledGroup: document.getElementById('controlledGroup').checked,
      otherMembersAverage: val('otherMembersAverage'),
      otherMembersFullTime: val('otherMembersFullTime'),
      penaltyMode: document.getElementById('penaltyVary').checked ? 'months' : 'same',
      fullTime: val('fullTime'),
      nonAssessment: val('nonAssessment'),
      notOffered: val('notOffered'),
      offer: checked('offer') || 'below',
      anyCredit: checked('anyCredit') === 'yes',
      ptcCount: val('ptcCount'),
      months: months,
      penaltyMonths: penaltyMonths,
      affordUse: val('premium') !== '',
      premium: val('premium'),
      harbor: val('harbor'),
      minimumValue: document.getElementById('minimumValue').checked,
      w2Wages: val('w2Wages'),
      payType: checked('payType') || 'hourly',
      hourlyRate: val('hourlyRate'),
      monthlySalary: val('monthlySalary'),
      location: val('location'),
      planStart: val('planStart')
    };
  }

  function clearInvalid() {
    form.querySelectorAll('[aria-invalid="true"]').forEach(function (el) { el.removeAttribute('aria-invalid'); });
  }

  function showErrors(errors) {
    clearInvalid();
    var box = document.getElementById('form-error');
    if (!errors || !errors.length) {
      box.textContent = '';
      return;
    }
    box.textContent = errors[0].message;
    var field = document.getElementById(errors[0].field);
    if (field) {
      field.setAttribute('aria-invalid', 'true');
      field.focus();
    }
  }

  function activeScenario(result) {
    if (result.kind === 'a') return 'nothing';
    if (result.kind === 'b') return 'unaffordable';
    if (result.kind === 'zero') return 'affordable';
    return '';
  }

  function formulaLine(result) {
    if (!result.identical || !result.monthRows.length || !result.prior.isAle) return '';
    var row = result.monthRows[0];
    var span = result.monthCount === 12 ? 'for the full year' : 'for ' + result.monthCount + ' of 12 months';
    if (result.kind === 'b') {
      var line = row.ptc + ' credit recipient' + (row.ptc === 1 ? '' : 's') + ' × ' + ACA.money(result.rates.bAnnual * 100) + ' ' + span;
      if (result.bCapped) line += ', capped at the A penalty';
      return line + ' = ' + ACA.money(result.actualCents) + ' under section 4980H(b).';
    }
    return row.assessed + ' full-time employees after the reduction × ' + ACA.money(result.rates.aAnnual * 100) + ' ' + span + ' = ' + ACA.money(result.aAnnualCents) + ' under section 4980H(a).';
  }

  function renderResults(result) {
    var active = activeScenario(result);
    var monthly = result.monthCount ? ACA.money(Math.round(result.actualCents / result.monthCount)) : ACA.money(0);
    var ale = result.prior.isAle
      ? 'The rounded average is ' + result.prior.rounded + '. The employer mandate likely applies in ' + result.year + '.'
      : 'The rounded average is ' + result.prior.rounded + ', under 50. The employer mandate does not apply.';
    var soft = '';
    if (!result.prior.isAle) {
      soft = '<div class="soft"><p>Small-group coverage can still be a fit. DK Benefits can walk through options with you.</p><p><a class="btn btn-gold" href="' + esc(cfg.ratesUrl || 'https://www.dkbenefits.net/instant-group-quote') + '" target="_blank" rel="noopener">See small-group rates</a></p></div>';
    }
    var months = '';
    if (!result.identical && result.monthRows.length) {
      months = '<table class="month-table"><thead><tr><th>Month</th><th>Full-time</th><th>A</th><th>B</th></tr></thead><tbody>' +
        result.monthRows.map(function (row) {
          return '<tr><td>' + esc(row.name) + '</td><td>' + row.fullTime + '</td><td>' + esc(ACA.money(row.aCents)) + '</td><td>' + esc(ACA.money(row.bCents)) + (row.capped ? ' capped' : '') + '</td></tr>';
        }).join('') + '</tbody></table>';
    }
    var afford = result.afford.used
      ? '<div class="callout"><strong>' + (result.afford.passes ? 'This premium meets the ' + esc(result.afford.harborLabel) + ' safe harbor.' : 'This premium does not meet the ' + esc(result.afford.harborLabel) + ' safe harbor.') + '</strong><p>' + esc(result.afford.detail) + '</p></div>'
      : '<p class="hint">Enter a self-only premium to check a safe harbor.</p>';
    resultsEl.hidden = false;
    resultsEl.innerHTML =
      '<section class="card" id="result-card">' +
        '<div class="hero"><p class="lab">Estimated exposure</p><strong class="hero-amount">' + esc(ACA.money(result.actualCents)) + '</strong><p>' + esc(result.actualLabel) + (result.actualCents ? ', ' + esc(monthly) + ' in a typical selected month.' : '.') + ' ' + esc(result.monthsLabel) + '.</p></div>' +
        '<h2>Your result</h2><p>' + esc(ale) + '</p>' +
        (result.prior.seasonalNote ? '<p>' + esc(result.prior.seasonalNote) + '</p>' : '') +
        '<p>' + esc(formulaLine(result)) + '</p>' +
        '<div class="scenarios">' +
          scenarioCard('nothing', 'Offer nothing', result.scenarioNothingCents, 'The A penalty, if the offer test is missed and at least one full-time employee gets a credit.', active) +
          scenarioCard('unaffordable', 'Offer, but unaffordable', result.scenarioUnaffordableCents, 'The B penalty for the credit count you entered, capped at the A penalty.', active) +
          scenarioCard('affordable', 'Offer affordable coverage', 0, 'No section 4980H payment for an affordable, minimum-value offer. The filing forms can still apply.', active) +
        '</div>' +
        afford + months + soft +
        '<p class="hint">Full-time equivalents are used for the 50-employee test only. They are not multiplied into the penalty. The 30-employee reduction is shared across a controlled group, and that share rounds up.</p>' +
        '<div class="actions"><button type="button" class="btn-secondary" id="print-btn">Print / Save as PDF</button><button type="button" class="btn-gold" id="download-btn">Download summary</button></div>' +
      '</section>';
    leadEl.hidden = false;
    if (!val('lead-employees')) document.getElementById('lead-employees').value = val('fullTime');
    if (!endpoint) {
      document.getElementById('lead-status').textContent = 'This form is not connected yet. Call or text 407-476-5076 or email dan@dkbenefits.net. You can still print or download the estimate.';
    }
    document.getElementById('print-btn').addEventListener('click', printSummary);
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
      paragraphs +
      '<h2>Contact</h2><p>DK Benefits LLC · 407-476-5076 · www.dkbenefits.net</p><p>6000 Metrowest Blvd #200, Orlando, FL 32835</p>';
  }

  function printSummary() {
    if (!lastResult) return;
    window.print();
  }

  function downloadSummary() {
    if (!lastResult) return;
    var blob = new Blob([lastResult.report + '\n'], { type: 'text/plain;charset=utf-8' });
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
    if (!result.ok) {
      showErrors(result.errors);
      return;
    }
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
    document.getElementById('notOffered').value = '';
    document.getElementById('averagePartTimeHours').value = '0';
    setAllMonths(true);
    form.querySelector('input[name="anyCredit"][value="yes"]').checked = true;
    document.getElementById('minimumValue').checked = true;
    document.getElementById('harbor').value = 'fpl';
    document.getElementById('location').value = 'mainland';
    document.getElementById('planStart').value = 'calendar';
    if (kind === '120') {
      document.getElementById('averageFullTime').value = '120';
      document.getElementById('fullTime').value = '120';
      document.getElementById('ptcCount').value = '1';
      form.querySelector('input[name="offer"][value="below"]').checked = true;
      document.getElementById('premium').value = '';
    } else if (kind === '80') {
      document.getElementById('averageFullTime').value = '80';
      document.getElementById('fullTime').value = '80';
      document.getElementById('ptcCount').value = '6';
      form.querySelector('input[name="offer"][value="unaffordable"]').checked = true;
      document.getElementById('premium').value = '450';
    } else {
      document.getElementById('averageFullTime').value = '30';
      document.getElementById('averagePartTimeHours').value = '1200';
      document.getElementById('fullTime').value = '30';
      document.getElementById('ptcCount').value = '1';
      form.querySelector('input[name="offer"][value="below"]').checked = true;
      document.getElementById('premium').value = '';
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
    if (!lastResult) {
      status.textContent = 'Calculate an estimate first.';
      return;
    }
    var honey = leadForm.elements.company_website.value.trim();
    if (honey) {
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
      if (response && response.ok) {
        status.textContent = 'Thanks. Dan has the estimate, and a copy is on its way to you. Your results stay on this page.';
      } else {
        status.textContent = (response && response.error) || 'We could not send that just now. Call or text 407-476-5076 or email dan@dkbenefits.net.';
      }
    }).catch(function () {
      status.textContent = 'We could not send that just now. Call or text 407-476-5076 or email dan@dkbenefits.net.';
    });
  }

  function postHeight() {
    if (!window.parent || window.parent === window) return;
    var height = Math.ceil(Math.max(
      document.body ? document.body.scrollHeight : 0,
      document.documentElement ? document.documentElement.scrollHeight : 0
    ));
    window.parent.postMessage({ type: 'resize', height: height, tool: 'aca-penalty' }, '*');
  }

  buildGrids();
  form.addEventListener('submit', calculate);
  form.addEventListener('change', syncChrome);
  form.addEventListener('input', syncChrome);
  leadForm.addEventListener('submit', submitLead);
  document.getElementById('ex-120').addEventListener('click', function () { loadExample('120'); });
  document.getElementById('ex-80').addEventListener('click', function () { loadExample('80'); });
  document.getElementById('ex-40').addEventListener('click', function () { loadExample('40'); });
  syncChrome();
  window.addEventListener('load', function () {
    window.scrollTo(0, 0);
    postHeight();
  });
})();
