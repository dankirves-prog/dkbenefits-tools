(function () {
  var STATE_NAMES = {
    AL: 'Alabama', AK: 'Alaska', AZ: 'Arizona', AR: 'Arkansas', CA: 'California', CO: 'Colorado',
    CT: 'Connecticut', DE: 'Delaware', DC: 'District of Columbia', FL: 'Florida', GA: 'Georgia',
    HI: 'Hawaii', ID: 'Idaho', IL: 'Illinois', IN: 'Indiana', IA: 'Iowa', KS: 'Kansas', KY: 'Kentucky',
    LA: 'Louisiana', ME: 'Maine', MD: 'Maryland', MA: 'Massachusetts', MI: 'Michigan', MN: 'Minnesota',
    MS: 'Mississippi', MO: 'Missouri', MT: 'Montana', NE: 'Nebraska', NV: 'Nevada', NH: 'New Hampshire',
    NJ: 'New Jersey', NM: 'New Mexico', NY: 'New York', NC: 'North Carolina', ND: 'North Dakota',
    OH: 'Ohio', OK: 'Oklahoma', OR: 'Oregon', PA: 'Pennsylvania', RI: 'Rhode Island', SC: 'South Carolina',
    SD: 'South Dakota', TN: 'Tennessee', TX: 'Texas', UT: 'Utah', VT: 'Vermont', VA: 'Virginia',
    WA: 'Washington', WV: 'West Virginia', WI: 'Wisconsin', WY: 'Wyoming'
  };
  var STEP_LABELS = ['Company', 'Design', 'Administration', 'Check', 'Download'];
  var step = 1;
  var startedAt = Date.now();
  var sessionId = loadSessionId();
  var submissionId = null;
  var inFlight = false;
  var planNameTouched = false;
  var lastFiles = null;
  var utm = readUtm();

  function $(id) { return document.getElementById(id); }
  function loadSessionId() {
    try {
      var existing = sessionStorage.getItem('dkb_s128_session');
      if (existing) return existing;
      var id = (window.crypto && crypto.randomUUID) ? crypto.randomUUID() : String(Date.now());
      sessionStorage.setItem('dkb_s128_session', id);
      return id;
    } catch (err) {
      return String(Date.now());
    }
  }
  function readUtm() {
    var params = new URLSearchParams(location.search);
    var keys = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content'];
    var out = {};
    keys.forEach(function (key) {
      var value = params.get(key) || '';
      value = value.replace(/[^A-Za-z0-9._-]/g, '').slice(0, 80);
      if (value) out[key] = value;
    });
    return out;
  }
  function checked(name) {
    var el = document.querySelector('input[name="' + name + '"]:checked');
    return el ? el.value : '';
  }
  function fieldValue(id) {
    var el = $(id);
    return el ? el.value : '';
  }
  function readForm() {
    return {
      employer_name: fieldValue('employer_name'),
      employer_ein: fieldValue('employer_ein'),
      street: fieldValue('street'),
      city: fieldValue('city'),
      state: fieldValue('state'),
      zip: fieldValue('zip'),
      contact_name: fieldValue('contact_name'),
      contact_title: fieldValue('contact_title'),
      contact_email: fieldValue('contact_email'),
      contact_phone: fieldValue('contact_phone'),
      total_employee_count: fieldValue('total_employee_count'),
      funding_mode: checked('funding_mode'),
      employer_annual_grant: fieldValue('employer_annual_grant'),
      annual_cap_mode: checked('annual_cap_mode'),
      fixed_annual_cap: fieldValue('fixed_annual_cap'),
      allow_employee_account: checked('allow_employee_account'),
      eligibility_class_choice: checked('eligibility_class_choice'),
      eligibility_class_other: fieldValue('eligibility_class_other'),
      waiting_days: fieldValue('waiting_days'),
      plan_name: fieldValue('plan_name'),
      effective_date: fieldValue('effective_date'),
      participating_employers: fieldValue('participating_employers'),
      entity_type: fieldValue('entity_type'),
      related_businesses: fieldValue('related_businesses'),
      owners_or_family_want_to_participate: fieldValue('owners_or_family_want_to_participate'),
      collectively_bargained_employees: fieldValue('collectively_bargained_employees'),
      has_existing_125_plan: fieldValue('has_existing_125_plan'),
      administrator_name: fieldValue('administrator_name'),
      administrator_contact: fieldValue('administrator_contact'),
      signer_name: fieldValue('signer_name'),
      signer_title: fieldValue('signer_title'),
      cafeteria_plan_name: fieldValue('cafeteria_plan_name'),
      cafeteria_amendment_date: fieldValue('cafeteria_amendment_date'),
      election_cutoff_days: fieldValue('election_cutoff_days')
    };
  }
  function clearErrors() {
    document.querySelectorAll('.field-error').forEach(function (el) { el.textContent = ''; });
    document.querySelectorAll('[aria-invalid="true"]').forEach(function (el) { el.removeAttribute('aria-invalid'); });
  }
  function clearFieldError(name) {
    if (!name) return;
    var box = $('err_' + name);
    if (box) box.textContent = '';
    var input = $(name);
    if (input) input.removeAttribute('aria-invalid');
    document.querySelectorAll('[name="' + name + '"]').forEach(function (el) { el.removeAttribute('aria-invalid'); });
  }
  function showErrors(errors, only) {
    var allow = only ? {} : null;
    if (only) only.forEach(function (name) { allow[name] = true; });
    var first = null;
    errors.forEach(function (err) {
      if (allow && !allow[err.field]) return;
      var box = $('err_' + err.field);
      if (box) box.textContent = err.message;
      var input = $(err.field);
      if (input && input.matches && input.matches('input, select, textarea')) input.setAttribute('aria-invalid', 'true');
      if (!first) first = input || box;
    });
    if (first && first.focus) first.focus();
    return errors.some(function (err) { return !allow || allow[err.field]; });
  }
  function fundingMode() { return checked('funding_mode'); }
  function syncConditional() {
    var mode = fundingMode();
    var salary = mode === 'salary_reduction_only' || mode === 'combined';
    var grant = mode === 'employer_only' || mode === 'combined';
    document.querySelectorAll('.only-salary').forEach(function (el) { el.classList.toggle('hidden', !salary); });
    document.querySelectorAll('.only-grant').forEach(function (el) { el.classList.toggle('hidden', !grant); });
    document.querySelectorAll('.only-fixed').forEach(function (el) {
      el.classList.toggle('hidden', checked('annual_cap_mode') !== 'fixed');
    });
    document.querySelectorAll('.only-other').forEach(function (el) {
      el.classList.toggle('hidden', checked('eligibility_class_choice') !== 'other');
    });
    var existingPlan = fieldValue('has_existing_125_plan');
    var confirmedPlan = salary && existingPlan === 'yes';
    var missingPlan = salary && (existingPlan === 'no' || existingPlan === 'unsure');
    document.querySelectorAll('.only-cafeteria').forEach(function (el) {
      el.classList.toggle('hidden', !confirmedPlan);
    });
    ['cafeteriaMissing', 'cafeteriaMissingAdmin'].forEach(function (id) {
      var note = $(id);
      if (note) note.classList.toggle('hidden', !missingPlan);
    });
    if (!confirmedPlan) {
      clearFieldError('cafeteria_plan_name');
      clearFieldError('cafeteria_amendment_date');
    }
    var result = S128Model.validate(readForm(), { asOf: S128Model.todayIso() });
    var note = $('capacityNote');
    var message = result.ok || result.plan.funding_mode ? S128Model.capacityMessage(result.plan) : '';
    if (salary && message && !result.errors.some(function (e) { return e.field === 'employer_annual_grant' || e.field === 'fixed_annual_cap' || e.field === 'annual_cap_mode' || e.field === 'effective_date'; })) {
      note.textContent = message;
      note.classList.remove('hidden');
    } else {
      note.textContent = '';
      note.classList.add('hidden');
    }
  }
  function suggestName() {
    if (planNameTouched) return;
    var suggested = S128Model.suggestPlanName(fieldValue('employer_name'));
    if (suggested) $('plan_name').value = suggested;
  }
  function fillStates() {
    var select = $('state');
    S128Model.US_STATES.forEach(function (code) {
      var option = document.createElement('option');
      option.value = code;
      option.textContent = STATE_NAMES[code] || code;
      select.appendChild(option);
    });
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
      btn.disabled = index + 1 > step || step === 5;
      btn.addEventListener('click', function () {
        if (index + 1 < step) go(index + 1);
      });
      li.appendChild(btn);
      list.appendChild(li);
    });
  }
  function showStep(next) {
    step = next;
    document.querySelectorAll('[data-step]').forEach(function (section) {
      section.classList.toggle('hidden', Number(section.getAttribute('data-step')) !== step);
    });
    document.querySelectorAll('h2[id="stepTitle"]').forEach(function (heading) {
      heading.removeAttribute('id');
    });
    var heading = document.querySelector('[data-step="' + step + '"] h2');
    if (heading) {
      heading.id = 'stepTitle';
      heading.setAttribute('tabindex', '-1');
      heading.focus();
    }
    $('btnBack').classList.toggle('hidden', step === 1);
    $('btnNext').textContent = step === 4 ? 'Create documents' : 'Continue';
    $('btnNext').classList.toggle('hidden', step === 5);
    renderProgress();
    syncConditional();
  }
  function go(next) {
    if (next === 4) renderReview();
    showStep(next);
  }
  function validateCurrent() {
    clearErrors();
    var result = S128Model.validate(readForm(), { asOf: S128Model.todayIso() });
    var fields = S128Model.stepFields(step);
    var blocked = showErrors(result.errors, fields);
    return !blocked;
  }
  function renderReview() {
    var result = S128Model.validate(readForm(), { asOf: S128Model.todayIso() });
    var flags = $('reviewFlags');
    if (result.review.required) {
      flags.innerHTML = '<div class="review-flag"><h3>A few items to look at</h3><ul>' +
        result.review.reasons.map(function (reason) { return '<li>' + escapeHtml(reason) + '</li>'; }).join('') +
        '</ul></div>';
    } else {
      flags.innerHTML = '<div class="clean-note"><strong>Ready to create your documents.</strong> The signature and date stay blank until your company signs.</div>';
    }
    var plan = result.plan;
    var lead = result.lead;
    var cap = S128Model.capacityMessage(plan);
    $('reviewSummary').innerHTML = [
      block('Company', 1, [
        ['Legal name', plan.employer_name],
        ['EIN', plan.employer_ein],
        ['Address', plan.employer_address],
        ['State', plan.state],
        ['Employees', lead.total_employee_count],
        ['Contact', [lead.contact_name, lead.contact_title, lead.contact_email, lead.contact_phone].filter(Boolean).join(' · ')],
        ['Entity', S128Model.entityLabel(lead.entity_type)]
      ]),
      block('Design', 2, [
        ['Program', plan.plan_name],
        ['Effective date', S128Model.formatLongDate(plan.effective_date)],
        ['Funding', S128Model.fundingLabel(plan.funding_mode)],
        ['Employer grant', plan.employer_annual_grant ? S128Model.formatMoney(plan.employer_annual_grant) : 'None'],
        ['Annual cap', S128Model.capText(plan)],
        ['Salary reduction room', cap || 'Not used'],
        ['Eligible class', plan.eligibility_class],
        ['Waiting period', plan.waiting_days === 0 ? 'Eligible on hire' : plan.waiting_days + ' days'],
        ['Other employers', (plan.participating_employers || []).join('; ') || 'None']
      ]),
      block('Administration', 3, [
        ['Administrator', plan.administrator_name],
        ['Administrator contact', plan.administrator_contact],
        ['Representative', plan.signer_name + (plan.signer_title ? ', ' + plan.signer_title : '')],
        ['Section 125 plan', !S128Model.fundingUsesSalary(plan.funding_mode) ? 'Not used' : (plan.cafeteria_plan_name || 'Not confirmed. A cafeteria plan must be adopted or confirmed before salary reduction can start.')],
        ['Amendment', !S128Model.fundingUsesSalary(plan.funding_mode) ? 'Not used' : (plan.cafeteria_plan_name ? S128Model.formatLongDate(plan.cafeteria_amendment_date) : 'Not prepared')],
        ['Processing notice', plan.election_cutoff_days == null ? 'Not used' : plan.election_cutoff_days + ' days']
      ])
    ].join('');
    $('reviewSummary').querySelectorAll('[data-edit]').forEach(function (btn) {
      btn.addEventListener('click', function () { go(Number(btn.getAttribute('data-edit'))); });
    });
  }
  function block(title, stepNo, rows) {
    var body = rows.map(function (row) {
      return '<dt>' + escapeHtml(row[0]) + '</dt><dd>' + escapeHtml(row[1] == null ? '' : row[1]) + '</dd>';
    }).join('');
    return '<section><h3>' + escapeHtml(title) + ' <button type="button" class="linkish" data-edit="' + stepNo + '">Edit</button></h3><dl>' + body + '</dl></section>';
  }
  function escapeHtml(value) {
    return String(value == null ? '' : value).replace(/[&<>"]/g, function (ch) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[ch];
    });
  }
  function shouldPost() {
    var cfg = window.S128_CONFIG || {};
    if (!cfg.endpoint) return false;
    var params = new URLSearchParams(location.search);
    if (params.get('live') === '0') return false;
    if (params.get('live') === '1') return true;
    if (window.__s128Live === true) return true;
    return location.hostname === 'dankirves-prog.github.io';
  }
  function newSubmissionId() {
    submissionId = (window.crypto && crypto.randomUUID) ? crypto.randomUUID() : ('s128-' + Date.now());
    return submissionId;
  }
  function pendingKey(id) { return 'dkb_s128_pending_' + id; }
  function savePending(record) {
    try {
      var stored = Object.assign({}, record);
      delete stored.files;
      localStorage.setItem(pendingKey(record.submissionId), JSON.stringify(stored));
      localStorage.setItem('dkb_s128_pending_latest', record.submissionId);
    } catch (err) {}
  }
  function clearPending(id) {
    try {
      localStorage.removeItem(pendingKey(id));
      if (localStorage.getItem('dkb_s128_pending_latest') === id) localStorage.removeItem('dkb_s128_pending_latest');
    } catch (err) {}
  }
  function payloadFrom(result, id) {
    return {
      event: 's128_submission',
      submissionId: id,
      sessionId: sessionId,
      startedAt: new Date(startedAt).toISOString(),
      submittedAt: new Date().toISOString(),
      pageUrl: location.href,
      templateVersion: S128Model.TEMPLATE_VERSION,
      test: new URLSearchParams(location.search).get('test') === '1',
      hp: fieldValue('company_website'),
      utm: utm,
      lead: result.lead,
      plan: result.plan,
      review: result.review,
      acknowledgement: {
        accepted: true,
        acceptedAt: new Date().toISOString(),
        termsVersion: S128Terms.VERSION
      },
      sendVisitorCopy: true
    };
  }
  function bytesToBase64(bytes) {
    var view = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
    var binary = '';
    var chunk = 0x8000;
    for (var i = 0; i < view.length; i += chunk) {
      binary += String.fromCharCode.apply(null, view.subarray(i, i + chunk));
    }
    return btoa(binary);
  }
  function filesPayload(files) {
    return files.map(function (file) {
      return { name: file.name, mime: file.mime, dataBase64: bytesToBase64(file.bytes) };
    });
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
    setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
  }
  function addDownload(bytes, name, mime, label) {
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'btn-gold';
    btn.textContent = label;
    btn.addEventListener('click', function () { triggerDownload(bytes, name, mime); });
    $('downloadList').appendChild(btn);
  }
  function buildFiles(plan) {
    var files = [];
    var planName = S128Docgen.planFileName(plan);
    var planBytes = S128Docgen.buildPlanDocx(plan);
    files.push({ name: planName, bytes: planBytes, mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', label: 'Download Word plan' });
    var amendment = S128Docgen.buildAmendmentDocx(plan);
    if (amendment) {
      files.push({
        name: S128Docgen.amendmentFileName(plan),
        bytes: amendment,
        mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        label: 'Download Section 125 amendment (Word)'
      });
    }
    files.push({
      name: S128Docgen.guideFileName(plan),
      bytes: S128Docgen.buildGuideDocx(plan),
      mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      label: 'Download implementation guide (Word)'
    });
    return files;
  }
  function showDownloads(files) {
    $('downloadList').innerHTML = '';
    files.forEach(function (file) { addDownload(file.bytes, file.name, file.mime, file.label); });
  }
  function pdfFiles(plan) {
    var jobs = [{
      promise: S128Pdf.buildPdf(S128Docgen.planParagraphs(plan), { title: plan.plan_name }),
      name: S128Docgen.pdfFileName(S128Docgen.planFileName(plan)),
      label: 'Download PDF plan'
    }];
    var amendmentRows = S128Docgen.amendmentParagraphs(plan);
    if (amendmentRows) {
      jobs.push({
        promise: S128Pdf.buildPdf(amendmentRows, { title: 'Amendment' }),
        name: S128Docgen.pdfFileName(S128Docgen.amendmentFileName(plan)),
        label: 'Download Section 125 amendment (PDF)'
      });
    }
    jobs.push({
      promise: S128Pdf.buildPdf(S128Docgen.guideParagraphs(plan), { title: 'Section 128 implementation guide' }),
      name: S128Docgen.pdfFileName(S128Docgen.guideFileName(plan)),
      label: 'Download implementation guide (PDF)'
    });
    return Promise.all(jobs.map(function (job) {
      return job.promise.then(function (bytes) {
        return { name: job.name, bytes: bytes, mime: 'application/pdf', label: job.label };
      });
    })).catch(function () { return []; });
  }
  function notePdfMissing() {
    var note = document.createElement('p');
    note.className = 'hint';
    note.textContent = 'A matching PDF could not be created in this browser. Use the Word file.';
    $('downloadList').appendChild(note);
  }
  function setStatus(kind, html) {
    var box = $('emailStatus');
    box.className = 'status ' + kind;
    box.innerHTML = html;
  }
  function phoneLine() {
    var cfg = window.S128_CONFIG || {};
    return '<a href="tel:' + (cfg.phoneTel || '4074765076') + '">' + (cfg.phoneDisplay || '407-476-5076') + '</a>';
  }
  function showEmailResult(body, errorText) {
    $('btnRetry').classList.add('hidden');
    if (!shouldPost()) {
      setStatus('neutral', '<strong>Your documents are ready to download.</strong>');
      return;
    }
    if (body && body.ok === true && body.leadEmailed === true && body.visitorEmailed === true) {
      var already = body.duplicate === true;
      setStatus(already ? 'duplicate' : 'sent', already
        ? '<strong>This request was already emailed.</strong> You can download the documents again below.'
        : '<strong>Emailed.</strong> A copy was emailed to you.');
      return;
    }
    if (body && body.ok === true && body.leadEmailed === true) {
      $('btnRetry').classList.remove('hidden');
      setStatus('partial', '<strong>A copy could not be emailed to you</strong>' + (body.visitorRateLimited ? ' because that address has reached the hourly limit' : '') + '. Retry sends your copy only. Questions about DK Benefits’ services? ' + phoneLine() + ' · dan@dkbenefits.net.');
      return;
    }
    $('btnRetry').classList.remove('hidden');
    setStatus('failed', '<strong>The copy could not be emailed.</strong> ' + escapeHtml(errorText || (body && body.error) || 'The delivery service did not accept the message.') + ' Your answers are saved in this browser. Retry, or use the contact line below. Questions about DK Benefits’ services? ' + phoneLine() + ' · dan@dkbenefits.net.');
  }
  function postLead(record) {
    var cfg = window.S128_CONFIG || {};
    return fetch(cfg.endpoint, {
      method: 'POST',
      body: JSON.stringify(record)
    }).then(function (response) {
      return response.json().catch(function () { return { ok: false, error: 'The delivery service returned an unreadable response.' }; });
    }).then(function (body) {
      if (!body || body.ok !== true) {
        var err = new Error((body && body.error) || 'The delivery service did not accept the message.');
        err.body = body;
        throw err;
      }
      return body;
    });
  }
  function finishGenerate(isRetry) {
    if (inFlight) return;
    clearErrors();
    var result = S128Model.validate(readForm(), { asOf: S128Model.todayIso() });
    if (!result.ok) {
      showErrors(result.errors);
      go(1);
      return;
    }
    if (!$('terms_ack').checked) {
      $('err_terms_ack').textContent = 'Agree to the Terms of use before the documents can be created.';
      $('terms_ack').focus();
      if (step !== 4) go(4);
      return;
    }
    var id = isRetry && submissionId ? submissionId : newSubmissionId();
    var record = payloadFrom(result, id);
    lastFiles = buildFiles(result.plan);
    showStep(5);
    showDownloads(lastFiles);
    if (!isRetry) {
      lastFiles.forEach(function (file) {
        if (/\.docx$/i.test(file.name)) triggerDownload(file.bytes, file.name, file.mime);
      });
    }
    inFlight = true;
    $('btnRetry').classList.add('hidden');
    setStatus('neutral', 'Preparing your documents…');
    pdfFiles(result.plan).then(function (pdfs) {
      var all = lastFiles.concat(pdfs);
      showDownloads(all);
      if (!pdfs.length) notePdfMissing();
      record.files = filesPayload(all);
      if (!shouldPost()) {
        inFlight = false;
        clearPending(id);
        showEmailResult(null);
        return;
      }
      record.emailAttempted = true;
      savePending(record);
      $('btnRetry').disabled = true;
      setStatus('neutral', 'Sending your documents…');
      postLead(record).then(function (body) {
        inFlight = false;
        $('btnRetry').disabled = false;
        if (body.leadEmailed && body.visitorEmailed) clearPending(id);
        else {
          record.leadDelivered = !!body.leadEmailed;
          savePending(record);
        }
        showEmailResult(body);
      }).catch(function (err) {
        inFlight = false;
        $('btnRetry').disabled = false;
        record.leadDelivered = !!(err.body && err.body.leadEmailed);
        savePending(record);
        showEmailResult(err.body || null, err.message);
      });
    });
  }
  function showSavedBanner() {
    var latest = null;
    try { latest = localStorage.getItem('dkb_s128_pending_latest'); } catch (err) { return; }
    if (!latest) return;
    var raw = null;
    try { raw = localStorage.getItem(pendingKey(latest)); } catch (err) { return; }
    if (!raw) return;
    var saved = null;
    try { saved = JSON.parse(raw); } catch (err) { return; }
    if (!saved || !saved.emailAttempted || !shouldPost()) return;
    var banner = $('savedBanner');
    banner.classList.remove('hidden');
    var headline = saved.leadDelivered
      ? 'An earlier request was recorded. Your copy was not emailed.'
      : 'An earlier request was not emailed.';
    banner.innerHTML = '<strong>' + headline + '</strong> It is saved in this browser. <button type="button" class="linkish" id="btnRestore">Open the saved answers</button>';
    $('btnRestore').addEventListener('click', function () {
      restore(saved);
      banner.classList.add('hidden');
    });
  }
  function restore(saved) {
    var data = Object.assign({}, saved.plan || {}, saved.lead || {});
    Object.keys(data).forEach(function (key) {
      var el = $(key);
      if (!el || el.type === 'radio') return;
      if (key === 'participating_employers' && Array.isArray(data[key])) el.value = data[key].join('\n');
      else if (data[key] != null) el.value = data[key];
    });
    setRadio('funding_mode', data.funding_mode);
    setRadio('annual_cap_mode', data.annual_cap_mode);
    setRadio('eligibility_class_choice', data.eligibility_class_choice);
    if (data.allow_employee_account === true) setRadio('allow_employee_account', 'yes');
    if (data.allow_employee_account === false && data.funding_mode !== 'salary_reduction_only') setRadio('allow_employee_account', 'no');
    submissionId = saved.submissionId;
    if (saved.startedAt) startedAt = Date.parse(saved.startedAt) || startedAt;
    planNameTouched = true;
    syncConditional();
    go(4);
  }
  function setRadio(name, value) {
    var el = document.querySelector('input[name="' + name + '"][value="' + value + '"]');
    if (el) el.checked = true;
  }

  function endpointConfigured() {
    return !!(window.S128_CONFIG && window.S128_CONFIG.endpoint);
  }
  function mountTerms() {
    $('termsDialogBody').innerHTML = S128Terms.PARAGRAPHS.map(function (paragraph) {
      return '<p>' + escapeHtml(paragraph) + '</p>';
    }).join('');
    $('openTerms').addEventListener('click', function (event) {
      event.preventDefault();
      event.stopPropagation();
      $('termsDialog').showModal();
    });
    $('closeTerms').addEventListener('click', function () { $('termsDialog').close(); });
  }
  function syncEmailCopy() {
    var hint = $('contactEmailHint');
    if (hint) hint.textContent = 'A copy of the sample documents is emailed to this address when delivery is on.';
  }
  function digitsBeforeCaret(value, caret) {
    return (String(value || '').slice(0, caret).match(/\d/g) || []).length;
  }
  function caretAfterDigits(formatted, count) {
    if (count <= 0) return 0;
    var seen = 0;
    for (var i = 0; i < formatted.length; i++) {
      if (/\d/.test(formatted.charAt(i))) {
        seen++;
        if (seen === count) return i + 1;
      }
    }
    return formatted.length;
  }
  function bindLiveMask(input, format) {
    function apply() {
      var start = input.selectionStart || 0;
      var count = digitsBeforeCaret(input.value, start);
      var next = format(input.value);
      if (next === input.value) return;
      input.value = next;
      var pos = caretAfterDigits(next, count);
      if (input.setSelectionRange) input.setSelectionRange(pos, pos);
    }
    function removeDigit(index) {
      var all = String(input.value || '').replace(/\D/g, '');
      if (index < 0 || index >= all.length) return;
      input.value = format(all.slice(0, index) + all.slice(index + 1));
      var pos = caretAfterDigits(input.value, index);
      if (input.setSelectionRange) input.setSelectionRange(pos, pos);
      input.dispatchEvent(new Event('input', { bubbles: true }));
    }
    input.addEventListener('input', apply);
    input.addEventListener('keydown', function (event) {
      if (event.key !== 'Backspace' && event.key !== 'Delete') return;
      var start = input.selectionStart;
      var end = input.selectionEnd;
      if (start == null || start !== end) return;
      var value = input.value || '';
      if (event.key === 'Backspace' && start > 0 && /\D/.test(value.charAt(start - 1))) {
        event.preventDefault();
        removeDigit(digitsBeforeCaret(value, start) - 1);
      } else if (event.key === 'Delete' && start < value.length && /\D/.test(value.charAt(start))) {
        event.preventDefault();
        removeDigit(digitsBeforeCaret(value, start));
      }
    });
  }
  function applyWaitingGate(input) {
    var raw = String(input.value || '');
    var cut = raw.search(/[^\d]/);
    var digits = cut === -1 ? raw : raw.slice(0, cut);
    var invalidChars = cut !== -1;
    var message = '';
    if (/^\d+$/.test(digits)) {
      var n = Number(digits);
      if (n > 365) {
        digits = input.dataset.lastValid || '0';
        message = 'Use 0 to 365 calendar days. A longer wait is outside this sample.';
      } else {
        digits = String(n);
        input.dataset.lastValid = digits;
        if (invalidChars) message = 'Enter the waiting period as a whole number of days.';
      }
    } else if (invalidChars) {
      message = 'Enter the waiting period as a whole number of days.';
    }
    if (input.value !== digits) input.value = digits;
    input.dataset.gateMessage = message;
  }
  function onFieldEdited(event) {
    var target = event.target;
    if (!target) return;
    clearFieldError(target.id);
    if (target.name) clearFieldError(target.name);
    if (target.id === 'waiting_days' && target.dataset.gateMessage) {
      var box = $('err_waiting_days');
      if (box) box.textContent = target.dataset.gateMessage;
      target.setAttribute('aria-invalid', 'true');
    }
    syncConditional();
  }
  function init() {
    fillStates();
    if (window.S128Tips) S128Tips.mount();
    mountTerms();
    syncEmailCopy();
    $('employer_name').addEventListener('change', suggestName);
    $('plan_name').addEventListener('input', function () { planNameTouched = true; });
    bindLiveMask($('employer_ein'), S128Model.formatEinLive);
    bindLiveMask($('contact_phone'), S128Model.formatPhoneLive);
    var waiting = $('waiting_days');
    waiting.dataset.lastValid = /^\d+$/.test(waiting.value) && Number(waiting.value) <= 365 ? String(Number(waiting.value)) : '0';
    waiting.addEventListener('input', function () { applyWaitingGate(waiting); });
    waiting.addEventListener('keydown', function (event) {
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      if (event.key.length === 1 && !/\d/.test(event.key)) {
        event.preventDefault();
        waiting.dataset.gateMessage = 'Enter the waiting period as a whole number of days.';
        var box = $('err_waiting_days');
        if (box) box.textContent = waiting.dataset.gateMessage;
        waiting.setAttribute('aria-invalid', 'true');
      }
    });
    document.getElementById('wizard').addEventListener('change', onFieldEdited);
    document.getElementById('wizard').addEventListener('input', onFieldEdited);
    $('btnNext').addEventListener('click', function () {
      if (step < 4) {
        if (step === 1 && !fieldValue('plan_name')) suggestName();
        if (!validateCurrent()) return;
        go(step + 1);
        return;
      }
      if (step === 4) finishGenerate(false);
    });
    $('btnBack').addEventListener('click', function () {
      if (step > 1) go(step - 1);
    });
    $('btnRetry').addEventListener('click', function () { finishGenerate(true); });
    showStep(1);
    showSavedBanner();
    window.__s128SetStartedAt = function (value) { startedAt = value; };
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
