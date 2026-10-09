/**
 * DK Benefits Section 125 — combined Apps Script.
 * Paste this file as the only script in a NEW project bound to the spreadsheet
 * "DK Benefits Section 125 Leads".
 * Do not paste it into the Section 128 project or the quote-tool project.
 * Order: s125-model.js, s125-terms.js, s125-docgen.js, apps-script/Code.gs.
 * Generated from those files. Do not edit by hand.
 * Template s125-v1.0-2026-10-10. Terms s125-terms-2026-10-10.
 */
/**
 * Section 125 sample plan rules.
 * Dollar figures follow IR-2025-103 / Rev. Proc. 2025-32 and the OBBBA change to §129.
 * Draft for the employer's own advisors. Not legal advice.
 */
var S125Model = (function () {
  var TEMPLATE_VERSION = 's125-v1.0-2026-10-10';
  var GUIDANCE_AS_OF = '2026-10-09';
  var HEALTH_FSA_LIMIT_2026 = 3400;
  var CARRYOVER_FROM_2026 = 680;
  var CARRYOVER_INTO_2026 = 660;
  var DCAP_LIMIT_2026 = 7500;
  var DCAP_MFS_2026 = 3750;

  var US_STATES = ['AL','AK','AZ','AR','CA','CO','CT','DE','DC','FL','GA','HI','ID','IL','IN','IA','KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ','NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT','VA','WA','WV','WI','WY'];
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
  function phoneDigits(raw) {
    var d = digits(raw);
    if (d.charAt(0) === '1' && d.length > 10) d = d.slice(1);
    return d.slice(0, 16);
  }
  function formatPhoneLive(raw) {
    var d = phoneDigits(raw);
    if (!d) return '';
    var main = d.slice(0, Math.min(10, d.length));
    var ext = d.length > 10 ? d.slice(10) : '';
    var out;
    if (main.length < 4) out = main;
    else if (main.length < 7) out = main.slice(0, 3) + '-' + main.slice(3);
    else out = main.slice(0, 3) + '-' + main.slice(3, 6) + '-' + main.slice(6);
    if (ext) out += ' ext. ' + ext;
    return out;
  }
  function formatZipLive(raw) {
    var d = digits(raw).slice(0, 9);
    if (d.length <= 5) return d;
    return d.slice(0, 5) + '-' + d.slice(5);
  }
  function formatDateLive(raw) {
    var text = String(raw || '').replace(/[^\d/]/g, '');
    var parts = text.split('/');
    if (parts.length === 1) {
      var d = parts[0].slice(0, 8);
      if (d.length <= 2) return d;
      if (d.length <= 4) return d.slice(0, 2) + '/' + d.slice(2);
      return d.slice(0, 2) + '/' + d.slice(2, 4) + '/' + d.slice(4);
    }
    var month = parts[0].slice(0, 2);
    var day = (parts[1] || '').slice(0, 2);
    var year = (parts[2] || '').slice(0, 4);
    if (parts.length > 2 && year.length === 4) {
      if (month.length === 1) month = '0' + month;
      if (day.length === 1) day = '0' + day;
    }
    var out = month;
    if (text.indexOf('/') !== -1) out += '/' + day;
    if (parts.length > 2) out += '/' + year;
    return out;
  }
  function formatMonthYearLive(raw) {
    var text = String(raw || '').replace(/[^\d/]/g, '');
    var parts = text.split('/');
    if (parts.length === 1) {
      var d = parts[0].slice(0, 6);
      if (d.length <= 2) return d;
      return d.slice(0, 2) + '/' + d.slice(2);
    }
    var month = parts[0].slice(0, 2);
    var year = (parts[1] || '').slice(0, 4);
    if (year.length === 4 && month.length === 1) month = '0' + month;
    return month + '/' + year;
  }
  function parseUserDate(raw) {
    var iso = parseIso(raw);
    if (iso) return iso;
    var m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(clean(raw));
    if (!m) return null;
    var month = Number(m[1]);
    var day = Number(m[2]);
    var year = Number(m[3]);
    var dt = new Date(year, month - 1, day);
    if (dt.getFullYear() !== year || dt.getMonth() !== month - 1 || dt.getDate() !== day) return null;
    return dt;
  }
  function canonicalMonthYear(raw) {
    var formatted = formatMonthYearLive(raw);
    var m = /^(\d{1,2})\/(\d{4})$/.exec(clean(formatted));
    if (!m) return '';
    var month = Number(m[1]);
    var year = Number(m[2]);
    if (month < 1 || month > 12 || year < 1900 || year > 2100) return '';
    return pad(month) + '/' + String(year);
  }
  function formatDateCanonical(raw) {
    var dt = parseUserDate(raw);
    if (!dt) return formatDateLive(raw);
    return pad(dt.getMonth() + 1) + '/' + pad(dt.getDate()) + '/' + dt.getFullYear();
  }
  function validEmail(value) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value) && value.length <= 120;
  }
  function wholeInRange(raw, min, max) {
    var s = clean(raw).replace(/[$,\s]/g, '');
    if (!/^\d+$/.test(s)) return null;
    var n = Number(s);
    if (!isFinite(n) || n < min || n > max) return null;
    return n;
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
    if (nextStart && oeDays >= 1 && oeDays <= 90 && oeDays === Math.floor(oeDays)) {
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
    var planNumber = wholeInRange(input.plan_number, 501, 999);
    if (planNumber == null) push(errors, 'plan_number', 'Use a whole-number plan number from 501 to 999.');
    if (clean(input.street).length < 2) push(errors, 'street', 'Enter the street address.');
    if (clean(input.city).length < 2) push(errors, 'city', 'Enter the city.');
    if (US_STATES.indexOf(clean(input.state)) === -1) push(errors, 'state', 'Choose a state.');
    var zip = formatZipLive(input.zip);
    if (!/^\d{5}(-\d{4})?$/.test(zip)) push(errors, 'zip', 'Enter a 5-digit ZIP code, or ZIP+4.');
    var phone = phoneDigits(input.phone);
    if (phone.length < 10) push(errors, 'phone', 'Enter a 10-digit phone number.');
    if (!ENTITY[input.entity_type]) push(errors, 'entity_type', 'Choose the entity type.');
    if (input.entity_type === 'llc' && !LLC_TAX[input.llc_tax]) push(errors, 'llc_tax', 'Choose how the LLC is taxed.');

    var eff = parseUserDate(input.effective_date);
    if (eff) input.effective_date = toIso(eff);
    if (!eff) push(errors, 'effective_date', 'Enter the effective date as MM/DD/YYYY.');
    else if (toIso(eff) < asOf) push(errors, 'effective_date', 'Use today or a future date. A cafeteria plan is adopted prospectively.');
    if (input.plan_year_type !== 'calendar' && input.plan_year_type !== 'custom') {
      push(errors, 'plan_year_type', 'Choose a calendar year or a custom plan year.');
    }
    if (input.plan_year_type === 'custom' && !planYearParts(input)) {
      push(errors, 'plan_year_start', 'Choose a start month and a day that exists in that month. February uses the 1st through the 28th.');
    }
    if (input.prior_plan !== 'yes' && input.prior_plan !== 'no') push(errors, 'prior_plan', 'Say whether a Section 125 plan is already in place.');
    var adoption = '';
    if (input.prior_plan === 'yes') {
      adoption = canonicalMonthYear(input.prior_adoption);
      if (!adoption) push(errors, 'prior_adoption', 'Enter the original adoption month and year, like 01/2020.');
      input.prior_adoption = adoption;
    }
    var oe = wholeInRange(input.oe_window_days, 1, 90);
    if (oe == null) push(errors, 'oe_window_days', 'Enter the open enrollment window as a whole number of days from 1 to 90.');
    var hire = wholeInRange(input.new_hire_window, 1, 30);
    if (hire == null) push(errors, 'new_hire_window', 'Enter the new-hire window as a whole number of days from 1 to 30.');

    var count = wholeInRange(input.employee_count, 1, 100000);
    if (count == null) push(errors, 'employee_count', 'Enter the employee count as a whole number from 1 to 100,000.');
    if (['insured', 'level', 'self'].indexOf(input.funding_type) === -1) push(errors, 'funding_type', 'Choose how the medical plan is funded.');
    var hours = wholeInRange(input.full_time_hours, 1, 40);
    if (hours == null) push(errors, 'full_time_hours', 'Enter full-time hours as a whole number from 1 to 40.');
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
    if (!validEmail(email)) push(errors, 'signer_email', 'Enter a valid email address.');

    var derived = derive(input, asOf);
    var plan = {
      template_version: TEMPLATE_VERSION,
      employer_name: name,
      employer_ein: ein,
      plan_number: planNumber == null ? '' : String(planNumber),
      plan_name: name ? (name + ' Section 125 Cafeteria Plan') : '',
      street: clean(input.street),
      city: clean(input.city),
      state: clean(input.state),
      zip: /^\d{5}(-\d{4})?$/.test(zip) ? zip : clean(input.zip),
      employer_address: [clean(input.street), clean(input.city), clean(input.state), clean(input.zip)].filter(Boolean).join(', ').replace(/, ([A-Z]{2}), /, ', $1 '),
      phone: phone.length >= 10 ? formatPhoneLive(phone) : clean(input.phone),
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
      prior_adoption: derived.prior_plan ? adoption : '',
      plan_year_change: derived.plan_year_change,
      on_plan_year_start: derived.on_plan_year_start,
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
    if (step === 1) return ['employer_name', 'employer_ein', 'plan_number', 'street', 'city', 'state', 'zip', 'phone', 'funding_type', 'multi_state'];
    if (step === 2) return ['effective_date', 'plan_year_type', 'plan_year_start', 'prior_plan', 'prior_adoption', 'oe_window_days', 'new_hire_window'];
    if (step === 3) return ['entity_type', 'llc_tax', 'employee_count', 'full_time_hours', 'waiting_period', 'eligible_classes', 'eligible_class_other'];
    if (step === 4) return ['benefits', 'health_fsa_design', 'health_fsa_unused', 'dcap_unused'];
    return ['signer_name', 'signer_title', 'signer_email'];
  }

  function stateName(code) {
    return STATE_NAMES[code] || clean(code);
  }

  function entitySentence(plan) {
    var state = stateName(plan.state);
    var article = /^[AEIO]/.test(state) ? 'an' : 'a';
    var place = article + ' ' + state;
    if (plan.entity_type === 'c-corp') return place + ' corporation';
    if (plan.entity_type === 's-corp') return place + ' corporation that has elected to be taxed as an S corporation';
    if (plan.entity_type === 'partnership') return place + ' partnership';
    if (plan.entity_type === 'sole-prop') return place + ' sole proprietorship';
    if (plan.entity_type === 'nonprofit') return place + ' nonprofit organization';
    if (plan.entity_type === 'llc') {
      if (plan.llc_tax === 's-corp') return place + ' limited liability company taxed as an S corporation';
      if (plan.llc_tax === 'c-corp') return place + ' limited liability company taxed as a C corporation';
      if (plan.llc_tax === 'partnership') return place + ' limited liability company taxed as a partnership';
      if (plan.llc_tax === 'disregarded') return place + ' limited liability company disregarded as separate from its owner';
      return place + ' limited liability company';
    }
    return place + ' employer';
  }

  function waitingText(code) { return WAITING[code] || ''; }
  function benefitLabel(code) { return BENEFIT_LABEL[code] || code; }

  function entityLabel(plan) {
    plan = plan || {};
    if (plan.entity_type === 'llc') {
      if (plan.llc_tax === 's-corp') return 'Limited liability company taxed as an S corporation';
      if (plan.llc_tax === 'c-corp') return 'Limited liability company taxed as a C corporation';
      if (plan.llc_tax === 'partnership') return 'Limited liability company taxed as a partnership';
      if (plan.llc_tax === 'disregarded') return 'Limited liability company disregarded as separate from its owner';
      return 'Limited liability company';
    }
    return ENTITY[plan.entity_type] || '';
  }

  function fundingLabel(code) {
    if (code === 'insured') return 'Fully insured';
    if (code === 'level') return 'Level funded';
    if (code === 'self') return 'Self-funded';
    return '';
  }

  function healthFsaDesignLabel(code) {
    if (code === 'general') return 'General purpose';
    if (code === 'limited') return 'Limited purpose';
    if (code === 'both') return 'General purpose and limited purpose';
    return '';
  }

  function unusedLabel(code) {
    if (code === 'forfeit') return 'Forfeiture';
    if (code === 'grace') return 'Grace period';
    if (code === 'carryover') return 'Carryover';
    return '';
  }

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

  function shortYearMonths(startIso, endIso) {
    var start = parseIso(startIso);
    var end = parseIso(endIso);
    if (!start || !end || end < start) return 0;
    var count = 0;
    var y = start.getFullYear();
    var m = start.getMonth() + 1;
    var endY = end.getFullYear();
    var endM = end.getMonth() + 1;
    while (y < endY || (y === endY && m <= endM)) {
      var dim = new Date(y, m, 0).getDate();
      var monthEnd = new Date(y, m - 1, dim);
      var partialStart = y === start.getFullYear() && m === start.getMonth() + 1 && start.getDate() !== 1;
      if (!partialStart && monthEnd <= end) count++;
      m += 1;
      if (m > 12) { m = 1; y += 1; }
    }
    return count;
  }

  function dayBeforeIso(iso) {
    var dt = parseIso(iso);
    if (!dt) return '';
    return toIso(addDays(dt, -1));
  }

  function daysUntil(iso, asOf) {
    var target = parseIso(iso);
    var from = parseIso(asOf);
    if (!target || !from) return null;
    return Math.round((target.getTime() - from.getTime()) / 86400000);
  }

  function planYearNote(plan) {
    plan = plan || {};
    if (plan.plan_year_change && plan.on_plan_year_start) {
      return 'This restatement changes the plan year. The plan year in effect before ' + formatLongDate(plan.effective_date) + ' ends on ' + formatLongDate(dayBeforeIso(plan.effective_date)) + ', and that period is a short plan year. Beginning ' + formatLongDate(plan.effective_date) + ', each plan year is ' + planYearSentence(plan) + '.';
    }
    if (plan.short_plan_year && plan.plan_year_change) {
      return 'This restatement changes the plan year. The short plan year begins ' + formatLongDate(plan.effective_date) + ' and ends ' + formatLongDate(plan.short_plan_year_end) + '. Each later plan year is ' + planYearSentence(plan) + '.';
    }
    if (plan.short_plan_year) {
      return 'This is a short first plan year, from ' + formatLongDate(plan.effective_date) + ' through ' + formatLongDate(plan.short_plan_year_end) + '.';
    }
    if (plan.prior_plan && !plan.plan_year_change) return 'This restatement continues the existing plan year.';
    return '';
  }

  function stepTwoNotices(plan, asOf) {
    plan = plan || {};
    var notes = [];
    if (plan.short_plan_year && shortYearMonths(plan.effective_date, plan.short_plan_year_end) === 0) {
      notes.push('The first plan year is less than a month. Consider an effective date on the plan-year start.');
    }
    var days = daysUntil(plan.effective_date, asOf || todayIso());
    if (days != null && days >= 0 && days < 14) {
      notes.push('Leave time to sign the plan and enroll employees before this date.');
    }
    return notes;
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
    formatZipLive: formatZipLive,
    formatDateLive: formatDateLive,
    formatDateCanonical: formatDateCanonical,
    formatMonthYearLive: formatMonthYearLive,
    canonicalMonthYear: canonicalMonthYear,
    validEmail: validEmail,
    formatLongDate: formatLongDate,
    formatMoney: formatMoney,
    todayIso: todayIso,
    stateName: stateName,
    entitySentence: entitySentence,
    entityLabel: entityLabel,
    fundingLabel: fundingLabel,
    healthFsaDesignLabel: healthFsaDesignLabel,
    unusedLabel: unusedLabel,
    waitingText: waitingText,
    benefitLabel: benefitLabel,
    classSentence: classSentence,
    planYearSentence: planYearSentence,
    shortYearMonths: shortYearMonths,
    dayBeforeIso: dayBeforeIso,
    planYearNote: planYearNote,
    stepTwoNotices: stepTwoNotices,
    ownerRule: ownerRule
  };
})();

