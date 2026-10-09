/**
 * DK Benefits Section 125 — combined Apps Script.
 * Paste this file as the only script in a NEW project bound to the spreadsheet
 * "DK Benefits Section 125 Leads".
 * Do not paste it into the Section 128 project or the quote-tool project.
 * Order: s125-model.js, s125-terms.js, s125-docgen.js, apps-script/Code.gs.
 */

/**
 * Section 125 sample plan rules.
 * Dollar figures follow IR-2025-103 / Rev. Proc. 2025-32 and the OBBBA change to §129.
 * Draft for the employer's own advisors. Not legal advice.
 */
var S125Model = (function () {
  var TEMPLATE_VERSION = 's125-v1.0.0-2026-10-09';
  var GUIDANCE_AS_OF = '2026-10-09';
  var HEALTH_FSA_LIMIT_2026 = 3400;
  var CARRYOVER_FROM_2026 = 680;
  var CARRYOVER_INTO_2026 = 660;
  var DCAP_LIMIT_2026 = 7500;
  var DCAP_MFS_2026 = 3750;

  var US_STATES = ['AL','AK','AZ','AR','CA','CO','CT','DE','DC','FL','GA','HI','ID','IL','IN','IA','KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ','NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT','VA','WA','WV','WI','WY'];
  var MONTHS = ['', 'January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  var MONTH_DAYS = [0, 31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

  var ENTITY = {
    'c-corp': 'C corporation',
    's-corp': 'S corporation',
    'llc': 'Limited liability company',
    'partnership': 'Partnership',
    'sole-prop': 'Sole proprietorship',
    'nonprofit': 'Nonprofit organization'
  };
  var LLC_TAX = {
    's-corp': 'S corporation',
    'partnership': 'partnership',
    'c-corp': 'C corporation',
    'disregarded': 'disregarded entity (sole proprietorship)'
  };
  var WAITING = {
    none: 'No waiting period. Coverage starts on the date of hire.',
    fom_hire: 'The first day of the month after the date of hire.',
    fom_30: 'The first day of the month after 30 days of employment.',
    fom_60: 'The first day of the month after 60 days of employment.',
    days_30: 'The 31st day of employment.',
    days_60: 'The 61st day of employment.',
    days_90: 'The 91st day of employment.'
  };
  var BENEFIT_LABEL = {
    medical: 'Medical',
    dental: 'Dental',
    vision: 'Vision',
    health_fsa: 'Health FSA',
    dcap: 'Dependent Care FSA',
    hsa: 'HSA'
  };

  function push(errors, field, message) {
    errors.push({ field: field, message: message });
  }
  function clean(value) { return String(value == null ? '' : value).trim(); }
  function digits(value) { return clean(value).replace(/\D/g, ''); }
  function pad(n) { return (n < 10 ? '0' : '') + n; }

  function parseIso(iso) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(clean(iso));
    if (!m) return null;
    var y = Number(m[1]);
    var mo = Number(m[2]);
    var d = Number(m[3]);
    var dt = new Date(y, mo - 1, d);
    if (dt.getFullYear() !== y || dt.getMonth() !== mo - 1 || dt.getDate() !== d) return null;
    return dt;
  }
  function toIso(dt) {
    return dt.getFullYear() + '-' + pad(dt.getMonth() + 1) + '-' + pad(dt.getDate());
  }
  function addDays(dt, n) {
    var x = new Date(dt.getFullYear(), dt.getMonth(), dt.getDate());
    x.setDate(x.getDate() + n);
    return x;
  }
  function formatLongDate(iso) {
    var dt = parseIso(iso);
    if (!dt) return '';
    return MONTHS[dt.getMonth() + 1] + ' ' + dt.getDate() + ', ' + dt.getFullYear();
  }
  function formatMoney(n) {
    return '$' + Number(n).toLocaleString('en-US');
  }
  function todayIso(now) {
    var dt = now ? new Date(now) : new Date();
    return toIso(new Date(dt.getFullYear(), dt.getMonth(), dt.getDate()));
  }
  function formatEinLive(raw) {
    var d = digits(raw).slice(0, 9);
    if (d.length <= 2) return d;
    return d.slice(0, 2) + '-' + d.slice(2);
  }
  function formatPhoneLive(raw) {
    var d = digits(raw).slice(0, 10);
    if (d.length < 4) return d;
    if (d.length < 7) return d.slice(0, 3) + '-' + d.slice(3);
    return d.slice(0, 3) + '-' + d.slice(3, 6) + '-' + d.slice(6);
  }

  function maxDay(month) {
    return MONTH_DAYS[month] || 0;
  }
  function planYearParts(input) {
    if (input.plan_year_type === 'calendar') return { month: 1, day: 1 };
    var month = Number(input.plan_year_start_month);
    var day = Number(input.plan_year_start_day);
    if (!month || !day || day > maxDay(month)) return null;
    return { month: month, day: day };
  }
  function firstStartOnOrAfter(eff, month, day) {
    var start = new Date(eff.getFullYear(), month - 1, day);
    if (start < eff) start = new Date(eff.getFullYear() + 1, month - 1, day);
    return start;
  }
  function endParts(month, day) {
    if (day > 1) return { month: month, day: day - 1 };
    var prev = month === 1 ? 12 : month - 1;
    return { month: prev, day: maxDay(prev) };
  }

  function ownerRule(input) {
    var entity = input.entity_type;
    var llc = input.llc_tax;
    if (entity === 's-corp' || (entity === 'llc' && llc === 's-corp')) return 's-corp';
    if (entity === 'partnership' || entity === 'sole-prop') return 'self-employed';
    if (entity === 'llc' && (llc === 'partnership' || llc === 'disregarded')) return 'self-employed';
    return 'none';
  }

  function selectedBenefits(input) {
    var raw = input.benefits;
    var list = Array.isArray(raw) ? raw : [];
    var allowed = { medical: 1, dental: 1, vision: 1, health_fsa: 1, dcap: 1, hsa: 1 };
    var out = [];
    list.forEach(function (item) {
      if (allowed[item] && out.indexOf(item) === -1) out.push(item);
    });
    return out;
  }

  function has(list, name) { return list.indexOf(name) !== -1; }

  function derive(input, asOf) {
    var benefits = selectedBenefits(input);
    var parts = planYearParts(input);
    var eff = parseIso(input.effective_date);
    var prior = input.prior_plan === 'yes';
    var changeYear = prior && input.plan_year_change === 'yes';
    var onStart = !!(eff && parts && eff.getMonth() + 1 === parts.month && eff.getDate() === parts.day);
    var shortYear = !!(eff && parts && !onStart && (!prior || changeYear));
    var nextStart = eff && parts ? firstStartOnOrAfter(eff, parts.month, parts.day) : null;
    var shortEnd = null;
    if (shortYear && nextStart) {
      var boundary = nextStart.getTime() === eff.getTime()
        ? new Date(eff.getFullYear() + 1, parts.month - 1, parts.day)
        : nextStart;
      shortEnd = addDays(boundary, -1);
    }
    var oeDays = Number(input.oe_window_days);
    var oeStart = null;
    var oeEnd = null;
    if (nextStart && (oeDays === 15 || oeDays === 30 || oeDays === 45)) {
      oeEnd = addDays(nextStart, -1);
      oeStart = addDays(oeEnd, -(oeDays - 1));
    }
    var end = parts ? endParts(parts.month, parts.day) : null;
    var classes = Array.isArray(input.eligible_classes) ? input.eligible_classes.filter(function (c) {
      return c === 'full-time' || c === 'part-time' || c === 'other';
    }) : [];
    return {
      benefits: benefits,
      parts: parts,
      end_parts: end,
      effective: eff,
      prior_plan: prior,
      plan_year_change: changeYear,
      on_plan_year_start: onStart,
      short_plan_year: shortYear,
      short_plan_year_end: shortEnd ? toIso(shortEnd) : '',
      next_plan_year_start: nextStart ? toIso(nextStart) : '',
      oe_start_date: oeStart ? toIso(oeStart) : '',
      oe_end_date: oeEnd ? toIso(oeEnd) : '',
      oe_before_effective: !!(oeStart && eff && oeStart < eff),
      owner_rule: ownerRule(input),
      classes: classes,
      as_of: asOf || todayIso()
    };
  }

  function yesNo(value) {
    if (value === true || value === 'yes') return 'yes';
    if (value === false || value === 'no') return 'no';
    return value == null ? '' : String(value);
  }

  function validate(input, options) {
    input = Object.assign({}, input || {});
    input.prior_plan = yesNo(input.prior_plan);
    input.plan_year_change = yesNo(input.plan_year_change);
    input.multi_state = yesNo(input.multi_state);
    options = options || {};
    var errors = [];
    var asOf = options.asOf || todayIso();
    var name = clean(input.employer_name);
    if (name.length < 2 || name.length > 120) push(errors, 'employer_name', 'Enter the employer’s legal name (2 to 120 characters).');
    var ein = formatEinLive(input.employer_ein);
    if (!/^\d{2}-\d{7}$/.test(ein) || ein.slice(0, 2) === '00') push(errors, 'employer_ein', 'Enter a 9-digit EIN, like 12-3456789.');
    var planNumber = clean(input.plan_number) || '501';
    if (!/^\d{3}$/.test(planNumber)) push(errors, 'plan_number', 'Use a 3-digit plan number, such as 501.');
    if (clean(input.street).length < 2) push(errors, 'street', 'Enter the street address.');
    if (clean(input.city).length < 2) push(errors, 'city', 'Enter the city.');
    if (US_STATES.indexOf(clean(input.state)) === -1) push(errors, 'state', 'Choose a state.');
    if (!/^\d{5}(-\d{4})?$/.test(clean(input.zip))) push(errors, 'zip', 'Enter a 5-digit ZIP code.');
    var phone = digits(input.phone);
    if (phone.length !== 10) push(errors, 'phone', 'Enter a 10-digit phone number.');
    if (!ENTITY[input.entity_type]) push(errors, 'entity_type', 'Choose the entity type.');
    if (input.entity_type === 'llc' && !LLC_TAX[input.llc_tax]) push(errors, 'llc_tax', 'Choose how the LLC is taxed.');

    var eff = parseIso(input.effective_date);
    if (!eff) push(errors, 'effective_date', 'Choose an effective date.');
    else if (toIso(eff) < asOf) push(errors, 'effective_date', 'Use today or a future date. A cafeteria plan is adopted prospectively.');
    if (input.plan_year_type !== 'calendar' && input.plan_year_type !== 'custom') {
      push(errors, 'plan_year_type', 'Choose a calendar year or a custom plan year.');
    }
    if (input.plan_year_type === 'custom' && !planYearParts(input)) {
      push(errors, 'plan_year_start', 'Choose a start month and a day that exists in that month. February uses the 1st through the 28th.');
    }
    if (input.prior_plan !== 'yes' && input.prior_plan !== 'no') push(errors, 'prior_plan', 'Say whether a Section 125 plan is already in place.');
    if (input.prior_plan === 'yes' && !/^(0[1-9]|1[0-2])\/\d{4}$/.test(clean(input.prior_adoption))) {
      push(errors, 'prior_adoption', 'Enter the original adoption month and year, like 01/2020.');
    }
    var oe = Number(input.oe_window_days);
    if (oe !== 15 && oe !== 30 && oe !== 45) push(errors, 'oe_window_days', 'Choose a 15, 30, or 45 day open enrollment window.');
    var hire = Number(input.new_hire_window);
    if ([7, 14, 30, 60].indexOf(hire) === -1) push(errors, 'new_hire_window', 'Choose how many days a new hire has to enroll.');

    var count = Number(input.employee_count);
    if (!/^\d+$/.test(clean(input.employee_count)) || count < 1 || count > 100000) {
      push(errors, 'employee_count', 'Enter the number of employees.');
    }
    if (['insured', 'level', 'self'].indexOf(input.funding_type) === -1) push(errors, 'funding_type', 'Choose how the medical plan is funded.');
    var hours = Number(input.full_time_hours);
    if (!/^\d+$/.test(clean(input.full_time_hours)) || hours < 1 || hours > 40) {
      push(errors, 'full_time_hours', 'Enter full-time hours as a whole number from 1 to 40.');
    }
    if (!WAITING[input.waiting_period]) push(errors, 'waiting_period', 'Choose a waiting period.');
    var classes = Array.isArray(input.eligible_classes) ? input.eligible_classes : [];
    var classOk = classes.filter(function (c) { return c === 'full-time' || c === 'part-time' || c === 'other'; });
    if (!classOk.length) push(errors, 'eligible_classes', 'Choose at least one eligible class.');
    var other = clean(input.eligible_class_other);
    if (classOk.indexOf('other') !== -1 && (other.length < 3 || other.length > 160)) {
      push(errors, 'eligible_class_other', 'Describe the other class in objective terms, such as a job category or location.');
    }
    if (input.multi_state !== 'yes' && input.multi_state !== 'no') push(errors, 'multi_state', 'Say whether employees work in more than one state.');

    var benefits = selectedBenefits(input);
    if (!benefits.length) push(errors, 'benefits', 'Choose at least one pre-tax benefit.');
    var health = has(benefits, 'health_fsa');
    var dcap = has(benefits, 'dcap');
    var hsa = has(benefits, 'hsa');
    if (health && ['general', 'limited', 'both'].indexOf(input.health_fsa_design) === -1) {
      push(errors, 'health_fsa_design', 'Choose a general-purpose Health FSA, a limited-purpose Health FSA, or both.');
    }
    if (health && ['forfeit', 'grace', 'carryover'].indexOf(input.health_fsa_unused) === -1) {
      push(errors, 'health_fsa_unused', 'Choose forfeiture, a grace period, or carryover for the Health FSA.');
    }
    if (dcap && ['forfeit', 'grace'].indexOf(input.dcap_unused) === -1) {
      push(errors, 'dcap_unused', 'Choose forfeiture or a grace period for the Dependent Care FSA. Carryover does not apply.');
    }
    var signer = clean(input.signer_name);
    var title = clean(input.signer_title);
    var email = clean(input.signer_email);
    if (signer.length < 2) push(errors, 'signer_name', 'Enter the authorized officer’s name.');
    if (title.length < 2) push(errors, 'signer_title', 'Enter the officer’s title.');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) push(errors, 'signer_email', 'Enter an email address for the follow-up note.');

    var derived = derive(input, asOf);
    var plan = {
      template_version: TEMPLATE_VERSION,
      employer_name: name,
      employer_ein: ein,
      plan_number: planNumber,
      plan_name: name ? (name + ' Section 125 Cafeteria Plan') : '',
      street: clean(input.street),
      city: clean(input.city),
      state: clean(input.state),
      zip: clean(input.zip),
      employer_address: [clean(input.street), clean(input.city), clean(input.state), clean(input.zip)].filter(Boolean).join(', ').replace(/, ([A-Z]{2}), /, ', $1 '),
      phone: phone.length === 10 ? formatPhoneLive(phone) : clean(input.phone),
      entity_type: input.entity_type || '',
      llc_tax: input.entity_type === 'llc' ? input.llc_tax : '',
      owner_rule: derived.owner_rule,
      effective_date: eff ? toIso(eff) : '',
      plan_year_type: input.plan_year_type || '',
      plan_year_start_month: derived.parts ? derived.parts.month : 0,
      plan_year_start_day: derived.parts ? derived.parts.day : 0,
      plan_year_end_month: derived.end_parts ? derived.end_parts.month : 0,
      plan_year_end_day: derived.end_parts ? derived.end_parts.day : 0,
      prior_plan: derived.prior_plan,
      prior_adoption: derived.prior_plan ? clean(input.prior_adoption) : '',
      plan_year_change: derived.plan_year_change,
      short_plan_year: derived.short_plan_year,
      short_plan_year_end: derived.short_plan_year_end,
      next_plan_year_start: derived.next_plan_year_start,
      oe_window_days: oe,
      oe_start_date: derived.oe_start_date,
      oe_end_date: derived.oe_end_date,
      oe_before_effective: derived.oe_before_effective,
      new_hire_window: hire,
      employee_count: count,
      funding_type: input.funding_type || '',
      full_time_hours: hours,
      waiting_period: input.waiting_period || '',
      eligible_classes: derived.classes,
      eligible_class_other: derived.classes.indexOf('other') !== -1 ? other : '',
      multi_state: input.multi_state === 'yes',
      benefits: benefits,
      health_fsa_design: health ? input.health_fsa_design : '',
      health_fsa_unused: health ? input.health_fsa_unused : '',
      dcap_unused: dcap ? input.dcap_unused : '',
      signer_name: signer,
      signer_title: title,
      signer_email: email
    };
    plan.employer_address = plan.street + ', ' + plan.city + ', ' + plan.state + ' ' + plan.zip;
    var lead = {
      contact_name: signer,
      contact_title: title,
      contact_email: email,
      contact_phone: plan.phone,
      employee_count: count,
      entity_type: plan.entity_type
    };
    return { ok: errors.length === 0, errors: errors, plan: plan, lead: lead, review: { required: false, reasons: [] } };
  }

  function validateSubmission(payload, options) {
    if (!payload || !payload.plan) return { ok: false, errors: [{ field: 'plan', message: 'The plan answers are missing.' }] };
    var merged = Object.assign({}, payload.plan, payload.lead || {});
    if (payload.plan.signer_email) merged.signer_email = payload.plan.signer_email;
    if (payload.lead && payload.lead.contact_email) merged.signer_email = payload.plan.signer_email || payload.lead.contact_email;
    return validate(merged, options);
  }

  function stepFields(step) {
    if (step === 1) return ['employer_name', 'employer_ein', 'plan_number', 'street', 'city', 'state', 'zip', 'phone', 'entity_type', 'llc_tax'];
    if (step === 2) return ['effective_date', 'plan_year_type', 'plan_year_start', 'prior_plan', 'prior_adoption', 'oe_window_days', 'new_hire_window'];
    if (step === 3) return ['employee_count', 'funding_type', 'full_time_hours', 'waiting_period', 'eligible_classes', 'eligible_class_other', 'multi_state'];
    if (step === 4) return ['benefits', 'health_fsa_design', 'health_fsa_unused', 'dcap_unused'];
    return ['signer_name', 'signer_title', 'signer_email'];
  }

  function entitySentence(plan) {
    var base = ENTITY[plan.entity_type] || 'Employer';
    if (plan.entity_type === 'llc') return 'an LLC taxed as a ' + (LLC_TAX[plan.llc_tax] || 'business');
    return base;
  }

  function waitingText(code) { return WAITING[code] || ''; }
  function benefitLabel(code) { return BENEFIT_LABEL[code] || code; }

  function classSentence(plan) {
    var bits = [];
    if (plan.eligible_classes.indexOf('full-time') !== -1) {
      bits.push('Full-Time employees regularly scheduled to work at least ' + plan.full_time_hours + ' hours a week');
    }
    if (plan.eligible_classes.indexOf('part-time') !== -1) {
      bits.push('Part-Time employees regularly scheduled to work fewer than ' + plan.full_time_hours + ' hours a week');
    }
    if (plan.eligible_classes.indexOf('other') !== -1) bits.push(plan.eligible_class_other);
    return bits.join('; ');
  }

  function planYearSentence(plan) {
    if (plan.plan_year_type === 'calendar') return 'the calendar year, January 1 through December 31';
    var start = MONTHS[plan.plan_year_start_month] + ' ' + plan.plan_year_start_day;
    var end = MONTHS[plan.plan_year_end_month] + ' ' + plan.plan_year_end_day;
    return 'the 12-month period beginning ' + start + ' and ending ' + end;
  }

  return {
    TEMPLATE_VERSION: TEMPLATE_VERSION,
    GUIDANCE_AS_OF: GUIDANCE_AS_OF,
    HEALTH_FSA_LIMIT_2026: HEALTH_FSA_LIMIT_2026,
    CARRYOVER_FROM_2026: CARRYOVER_FROM_2026,
    CARRYOVER_INTO_2026: CARRYOVER_INTO_2026,
    DCAP_LIMIT_2026: DCAP_LIMIT_2026,
    DCAP_MFS_2026: DCAP_MFS_2026,
    US_STATES: US_STATES,
    MONTHS: MONTHS,
    WAITING: WAITING,
    validate: validate,
    validateSubmission: validateSubmission,
    stepFields: stepFields,
    derive: derive,
    formatEinLive: formatEinLive,
    formatPhoneLive: formatPhoneLive,
    formatLongDate: formatLongDate,
    formatMoney: formatMoney,
    todayIso: todayIso,
    entitySentence: entitySentence,
    waitingText: waitingText,
    benefitLabel: benefitLabel,
    classSentence: classSentence,
    planYearSentence: planYearSentence,
    ownerRule: ownerRule
  };
})();
/**
 * Educational-tool terms. Version s125-terms-2026-10-09.
 * Draft wording for DK Benefits LLC's own attorney to review before go-live.
 * Not itself legal advice.
 */
