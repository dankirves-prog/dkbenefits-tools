(function () {
  var form = document.getElementById('atne');
  if (!form || !window.ATNE) return;
  var cfg = window.ATNE_CONFIG || {};
  var resultsEl = document.getElementById('results');
  var lastResult = null;
  var penaltyUrl = cfg.penaltyCalculatorUrl || 'https://www.dkbenefits.net/aca-penalty-calculator';
  var pagesUrl = cfg.penaltyCalculatorPagesUrl || 'https://dankirves-prog.github.io/dkbenefits-tools/aca-penalty-calculator.html';
  var quizUrl = cfg.complianceQuizUrl || 'https://dankirves-prog.github.io/dkbenefits-tools/compliance-assessment.html';
  var contactUrl = cfg.contactUrl || 'https://www.dkbenefits.net/contact';
  var quoteUrl = cfg.quoteUrl || 'https://www.dkbenefits.net/instant-group-quote';
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

  function tipText(key) {
    var tips = {
      atne: 'ATNE means average total number of employees. Add full-time employees and full-time equivalents for each month, divide by 12, and round down. That whole number is what employers compare with 50.',
      year: 'Applicable large employer status for a calendar year uses the prior calendar year. Checking 2026 uses 2025. Months with no employees count as zero. Always divide by 12, including months before a mid-year opening.',
      fullTime: 'A full-time employee averages at least 30 hours of service a week, or 130 hours in the month. Paid time off counts as hours of service: vacation, holidays, and sick days.',
      nonFt: 'Count everyone who is not full-time that month, including variable-hour staff and seasonal staff. Their hours become full-time equivalents. Equivalents are for this size test. They are not automatically people who must get an offer of coverage.',
      cap: 'For each person who is not full-time, count at most 120 hours of service that month. Add the capped hours and divide by 120. Fractions count, and each month may round to the nearest hundredth. A headcount plus hours-each applies the cap for you. In the grid, cap each person before you type the total, or use the cap helper.',
      seasonal: 'The exception applies when the workforce exceeds 50 for 120 days or fewer and the employees above 50 in that stretch are seasonal workers. Four calendar months count as 120 days, in a row or not. Seasonal work is labor or services on a seasonal basis, such as holiday-only retail or a harvest crew.',
      newEmployer: 'Check this only if the company was not open on any business day last year. Then enter the average you reasonably expect this year. You are an ALE only if that expectation is at least 50 and you actually average at least 50. A company that existed for part of last year uses last year instead, with zero for the closed months.',
      group: 'Companies treated as one employer under Internal Revenue Code sections 414(b), (c), (m), and (o) add their employees together before the 50 test. This page does not decide who is in the group. It adds the average you enter, then rounds down once.',
      otherAverage: 'The other companies combined, full-time plus full-time equivalents, averaged over the year, before rounding down. Use 0 if they have no employees.',
      tricare: 'For the size test only, leave out an employee for any month in which the employee has TRICARE or Veterans Administration coverage. Section 4980H(c)(2)(F) is the exclusion. It does not, by itself, change a penalty calculation.'
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
    pop.textContent = tipText(btn.getAttribute('data-tip'));
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

  function buildGrid() {
    var cards = '';
    var options = '';
    ATNE.MONTHS.forEach(function (name, i) {
      cards += '<div class="month-card"><strong>' + name + '</strong>' +
        '<label for="ft' + i + '">Full-time employees</label>' +
        '<input id="ft' + i + '" type="number" inputmode="numeric" min="0" step="1" autocomplete="off">' +
        '<label for="hours' + i + '">Non-full-time hours, capped at 120 each</label>' +
        '<input id="hours' + i + '" type="number" inputmode="decimal" min="0" step="0.01" autocomplete="off"></div>';
      options += '<option value="' + i + '">' + name + '</option>';
    });
    document.getElementById('month-grid').innerHTML = cards;
    document.getElementById('cap-month').innerHTML = options;
  }

  function readForm() {
    var months = [];
    for (var i = 0; i < 12; i++) {
      months.push({ fullTime: val('ft' + i), hours: val('hours' + i) });
    }
    return {
      year: val('year'),
      mode: checked('mode') === 'months' ? 'months' : 'quick',
      fullTime: val('fullTime'),
      nonFtCount: val('nonFtCount'),
      hoursEach: val('hoursEach'),
      hoursBasis: val('hoursBasis') === 'week' ? 'week' : 'month',
      months: months,
      blankMonthsZero: document.getElementById('blankMonthsZero').checked,
      seasonalAttest: document.getElementById('seasonalAttest').checked,
      newEmployer: document.getElementById('newEmployer').checked,
      controlledGroup: document.getElementById('controlledGroup').checked,
      otherAverage: val('otherAverage')
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
    if (field) field.setAttribute('aria-invalid', 'true');
  }

  function setHint(text) {
    var el = document.getElementById('input-hint');
    el.textContent = text || '';
    el.hidden = !text;
  }

  function hintFor(result) {
    if (result.needsHours) return 'Enter hours for the non-full-time employees to see ALE status.';
    if (result.needsCount) return 'Enter how many non-full-time employees those hours belong to.';
    if (result.partial) return result.filled + ' of 12 months have a count. Enter every month, or mark blank months as zero, before ALE status is shown.';
    return '';
  }

  function paintChrome() {
    var year = Number(val('year') || 2026);
    var prior = year - 1;
    var neu = document.getElementById('newEmployer').checked;
    var group = document.getElementById('controlledGroup').checked;
    var monthsMode = checked('mode') === 'months';
    document.getElementById('year-line').textContent = neu
      ? 'ALE status for ' + year + '. This company was not in business on any day in ' + prior + '. Enter the workforce you reasonably expect in ' + year + '. You are an ALE only if you expect to average at least 50 and you actually average at least 50.'
      : 'ALE status for ' + year + ' uses the ' + prior + ' workforce. The average total number of employees is full-time plus full-time equivalents, divided by 12, then rounded down.';
    document.getElementById('ft-label').textContent = neu
      ? 'Full-time employees you expect in a typical month of ' + year
      : 'Full-time employees in a typical month of ' + prior;
    document.getElementById('hours-each-label').textContent = val('hoursBasis') === 'week'
      ? 'Hours each person works in a week'
      : 'Hours each person works in a month';
    document.getElementById('seasonal-label').textContent = group
      ? 'This is true for the whole controlled group: it was over 50 for 120 days or fewer, and the employees over 50 were seasonal workers.'
      : 'The employees who put the count over 50 in that stretch were seasonal workers.';
    document.getElementById('quick-panel').classList.toggle('hidden', monthsMode);
    document.getElementById('months-panel').classList.toggle('hidden', !monthsMode);
    document.getElementById('group-fields').classList.toggle('hidden', !group);
    var count = ATNE.readWhole(val('nonFtCount'));
    var each = ATNE.readNumber(val('hoursEach'));
    var warn = document.getElementById('hours-warning');
    var showWarn = !count.empty && !count.invalid && count.value > 0 && !each.empty && !each.invalid &&
      ATNE.classifyHours(each.value, val('hoursBasis')).fullTime;
    warn.hidden = !showWarn;
    warn.textContent = showWarn
      ? '30 or more hours a week, or 130 or more in a month, is full-time. The 120-hour cap still counts each person as 1.0. Move them to the full-time count if you want, and do not count the same person in both places.'
      : '';
  }

  function paintSeasonal(result) {
    var el = document.getElementById('seasonal-status');
    el.textContent = result && result.ready && result.seasonalNote
      ? result.seasonalNote
      : 'Enter a workforce above. This line will say how many months are over 50.';
  }

  function hideResults() {
    lastResult = null;
    resultsEl.hidden = true;
    resultsEl.innerHTML = '';
  }

  function siteLink(url, label, gold) {
    var onSite = url.indexOf('://www.dkbenefits.net') !== -1 || url.indexOf('://dkbenefits.net') !== -1;
    var cls = gold ? 'btn btn-gold' : 'btn btn-secondary';
    var rel = onSite ? '' : ' rel="noopener"';
    return '<a class="' + cls + '" href="' + esc(url) + '" target="' + (onSite ? '_top' : '_blank') + '"' + rel + '>' + esc(label) + '</a>';
  }

  function monthTable(result) {
    var rows = result.months.map(function (row) {
      return '<tr class="' + (row.exceeds50 ? 'over' : '') + '">' +
        '<td>' + esc(row.name) + '</td>' +
        '<td class="num">' + esc(ATNE.formatNum(row.fullTime)) + '</td>' +
        '<td class="num">' + esc(ATNE.formatNum(row.hours)) + '</td>' +
        '<td class="num">' + esc(ATNE.formatNum(row.fte)) + '</td>' +
        '<td class="num">' + esc(ATNE.formatNum(row.total)) + '</td>' +
        '<td>' + (row.exceeds50 ? 'Yes' : '') + '</td></tr>';
    }).join('');
    return '<div class="table-wrap"><table class="month-table"><caption class="hint">Full-time employees plus full-time equivalents for each month. A month is over 50 only when the total exceeds 50.</caption><thead><tr><th>Month</th><th class="num">Full-time</th><th class="num">Non-FT hours</th><th class="num">FTEs</th><th class="num">Total</th><th>Over 50</th></tr></thead><tbody>' + rows + '</tbody></table></div>';
  }

  function renderResults(result) {
    lastResult = result;
    var tone = result.seasonalApplied ? 'no' : (result.outcome === 'borderline' ? 'line' : (result.isAle ? 'ale' : 'no'));
    var pill = result.seasonalApplied ? 'Seasonal exception' : (result.outcome === 'borderline' ? 'Borderline' : (result.isAle ? 'ALE — yes' : 'ALE — no'));
    var exact = result.controlledGroup
      ? 'This company averaged ' + ATNE.formatNum(result.ownExact) + '. Combined with the other companies, the average is ' + ATNE.formatNum(result.exact) + ' before rounding down.'
      : 'Exact average ' + ATNE.formatNum(result.exact) + ' before rounding down.';
    var basis = result.newEmployer
      ? 'These figures are the workforce expected in ' + result.year + '.'
      : 'These figures are the ' + result.priorYear + ' workforce, used for ' + result.year + '.';
    var steps = result.nextSteps.map(function (step) {
      return '<li>' + esc(step) + '</li>';
    }).join('');
    var buttons = [];
    if (result.showPenaltyCta) {
      buttons.push(siteLink(penaltyUrl, 'Estimate ACA employer penalties', true));
      buttons.push(siteLink(pagesUrl, 'Penalty calculator on GitHub Pages', false));
      buttons.push(siteLink(contactUrl, 'Talk to our team', false));
    } else {
      buttons.push(siteLink(contactUrl, 'Talk to our team', true));
      buttons.push(siteLink(quizUrl, 'Benefits compliance checkup', false));
      buttons.push(siteLink(quoteUrl, 'See small-group rates', false));
    }
    var seasonalLink = result.seasonalApplied
      ? '<p><a class="text-link" href="' + esc(penaltyUrl) + '" target="_top">If this exception does not hold, estimate the employer penalty</a></p>'
      : '';
    var fullTimeNote = result.looksFullTime
      ? '<p>Some hours entered as non-full-time are full-time hours. The 120-hour cap counts each of those people as 1.0 in the total. Do not also list them as full-time.</p>'
      : '';
    var groupNote = result.controlledGroup
      ? ''
      : '<p>Related companies in a controlled group have to be added together. This result uses only the workforce you entered.</p>';
    resultsEl.hidden = false;
    resultsEl.innerHTML =
      '<section class="card" id="result-card">' +
        '<div class="hero ' + tone + '">' +
          '<span class="pill">' + esc(pill) + '</span>' +
          '<strong class="hero-amount">' + esc(String(result.floored)) + '</strong>' +
          '<p>Average ATNE, rounded down. ' + esc(result.headline) + '</p>' +
        '</div>' +
        '<p>' + esc(basis) + ' ' + esc(exact) + '</p>' +
        '<p>' + esc(result.seasonalNote) + '</p>' +
        fullTimeNote +
        '<h2>Next steps</h2>' +
        '<ol class="next-steps">' + steps + '</ol>' +
        '<div id="result-actions">' +
          '<div class="actions">' + buttons.join('') + '</div>' +
          seasonalLink +
        '</div>' +
        monthTable(result) +
        '<div class="footnotes">' + groupNote +
          '<p>TRICARE or VA coverage is left out of this count for a month the employee has that coverage. Take those employees out of the numbers above. The exclusion is only for this size test.</p>' +
        '</div>' +
        '<div class="actions"><button type="button" class="btn-secondary" id="download-btn">Download summary</button></div>' +
      '</section>';
    postHeight();
  }

  function sync(opts) {
    opts = opts || {};
    paintChrome();
    var result = ATNE.calculate(readForm());
    if (!result.ok) {
      showErrors(result.errors);
      setHint('');
      paintSeasonal(null);
      hideResults();
      if (opts.focusError) {
        var field = document.getElementById(result.errors[0].field);
        if (field && field.focus) field.focus();
      }
    } else {
      showErrors([]);
      paintSeasonal(result);
      if (!result.ready) {
        setHint(hintFor(result));
        hideResults();
      } else {
        setHint('');
        renderResults(result);
        if (opts.scroll) {
          var card = document.getElementById('result-card');
          if (card && card.scrollIntoView) card.scrollIntoView({ block: 'start', behavior: 'auto' });
        }
      }
    }
    postHeight();
  }

  function postHeight() {
    if (!window.parent || window.parent === window) return;
    var height = Math.ceil(Math.max(document.body.scrollHeight, document.documentElement.scrollHeight));
    window.parent.postMessage({ type: 'resize', height: height, tool: 'aca-workforce' }, '*');
  }

  function downloadSummary() {
    if (!lastResult) return;
    var blob = new Blob([lastResult.report + '\n'], { type: 'text/plain;charset=utf-8' });
    var link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'dk-benefits-aca-workforce-size.txt';
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(function () { URL.revokeObjectURL(link.href); }, 1000);
  }

  function resetForm() {
    document.getElementById('year').value = '2026';
    form.querySelector('input[name="mode"][value="quick"]').checked = true;
    ['fullTime', 'nonFtCount', 'hoursEach', 'otherAverage', 'cap-count', 'cap-each'].forEach(function (id) {
      document.getElementById(id).value = '';
    });
    document.getElementById('hoursBasis').value = 'month';
    document.getElementById('cap-basis').value = 'month';
    document.getElementById('seasonalAttest').checked = false;
    document.getElementById('newEmployer').checked = false;
    document.getElementById('controlledGroup').checked = false;
    document.getElementById('blankMonthsZero').checked = false;
    document.getElementById('cap-error').textContent = '';
    for (var i = 0; i < 12; i++) {
      document.getElementById('ft' + i).value = '';
      document.getElementById('hours' + i).value = '';
    }
  }

  function loadExample(kind) {
    resetForm();
    if (kind === 'line') {
      document.getElementById('fullTime').value = '20';
      document.getElementById('nonFtCount').value = '40';
      document.getElementById('hoursEach').value = '90';
    } else if (kind === 'ale') {
      document.getElementById('fullTime').value = '80';
    } else if (kind === 'under') {
      document.getElementById('fullTime').value = '30';
      document.getElementById('nonFtCount').value = '15';
      document.getElementById('hoursEach').value = '80';
    } else {
      form.querySelector('input[name="mode"][value="months"]').checked = true;
      for (var i = 0; i < 12; i++) {
        document.getElementById('ft' + i).value = i < 8 ? '40' : '120';
        document.getElementById('hours' + i).value = '0';
      }
      document.getElementById('seasonalAttest').checked = true;
      document.getElementById('blankMonthsZero').checked = true;
    }
    sync({ scroll: true });
  }

  function fillGrid() {
    var input = readForm();
    input.mode = 'quick';
    var result = ATNE.calculate(input);
    var capError = document.getElementById('cap-error');
    if (!result.ready) {
      capError.textContent = result.needsHours
        ? 'Enter hours for the non-full-time employees first.'
        : 'Enter the stable-workforce numbers first.';
      return;
    }
    for (var i = 0; i < 12; i++) {
      document.getElementById('ft' + i).value = String(result.months[i].fullTime);
      document.getElementById('hours' + i).value = ATNE.formatHoursInput(result.months[i].hours);
    }
    document.getElementById('blankMonthsZero').checked = true;
    capError.textContent = 'All 12 months now use those numbers. Change any month that was different, including a seasonal spike.';
    sync();
  }

  function applyCap() {
    var capError = document.getElementById('cap-error');
    var month = Number(val('cap-month'));
    var count = ATNE.readWhole(val('cap-count'));
    var each = ATNE.readNumber(val('cap-each'));
    if (count.empty || count.invalid || count.value <= 0) {
      capError.textContent = 'Enter how many non-full-time people are in that month.';
      return;
    }
    if (each.empty || each.invalid) {
      capError.textContent = 'Enter the hours each of those people worked.';
      return;
    }
    var agg = ATNE.aggregateFromHeadcount(count.value, each.value, val('cap-basis'));
    document.getElementById('hours' + month).value = ATNE.formatHoursInput(agg.cappedHours);
    if (document.getElementById('ft' + month).value.trim() === '') document.getElementById('ft' + month).value = '0';
    capError.textContent = agg.looksFullTime
      ? 'Those hours are full-time hours. The capped total is in the month. Move the people into full-time if they should not sit in the hours column.'
      : 'Capped hours for ' + ATNE.MONTHS[month] + ': ' + ATNE.formatHoursInput(agg.cappedHours) + '.';
    sync();
  }

  buildGrid();
  form.addEventListener('submit', function (event) {
    event.preventDefault();
    sync({ scroll: true, focusError: true });
  });
  form.addEventListener('input', function () { sync(); });
  form.addEventListener('change', function () { sync(); });
  resultsEl.addEventListener('click', function (event) {
    var btn = event.target.closest ? event.target.closest('#download-btn') : null;
    if (btn) downloadSummary();
  });
  document.getElementById('fill-grid').addEventListener('click', fillGrid);
  document.getElementById('cap-apply').addEventListener('click', applyCap);
  document.getElementById('ex-line').addEventListener('click', function () { loadExample('line'); });
  document.getElementById('ex-ale').addEventListener('click', function () { loadExample('ale'); });
  document.getElementById('ex-under').addEventListener('click', function () { loadExample('under'); });
  document.getElementById('ex-seasonal').addEventListener('click', function () { loadExample('seasonal'); });
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
  window.addEventListener('resize', function () {
    closeTip();
    postHeight();
  });
  if (window.ResizeObserver) new ResizeObserver(function () { postHeight(); }).observe(document.body);
  sync();
  window.addEventListener('load', function () {
    window.scrollTo(0, 0);
    postHeight();
  });
})();
