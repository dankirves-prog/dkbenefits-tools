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
    if (code === 'hra' || code === 'health_fsa') return false;
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
    if (plan.cobra === 'unsure') notes.push('Confirm the federal COBRA employee count before you rely on the COBRA paragraph.');
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
      original_effective_date: String(input.original_effective_date || '').trim(),
      is_restatement: input.is_restatement === 'yes' ? 'yes' : 'no',
      restatement_date: String(input.restatement_date || '').trim(),
      intended_signature_date: String(input.intended_signature_date || '').trim(),
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
    if (!/^\d{3}$/.test(plan.plan_number) || num(plan.plan_number) < 501 || num(plan.plan_number) > 999) {
      push(errors, 'plan_number', 'Enter a three-digit plan number from 501 through 999.');
    }
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
    if (num(plan.census.a) < 1) push(errors, 'census_a', 'Enter at least 1 current employee covered by a wrapped benefit.');
    wrappedBenefits(plan).forEach(function (code) {
      if (!plan.carriers[code]) push(errors, 'carrier_' + code, 'Enter the carrier or administrator for ' + benefitLabel(code) + '.');
      if (needsCarrierAddress(plan, code)) {
        var addr = plan.carrier_addresses && plan.carrier_addresses[code];
        if (!String(addr || '').trim()) push(errors, 'carrier_address_' + code, 'Enter the address for ' + benefitLabel(code) + '.');
      }
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
  function phoneText(plan) {
    return WpModel.formatPhone(plan.phone) || 'the number on the employer\'s records';
  }
  function administratorIdentity(plan) {
    return 'The plan administrator is ' + adminName(plan) + '. The administrator\'s business address is ' + plan.address + '. The administrator\'s phone is ' + phoneText(plan) + '.';
  }
  function governingBody(plan) {
    var body = String(plan.governing_body || '').trim();
    if (!body) return 'the governing body';
    if (/^the\b/i.test(body)) return body;
    return 'the ' + body;
  }
  function governingVerb(plan) {
    var body = String(plan.governing_body || '').replace(/^the\s+/i, '');
    if (/^(llc\s+)?(members|directors|partners|trustees|owners)\b/i.test(body)) return 'adopt';
    if (/\bmembers\b/i.test(body) && !/^board\b/i.test(body)) return 'adopt';
    return 'adopts';
  }
  function administrationType(plan, code) {
    if (code === 'hra' || code === 'health_fsa') return 'sponsor administration';
    if (code === 'medical' && WpModel.isSelfFundedFunding(plan.funding)) return 'contract administration';
    if (code === 'std' && plan.std_type === 'trust') return 'sponsor administration';
    if (WpModel.benefitIsInsured(plan, code)) return 'insurer administration';
    return 'sponsor administration';
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
      return 'Federal COBRA does not apply. State continuation coverage may be available. The certificate and state law control.';
    }
    if (plan.cobra === 'no') return 'Federal COBRA does not apply.';
    return '';
  }
  function erisaRights(plan) {
    var rights = [
      'As a participant in the plan, you are entitled to certain rights and protections under the Employee Retirement Income Security Act of 1974. ERISA provides that all plan participants shall be entitled to:',
      'Examine, without charge, at the plan administrator\'s office and at other specified locations, all documents governing the plan, including insurance contracts and a copy of the latest annual report, if any, filed by the plan with the U.S. Department of Labor.',
      'Obtain, upon written request to the plan administrator, copies of documents governing the operation of the plan, including insurance contracts and copies of the latest annual report, if any, and an updated summary plan description. The administrator may make a reasonable charge for the copies.',
      'Receive a summary of the plan\'s annual financial report if the plan is required to file an annual report. The plan administrator is required by law to furnish each participant with a copy of this summary annual report.'
    ];
    if (plan && WpModel.groupHealth(plan) && (plan.cobra === 'yes' || plan.cobra === 'unsure')) {
      rights.push('Continue Group Health Plan Coverage. Continue health care coverage for yourself, spouse or dependents if there is a loss of coverage under the plan as a result of a qualifying event. You or your dependents may have to pay for such coverage. Review this summary plan description and the documents governing the plan on the rules governing your COBRA continuation coverage rights.');
    }
    rights.push('Prudent actions by plan fiduciaries. In addition to creating rights for plan participants, ERISA imposes duties upon the people who are responsible for the operation of the employee benefit plan. The people who operate your plan, called fiduciaries, have a duty to do so prudently and in the interest of you and other plan participants and beneficiaries.');
    rights.push('Enforce your rights. If your claim for a benefit is denied or ignored, in whole or in part, you have a right to know why this was done, to obtain copies of documents relating to the decision without charge, and to appeal any denial, all within certain time schedules. Under ERISA, there are steps you can take to enforce the above rights. For instance, if you request a copy of plan documents or the latest annual report from the plan and do not receive them within 30 days, you may file suit in a Federal court. In such a case, the court may require the plan administrator to provide the materials and pay you up to $110 a day until you receive the materials, unless the materials were not sent because of reasons beyond the control of the administrator.');
    rights.push('If you have a claim for benefits which is denied or ignored, in whole or in part, you may file suit in a state or Federal court. If it should happen that plan fiduciaries misuse the plan\'s money, or if you are discriminated against for asserting your rights, you may seek assistance from the U.S. Department of Labor, or you may file suit in a Federal court. The court will decide who should pay court costs and legal fees. If you are successful the court may order the person you have sued to pay these costs and fees. If you lose, the court may order you to pay these costs and fees, for example, if it finds your claim is frivolous.');
    rights.push('If you have any questions about your plan, you should contact the plan administrator. If you have any questions about this statement or about your rights under ERISA, or if you need assistance in obtaining documents from the plan administrator, you should contact the nearest office of the Employee Benefits Security Administration, U.S. Department of Labor, or the Division of Technical Assistance and Inquiries, Employee Benefits Security Administration, U.S. Department of Labor, 200 Constitution Avenue N.W., Washington, D.C. 20210. You may also find answers at the Employee Benefits Security Administration website.');
    return rights;
  }
  function addSection(rows, title, paragraphs, level) {
    var texts = (paragraphs || []).filter(function (text) { return !!text; });
    if (!texts.length) return;
    var chars = 0;
    texts.forEach(function (text) { chars += String(text).length; });
    var short = texts.length <= 6 && chars <= 1700;
    rows.push(level === 2 ? h2(title) : h1(title));
    texts.forEach(function (text, i) {
      var keep = short && i < texts.length - 1;
      rows.push(row(null, text, keep ? { keepNext: true, keepLines: true } : { keepLines: true }));
    });
  }
  function signatureRows(plan) {
    var rows = [];
    addSection(rows, 'Adoption', [
      'The employer adopts this document when the authorized person signs it. The signature line and the date line are blank until that signature.',
      'Authorized signature: ________________________________',
      'Date: ________________________________',
      'Name: ' + (plan.signer_name || ''),
      'Title: ' + (plan.signer_title || ''),
      'Governing body: ' + (plan.governing_body || 'The governing body named by the employer')
    ]);
    return rows;
  }
  function benefitLines(plan) {
    return WpModel.wrappedBenefits(plan).map(function (code) {
      var addr = (plan.carrier_addresses && plan.carrier_addresses[code]) || '';
      var line = WpModel.benefitLabel(code) + ' is provided through ' + carrier(plan, code) + (addr ? ', ' + addr : '') + '.';
      line += ' Type of administration: ' + administrationType(plan, code) + '.';
      if (WpModel.benefitIsInsured(plan, code) && (code === 'medical' || code === 'dental' || code === 'vision' || code === 'rx' || (code === 'eap' && plan.eap_type === 'substantive'))) {
        line += ' Benefits are guaranteed under the insurance policy.';
      }
      if (code === 'hra' && plan.hra_type) line += ' The HRA type is ' + WpModel.hraLabel(plan.hra_type) + '. The separate HRA document is incorporated.';
      if (code === 'health_fsa') line += ' The separate health FSA document is incorporated. The health FSA is paid from the employer\'s general assets.';
      if (code === 'hra') line += ' The HRA is paid from the employer\'s general assets.';
      if (code === 'medical' && plan.network === 'traditional') line += ' Benefits are provided through a provider network named in the certificate.';
      if (code === 'medical' && (plan.network === 'rbp' || plan.funding === 'rbp')) {
        line += ' Reference-based pricing can leave a balance bill. The No Surprises Act protects a participant for emergency care, certain non-emergency care at an in-network facility, and air ambulance services, as that law applies. The certificate controls the detail.';
      }
      var wait = plan.waiting && plan.waiting[code];
      if (wait) line += ' Waiting period: ' + wait + '.';
      line += taxSentence(plan, code);
      return line;
    });
  }
  function effectiveSentence(plan) {
    if (plan.is_restatement === 'yes') {
      return 'This document restates the plan originally effective ' + longDate(plan.original_effective_date) + '. This restatement is effective ' + longDate(plan.restatement_date) + '.';
    }
    return 'The plan is effective ' + longDate(plan.original_effective_date) + '.';
  }
  function selfFundedDesign(plan) {
    return WpModel.isSelfFundedFunding(plan.funding) || WpModel.hasBenefit(plan, 'hra') || WpModel.hasBenefit(plan, 'health_fsa') ||
      (WpModel.hasBenefit(plan, 'std') && plan.std_type === 'trust');
  }
  function section125Sentence(plan) {
    var pretax = false;
    var tax = plan.tax || {};
    Object.keys(tax).forEach(function (code) { if (tax[code] === 'pretax') pretax = true; });
    if (pretax || plan.section125 === 'yes') {
      return 'Where a benefit is offered pre-tax, that choice is made under a separate Section 125 cafeteria plan. This wrap is not the cafeteria plan. The cafeteria plan controls the election, the irrevocability rules, and the permitted changes in status. A pre-tax election does not add a benefit that the certificate does not provide.';
    }
    return 'No pre-tax election under a Section 125 plan applies to the benefits in this wrap. Employee contributions, if any, are taken as the enrollment materials state.';
  }
  function cobraBlock(plan, voice) {
    if (!WpModel.groupHealth(plan)) return [];
    var who = plan.cobra_admin || 'the plan administrator';
    var you = voice === 'you';
    if (plan.cobra === 'yes' || plan.cobra === 'unsure') {
      return [
        'Federal COBRA continuation coverage applies to the group health benefits under this plan to the extent the employer met the federal employee threshold in the prior calendar year. COBRA is administered by ' + who + '. The general notice and the election notice are part of this package. Those notices state the qualifying events, the election steps, and the deadlines.',
        (you ? 'You' : 'A covered person') + ' should read the COBRA notices for the qualifying events, who may elect, how to elect, and how long coverage can last. This wrap does not restate those deadlines. Dental and vision are group health coverage for COBRA when they are wrapped.',
        'A part-time employee counts as a fraction of an employee for the federal threshold. The fraction is hours worked divided by full-time hours. Related employers under common control are counted together. The plan administrator can require proof of a qualifying event and of timely payment.'
      ];
    }
    if (plan.cobra === 'no' && plan.funding === 'insured') {
      return [
        'Federal COBRA does not apply. State continuation coverage may be available. The certificate and state law control.',
        'If a later count shows that the federal threshold was met, the federal COBRA notices control from that point. This document does not state a number of months of continuation.'
      ];
    }
    if (plan.cobra === 'no') {
      return [
        'Federal COBRA does not apply.',
        'This document does not state a number of months of continuation.'
      ];
    }
    return [];
  }
  function claimsBlock(plan, voice) {
    var you = voice === 'you';
    var person = you ? 'You' : 'A claimant';
    var your = you ? 'your' : 'the';
    var paras = [];
    if (plan.funding === 'insured') {
      paras.push('The insurer decides claims for an insured benefit under the certificate. ' + person + ' may get a copy of the claim procedure from the plan administrator without charge.');
    } else if (plan.appeals === 'employer') {
      paras.push((plan.tpa_name || 'The TPA') + ' administers claims. The employer decides the final internal appeal. ' + person + ' may get a copy of the claim procedure from the plan administrator without charge. The written claim procedure has to match that choice.');
    } else if (WpModel.isSelfFundedFunding(plan.funding)) {
      paras.push((plan.tpa_name || carrier(plan, 'medical')) + ' administers claims. The employer is the named fiduciary. ' + person + ' may get a copy of the claim procedure from the plan administrator without charge.');
    } else {
      paras.push('The carrier or administrator named for each benefit decides claims for that benefit. ' + person + ' may get a copy of the claim procedure from the plan administrator without charge.');
    }
    paras.push('A claim asks the plan to pay or provide a benefit. A request for prior approval is a claim. A concurrent review of an ongoing course of treatment is a claim. An inquiry that does not ask for a benefit decision is not a claim. ' + person + ' may authorize a representative in writing. The plan may require a reasonable form of appointment.');
    paras.push('Urgent care is care where the ordinary time frames would seriously jeopardize life, health, or the ability to regain maximum function, or would subject a claimant to severe pain that cannot be managed without the care. For an urgent claim, the plan notifies the claimant as soon as possible, and in no event later than 72 hours after receipt, if the information is complete. If more information is needed, the plan gives the claimant at least 48 hours to supply it and then decides within 48 hours after the information arrives or the time to supply it ends.');
    paras.push('For a pre-service claim that is not urgent, the plan notifies the claimant within a reasonable period, and in no event later than 15 days after receipt. The plan may extend that period once, for up to 15 days, when matters beyond its control require the extension and it gives notice before the first period ends. If the claimant did not follow the plan\'s procedure, the plan gives notice within 5 days. If more information is needed, the claimant has at least 45 days to supply it, and the decision clock pauses until the information arrives.');
    paras.push('For a post-service claim, the plan notifies the claimant within a reasonable period, and in no event later than 30 days after receipt. One 15-day extension is available on the same terms as a pre-service claim. If more information is needed, the claimant has at least 45 days to supply it.');
    paras.push('For a concurrent-care decision that reduces or ends an approved course of treatment, the plan gives notice early enough for the claimant to appeal before the benefit is reduced or ends. A request to extend an urgent course of treatment is decided as soon as possible, and within 24 hours when the request is received at least 24 hours before the approved period ends.');
    var disability = 'If a benefit is a disability benefit, the stricter disability time frames apply to that benefit. The administrator decides a disability claim within a reasonable period, and in no event later than 45 days, with up to two 30-day extensions for matters beyond its control. An appeal of a disability denial is decided within 45 days, with one 45-day extension. The denial will identify any internal rule and will state that a copy is available on request. A disagreement about medical judgment will be decided with a consultation that gives no weight to the first decision.';
    var wrappedNow = WpModel.wrappedBenefits(plan);
    if (wrappedNow.indexOf('std') !== -1 || wrappedNow.indexOf('ltd') !== -1) {
      disability += ' Before the appeal decision, ' + (you ? 'you' : 'the claimant') + ' may review and respond to new evidence or a new rationale. The final denial states any contractual limitations period and the date it expires.';
    }
    paras.push(disability);
    paras.push('An adverse benefit determination explains the reasons, the plan terms, any additional information that would perfect the claim, the appeal steps, and the time limits, including that ' + your + ' right to sue under ERISA follows the appeal. It also describes any internal rule, protocol, or guideline that was relied on, or states that a copy is free on request. If the decision turns on medical judgment or an experimental treatment exclusion, the notice says so and offers the identity of any medical expert.');
    paras.push((you ? 'You have' : person + ' has') + ' at least 180 days after an adverse determination to appeal. The appeal is to the named fiduciary. The reviewer is not the person who made the first decision and is not that person\'s subordinate. The reviewer gives no deference to the first decision. If the decision turns on medical judgment, the reviewer consults a qualified professional who was not involved in the first decision. ' + person + ' may submit written comments, documents, and records, and may receive, free of charge, the records relevant to the claim.');
    paras.push('An urgent appeal is decided as soon as possible, and in no event later than 72 hours after the plan receives it. A pre-service appeal is decided within a reasonable period, and in no event later than 30 days. A post-service appeal is decided within a reasonable period, and in no event later than 60 days. The decision on appeal is in writing and includes the reasons, the plan terms, a statement that ' + (you ? 'you' : 'the claimant') + ' may receive the relevant records free of charge, and a description of any further voluntary appeal and of the right to sue.');
    if (WpModel.hasBenefit(plan, 'medical') || WpModel.groupHealth(plan)) {
      paras.push('A medical claim that is subject to external review follows the external review process in the certificate and the federal external-review rules. ' + (you ? 'You generally have' : person + ' generally has') + ' four months after the final internal denial to request external review. The external reviewer\'s decision is binding on the plan except as other remedies provide. External review is not a new internal appeal, and it does not extend the time to sue except as the notice states.');
    }
    paras.push('The time to file suit begins when the internal appeal is finished, or earlier if the plan fails to follow its procedures in a way that is more than minor and the failure is not corrected. Exhaustion of the internal appeal is required before suit, except where the procedures say exhaustion is excused. A claimant should read the denial and the appeal decision for the forum and the time limit that apply to that benefit.');
    paras.push('The certificate or booklet for a benefit controls the address for claims, the forms, and any shorter internal deadline that still meets these federal minimums. If this wrap and the certificate describe different time frames, the frame that is lawful and that the certificate uses for that benefit controls, and the employer issues a summary of material modifications if the wrap has to be corrected.');
    return paras;
  }
  function hipaaBlock(plan, voice) {
    var you = voice === 'you';
    if (plan.phi === 'yes') {
      return [
        'The plan may disclose protected health information to the plan sponsor only for plan administration, and only after the sponsor certifies that the plan has been amended and that the sponsor agrees to the limits in the HIPAA amendment. The sponsor will not use that information for employment decisions. The people who may see it are: ' + (plan.phi_classes || 'the classes written on the HIPAA amendment') + '.',
        'Protected health information is health information that identifies a person and relates to health, care, or payment. Enrollment and disenrollment records, and summary information that does not identify a person, may be used to obtain premium bids or to change the plan. Information that identifies a person is used only for the plan-administration work described in the amendment.',
        'The plan sponsor applies administrative, physical, and technical safeguards. It uses and discloses the minimum information needed for the task. Agents who receive the information agree to the same limits. The sponsor reports a use or disclosure that is not allowed, makes the information available for access, amendment, and an accounting, and makes its books available to the U.S. Department of Health and Human Services. When the information is no longer needed, the sponsor returns or destroys it if that is feasible. The separate HIPAA amendment and the plan sponsor certification are part of this plan.'
      ];
    }
    return [
      'The plan sponsor does not receive protected health information for plan administration beyond enrollment and disenrollment.',
      'Enrollment and disenrollment records may be shared with the sponsor so coverage can be started and stopped. A HIPAA amendment and a plan sponsor certification are required before the sponsor receives protected health information.'
    ];
  }
  function noticeBlock(plan, voice) {
    var paras = [];
    var you = voice === 'you';
    paras.push.apply(paras, cobraBlock(plan, voice));
    if (WpModel.groupHealth(plan)) {
      paras.push('The plan has written procedures for qualified medical child support orders, including a National Medical Support Notice. A copy is available from the plan administrator without charge. Those procedures are part of this package. An order that the administrator decides is qualified is followed to the extent the certificate allows. A National Medical Support Notice is handled as a medical child support order.');
    }
    if (WpModel.groupHealth(plan)) paras.push(WpModel.MSP_SENTENCE);
    if (WpModel.hasBenefit(plan, 'medical')) {
      paras.push(WpModel.NEWBORNS);
      if (plan.funding === 'insured') paras.push(WpModel.NEWBORNS_INSURED);
      paras.push('If the plan covers mastectomy, it will provide reconstruction of the breast on which the mastectomy was performed, surgery and reconstruction of the other breast, prostheses, and treatment of physical complications including lymphedema, in the manner the certificate describes.');
      if (WpModel.parityMode(plan) === 'print') {
        paras.push('Financial requirements and treatment limits on mental health and substance use benefits are not more restrictive than the limits on medical and surgical benefits, as federal law requires. The certificate states the benefits and any limits. This sentence does not decide a particular exclusion.');
      } else if (WpModel.parityMode(plan) === 'booklet') {
        paras.push('Mental health and substance use benefits, and any limits on those benefits, are described in the certificate or booklet.');
      }
    }
    paras.push.apply(paras, hipaaBlock(plan, voice));
    paras.push((you ? 'If you' : 'If a participant') + ' leave employment for uniformed service, coverage and reinstatement follow the federal military-leave law. The participant gives the employer advance notice when notice is required, and elects whether to continue coverage for the period that law allows. Reinstatement is made without a new exclusion for a condition that the military-leave law protects, subject to the certificate.');
    paras.push((you ? 'If you' : 'If a participant') + ' take leave that the Family and Medical Leave Act covers, group health coverage continues during that leave on the same terms as for an active employee, if the required contribution is paid. The employer tells the participant how to pay. When the leave ends and the participant returns, coverage is restored without a new waiting period that the leave law forbids. A benefit that is not a group health benefit follows the certificate and the employer\'s leave policy.');
    return paras;
  }
  function powersBlock(plan) {
    var rows = [];
    if (plan.discretion !== 'no') {
      rows.push('The plan administrator has full discretionary authority to administer the plan, to interpret the plan and the incorporated certificates, to decide questions of eligibility, and to decide claims and appeals. A decision made under that authority is reviewed with deference to the administrator. The administrator will apply the certificate that governs the benefit.');
    }
    rows.push('The administrator may adopt procedures, appoint and remove a claims administrator or TPA, delegate duties in writing, sign contracts for the plan, correct a clerical error, and recover a payment that was not owed. A delegation does not relieve the named fiduciary of the duty to watch the delegate. The employer is the named fiduciary except where an insurer decides an insured claim under the certificate.');
    rows.push('The administrator keeps the records needed to run the plan and to answer a lawful request for documents. A participant or beneficiary may examine the governing documents and may obtain copies as the statement of ERISA rights describes. The administrator may charge a reasonable amount for copies where the law allows a charge.');
    rows.push('No person speaking for the employer can change this plan by an oral promise. A change is made only by a written amendment adopted as this document describes. A clerical error may be corrected retroactively when the correction matches the intended term and the certificate.');
    return rows;
  }
  function subrogationBlock(plan, voice) {
    var you = voice === 'you';
    if (!selfFundedDesign(plan)) {
      return ['Insured benefits follow the recovery terms in the certificate. This wrap does not add a separate reimbursement right for a fully insured benefit.'];
    }
    return [
      'This section applies to a self-funded or level-funded benefit, including a health reimbursement arrangement or a health FSA that pays from general assets. It does not enlarge the recovery terms of a fully insured benefit. Those terms stay in the certificate.',
      (you ? 'If you receive' : 'If a participant receives') + ' benefits for an injury or illness that someone else may be responsible for, the plan may recover what it paid from any amount ' + (you ? 'you' : 'the participant') + ' or a dependent receives from that person, an insurer, or another source. The right comes first, before the participant is made whole, except where a law that actually applies says otherwise. The plan is not limited to a particular fund.',
      'The participant will not settle a claim in a way that impairs the plan\'s right without the plan\'s written consent. The participant will cooperate, sign papers, and tell the plan about the claim. The plan may offset later benefits if the recovery is not repaid. Attorneys\' fees are not deducted from the plan\'s share unless the plan agrees in writing. This section is a right of reimbursement and an equitable lien on the recovery.'
    ];
  }
  function planParagraphs(plan) {
    var rows = [];
    var benefits = WpModel.wrappedBenefits(plan);
    rows.push(row('Title', plan.plan_name, { keepNext: true, keepLines: true }));
    rows.push(row(null, 'Wrap plan document', { keepNext: true, keepLines: true }));
    rows.push(row(null, WpModel.DISCLAIMER));
    addSection(rows, 'Establishment', [
      plan.employer_name + ' establishes this plan to wrap the welfare benefits listed below into one employee welfare benefit plan. Each certificate, booklet, policy, and component plan document is incorporated by reference. Together they are the plan.',
      'The purpose of the wrap is to supply the ERISA frame: the sponsor, the number, the administrator, the fiduciary, the agent for service, the plan year, amendment, and termination. The certificate still controls the benefit detail for that benefit.',
      effectiveSentence(plan),
      fundingSentence(plan)
    ]);
    addSection(rows, 'Plan identity', [
      'Plan sponsor: ' + plan.employer_name + '. EIN ' + plan.employer_ein + '. Address: ' + plan.address + '. Phone: ' + phoneText(plan) + '.',
      'Plan number: ' + plan.plan_number + '. ' + WpModel.planYearSentence(plan),
      administratorIdentity(plan),
      agentSentence(plan),
      plan.trust === 'yes'
        ? 'The trustee is ' + plan.trustee_name + (plan.trustee_address ? ', ' + plan.trustee_address : '') + '.'
        : 'Plan assets are not held in a trust. Insured benefits are provided under insurance contracts. A benefit paid from a trust or a separate fund, if one is part of this plan, is identified with that benefit.',
      plan.bargaining === 'yes'
        ? 'Some benefits are maintained under a collective bargaining agreement. A copy of that agreement is available from the plan administrator on request.'
        : 'The plan is not maintained under a collective bargaining agreement.'
    ]);
    addSection(rows, 'Definitions', [
      'Certificate means the insurance certificate, the evidence of coverage, the booklet, the schedule of benefits, or the component plan document for a wrapped benefit, including any summary of material modifications to it.',
      'Component benefit means one benefit listed in this wrap. A component document is the certificate or the separate plan for that benefit, such as a health FSA or an HRA document.',
      'Employer means ' + plan.employer_name + ' and any related employer that adopts this plan in writing. A related employer is not a sponsor of this plan until it adopts the plan.',
      'Participant means an employee or former employee who is covered by at least one component benefit, or who contributes to a component benefit, under the participation rules below. A dependent is a beneficiary, not a participant, unless the dependent is covered in the dependent\'s own right.',
      'Plan administrator means ' + adminName(plan) + '. Claims administrator means the insurer, TPA, or other person who decides claims for a component benefit.',
      'Plan year is the period named above. A policy year in a component document stays the period that document uses.'
    ]);
    addSection(rows, 'Benefits wrapped under this plan', [
      'The following benefits are part of this plan. The certificate, booklet, or TPA document for each benefit is incorporated by reference.'
    ].concat(benefitLines(plan)).concat([
      benefits.length ? 'A benefit that is not listed is not part of this plan, even if the employer offers it outside the plan.' : 'No component benefit was selected.',
      plan.tpa_document && WpModel.isSelfFundedFunding(plan.funding)
        ? 'The TPA plan document or SPD named "' + plan.tpa_document + '" is incorporated for the self-funded medical benefit.'
        : '',
      plan.dcap_interest ? 'Dependent care stays in the Section 125 plan. It is not a benefit under this wrap and it is not listed on Schedule A.' : ''
    ]));
    addSection(rows, 'Order of control', [
      'The certificate or self-funded booklet controls covered services, exclusions, cost sharing, and dependent rules for that benefit. The carrier or TPA booklet controls the claim steps and the address for that benefit. This wrap controls the ERISA frame: name, number, sponsor, administrator, fiduciary, agent for service, plan year, amendment, and termination.',
      'Enrollment records show who elected what. They do not add a benefit the certificate does not provide. If this wrap reads richer than the certificate, the certificate still controls, and the employer should issue a summary of material modifications.',
      'If two component documents conflict about the same insured benefit, the later certificate controls that benefit. This wrap controls over a component document on the ERISA frame. A summary of benefits and coverage, a flyer, or an oral statement does not change the plan.'
    ]);
    addSection(rows, 'Eligibility', [
      'Eligible classes: ' + (plan.classes || 'the classes named by the employer') + '. Hours: ' + (plan.hours || 'the hours requirement in the certificate') + '. Dependents: ' + (plan.dependents || 'the dependent categories in the certificate') + '.',
      'An employee is eligible for a component benefit only if the employee is in an eligible class, meets the hours rule, and completes any waiting period for that benefit. A dependent is eligible only if the employee is eligible and the dependent meets the certificate. The certificate may exclude a class, a dependent, or a condition. That exclusion controls.',
      'An eligible employee who is not enrolled, who does not contribute, and who is not automatically covered by an employer-paid benefit is not a participant in that benefit. Employer-paid coverage that needs no enrollment, such as basic life when it is wrapped, covers the employees the certificate says are covered.',
      'The employer may change the eligible classes by a written amendment. A change that takes coverage away is applied only as the amendment and the certificate allow, and participants are told through a summary of material modifications when the law requires one.'
    ]);
    addSection(rows, 'Participation', [
      'An eligible employee becomes a participant in a component benefit on the later of the effective date of this plan, the date the waiting period for that benefit ends, or the date coverage under the certificate begins. Different benefits may have different waiting periods. Each waiting period that was entered is stated with that benefit.',
      'A former employee who continues coverage under COBRA or a state continuation rule remains covered only for the benefits and the period that the continuation right actually provides. A retiree is a participant only if the certificate covers retirees and the retiree is enrolled.',
      'Participation in one component benefit does not create participation in another. Losing one benefit does not, by itself, end a different benefit that the person remains eligible for.'
    ]);
    addSection(rows, 'Enrollment and special enrollment', [
      'Enrollment is made in the time and manner the employer and the certificate require. A new employee enrolls before the waiting period ends, or within the new-hire window the certificate states. After that window, enrollment waits until the next open enrollment unless a special enrollment right applies.',
      'Open enrollment is the period the employer sets before the start of a plan year, or at another time the certificate allows. An election made at open enrollment is effective on the date the certificate states. Failure to enroll is a waiver until the next open enrollment or a special enrollment event.',
      'Special enrollment is available to the extent federal law requires it for the group health benefits. The usual events are loss of other health coverage, marriage, birth, adoption, or placement for adoption, and eligibility for or loss of a Medicaid or children\'s health insurance premium subsidy. The employee must request enrollment within 30 days after the event, or within 60 days when the Medicaid or children\'s health insurance rule uses that longer period.',
      'A special enrollment right does not create a benefit the certificate does not insure or the plan does not offer. The administrator may require proof of the event. Coverage starts on the date the special-enrollment rule and the certificate require, which for a birth, adoption, or placement is the date of the event when that rule applies.'
    ]);
    addSection(rows, 'Termination of coverage', [
      'Coverage may end when employment ends, when eligibility ends, when enrollment is missed, when a required contribution is not paid, when dependent status ends, when the plan is amended or terminated, when the insurer rescinds coverage for fraud or intentional misrepresentation as the certificate allows, or when the certificate states a tighter rule.',
      'Ending employment ends coverage on the date the certificate uses, often the last day of work or the end of the month, unless continuation coverage is elected. A leave of absence continues coverage only as the certificate, the military-leave rule, or the family-and-medical-leave rule provides.',
      'A dependent loses coverage when the dependent no longer meets the certificate, subject to any continuation right. The employee must tell the administrator when a dependent loses eligibility. Coverage that continues after a late notice may be cancelled back to the date eligibility ended, and the plan may recover benefits paid for a person who was not eligible.',
      'Termination of the plan ends coverage as of the termination date the employer adopts. Welfare benefits are not vested. Ending the plan does not cut off a claim for services already received while coverage was in force, except as the certificate states.'
    ]);
    addSection(rows, 'Contributions and the Section 125 plan', [
      plan.employee_contributions === 'yes' && plan.remitted === 'yes'
        ? 'Where employees contribute, the employer remits those amounts to the carrier or TPA.'
        : plan.employee_contributions === 'yes'
          ? 'Employees contribute toward one or more benefits, as the enrollment materials describe.'
          : 'The employer pays the cost of the wrapped benefits except as a certificate states otherwise.',
      section125Sentence(plan),
      'Insured benefits are funded through premiums, self-funded benefits are funded from the employer\'s general assets, and participant contributions are applied toward the cost of the benefit elected.',
      WpModel.REVERSION,
      WpModel.isSelfFundedFunding(plan.funding)
        ? 'Stop-loss, if the employer has it, protects the employer. It is not a participant benefit, and its terms are not stated in this document.'
        : ''
    ]);
    addSection(rows, 'Claims and appeals', claimsBlock(plan, 'plan'));
    addSection(rows, plan.discretion === 'no' ? 'Plan administrator powers' : 'Plan administrator powers and discretion', powersBlock(plan));
    addSection(rows, 'Subrogation and reimbursement', subrogationBlock(plan, 'plan'));
    addSection(rows, 'Continuation coverage', cobraBlock(plan, 'plan'));
    if (WpModel.groupHealth(plan)) {
      addSection(rows, 'Qualified medical child support orders', [
        'The plan administrator, or the delegate named in the procedures, receives medical child support orders and National Medical Support Notices. The procedures in the separate QMCSO document are incorporated into this plan.',
        'When an order or a National Medical Support Notice arrives, the administrator notifies the participant and each alternate recipient. A National Medical Support Notice is handled as a medical child support order under federal law. The administrator decides whether the order is qualified and sends that decision in writing.',
        'Coverage required by a qualified order is provided as the order and the certificate allow. The plan does not cover a person the certificate cannot cover. Benefits paid to an alternate recipient are paid as the order directs. A copy of the procedures is available from the plan administrator without charge.'
      ]);
    }
    addSection(rows, 'Privacy and security', hipaaBlock(plan, 'plan'));
    if (WpModel.hasBenefit(plan, 'medical')) {
      addSection(rows, 'Mental health parity', [
        WpModel.parityMode(plan) === 'print'
          ? 'Financial requirements and treatment limits on mental health and substance use benefits are not more restrictive than the limits on medical and surgical benefits, as federal law requires. Quantitative limits and nonquantitative limits are applied as the certificate and federal law require. This plan does not decide a particular exclusion in this sentence.'
          : 'Mental health and substance use benefits, and any limits on those benefits, are described in the certificate or booklet. The employee count is not above the small-plan line that federal law uses for a self-funded parity statement, so this wrap defers to the booklet.'
      ]);
      addSection(rows, 'Newborns and mothers', [
        WpModel.NEWBORNS,
        plan.funding === 'insured' ? WpModel.NEWBORNS_INSURED : 'The booklet states how a hospital stay in connection with childbirth is covered.'
      ]);
      addSection(rows, 'Mastectomy reconstruction', [
        'If the plan covers mastectomy, it will provide reconstruction of the breast on which the mastectomy was performed, surgery and reconstruction of the other breast, prostheses, and treatment of physical complications including lymphedema, in the manner the certificate describes. Cost sharing in the certificate still applies to the extent federal law allows it. This section does not require the plan to cover mastectomy if the certificate does not.'
      ]);
    }
    addSection(rows, 'Military leave', [
      'A participant who leaves employment for uniformed service, and the participant\'s covered dependents, may continue group health coverage for the period federal military-leave law requires, if the participant gives the notice that law requires and pays any required contribution. The contribution may be up to the amount that law permits.',
      'On return to employment within the time that law allows, coverage is reinstated without a new exclusion or waiting period for a condition that the military-leave law protects. The certificate continues to control covered services. This section does not promise a benefit the plan did not offer before the service.'
    ]);
    addSection(rows, 'Family and medical leave', [
      'During a leave covered by the Family and Medical Leave Act, group health coverage continues for the employee and covered dependents on the same terms as for an active employee, if the employee pays the required contribution in the way the employer describes.',
      'If the employee does not pay, the employer may end coverage after the notice the leave rules require, and must restore coverage when the employee returns, without a new waiting period that the leave law forbids, if the employee is still eligible. A non-health benefit during leave follows the certificate and the employer\'s written leave policy.'
    ]);
    if (WpModel.groupHealth(plan)) {
      addSection(rows, 'Medicare coordination', [
        WpModel.MSP_SENTENCE,
        'The certificate states how a claim is handled when a covered person also has Medicare. Federal rules decide when this plan pays before Medicare and when Medicare pays first. Those rules look at the reason for Medicare, the size of the employer, and whether the coverage is because of current employment.'
      ]);
    }
    addSection(rows, 'Amendment and termination', [
      'The employer may amend or terminate the plan, or any component benefit, by written action of ' + governingBody(plan) + '. An amendment is effective on the date the written action states. A material change is communicated in a summary of material modifications.',
      'Welfare benefits are not vested. The employer does not promise to continue a benefit for any period, except where an insurance contract or continuation law independently requires it. Termination does not avoid a claim incurred while the benefit was in force, except as the certificate states.',
      WpModel.REVERSION,
      'No plan asset, participant contribution, or participants\' share of an insurer refund or rebate will be used for the employer\'s general business. Reasonable plan expenses may be paid from those amounts when the law allows.'
    ]);
    addSection(rows, 'Miscellaneous', [
      'This wrap, the incorporated certificates, and the written amendments are the entire plan. A handbook, a benefits guide, or a conversation is not the plan. Headings are for convenience and do not change the text.',
      'If a court holds one provision unenforceable, the rest of the plan remains in force. The plan is construed under ERISA. To the extent state law is not preempted, the law of the employer\'s principal place of business applies, except where an insurance contract chooses the law that governs that contract.',
      'Benefits cannot be assigned except as a qualified medical child support order requires, as a National Medical Support Notice requires, or as the certificate allows a direct payment to a provider. A direction to pay a provider is not an assignment of the participant\'s claim rights unless the certificate says it is.',
      'The plan is not a contract of employment. Nothing in the plan limits the employer\'s right to hire, discipline, or end employment, except as an employment agreement or a labor agreement separately provides.',
      'Notices to a participant are sent by a method the law allows, including mail to the last address on file or an electronic method the participant can access. A participant must keep the address current. A notice to an alternate recipient under a qualified order is sent to the address in the order.',
      'The plan administrator may correct a payment error, recover an overpayment, and pay a benefit that was underpaid. Recovery may be made from later benefits, from the payee, or from a provider who was paid in error. A missing participant\'s benefit is handled under the certificate and under unclaimed-property rules that actually apply. The plan does not forfeit a benefit merely because mail was returned until a reasonable search has been made.',
      'Federal notices that sit outside this wrap, including a summary of benefits and coverage, a children\'s health insurance notice, a Medicare prescription-drug notice, and a marketplace notice, are given with the certificate or at enrollment. They are not restated here. The summary plan description in this package is the ERISA summary. The certificates are part of that summary for the benefit detail.'
    ]);
    rows.push.apply(rows, signatureRows(plan));
    return rows;
  }
  function spdParagraphs(plan) {
    var rows = [];
    rows.push(row('Title', plan.plan_name, { keepNext: true, keepLines: true }));
    rows.push(row(null, 'Summary plan description', { keepNext: true, keepLines: true }));
    rows.push(row(null, WpModel.DISCLAIMER));
    addSection(rows, 'About this summary', [
      'This summary plan description tells you, in ordinary language, how the plan is set up and where to find the rules for each benefit. It is written for participants and beneficiaries. The wrap plan document and the certificates are the controlling documents. If this summary and a certificate disagree about a covered service, the certificate controls. If they disagree about the name of the plan, the sponsor, the administrator, or the plan year, the wrap controls.',
      effectiveSentence(plan),
      'Read this summary with the certificate for each benefit you have. The certificate states what is covered, what is excluded, and what you pay at the point of care. This summary does not list every exclusion.'
    ]);
    addSection(rows, 'Plan identity', [
      'Plan sponsor: ' + plan.employer_name + '. EIN ' + plan.employer_ein + '. Address: ' + plan.address + '. Phone: ' + phoneText(plan) + '.',
      'Plan number: ' + plan.plan_number + '. Type of plan: an employee welfare benefit plan. ' + WpModel.planYearSentence(plan),
      fundingSentence(plan),
      administratorIdentity(plan) + ' You may write to the administrator for a copy of the plan documents.',
      agentSentence(plan),
      plan.trust === 'yes'
        ? 'The trustee is ' + plan.trustee_name + (plan.trustee_address ? ', ' + plan.trustee_address : '') + '.'
        : 'Plan assets are not held in a trust.',
      plan.bargaining === 'yes'
        ? 'Some benefits are maintained under a collective bargaining agreement. You may ask the plan administrator for a copy.'
        : 'The plan is not maintained under a collective bargaining agreement.'
    ]);
    addSection(rows, 'What the plan covers', [
      'The plan wraps the benefits below. Each one is provided through the carrier or administrator named here, under that benefit\'s certificate or booklet.'
    ].concat(benefitLines(plan)).concat([
      plan.tpa_document && WpModel.isSelfFundedFunding(plan.funding)
        ? 'The TPA plan document or SPD named "' + plan.tpa_document + '" is part of the medical benefit.'
        : '',
      'A benefit you did not elect, and a benefit that is not listed, is not your coverage. Enrollment records show the election. They do not create a benefit the certificate does not provide.'
    ]));
    addSection(rows, 'Who can be covered', [
      'Eligible classes: ' + (plan.classes || 'the classes the employer names') + '. The hours requirement is ' + (plan.hours || 'the hours requirement in the certificate') + '. Dependents the employer covers: ' + (plan.dependents || 'the dependents the certificate names') + '.',
      'You are eligible for a benefit only if you are in an eligible class, you meet the hours rule, and you complete the waiting period for that benefit. Your dependent is eligible only if you are eligible and the dependent meets the certificate. The certificate may set a tighter rule, and that rule controls.',
      'You become covered on the later of the plan\'s effective date, the end of the waiting period, or the date the certificate says coverage starts, if you enroll on time or if the benefit covers you automatically. A waiting period that applies to only one benefit is stated with that benefit above.'
    ]);
    addSection(rows, 'How you enroll', [
      'You enroll in the time and in the way the employer and the certificate require. As a new employee, you enroll in the new-hire window. If you miss it, you generally wait until the next open enrollment unless you have a special enrollment right.',
      'Open enrollment is the period the employer announces before the plan year, or another window the certificate allows. An election you make then starts on the date the certificate states. If you do not enroll, you have waived coverage until the next window or a special enrollment event.',
      'You may have a special right to enroll in a group health benefit when you lose other health coverage, when you marry, when a child is born, adopted, or placed for adoption, or when you gain or lose a Medicaid or children\'s health insurance subsidy. You must ask to enroll within 30 days after the event, or within 60 days when the subsidy rule gives you that longer time. The administrator may ask for proof. Special enrollment does not add a benefit the plan does not offer.'
    ]);
    addSection(rows, 'When coverage ends', [
      'Your coverage can end when your employment ends, when you are no longer eligible, when you do not enroll, when you do not pay a required contribution, when a dependent no longer qualifies, when the plan is changed or ended, or when the certificate states an earlier end.',
      'Tell the plan administrator when a dependent is no longer eligible. If coverage is paid after eligibility ended, the plan may recover that payment. Ending the plan does not erase a claim for care you received while you were covered, except as the certificate says.',
      'Welfare benefits are not vested. The employer may change or end a benefit. You will be told of a material change.'
    ]);
    addSection(rows, 'What you pay', [
      plan.employee_contributions === 'yes'
        ? 'You may be required to contribute toward one or more benefits. The enrollment materials state the amount and whether it is taken from pay.'
        : 'The employer pays the cost of the wrapped benefits except as a certificate says otherwise.',
      section125Sentence(plan),
      'If you are contributing, those amounts are used for benefits and reasonable plan expenses. ' + WpModel.REVERSION
    ]);
    addSection(rows, 'How to file a claim and how to appeal', claimsBlock(plan, 'you'));
    addSection(rows, 'Who runs the plan', powersBlock(plan).concat([
      'You may examine, without charge, the documents that govern the plan, and you may ask for copies as the statement of ERISA rights below explains.'
    ]));
    addSection(rows, 'Recovery from a third party', subrogationBlock(plan, 'you'));
    addSection(rows, 'Continuation coverage', cobraBlock(plan, 'you'));
    if (WpModel.groupHealth(plan)) {
      addSection(rows, 'Medical child support, privacy, and Medicare', [
        'The plan follows qualified medical child support orders, including a National Medical Support Notice. If an order or a notice arrives, you and each alternate recipient are notified. The administrator decides whether the order is qualified and writes to you with that decision. A qualified order is followed to the extent the certificate allows. You may get a copy of the procedures from the plan administrator without charge.'
      ].concat(hipaaBlock(plan, 'you')).concat([
        WpModel.MSP_SENTENCE,
        'The certificate states how a claim is handled when you also have Medicare. Federal rules decide the order of payment.'
      ]));
    }
    if (WpModel.hasBenefit(plan, 'medical')) {
      addSection(rows, 'Hospital stays, reconstruction, and mental health', [
        WpModel.NEWBORNS,
        plan.funding === 'insured' ? WpModel.NEWBORNS_INSURED : 'The booklet states how a hospital stay in connection with childbirth is covered.',
        'If the plan covers mastectomy, it will provide reconstruction of the breast on which the mastectomy was performed, surgery and reconstruction of the other breast, prostheses, and treatment of physical complications including lymphedema, in the manner the certificate describes.',
        WpModel.parityMode(plan) === 'print'
          ? 'Financial requirements and treatment limits on mental health and substance use benefits are not more restrictive than the limits on medical and surgical benefits, as federal law requires.'
          : 'Mental health and substance use benefits, and any limits on those benefits, are described in the certificate or booklet.'
      ]);
    }
    addSection(rows, 'Military leave and family leave', [
      'If you leave work for uniformed service, you may continue group health coverage for the period federal law allows, if you give the required notice and pay any required contribution. When you return on time, coverage is restored without a new exclusion that the military-leave law forbids.',
      'If you take family or medical leave that federal law protects, your group health coverage continues during the leave if you pay your contribution the way the employer explains. When you return, coverage is restored without a new waiting period that the leave law forbids, if you are still eligible.'
    ]);
    addSection(rows, 'If the plan changes or ends', [
      'The employer may amend or end the plan by written action of ' + governingBody(plan) + '. You will receive a summary of a material change. Benefits under this welfare plan are not vested.',
      WpModel.REVERSION
    ]);
    addSection(rows, 'Other facts you should know', [
      'This summary, the wrap, and the certificates are the plan information you should rely on. A flyer or a conversation does not change the plan. You cannot assign your claim rights except as a qualified order requires or as the certificate allows a provider to be paid directly.',
      'The plan is not a promise of continued employment. Keep your address current so notices reach you. If a payment was too high, the plan may recover it. If a payment was too low, the plan will correct it.',
      'Some federal notices come with your certificate or at enrollment, including a summary of benefits and coverage where one is required, a children\'s health insurance notice, a Medicare prescription notice, and a marketplace notice. Those notices are part of how the plan communicates. They are not reprinted in this summary.'
    ]);
    addSection(rows, 'Statement of ERISA rights', erisaRights(plan));
    return rows;
  }
  function scheduleParagraphs(plan) {
    var rows = [];
    rows.push(row('Title', 'Schedule A: Documents to attach', { keepNext: true, keepLines: true }));
    rows.push(row(null, WpModel.DISCLAIMER));
    addSection(rows, 'What this schedule is', [
      'This schedule is the employer\'s attachment list for the wrap plan document and the summary plan description. It names each wrapped benefit, the carrier or administrator, the funding in a word, and the paper the employer attaches.',
      'This list is not the insurance schedule filed with a Form 5500. Do not staple this page into a filing in place of the official schedule. Use it to build the participant package.',
      'Attach the current certificate, booklet, or component plan for every row. A wrap without those papers does not tell a participant what is covered. If a paper is missing, get it before you hand out the package.'
    ]);
    addSection(rows, 'Benefit schedule', WpModel.wrappedBenefits(plan).map(function (code) {
      var funding = 'Fully insured';
      if (code === 'hra' || code === 'health_fsa') funding = 'Paid from the employer\'s general assets';
      else if (code === 'medical') funding = WpModel.fundingLabel(plan.funding || 'insured');
      else if (!WpModel.benefitIsInsured(plan, code)) funding = 'Self-funded';
      var doc = code === 'medical' && plan.tpa_document ? plan.tpa_document : 'Current certificate, booklet, or component plan';
      if (code === 'hra') doc = 'Separate HRA plan document' + (plan.hra_type ? ' (' + WpModel.hraLabel(plan.hra_type) + ')' : '');
      if (code === 'health_fsa') doc = 'Separate health FSA plan document';
      return WpModel.benefitLabel(code) + '. Carrier or administrator: ' + carrier(plan, code) + '. Attach: ' + doc + '. Funding: ' + funding + '.';
    }).concat([
      WpModel.wrappedBenefits(plan).length ? 'Attach the papers in the order of the rows above, after the wrap plan document.' : 'No wrapped benefit was selected, so there is nothing to attach under this schedule.'
    ]));
    addSection(rows, 'How to assemble the package', [
      'Put the wrap plan document first. Put the summary plan description next, or give the summary as the front piece if you would rather hand participants the summary with the certificates behind it. Then attach each certificate, booklet, and component plan in the order of the benefit schedule. Add the claim procedure if it is not already inside the certificate.',
      'Add the qualified medical child support order procedures if a group health benefit is wrapped. Add the HIPAA amendment if the plan sponsor receives protected health information, and keep the signed certification with the plan records. The adoption resolution stays with the employer\'s signed copy. It does not have to be in the participant envelope.',
      'Give that package to participants. A person who becomes covered should receive it within 90 days after coverage begins. If the plan has just become subject to the reporting rules, give it within 120 days after that date. A material change is described in a summary of material modifications within 210 days after the plan year in which the change was adopted. Restate the summary plan description every five years if material changes were made, and every ten years if they were not.',
      'You may hand the package out, mail it, or deliver it electronically if the recipient can actually access it and you follow the electronic-disclosure rule that applies to that person. Keep proof of what you sent, the date, and who received it.',
      'Keep the signed wrap, the signed adoption resolution, the signed HIPAA certification if you use it, and a record of distribution. When a certificate is replaced at renewal, swap the old certificate out of the package and keep a copy of the version that was in force for each plan year.'
    ]);
    addSection(rows, 'What does not belong in the package', [
      'Do not include a stop-loss contract, a broker compensation schedule, or an internal rate sheet. Those are employer papers. Participants receive the certificate and this plan, not the employer\'s reimbursement contract.',
      'Dependent care, a health savings account, and a referral-only assistance program are not rows on this schedule. A voluntary benefit that met the safe harbor and was left out of the wrap is not a row either. If you are unsure, look at the findings report before you copy the package.'
    ]);
    return rows;
  }
  function resolutionParagraphs(plan) {
    var when = plan.is_restatement === 'yes' ? longDate(plan.restatement_date) : longDate(plan.original_effective_date);
    var rows = [];
    rows.push(row('Title', 'Adoption resolution', { keepNext: true, keepLines: true }));
    rows.push(row(null, WpModel.DISCLAIMER));
    addSection(rows, 'Resolutions', [
      governingBody(plan).charAt(0).toUpperCase() + governingBody(plan).slice(1) + ' of ' + plan.employer_name + ' ' + governingVerb(plan) + ' the following action.',
      'The employer maintains welfare benefits for its eligible employees and their dependents. The employer intends those benefits to be one employee welfare benefit plan, with each certificate and component document incorporated.',
      plan.employer_name + ' resolves that the ' + plan.plan_name + ', plan number ' + plan.plan_number + ', is adopted effective ' + when + ' when the authorized person signs this resolution.',
      plan.is_restatement === 'yes'
        ? 'This resolution restates the plan originally effective ' + longDate(plan.original_effective_date) + '. Rights that already accrued under the prior document are handled as the restatement and the certificates provide. This resolution does not cut off a claim incurred before the restatement date except as a certificate states.'
        : 'This is the adoption of the wrap. It is effective on the date stated above once it is signed.',
      'The plan administrator is ' + adminName(plan) + '. The administrator may carry out the plan, sign ordinary administration papers, and deliver the summary plan description and the certificates as Schedule A describes.',
      'The officers of the employer are authorized to do what is needed to carry out this resolution, including signing the wrap, delivering participant copies, and keeping the signed original with the plan records.',
      'Welfare benefits under the plan are not vested. The employer may amend or terminate the plan by a later written action of the same governing body.'
    ]);
    rows.push.apply(rows, signatureRows(plan));
    return rows;
  }
  function hipaaParagraphs(plan) {
    var classes = plan.phi_classes || '________________________________';
    return [
      row('Title', 'HIPAA privacy amendment', { keepNext: true, keepLines: true }),
      row(null, WpModel.DISCLAIMER),
      row(null, plan.plan_name + ' is amended to add the following limits on protected health information. This amendment is part of the plan.')
    ].concat((function () {
      var rows = [];
      addSection(rows, 'When the sponsor may receive information', [
        'The plan may disclose protected health information to the plan sponsor only for plan administration and only as federal privacy law allows.',
        'The plan sponsor receives protected health information to administer the plan. The classes of people who may see it are: ' + classes + '.',
        'Summary health information that does not identify a person may be disclosed so the sponsor can obtain premium bids or consider changing the plan. Information about whether a person is enrolled may be disclosed. Any other protected health information waits for the certification below.'
      ]);
      addSection(rows, 'Plan sponsor certification', [
        'The plan sponsor certifies that the plan documents have been amended to include these limits and that the sponsor agrees to them.',
        'The sponsor will not use or further disclose the information except as the plan documents allow or as law requires. Agents and subcontractors who receive it agree to the same limits. The sponsor will not use the information for employment decisions, including hiring, firing, or placing an employee.',
        'The sponsor will report to the plan any use or disclosure that is not allowed and that the sponsor becomes aware of. The sponsor will make protected health information available for access, amendment, and an accounting of disclosures, as the privacy rule requires. The sponsor will make its internal practices, books, and records relating to the use and disclosure available to the U.S. Department of Health and Human Services.',
        'When the information is no longer needed for the purpose of the disclosure, the sponsor will return it or destroy it if feasible. If return or destruction is not feasible, the sponsor will limit further use to the purpose that makes return or destruction infeasible. The sponsor will provide for adequate separation between the plan and the sponsor, as the class list in this amendment describes.',
        'The classes of employees, classes of other persons under the sponsor\'s control, and other persons who may receive protected health information for plan administration are: ' + classes + '. Those persons may use it only for plan administration. Anyone who does not comply is subject to the employer\'s disciplinary policy, up to and including ending the access or the employment, and to any other remedy the plan or the law provides.'
      ]);
      addSection(rows, 'Security', [
        'The plan sponsor will apply administrative, physical, and technical safeguards that reasonably and appropriately protect the confidentiality, integrity, and availability of electronic protected health information that the sponsor creates, receives, maintains, or transmits on behalf of the plan.',
        'The sponsor will ensure that any agent or subcontractor who handles that electronic information agrees to the same safeguards. The sponsor will report to the plan any security incident of which the sponsor becomes aware. The separation between the plan and the sponsor applies to electronic information as well as to paper records.',
        'The sponsor will use the minimum information needed for the task, will not store it in a place where people outside the class list can browse it, and will cut off access when a person leaves the class list.'
      ]);
      addSection(rows, 'Certification signature', [
        'By signing, the plan sponsor makes the certification described above. The signature line and the date line stay blank until that signature.',
        'Plan sponsor certification signature: ________________________________',
        'Date: ________________________________',
        'Name: ' + (plan.signer_name || ''),
        'Title: ' + (plan.signer_title || ''),
        'Plan: ' + plan.plan_name
      ]);
      return rows;
    })());
  }
  function qmcsoParagraphs(plan) {
    var rows = [];
    rows.push(row('Title', 'Qualified medical child support order procedures', { keepNext: true, keepLines: true }));
    rows.push(row(null, WpModel.DISCLAIMER));
    addSection(rows, 'Purpose', [
      plan.employer_name + ' adopts these procedures for medical child support orders under the plan, including a National Medical Support Notice. The procedures are part of the plan. A copy is available from the plan administrator without charge.',
      'These procedures apply to the group health benefits the plan wraps. They do not create coverage the certificate does not provide. An order cannot require a benefit, a dependent category, or a form of payment that the plan does not offer.'
    ]);
    addSection(rows, 'How an order is received', [
      'Send an order or a National Medical Support Notice to the plan administrator at the sponsor\'s address. The administrator stamps or otherwise records the date it arrived. A National Medical Support Notice is handled as a medical child support order under federal law, including the part of that law that tells the plan how to treat the notice. The administrator responds to the issuing agency within 40 business days after the date of the National Medical Support Notice.',
      'The participant, the child, and each alternate recipient may send comments and a copy of the order. An alternate recipient may be the child or a person acting for the child, such as a custodial parent or a state agency. The administrator may ask for a certified copy if the first copy is incomplete.'
    ]);
    addSection(rows, 'Notice', [
      'When an order or a National Medical Support Notice arrives, the plan administrator notifies the participant and each alternate recipient at the addresses in the order, or at the last known address if the order omits one. The notice says the order was received and that the administrator will decide whether it is qualified.',
      'If the notice from a state agency is incomplete, the administrator tells the agency what is missing, within the time the notice instructions require, and pauses the qualification decision only as those instructions allow.'
    ]);
    addSection(rows, 'How qualification is decided', [
      'The administrator decides whether the order is a qualified medical child support order. To be qualified, the order must create or recognize a child\'s right to receive benefits for which a participant is eligible, or assign that right. It must include the name and last known mailing address of the participant and of each alternate recipient, a reasonable description of the coverage, the period to which it applies, and each plan it reaches. It must not require a benefit that is not provided, except as federal law requires a notice to be honored.',
      'The administrator makes the decision within a reasonable time after the order arrives, and notifies the participant and each alternate recipient in writing. If the order is not qualified, the notice explains what is missing or what the plan cannot do. A corrected order may be submitted and will be reviewed as a new order.',
      'While the decision is pending, the administrator takes the steps federal law requires so that any coverage the order might require is not lost solely because the decision takes time. That may include a temporary enrollment to the extent the law and the certificate allow it.'
    ]);
    addSection(rows, 'After an order is qualified', [
      'Coverage required by a qualified order is provided as the order and the certificate allow. The alternate recipient is treated as a beneficiary for the benefits the order assigns. Claim payments for the child may be directed to the alternate recipient when the order says so.',
      'The participant remains responsible for contributions the certificate requires, unless the order or a state agency arranges payment. If a required contribution is not paid, coverage can end on the same terms as for any other similarly situated beneficiary, after any notice the law requires.',
      'The administrator keeps a copy of the order, the notices, and the decision with the plan records. Those papers are available to the participant and the alternate recipient on request, subject to the privacy rules that apply to the child\'s information.'
    ]);
    addSection(rows, 'Questions', [
      'Questions about these procedures go to the plan administrator. Questions about a particular child support case go to the agency or the court that issued the order. The plan administrator decides plan qualification. The administrator does not give legal advice about the order itself.',
      'A copy of these procedures is available from the plan administrator without charge.'
    ]);
    return rows;
  }
  function findingsParagraphs(plan, findings) {
    var rows = [];
    var filing = WpModel.filingResult(plan);
    var count = WpModel.countParticipants(plan);
    var census = plan.census || {};
    rows.push(row('Title', 'Findings report', { keepNext: true, keepLines: true }));
    rows.push(row(null, WpModel.DISCLAIMER));
    addSection(rows, 'Who this report is for', [
      'This note is for the employer. It is not part of the summary plan description given to employees.',
      'It explains what the sample package contains, how the Form 5500 answer was reached, what the COBRA and HIPAA answers mean, and what to do next. It is a drafting aid. Your own counsel should take a look before you sign.'
    ]);
    addSection(rows, 'Documents in the sample', [
      'The sample contains a wrap plan document, a summary plan description with the statement of ERISA rights, Schedule A with assembly instructions, and an adoption resolution with a signature block.',
      WpModel.groupHealth(plan)
        ? 'Because a group health benefit is wrapped, the sample contains qualified medical child support order procedures, including National Medical Support Notice handling.'
        : 'No group health benefit was wrapped, so the medical child support procedures were not added.',
      plan.phi === 'yes'
        ? 'The sample contains a HIPAA privacy amendment and the plan sponsor certification.'
        : 'The sample does not contain a HIPAA amendment.',
      'The signature lines and the date lines are blank on purpose. The signer\'s name and title are printed. Do not treat an unsigned sample as an adopted plan.'
    ]);
    addSection(rows, 'Form 5500 status', [
      count + ' covered participants. ' + filing.text,
      'The count is the sum of four numbers you entered for the first day of the plan year. Current employees enrolled in or automatically covered by at least one wrapped benefit: ' + (census.a || '0') + '. Current employees not in that group who contribute, for example to a health FSA only: ' + (census.b || '0') + '. Former employees on COBRA: ' + (census.c || '0') + '. Covered retirees: ' + (census.d || '0') + '. Dependents, spouses, and children who are alternate recipients under a medical child support order are not added. The same person is counted once.',
      'An employer-paid benefit that needs no enrollment, such as basic life, counts the employees who are eligible for it. A person who waived an elective benefit, is not covered, is not contributing, and has no automatic benefit is not in the count.',
      count >= 100
        ? 'The count is 100 or more, so a Form 5500 is required for this welfare plan. That is a filing duty. It is not printed in the summary plan description. The summary still tells participants they receive a summary annual report if the plan is required to file an annual report.'
        : 'The count is under 100. Whether the small-plan exemption can be stated also depends on funding, on whether employee money is remitted or runs through a cafeteria plan, and on whether any benefit is held in a trust.',
      filing.code === 'exempt'
        ? 'On the answers given, the small-plan filing exemption may apply. For a fully insured benefit, employee contributions can still fit the exemption when they are remitted to the insurer and the plan has no trust. For a self-funded or level-funded benefit, employee contributions are described that way only when a Section 125 plan is in place and the money is not held in a trust. Confirm the count is the count on the first day of the plan year before you rely on this sentence.'
        : filing.code === 'unconfirmed'
          ? 'The exemption is not stated. ' + filing.text + ' Supply the missing confirmation, or plan on filing, before you treat the plan as exempt.'
          : 'A trust or other separate fund, if you reported one, ends the small-plan exemption at any size. A count of 100 or more ends it as well.',
      count >= 100
        ? 'A count at or above 100 is not saved by a prior small-plan filing. If you filed in an earlier year while the plan was small, that history does not keep a larger plan off the filing list. The band from 80 through 120 participants is a choice of schedules for a plan that already files. It is not a reason to skip the filing. ' + (plan.prior_small_filing === 'yes' ? 'A prior small-plan filing does not change this. A Form 5500 is required.' : 'You did not report a prior small-plan filing. The filing answer would be the same if you had.')
        : 'The band from 80 through 120 participants does not create the exemption and does not cancel it. It is a schedule rule for plans that file. It was not used to reach the answer above.'
    ]);
    addSection(rows, 'COBRA', [
      plan.cobra === 'yes'
        ? 'You answered that the federal COBRA threshold was met. The wrap and the summary include the federal COBRA paragraph and name ' + (plan.cobra_admin || 'the plan administrator') + ' as the party who handles it. The general notice and the election notice still have to go out. This sample does not replace those notices, and it does not print a number of months of continuation.'
        : plan.cobra === 'unsure'
          ? 'You marked the federal COBRA count as not sure. The wrap and the summary still include the federal COBRA paragraph so the package is complete. Confirm the federal COBRA employee count before you rely on the COBRA paragraph. Count part-time employees as a fraction, hours worked divided by full-time hours, and count related employers.'
          : 'You answered that federal COBRA did not apply. Confirm that answer with the prior-year employee count before you omit federal COBRA notices.',
      plan.cobra === 'no' && plan.funding === 'insured'
        ? 'Because the medical benefit is insured and you answered no, the documents say state continuation coverage may be available and that the certificate and state law control. They do not name a number of months.'
        : '',
      plan.cobra === 'no' && count >= 100
        ? 'You answered that federal COBRA did not apply, and the covered-participant count is 100 or more. Those answers usually do not belong together. Confirm the prior-year employee count, including related employers. The participant count and the COBRA employee count are different tests, but a large covered group is a reason to look again.'
        : count >= 100 && plan.cobra !== 'no'
          ? 'The covered-participant count is 100 or more. That count is the Form 5500 count. COBRA uses a different prior-year employee test. You still confirm the COBRA test on its own, including part-time fractions and related employers.'
          : ''
    ]);
    addSection(rows, 'HIPAA', [
      plan.phi === 'yes'
        ? 'The plan sponsor receives protected health information for plan administration. The package includes a HIPAA amendment and a plan sponsor certification. The classes named to see that information are: ' + (plan.phi_classes || 'not yet filled in') + '.'
        : 'The plan sponsor does not receive protected health information beyond enrollment and disenrollment. A HIPAA amendment and a plan sponsor certification are needed before the sponsor ever receives protected health information.',
      plan.phi === 'yes' && plan.phi_classes_blank
        ? 'Fill in the job classes that may see health information before you sign the HIPAA amendment.'
        : plan.phi === 'yes'
          ? 'The certification states the statutory limits: plan-administration use only, no employment use, agents bound, notice of a misuse, access, amendment, an accounting, access for the federal health department, return or destruction when the job is done, and security safeguards for electronic information.'
          : '',
      WpModel.isSelfFundedFunding(plan.funding)
        ? 'Self-funded and level-funded medical plans usually involve the sponsor in claim information. If a TPA handles claims, confirm in the TPA contract that the sponsor\'s access matches the class list in the amendment.'
        : 'A fully insured plan can often leave identifiable claims with the insurer. If you receive more than enrollment data, sign the certification first.'
    ]);
    addSection(rows, 'Other plan design notes', WpModel.designNotes(plan));
    if (WpModel.complexFunding(plan)) {
      addSection(rows, 'Broker-of-record review', [
        WpModel.BROKER_LINE,
        'That offer is a review of the arrangement after DK Benefits is broker of record. It is not a condition on using this sample, and it is not a refusal to generate the documents. The Word file and the PDF are complete samples either way.'
      ]);
    }
    addSection(rows, 'Next steps', [
      'Collect the certificate, booklet, or TPA plan document for every benefit on Schedule A. Attach them in that order. If you do not have one yet, the package is not ready to hand to employees.',
      'Read the wrap and the summary against the certificates. If the wrap is broader than a certificate, the certificate still controls, and you should correct the wrap or issue a summary of material modifications.',
      'Ask your own counsel to take a look before anyone signs. That is a suggestion. The sample is yours to review.',
      'When you are ready, sign the adoption resolution and the wrap. Sign the HIPAA certification if the sponsor will receive protected health information. Leave no line blank at that time. Until then the lines stay blank.',
      'Give participants the summary and the certificates on the schedule in Schedule A: within 90 days after coverage starts, within 120 days after the plan becomes subject to the reporting rules, and with a summary of material modifications within 210 days after the plan year of a material change.',
      'Keep the signed originals and a record of what you sent, when, and to whom.'
    ]);
    addSection(rows, 'Filing and renewal', [
      filing.code === 'required'
        ? 'Put the Form 5500 on the calendar with the person who prepares the filing. The summary annual report, if a filing is required, goes to participants after that filing. This findings report is the place that statement lives. It is not in the summary plan description.'
        : 'If you later cross 100 covered participants, or you add a trust, revisit the filing answer. The summary plan description does not state a filing conclusion either way.',
      'Renewal planning belongs on your calendar about 90 days before the next plan year starts. This sample does not send that reminder to employees.'
    ]);
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
  function spdFileName(plan) { return safe(plan.employer_name) + '_SPD.docx'; }
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
    spdParagraphs: spdParagraphs,
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
    spdFileName: spdFileName,
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
  for (var i = 0; i < files.length && out.length < 14; i++) {
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