var S125Terms = (function () {
  var VERSION = 's125-terms-2026-10-09';
  var AS_OF = 'October 9, 2026';

  var PARAGRAPHS = [
    'DK Benefits LLC provides this Section 125 cafeteria plan tool as an educational resource to help employers. It produces a sample template only.',
    'The tool and the documents are not legal advice, tax advice, accounting advice, or ERISA advice. Using the tool, downloading a document, or receiving a note by email does not create an attorney-client relationship, a tax-advisor relationship, or any other advisory relationship.',
    'DK Benefits LLC and Daniel Kirves do not review, approve, or verify the documents or the information the employer enters. The employer is solely responsible for the accuracy of that information, for deciding whether to adopt a plan, for customizing the documents, for adoption and implementation, and for ongoing compliance and operation.',
    'Consult your own attorney, tax advisor, and third-party administrator before adopting or operating a cafeteria plan. This sample reflects publicly available rules as of ' + AS_OF + ', including the 2007 proposed cafeteria plan regulations (which taxpayers may rely on), IRC §§105, 125, 129, 1372, and 223, and IRS notices and revenue rulings cited in the research record. Law and guidance may change. Dollar limits change by year.',
    'The documents are a sample draft for the employer’s review with its own advisors. They are not adopted until the employer signs them. The signature line and the date line are left blank. Generating or downloading a file does not adopt a plan.',
    'A health FSA or dependent care FSA also needs the administrator’s claims procedures. This sample states the cafeteria-plan election rules and the unused-funds rule the employer chose. It does not replace a carrier contract, a stop-loss policy, or an insurance certificate.',
    'The tool and the documents are provided “as is” and “as available,” without warranties of any kind, express or implied, including warranties of accuracy, fitness for a particular purpose, and non-infringement.',
    'To the fullest extent permitted by law, DK Benefits LLC and Daniel Kirves have no liability for any use of, or reliance on, the tool or the documents, including a decision to adopt, not to adopt, or to operate a plan.',
    'The employer agrees to indemnify and hold harmless DK Benefits LLC and Daniel Kirves from claims, damages, losses, and reasonable expenses arising out of the employer’s use of the tool, reliance on the sample documents, or adoption or operation of a plan, except to the extent caused by DK Benefits LLC’s intentional misconduct. This indemnity applies only to the extent the law allows.',
    'Checking the box means the employer agrees to these terms, version ' + VERSION + ', and that the person submitting the form is authorized to agree for the employer.'
  ];

  var CHECKBOX = 'I understand this is an educational tool, not legal or tax advice, and my company is responsible for what it adopts. I agree to the Terms of use.';

  var FOOTER = 'Prepared with DK Benefits\' educational tool. Not effective until signed by the employer.';

  return {
    VERSION: VERSION,
    AS_OF: AS_OF,
    PARAGRAPHS: PARAGRAPHS,
    CHECKBOX: CHECKBOX,
    FOOTER: FOOTER
  };
})();
/**
 * Section 125 sample cafeteria plan, checklist, and follow-up note.
 * Word uses Calibri. The PDF uses Times because the vendored pdf-lib has no fontkit.
 */
