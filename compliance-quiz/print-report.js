/**
 * Printable Benefits Compliance Checkup.
 * Hidden on screen. Built when the visitor prints or saves a PDF.
 * Loaded by the preview page, and by the live page when that page includes this script.
 */
(function () {
  var QUIZ = document.getElementById('quiz');
  if (!QUIZ) return;

  var GROUP_ORDER = ['actionNeeded', 'confirm', 'inPlace', 'note'];
  var GROUP_LABEL = {
    actionNeeded: 'Action needed',
    confirm: 'Confirm',
    inPlace: 'In place',
    note: 'Notes'
  };
  var MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

  function esc(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function text(el) {
    return el ? String(el.textContent || '').replace(/\s+/g, ' ').trim() : '';
  }

  function printedDate(date) {
    var d = date || new Date();
    return MONTHS[d.getMonth()] + ' ' + d.getDate() + ', ' + d.getFullYear();
  }

  function companyName() {
    var input = document.querySelector('input[name="company"]');
    return input ? String(input.value || '').trim() : '';
  }

  function statusKey(badge) {
    if (!badge || !badge.className) return 'note';
    var match = String(badge.className).match(/badge-([A-Za-z]+)/);
    return match ? match[1] : 'note';
  }

  function actionText(article) {
    var heads = article.querySelectorAll('.finding-body h3');
    for (var i = 0; i < heads.length; i += 1) {
      if (text(heads[i]) !== 'What to do') continue;
      var node = heads[i].nextElementSibling;
      while (node && node.tagName !== 'P') node = node.nextElementSibling;
      return text(node);
    }
    return '';
  }

  function readModel() {
    var scoreEl = QUIZ.querySelector('.score-num');
    var score = '';
    if (scoreEl) {
      var copy = scoreEl.cloneNode(true);
      var suffix = copy.querySelector('span');
      if (suffix) suffix.parentNode.removeChild(suffix);
      score = text(copy);
    }
    var priorities = [];
    var rows = QUIZ.querySelectorAll('.priority-list li');
    for (var p = 0; p < rows.length; p += 1) {
      priorities.push({
        title: text(rows[p].querySelector('strong')),
        finding: text(rows[p].querySelector('p')),
        status: text(rows[p].querySelector('.badge'))
      });
    }
    var items = [];
    var cards = QUIZ.querySelectorAll('article.finding');
    for (var c = 0; c < cards.length; c += 1) {
      items.push({
        title: text(cards[c].querySelector('.finding-title')),
        status: statusKey(cards[c].querySelector('.badge')),
        action: actionText(cards[c])
      });
    }
    var calendar = [];
    var dates = QUIZ.querySelectorAll('.calendar-list li');
    for (var d = 0; d < dates.length; d += 1) {
      var spans = dates[d].querySelectorAll('span');
      calendar.push({ when: text(spans[0]), text: text(spans[1]) });
    }
    return {
      company: companyName(),
      printed: printedDate(),
      score: score,
      label: text(QUIZ.querySelector('.readiness-label')),
      sub: text(QUIZ.querySelector('.readiness-sub')),
      priorities: priorities,
      items: items,
      calendar: calendar
    };
  }

  function nextSteps(model) {
    var hasAction = false;
    var hasConfirm = false;
    (model.items || []).forEach(function (item) {
      if (item.status === 'actionNeeded') hasAction = true;
      if (item.status === 'confirm') hasConfirm = true;
    });
    var lines = [];
    if (hasAction) lines.push('Start with the Action needed items. Those are the ones most likely to create a notice, filing, or plan-document problem.');
    if (hasConfirm) lines.push('Confirm the open items before the next renewal or filing date.');
    if (!hasAction && !hasConfirm) lines.push('Nothing in this checkup is marked Action needed. Keep the calendar, and review the plan when benefits change.');
    lines.push('DK Benefits can walk through this checklist with you.');
    return lines;
  }

  function render(model) {
    model = model || {};
    var prepared = model.company
      ? '<p class="print-prepared">Prepared for ' + esc(model.company) + '</p>'
      : '';
    var score = model.score
      ? '<p class="print-score">' + esc(model.score) + '<span>/10</span></p>'
      : '';
    var priorities = (model.priorities || []).map(function (item, index) {
      return '<li class="print-priority"><span class="print-rank">' + (index + 1) + '</span><div><strong>' + esc(item.title) + '</strong><p>' + esc(item.finding) + '</p></div></li>';
    }).join('');
    if (!priorities) priorities = '<li class="print-priority"><div><p>Nothing in these answers needs action right now. The notes below are still worth a look.</p></div></li>';
    var groups = GROUP_ORDER.map(function (key) {
      var rows = (model.items || []).filter(function (item) { return item.status === key; });
      if (!rows.length) return '';
      var list = rows.map(function (item) {
        return '<li class="print-item"><span class="print-box" aria-hidden="true"></span><div><strong>' + esc(item.title) + '</strong><p>' + esc(item.action) + '</p></div></li>';
      }).join('');
      return '<section class="print-group"><h3>' + esc(GROUP_LABEL[key]) + '</h3><ul class="print-checks">' + list + '</ul></section>';
    }).join('');
    var calendar = '';
    if ((model.calendar || []).length) {
      var body = model.calendar.map(function (row) {
        return '<tr><td>' + esc(row.when) + '</td><td>' + esc(row.text) + '</td></tr>';
      }).join('');
      calendar = '<table class="print-calendar"><thead><tr><th>When</th><th>Notice or filing</th></tr></thead><tbody>' + body + '</tbody></table>';
    } else {
      calendar = '<p class="print-empty">No dated notices or filings came up in these answers.</p>';
    }
    var steps = nextSteps(model).map(function (line) {
      return '<li>' + esc(line) + '</li>';
    }).join('');
    return '<header class="print-banner">' +
        '<p class="print-brand">DK Benefits</p>' +
        '<h1>Benefits Compliance Checkup</h1>' +
        prepared +
        '<p class="print-date">Printed ' + esc(model.printed || printedDate()) + '</p>' +
      '</header>' +
      '<section class="print-section"><h2>Readiness</h2>' + score +
        '<p class="print-label">' + esc(model.label || '') + '</p>' +
        '<p>' + esc(model.sub || '') + '</p></section>' +
      '<section class="print-section"><h2>Top 3 priorities</h2><ol class="print-priorities">' + priorities + '</ol></section>' +
      '<section class="print-section"><h2>Findings checklist</h2>' + groups + '</section>' +
      '<section class="print-section"><h2>Notice and filing calendar</h2>' + calendar + '</section>' +
      '<section class="print-section print-next"><h2>Next steps</h2><ul>' + steps + '</ul></section>' +
      '<section class="print-contact">' +
        '<h2>Talk with DK Benefits</h2>' +
        '<p>Daniel Kirves, Benefits Broker | DK Benefits</p>' +
        '<p>407-476-5076</p>' +
        '<p>dan@dkbenefits.net</p>' +
        '<p>www.dkbenefits.net</p>' +
        '<p>6000 Metrowest Blvd #200 Orlando, FL 32835</p>' +
        '<p>Agency Lic# L109331</p>' +
        '<p class="print-offer">DK Benefits clients get COBRA notice handling at no extra cost, and you keep the 2% admin fee.</p>' +
      '</section>' +
      '<p class="print-disclaimer">This checkup is general information, not legal, tax, or ERISA advice. Confirm current requirements before you file or change a plan.</p>';
  }

  function host() {
    var node = document.getElementById('print-report');
    if (node) return node;
    node = document.createElement('article');
    node.id = 'print-report';
    node.className = 'print-report';
    document.body.appendChild(node);
    return node;
  }

  function mount() {
    if (!document.getElementById('results-title')) {
      host().innerHTML = '';
      return;
    }
    host().innerHTML = render(readModel());
  }

  function relabel() {
    var buttons = QUIZ.querySelectorAll('[data-action="print"]');
    for (var i = 0; i < buttons.length; i += 1) {
      if (buttons[i].textContent !== 'Print or save as PDF') buttons[i].textContent = 'Print or save as PDF';
    }
  }

  new MutationObserver(relabel).observe(QUIZ, { childList: true, subtree: true });
  window.addEventListener('beforeprint', mount);
  relabel();
  window.DKPrint = { render: render, readModel: readModel, mount: mount, printedDate: printedDate };
})();
