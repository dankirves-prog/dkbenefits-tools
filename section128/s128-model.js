/**
 * Section 128 Trump Account Contribution Program — validation, limits, review flags.
 * Template s128-v0.2-2026-10-08. Guidance reviewed October 8, 2026.
 * Same rules run in the browser and in the Apps Script.
 */
var S128Model = (function () {
  var TEMPLATE_VERSION = 's128-v0.2-2026-10-08';
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

  function normalizePhone(raw) {
    var d = digitsOnly(raw);
    if (d.length === 11 && d.charAt(0) === '1') d = d.slice(1);
    if (d.length !== 10) return null;
    return d;
  }

  function formatPhone(d) {
    if (!d || d.length !== 10) return '';
    return '(' + d.slice(0, 3) + ') ' + d.slice(3, 6) + '-' + d.slice(6);
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
      return 'the Section 128(b) statutory limit for each calendar year, as adjusted under Section 128(b)(2) (indexed dollar amounts after 2027 are not stated until the IRS publishes them)';
    }
    var amt = formatMoney(plan.fixed_annual_cap);
    if (published) {
      return 'a fixed cap of ' + amt + ' per employee per calendar year, not to exceed the Section 128(b) limit ($2,500 for 2026 and 2027; as adjusted under Section 128(b)(2) for later years)';
    }
    return 'a fixed cap of ' + amt + ' per employee per calendar year, not to exceed the Section 128(b) limit as adjusted under Section 128(b)(2) (this fixed cap does not increase automatically, and no indexed amount after 2027 is stated because none has been published)';
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
        return 'For ' + info.year + ', employees may elect up to ' + formatMoney(info.room) + ' through payroll if this fixed cap is used. The indexed Section 128(b) limit for ' + info.year + ' has not been published, so no higher figure is shown. Salary reduction can fund dependents’ accounts only.';
      }
      return 'Salary reduction for ' + info.year + ' is limited to the Section 128(b) amount for that year. The indexed figure has not been published, so this draft does not state a dollar capacity above the last published limit of ' + formatMoney(info.publishedCeiling) + '. Salary reduction can fund dependents’ accounts only.';
    }
    if (plan.funding_mode === 'combined') {
      return 'For ' + info.year + ', employees may elect up to ' + formatMoney(info.room) + ' per year through payroll after the employer grant is reserved. Salary reduction can fund dependents’ accounts only. It does not reduce Social Security or Medicare tax.';
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
      if (waiting > 365) push(errors, 'waiting_days', 'Use 0 to 365 calendar days. A longer wait needs a separate review outside this draft.');
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
      plan.cafeteria_plan_name = cleanText(src.cafeteria_plan_name);
      if (plan.cafeteria_plan_name.length < 2 || plan.cafeteria_plan_name.length > 160) {
        push(errors, 'cafeteria_plan_name', 'Enter the name of the existing Section 125 plan.');
      }
      plan.cafeteria_amendment_date = cleanText(src.cafeteria_amendment_date);
      if (!isIsoDate(plan.cafeteria_amendment_date)) push(errors, 'cafeteria_amendment_date', 'Choose the Section 125 amendment effective date.');
      else if (plan.cafeteria_amendment_date < FIRST_CONTRIBUTION_DATE) push(errors, 'cafeteria_amendment_date', 'The amendment cannot be effective before July 4, 2026.');
      else if (plan.cafeteria_amendment_date < asOf) push(errors, 'cafeteria_amendment_date', 'The Section 125 amendment must be prospective. Choose today or a later date.');
      else if (plan.cafeteria_amendment_date > addMonthsIso(asOf, 18)) push(errors, 'cafeteria_amendment_date', 'Choose an amendment date within the next 18 months.');
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
    if (!validEmail(lead.contact_email)) push(errors, 'contact_email', 'Enter a valid email for the copy of this draft.');
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

    plan.employer_address = [plan.street, plan.city, plan.state, plan.zip].filter(Boolean).join(', ');
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
      reasons.push('Additional participating employers are listed. Related employers are treated as one employer for Section 128. Review the group before use.');
    }
    if (lead.related_businesses === 'yes' || lead.related_businesses === 'unsure') {
      reasons.push('Related businesses were marked ' + (lead.related_businesses === 'yes' ? 'yes' : 'unsure') + '. Controlled-group and affiliated-service-group rules may apply. Review before use.');
    }
    if (plan.eligibility_class_choice === 'other') {
      reasons.push('The eligible class is narrower than all common-law employees. It must stay objective and nondiscriminatory. Review before use.');
    }
    if (lead.owners_or_family_want_to_participate === 'yes') {
      if (lead.entity_type === 's_corp') {
        reasons.push('An owner or family member wants to participate in an S corporation. A 2-percent shareholder, with ownership attribution, is not treated as an employee for this program under the proposed-regulation preamble. Review before use.');
      } else if (lead.entity_type === 'llc_partnership' || lead.entity_type === 'sole_prop') {
        reasons.push('An owner wants to participate, but partners and sole proprietors are not eligible employees. Review who would actually be covered.');
      } else if (lead.entity_type === 'c_corp') {
        reasons.push('A C corporation owner-employee may participate if the person is a common-law employee. That person is usually highly compensated for testing. Review before use.');
      } else {
        reasons.push('An owner or family member wants to participate. Review eligibility before use.');
      }
    }
    if (plan.allow_employee_account === true) {
      reasons.push('Employer grants may go to an employee’s own account during the growth period. Department of Labor conditions apply to that design. Review before use.');
    }
    if (fundingUsesSalary(plan.funding_mode) && (lead.has_existing_125_plan === 'no' || lead.has_existing_125_plan === 'unsure')) {
      reasons.push('Salary reduction needs an existing Section 125 plan, amended before the first affected paycheck. No existing plan was confirmed. Review before use.');
    }
    if (isIsoDate(plan.effective_date) && plan.effective_date < asOf) {
      reasons.push('The effective date is before today. Review whether this draft can still be used prospectively.');
    }
    if (isIsoDate(plan.effective_date) && +plan.effective_date.slice(0, 4) >= 2028) {
      reasons.push('The Section 128 limit for ' + plan.effective_date.slice(0, 4) + ' has not been published. This draft does not invent an indexed dollar amount. Review the limit before any contribution is made for that year.');
    }
    if (lead.collectively_bargained_employees === 'yes') {
      reasons.push('Collectively bargained employees were reported. Testing exclusions apply only when their conditions are met. Review before use.');
    }
    if (plan.state && plan.state !== 'FL' && plan.state !== 'GA') {
      reasons.push('Business review: the employer is in ' + plan.state + '. Employers in any U.S. state can prepare this draft. The state is included in the lead.');
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
    formatPhone: formatPhone,
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