var S125Docgen = (function () {
  var W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
  var R = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
  var FOOTER = S125Terms.FOOTER;

  function xml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
  function has(plan, code) { return plan.benefits.indexOf(code) !== -1; }
  function row(style, text, extra) {
    var item = { style: style, text: text };
    if (extra) Object.keys(extra).forEach(function (key) { item[key] = extra[key]; });
    return item;
  }

  function ownerParagraph(plan) {
    if (plan.owner_rule === 's-corp') {
      return 'Employee does not include a 2-percent shareholder of the Employer within the meaning of Code §1372(b). A 2-percent shareholder is a person who owns more than 2 percent of the outstanding stock or of the total combined voting power on any day of the S corporation’s year, including stock treated as owned under Code §318. Attribution under §318(a)(1) includes stock owned by a spouse, child, grandchild, or parent. It does not include stock owned only by a sibling. Such a person may not make pre-tax contributions under this Plan. This rule applies to an S corporation and to an LLC that has elected to be taxed as an S corporation.';
    }
    if (plan.owner_rule === 'self-employed') {
      return 'Employee does not include a self-employed individual within the meaning of Code §401(c), including a partner, a member of an LLC taxed as a partnership, a member of an LLC that is a disregarded entity, and a sole proprietor. Those individuals may not make pre-tax contributions under this Plan.';
    }
    return 'A common-law employee of a C corporation or a nonprofit may participate, including an owner who is a common-law employee. Partners, sole proprietors, and more-than-2-percent S corporation shareholders are not employees for Code §125 when those rules apply to the employer.';
  }

  function benefitParagraphs(plan) {
    var rows = [];
    ['medical', 'dental', 'vision'].forEach(function (code) {
      if (!has(plan, code)) return;
      var name = S125Model.benefitLabel(code).toLowerCase();
      rows.push(row(null, 'The Employee’s share of premiums for coverage under the Employer’s group ' + name + ' plan, as described in the applicable insurance contract or plan document.'));
    });
    if (has(plan, 'health_fsa')) {
      var design = plan.health_fsa_design;
      var designText = design === 'limited'
        ? 'The Health FSA under this Plan is a limited-purpose health FSA. It reimburses dental, vision, and preventive care expenses. It is not a general-purpose health FSA.'
        : design === 'both'
          ? 'The Employer offers a general-purpose Health FSA and a limited-purpose Health FSA. The limited-purpose Health FSA reimburses dental, vision, and preventive care expenses. A Participant who wants to contribute to an HSA elects the limited-purpose Health FSA. A Participant covered by the general-purpose Health FSA, and a spouse who can be reimbursed by that FSA, is not eligible to contribute to an HSA for that period.'
          : 'The Health FSA under this Plan is a general-purpose health FSA. It can reimburse Code §213(d) medical expenses. A Participant covered by this general-purpose Health FSA, and a spouse who can be reimbursed by it, is not eligible to contribute to an HSA while that coverage is in effect. The Employer may still offer an HSA. An employee who wants to contribute to an HSA needs a limited-purpose FSA (dental, vision, and preventive care), a post-deductible FSA, or no general-purpose Health FSA.';
      rows.push(row(null, 'Health FSA. ' + designText + ' For a plan year beginning in 2026, the most a Participant may contribute by salary reduction is ' + S125Model.formatMoney(S125Model.HEALTH_FSA_LIMIT_2026) + ', under Code §125(i).'));
      if (plan.health_fsa_unused === 'grace') {
        rows.push(row(null, 'Health FSA grace period. This Plan provides a grace period ending on the 15th day of the third month after the end of each plan year. Expenses incurred during the grace period may be reimbursed from unused Health FSA amounts remaining at the end of the prior plan year. Amounts not used by the end of the grace period and the run-out period are forfeited. This Plan does not also provide a Health FSA carryover.'));
      } else if (plan.health_fsa_unused === 'carryover') {
        rows.push(row(null, 'Health FSA carryover. Unused Health FSA amounts up to the indexed carryover limit may be carried into the next plan year. For a plan year beginning in 2026, that carryover into the next plan year is ' + S125Model.formatMoney(S125Model.CARRYOVER_FROM_2026) + '. Amounts carried into a plan year beginning in 2026 from a plan year beginning in 2025 are limited to ' + S125Model.formatMoney(S125Model.CARRYOVER_INTO_2026) + '. Amounts above the limit are forfeited. This Plan does not also provide a Health FSA grace period. Carryover does not apply to the Dependent Care FSA.'));
      } else {
        rows.push(row(null, 'Health FSA forfeiture. Unused Health FSA amounts are forfeited at the end of the plan year and the run-out period. This Plan does not provide a Health FSA grace period or a Health FSA carryover.'));
      }
    }
    if (has(plan, 'dcap')) {
      var dcapUnused = plan.dcap_unused === 'grace'
        ? 'This Plan provides a grace period for the Dependent Care FSA ending on the 15th day of the third month after the end of each plan year. Amounts not used by the end of that grace period and the run-out period are forfeited.'
        : 'Unused Dependent Care FSA amounts are forfeited at the end of the plan year and the run-out period.';
      rows.push(row(null, 'Dependent Care FSA. A Participant may pay qualifying dependent care expenses on a pre-tax basis under Code §129. For taxable years beginning in 2026, the exclusion is ' + S125Model.formatMoney(S125Model.DCAP_LIMIT_2026) + ' (' + S125Model.formatMoney(S125Model.DCAP_MFS_2026) + ' if the Participant is married and files a separate return). That amount is set by statute and is not adjusted for inflation. Dependent care eligibility follows Code §§129 and 21, generally a dependent under age 13 or a spouse or dependent who is incapable of self-care. The age-27 accident-and-health rule does not apply to the Dependent Care FSA. ' + dcapUnused + ' Carryover does not apply to the Dependent Care FSA.'));
    }
    if (has(plan, 'hsa')) {
      rows.push(row(null, 'HSA contributions. A Participant who is an eligible individual under Code §223 may make pre-tax salary-reduction contributions to a health savings account. HSA Elections: Notwithstanding any irrevocable-election rule, a Participant may prospectively make, change, or revoke a salary reduction election for HSA contributions at least monthly, without a change-in-status event. The change applies only to compensation that is not yet currently available on the date of the change. A Participant who stops being HSA-eligible may prospectively revoke the election. HSA contributions are nonforfeitable once deposited to the custodian. Offering a general-purpose Health FSA does not prohibit the Employer from offering HSA contributions. A person covered by a general-purpose Health FSA is not an eligible individual for the HSA.'));
    }
    return rows;
  }

  function planParagraphs(plan) {
    var rows = [];
    rows.push(row('Title', plan.plan_name || 'Section 125 Cafeteria Plan'));
    rows.push(row(null, 'Educational sample prepared for ' + plan.employer_name + '. This document is not legal, tax, or ERISA advice. It is not effective until the Employer signs it. The signature line and the date line are blank.'));
    rows.push(row('Heading1', 'Article I. Establishment'));
    rows.push(row(null, plan.employer_name + ', ' + S125Model.entitySentence(plan) + ', EIN ' + plan.employer_ein + ', with its principal office at ' + plan.employer_address + ', adopts this cafeteria plan under Code §125. The plan number is ' + plan.plan_number + '. The Plan Administrator is the Employer, acting through its authorized officer.'));
    var adopt = plan.prior_plan
      ? 'This document restates the cafeteria plan originally adopted ' + plan.prior_adoption + '. The restatement is effective ' + S125Model.formatLongDate(plan.effective_date) + '.'
      : 'This Plan is effective ' + S125Model.formatLongDate(plan.effective_date) + '. It is adopted prospectively. It does not cover a period before the effective date.';
    rows.push(row(null, adopt));
    rows.push(row(null, 'The plan year is ' + S125Model.planYearSentence(plan) + '.'));
    if (plan.short_plan_year) {
      rows.push(row(null, 'The first plan year is a short plan year beginning ' + S125Model.formatLongDate(plan.effective_date) + ' and ending ' + S125Model.formatLongDate(plan.short_plan_year_end) + '. Later plan years follow the 12-month plan year above.' + (plan.plan_year_change ? ' This restatement changes the plan year, so the period before the new plan year starts is a short year.' : '')));
    } else if (plan.prior_plan) {
      rows.push(row(null, 'This restatement continues the existing plan year. It is not a new short plan year.'));
    }

    rows.push(row('Heading1', 'Article II. Definitions'));
    rows.push(row(null, 'Employer means ' + plan.employer_name + '.'));
    rows.push(row(null, ownerParagraph(plan)));
    rows.push(row(null, 'Eligible Employee means an Employee in an eligible class in Article III who has satisfied the waiting period and the other eligibility rules. Full-Time means an Employee regularly scheduled to work at least ' + plan.full_time_hours + ' hours a week. Part-Time means an Employee regularly scheduled to work fewer than ' + plan.full_time_hours + ' hours a week.'));
    rows.push(row(null, 'Dependent means a dependent under Code §152, except as this paragraph provides. For accident and health benefits, including medical, dental, vision, and a Health FSA, Dependent also includes a Participant’s child (as defined in Code §152(f)(1)) who has not attained age 27 as of the end of the Participant’s taxable year, even if that child is not a dependent under Code §152. That age-27 rule does not make a person a qualifying individual for the Dependent Care FSA.'));
    rows.push(row(null, 'A highly compensated individual, for Code §125, is a person described in Code §125(e): an officer; a shareholder owning more than 5 percent of the voting power or value of all classes of stock; a highly compensated employee under the compensation test; or a spouse or dependent of any of them. “Five percent or greater” is not the test. The ownership test is more than 5 percent.'));
    rows.push(row(null, 'A key employee is a key employee under Code §416(i)(1).'));

    rows.push(row('Heading1', 'Article III. Eligibility'));
    rows.push(row(null, 'Eligible classes: ' + S125Model.classSentence(plan) + '.'));
    rows.push(row(null, 'Waiting period and election effective date. ' + S125Model.waitingText(plan.waiting_period) + ' An election is effective on the date coverage begins under that waiting period. It is not postponed by an extra month beyond the waiting period the Employer chose.'));
    if (plan.waiting_period === 'days_90') {
      rows.push(row(null, 'The 90-day period is the general maximum waiting period for a group health plan under the Affordable Care Act. Coverage begins on the 91st day. This sample does not add days beyond that.'));
    }
    rows.push(row(null, 'The following are not Eligible Employees: an Employee who has not finished the waiting period; a temporary employee, a leased employee, or an independent contractor who is not a common-law employee; and any person excluded in Article II.'));
    if (plan.multi_state) {
      rows.push(row(null, 'Employees may work in more than one state. This Plan states the federal cafeteria-plan rules. State insurance and employment laws may also apply where the employees work.'));
    }

    rows.push(row('Heading1', 'Article IV. Benefits'));
    var claimSource = (has(plan, 'health_fsa') || has(plan, 'dcap'))
      ? 'The underlying insurance contract or FSA claims procedures control payment of a specific claim.'
      : 'The underlying insurance contract controls payment of a specific claim.';
    rows.push(row(null, 'A Participant may choose among cash and the qualified benefits listed in this Article. Each benefit is the Employee’s pre-tax payment of the cost described. ' + claimSource));
    benefitParagraphs(plan).forEach(function (item) { rows.push(item); });
    if ((has(plan, 'health_fsa') || has(plan, 'dcap')) && plan.funding_type) {
      rows.push(row(null, 'The ' + (has(plan, 'health_fsa') && has(plan, 'dcap') ? 'Health FSA and the Dependent Care FSA are' : has(plan, 'health_fsa') ? 'Health FSA is' : 'Dependent Care FSA is') + ' administered under the Employer’s FSA procedures. Those procedures do not replace the unused-funds rule stated in this Plan.'));
    }

    rows.push(row('Heading1', 'Article V. Elections'));
    rows.push(row(null, 'A salary-reduction election is irrevocable for the plan year except as this Article allows. The Plan permits prospective election changes for the events in Treas. Reg. §1.125-4 that the Employer has put in its election procedures, including a change in status and a HIPAA special enrollment right, when the change is consistent with that event.'));
    if (has(plan, 'hsa')) {
      rows.push(row(null, 'HSA salary-reduction elections are not locked for the year. Article IV requires a prospective change or revocation at least monthly, and a prospective revocation when the Participant stops being HSA-eligible.'));
    }
    rows.push(row(null, 'A new hire has ' + plan.new_hire_window + ' days after becoming eligible to make an initial election. An Employee who does not make an election in that window, or during open enrollment, is deemed to have waived all pre-tax benefits and elected cash. The missed election does not default to after-tax coverage.'));
    var oe = 'The annual open enrollment period runs for ' + plan.oe_window_days + ' days and ends the day before the plan year starts. Elections made during open enrollment are effective on the first day of the upcoming plan year. The first open enrollment period under this Plan runs from ' + S125Model.formatLongDate(plan.oe_start_date) + ' through ' + S125Model.formatLongDate(plan.oe_end_date) + '.';
    if (plan.oe_before_effective) {
      oe += ' That first window ends the day before the effective date. It is the enrollment to start the Plan. It is not an enrollment for a year that has already passed.';
    }
    rows.push(row(null, oe));

    rows.push(row('Heading1', 'Article VI. Salary reduction'));
    rows.push(row(null, 'A Participant’s taxable pay is reduced, before income tax and, where the Code allows, before Social Security and Medicare tax, by the amount needed to pay the elected benefits. The Employer pays that amount to the benefit. An election applies only to compensation that is not yet currently available.'));

    rows.push(row('Heading1', 'Article VII. Plan Administrator'));
    var admin = 'The Plan Administrator is the Employer, acting through its authorized officer. The officer who signs this Plan does so for the Employer and is not named personally as the fiduciary. The Plan Administrator applies this Plan and keeps records.';
    if (has(plan, 'health_fsa') || has(plan, 'dcap')) {
      admin += ' The Plan Administrator may delegate day-to-day administration of an FSA to a third-party administrator. Delegation does not move the unused-funds rule out of this Plan.';
    }
    rows.push(row(null, admin));
    rows.push(row(null, 'Notices to the Plan Administrator may be sent to ' + plan.signer_name + ', ' + plan.signer_title + ', at the Employer’s office.'));

    rows.push(row('Heading1', has(plan, 'hsa')
      ? 'Article VIII. No vested right except deposited HSA contributions'
      : 'Article VIII. No vested right'));
    var vest = 'Except for HSA amounts already deposited with the custodian, no Participant accrues a vested right to benefits under this Plan. Health FSA and Dependent Care FSA balances that remain unused under Article IV are forfeited.';
    if (!has(plan, 'hsa')) vest = 'No Participant accrues a vested right to benefits under this Plan. Amounts that remain unused under Article IV are forfeited.';
    rows.push(row(null, vest));

    rows.push(row('Heading1', 'Article IX. Nondiscrimination'));
    rows.push(row(null, 'This Plan is intended to satisfy the cafeteria-plan nondiscrimination rules in Code §125, including the 25 percent key-employee concentration test in §125(b)(2). Those tests apply to a plan of every size. The Employer will test the Plan each year. A larger workforce does not create the duty, and a smaller workforce does not remove it.'));
    if (has(plan, 'dcap')) {
      rows.push(row(null, 'Dependent Care FSA benefits are also subject to the Code §129(d) tests, including the 55 percent average benefits test and the limit on benefits to more-than-5-percent owners. The higher 2026 exclusion can make the 55 percent test harder to pass. The Employer should test before relying on the ' + S125Model.formatMoney(S125Model.DCAP_LIMIT_2026) + ' cap.'));
    }
    if (plan.funding_type === 'self' || plan.funding_type === 'level') {
      rows.push(row(null, 'Self-insured medical reimbursement benefits, including a level-funded arrangement that is self-insured for tax purposes, are also subject to the nondiscrimination requirements of Code §105(h).'));
    }
    if (Number(plan.employee_count) >= 50) {
      rows.push(row(null, 'An employer with 50 or more employees may be subject to the Family and Medical Leave Act, which affects cafeteria-plan elections during leave. Applicable large employer status under the Affordable Care Act depends on full-time and full-time-equivalent employees, not on this headcount alone.'));
    }

    rows.push(row('Heading1', 'Article X. Amendment and termination'));
    var amend = 'The Employer may amend or terminate this Plan prospectively. An amendment is effective only when the Employer adopts it in writing.';
    if (has(plan, 'hsa')) amend += ' Termination does not take back an HSA contribution already deposited.';
    rows.push(row(null, amend));

    rows.push(row('Heading1', 'Article XI. Severability'));
    rows.push(row(null, 'If a provision of this Plan is held invalid, the rest of the Plan remains in effect. This Article is part of every form of this Plan, whether or not an HSA is offered.'));

    rows.push(row('Heading1', 'Article XII. Execution'));
    rows.push(row(null, 'The Employer adopts this Plan as of the effective date when its authorized officer signs below. Generating this file does not adopt the Plan.', { keepNext: true }));
    rows.push(row(null, 'Employer: ' + plan.employer_name, { keepNext: true, keepLines: true }));
    rows.push(row(null, 'By: ________________________________', { keepNext: true, keepLines: true }));
    rows.push(row(null, 'Name: ' + plan.signer_name, { keepNext: true, keepLines: true }));
    rows.push(row(null, 'Title: ' + plan.signer_title, { keepNext: true, keepLines: true }));
    rows.push(row(null, 'Date: ________________________________', { keepLines: true }));
    rows.push(row(null, 'The date line is blank. The Employer dates the Plan when it signs.'));
    return rows;
  }

  function signLine(plan) {
    var when = S125Model.formatLongDate(plan.effective_date);
    var today = S125Model.todayIso();
    if (plan.effective_date && plan.effective_date < today) return 'Sign and date the plan as soon as you can.';
    return 'Sign and date the plan before ' + when + '.';
  }

  function checklistLines(plan) {
    var lines = [signLine(plan).replace(/\.$/, '') + '.'];
    lines.push('Give payroll the signed plan so pre-tax deductions start on or after the effective date.');
    if (has(plan, 'health_fsa') || has(plan, 'dcap')) {
      lines.push('Tell the FSA administrator the unused-funds rule in Article IV. Do not leave that rule only in side materials.');
    }
    if (has(plan, 'hsa')) lines.push('Tell payroll that HSA salary-reduction elections can be changed at least monthly, prospectively.');
    lines.push('Send employees a short note with the eligible classes, the waiting period, and the open enrollment dates in the plan.');
    if (plan.owner_rule === 's-corp') lines.push('Keep more-than-2% S corporation shareholders, including attributed family owners, off the pre-tax plan.');
    if (plan.owner_rule === 'self-employed') lines.push('Keep partners, LLC members taxed as partners, and sole proprietors off the pre-tax plan.');
    return lines;
  }

  function emailChecklistLines(plan) {
    var lines = [signLine(plan)];
    lines.push('Let payroll know these elections come out of pay before income tax, and before Social Security and Medicare tax when the benefit qualifies.');
    if (has(plan, 'health_fsa')) {
      if (plan.health_fsa_unused === 'carryover') {
        lines.push('The Health FSA carries unused amounts up to the plan-year limit ($680 from a 2026 plan year). It does not also have a grace period.');
      } else if (plan.health_fsa_unused === 'grace') {
        lines.push('The Health FSA grace period runs through the 15th day of the third month after the plan year. It does not also have a carryover.');
      } else {
        lines.push('Unused Health FSA money is forfeited at the end of the plan year. There is no grace period and no carryover.');
      }
    }
    if (has(plan, 'dcap')) {
      lines.push(plan.dcap_unused === 'grace'
        ? 'Unused dependent care money can be used through the 15th day of the third month. It cannot be carried over.'
        : 'Unused dependent care money is forfeited at the end of the plan year. It cannot be carried over.');
    }
    if (has(plan, 'hsa')) lines.push('Employees can change the HSA election at least once a month. It does not have to wait for open enrollment.');
    lines.push('Send your employees a short note about who is eligible and when they can enroll.');
    return lines;
  }

  function guideParagraphs(plan) {
    var rows = [
      row('Title', 'Section 125 implementation checklist'),
      row(null, plan.employer_name + ' — ' + plan.plan_name + '.')
    ];
    checklistLines(plan).forEach(function (line, index) {
      rows.push(row(null, (index + 1) + '. ' + line));
    });
    rows.push(row(null, 'This checklist is educational. It is not legal or tax advice.'));
    return rows;
  }

  function followUpFirstName(lead) {
    var name = String(lead && lead.contact_name || '').trim();
    return name.split(/\s+/)[0] || '';
  }

  function followUpEmailText(plan, lead, links) {
    links = links || {};
    lead = lead || {};
    plan = plan || { benefits: [], employer_name: '' };
    plan.benefits = plan.benefits || [];
    var section128 = links.section128Url || '';
    var rates = links.ratesUrl || '';
    var first = followUpFirstName(lead);
    var employer = plan.employer_name || 'your company';
    var lines = [
      first ? ('Hi ' + first + ',') : 'Hi there,',
      '',
      'I just saw you put together your Section 125 plan for ' + employer + '. Thanks so much for giving my tool a try. I really appreciate it!',
      '',
      'Just a few quick reminders so you can get it up and running:',
      ''
    ];
    emailChecklistLines(plan).forEach(function (line, index) {
      lines.push((index + 1) + '. ' + line);
    });
    lines.push(
      '',
      'Your tax advisor can help with anything specific to your situation.',
      '',
      'Oh, and if you want to look at employer contributions to Trump accounts under Section 128, I have a free tool for that too:',
      section128,
      '',
      'Also, just so you know, I\'m an employee benefits broker. No pressure at all, but I\'d be happy to help you shop and negotiate your group health and other benefits. I even have some rates you can check out online right now:',
      rates,
      '',
      'Would you mind giving me a shot to see what I can do for you? I\'d love to hear from you.',
      '',
      'Also, just so it\'s clear, I don\'t sell, market, open, or administer Trump accounts. And legally I have to mention that the tool is educational and isn\'t legal or tax advice.',
      '',
      'Daniel Kirves',
      'Benefits Broker | 20 Years Exp | DK Benefits',
      '407-476-5076 | www.dkbenefits.net',
      '6000 Metrowest Blvd #200 Orlando, FL 32835',
      '',
      'Agency Lic# L109331'
    );
    return lines.join('\n');
  }

  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function followUpEmailHtml(plan, lead, links) {
    links = links || {};
    var allowed = {};
    if (links.section128Url) allowed[links.section128Url] = true;
    if (links.ratesUrl) allowed[links.ratesUrl] = true;
    var html = followUpEmailText(plan, lead, links).split('\n').map(function (line) {
      if (allowed[line]) {
        var safe = escapeHtml(line);
        return '<a href="' + safe + '">' + safe + '</a>';
      }
      return escapeHtml(line);
    }).join('<br>\n');
    return '<div>' + html + '</div>';
  }

  function paragraphXml(row) {
    if (row.pageBreak) return '<w:p><w:r><w:br w:type="page"/></w:r></w:p>';
    var bits = [];
    if (row.style) bits.push('<w:pStyle w:val="' + xml(row.style) + '"/>');
    if (row.keepNext) bits.push('<w:keepNext/>');
    if (row.keepLines) bits.push('<w:keepLines/>');
    if (row.spaceBefore || row.spaceAfter != null) {
      var spacing = '<w:spacing';
      if (row.spaceBefore) spacing += ' w:before="' + row.spaceBefore + '"';
      if (row.spaceAfter != null) spacing += ' w:after="' + row.spaceAfter + '"';
      spacing += '/>';
      bits.push(spacing);
    }
    var pPr = bits.length ? '<w:pPr>' + bits.join('') + '</w:pPr>' : '';
    var text = row.text || '';
    if (!text) return '<w:p>' + pPr + '</w:p>';
    return '<w:p>' + pPr + '<w:r><w:t xml:space="preserve">' + xml(text) + '</w:t></w:r></w:p>';
  }

  function documentXml(rows) {
    var body = rows.map(paragraphXml).join('');
    return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<w:document xmlns:w="' + W + '" xmlns:r="' + R + '"><w:body>' + body +
      '<w:sectPr>' +
      '<w:headerReference w:type="default" r:id="rId2"/>' +
      '<w:footerReference w:type="default" r:id="rId3"/>' +
      '<w:pgSz w:w="12240" w:h="15840"/>' +
      '<w:pgMar w:top="936" w:right="1152" w:bottom="936" w:left="1152" w:header="720" w:footer="720" w:gutter="0"/>' +
      '</w:sectPr></w:body></w:document>';
  }

  function headerXml() {
    return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<w:hdr xmlns:w="' + W + '"><w:p><w:pPr><w:pStyle w:val="Header"/></w:pPr></w:p></w:hdr>';
  }

  function footerXml() {
    return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<w:ftr xmlns:w="' + W + '">' +
      '<w:p><w:pPr><w:pStyle w:val="Footer"/></w:pPr>' +
      '<w:r><w:t xml:space="preserve">' + xml(FOOTER) + '</w:t></w:r></w:p>' +
      '<w:p><w:pPr><w:pStyle w:val="Footer"/><w:jc w:val="right"/></w:pPr>' +
      '<w:r><w:t xml:space="preserve">Page </w:t></w:r>' +
      '<w:r><w:fldChar w:fldCharType="begin"/></w:r>' +
      '<w:r><w:instrText xml:space="preserve"> PAGE </w:instrText></w:r>' +
      '<w:r><w:fldChar w:fldCharType="separate"/></w:r>' +
      '<w:r><w:t>1</w:t></w:r>' +
      '<w:r><w:fldChar w:fldCharType="end"/></w:r>' +
      '</w:p></w:ftr>';
  }

  function stylesXml() {
    return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<w:styles xmlns:w="' + W + '">' +
      '<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:qFormat/>' +
      '<w:pPr><w:spacing w:after="120" w:line="246" w:lineRule="auto"/></w:pPr>' +
      '<w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:cs="Calibri"/><w:sz w:val="22"/><w:szCs w:val="22"/></w:rPr></w:style>' +
      '<w:style w:type="paragraph" w:styleId="Title"><w:name w:val="Title"/><w:basedOn w:val="Normal"/><w:qFormat/>' +
      '<w:pPr><w:spacing w:before="0" w:after="160"/></w:pPr>' +
      '<w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/><w:b/><w:color w:val="1A2E4A"/><w:sz w:val="36"/><w:szCs w:val="36"/></w:rPr></w:style>' +
      '<w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/><w:basedOn w:val="Normal"/><w:uiPriority w:val="9"/><w:qFormat/>' +
      '<w:pPr><w:spacing w:before="240" w:after="80"/><w:outlineLvl w:val="0"/></w:pPr>' +
      '<w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/><w:b/><w:color w:val="1A2E4A"/><w:sz w:val="28"/><w:szCs w:val="28"/></w:rPr></w:style>' +
      '<w:style w:type="paragraph" w:styleId="Heading2"><w:name w:val="heading 2"/><w:basedOn w:val="Normal"/><w:uiPriority w:val="9"/><w:qFormat/>' +
      '<w:pPr><w:spacing w:before="200" w:after="60"/><w:outlineLvl w:val="1"/></w:pPr>' +
      '<w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/><w:b/><w:color w:val="1A2E4A"/><w:sz w:val="24"/><w:szCs w:val="24"/></w:rPr></w:style>' +
      '<w:style w:type="paragraph" w:styleId="Header"><w:name w:val="Header"/><w:basedOn w:val="Normal"/>' +
      '<w:pPr><w:spacing w:after="0"/></w:pPr><w:rPr><w:sz w:val="16"/><w:szCs w:val="16"/><w:i/><w:color w:val="5A6A7E"/></w:rPr></w:style>' +
      '<w:style w:type="paragraph" w:styleId="Footer"><w:name w:val="Footer"/><w:basedOn w:val="Normal"/>' +
      '<w:pPr><w:spacing w:after="0"/></w:pPr><w:rPr><w:sz w:val="16"/><w:szCs w:val="16"/><w:color w:val="5A6A7E"/></w:rPr></w:style>' +
      '</w:styles>';
  }

  function coreXml(props) {
    var now = (props.created || '2026-10-08') + 'T00:00:00Z';
    return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">' +
      '<dc:title>' + xml(props.title || 'Section 125 Cafeteria Plan') + '</dc:title>' +
      '<dc:subject>Section 125 Cafeteria Plan.</dc:subject>' +
      '<dc:creator>DK Benefits LLC</dc:creator>' +
      '<cp:lastModifiedBy>DK Benefits LLC</cp:lastModifiedBy>' +
      '<dc:description>Template ' + xml(S125Model.TEMPLATE_VERSION) + '.</dc:description>' +
      '<dcterms:created xsi:type="dcterms:W3CDTF">' + xml(now) + '</dcterms:created>' +
      '<dcterms:modified xsi:type="dcterms:W3CDTF">' + xml(now) + '</dcterms:modified>' +
      '</cp:coreProperties>';
  }

  function appXml() {
    return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties">' +
      '<Application>DK Benefits LLC</Application><Company>DK Benefits LLC</Company></Properties>';
  }

  function contentTypesXml() {
    return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
      '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
      '<Default Extension="xml" ContentType="application/xml"/>' +
      '<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>' +
      '<Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>' +
      '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>' +
      '<Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>' +
      '<Override PartName="/word/header1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.header+xml"/>' +
      '<Override PartName="/word/footer1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.footer+xml"/>' +
      '<Override PartName="/word/settings.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.settings+xml"/>' +
      '</Types>';
  }

  function rootRels() {
    return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
      '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>' +
      '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>' +
      '<Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/>' +
      '</Relationships>';
  }

  function docRels() {
    return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
      '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>' +
      '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/header" Target="header1.xml"/>' +
      '<Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/footer" Target="footer1.xml"/>' +
      '<Relationship Id="rId4" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/settings" Target="settings.xml"/>' +
      '</Relationships>';
  }

  function settingsXml() {
    return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<w:settings xmlns:w="' + W + '"><w:compat><w:compatSetting w:name="compatibilityMode" w:uri="http://schemas.microsoft.com/office/word" w:val="15"/></w:compat><w:updateFields w:val="true"/></w:settings>';
  }

  function packageParts(rows, props) {
    return [
      { name: '[Content_Types].xml', text: contentTypesXml() },
      { name: '_rels/.rels', text: rootRels() },
      { name: 'docProps/core.xml', text: coreXml(props || {}) },
      { name: 'docProps/app.xml', text: appXml() },
      { name: 'word/document.xml', text: documentXml(rows) },
      { name: 'word/styles.xml', text: stylesXml() },
      { name: 'word/header1.xml', text: headerXml() },
      { name: 'word/footer1.xml', text: footerXml() },
      { name: 'word/settings.xml', text: settingsXml() },
      { name: 'word/_rels/document.xml.rels', text: docRels() }
    ];
  }

  function crcTable() {
    var table = new Uint32Array(256);
    for (var n = 0; n < 256; n++) {
      var c = n;
      for (var k = 0; k < 8; k++) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
      table[n] = c >>> 0;
    }
    return table;
  }
  var CRC = null;
  function crc32(bytes) {
    if (!CRC) CRC = crcTable();
    var c = 0xffffffff;
    for (var i = 0; i < bytes.length; i++) c = CRC[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  }

  function utf8(str) {
    if (typeof TextEncoder !== 'undefined') return new TextEncoder().encode(str);
    var out = [];
    for (var i = 0; i < str.length; i++) {
      var code = str.charCodeAt(i);
      if (code < 0x80) out.push(code);
      else if (code < 0x800) out.push(0xc0 | (code >> 6), 0x80 | (code & 0x3f));
      else out.push(0xe0 | (code >> 12), 0x80 | ((code >> 6) & 0x3f), 0x80 | (code & 0x3f));
    }
    return new Uint8Array(out);
  }

  function u16(n) { return new Uint8Array([n & 255, (n >> 8) & 255]); }
  function u32(n) { return new Uint8Array([n & 255, (n >> 8) & 255, (n >> 16) & 255, (n >>> 24) & 255]); }
  function concatBytes(parts) {
    var len = 0;
    var i;
    for (i = 0; i < parts.length; i++) len += parts[i].length;
    var out = new Uint8Array(len);
    var o = 0;
    for (i = 0; i < parts.length; i++) { out.set(parts[i], o); o += parts[i].length; }
    return out;
  }

  function zipStore(files) {
    var locals = [];
    var centrals = [];
    var offset = 0;
    for (var i = 0; i < files.length; i++) {
      var nameBytes = utf8(files[i].name);
      var data = utf8(files[i].text);
      var crc = crc32(data);
      var local = concatBytes([
        u32(0x04034b50), u16(20), u16(0), u16(0), u16(0), u16(0x21),
        u32(crc), u32(data.length), u32(data.length), u16(nameBytes.length), u16(0),
        nameBytes, data
      ]);
      locals.push(local);
      centrals.push(concatBytes([
        u32(0x02014b50), u16(20), u16(20), u16(0), u16(0), u16(0), u16(0x21),
        u32(crc), u32(data.length), u32(data.length), u16(nameBytes.length), u16(0), u16(0),
        u16(0), u16(0), u32(0), u32(offset), nameBytes
      ]));
      offset += local.length;
    }
    var central = concatBytes(centrals);
    var end = concatBytes([
      u32(0x06054b50), u16(0), u16(0), u16(files.length), u16(files.length),
      u32(central.length), u32(offset), u16(0)
    ]);
    return concatBytes(locals.concat([central, end]));
  }

  function buildDocx(rows, props) {
    return zipStore(packageParts(rows, props || {}));
  }

  var FILE_LETTERS = { 'Ł': 'L', 'ł': 'l', 'Ø': 'O', 'ø': 'o', 'Đ': 'D', 'đ': 'd', 'ß': 'ss', 'Æ': 'AE', 'æ': 'ae', 'Œ': 'OE', 'œ': 'oe', 'Þ': 'Th', 'þ': 'th' };

  function asciiLetters(value) {
    var s = String(value || '');
    if (s.normalize) s = s.normalize('NFD').replace(/[̀-ͯ]/g, '');
    return s.replace(/[ŁłØøĐđßÆæŒœÞþ]/g, function (ch) { return FILE_LETTERS[ch]; });
  }

  function safeFilePart(name) {
    var s = asciiLetters(name || 'Employer').replace(/[^A-Za-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 50);
    return s || 'Employer';
  }

  function planFileName(plan) {
    return safeFilePart(plan.employer_name) + '_Section_125_Plan_v1.0.docx';
  }

  function guideFileName(plan) {
    return safeFilePart(plan.employer_name) + '_Section_125_Implementation_Guide_v1.0.docx';
  }

  function pdfFileName(docxName) {
    return String(docxName).replace(/\.docx$/i, '.pdf');
  }


  function buildPlanDocx(plan) {
    return buildDocx(planParagraphs(plan), {
      title: plan.plan_name,
      created: S125Model.GUIDANCE_AS_OF
    });
  }

  function buildGuideDocx(plan) {
    return buildDocx(guideParagraphs(plan), {
      title: 'Section 125 implementation checklist',
      created: S125Model.GUIDANCE_AS_OF
    });
  }

  function plainText(rows) {
    return (rows || []).map(function (row) { return row.text || ''; }).join('\n');
  }

  return {
    FOOTER: FOOTER,
    checklistLines: checklistLines,
    emailChecklistLines: emailChecklistLines,
    planParagraphs: planParagraphs,
    guideParagraphs: guideParagraphs,
    followUpEmailText: followUpEmailText,
    followUpEmailHtml: followUpEmailHtml,
    buildDocx: buildDocx,
    buildPlanDocx: buildPlanDocx,
    buildGuideDocx: buildGuideDocx,
    planFileName: planFileName,
    guideFileName: guideFileName,
    pdfFileName: pdfFileName,
    plainText: plainText,
    zipStore: zipStore
  };
})();

/**
 * DK Benefits Section 125 lead service.
 * Container-bound to a spreadsheet named DK Benefits Section 125 Leads.
 * Do not paste this into the Section 128 script or the quote-tool script.
 *
 * Paste section125/apps-script/S125Combined.gs as the only script file,
 * or paste s125-model.js, s125-terms.js, s125-docgen.js, and this file.
 *
 * Deploy as a web app: Execute as Me (dan@dkbenefits.net), Who has access: Anyone.
 * Run setupSection125 once from the editor.
 */
var S125_NOTIFY_EMAIL = 'dan@dkbenefits.net';
var S125_SUBMISSIONS_SHEET = 'Submissions';
var S125_EVENTS_SHEET = 'Events';
var S125_FOLLOWUPS_SHEET = 'FollowUps';
var S125_VISITOR_HOURLY_LIMIT = 3;
var S125_DAILY_LEAD_CAP = 50;
var S125_MIN_ELAPSED_MS = 3000;
var S125_PENDING_STALE_MS = 45000;
var S125_MAX_FILE_BYTES = 1500000;
var S125_MAX_FILES = 8;
var S125_DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
var S125_PDF_MIME = 'application/pdf';
var S125_FOLLOWUP_DELAY_MS = 10 * 60 * 1000;
var S125_FOLLOWUP_HANDLER = 's125SendDueFollowUps';
var SECTION128_URL = 'https://www.dkbenefits.net/section-128-tool';
var RATES_URL = 'https://www.dkbenefits.net/instant-group-quote';

var S125_FOLLOWUP_HEADERS = [
  'timestamp', 'email', 'name', 'company', 'plan_json', 'status', 'test', 'submission_id', 'error', 'sent_at'
];
var S125_SUBMISSION_HEADERS = [
  'timestamp', 'submission_id', 'status', 'test', 'company', 'state', 'contact_name',
  'contact_email', 'contact_phone', 'employees', 'benefits', 'effective_date',
  'page_url', 'template_version', 'lead_emailed', 'visitor_emailed', 'error', 'payload_json',
  'terms_version', 'terms_accepted_at'
];
var S125_EVENT_HEADERS = ['timestamp', 'kind', 'submission_id', 'detail'];

function doGet() {
  return ContentService
    .createTextOutput('DK Benefits Section 125 lead service is deployed. Submit the form to deliver a lead.')
    .setMimeType(ContentService.MimeType.TEXT);
}

function doPost(e) {
  var payload;
  try {
    payload = JSON.parse((e && e.postData && e.postData.contents) || '{}');
  } catch (err) {
    return s125Json_({ ok: false, error: 'The submission could not be read.' });
  }
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return s125Json_({ ok: false, error: 'The submission could not be read.' });
  }
  if (payload.event !== 's125_submission') {
    return s125Json_({ ok: false, error: 'Unrecognized submission.' });
  }
  try {
    return s125Json_(s125Handle_(payload));
  } catch (err) {
    try { s125LogEvent_('failed', payload.submissionId || '', err && err.message ? err.message : 'failed'); } catch (ignore) {}
    return s125Json_({ ok: false, error: 'The sample could not be sent.' });
  }
}

function setupSection125() {
  s125Sheet_(S125_SUBMISSIONS_SHEET, S125_SUBMISSION_HEADERS);
  s125Sheet_(S125_EVENTS_SHEET, S125_EVENT_HEADERS);
  s125Sheet_(S125_FOLLOWUPS_SHEET, S125_FOLLOWUP_HEADERS);
  setupFollowUpTrigger();
}

function setupFollowUpTrigger() {
  var triggers = ScriptApp.getProjectTriggers();
  for (var i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === S125_FOLLOWUP_HANDLER) return;
  }
  ScriptApp.newTrigger(S125_FOLLOWUP_HANDLER).timeBased().everyMinutes(5).create();
}

