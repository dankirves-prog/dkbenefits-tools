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
    if (month < 1 || month > 12 || year < 1000 || year > 2100) return '';
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
      else {
        var adoptedYear = Number(adoption.slice(3));
        var adoptedMonth = Number(adoption.slice(0, 2));
        if (adoptedYear < 1978) push(errors, 'prior_adoption', 'Enter an adoption month in 1978 or later.');
        else if (eff && adoptedYear * 12 + adoptedMonth > eff.getFullYear() * 12 + eff.getMonth() + 1) {
          push(errors, 'prior_adoption', 'The original adoption month cannot be after the effective date.');
        }
      }
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
    var reasons = reviewReasons(plan, asOf);
    return { ok: errors.length === 0, errors: errors, plan: plan, lead: lead, review: { required: reasons.length > 0, reasons: reasons } };
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

  function formatAdoptionMonth(value) {
    var match = /^(\d{2})\/(\d{4})$/.exec(String(value || ''));
    if (!match) return String(value || '');
    return (MONTHS[Number(match[1])] || match[1]) + ' ' + match[2];
  }

  function reviewReasons(plan, asOf) {
    var reasons = [];
    var benefits = plan.benefits || [];
    var classes = plan.eligible_classes || [];
    var health = benefits.indexOf('health_fsa') !== -1;
    if (health && benefits.indexOf('medical') === -1) reasons.push('Health FSA is offered without a medical benefit.');
    if (health && (classes.indexOf('part-time') !== -1 || classes.indexOf('other') !== -1)) {
      reasons.push('Health FSA is offered to part-time employees or another class.');
    }
    if (plan.short_plan_year && shortYearMonths(plan.effective_date, plan.short_plan_year_end) < 1) {
      reasons.push('The first plan year is shorter than one month.');
    }
    var days = daysUntil(plan.effective_date, asOf || todayIso());
    if (days != null && days >= 0 && days < 14) reasons.push('The effective date is within 14 days.');
    if (plan.plan_year_change) reasons.push('The restatement changes the plan year.');
    if (plan.funding_type === 'self' || plan.funding_type === 'level') reasons.push('Medical coverage is self-funded or level-funded.');
    return reasons;
  }

  function planYearSentence(plan) {
    if (plan.plan_year_type === 'calendar') return 'the calendar year, January 1 through December 31';
    var start = MONTHS[plan.plan_year_start_month] + ' ' + plan.plan_year_start_day;
    if (Number(plan.plan_year_start_month) === 3 && Number(plan.plan_year_start_day) === 1) {
      return 'the 12-month period beginning ' + start + ' and ending on the last day of February';
    }
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
    formatAdoptionMonth: formatAdoptionMonth,
    shortYearMonths: shortYearMonths,
    dayBeforeIso: dayBeforeIso,
    planYearNote: planYearNote,
    stepTwoNotices: stepTwoNotices,
    ownerRule: ownerRule
  };
})();
