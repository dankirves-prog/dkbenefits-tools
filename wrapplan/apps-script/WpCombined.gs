/**
 * DK Benefits wrap plan combined Apps Script.
 * Paste this file as the only script in a NEW project bound to the spreadsheet
 * "DK Benefits Wrap Plan Leads".
 * Do not paste it into the Section 125, Section 128, or quote-tool project.
 * Order: wp-model.js, wp-terms.js, wp-docgen.js, apps-script/Code.gs.
 * Generated from those files. Do not edit by hand.
 * Template wp-v1. Terms wp-terms-1.
 */
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
/**
 * Short terms for the wrap plan sample. Draft for DK Benefits LLC's own attorney before go-live.
 */
var WpTerms = (function () {
  var VERSION = 'wp-terms-1';
  var TEXT = [
    'This tool prepares a sample wrap plan document and the companion papers for a private employer.',
    'Sample prepared for review by the employer\'s own counsel. DK Benefits is not a law firm.',
    'The sample is not adopted until the employer signs it. The employer is responsible for the certificates, the filings, and the notices that go with the package.',
    'Do not type stop-loss deductibles or dollar limits. The sample does not include them.'
  ].join(' ');
  return { VERSION: VERSION, TEXT: TEXT };
})();
/**
 * Wrap plan sample documents.
 * Word uses Calibri. The PDF uses Times because the vendored pdf-lib has no fontkit.
 */