function s125EnsureFollowUpTrigger_() {
  try { setupFollowUpTrigger(); } catch (err) {}
}

function s125Handle_(payload) {
  if (payload.hp) {
    s125LogEvent_('rejected_honeypot', payload.submissionId || '', 'honeypot');
    return { ok: false, error: 'The sample could not be sent.' };
  }
  var started = Date.parse(payload.startedAt || '');
  var submitted = Date.parse(payload.submittedAt || '') || s125Now_();
  if (!started || submitted - started < S125_MIN_ELAPSED_MS) {
    s125LogEvent_('rejected_fast', payload.submissionId || '', 'too fast');
    return { ok: false, error: 'The sample could not be sent.' };
  }
  if (!payload.submissionId || String(payload.submissionId).length < 8 || String(payload.submissionId).length > 80) {
    return { ok: false, error: 'The submission id is missing.' };
  }
  var ack = payload.acknowledgement || {};
  if (ack.accepted !== true || !ack.acceptedAt || !Date.parse(ack.acceptedAt) || ack.termsVersion !== S125Terms.VERSION) {
    s125LogEvent_('rejected_terms', payload.submissionId, 'terms');
    return { ok: false, error: 'The terms acknowledgement is missing.' };
  }
  var checked = S125Model.validateSubmission(payload, { asOf: s125Today_() });
  if (!checked.ok) {
    s125LogEvent_('rejected_validation', payload.submissionId, checked.errors.map(function (item) { return item.field; }).join(','));
    return { ok: false, error: checked.errors[0] ? checked.errors[0].message : 'Check the form and try again.' };
  }

  s125EnsureFollowUpTrigger_();
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  var existing;
  try {
    existing = s125FindSubmission_(String(payload.submissionId));
    if (existing && existing.leadEmailed) {
      return {
        ok: true,
        duplicate: true,
        leadEmailed: true,
        visitorEmailed: false,
        followUpQueued: s125AppendFollowUp_(payload, checked)
      };
    }
    if (existing && existing.status === 'pending' && !existing.leadEmailed) {
      var age = s125Now_() - Date.parse(existing.timestamp || '');
      if (!isNaN(age) && age >= 0 && age < S125_PENDING_STALE_MS) {
        return { ok: false, error: 'This submission is already being sent. Wait a moment and retry.' };
      }
    }
    if (s125CountLeadsToday_(String(payload.submissionId)) >= S125_DAILY_LEAD_CAP) {
      s125LogEvent_('rejected_daily_cap', payload.submissionId, 'cap');
      return { ok: false, error: 'The daily email limit has been reached. Questions about DK Benefits’ services? 407-476-5076 · dan@dkbenefits.net' };
    }
    s125UpsertSubmission_(existing, payload, checked, 'pending', '', false, false);
  } finally {
    lock.releaseLock();
  }

  var files;
  try {
    files = s125AttachmentFiles_(payload, checked.plan);
  } catch (buildErr) {
    s125Mark_(String(payload.submissionId), 'failed', buildErr.message || 'document error', false, false);
    return { ok: false, error: 'The sample could not be prepared for email.' };
  }
  var quota = 0;
  try { quota = MailApp.getRemainingDailyQuota(); } catch (ignoreQuota) { quota = 0; }
  if (quota < 1) {
    s125Mark_(String(payload.submissionId), 'failed', 'mail quota', false, false);
    return { ok: false, error: 'Email delivery is temporarily unavailable.' };
  }
  try {
    MailApp.sendEmail(s125LeadMessage_(payload, checked, files));
  } catch (mailErr) {
    s125Mark_(String(payload.submissionId), 'failed', mailErr.message || 'mail failed', false, false);
    return { ok: false, error: 'The request could not be sent.' };
  }

  var followQueued = false;
  if (payload.sendVisitorCopy !== false) {
    var queueLock = LockService.getScriptLock();
    queueLock.waitLock(20000);
    try { followQueued = s125AppendFollowUp_(payload, checked); } catch (queueErr) { followQueued = false; }
    finally { queueLock.releaseLock(); }
  }
  s125Mark_(String(payload.submissionId), 'sent', '', true, false);
  s125LogEvent_('sent', payload.submissionId, 'dan' + (followQueued ? '+queued' : ''));
  return { ok: true, leadEmailed: true, visitorEmailed: false, followUpQueued: followQueued, duplicate: false };
}

