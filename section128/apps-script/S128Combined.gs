/**
 * Combined Section 128 Apps Script deploy file.
 * Generated from s128-model.js + s128-terms.js + s128-docgen.js + apps-script/Code.gs.
 * Paste this whole file into Apps Script as Code.gs. Do not edit by hand.
 * Template s128-v1.0-2026-10-09. Terms s128-terms-2026-10-09.
 * The Terms of use are a draft for DK Benefits LLC counsel before go-live. They are not legal advice.
 */

/**
 * Section 128 Trump Account Contribution Program — validation, limits, review flags.
 * Template s128-v1.0-2026-10-09. Guidance as of October 8, 2026.
 * Same rules run in the browser and in the Apps Script.
 */
var S128Model = (function () {
  var TEMPLATE_VERSION = 's128-v1.0-2026-10-09';
  var GUIDANCE_AS_OF = '2026-10-08';
  var FIRST_CONTRIBUTION_DATE = '2026-07-04';
  var PUBLISHED_S128_CEILING = 2500;
  var KNOWN_LIMITS = {
    2026: { s128: 2500, s530A: 5000, status: 'statute' },
    2027: { s128: 2500, s530A: 5000, status: 'statute' }
  };
  var FUNDING_MODES = ['employer_only', 'salary_reduction_only', 'combined'];
  var CAP_MODES = ['statutory', 'fixed'];
  var ENTITY_TYPES = ['c_corp', 's_corp', 'llc_partnership', 'sole_prop', 'nonprofit', 'other'];
  var MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  var US_STATES = ['AL','AK','AZ','AR','CA','CO','CT','DE','DC','FL','GA','HI','ID','IL','IN','IA','KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ','NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT','VA','WA','WV','WI','WY'];

  function todayIso(date) {
    var d = date || new Date();
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  }

  function pad(n) {
    return n < 10 ? '0' + n : String(n);
  }

  function isIsoDate(value) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value || '')) return false;
    var y = +value.slice(0, 4);
    var m = +value.slice(5, 7);
    var d = +value.slice(8, 10);
    var dt = new Date(Date.UTC(y, m - 1, d));
    return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
  }

  function addMonthsIso(iso, months) {
    var y = +iso.slice(0, 4);
    var m = +iso.slice(5, 7) - 1;
    var d = +iso.slice(8, 10);
    var first = new Date(Date.UTC(y, m + months, 1));
    var last = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0)).getUTCDate();
    var day = Math.min(d, last);
    return new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth(), day)).toISOString().slice(0, 10);
  }

  function formatLongDate(iso) {
    if (!isIsoDate(iso)) return '';
    return MONTHS[+iso.slice(5, 7) - 1] + ' ' + Number(iso.slice(8, 10)) + ', ' + iso.slice(0, 4);
  }

  function formatMoney(amount) {
    var n = Math.round(Number(amount));
    var sign = n < 0 ? '-' : '';
    var s = String(Math.abs(n));
    return sign + '$' + s.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  }

  function digitsOnly(value) {
    return String(value || '').replace(/\D/g, '');
  }

  function cleanText(value) {
    return String(value == null ? '' : value).replace(/\s+/g, ' ').trim();
  }

  function push(errors, field, message) {
    errors.push({ field: field, message: message });
  }

  function hasError(errors, field) {
    for (var i = 0; i < errors.length; i++) if (errors[i].field === field) return true;
    return false;
  }

  function normalizeEin(raw) {
    var d = digitsOnly(raw);
    if (d.length !== 9) return null;
    return d.slice(0, 2) + '-' + d.slice(2);
  }

  function formatEinLive(raw) {
    var d = digitsOnly(raw).slice(0, 9);
    if (d.length < 3) return d;
    return d.slice(0, 2) + '-' + d.slice(2);
  }

  function phoneDigits(raw) {
    var d = digitsOnly(raw);
    if (d.charAt(0) === '1' && d.length > 10) d = d.slice(1);
    return d.slice(0, 16);
  }

  function normalizePhone(raw) {
    var d = phoneDigits(raw);
    if (d.length < 10) return null;
    return d;
  }

  function formatPhone(d) {
    if (!d || d.length < 10) return '';
    var main = '(' + d.slice(0, 3) + ') ' + d.slice(3, 6) + '-' + d.slice(6, 10);
    var ext = d.slice(10, 16);
    return ext ? main + ' ext. ' + ext : main;
  }

  function formatPhoneLive(raw) {
    var d = phoneDigits(raw);
    if (!d) return '';
    var main = d.slice(0, Math.min(10, d.length));
    var ext = d.length > 10 ? d.slice(10) : '';
    var out;
    if (main.length < 3) out = '(' + main;
    else if (main.length === 3) out = '(' + main + ')';
    else if (main.length <= 6) out = '(' + main.slice(0, 3) + ') ' + main.slice(3);
    else out = '(' + main.slice(0, 3) + ') ' + main.slice(3, 6) + '-' + main.slice(6);
    if (ext) out += ' ext. ' + ext;
    return out;
  }

  function validEmail(value) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value) && value.length <= 120;
  }

  function wholeDollars(raw) {
    if (raw == null) return null;
    var s = String(raw).trim().replace(/[$,\s]/g, '');
    if (!/^\d+$/.test(s)) return null;
    var n = Number(s);
    if (!isFinite(n)) return null;
    return n;
  }

  function yesNo(raw) {
    if (raw === true || raw === 'true' || raw === 'yes') return 'yes';
    if (raw === false || raw === 'false' || raw === 'no') return 'no';
    if (raw === 'unsure') return 'unsure';
    return '';
  }

  function boolFromYesNo(raw) {
    var v = yesNo(raw);
    if (v === 'yes') return true;
    if (v === 'no') return false;
    return null;
  }

  function parseEmployers(raw) {
    if (Array.isArray(raw)) {
      return raw.map(cleanText).filter(Boolean);
    }
    return String(raw || '').split(/\n+/).map(cleanText).filter(Boolean);
  }

  function looksLikeNameList(text) {
    var t = cleanText(text);
    if (/\b(by name|named employees|the following employees|only the following|listed below|these employees)\b/i.test(t)) return true;
    var parts = t.split(/[,;]|\band\b/i).map(cleanText).filter(Boolean);
    if (parts.length < 2) return false;
    var nameLike = 0;
    for (var i = 0; i < parts.length; i++) {
      if (/^[A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,2}$/.test(parts[i])) nameLike++;
    }
    return nameLike >= 2;
  }

  function fundingUsesGrant(mode) {
    return mode === 'employer_only' || mode === 'combined';
  }

  function fundingUsesSalary(mode) {
    return mode === 'salary_reduction_only' || mode === 'combined';
  }

  function limitForYear(year) {
    return KNOWN_LIMITS[year] || null;
  }

  function yearsTouched(effectiveDate) {
    var y = +String(effectiveDate || '').slice(0, 4);
    if (!y) return [];
    return [y, y + 1];
  }

  function statutoryCeiling(effectiveDate) {
    var years = yearsTouched(effectiveDate);
    var ceiling = PUBLISHED_S128_CEILING;
    for (var i = 0; i < years.length; i++) {
      var known = limitForYear(years[i]);
      if (known) ceiling = Math.min(ceiling, known.s128);
    }
    return ceiling;
  }

  function suggestPlanName(employerName) {
    var name = cleanText(employerName);
    if (!name) return '';
    return name + ' Trump Account Contribution Program';
  }

  function fundingLabel(mode) {
    if (mode === 'employer_only') return 'Employer grant only';
    if (mode === 'salary_reduction_only') return 'Salary reduction only';
    if (mode === 'combined') return 'Employer grant and salary reduction';
    return '';
  }

  function entityLabel(type) {
    var map = {
      c_corp: 'C corporation',
      s_corp: 'S corporation',
      llc_partnership: 'LLC or partnership',
      sole_prop: 'Sole proprietorship',
      nonprofit: 'Nonprofit',
      other: 'Other'
    };
    return map[type] || '';
  }

  function capText(plan) {
    var year = +String(plan.effective_date || '').slice(0, 4);
    var published = year > 0 && year <= 2027;
    if (plan.annual_cap_mode === 'statutory') {
      if (published) {
        return 'the Section 128(b) statutory limit for each calendar year ($2,500 for 2026 and 2027; as adjusted under Section 128(b)(2) for later years)';
      }
      return 'the Section 128(b) statutory limit for each calendar year, as adjusted under Section 128(b)(2)';
    }
    var amt = formatMoney(plan.fixed_annual_cap);
    if (published) {
      if (Number(plan.fixed_annual_cap) === PUBLISHED_S128_CEILING) {
        return 'a fixed cap of ' + amt + ' per employee per calendar year, equal to the Section 128(b) limit for 2026 and 2027 (as adjusted under Section 128(b)(2) for later years)';
      }
      return 'a fixed cap of ' + amt + ' per employee per calendar year, not to exceed the Section 128(b) limit ($2,500 for 2026 and 2027; as adjusted under Section 128(b)(2) for later years)';
    }
    return 'a fixed cap of ' + amt + ' per employee per calendar year, not to exceed the Section 128(b) limit as adjusted under Section 128(b)(2)';
  }

  function salaryCapacity(plan) {
    if (!fundingUsesSalary(plan.funding_mode) || !isIsoDate(plan.effective_date)) return null;
    var year = +plan.effective_date.slice(0, 4);
    var known = limitForYear(year);
    var grant = fundingUsesGrant(plan.funding_mode) ? Number(plan.employer_annual_grant || 0) : 0;
    if (!known) {
      var fixed = plan.annual_cap_mode === 'fixed' ? Number(plan.fixed_annual_cap) : null;
      return {
        year: year,
        unpublished: true,
        room: fixed == null ? null : Math.max(0, fixed - grant),
        fixedCap: fixed,
        publishedCeiling: PUBLISHED_S128_CEILING
      };
    }
    var cap = plan.annual_cap_mode === 'fixed' ? Number(plan.fixed_annual_cap) : known.s128;
    return {
      year: year,
      unpublished: false,
      room: Math.max(0, Math.min(cap, known.s128) - grant),
      statutory: known.s128,
      cap: cap
    };
  }

  function capacityMessage(plan) {
    var info = salaryCapacity(plan);
    if (!info) return '';
    if (info.unpublished) {
      if (info.fixedCap != null) {
        return 'For ' + info.year + ', employees may elect up to ' + formatMoney(info.room) + ' through payroll under this fixed cap. Salary reduction can fund dependents’ accounts only.';
      }
      return 'Salary reduction for ' + info.year + ' follows the Section 128(b) limit for that year. Salary reduction can fund dependents’ accounts only.';
    }
    if (plan.funding_mode === 'combined') {
      var ceiling = info.statutory || info.cap;
      var together = ceiling
        ? 'The employer grant and employee salary reduction together can\'t exceed the ' + formatMoney(ceiling) + ' annual limit per employee.'
        : 'The employer grant and employee salary reduction together can\'t exceed the annual limit per employee.';
      return together + ' With a ' + formatMoney(plan.employer_annual_grant || 0) + ' grant, an employee can elect up to ' + formatMoney(info.room) + ' through payroll. Salary reduction can fund dependents’ accounts only. It does not reduce Social Security or Medicare tax.';
    }
    return 'For ' + info.year + ', employees may elect up to ' + formatMoney(info.room) + ' per year through payroll, for dependents’ accounts only. Salary reduction does not reduce Social Security or Medicare tax.';
  }

  function validate(input, opts) {
    opts = opts || {};
    var asOf = opts.asOf || todayIso();
    if (!isIsoDate(asOf)) asOf = todayIso();
    var errors = [];
    var src = input || {};
    var plan = {};
    var lead = {};

    plan.employer_name = cleanText(src.employer_name);
    if (plan.employer_name.length < 2 || plan.employer_name.length > 120) {
      push(errors, 'employer_name', 'Enter the employer’s legal name (2 to 120 characters).');
    }

    var ein = normalizeEin(src.employer_ein);
    if (!ein) push(errors, 'employer_ein', 'Enter a 9-digit EIN, like 12-3456789.');
    else if (ein.slice(0, 2) === '00' || ein === '00-0000000') push(errors, 'employer_ein', 'That EIN is not usable. Check the prefix and digits.');
    else plan.employer_ein = ein;

    plan.street = cleanText(src.street || src.employer_street);
    plan.city = cleanText(src.city || src.employer_city);
    plan.state = cleanText(src.state || src.employer_state).toUpperCase();
    plan.zip = cleanText(src.zip || src.employer_zip);
    if (plan.street.length < 2 || plan.street.length > 120) push(errors, 'street', 'Enter the street address.');
    if (plan.city.length < 2 || plan.city.length > 60) push(errors, 'city', 'Enter the city.');
    if (US_STATES.indexOf(plan.state) === -1) push(errors, 'state', 'Choose a U.S. state.');
    if (!/^\d{5}(-\d{4})?$/.test(plan.zip)) push(errors, 'zip', 'Enter a 5-digit ZIP code.');

    plan.participating_employers = parseEmployers(src.participating_employers);
    if (plan.participating_employers.length > 20) push(errors, 'participating_employers', 'List no more than 20 additional employers.');
    for (var pe = 0; pe < plan.participating_employers.length; pe++) {
      if (plan.participating_employers[pe].length > 120) {
        push(errors, 'participating_employers', 'Each participating employer name must be 120 characters or fewer.');
        break;
      }
    }

    plan.plan_name = cleanText(src.plan_name);
    if (plan.plan_name.length < 2 || plan.plan_name.length > 160) {
      push(errors, 'plan_name', 'Enter the program name.');
    }

    plan.effective_date = cleanText(src.effective_date);
    if (!isIsoDate(plan.effective_date)) push(errors, 'effective_date', 'Choose the program effective date.');
    else if (plan.effective_date < FIRST_CONTRIBUTION_DATE) push(errors, 'effective_date', 'Contributions cannot start before July 4, 2026.');
    else if (plan.effective_date > addMonthsIso(asOf, 18)) push(errors, 'effective_date', 'Choose an effective date within the next 18 months.');

    plan.administrator_name = cleanText(src.administrator_name);
    plan.administrator_contact = cleanText(src.administrator_contact);
    if (plan.administrator_name.length < 2 || plan.administrator_name.length > 120) {
      push(errors, 'administrator_name', 'Enter the administrator’s name or role.');
    }
    var adminEmail = /[^\s@]+@[^\s@]+\.[^\s@]+/.test(plan.administrator_contact);
    var adminPhone = !!normalizePhone(plan.administrator_contact);
    if (plan.administrator_contact.length < 5 || plan.administrator_contact.length > 160 || (!adminEmail && !adminPhone)) {
      push(errors, 'administrator_contact', 'Enter an email or phone number for the administrator.');
    }

    var classChoice = cleanText(src.eligibility_class_choice || src.eligibility_choice);
    var classText = cleanText(src.eligibility_class_other || src.eligibility_other);
    if (src.eligibility_class === 'All common-law employees') classChoice = 'all';
    if (!classChoice && src.eligibility_class && src.eligibility_class !== 'All common-law employees') {
      classChoice = 'other';
      classText = classText || cleanText(src.eligibility_class);
    }
    if (classChoice !== 'all' && classChoice !== 'other') {
      push(errors, 'eligibility_class', 'Choose the eligible employee class.');
    } else if (classChoice === 'all') {
      plan.eligibility_class_choice = 'all';
      plan.eligibility_class = 'All common-law employees';
    } else {
      plan.eligibility_class_choice = 'other';
      if (classText.length < 3 || classText.length > 240) push(errors, 'eligibility_class_other', 'Describe an objective class, such as full-time employees or employees at a named location.');
      else if (looksLikeNameList(classText)) push(errors, 'eligibility_class_other', 'List an objective class. Naming individual employees is not an eligible class.');
      else {
        plan.eligibility_class = classText;
      }
    }

    var waitingRaw = String(src.waiting_days == null ? '' : src.waiting_days).trim();
    if (!/^\d+$/.test(waitingRaw)) push(errors, 'waiting_days', 'Enter the waiting period as a whole number of days.');
    else {
      var waiting = Number(waitingRaw);
      if (waiting > 365) push(errors, 'waiting_days', 'Use 0 to 365 calendar days. A longer wait is outside this sample.');
      else plan.waiting_days = waiting;
    }

    plan.funding_mode = cleanText(src.funding_mode);
    if (FUNDING_MODES.indexOf(plan.funding_mode) === -1) {
      push(errors, 'funding_mode', 'Choose how the program is funded.');
    }

    plan.annual_cap_mode = cleanText(src.annual_cap_mode);
    if (CAP_MODES.indexOf(plan.annual_cap_mode) === -1) {
      push(errors, 'annual_cap_mode', 'Choose the annual cap.');
    }

    var ceiling = isIsoDate(plan.effective_date) ? statutoryCeiling(plan.effective_date) : PUBLISHED_S128_CEILING;
    if (plan.annual_cap_mode === 'fixed') {
      var fixed = wholeDollars(src.fixed_annual_cap);
      if (fixed == null || fixed < 1) push(errors, 'fixed_annual_cap', 'Enter the fixed annual cap in whole dollars.');
      else if (fixed > PUBLISHED_S128_CEILING) {
        push(errors, 'fixed_annual_cap', 'The published Section 128 limit for 2026 and 2027 is $2,500. A higher cap cannot be checked until the IRS publishes an indexed amount. No indexed figure is available yet.');
      } else plan.fixed_annual_cap = fixed;
    } else {
      plan.fixed_annual_cap = null;
    }

    var programCap = plan.annual_cap_mode === 'fixed' && plan.fixed_annual_cap ? Math.min(plan.fixed_annual_cap, ceiling) : ceiling;

    if (fundingUsesGrant(plan.funding_mode)) {
      var grant = wholeDollars(src.employer_annual_grant);
      if (grant == null || grant < 1) push(errors, 'employer_annual_grant', 'Enter the annual employer grant in whole dollars.');
      else if (grant > PUBLISHED_S128_CEILING) {
        push(errors, 'employer_annual_grant', 'The published Section 128 limit for 2026 and 2027 is $2,500 per employee. A higher grant cannot be checked until the IRS publishes an indexed amount.');
      } else if (plan.annual_cap_mode === 'fixed' && plan.fixed_annual_cap && grant > plan.fixed_annual_cap) {
        push(errors, 'employer_annual_grant', 'The employer grant cannot be more than the annual cap.');
      } else if (plan.funding_mode === 'combined' && grant >= programCap) {
        push(errors, 'employer_annual_grant', 'Combined funding needs room left for salary reduction. Lower the grant or raise the cap.');
      } else if (grant > ceiling) {
        push(errors, 'employer_annual_grant', 'The grant is above the Section 128 limit that applies to this effective date.');
      } else plan.employer_annual_grant = grant;

      var recipient = src.allow_employee_account;
      if (recipient === true || recipient === 'yes' || recipient === 'employee_and_dependent') plan.allow_employee_account = true;
      else if (recipient === false || recipient === 'no' || recipient === 'dependent_only') plan.allow_employee_account = false;
      else push(errors, 'allow_employee_account', 'Choose who can receive the employer grant.');
    } else {
      plan.employer_annual_grant = null;
      plan.allow_employee_account = false;
    }

    if (fundingUsesSalary(plan.funding_mode)) {
      var cutoffRaw = String(src.election_cutoff_days == null ? '' : src.election_cutoff_days).trim();
      if (!/^\d+$/.test(cutoffRaw)) push(errors, 'election_cutoff_days', 'Enter the payroll processing notice as a whole number of days.');
      else {
        var cutoff = Number(cutoffRaw);
        if (cutoff > 30) push(errors, 'election_cutoff_days', 'Use 0 to 30 days so employees can still change an election at least monthly.');
        else plan.election_cutoff_days = cutoff;
      }
      var existing125 = yesNo(src.has_existing_125_plan);
      if (existing125 === 'yes') {
        plan.cafeteria_plan_name = cleanText(src.cafeteria_plan_name);
        if (plan.cafeteria_plan_name.length < 2 || plan.cafeteria_plan_name.length > 160) {
          push(errors, 'cafeteria_plan_name', 'Enter the name of the existing Section 125 plan.');
        }
        plan.cafeteria_amendment_date = cleanText(src.cafeteria_amendment_date);
        if (!isIsoDate(plan.cafeteria_amendment_date)) push(errors, 'cafeteria_amendment_date', 'Choose the Section 125 amendment effective date.');
        else if (plan.cafeteria_amendment_date < FIRST_CONTRIBUTION_DATE) push(errors, 'cafeteria_amendment_date', 'The amendment cannot be effective before July 4, 2026.');
        else if (plan.cafeteria_amendment_date < asOf) push(errors, 'cafeteria_amendment_date', 'The Section 125 amendment must be prospective. Choose today or a later date.');
        else if (plan.cafeteria_amendment_date > addMonthsIso(asOf, 18)) push(errors, 'cafeteria_amendment_date', 'Choose an amendment date within the next 18 months.');
        else if (isIsoDate(plan.effective_date) && plan.cafeteria_amendment_date < plan.effective_date) push(errors, 'cafeteria_amendment_date', 'The amendment effective date cannot be earlier than the program effective date.');
      } else {
        plan.cafeteria_plan_name = '';
        plan.cafeteria_amendment_date = '';
      }
    } else {
      plan.election_cutoff_days = null;
      plan.cafeteria_plan_name = '';
      plan.cafeteria_amendment_date = '';
    }

    plan.signer_name = cleanText(src.signer_name);
    plan.signer_title = cleanText(src.signer_title);
    if (plan.signer_name.length < 2 || plan.signer_name.length > 120) push(errors, 'signer_name', 'Enter the authorized representative’s name. The signature line stays blank.');
    if (plan.signer_title.length < 2 || plan.signer_title.length > 120) push(errors, 'signer_title', 'Enter the authorized representative’s title.');

    lead.contact_name = cleanText(src.contact_name);
    lead.contact_title = cleanText(src.contact_title);
    lead.contact_email = cleanText(src.contact_email);
    var phone = normalizePhone(src.contact_phone);
    lead.contact_phone = phone ? formatPhone(phone) : '';
    if (lead.contact_name.length < 2 || lead.contact_name.length > 120) push(errors, 'contact_name', 'Enter the contact’s name.');
    if (lead.contact_title.length < 2 || lead.contact_title.length > 120) push(errors, 'contact_title', 'Enter the contact’s title.');
    if (!validEmail(lead.contact_email)) push(errors, 'contact_email', 'Enter a valid email address.');
    if (!phone) push(errors, 'contact_phone', 'Enter a 10-digit U.S. phone number.');

    var countRaw = String(src.total_employee_count == null ? '' : src.total_employee_count).trim().replace(/,/g, '');
    if (!/^\d+$/.test(countRaw)) push(errors, 'total_employee_count', 'Enter the total number of employees.');
    else {
      var count = Number(countRaw);
      if (count < 1 || count > 100000) push(errors, 'total_employee_count', 'Enter an employee count from 1 to 100,000.');
      else lead.total_employee_count = count;
    }

    lead.entity_type = cleanText(src.entity_type);
    if (ENTITY_TYPES.indexOf(lead.entity_type) === -1) push(errors, 'entity_type', 'Choose the employer’s entity type.');
    lead.related_businesses = yesNo(src.related_businesses);
    if (['yes', 'no', 'unsure'].indexOf(lead.related_businesses) === -1) push(errors, 'related_businesses', 'Say whether related businesses should be included.');
    lead.owners_or_family_want_to_participate = yesNo(src.owners_or_family_want_to_participate);
    if (['yes', 'no'].indexOf(lead.owners_or_family_want_to_participate) === -1) {
      push(errors, 'owners_or_family_want_to_participate', 'Say whether an owner or an owner’s family member wants to participate.');
    }
    lead.collectively_bargained_employees = yesNo(src.collectively_bargained_employees);
    if (['yes', 'no'].indexOf(lead.collectively_bargained_employees) === -1) {
      push(errors, 'collectively_bargained_employees', 'Say whether any employees are covered by a collective bargaining agreement.');
    }
    if (fundingUsesSalary(plan.funding_mode)) {
      lead.has_existing_125_plan = yesNo(src.has_existing_125_plan);
      if (['yes', 'no', 'unsure'].indexOf(lead.has_existing_125_plan) === -1) {
        push(errors, 'has_existing_125_plan', 'Say whether a Section 125 cafeteria plan is already in place.');
      }
    } else {
      lead.has_existing_125_plan = '';
    }

    var cityLine = [plan.city, plan.state].filter(Boolean).join(', ');
    if (plan.zip) cityLine = cityLine ? cityLine + ' ' + plan.zip : plan.zip;
    plan.employer_address = [plan.street, cityLine].filter(Boolean).join(', ');
    var review = buildReview(plan, lead, asOf);
    return {
      ok: errors.length === 0,
      errors: errors,
      plan: plan,
      lead: lead,
      review: review,
      asOf: asOf,
      templateVersion: TEMPLATE_VERSION
    };
  }

  function buildReview(plan, lead, asOf) {
    var reasons = [];
    if (plan.participating_employers && plan.participating_employers.length) {
      reasons.push('Additional participating employers are listed. Related employers are treated as one employer for Section 128.');
    }
    if (lead.related_businesses === 'yes' || lead.related_businesses === 'unsure') {
      reasons.push('Related businesses were marked ' + (lead.related_businesses === 'yes' ? 'yes' : 'unsure') + '. Controlled-group and affiliated-service-group rules may apply.');
    }
    if (plan.eligibility_class_choice === 'other') {
      reasons.push('The eligible class is narrower than all common-law employees. It must stay objective and nondiscriminatory.');
    }
    if (lead.owners_or_family_want_to_participate === 'yes') {
      if (lead.entity_type === 's_corp') {
        reasons.push('An owner or family member wants to participate in an S corporation. A 2-percent shareholder, with ownership attribution, is not treated as an employee for this program under the proposed-regulation preamble.');
      } else if (lead.entity_type === 'llc_partnership' || lead.entity_type === 'sole_prop') {
        reasons.push('An owner or family member wants to participate. Partners and sole proprietors are not eligible employees. A family member who is a common-law employee of the business may be eligible.');
      } else if (lead.entity_type === 'c_corp') {
        reasons.push('A C corporation owner-employee may participate if the person is a common-law employee. That person is usually highly compensated for testing.');
      } else {
        reasons.push('An owner or family member wants to participate. Eligibility depends on whether that person is a common-law employee.');
      }
    }
    if (plan.allow_employee_account === true) {
      reasons.push('Employer grants may go to an employee’s own account during the growth period. Department of Labor conditions apply to that design.');
    }
    if (fundingUsesSalary(plan.funding_mode) && (lead.has_existing_125_plan === 'no' || lead.has_existing_125_plan === 'unsure')) {
      reasons.push('Salary reduction has to run through a Section 125 cafeteria plan. No cafeteria plan was confirmed, so this sample does not include an amendment. A cafeteria plan must be adopted or confirmed before salary reduction can start.');
    }
    if (isIsoDate(plan.effective_date) && plan.effective_date < asOf) {
      reasons.push('The effective date is before today. Contributions made before the plan is signed may not qualify. Consider using today or a later date.');
    }
    if (isIsoDate(plan.effective_date) && +plan.effective_date.slice(0, 4) >= 2028) {
      reasons.push('The Section 128 limit for ' + plan.effective_date.slice(0, 4) + ' has not been published. This sample does not invent an indexed dollar amount. Confirm the published limit before any contribution is made for that year.');
    }
    if (lead.collectively_bargained_employees === 'yes') {
      reasons.push('Collectively bargained employees were reported. Testing exclusions apply only when their conditions are met.');
    }
    if (plan.state && plan.state !== 'FL' && plan.state !== 'GA') {
      reasons.push('The employer is in ' + plan.state + '. Employers in any U.S. state can prepare this sample. State income-tax treatment is separate from the federal exclusion.');
    }
    return { required: reasons.length > 0, reasons: reasons };
  }

  function validateSubmission(body, opts) {
    var src = body || {};
    var flat = {};
    var key;
    var plan = src.plan || {};
    var lead = src.lead || {};
    for (key in plan) if (Object.prototype.hasOwnProperty.call(plan, key)) flat[key] = plan[key];
    for (key in lead) if (Object.prototype.hasOwnProperty.call(lead, key)) flat[key] = lead[key];
    return validate(flat, opts);
  }

  function stepFields(step) {
    if (step === 1) return ['employer_name', 'employer_ein', 'street', 'city', 'state', 'zip', 'contact_name', 'contact_title', 'contact_email', 'contact_phone', 'total_employee_count'];
    if (step === 2) return ['funding_mode', 'employer_annual_grant', 'annual_cap_mode', 'fixed_annual_cap', 'allow_employee_account', 'eligibility_class', 'eligibility_class_other', 'waiting_days', 'plan_name', 'effective_date', 'participating_employers', 'entity_type', 'related_businesses', 'owners_or_family_want_to_participate', 'collectively_bargained_employees', 'has_existing_125_plan'];
    if (step === 3) return ['administrator_name', 'administrator_contact', 'signer_name', 'signer_title', 'cafeteria_plan_name', 'cafeteria_amendment_date', 'election_cutoff_days'];
    return [];
  }

  return {
    TEMPLATE_VERSION: TEMPLATE_VERSION,
    GUIDANCE_AS_OF: GUIDANCE_AS_OF,
    FIRST_CONTRIBUTION_DATE: FIRST_CONTRIBUTION_DATE,
    PUBLISHED_S128_CEILING: PUBLISHED_S128_CEILING,
    KNOWN_LIMITS: KNOWN_LIMITS,
    US_STATES: US_STATES,
    todayIso: todayIso,
    formatLongDate: formatLongDate,
    formatMoney: formatMoney,
    formatEinLive: formatEinLive,
    formatPhone: formatPhone,
    formatPhoneLive: formatPhoneLive,
    suggestPlanName: suggestPlanName,
    fundingLabel: fundingLabel,
    entityLabel: entityLabel,
    fundingUsesGrant: fundingUsesGrant,
    fundingUsesSalary: fundingUsesSalary,
    capText: capText,
    salaryCapacity: salaryCapacity,
    capacityMessage: capacityMessage,
    limitForYear: limitForYear,
    validate: validate,
    validateSubmission: validateSubmission,
    stepFields: stepFields,
    looksLikeNameList: looksLikeNameList
  };
})();
/**
 * Educational-tool terms. Version s128-terms-2026-10-09.
 * Draft wording for DK Benefits LLC's own attorney to review before go-live.
 * Not itself legal advice. Paragraph 2 says asking DK Benefits LLC for a copy
 * does not create an advisory relationship. The paragraph after the sample-draft
 * sentence says the documents are free to download on the final screen, are not
 * emailed to the employer, and that a later copy is a request to DK Benefits LLC.
 * AS_OF is unchanged. The checkbox sentence is the shorter v0.4 label.
 */
