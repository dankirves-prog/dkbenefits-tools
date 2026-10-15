/**
 * Benefits compliance checkup UI.
 * Posts only { type: 'resize', height } and { type: 'scrollTop' } to a parent frame.
 * Answers stay in this browser unless the visitor submits the optional lead form.
 */
(function () {
  var root = document.getElementById('quiz');
  if (!root || !window.DKQuiz) return;

  var answers = {};
  var index = 0;
  var phase = 'question';
  var result = null;
  var showError = false;
  var leadState = 'idle';
  var leadMessage = '';

  var STATUS_LABEL = {
    actionNeeded: 'Action needed',
    confirm: 'Confirm',
    inPlace: 'In place',
    note: 'Note'
  };

  function esc(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function visible() { return DKQuiz.visibleQuestions(answers); }

  function prune() {
    DKQuiz.questions.forEach(function (q) {
      if (q.showIf && !q.showIf(answers)) delete answers[q.id];
    });
  }

  function hasAnswer(q) {
    var value = answers[q.id];
    if (!q) return false;
    if (q.multiSelect) return Array.isArray(value) && value.length > 0;
    return value != null && value !== '';
  }

  function selectedMap(q) {
    var value = answers[q.id];
    var map = {};
    if (q.multiSelect && Array.isArray(value)) value.forEach(function (item) { map[item] = true; });
    else if (value != null) map[value] = true;
    return map;
  }

  function syncChrome() {
    var embedded = window.parent && window.parent !== window;
    document.body.classList.toggle('is-embedded', !!embedded);
    document.body.classList.toggle('is-compact', !embedded && !(phase === 'question' && index === 0));
  }

  function measureHeight() {
    var height = 0;
    ['.preview-banner', '.site-header', '#quiz'].forEach(function (sel) {
      var el = document.querySelector(sel);
      if (!el) return;
      if (window.getComputedStyle(el).display === 'none') return;
      height += el.offsetHeight;
    });
    return Math.ceil(height);
  }

  function postHeight() {
    if (!window.parent || window.parent === window) return;
    window.parent.postMessage({ type: 'resize', height: measureHeight() }, '*');
  }

  function scrollTop() {
    window.scrollTo(0, 0);
    if (document.documentElement) document.documentElement.scrollTop = 0;
    if (document.body) document.body.scrollTop = 0;
    if (window.parent && window.parent !== window) {
      window.parent.postMessage({ type: 'scrollTop' }, '*');
    }
  }

  function endpoint() {
    var url = (typeof QUIZ_LEAD_ENDPOINT === 'string') ? QUIZ_LEAD_ENDPOINT.trim() : '';
    return /^https?:\/\//i.test(url) ? url : '';
  }

  function optionExclusive(q, value) {
    var match = false;
    q.options.forEach(function (opt) { if (opt.value === value && opt.exclusive) match = true; });
    return match;
  }

  function onOption(value) {
    var list = visible();
    var q = list[index];
    if (!q) return;
    showError = false;
    if (q.multiSelect) {
      var current = Array.isArray(answers[q.id]) ? answers[q.id].slice() : [];
      if (optionExclusive(q, value)) {
        answers[q.id] = current.length === 1 && current[0] === value ? [] : [value];
      } else {
        current = current.filter(function (item) { return !optionExclusive(q, item); });
        var at = current.indexOf(value);
        if (at === -1) current.push(value);
        else current.splice(at, 1);
        answers[q.id] = current;
      }
    } else {
      answers[q.id] = value;
    }
    prune();
    render({ focusValue: value });
  }

  function goNext() {
    var list = visible();
    var q = list[index];
    if (!hasAnswer(q)) {
      showError = true;
      render({ focusValue: null });
      var err = root.querySelector('.field-error');
      if (err) err.focus();
      return;
    }
    showError = false;
    if (index < list.length - 1) index += 1;
    else {
      phase = 'results';
      result = DKQuiz.scoreAnswers(answers);
    }
    scrollTop();
    render({ focusHeading: true });
  }

  function goBack() {
    showError = false;
    if (phase === 'results') {
      phase = 'question';
      index = Math.max(0, visible().length - 1);
    } else if (index > 0) {
      index -= 1;
    }
    scrollTop();
    render({ focusHeading: true });
  }

  function restart() {
    answers = {};
    index = 0;
    phase = 'question';
    result = null;
    showError = false;
    leadState = 'idle';
    leadMessage = '';
    scrollTop();
    render({ focusHeading: true });
  }

  function toggleExpand(btn) {
    var article = btn.closest('.finding');
    if (!article) return;
    var body = article.querySelector('.finding-body');
    var open = btn.getAttribute('aria-expanded') === 'true';
    btn.setAttribute('aria-expanded', open ? 'false' : 'true');
    if (open) body.setAttribute('hidden', '');
    else body.removeAttribute('hidden');
    postHeight();
  }

  function render(opts) {
    opts = opts || {};
    syncChrome();
    if (phase === 'results') renderResults();
    else renderQuestion();
    if (opts.focusValue) {
      var btn = root.querySelector('[data-value="' + opts.focusValue.replace(/"/g, '') + '"]');
      if (btn) btn.focus();
    } else if (opts.focusHeading) {
      var heading = root.querySelector('#q-text, #results-title');
      if (heading) heading.focus();
    }
    requestAnimationFrame(postHeight);
  }

  function renderQuestion() {
    var list = visible();
    if (index > list.length - 1) index = Math.max(0, list.length - 1);
    var q = list[index];
    if (!q) return;
    var progress = DKQuiz.stepProgress(answers, index);
    var step = progress.step;
    var about = progress.total;
    var pct = Math.max(4, Math.min(100, Math.round((step / about) * 100)));
    var chosen = selectedMap(q);
    var role = q.multiSelect ? 'group' : 'radiogroup';
    var options = q.options.map(function (opt) {
      var on = !!chosen[opt.value];
      return '<button type="button" class="option' + (q.multiSelect ? ' multi' : '') + '" role="' + (q.multiSelect ? 'checkbox' : 'radio') + '" aria-checked="' + (on ? 'true' : 'false') + '" data-action="option" data-value="' + esc(opt.value) + '"><span class="mark" aria-hidden="true"></span><span>' + esc(opt.label) + '</span></button>';
    }).join('');
    var error = showError
      ? '<p class="field-error" tabindex="-1">' + (q.multiSelect ? 'Select at least one to continue.' : 'Choose an answer to continue.') + '</p>'
      : '';
    root.innerHTML =
      '<section class="panel" aria-labelledby="q-text">' +
        '<p class="progress-label"><span>Step ' + step + ' of ' + about + '</span><span>About 5 minutes</span></p>' +
        '<div class="progress-track" aria-hidden="true"><div class="progress-fill" style="width:' + pct + '%"></div></div>' +
        '<h2 id="q-text" class="q-text" tabindex="-1">' + esc(q.text) + '</h2>' +
        (q.helper ? '<p class="helper">' + esc(q.helper) + '</p>' : '') +
        '<div class="options" role="' + role + '" aria-labelledby="q-text">' + options + '</div>' +
        error +
        '<div class="quiz-nav">' +
          (index > 0 ? '<button type="button" class="btn-secondary" data-action="back">Back</button>' : '') +
          '<button type="button" class="btn-primary" data-action="next">' + (index === list.length - 1 ? 'See results' : 'Next') + '</button>' +
        '</div>' +
      '</section>';
  }

  function badge(status) {
    return '<span class="badge badge-' + esc(status) + '">' + esc(STATUS_LABEL[status] || 'Note') + '</span>';
  }

  function renderPriorities() {
    var items = result.priorities || [];
    if (!items.length) {
      return '<section class="panel priorities"><h2 id="top3">Top 3 priorities</h2><p class="helper">Nothing in your answers needs action right now. The notes below are still worth a look.</p></section>';
    }
    var list = items.map(function (item, i) {
      var href = toolHref(item.cta);
      var button = href ? '<a class="tool-btn" href="' + esc(href) + '" target="_blank" rel="noopener">' + esc(item.cta.label) + '</a>' : '';
      return '<li><span class="rank">' + (i + 1) + '</span><div class="priority-copy">' + badge(item.status) + '<strong>' + esc(item.title) + '</strong><p>' + esc(item.finding) + '</p>' + button + '</div></li>';
    }).join('');
    return '<section class="panel priorities" aria-labelledby="top3"><h2 id="top3">Top 3 priorities</h2><ol class="priority-list">' + list + '</ol></section>';
  }

  function renderSnapshot() {
    var snap = result.snapshot || { lines: [] };
    var ready = result.readiness || {};
    var lines = (snap.lines || []).map(function (line) {
      return '<div class="snap status-' + esc(line.status || 'neutral') + '"><span>' + esc(line.label) + '</span><strong>' + esc(line.value) + '</strong></div>';
    }).join('');
    var alert = snap.alert && snap.alertText
      ? '<div class="alert"><strong>' + esc(snap.alertText) + '</strong>' + (snap.alertSub ? '<p>' + esc(snap.alertSub) + '</p>' : '') + '</div>'
      : '';
    var score = ready.score != null
      ? '<div class="readiness ' + esc(ready.className || '') + '"><div class="score-num" aria-label="Readiness ' + esc(ready.score) + ' out of 10">' + esc(ready.score) + '<span>/10</span></div><div><span class="readiness-label">' + esc(ready.label) + '</span><span class="readiness-sub">' + esc(ready.sub) + '</span></div></div>'
      : (ready.label
        ? '<div class="readiness ' + esc(ready.className || '') + '"><div><span class="readiness-label">' + esc(ready.label) + '</span><span class="readiness-sub">' + esc(ready.sub || '') + '</span></div></div>'
        : '');
    return '<section class="panel snapshot" aria-labelledby="snap-title"><h2 id="snap-title">Snapshot</h2>' + alert + '<div class="snapshot-grid">' + lines + '</div>' + score + '</section>';
  }

  function renderCalendar() {
    var items = result.calendar || [];
    if (!items.length) return '';
    var list = items.map(function (item) {
      return '<li><span class="when">' + esc(item.when) + '</span><span>' + esc(item.text) + '</span></li>';
    }).join('');
    return '<section class="panel calendar" id="calendar" aria-labelledby="cal-title"><h2 id="cal-title">Your compliance calendar</h2><ul class="calendar-list">' + list + '</ul></section>';
  }

  function toolHref(cta) {
    if (!cta || !DKQuiz.URLS[cta.type]) return '';
    return DKQuiz.URLS[cta.type];
  }

  function renderCards() {
    var cards = result.cards || [];
    var html = cards.map(function (card) {
      var links = (card.links || []).map(function (link) {
        return '<a class="notice-link" href="' + esc(link.url) + '" target="_blank" rel="noopener">' + esc(link.label) + (link.helper ? '<span>' + esc(link.helper) + '</span>' : '') + '</a>';
      }).join('');
      var href = toolHref(card.cta);
      var cta = href ? '<a class="tool-link" href="' + esc(href) + '" target="_blank" rel="noopener">' + esc(card.cta.label) + '</a>' : '';
      return '<article class="finding">' +
        '<button type="button" class="finding-toggle" data-action="expand" aria-expanded="false">' +
          '<span class="finding-title">' + esc(card.title) + '</span>' + badge(card.status) +
          '<span class="chevron" aria-hidden="true"></span>' +
          '<p class="finding-summary">' + esc(card.summary) + '</p>' +
        '</button>' +
        '<div class="finding-body" hidden>' +
          '<h3>What we found</h3><p>' + esc(card.finding) + '</p>' +
          '<h3>What it means</h3><p>' + esc(card.description) + '</p>' +
          '<h3>What to do</h3><p>' + esc(card.action) + '</p>' +
          links + cta +
        '</div></article>';
    }).join('');
    return '<h2 class="cards-title">Your items</h2>' + html;
  }

  function renderDisclaimer() {
    return '<section class="panel disclaimer"><p>This checkup is general information, not legal, tax, or ERISA advice.</p>' +
      '<details><summary>Read full notice</summary>' +
      '<p>This compliance checkup is provided for general informational and educational purposes only. It is not legal, tax, accounting, or ERISA advice, and it does not create an advisor-client, broker-client, or fiduciary relationship of any kind.</p>' +
      '<p>The results are based on the answers you selected. They highlight common considerations. They do not confirm that a plan is in compliance. Laws and plan terms vary, and this checkup cannot see documents it did not ask about.</p>' +
      '<p>The employer remains responsible for compliance. DK Benefits LLC does not assume liability for actions taken, or not taken, based on these results.</p>' +
      '<p>Rules and limits change. Confirm current requirements with your advisor, counsel, or payroll provider before you file or change a plan.</p>' +
      '</details></section>';
  }

  function honeypotField() {
    return '<label class="hp">Leave this blank<input name="company_website" tabindex="-1" autocomplete="off"></label>';
  }

  function renderLeadInner() {
    var privacy = '<p class="privacy">If you send contact info, we use your name and email or phone only to reply about this checkup.</p>';
    if (!endpoint()) {
      return privacy + honeypotField() +
        '<p class="unconfigured">This form is not connected yet. Call or text 407-476-5076 or email dan@dkbenefits.net.</p>';
    }
    if (leadState === 'sent') return '<p class="lead-success">' + esc(leadMessage) + '</p>';
    return privacy +
      '<p class="optional">Optional. Your results stay on this page either way.</p>' +
      '<form id="lead-form" novalidate>' +
        honeypotField() +
        '<div class="lead-grid">' +
          '<label class="field">First name<input name="firstName" autocomplete="given-name" required></label>' +
          '<label class="field">Company<input name="company" autocomplete="organization" required></label>' +
          '<label class="field">Email<input name="email" type="email" autocomplete="email" inputmode="email"></label>' +
          '<label class="field">Phone<input name="phone" type="tel" autocomplete="tel" inputmode="tel"></label>' +
        '</div>' +
        '<p class="hint">Email or phone, at least one.</p>' +
        (leadMessage ? '<p class="field-error">' + esc(leadMessage) + '</p>' : '') +
        '<div class="quiz-nav"><button class="btn-primary" type="submit"' + (leadState === 'sending' ? ' disabled' : '') + '>' + (leadState === 'sending' ? 'Sending...' : 'Send') + '</button></div>' +
      '</form>';
  }

  function renderContact() {
    return '<section class="contact-box" id="contact-box">' +
      '<h2>Let DK Benefits review your benefits package.</h2>' +
      '<p>Call/text/email today.</p>' +
      '<div class="contact-lines">' +
        '<a href="tel:4074765076">407-476-5076</a>' +
        '<a href="mailto:dan@dkbenefits.net">dan@dkbenefits.net</a>' +
        '<a href="https://www.dkbenefits.net" target="_blank" rel="noopener">www.dkbenefits.net</a>' +
      '</div>' +
      '<div class="lead-panel" id="lead-panel">' + renderLeadInner() + '</div></section>';
  }

  function renderResults() {
    root.innerHTML =
      '<div class="results-head"><h2 id="results-title" tabindex="-1">Your results</h2>' +
        '<button type="button" class="btn-secondary no-print" data-action="print">Print / Save as PDF</button></div>' +
      '<p class="privacy-line">Your answers stay in this browser unless you choose to send contact info at the end.</p>' +
      renderPriorities() +
      renderSnapshot() +
      renderCalendar() +
      renderCards() +
      (result.flags && result.flags.offersBenefits
        ? '<p class="strategy-row no-print"><a class="tool-link" href="' + esc(DKQuiz.URLS.quote) + '" target="_blank" rel="noopener">Review quotes and strategy</a></p>'
        : '') +
      renderDisclaimer() +
      renderContact() +
      '<button type="button" class="btn-text start-over no-print" data-action="restart">Start over</button>';
  }

  function findingsText() {
    var ready = result.readiness || {};
    var lines = [];
    if (ready.score != null) lines.push('Readiness: ' + ready.label + ' (' + ready.score + '/10)');
    else if (ready.label) lines.push('Readiness: ' + ready.label);
    (result.priorities || []).forEach(function (item, i) {
      lines.push((i + 1) + '. ' + item.title + ': ' + item.finding);
    });
    return lines.join('\n');
  }

  function submitLead(form) {
    if (form.company_website && String(form.company_website.value || '').trim()) {
      leadState = 'sent';
      leadMessage = 'Thanks. Your note is on its way. Your results are still on this page.';
      render();
      return;
    }
    var data = {
      firstName: form.firstName.value.trim(),
      company: form.company.value.trim(),
      email: form.email.value.trim(),
      phone: form.phone.value.trim()
    };
    if (!data.firstName || !data.company || (!data.email && !data.phone)) {
      leadState = 'error';
      leadMessage = 'Enter your first name, company, and an email or phone.';
      render();
      return;
    }
    if (data.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) {
      leadState = 'error';
      leadMessage = 'Enter a valid email, or leave it blank and use a phone number.';
      render();
      return;
    }
    if (data.phone && data.phone.replace(/\D/g, '').length < 7) {
      leadState = 'error';
      leadMessage = 'Enter a valid phone number, or leave it blank and use an email.';
      render();
      return;
    }
    leadState = 'sending';
    leadMessage = '';
    render();
    var payload = {
      firstName: data.firstName,
      company: data.company,
      email: data.email,
      phone: data.phone,
      summary: result.summary || '',
      findings: findingsText(),
      pageUrl: window.location.href,
      version: DKQuiz.VERSION
    };
    fetch(endpoint(), { method: 'POST', body: JSON.stringify(payload) })
      .then(function (response) {
        if (!response.ok) throw new Error('status');
        return response.text();
      })
      .then(function (text) {
        var body = null;
        try { body = JSON.parse(text); } catch (ignore) { body = null; }
        if (body && body.ok === false) throw new Error('rejected');
        leadState = 'sent';
        leadMessage = 'Thanks. Your note is on its way. Your results are still on this page.';
        render();
      })
      .catch(function () {
        leadState = 'error';
        leadMessage = 'We could not send that just now. Your checkup results are still on this page. Call or text 407-476-5076 or email dan@dkbenefits.net.';
        render();
      });
  }

  root.addEventListener('click', function (event) {
    var target = event.target.closest('[data-action]');
    if (!target || !root.contains(target)) return;
    var action = target.getAttribute('data-action');
    if (action === 'option') onOption(target.getAttribute('data-value'));
    else if (action === 'next') goNext();
    else if (action === 'back') goBack();
    else if (action === 'expand') toggleExpand(target);
    else if (action === 'print') window.print();
    else if (action === 'restart') restart();
  });

  root.addEventListener('toggle', function (event) {
  if (event.target && event.target.tagName === 'DETAILS') postHeight();
}, true);

root.addEventListener('submit', function (event) {
    var form = event.target.closest('#lead-form');
    if (!form) return;
    event.preventDefault();
    submitLead(form);
  });

  document.addEventListener('keydown', function (event) {
    if (phase !== 'question') return;
    var tag = event.target && event.target.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA') return;
    var option = event.target.closest && event.target.closest('.option');
    var options = root.querySelectorAll('.option');
    if (!options.length) return;
    var list = Array.prototype.slice.call(options);
    var at = option ? list.indexOf(option) : -1;
    if (event.key === 'ArrowDown' || event.key === 'ArrowRight') {
      event.preventDefault();
      list[(at + 1) % list.length].focus();
    } else if (event.key === 'ArrowUp' || event.key === 'ArrowLeft') {
      event.preventDefault();
      list[(at - 1 + list.length) % list.length].focus();
    } else if (event.key === ' ' && option) {
      event.preventDefault();
      onOption(option.getAttribute('data-value'));
    } else if (event.key === 'Enter' && option) {
      event.preventDefault();
      goNext();
    }
  });

  window.addEventListener('resize', function () { postHeight(); });
  window.addEventListener('beforeprint', function () {
    root.querySelectorAll('.finding-body').forEach(function (body) { body.removeAttribute('hidden'); });
    root.querySelectorAll('.finding-toggle').forEach(function (btn) { btn.setAttribute('aria-expanded', 'true'); });
    var notice = root.querySelector('.disclaimer details');
    if (notice) notice.open = true;
  });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(postHeight);
  window.DKCompliance = { version: DKQuiz.VERSION, measureHeight: measureHeight };
  render({ focusHeading: true });
})();