function s125AttachmentFiles_(payload, plan) {
  var accepted = [];
  var sawDocx = false;
  var incoming = payload.files || [];
  for (var i = 0; i < incoming.length && accepted.length < S125_MAX_FILES; i++) {
    var file = s125CheckedFile_(incoming[i]);
    if (!file) continue;
    if (file.mime === S125_DOCX_MIME) sawDocx = true;
    accepted.push(file.blob);
  }
  if (!sawDocx) {
    accepted.unshift(s125BytesBlob_(S125Docgen.buildPlanDocx(plan), S125_DOCX_MIME, S125Docgen.planFileName(plan)));
    if (accepted.length < S125_MAX_FILES) {
      accepted.push(s125BytesBlob_(S125Docgen.buildGuideDocx(plan), S125_DOCX_MIME, S125Docgen.guideFileName(plan)));
    }
  }
  return accepted.slice(0, S125_MAX_FILES);
}

function s125CheckedFile_(file) {
  if (!file || typeof file !== 'object') return null;
  var mime = String(file.mime || '');
  if (mime !== S125_DOCX_MIME && mime !== S125_PDF_MIME) return null;
  var raw = String(file.dataBase64 || '').replace(/\s+/g, '');
  if (!raw || raw.length > Math.ceil(S125_MAX_FILE_BYTES * 4 / 3) + 16) return null;
  var bytes;
  try { bytes = Utilities.base64Decode(raw); } catch (err) { return null; }
  if (!bytes || !bytes.length || bytes.length > S125_MAX_FILE_BYTES) return null;
  if (mime === S125_PDF_MIME) {
    if (bytes[0] !== 0x25 || bytes[1] !== 0x50 || bytes[2] !== 0x44 || bytes[3] !== 0x46) return null;
  } else if (bytes[0] !== 0x50 || bytes[1] !== 0x4B) return null;
  var ext = mime === S125_PDF_MIME ? '.pdf' : '.docx';
  var name = String(file.name || 'Section125').replace(/[^A-Za-z0-9._-]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 80);
  if (!name) name = 'Section125';
  if (!new RegExp(ext + '$', 'i').test(name)) name += ext;
  return { mime: mime, blob: s125BytesBlob_(bytes, mime, name) };
}

