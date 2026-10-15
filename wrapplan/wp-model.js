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
  function groupHealth(plan) {
    return hasBenefit(plan, 'medical') || hasBenefit(plan, 'dental') || hasBenefit(plan, 'vision') ||
      hasBenefit(plan, 'health_fsa') || hasBenefit(plan, 'hra') ||
      (hasBenefit(plan, 'eap') && plan.eap_type === 'substantive');
  }
  function countParticipants(plan) {
    var c = plan.census || {};
    return num(c.a) + num(c.b) + num(c.c) + num(c.d);
  }
  function selfFundedSlice(plan) {
    if (isSelfFundedFunding(plan.funding) && hasBenefit(plan, 'medical')) return true;
    if (hasBenefit(plan, 'hra') || hasBenefit(plan, 'health_fsa')) return true;
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
  function voluntaryWrapped(plan) {
    var codes = ['vol_life', 'vol_add', 'accident', 'critical', 'hospital'];
    var selected = codes.filter(function (code) { return hasBenefit(plan, code); });
    if (!selected.length) return { include: false, codes: [], reason: '' };
    if (yes(plan.vol_pretax)) {
      return { include: true, codes: selected, reason: 'Pre-tax treatment through a Section 125 plan fails the voluntary-plan safe harbor, so these benefits are wrapped.' };
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
  function benefitLabel(code) { return BENEFIT_LABELS[code] || code; }
  function fundingLabel(code) { return FUNDING_LABELS[code] || code; }
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
    if (plan.contact_name) score += 10;
    if (plan.contact_email) score += 15;
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
  function findingsFor(plan) {
    var notes = [];
    var filing = filingResult(plan);
    notes.push(countParticipants(plan) + ' covered participants. ' + filing.text);
    if (countParticipants(plan) >= 100 && yes(plan.prior_small_filing)) {
      notes.push('A prior small-plan filing does not change this. A Form 5500 is required.');
    }
    if (plan.cobra === 'unsure') notes.push('Confirm the federal COBRA employee count before you rely on the COBRA paragraph.');
    if (plan.cobra === 'no' && countParticipants(plan) >= 100) {
      notes.push('You answered that federal COBRA did not apply, and the covered-participant count is 100 or more. Those answers usually do not belong together. Confirm the prior-year employee count, including related employers.');
    }
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
    if (yes(plan.employee_contributions) && num(plan.employee_count) >= 50 && isSelfFundedFunding(plan.funding)) {
      notes.push('A self-funded health plan can face nondiscrimination rules. Whether the employer is an applicable large employer depends on full-time equivalents, not on this headcount alone. This sample does not decide either question.');
    } else if (num(plan.employee_count) >= 50) {
      notes.push('Whether the employer is an applicable large employer depends on full-time equivalents, not on this headcount alone.');
    } else if (isSelfFundedFunding(plan.funding) && hasBenefit(plan, 'medical')) {
      notes.push('A self-funded health plan can face nondiscrimination rules. This sample does not decide that question.');
    }
    if (complexFunding(plan)) notes.push(BROKER_LINE);
    if (plan.phi_classes_blank && (yes(plan.phi) || isSelfFundedFunding(plan.funding))) {
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
      original_effective_date: String(input.original_effective_date || '').trim(),
      is_restatement: input.is_restatement === 'yes' ? 'yes' : 'no',
      restatement_date: String(input.restatement_date || '').trim(),
      intended_signature_date: String(input.intended_signature_date || '').trim(),
      plan_year_type: input.plan_year_type === 'fiscal' ? 'fiscal' : 'calendar',
      plan_year_end_month: String(input.plan_year_end_month || ''),
      employee_count: String(input.employee_count || '').trim(),
      benefits: benefits,
      carriers: input.carriers || {},
      waiting: input.waiting || {},
      tax: input.tax || {},
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
      certificates: input.certificates || 'yes',
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
    plan.benefits = plan.benefits.filter(function (code) { return code !== 'dcap'; });
    if (!plan.phi && isSelfFundedFunding(plan.funding) && hasBenefit(plan, 'medical')) plan.phi = 'yes';
    plan.phi_classes_blank = (plan.phi === 'yes' && !plan.phi_classes);
    plan.address = [plan.street, plan.city, plan.state, plan.zip].filter(Boolean).join(', ');
    return plan;
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
    if (!plan.street || !plan.city || !plan.state || !/^\d{5}$/.test(plan.zip)) push(errors, 'address', 'Enter a street, city, state, and 5-digit ZIP code.');
    var pn = num(plan.plan_number);
    if (pn < 501 || pn > 999) push(errors, 'plan_number', 'Enter a plan number from 501 through 999.');
    if (!plan.original_effective_date) push(errors, 'original_effective_date', 'Enter the original effective date.');
    if (plan.is_restatement === 'yes' && !plan.restatement_date) push(errors, 'restatement_date', 'Enter the restatement date.');
    if (!plan.employee_count || num(plan.employee_count) < 1) push(errors, 'employee_count', 'Enter about how many employees you had last year.');
    if (!plan.benefits.length) push(errors, 'benefits', 'Select at least one benefit.');
    if (hasBenefit(plan, 'medical') && !plan.funding) push(errors, 'funding', 'Choose how medical is funded.');
    if (hasBenefit(plan, 'medical') && isSelfFundedFunding(plan.funding)) {
      if (!plan.tpa_name) push(errors, 'tpa_name', 'Enter the TPA name.');
      if (!plan.tpa_document) push(errors, 'tpa_document', 'Enter the name of the TPA plan document or SPD.');
      if (!plan.stop_loss) push(errors, 'stop_loss', 'Say whether stop-loss is in place.');
    }
    wrappedBenefits(plan).forEach(function (code) {
      if (!plan.carriers[code]) push(errors, 'carrier_' + code, 'Enter the carrier or administrator for ' + benefitLabel(code) + '.');
    });
    if (hasBenefit(plan, 'hra') && !plan.hra_type) push(errors, 'hra_type', 'Choose the HRA type.');
    if (hasBenefit(plan, 'eap') && !plan.eap_type) push(errors, 'eap_type', 'Say whether the EAP is referral-only or provides care.');
    if (hasBenefit(plan, 'std') && !plan.std_type) push(errors, 'std_type', 'Say how short-term disability is paid.');
    if (groupHealth(plan) && !plan.cobra) push(errors, 'cobra', 'Answer the federal COBRA question.');
    if (!plan.signer_name || !plan.signer_title) push(errors, 'signer_name', 'Enter the signer name and title.');
    if (!plan.contact_name) push(errors, 'contact_name', 'Enter your name.');
    if (!plan.contact_email || plan.contact_email.indexOf('@') === -1) push(errors, 'contact_email', 'Enter an email address.');
    if (yes(plan.trust) && !plan.trustee_name) push(errors, 'trustee_name', 'Enter the trustee name.');
    var volCodes = ['vol_life', 'vol_add', 'accident', 'critical', 'hospital'];
    var anyVol = volCodes.some(function (code) { return hasBenefit(plan, code); });
    if (anyVol && !plan.vol_consideration) push(errors, 'vol_consideration', 'Answer whether the employer receives consideration beyond reasonable pay for payroll deduction.');
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
    MSP_SENTENCE: MSP_SENTENCE,
    REVERSION: REVERSION,
    NEWBORNS: NEWBORNS,
    NEWBORNS_INSURED: NEWBORNS_INSURED,
    ALLOWED_ORIGINS: ALLOWED_ORIGINS,
    BENEFIT_LABELS: BENEFIT_LABELS,
    benefitLabel: benefitLabel,
    fundingLabel: fundingLabel,
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
    monthName: monthName
  };
})();