var WpDocgen = (function () {
  var W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
  var R = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
  var MONTHS = ['', 'January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

  function xml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
  function row(style, text, extra) {
    var item = { style: style, text: text };
    if (extra) Object.keys(extra).forEach(function (key) { item[key] = extra[key]; });
    return item;
  }
  function h1(text) { return row('Heading1', text, { keepNext: true, keepLines: true }); }
  function h2(text) { return row('Heading2', text, { keepNext: true, keepLines: true }); }
  function longDate(iso) {
    var match = String(iso || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (!match) return String(iso || '');
    var month = MONTHS[parseInt(match[2], 10)] || match[2];
    return month + ' ' + parseInt(match[3], 10) + ', ' + match[1];
  }
  function carrier(plan, code) {
    return (plan.carriers && plan.carriers[code]) || 'the carrier named for this benefit';
  }
  function adminName(plan) {
    if (plan.admin_choice === 'custom' && plan.admin_name) return plan.admin_name;
    return plan.employer_name;
  }
  function agentSentence(plan) {
    if (plan.agent_choice === 'custom' && plan.agent_name) {
      return 'The agent for service of legal process is ' + plan.agent_name + (plan.agent_address ? ', ' + plan.agent_address : '') + '. Service of legal process may also be made on the plan administrator.';
    }
    return 'The agent for service of legal process is ' + plan.employer_name + ', ' + plan.address + '. Service of legal process may also be made on the plan administrator.';
  }
  function fundingSentence(plan) {
    if (plan.funding === 'insured') return 'Medical benefits are fully insured. The insurer administers claims under the certificate.';
    if (plan.funding === 'level') return 'Medical benefits are self-funded under a level-funded arrangement. ' + (plan.tpa_name || 'The TPA') + ' administers claims. The employer is the named fiduciary. Benefits are paid from the employer\'s general assets.';
    if (plan.funding === 'aso') return 'Medical benefits are self-funded. ' + (plan.tpa_name || 'The TPA') + ' administers claims under an administrative-services arrangement. The employer is the named fiduciary. Benefits are paid from the employer\'s general assets.';
    if (plan.funding === 'captive') return 'Medical benefits are self-funded through a captive arrangement. ' + (plan.tpa_name || 'The TPA') + ' administers claims. The employer is the named fiduciary.';
    if (plan.funding === 'rbp') return 'Medical benefits are self-funded and use reference-based pricing. ' + (plan.tpa_name || 'The TPA') + ' administers claims. The employer is the named fiduciary.';
    return 'Each benefit is administered as its certificate or booklet describes.';
  }
  function taxSentence(plan, code) {
    var tax = (plan.tax && plan.tax[code]) || '';
    if (tax === 'pretax') return ' Employee contributions for this benefit are intended to be pre-tax under a separate Section 125 plan. This wrap is not that plan.';
    if (tax === 'aftertax') return ' Employee contributions for this benefit are taken after tax.';
    if (tax === 'none') return ' The employer does not take an employee contribution for this benefit.';
    return '';
  }
  function cobraParagraph(plan) {
    if (!WpModel.groupHealth(plan)) return '';
    if (plan.cobra === 'yes' || plan.cobra === 'unsure') {
      var who = plan.cobra_admin || 'the plan administrator';
      return 'Federal COBRA continuation coverage applies to the group health benefits under this plan to the extent the employer met the federal employee threshold in the prior calendar year. COBRA is administered by ' + who + '. The general notice and the election notice are part of this package. Those notices state the qualifying events, the election steps, and the deadlines.';
    }
    if (plan.cobra === 'no' && plan.funding === 'insured') {
      return 'Federal COBRA is not stated as applicable based on the employer\'s answer. State continuation coverage may be available. The certificate and state law control.';
    }
    if (plan.cobra === 'no') return 'Federal COBRA is not stated as applicable based on the employer\'s answer.';
    return '';
  }
  function erisaRights() {
    return [
      'As a participant in the plan, you are entitled to certain rights and protections under the Employee Retirement Income Security Act of 1974. ERISA provides that all plan participants shall be entitled to:',
      'Examine, without charge, at the plan administrator\'s office and at other specified locations, all documents governing the plan, including insurance contracts and a copy of the latest annual report, if any, filed by the plan with the U.S. Department of Labor.',
      'Obtain, upon written request to the plan administrator, copies of documents governing the operation of the plan, including insurance contracts and copies of the latest annual report, if any, and an updated summary plan description. The administrator may make a reasonable charge for the copies.',
      'Receive a summary of the plan\'s annual financial report if the plan is required to file an annual report. The plan administrator is required by law to furnish each participant with a copy of this summary annual report.',
      'Prudent actions by plan fiduciaries. In addition to creating rights for plan participants, ERISA imposes duties upon the people who are responsible for the operation of the employee benefit plan. The people who operate your plan, called fiduciaries, have a duty to do so prudently and in the interest of you and other plan participants and beneficiaries.',
      'Enforce your rights. If your claim for a benefit is denied or ignored, in whole or in part, you have a right to know why this was done, to obtain copies of documents relating to the decision without charge, and to appeal any denial, all within certain time schedules. Under ERISA, there are steps you can take to enforce the above rights. For instance, if you request a copy of plan documents or the latest annual report from the plan and do not receive them within 30 days, you may file suit in a Federal court. In such a case, the court may require the plan administrator to provide the materials and pay you up to $110 a day until you receive the materials, unless the materials were not sent because of reasons beyond the control of the administrator.',
      'If you have a claim for benefits which is denied or ignored, in whole or in part, you may file suit in a state or Federal court. If it should happen that plan fiduciaries misuse the plan\'s money, or if you are discriminated against for asserting your rights, you may seek assistance from the U.S. Department of Labor, or you may file suit in a Federal court. The court will decide who should pay court costs and legal fees. If you are successful the court may order the person you have sued to pay these costs and fees. If you lose, the court may order you to pay these costs and fees, for example, if it finds your claim is frivolous.',
      'If you have any questions about your plan, you should contact the plan administrator. If you have any questions about this statement or about your rights under ERISA, or if you need assistance in obtaining documents from the plan administrator, you should contact the nearest office of the Employee Benefits Security Administration, U.S. Department of Labor, or the Division of Technical Assistance and Inquiries, Employee Benefits Security Administration, U.S. Department of Labor, 200 Constitution Avenue N.W., Washington, D.C. 20210. You may also find answers at the Employee Benefits Security Administration website.'
    ];
  }
  function signatureRows(plan) {
    return [
      h1('Adoption'),
      row(null, 'The employer adopts this document when the authorized person signs it. The signature line and the date line are blank until that signature.'),
      row(null, 'Authorized signature: ________________________________'),
      row(null, 'Date: ________________________________'),
      row(null, 'Name: ' + plan.signer_name),
      row(null, 'Title: ' + plan.signer_title),
      row(null, 'Governing body: ' + (plan.governing_body || 'The governing body named by the employer'))
    ];
  }
  function planParagraphs(plan) {
    var rows = [];
    var benefits = WpModel.wrappedBenefits(plan);
    rows.push(row('Title', plan.plan_name, { keepNext: true, keepLines: true }));
    rows.push(row(null, 'Wrap plan document and summary plan description'));
    rows.push(row(null, WpModel.DISCLAIMER));
    rows.push(h1('Plan identity'));
    rows.push(row(null, 'Plan sponsor: ' + plan.employer_name + '. EIN ' + plan.employer_ein + '. Address: ' + plan.address + '. Phone: ' + (plan.phone || 'the number on the employer\'s records') + '.'));
    rows.push(row(null, 'Plan number: ' + plan.plan_number + '. ' + WpModel.planYearSentence(plan)));
    if (plan.is_restatement === 'yes') {
      rows.push(row(null, 'This document restates the plan originally effective ' + longDate(plan.original_effective_date) + '. This restatement is effective ' + longDate(plan.restatement_date) + '.'));
    } else {
      rows.push(row(null, 'The plan is effective ' + longDate(plan.original_effective_date) + '.'));
    }
    rows.push(row(null, 'This is an employee welfare benefit plan. ' + fundingSentence(plan)));
    rows.push(h1('Plan administrator and service of process'));
    rows.push(row(null, 'The plan administrator is ' + adminName(plan) + '. The administrator\'s address and phone are the sponsor\'s unless a different administrator address is on file.'));
    rows.push(row(null, agentSentence(plan)));
    if (plan.trust === 'yes') {
      rows.push(row(null, 'The trustee is ' + plan.trustee_name + (plan.trustee_address ? ', ' + plan.trustee_address : '') + '.'));
    }
    if (plan.bargaining === 'yes') {
      rows.push(row(null, 'Some benefits are maintained under a collective bargaining agreement. A copy of that agreement is available from the plan administrator on request.'));
    }
    rows.push(h1('Benefits wrapped under this plan'));
    rows.push(row(null, 'The following benefits are part of this plan. The certificate, booklet, or TPA document for each benefit is incorporated by reference.'));
    benefits.forEach(function (code) {
      var line = WpModel.benefitLabel(code) + ' is provided through ' + carrier(plan, code) + '.';
      if (code === 'hra' && plan.hra_type) line += ' The HRA type is ' + plan.hra_type + '. The separate HRA document is incorporated.';
      if (code === 'health_fsa') line += ' The separate health FSA document is incorporated.';
      if (code === 'medical' && plan.network === 'traditional') line += ' Benefits are provided through a provider network named in the certificate.';
      if (code === 'medical' && (plan.network === 'rbp' || plan.funding === 'rbp')) {
        line += ' Reference-based pricing can leave a balance bill. The No Surprises Act protects you for emergency care, certain non-emergency care at an in-network facility, and air ambulance services, as that law applies. The certificate controls the detail.';
      }
      var wait = plan.waiting && plan.waiting[code];
      if (wait) line += ' Waiting period: ' + wait + '.';
      line += taxSentence(plan, code);
      rows.push(row(null, line));
    });
    if (plan.tpa_document && WpModel.isSelfFundedFunding(plan.funding)) {
      rows.push(row(null, 'The TPA plan document or SPD named "' + plan.tpa_document + '" is incorporated for the self-funded medical benefit.'));
    }
    rows.push(h2('Order of control'));
    rows.push(row(null, 'The certificate or self-funded booklet controls covered services, exclusions, and dependent rules for that benefit. The carrier or TPA booklet controls the claim steps and the address for that benefit. This wrap controls the ERISA frame: name, number, sponsor, administrator, fiduciary, agent for service, plan year, amendment, and termination. Enrollment records show who elected what. They do not add a benefit the certificate does not provide. If this wrap reads richer than the certificate, the certificate still controls, and the employer should issue a summary of material modifications.'));
    rows.push(h1('Eligibility'));
    rows.push(row(null, 'Eligible classes: ' + (plan.classes || 'the classes named by the employer') + '. Hours: ' + (plan.hours || 'the hours requirement in the certificate') + '. Dependents: ' + (plan.dependents || 'the dependent categories in the certificate') + '.'));
    rows.push(row(null, 'Coverage may end when employment ends, when eligibility ends, when enrollment is missed, when a required contribution is not paid, when dependent status ends, when the plan is amended or terminated, or when the certificate states a tighter rule.'));
    rows.push(h1('Contributions'));
    if (plan.employee_contributions === 'yes' && plan.remitted === 'yes') {
      rows.push(row(null, 'Where employees contribute, the employer remits those amounts to the carrier or TPA.'));
    } else if (plan.employee_contributions === 'yes') {
      rows.push(row(null, 'Employees contribute toward one or more benefits, as the enrollment materials describe.'));
    } else {
      rows.push(row(null, 'The employer pays the cost of the wrapped benefits except as a certificate states otherwise.'));
    }
    rows.push(row(null, WpModel.REVERSION));
    rows.push(h1('Claims'));
    if (plan.funding === 'insured') {
      rows.push(row(null, 'The insurer decides medical claims under the certificate. You may get a copy of the claim procedure from the plan administrator without charge.'));
    } else if (plan.appeals === 'employer') {
      rows.push(row(null, (plan.tpa_name || 'The TPA') + ' administers claims. The employer decides the final internal appeal. You may get a copy of the claim procedure from the plan administrator without charge.'));
    } else {
      rows.push(row(null, (plan.tpa_name || carrier(plan, 'medical')) + ' administers claims. The employer is the named fiduciary. You may get a copy of the claim procedure from the plan administrator without charge.'));
    }
    if (WpModel.hasBenefit(plan, 'medical')) {
      rows.push(row(null, 'Medical claims that are subject to external review follow the external review process in the certificate.'));
    }
    if (WpModel.groupHealth(plan)) {
      rows.push(h1('Group health notices'));
      var cobra = cobraParagraph(plan);
      if (cobra) rows.push(row(null, cobra));
      rows.push(row(null, 'The plan has written procedures for qualified medical child support orders, including a National Medical Support Notice. A copy is available from the plan administrator without charge. Those procedures are part of this package.'));
      rows.push(row(null, WpModel.MSP_SENTENCE));
      if (WpModel.hasBenefit(plan, 'medical')) {
        rows.push(row(null, WpModel.NEWBORNS));
        if (plan.funding === 'insured') rows.push(row(null, WpModel.NEWBORNS_INSURED));
        rows.push(row(null, 'If the plan covers mastectomy, it will provide reconstruction of the breast on which the mastectomy was performed, surgery and reconstruction of the other breast, prostheses, and treatment of physical complications including lymphedema, in the manner the certificate describes.'));
        if (WpModel.parityMode(plan) === 'print') {
          rows.push(row(null, 'Financial requirements and treatment limits on mental health and substance use benefits are not more restrictive than the limits on medical and surgical benefits, as federal law requires.'));
        } else if (WpModel.parityMode(plan) === 'booklet') {
          rows.push(row(null, 'Mental health and substance use benefits, and any limits on those benefits, are described in the certificate or booklet.'));
        }
      }
      if (plan.phi === 'yes') {
        rows.push(row(null, 'The plan may disclose protected health information to the plan sponsor only for plan administration, and only after the sponsor certifies that the plan has been amended and that the sponsor agrees to the limits in the HIPAA amendment. The sponsor will not use that information for employment decisions. The people who may see it are: ' + (plan.phi_classes || 'the classes written on the HIPAA amendment') + '.'));
      } else {
        rows.push(row(null, 'The plan sponsor does not receive protected health information for plan administration beyond enrollment and disenrollment.'));
      }
    }
    rows.push(h1('Statement of ERISA rights'));
    erisaRights().forEach(function (text) { rows.push(row(null, text)); });
    rows.push(h1('Amendment and termination'));
    rows.push(row(null, 'The employer may amend or terminate the plan by written action of ' + (plan.governing_body || 'its governing body') + '. A material change is communicated in a summary of material modifications. Welfare benefits are not vested.'));
    rows.push(row(null, WpModel.REVERSION));
    rows.push.apply(rows, signatureRows(plan));
    return rows;
  }
  function scheduleParagraphs(plan) {
    var rows = [];
    rows.push(row('Title', 'Schedule A: Documents to attach', { keepNext: true, keepLines: true }));
    rows.push(row(null, WpModel.DISCLAIMER));
    rows.push(row(null, 'This list is the employer\'s attachment list. It is not the insurance schedule filed with a Form 5500.'));
    WpModel.wrappedBenefits(plan).forEach(function (code) {
      var funding = code === 'medical' ? WpModel.fundingLabel(plan.funding || 'insured') : 'As stated in the certificate';
      var doc = code === 'medical' && plan.tpa_document ? plan.tpa_document : 'Certificate or booklet';
      rows.push(row(null, WpModel.benefitLabel(code) + '. Carrier or administrator: ' + carrier(plan, code) + '. Attach: ' + doc + '. Funding: ' + funding + '.'));
    });
    rows.push(h1('Assembly'));
    rows.push(row(null, 'Put the wrap plan document first. Then attach each certificate in the order above. Add the claim procedure if it is not already inside the certificate. Give that package to participants.'));
    rows.push(row(null, 'Give the package within 90 days after a person becomes covered, and within 120 days after the plan becomes subject to the reporting rules. A material change is described in a summary of material modifications within 210 days after the plan year ends. Restate the summary plan description every five years if material changes were made, and every ten years if they were not.'));
    rows.push(row(null, 'Keep the signed wrap, the adoption resolution, and a record of what was sent, when it was sent, and to whom.'));
    return rows;
  }
  function resolutionParagraphs(plan) {
    var when = plan.is_restatement === 'yes' ? longDate(plan.restatement_date) : longDate(plan.original_effective_date);
    var rows = [
      row('Title', 'Adoption resolution', { keepNext: true, keepLines: true }),
      row(null, WpModel.DISCLAIMER),
      row(null, plan.employer_name + ' resolves that the ' + plan.plan_name + ' is adopted effective ' + when + ' when the authorized person signs this resolution.')
    ];
    if (plan.is_restatement === 'yes') {
      rows.push(row(null, 'This resolution restates the plan originally effective ' + longDate(plan.original_effective_date) + '.'));
    }
    rows.push.apply(rows, signatureRows(plan));
    return rows;
  }
  function hipaaParagraphs(plan) {
    return [
      row('Title', 'HIPAA privacy amendment', { keepNext: true, keepLines: true }),
      row(null, WpModel.DISCLAIMER),
      row(null, 'The plan may disclose protected health information to the plan sponsor only for plan administration and only as federal privacy law allows.'),
      row(null, 'The plan sponsor certifies that the plan documents have been amended to include these limits and that the sponsor agrees to them.'),
      row(null, 'The sponsor will not use or further disclose the information except as the plan documents allow or as law requires. Agents who receive it agree to the same limits. The sponsor will not use it for employment decisions. The sponsor will report a use or disclosure that is not allowed. The sponsor will make the information available for access, amendment, and an accounting, and will make its books available to the U.S. Department of Health and Human Services. When the information is no longer needed, the sponsor will return or destroy it if that is feasible. The sponsor will apply administrative, physical, and technical safeguards.'),
      row(null, 'The classes of people who may see the information for plan administration are: ' + (plan.phi_classes || '________________________________') + '.'),
      row(null, 'Plan sponsor certification signature: ________________________________'),
      row(null, 'Date: ________________________________'),
      row(null, 'Name: ' + plan.signer_name),
      row(null, 'Title: ' + plan.signer_title)
    ];
  }
  function qmcsoParagraphs(plan) {
    return [
      row('Title', 'Qualified medical child support order procedures', { keepNext: true, keepLines: true }),
      row(null, WpModel.DISCLAIMER),
      row(null, plan.employer_name + ' will use these procedures for medical child support orders, including a National Medical Support Notice.'),
      row(null, 'When an order or a National Medical Support Notice arrives, the plan administrator notifies the participant and each alternate recipient. A National Medical Support Notice is handled as a medical child support order under federal law.'),
      row(null, 'The administrator decides whether the order is qualified and sends that decision in writing. Coverage required by a qualified order is provided as the order and the certificate allow.'),
      row(null, 'A copy of these procedures is available from the plan administrator without charge.')
    ];
  }
  function findingsParagraphs(plan, findings) {
    var rows = [
      row('Title', 'Findings report', { keepNext: true, keepLines: true }),
      row(null, WpModel.DISCLAIMER),
      row(null, 'This note is for the employer. It is not part of the summary plan description given to employees.')
    ];
    (findings || WpModel.findingsFor(plan)).forEach(function (line) { rows.push(row(null, line)); });
    return rows;
  }
  function explainParagraphs(plan) {
    var text = 'This tool drafts an ERISA wrap for a private employer. It does not fit this arrangement, so no ERISA plan document was prepared.';
    if (plan.erisa_path === 'governmental') text = 'A governmental plan is generally outside ERISA. An ERISA wrap is the wrong document. This tool did not prepare one.';
    if (plan.erisa_path === 'church') text = 'A church plan is generally outside ERISA. This tool does not draft an ERISA wrap for it.';
    if (plan.erisa_path === 'owner-only') text = 'A plan that covers only an owner and spouse, or only partners and their spouses, and no common-law employee, is generally not an ERISA plan. This tool did not draft an ERISA wrap.';
    return [
      row('Title', 'About this arrangement', { keepNext: true, keepLines: true }),
      row(null, WpModel.DISCLAIMER),
      row(null, text),
      row(null, 'DK Benefits keeps a record of this request.')
    ];
  }
  function followUpEmailText(plan, lead) {
    var first = String((lead && lead.contact_name) || '').trim().split(/\s+/)[0];
    return [
      first ? ('Hi ' + first + ',') : 'Hi there,',
      '',
      'I hope the wrap document was useful.',
      '',
      'Since this is a free tool, it\'s always a good idea to have your own counsel take a quick look before you sign.',
      '',
      'If you don\'t want to hear from me that\'s fine too just let me know.',
      '',
      'Daniel Kirves',
      'Benefits Broker | 20 Years Exp | DK Benefits',
      '407-476-5076 | www.dkbenefits.net',
      '6000 Metrowest Blvd #200 Orlando, FL 32835',
      'Agency Lic# L109331'
    ].join('\n');
  }
  function followUpEmailHtml(plan, lead) {
    return '<div>' + followUpEmailText(plan, lead).split('\n').map(function (line) {
      return xml(line);
    }).join('<br>\n') + '</div>';
  }

  function paragraphXml(item) {
    var bits = [];
    if (item.style) bits.push('<w:pStyle w:val="' + xml(item.style) + '"/>');
    if (item.keepNext) bits.push('<w:keepNext/>');
    if (item.keepLines) bits.push('<w:keepLines/>');
    var pPr = bits.length ? '<w:pPr>' + bits.join('') + '</w:pPr>' : '';
    return '<w:p>' + pPr + '<w:r><w:t xml:space="preserve">' + xml(item.text || '') + '</w:t></w:r></w:p>';
  }
  function documentXml(rows) {
    return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<w:document xmlns:w="' + W + '" xmlns:r="' + R + '"><w:body>' + rows.map(paragraphXml).join('') +
      '<w:sectPr><w:headerReference w:type="default" r:id="rId2"/><w:footerReference w:type="default" r:id="rId3"/>' +
      '<w:pgSz w:w="12240" w:h="15840"/>' +
      '<w:pgMar w:top="936" w:right="1152" w:bottom="936" w:left="1152" w:header="720" w:footer="720" w:gutter="0"/>' +
      '</w:sectPr></w:body></w:document>';
  }
  function headerXml() {
    return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:hdr xmlns:w="' + W + '"><w:p><w:pPr><w:pStyle w:val="Header"/></w:pPr></w:p></w:hdr>';
  }
  function pageField(instr) {
    return '<w:r><w:fldChar w:fldCharType="begin"/></w:r><w:r><w:instrText xml:space="preserve"> ' + instr + ' </w:instrText></w:r>' +
      '<w:r><w:fldChar w:fldCharType="separate"/></w:r><w:r><w:t>1</w:t></w:r><w:r><w:fldChar w:fldCharType="end"/></w:r>';
  }
  function footerXml(label) {
    var name = xml(label || '');
    return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:ftr xmlns:w="' + W + '"><w:p><w:pPr><w:pStyle w:val="Footer"/><w:jc w:val="center"/></w:pPr>' +
      (name ? '<w:r><w:t xml:space="preserve">' + name + ' | Page </w:t></w:r>' : '<w:r><w:t xml:space="preserve">Page </w:t></w:r>') +
      pageField('PAGE') + '<w:r><w:t xml:space="preserve"> of </w:t></w:r>' + pageField('NUMPAGES') + '</w:p></w:ftr>';
  }
  function stylesXml() {
    return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:styles xmlns:w="' + W + '">' +
      '<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:pPr><w:spacing w:after="120"/></w:pPr><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/><w:sz w:val="22"/></w:rPr></w:style>' +
      '<w:style w:type="paragraph" w:styleId="Title"><w:name w:val="Title"/><w:basedOn w:val="Normal"/><w:rPr><w:b/><w:sz w:val="36"/><w:color w:val="1A2E4A"/></w:rPr></w:style>' +
      '<w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/><w:basedOn w:val="Normal"/><w:rPr><w:b/><w:sz w:val="28"/><w:color w:val="1A2E4A"/></w:rPr></w:style>' +
      '<w:style w:type="paragraph" w:styleId="Heading2"><w:name w:val="heading 2"/><w:basedOn w:val="Normal"/><w:rPr><w:b/><w:sz w:val="24"/><w:color w:val="1A2E4A"/></w:rPr></w:style>' +
      '<w:style w:type="paragraph" w:styleId="Header"><w:name w:val="Header"/><w:basedOn w:val="Normal"/></w:style>' +
      '<w:style w:type="paragraph" w:styleId="Footer"><w:name w:val="Footer"/><w:basedOn w:val="Normal"/></w:style></w:styles>';
  }
  function coreXml(props) {
    return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/">' +
      '<dc:title>' + xml(props.title || 'Wrap plan') + '</dc:title><dc:creator>DK Benefits LLC</dc:creator></cp:coreProperties>';
  }
  function contentTypesXml() {
    return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
      '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
      '<Default Extension="xml" ContentType="application/xml"/>' +
      '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>' +
      '<Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>' +
      '<Override PartName="/word/header1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.header+xml"/>' +
      '<Override PartName="/word/footer1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.footer+xml"/>' +
      '<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>' +
      '</Types>';
  }
  function rootRels() {
    return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
      '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>' +
      '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/></Relationships>';
  }
  function docRels() {
    return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
      '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>' +
      '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/header" Target="header1.xml"/>' +
      '<Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/footer" Target="footer1.xml"/></Relationships>';
  }
  function utf8(str) {
    if (typeof TextEncoder !== 'undefined') return new TextEncoder().encode(str);
    return new Uint8Array([]);
  }
  function u16(n) { return new Uint8Array([n & 255, (n >> 8) & 255]); }
  function u32(n) { return new Uint8Array([n & 255, (n >> 8) & 255, (n >> 16) & 255, (n >>> 24) & 255]); }
  function concatBytes(parts) {
    var len = 0;
    for (var i = 0; i < parts.length; i++) len += parts[i].length;
    var out = new Uint8Array(len);
    var o = 0;
    for (var j = 0; j < parts.length; j++) { out.set(parts[j], o); o += parts[j].length; }
    return out;
  }
  function crc32(bytes) {
    var c = 0xffffffff;
    for (var i = 0; i < bytes.length; i++) {
      c = c ^ bytes[i];
      for (var k = 0; k < 8; k++) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    }
    return (c ^ 0xffffffff) >>> 0;
  }
  function zipStore(files) {
    var locals = [];
    var centrals = [];
    var offset = 0;
    for (var i = 0; i < files.length; i++) {
      var nameBytes = utf8(files[i].name);
      var data = utf8(files[i].text);
      var crc = crc32(data);
      var local = concatBytes([u32(0x04034b50), u16(20), u16(0), u16(0), u16(0), u16(0x21), u32(crc), u32(data.length), u32(data.length), u16(nameBytes.length), u16(0), nameBytes, data]);
      locals.push(local);
      centrals.push(concatBytes([u32(0x02014b50), u16(20), u16(20), u16(0), u16(0), u16(0), u16(0x21), u32(crc), u32(data.length), u32(data.length), u16(nameBytes.length), u16(0), u16(0), u16(0), u16(0), u32(0), u32(offset), nameBytes]));
      offset += local.length;
    }
    var central = concatBytes(centrals);
    return concatBytes(locals.concat([central, concatBytes([u32(0x06054b50), u16(0), u16(0), u16(files.length), u16(files.length), u32(central.length), u32(offset), u16(0)])]));
  }
  function buildDocx(rows, props) {
    props = props || {};
    return zipStore([
      { name: '[Content_Types].xml', text: contentTypesXml() },
      { name: '_rels/.rels', text: rootRels() },
      { name: 'docProps/core.xml', text: coreXml(props) },
      { name: 'word/document.xml', text: documentXml(rows) },
      { name: 'word/styles.xml', text: stylesXml() },
      { name: 'word/header1.xml', text: headerXml() },
      { name: 'word/footer1.xml', text: footerXml(props.footer || props.title || '') },
      { name: 'word/_rels/document.xml.rels', text: docRels() }
    ]);
  }
  function safe(name) {
    return String(name || 'Employer').replace(/[^A-Za-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 40) || 'Employer';
  }
  function planFileName(plan) { return safe(plan.employer_name) + '_Wrap_Plan.docx'; }
  function scheduleFileName(plan) { return safe(plan.employer_name) + '_Schedule_A.docx'; }
  function resolutionFileName(plan) { return safe(plan.employer_name) + '_Adoption_Resolution.docx'; }
  function hipaaFileName(plan) { return safe(plan.employer_name) + '_HIPAA_Amendment.docx'; }
  function qmcsoFileName(plan) { return safe(plan.employer_name) + '_QMCSO_Procedures.docx'; }
  function findingsFileName(plan) { return safe(plan.employer_name) + '_Findings.docx'; }
  function explainFileName(plan) { return safe(plan.employer_name) + '_Explanation.docx'; }
  function pdfFileName(docxName) { return String(docxName).replace(/\.docx$/i, '.pdf'); }
  function footerFor(plan, title) {
    return plan.employer_name + ' ' + title;
  }
  function plainText(rows) {
    return (rows || []).map(function (item) { return item.text || ''; }).join('\n');
  }
  function needsHipaa(plan) {
    return plan.phi === 'yes';
  }
  function needsQmcso(plan) {
    return WpModel.groupHealth(plan);
  }

  return {
    planParagraphs: planParagraphs,
    scheduleParagraphs: scheduleParagraphs,
    resolutionParagraphs: resolutionParagraphs,
    hipaaParagraphs: hipaaParagraphs,
    qmcsoParagraphs: qmcsoParagraphs,
    findingsParagraphs: findingsParagraphs,
    explainParagraphs: explainParagraphs,
    followUpEmailText: followUpEmailText,
    followUpEmailHtml: followUpEmailHtml,
    buildDocx: buildDocx,
    planFileName: planFileName,
    scheduleFileName: scheduleFileName,
    resolutionFileName: resolutionFileName,
    hipaaFileName: hipaaFileName,
    qmcsoFileName: qmcsoFileName,
    findingsFileName: findingsFileName,
    explainFileName: explainFileName,
    pdfFileName: pdfFileName,
    footerFor: footerFor,
    plainText: plainText,
    needsHipaa: needsHipaa,
    needsQmcso: needsQmcso,
    longDate: longDate
  };
})();
/**
 * DK Benefits wrap plan lead service.
 * Container-bound to a spreadsheet named DK Benefits Wrap Plan Leads.
 * Do not paste this into the Section 125, Section 128, or quote-tool script.
 * Deploy as a web app: Execute as Me (dan@dkbenefits.net), Who has access: Anyone.
 * Run setupWrapPlan once from the editor.
 */
var WP_NOTIFY_EMAIL = 'dan@dkbenefits.net';
var WP_SUBMISSIONS = 'Submissions';
var WP_EVENTS = 'Events';
var WP_FOLLOWUPS = 'FollowUps';
var WP_FOLLOWUP_DELAY_MS = 12 * 60 * 1000;
var WP_MIN_ELAPSED_MS = 3000;
var WP_DAILY_CAP = 50;
var WP_HOURLY_VISITOR = 3;
var WP_SUBMISSION_HEADERS = [
  'timestamp', 'submission_id', 'status', 'test', 'company', 'state', 'contact_name',
  'contact_email', 'contact_phone', 'employee_count', 'role', 'utm', 'referrer',
  'erisa_path', 'funding', 'benefits', 'plan_number', 'covered_participants', 'filing_result',
  'cobra', 'phi', 'lead_score', 'findings_summary', 'renewal_reminder_on', 'renewal_emailed_dan',
  'page_url', 'template_version', 'lead_emailed', 'visitor_emailed', 'error', 'payload_json',
  'terms_version', 'terms_accepted_at'
];
var WP_EVENT_HEADERS = ['timestamp', 'kind', 'submission_id', 'detail'];
var WP_FOLLOWUP_HEADERS = ['timestamp', 'email', 'name', 'company', 'status', 'test', 'submission_id', 'error', 'sent_at', 'not_before'];

function doGet() {
  return ContentService.createTextOutput('DK Benefits wrap plan lead service is deployed. Submit the form to deliver a lead.')
    .setMimeType(ContentService.MimeType.TEXT);
}

function doPost(e) {
  var payload;
  try { payload = JSON.parse((e && e.postData && e.postData.contents) || '{}'); }
  catch (err) { return wpJson_({ ok: false, error: 'The submission could not be read.' }); }
  if (!payload || payload.event !== 'wp_submission') return wpJson_({ ok: false, error: 'Unrecognized submission.' });
  try { return wpJson_(wpHandle_(payload)); }
  catch (err2) { return wpJson_({ ok: false, error: 'The sample could not be sent.' }); }
}

function setupWrapPlan() {
  wpSheet_(WP_SUBMISSIONS, WP_SUBMISSION_HEADERS);
  wpSheet_(WP_EVENTS, WP_EVENT_HEADERS);
  wpSheet_(WP_FOLLOWUPS, WP_FOLLOWUP_HEADERS);
  setupFollowUpTrigger();
}

function setupFollowUpTrigger() {
  var triggers = ScriptApp.getProjectTriggers();
  for (var i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === 'wpSendDueFollowUps') return;
  }
  ScriptApp.newTrigger('wpSendDueFollowUps').timeBased().everyMinutes(5).create();
}

function wpCountToday_() {
  var sheet = wpSheet_(WP_SUBMISSIONS, WP_SUBMISSION_HEADERS);
  var rows = sheet.getDataRange().getValues();
  var day = new Date().toISOString().slice(0, 10);
  var n = 0;
  for (var i = 1; i < rows.length; i++) {
    if (String(rows[i][0] || '').slice(0, 10) === day) n++;
  }
  return n;
}

function wpHandle_(payload) {
  if (payload.hp) return { ok: false, error: 'The sample could not be sent.' };
  var started = Date.parse(payload.startedAt || '');
  var submitted = Date.parse(payload.submittedAt || '') || Date.now();
  if (!started || submitted - started < WP_MIN_ELAPSED_MS) return { ok: false, error: 'The sample could not be sent.' };
  var ack = payload.acknowledgement || {};
  if (ack.accepted !== true || ack.termsVersion !== WpTerms.VERSION) return { ok: false, error: 'The terms acknowledgement is missing.' };
  var checked = WpModel.validateSubmission(payload);
  if (!checked.ok) return { ok: false, error: checked.errors[0].message };
  if (wpCountToday_() >= WP_DAILY_CAP) return { ok: false, error: 'The daily email limit has been reached. Questions about DK Benefits services? 407-476-5076.' };
  var plan = checked.plan;
  var lead = checked.lead;
  wpSheet_(WP_SUBMISSIONS, WP_SUBMISSION_HEADERS).appendRow([
    new Date().toISOString(), payload.submissionId, 'sent', payload.test ? 'yes' : 'no', plan.employer_name, plan.state,
    lead.contact_name, lead.contact_email, lead.contact_phone || '', plan.employee_count, plan.role || '',
    plan.utm || '', plan.referrer || '', plan.erisa_path, plan.funding || '', (plan.benefits || []).join('|'),
    plan.plan_number, WpModel.countParticipants(plan), checked.filing ? checked.filing.code : '',
    plan.cobra || '', plan.phi || '', lead.score, (checked.findings || []).join(' '),
    WpModel.renewalReminderOn(plan, new Date(submitted)), '',
    payload.pageUrl || '', payload.templateVersion || WpModel.TEMPLATE_VERSION, 'yes', 'no', '',
    '', ack.termsVersion, ack.acceptedAt
  ]);
  wpSheet_(WP_EVENTS, WP_EVENT_HEADERS).appendRow([new Date().toISOString(), 'sent', payload.submissionId, 'dan']);
  MailApp.sendEmail(wpLeadMessage_(payload, checked));
  var notBefore = wpFollowUpWhen_(submitted + WP_FOLLOWUP_DELAY_MS);
  wpSheet_(WP_FOLLOWUPS, WP_FOLLOWUP_HEADERS).appendRow([
    new Date(submitted).toISOString(), lead.contact_email, lead.contact_name, plan.employer_name,
    'pending', payload.test ? 'yes' : 'no', payload.submissionId, '', '', new Date(notBefore).toISOString()
  ]);
  return { ok: true, leadEmailed: true, visitorEmailed: false };
}

function wpLeadMessage_(payload, checked) {
  var plan = checked.plan;
  var lead = checked.lead;
  var subject = (payload.test ? '[TEST] ' : '') + 'New Wrap Plan Lead: ' + plan.employer_name;
  var lines = [
    subject,
    'Role: ' + WpModel.roleLabel(plan.role),
    'Email: ' + lead.contact_email,
    'Phone: ' + (lead.contact_phone || ''),
    'Employees last year: ' + plan.employee_count,
    'Covered participants: ' + WpModel.countParticipants(plan),
    'Lead score: ' + lead.score,
    'Renewal reminder for Dan: ' + WpModel.renewalReminderOn(plan, new Date()),
    '',
    'Findings',
    (checked.findings || []).join('\n')
  ];
  return { to: WP_NOTIFY_EMAIL, subject: subject, body: lines.join('\n'), attachments: wpFiles_(payload) };
}

function wpFiles_(payload) {
  var out = [];
  var files = payload.files || [];
  for (var i = 0; i < files.length && out.length < 8; i++) {
    var file = files[i];
    if (!file || (file.mime !== 'application/pdf' && file.mime.indexOf('wordprocessingml') === -1)) continue;
    try {
      var bytes = Utilities.base64Decode(String(file.dataBase64 || ''));
      if (!bytes || !bytes.length) continue;
      if (file.mime === 'application/pdf' && (bytes[0] !== 0x25 || bytes[1] !== 0x50)) continue;
      if (file.mime !== 'application/pdf' && (bytes[0] !== 0x50 || bytes[1] !== 0x4B)) continue;
      out.push(Utilities.newBlob(bytes, file.mime, file.name || 'wrap'));
    } catch (err) {}
  }
  return out;
}

function wpHourEt_(ms) {
  var parts = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date(ms));
  var hour = 0;
  var minute = 0;
  parts.forEach(function (part) {
    if (part.type === 'hour') hour = parseInt(part.value, 10);
    if (part.type === 'minute') minute = parseInt(part.value, 10);
  });
  return { hour: hour, minute: minute };
}

function wpInWindow_(ms) {
  var clock = wpHourEt_(ms);
  return clock.hour >= 7 && clock.hour <= 18;
}

function wpFollowUpWhen_(dueMs) {
  if (wpInWindow_(dueMs)) return dueMs;
  var cursor = dueMs;
  for (var i = 0; i < 96; i++) {
    cursor += 15 * 60 * 1000;
    var clock = wpHourEt_(cursor);
    if (clock.hour === 7) return cursor - clock.minute * 60 * 1000;
  }
  return dueMs;
}

function wpSendDueFollowUps() {
  try { wpSendDueRenewals(); } catch (ignoreRenewal) {}
  var sheet = wpSheet_(WP_FOLLOWUPS, WP_FOLLOWUP_HEADERS);
  var rows = sheet.getDataRange().getValues();
  var now = Date.now();
  var sentThisHour = 0;
  for (var r = 1; r < rows.length; r++) {
    if (rows[r][4] !== 'pending') continue;
    var due = Date.parse(rows[r][9] || '');
    if (!due || due > now) continue;
    if (!wpInWindow_(now)) continue;
    var email = String(rows[r][1] || '');
    if (wpAlreadyToday_(rows, email, r)) {
      sheet.getRange(r + 1, 5).setValue('skipped');
      continue;
    }
    if (sentThisHour >= WP_HOURLY_VISITOR) continue;
    var plan = { employer_name: rows[r][3] };
    var lead = { contact_name: rows[r][2], contact_email: email };
    var subject = (rows[r][5] === 'yes' ? '[TEST] ' : '') + 'Your wrap plan sample';
    MailApp.sendEmail({
      to: email,
      replyTo: WP_NOTIFY_EMAIL,
      name: 'Daniel Kirves',
      subject: subject,
      body: WpDocgen.followUpEmailText(plan, lead),
      htmlBody: WpDocgen.followUpEmailHtml(plan, lead)
    });
    sheet.getRange(r + 1, 5).setValue('sent');
    sheet.getRange(r + 1, 9).setValue(new Date().toISOString());
    wpMarkVisitorEmailed_(rows[r][6]);
    sentThisHour++;
  }
}

function wpMarkVisitorEmailed_(submissionId) {
  if (!submissionId) return;
  var sheet = wpSheet_(WP_SUBMISSIONS, WP_SUBMISSION_HEADERS);
  var rows = sheet.getDataRange().getValues();
  for (var i = 1; i < rows.length; i++) {
    if (String(rows[i][1]) === String(submissionId)) sheet.getRange(i + 1, 29).setValue('yes');
  }
}

function wpSendDueRenewals() {
  var sheet = wpSheet_(WP_SUBMISSIONS, WP_SUBMISSION_HEADERS);
  var rows = sheet.getDataRange().getValues();
  var today = new Date().toISOString().slice(0, 10);
  for (var r = 1; r < rows.length; r++) {
    var when = String(rows[r][23] || '');
    var sent = String(rows[r][24] || '');
    if (!when || sent || when > today) continue;
    MailApp.sendEmail({
      to: WP_NOTIFY_EMAIL,
      subject: 'Wrap renewal reminder: ' + rows[r][4],
      body: 'Internal reminder for Dan only. ' + rows[r][4] + ' reminder date ' + when + '.'
    });
    sheet.getRange(r + 1, 25).setValue('yes');
  }
}

function wpAlreadyToday_(rows, email, index) {
  var day = new Date().toISOString().slice(0, 10);
  for (var i = 1; i < rows.length; i++) {
    if (i === index) continue;
    if (String(rows[i][1] || '').toLowerCase() !== email.toLowerCase()) continue;
    if (rows[i][4] === 'sent' && String(rows[i][8] || '').slice(0, 10) === day) return true;
  }
  return false;
}

function wpSheet_(name, headers) {
  var book = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = book.getSheetByName(name);
  if (!sheet) {
    sheet = book.insertSheet(name);
    sheet.appendRow(headers);
  }
  return sheet;
}

function wpJson_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