function s125BytesBlob_(bytes, mime, name) {
  var data = [];
  for (var i = 0; i < bytes.length; i++) data.push(bytes[i]);
  return Utilities.newBlob(data, mime, name);
}

function s125LeadMessage_(payload, checked, files) {
  var plan = checked.plan;
  var lead = checked.lead;
  var bits = [];
  if (payload.test) bits.push('[TEST]');
  bits.push('New Section 125 Lead: ' + plan.employer_name);
  var lines = [
    'Section 125 cafeteria plan — sample lead',
    'Template: ' + (payload.templateVersion || S125Model.TEMPLATE_VERSION),
    'Submission id: ' + payload.submissionId,
    'Source page: ' + (payload.pageUrl || ''),
    '',
    'Company: ' + plan.employer_name,
    'EIN: ' + plan.employer_ein,
    'Address: ' + plan.employer_address,
    'Entity: ' + plan.entity_type + (plan.llc_tax ? ' / ' + plan.llc_tax : ''),
    'Benefits: ' + (plan.benefits || []).join(', '),
    'Effective date: ' + plan.effective_date,
    'Contact: ' + lead.contact_name + ' <' + lead.contact_email + '> ' + lead.contact_phone,
    '',
    'Terms version: ' + ((payload.acknowledgement && payload.acknowledgement.termsVersion) || ''),
    'Accepted at: ' + ((payload.acknowledgement && payload.acknowledgement.acceptedAt) || ''),
    '',
    'The attached files are sample drafts. They are not adopted until the employer signs them. They are not stored on a public link.'
  ];
  return {
    to: S125_NOTIFY_EMAIL,
    subject: bits.join(' '),
    body: lines.join('\n'),
    name: 'DK Benefits LLC',
    attachments: files
  };
}

