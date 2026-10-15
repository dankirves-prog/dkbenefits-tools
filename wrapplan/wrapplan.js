/**
 * Wrap plan preview. Files are built in the browser.
 * The page does not tell the visitor that a message will be sent.
 */
(function () {
  var STEPS = ['Start', 'Employer', 'ERISA', 'Benefits', 'Eligibility', 'Funding', 'COBRA', 'Download'];
  var BENEFITS = [
    ['medical', 'Medical'],
    ['dental', 'Dental'],
    ['vision', 'Vision'],
    ['rx', 'Prescription drugs (carved out)'],
    ['hra', 'Health Reimbursement Arrangement (HRA)'],
    ['health_fsa', 'Health FSA'],
    ['lpfsa', 'Limited Purpose FSA'],
    ['life', 'Group term life'],
    ['add', 'Group AD&D'],
    ['std', 'Short-term disability'],
    ['ltd', 'Long-term disability'],
    ['eap', 'Employee assistance program'],
    ['vol_life', 'Voluntary life'],
    ['vol_add', 'Voluntary AD&D'],
    ['accident', 'Accident'],
    ['critical', 'Critical illness'],
    ['hospital', 'Hospital indemnity']
  ];
  var VOL = ['vol_life', 'vol_add', 'accident', 'critical', 'hospital'];
  var SELF_FUNDING = ['level', 'aso', 'captive', 'rbp'];
  var step = 1;
  var startedAt = Date.now();
  var DRAFT_KEY = 'wp-draft-v3';

  function $(id) { return document.getElementById(id); }
  function val(id) {
    var el = $(id);
    return el ? String(el.value || '').trim() : '';
  }
  function setText(id, text) {
    var el = $(id);
    if (el) el.textContent = text || '';
  }
  function selectedBenefits() {
    return Array.prototype.map.call(document.querySelectorAll('input[name="benefits"]:checked'), function (box) {
      return box.value;
    });
  }
  function hasCode(code) { return selectedBenefits().indexOf(code) !== -1; }
  function formMedicalSelf() {
    return hasCode('medical') && SELF_FUNDING.indexOf(val('funding')) !== -1;
  }
  function formGroupHealth() {
    if (hasCode('medical') || hasCode('dental') || hasCode('vision') || hasCode('health_fsa') || hasCode('lpfsa') || hasCode('hra')) return true;
    return hasCode('eap') && val('eap_type') === 'substantive';
  }
  function showStep(n) {
    step = n;
    Array.prototype.forEach.call(document.querySelectorAll('[data-step]'), function (section) {
      section.hidden = String(section.getAttribute('data-step')) !== String(n);
    });
    $('backBtn').hidden = n === 1;
    $('nextBtn').hidden = n === STEPS.length;
    $('buildBtn').hidden = n !== STEPS.length;
    var list = $('progressList');
    list.textContent = '';
    STEPS.forEach(function (label, index) {
      var item = document.createElement('li');
      item.textContent = label;
      if (index + 1 === n) item.className = 'active';
      list.appendChild(item);
    });
    Array.prototype.forEach.call(document.querySelectorAll('h2[id="stepTitle"]'), function (heading) {
      heading.removeAttribute('id');
    });
    var title = document.querySelector('[data-step="' + n + '"] h2');
    if (title) title.id = 'stepTitle';
    postParent({ type: 'wp-scroll', step: n });
    saveDraft();
  }
  function postParent(data) {
    if (!window.parent || window.parent === window) return;
    WpModel.ALLOWED_ORIGINS.forEach(function (origin) {
      try { window.parent.postMessage(data, origin); } catch (err) {}
    });
  }
  function clearErrors() {
    Array.prototype.forEach.call(document.querySelectorAll('.field-error'), function (el) { el.textContent = ''; });
  }
  function showErrors(errors) {
    clearErrors();
    (errors || []).forEach(function (error) {
      var el = $('err_' + error.field);
      if (el) el.textContent = error.message;
    });
  }
  function digitsOnly(value, max) {
    var digits = String(value || '').replace(/\D/g, '');
    return max ? digits.slice(0, max) : digits;
  }
  function formatPhoneInput(el) {
    var digits = digitsOnly(el.value, 11);
    if (digits.length === 11 && digits.charAt(0) === '1') digits = digits.slice(1);
    digits = digits.slice(0, 10);
    if (digits.length > 6) el.value = digits.slice(0, 3) + '-' + digits.slice(3, 6) + '-' + digits.slice(6);
    else if (digits.length > 3) el.value = digits.slice(0, 3) + '-' + digits.slice(3);
    else el.value = digits;
  }
  function formatEinInput(el) {
    var digits = digitsOnly(el.value, 9);
    el.value = digits.length > 2 ? digits.slice(0, 2) + '-' + digits.slice(2) : digits;
  }
  function formatDateInput(el) {
    var digits = digitsOnly(el.value, 8);
    if (digits.length > 4) el.value = digits.slice(0, 2) + '/' + digits.slice(2, 4) + '/' + digits.slice(4);
    else if (digits.length > 2) el.value = digits.slice(0, 2) + '/' + digits.slice(2);
    else el.value = digits;
  }
  function displayDate(value) {
    var iso = String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (iso) return iso[2] + '/' + iso[3] + '/' + iso[1];
    return String(value || '');
  }
  function readPlan() {
    var carriers = {};
    var carrierAddresses = {};
    var tax = {};
    var benefitFunding = {};
    var overrides = {};
    var overrideOther = {};
    var selfMedical = formMedicalSelf();
    var codes = selectedBenefits();
    codes.forEach(function (code) {
      carriers[code] = val('carrier_' + code);
      if (code === 'medical' || code === 'dental' || code === 'vision' || code === 'rx' || (code === 'eap' && val('eap_type') === 'substantive')) {
        carrierAddresses[code] = val('carrier_address_' + code);
      }
      if (code !== 'hra') tax[code] = val('tax_' + code);
      if (code !== 'medical' && code !== 'hra' && code !== 'health_fsa' && code !== 'lpfsa' && code !== 'std') {
        benefitFunding[code] = val('benefit_funding_' + code) || 'insured';
      }
      var over = val('waitover_sel_' + code);
      if ($('waitingOverrides') && !$('waitingOverrides').hidden && over && over !== 'same') {
        overrides[code] = over;
        overrideOther[code] = val('waitover_other_' + code);
      }
    });
    var restatement = val('is_restatement') === 'yes';
    var wrapDate = val('wrap_effective_date');
    var params = new URLSearchParams(location.search);
    return {
      erisa_path: val('erisa_path') || 'private',
      employer_name: val('employer_name'),
      employer_ein: val('employer_ein'),
      phone: val('phone'),
      street: val('street'),
      city: val('city'),
      state: val('state').toUpperCase(),
      zip: val('zip'),
      plan_name: val('plan_name'),
      plan_number: val('plan_number'),
      original_effective_date: restatement ? val('original_effective_date') : wrapDate,
      is_restatement: restatement ? 'yes' : 'no',
      restatement_date: restatement ? wrapDate : '',
      intended_signature_date: val('intended_signature_date'),
      plan_year_type: val('plan_year_type'),
      plan_year_end_month: val('plan_year_end_month'),
      employee_count: val('employee_count'),
      benefits: codes,
      carriers: carriers,
      carrier_addresses: carrierAddresses,
      waiting_period: val('waiting_period'),
      waiting_other: val('waiting_other'),
      waiting_overrides: overrides,
      waiting_override_other: overrideOther,
      tax: tax,
      benefit_funding: benefitFunding,
      discretion: val('discretion') || 'yes',
      funding: hasCode('medical') ? val('funding') : '',
      network: val('funding') === 'rbp' ? 'rbp' : 'traditional',
      stop_loss: selfMedical ? val('stop_loss') : '',
      tpa_name: selfMedical ? val('tpa_name') : '',
      tpa_document: selfMedical ? val('tpa_document') : '',
      hra_type: hasCode('hra') ? val('hra_type') : '',
      ichra_same_class: hasCode('hra') && val('hra_type') === 'ichra' ? val('ichra_same_class') : '',
      eap_type: hasCode('eap') ? val('eap_type') : '',
      std_type: hasCode('std') ? val('std_type') : '',
      vol_contrib: val('vol_contrib'),
      vol_voluntary: val('vol_voluntary'),
      vol_endorse: val('vol_endorse'),
      vol_payroll_only: val('vol_payroll_only'),
      vol_consideration: val('vol_consideration'),
      classes: val('classes'),
      hours: val('hours'),
      dependents: val('dependents'),
      census: { a: val('census_a'), b: val('census_b') || '0', c: val('census_c') || '0', d: val('census_d') || '0' },
      employee_contributions: val('employee_contributions'),
      remitted: val('employee_contributions') === 'yes' ? val('remitted') : '',
      section125: val('section125'),
      trust: val('trust') || 'no',
      trustee_name: val('trust') === 'yes' ? val('trustee_name') : '',
      trustee_address: val('trust') === 'yes' ? val('trustee_address') : '',
      cobra: formGroupHealth() ? val('cobra') : '',
      cobra_admin: formGroupHealth() && val('cobra') === 'yes' ? val('cobra_admin') : '',
      appeals: selfMedical ? (val('appeals') || 'carrier') : 'carrier',
      bargaining: val('bargaining') || 'no',
      phi: val('phi') || 'no',
      phi_classes: val('phi') === 'yes' ? val('phi_classes') : '',
      certificates: val('certificates'),
      agent_choice: val('agent_choice') || 'employer',
      agent_name: val('agent_name'),
      agent_address: val('agent_address'),
      admin_choice: val('admin_choice') || 'employer',
      admin_name: val('admin_name'),
      signer_name: val('signer_name'),
      signer_title: val('signer_title'),
      governing_body: val('governing_body'),
      contact_name: val('contact_name'),
      contact_email: val('contact_email'),
      contact_phone: val('contact_phone'),
      role: val('role'),
      prior_small_filing: val('prior_small_filing') || 'no',
      utm: params.get('utm_source') || '',
      referrer: document.referrer || ''
    };
  }
  function addField(parent, id, labelText, kind, tipId) {
    var wrap = document.createElement('div');
    wrap.className = 'field';
    wrap.id = id + '_wrap';
    var lab = document.createElement('label');
    lab.htmlFor = id;
    lab.appendChild(document.createTextNode(labelText));
    if (tipId) {
      var tip = tipButton(tipId);
      if (tip) lab.appendChild(tip);
    }
    var input = document.createElement(kind === 'select' ? 'select' : 'input');
    input.id = id;
    wrap.appendChild(lab);
    wrap.appendChild(input);
    parent.appendChild(wrap);
    return input;
  }
  function fieldError(input, id) {
    var err = document.createElement('p');
    err.className = 'field-error';
    err.id = id;
    err.setAttribute('role', 'alert');
    input.parentNode.appendChild(err);
  }
  function fillOptions(select, pairs, current) {
    select.textContent = '';
    pairs.forEach(function (pair) {
      var opt = document.createElement('option');
      opt.value = pair[0];
      opt.textContent = pair[1];
      select.appendChild(opt);
    });
    if (current) select.value = current;
  }
  function tipButton(id) {
    var tip = WpTips.text(id);
    if (!tip) return null;
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'info';
    btn.setAttribute('aria-label', 'More information');
    btn.appendChild(document.createTextNode('i'));
    var bubble = document.createElement('span');
    bubble.className = 'bubble';
    bubble.setAttribute('role', 'tooltip');
    bubble.textContent = tip;
    btn.appendChild(bubble);
    btn.addEventListener('click', function (event) {
      event.preventDefault();
      event.stopPropagation();
    });
    return btn;
  }
  function waitingPairs(includeSame) {
    var pairs = includeSame ? [['same', 'Same as the plan']] : [];
    WpModel.WAITING_OPTIONS.forEach(function (option) { pairs.push([option.id, option.menu]); });
    return pairs;
  }
  function mountWaiting() {
    fillOptions($('waiting_period'), [['', 'Choose']].concat(waitingPairs(false)), '');
    var host = $('waitingOverrides');
    BENEFITS.forEach(function (pair) {
      var wrap = document.createElement('div');
      wrap.className = 'field';
      wrap.id = 'waitover_' + pair[0];
      wrap.hidden = true;
      var lab = document.createElement('label');
      lab.htmlFor = 'waitover_sel_' + pair[0];
      lab.textContent = pair[1];
      var sel = document.createElement('select');
      sel.id = 'waitover_sel_' + pair[0];
      fillOptions(sel, waitingPairs(true), 'same');
      var other = document.createElement('input');
      other.id = 'waitover_other_' + pair[0];
      other.placeholder = 'Describe the waiting period';
      other.hidden = true;
      var err = document.createElement('p');
      err.className = 'field-error';
      err.id = 'err_waitover_other_' + pair[0];
      err.setAttribute('role', 'alert');
      wrap.appendChild(lab);
      wrap.appendChild(sel);
      wrap.appendChild(other);
      wrap.appendChild(err);
      host.appendChild(wrap);
    });
  }
  function mountBenefits() {
    var host = $('benefitBoxes');
    BENEFITS.forEach(function (pair) {
      var code = pair[0];
      var item = document.createElement('div');
      item.className = 'benefit-item';
      var label = document.createElement('label');
      label.className = 'check-line';
      var box = document.createElement('input');
      box.type = 'checkbox';
      box.name = 'benefits';
      box.value = code;
      label.appendChild(box);
      label.appendChild(document.createTextNode(' ' + pair[1]));
      item.appendChild(label);
      if (code === 'lpfsa') {
        var note = document.createElement('p');
        note.className = 'hint benefit-note';
        note.textContent = 'Covers dental and vision expenses, and preventive care if the plan allows, so it stays compatible with a health savings account.';
        item.appendChild(note);
      }
      var panel = document.createElement('div');
      panel.className = 'benefit-fields';
      panel.id = 'panel_' + code;
      panel.hidden = true;
      fillBenefitPanel(panel, code);
      item.appendChild(panel);
      host.appendChild(item);
    });
    var dcap = document.createElement('div');
    dcap.className = 'benefit-item is-disabled';
    var dcapLabel = document.createElement('label');
    dcapLabel.className = 'check-line';
    var dcapBox = document.createElement('input');
    dcapBox.type = 'checkbox';
    dcapBox.disabled = true;
    dcapLabel.appendChild(dcapBox);
    dcapLabel.appendChild(document.createTextNode(' Dependent Care FSA'));
    var dcapNote = document.createElement('p');
    dcapNote.className = 'hint benefit-note';
    dcapNote.textContent = 'Dependent care stays in the Section 125 plan, not this wrap.';
    dcap.appendChild(dcapLabel);
    dcap.appendChild(dcapNote);
    host.appendChild(dcap);
  }
  function fillBenefitPanel(panel, code) {
    var carrier = addField(panel, 'carrier_' + code, code === 'hra' || code === 'health_fsa' || code === 'lpfsa' ? 'Administrator' : 'Carrier or insurer name');
    fieldError(carrier, 'err_carrier_' + code);
    if (code === 'medical' || code === 'dental' || code === 'vision' || code === 'rx' || code === 'eap') {
      var addr = addField(panel, 'carrier_address_' + code, 'Insurer or administrator address');
      fieldError(addr, 'err_carrier_address_' + code);
      if (code === 'eap') addr.parentNode.id = 'eapAddressWrap';
    }
    if (code === 'medical') {
      var funding = addField(panel, 'funding', 'How is medical funded?', 'select', 'funding');
      fillOptions(funding, [
        ['', 'Choose'],
        ['insured', 'Fully insured'],
        ['level', 'Level-funded'],
        ['aso', 'Self-funded (ASO)'],
        ['captive', 'Captive'],
        ['rbp', 'Reference-based pricing']
      ], '');
      fieldError(funding, 'err_funding');
      var self = document.createElement('div');
      self.id = 'selfFundedWrap';
      self.hidden = true;
      var tpa = addField(self, 'tpa_name', 'Third-party administrator name');
      fieldError(tpa, 'err_tpa_name');
      var tpaDoc = addField(self, 'tpa_document', 'Name of the administrator plan document or SPD');
      fieldError(tpaDoc, 'err_tpa_document');
      var stop = addField(self, 'stop_loss', 'Does a stop-loss policy cover the employer?', 'select', 'stop_loss');
      fillOptions(stop, [['', 'Choose'], ['yes', 'Yes'], ['no', 'No']], '');
      var stopNote = document.createElement('p');
      stopNote.className = 'hint';
      stopNote.textContent = 'The stop-loss policy covers the employer, not participants.';
      stop.parentNode.appendChild(stopNote);
      fieldError(stop, 'err_stop_loss');
      panel.appendChild(self);
    } else if (code !== 'hra' && code !== 'health_fsa' && code !== 'lpfsa' && code !== 'std') {
      var fund = addField(panel, 'benefit_funding_' + code, 'Insured or self-funded', 'select');
      fillOptions(fund, [['insured', 'Fully insured'], ['self', 'Self-funded']], 'insured');
    }
    if (code === 'hra') {
      var hra = addField(panel, 'hra_type', 'HRA type', 'select', 'hra_type');
      fillOptions(hra, [
        ['', 'Choose'],
        ['integrated', 'Integrated HRA'],
        ['excepted', 'Excepted-benefit HRA'],
        ['ichra', 'Individual coverage HRA'],
        ['qsehra', 'Qualified small employer HRA']
      ], '');
      fieldError(hra, 'err_hra_type');
      var ichra = document.createElement('div');
      ichra.id = 'ichraWrap';
      ichra.hidden = true;
      var same = addField(ichra, 'ichra_same_class', 'Is it offered to a class that can also enroll in group medical?', 'select');
      fillOptions(same, [['', 'Choose'], ['yes', 'Yes'], ['no', 'No']], '');
      panel.appendChild(ichra);
    }
    if (code === 'eap') {
      var eap = addField(panel, 'eap_type', 'EAP type', 'select');
      fillOptions(eap, [['', 'Choose'], ['referral', 'Referral only (left out of the wrap)'], ['substantive', 'Provides counseling or other care']], '');
      fieldError(eap, 'err_eap_type');
    }
    if (code === 'std') {
      var std = addField(panel, 'std_type', 'How short-term disability is paid', 'select');
      fillOptions(std, [['', 'Choose'], ['insured', 'Insured policy'], ['general-assets', 'Paid from employer general assets'], ['trust', 'Paid from a trust or separate fund']], '');
      fieldError(std, 'err_std_type');
    }
    if (code === 'hra') return;
    var taxDefault = WpModel.PRETAC_TAX[code] ? 'pretax' : (WpModel.EMPLOYER_TAX[code] ? 'none' : '');
    var taxPairs = [['pretax', 'Pre-tax'], ['aftertax', 'After tax'], ['none', 'Employer paid']];
    if (!taxDefault) taxPairs.unshift(['', 'Choose']);
    var tax = addField(panel, 'tax_' + code, 'Employee contributions for this benefit', 'select');
    fillOptions(tax, taxPairs, taxDefault);
    fieldError(tax, 'err_tax_' + code);
  }
  function paintReview(result) {
    var box = $('reviewBox');
    box.textContent = '';
    var plan = result.plan;
    function line(text) {
      var p = document.createElement('p');
      p.textContent = text;
      box.appendChild(p);
    }
    if (result.mode === 'explain') {
      line(WpDocgen.plainText(WpDocgen.explainParagraphs(plan)));
      return;
    }
    line(plan.plan_name + '. Plan number ' + plan.plan_number + '.');
    line(WpModel.planYearSentence(plan));
    line('Covered participants: ' + WpModel.countParticipants(plan) + '.');
    line('Benefits: ' + WpModel.wrappedBenefits(plan).map(WpModel.benefitLabel).join(', ') + '.');
    result.findings.forEach(line);
  }
  function downloadLabel(name) {
    var pdf = /\.pdf$/i.test(name);
    if (/_Findings\./.test(name)) return pdf ? 'Download Findings Report (PDF)' : 'Download Findings Report (Word)';
    if (/_Explanation\./.test(name)) return pdf ? 'Download Explanation (PDF)' : 'Download Explanation (Word)';
    return pdf ? 'Download Plan (PDF)' : 'Download Plan (Word)';
  }
  function triggerDownload(bytes, name, mime) {
    var blob = new Blob([bytes], { type: mime });
    var url = URL.createObjectURL(blob);
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
    list.hidden = false;
    list.textContent = '';
    var pdfCol = document.createElement('div');
    pdfCol.className = 'download-col download-col-pdf';
    var wordCol = document.createElement('div');
    wordCol.className = 'download-col download-col-word';
    files.forEach(function (file) {
      var pdf = file.mime === 'application/pdf';
      var button = document.createElement('button');
      button.type = 'button';
      button.className = 'btn-gold';
      button.textContent = downloadLabel(file.name);
      button.addEventListener('click', function () { triggerDownload(file.bytes, file.name, file.mime); });
      (pdf ? pdfCol : wordCol).appendChild(button);
    });
    if (wordCol.childElementCount) list.appendChild(wordCol);
    if (pdfCol.childElementCount) list.appendChild(pdfCol);
  }
  function jobsFor(result) {
    var plan = result.plan;
    if (result.mode === 'explain') {
      return [{ rows: WpDocgen.explainParagraphs(plan), name: WpDocgen.explainFileName(plan), title: 'About this arrangement' }];
    }
    var jobs = [
      { rows: WpDocgen.planParagraphs(plan), name: WpDocgen.planFileName(plan), title: 'Wrap Plan Document' },
      { rows: WpDocgen.spdParagraphs(plan), name: WpDocgen.spdFileName(plan), title: 'Summary Plan Description' },
      { rows: WpDocgen.scheduleParagraphs(plan), name: WpDocgen.scheduleFileName(plan), title: 'Schedule A' },
      { rows: WpDocgen.resolutionParagraphs(plan), name: WpDocgen.resolutionFileName(plan), title: 'Adoption Resolution' }
    ];
    if (WpDocgen.needsQmcso(plan)) jobs.push({ rows: WpDocgen.qmcsoParagraphs(plan), name: WpDocgen.qmcsoFileName(plan), title: 'QMCSO Procedures' });
    if (WpDocgen.needsHipaa(plan)) jobs.push({ rows: WpDocgen.hipaaParagraphs(plan), name: WpDocgen.hipaaFileName(plan), title: 'HIPAA Amendment' });
    jobs.push({ rows: WpDocgen.findingsParagraphs(plan, result.findings), name: WpDocgen.findingsFileName(plan), title: 'Findings Report' });
    return jobs;
  }
  function bytesToBase64(bytes) {
    var view = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
    var binary = '';
    var chunk = 0x8000;
    for (var i = 0; i < view.length; i += chunk) binary += String.fromCharCode.apply(null, view.subarray(i, i + chunk));
    return btoa(binary);
  }
  function sendLead(result, files) {
    var endpoint = (window.WP_CONFIG && window.WP_CONFIG.endpoint) || '';
    if (!endpoint) return;
    var payload = {
      event: 'wp_submission',
      submissionId: 'wp' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8),
      startedAt: new Date(startedAt).toISOString(),
      submittedAt: new Date().toISOString(),
      pageUrl: location.href,
      templateVersion: WpModel.TEMPLATE_VERSION,
      test: new URLSearchParams(location.search).get('test') === '1',
      hp: val('company_website'),
      plan: result.plan,
      findings: result.findings,
      acknowledgement: { accepted: true, acceptedAt: new Date().toISOString(), termsVersion: WpTerms.VERSION },
      files: files.slice(0, 14).map(function (file) {
        return { name: file.name, mime: file.mime, dataBase64: bytesToBase64(file.bytes) };
      })
    };
    fetch(endpoint, { method: 'POST', mode: 'no-cors', body: JSON.stringify(payload) }).catch(function () {});
  }
  function build() {
    clearErrors();
    if (!$('consent').checked) {
      setText('err_consent', 'Confirm the terms before creating your documents.');
      return;
    }
    var result = WpModel.validate(readPlan());
    if (!result.ok) {
      var order = result.mode === 'explain' ? [2, 8] : [2, 4, 5, 6, 7, 8];
      var target = step;
      for (var i = 0; i < order.length; i++) {
        if (errorsOnStep(result.errors, order[i]).length) {
          target = order[i];
          break;
        }
      }
      showStep(target);
      showErrors(errorsOnStep(result.errors, target));
      if (target === 8) setText('statusLine', 'Fix the items marked above.');
      postParent({ type: 'wp-scroll', step: target });
      return;
    }
    setText('statusLine', 'Your documents are ready to download.');
    var jobs = jobsFor(result);
    var docx = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    if (result.mode === 'explain') {
      var explain = jobs[0];
      var explainWord = {
        name: explain.name,
        mime: docx,
        bytes: WpDocgen.buildDocx(explain.rows, { title: explain.title, footer: WpDocgen.footerFor(result.plan, explain.title) })
      };
      WpPdf.buildPdf(explain.rows, { title: explain.title, footer: WpDocgen.footerFor(result.plan, explain.title) }).then(function (bytes) {
        var files = [explainWord, { name: WpDocgen.pdfFileName(explain.name), mime: 'application/pdf', bytes: bytes }];
        showDownloads(files);
        sendLead(result, files);
      }).catch(function () {
        showDownloads([explainWord]);
        setText('statusLine', 'The Word file is ready. The PDF could not be built in this browser.');
      });
      return;
    }
    var findingsJob = jobs[jobs.length - 1];
    var packetJobs = jobs.slice(0, -1);
    var findingsWord = {
      name: findingsJob.name,
      mime: docx,
      bytes: WpDocgen.buildDocx(findingsJob.rows, { title: findingsJob.title, footer: WpDocgen.footerFor(result.plan, findingsJob.title) })
    };
    function pdfOf(job) {
      return WpPdf.buildPdf(job.rows, { title: job.title, footer: WpDocgen.footerFor(result.plan, job.title) });
    }
    function wordPacket(entries) {
      var coverRows = WpDocgen.coverParagraphs(result.plan, entries);
      var sections = [{ rows: coverRows, footer: WpDocgen.footerFor(result.plan, 'Plan packet') }].concat(packetJobs.map(function (job) {
        return { rows: job.rows, footer: WpDocgen.footerFor(result.plan, job.title) };
      }));
      return {
        name: WpDocgen.packetFileName(result.plan),
        mime: docx,
        bytes: WpDocgen.buildPacketDocx(sections, { title: result.plan.plan_name || 'Plan packet' }),
        coverRows: coverRows
      };
    }
    Promise.all(packetJobs.map(pdfOf)).then(function (parts) {
      var PDFLib = window.PDFLib;
      return Promise.all(parts.map(function (bytes) {
        return PDFLib.PDFDocument.load(bytes).then(function (doc) { return doc.getPageCount(); });
      })).then(function (counts) {
        var entries = packetJobs.map(function (job, index) {
          return { title: job.title, pages: counts[index] };
        });
        var packetWord = wordPacket(entries);
        return pdfOf({ rows: packetWord.coverRows, title: 'Plan packet' }).then(function (coverPdf) {
          return WpPdf.mergePdfs([coverPdf].concat(parts), { title: result.plan.plan_name || 'Plan packet' });
        }).then(function (packetPdf) {
          return pdfOf(findingsJob).then(function (findingsPdf) {
            return [
              packetWord,
              { name: WpDocgen.pdfFileName(packetWord.name), mime: 'application/pdf', bytes: packetPdf },
              findingsWord,
              { name: WpDocgen.pdfFileName(findingsJob.name), mime: 'application/pdf', bytes: findingsPdf }
            ];
          });
        });
      });
    }).then(function (files) {
      showDownloads(files);
      sendLead(result, files);
    }).catch(function () {
      showDownloads([wordPacket(packetJobs.map(function (job) { return { title: job.title }; })), findingsWord]);
      setText('statusLine', 'The Word files are ready. The PDF could not be built in this browser.');
    });
  }
  function saveDraft() {
    try { localStorage.setItem(DRAFT_KEY, JSON.stringify(readPlan())); } catch (err) {}
  }
  var STEP_FIELDS = {
    2: ['employer_name', 'employer_ein', 'address', 'plan_number', 'employee_count', 'wrap_effective_date', 'original_effective_date'],
    4: ['benefits', 'hra_type', 'eap_type', 'std_type', 'vol_consideration', 'funding', 'tpa_name', 'tpa_document', 'stop_loss'],
    5: ['waiting_period', 'waiting_other'],
    6: ['census_a', 'trustee_name', 'section125', 'employee_contributions', 'remitted', 'certificates'],
    7: ['cobra', 'signer_name', 'intended_signature_date'],
    8: ['contact_name', 'contact_email']
  };
  function errorsOnStep(errors, n) {
    var fields = STEP_FIELDS[n] || [];
    return (errors || []).filter(function (error) {
      if (fields.indexOf(error.field) !== -1) return true;
      if (n === 4 && (error.field.indexOf('carrier_') === 0 || error.field.indexOf('tax_') === 0)) return true;
      return n === 5 && error.field.indexOf('waitover_') === 0;
    });
  }
  function stepShouldBlock(result, n) {
    if (result.mode === 'explain') return n === 2;
    return n === 2 || n === 4 || n === 5 || n === 6 || n === 7;
  }
  function putValue(id, value) {
    var el = $(id);
    if (el && value != null && value !== '') el.value = value;
  }
  function loadDraft() {
    try {
      var raw = localStorage.getItem(DRAFT_KEY);
      if (!raw) return;
      var data = JSON.parse(raw);
      var later = {
        benefits: 1, carriers: 1, carrier_addresses: 1, census: 1, waiting: 1, tax: 1, benefit_funding: 1,
        funding: 1, network: 1, stop_loss: 1, tpa_name: 1, tpa_document: 1,
        hra_type: 1, ichra_same_class: 1, eap_type: 1, std_type: 1,
        vol_contrib: 1, vol_voluntary: 1, vol_endorse: 1, vol_payroll_only: 1, vol_consideration: 1,
        utm: 1, referrer: 1, address: 1, phi_classes_blank: 1,
        original_effective_date: 1, restatement_date: 1, wrap_effective_date: 1, intended_signature_date: 1,
        waiting_period: 1, waiting_other: 1, waiting_overrides: 1, waiting_override_other: 1, is_restatement: 1
      };
      Object.keys(data).forEach(function (key) {
        if (later[key]) return;
        var el = $(key);
        if (el && data[key]) el.value = data[key];
      });
      var restatement = data.is_restatement === 'yes';
      putValue('is_restatement', restatement ? 'yes' : 'no');
      putValue('wrap_effective_date', displayDate(restatement ? (data.restatement_date || data.wrap_effective_date) : (data.wrap_effective_date || data.original_effective_date)));
      if (restatement) putValue('original_effective_date', displayDate(data.original_effective_date));
      putValue('intended_signature_date', displayDate(data.intended_signature_date));
      putValue('waiting_period', data.waiting_period);
      putValue('waiting_other', data.waiting_other);
      if (data.census) {
        ['a', 'b', 'c', 'd'].forEach(function (part) { putValue('census_' + part, data.census[part]); });
      }
      if (Array.isArray(data.benefits)) {
        Array.prototype.forEach.call(document.querySelectorAll('input[name="benefits"]'), function (box) {
          box.checked = data.benefits.indexOf(box.value) !== -1;
        });
      }
      putValue('funding', data.funding);
      putValue('stop_loss', data.stop_loss);
      putValue('tpa_name', data.tpa_name);
      putValue('tpa_document', data.tpa_document);
      putValue('hra_type', data.hra_type);
      putValue('ichra_same_class', data.ichra_same_class);
      putValue('eap_type', data.eap_type);
      putValue('std_type', data.std_type);
      ['vol_contrib', 'vol_voluntary', 'vol_endorse', 'vol_payroll_only', 'vol_consideration'].forEach(function (key) {
        putValue(key, data[key]);
      });
      Object.keys(data.carriers || {}).forEach(function (code) { putValue('carrier_' + code, data.carriers[code]); });
      Object.keys(data.carrier_addresses || {}).forEach(function (code) { putValue('carrier_address_' + code, data.carrier_addresses[code]); });
      Object.keys(data.tax || {}).forEach(function (code) { putValue('tax_' + code, data.tax[code]); });
      Object.keys(data.benefit_funding || {}).forEach(function (code) { putValue('benefit_funding_' + code, data.benefit_funding[code]); });
      var overs = data.waiting_overrides || {};
      if (Object.keys(overs).length) {
        $('waitingOverrides').hidden = false;
        $('waitingOverrideLink').hidden = true;
        Object.keys(overs).forEach(function (code) {
          putValue('waitover_sel_' + code, overs[code]);
          putValue('waitover_other_' + code, (data.waiting_override_other || {})[code]);
        });
      }
      if (data.phi) $('phi').dataset.touched = '1';
    } catch (err) {}
  }
  function mountTips() {
    Array.prototype.forEach.call(document.querySelectorAll('.tip-slot'), function (slot) {
      var tip = tipButton(slot.getAttribute('data-tip'));
      if (!tip) return;
      slot.textContent = '';
      slot.appendChild(tip);
    });
  }
  function syncPanels() {
    $('fiscalWrap').hidden = val('plan_year_type') !== 'fiscal';
    $('originalWrap').hidden = val('is_restatement') !== 'yes';
    $('trusteeWrap').hidden = val('trust') !== 'yes';
    $('agentWrap').hidden = val('agent_choice') !== 'custom';
    $('adminWrap').hidden = val('admin_choice') !== 'custom';
    $('remittedWrap').hidden = val('employee_contributions') !== 'yes';
    var phi = $('phi');
    if (phi && !phi.dataset.touched) phi.value = formMedicalSelf() ? 'yes' : 'no';
    $('phiClassesWrap').hidden = val('phi') !== 'yes';
    $('waitingOtherWrap').hidden = val('waiting_period') !== 'other';
    var group = formGroupHealth();
    $('cobraWrap').hidden = !group;
    $('cobraAdminWrap').hidden = !group || val('cobra') !== 'yes';
    $('appealsWrap').hidden = !formMedicalSelf();
    var self = $('selfFundedWrap');
    if (self) self.hidden = !formMedicalSelf();
    var ichra = $('ichraWrap');
    if (ichra) ichra.hidden = !(hasCode('hra') && val('hra_type') === 'ichra');
    var eapAddr = $('eapAddressWrap');
    if (eapAddr) eapAddr.hidden = val('eap_type') !== 'substantive';
    $('volWrap').hidden = !VOL.some(hasCode);
    BENEFITS.forEach(function (pair) {
      var panel = $('panel_' + pair[0]);
      var box = document.querySelector('input[name="benefits"][value="' + pair[0] + '"]');
      if (panel && box) panel.hidden = !box.checked;
      var over = $('waitover_' + pair[0]);
      if (over) over.hidden = !box.checked || $('waitingOverrides').hidden;
      var other = $('waitover_other_' + pair[0]);
      var sel = $('waitover_sel_' + pair[0]);
      if (other && sel) other.hidden = sel.value !== 'other';
    });
    var path = val('erisa_path');
    var note = $('explainNote');
    if (path && path !== 'private') {
      note.hidden = false;
      var fake = WpModel.normalize({ erisa_path: path, employer_name: val('employer_name') || 'This employer' });
      note.textContent = WpDocgen.plainText(WpDocgen.explainParagraphs(fake));
    } else note.hidden = true;
    var count = WpModel.countParticipants({ census: { a: val('census_a'), b: val('census_b'), c: val('census_c'), d: val('census_d') } });
    setText('countPreview', 'Covered participants: ' + count + '.');
    $('priorWrap').hidden = count < 100;
  }

  document.addEventListener('DOMContentLoaded', function () {
    mountBenefits();
    mountWaiting();
    mountTips();
    loadDraft();
    showStep(1);
    $('backBtn').addEventListener('click', function () { if (step > 1) showStep(step - 1); });
    $('nextBtn').addEventListener('click', function () {
      clearErrors();
      var result = WpModel.validate(readPlan());
      if (stepShouldBlock(result, step)) {
        var mine = errorsOnStep(result.errors, step);
        if (mine.length) {
          showErrors(mine);
          postParent({ type: 'wp-scroll', step: step });
          return;
        }
      }
      if (step === 7) paintReview(result);
      showStep(step + 1);
    });
    $('waitingOverrideLink').addEventListener('click', function () {
      $('waitingOverrides').hidden = false;
      $('waitingOverrideLink').hidden = true;
      syncPanels();
    });
    $('buildBtn').addEventListener('click', function (event) {
      event.preventDefault();
      build();
    });
    $('wizard').addEventListener('submit', function (event) { event.preventDefault(); build(); });
    ['phone', 'contact_phone'].forEach(function (id) {
      $(id).addEventListener('input', function () { formatPhoneInput($(id)); });
    });
    $('employer_ein').addEventListener('input', function () { formatEinInput($('employer_ein')); });
    ['wrap_effective_date', 'original_effective_date', 'intended_signature_date'].forEach(function (id) {
      $(id).addEventListener('input', function () { formatDateInput($(id)); });
    });
    $('wizard').addEventListener('change', function (event) {
      if (event.target && event.target.id === 'phi') event.target.dataset.touched = '1';
      syncPanels();
    });
    $('wizard').addEventListener('input', function () { saveDraft(); syncPanels(); });
    syncPanels();
  });
})();
