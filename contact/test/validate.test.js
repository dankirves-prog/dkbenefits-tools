const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');

function loadModel() {
  const context = { console: console };
  vm.createContext(context);
  vm.runInContext(fs.readFileSync(path.join(root, 'contact-validate.js'), 'utf8'), context, { filename: 'contact-validate.js' });
  return context.ContactModel;
}

const ContactModel = loadModel();

function lead(overrides) {
  return Object.assign({
    firstName: 'Ada',
    lastName: 'Lovelace',
    company: 'Northwind',
    email: 'Ada@Northwind.Example',
    phone: '4075550199',
    message: 'We would like help with our group health plan.'
  }, overrides || {});
}

test('a complete form is accepted and the phone is formatted', function () {
  const checked = ContactModel.validate(lead());
  assert.equal(checked.ok, true);
  assert.equal(checked.lead.email, 'ada@northwind.example');
  assert.equal(checked.lead.phone, '(407) 555-0199');
  assert.equal(checked.lead.firstName, 'Ada');
});

test('first name, email, and message are required; phone and last name may be blank', function () {
  const checked = ContactModel.validate({ firstName: 'Ada', email: 'ada@northwind.example', message: 'Hello there' });
  assert.equal(checked.ok, true);
  assert.equal(checked.lead.lastName, '');
  assert.equal(checked.lead.phone, '');
  assert.equal(checked.lead.company, '');

  const empty = ContactModel.validate({});
  assert.equal(empty.ok, false);
  assert.equal(empty.errors.map(function (item) { return item.field; }).join(','), 'firstName,email,message');
});

test('bad email and a partial phone are rejected', function () {
  const checked = ContactModel.validate(lead({ email: 'not-an-email', phone: '407-555' }));
  assert.equal(checked.ok, false);
  const fields = checked.errors.map(function (item) { return item.field; });
  assert.ok(fields.indexOf('email') !== -1);
  assert.ok(fields.indexOf('phone') !== -1);
  assert.match(checked.errors.filter(function (item) { return item.field === 'phone'; })[0].message, /10-digit/);
});

test('the auto reply matches the plain-text note and has no em dash', function () {
  const body = ContactModel.replyBody('Mary Ann');
  assert.equal(body, [
    'Hi Mary,',
    '',
    'Thanks for reaching out to DK Benefits. I got your message and will get back to you within one business day. If it\'s urgent, call or text me at 407-476-5076.',
    '',
    'Daniel Kirves',
    'DK Benefits'
  ].join('\n'));
  assert.equal(ContactModel.replyBody(''), [
    'Hi there,',
    '',
    'Thanks for reaching out to DK Benefits. I got your message and will get back to you within one business day. If it\'s urgent, call or text me at 407-476-5076.',
    '',
    'Daniel Kirves',
    'DK Benefits'
  ].join('\n'));
  assert.equal(ContactModel.REPLY_SUBJECT, 'Thanks for reaching out to DK Benefits');
  assert.equal(body.indexOf('\u2014'), -1);
  assert.equal(body.indexOf('\u2013'), -1);
});

test('an em dash typed into a name is stored as a hyphen', function () {
  const checked = ContactModel.validate(lead({ firstName: 'Mary\u2014Jane' }));
  assert.equal(checked.ok, true);
  assert.equal(checked.lead.firstName, 'Mary-Jane');
  assert.match(ContactModel.replyBody(checked.lead.firstName), /^Hi Mary-Jane,/);
});

test('user-facing contact files do not contain an em dash or any other email address', function () {
  const files = [
    'index.html',
    'contact.css',
    'contact.js',
    'config.js',
    'contact-validate.js',
    'apps-script/Code.gs',
    'apps-script/README.md'
  ];
  files.forEach(function (file) {
    const text = fs.readFileSync(path.join(root, file), 'utf8');
    assert.equal(text.indexOf('\u2014'), -1, file);
    assert.equal(text.indexOf('\u2013'), -1, file);
    const emails = text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi) || [];
    emails.forEach(function (email) {
      assert.equal(email.toLowerCase(), 'dan@dkbenefits.net', file + ' has ' + email);
    });
  });
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  const css = fs.readFileSync(path.join(root, 'contact.css'), 'utf8');
  const config = fs.readFileSync(path.join(root, 'config.js'), 'utf8');
  assert.match(html, /Send Message/);
  assert.match(html, /Thanks! Your message is on its way\. I'll be in touch within one business day\./);
  assert.match(css, /#C9A227/i);
  assert.match(css, /#B38F1F/i);
  assert.match(css, /#16233A/i);
  assert.match(css, /#21406A/i);
  assert.match(css, /#172E4D/i);
  assert.match(css, /#3A4657/i);
  assert.match(css, /#E3E8F0/i);
  assert.match(css, /#F3F6FA/i);
  assert.match(css, /font-family:\s*Inter/);
  assert.match(css, /\.send:hover[\s\S]*color:\s*var\(--ink\)/);
  assert.doesNotMatch(css, /\.send[^{]*\{[^}]*color:\s*(#fff|#ffffff|white)\b/i);
  assert.doesNotMatch(css, /min-height:\s*100vh/);
  assert.match(css, /color-scheme:\s*light/);
  assert.equal((config.match(/CONTACT_ENDPOINT\s*=/g) || []).length, 1);
  assert.match(config, /CONTACT_ENDPOINT = ''/);
});
