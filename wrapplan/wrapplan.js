/**
 * Wrap plan preview. Files are built in the browser.
 * The page does not tell the visitor that a message will be sent.
 */
(function () {
  var STEPS = ['Your company', 'Your plan', 'Benefits', 'Who is eligible', 'Plan size and COBRA', 'Sign and finish'];
  var GROUPS = [
    ['Health', [['medical', 'Medical'], ['dental', 'Dental'], ['vision', 'Vision'], ['rx', 'Prescription drugs (separate from medical)']]],
    ['Accounts', [['hra', 'Health Reimbursement Arrangement (HRA)'], ['health_fsa', 'Health FSA'], ['lpfsa', 'Limited purpose FSA']]],
    ['Income and life', [['life', 'Group life'], ['add', 'AD&D'], ['std', 'Short-term disability'], ['ltd', 'Long-term disability']]],
    ['Other', [['eap', 'Employee assistance program']]],
    ['Voluntary', [['vol_life', 'Voluntary life'], ['vol_add', 'Voluntary AD&D'], ['accident', 'Accident'], ['critical', 'Critical illness'], ['hospital', 'Hospital indemnity']]]
  ];
  var BENEFITS = GROUPS.reduce(function (list, group) { return list.concat(group[1]); }, []);
  var VOL = ['vol_life', 'vol_add', 'accident', 'critical', 'hospital'];
  var SELF_BOX = { dental: 1, vision: 1, life: 1, add: 1, ltd: 1, eap: 1 };
  var SELF_FUNDING = ['level', 'aso', 'captive', 'rbp'];
  var AUTO_PAID = ['life', 'add', 'ltd', 'std', 'eap'];
  var step = 0;
  var startedAt = Date.now();
  var DRAFT_KEY = 'wp-draft-v4';
  var planCustom = false;
  var adopterCustom = false;
  var fromReview = false;
  var resumeBuild = false;
  var restoring = false;

  function $(id) { return document.getElementById(id); }
  function val(id) {
    var el = $(id);
    return el ? String(el.value || '').trim() : '';
  }
  function setText(id, text) {
    var el = $(id);
    if (el) el.textContent = text || '';
  }
  function checkedRadio(name) {
    var el = document.querySelector('input[name="' + name + '"]:checked');
    return el ? el.value : '';
  }
  function selectedBenefits() {
    return Array.prototype.map.call(document.querySelectorAll('input[name="benefits"]:checked'), function (box) { return box.value; });
  }
  function hasCode(code) { return selectedBenefits().indexOf(code) !== -1; }
  function formMedicalSelf() { return hasCode('medical') && SELF_FUNDING.indexOf(checkedRadio('funding')) !== -1; }
  function digitsOnly(value, max) {
    var digits = String(value || '').replace(/\D/g, '');
    return max ? digits.slice(0, max) : digits;
  }
  function formatPhoneInput(el) {
    var digits = digitsOnly(el.value, 10);
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
  function longUS(iso) {
    var match = String(iso || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!match) return '';
    return WpModel.monthName(Number(match[2])) + ' ' + Number(match[3]) + ', ' + match[1];
  }
  function choice(name, value, title, line) {
    var label = document.createElement('label');
    label.className = 'choice';
    var input = document.createElement('input');
    input.type = 'radio';
    input.name = name;
    input.value = value;
    var text = document.createElement('span');
    var strong = document.createElement('span');
    strong.className = 'choice-name';
    strong.textContent = title;
    text.appendChild(strong);
    if (line) {
      var small = document.createElement('span');
      small.className = 'choice-line';
      small.textContent = line;
      text.appendChild(small);
    }
    label.appendChild(input);
    label.appendChild(text);
    return label;
  }
  function fillChoices(id, name, options) {
    var host = $(id);
    host.textContent = '';
    options.forEach(function (option) { host.appendChild(choice(name, option[0], option[1], option[2])); });
  }
  function fillSelect(select, pairs) {
    select.textContent = '';
    pairs.forEach(function (pair) {
      var opt = document.createElement('option');
      opt.value = pair[0];
      opt.textContent = pair[1];
      select.appendChild(opt);
    });
  }
  function fieldError(parent, id) {
    var err = document.createElement('p');
    err.className = 'field-error';
    err.id = id;
    err.setAttribute('role', 'alert');
    parent.appendChild(err);
  }
  var openTipBtn = null;
  function infoButton(tipId) {
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'info';
    btn.textContent = 'i';
    btn.setAttribute('data-tip', tipId);
    btn.setAttribute('aria-label', 'More information');
    btn.setAttribute('aria-expanded', 'false');
    btn.setAttribute('aria-controls', 'tipPopover');
    btn.addEventListener('click', function (event) {
      event.preventDefault();
      event.stopPropagation();
      toggleTip(btn);
    });
    return btn;
  }
  function ensurePopover() {
    var pop = $('tipPopover');
    if (pop) return pop;
    pop = document.createElement('div');
    pop.id = 'tipPopover';
    pop.className = 'tip-pop';
    pop.setAttribute('role', 'dialog');
    pop.hidden = true;
    var text = document.createElement('p');
    text.id = 'tipBody';
    pop.appendChild(text);
    document.body.appendChild(pop);
    return pop;
  }
  function closeTip() {
    var pop = $('tipPopover');
    if (pop) pop.hidden = true;
    if (openTipBtn) {
      openTipBtn.setAttribute('aria-expanded', 'false');
      openTipBtn.removeAttribute('aria-describedby');
      openTipBtn = null;
    }
  }
  function placeTip(btn) {
    var pop = $('tipPopover');
    var rect = btn.getBoundingClientRect();
    var width = Math.min(300, window.innerWidth - 16);
    pop.style.width = width + 'px';
    var left = rect.left;
    if (left + width > window.innerWidth - 8) left = window.innerWidth - 8 - width;
    if (left < 8) left = 8;
    var top = rect.bottom + 6;
    pop.style.left = left + 'px';
    pop.style.top = top + 'px';
    var box = pop.getBoundingClientRect();
    var phone = window.innerWidth < 720;
    if (!phone && box.bottom > window.innerHeight - 8) {
      var above = rect.top - box.height - 6;
      if (above >= 8) pop.style.top = above + 'px';
    }
    box = pop.getBoundingClientRect();
    if (box.bottom > window.innerHeight - 8) {
      var fitted = Math.max(rect.bottom + 6, window.innerHeight - box.height - 8);
      if (phone) fitted = Math.min(fitted, window.innerHeight - box.height - 8);
      pop.style.top = Math.max(8, fitted) + 'px';
    }
  }
  function toggleTip(btn) {
    var pop = ensurePopover();
    if (openTipBtn === btn && !pop.hidden) {
      closeTip();
      return;
    }
    closeTip();
    $('tipBody').textContent = (window.WpTips && WpTips.text(btn.getAttribute('data-tip'))) || '';
    pop.hidden = false;
    btn.setAttribute('aria-expanded', 'true');
    btn.setAttribute('aria-describedby', 'tipBody');
    openTipBtn = btn;
    placeTip(btn);
  }
  function mountTips() {
    Array.prototype.forEach.call(document.querySelectorAll('[data-tip]'), function (el) {
      if (el.classList.contains('info')) return;
      if (el.querySelector('.info')) return;
      el.appendChild(infoButton(el.getAttribute('data-tip')));
    });
  }
  function questionLabel(text, tipId) {
    var p = document.createElement('p');
    p.className = 'q-label';
    p.appendChild(document.createTextNode(text));
    if (tipId) p.appendChild(infoButton(tipId));
    return p;
  }
  function segment(name, value, title) {
    var label = document.createElement('label');
    label.className = 'segment-item';
    var input = document.createElement('input');
    input.type = 'radio';
    input.name = name;
    input.value = value;
    var text = document.createElement('span');
    text.textContent = title;
    label.appendChild(input);
    label.appendChild(text);
    return label;
  }
  function addInput(parent, id, labelText, tipId) {
    var wrap = document.createElement('div');
    wrap.className = 'field';
    var lab = document.createElement('label');
    lab.htmlFor = id;
    lab.appendChild(document.createTextNode(labelText));
    if (tipId) lab.appendChild(infoButton(tipId));
    var input = document.createElement('input');
    input.type = 'text';
    input.id = id;
    wrap.appendChild(lab);
    wrap.appendChild(input);
    parent.appendChild(wrap);
    return input;
  }
  function readPlan() {
    var codes = selectedBenefits();
    var carriers = {};
    var addresses = {};
    var tax = {};
    var benefitFunding = {};
    var overrides = {};
    var overrideOther = {};
    codes.forEach(function (code) {
      carriers[code] = val('carrier_' + code);
      if (code !== 'hra') tax[code] = checkedRadio('tax_' + code);
      if (SELF_BOX[code]) benefitFunding[code] = $('self_' + code) && $('self_' + code).checked ? 'self' : 'insured';
      var over = val('waitover_sel_' + code);
      if ($('waitingOverrides') && !$('waitingOverrides').hidden && over && over !== 'same') {
        overrides[code] = over;
        overrideOther[code] = val('waitover_other_' + code);
      }
    });
    var first = checkedRadio('first_wrap');
    var effect = checkedRadio('effective_choice');
    var startMonth = val('plan_year_start_month');
    var choices = startMonth ? WpModel.effectiveDateChoices(Number(startMonth), new Date()) : { current: '', next: '' };
    var effectDate = effect === 'current' ? choices.current : effect === 'next' ? choices.next : val('wrap_effective_date');
    var replacing = first === 'no';
    var selfMedical = formMedicalSelf();
    var cobraWho = checkedRadio('cobra_who');
    var cobraAdmin = cobraWho === 'admin' ? val('cobra_admin') : cobraWho === 'carrier' ? 'the insurance company' : cobraWho === 'employer' ? 'the employer' : '';
    var params = new URLSearchParams(location.search);
    return {
      erisa_path: 'private',
      employer_name: val('employer_name'),
      employer_ein: val('employer_ein'),
      phone: val('phone'),
      street: val('street'),
      city: val('city'),
      state: val('state'),
      zip: val('zip'),
      business_type: val('business_type'),
      plan_name: planCustom ? val('plan_name') : '',
      plan_number: planCustom ? val('plan_number') : '501',
      plan_year_start_month: startMonth,
      first_wrap: first,
      is_restatement: replacing ? 'yes' : 'no',
      original_effective_date: replacing ? val('original_effective_date') : effectDate,
      restatement_date: replacing ? effectDate : '',
      employee_count: val('employee_count'),
      benefits: codes,
      carriers: carriers,
      carrier_addresses: addressesFrom(codes, addresses),
      tax: tax,
      benefit_funding: benefitFunding,
      waiting_period: val('waiting_period'),
      waiting_other: val('waiting_other'),
      waiting_overrides: overrides,
      waiting_override_other: overrideOther,
      funding: hasCode('medical') ? checkedRadio('funding') : '',
      network: selfMedical ? (checkedRadio('network') || (checkedRadio('funding') === 'rbp' ? 'rbp' : 'traditional')) : 'traditional',
      stop_loss: selfMedical ? checkedRadio('stop_loss') : '',
      tpa_name: selfMedical ? val('tpa_name') : '',
      tpa_document: selfMedical ? val('tpa_document') : '',
      hra_type: hasCode('hra') ? checkedRadio('hra_type') : '',
      ichra_same_class: hasCode('hra') && checkedRadio('hra_type') === 'ichra' ? checkedRadio('ichra_same_class') : '',
      eap_type: hasCode('eap') ? checkedRadio('eap_type') : '',
      std_type: hasCode('std') ? checkedRadio('std_type') : '',
      vol_include: checkedRadio('vol_include'),
      classes: val('classes'),
      hours: val('hours'),
      dependents: val('dependents'),
      census: { a: val('census_a'), b: '0', c: '0', d: '0' },
      section125: $('section125Wrap') && !$('section125Wrap').hidden ? checkedRadio('section125') : '',
      trust: checkedRadio('trust') || 'no',
      trustee_name: checkedRadio('trust') === 'yes' ? val('trustee_name') : '',
      trustee_address: checkedRadio('trust') === 'yes' ? val('trustee_address') : '',
      cobra: Number(val('employee_count')) >= 20 ? checkedRadio('cobra') : '',
      cobra_admin: checkedRadio('cobra') === 'yes' ? cobraAdmin : '',
      appeals: selfMedical ? (checkedRadio('appeals') || 'carrier') : 'carrier',
      bargaining: checkedRadio('bargaining') || 'no',
      phi: selfMedical ? 'yes' : (checkedRadio('phi') || 'no'),
      phi_classes: val('phi_classes'),
      discretion: checkedRadio('discretion') || 'yes',
      agent_choice: checkedRadio('agent_choice') || 'employer',
      agent_name: val('agent_name'),
      agent_address: val('agent_address'),
      admin_choice: checkedRadio('admin_choice') || 'employer',
      admin_name: val('admin_name'),
      governing_body: adopterCustom ? val('governing_body') : '',
      signer_name: val('signer_name'),
      signer_title: val('signer_title'),
      contact_name: val('contact_name'),
      contact_email: val('contact_email'),
      contact_phone: val('contact_phone'),
      role: checkedRadio('role') || 'employer',
      utm: params.get('utm_source') || '',
      referrer: document.referrer || ''
    };
  }
  function addressesFrom(codes, addresses) {
    codes.forEach(function (code) {
      if (code === 'medical' || code === 'dental' || code === 'vision' || code === 'rx' || (code === 'eap' && checkedRadio('eap_type') === 'substantive')) {
        addresses[code] = val('carrier_address_' + code);
      }
    });
    return addresses;
  }
  function mountStatic() {
    fillSelect($('state'), [['', 'Choose']].concat(WpModel.STATES.map(function (code) { return [code, code]; })));
    fillSelect($('business_type'), [
      ['', 'Choose'],
      ['llc', 'LLC'],
      ['scorp', 'S corporation'],
      ['ccorp', 'C corporation'],
      ['partnership', 'Partnership'],
      ['sole', 'Sole proprietor'],
      ['nonprofit', 'Nonprofit'],
      ['other', 'Other']
    ]);
    var months = [['', 'Choose']];
    for (var m = 1; m <= 12; m++) months.push([String(m), WpModel.monthName(m)]);
    fillSelect($('plan_year_start_month'), months);
    fillChoices('firstWrapChoices', 'first_wrap', [
      ['yes', 'Yes, this is our first one', ''],
      ['no', 'No, this replaces an older one', '']
    ]);
    fillChoices('volIncludeChoices', 'vol_include', [
      ['yes', 'Yes, include them', 'Most employers do.'],
      ['no', 'No, leave them out', 'Only works if the employer pays nothing, takes deductions after tax, and only collects payroll deductions without promoting the coverage or being paid for offering it.']
    ]);
    fillChoices('section125Choices', 'section125', [['yes', 'Yes', ''], ['no', 'No', ''], ['notsure', 'Not sure', '']]);
    fillChoices('cobraChoices', 'cobra', [['yes', 'Yes', ''], ['no', 'No', '']]);
    fillChoices('cobraWhoChoices', 'cobra_who', [
      ['employer', 'We do', ''],
      ['carrier', 'Our insurance company', ''],
      ['admin', 'A COBRA administrator', '']
    ]);
    fillChoices('appealChoices', 'appeals', [['carrier', 'The TPA', ''], ['employer', 'We do (the employer)', '']]);
    fillChoices('trustChoices', 'trust', [['no', 'No', ''], ['yes', 'Yes', '']]);
    fillChoices('bargainChoices', 'bargaining', [['no', 'No', ''], ['yes', 'Yes', '']]);
    fillChoices('discretionChoices', 'discretion', [['yes', 'Include', ''], ['no', 'Leave out', '']]);
    fillChoices('adminChoices', 'admin_choice', [['employer', 'The company', ''], ['custom', 'Someone else', '']]);
    fillChoices('agentChoices', 'agent_choice', [['employer', 'The company', ''], ['custom', 'Someone else', '']]);
    fillChoices('phiChoices', 'phi', [['no', 'No', ''], ['yes', 'Yes', '']]);
    fillChoices('roleChoices', 'role', [
      ['employer', 'Employer', ''],
      ['broker', 'Broker or consultant', ''],
      ['tpa', 'TPA', ''],
      ['advisor', 'Attorney or CPA', ''],
      ['other', 'Other', '']
    ]);
    fillChoices('pathChoices', 'erisa_path', [
      ['governmental', 'Government employer', ''],
      ['church', 'Church plan', ''],
      ['owner-only', 'Only owners covered', '']
    ]);
    var role = document.querySelector('input[name="role"][value="employer"]');
    if (role) role.checked = true;
    var trust = document.querySelector('input[name="trust"][value="no"]');
    if (trust) trust.checked = true;
    var bargain = document.querySelector('input[name="bargaining"][value="no"]');
    if (bargain) bargain.checked = true;
    var discretion = document.querySelector('input[name="discretion"][value="yes"]');
    if (discretion) discretion.checked = true;
    var admin = document.querySelector('input[name="admin_choice"][value="employer"]');
    if (admin) admin.checked = true;
    var agent = document.querySelector('input[name="agent_choice"][value="employer"]');
    if (agent) agent.checked = true;
    var phi = document.querySelector('input[name="phi"][value="no"]');
    if (phi) phi.checked = true;
    setText('termsText', WpTerms.TEXT);
    var pairs = [['', 'Choose']];
    WpModel.WAITING_OPTIONS.forEach(function (option) { pairs.push([option.id, option.menu]); });
    fillSelect($('waiting_period'), pairs);
  }
  function mountBenefits() {
    var host = $('benefitGroups');
    GROUPS.forEach(function (group) {
      var block = document.createElement('div');
      block.className = 'benefit-block';
      var title = document.createElement('h3');
      title.textContent = group[0];
      var grid = document.createElement('div');
      grid.className = 'benefit-grid';
      group[1].forEach(function (pair) { grid.appendChild(benefitItem(pair[0], pair[1])); });
      block.appendChild(title);
      block.appendChild(grid);
      host.appendChild(block);
    });
    var hostWait = $('waitingOverrides');
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
      var pairs = [['same', 'Same as the plan']];
      WpModel.WAITING_OPTIONS.forEach(function (option) { pairs.push([option.id, option.menu]); });
      fillSelect(sel, pairs);
      var other = document.createElement('input');
      other.type = 'text';
      other.id = 'waitover_other_' + pair[0];
      other.placeholder = 'Describe the waiting period';
      other.hidden = true;
      wrap.appendChild(lab);
      wrap.appendChild(sel);
      wrap.appendChild(other);
      fieldError(wrap, 'err_waitover_other_' + pair[0]);
      hostWait.appendChild(wrap);
    });
  }
  function benefitItem(code, label) {
    var item = document.createElement('div');
    item.className = 'benefit-item';
    var boxLabel = document.createElement('label');
    boxLabel.className = 'check-line';
    var box = document.createElement('input');
    box.type = 'checkbox';
    box.name = 'benefits';
    box.value = code;
    boxLabel.appendChild(box);
    boxLabel.appendChild(document.createTextNode(' ' + label));
    item.appendChild(boxLabel);
    if (code === 'lpfsa') {
      item.classList.add('has-note');
      var note = document.createElement('p');
      note.className = 'hint benefit-note';
      note.textContent = 'Covers dental and vision expenses, and preventive care if the plan allows, so it stays compatible with a health savings account.';
      item.appendChild(note);
    }
    var panel = document.createElement('div');
    panel.className = 'benefit-fields';
    panel.id = 'panel_' + code;
    panel.hidden = true;
    fillPanel(panel, code);
    item.appendChild(panel);
    return item;
  }
  function paySegment(panel, code) {
    var row = document.createElement('div');
    row.className = 'pay-row';
    row.appendChild(questionLabel('Who pays?', 'who_pays'));
    var pays = document.createElement('div');
    pays.className = 'segment';
    pays.setAttribute('role', 'radiogroup');
    pays.setAttribute('aria-label', 'Who pays?');
    var taxDefault = WpModel.PRETAC_TAX[code] ? 'pretax' : (WpModel.EMPLOYER_TAX[code] ? 'none' : '');
    [
      ['none', 'Employer pays'],
      ['pretax', 'Employees pay, pre-tax'],
      ['aftertax', 'Employees pay, after tax']
    ].forEach(function (option) {
      var node = segment('tax_' + code, option[0], option[1]);
      if (taxDefault && option[0] === taxDefault) node.querySelector('input').checked = true;
      pays.appendChild(node);
    });
    row.appendChild(pays);
    panel.appendChild(row);
    fieldError(panel, 'err_tax_' + code);
  }
  function selfBox(panel, code) {
    var self = document.createElement('label');
    self.className = 'check-line';
    var selfInput = document.createElement('input');
    selfInput.type = 'checkbox';
    selfInput.id = 'self_' + code;
    self.appendChild(selfInput);
    self.appendChild(document.createTextNode(' Self-funded?'));
    self.appendChild(infoButton('self_funded'));
    panel.appendChild(self);
  }
  function fillPanel(panel, code) {
    var top = document.createElement('div');
    top.className = 'pair-fields';
    addInput(top, 'carrier_' + code, 'Insurance company or administrator');
    fieldError(top, 'err_carrier_' + code);
    if (code === 'medical' || code === 'dental' || code === 'vision' || code === 'eap') {
      var addr = addInput(top, 'carrier_address_' + code, 'Insurer mailing address (optional)');
      var hint = document.createElement('p');
      hint.className = 'hint';
      hint.textContent = 'On your certificate. Leave blank to fill in later.';
      addr.parentNode.appendChild(hint);
      if (code === 'eap') addr.parentNode.id = 'eapAddressWrap';
    }
    panel.appendChild(top);
    if (code === 'hra') {
      var fixed = document.createElement('p');
      fixed.className = 'q-label';
      fixed.textContent = 'Employer paid';
      panel.appendChild(fixed);
      panel.appendChild(questionLabel('HRA type', 'hra_type'));
      var types = document.createElement('div');
      types.id = 'hra_type_group';
      types.className = 'choices';
      [
        ['integrated', 'Integrated with our medical plan', ''],
        ['excepted', 'Excepted benefit HRA', ''],
        ['ichra', 'Individual coverage HRA (ICHRA)', ''],
        ['qsehra', 'Small employer HRA (QSEHRA)', '']
      ].forEach(function (option) { types.appendChild(choice('hra_type', option[0], option[1], option[2])); });
      panel.appendChild(types);
      fieldError(panel, 'err_hra_type');
      var ichra = document.createElement('div');
      ichra.id = 'ichraWrap';
      ichra.hidden = true;
      var same = document.createElement('div');
      same.className = 'choices';
      [['yes', 'Yes', ''], ['no', 'No', '']].forEach(function (option) {
        same.appendChild(choice('ichra_same_class', option[0], 'Offered to a class that can also enroll in group medical? ' + option[1], ''));
      });
      ichra.appendChild(same);
      panel.appendChild(ichra);
      return;
    }
    paySegment(panel, code);
    if (SELF_BOX[code]) selfBox(panel, code);
    if (code === 'medical') {
      panel.appendChild(questionLabel('How is medical funded?', 'funding'));
      var funding = document.createElement('div');
      funding.className = 'choices';
      funding.id = 'fundingChoices';
      [
        ['insured', 'Fully insured', 'You pay a premium. The insurance company pays claims.'],
        ['level', 'Level-funded', 'A level monthly cost. Claims are paid from a claims fund with stop-loss.'],
        ['aso', 'Self-funded through a TPA', 'You pay claims as they come in. A TPA processes them.'],
        ['captive', 'Captive', 'Self-funded, with stop-loss bought through a group captive.'],
        ['rbp', 'Reference-based pricing', 'Self-funded, and providers are paid based on Medicare rates.']
      ].forEach(function (option) { funding.appendChild(choice('funding', option[0], option[1], option[2])); });
      panel.appendChild(funding);
      var how = document.createElement('details');
      how.className = 'how';
      how.innerHTML = '<summary>How do I know?</summary><p>Look at your renewal. A premium per person from an insurance company, with no claims fund or stop-loss, is fully insured. If you see a TPA, a claims fund, or stop-loss, it is one of the self-funded types.</p>';
      panel.appendChild(how);
      fieldError(panel, 'err_funding');
      var selfWrap = document.createElement('div');
      selfWrap.id = 'selfFundedWrap';
      selfWrap.hidden = true;
      addInput(selfWrap, 'tpa_name', 'TPA name');
      fieldError(selfWrap, 'err_tpa_name');
      addInput(selfWrap, 'tpa_document', 'TPA plan document or SPD name', 'tpa_document');
      fieldError(selfWrap, 'err_tpa_document');
      selfWrap.appendChild(questionLabel('Stop-loss', 'stop_loss'));
      var stop = document.createElement('div');
      stop.className = 'choices';
      [['yes', 'Yes', ''], ['no', 'No', '']].forEach(function (option) { stop.appendChild(choice('stop_loss', option[0], option[1], option[2])); });
      selfWrap.appendChild(stop);
      fieldError(selfWrap, 'err_stop_loss');
      var network = document.createElement('div');
      network.className = 'choices';
      [['traditional', 'Provider network', ''], ['rbp', 'Providers paid from Medicare rates', '']].forEach(function (option) {
        network.appendChild(choice('network', option[0], option[1], option[2]));
      });
      selfWrap.appendChild(network);
      panel.appendChild(selfWrap);
    }
    if (code === 'eap') {
      panel.appendChild(questionLabel('What does the EAP provide?', 'eap_type'));
      var eap = document.createElement('div');
      eap.className = 'choices';
      [['substantive', 'Counseling sessions', ''], ['referral', 'Only referrals', '']].forEach(function (option) {
        eap.appendChild(choice('eap_type', option[0], option[1], option[2]));
      });
      panel.appendChild(eap);
      fieldError(panel, 'err_eap_type');
    }
    if (code === 'std') {
      panel.appendChild(questionLabel('How is short-term disability paid?', 'std_type'));
      var std = document.createElement('div');
      std.className = 'choices';
      [
        ['insured', 'Insured policy', ''],
        ['general-assets', 'Paid from employer general assets', ''],
        ['trust', 'Paid from a trust or separate fund', '']
      ].forEach(function (option) { std.appendChild(choice('std_type', option[0], option[1], option[2])); });
      panel.appendChild(std);
      fieldError(panel, 'err_std_type');
    }
  }
  function paintEffective() {
    var host = $('effectiveChoices');
    var startRaw = val('plan_year_start_month');
    var current = checkedRadio('effective_choice');
    host.textContent = '';
    if (!startRaw) return;
    var start = Number(startRaw);
    var choices = WpModel.effectiveDateChoices(start, new Date());
    [
      ['current', 'Start of this plan year: ' + longUS(choices.current), ''],
      ['next', 'Start of next plan year: ' + longUS(choices.next), ''],
      ['other', 'Another date', '']
    ].forEach(function (option) { host.appendChild(choice('effective_choice', option[0], option[1], option[2])); });
    if (current) {
      var again = document.querySelector('input[name="effective_choice"][value="' + current + '"]');
      if (again) again.checked = true;
    }
  }
  function paintPlanLine() {
    var name = val('employer_name') || 'Company';
    setText('planDefaultText', name + ' Group Welfare Benefit Plan, plan number ' + (planCustom ? (val('plan_number') || '501') : '501') + '.');
  }
  function paintAdopter() {
    var body = adopterCustom ? val('governing_body') : (WpModel.BUSINESS_TYPES[val('business_type')] || 'the governing body');
    setText('adopterText', body);
  }
  function anyPretaxSelected() {
    return selectedBenefits().some(function (code) { return code !== 'hra' && checkedRadio('tax_' + code) === 'pretax'; });
  }
  function askVoluntary() {
    var picked = selectedBenefits().filter(function (code) { return VOL.indexOf(code) !== -1; });
    if (!picked.length) return false;
    return picked.every(function (code) {
      var tax = checkedRadio('tax_' + code);
      return tax !== 'pretax' && tax !== 'none';
    });
  }
  function sync() {
    selectedBenefits();
    BENEFITS.forEach(function (pair) {
      var panel = $('panel_' + pair[0]);
      if (panel) {
        panel.hidden = !hasCode(pair[0]);
        if (panel.parentNode) {
          var open = !!hasCode(pair[0]);
          var wide = pair[0] === 'medical' || pair[0] === 'hra' || pair[0] === 'eap' || pair[0] === 'std';
          var side = pair[0] === 'dental' || pair[0] === 'vision';
          panel.parentNode.classList.toggle('is-open', open);
          panel.parentNode.classList.toggle('is-wide', open && wide);
          panel.parentNode.classList.toggle('is-line', open && !wide && !side);
        }
      }
      var over = $('waitover_' + pair[0]);
      if (over) over.hidden = !hasCode(pair[0]) || $('waitingOverrides').hidden;
    });
    var self = $('selfFundedWrap');
    if (self) self.hidden = !formMedicalSelf();
    var eapAddr = $('eapAddressWrap');
    if (eapAddr) eapAddr.hidden = checkedRadio('eap_type') !== 'substantive';
    var ichra = $('ichraWrap');
    if (ichra) ichra.hidden = !(hasCode('hra') && checkedRadio('hra_type') === 'ichra');
    $('originalWrap').hidden = checkedRadio('first_wrap') !== 'no';
    $('otherDateWrap').hidden = checkedRadio('effective_choice') !== 'other';
    $('waitingOtherWrap').hidden = val('waiting_period') !== 'other';
    $('volAsk').hidden = !askVoluntary();
    $('section125Wrap').hidden = !anyPretaxSelected();
    var note = $('section125Note');
    if (note) note.hidden = checkedRadio('section125') !== 'no' && checkedRadio('section125') !== 'notsure';
    var count = Number(val('employee_count'));
    $('cobraWrap').hidden = !(count >= 20);
    $('cobraWhoWrap').hidden = !(count >= 20 && checkedRadio('cobra') === 'yes');
    $('cobraAdminWrap').hidden = checkedRadio('cobra_who') !== 'admin';
    $('selfMedicalStep').hidden = !formMedicalSelf();
    $('phiInsured').hidden = formMedicalSelf() || !hasCode('medical');
    var phiField = $('phiStep');
    if (phiField) {
      if (formMedicalSelf()) $('selfMedicalStep').appendChild(phiField);
      else if (checkedRadio('phi') === 'yes') $('phiLess').appendChild(phiField);
    }
    if ($('phiLess')) $('phiLess').hidden = checkedRadio('phi') !== 'yes' || formMedicalSelf();
    $('trusteeWrap').hidden = checkedRadio('trust') !== 'yes';
    $('adminWrap').hidden = checkedRadio('admin_choice') !== 'custom';
    $('agentWrap').hidden = checkedRadio('agent_choice') !== 'custom';
    var auto = AUTO_PAID.filter(function (code) { return hasCode(code) && checkedRadio('tax_' + code) === 'none'; })[0];
    var autoNote = $('autoCoverNote');
    if (auto) {
      var label = BENEFITS.filter(function (pair) { return pair[0] === auto; })[0][1];
      autoNote.hidden = false;
      autoNote.textContent = 'Your ' + label + ' is employer paid, so everyone eligible for it counts. This is usually all eligible employees.';
    } else autoNote.hidden = true;
    paintPlanLine();
    paintAdopter();
  }
  function showStep(n) {
    step = n;
    Array.prototype.forEach.call(document.querySelectorAll('[data-step]'), function (section) {
      section.hidden = Number(section.getAttribute('data-step')) !== n;
    });
    var kicker = $('stepKicker');
    var bar = $('progressBar');
    if (n >= 1 && n <= 6) {
      kicker.hidden = false;
      bar.hidden = false;
      kicker.textContent = 'Step ' + n + ' of 6: ' + STEPS[n - 1];
      $('progressFill').style.width = ((n / 6) * 100) + '%';
      document.title = 'Step ' + n + ' of 6: ' + STEPS[n - 1];
    } else {
      kicker.hidden = true;
      bar.hidden = true;
    }
    if (n === 6) fromReview = false;
    if (n === 0 || n === 7) resumeBuild = false;
    $('backBtn').hidden = n === 0 || n === 7;
    $('reviewBtn').hidden = !fromReview || n === 0 || n === 6 || n === 7;
    $('nextBtn').hidden = n === 6 || n === 7 || (resumeBuild && n !== 0);
    $('nextBtn').textContent = n === 0 ? 'Start' : 'Next';
    $('returnBtn').hidden = !resumeBuild || n === 0 || n === 7;
    $('buildBtn').hidden = n !== 6 || resumeBuild;
    $('navRow').hidden = n === 7;
    if (n === 6) paintAnswers();
    var title = document.querySelector('[data-step="' + n + '"] h2');
    if (title) title.focus();
  }
  function paintAnswers() {
    var plan = WpModel.normalize(readPlan());
    var card = $('answerCard');
    card.textContent = '';
    var heading = document.createElement('h3');
    heading.textContent = 'Check your answers';
    card.appendChild(heading);
    var effect = plan.is_restatement === 'yes' ? plan.restatement_date : plan.original_effective_date;
    var lines = [
      [1, plan.employer_name + ', ' + plan.city + ' ' + plan.state + '. EIN ' + plan.employer_ein + '.'],
      [2, 'Plan year starts ' + WpModel.monthName(WpModel.planYearFromStart(plan.plan_year_start_month || 1).plan_year_start_month) + '. Effective ' + longUS(effect) + '. ' + (plan.is_restatement === 'yes' ? 'Replaces an older document.' : 'First wrap.')],
      [3, WpModel.wrappedBenefits(plan).map(function (code) {
        return WpModel.benefitLabel(code) + ' (' + ((plan.carriers || {})[code] || 'carrier') + (code === 'medical' && plan.funding ? ', ' + WpModel.fundingLabel(plan.funding).toLowerCase() : '') + ')';
      }).join(', ') + '.'],
      [4, (plan.classes || 'Eligible employees') + ', ' + (plan.hours || '') + '. Coverage starts ' + lowerFirst((plan.waiting && plan.waiting[plan.benefits[0]]) || 'when you choose') + '.'],
      [5, (plan.census.a || '0') + ' people covered. ' + (plan.cobra === 'yes' ? 'Federal COBRA applies.' : 'Federal COBRA does not apply.')]
    ];
    lines.forEach(function (line) {
      var row = document.createElement('p');
      row.className = 'answer-line';
      var text = document.createElement('span');
      text.textContent = line[1];
      var edit = document.createElement('button');
      edit.type = 'button';
      edit.className = 'text-link';
      edit.textContent = 'Edit';
      edit.addEventListener('click', function () {
        fromReview = true;
        showStep(line[0]);
      });
      row.appendChild(text);
      row.appendChild(edit);
      card.appendChild(row);
    });
  }
  function clearErrors() {
    Array.prototype.forEach.call(document.querySelectorAll('.field-error'), function (el) { el.textContent = ''; });
    Array.prototype.forEach.call(document.querySelectorAll('[aria-invalid="true"]'), function (el) { el.removeAttribute('aria-invalid'); });
  }
  var STEP_FIELDS = {
    1: ['employer_name', 'employer_ein', 'phone', 'address', 'business_type'],
    2: ['plan_year_start_month', 'wrap_effective_date', 'original_effective_date', 'plan_number', 'employee_count'],
    3: ['benefits', 'funding', 'tpa_name', 'tpa_document', 'stop_loss', 'hra_type', 'eap_type', 'std_type', 'vol_include'],
    4: ['waiting_period', 'waiting_other'],
    5: ['census_a', 'section125', 'cobra', 'cobra_admin'],
    6: ['signer_name', 'contact_name', 'contact_email']
  };
  function errorsOnStep(errors, n) {
    var fields = STEP_FIELDS[n] || [];
    return (errors || []).filter(function (error) {
      if (fields.indexOf(error.field) !== -1) return true;
      if (n === 3 && (error.field.indexOf('carrier_') === 0 || error.field.indexOf('tax_') === 0)) return true;
      return n === 4 && error.field.indexOf('waitover_') === 0;
    });
  }
  function showErrors(errors) {
    errors.forEach(function (error) {
      setText('err_' + error.field, error.message);
      var el = $(error.field);
      if (el) el.setAttribute('aria-invalid', 'true');
    });
  }
  function lowerFirst(text) {
    text = String(text || '');
    if (!text) return text;
    return text.charAt(0).toLowerCase() + text.slice(1);
  }
  function snapshotFields() {
    var fields = [];
    Array.prototype.forEach.call(document.querySelectorAll('#wizard input, #wizard select, #wizard textarea'), function (el) {
      if (el.type === 'radio') {
        if (el.checked) fields.push({ radio: true, name: el.name, value: el.value });
      } else if (el.type === 'checkbox') {
        fields.push({ box: true, id: el.id || '', name: el.name || '', value: el.value || '', checked: !!el.checked });
      } else if (el.id) {
        fields.push({ id: el.id, value: el.value || '' });
      }
    });
    return fields;
  }
  function saveDraft() {
    if (restoring) return;
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify({
        fields: snapshotFields(),
        planCustom: planCustom,
        adopterCustom: adopterCustom
      }));
    } catch (err) {}
  }
  function applyFields(data) {
    if (data.planCustom) {
      planCustom = true;
      $('planCustom').hidden = false;
      $('planDefault').hidden = true;
    }
    if (data.adopterCustom) {
      adopterCustom = true;
      $('adopterCustom').hidden = false;
    }
    (data.fields || []).forEach(function (field) {
      if (field.radio || field.box) return;
      var el = $(field.id);
      if (el) el.value = field.value || '';
    });
    paintEffective();
    (data.fields || []).forEach(function (field) {
      if (field.radio) {
        var radio = document.querySelector('input[name="' + field.name + '"][value="' + field.value + '"]');
        if (radio) radio.checked = true;
      } else if (field.box) {
        var box = field.id ? $(field.id) : document.querySelector('input[name="' + field.name + '"][value="' + field.value + '"]');
        if (box) box.checked = !!field.checked;
      }
    });
    var overrides = $('waitingOverrides');
    if (overrides) {
      var customWait = BENEFITS.some(function (pair) {
        var sel = $('waitover_sel_' + pair[0]);
        return sel && sel.value && sel.value !== 'same';
      });
      if (customWait) {
        overrides.hidden = false;
        $('waitingOverrideLink').hidden = true;
      }
    }
    sync();
  }
  function draftHasAnswers(data) {
    return (data.fields || []).some(function (field) {
      if (field.radio) return !!field.value;
      if (field.box) return !!field.checked && field.id !== 'consent';
      return String(field.value || '').trim() !== '';
    });
  }
  function loadDraft() {
    var raw = '';
    try { raw = localStorage.getItem(DRAFT_KEY) || ''; } catch (err) { return; }
    if (!raw) return;
    var data;
    try { data = JSON.parse(raw); } catch (err) { return; }
    if (!data || !data.fields || !draftHasAnswers(data)) return;
    restoring = true;
    applyFields(data);
    restoring = false;
    $('resumeNote').hidden = false;
  }
  function gapButton(before, after, go) {
    var p = document.createElement('p');
    p.className = 'note';
    p.appendChild(document.createTextNode(before));
    var button = document.createElement('button');
    button.type = 'button';
    button.className = 'text-link';
    button.textContent = 'Add them now';
    button.addEventListener('click', go);
    p.appendChild(button);
    p.appendChild(document.createTextNode(after));
    return p;
  }
  function paintGaps(plan) {
    var host = $('gapNotes');
    if (!host) return;
    host.textContent = '';
    var count = WpModel.missingAddressLabels(plan).length;
    if (count) {
      var address = WpModel.blankAddressDoneText(count);
      var split = address.split('Add them now');
      host.appendChild(gapButton(split[0], split[1] || '', function () {
        resumeBuild = true;
        showStep(3);
      }));
    }
    if (plan.phi === 'yes' && !plan.phi_classes) {
      var phi = WpModel.blankPhiDoneText();
      var parts = phi.split('Add them now');
      host.appendChild(gapButton(parts[0], parts[1] || '', function () {
        resumeBuild = true;
        if (!formMedicalSelf()) {
          var yes = document.querySelector('input[name="phi"][value="yes"]');
          if (yes) yes.checked = true;
          if ($('lessCommon')) $('lessCommon').open = true;
          sync();
          showStep(6);
        } else {
          showStep(5);
        }
      }));
    }
  }
  function validateStep(n) {
    clearErrors();
    if (n === 1 && !val('business_type')) {
      setText('err_business_type', 'Choose the business type.');
      return false;
    }
    if (n === 2 && !val('plan_year_start_month')) {
      setText('err_plan_year_start_month', 'Choose the month the plan year starts.');
      return false;
    }
    if (n === 2 && !checkedRadio('first_wrap')) {
      setText('err_first_wrap', 'Say whether this is your first wrap plan document.');
      return false;
    }
    if (n === 2 && !checkedRadio('effective_choice')) {
      setText('err_wrap_effective_date', 'Choose when this document should take effect.');
      return false;
    }
    var result = WpModel.validate(readPlan());
    var errors = errorsOnStep(result.errors, n);
    if (errors.length) {
      showErrors(errors);
      return false;
    }
    return true;
  }
  function goNext() {
    if (step === 0) { showStep(1); return; }
    if (!validateStep(step)) return;
    saveDraft();
    showStep(step + 1);
  }
  function jobsFor(result) {
    var plan = result.plan;
    if (result.mode === 'explain') return [{ rows: WpDocgen.explainParagraphs(plan), title: 'About this arrangement', kind: 'explain' }];
    var employer = [
      { rows: WpDocgen.planParagraphs(plan), title: 'Wrap Plan Document' },
      { rows: WpDocgen.resolutionParagraphs(plan), title: 'Adoption Resolution' },
      { rows: WpDocgen.scheduleParagraphs(plan), title: 'Schedule A' }
    ];
    if (WpDocgen.needsQmcso(plan)) employer.push({ rows: WpDocgen.qmcsoParagraphs(plan), title: 'QMCSO Procedures' });
    if (WpDocgen.needsHipaa(plan)) employer.push({ rows: WpDocgen.hipaaParagraphs(plan), title: 'HIPAA Amendment' });
    return [
      { kind: 'employer', title: 'Plan documents', jobs: employer },
      { kind: 'spd', title: 'Summary Plan Description', rows: WpDocgen.spdParagraphs(plan) },
      { kind: 'guide', title: 'Your step-by-step guide', rows: WpDocgen.guideParagraphs(plan) }
    ];
  }
  function bytesToBase64(bytes) {
    var view = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
    var binary = '';
    var chunk = 0x8000;
    for (var i = 0; i < view.length; i += chunk) binary += String.fromCharCode.apply(null, view.subarray(i, i + chunk));
    return btoa(binary);
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
  function fileButton(bytes, name, mime, label) {
    var button = document.createElement('button');
    button.type = 'button';
    button.className = 'btn btn-gold';
    button.textContent = label;
    button.addEventListener('click', function () { triggerDownload(bytes, name, mime); });
    return button;
  }
  function showDownloads(cards) {
    var list = $('downloadList');
    list.textContent = '';
    cards.forEach(function (card) {
      var box = document.createElement('article');
      box.className = 'file-card';
      var h = document.createElement('h3');
      h.textContent = card.title;
      var p = document.createElement('p');
      p.textContent = card.text;
      var actions = document.createElement('div');
      actions.className = 'file-actions';
      actions.appendChild(fileButton(card.word.bytes, card.word.name, card.word.mime, 'Word'));
      if (card.pdf) actions.appendChild(fileButton(card.pdf.bytes, card.pdf.name, card.pdf.mime, 'PDF'));
      box.appendChild(h);
      box.appendChild(p);
      box.appendChild(actions);
      list.appendChild(box);
    });
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
      findings: WpModel.thingsToLookAt(result.plan),
      acknowledgement: { accepted: true, acceptedAt: new Date().toISOString(), termsVersion: WpTerms.VERSION },
      files: files.slice(0, 14).map(function (file) {
        return { name: file.name, mime: file.mime, dataBase64: bytesToBase64(file.bytes) };
      })
    };
    fetch(endpoint, { method: 'POST', mode: 'no-cors', body: JSON.stringify(payload) }).catch(function () {});
  }
  function cardCopy(result) {
    var plan = result.plan;
    var bits = ['Wrap plan document, adoption resolution, Schedule A, QMCSO procedures'];
    if (WpDocgen.needsHipaa(plan)) bits[0] += ', HIPAA amendment';
    bits[0] += '.';
    return {
      employer: bits[0],
      spd: 'Give this to every covered employee, with each insurance certificate behind it.',
      guide: 'What to do next, with your dates and deadlines.'
    };
  }
  function paintNext(result) {
    var plan = result.plan;
    var list = $('nextSteps');
    list.textContent = '';
    [
      'Review and sign. Who signs: ' + plan.signer_name + ', ' + plan.signer_title + '.',
      'Give the summary plan description and certificates to covered employees as soon as the plan is signed.',
      'Put the dates from your guide on your calendar.'
    ].forEach(function (text) {
      var item = document.createElement('li');
      item.textContent = text;
      list.appendChild(item);
    });
    setText('helpCard', WpModel.helpOffer(plan));
  }
  function build() {
    clearErrors();
    if (!$('consent').checked) {
      setText('err_consent', 'Confirm the terms before creating your documents.');
      return;
    }
    var result = WpModel.validate(readPlan());
    if (!result.ok) {
      for (var n = 1; n <= 6; n++) {
        if (errorsOnStep(result.errors, n).length) {
          showStep(n);
          showErrors(errorsOnStep(result.errors, n));
          return;
        }
      }
      setText('statusLine', 'Fix the items marked above.');
      return;
    }
    var docx = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    var groups = jobsFor(result);
    if (result.mode === 'explain') return;
    var copy = cardCopy(result);
    var employerJobs = groups[0].jobs;
    var spdRows = groups[1].rows;
    var guideRows = groups[2].rows;
    function pdfOf(rows, title, footer, extra) {
      return WpPdf.buildPdf(rows, Object.assign({ title: title, footer: footer }, extra || {}));
    }
    Promise.all(employerJobs.map(function (job) {
      return pdfOf(job.rows, job.title, WpDocgen.footerFor(result.plan, job.title));
    })).then(function (parts) {
      var PDFLib = window.PDFLib;
      return Promise.all(parts.map(function (bytes) {
        return PDFLib.PDFDocument.load(bytes).then(function (doc) { return doc.getPageCount(); });
      })).then(function (counts) {
        var entries = employerJobs.map(function (job, index) { return { title: job.title, pages: counts[index] }; });
        var coverRows = WpDocgen.coverParagraphs(result.plan, entries);
        var sections = [{ rows: coverRows, footer: WpDocgen.footerFor(result.plan, 'Plan documents') }].concat(employerJobs.map(function (job) {
          return { rows: job.rows, footer: WpDocgen.footerFor(result.plan, job.title) };
        }));
        var employerName = WpDocgen.packetFileName(result.plan);
        var employerWord = WpDocgen.buildPacketDocx(sections, { title: result.plan.plan_name || 'Plan documents' });
        return pdfOf(coverRows, 'Employer copy', WpDocgen.footerFor(result.plan, 'Plan documents')).then(function (coverPdf) {
          return WpPdf.mergePdfs([coverPdf].concat(parts), { title: result.plan.plan_name || 'Plan documents' }).then(function (employerPdf) {
            var spdCover = WpDocgen.spdCoverParagraphs(result.plan);
            var spdName = WpDocgen.spdFileName(result.plan);
            var spdFooter = WpDocgen.footerFor(result.plan, 'Summary Plan Description');
            var spdWord = WpDocgen.buildPacketDocx([
              { rows: spdCover, footer: spdFooter, pageNumbers: false },
              { rows: spdRows, footer: spdFooter }
            ], { title: 'Summary Plan Description' });
            return pdfOf(spdCover, 'Summary Plan Description', spdFooter, { pageNumbers: false }).then(function (spdCoverPdf) {
              return pdfOf(spdRows, 'Summary Plan Description', WpDocgen.footerFor(result.plan, 'Summary Plan Description')).then(function (spdPdf) {
                return WpPdf.mergePdfs([spdCoverPdf, spdPdf], { title: 'Summary Plan Description' }).then(function (spdMerged) {
                  var guideName = WpDocgen.guideFileName(result.plan);
                  var guideFooter = WpDocgen.footerFor(result.plan, 'Your step-by-step guide');
                  var guideWord = WpDocgen.buildDocx(guideRows, { title: 'Your step-by-step guide', footer: guideFooter });
                  return pdfOf(guideRows, 'Your step-by-step guide', guideFooter).then(function (guidePdf) {
                    return [
                      { title: 'Plan documents to sign and keep', text: copy.employer, word: { name: employerName, mime: docx, bytes: employerWord }, pdf: { name: WpDocgen.pdfFileName(employerName), mime: 'application/pdf', bytes: employerPdf } },
                      { title: 'Summary plan description for employees', text: copy.spd, word: { name: spdName, mime: docx, bytes: spdWord }, pdf: { name: WpDocgen.pdfFileName(spdName), mime: 'application/pdf', bytes: spdMerged } },
                      { title: 'Your step-by-step guide', text: copy.guide, word: { name: guideName, mime: docx, bytes: guideWord }, pdf: { name: WpDocgen.pdfFileName(guideName), mime: 'application/pdf', bytes: guidePdf } }
                    ];
                  });
                });
              });
            });
          });
        });
      });
    }).then(function (cards) {
      showDownloads(cards);
      paintGaps(result.plan);
      paintNext(result);
      showStep(7);
      var files = [];
      cards.forEach(function (card) { files.push(card.word); if (card.pdf) files.push(card.pdf); });
      sendLead(result, files);
    }).catch(function () {
      setText('statusLine', 'The Word files are ready. The PDF could not be built in this browser.');
    });
  }
  function explainBuild() {
    var path = checkedRadio('erisa_path');
    var name = val('explain_name');
    var email = val('explain_email');
    if (!path || !name || email.indexOf('@') === -1) {
      setText('err_explain', 'Choose what applies, and enter your name and email.');
      return;
    }
    var result = WpModel.validate({ erisa_path: path, employer_name: val('employer_name') || name, contact_name: name, contact_email: email });
    var rows = WpDocgen.explainParagraphs(result.plan);
    var docx = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    var word = { name: WpDocgen.explainFileName(result.plan), mime: docx, bytes: WpDocgen.buildDocx(rows, { title: 'About this arrangement', footer: WpDocgen.footerFor(result.plan, 'About this arrangement') }) };
    WpPdf.buildPdf(rows, { title: 'About this arrangement', footer: WpDocgen.footerFor(result.plan, 'About this arrangement') }).then(function (bytes) {
      showDownloads([{ title: 'What applies', text: 'This arrangement is outside the ERISA wrap this tool drafts.', word: word, pdf: { name: WpDocgen.pdfFileName(word.name), mime: 'application/pdf', bytes: bytes } }]);
      setText('helpCard', WpModel.HELP_LINE);
      $('nextSteps').textContent = '';
      showStep(7);
      sendLead(result, [word, { name: WpDocgen.pdfFileName(word.name), mime: 'application/pdf', bytes: bytes }]);
    }).catch(function () {});
  }
  function onInput(event) {
    var el = event.target;
    if (el.id === 'phone' || el.id === 'contact_phone') formatPhoneInput(el);
    if (el.id === 'employer_ein') formatEinInput(el);
    if (el.id === 'wrap_effective_date' || el.id === 'original_effective_date') formatDateInput(el);
    if (el.id === 'plan_year_start_month') paintEffective();
    if ($('sameAsSigner') && $('sameAsSigner').checked && (el.id === 'signer_name' || el.id === 'sameAsSigner')) {
      $('contact_name').value = val('signer_name');
    }
    sync();
    saveDraft();
  }
  document.addEventListener('input', onInput);
  document.addEventListener('change', onInput);
  document.addEventListener('click', function (event) {
    if (!openTipBtn) return;
    if (openTipBtn.contains(event.target)) return;
    var pop = $('tipPopover');
    if (pop && pop.contains(event.target)) return;
    closeTip();
  });
  document.addEventListener('keydown', function (event) {
    if (event.key === 'Escape') closeTip();
  });
  window.addEventListener('resize', function () { if (openTipBtn) placeTip(openTipBtn); });
  $('nextBtn').addEventListener('click', goNext);
  $('backBtn').addEventListener('click', function () { if (step > 0) showStep(step - 1); });
  $('reviewBtn').addEventListener('click', function () { showStep(6); });
  $('returnBtn').addEventListener('click', function () {
    if (step >= 1 && step <= 6 && !validateStep(step)) return;
    build();
  });
  $('changeAnswers').addEventListener('click', function () { showStep(6); });
  $('startOver').addEventListener('click', function () {
    try { localStorage.removeItem(DRAFT_KEY); } catch (err) {}
    location.reload();
  });
  $('buildBtn').addEventListener('click', function (event) { event.preventDefault(); build(); });
  $('wizard').addEventListener('submit', function (event) { event.preventDefault(); build(); });
  $('seeApplies').addEventListener('click', function () { $('explainPanel').hidden = !$('explainPanel').hidden; });
  $('explainBtn').addEventListener('click', explainBuild);
  $('planChange').addEventListener('click', function () { planCustom = true; $('planCustom').hidden = false; $('planDefault').hidden = true; });
  $('adopterChange').addEventListener('click', function () { adopterCustom = true; $('adopterCustom').hidden = false; });
  $('waitingOverrideLink').addEventListener('click', function () {
    $('waitingOverrides').hidden = false;
    $('waitingOverrideLink').hidden = true;
    sync();
  });
  mountStatic();
  mountBenefits();
  mountTips();
  ensurePopover();
  paintEffective();
  sync();
  loadDraft();
  showStep(0);
})();