/**
 * Educational-tool terms. Version s125-terms-2026-10-10.
 * Draft wording for DK Benefits LLC's own attorney to review before go-live.
 * Not itself legal advice.
 */
var S125Terms = (function () {
  var VERSION = 's125-terms-2026-10-10';
  var AS_OF = 'October 9, 2026';

  var PARAGRAPHS = [
    'DK Benefits LLC provides this Section 125 cafeteria plan tool as an educational resource to help employers. It produces a sample template only.',
    'The tool and the documents are not legal advice, tax advice, accounting advice, or ERISA advice. Using the tool, downloading a document, or asking DK Benefits LLC for a copy does not create an attorney-client relationship, a tax-advisor relationship, or any other advisory relationship.',
    'DK Benefits LLC and Daniel Kirves do not review, approve, or verify the documents or the information the employer enters. The employer is solely responsible for the accuracy of that information, for deciding whether to adopt a plan, for customizing the documents, for adoption and implementation, and for ongoing compliance and operation.',
    'Consult your own attorney, tax advisor, and third-party administrator before adopting or operating a cafeteria plan. This sample reflects publicly available rules as of ' + AS_OF + ', including the 2007 proposed cafeteria plan regulations (which taxpayers may rely on), IRC §§105, 125, 129, 1372, and 223, and IRS notices and revenue rulings cited in the research record. Law and guidance may change. Dollar limits change by year.',
    'The documents are a sample draft for the employer’s review with its own advisors. They are not adopted until the employer signs them. The signature line and the date line are left blank. Generating or downloading a file does not adopt a plan.',
    'The tool and the documents are free. The employer can download the documents on the final screen at no charge. The documents are not emailed to the employer. When the documents are created, the employer’s answers and a copy of the documents are sent to DK Benefits LLC. If the employer needs a copy later, it may contact DK Benefits LLC at 407-476-5076 or dan@dkbenefits.net. DK Benefits LLC will try to provide one but does not guarantee that a copy is kept or can be retrieved.',
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

  function h1(text) { return row('Heading1', text, { keepNext: true, keepLines: true }); }
  function h2(text) { return row('Heading2', text, { keepNext: true, keepLines: true }); }
  function money(amount) { return S125Model.formatMoney(amount); }

  function ownerParagraph(plan) {
    if (plan.owner_rule === 's-corp') {
      return 'Employee does not include a 2-percent shareholder of the Employer within the meaning of Code §1372(b). A 2-percent shareholder is a person who owns more than 2 percent of the outstanding stock or of the total combined voting power on any day of the S corporation’s year, including stock treated as owned under Code §318. Attribution under §318(a)(1) includes stock owned by a spouse, child, grandchild, or parent. It does not include stock owned only by a sibling. Such a person may not make pre-tax contributions under this Plan. This rule applies to an S corporation and to an LLC that has elected to be taxed as an S corporation.';
    }
    if (plan.owner_rule === 'self-employed') {
      return 'Employee does not include a self-employed individual within the meaning of Code §401(c), including a partner, a member of an LLC taxed as a partnership, a member of an LLC that is a disregarded entity, and a sole proprietor. Those individuals may not make pre-tax contributions under this Plan.';
    }
    return 'A common-law employee of a C corporation or a nonprofit may participate, including an owner who is a common-law employee. Partners, sole proprietors, and more-than-2-percent S corporation shareholders are not employees for Code §125 when those rules apply to the employer.';
  }

  function joinList(items) {
    if (items.length <= 1) return items[0] || '';
    if (items.length === 2) return items[0] + ' and ' + items[1];
    return items.slice(0, -1).join(', ') + ', and ' + items[items.length - 1];
  }

  function benefitSections(plan) {
    var rows = [];
    var premiums = ['medical', 'dental', 'vision'].filter(function (code) { return has(plan, code); });
    if (premiums.length) {
      var names = premiums.map(function (code) { return S125Model.benefitLabel(code).toLowerCase(); });
      rows.push(h2('Premium payment benefits'));
      rows.push(row(null, 'A Participant may pay, on a pre-tax basis, the Employee’s share of the premium for the group ' + joinList(names) + ' coverage the Employer maintains. The contract for each coverage describes the benefits, the exclusions, and how a claim is paid. Electing one of these coverages does not elect the others.'));
      var bodies = {
        medical: 'Medical coverage under this Plan is the Employer’s group medical contract, and it is an accident and health benefit. The salary reduction equals the Employee’s share of the premium for the coverage tier the Participant elects. If the insurer changes that share during the plan year, the reduction changes with it, and the rate change alone does not require a new election. The Employer may pay any remaining share of the medical premium outside this Plan.',
        dental: 'Dental coverage under this Plan is the Employer’s group dental contract. The services that contract covers are the dental services the Participant may receive. The salary reduction equals the Employee’s share of the dental premium for the tier elected. Waiving dental coverage leaves any medical election and any vision election in place.',
        vision: 'Vision coverage under this Plan is the Employer’s group vision contract. The services that contract covers are the vision services the Participant may receive. The salary reduction equals the Employee’s share of the vision premium for the tier elected. The vision election is independent of the other premium benefits for the plan year.'
      };
      premiums.forEach(function (code) {
        rows.push(h2(S125Model.benefitLabel(code)));
        rows.push(row(null, bodies[code]));
      });
    }
    if (has(plan, 'health_fsa')) {
      var design = plan.health_fsa_design;
      var what = design === 'limited'
        ? 'The Health FSA is a limited-purpose health FSA. It reimburses dental, vision, and preventive care expenses.'
        : design === 'both'
          ? 'The Employer offers both a general-purpose Health FSA, which reimburses Code §213(d) medical expenses, and a limited-purpose Health FSA, which reimburses dental expenses, vision expenses, and preventive care.'
          : 'The Health FSA reimburses Code §213(d) medical expenses.';
      var unused;
      if (plan.health_fsa_unused === 'grace') {
        unused = 'The Health FSA has a grace period that ends on the 15th day of the third month after the plan year. A Health FSA expense incurred in the grace period may be paid from the amount unused at the end of the prior plan year. Any Health FSA amount still unused when the grace period and the run-out period end is forfeited to the Employer. The Health FSA does not also carry unused amounts into the next plan year.';
      } else if (plan.health_fsa_unused === 'carryover') {
        unused = carryoverSentence(plan);
      } else {
        unused = 'A Health FSA amount still unused when the plan year and the run-out period end is forfeited to the Employer. The Health FSA has neither a grace period nor a carryover.';
      }
      rows.push(h2('Health FSA'));
      rows.push(row(null, what + ' ' + healthFsaLimitSentence(plan)));
      rows.push(row(null, 'Only an Eligible Employee who is eligible for the Employer\'s group major medical plan for the plan year, whether or not the Employee enrolls in it, may elect the Health FSA.'));
      rows.push(row(null, 'The Health FSA is self-insured medical reimbursement. The amount elected for the period of coverage is available on the first day of that coverage, without regard to how much has been withheld from pay by the date of the claim.'));
      rows.push(row(null, 'An expense is incurred when the care is furnished, not when the Participant is billed and not when the Participant pays. Only an expense incurred while Health FSA coverage is in effect may be reimbursed, and only after the Participant substantiates it.'));
      rows.push(row(null, unused));
    }
    if (has(plan, 'dcap')) {
      var dcapUnused = plan.dcap_unused === 'grace'
        ? 'The Dependent Care FSA has a grace period that ends on the 15th day of the third month after the plan year. Any Dependent Care FSA amount still unused when that grace period and the run-out period end is forfeited to the Employer.'
        : 'A Dependent Care FSA amount still unused when the plan year and the run-out period end is forfeited to the Employer.';
      rows.push(h2('Dependent Care FSA'));
      rows.push(row(null, 'A Participant may pay qualifying dependent care assistance on a pre-tax basis under Code §129. For a taxable year beginning in 2026, the exclusion is ' + money(S125Model.DCAP_LIMIT_2026) + ', or ' + money(S125Model.DCAP_MFS_2026) + ' if the Participant is married and files a separate return. The statute sets those amounts. They are not adjusted for inflation. A qualifying individual is determined under Code §§129 and 21.'));
      rows.push(row(null, 'The expenses must be employment-related expenses that §129 treats as qualifying. The exclusion for a year also cannot exceed the Participant’s earned income, or the spouse’s earned income if the Participant is married, except where §129 treats a student or a spouse who is incapable of self-care as having earned income.'));
      rows.push(row(null, 'The Participant identifies the provider and shows the date and the amount before the Employer excludes the payment. The Employer reports the assistance on Form W-2.'));
      rows.push(row(null, dcapUnused + ' The Dependent Care FSA does not have a carryover.'));
    }
    if (has(plan, 'hsa')) {
      var hsa = 'A Participant who is an eligible individual under Code §223 may contribute to a health savings account by pre-tax salary reduction. The Participant may prospectively start, change, or stop that election at least monthly, and no change-in-status event is required. The change applies only to compensation not yet currently available. A Participant who ceases to be an eligible individual may prospectively stop the election. An HSA contribution is nonforfeitable once deposited with the custodian.';
      if (has(plan, 'health_fsa') && plan.health_fsa_design === 'limited') {
        hsa += ' Coverage under the limited-purpose Health FSA does not, by itself, end HSA eligibility.';
      } else if (has(plan, 'health_fsa') && plan.health_fsa_design === 'both') {
        hsa += ' A Participant who contributes to an HSA elects the limited-purpose Health FSA. Coverage under the general-purpose Health FSA, including coverage of a spouse who can be reimbursed from it, ends HSA eligibility for that period.';
      } else if (has(plan, 'health_fsa')) {
        hsa += ' Coverage under the general-purpose Health FSA, including coverage of a spouse who can be reimbursed from it, ends HSA eligibility while that coverage remains in effect.';
      }
      rows.push(h2('Health savings account'));
      rows.push(row(null, hsa));
      rows.push(row(null, 'The Employer forwards each contribution to the custodian the Participant designates, and the custodian holds the account. This Plan does not decide claims for payment from that account.'));
      rows.push(row(null, 'Contributions from all sources for the year stay within the limit Code §223 sets for the Participant’s coverage. This Plan does not write a different annual dollar cap over that statute.'));
    }
    return rows;
  }

  function planParagraphs(plan) {
    var rows = [];
    var state = S125Model.stateName(plan.state);
    var health = has(plan, 'medical') || has(plan, 'dental') || has(plan, 'vision') || has(plan, 'health_fsa') || has(plan, 'hsa');
    rows.push(row('Title', plan.plan_name || 'Section 125 Cafeteria Plan', { keepNext: true, keepLines: true }));
    rows.push({
      table: [
        { label: 'Plan Name', value: plan.plan_name },
        { label: 'Employer', value: plan.employer_name },
        { label: 'EIN', value: plan.employer_ein },
        { label: 'Effective Date', value: S125Model.formatLongDate(plan.effective_date) },
        { label: 'Plan Year', value: S125Model.planYearSentence(plan) },
        { label: 'Plan Number', value: String(plan.plan_number) }
      ]
    });

    rows.push(h1('Article 1. Establishment'));
    rows.push(row(null, plan.employer_name + ', ' + S125Model.entitySentence(plan) + ', adopts this cafeteria plan under Code §125. The Employer’s principal office is ' + plan.employer_address + '.'));
    if (plan.prior_plan) {
      rows.push(row(null, 'This document restates the cafeteria plan originally adopted ' + plan.prior_adoption + '. The restatement is effective ' + S125Model.formatLongDate(plan.effective_date) + '. The Employer adopts it prospectively.'));
    } else {
      rows.push(row(null, 'This Plan is effective ' + S125Model.formatLongDate(plan.effective_date) + '. The Employer adopts it prospectively. Benefits are not provided for a period before the effective date.'));
    }
    var yearSentence = establishmentYearSentence(plan);
    if (yearSentence) rows.push(row(null, yearSentence));
    rows.push(row(null, 'The purpose of this Plan is to let an Eligible Employee choose, before the compensation is currently available, between cash and the qualified benefits in Article 5. The Employer intends the Plan to meet Code §125 and the regulations under it.'));
    rows.push(row(null, 'Where a benefit is also described in a separate contract or account agreement, that document controls the coverage or the account, and this Plan controls the pre-tax election.'));

    rows.push(h1('Article 2. Definitions'));
    rows.push(row(null, 'Employer means ' + plan.employer_name + '.'));
    rows.push(row(null, 'Plan Administrator means the Employer, acting through its authorized officer. The officer who signs this Plan signs for the Employer and is not named personally as the fiduciary.'));
    rows.push(row(null, 'Code means the Internal Revenue Code of 1986, as amended. ERISA means the Employee Retirement Income Security Act of 1974, as amended.'));
    rows.push(row(null, ownerParagraph(plan)));
    rows.push(row(null, 'Eligible Employee means an Employee in an eligible class who has completed the waiting period in Article 3. Full-Time means an Employee regularly scheduled to work at least ' + plan.full_time_hours + ' hours a week. Part-Time means an Employee regularly scheduled to work fewer than ' + plan.full_time_hours + ' hours a week.'));
    rows.push(row(null, 'Dependent means a dependent under Code §152, except that, for an accident or health benefit, Dependent also includes a child as defined in Code §152(f)(1) who has not attained age 27 as of the end of the Participant’s taxable year. The age-27 rule does not determine who is a qualifying individual for dependent care assistance.'));
    rows.push(row(null, 'A highly compensated individual is a person described in Code §125(e): an officer, a shareholder who owns more than 5 percent of the voting power or value of all classes of stock, a highly compensated employee under the compensation test, or a spouse or dependent of any of them.'));
    rows.push(row(null, 'Key employee means a person described in Code §416(i)(1). A Participant is an Eligible Employee who has a salary-reduction election in effect, or who is treated as having elected cash.'));
    rows.push(row(null, 'Compensation means wages paid for service as an Employee, measured before the salary reduction in Article 7. Plan Year means the period named in the title block, and a short first year described in Article 1 is a Plan Year for the rules that apply during it.'));
    rows.push(row(null, 'A Qualified Benefit is a benefit Code §125 permits and that Article 5 offers. Cash is the compensation the Participant would have received if the Participant had not elected a Qualified Benefit. A Salary Reduction Agreement is the election filed under Article 6. Spouse means the person to whom the Participant is married under federal tax law.'));
    rows.push(row(null, 'The Run-out Period is the time after the plan year, and after a grace period when Article 5 provides one, during which a claim may still be filed for an expense incurred while coverage was in effect. The Plan Administrator sets the length of that period and tells Participants the deadline before the plan year starts.'));

    rows.push(h1('Article 3. Eligibility'));
    rows.push(row(null, 'The eligible classes are: ' + S125Model.classSentence(plan) + '.'));
    rows.push(row(null, 'Waiting period. ' + S125Model.waitingText(plan.waiting_period)));
    rows.push(row(null, 'An Employee who has not completed the waiting period is not an Eligible Employee. A temporary employee, a leased employee, and an independent contractor who is not a common-law employee are not Eligible Employees. A person excluded from the definition of Employee is not an Eligible Employee.'));
    rows.push(h2('Loss of eligibility'));
    rows.push(row(null, 'Eligibility ends when employment ends or when the person no longer belongs to an eligible class. From that date the person cannot make a new pre-tax election. A claim for care or dependent care furnished before that date is still presented under Article 9.'));
    rows.push(row(null, 'An Employee who terminates employment and is rehired within 30 days, or who returns from an unpaid leave of absence of less than 30 days, is not a new employee under Article 4. The election in effect before the separation or leave is reinstated for the rest of the plan year, unless Article 6 permits a change. An Employee who returns after 30 days or more is treated as a new hire, unless the group health plan or applicable law requires coverage to resume sooner.'));
    if (plan.multi_state) {
      rows.push(row(null, 'Eligible Employees may work in more than one state. This Plan applies the federal cafeteria-plan rules. State insurance law and state employment law may also apply in a state where an Employee works.'));
    }

    rows.push(h1('Article 4. Participation'));
    rows.push(row(null, 'An Eligible Employee may make an election within ' + plan.new_hire_window + ' days after becoming eligible. An election received on or before the date coverage begins under Article 3 takes effect on that date. An election received later takes effect prospectively, on the first day of the first pay period that begins after the Plan Administrator receives it. The exception is an election made within 30 days after the date of hire, which may take effect as of the date coverage begins (Prop. Treas. Reg. §1.125-2(d)). Salary reduction applies only to compensation not yet currently available when the election is made. An Employee who does not elect in that period, or during open enrollment, is treated as having waived every pre-tax benefit and elected cash. The missed election does not default to after-tax coverage.'));
    rows.push(row(null, 'Participation ends on the earliest of the day employment ends, the day the person ceases to be an Eligible Employee, the day no pre-tax election remains in effect, and the day this Plan ends. The Employer takes no salary reduction for pay earned after that day.'));
    if (Number(plan.employee_count) >= 50) {
      rows.push(row(null, 'While a Participant is on leave protected by the Family and Medical Leave Act, the Participant may continue, revoke, or resume a salary-reduction election as that Act and the cafeteria-plan regulations require.'));
    }

    rows.push(h1('Article 5. Benefits'));
    rows.push(row(null, 'A Participant may choose cash or one or more of the qualified benefits described in this Article. Each qualified benefit is the pre-tax payment of the cost this Article describes.'));
    rows.push(row(null, has(plan, 'hsa')
      ? 'Except for the health savings account contributions this Article allows, the Plan does not provide deferred compensation. A program the Employer maintains outside this Article is not a benefit of this Plan.'
      : 'The Plan does not provide deferred compensation. A program the Employer maintains outside this Article is not a benefit of this Plan.'));
    benefitSections(plan).forEach(function (item) { rows.push(item); });

    rows.push(h1('Article 6. Elections'));
    rows.push(row(null, 'The Participant files each election in the manner the Plan Administrator directs, on paper or by electronic enrollment. An election received after the applicable period has closed does not take effect.'));
    rows.push(row(null, 'A salary-reduction election stays in effect for the plan year. The Participant may change it during the year only when Treas. Reg. §1.125-4 permits the change, the Employer’s election procedures include that event, and the change is consistent with the event. Those events include a change in status and a HIPAA special enrollment right. The request is due within 30 days after the event, unless that special enrollment right allows more time, and it affects only compensation that is not yet currently available unless the regulation sets an earlier effective date.'));
    if (has(plan, 'hsa')) {
      rows.push(row(null, 'An election to contribute to a health savings account changes only as the Health savings account section provides.'));
    }
    if (!plan.prior_plan) {
      rows.push(row(null, 'Initial enrollment. Each Employee who will be an Eligible Employee on the Effective Date may make an election during an initial enrollment period the Plan Administrator sets, ending no later than the day before the Effective Date. Those elections take effect on the Effective Date and remain in effect through the end of the first plan year.'));
    } else {
      rows.push(row(null, 'Elections in effect under the plan being restated continue under this restatement for the rest of the plan year in which the restatement takes effect.'));
    }
    rows.push(row(null, 'Open enrollment lasts ' + plan.oe_window_days + ' days and ends on the day before the plan year begins. An election made in open enrollment takes effect on the first day of the coming plan year. The first' + (plan.short_plan_year ? ' annual' : '') + ' open enrollment period under this Plan is ' + S125Model.formatLongDate(plan.oe_start_date) + ' through ' + S125Model.formatLongDate(plan.oe_end_date) + '.'));

    rows.push(h1('Article 7. Salary reduction'));
    rows.push(row(null, 'The Employer reduces a Participant’s compensation, before federal income tax and, where the Code allows, before Social Security and Medicare tax, by the amount required to pay the elected benefits. The reduction applies only to compensation that is not yet currently available to the Participant. The Employer then pays that amount toward the elected benefit.'));
    rows.push(row(null, 'The annual election is collected over the paydays remaining in the period of coverage. If a clerical error withholds the wrong amount, the Employer may adjust a later payday in the same plan year. That adjustment is not a new election and does not change the benefit the Participant chose.'));

    rows.push(h1('Article 8. Funding'));
    if (plan.funding_type === 'self' || plan.funding_type === 'level') {
      rows.push(row(null, 'The Employer pays benefits from its general assets. A level-funded arrangement, if the Employer uses one, is treated as self-insured for federal income-tax purposes.'));
    } else {
      rows.push(row(null, 'The Employer pays insured benefits by remitting the elected premium to the insurer.'));
    }
    rows.push(row(null, 'A salary reduction under this Plan is an Employer contribution for federal income-tax purposes. The Employer is not required to hold Plan contributions in a separate trust.' + (has(plan, 'hsa') ? ' A health savings account is held by its custodian under Article 5.' : '')));
    if (has(plan, 'health_fsa') || has(plan, 'dcap')) {
      var which = has(plan, 'health_fsa') && has(plan, 'dcap')
        ? 'Each flexible spending arrangement'
        : (has(plan, 'health_fsa') ? 'The Health FSA' : 'The Dependent Care FSA');
      rows.push(row(null, which + ' is paid from the Employer’s general assets and is administered under the Employer’s claims procedures. Those procedures do not change the unused-amount rule in Article 5.'));
    }

    rows.push(h1('Article 9. Claims and appeals'));
    if (health && (has(plan, 'health_fsa') || has(plan, 'dcap'))) {
      rows.push(row(null, 'A claim under an insurance contract is filed and decided under that contract. A request for reimbursement from a flexible spending arrangement is filed with the Plan Administrator, or with the claims administrator the Employer names, before the Run-out Period ends. The decision is in writing. A claimant may appeal a denial in writing within 180 days after receiving it, and the appeal is decided in writing.'));
      rows.push(row(null, 'The request states the date of service, the amount, and the provider, and the Participant affirms that the expense has not been reimbursed elsewhere and will not be claimed as a deduction or a credit. Further proof may be required. A request that is still incomplete when the Run-out Period ends is denied.'));
    } else if (has(plan, 'dcap')) {
      rows.push(row(null, 'A request for dependent care reimbursement is filed with the Plan Administrator, or with the claims administrator the Employer names, before the Run-out Period ends. The decision is in writing. A claimant may appeal a denial in writing within 180 days after receiving it, and the appeal is decided in writing.'));
      rows.push(row(null, 'The request names the provider and the dependent, states the dates of care and the amount, and includes the Participant’s affirmation that the expense has not been reimbursed elsewhere. A request that is still incomplete when the Run-out Period ends is denied.'));
    } else {
      rows.push(row(null, 'A claim for a benefit under an insurance contract is filed and decided under that contract, including the contract’s appeal procedure. This Plan does not decide a carrier’s claim.'));
    }

    rows.push(h1('Article 10. Continuation coverage'));
    if (has(plan, 'medical') || has(plan, 'dental') || has(plan, 'vision') || has(plan, 'health_fsa')) {
      rows.push(row(null, 'If COBRA applies to a group health benefit under this Plan, a qualified beneficiary may elect continuation coverage as COBRA provides. Electing COBRA does not keep a salary-reduction election in force after the person ceases to be a Participant. Pre-tax payment of a COBRA premium is available only while the person remains a Participant. Continuation of a Health FSA, if COBRA requires it, lasts only for the period and on the terms COBRA provides for a health flexible spending arrangement.'));
      rows.push(row(null, 'The Employer gives the notices COBRA assigns to the plan sponsor. Once the qualified beneficiary is no longer a Participant, the continuation premium is paid on an after-tax basis under that continuation coverage.'));
    } else {
      rows.push(row(null, 'COBRA continuation coverage does not apply to dependent care assistance. If the Employer maintains a group health plan outside this Plan, continuation of that plan is governed by COBRA and by that plan.'));
    }

    rows.push(h1('Article 11. Privacy of health information'));
    if (health) {
      rows.push(row(null, 'To the extent this Plan is a group health plan, the Employer may use and disclose protected health information only for plan administration, as the HIPAA privacy rule permits. The information is not used to make employment decisions, and it is not shared with people who do not administer the Plan. A vendor that handles claims does so under a business-associate agreement when the privacy rule requires one. Dependent care assistance is not a group health plan, and the HIPAA privacy rule does not apply to it.'));
    } else {
      rows.push(row(null, 'Dependent care assistance under this Plan is not a group health plan, and the HIPAA privacy rule does not apply to it.'));
    }

    rows.push(h1('Article 12. Administration'));
    rows.push(row(null, 'The Plan Administrator, as defined in Article 2, interprets this Plan, decides questions of eligibility and benefit, and keeps the records Article 17 requires. The Administrator may adopt enrollment and claims procedures, correct a clerical mistake, and delegate ministerial work. Notices go to ' + plan.signer_name + ', ' + plan.signer_title + ', at the Employer’s office.'));
    rows.push(row(null, 'The Employer indemnifies an officer or employee who serves in the administration of the Plan against reasonable cost of that service, other than cost arising from that person’s fraud or willful misconduct.'));
    if (has(plan, 'health_fsa') || has(plan, 'dcap')) {
      rows.push(row(null, 'The Plan Administrator may appoint a third-party administrator for day-to-day claims work. The appointment does not change the unused-amount rule in Article 5.'));
    }
    rows.push(row(null, has(plan, 'hsa')
      ? 'Participation does not give a Participant a vested right to a benefit that has not been paid, other than an HSA contribution the custodian has received.'
      : 'Participation does not give a Participant a vested right to a benefit that has not been paid.'));

    rows.push(h1('Article 13. Nondiscrimination'));
    rows.push(row(null, 'The Plan Administrator will apply the cafeteria-plan nondiscrimination rules of Code §125 for each plan year, including the eligibility test, the contributions and benefits test, and the key-employee concentration test in Code §125(b)(2). If a test is not met, the highly compensated individuals or key employees reached by that test include the benefit in income as the Code provides, and the failure does not by itself tax the other Participants.'));
    if (has(plan, 'dcap')) {
      rows.push(row(null, 'Dependent care assistance is also tested under Code §129(d), including the 55 percent average-benefits test and the limit on benefits provided to more-than-5-percent owners. The Plan Administrator will complete that testing before the Employer relies on the ' + money(S125Model.DCAP_LIMIT_2026) + ' exclusion.'));
    }
    if (plan.funding_type === 'self' || plan.funding_type === 'level' || has(plan, 'health_fsa')) {
      rows.push(row(null, 'Self-insured medical reimbursement, including the Health FSA and any level-funded medical arrangement that is self-insured for tax purposes, must also satisfy Code §105(h).'));
    }
    if (Number(plan.employee_count) >= 50) {
      rows.push(row(null, 'Whether the Employer is an applicable large employer under the Affordable Care Act is determined from full-time employees and full-time-equivalent employees.'));
    }

    rows.push(h1('Article 14. Amendment and termination'));
    var amend = 'The Employer may amend or terminate this Plan by a written instrument. The change is prospective. It does not take away a benefit for a claim already incurred, except as the Code permits.';
    if (has(plan, 'hsa')) amend += ' Termination does not recover an HSA contribution the custodian has already received.';
    rows.push(row(null, amend + ' An authorized officer signs each amendment. Participants are notified of a material reduction before the reduction applies, or as soon as Plan administration reasonably permits.'));

    rows.push(h1('Article 15. No right to employment'));
    rows.push(row(null, 'This Plan does not give any person a right to be hired or to remain employed, and it does not limit the Employer’s right to change the terms of employment or to end employment. An election is not a contract of employment and does not set the Participant’s hours or pay.'));

    rows.push(h1('Article 16. Nonassignment'));
    rows.push(row(null, 'A Participant may not assign, alienate, or pledge a benefit under this Plan, except as the Code requires or as an insurer accepts an assignment of an insured benefit. A benefit is not subject to the claims of the Participant’s creditors.'));

    rows.push(h1('Article 17. Plan records'));
    rows.push(row(null, 'The Plan Administrator keeps elections, salary reductions, and reimbursement records for as long as the Code and ERISA require, and makes them available for examination as those laws require. Those records include this document, later amendments, enrollment forms, payroll reports, and claim files, and they are kept at least seven years after the plan year they concern, or longer while a claim or an examination remains open.'));

    rows.push(h1('Article 18. Governing law'));
    rows.push(row(null, 'This Plan is governed by the Code and by ERISA to the extent ERISA applies. Where state law is not preempted, this Plan is governed by the laws of the State of ' + state + '.'));

    rows.push(h1('Article 19. Severability'));
    rows.push(row(null, 'If a provision of this Plan is held invalid, the rest of the Plan remains in effect. Headings are for convenience and do not change the meaning of the provisions that follow them.'));

    rows.push(h1('Article 20. Execution'));
    rows.push(row(null, 'The Employer has caused this Plan to be executed by its authorized officer.', { keepNext: true, keepLines: true }));
    rows.push(row(null, 'Employer: ' + plan.employer_name, { keepNext: true, keepLines: true }));
    rows.push(row(null, 'By: ________________________________', { keepNext: true, keepLines: true }));
    rows.push(row(null, 'Name: ' + plan.signer_name, { keepNext: true, keepLines: true }));
    rows.push(row(null, 'Title: ' + plan.signer_title, { keepNext: true, keepLines: true }));
    rows.push(row(null, 'Date: ________________________________', { keepLines: true }));
    return rows;
  }

  function signLine(plan) {
    return 'Sign and date the plan on or before ' + S125Model.formatLongDate(plan.effective_date) + '.';
  }

  function firstPlanYear(plan) {
    if (plan.short_plan_year && plan.effective_date) return Number(String(plan.effective_date).slice(0, 4));
    if (plan.on_plan_year_start && plan.effective_date) return Number(String(plan.effective_date).slice(0, 4));
    if (plan.next_plan_year_start) return Number(String(plan.next_plan_year_start).slice(0, 4)) - (plan.effective_date === plan.next_plan_year_start ? 0 : 1);
    return Number(String(plan.effective_date || '').slice(0, 4)) || 2026;
  }

  function healthFsaLimitSentence(plan) {
    var sentence = 'Salary reduction contributions to the Health FSA for a plan year may not exceed the dollar limit in Code §125(i) for that plan year, as adjusted for inflation. For a plan year beginning in 2026, the limit is ' + money(S125Model.HEALTH_FSA_LIMIT_2026) + '.';
    if (!plan.short_plan_year || !plan.effective_date || !plan.short_plan_year_end) return sentence;
    var months = S125Model.shortYearMonths(plan.effective_date, plan.short_plan_year_end);
    var year = Number(String(plan.effective_date).slice(0, 4));
    var amount = year === 2026
      ? money(Math.floor(S125Model.HEALTH_FSA_LIMIT_2026 * months / 12))
      : (months + '/12 of the §125(i) limit for ' + year);
    return sentence + ' For the short plan year from ' + S125Model.formatLongDate(plan.effective_date) + ' through ' + S125Model.formatLongDate(plan.short_plan_year_end) + ', the limit is prorated by the number of months in that short plan year, as Notice 2012-40 requires: ' + amount + '.';
  }

  function carryoverSentence(plan) {
    var text = 'The Health FSA carries unused amounts into the next plan year, up to the maximum carryover the IRS sets for that plan year, as adjusted for inflation ($680 from a plan year beginning in 2026).';
    if (firstPlanYear(plan) < 2027) {
      text += ' Amounts carried into a plan year that begins in 2026, from a plan year that begins in 2025, are limited to ' + money(S125Model.CARRYOVER_INTO_2026) + '.';
    }
    return text + ' Any Health FSA amount above that limit is forfeited to the Employer. The Health FSA does not also have a grace period.';
  }

  function establishmentYearSentence(plan) {
    if (plan.plan_year_change && plan.on_plan_year_start) return S125Model.planYearNote(plan);
    if (plan.short_plan_year && plan.plan_year_change) {
      return 'The short plan year begins ' + S125Model.formatLongDate(plan.effective_date) + ' and ends ' + S125Model.formatLongDate(plan.short_plan_year_end) + '. Each later plan year is ' + S125Model.planYearSentence(plan) + '.';
    }
    if (plan.short_plan_year) {
      return 'The first plan year is a short plan year beginning ' + S125Model.formatLongDate(plan.effective_date) + ' and ending ' + S125Model.formatLongDate(plan.short_plan_year_end) + '. Each later plan year is ' + S125Model.planYearSentence(plan) + '.';
    }
    if (plan.prior_plan && !plan.plan_year_change) return 'This restatement continues the existing plan year.';
    return '';
  }

  function checklistLines(plan) {
    var lines = [signLine(plan)];
    if (!plan.prior_plan) lines.push('Hold enrollment for current employees before ' + S125Model.formatLongDate(plan.effective_date) + '.');
    if (plan.plan_year_change) lines.push('Changing the plan year needs a valid business reason (Notice 2012-40). Write it down. Prorate the Health FSA limit for any short plan year, including the year that ends early.');
    lines.push('Give payroll the signed plan so pre-tax deductions start on or after the effective date.');
    if (has(plan, 'health_fsa') || has(plan, 'dcap')) {
      lines.push('Tell the FSA administrator the unused-amount rule in the plan. Do not leave that rule only in side materials.');
    }
    if (has(plan, 'health_fsa')) lines.push('Offer the Health FSA only to employees eligible for your major medical plan.');
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
      'Oh, and if you\'re looking at contributing to your employees\' kids\' new child savings accounts (the Section 128 accounts, officially called "Trump accounts"), I have a free tool that creates that plan too. I don\'t sell or administer the accounts themselves, but the tool is there if you need it:',
      section128,
      '',
      'Also, just so you know, I\'m an employee benefits broker. No pressure at all, but I\'d be happy to help you shop and negotiate your group health and other benefits. I even have some rates you can check out online right now:',
      rates,
      '',
      'Would you mind giving me a shot to see what I can do for you? I\'d love to hear from you.',
      '',
      'Just so it\'s clear, legally I have to mention that the tool is educational and isn\'t legal or tax advice.',
      '',
      'If you\'d rather not get these emails from me, let me know and I\'ll take you off the list.',
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

  function tableXml(items) {
    var rows = items.map(function (item) {
      return '<w:tr>' +
        '<w:tc><w:tcPr><w:tcW w:w="2880" w:type="dxa"/><w:shd w:val="clear" w:color="auto" w:fill="F4F7FB"/></w:tcPr>' +
        '<w:p><w:r><w:rPr><w:b/><w:color w:val="1A2E4A"/></w:rPr><w:t xml:space="preserve">' + xml(item.label) + '</w:t></w:r></w:p></w:tc>' +
        '<w:tc><w:tcPr><w:tcW w:w="6480" w:type="dxa"/></w:tcPr>' +
        '<w:p><w:r><w:t xml:space="preserve">' + xml(item.value) + '</w:t></w:r></w:p></w:tc>' +
        '</w:tr>';
    }).join('');
    return '<w:tbl><w:tblPr><w:tblW w:w="9360" w:type="dxa"/><w:tblBorders>' +
      '<w:top w:val="single" w:sz="4" w:space="0" w:color="1A2E4A"/>' +
      '<w:left w:val="single" w:sz="4" w:space="0" w:color="1A2E4A"/>' +
      '<w:bottom w:val="single" w:sz="4" w:space="0" w:color="1A2E4A"/>' +
      '<w:right w:val="single" w:sz="4" w:space="0" w:color="1A2E4A"/>' +
      '<w:insideH w:val="single" w:sz="4" w:space="0" w:color="D5DDE6"/>' +
      '<w:insideV w:val="single" w:sz="4" w:space="0" w:color="D5DDE6"/>' +
      '</w:tblBorders></w:tblPr>' + rows + '</w:tbl>';
  }

  function blockXml(row) {
    if (row.table) return tableXml(row.table);
    return paragraphXml(row);
  }

  function documentXml(rows) {
    var body = rows.map(blockXml).join('');
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

  function pageField(instr) {
    return '<w:r><w:fldChar w:fldCharType="begin"/></w:r>' +
      '<w:r><w:instrText xml:space="preserve"> ' + instr + ' </w:instrText></w:r>' +
      '<w:r><w:fldChar w:fldCharType="separate"/></w:r>' +
      '<w:r><w:t>1</w:t></w:r>' +
      '<w:r><w:fldChar w:fldCharType="end"/></w:r>';
  }

  function footerXml(label) {
    var name = xml(label || '');
    return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<w:ftr xmlns:w="' + W + '">' +
      '<w:p><w:pPr><w:pStyle w:val="Footer"/><w:jc w:val="center"/></w:pPr>' +
      (name ? '<w:r><w:t xml:space="preserve">' + name + ' | Page </w:t></w:r>' : '<w:r><w:t xml:space="preserve">Page </w:t></w:r>') +
      pageField('PAGE') +
      '<w:r><w:t xml:space="preserve"> of </w:t></w:r>' +
      pageField('NUMPAGES') +
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
    props = props || {};
    return [
      { name: '[Content_Types].xml', text: contentTypesXml() },
      { name: '_rels/.rels', text: rootRels() },
      { name: 'docProps/core.xml', text: coreXml(props) },
      { name: 'docProps/app.xml', text: appXml() },
      { name: 'word/document.xml', text: documentXml(rows) },
      { name: 'word/styles.xml', text: stylesXml() },
      { name: 'word/header1.xml', text: headerXml() },
      { name: 'word/footer1.xml', text: footerXml(props.footer || props.title || '') },
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

  function fileVersion() {
    var match = String(S125Model.TEMPLATE_VERSION || '').match(/v(\d+\.\d+(?:\.\d+)?)/);
    return match ? ('_v' + match[1]) : '';
  }

  function planFileName(plan) {
    return safeFilePart(plan.employer_name) + '_Section_125_Plan' + fileVersion() + '.docx';
  }

  function guideFileName(plan) {
    return safeFilePart(plan.employer_name) + '_Section_125_Implementation_Guide' + fileVersion() + '.docx';
  }

  function pdfFileName(docxName) {
    return String(docxName).replace(/\.docx$/i, '.pdf');
  }


  function buildPlanDocx(plan) {
    return buildDocx(planParagraphs(plan), {
      title: plan.plan_name,
      footer: plan.plan_name,
      created: S125Model.GUIDANCE_AS_OF
    });
  }

  function buildGuideDocx(plan) {
    return buildDocx(guideParagraphs(plan), {
      title: 'Section 125 implementation checklist',
      footer: 'Section 125 implementation checklist',
      created: S125Model.GUIDANCE_AS_OF
    });
  }

  function plainText(rows) {
    return (rows || []).map(function (row) {
      if (row.table) {
        return row.table.map(function (item) { return item.label + ': ' + item.value; }).join('\n');
      }
      return row.text || '';
    }).join('\n');
  }

  return {
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
  var termsOk = ack.termsVersion === S125Terms.VERSION || ack.termsVersion === 's125-terms-2026-10-09';
  if (ack.accepted !== true || !ack.acceptedAt || !Date.parse(ack.acceptedAt) || !termsOk) {
    s125LogEvent_('rejected_terms', payload.submissionId, 'terms');
    return { ok: false, error: 'The terms acknowledgement is missing.' };
  }
  var checked = S125Model.validateSubmission(payload, { asOf: s125AsOf_() });
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

function s125Has_(plan, code) {
  return (plan.benefits || []).indexOf(code) !== -1;
}

function s125LeadMessage_(payload, checked, files) {
  var plan = checked.plan;
  var lead = checked.lead;
  var health = s125Has_(plan, 'health_fsa');
  var dcap = s125Has_(plan, 'dcap');
  var hsa = s125Has_(plan, 'hsa');
  var benefits = (plan.benefits || []).map(function (code) { return S125Model.benefitLabel(code); }).join(', ');
  var year = S125Model.planYearSentence(plan);
  if (year) year = year.charAt(0).toUpperCase() + year.slice(1);
  var bits = [];
  if (payload.test) bits.push('[TEST]');
  bits.push('New Section 125 Lead: ' + plan.employer_name + ' | ' + S125Model.entityLabel(plan) + ' | ' + plan.employee_count + ' employees');
  var lines = [
    'Section 125 cafeteria plan — sample lead',
    'Template: ' + (payload.templateVersion || S125Model.TEMPLATE_VERSION),
    'Submission id: ' + payload.submissionId,
    'Source page: ' + (payload.pageUrl || ''),
    '',
    'Company',
    'Legal name: ' + plan.employer_name,
    'EIN: ' + plan.employer_ein,
    'Address: ' + plan.employer_address,
    'State: ' + S125Model.stateName(plan.state),
    'Entity: ' + S125Model.entityLabel(plan),
    'Employees: ' + plan.employee_count,
    '',
    'Contact',
    'Name: ' + (lead.contact_name || plan.signer_name),
    'Title: ' + (lead.contact_title || plan.signer_title),
    'Email: ' + (lead.contact_email || plan.signer_email),
    'Phone: ' + (lead.contact_phone || plan.phone),
    '',
    'Design',
    'Plan: ' + plan.plan_name,
    'Plan number: ' + plan.plan_number,
    'Effective date: ' + S125Model.formatLongDate(plan.effective_date),
    'Plan year: ' + year,
    'Funding: ' + S125Model.fundingLabel(plan.funding_type),
    'Eligible classes: ' + S125Model.classSentence(plan),
    'Waiting period: ' + S125Model.waitingText(plan.waiting_period),
    'Full-time hours: ' + plan.full_time_hours,
    'New-hire enrollment: ' + plan.new_hire_window + ' days',
    'Open enrollment: ' + plan.oe_window_days + ' days',
    'Employees in more than one state: ' + (plan.multi_state ? 'Yes' : 'No'),
    'Existing Section 125 plan: ' + (plan.prior_plan ? 'Yes, originally adopted ' + plan.prior_adoption : 'No'),
    'Benefits: ' + benefits,
    'Health FSA: ' + (health ? S125Model.healthFsaDesignLabel(plan.health_fsa_design) : 'Not offered'),
    'Unused Health FSA amounts: ' + (health ? S125Model.unusedLabel(plan.health_fsa_unused) : 'Not offered'),
    'Dependent Care FSA: ' + (dcap ? 'Offered' : 'Not offered'),
    'Unused dependent care amounts: ' + (dcap ? S125Model.unusedLabel(plan.dcap_unused) : 'Not offered'),
    'HSA: ' + (hsa ? 'Offered. The election can be changed at least monthly.' : 'Not offered'),
    'Authorized officer: ' + plan.signer_name,
    'Officer title: ' + plan.signer_title,
    'Officer email: ' + plan.signer_email,
    '',
    'Acknowledgement',
    'Terms version: ' + ((payload.acknowledgement && payload.acknowledgement.termsVersion) || ''),
    'Accepted at: ' + ((payload.acknowledgement && payload.acknowledgement.acceptedAt) || ''),
    '',
    'The attached files are sample drafts. They are not adopted until the employer signs them. They are not stored on a public link.'
  ];
  if (plan.short_plan_year) {
    lines.splice(lines.indexOf('Plan year: ' + year) + 1, 0, 'First plan year: short year ending ' + S125Model.formatLongDate(plan.short_plan_year_end));
  }
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
function s125AsOf_() {
  try {
    if (typeof Utilities !== 'undefined' && Utilities.formatDate) {
      return Utilities.formatDate(new Date(s125Now_()), 'Pacific/Honolulu', 'yyyy-MM-dd');
    }
  } catch (err) {}
  var shifted = new Date(s125Now_() - 10 * 60 * 60 * 1000);
  var month = shifted.getUTCMonth() + 1;
  var day = shifted.getUTCDate();
  return shifted.getUTCFullYear() + '-' + (month < 10 ? '0' : '') + month + '-' + (day < 10 ? '0' : '') + day;
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