var S128Terms = (function () {
  var VERSION = 's128-terms-2026-10-09';
  var AS_OF = 'October 8, 2026';

  var PARAGRAPHS = [
    'DK Benefits LLC provides this Section 128 Trump Account contribution program tool as an educational resource to help employers. It produces a sample template only.',
    'The tool and the documents are not legal advice, tax advice, accounting advice, or ERISA advice. Using the tool, downloading a document, or asking DK Benefits LLC for a copy does not create an attorney-client relationship, a tax-advisor relationship, or any other advisory relationship.',
    'DK Benefits LLC and Daniel Kirves do not review, approve, or verify the documents or the information the employer enters. The employer is solely responsible for the accuracy of that information, for deciding whether to adopt a program, for customizing the documents, for adoption and implementation, and for ongoing compliance and operation.',
    'Consult your own attorney and tax advisor before adopting or operating any program. Final Section 128 regulations have not been issued. This sample reflects guidance as of ' + AS_OF + ', including the proposed regulations in REG-101355-26 and Treasury Decision 10056. Law and guidance may change.',
    'The documents are a sample draft for the employer’s review with its own advisors. They are not adopted until the employer signs them. The signature line and the date line are left blank. Generating or downloading a file does not adopt a program and does not amend a cafeteria plan.',
    'The tool and the documents are free. The employer can download the documents on the final screen at no charge. The documents are not emailed to the employer. When the documents are created, the employer’s answers and a copy of the documents are sent to DK Benefits LLC. If the employer needs a copy later, it may contact DK Benefits LLC at 407-476-5076 or dan@dkbenefits.net. DK Benefits LLC will try to provide one but does not guarantee that a copy is kept or can be retrieved.',
    'The tool and the documents are provided “as is” and “as available,” without warranties of any kind, express or implied, including warranties of accuracy, fitness for a particular purpose, and non-infringement.',
    'To the fullest extent permitted by law, DK Benefits LLC and Daniel Kirves have no liability for any use of, or reliance on, the tool or the documents, including a decision to adopt, not to adopt, or to operate a program.',
    'The employer agrees to indemnify and hold harmless DK Benefits LLC and Daniel Kirves from claims, damages, losses, and reasonable expenses arising out of the employer’s use of the tool, reliance on the sample documents, or adoption or operation of a program, except to the extent caused by DK Benefits LLC’s intentional misconduct. This indemnity applies only to the extent the law allows.',
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
 * Deterministic Section 128 DOCX builder. Template s128-v1.0-2026-10-09.
 * Language is the Employer Plan (Articles 1–12 and the adoption agreement),
 * with the October 8, 2026 research edits applied. No live drafting.
 */
var S128Docgen = (function () {
  var W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
  var R = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
  var FOOTER = S128Terms.FOOTER;

  function xml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  function money(plan, amount) {
    return S128Model.formatMoney(amount);
  }

  function longDate(iso) {
    return S128Model.formatLongDate(iso);
  }

  function usesGrant(plan) { return S128Model.fundingUsesGrant(plan.funding_mode); }
  function usesSalary(plan) { return S128Model.fundingUsesSalary(plan.funding_mode); }

  function waitingText(days) {
    if (days === 0) return '0 calendar days of employment (eligible on hire)';
    return days + ' calendar days of employment';
  }

  function noticeDays(plan) {
    var n = Number(plan.election_cutoff_days);
    if (!isFinite(n)) n = 0;
    n = Math.floor(n);
    if (n < 0) n = 0;
    if (n > 30) n = 30;
    return String(n);
  }

  function employersText(plan) {
    if (!plan.participating_employers || !plan.participating_employers.length) {
      return 'None (the sponsoring Employer is the sole participating employer)';
    }
    return plan.participating_employers.join('; ');
  }

  function recipientText(plan) {
    if (plan.allow_employee_account) {
      return 'eligible dependent Trump accounts and an eligible employee’s own Trump account during the growth period';
    }
    return 'eligible dependent Trump accounts only';
  }

  function accountLimitSentence(plan) {
    var year = +String(plan.effective_date).slice(0, 4);
    if (year >= 2028) {
      return 'Section 530A imposes a separate account-level annual contribution limit. The base amount is adjusted after 2027. Section 128 contributions count toward that limit. Qualified pilot, qualified general, and qualified rollover contributions receive their applicable statutory treatment. The employee and responsible party must coordinate other account deposits. The administrator processes trustee rejections and known errors. The Employer is not required to enforce the separate account-level limit.';
    }
    return 'Section 530A imposes a separate account-level annual contribution limit, generally $5,000 for 2026 and 2027, adjusted after 2027. Section 128 contributions count toward that limit. Qualified pilot, qualified general, and qualified rollover contributions receive their applicable statutory treatment. The employee and responsible party must coordinate other account deposits. The administrator processes trustee rejections and known errors. The Employer is not required to enforce the separate account-level limit.';
  }

  function article4Funding(plan) {
    if (plan.funding_mode === 'salary_reduction_only') {
      return 'The funding method is salary reduction only. No employer grant is provided. Contributions are made only by salary reduction, which begins only after the Section 125 plan permits the benefit.';
    }
    var grant = 'The Employer provides a uniform annual grant of ' + money(plan, plan.employer_annual_grant) + ' once per employee per calendar year. It is paid with the next practicable regular payroll remittance after eligibility, written designation, and account verification are complete for that year. The grant is not prorated for a partial year. The employee must be eligible and employed when payment is made. Rehire does not create a second grant in the same year. No grant is payable as cash or in exchange for declining participation.';
    if (plan.funding_mode === 'combined') {
      return 'The funding method is an employer grant and employee salary reduction. ' + grant + ' Salary reduction begins only after the Section 125 plan permits the benefit.';
    }
    return 'The funding method is an employer grant only. ' + grant;
  }

  function article4Recipients(plan) {
    var tail = ' Every account beneficiary must remain in the growth period when a program contribution is made.';
    if (plan.funding_mode === 'salary_reduction_only') {
      return 'Salary reduction may be directed only to Trump accounts of the employee’s qualifying dependents. No Section 125 salary reduction may fund the employee’s own account.' + tail;
    }
    if (plan.funding_mode === 'combined') {
      return 'Employer grants may be directed to ' + recipientText(plan) + '. Salary reduction may be directed only to Trump accounts of the employee’s qualifying dependents. No Section 125 salary reduction may fund the employee’s own account.' + tail;
    }
    return 'Employer grants may be directed to ' + recipientText(plan) + '.' + tail;
  }

  function article5Cap(plan) {
    var who = usesSalary(plan)
      ? 'including employer grants and salary reduction'
      : 'including employer grants';
    if (plan.funding_mode === 'salary_reduction_only') who = 'including salary reduction';
    var tail = '';
    if (plan.annual_cap_mode === 'fixed') tail = ' A fixed employer cap does not increase automatically.';
    else if (+String(plan.effective_date).slice(0, 4) < 2028) tail = ' A cap equal to the statutory limit follows published adjustments.';
    return 'The program annual cap is ' + S128Model.capText(plan) + '. Total Section 128 contributions attributable to an employee, ' + who + ', may not exceed the lesser of that cap and the Section 128(b) statutory limit.' + tail;
  }

  function combinedShareSentence(plan) {
    var info = S128Model.salaryCapacity(plan);
    var grant = money(plan, plan.employer_annual_grant);
    if (info && info.room != null) {
      return 'The employer grant and employee salary reduction together cannot exceed the annual limit per employee. With a ' + grant + ' grant, an employee can elect up to ' + S128Model.formatMoney(info.room) + ' through payroll.';
    }
    return 'The employer grant and employee salary reduction together cannot exceed the annual limit per employee. Salary reduction is limited to the amount left after the employer grant.';
  }

  function article5Tracking(plan) {
    var base = 'The administrator tracks actual contributions and amounts pending transmission across participating employers and all programs required to be aggregated.';
    if (plan.funding_mode === 'combined') {
      return base + ' ' + combinedShareSentence(plan) + ' Any amount reported by the employee from an unrelated employer is considered when setting prospective elections, to the extent practicable.';
    }
    if (plan.funding_mode === 'salary_reduction_only') {
      return base + ' Any amount reported by the employee from an unrelated employer is considered when setting prospective elections, to the extent practicable.';
    }
    return base + ' Any amount reported by the employee from an unrelated employer is considered when applying prospective limits, to the extent practicable.';
  }

  function article5Carryover(plan) {
    if (usesSalary(plan)) {
      return 'A contribution is counted in the calendar year actually made during the growth period. This program provides no prior-year catch-up allocation, carryover of unused salary reduction authority, or use-it-or-lose-it spending account. Amounts already deposited belong to the account beneficiary.';
    }
    return 'A contribution is counted in the calendar year actually made during the growth period. This program provides no prior-year catch-up allocation or use-it-or-lose-it spending account. Amounts already deposited belong to the account beneficiary.';
  }

  function article7(plan) {
    if (!usesSalary(plan)) {
      return [{
        style: 'Heading2',
        text: 'Article 7 Reserved'
      }, {
        style: null,
        text: 'Reserved: salary reduction is not offered under this Program, and adding it requires a prospective written amendment to this Program and to the Employer’s Section 125 cafeteria plan.'
      }];
    }
    return [
      { style: 'Heading2', text: 'Article 7 Salary reduction' },
      { style: null, text: 'The Adoption Agreement makes salary reduction available under this Program. An employee may initiate, increase, decrease, or revoke an election prospectively at any time during the plan year, subject to ' + noticeDays(plan) + ' calendar days of payroll processing notice. Administration must permit changes and revocations to become effective at least monthly and only as to salary not yet currently available. No qualifying life event is required.' },
      { style: null, text: 'Elections identify the amount per payroll and the effective payroll date. The administrator limits deductions to the available annual amount, applicable compensation, and verified eligible dependent accounts. No retroactive election is permitted. Salary reduction stops before the dependent’s growth period ends and when the employee revokes the election, employment or eligibility ends, or applicable limits require a stop.' },
      { style: null, text: 'The employer remits authorized salary reduction promptly under its regular payroll remittance process. Deductions continue only while they can be sent to valid eligible accounts. If a contribution is rejected, the administrator investigates, retries only when a lawful eligible transfer is available, and otherwise returns an untransferred deduction through payroll with the appropriate wage and withholding adjustments. ' + (plan.funding_mode === 'combined'
        ? 'A correction does not authorize retroactive salary reduction or a cash substitute for an employer grant.'
        : 'A correction does not authorize retroactive salary reduction.') }
    ];
  }

  function article8Notice(plan) {
    var items = 'eligibility, funding, contribution limits, designation requirements, ';
    if (usesSalary(plan)) items += 'available election changes, ';
    items += 'tax treatment, the administrator contact, and that an account automatically created by the Treasury Department cannot receive Program contributions; after a parent or guardian claims it, contributions can go only to the claimed account, once that account is activated';
    return 'The employer gives all eligible employees reasonable written notice of the program’s availability and terms before participation and when material terms change. The notice identifies ' + items + '. Electronic delivery must provide a practical way for employees to obtain the terms.';
  }

  function article9Payroll(plan) {
    if (plan.funding_mode === 'salary_reduction_only') {
      return 'Payroll will distinguish salary reduction, qualifying contributions, and amounts reclassified as taxable. It will collect applicable employee taxes from available compensation and account for employer taxes. The employer will follow current federal reporting instructions and determine applicable state and local income and employment tax treatment separately.';
    }
    if (plan.funding_mode === 'combined') {
      return 'Payroll will distinguish employer grants, salary reduction, qualifying contributions, and amounts reclassified as taxable. It will collect applicable employee taxes from available compensation and account for employer taxes without reducing a stated grant except as law permits. The employer will follow current federal reporting instructions and determine applicable state and local income and employment tax treatment separately.';
    }
    return 'Payroll will distinguish employer grants, qualifying contributions, and amounts reclassified as taxable. It will collect applicable employee taxes from available compensation and account for employer taxes without reducing a stated grant except as law permits. The employer will follow current federal reporting instructions and determine applicable state and local income and employment tax treatment separately.';
  }

  function article9Tax(plan) {
    var base = 'Properly qualifying contributions are intended to be excluded from the employee’s federal gross income and generally from federal income tax withholding. They remain wages for Social Security, Medicare, and generally federal unemployment tax, and Railroad Retirement Tax Act compensation where applicable, unless a separate exclusion applies. Applicable wage bases and employer-specific exemptions remain relevant.';
    if (usesSalary(plan)) return base + ' Salary reduction does not create a payroll-tax exclusion for these contributions.';
    return base;
  }

  function article10Intro(plan) {
    var base = 'Eligibility, contributions, and benefits must not discriminate in favor of HCEs or their dependents. The employer applies objective eligibility criteria, uniform contribution terms, and the Section 128 tests, aggregating related employers and programs when required.';
    if (usesSalary(plan)) return base + ' Section 125 compliance is evaluated separately.';
    return base;
  }

  function article10Average(plan) {
    var included = 'Employer grants and salary reduction are included.';
    if (plan.funding_mode === 'employer_only') included = 'Employer grants are included.';
    if (plan.funding_mode === 'salary_reduction_only') included = 'Salary reduction contributions are included.';
    return 'The administrator evaluates the eligibility classification and the 55-percent average-benefits test under applicable law. For the average-benefits test, the administrator divides contributions for each HCE or NHCE group by the number of employees in that group receiving a positive contribution, after permitted exclusions. ' + included + ' Testing is performed as of the last day of the plan year. Interim checks may support prospective limits.';
  }

  function article11Corrections(plan) {
    if (usesSalary(plan)) {
      return 'The administrator documents an error’s nature, affected employee and accounts, contribution year and dates, amounts, determination date, and corrective action. It stops improper transfers and reconciles payroll and trustee records. Corrections may include fixing a designation, making a missed contribution when still permitted, returning untransferred deductions, or reclassifying deposits. A late payment is not assigned to an earlier contribution year.';
    }
    return 'The administrator documents an error’s nature, affected employee and accounts, contribution year and dates, amounts, determination date, and corrective action. It stops improper transfers and reconciles payroll and trustee records. Corrections may include fixing a designation, making a missed contribution when still permitted, or reclassifying deposits. A late payment is not assigned to an earlier contribution year.';
  }

  function article12(plan) {
    if (usesSalary(plan)) {
      return 'The employer may amend or terminate the program prospectively by a written instrument and reasonable notice. Amendments must preserve required eligibility, contribution, notice, and correction provisions. They cannot retroactively create a salary reduction election. Termination does not relieve the employer of remitting authorized deductions, furnishing statements, or completing corrections.';
    }
    return 'The employer may amend or terminate the program prospectively by a written instrument and reasonable notice. Amendments must preserve required eligibility, contribution, notice, and correction provisions. Termination does not relieve the employer of furnishing statements or completing corrections.';
  }

  function adoptionClose(plan) {
    var base = 'The undersigned employer adopts this agreement and Articles 1 through 12 as its separate written Section 128 Trump Account Contribution Program. The elections above are incorporated into the program and govern its administration.';
    if (usesSalary(plan)) {
      return base + ' Salary reduction is authorized only after corresponding provisions of the employer’s Section 125 cafeteria plan have been adopted and become effective.';
    }
    return base;
  }

  function planParagraphs(plan) {
    var rows = [
      { style: 'Title', text: 'Section 128 Trump Account Contribution Program' },
      { style: 'Heading1', text: 'Employer adoption agreement' },
      { style: null, text: 'Employer legal name: ' + plan.employer_name },
      { style: null, text: 'Employer EIN: ' + plan.employer_ein },
      { style: null, text: 'Effective date: ' + longDate(plan.effective_date) },
      { style: null, text: 'Employer address: ' + plan.employer_address },
      { style: null, text: 'Additional participating employers: ' + employersText(plan) },
      { style: null, text: 'Program name: ' + plan.plan_name },
      { style: null, text: 'Administrator: ' + plan.administrator_name },
      { style: null, text: 'Administrator contact: ' + plan.administrator_contact },
      { style: null, text: 'Eligible employee class: ' + plan.eligibility_class },
      { style: null, text: 'Waiting period: ' + waitingText(plan.waiting_days) },
      { style: 'Heading2', text: 'Funding elections' },
      { style: null, text: 'Funding method: ' + S128Model.fundingLabel(plan.funding_mode) }
    ];
    if (usesGrant(plan)) {
      rows.push({ style: null, text: 'Annual employer grant per employee: ' + money(plan, plan.employer_annual_grant) + ' (uniform flat grant, once per calendar year)' });
    }
    rows.push({ style: null, text: 'Annual total cap per employee: ' + S128Model.capText(plan) });
    if (usesGrant(plan)) {
      rows.push({ style: null, text: 'Employer grant recipients: ' + recipientText(plan) + '.' });
    }
    if (usesSalary(plan)) {
      rows.push({ style: null, text: 'Salary reduction election processing notice: ' + noticeDays(plan) + ' calendar days before payday' });
      if (plan.cafeteria_plan_name) {
        rows.push({ style: null, text: 'Section 125 plan name: ' + plan.cafeteria_plan_name });
        rows.push({ style: null, text: 'Section 125 amendment effective date: ' + longDate(plan.cafeteria_amendment_date) });
      } else {
        rows.push({ style: null, text: 'A Section 125 cafeteria plan was not confirmed. Salary reduction cannot start until a cafeteria plan is adopted or confirmed and amended for this benefit. A cafeteria-plan amendment is not included.' });
      }
    }
    rows.push({ style: null, text: adoptionClose(plan) });
    signatureBlock(plan).forEach(function (row) { rows.push(row); });

    rows.push({ style: 'Heading1', text: 'Plan purpose, definitions, and participation' });
    rows.push({ style: 'Heading2', text: 'Article 1 Purpose and governing terms' });
    var separate = usesSalary(plan)
      ? 'The Program is separate from the Employer’s Section 125 cafeteria plan and from each beneficiary’s individual Trump account.'
      : 'The Program is separate from each beneficiary’s individual Trump account.';
    rows.push({ style: null, text: 'The employer identified in the Adoption Agreement (the Employer) establishes the program named in that agreement (the Program) effective on the stated effective date, for the exclusive benefit of its eligible employees. The Program is intended to provide contributions eligible for exclusion from employees’ federal gross income under Internal Revenue Code Section 128. The Adoption Agreement is incorporated into the Program. ' + separate });
    rows.push({ style: null, text: 'The administrator identified in the Adoption Agreement applies these terms consistently, verifies account eligibility, coordinates contributions and payroll reporting, and maintains Program records. Administrative delegation does not change the Employer’s responsibility to follow the Program.' });
    rows.push({ style: null, text: 'The plan year is January 1 through December 31. The first plan year begins on the effective date and ends on December 31 of that year. Additional employers listed in the Adoption Agreement participate under the same terms. If none are listed, the sponsoring Employer is the sole participating employer.' });
    rows.push({ style: 'Heading2', text: 'Article 2 Definitions' });
    rows.push({ style: null, text: 'Employee means a common-law employee. It excludes self-employed individuals within Section 401(c)(1), including sole proprietors and partners, and a 2-percent S corporation shareholder within Section 1372(b), applying applicable ownership attribution rules. A director is not eligible solely because of director service. Ownership alone does not exclude an otherwise eligible common-law employee of a C corporation, subject to nondiscrimination rules.' });
    rows.push({ style: null, text: 'Dependent means an individual the employee anticipates will be the employee’s dependent under Section 152 for the contribution year. For a married couple filing jointly, a qualifying dependent is treated as the dependent of both spouses.' });
    rows.push({ style: null, text: 'Trump account means an account meeting Section 530A(b)(1). Growth period begins when the initial account is established and ends on December 31 of the calendar year in which the beneficiary attains age 17. Contributions under this program stop before January 1 of the year the beneficiary turns 18, even if the birthday occurs later in that year.' });
    rows.push({ style: null, text: 'HCE means a highly compensated employee under Section 414(q). NHCE means an employee who is not an HCE. Employers required to be aggregated under Section 414(b), (c), (m), or (o) are treated as one employer for the applicable Section 128 rules.' });
    rows.push({ style: 'Heading2', text: 'Article 3 Eligibility and voluntary participation' });
    rows.push({ style: null, text: 'Eligible employees are common-law employees in the class stated in the Adoption Agreement who complete its calendar-day waiting period and satisfy Article 2. Entry occurs upon completion of that period while in the eligible class, but not before the effective date. Each eligible employee must have a meaningful opportunity to participate. Participation requires a voluntary written request. Employees may decline without receiving a cash substitute.' });
    var endParticipation = usesSalary(plan)
      ? 'Participation ends when employment or eligible-class status ends, or the program terminates. The employer remains responsible for amounts already withheld and unresolved transfers or corrections. An employee may update account designations and certifications as provided below.'
      : 'Participation ends when employment or eligible-class status ends, or the program terminates. The employer remains responsible for unresolved transfers or corrections. An employee may update account designations and certifications as provided below.';
    rows.push({ style: null, text: endParticipation });

    rows.push({ style: 'Heading1', text: 'Contributions and annual limits' });
    rows.push({ style: 'Heading2', text: 'Article 4 Funding and allocation' });
    rows.push({ style: null, text: article4Funding(plan) });
    rows.push({ style: null, text: article4Recipients(plan) });
    rows.push({ style: null, text: 'An employee may allocate permitted contributions among one or more eligible accounts by a written designation totaling 100 percent. Allocations do not increase the employee’s total limit. Amounts are paid directly to verified Trump account trustees, never paid to the employee or dependent as cash or as reimbursement for an earlier personal contribution.' });
    rows.push({ style: 'Heading2', text: 'Article 5 Calendar year limits' });
    rows.push({ style: null, text: article5Cap(plan) });
    rows.push({ style: null, text: article5Tracking(plan) });
    rows.push({ style: null, text: 'The statutory exclusion applies per employee across all employers. The employee must report other-employer contributions to the administrator to support prospective limits. Excess contributions attributable to unrelated employers are treated under applicable tax law. Such excess alone does not invalidate an otherwise compliant Program.' });
    rows.push({ style: null, text: accountLimitSentence(plan) });
    rows.push({ style: null, text: article5Carryover(plan) });

    rows.push({ style: 'Heading1', text: 'Account designation and payroll elections' });
    rows.push({ style: 'Heading2', text: 'Article 6 Designation, certification, and verification' });
    rows.push({ style: null, text: 'Before any contribution, an employee submits a paper or electronic designation identifying the contribution year, each beneficiary and date of birth, the relationship to the employee, the trustee, secure payment instructions, and the allocation percentage. The employee certifies in writing that each beneficiary is the employee or an anticipated Section 152 dependent for that contribution year and that no facts known to the employee make the beneficiary ineligible for that calendar year.' });
    rows.push({ style: null, text: 'The employee renews the certification for each contribution year and promptly reports changes affecting eligibility, dependency, trustee, account status, allocation, or contributions from other employers. The employer may rely on the relationship and eligibility certifications unless it has actual knowledge they are incorrect. Dependency or ownership questions requiring interpretation are resolved before payment.' });
    rows.push({ style: null, text: 'The employer will independently verify that each destination is a valid Trump account using information supplied by the trustee, payroll processor, or another service provider through a method reasonably designed for that purpose. An employee’s assertion that an account is valid, standing alone, is insufficient. Verification confirms that the account can accept contributions under this Program. An account automatically established by the Secretary (an auto account) cannot receive Program contributions. After an auto account is claimed, Program contributions may be made only to the claimed Trump account that receives its balance, once that account is activated. Verification is documented before initial payment and refreshed when an account or trustee changes or contrary information arises.' });
    rows.push({ style: null, text: 'The employer will not restrict contributions to accounts maintained by a selected trustee or list of trustees. A payroll vendor’s limited trustee support does not change that rule. The administrator will arrange a workable alternative transfer process for a valid designated account. Contributions pending verification or transfer are tracked and resolved. The employer does not promise tax qualification or retroactive dating for delayed deposits.' });
    article7(plan).forEach(function (row) { rows.push(row); });

    rows.push({ style: 'Heading1', text: 'Employee notices, tax treatment, and records' });
    rows.push({ style: 'Heading2', text: 'Article 8 Notices and statements' });
    rows.push({ style: null, text: article8Notice(plan) });
    rows.push({ style: null, text: 'The employer furnishes each participating employee, on or before January 31, a written statement of Section 128 contributions made during the preceding calendar year. This obligation may be satisfied by correct reporting on Form W-2 under the instructions applicable for that year. For 2026, the instructions prescribe box 12, code TA. The employer provides any additional or corrected statement required to explain reclassification or an administrative error.' });
    rows.push({ style: null, text: 'At the time of every transfer, the employer affirmatively identifies in writing the amount transmitted as a Section 128 contribution to the trustee. Electronic transmission data may satisfy this requirement if they communicate the designation in writing. Nonqualifying amounts are separately identified and not represented as Section 128 contributions.' });
    rows.push({ style: 'Heading2', text: 'Article 9 Tax administration and record retention' });
    rows.push({ style: null, text: article9Tax(plan) });
    rows.push({ style: null, text: article9Payroll(plan) });
    rows.push({ style: null, text: 'The administrator maintains the executed plan and amendments, employer adoption data, eligible employee notices, annual certifications, trustee verification evidence, designations and elections, dated transfer records, trustee acknowledgments or rejections, payroll and annual statements, nondiscrimination calculations, and correction records. Records are retained for applicable tax and other legal periods and protected using access controls and secure transmission. Account and tax identifiers must be collected and transmitted securely.' });
    rows.push({ style: null, text: 'The employer does not guarantee an employee’s tax treatment, investment return, future account value, or eligibility for the separate federal pilot deposit. Account investments, distributions, and account-level tax reporting are handled by the trustee and responsible party under applicable law.' });

    rows.push({ style: 'Heading1', text: 'Testing, corrections, and employer authority' });
    rows.push({ style: 'Heading2', text: 'Article 10 Nondiscrimination' });
    rows.push({ style: null, text: article10Intro(plan) });
    rows.push({ style: null, text: article10Average(plan) });
    rows.push({ style: null, text: 'The administrator applies testing exclusions only when their conditions are satisfied. A testing exclusion does not itself exclude participation. HCE amounts may be limited prospectively under a consistent compliance procedure.' });
    rows.push({ style: 'Heading2', text: 'Article 11 Administrative failures and corrective notices' });
    rows.push({ style: null, text: article11Corrections(plan) });
    rows.push({ style: null, text: 'When a previously identified Section 128 contribution is determined not to qualify, the employer gives the trustee written notice of the account, contribution calendar year, and nonqualifying amount within 21 calendar days after determination. The employee is informed of the amount, year, reason, tax and statement corrections, and required action. Correction does not authorize unilateral withdrawal from the account.' });
    rows.push({ style: null, text: 'A nondiscrimination failure generally removes the exclusion for affected HCEs without removing it for NHCEs. Where legally available, an average-benefits failure may be remediated by timely treating the calculated HCE excess as gross income and applicable wages and reporting it by the Form W-2 furnishing deadline for the tested year, with trustee corrective notices. That partial remediation is not assumed to cure an eligibility or contribution-terms failure. Otherwise the employer applies the income inclusion required by law and corrects reporting.' });
    rows.push({ style: 'Heading2', text: 'Article 12 Amendment, termination, and individual ownership' });
    rows.push({ style: null, text: article12(plan) });
    rows.push({ style: null, text: 'The account belongs to its beneficiary and remains independent of employment. Participation is voluntary. The employer does not direct or influence investments, impose use or rollover restrictions beyond law, present the account or program as an employer-maintained ERISA pension or welfare plan, or receive payment or compensation in connection with an account. The employer imposes no vesting or forfeiture condition on money deposited into an account. Account-level rights are governed by Section 530A and the trustee’s instrument.' });
    return rows;
  }

  function amendmentParagraphs(plan) {
    if (!usesSalary(plan) || !plan.cafeteria_plan_name) return null;
    var capShare = plan.funding_mode === 'combined'
      ? combinedShareSentence(plan)
      : 'Salary reduction contributions attributable to an employee may not exceed that cap.';
    return [
      { style: 'Title', text: 'Amendment to ' + plan.cafeteria_plan_name },
      { style: 'Heading2', text: 'Section 128 Trump Account Contribution Benefit' },
      { style: 'Heading2', text: 'Adoption and qualified benefit' },
      { style: null, text: plan.employer_name + ' amends ' + plan.cafeteria_plan_name + ' effective ' + longDate(plan.cafeteria_amendment_date) + ' to make available the Section 128 Trump Account contribution benefit described in ' + plan.plan_name + ', maintained as a separate written program. Eligible participants may elect prospective salary reduction contributions to verified Trump accounts of their anticipated Section 152 dependents during those beneficiaries’ growth periods. Contributions to a participant’s own Trump account are not available through this cafeteria plan.' },
      { style: 'Heading2', text: 'Eligibility and amounts' },
      { style: null, text: 'Participation requires eligibility under both this cafeteria plan and the separate Section 128 program named ' + plan.plan_name + ' (the Program). The Section 128 program annual cap is ' + S128Model.capText(plan) + '. ' + capShare + ' Account designation, certification, verification, allocation, notices, and corrections follow the Program.' },
      { style: 'Heading2', text: 'Prospective election changes' },
      { style: null, text: 'A participant may initiate, increase, decrease, or revoke a salary reduction election for this benefit prospectively at any time during the plan year. No qualifying life event is required. The participant must provide ' + noticeDays(plan) + ' calendar days of payroll processing notice. Administration must permit changes and revocations to become effective at least monthly and only as to salary not yet currently available. No retroactive election or change is permitted. This provision controls over a general irrevocability or change-in-status restriction in the cafeteria plan solely for this benefit.' },
      { style: 'Heading2', text: 'Payment, tax treatment, and compliance' },
      { style: null, text: 'Authorized deductions are remitted directly to independently verified Trump account trustees under the Section 128 program. Elections end or are adjusted when the participant or account becomes ineligible, the beneficiary’s growth period ends, the participant revokes an election, the maximum is reached, or a compliance limit applies. Payroll will apply federal gross income exclusion only to qualifying amounts and will retain applicable Social Security, Medicare, unemployment, and other required wage treatment. This amendment creates no payroll-tax exclusion.' },
      { style: null, text: 'The employer will evaluate cafeteria plan nondiscrimination independently of Section 128 testing. The amendment does not establish an FSA grace period, carryover, uniform coverage rule, or prior-year contribution designation. Except for the specific benefit and election provisions above, the cafeteria plan remains governed by its existing terms and applicable law.' }
    ].concat(signatureBlock(plan));
  }

  function signatureBlock(plan) {
    function line(text, spaceBefore) {
      return {
        text: text,
        spaceBefore: spaceBefore,
        spaceAfter: 40,
        keepNext: true,
        keepLines: true
      };
    }
    return [
      { style: 'Heading2', text: 'Employer signature', keepNext: true, keepLines: true },
      line('Authorized representative: ' + plan.signer_name, 120),
      line('Title: ' + plan.signer_title, 160),
      line('Signature: ________________________________', 200),
      { text: 'Date: ________________', spaceBefore: 200, spaceAfter: 40, keepLines: true }
    ];
  }

  function checklistLimitText(plan) {
    if (plan.annual_cap_mode === 'fixed' && plan.fixed_annual_cap) return money(plan, plan.fixed_annual_cap) + ' per employee per year';
    var year = +String(plan.effective_date || '').slice(0, 4);
    var known = S128Model.limitForYear(year);
    if (known) return money(plan, known.s128) + ' per employee per year';
    return 'the per-employee Section 128 limit the IRS publishes for that year';
  }

  function checklistContributionLine(plan) {
    var limit = checklistLimitText(plan);
    var grant = usesGrant(plan) ? money(plan, plan.employer_annual_grant) : '';
    if (plan.funding_mode === 'employer_only') {
      return 'Pay the ' + grant + ' grant once a year for each participating employee, directly to the verified Trump account.';
    }
    if (plan.funding_mode === 'salary_reduction_only') {
      return 'Start payroll deductions once the cafeteria plan permits them, up to ' + limit + '.';
    }
    return 'Pay the ' + grant + ' grant once a year and start payroll deductions once the cafeteria plan permits them. Together they can’t exceed ' + limit + '.';
  }

  function signChecklistLine(plan) {
    var when = longDate(plan.effective_date);
    var today = S128Model.todayIso();
    if (plan.effective_date && today && plan.effective_date < today) {
      return 'Sign and date the plan (page 1) as soon as possible. It takes effect on ' + when + '.';
    }
    return 'Sign and date the plan (page 1) before the effective date (' + when + ').';
  }

  function emailSignLine(plan) {
    var when = longDate(plan.effective_date);
    var today = S128Model.todayIso();
    if (plan.effective_date && today && plan.effective_date < today) {
      return 'Sign and date the plan (page 1) as soon as you can.';
    }
    return 'Sign and date the plan (page 1) before ' + when + '.';
  }

  function emailContributionLine(plan) {
    var limit = checklistLimitText(plan);
    var grant = usesGrant(plan) ? money(plan, plan.employer_annual_grant) : '';
    if (plan.funding_mode === 'employer_only') {
      return 'Pay the ' + grant + ' grant once a year for each participating employee, straight to their verified Trump account.';
    }
    if (plan.funding_mode === 'salary_reduction_only') {
      return 'Start payroll deductions once your cafeteria plan allows them, up to ' + limit + '.';
    }
    return 'Pay the ' + grant + ' grant once a year and start payroll deductions once your cafeteria plan allows them. Together they can\'t go over ' + limit + '.';
  }

  function emailChecklistLines(plan) {
    var lines = [emailSignLine(plan)];
    if (usesSalary(plan)) {
      lines.push(plan.cafeteria_plan_name
        ? 'Add the Section 125 amendment to your cafeteria plan and sign it.'
        : 'Adopt or confirm a Section 125 cafeteria plan and amend it for this benefit before any payroll deductions start. No amendment was prepared.');
    }
    lines.push('Let payroll know the contributions aren\'t subject to income tax, but Social Security and Medicare still apply. They go on the W-2 in box 12, code TA.');
    lines.push('Send your employees a short note letting them know about the program.');
    lines.push(plan.allow_employee_account
      ? 'Get each employee\'s child\'s Trump account info (or the employee\'s own account, if the employee is 17 or younger) and make sure the account is active. If the Treasury opened it automatically, a parent has to claim it first.'
      : 'Get each employee\'s child\'s Trump account info and make sure the account is active. If the Treasury opened it automatically, a parent has to claim it first.');
    lines.push(emailContributionLine(plan));
    return lines;
  }

  function checklistLines(plan) {
    var lines = [
      signChecklistLine(plan)
    ];
    if (usesSalary(plan)) {
      lines.push(plan.cafeteria_plan_name
        ? 'Add the Section 125 amendment to your cafeteria plan and sign it.'
        : 'Adopt or confirm a Section 125 cafeteria plan and amend it for this benefit before any payroll deductions start. No amendment was prepared.');
    }
    lines.push('Tell payroll: contributions are excluded from income tax but still subject to Social Security and Medicare, reported on W-2 box 12 code TA.');
    lines.push('Give employees a short written notice of the program.');
    lines.push(plan.allow_employee_account
      ? 'Collect Trump account information for each employee’s child (or the employee’s own account, if the employee is 17 or younger) and make sure the account is active. Accounts the Treasury opened automatically must be claimed by a parent first.'
      : 'Collect each employee’s child’s Trump account information and make sure the account is active. Accounts the Treasury opened automatically must be claimed by a parent first.');
    lines.push(checklistContributionLine(plan));
    return lines;
  }

  function guideParagraphs(plan) {
    var rows = [
      { style: 'Title', text: 'Section 128 implementation checklist' },
      { style: null, text: plan.employer_name + ' — ' + S128Model.fundingLabel(plan.funding_mode) + '.' }
    ];
    checklistLines(plan).forEach(function (line, index) {
      rows.push({ style: null, text: (index + 1) + '. ' + line });
    });
    return rows;
  }

  function followUpFirstName(lead) {
    var name = String(lead && lead.contact_name || '').trim();
    var first = name.split(/\s+/)[0] || '';
    return first;
  }

  function followUpEmailText(plan, lead, links) {
    links = links || {};
    lead = lead || {};
    plan = plan || {};
    var section125 = links.section125Url || '';
    var rates = links.ratesUrl || '';
    var first = followUpFirstName(lead);
    var employer = plan.employer_name || 'your company';
    var lines = [
      first ? ('Hi ' + first + ',') : 'Hi there,',
      '',
      'I just saw you put together your Section 128 plan for ' + employer + '. Thanks so much for giving my tool a try. I really appreciate it!',
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
      'Oh, and if you ever need a Section 125 plan, or yours could use a refresh, I\'ve got a free tool for that too:',
      section125,
      '',
      'Also, just so you know, I\'m an employee benefits broker. No pressure at all, but I\'d be happy to help you shop and negotiate your group health and other benefits. I even have some rates you can check out online right now:',
      rates,
      '',
      'Would you mind giving me a shot to see what I can do for you? I\'d love to hear from you.',
      '',
      'Also, just so it\'s clear, I don\'t sell, market, open, or administer Trump accounts. And legally I have to mention that the tool is educational and isn\'t legal or tax advice.',
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
    if (links.section125Url) allowed[links.section125Url] = true;
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

  function visitorEmailText(plan, lead, links) {
    return followUpEmailText(plan, lead, links);
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
      '<dc:title>' + xml(props.title || 'Section 128 Trump Account Contribution Program') + '</dc:title>' +
      '<dc:subject>Section 128 Trump Account Contribution Program.</dc:subject>' +
      '<dc:creator>DK Benefits LLC</dc:creator>' +
      '<cp:lastModifiedBy>DK Benefits LLC</cp:lastModifiedBy>' +
      '<dc:description>Template ' + xml(S128Model.TEMPLATE_VERSION) + '.</dc:description>' +
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

  function fileVersion() {
    var m = /^s128-(v[\d.]+)-/.exec(S128Model.TEMPLATE_VERSION);
    return m ? '_' + m[1] : '';
  }

  function planFileName(plan) {
    return safeFilePart(plan.employer_name) + '_Section_128_Plan' + fileVersion() + '.docx';
  }

  function amendmentFileName(plan) {
    return safeFilePart(plan.employer_name) + '_Section_125_Amendment' + fileVersion() + '.docx';
  }

  function guideFileName(plan) {
    return safeFilePart(plan.employer_name) + '_Section_128_Implementation_Guide' + fileVersion() + '.docx';
  }

  function pdfFileName(docxName) {
    return String(docxName).replace(/\.docx$/i, '.pdf');
  }

  function buildPlanDocx(plan) {
    return buildDocx(planParagraphs(plan), {
      title: plan.plan_name,
      created: S128Model.GUIDANCE_AS_OF
    });
  }

  function buildAmendmentDocx(plan) {
    var rows = amendmentParagraphs(plan);
    if (!rows) return null;
    return buildDocx(rows, {
      title: 'Amendment to ' + plan.cafeteria_plan_name,
      created: S128Model.GUIDANCE_AS_OF
    });
  }

  function buildGuideDocx(plan) {
    return buildDocx(guideParagraphs(plan), {
      title: 'Section 128 implementation checklist',
      created: S128Model.GUIDANCE_AS_OF
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
    amendmentParagraphs: amendmentParagraphs,
    guideParagraphs: guideParagraphs,
    visitorEmailText: visitorEmailText,
    followUpEmailText: followUpEmailText,
    followUpEmailHtml: followUpEmailHtml,
    buildDocx: buildDocx,
    buildPlanDocx: buildPlanDocx,
    buildAmendmentDocx: buildAmendmentDocx,
    buildGuideDocx: buildGuideDocx,
    planFileName: planFileName,
    amendmentFileName: amendmentFileName,
    guideFileName: guideFileName,
    pdfFileName: pdfFileName,
    plainText: plainText,
    zipStore: zipStore
  };
})();
/**
 * DK Benefits Section 128 lead service.
 * Container-bound to a new spreadsheet. Do not paste this into the quote-tool script.
 *
 * Also add these script files, pasted from the repo with no edits:
 *   S128Model.gs  = section128/s128-model.js
 *   S128Terms.gs  = section128/s128-terms.js
 *   S128Docgen.gs = section128/s128-docgen.js
 * Or paste section128/apps-script/S128Combined.gs as the only script file.
 *
 * Deploy as a web app: Execute as Me, Who has access: Anyone.
 * See README.md in this folder.
 */
var S128_NOTIFY_EMAIL = 'dan@dkbenefits.net';
var S128_SUBMISSIONS_SHEET = 'Submissions';
var S128_EVENTS_SHEET = 'Events';
var S128_VISITOR_HOURLY_LIMIT = 3;
var S128_DAILY_LEAD_CAP = 50;
var S128_MIN_ELAPSED_MS = 3000;
var S128_PENDING_STALE_MS = 45000;
var S128_MAX_FILE_BYTES = 1500000;
var S128_MAX_FILES = 8;
var S128_DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
var S128_PDF_MIME = 'application/pdf';
var S128_FOLLOWUPS_SHEET = 'FollowUps';
var S128_FOLLOWUP_DELAY_MS = 10 * 60 * 1000;
var S128_FOLLOWUP_HANDLER = 's128SendDueFollowUps';
var S128_ACCEPTED_TERMS_VERSIONS = [S128Terms.VERSION, 's128-terms-2026-10-08b'];
var SECTION125_URL = 'https://www.dkbenefits.net/section125plantool';
var RATES_URL = 'https://www.dkbenefits.net/instant-group-quote';

var S128_FOLLOWUP_HEADERS = [
  'timestamp', 'email', 'name', 'company', 'plan_json', 'status', 'test', 'submission_id', 'error', 'sent_at'
];

var S128_SUBMISSION_HEADERS = [
  'timestamp', 'submission_id', 'status', 'test', 'company', 'state', 'contact_name',
  'contact_email', 'contact_phone', 'employees', 'funding_mode', 'effective_date',
  'review_required', 'review_reasons', 'page_url', 'template_version',
  'lead_emailed', 'visitor_emailed', 'error', 'payload_json',
  'terms_version', 'terms_accepted_at'
];

function doGet() {
  return ContentService
    .createTextOutput('DK Benefits Section 128 lead service is deployed. Submit the form to deliver a lead.')
    .setMimeType(ContentService.MimeType.TEXT);
}

function doPost(e) {
  var payload;
  try {
    payload = JSON.parse((e && e.postData && e.postData.contents) || '{}');
  } catch (err) {
    return s128Json_({ ok: false, error: 'The submission could not be read.' });
  }
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return s128Json_({ ok: false, error: 'The submission could not be read.' });
  }
  if (payload.event !== 's128_submission') {
    return s128Json_({ ok: false, error: 'Unrecognized submission.' });
  }
  try {
    return s128Json_(s128Handle_(payload));
  } catch (err) {
    try { s128LogEvent_('failed', payload.submissionId || '', err && err.message ? err.message : 'failed'); } catch (ignore) {}
    return s128Json_({ ok: false, error: 'The sample could not be sent.' });
  }
}

function s128Handle_(payload) {
  if (payload.hp) {
    s128LogEvent_('rejected_honeypot', payload.submissionId || '', 'honeypot');
    return { ok: false, error: 'The sample could not be sent.' };
  }
  var started = Date.parse(payload.startedAt || '');
  var submitted = Date.parse(payload.submittedAt || '') || Date.now();
  if (!started || submitted - started < S128_MIN_ELAPSED_MS) {
    s128LogEvent_('rejected_fast', payload.submissionId || '', 'too fast');
    return { ok: false, error: 'The sample could not be sent.' };
  }
  if (!payload.submissionId || String(payload.submissionId).length < 8 || String(payload.submissionId).length > 80) {
    return { ok: false, error: 'The submission id is missing.' };
  }

  var ack = payload.acknowledgement || {};
  if (ack.accepted !== true || !ack.acceptedAt || !Date.parse(ack.acceptedAt) || S128_ACCEPTED_TERMS_VERSIONS.indexOf(ack.termsVersion) === -1) {
    s128LogEvent_('rejected_terms', payload.submissionId, 'terms');
    return { ok: false, error: 'The terms acknowledgement is missing.' };
  }

  var checked = S128Model.validateSubmission(payload, { asOf: s128Today_() });
  if (!checked.ok) {
    s128LogEvent_('rejected_validation', payload.submissionId, checked.errors.map(function (item) { return item.field; }).join(','));
    return { ok: false, error: checked.errors[0] ? checked.errors[0].message : 'Check the form and try again.', fields: checked.errors };
  }

  s128EnsureFollowUpTrigger_();

  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  var existing;
  var sendLead = true;
  try {
    existing = s128FindSubmission_(String(payload.submissionId));
    if (existing && existing.leadEmailed) {
      return {
        ok: true,
        duplicate: true,
        leadEmailed: true,
        visitorEmailed: false,
        followUpQueued: s128AppendFollowUp_(payload, checked)
      };
    }
    if (existing && existing.status === 'pending' && !existing.leadEmailed) {
      var age = Date.now() - Date.parse(existing.timestamp || '');
      if (!isNaN(age) && age >= 0 && age < S128_PENDING_STALE_MS) {
        return { ok: false, error: 'This submission is already being sent. Wait a moment and retry.' };
      }
    }
    sendLead = !(existing && existing.leadEmailed);
    if (sendLead && s128CountLeadsToday_(String(payload.submissionId)) >= S128_DAILY_LEAD_CAP) {
      s128LogEvent_('rejected_daily_cap', payload.submissionId, 'cap');
      return { ok: false, error: 'The daily email limit has been reached. Questions about DK Benefits’ services? 407-476-5076 · dan@dkbenefits.net' };
    }
    s128UpsertSubmission_(
      existing,
      payload,
      checked,
      'pending',
      '',
      !!(existing && existing.leadEmailed),
      !!(existing && existing.visitorEmailed)
    );
  } finally {
    lock.releaseLock();
  }

  var files;
  try {
    files = s128AttachmentFiles_(payload, checked.plan);
  } catch (buildErr) {
    s128Mark_(String(payload.submissionId), 'failed', buildErr.message || 'document error', !!(existing && existing.leadEmailed), !!(existing && existing.visitorEmailed));
    return { ok: false, error: 'The sample could not be prepared for email.' };
  }

  var quota = 0;
  try { quota = MailApp.getRemainingDailyQuota(); } catch (ignoreQuota) { quota = 0; }
  if (sendLead && quota < 1) {
    s128Mark_(String(payload.submissionId), 'failed', 'mail quota', false, !!(existing && existing.visitorEmailed));
    return { ok: false, error: 'Email delivery is temporarily unavailable.' };
  }

  var leadSent = !!(existing && existing.leadEmailed);
  if (sendLead) {
    try {
      MailApp.sendEmail(s128LeadMessage_(payload, checked, files));
      leadSent = true;
      s128Mark_(String(payload.submissionId), 'partial', '', true, false);
    } catch (mailErr) {
      s128Mark_(String(payload.submissionId), 'failed', mailErr.message || 'mail failed', false, false);
      return { ok: false, error: 'The request could not be sent.' };
    }
  }

  var followQueued = false;
  if (leadSent && payload.sendVisitorCopy !== false) {
    var queueLock = LockService.getScriptLock();
    queueLock.waitLock(20000);
    try {
      followQueued = s128AppendFollowUp_(payload, checked);
    } catch (queueErr) {
      followQueued = false;
    } finally {
      queueLock.releaseLock();
    }
  }

  s128Mark_(String(payload.submissionId), 'sent', '', leadSent, false);
  s128LogEvent_('sent', payload.submissionId, (leadSent ? 'dan' : '') + (followQueued ? '+queued' : ''));
  return {
    ok: true,
    leadEmailed: leadSent,
    visitorEmailed: false,
    followUpQueued: followQueued,
    duplicate: false
  };
}

function s128AttachmentFiles_(payload, plan) {
  var accepted = [];
  var sawDocx = false;
  var incoming = payload.files;
  if (incoming && incoming.length) {
    for (var i = 0; i < incoming.length && accepted.length < S128_MAX_FILES; i++) {
      var file = s128CheckedFile_(incoming[i]);
      if (!file) continue;
      if (file.mime === S128_DOCX_MIME) sawDocx = true;
      accepted.push(file.blob);
    }
  }
  if (!sawDocx) {
    accepted.unshift(s128BytesBlob_(S128Docgen.buildPlanDocx(plan), S128_DOCX_MIME, S128Docgen.planFileName(plan)));
    var amendmentBytes = S128Docgen.buildAmendmentDocx(plan);
    if (amendmentBytes && accepted.length < S128_MAX_FILES) {
      accepted.push(s128BytesBlob_(amendmentBytes, S128_DOCX_MIME, S128Docgen.amendmentFileName(plan)));
    }
    if (accepted.length < S128_MAX_FILES) {
      accepted.push(s128BytesBlob_(S128Docgen.buildGuideDocx(plan), S128_DOCX_MIME, S128Docgen.guideFileName(plan)));
    }
  }
  return accepted.slice(0, S128_MAX_FILES);
}

function s128CheckedFile_(file) {
  if (!file || typeof file !== 'object') return null;
  var mime = String(file.mime || '');
  if (mime !== S128_DOCX_MIME && mime !== S128_PDF_MIME) return null;
  var raw = String(file.dataBase64 || '').replace(/\s+/g, '');
  if (!raw || raw.length > Math.ceil(S128_MAX_FILE_BYTES * 4 / 3) + 16) return null;
  var bytes;
  try { bytes = Utilities.base64Decode(raw); } catch (err) { return null; }
  if (!bytes || !bytes.length || bytes.length > S128_MAX_FILE_BYTES) return null;
  if (mime === S128_PDF_MIME) {
    if (bytes[0] !== 0x25 || bytes[1] !== 0x50 || bytes[2] !== 0x44 || bytes[3] !== 0x46) return null;
  } else if (bytes[0] !== 0x50 || bytes[1] !== 0x4B) {
    return null;
  }
  var ext = mime === S128_PDF_MIME ? '.pdf' : '.docx';
  var name = String(file.name || 'Section128').replace(/[^A-Za-z0-9._-]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 80);
  if (!name) name = 'Section128';
  if (!new RegExp(ext + '$', 'i').test(name)) name += ext;
  return { mime: mime, blob: s128BytesBlob_(bytes, mime, name) };
}

function s128BytesBlob_(bytes, mime, name) {
  var data = [];
  for (var i = 0; i < bytes.length; i++) data.push(bytes[i]);
  return Utilities.newBlob(data, mime, name);
}

function s128LeadMessage_(payload, checked, files) {
  var lead = checked.lead;
  var plan = checked.plan;
  var review = checked.review;
  var bits = [];
  if (payload.test) bits.push('[TEST]');
  if (review.required) bits.push('[REVIEW]');
  bits.push('New Section 128 Lead: ' + plan.employer_name + ' | ' + S128Model.fundingLabel(plan.funding_mode) + ' | ' + lead.total_employee_count + ' employees');
  var lines = [
    'Section 128 Trump Account Contribution Program — draft lead',
    'Template: ' + (payload.templateVersion || S128Model.TEMPLATE_VERSION),
    'Submitted: ' + s128Stamp_(),
    'Source page: ' + (payload.pageUrl || ''),
    'Submission id: ' + payload.submissionId,
    '',
    'Company',
    'Legal name: ' + plan.employer_name,
    'EIN: ' + plan.employer_ein,
    'Address: ' + plan.employer_address,
    'State: ' + plan.state,
    'Entity: ' + S128Model.entityLabel(lead.entity_type),
    'Employees: ' + lead.total_employee_count,
    'Additional employers: ' + ((plan.participating_employers || []).join('; ') || 'None'),
    '',
    'Contact',
    'Name: ' + lead.contact_name,
    'Title: ' + lead.contact_title,
    'Email: ' + lead.contact_email,
    'Phone: ' + lead.contact_phone,
    '',
    'Design',
    'Program: ' + plan.plan_name,
    'Effective date: ' + S128Model.formatLongDate(plan.effective_date),
    'Funding: ' + S128Model.fundingLabel(plan.funding_mode),
    'Employer grant: ' + (plan.employer_annual_grant ? S128Model.formatMoney(plan.employer_annual_grant) : 'None'),
    'Cap: ' + S128Model.capText(plan),
    'Salary reduction room: ' + (S128Model.capacityMessage(plan) || 'Not used'),
    'Grant recipients: ' + (plan.allow_employee_account ? 'Dependents and employee own account' : 'Dependent accounts only'),
    'Eligible class: ' + plan.eligibility_class,
    'Waiting days: ' + plan.waiting_days,
    'Administrator: ' + plan.administrator_name,
    'Administrator contact: ' + plan.administrator_contact,
    'Representative: ' + plan.signer_name + ', ' + plan.signer_title,
    'Section 125 plan: ' + (plan.cafeteria_plan_name || 'Not used'),
    'Amendment date: ' + (plan.cafeteria_amendment_date ? S128Model.formatLongDate(plan.cafeteria_amendment_date) : 'Not used'),
    'Processing notice days: ' + (plan.election_cutoff_days == null ? 'Not used' : plan.election_cutoff_days),
    'Related businesses: ' + (lead.related_businesses || ''),
    'Owner or family participation: ' + (lead.owners_or_family_want_to_participate || ''),
    'Collectively bargained: ' + (lead.collectively_bargained_employees || ''),
    'Existing Section 125 plan: ' + (lead.has_existing_125_plan || 'Not asked'),
    '',
    'Review',
    review.required ? review.reasons.map(function (reason) { return '- ' + reason; }).join('\n') : 'No extra review flags.',
    '',
    'Acknowledgement',
    'Terms version: ' + ((payload.acknowledgement && payload.acknowledgement.termsVersion) || ''),
    'Accepted at: ' + ((payload.acknowledgement && payload.acknowledgement.acceptedAt) || ''),
    '',
    'The attached files are sample drafts for the employer. They are not adopted until the employer signs them.'
  ];
  return {
    to: S128_NOTIFY_EMAIL,
    subject: bits.join(' '),
    body: lines.join('\n'),
    name: 'DK Benefits LLC',
    attachments: files
  };
}

function s128FollowUpPlan_(plan) {
  return {
    employer_name: plan.employer_name,
    funding_mode: plan.funding_mode,
    employer_annual_grant: plan.employer_annual_grant,
    annual_cap_mode: plan.annual_cap_mode,
    fixed_annual_cap: plan.fixed_annual_cap,
    effective_date: plan.effective_date,
    cafeteria_plan_name: plan.cafeteria_plan_name || '',
    allow_employee_account: !!plan.allow_employee_account
  };
}

function s128AppendFollowUp_(payload, checked) {
  if (payload.sendVisitorCopy === false) return false;
  var email = checked.lead && checked.lead.contact_email;
  if (!email) return false;
  var sheet = s128Sheet_(S128_FOLLOWUPS_SHEET, S128_FOLLOWUP_HEADERS);
  var values = sheet.getDataRange().getValues();
  var id = String(payload.submissionId);
  for (var i = 1; i < values.length; i++) {
    if (String(values[i][7]) === id) return true;
  }
  sheet.appendRow([
    new Date(s128Now_()).toISOString(),
    email,
    checked.lead.contact_name || '',
    checked.plan.employer_name || '',
    JSON.stringify(s128FollowUpPlan_(checked.plan)),
    'pending',
    payload.test ? 'yes' : 'no',
    id,
    '',
    ''
  ]);
  return true;
}

function s128FollowUpMessage_(row) {
  var plan = {};
  try { plan = JSON.parse(String(row[4] || '{}')); } catch (err) { plan = {}; }
  var subject = 'Thanks for using my Section 128 tool!';
  if (String(row[6]) === 'yes') subject = '[TEST] ' + subject;
  var links = { section125Url: SECTION125_URL, ratesUrl: RATES_URL };
  var lead = { contact_name: String(row[2] || '') };
  return {
    to: String(row[1] || ''),
    subject: subject,
    body: S128Docgen.followUpEmailText(plan, lead, links),
    htmlBody: S128Docgen.followUpEmailHtml(plan, lead, links),
    name: 'Daniel Kirves',
    replyTo: S128_NOTIFY_EMAIL
  };
}

function s128CellTime_(value) {
  if (value && typeof value.getTime === 'function') {
    var ms = value.getTime();
    if (typeof ms === 'number' && isFinite(ms)) return ms;
  }
  if (typeof value === 'number' && isFinite(value) && value > 20000 && value < 100000) {
    return Math.round((value - 25569) * 86400 * 1000);
  }
  return Date.parse(String(value || ''));
}

function s128CellDay_(value) {
  if (value && typeof value.getTime === 'function') {
    var ms = value.getTime();
    if (typeof ms === 'number' && isFinite(ms)) return new Date(ms).toISOString().slice(0, 10);
  }
  return String(value || '').slice(0, 10);
}

function s128Log_(message) {
  var line = String(message);
  try {
    if (typeof Logger !== 'undefined' && Logger && Logger.log) Logger.log(line);
  } catch (err) {}
  try {
    if (typeof console !== 'undefined' && console && console.log) console.log(line);
  } catch (err) {}
}

function s128TsPreview_(value) {
  var kind = 'empty';
  if (value && typeof value.getTime === 'function') kind = 'Date';
  else if (value != null && value !== '') kind = typeof value;
  var text = '';
  try { text = String(value == null ? '' : value); } catch (err) { text = ''; }
  if (text.length > 80) text = text.slice(0, 80);
  return kind + ':' + text;
}

function s128FollowUpSentToday_(values, email) {
  var day = s128Today_();
  var target = String(email || '').toLowerCase();
  for (var i = 1; i < values.length; i++) {
    if (String(values[i][1] || '').toLowerCase() !== target) continue;
    if (String(values[i][6] || '') === 'yes') continue;
    if (String(values[i][5]) !== 'sent') continue;
    if (s128CellDay_(values[i][9]) === day) return true;
  }
  return false;
}

function s128SendDueFollowUps() {
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    var sheet = s128Sheet_(S128_FOLLOWUPS_SHEET, S128_FOLLOWUP_HEADERS);
    var values = sheet.getDataRange().getValues();
    var now = s128Now_();
    var found = Math.max(0, values.length - 1);
    var sent = 0;
    var skipped = 0;
    var waiting = 0;
    var ignored = 0;
    var header = values.length ? values[0] : [];
    var headerText = [];
    var headerOk = true;
    for (var h = 0; h < S128_FOLLOWUP_HEADERS.length; h++) {
      headerText.push(String(header[h] || ''));
      if (headerText[h] !== S128_FOLLOWUP_HEADERS[h]) headerOk = false;
    }
    s128Log_('s128SendDueFollowUps: found ' + found + ' follow-up row(s)');
    if (!headerOk) {
      s128Log_('s128SendDueFollowUps: header is [' + headerText.join(', ') + '] expected [' + S128_FOLLOWUP_HEADERS.join(', ') + ']');
    }
    for (var i = 1; i < values.length; i++) {
      var status = String(values[i][5] || '');
      var testRow = String(values[i][6] || '') === 'yes';
      var retryTest = testRow && status === 'skipped' && String(values[i][8] || '') === 'already sent today';
      var rowNumber = i + 1;
      var label = 'row ' + rowNumber + ' ' + String(values[i][1] || '(no email)') + ' id=' + String(values[i][7] || '') + ' status=' + (status || '(blank)') + ' test=' + (testRow ? 'yes' : 'no');
      if (status !== 'pending' && !retryTest) {
        ignored++;
        s128Log_(label + ' reason=not pending');
        continue;
      }
      // The sheet returns this cell as a Date or a serial, not the ISO text that was stored.
      var ts = s128CellTime_(values[i][0]);
      if (isNaN(ts)) {
        waiting++;
        s128Log_(label + ' reason=timestamp not readable value=' + s128TsPreview_(values[i][0]));
        continue;
      }
      var ageMs = now - ts;
      if (ageMs < S128_FOLLOWUP_DELAY_MS) {
        waiting++;
        s128Log_(label + ' reason=not due for ' + Math.ceil((S128_FOLLOWUP_DELAY_MS - ageMs) / 60000) + ' more minute(s)');
        continue;
      }
      var email = String(values[i][1] || '');
      if (!testRow && s128FollowUpSentToday_(values, email)) {
        sheet.getRange(rowNumber, 6).setValue('skipped');
        sheet.getRange(rowNumber, 9).setValue('already sent today');
        values[i][5] = 'skipped';
        values[i][8] = 'already sent today';
        skipped++;
        s128Log_(label + ' reason=already sent today');
        continue;
      }
      if (!s128VisitorAllowed_(email)) {
        sheet.getRange(rowNumber, 6).setValue('skipped');
        sheet.getRange(rowNumber, 9).setValue('hourly limit');
        values[i][5] = 'skipped';
        skipped++;
        s128Log_(label + ' reason=hourly limit');
        continue;
      }
      try {
        var message = s128FollowUpMessage_(values[i]);
        if (message.attachments) delete message.attachments;
        MailApp.sendEmail(message);
        var sentAt = new Date(s128Now_()).toISOString();
        sheet.getRange(rowNumber, 6).setValue('sent');
        sheet.getRange(rowNumber, 9).setValue('');
        sheet.getRange(rowNumber, 10).setValue(sentAt);
        values[i][5] = 'sent';
        values[i][9] = sentAt;
        sent++;
        s128Log_(label + ' reason=sent');
      } catch (err) {
        var mailError = err && err.message ? String(err.message).slice(0, 300) : 'mail failed';
        sheet.getRange(rowNumber, 6).setValue('failed');
        sheet.getRange(rowNumber, 9).setValue(mailError);
        values[i][5] = 'failed';
        skipped++;
        s128Log_(label + ' reason=mail failed ' + mailError);
      }
    }
    s128Log_('s128SendDueFollowUps: sent=' + sent + ' skipped=' + skipped + ' waiting=' + waiting + ' ignored=' + ignored);
  } catch (err) {
    s128Log_('s128SendDueFollowUps: failed ' + (err && err.message ? String(err.message) : err));
    throw err;
  } finally {
    lock.releaseLock();
  }
}

function setupFollowUpTrigger() {
  var triggers = ScriptApp.getProjectTriggers();
  for (var i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === S128_FOLLOWUP_HANDLER) return;
  }
  ScriptApp.newTrigger(S128_FOLLOWUP_HANDLER).timeBased().everyMinutes(5).create();
}

function s128EnsureFollowUpTrigger_() {
  try { setupFollowUpTrigger(); } catch (err) {}
}

function s128Now_() {
  if (typeof S128_TEST_NOW === 'number' && isFinite(S128_TEST_NOW)) return S128_TEST_NOW;
  return Date.now();
}

function s128VisitorAllowed_(email) {
  var cache = CacheService.getScriptCache();
  var key = 's128v:' + String(email || '').toLowerCase();
  var count = Number(cache.get(key) || '0');
  if (count >= S128_VISITOR_HOURLY_LIMIT) return false;
  cache.put(key, String(count + 1), 3600);
  return true;
}

function s128Sheet_(name, headers) {
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
  var width = headers.length;
  if (sheet.getLastColumn) width = Math.max(sheet.getLastColumn(), headers.length);
  var current = sheet.getRange(1, 1, 1, width).getValues()[0];
  var changed = false;
  for (var i = 0; i < headers.length; i++) {
    if (current[i] === '' || current[i] == null) {
      current[i] = headers[i];
      changed = true;
    }
  }
  if (changed) sheet.getRange(1, 1, 1, headers.length).setValues([current.slice(0, headers.length)]);
  return sheet;
}

function s128FindSubmission_(id) {
  var sheet = s128Sheet_(S128_SUBMISSIONS_SHEET, S128_SUBMISSION_HEADERS);
  var values = sheet.getDataRange().getValues();
  for (var i = 1; i < values.length; i++) {
    if (String(values[i][1]) === id) {
      return {
        rowNumber: i + 1,
        status: String(values[i][2] || ''),
        timestamp: String(values[i][0] || ''),
        leadEmailed: String(values[i][16] || '') === 'yes',
        visitorEmailed: String(values[i][17] || '') === 'yes'
      };
    }
  }
  return null;
}

function s128CountLeadsToday_(exceptId) {
  var sheet = s128Sheet_(S128_SUBMISSIONS_SHEET, S128_SUBMISSION_HEADERS);
  var values = sheet.getDataRange().getValues();
  var day = new Date().toISOString().slice(0, 10);
  var count = 0;
  for (var i = 1; i < values.length; i++) {
    if (String(values[i][1]) === exceptId) continue;
    if (String(values[i][16] || '') !== 'yes') continue;
    if (String(values[i][0] || '').slice(0, 10) === day) count++;
  }
  return count;
}

function s128Row_(payload, checked, status, error, leadEmailed, visitorEmailed) {
  var plan = checked.plan;
  var lead = checked.lead;
  return [
    new Date().toISOString(),
    String(payload.submissionId),
    status,
    payload.test ? 'yes' : 'no',
    plan.employer_name,
    plan.state,
    lead.contact_name,
    lead.contact_email,
    lead.contact_phone,
    lead.total_employee_count,
    plan.funding_mode,
    plan.effective_date,
    checked.review.required ? 'yes' : 'no',
    (checked.review.reasons || []).join(' | '),
    payload.pageUrl || '',
    payload.templateVersion || '',
    leadEmailed ? 'yes' : 'no',
    visitorEmailed ? 'yes' : 'no',
    error || '',
    JSON.stringify({ lead: lead, plan: plan, review: checked.review, acknowledgement: payload.acknowledgement || {}, utm: payload.utm || {} }),
    (payload.acknowledgement && payload.acknowledgement.termsVersion) || '',
    (payload.acknowledgement && payload.acknowledgement.acceptedAt) || ''
  ];
}

function s128UpsertSubmission_(existing, payload, checked, status, error, leadEmailed, visitorEmailed) {
  var sheet = s128Sheet_(S128_SUBMISSIONS_SHEET, S128_SUBMISSION_HEADERS);
  var row = s128Row_(payload, checked, status, error, leadEmailed, visitorEmailed);
  if (!existing) {
    sheet.appendRow(row);
    return;
  }
  sheet.getRange(existing.rowNumber, 1, 1, row.length).setValues([row]);
}

function s128Mark_(id, status, error, leadEmailed, visitorEmailed) {
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var found = s128FindSubmission_(id);
    if (!found) return;
    var sheet = s128Sheet_(S128_SUBMISSIONS_SHEET, S128_SUBMISSION_HEADERS);
    sheet.getRange(found.rowNumber, 3).setValue(status);
    sheet.getRange(found.rowNumber, 17).setValue(leadEmailed ? 'yes' : 'no');
    sheet.getRange(found.rowNumber, 18).setValue(visitorEmailed ? 'yes' : 'no');
    sheet.getRange(found.rowNumber, 19).setValue(error || '');
  } finally {
    lock.releaseLock();
  }
}

function s128LogEvent_(kind, submissionId, detail) {
  var sheet = s128Sheet_(S128_EVENTS_SHEET, ['timestamp', 'kind', 'submission_id', 'detail']);
  sheet.appendRow([new Date().toISOString(), kind, submissionId || '', String(detail || '').slice(0, 500)]);
}

function s128Today_() {
  try {
    if (typeof Session !== 'undefined' && Session.getScriptTimeZone) {
      return Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd');
    }
  } catch (err) {}
  return S128Model.todayIso(new Date());
}

function s128Stamp_() {
  try {
    if (typeof Session !== 'undefined' && Session.getScriptTimeZone) {
      return Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm z');
    }
  } catch (err) {}
  return new Date().toISOString();
}

function s128Json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
