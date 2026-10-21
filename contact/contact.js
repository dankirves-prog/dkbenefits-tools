/**
 * DK Benefits contact form.
 * The Apps Script URL is CONTACT_ENDPOINT in config.js. Do not put it here.
 */
(function () {
  var STARTED_KEY = 'dkbContactStartedAt';
  var VISITOR_KEY = 'dkbContactVisitorId';
  var MIN_ELAPSED_MS = 3000;
  var startedAt = readStartedAt();
  var visitorId = readVisitorId();
  var submissionId = '';
  var inFlight = false;

  var form = document.getElementById('contactForm');
  var formCard = document.getElementById('formCard');
  var successCard = document.getElementById('successCard');
  var banner = document.getElementById('formBanner');
  var sendButton = document.getElementById('sendButton');
  var successText = document.getElementById('successText');

  window.scrollTo(0, 0);

  form.addEventListener('submit', onSubmit);
  document.getElementById('phone').addEventListener('blur', function () {
    var formatted = ContactModel.formatPhone(this.value);
    if (formatted && formatted !== this.value && ContactModel.formatPhone(this.value).indexOf('(') === 0) {
      this.value = formatted;
    }
  });
  ['firstName', 'lastName', 'company', 'email', 'phone', 'message'].forEach(function (name) {
    document.getElementById(name).addEventListener('input', function () {
      clearField(name);
    });
  });

  function readStartedAt() {
    var stored = 0;
    try { stored = Number(sessionStorage.getItem(STARTED_KEY) || '0'); } catch (err) { stored = 0; }
    if (!stored || !isFinite(stored) || stored > Date.now() || Date.now() - stored > 12 * 60 * 60 * 1000) {
      stored = Date.now();
      try { sessionStorage.setItem(STARTED_KEY, String(stored)); } catch (err) {}
    }
    return stored;
  }

  function readVisitorId() {
    var stored = '';
    try { stored = sessionStorage.getItem(VISITOR_KEY) || ''; } catch (err) { stored = ''; }
    if (!/^[A-Za-z0-9-]{8,80}$/.test(stored)) {
      stored = newId();
      try { sessionStorage.setItem(VISITOR_KEY, stored); } catch (err) {}
    }
    return stored;
  }

  function newId() {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (ch) {
      var r = Math.random() * 16 | 0;
      var v = ch === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }

  function configuredEndpoint() {
    var value = String(window.CONTACT_ENDPOINT || '').trim();
    if (!/^https:\/\/script\.google\.com\/macros\/s\/[A-Za-z0-9_-]+\/exec$/.test(value)) return '';
    return value;
  }

  function fieldValue(id) {
    var el = document.getElementById(id);
    return el ? el.value : '';
  }

  function readLead() {
    return {
      firstName: fieldValue('firstName'),
      lastName: fieldValue('lastName'),
      company: fieldValue('company'),
      email: fieldValue('email'),
      phone: fieldValue('phone'),
      message: fieldValue('message')
    };
  }

  function clearField(name) {
    var box = document.getElementById('err_' + name);
    var input = document.getElementById(name);
    if (box) box.textContent = '';
    if (input) input.removeAttribute('aria-invalid');
  }

  function clearErrors() {
    ['firstName', 'lastName', 'company', 'email', 'phone', 'message'].forEach(clearField);
    hideBanner();
  }

  function hideBanner() {
    banner.hidden = true;
    banner.className = 'banner';
    banner.textContent = '';
  }

  function showBanner(kind, text) {
    banner.className = 'banner ' + kind;
    banner.textContent = text;
    banner.hidden = false;
  }

  function focusControl(el) {
    if (!el || !el.focus) return;
    try { el.focus({ preventScroll: true }); } catch (err) {
      try { el.focus(); } catch (ignore) {}
    }
  }

  function showFieldErrors(errors) {
    var first = null;
    errors.forEach(function (err) {
      var box = document.getElementById('err_' + err.field);
      var input = document.getElementById(err.field);
      if (box) box.textContent = err.message;
      if (input) {
        input.setAttribute('aria-invalid', 'true');
        if (!first) first = input;
      }
    });
    showBanner('error', 'Please check the highlighted fields.');
    focusControl(first || banner);
  }

  function testMode() {
    try {
      return /(?:\?|&)test=1(?:&|$)/.test(window.location.search);
    } catch (err) {
      return false;
    }
  }

  function pageUrl() {
    var url = String(window.location.href || '').split('#')[0];
    if (url.length > 500) url = url.slice(0, 500);
    return url;
  }

  function setSending(sending) {
    inFlight = sending;
    sendButton.disabled = sending;
    sendButton.textContent = sending ? 'Sending...' : 'Send Message';
    sendButton.setAttribute('aria-busy', sending ? 'true' : 'false');
  }

  function showSuccess() {
    formCard.hidden = true;
    successCard.hidden = false;
    focusControl(successText);
    window.scrollTo(0, 0);
  }

  function onSubmit(event) {
    event.preventDefault();
    if (inFlight) return;
    clearErrors();
    var checked = ContactModel.validate(readLead());
    if (!checked.ok) {
      showFieldErrors(checked.errors);
      return;
    }
    if (Date.now() - startedAt < MIN_ELAPSED_MS) {
      showBanner('notice', 'Please take a moment to review your message, then send it again.');
      return;
    }
    var endpoint = configuredEndpoint();
    if (!endpoint) {
      showBanner('notice', 'This form is not connected yet. Call or text me at 407-476-5076, or email dan@dkbenefits.net.');
      return;
    }
    if (!submissionId) submissionId = newId();
    var record = {
      event: 'contact_submission',
      submissionId: submissionId,
      visitorId: visitorId,
      startedAt: new Date(startedAt).toISOString(),
      submittedAt: new Date().toISOString(),
      pageUrl: pageUrl(),
      test: testMode(),
      hp: fieldValue('company_website'),
      lead: checked.lead
    };
    setSending(true);
    fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(record)
    }).then(function (response) {
      return response.json().catch(function () { return { ok: false, error: 'The form could not read a response.' }; });
    }).then(function (body) {
      setSending(false);
      if (body && body.ok === true && body.leadEmailed === true) {
        submissionId = '';
        showSuccess();
        return;
      }
      if (body && body.fields && body.fields.length) showFieldErrors(body.fields);
      showBanner('error', (body && body.error) || 'Your message could not be sent. Call or text 407-476-5076 or email dan@dkbenefits.net.');
    }).catch(function () {
      setSending(false);
      showBanner('error', 'Your message could not be sent. Call or text 407-476-5076 or email dan@dkbenefits.net.');
    });
  }
})();
