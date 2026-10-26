/**
 * Page for the mid-year election change tool.
 * Decisions live in qe-model.js. This file only asks the questions and shows the result.
 * window.QE.scenario is the object a later form can read.
 */
(function () {
  var model = window.QEModel;
  var state = { event: '', benefits: [], answers: {}, timing: '' };
  var stepId = 'event';
  var paintedStep = '';
  var ORIGINS = [
    'https://www.dkbenefits.net',
    'https://dkbenefits.net',
    'https://dankirves-prog.github.io',
    'https://www-dkbenefits-net.filesusr.com',
    'https://editor.wix.com',
    'https://create.editorx.com',
    'https://manage.wix.com'
  ];
  var NOTE = 'These are general rules. The employer\'s plan document and the carrier\'s rules govern. This is not legal or tax advice.';

  window.QE = {
    scenario: null,
    evaluate: model.evaluate,
    enumerate: model.enumerate,
    model: model
  };

  var form = document.getElementById('wizard');
  var panel = document.getElementById('panel');
  var progress = document.getElementById('progressList');

  function esc(text) {
    return String(text == null ? '' : text)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function includeTiming() {
    if (!state.event || !state.benefits.length) return true;
    return model.windowMode(state) !== 'none';
  }

  function stepList() {
    var list = [
      { id: 'event', name: 'Event' },
      { id: 'benefits', name: 'Benefits' },
      { id: 'change', name: 'Change' }
    ];
    if (includeTiming()) list.push({ id: 'timing', name: 'Timing' });
    list.push({ id: 'result', name: 'Result' });
    return list;
  }

  function stepIndex(list) {
    for (var i = 0; i < list.length; i++) {
      if (list[i].id === stepId) return i;
    }
    return 0;
  }

  function prune() {
    var guard = 0;
    while (guard < 8) {
      guard += 1;
      var questions = model.visibleQuestions(state);
      var ids = {};
      questions.forEach(function (question) { ids[question.id] = question; });
      var changed = false;
      Object.keys(state.answers).forEach(function (key) {
        var question = ids[key];
        if (!question) {
          delete state.answers[key];
          changed = true;
          return;
        }
        var ok = question.options.some(function (opt) { return opt.value === state.answers[key]; });
        if (!ok) {
          delete state.answers[key];
          changed = true;
        }
      });
      if (!changed) break;
    }
    var mode = state.event ? model.windowMode(state) : 'gate30';
    var options = model.timingOptions(mode);
    var timingOk = options.some(function (opt) { return opt.value === state.timing; });
    if (!timingOk) state.timing = mode === 'none' ? 'not_applicable' : '';
  }

  function questionsComplete() {
    var questions = model.visibleQuestions(state);
    if (!questions.length) return false;
    return questions.every(function (question) { return !!state.answers[question.id]; });
  }

  function validate() {
    if (stepId === 'event' && !state.event) return 'Select the event that applies.';
    if (stepId === 'benefits' && !state.benefits.length) return 'Select at least one benefit.';
    if (stepId === 'change' && !questionsComplete()) return 'Answer every question on this step.';
    if (stepId === 'timing' && !state.timing) return 'Select when the event happened.';
    return '';
  }

  function choice(name, value, label, checked, type) {
    return '<label class="choice"><input type="' + type + '" name="' + esc(name) + '" value="' + esc(value) + '"' + (checked ? ' checked' : '') + '> <span>' + esc(label) + '</span></label>';
  }

  function note() {
    return '<p class="soft-note">' + esc(NOTE) + '</p>';
  }

  function nav() {
    var back = '<button type="button" class="btn btn-secondary" id="backBtn"' + (stepId === 'event' ? ' hidden' : '') + '>Back</button>';
    if (stepId === 'result') {
      return '<div class="nav">' + back + '<button type="button" class="btn btn-primary" id="startOver">Start over</button></div>';
    }
    return '<div class="nav">' + back + '<button type="submit" class="btn btn-primary" id="nextBtn">Next</button></div>';
  }

  function errorSlot() {
    return '<p class="field-error" id="fieldError" role="alert"></p>';
  }

  function countText(list) {
    return 'Step ' + (stepIndex(list) + 1) + ' of ' + list.length;
  }

  function eventBody() {
    var choices = model.EVENTS.map(function (event) {
      return choice('event', event.id, event.label, state.event === event.id, 'radio');
    }).join('');
    return ''
      + '<h2 id="stepTitle" tabindex="-1">What qualifying event happened?</h2>'
      + '<p class="lede">Select the one situation that applies.</p>'
      + '<fieldset><div class="choices event-choices">' + choices + '</div></fieldset>'
      + errorSlot()
      + note()
      + nav();
  }

  function benefitsBody() {
    var choices = model.BENEFITS.map(function (benefit) {
      return choice('benefit', benefit.id, benefit.label, state.benefits.indexOf(benefit.id) !== -1, 'checkbox');
    }).join('');
    return ''
      + '<h2 id="stepTitle" tabindex="-1">Which benefits would change?</h2>'
      + '<p class="lede">Select every benefit this request would change. The answer can differ by benefit.</p>'
      + '<fieldset><div class="choices event-choices">' + choices + '</div></fieldset>'
      + errorSlot()
      + note()
      + nav();
  }

  function changeBody() {
    var questions = model.visibleQuestions(state);
    var blocks = questions.map(function (question) {
      var choices = question.options.map(function (opt) {
        return choice('q-' + question.id, opt.value, opt.label, state.answers[question.id] === opt.value, 'radio');
      }).join('');
      return '<fieldset><legend>' + esc(question.prompt) + '</legend><div class="choices">' + choices + '</div></fieldset>';
    }).join('');
    var lede = state.benefits.length === 1 && state.benefits[0] === 'hsa'
      ? 'An HSA paycheck change does not need a qualifying event. Confirm what payroll should do.'
      : 'Answer each question. A later question appears only when it applies.';
    return ''
      + '<h2 id="stepTitle" tabindex="-1">What change is being requested?</h2>'
      + '<p class="lede">' + esc(lede) + '</p>'
      + blocks
      + errorSlot()
      + note()
      + nav();
  }

  function timingBody() {
    var mode = model.windowMode(state);
    var choices = model.timingOptions(mode).map(function (opt) {
      return choice('timing', opt.value, opt.label, state.timing === opt.value, 'radio');
    }).join('');
    return ''
      + '<h2 id="stepTitle" tabindex="-1">When did this happen?</h2>'
      + '<p class="lede">' + esc(model.timingPrompt(mode)) + '</p>'
      + '<fieldset><div class="choices">' + choices + '</div></fieldset>'
      + errorSlot()
      + note()
      + nav();
  }

  function resultBody(list) {
    var view = model.scenario(state);
    window.QE.scenario = view;
    var result = view.result;
    var bits = [view.event.label];
    if (view.coverage.length) bits.push(view.coverage.map(function (item) { return item.label; }).join(', '));
    if (view.change.label) bits.push(view.change.label);
    view.followups.forEach(function (item) {
      if (item.label) bits.push(item.label);
    });
    if (view.timing.label && state.timing && state.timing !== 'not_applicable') bits.push(view.timing.label);
    var steps = result.steps.length
      ? '<h3 class="what">What to do</h3><ol class="steps">' + result.steps.map(function (step) {
        return '<li>' + esc(step) + '</li>';
      }).join('') + '</ol>'
      : '';
    var parts = result.parts.length > 1
      ? '<div class="parts">' + result.parts.map(function (item) {
        return '<article class="part"><h3>' + esc(item.label) + '</h3><p><strong>' + esc(item.title) + '.</strong> ' + esc(item.text) + '</p></article>';
      }).join('') + '</div>'
      : '';
    var nudge = result.nudge
      ? '<div class="nudge"><p>Pre-tax treatment depends on the written Section 125 plan.</p><a class="btn btn-gold" href="' + esc(result.nudgeUrl) + '" target="_blank" rel="noopener">Open the Section 125 plan document tool</a></div>'
      : '';
    var bases = result.bases.length
      ? '<details class="basis"><summary>Legal basis</summary><ul>' + result.bases.map(function (basis) {
        return '<li>' + esc(basis) + '</li>';
      }).join('') + '</ul></details>'
      : '';
    panel.className = 'card result-' + result.code;
    return ''
      + '<p class="step-count" id="stepCount">' + esc(countText(list)) + '</p>'
      + '<p class="badge">' + esc(result.title) + '</p>'
      + '<h2 id="stepTitle" tabindex="-1">' + esc(result.title) + '</h2>'
      + '<p class="path-line">' + esc(bits.join('. ')) + '</p>'
      + '<p class="summary">' + esc(result.summary) + '</p>'
      + steps
      + parts
      + nudge
      + bases
      + note()
      + nav();
  }

  function bodyFor(list) {
    if (stepId !== 'result') panel.className = 'card';
    if (stepId === 'event') return eventBody();
    if (stepId === 'benefits') return benefitsBody();
    if (stepId === 'change') return changeBody();
    if (stepId === 'timing') return timingBody();
    return resultBody(list);
  }

  function paintProgress(list) {
    var index = stepIndex(list);
    progress.innerHTML = list.map(function (step, i) {
      var current = i === index;
      var disabled = i > index;
      return '<li><button type="button" data-step="' + step.id + '"'
        + (current ? ' aria-current="step"' : '')
        + (disabled ? ' disabled' : '')
        + '><span class="step-index">' + (i + 1) + '</span> <span class="step-name">' + esc(step.name) + '</span></button></li>';
    }).join('');
  }

  function findInput(name, value) {
    var nodes = form.querySelectorAll('input[name="' + name + '"]');
    for (var i = 0; i < nodes.length; i++) {
      if (nodes[i].value === value) return nodes[i];
    }
    return null;
  }

  function post(data) {
    if (window.parent === window) return;
    var origins = ORIGINS.slice();
    if (window.location.origin && origins.indexOf(window.location.origin) === -1) {
      origins.push(window.location.origin);
    }
    origins.forEach(function (origin) {
      try { window.parent.postMessage(data, origin); } catch (err) {}
    });
  }

  function measure() {
    var body = document.body;
    var html = document.documentElement;
    return Math.ceil(Math.max(
      body ? body.scrollHeight : 0,
      body ? body.offsetHeight : 0,
      html ? html.scrollHeight : 0,
      html ? html.offsetHeight : 0
    ));
  }

  function postHeight() {
    post({ type: 'resize', height: measure(), tool: 'qualifying-event' });
  }

  function scheduleHeight() {
    if (window.requestAnimationFrame) {
      window.requestAnimationFrame(function () {
        window.requestAnimationFrame(postHeight);
      });
    } else {
      postHeight();
    }
  }

  function paint(options) {
    options = options || {};
    prune();
    var list = stepList();
    if (stepIndex(list) === 0 && list[0].id !== stepId && !list.some(function (step) { return step.id === stepId; })) {
      stepId = 'change';
      list = stepList();
    }
    if (!list.some(function (step) { return step.id === stepId; })) {
      stepId = 'change';
      list = stepList();
    }
    if (stepId !== 'result') window.QE.scenario = null;
    var changed = paintedStep !== stepId;
    paintedStep = stepId;
    paintProgress(list);
    var html = bodyFor(list);
    if (stepId !== 'result') {
      html = '<p class="step-count" id="stepCount">' + esc(countText(list)) + '</p>' + html;
    }
    panel.innerHTML = html;
    if (options.focus && changed) {
      var title = document.getElementById('stepTitle');
      if (title) title.focus({ preventScroll: true });
    } else if (options.restoreName) {
      var input = findInput(options.restoreName, options.restoreValue);
      if (input) input.focus({ preventScroll: true });
    }
    if (options.scroll && changed) {
      window.scrollTo(0, 0);
      post({ type: 'scrollTop', tool: 'qualifying-event' });
    }
    scheduleHeight();
  }

  function goNext() {
    var message = validate();
    if (message) {
      var err = document.getElementById('fieldError');
      if (err) err.textContent = message;
      scheduleHeight();
      return;
    }
    if (!includeTiming()) state.timing = 'not_applicable';
    var list = stepList();
    var index = stepIndex(list);
    if (index < list.length - 1) {
      stepId = list[index + 1].id;
      paint({ focus: true, scroll: true });
    }
  }

  function goBack() {
    var list = stepList();
    var index = stepIndex(list);
    if (index > 0) {
      stepId = list[index - 1].id;
      paint({ focus: true, scroll: true });
    }
  }

  function reset() {
    state.event = '';
    state.benefits = [];
    state.answers = {};
    state.timing = '';
    stepId = 'event';
    window.QE.scenario = null;
    paint({ focus: true, scroll: true });
  }

  form.addEventListener('change', function (event) {
    var input = event.target;
    if (!input || !input.name) return;
    if (input.name === 'event') {
      if (state.event !== input.value) {
        state.event = input.value;
        state.answers = {};
        state.timing = '';
      }
      paint({ restoreName: 'event', restoreValue: input.value });
      return;
    }
    if (input.name === 'benefit') {
      state.benefits = Array.prototype.map.call(
        form.querySelectorAll('input[name="benefit"]:checked'),
        function (box) { return box.value; }
      );
      paint({ restoreName: 'benefit', restoreValue: input.value });
      return;
    }
    if (input.name.indexOf('q-') === 0) {
      state.answers[input.name.slice(2)] = input.value;
      paint({ restoreName: input.name, restoreValue: input.value });
      return;
    }
    if (input.name === 'timing') {
      state.timing = input.value;
      paint({ restoreName: 'timing', restoreValue: input.value });
    }
  });

  form.addEventListener('submit', function (event) {
    event.preventDefault();
    if (stepId !== 'result') goNext();
  });

  form.addEventListener('click', function (event) {
    var button = event.target.closest ? event.target.closest('button') : null;
    if (!button) return;
    if (button.id === 'backBtn') {
      event.preventDefault();
      goBack();
    }
    if (button.id === 'startOver') {
      event.preventDefault();
      reset();
    }
  });

  progress.addEventListener('click', function (event) {
    var button = event.target.closest ? event.target.closest('button') : null;
    if (!button || button.disabled) return;
    var id = button.getAttribute('data-step');
    var list = stepList();
    var next = -1;
    var current = stepIndex(list);
    for (var i = 0; i < list.length; i++) if (list[i].id === id) next = i;
    if (next >= 0 && next < current) {
      stepId = id;
      paint({ focus: true, scroll: true });
    }
  });

  if (window.ResizeObserver) {
    var observer = new ResizeObserver(function () { postHeight(); });
    observer.observe(document.body);
  }
  window.addEventListener('load', postHeight);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(postHeight);

  paint({ focus: false });
})();
