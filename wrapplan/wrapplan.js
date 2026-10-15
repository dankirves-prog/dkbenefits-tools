/**
 * Wrap plan preview. Files are built in the browser.
 * The page does not tell the visitor that a message will be sent.
 */
(function () {
  var STEPS = ['Start', 'Employer', 'ERISA', 'Benefits', 'Funding', 'COBRA', 'Download'];
  var BENEFITS = [
    ['medical', 'Medical'], ['dental', 'Dental'], ['vision', 'Vision'], ['rx', 'Prescription drugs (carved out)'],
    ['life', 'Group term life'], ['add', 'Group AD&D'], ['std', 'Short-term disability'], ['ltd', 'Long-term disability'],
    ['eap', 'Employee assistance program'], ['hra', 'Health reimbursement arrangement'], ['health_fsa', 'Health FSA'],
    ['vol_life', 'Voluntary life'], ['vol_add', 'Voluntary AD&D'], ['accident', 'Accident'],
    ['critical', 'Critical illness'], ['hospital', 'Hospital indemnity']
  ];
  var step = 1;
  var startedAt = Date.now();
  var DRAFT_KEY = 'wp-draft-v1';

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
  function readPlan() {
    var carriers = {};
    var carrierAddresses = {};
    var waiting = {};
    var tax = {};
    var benefitFunding = {};
    selectedBenefits().forEach(function (code) {
      carriers[code] = val('carrier_' + code);
      carrierAddresses[code] = val('carrier_address_' + code);
      waiting[code] = val('waiting_' + code);
      tax[code] = val('tax_' + code);
      if (code !== 'medical' && code !== 'hra' && code !== 'health_fsa') {
        benefitFunding[code] = val('benefit_funding_' + code) || 'insured';
      }
    });
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
      original_effective_date: val('original_effective_date'),
      is_restatement: val('is_restatement'),
      restatement_date: val('restatement_date'),
      intended_signature_date: val('intended_signature_date'),
      plan_year_type: val('plan_year_type'),
      plan_year_end_month: val('plan_year_end_month'),
      employee_count: val('employee_count'),
      benefits: selectedBenefits(),
      carriers: carriers,
      carrier_addresses: carrierAddresses,
      waiting: waiting,
      tax: tax,
      benefit_funding: benefitFunding,
      discretion: val('discretion') || 'yes',
      funding: val('funding'),
      network: val('network'),
      stop_loss: val('stop_loss'),
      tpa_name: val('tpa_name'),
      tpa_document: val('tpa_document'),
      hra_type: val('hra_type'),
      hra_doc: val('hra_doc'),
      ichra_same_class: val('ichra_same_class'),
      health_fsa_doc: val('health_fsa_doc'),
      eap_type: val('eap_type'),
      std_type: val('std_type'),
      vol_pretax: val('vol_pretax'),
      vol_contrib: val('vol_contrib'),
      vol_voluntary: val('vol_voluntary'),
      vol_endorse: val('vol_endorse'),
      vol_payroll_only: val('vol_payroll_only'),
      vol_consideration: val('vol_consideration'),
      classes: val('classes'),
      hours: val('hours'),
      dependents: val('dependents'),
      census: { a: val('census_a'), b: val('census_b'), c: val('census_c'), d: val('census_d') },
      employee_contributions: val('employee_contributions'),
      remitted: val('remitted'),
      section125: val('section125'),
      trust: val('trust'),
      trustee_name: val('trustee_name'),
      trustee_address: val('trustee_address'),
      cobra: val('cobra'),
      cobra_admin: val('cobra_admin'),
      appeals: val('appeals'),
      bargaining: val('bargaining'),
      phi: val('phi'),
      phi_classes: val('phi_classes'),
      certificates: val('certificates'),
      dcap_interest: val('dcap_interest'),
      agent_choice: val('agent_choice'),
      agent_name: val('agent_name'),
      agent_address: val('agent_address'),
      admin_choice: val('admin_choice'),
      admin_name: val('admin_name'),
      signer_name: val('signer_name'),
      signer_title: val('signer_title'),
      governing_body: val('governing_body'),
      contact_name: val('contact_name'),
      contact_email: val('contact_email'),
      contact_phone: val('contact_phone'),
      role: val('role'),
      prior_small_filing: val('prior_small_filing'),
      utm: params.get('utm_source') || '',
      referrer: document.referrer || ''
    };
  }
  function addField(parent, id, label, kind) {
    var wrap = document.createElement('div');
    wrap.className = 'field';
    var lab = document.createElement('label');
    lab.htmlFor = id;
    lab.textContent = label;
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
    input.parentNode.appendChild(err);
  }
  function savedValue(id) {
    var el = $(id);
    return el ? String(el.value || '') : '';
  }
  function fillOptions(select, pairs, current) {
    pairs.forEach(function (pair) {
      var opt = document.createElement('option');
      opt.value = pair[0];
      opt.textContent = pair[1];
      select.appendChild(opt);
    });
    if (current) select.value = current;
  }
  function renderBenefitDetails() {
    var host = $('benefitDetail');
    var codes = selectedBenefits();
    var saved = {};
    ['eap_type', 'std_type', 'hra_type', 'ichra_same_class', 'vol_pretax', 'vol_contrib', 'vol_voluntary', 'vol_endorse', 'vol_payroll_only', 'vol_consideration'].forEach(function (id) {
      saved[id] = savedValue(id);
    });
    var savedCarriers = {};
    var savedWaiting = {};
    var savedTax = {};
    var savedAddr = {};
    var savedFund = {};
    codes.forEach(function (code) {
      savedCarriers[code] = savedValue('carrier_' + code);
      savedWaiting[code] = savedValue('waiting_' + code);
      savedTax[code] = savedValue('tax_' + code);
      savedAddr[code] = savedValue('carrier_address_' + code);
      savedFund[code] = savedValue('benefit_funding_' + code);
    });
    host.textContent = '';
    codes.forEach(function (code) {
      var block = document.createElement('div');
      var title = document.createElement('h3');
      title.textContent = WpModel.benefitLabel(code);
      block.appendChild(title);
      var carrierInput = addField(block, 'carrier_' + code, 'Carrier or administrator');
      carrierInput.value = savedCarriers[code] || '';
      fieldError(carrierInput, 'err_carrier_' + code);
      if (code === 'medical' || code === 'dental' || code === 'vision' || code === 'rx' || code === 'eap') {
        var addr = addField(block, 'carrier_address_' + code, 'Insurer or administrator address');
        addr.value = savedAddr[code] || '';
        fieldError(addr, 'err_carrier_address_' + code);
      }
      if (code !== 'medical' && code !== 'hra' && code !== 'health_fsa') {
        var fund = addField(block, 'benefit_funding_' + code, 'Insured or self-funded', 'select');
        fillOptions(fund, [['insured', 'Fully insured'], ['self', 'Self-funded']], savedFund[code] || 'insured');
      }
      var waiting = addField(block, 'waiting_' + code, 'Waiting period for this benefit');
      waiting.value = savedWaiting[code] || '';
      var tax = addField(block, 'tax_' + code, 'Employee contributions for this benefit', 'select');
      fillOptions(tax, [['none', 'None'], ['pretax', 'Pre-tax'], ['aftertax', 'After tax']], savedTax[code] || 'none');
      host.appendChild(block);
    });
    if (codes.indexOf('eap') !== -1) {
      var eap = addField(host, 'eap_type', 'EAP type', 'select');
      fillOptions(eap, [['', 'Choose'], ['referral', 'Referral only (left out of the wrap)'], ['substantive', 'Provides counseling or other care']], saved.eap_type);
      fieldError(eap, 'err_eap_type');
    }
    if (codes.indexOf('std') !== -1) {
      var std = addField(host, 'std_type', 'How short-term disability is paid', 'select');
      fillOptions(std, [['', 'Choose'], ['insured', 'Insured policy'], ['general-assets', 'Paid from employer general assets'], ['trust', 'Paid from a trust or separate fund']], saved.std_type);
      fieldError(std, 'err_std_type');
    }
    if (codes.indexOf('hra') !== -1) {
      var hra = addField(host, 'hra_type', 'HRA type', 'select');
      fillOptions(hra, [['', 'Choose'], ['integrated', 'Integrated HRA'], ['excepted', 'Excepted-benefit HRA'], ['ichra', 'Individual coverage HRA'], ['qsehra', 'Qualified small employer HRA']], saved.hra_type);
      fieldError(hra, 'err_hra_type');
      var same = addField(host, 'ichra_same_class', 'If this is an individual coverage HRA, is it offered to a class that can also enroll in group medical?', 'select');
      fillOptions(same, [['', 'Not an individual coverage HRA'], ['yes', 'Yes'], ['no', 'No']], saved.ichra_same_class);
    }
    var vol = ['vol_life', 'vol_add', 'accident', 'critical', 'hospital'].some(function (code) { return codes.indexOf(code) !== -1; });
    if (vol) {
      [['vol_pretax', 'Are these voluntary benefits pre-tax through a Section 125 plan?'],
        ['vol_contrib', 'Does the employer contribute toward them?'],
        ['vol_voluntary', 'Is participation voluntary?'],
        ['vol_endorse', 'Does the employer endorse them?'],
        ['vol_payroll_only', 'Is the employer limited to payroll deduction?'],
        ['vol_consideration', 'Does the employer receive any consideration beyond reasonable pay for payroll deduction?']].forEach(function (pair) {
        var sel = addField(host, pair[0], pair[1], 'select');
        fillOptions(sel, [['', 'Choose'], ['no', 'No'], ['yes', 'Yes']], saved[pair[0]]);
        if (pair[0] === 'vol_consideration') fieldError(sel, 'err_vol_consideration');
      });
    }
  }
  function renderFunding() {
    var host = $('fundingFields');
    var saved = {
      funding: savedValue('funding'),
      network: savedValue('network') || 'traditional',
      stop_loss: savedValue('stop_loss'),
      tpa_name: savedValue('tpa_name'),
      tpa_document: savedValue('tpa_document')
    };
    host.textContent = '';
    if (selectedBenefits().indexOf('medical') === -1) {
      var note = document.createElement('p');
      note.textContent = 'No medical benefit is selected. Funding questions for medical stay blank.';
      host.appendChild(note);
      return;
    }
    var funding = addField(host, 'funding', 'Medical funding', 'select');
    fillOptions(funding, [['', 'Choose'], ['insured', 'Fully insured'], ['level', 'Level-funded'], ['aso', 'Self-funded (ASO)'], ['captive', 'Captive'], ['rbp', 'Reference-based pricing']], saved.funding);
    var network = addField(host, 'network', 'Network', 'select');
    fillOptions(network, [['traditional', 'Traditional network'], ['rbp', 'Reference-based pricing']], saved.network);
    var stop = addField(host, 'stop_loss', 'Is stop-loss in place? Terms are not printed.', 'select');
    fillOptions(stop, [['', 'Choose'], ['yes', 'Yes'], ['no', 'No']], saved.stop_loss);
    var tpa = addField(host, 'tpa_name', 'TPA name (self-funded, level-funded, captive, or reference-based pricing)');
    tpa.value = saved.tpa_name;
    var tpaDoc = addField(host, 'tpa_document', 'Name of the TPA plan document or SPD');
    tpaDoc.value = saved.tpa_document;
    ['funding', 'tpa_name', 'tpa_document', 'stop_loss'].forEach(function (id) {
      var err = document.createElement('p');
      err.className = 'field-error';
      err.id = 'err_' + id;
      host.appendChild(err);
    });
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
    if (/_Wrap_Plan\./.test(name)) return pdf ? 'Download Plan (PDF)' : 'Download Plan (Word)';
    if (/_SPD\./.test(name)) return pdf ? 'Download SPD (PDF)' : 'Download SPD (Word)';
    if (/_Schedule_A\./.test(name)) return pdf ? 'Download Schedule A (PDF)' : 'Download Schedule A (Word)';
    if (/_Adoption_Resolution\./.test(name)) return pdf ? 'Download Adoption Resolution (PDF)' : 'Download Adoption Resolution (Word)';
    if (/_HIPAA_Amendment\./.test(name)) return pdf ? 'Download HIPAA Amendment (PDF)' : 'Download HIPAA Amendment (Word)';
    if (/_QMCSO_Procedures\./.test(name)) return pdf ? 'Download QMCSO Procedures (PDF)' : 'Download QMCSO Procedures (Word)';
    if (/_Findings\./.test(name)) return pdf ? 'Download Findings (PDF)' : 'Download Findings (Word)';
    return pdf ? 'Download Explanation (PDF)' : 'Download Explanation (Word)';
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
    if (WpDocgen.needsHipaa(plan)) jobs.push({ rows: WpDocgen.hipaaParagraphs(plan), name: WpDocgen.hipaaFileName(plan), title: 'HIPAA Amendment' });
    if (WpDocgen.needsQmcso(plan)) jobs.push({ rows: WpDocgen.qmcsoParagraphs(plan), name: WpDocgen.qmcsoFileName(plan), title: 'QMCSO Procedures' });
    jobs.push({ rows: WpDocgen.findingsParagraphs(plan, result.findings), name: WpDocgen.findingsFileName(plan), title: 'Findings Report' });
    return jobs;
  }
  function buildWord(jobs, plan) {
    var docx = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    return jobs.map(function (job) {
      return {
        name: job.name,
        mime: docx,
        bytes: WpDocgen.buildDocx(job.rows, { title: job.title, footer: WpDocgen.footerFor(plan, job.title) })
      };
    });
  }
  function buildPdf(jobs, plan) {
    return Promise.all(jobs.map(function (job) {
      return WpPdf.buildPdf(job.rows, {
        title: job.title,
        footer: WpDocgen.footerFor(plan, job.title)
      }).then(function (bytes) {
        return { name: WpDocgen.pdfFileName(job.name), mime: 'application/pdf', bytes: bytes };
      });
    }));
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
      setText('err_consent', 'Confirm the sample terms before building.');
      return;
    }
    var result = WpModel.validate(readPlan());
    if (!result.ok) {
      var order = result.mode === 'explain' ? [2, 7] : [2, 4, 5, 6, 7];
      var target = step;
      for (var i = 0; i < order.length; i++) {
        if (errorsOnStep(result.errors, order[i]).length) {
          target = order[i];
          break;
        }
      }
      showStep(target);
      showErrors(errorsOnStep(result.errors, target));
      if (target === 7) setText('statusLine', 'Fix the items marked above.');
      postParent({ type: 'wp-scroll', step: target });
      return;
    }
    setText('statusLine', 'Your sample is ready to download.');
    var jobs = jobsFor(result);
    var word = buildWord(jobs, result.plan);
    buildPdf(jobs, result.plan).then(function (pdfs) {
      var files = word.concat(pdfs);
      showDownloads(files);
      sendLead(result, files);
    }).catch(function () {
      showDownloads(word);
      setText('statusLine', 'The Word files are ready. The PDF could not be built in this browser.');
    });
  }
  function saveDraft() {
    try { localStorage.setItem(DRAFT_KEY, JSON.stringify(readPlan())); } catch (err) {}
  }
  var STEP_FIELDS = {
    2: ['employer_name', 'employer_ein', 'address', 'plan_number', 'employee_count', 'original_effective_date', 'restatement_date'],
    4: ['benefits', 'hra_type', 'eap_type', 'std_type', 'vol_consideration'],
    5: ['funding', 'tpa_name', 'tpa_document', 'stop_loss', 'census_a', 'trustee_name'],
    6: ['cobra', 'signer_name'],
    7: ['contact_name', 'contact_email']
  };
  function errorsOnStep(errors, n) {
    var fields = STEP_FIELDS[n] || [];
    return (errors || []).filter(function (error) {
      if (fields.indexOf(error.field) !== -1) return true;
      return n === 4 && error.field.indexOf('carrier_') === 0;
    });
  }
  function stepShouldBlock(result, n) {
    if (result.mode === 'explain') return n === 2;
    return n === 2 || n === 4 || n === 5 || n === 6;
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
        vol_pretax: 1, vol_contrib: 1, vol_voluntary: 1, vol_endorse: 1, vol_payroll_only: 1, vol_consideration: 1,
        utm: 1, referrer: 1, address: 1, phi_classes_blank: 1
      };
      Object.keys(data).forEach(function (key) {
        if (later[key]) return;
        var el = $(key);
        if (el && data[key]) el.value = data[key];
      });
      if (data.census) {
        ['a', 'b', 'c', 'd'].forEach(function (part) {
          putValue('census_' + part, data.census[part]);
        });
      }
      if (Array.isArray(data.benefits)) {
        Array.prototype.forEach.call(document.querySelectorAll('input[name="benefits"]'), function (box) {
          box.checked = data.benefits.indexOf(box.value) !== -1;
        });
      }
      renderBenefitDetails();
      renderFunding();
      putValue('funding', data.funding);
      putValue('network', data.network);
      putValue('stop_loss', data.stop_loss);
      putValue('tpa_name', data.tpa_name);
      putValue('tpa_document', data.tpa_document);
      putValue('hra_type', data.hra_type);
      putValue('ichra_same_class', data.ichra_same_class);
      putValue('eap_type', data.eap_type);
      putValue('std_type', data.std_type);
      ['vol_pretax', 'vol_contrib', 'vol_voluntary', 'vol_endorse', 'vol_payroll_only', 'vol_consideration'].forEach(function (key) {
        putValue(key, data[key]);
      });
      Object.keys(data.carriers || {}).forEach(function (code) { putValue('carrier_' + code, data.carriers[code]); });
      Object.keys(data.carrier_addresses || {}).forEach(function (code) { putValue('carrier_address_' + code, data.carrier_addresses[code]); });
      Object.keys(data.waiting || {}).forEach(function (code) { putValue('waiting_' + code, data.waiting[code]); });
      Object.keys(data.tax || {}).forEach(function (code) { putValue('tax_' + code, data.tax[code]); });
      Object.keys(data.benefit_funding || {}).forEach(function (code) { putValue('benefit_funding_' + code, data.benefit_funding[code]); });
    } catch (err) {}
  }
  function mountTips() {
    Array.prototype.forEach.call(document.querySelectorAll('.tip-slot'), function (slot) {
      var tip = WpTips.text(slot.getAttribute('data-tip'));
      if (!tip) return;
      var note = document.createElement('span');
      note.className = 'hint';
      note.textContent = ' ' + tip;
      slot.appendChild(note);
    });
  }
  function mountBenefits() {
    var host = $('benefitBoxes');
    BENEFITS.forEach(function (pair) {
      var label = document.createElement('label');
      label.className = 'check-line';
      var box = document.createElement('input');
      box.type = 'checkbox';
      box.name = 'benefits';
      box.value = pair[0];
      label.appendChild(box);
      label.appendChild(document.createTextNode(' ' + pair[1]));
      host.appendChild(label);
    });
  }
  function syncPanels() {
    $('fiscalWrap').hidden = val('plan_year_type') !== 'fiscal';
    $('restatementWrap').hidden = val('is_restatement') !== 'yes';
    $('trusteeWrap').hidden = val('trust') !== 'yes';
    $('agentWrap').hidden = val('agent_choice') !== 'custom';
    $('adminWrap').hidden = val('admin_choice') !== 'custom';
    var path = val('erisa_path');
    var note = $('explainNote');
    if (path && path !== 'private') {
      note.hidden = false;
      var fake = WpModel.normalize({ erisa_path: path, employer_name: val('employer_name') || 'This employer' });
      note.textContent = WpDocgen.plainText(WpDocgen.explainParagraphs(fake));
    } else note.hidden = true;
    var count = WpModel.countParticipants({ census: { a: val('census_a'), b: val('census_b'), c: val('census_c'), d: val('census_d') } });
    setText('countPreview', 'Covered participants: ' + count + '.');
  }

  document.addEventListener('DOMContentLoaded', function () {
    mountBenefits();
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
      if (step === 4) renderFunding();
      if (step === 6) paintReview(result);
      showStep(step + 1);
    });
    $('buildBtn').addEventListener('click', function (event) {
      event.preventDefault();
      build();
    });
    $('wizard').addEventListener('submit', function (event) { event.preventDefault(); build(); });
    $('wizard').addEventListener('change', function (event) {
      if (event.target && event.target.name === 'benefits') renderBenefitDetails();
      syncPanels();
    });
    $('wizard').addEventListener('input', function () { saveDraft(); syncPanels(); });
    syncPanels();
  });
})();
