const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const SCRIPT = path.join(__dirname, '../apps-script/ComplianceLeads.gs');

function sheet() {
  const rows = [];
  return {
    appendRow(row) { rows.push(row.slice()); },
    getLastRow() { return rows.length; },
    getDataRange() {
      return { getValues() { return rows.map((row) => row.slice()); } };
    },
    getRange(row, column, numRows, numColumns) {
      return {
        setValues(matrix) {
          for (let r = 0; r < matrix.length; r += 1) {
            if (!rows[row - 1 + r]) rows[row - 1 + r] = [];
            for (let c = 0; c < matrix[r].length; c += 1) rows[row - 1 + r][column - 1 + c] = matrix[r][c];
          }
        }
      };
    },
    setFrozenRows() {},
    getName() { return 'DK Compliance Leads'; }
  };
}

function world() {
  const sheets = {};
  const gmail = [];
  const triggers = [];
  const api = {
    CL_TEST_NOW: null,
    gmail,
    triggers,
    sheets,
    SpreadsheetApp: {
      getActiveSpreadsheet() {
        return {
          getSheetByName(name) { return sheets[name] || null; },
          insertSheet(name) {
            sheets[name] = sheet();
            return sheets[name];
          }
        };
      }
    },
    GmailApp: {
      sendEmail(to, subject, body, options) {
        gmail.push({ to, subject, body, options: options || null });
      }
    },
    LockService: {
      getScriptLock() {
        return { waitLock() {}, releaseLock() {} };
      }
    },
    ScriptApp: {
      getProjectTriggers() {
        return triggers.map((name) => ({ getHandlerFunction() { return name; } }));
      },
      newTrigger(name) {
        return {
          timeBased() {
            return { everyMinutes() { return { create() { triggers.push(name); } }; } };
          }
        };
      }
    },
    ContentService: {
      MimeType: { JSON: 'application/json' },
      createTextOutput(text) {
        const output = {
          setMimeType() { return output; },
          getContent() { return text; }
        };
        return output;
      }
    }
  };
  vm.createContext(api);
  vm.runInContext(fs.readFileSync(SCRIPT, 'utf8'), api, { filename: 'ComplianceLeads.gs' });
  return api;
}

function post(api, payload) {
  const output = api.doPost({ postData: { contents: JSON.stringify(payload) } });
  return JSON.parse(output.getContent());
}

function rows(api) {
  return api.sheets['DK Compliance Leads'].getDataRange().getValues();
}

const EXACT_BODY = [
  'Hi Ada,',
  '',
  'Thanks for running the benefits compliance checkup. I hope it gave you a clear picture of where things stand.',
  '',
  'By the way, I\'m an independent employee benefits broker, and I help employers get these items in order and shop group benefits across the full market. If you want a second set of eyes on your results, call or text me at 407-476-5076 or email me.',
  '',
  'Daniel Kirves',
  'Benefits Broker | 20 Years Exp | DK Benefits',
  '407-476-5076 | www.dkbenefits.net',
  '6000 Metrowest Blvd #200 Orlando, FL 32835',
  '',
  'Agency Lic# L109331'
].join('\n');

test('follow-up is 12 minutes later and moves outside 7:00 to 18:59 ET', () => {
  const api = world();
  const morning = api.clLocalToUtc_(2026, 10, 14, 10, 0);
  assert.equal(api.clFollowUpDue(morning), morning + 12 * 60 * 1000);
  const late = api.clLocalToUtc_(2026, 10, 14, 18, 50);
  assert.equal(api.clFollowUpDue(late), api.clLocalToUtc_(2026, 10, 15, 7, 0));
  const early = api.clLocalToUtc_(2026, 10, 14, 6, 40);
  assert.equal(api.clFollowUpDue(early), api.clLocalToUtc_(2026, 10, 14, 7, 0));
  const due = morning + 12 * 60 * 1000;
  assert.equal(api.clFollowUpDecision(due, morning + 5 * 60 * 1000, false).action, 'wait');
  assert.equal(api.clFollowUpDecision(due, morning + 13 * 60 * 1000, false).action, 'send');
  const afterHours = api.clFollowUpDecision(morning, api.clLocalToUtc_(2026, 10, 14, 20, 0), false);
  assert.equal(afterHours.action, 'wait');
  assert.equal(afterHours.reason, 'after hours');
  assert.equal(afterHours.nextAt, api.clLocalToUtc_(2026, 10, 15, 7, 0));
  const again = api.clFollowUpDecision(morning, morning + 13 * 60 * 1000, true);
  assert.equal(again.reason, 'already sent today');
});

