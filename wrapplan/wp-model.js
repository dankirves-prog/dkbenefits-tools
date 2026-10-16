/**
 * Wrap plan sample rules.
 * Visitor copy lives in the document builders. This file decides the answers.
 * Draft for the employer's own advisors. Not legal advice.
 */
var WpModel = (function () {
  var TEMPLATE_VERSION = 'wp-v1';
  var TERMS_VERSION = 'wp-terms-1';
  var DISCLAIMER = 'Sample prepared for review by the employer\'s own counsel. DK Benefits is not a law firm.';
  var BROKER_LINE = 'DK Benefits can do an in-depth review of this arrangement once DK Benefits is the broker of record.';
  var HELP_LINE = 'DK Benefits reviews wrap plan documents like this one for our clients. Want to talk it over? Call 407-476-5076 or visit dkbenefits.net.';
  var STATES = ['AL','AK','AZ','AR','CA','CO','CT','DE','DC','FL','GA','HI','ID','IL','IN','IA','KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ','NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT','VA','WA','WV','WI','WY'];
  var BUSINESS_TYPES = {
    llc: 'Members',
    scorp: 'Board of Directors',
    ccorp: 'Board of Directors',
    partnership: 'Partners',
    sole: 'Owner',
    nonprofit: 'Board of Directors'
  };
  var MSP_SENTENCE = 'Coordination with Medicare follows the federal Medicare Secondary Payer rules and the certificate.';
  var REVERSION = 'Any plan assets, including participant contributions and the participants\' share of any insurer refund or rebate, will be used only for benefits and reasonable plan expenses and will not revert to the employer.';
  var NEWBORNS = 'Group health plans and health insurance issuers generally may not, under Federal law, restrict benefits for any hospital length of stay in connection with childbirth for the mother or newborn child to less than 48 hours following a vaginal delivery, or less than 96 hours following a cesarean section. However, Federal law generally does not prohibit the mother\'s or newborn\'s attending provider, after consulting with the mother, from discharging the mother or her newborn earlier than 48 hours (or 96 hours as applicable). In any case, plans and issuers may not, under Federal law, require that a provider obtain authorization from the plan or the insurance issuer for prescribing a length of stay not in excess of 48 hours (or 96 hours).';
  var NEWBORNS_INSURED = 'If state law governs the length of a hospital stay in connection with childbirth, the certificate describes that law.';
  var ALLOWED_ORIGINS = [
    'https://www.dkbenefits.net',
    'https://dkbenefits.net',
    'https://dankirves-prog.github.io',
    'https://www-dkbenefits-net.filesusr.com',
    'https://editor.wix.com',
    'https://create.editorx.com',
    'https://manage.wix.com'
  ];
  var MONTHS = ['', 'January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  var BENEFIT_LABELS = {
    medical: 'Medical',
    dental: 'Dental',
    vision: 'Vision',
    rx: 'Prescription drugs',
    life: 'Group term life',
    add: 'Group AD&D',
    std: 'Short-term disability',
    ltd: 'Long-term disability',
    eap: 'Employee assistance program',
    hra: 'Health reimbursement arrangement',
    health_fsa: 'Health FSA',
    lpfsa: 'Limited purpose FSA',
    vol_life: 'Voluntary life',
    vol_add: 'Voluntary AD&D',
    accident: 'Accident',
    critical: 'Critical illness',
    hospital: 'Hospital indemnity'
  };
  var FUNDING_LABELS = {
    insured: 'Fully insured',
    level: 'Level-funded',
    aso: 'Self-funded (ASO)',
    captive: 'Captive',
    rbp: 'Reference-based pricing'
  };
  var ROLES = {
    employer: 'Employer',
    broker: 'Broker or consultant',
    tpa: 'TPA',
    advisor: 'Attorney or CPA',
    other: 'Other'
  };

  function num(value) {
    var n = parseInt(value, 10);
    return isNaN(n) ? 0 : n;
  }
  function yes(value) { return value === 'yes' || value === true; }
  function hasBenefit(plan, code) {
    return (plan.benefits || []).indexOf(code) !== -1;
  }
  function isSelfFundedFunding(funding) {
    return funding === 'level' || funding === 'aso' || funding === 'captive' || funding === 'rbp';
  }
  var WAITING_OPTIONS = [
    { id: 'date-of-hire', label: 'Date of hire', menu: 'Date of hire' },
    { id: 'first-following-hire', label: 'First of the month following date of hire', menu: 'First of the month following date of hire' },
    { id: 'first-following-30', label: 'First of the month following 30 days', menu: 'First of the month following 30 days' },
    { id: 'day-31', label: '31st day', menu: '31st day' },
    { id: 'first-following-60', label: 'First of the month following 60 days', menu: 'First of the month following 60 days' },
    { id: 'day-61', label: '61st day', menu: '61st day' },
    { id: 'day-90', label: '90th day', menu: '90th day' },
    { id: 'day-91', label: 'The 91st day', menu: 'The 91st day (a 90-day wait, the federal maximum)' },
    { id: 'other', label: 'Other', menu: 'Other' }
  ];
  function waitingText(id, other) {
    if (id === 'other') return String(other || '').trim();
    for (var i = 0; i < WAITING_OPTIONS.length; i++) {
      if (WAITING_OPTIONS[i].id === id) return WAITING_OPTIONS[i].label;
    }
    return '';
  }
  function isoDate(value) {
    var raw = String(value || '').trim();
    var us = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (us) raw = us[3] + '-' + us[1] + '-' + us[2];
    var iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!iso) return '';
    var y = Number(iso[1]);
    var m = Number(iso[2]);
    var d = Number(iso[3]);
    var dt = new Date(Date.UTC(y, m - 1, d));
    if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) return '';
    return iso[1] + '-' + iso[2] + '-' + iso[3];
  }
  function storedDate(value) {
    return isoDate(value) || String(value || '').trim();
  }
  function groupHealth(plan) {
    return hasBenefit(plan, 'medical') || hasBenefit(plan, 'dental') || hasBenefit(plan, 'vision') ||
      hasBenefit(plan, 'health_fsa') || hasBenefit(plan, 'lpfsa') || hasBenefit(plan, 'hra') ||
      (hasBenefit(plan, 'eap') && plan.eap_type === 'substantive');
  }
  function countParticipants(plan) {
    var c = plan.census || {};
    return num(c.a) + num(c.b) + num(c.c) + num(c.d);
  }
  function selfFundedSlice(plan) {
    if (isSelfFundedFunding(plan.funding) && hasBenefit(plan, 'medical')) return true;
    if (hasBenefit(plan, 'hra') || hasBenefit(plan, 'health_fsa') || hasBenefit(plan, 'lpfsa')) return true;
    if (hasBenefit(plan, 'std') && plan.std_type === 'trust') return true;
    return false;
  }
  function hasSeparateFund(plan) {
    return yes(plan.trust) || (hasBenefit(plan, 'std') && plan.std_type === 'trust');
  }
  function filingResult(plan) {
    var n = countParticipants(plan);
    var trust = hasSeparateFund(plan);
    if (n >= 100 || trust) {
      return {
        code: 'required',
        count: n,
        text: 'A Form 5500 is required.'
      };
    }
    var contrib = yes(plan.employee_contributions);
    if (!selfFundedSlice(plan)) {
      if (!contrib || yes(plan.remitted)) {
        return { code: 'exempt', count: n, text: 'The small-plan filing exemption may apply.' };
      }
      return {
        code: 'unconfirmed',
        count: n,
        text: 'The small-plan filing exemption is not stated, because employee premiums were not confirmed as remitted to the insurer within three months.'
      };
    }
    if (contrib && !yes(plan.section125)) {
      return {
        code: 'unconfirmed',
        count: n,
        text: 'The small-plan filing exemption is not stated. Employee contributions to a self-funded benefit are described that way only when a Section 125 plan is in place and the money is not held in a trust.'
      };
    }
    return { code: 'exempt', count: n, text: 'The small-plan filing exemption may apply.' };
  }
  function parityMode(plan) {
    if (!hasBenefit(plan, 'medical')) return 'none';
    if (plan.funding === 'insured') return 'print';
    if (isSelfFundedFunding(plan.funding) && num(plan.employee_count) > 50) return 'print';
    return 'booklet';
  }
  function complexFunding(plan) {
    return isSelfFundedFunding(plan.funding);
  }
  function voluntaryCodes(plan) {
    return ['vol_life', 'vol_add', 'accident', 'critical', 'hospital'].filter(function (code) { return hasBenefit(plan, code); });
  }
  function voluntaryWrapped(plan) {
    var selected = voluntaryCodes(plan);
    if (!selected.length) return { include: false, codes: [], reason: '' };
    var tax = plan.tax || {};
    var pretaxChoice = selected.some(function (code) { return tax[code] === 'pretax'; });
    if (pretaxChoice) {
      return { include: true, codes: selected, reason: 'Pre-tax treatment through a Section 125 plan fails the voluntary-plan safe harbor, so these benefits are wrapped.' };
    }
    var employerPaid = selected.some(function (code) { return tax[code] === 'none'; });
    if (employerPaid) {
      return { include: true, codes: selected, reason: 'Employer-paid voluntary benefits are part of the plan.' };
    }
    if (plan.vol_include === 'no') {
      return { include: false, codes: selected, reason: 'The voluntary benefits meet the safe harbor and are left out of the wrap.' };
    }
    if (plan.vol_include === 'yes') {
      return { include: true, codes: selected, reason: 'These voluntary benefits are included in the plan.' };
    }
    var fail = yes(plan.vol_contrib) || !yes(plan.vol_voluntary) || yes(plan.vol_endorse) || !yes(plan.vol_payroll_only) || yes(plan.vol_consideration);
    if (fail) {
      return { include: true, codes: selected, reason: 'The voluntary-plan safe harbor was not met, so these benefits are wrapped.' };
    }
    return { include: false, codes: selected, reason: 'The voluntary benefits meet the safe harbor and are left out of the wrap.' };
  }
  function wrappedBenefits(plan) {
    var list = (plan.benefits || []).slice();
    if (hasBenefit(plan, 'eap') && plan.eap_type === 'referral') {
      list = list.filter(function (code) { return code !== 'eap'; });
    }
    if (hasBenefit(plan, 'std') && plan.std_type === 'general-assets') {
      list = list.filter(function (code) { return code !== 'std'; });
    }
    var vol = voluntaryWrapped(plan);
    if (!vol.include) {
      list = list.filter(function (code) { return vol.codes.indexOf(code) === -1; });
    }
    return list;
  }
  var HRA_LABELS = {
    integrated: 'integrated HRA',
    excepted: 'excepted-benefit HRA',
    ichra: 'individual coverage HRA',
    qsehra: 'qualified small employer HRA'
  };
  function benefitLabel(code) { return BENEFIT_LABELS[code] || code; }
  function hraLabel(code) { return HRA_LABELS[code] || code; }
  function fundingLabel(code) { return FUNDING_LABELS[code] || code; }
  function formatPhone(value) {
    var digits = String(value || '').replace(/\D/g, '');
    if (digits.length === 11 && digits.charAt(0) === '1') digits = digits.slice(1);
    if (digits.length === 10) return digits.slice(0, 3) + '-' + digits.slice(3, 6) + '-' + digits.slice(6);
    return String(value || '').trim();
  }
  function benefitIsInsured(plan, code) {
    if (code === 'hra' || code === 'health_fsa' || code === 'lpfsa') return false;
    if (code === 'std' && plan.std_type === 'trust') return false;
    if (code === 'medical') return plan.funding === 'insured';
    return (plan.benefit_funding || {})[code] !== 'self';
  }
  function needsCarrierAddress(plan, code) {
    if (code === 'medical' || code === 'dental' || code === 'vision' || code === 'rx') return true;
    return code === 'eap' && plan.eap_type === 'substantive';
  }
  function anyInsuredBenefit(plan) {
    return wrappedBenefits(plan).some(function (code) { return benefitIsInsured(plan, code); });
  }
  function roleLabel(code) { return ROLES[code] || code; }
  function monthName(n) { return MONTHS[num(n)] || ''; }
  function planYearSentence(plan) {
    if (plan.plan_year_type === 'fiscal') {
      var name = monthName(plan.plan_year_end_month);
      if (num(plan.plan_year_end_month) === 2) return 'The plan year ends on the last day of February.';
      return 'The plan year ends on the last day of ' + name + '.';
    }
    return 'The plan year is the calendar year.';
  }
  function nextPlanYearStart(plan, asOf) {
    var endMonth = plan.plan_year_type === 'fiscal' ? num(plan.plan_year_end_month) : 12;
    var startMonth = endMonth === 12 ? 1 : endMonth + 1;
    var year = asOf.getFullYear();
    var start = new Date(year, startMonth - 1, 1);
    if (start < new Date(asOf.getFullYear(), asOf.getMonth(), asOf.getDate())) {
      start = new Date(year + 1, startMonth - 1, 1);
    }
    return start;
  }
  function isWeekend(date) {
    var day = date.getDay();
    return day === 0 || day === 6;
  }
  function nextBusinessMorning(asOf) {
    var date = new Date(asOf.getFullYear(), asOf.getMonth(), asOf.getDate());
    if (asOf.getHours() >= 7) date.setDate(date.getDate() + 1);
    while (isWeekend(date)) date.setDate(date.getDate() + 1);
    return date;
  }
  function formatISODate(date) {
    var m = String(date.getMonth() + 1);
    var d = String(date.getDate());
    if (m.length < 2) m = '0' + m;
    if (d.length < 2) d = '0' + d;
    return date.getFullYear() + '-' + m + '-' + d;
  }
  function renewalReminderOn(plan, asOf) {
    asOf = asOf || new Date();
    var start = nextPlanYearStart(plan, asOf);
    var remind = new Date(start.getFullYear(), start.getMonth(), start.getDate());
    remind.setDate(remind.getDate() - 90);
    var today = new Date(asOf.getFullYear(), asOf.getMonth(), asOf.getDate());
    if (remind.getTime() <= today.getTime()) return formatISODate(nextBusinessMorning(asOf));
    return formatISODate(remind);
  }
  function leadScore(plan) {
    var score = 0;
    if (plan.contact_phone) score += 20;
    if (num(plan.employee_count) >= 20 || countParticipants(plan) >= 100) score += 15;
    if (plan.funding === 'level') score += 10;
    if (plan.funding === 'aso' || plan.funding === 'captive' || plan.funding === 'rbp') score += 20;
    if (plan.cobra === 'no' && countParticipants(plan) >= 100) score += 10;
    if (yes(plan.trust)) score += 10;
    if (score > 100) score = 100;
    return score;
  }
  function push(errors, field, message) {
    errors.push({ field: field, message: message });
  }
  function designNotes(plan) {
    var notes = [];
    if (plan.certificates === 'no') {
      notes.push('You said a certificate, booklet, or TPA plan document is not on hand for every benefit. Attach each one before you give the wrap to employees.');
    }
    if (hasBenefit(plan, 'eap') && plan.eap_type === 'referral') {
      notes.push('A referral-only employee assistance program is left out of the wrap.');
    }
    if (hasBenefit(plan, 'std') && plan.std_type === 'general-assets') {
      notes.push('Short-term disability paid from the employer\'s general assets is treated as a payroll practice and is left out of the wrap. State disability rules may still apply and are not restated here.');
    }
    if (hasBenefit(plan, 'std') && plan.std_type === 'trust') {
      notes.push('Short-term disability paid from a trust or separate fund is wrapped. That fund is plan assets, so the small-plan exemption is not available.');
    }
    if ((hasBenefit(plan, 'ltd') && (plan.tax || {}).ltd === 'pretax') || (hasBenefit(plan, 'std') && (plan.tax || {}).std === 'pretax')) {
      notes.push('Disability benefits paid from pre-tax premiums are taxable income to the employee.');
    }
    if (plan.dcap_interest) {
      notes.push('Dependent care stays in the Section 125 plan. It is not part of this wrap.');
    }
    var vol = voluntaryWrapped(plan);
    if (vol.codes.length) notes.push(vol.reason);
    if (hasBenefit(plan, 'hra') && plan.hra_type === 'qsehra' && hasBenefit(plan, 'medical')) {
      notes.push('A qualified small employer HRA is for an employer that does not offer a group health plan. Confirm this design with counsel before you sign.');
    }
    if (hasBenefit(plan, 'hra') && plan.hra_type === 'ichra') {
      notes.push('The individual-coverage notice and the individual policy sit outside this wrap.');
      if (hasBenefit(plan, 'medical') && plan.ichra_same_class !== 'no') {
        notes.push('You indicated the individual coverage HRA is offered to the same class that can also enroll in group medical. Confirm that class design before you sign.');
      }
    }
    if (plan.admin_choice === 'custom') notes.push('The plan administrator was changed from the employer. Confirm that the named person is the administrator in the plan records.');
    if (plan.intended_signature_date && plan.restatement_date && plan.intended_signature_date > plan.restatement_date) {
      notes.push('The date you intend to sign is after the effective date of this document. Confirm that this is a restatement.');
    } else if (plan.intended_signature_date && !plan.restatement_date && plan.original_effective_date && plan.intended_signature_date > plan.original_effective_date) {
      notes.push('The date you intend to sign is after the effective date. Confirm that this is a restatement.');
    }
    if (num(plan.employee_count) >= 50 && isSelfFundedFunding(plan.funding)) {
      notes.push('A self-funded health plan can face nondiscrimination rules. Whether the employer is an applicable large employer depends on full-time equivalents, not on this headcount alone. This sample does not decide either question.');
    } else if (num(plan.employee_count) >= 50) {
      notes.push('Whether the employer is an applicable large employer depends on full-time equivalents, not on this headcount alone.');
    } else if (isSelfFundedFunding(plan.funding) && hasBenefit(plan, 'medical')) {
      notes.push('A self-funded health plan can face nondiscrimination rules. This sample does not decide that question.');
    }
    if (plan.discretion !== 'no' && anyInsuredBenefit(plan)) {
      notes.push('Some states bar discretionary clauses in insured policies. Confirm that clause before you sign.');
    }
    return notes;
  }
  function findingsFor(plan) {
    var notes = [];
    var filing = filingResult(plan);
    notes.push(countParticipants(plan) + ' covered participants. ' + filing.text);
    if (countParticipants(plan) >= 100 && yes(plan.prior_small_filing)) {
      notes.push('A prior small-plan filing does not change this. A Form 5500 is required.');
    }
    if (plan.cobra === 'no' && countParticipants(plan) >= 100) {
      notes.push('You answered that federal COBRA did not apply, and the covered-participant count is 100 or more. Those answers usually do not belong together. Confirm the prior-year employee count, including related employers.');
    }
    designNotes(plan).forEach(function (note) { notes.push(note); });
    if (complexFunding(plan)) notes.push(BROKER_LINE);
    if (plan.phi_classes_blank && plan.phi === 'yes') {
      notes.push('Fill in the job classes that may see health information before you sign the HIPAA amendment.');
    }
    return notes;
  }
  function normalize(input) {
    input = input || {};
    var benefits = Array.isArray(input.benefits) ? input.benefits.slice() : [];
    var plan = {
      erisa_path: input.erisa_path || 'private',
      employer_name: String(input.employer_name || '').trim(),
      employer_ein: String(input.employer_ein || '').trim(),
      phone: String(input.phone || '').trim(),
      street: String(input.street || '').trim(),
      city: String(input.city || '').trim(),
      state: String(input.state || '').trim(),
      zip: String(input.zip || '').trim(),
      plan_name: String(input.plan_name || '').trim(),
      plan_number: String(input.plan_number || '').trim(),
      original_effective_date: storedDate(input.original_effective_date),
      is_restatement: input.is_restatement === 'yes' ? 'yes' : 'no',
      restatement_date: input.is_restatement === 'yes' ? storedDate(input.restatement_date) : '',
      intended_signature_date: storedDate(input.intended_signature_date),
      plan_year_type: input.plan_year_type === 'fiscal' ? 'fiscal' : 'calendar',
      plan_year_end_month: String(input.plan_year_end_month || ''),
      employee_count: String(input.employee_count || '').trim(),
      benefits: benefits,
      carriers: input.carriers || {},
      carrier_addresses: input.carrier_addresses || {},
      waiting: input.waiting || {},
      tax: input.tax || {},
      benefit_funding: input.benefit_funding || {},
      discretion: input.discretion === 'no' ? 'no' : 'yes',
      funding: input.funding || '',
      network: input.network || '',
      stop_loss: input.stop_loss || '',
      tpa_name: String(input.tpa_name || '').trim(),
      tpa_document: String(input.tpa_document || '').trim(),
      hra_type: input.hra_type || '',
      hra_doc: input.hra_doc || '',
      ichra_same_class: input.ichra_same_class || '',
      health_fsa_doc: input.health_fsa_doc || '',
      eap_type: input.eap_type || '',
      std_type: input.std_type || '',
      vol_pretax: input.vol_pretax || '',
      vol_contrib: input.vol_contrib || '',
      vol_voluntary: input.vol_voluntary || '',
      vol_endorse: input.vol_endorse || '',
      vol_payroll_only: input.vol_payroll_only || '',
      vol_consideration: input.vol_consideration || '',
      vol_include: input.vol_include || '',
      business_type: input.business_type || '',
      plan_year_start_month: String(input.plan_year_start_month || ''),
      first_wrap: input.first_wrap || '',
      classes: String(input.classes || '').trim(),
      hours: String(input.hours || '').trim(),
      dependents: String(input.dependents || '').trim(),
      census: {
        a: String((input.census && input.census.a) || input.census_a || '0'),
        b: String((input.census && input.census.b) || input.census_b || '0'),
        c: String((input.census && input.census.c) || input.census_c || '0'),
        d: String((input.census && input.census.d) || input.census_d || '0')
      },
      employee_contributions: input.employee_contributions || '',
      remitted: input.remitted || '',
      section125: input.section125 || '',
      trust: input.trust || 'no',
      trustee_name: String(input.trustee_name || '').trim(),
      trustee_address: String(input.trustee_address || '').trim(),
      cobra: input.cobra || '',
      cobra_admin: String(input.cobra_admin || '').trim(),
      appeals: input.appeals || '',
      bargaining: input.bargaining || 'no',
      phi: input.phi || '',
      phi_classes: String(input.phi_classes || '').trim(),
      certificates: input.certificates || '',
      dcap_interest: input.dcap_interest === 'yes',
      agent_choice: input.agent_choice === 'custom' ? 'custom' : 'employer',
      agent_name: String(input.agent_name || '').trim(),
      agent_address: String(input.agent_address || '').trim(),
      admin_choice: input.admin_choice === 'custom' ? 'custom' : 'employer',
      admin_name: String(input.admin_name || '').trim(),
      signer_name: String(input.signer_name || '').trim(),
      signer_title: String(input.signer_title || '').trim(),
      governing_body: String(input.governing_body || '').trim(),
      contact_name: String(input.contact_name || '').trim(),
      contact_email: String(input.contact_email || '').trim(),
      contact_phone: String(input.contact_phone || '').trim(),
      role: input.role || '',
      prior_small_filing: input.prior_small_filing === 'yes' ? 'yes' : 'no',
      utm: String(input.utm || '').trim(),
      referrer: String(input.referrer || '').trim()
    };
    if (!plan.plan_name && plan.employer_name) plan.plan_name = plan.employer_name + ' Group Welfare Benefit Plan';
    plan.benefits = plan.benefits.filter(function (code) { return code !== 'dcap' && code !== 'lpfsa_disabled'; });
    applyTaxDefaults(plan);
    applyWaiting(plan, input);
    applyPlanYear(plan);
    applyDerivedAnswers(plan);
    if (!plan.phi && isSelfFundedFunding(plan.funding) && hasBenefit(plan, 'medical')) plan.phi = 'yes';
    plan.phi_classes_blank = (plan.phi === 'yes' && !plan.phi_classes);
    plan.address = [plan.street, plan.city, plan.state, plan.zip].filter(Boolean).join(', ');
    return plan;
  }
  function applyPlanYear(plan) {
    var start = num(plan.plan_year_start_month);
    if (!start) return;
    plan.plan_year_start_month = String(start);
    if (start === 1) {
      plan.plan_year_type = 'calendar';
      plan.plan_year_end_month = '12';
      return;
    }
    plan.plan_year_type = 'fiscal';
    plan.plan_year_end_month = String(start - 1);
  }
  function anyEmployeePaid(plan) {
    var tax = plan.tax || {};
    return (plan.benefits || []).some(function (code) {
      return code !== 'hra' && (tax[code] === 'pretax' || tax[code] === 'aftertax');
    });
  }
  function anyPretax(plan) {
    var tax = plan.tax || {};
    return (plan.benefits || []).some(function (code) { return code !== 'hra' && tax[code] === 'pretax'; });
  }
  function applyDerivedAnswers(plan) {
    if (!plan.governing_body && BUSINESS_TYPES[plan.business_type]) plan.governing_body = BUSINESS_TYPES[plan.business_type];
    if (!plan.employee_contributions) plan.employee_contributions = anyEmployeePaid(plan) ? 'yes' : 'no';
    if (!plan.remitted && !isSelfFundedFunding(plan.funding)) plan.remitted = 'yes';
    if (num(plan.employee_count) > 0 && num(plan.employee_count) < 20) {
      plan.cobra = groupHealth(plan) || plan.cobra ? 'no' : plan.cobra;
      if (groupHealth(plan)) plan.cobra = 'no';
    }
  }
  function pad2(n) { return (n < 10 ? '0' : '') + n; }
  function dateISO(year, month, day) { return year + '-' + pad2(month) + '-' + pad2(day); }
  function planYearFromStart(month) {
    var start = num(month);
    if (start < 1 || start > 12) return null;
    if (start === 1) return { plan_year_start_month: '1', plan_year_type: 'calendar', plan_year_end_month: '12' };
    return { plan_year_start_month: String(start), plan_year_type: 'fiscal', plan_year_end_month: String(start - 1) };
  }
  function effectiveDateChoices(startMonth, asOf) {
    asOf = asOf || new Date();
    var start = num(startMonth) || 1;
    var year = asOf.getFullYear();
    if (asOf.getMonth() + 1 < start) year -= 1;
    return {
      current: dateISO(year, start, 1),
      next: dateISO(year + 1, start, 1)
    };
  }
  function lastDay(month) {
    var days = [0, 31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    return days[month] || 30;
  }
  function planEndMonth(plan) {
    return plan.plan_year_type === 'fiscal' ? (num(plan.plan_year_end_month) || 12) : 12;
  }
  function dueAfterEnd(plan, monthsLater) {
    var endMonth = planEndMonth(plan);
    var dueMonth = ((endMonth - 1 + monthsLater) % 12) + 1;
    var label = monthName(dueMonth) + ' ' + lastDay(dueMonth);
    if (dueMonth < startMonthOf(plan)) label = 'the following ' + label;
    return { month: dueMonth, day: lastDay(dueMonth), label: label };
  }
  function form5500Due(plan) { return dueAfterEnd(plan, 7); }
  function summaryAnnualDue(plan) { return dueAfterEnd(plan, 9); }
  function startMonthOf(plan) {
    if (num(plan.plan_year_start_month)) return num(plan.plan_year_start_month);
    var end = planEndMonth(plan);
    return end === 12 ? 1 : end + 1;
  }
  function monthDayAfterStart(plan, days) {
    var month = startMonthOf(plan);
    var day = 1 + days;
    while (day > lastDay(month)) {
      day -= lastDay(month);
      month += 1;
      if (month > 12) month = 1;
    }
    return monthName(month) + ' ' + day;
  }
  function renewalMonthLabel(plan) {
    var start = startMonthOf(plan);
    var month = start - 2;
    if (month < 1) month += 12;
    return monthName(month);
  }
  function paidFromGeneralAssets(plan, code) {
    if (code === 'hra' || code === 'health_fsa' || code === 'lpfsa') return true;
    if (code === 'medical') return isSelfFundedFunding(plan.funding);
    if (code === 'std' && plan.std_type === 'trust') return false;
    return !benefitIsInsured(plan, code);
  }
  function allGeneralAssets(plan) {
    var list = wrappedBenefits(plan);
    return list.length > 0 && list.every(function (code) { return paidFromGeneralAssets(plan, code); });
  }
  function helpOffer(plan) {
    return complexFunding(plan) ? BROKER_LINE : HELP_LINE;
  }
  function thingsToLookAt(plan) {
    var notes = [];
    var count = countParticipants(plan);
    var filing = filingResult(plan);
    if (count >= 100) {
      notes.push('You have ' + count + ' covered people, so a Form 5500 is required each year. See the calendar.');
      notes.push('We count each covered person once on the first day of the plan year. Spouses and children are not counted.');
    } else if (count >= 80) {
      notes.push('At 100 on the first day of a plan year, a Form 5500 is required. Check the count before each plan year starts.');
      notes.push('We count each covered person once on the first day of the plan year. Spouses and children are not counted.');
    }
    if (count >= 100 && yes(plan.prior_small_filing)) notes.push('A prior small-plan filing does not change this. A Form 5500 is required.');
    if ((hasBenefit(plan, 'ltd') && (plan.tax || {}).ltd === 'pretax') || (hasBenefit(plan, 'std') && (plan.tax || {}).std === 'pretax')) {
      notes.push('Disability benefits paid from pre-tax premiums are taxable income to the employee.');
    }
    var vol = voluntaryWrapped(plan);
    if (vol.include && vol.codes.some(function (code) { return (plan.tax || {})[code] === 'pretax'; })) {
      notes.push('Pre-tax voluntary benefits are part of the plan.');
    } else if (vol.include && vol.codes.some(function (code) { return (plan.tax || {})[code] === 'none'; })) {
      notes.push('Employer-paid voluntary benefits are part of the plan.');
    }
    if (hasBenefit(plan, 'hra') && plan.hra_type === 'qsehra' && hasBenefit(plan, 'medical')) {
      notes.push('A small employer HRA is only for employers that do not offer group health coverage. Ask your advisor before you sign.');
    }
    if (hasBenefit(plan, 'hra') && plan.hra_type === 'ichra') {
      notes.push('The individual coverage notice and the individual policy sit outside this wrap.');
      if (hasBenefit(plan, 'medical') && plan.ichra_same_class !== 'no') {
        notes.push('This individual coverage HRA is offered to a class that can also enroll in group medical. Ask your advisor before you sign.');
      }
    }
    if (plan.discretion !== 'no' && anyInsuredBenefit(plan)) {
      notes.push('Some states limit discretionary clauses in insured plans. Your counsel can tell you whether to keep it.');
    }
    if (num(plan.employee_count) >= 50 && isSelfFundedFunding(plan.funding)) {
      notes.push('A self-funded health plan can face nondiscrimination rules. Whether you are an applicable large employer depends on full-time equivalents. Ask your payroll provider or advisor.');
    } else if (num(plan.employee_count) >= 50) {
      notes.push('Whether you are an applicable large employer depends on full-time equivalents. Ask your payroll provider or advisor.');
    } else if (isSelfFundedFunding(plan.funding) && hasBenefit(plan, 'medical')) {
      notes.push('A self-funded health plan can face nondiscrimination rules. This sample does not decide that question.');
    }
    if (hasBenefit(plan, 'eap') && plan.eap_type === 'referral') notes.push('A referral-only employee assistance program is left out of the plan.');
    if (hasBenefit(plan, 'std') && plan.std_type === 'general-assets') notes.push('Short-term disability paid from general assets is left out of the plan. State disability rules may still apply.');
    if (hasBenefit(plan, 'std') && plan.std_type === 'trust') notes.push('Short-term disability paid from a trust is in the plan. That fund is plan assets, so the small-plan exemption is not available.');
    if (plan.cobra === 'no' && count >= 100) notes.push('You said federal COBRA does not apply, and 100 or more people are covered. Confirm the prior-year employee count, including related companies.');
    if (plan.phi === 'yes' && plan.phi_classes_blank) notes.push('Fill in the job titles that may see employee health information before you sign.');
    if (complexFunding(plan)) notes.push(BROKER_LINE);
    if (filing.code === 'unconfirmed') notes.push(filing.text);
    return notes;
  }
  function guideCalendar(plan) {
    var yearly = [];
    var hire = [];
    var changes = [];
    var filing = filingResult(plan);
    var medical = hasBenefit(plan, 'medical');
    var drugs = medical || hasBenefit(plan, 'rx');
    var selfMedical = medical && isSelfFundedFunding(plan.funding);
    yearly.push(renewalMonthLabel(plan) + ': Renewal. Get the new certificates. If anything changed, tell employees.');
    if (medical) yearly.push('Open enrollment: SBC, CHIP notice, WHCRA notice, and HIPAA special enrollment notice.');
    if (drugs) {
      yearly.push('By October 15: Medicare Part D notice.');
      yearly.push('Within 60 days after the plan year starts, by ' + monthDayAfterStart(plan, 60) + ': CMS creditable coverage disclosure.');
    }
    if (medical) {
      yearly.push('By June 1: RxDC. The insurer or TPA usually files it, so get that in writing.');
      yearly.push('By December 31: gag clause attestation. The insurer or TPA usually files it, so get that in writing.');
    }
    if (selfMedical || hasBenefit(plan, 'hra') || plan.funding === 'level' || plan.funding === 'captive' || plan.funding === 'rbp' || plan.funding === 'aso') {
      yearly.push('By July 31: PCORI fee on Form 720.');
    }
    if (filing.code === 'required') {
      yearly.push('By ' + form5500Due(plan).label + ': Form 5500, with a 2 and a half month extension on Form 5558.');
      if (!allGeneralAssets(plan)) yearly.push('By ' + summaryAnnualDue(plan).label + ': summary annual report.');
    }
    if (num(plan.employee_count) >= 50 || selfMedical) yearly.push('Early in the year: ACA forms 1094 and 1095.');
    hire.push('Marketplace notice within 14 days after the start date.');
    if (medical) hire.push('SBC and HIPAA special enrollment notice at enrollment.');
    hire.push('SPD and certificates within 90 days after coverage starts.');
    if (plan.cobra === 'yes') hire.push('COBRA general notice with the new-hire papers.');
    changes.push('A new insurer, a new benefit, or a change in eligibility, waiting period, or who pays: a summary of material modifications within 210 days after the end of that plan year.');
    if (groupHealth(plan)) changes.push('A cut in group health benefits: notice within 60 days.');
    if (medical) changes.push('A mid-year group health change: 60 days notice before it takes effect, with an updated SBC.');
    changes.push('A new SPD every 5 years if anything changed, and every 10 years at the latest.');
    return { yearly: yearly, hire: hire, changes: changes };
  }
  var PRETAC_TAX = { medical: 1, dental: 1, vision: 1, health_fsa: 1, lpfsa: 1 };
  var EMPLOYER_TAX = { eap: 1, life: 1, add: 1, ltd: 1, std: 1 };
  function applyTaxDefaults(plan) {
    var tax = plan.tax || {};
    (plan.benefits || []).forEach(function (code) {
      if (code === 'hra') {
        tax[code] = 'none';
        return;
      }
      if (tax[code]) return;
      if (PRETAC_TAX[code]) tax[code] = 'pretax';
      else if (EMPLOYER_TAX[code]) tax[code] = 'none';
    });
    plan.tax = tax;
  }
  function applyWaiting(plan, input) {
    var legacy = input.waiting && typeof input.waiting === 'object' ? input.waiting : {};
    var legacyKeys = Object.keys(legacy).filter(function (key) { return String(legacy[key] || '').trim(); });
    var overrides = input.waiting_overrides || {};
    var overrideOther = input.waiting_override_other || {};
    var hasOverride = Object.keys(overrides).some(function (key) { return overrides[key] && overrides[key] !== 'same'; });
    plan.waiting_overrides = overrides;
    if (!input.waiting_period && legacyKeys.length && !hasOverride) {
      plan.waiting_period = '';
      plan.waiting_other = '';
      plan.waiting = legacy;
      return;
    }
    if (!input.waiting_period) {
      plan.waiting_period = '';
      plan.waiting_other = '';
      plan.waiting = {};
      return;
    }
    var id = input.waiting_period;
    plan.waiting_period = id;
    plan.waiting_other = String(input.waiting_other || '').trim();
    var base = waitingText(id, plan.waiting_other);
    var waiting = {};
    (plan.benefits || []).forEach(function (code) {
      var over = overrides[code];
      if (over && over !== 'same') waiting[code] = waitingText(over, overrideOther[code]);
      else waiting[code] = base;
    });
    plan.waiting = waiting;
  }
  function validate(input) {
    var plan = normalize(input);
    var errors = [];
    if (plan.erisa_path !== 'private') {
      if (!plan.employer_name) push(errors, 'employer_name', 'Enter the organization name.');
      if (!plan.contact_name) push(errors, 'contact_name', 'Enter your name.');
      if (!plan.contact_email || plan.contact_email.indexOf('@') === -1) push(errors, 'contact_email', 'Enter an email address.');
      return {
        ok: errors.length === 0,
        errors: errors,
        plan: plan,
        mode: 'explain',
        findings: [],
        lead: leadFrom(plan)
      };
    }
    if (!plan.employer_name) push(errors, 'employer_name', 'Enter the legal employer name.');
    if (!/^\d{2}-?\d{7}$/.test(plan.employer_ein)) push(errors, 'employer_ein', 'Enter a 9-digit EIN.');
    var phoneDigits = String(plan.phone || '').replace(/\D/g, '');
    if (phoneDigits.length === 11 && phoneDigits.charAt(0) === '1') phoneDigits = phoneDigits.slice(1);
    if (phoneDigits.length !== 10) push(errors, 'phone', 'Enter a 10-digit business phone.');
    if (!plan.street || !plan.city || !plan.state || !/^\d{5}$/.test(plan.zip)) push(errors, 'address', 'Enter a street, city, state, and 5-digit ZIP code.');
    if (!/^\d{3}$/.test(plan.plan_number) || num(plan.plan_number) < 501 || num(plan.plan_number) > 999) {
      push(errors, 'plan_number', 'Enter a three-digit plan number from 501 through 999.');
    }
    if (plan.is_restatement === 'yes') {
      if (!isoDate(plan.restatement_date)) push(errors, 'wrap_effective_date', 'Enter the effective date as month, day, and year.');
      if (!isoDate(plan.original_effective_date)) push(errors, 'original_effective_date', 'Enter the original effective date as month, day, and year.');
    } else if (!isoDate(plan.original_effective_date)) {
      push(errors, 'wrap_effective_date', 'Enter the effective date as month, day, and year.');
    }
    if (plan.intended_signature_date && !isoDate(plan.intended_signature_date)) {
      push(errors, 'intended_signature_date', 'Enter the date as month, day, and year.');
    }
    if (!plan.waiting_period) push(errors, 'waiting_period', 'Choose the waiting period.');
    if (plan.waiting_period === 'other' && !plan.waiting_other) push(errors, 'waiting_other', 'Describe the waiting period.');
    Object.keys(plan.waiting_overrides || {}).forEach(function (code) {
      if (plan.waiting_overrides[code] === 'other' && !(plan.waiting && plan.waiting[code])) {
        push(errors, 'waitover_other_' + code, 'Describe the waiting period for ' + benefitLabel(code) + '.');
      }
    });
    if (!plan.employee_count || num(plan.employee_count) < 1) push(errors, 'employee_count', 'Enter about how many employees you had last year.');
    if (!plan.benefits.length) push(errors, 'benefits', 'Select at least one benefit.');
    if (hasBenefit(plan, 'medical') && !plan.funding) push(errors, 'funding', 'Choose how medical is funded.');
    if (anyPretax(plan) && plan.section125 !== 'yes' && plan.section125 !== 'no' && plan.section125 !== 'notsure') {
      push(errors, 'section125', 'Say whether a Section 125 plan document is signed.');
    }
    if (hasBenefit(plan, 'medical') && isSelfFundedFunding(plan.funding)) {
      if (!plan.tpa_name) push(errors, 'tpa_name', 'Enter the TPA name.');
      if (!plan.tpa_document) push(errors, 'tpa_document', 'Enter the name of the TPA plan document or SPD.');
      if (!plan.stop_loss) push(errors, 'stop_loss', 'Say whether stop-loss is in place.');
    }
    if (num(plan.census.a) < 1) push(errors, 'census_a', 'Enter at least 1 current employee covered by a wrapped benefit.');
    (plan.benefits || []).forEach(function (code) {
      if (code !== 'hra' && !(plan.tax || {})[code]) {
        push(errors, 'tax_' + code, 'Choose how employees contribute to ' + benefitLabel(code) + '.');
      }
    });
    wrappedBenefits(plan).forEach(function (code) {
      if (!plan.carriers[code]) push(errors, 'carrier_' + code, 'Enter the carrier or administrator for ' + benefitLabel(code) + '.');
    });
    if (hasBenefit(plan, 'hra') && !plan.hra_type) push(errors, 'hra_type', 'Choose the HRA type.');
    if (hasBenefit(plan, 'eap') && !plan.eap_type) push(errors, 'eap_type', 'Say whether the EAP is referral-only or provides care.');
    if (hasBenefit(plan, 'std') && !plan.std_type) push(errors, 'std_type', 'Say how short-term disability is paid.');
    if (groupHealth(plan) && num(plan.employee_count) >= 20 && plan.cobra !== 'yes' && plan.cobra !== 'no') {
      push(errors, 'cobra', 'Answer yes or no on the federal COBRA count.');
    }
    if (!plan.signer_name || !plan.signer_title) push(errors, 'signer_name', 'Enter the signer name and title.');
    if (!plan.contact_name) push(errors, 'contact_name', 'Enter your name.');
    if (!plan.contact_email || plan.contact_email.indexOf('@') === -1) push(errors, 'contact_email', 'Enter an email address.');
    if (yes(plan.trust) && !plan.trustee_name) push(errors, 'trustee_name', 'Enter the trustee name.');
    var selectedVol = voluntaryCodes(plan);
    var askVol = selectedVol.length && selectedVol.every(function (code) {
      var tax = (plan.tax || {})[code];
      return tax && tax !== 'pretax' && tax !== 'none';
    });
    var legacyVol = plan.vol_consideration === 'yes' || plan.vol_consideration === 'no';
    if (askVol && !legacyVol && plan.vol_include !== 'yes' && plan.vol_include !== 'no') {
      push(errors, 'vol_include', 'Say whether to include the voluntary benefits.');
    }
    return {
      ok: errors.length === 0,
      errors: errors,
      plan: plan,
      mode: 'plan',
      findings: findingsFor(plan),
      filing: filingResult(plan),
      lead: leadFrom(plan)
    };
  }
  function leadFrom(plan) {
    return {
      contact_name: plan.contact_name,
      contact_email: plan.contact_email,
      contact_phone: plan.contact_phone,
      role: plan.role,
      company: plan.employer_name,
      score: leadScore(plan)
    };
  }
  function validateSubmission(payload) {
    if (!payload || !payload.plan) return { ok: false, errors: [{ field: 'plan', message: 'The answers are missing.' }] };
    return validate(payload.plan);
  }
  function originAllowed(origin) {
    return ALLOWED_ORIGINS.indexOf(origin) !== -1;
  }

  return {
    TEMPLATE_VERSION: TEMPLATE_VERSION,
    TERMS_VERSION: TERMS_VERSION,
    DISCLAIMER: DISCLAIMER,
    BROKER_LINE: BROKER_LINE,
    HELP_LINE: HELP_LINE,
    STATES: STATES,
    BUSINESS_TYPES: BUSINESS_TYPES,
    MSP_SENTENCE: MSP_SENTENCE,
    REVERSION: REVERSION,
    NEWBORNS: NEWBORNS,
    NEWBORNS_INSURED: NEWBORNS_INSURED,
    ALLOWED_ORIGINS: ALLOWED_ORIGINS,
    BENEFIT_LABELS: BENEFIT_LABELS,
    PRETAC_TAX: PRETAC_TAX,
    EMPLOYER_TAX: EMPLOYER_TAX,
    WAITING_OPTIONS: WAITING_OPTIONS,
    waitingText: waitingText,
    isoDate: isoDate,
    benefitLabel: benefitLabel,
    hraLabel: hraLabel,
    fundingLabel: fundingLabel,
    formatPhone: formatPhone,
    benefitIsInsured: benefitIsInsured,
    needsCarrierAddress: needsCarrierAddress,
    designNotes: designNotes,
    roleLabel: roleLabel,
    hasBenefit: hasBenefit,
    groupHealth: groupHealth,
    countParticipants: countParticipants,
    filingResult: filingResult,
    parityMode: parityMode,
    voluntaryWrapped: voluntaryWrapped,
    wrappedBenefits: wrappedBenefits,
    isSelfFundedFunding: isSelfFundedFunding,
    complexFunding: complexFunding,
    planYearSentence: planYearSentence,
    renewalReminderOn: renewalReminderOn,
    leadScore: leadScore,
    findingsFor: findingsFor,
    normalize: normalize,
    validate: validate,
    validateSubmission: validateSubmission,
    originAllowed: originAllowed,
    monthName: monthName,
    planYearFromStart: planYearFromStart,
    effectiveDateChoices: effectiveDateChoices,
    form5500Due: form5500Due,
    summaryAnnualDue: summaryAnnualDue,
    guideCalendar: guideCalendar,
    thingsToLookAt: thingsToLookAt,
    helpOffer: helpOffer,
    anyPretax: anyPretax,
    allGeneralAssets: allGeneralAssets
  };
})();
