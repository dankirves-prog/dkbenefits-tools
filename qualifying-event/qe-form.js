/**
 * Question form for the mid-year election change tool.
 * The same checks run in the browser and in node tests.
 * The page posts the payload to QE_QUESTION_ENDPOINT.
 */
var QEForm = (function () {
  var MIN_ELAPSED_MS = 3000;
  var FIELD_IDS = {
    name: 'qeName',
    email: 'qeEmail',
    phone: 'qePhone',
    company: 'qeCompany',
    question: 'qeQuestion'
  };

  function clean(value, max) {
    var text = String(value == null ? '' : value).replace(/[ \t\f\v]+/g, ' ').trim();
    if (max && text.length > max) text = text.slice(0, max);
    return text;
  }

  function digits(value) {
    return String(value || '').replace(/\D/g, '');
  }

  function emailOk(email) {
    if (!email || email.length > 254) return false;
    if (/\s/.test(email) || email.indexOf('..') !== -1) return false;
    var at = email.indexOf('@');
    if (at < 1 || at !== email.lastIndexOf('@')) return false;
    var domain = email.slice(at + 1);
    if (domain.indexOf('.') < 1 || domain.charAt(0) === '.' || domain.charAt(domain.length - 1) === '.') return false;
    return true;
  }

  function validate(fields) {
    fields = fields || {};
    var name = clean(fields.name, 120);
    var email = clean(fields.email, 254);
    var phone = clean(fields.phone, 24);
    var company = clean(fields.company, 120);
    var question = String(fields.question == null ? '' : fields.question).replace(/\r\n/g, '\n').trim();
    if (question.length > 4000) question = question.slice(0, 4000);
    var errors = [];
    if (!name) errors.push({ field: 'name', message: 'Enter your name.' });
    if (!email) errors.push({ field: 'email', message: 'Enter your email.' });
    else if (!emailOk(email)) errors.push({ field: 'email', message: 'Enter an email Dan can reply to.' });
    if (phone && digits(phone).length < 7) errors.push({ field: 'phone', message: 'Enter a phone number with at least 7 digits, or leave it blank.' });
    if (!question) errors.push({ field: 'question', message: 'Enter your question.' });
    return {
      ok: errors.length === 0,
      errors: errors,
      fields: { name: name, email: email, phone: phone, company: company, question: question }
    };
  }

  function whoLabel(scenario) {
    var followups = scenario && scenario.followups;
    if (!followups) return 'Not specified';
    for (var i = 0; i < followups.length; i++) {
      if (followups[i].id === 'who' && String(followups[i].label || '').trim()) return String(followups[i].label).trim();
    }
    return 'Not specified';
  }

  function textOf(value) {
    var text = String(value == null ? '' : value).trim();
    return text || 'Not specified';
  }

  function scenarioLines(scenario) {
    if (!scenario) return [];
    return [
      { label: 'Event', value: textOf(scenario.event && scenario.event.label) },
      { label: 'Who', value: whoLabel(scenario) },
      { label: 'Change', value: textOf(scenario.change && scenario.change.label) },
      { label: 'Timing', value: textOf(scenario.timing && scenario.timing.label) },
      { label: 'Result', value: textOf(scenario.result && scenario.result.title) }
    ];
  }

  function scenarioSummary(scenario) {
    return scenarioLines(scenario).map(function (line) {
      return line.label + ': ' + line.value;
    }).join('\n');
  }

  function buildPayload(input) {
    input = input || {};
    var checked = validate(input.fields || {});
    var include = input.includeScenario === true && !!input.scenario;
    return {
      event: 'qe_question',
      name: checked.fields.name,
      email: checked.fields.email,
      phone: checked.fields.phone,
      company: checked.fields.company,
      question: checked.fields.question,
      includeScenario: include,
      scenarioSummary: include ? scenarioSummary(input.scenario) : '',
      scenario: include ? input.scenario : null,
      hp: clean(input.hp, 200),
      company_website: clean(input.company_website, 200),
      startedAt: input.startedAt || '',
      submittedAt: input.submittedAt || '',
      pageUrl: clean(input.pageUrl, 500)
    };
  }

  function esc(text) {
    return String(text == null ? '' : text)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function refresh() {
    if (typeof document === 'undefined') return;
    var box = document.getElementById('qeScenarioBox');
    if (!box) return;
    var scenario = window.QE && window.QE.scenario;
    var summary = document.getElementById('qeScenarioSummary');
    var include = document.getElementById('includeScenario');
    if (!scenario) {
      box.hidden = true;
      if (summary) summary.innerHTML = '';
      if (include) include.checked = false;
      if (box.dataset) delete box.dataset.ready;
      return;
    }
    if (summary) {
      summary.innerHTML = scenarioLines(scenario).map(function (line) {
        return '<div><dt>' + esc(line.label) + '</dt><dd>' + esc(line.value) + '</dd></div>';
      }).join('');
    }
    var wasHidden = !!box.hidden;
    box.hidden = false;
    if (include && (wasHidden || !box.dataset || box.dataset.ready !== '1')) include.checked = true;
    if (box.dataset) box.dataset.ready = '1';
  }

  function bind() {
    var form = document.getElementById('questionForm');
    if (!form || form.getAttribute('data-bound') === '1') return;
    form.setAttribute('data-bound', '1');
    var startedAt = Date.now();
    var inFlight = false;
    var banner = document.getElementById('questionBanner');
    var sendButton = document.getElementById('questionSend');
    var successCard = document.getElementById('questionSuccess');
    var successText = document.getElementById('questionSuccessText');

    function endpoint() {
      var value = typeof QE_QUESTION_ENDPOINT === 'string' ? QE_QUESTION_ENDPOINT.trim() : '';
      return value;
    }

    function showBanner(kind, message) {
      if (!banner) return;
      banner.hidden = false;
      banner.className = 'banner ' + kind;
      banner.textContent = message;
    }

    function clearErrors() {
      if (banner) {
        banner.hidden = true;
        banner.textContent = '';
        banner.className = 'banner';
      }
      Object.keys(FIELD_IDS).forEach(function (key) {
        var input = document.getElementById(FIELD_IDS[key]);
        var slot = document.getElementById('err_' + key);
        if (input) input.removeAttribute('aria-invalid');
        if (slot) slot.textContent = '';
      });
    }

    function showFieldErrors(errors) {
      errors.forEach(function (error) {
        var input = document.getElementById(FIELD_IDS[error.field]);
        var slot = document.getElementById('err_' + error.field);
        if (input) input.setAttribute('aria-invalid', 'true');
        if (slot) slot.textContent = error.message;
      });
      var first = document.getElementById(FIELD_IDS[errors[0].field]);
      if (first && first.focus) first.focus();
    }

    function readFields() {
      function value(id) {
        var node = document.getElementById(id);
        return node ? node.value : '';
      }
      return {
        name: value('qeName'),
        email: value('qeEmail'),
        phone: value('qePhone'),
        company: value('qeCompany'),
        question: value('qeQuestion')
      };
    }

    function pageUrl() {
      var url = String(window.location && window.location.href || '').split('#')[0];
      if (url.length > 500) url = url.slice(0, 500);
      return url;
    }

    function setSending(sending) {
      inFlight = sending;
      if (!sendButton) return;
      sendButton.disabled = sending;
      sendButton.textContent = sending ? 'Sending...' : 'Send question';
      sendButton.setAttribute('aria-busy', sending ? 'true' : 'false');
    }

    function showSuccess() {
      form.hidden = true;
      if (successCard) successCard.hidden = false;
      if (successText && successText.focus) successText.focus();
    }

    form.addEventListener('submit', function (event) {
      event.preventDefault();
      if (inFlight) return;
      clearErrors();
      var includeBox = document.getElementById('qeScenarioBox');
      var includeInput = document.getElementById('includeScenario');
      var hp = document.getElementById('company_website');
      var include = !!(includeBox && !includeBox.hidden && includeInput && includeInput.checked);
      var checked = validate(readFields());
      if (!checked.ok) {
        showFieldErrors(checked.errors);
        return;
      }
      var url = endpoint();
      if (!url) {
        showBanner('notice', 'This form is not connected yet. Call or text 407-476-5076, or email dan@dkbenefits.net.');
        return;
      }
      if (Date.now() - startedAt < MIN_ELAPSED_MS) {
        showBanner('notice', 'Please take a moment to review your question, then send it again.');
        return;
      }
      var record = buildPayload({
        fields: checked.fields,
        scenario: window.QE && window.QE.scenario,
        includeScenario: include,
        hp: hp ? hp.value : '',
        company_website: hp ? hp.value : '',
        startedAt: new Date(startedAt).toISOString(),
        submittedAt: new Date().toISOString(),
        pageUrl: pageUrl()
      });
      setSending(true);
      fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(record)
      }).then(function (response) {
        return response.json().catch(function () {
          return { ok: false, error: 'Your question could not be sent. Call or text 407-476-5076 or email dan@dkbenefits.net.' };
        });
      }).then(function (body) {
        setSending(false);
        if (body && body.ok === true && body.emailed === true) {
          showSuccess();
          return;
        }
        if (body && body.fields && body.fields.length) showFieldErrors(body.fields);
        showBanner('error', (body && body.error) || 'Your question could not be sent. Call or text 407-476-5076 or email dan@dkbenefits.net.');
      }).catch(function () {
        setSending(false);
        showBanner('error', 'Your question could not be sent. Call or text 407-476-5076 or email dan@dkbenefits.net.');
      });
    });

    refresh();
  }

  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bind);
    else bind();
  }

  return {
    MIN_ELAPSED_MS: MIN_ELAPSED_MS,
    validate: validate,
    scenarioLines: scenarioLines,
    scenarioSummary: scenarioSummary,
    buildPayload: buildPayload,
    refresh: refresh
  };
})();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = QEForm;
}
