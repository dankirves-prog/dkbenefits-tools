/**
 * Contact form validation and the visitor auto-reply text.
 * Used by the page and pasted into Apps Script (see ContactCombined.gs).
 */
var ContactModel = (function () {
  var REPLY_SUBJECT = 'Thanks for reaching out to DK Benefits';
  var REPLY_LINE = 'Thanks for reaching out to DK Benefits. I got your message and will get back to you within one business day. If it\'s urgent, call or text me at 407-476-5076.';

  function tidyDashes(text) {
    return String(text || '').replace(/[\u2012\u2013\u2014\u2015]/g, '-');
  }

  function cleanLine(value, max) {
    var text = tidyDashes(value == null ? '' : value).replace(/[\u0000-\u001F\u007F]/g, ' ').replace(/\s+/g, ' ').trim();
    if (max && text.length > max) text = text.slice(0, max);
    return text;
  }

  function cleanBlock(value, max) {
    var text = tidyDashes(value == null ? '' : value).replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    text = text.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '');
    text = text.replace(/[ \t]+\n/g, '\n').replace(/\n{4,}/g, '\n\n\n').trim();
    if (max && text.length > max) text = text.slice(0, max);
    return text;
  }

  function hasSubstance(value) {
    return /[A-Za-z0-9]/.test(value) || /[^\u0000-\u007F]/.test(value);
  }

  function digits(value) {
    return String(value || '').replace(/\D/g, '');
  }

  function phoneDigits(value) {
    var d = digits(value);
    if (d.length === 11 && d.charAt(0) === '1') d = d.slice(1);
    return d;
  }

  function formatPhone(value) {
    var d = phoneDigits(value);
    if (d.length === 10) return '(' + d.slice(0, 3) + ') ' + d.slice(3, 6) + '-' + d.slice(6);
    return cleanLine(value, 40);
  }

  function emailOk(value) {
    if (!value || value.length > 254) return false;
    return /^[a-z0-9._%+\-]+@[a-z0-9.\-]+\.[a-z]{2,}$/.test(value);
  }

  function firstWord(name) {
    var text = cleanLine(name, 60);
    if (!text) return '';
    return text.split(' ')[0];
  }

  function escapeHtml(value) {
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function replyGreeting(firstName) {
    var word = firstWord(firstName);
    return word ? ('Hi ' + word + ',') : 'Hi there,';
  }

  function replyBody(firstName) {
    return [
      replyGreeting(firstName),
      '',
      REPLY_LINE,
      '',
      'Daniel Kirves',
      'Benefits Broker | 20 Years Exp | DK Benefits LLC',
      '☎ 407-476-5076 | 🌐 www.dkbenefits.net',
      'https://www.dkbenefits.net',
      '🏢 6000 Metrowest Blvd. Suite 200, Orlando, FL 32835',
      '💼 Expert Guidance. Smarter Benefits. Better Savings.',
      '',
      'Florida Agency Lic# L138779',
      'Georgia Agency Lic# 247922',
      'Agent License# FL: W588866 | GA: 3366904',
      'SC: 19265263 | IL: 19265263 | TN: 3003674757'
    ].join('\n');
  }

  function replyHtml(firstName) {
    var text = 'font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#1A1A1A;line-height:1.45;margin:0';
    return '<div style="font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#1A1A1A;line-height:1.45">' +
      '<p style="' + text + '">' + escapeHtml(replyGreeting(firstName)) + '</p>' +
      '<p style="' + text + ';margin-top:12px">' + escapeHtml(REPLY_LINE) + '</p>' +
      '<p style="' + text + ';margin-top:16px">' +
        '<strong style="font-size:18px">Daniel Kirves</strong><br>' +
        'Benefits Broker | 20 Years Exp | DK Benefits LLC<br>' +
        '☎ 407-476-5076 | 🌐 <a href="https://www.dkbenefits.net">www.dkbenefits.net</a><br>' +
        '🏢 6000 Metrowest Blvd. Suite 200, Orlando, FL 32835<br>' +
        '💼 <em>Expert Guidance. Smarter Benefits. Better Savings.</em>' +
      '</p>' +
      '<p style="' + text + ';margin-top:12px">' +
        'Florida Agency Lic# L138779<br>' +
        'Georgia Agency Lic# 247922<br>' +
        'Agent License# FL: W588866 | GA: 3366904<br>' +
        'SC: 19265263 | IL: 19265263 | TN: 3003674757' +
      '</p>' +
      '</div>';
  }

  function push(errors, field, message) {
    errors.push({ field: field, message: message });
  }

  function validate(input) {
    input = input || {};
    var errors = [];
    var firstName = cleanLine(input.firstName, 80);
    var lastName = cleanLine(input.lastName, 80);
    var company = cleanLine(input.company, 160);
    var email = cleanLine(input.email, 254).toLowerCase();
    var phoneRaw = cleanLine(input.phone, 40);
    var message = cleanBlock(input.message, 8000);

    if (!firstName || !hasSubstance(firstName)) push(errors, 'firstName', 'Enter your first name.');
    else if (firstName.length > 60) push(errors, 'firstName', 'Use 60 characters or fewer.');

    if (lastName && !hasSubstance(lastName)) push(errors, 'lastName', 'Enter your last name, or leave it blank.');
    else if (lastName.length > 60) push(errors, 'lastName', 'Use 60 characters or fewer.');

    if (company.length > 120) push(errors, 'company', 'Use 120 characters or fewer.');

    if (!email) push(errors, 'email', 'Enter your email.');
    else if (!emailOk(email)) push(errors, 'email', 'Enter a valid email address.');

    if (phoneRaw && phoneDigits(phoneRaw).length !== 10) {
      push(errors, 'phone', 'Enter a 10-digit phone number, or leave this blank.');
    }

    if (!message) push(errors, 'message', 'Enter a message.');
    else if (message.length > 4000) push(errors, 'message', 'Use 4,000 characters or fewer.');

    if (errors.length) return { ok: false, errors: errors };

    return {
      ok: true,
      errors: [],
      lead: {
        firstName: firstName,
        lastName: lastName,
        company: company,
        email: email,
        phone: phoneRaw ? formatPhone(phoneRaw) : '',
        message: message
      }
    };
  }

  return {
    REPLY_SUBJECT: REPLY_SUBJECT,
    validate: validate,
    replyBody: replyBody,
    replyHtml: replyHtml,
    firstWord: firstWord,
    formatPhone: formatPhone,
    cleanLine: cleanLine
  };
})();