function s125FollowUpPlan_(plan) {
  return {
    employer_name: plan.employer_name,
    effective_date: plan.effective_date,
    benefits: plan.benefits || [],
    health_fsa_unused: plan.health_fsa_unused || '',
    dcap_unused: plan.dcap_unused || '',
    owner_rule: plan.owner_rule || ''
  };
}

function s125AppendFollowUp_(payload, checked) {
  if (payload.sendVisitorCopy === false) return false;
  var email = checked.lead && checked.lead.contact_email;
  if (!email) return false;
  var sheet = s125Sheet_(S125_FOLLOWUPS_SHEET, S125_FOLLOWUP_HEADERS);
  var values = sheet.getDataRange().getValues();
  var id = String(payload.submissionId);
  for (var i = 1; i < values.length; i++) {
    if (String(values[i][7]) === id) return true;
  }
  sheet.appendRow([
    new Date(s125Now_()).toISOString(),
    email,
    checked.lead.contact_name || '',
    checked.plan.employer_name || '',
    JSON.stringify(s125FollowUpPlan_(checked.plan)),
    'pending',
    payload.test ? 'yes' : 'no',
    id,
    '',
    ''
  ]);
  return true;
}

function s125FollowUpMessage_(row) {
  var plan = {};
  try { plan = JSON.parse(String(row[4] || '{}')); } catch (err) { plan = {}; }
  var subject = 'Thanks for using my Section 125 tool!';
  if (String(row[6]) === 'yes') subject = '[TEST] ' + subject;
  var links = { section128Url: SECTION128_URL, ratesUrl: RATES_URL };
  var lead = { contact_name: String(row[2] || '') };
  return {
    to: String(row[1] || ''),
    subject: subject,
    body: S125Docgen.followUpEmailText(plan, lead, links),
    htmlBody: S125Docgen.followUpEmailHtml(plan, lead, links),
    name: 'Daniel Kirves',
    replyTo: S125_NOTIFY_EMAIL
  };
}

