(function () {
  var STEP_LABELS = ['Company', 'Plan year', 'Eligibility', 'Benefits', 'Create', 'Download'];
  var MONTHS = ['', 'January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  var step = 1;
  var startedAt = Date.now();
  var submissionId = '';
  var sessionId = (window.crypto && crypto.randomUUID) ? crypto.randomUUID() : ('s125-' + Date.now());
  var inFlight = false;
  var lastFiles = [];

  function $(id) { return document.getElementById(id); }
  function fieldValue(name) {
    var el = $(name);
    return el ? String(el.value || '').trim() : '';
  }
  function checked(name) {
    var el = document.querySelector('input[name="' + name + '"]:checked');
    return el ? el.value : '';
  }
  function checkedAll(name) {
    return Array.prototype.map.call(document.querySelectorAll('input[name="' + name + '"]:checked'), function (el) { return el.value; });
  }
  function embeddedFrame() {
    try { return window.self !== window.top; } catch (err) { return true; }
  }
  function documentOffsetTop(el) {
    var top = 0;
    var node = el;
    while (node) {
      top += node.offsetTop || 0;
      node = node.offsetParent;
    }
    return top;
  }
  function notifyParentScroll(el) {
    if (!el || !embeddedFrame()) return;
    window.parent.postMessage({ type: 's125-scroll', top: documentOffsetTop(el), step: step }, '*');
  }
  function readForm() {
    return {
      employer_name: fieldValue('employer_name'),
      employer_ein: fieldValue('employer_ein'),
      plan_number: fieldValue('plan_number'),
      street: fieldValue('street'),
      city: fieldValue('city'),
      state: fieldValue('state'),
      zip: fieldValue('zip'),
      phone: fieldValue('phone'),
      entity_type: checked('entity_type'),
      llc_tax: checked('llc_tax'),
      effective_date: fieldValue('effective_date'),
      plan_year_type: fieldValue('plan_year_type'),
      plan_year_start_month: fieldValue('plan_year_start_month'),
      plan_year_start_day: fieldValue('plan_year_start_day'),
      prior_plan: checked('prior_plan'),
      prior_adoption: fieldValue('prior_adoption'),
      plan_year_change: $('plan_year_change').checked ? 'yes' : 'no',
      oe_window_days: checked('oe_window_days'),
      new_hire_window: checked('new_hire_window'),
      employee_count: fieldValue('employee_count'),
      funding_type: checked('funding_type'),
      full_time_hours: fieldValue('full_time_hours'),
      waiting_period: fieldValue('waiting_period'),
      eligible_classes: checkedAll('eligible_classes'),
      eligible_class_other: fieldValue('eligible_class_other'),
      multi_state: checked('multi_state'),
      benefits: checkedAll('benefits'),
      health_fsa_design: checked('health_fsa_design'),
      health_fsa_unused: checked('health_fsa_unused'),
      dcap_unused: checked('dcap_unused'),
      signer_name: fieldValue('signer_name'),
      signer_title: fieldValue('signer_title'),
      signer_email: fieldValue('signer_email')
    };
  }
  function clearErrors() {
    document.querySelectorAll('.field-error').forEach(function (el) { el.textContent = ''; });
  }
  function showErrors(errors, only) {
    var allow = only ? {} : null;
    if (only) only.forEach(function (name) { allow[name] = true; });
    var first = null;
    errors.forEach(function (err) {
      if (allow && !allow[err.field]) return;
      var box = $('err_' + err.field);
      if (box) box.textContent = err.message;
      var input = $(err.field) || document.querySelector('[name="' + err.field + '"]');
      if (!first) first = input || box;
    });
    if (first) {
      if (first.scrollIntoView) first.scrollIntoView({ block: 'center', behavior: 'auto' });
      if (first.focus) first.focus({ preventScroll: true });
      notifyParentScroll(first);
    }
    return errors.some(function (err) { return !allow || allow[err.field]; });
  }
  function syncConditional() {
    var entity = checked('entity_type');
    document.querySelectorAll('.only-llc').forEach(function (el) {
      el.classList.toggle('hidden', entity !== 'llc');
    });
    if (entity !== 'llc') {
      document.querySelectorAll('input[name="llc_tax"]').forEach(function (el) { el.checked = false; });
    }
    var custom = fieldValue('plan_year_type') === 'custom';
    $('customYear').classList.toggle('hidden', !custom);
    var prior = checked('prior_plan') === 'yes';
    document.querySelectorAll('.only-prior').forEach(function (el) { el.classList.toggle('hidden', !prior); });
    if (!prior) $('plan_year_change').checked = false;
    var other = checkedAll('eligible_classes').indexOf('other') !== -1;
    document.querySelectorAll('.only-other').forEach(function (el) { el.classList.toggle('hidden', !other); });
    var benefits = checkedAll('benefits');
    var health = benefits.indexOf('health_fsa') !== -1;
    var dcap = benefits.indexOf('dcap') !== -1;
    var hsa = benefits.indexOf('hsa') !== -1;
    document.querySelectorAll('.only-health').forEach(function (el) { el.classList.toggle('hidden', !health); });
    document.querySelectorAll('.only-dcap').forEach(function (el) { el.classList.toggle('hidden', !dcap); });
    if (!health) {
      document.querySelectorAll('input[name="health_fsa_design"], input[name="health_fsa_unused"]').forEach(function (el) { el.checked = false; });
    }
    if (!dcap) {
      document.querySelectorAll('input[name="dcap_unused"]').forEach(function (el) { el.checked = false; });
    }
    var note = $('hsaNote');
    if (hsa && health && checked('health_fsa_design') === 'general') {
      note.textContent = 'You can offer both. An employee covered by this general-purpose Health FSA cannot contribute to an HSA. A limited-purpose FSA (dental, vision, and preventive care) or a post-deductible FSA leaves HSA eligibility in place.';
      note.classList.remove('hidden');
    } else if (hsa && health) {
      note.textContent = 'HSA salary-reduction elections can be changed at least monthly. Limited-purpose coverage is dental, vision, and preventive care.';
      note.classList.remove('hidden');
    } else {
      note.textContent = '';
      note.classList.add('hidden');
    }
    var result = S125Model.validate(readForm(), { asOf: S125Model.todayIso() });
    var short = $('shortYearNote');
    if (result.plan.short_plan_year) {
      short.textContent = 'This is a short first plan year, from ' + S125Model.formatLongDate(result.plan.effective_date) + ' through ' + S125Model.formatLongDate(result.plan.short_plan_year_end) + '.';
      short.classList.remove('hidden');
    } else if (result.plan.prior_plan && result.plan.effective_date) {
      short.textContent = 'This restatement keeps the existing plan year. It is not marked as a new short year.';
      short.classList.remove('hidden');
    } else {
      short.classList.add('hidden');
    }
    fillDays();
  }
  function fillDays() {
    var month = Number(fieldValue('plan_year_start_month'));
    var days = [0, 31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month] || 31;
    var select = $('plan_year_start_day');
    var current = select.value;
    select.innerHTML = '<option value="">Day</option>';
    for (var d = 1; d <= days; d++) {
      var option = document.createElement('option');
      option.value = String(d);
      option.textContent = String(d);
      select.appendChild(option);
    }
    if (current && Number(current) <= days) select.value = current;
  }
  function renderProgress() {
    var list = $('progressList');
    list.innerHTML = '';
    STEP_LABELS.forEach(function (label, index) {
      var li = document.createElement('li');
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.innerHTML = '<span class="step-index">Step ' + (index + 1) + '</span> <span class="step-name">' + label + '</span>';
      if (index + 1 === step) btn.setAttribute('aria-current', 'step');
      btn.disabled = index + 1 > step || step === 6;
      btn.addEventListener('click', function () { if (index + 1 < step) showStep(index + 1); });
      li.appendChild(btn);
      list.appendChild(li);
    });
  }
  function showStep(next, options) {
    var allowScroll = !options || options.scroll !== false;
    step = next;
    document.querySelectorAll('[data-step]').forEach(function (section) {
      section.classList.toggle('hidden', Number(section.getAttribute('data-step')) !== step);
    });
    document.querySelectorAll('h2[id="stepTitle"]').forEach(function (heading) { heading.removeAttribute('id'); });
    var heading = document.querySelector('[data-step="' + step + '"] h2');
    if (heading) {
      heading.id = 'stepTitle';
      heading.setAttribute('tabindex', '-1');
      if (allowScroll && heading.focus) heading.focus({ preventScroll: true });
    }
    $('btnBack').classList.toggle('hidden', step === 1 || step === 6);
    $('btnNext').textContent = step === 5 ? 'Create documents' : 'Continue';
    $('btnNext').classList.toggle('hidden', step === 6);
    renderProgress();
    syncConditional();
    if (step === 5) renderReview();
    if (!allowScroll) return;
    var target = heading || document.querySelector('[data-step="' + step + '"]');
    if (embeddedFrame()) {
      if (target && target.scrollIntoView) target.scrollIntoView({ block: 'start', behavior: 'auto' });
      notifyParentScroll(target);
    } else {
      window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
    }
  }
  function validateCurrent() {
    clearErrors();
    var result = S125Model.validate(readForm(), { asOf: S125Model.todayIso() });
    return !showErrors(result.errors, S125Model.stepFields(step));
  }
  function renderReview() {
    var result = S125Model.validate(readForm(), { asOf: S125Model.todayIso() });
    var plan = result.plan;
    var benefits = (plan.benefits || []).map(S125Model.benefitLabel).join(', ') || '—';
    $('reviewSummary').innerHTML = '<section><h3>Plan</h3><dl>' +
      '<dt>Employer</dt><dd>' + escapeHtml(plan.employer_name) + '</dd>' +
      '<dt>Effective</dt><dd>' + escapeHtml(S125Model.formatLongDate(plan.effective_date)) + '</dd>' +
      '<dt>Plan year</dt><dd>' + escapeHtml(S125Model.planYearSentence(plan)) + '</dd>' +
      '<dt>Benefits</dt><dd>' + escapeHtml(benefits) + '</dd>' +
      '<dt>Eligible class</dt><dd>' + escapeHtml(S125Model.classSentence(plan)) + '</dd>' +
      '</dl></section>';
  }
  function escapeHtml(value) {
    return String(value == null ? '' : value).replace(/[&<>"]/g, function (ch) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[ch];
    });
  }
  function shouldPost() {
    var cfg = window.S125_CONFIG || {};
    if (!cfg.endpoint) return false;
    var params = new URLSearchParams(location.search);
    if (params.get('live') === '0') return false;
    if (params.get('live') === '1') return true;
    if (window.__s125Live === true) return true;
    return location.hostname === 'dankirves-prog.github.io';
  }
  function bytesToBase64(bytes) {
    var view = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
    var binary = '';
    var chunk = 0x8000;
    for (var i = 0; i < view.length; i += chunk) binary += String.fromCharCode.apply(null, view.subarray(i, i + chunk));
    return btoa(binary);
  }
  function bytesToBlob(bytes, mime) {
    var copy = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
    return new Blob([copy], { type: mime });
  }
  function triggerDownload(bytes, name, mime) {
    var url = URL.createObjectURL(bytesToBlob(bytes, mime));
    var link = document.createElement('a');
    link.href = url;
    link.download = name;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  }
  function showDownloads(files) {
    var list = $('downloadList');
    list.innerHTML = '';
    files.forEach(function (file) {
      var button = document.createElement('button');
      button.type = 'button';
      button.className = 'btn-secondary';
      button.textContent = 'Download ' + file.name;
      button.addEventListener('click', function () { triggerDownload(file.bytes, file.name, file.mime); });
      list.appendChild(button);
    });
  }
  function buildFiles(plan) {
    var docx = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    return [
      { name: S125Docgen.planFileName(plan), mime: docx, bytes: S125Docgen.buildPlanDocx(plan) },
      { name: S125Docgen.guideFileName(plan), mime: docx, bytes: S125Docgen.buildGuideDocx(plan) }
    ];
  }
  function pdfFiles(plan) {
    var jobs = [
      { rows: S125Docgen.planParagraphs(plan), name: S125Docgen.pdfFileName(S125Docgen.planFileName(plan)), title: plan.plan_name },
      { rows: S125Docgen.guideParagraphs(plan), name: S125Docgen.pdfFileName(S125Docgen.guideFileName(plan)), title: 'Section 125 implementation checklist' }
    ];
    return Promise.all(jobs.map(function (job) {
      return S125Pdf.buildPdf(job.rows, { title: job.title, footer: job.title }).then(function (bytes) {
        return { name: job.name, mime: 'application/pdf', bytes: bytes };
      });
    }));
  }
  function payloadFrom(result, id, files) {
    return {
      event: 's125_submission',
      submissionId: id,
      sessionId: sessionId,
      startedAt: new Date(startedAt).toISOString(),
      submittedAt: new Date().toISOString(),
      pageUrl: location.href,
      templateVersion: S125Model.TEMPLATE_VERSION,
      test: new URLSearchParams(location.search).get('test') === '1',
      hp: fieldValue('company_website'),
      lead: result.lead,
      plan: result.plan,
      review: result.review,
      acknowledgement: { accepted: true, acceptedAt: new Date().toISOString(), termsVersion: S125Terms.VERSION },
      sendVisitorCopy: true,
      files: files.map(function (file) {
        return { name: file.name, mime: file.mime, dataBase64: bytesToBase64(file.bytes) };
      })
    };
  }
  function setStatus(html) { $('emailStatus').innerHTML = html; }
  function finishGenerate() {
    if (inFlight) return;
    clearErrors();
    var result = S125Model.validate(readForm(), { asOf: S125Model.todayIso() });
    if (!result.ok) {
      showErrors(result.errors);
      showStep(1);
      return;
    }
    if (!$('terms_ack').checked) {
      $('err_terms_ack').textContent = 'Agree to the Terms of use before the documents can be created.';
      if (step !== 5) showStep(5);
      var termsBox = $('terms_ack');
      if (termsBox.scrollIntoView) termsBox.scrollIntoView({ block: 'center', behavior: 'auto' });
      if (termsBox.focus) termsBox.focus({ preventScroll: true });
      notifyParentScroll(termsBox);
      return;
    }
    var id = submissionId || ((window.crypto && crypto.randomUUID) ? crypto.randomUUID() : ('s125-' + Date.now()));
    submissionId = id;
    lastFiles = buildFiles(result.plan);
    showStep(6);
    showDownloads(lastFiles);
    lastFiles.forEach(function (file) {
      if (/\.docx$/i.test(file.name)) triggerDownload(file.bytes, file.name, file.mime);
    });
    inFlight = true;
    setStatus('Preparing your documents…');
    pdfFiles(result.plan).then(function (pdfs) {
      var all = lastFiles.concat(pdfs);
      lastFiles = all;
      showDownloads(all);
      if (!shouldPost()) {
        inFlight = false;
        setStatus('<strong>Your documents are ready to download.</strong> Email delivery is not turned on for this copy of the page.');
        return;
      }
      var cfg = window.S125_CONFIG || {};
      return fetch(cfg.endpoint, { method: 'POST', body: JSON.stringify(payloadFrom(result, id, all)) })
        .then(function (response) { return response.json(); })
        .then(function (body) {
          inFlight = false;
          if (body && body.ok) {
            setStatus('<strong>Your documents are ready to download.</strong> A short note will come to your email shortly.');
          } else {
            $('btnRetry').classList.remove('hidden');
            setStatus('<strong>The request could not be sent.</strong> You can still download the documents below.');
          }
        });
    }).catch(function () {
      inFlight = false;
      $('btnRetry').classList.remove('hidden');
      setStatus(shouldPost()
        ? '<strong>The request could not be sent.</strong> You can still download the documents below.'
        : '<strong>The PDF could not be prepared.</strong> The Word files are still available below.');
    });
  }
  function mountTerms() {
    $('termsDialogBody').innerHTML = S125Terms.PARAGRAPHS.map(function (p) { return '<p>' + escapeHtml(p) + '</p>'; }).join('');
    $('openTerms').addEventListener('click', function (event) {
      event.preventDefault();
      if ($('termsDialog').showModal) $('termsDialog').showModal();
    });
    $('closeTerms').addEventListener('click', function () { $('termsDialog').close(); });
  }
  function init() {
    var state = $('state');
    S125Model.US_STATES.forEach(function (code) {
      var option = document.createElement('option');
      option.value = code;
      option.textContent = code;
      state.appendChild(option);
    });
    var month = $('plan_year_start_month');
    month.innerHTML = '<option value="">Month</option>';
    for (var m = 1; m <= 12; m++) {
      var opt = document.createElement('option');
      opt.value = String(m);
      opt.textContent = MONTHS[m];
      month.appendChild(opt);
    }
    fillDays();
    if (window.S125Tips) S125Tips.mount();
    mountTerms();
    $('employer_ein').addEventListener('input', function () { $('employer_ein').value = S125Model.formatEinLive($('employer_ein').value); });
    $('phone').addEventListener('input', function () { $('phone').value = S125Model.formatPhoneLive($('phone').value); });
    $('wizard').addEventListener('change', syncConditional);
    $('wizard').addEventListener('input', syncConditional);
    month.addEventListener('change', fillDays);
    $('btnNext').addEventListener('click', function () {
      if (step < 5) {
        if (!validateCurrent()) return;
        showStep(step + 1);
        return;
      }
      if (step === 5) finishGenerate();
    });
    $('btnBack').addEventListener('click', function () { if (step > 1 && step < 6) showStep(step - 1); });
    $('btnRetry').addEventListener('click', finishGenerate);
    showStep(1, { scroll: false });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