test('visitor note matches the checkup check-in', () => {
  const api = world();
  assert.equal(api.clFollowUpBody('Ada'), EXACT_BODY);
  assert.equal(api.clFollowUpBody(''), 'Hi there,\n\nThanks for running the benefits compliance checkup. I hope it gave you a clear picture of where things stand.\n\nBy the way, I\'m an independent employee benefits broker, and I help employers get these items in order and shop group benefits across the full market. If you want a second set of eyes on your results, call or text me at 407-476-5076 or email me.\n\nDaniel Kirves\nBenefits Broker | 20 Years Exp | DK Benefits\n407-476-5076 | www.dkbenefits.net\n6000 Metrowest Blvd #200 Orlando, FL 32835\n\nAgency Lic# L109331');
  const body = api.clFollowUpBody('Ada');
  assert.equal(/opt out|unsubscribe|Thanks, Dan/i.test(body), false);
  assert.equal(body.includes('mailto:'), false);
  assert.equal(body.includes('tel:'), false);
});

test('email lead notifies Dan and sends one check-in inside business hours', () => {
  const api = world();
  api.CL_TEST_NOW = api.clLocalToUtc_(2026, 10, 14, 10, 0);
  const saved = post(api, {
    firstName: 'Ada',
    company: 'Northwind',
    email: 'ada@example.com',
    phone: '407-555-0100',
    summary: 'Offers medical.',
    findings: '1. Wrap document: missing',
    pageUrl: 'https://dankirves-prog.github.io/dkbenefits-tools/compliance-assessment-preview.html'
  });
  assert.equal(saved.ok, true);
  assert.equal(saved.followUp, 'pending');
  assert.equal(api.gmail.length, 1);
  assert.equal(api.gmail[0].to, 'dan@dkbenefits.net');
  assert.match(api.gmail[0].body, /Ada/);
  assert.match(api.gmail[0].body, /Northwind/);
  assert.match(api.gmail[0].body, /Offers medical/);
  assert.match(api.gmail[0].body, /Wrap document/);
  api.CL_TEST_NOW = api.clLocalToUtc_(2026, 10, 14, 10, 13);
  api.processComplianceFollowUps();
  assert.equal(api.gmail.length, 2);
  assert.equal(api.gmail[1].to, 'ada@example.com');
  assert.equal(api.gmail[1].subject, 'Thanks for using my compliance checkup!');
  assert.equal(api.gmail[1].body, EXACT_BODY);
  assert.equal(api.gmail[1].options.name, 'Daniel Kirves');
  assert.equal(api.gmail[1].options.replyTo, 'dan@dkbenefits.net');
  assert.equal(api.gmail[1].options.htmlBody.includes('<br>'), true);
  assert.equal(api.gmail[1].options.htmlBody.includes('mailto:'), false);
  const data = rows(api);
  assert.equal(data[0][0], 'Submitted at');
  assert.equal(data[1][8], 'sent');
});

test('a second lead with the same email waits until the next day', () => {
  const api = world();
  api.CL_TEST_NOW = api.clLocalToUtc_(2026, 10, 14, 11, 0);
  post(api, { firstName: 'Ada', company: 'Northwind', email: 'ada@example.com', phone: '' });
  post(api, { firstName: 'Ada', company: 'Northwind', email: 'Ada@example.com', phone: '' });
  api.CL_TEST_NOW = api.clLocalToUtc_(2026, 10, 14, 11, 20);
  api.processComplianceFollowUps();
  const notes = api.gmail.filter((item) => item.subject === 'Thanks for using my compliance checkup!');
  assert.equal(notes.length, 1);
  const data = rows(api);
  assert.equal(data[1][8], 'sent');
  assert.equal(data[2][8], 'pending');
  assert.equal(data[2][9], new Date(api.clLocalToUtc_(2026, 10, 15, 7, 0)).toISOString());
});

test('phone-only lead emails Dan and skips the visitor note', () => {
  const api = world();
  api.CL_TEST_NOW = api.clLocalToUtc_(2026, 10, 14, 10, 0);
  const saved = post(api, { firstName: 'Ben', company: 'Harbor', email: '', phone: '407-476-5076' });
  assert.equal(saved.ok, true);
  assert.equal(saved.followUp, 'skipped');
  assert.equal(api.gmail.length, 1);
  assert.match(api.gmail[0].body, /407-476-5076/);
  api.CL_TEST_NOW = api.clLocalToUtc_(2026, 10, 14, 12, 0);
  api.processComplianceFollowUps();
  assert.equal(api.gmail.length, 1);
  assert.equal(rows(api)[1][8], 'skipped');
});

test('lead form requires a name, a company, and email or phone', () => {
  const api = world();
  assert.equal(post(api, { firstName: '', company: 'Harbor', email: 'a@b.co' }).ok, false);
  assert.equal(post(api, { firstName: 'Ben', company: '', email: 'a@b.co' }).ok, false);
  assert.equal(post(api, { firstName: 'Ben', company: 'Harbor' }).ok, false);
  assert.equal(api.gmail.length, 0);
});

test('setup creates the sheet and the five-minute trigger', () => {
  const api = world();
  api.setup();
  assert.ok(api.sheets['DK Compliance Leads']);
  assert.deepEqual(api.triggers, ['processComplianceFollowUps']);
  api.setup();
  assert.equal(api.triggers.length, 1);
});