function s125FollowUpSentToday_(values, email) {
  var day = s125Today_();
  var target = String(email || '').toLowerCase();
  for (var i = 1; i < values.length; i++) {
    if (String(values[i][1] || '').toLowerCase() !== target) continue;
    if (String(values[i][5]) !== 'sent') continue;
    if (String(values[i][9] || '').slice(0, 10) === day) return true;
  }
  return false;
}

function s125SendDueFollowUps() {
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    var sheet = s125Sheet_(S125_FOLLOWUPS_SHEET, S125_FOLLOWUP_HEADERS);
    var values = sheet.getDataRange().getValues();
    var now = s125Now_();
    for (var i = 1; i < values.length; i++) {
      if (String(values[i][5]) !== 'pending') continue;
      var ts = Date.parse(String(values[i][0] || ''));
      if (isNaN(ts) || now - ts < S125_FOLLOWUP_DELAY_MS) continue;
      var email = String(values[i][1] || '');
      var rowNumber = i + 1;
      if (s125FollowUpSentToday_(values, email)) {
        sheet.getRange(rowNumber, 6).setValue('skipped');
        sheet.getRange(rowNumber, 9).setValue('already sent today');
        values[i][5] = 'skipped';
        continue;
      }
      if (!s125VisitorAllowed_(email)) {
        sheet.getRange(rowNumber, 6).setValue('skipped');
        sheet.getRange(rowNumber, 9).setValue('hourly limit');
        values[i][5] = 'skipped';
        continue;
      }
      try {
        var message = s125FollowUpMessage_(values[i]);
        if (message.attachments) delete message.attachments;
        MailApp.sendEmail(message);
        var sentAt = new Date(s125Now_()).toISOString();
        sheet.getRange(rowNumber, 6).setValue('sent');
        sheet.getRange(rowNumber, 9).setValue('');
        sheet.getRange(rowNumber, 10).setValue(sentAt);
        values[i][5] = 'sent';
        values[i][9] = sentAt;
      } catch (err) {
        sheet.getRange(rowNumber, 6).setValue('failed');
        sheet.getRange(rowNumber, 9).setValue(err && err.message ? String(err.message).slice(0, 300) : 'mail failed');
        values[i][5] = 'failed';
      }
    }
  } finally {
    lock.releaseLock();
  }
}

function s125Now_() {
  if (typeof S125_TEST_NOW === 'number' && isFinite(S125_TEST_NOW)) return S125_TEST_NOW;
  return Date.now();
}
function s125Today_() {
  var dt = new Date(s125Now_());
  var m = dt.getUTCMonth() + 1;
  var d = dt.getUTCDate();
  return dt.getUTCFullYear() + '-' + (m < 10 ? '0' : '') + m + '-' + (d < 10 ? '0' : '') + d;
}
function s125Json_(body) {
  return ContentService.createTextOutput(JSON.stringify(body)).setMimeType(ContentService.MimeType.JSON);
}
function s125VisitorAllowed_(email) {
  var cache = CacheService.getScriptCache();
  var key = 's125v:' + String(email || '').toLowerCase();
  var count = Number(cache.get(key) || '0');
  if (count >= S125_VISITOR_HOURLY_LIMIT) return false;
  cache.put(key, String(count + 1), 3600);
  return true;
}
function s125Sheet_(name, headers) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
    sheet.appendRow(headers);
    return sheet;
  }
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(headers);
    return sheet;
  }
  var width = Math.max(sheet.getLastColumn(), headers.length);
  var current = sheet.getRange(1, 1, 1, width).getValues()[0];
  var changed = false;
  for (var i = 0; i < headers.length; i++) {
    if (!current[i]) { current[i] = headers[i]; changed = true; }
  }
  if (changed) sheet.getRange(1, 1, 1, headers.length).setValues([current.slice(0, headers.length)]);
  return sheet;
}
function s125FindSubmission_(id) {
  var sheet = s125Sheet_(S125_SUBMISSIONS_SHEET, S125_SUBMISSION_HEADERS);
  var values = sheet.getDataRange().getValues();
  for (var i = 1; i < values.length; i++) {
    if (String(values[i][1]) === id) {
      return { row: i + 1, timestamp: values[i][0], status: values[i][2], leadEmailed: values[i][14] === true || values[i][14] === 'yes' };
    }
  }
  return null;
}
function s125CountLeadsToday_(exceptId) {
  var sheet = s125Sheet_(S125_SUBMISSIONS_SHEET, S125_SUBMISSION_HEADERS);
  var values = sheet.getDataRange().getValues();
  var day = s125Today_();
  var count = 0;
  for (var i = 1; i < values.length; i++) {
    if (String(values[i][1]) === exceptId) continue;
    if (values[i][14] !== true && values[i][14] !== 'yes') continue;
    if (String(values[i][0] || '').slice(0, 10) === day) count++;
  }
  return count;
}
function s125UpsertSubmission_(existing, payload, checked, status, error, leadEmailed, visitorEmailed) {
  var sheet = s125Sheet_(S125_SUBMISSIONS_SHEET, S125_SUBMISSION_HEADERS);
  var plan = checked.plan;
  var lead = checked.lead;
  var stored = Object.assign({}, payload);
  delete stored.files;
  var row = [
    new Date(s125Now_()).toISOString(),
    String(payload.submissionId),
    status,
    payload.test ? 'yes' : 'no',
    plan.employer_name,
    plan.state,
    lead.contact_name,
    lead.contact_email,
    lead.contact_phone,
    plan.employee_count,
    (plan.benefits || []).join(', '),
    plan.effective_date,
    payload.pageUrl || '',
    payload.templateVersion || S125Model.TEMPLATE_VERSION,
    leadEmailed ? 'yes' : 'no',
    visitorEmailed ? 'yes' : 'no',
    error || '',
    JSON.stringify(stored).slice(0, 40000),
    (payload.acknowledgement && payload.acknowledgement.termsVersion) || '',
    (payload.acknowledgement && payload.acknowledgement.acceptedAt) || ''
  ];
  if (existing) sheet.getRange(existing.row, 1, 1, row.length).setValues([row]);
  else sheet.appendRow(row);
}
function s125Mark_(id, status, error, leadEmailed, visitorEmailed) {
  var existing = s125FindSubmission_(id);
  if (!existing) return;
  var sheet = s125Sheet_(S125_SUBMISSIONS_SHEET, S125_SUBMISSION_HEADERS);
  sheet.getRange(existing.row, 3).setValue(status);
  sheet.getRange(existing.row, 15).setValue(leadEmailed ? 'yes' : 'no');
  sheet.getRange(existing.row, 16).setValue(visitorEmailed ? 'yes' : 'no');
  sheet.getRange(existing.row, 17).setValue(error || '');
}
function s125LogEvent_(kind, id, detail) {
  var sheet = s125Sheet_(S125_EVENTS_SHEET, S125_EVENT_HEADERS);
  sheet.appendRow([new Date(s125Now_()).toISOString(), kind, id || '', detail || '']);
}
