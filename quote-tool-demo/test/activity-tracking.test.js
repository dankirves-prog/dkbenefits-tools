const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');
const activity = require('../quote-activity.js');

global.fetch = function refuseNetwork() {
  throw new Error('refusing network: tests must not call the live quote endpoint');
};

const MERGED_SCRIPT = path.join(__dirname, '../apps-script/Code.gs');
const serverSource = fs.readFileSync(MERGED_SCRIPT, 'utf8');
const plans = JSON.parse(fs.readFileSync(path.join(__dirname, '../plans.json'), 'utf8'));
const NOW = new Date('2026-10-06T23:32:00.000Z');
const UTM_QUERY = '?utm_source=google&utm_medium=cpc&utm_campaign=oct&utm_term=group-health&utm_content=hero';
const SHEET_URL = 'https://docs.google.com/spreadsheets/d/test-quote-sheet';

function memoryStorage() {
  const map = new Map();
  return {
    getItem(key) { return map.has(key) ? map.get(key) : null; },
    setItem(key, value) { map.set(String(key), String(value)); },
    removeItem(key) { map.delete(key); }
  };
}

function zeroRatePlans() {
  return plans.map((plan) => ({
    ...plan,
    rates: { employeeOnly: 0, employeeSpouse: 0, employeeChildren: 0, family: 0 }
  }));
}

function createSheet(name, log, state) {
  const rows = [];
  return {
    _name: name,
    _rows: rows,
    appendRow(row) {
      if (state.failEventsWrites && name === 'Quote Events') {
        throw new Error('events sheet unavailable');
      }
      const copy = row.map((cell) => (cell instanceof Date ? new Date(cell.getTime()) : cell));
      rows.push(copy);
      const label = name === 'Quote Events'
        ? (copy[0] === 'timestamp' ? 'header' : copy[1])
        : 'lead';
      log.push('append:' + name + ':' + label);
    },
    getLastRow() { return rows.length; },
    getRange(row, column, numRows, numColumns) {
      return {
        getValues() {
          const out = [];
          for (let r = 0; r < numRows; r++) {
            const source = rows[row - 1 + r] || [];
            const line = [];
            for (let c = 0; c < numColumns; c++) {
              const value = source[column - 1 + c];
              line.push(value === undefined ? '' : value);
            }
            out.push(line);
          }
          return out;
        },
        setValues(values) {
          for (let r = 0; r < values.length; r++) {
            const target = rows[row - 1 + r];
            if (!target) throw new Error('setValues missing row ' + (row + r));
            for (let c = 0; c < values[r].length; c++) {
              target[column - 1 + c] = values[r][c];
            }
          }
          log.push('update:' + name + ':' + values[0].join('|'));
        }
      };
    },
    setFrozenRows() {},
    getName() { return name; }
  };
}

function createWorld() {
  const log = [];
  const messages = [];
  const attempts = [];
  const sheets = new Map();
  const cacheReads = [];
  const propertyWrites = [];
  const state = {
    failEventsWrites: false,
    mailThrows: false,
    sheetUrl: SHEET_URL,
    omitSheet1: false
  };
  sheets.set('Sheet1', createSheet('Sheet1', log, state));

  const spreadsheet = {
    getSheetByName(name) {
      if (name === 'Sheet1' && state.omitSheet1) return null;
      return sheets.get(name) || null;
    },
    insertSheet(name) {
      if (state.failEventsWrites && name === 'Quote Events') {
        throw new Error('events sheet unavailable');
      }
      const sheet = createSheet(name, log, state);
      sheets.set(name, sheet);
      log.push('insert:' + name);
      return sheet;
    },
    getUrl() { return state.sheetUrl; }
  };

  const services = {
    SpreadsheetApp: {
      getActiveSpreadsheet() { return spreadsheet; },
      flush() { log.push('flush'); }
    },
    MailApp: {
      sendEmail(to, subject, body) {
        attempts.push({ to, subject, body });
        log.push('mail:' + subject);
        if (state.mailThrows) throw new Error('smtp down');
        messages.push({ to, subject, body });
      }
    },
    CacheService: {
      getScriptCache() {
        return {
          get(key) { cacheReads.push(key); return null; },
          put() {},
          remove() {}
        };
      }
    },
    PropertiesService: {
      getScriptProperties() {
        return {
          getProperty() { return null; },
          setProperty(key, value) { propertyWrites.push([key, value]); },
          deleteProperty() {},
          getProperties() { return {}; }
        };
      }
    },
    LockService: {
      getScriptLock() {
        return { waitLock() {}, releaseLock() {} };
      }
    },
    ContentService: {
      MimeType: { JSON: 'application/json' },
      createTextOutput(text) {
        const output = {
          _text: text,
          _mime: '',
          setMimeType(mime) {
            output._mime = mime;
            return output;
          },
          getContent() { return output._text; }
        };
        return output;
      }
    }
  };

  return { log, messages, attempts, sheets, cacheReads, propertyWrites, state, services, spreadsheet };
}

function loadScript(world) {
  const sandbox = Object.assign({ console }, world.services);
  vm.createContext(sandbox);
  vm.runInContext(serverSource, sandbox);
  return sandbox;
}

function callDoPost(sandbox, payload) {
  const output = sandbox.doPost({ postData: { contents: JSON.stringify(payload) } });
  assert.equal(output._mime, 'application/json');
  return JSON.parse(output.getContent());
}

function fresh() {
  const world = createWorld();
  const sandbox = loadScript(world);
  return { world, sandbox };
}

function eventRows(world) {
  const sheet = world.sheets.get('Quote Events');
  if (!sheet) return [];
  return sheet._rows.slice(1).map((row) => ({
    timestamp: row[0],
    event: row[1],
    session_id: row[2],
    utm_source: row[3],
    utm_medium: row[4],
    utm_campaign: row[5],
    utm_term: row[6],
    utm_content: row[7],
    email_attempted: row[8],
    email_result: row[9]
  }));
}

function sheet1Rows(world) {
  const sheet = world.sheets.get('Sheet1');
  return sheet ? sheet._rows : [];
}

function hostRow(row) {
  return Array.from(row, (cell) => {
    if (cell && typeof cell.getTime === 'function') return new Date(cell.getTime());
    return cell;
  });
}

function leadFixture(extra) {
  return Object.assign({
    firstName: 'Ada',
    email: 'ada@example.com',
    phone: '407-555-0100',
    answers: {
      state: 'Florida',
      employees: '12',
      enrolling: '8',
      priority: 'cost',
      coverage: 'no',
      timeline: '30'
    },
    tierMix: { employeeOnly: 5, employeeSpouse: 1, employeeChildren: 1, family: 1 },
    contribution: { model: 'percent', percent: 50, flatDollar: null },
    selectedPlans: [{
      id: 'cigna-epo-1000',
      name: 'Cigna EPO 1000',
      network: 'Utilizes Cigna network',
      typeBadge: 'Excellent Value',
      rates: Object.assign({}, plans.find((plan) => plan.id === 'cigna-epo-1000').rates)
    }]
  }, extra || {});
}

function expectedLeadSubject(payload) {
  const answers = payload.answers || {};
  return `New Quote Tool Lead: ${answers.state || 'State?'} | ${answers.employees || '?'} Eligible | ${answers.enrolling || '?'} Enrolling`;
}

function expectedLeadBody(payload) {
  const answers = payload.answers || {};
  const contribution = payload.contribution || {};
  const tierMix = payload.tierMix || {};
  const selectedPlans = payload.selectedPlans || [];
  const enrollmentMixText =
    `EE: ${tierMix.employeeOnly || 0}, ` +
    `ES: ${tierMix.employeeSpouse || 0}, ` +
    `EC: ${tierMix.employeeChildren || 0}, ` +
    `Family: ${tierMix.family || 0}`;
  const selectedBlock = selectedPlans.length
    ? selectedPlans.map((p) => `- ${p.name || ''} (${p.network || ''})`).join('\n')
    : 'None selected';
  return `New DK Benefits Quote Tool Lead

Name: ${payload.firstName || ''}
Email: ${payload.email || ''}
Phone: ${payload.phone || ''}

State: ${answers.state || ''}
Eligible Employees: ${answers.employees || ''}
Expected Enrolling: ${answers.enrolling || ''}
Priority: ${answers.priority || ''}
Current Coverage: ${answers.coverage || ''}
Timeline: ${answers.timeline || ''}

Contribution:
Model: ${contribution.model || ''}
Percent: ${contribution.percent || ''}
Flat Dollar: ${contribution.flatDollar || ''}
Enrollment Mix:
${enrollmentMixText}

Selected Plans:
${selectedBlock}

Google Sheet:
${SHEET_URL}
`;
}

function expectedLeadRow(payload, received) {
  const answers = payload.answers || {};
  const contribution = payload.contribution || {};
  const tierMix = payload.tierMix || {};
  const selectedPlans = payload.selectedPlans || [];
  const selectedPlanText = selectedPlans.length
    ? selectedPlans.map((p) => `${p.name || ''} (${p.network || ''})`).join(', ')
    : 'None selected';
  const enrollmentMixText =
    `EE: ${tierMix.employeeOnly || 0}, ` +
    `ES: ${tierMix.employeeSpouse || 0}, ` +
    `EC: ${tierMix.employeeChildren || 0}, ` +
    `Family: ${tierMix.family || 0}`;
  return [
    received[0],
    payload.firstName || '',
    payload.email || '',
    payload.phone || '',
    answers.state || '',
    answers.employees || '',
    answers.enrolling || '',
    answers.priority || '',
    answers.coverage || '',
    answers.timeline || '',
    contribution.model || '',
    contribution.percent || '',
    contribution.flatDollar || '',
    enrollmentMixText,
    selectedPlanText,
    JSON.stringify(payload)
  ];
}

test('current plans.json is a successful visible rate result', () => {
  const result = activity.classifyDisplayedRates(plans, { visibleGroups: ['top', 'low'] });
  assert.equal(result.status, 'ok');
  assert.ok(result.count >= 1);
});

test('empty catalogs and failed loads are not successful rate results', () => {
  assert.equal(activity.classifyDisplayedRates([], { visibleGroups: ['top', 'low'] }).status, 'empty');
  assert.equal(activity.classifyDisplayedRates(zeroRatePlans(), { visibleGroups: ['top', 'low'] }).status, 'empty');
  assert.equal(activity.classifyDisplayedRates(null, { error: new Error('Failed to load plans.json (500)') }).status, 'error');
  const mecOnly = [{
    group: 'mec',
    rates: { employeeOnly: 180, employeeSpouse: 360, employeeChildren: 340, family: 520 }
  }];
  assert.equal(activity.classifyDisplayedRates(mecOnly, { visibleGroups: ['top', 'low'] }).status, 'empty');
  assert.equal(activity.classifyDisplayedRates(mecOnly, { visibleGroups: ['top', 'low', 'mec'] }).status, 'ok');
});

test('one rate display emails once across rerenders, refresh, and retry', async () => {
  const { world, sandbox } = fresh();
  const storage = memoryStorage();
  let posts = 0;

  function post(payload) {
    posts += 1;
    const allowed = ['event', 'sessionId', 'timestamp', 'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content'];
    assert.deepEqual(Object.keys(payload).filter((key) => !allowed.includes(key)), []);
    const body = callDoPost(sandbox, payload);
    if (body.ok === false) throw new Error(body.error || 'activity failed');
    return { ok: true, body };
  }

  let tracker = activity.createQuoteActivityTracker({ storage, post, now: () => NOW });
  tracker.captureLandingUtms(UTM_QUERY);
  await tracker.onQuoteStarted();
  await tracker.onRatesRendered({ plans, visibleGroups: ['top', 'low'] });
  await tracker.onRatesRendered({ plans, visibleGroups: ['top', 'low'] });
  await tracker.onRatesRendered({ plans, visibleGroups: ['top', 'low'] });

  const sessionId = tracker.getSessionId();
  tracker = activity.createQuoteActivityTracker({ storage, post, now: () => NOW });
  tracker.captureLandingUtms('?utm_source=should-not-replace');
  await tracker.onRatesRendered({ plans, visibleGroups: ['top', 'low'] });

  const retry = callDoPost(sandbox, {
    event: 'rates_displayed',
    sessionId,
    timestamp: '1999-01-01T00:00:00.000Z',
    utm_source: 'google',
    utm_medium: 'cpc',
    utm_campaign: 'oct',
    utm_term: 'group-health',
    utm_content: 'hero',
    firstName: 'ZZSensitiveName',
    answers: { employees: 4242, zip: '99999', salary: 90000 }
  });
  assert.equal(retry.duplicate, true);
  assert.equal(retry.emailed, false);

  await tracker.onRatesRendered({ plans: [] });
  await tracker.onRatesRendered({ plans: zeroRatePlans() });
  await tracker.onRatesRendered({ plans: null, error: new Error('Failed to load plans.json (500)') });

  assert.equal(posts, 2);
  assert.equal(world.cacheReads.length, 0);
  assert.equal(world.propertyWrites.length, 0);
  const activityMails = world.messages.filter((message) => message.subject === 'Anonymous quote activity');
  assert.equal(activityMails.length, 1);
  assert.equal(activityMails[0].to, 'dan@dkbenefits.net');
  assert.equal(activityMails[0].body.includes('Anonymous quote activity'), true);
  assert.equal(activityMails[0].body.includes('New Quote Tool Lead'), false);
  assert.equal(activityMails[0].body.includes('Quote Tool Lead Error'), false);
  assert.equal(activityMails[0].body.includes('ZZSensitiveName'), false);
  assert.equal(activityMails[0].body.includes('4242'), false);
  assert.equal(activityMails[0].body.includes('99999'), false);
  assert.equal(activityMails[0].subject.startsWith('New Quote Tool Lead'), false);
  const rateRow = eventRows(world).find((row) => row.event === 'rates_displayed');
  assert.ok(rateRow);
  assert.equal(rateRow.email_result, 'sent');
  assert.equal(rateRow.utm_source, 'google');
  assert.equal(rateRow.utm_medium, 'cpc');
  assert.equal(rateRow.utm_campaign, 'oct');
  assert.equal(rateRow.utm_term, 'group-health');
  assert.equal(rateRow.utm_content, 'hero');
  assert.equal(activityMails[0].body.includes('Timestamp: ' + rateRow.timestamp), true);
  assert.equal(activityMails[0].body.includes('Quote session ID: ' + sessionId), true);
  assert.equal(rateRow.timestamp === '1999-01-01T00:00:00.000Z', false);
  assert.equal(eventRows(world).filter((row) => row.event === 'quote_started').length, 1);
  assert.equal(eventRows(world).filter((row) => row.event === 'rates_displayed').length, 1);
  assert.equal(sheet1Rows(world).length, 0);
  assert.equal(world.messages.some((message) => message.subject === 'Quote Tool Lead Error'), false);
  assert.equal(world.messages.some((message) => message.subject.startsWith('New Quote Tool Lead')), false);

  const eventsSheet = world.sheets.get('Quote Events');
  assert.deepEqual(hostRow(eventsSheet._rows[0]), [
    'timestamp', 'event', 'session_id', 'utm_source', 'utm_medium',
    'utm_campaign', 'utm_term', 'utm_content', 'email_attempted', 'email_result'
  ]);
  assert.equal(eventsSheet._rows.filter((row) => row[0] === 'timestamp').length, 1);
  const mailIndex = world.log.indexOf('mail:Anonymous quote activity');
  const appendIndex = world.log.indexOf('append:Quote Events:rates_displayed');
  assert.ok(appendIndex !== -1 && appendIndex < mailIndex);
});

test('overlapping renders share one rates request', async () => {
  const { world, sandbox } = fresh();
  let posts = 0;
  let release;
  const gate = new Promise((resolve) => { release = resolve; });
  const tracker = activity.createQuoteActivityTracker({
    storage: memoryStorage(),
    now: () => NOW,
    post(payload) {
      posts += 1;
      return gate.then(() => {
        const body = callDoPost(sandbox, payload);
        if (body.ok === false) throw new Error(body.error || 'failed');
        return { ok: true, body };
      });
    }
  });
  const renders = [
    tracker.onRatesRendered({ plans, visibleGroups: ['top', 'low'] }),
    tracker.onRatesRendered({ plans, visibleGroups: ['top', 'low'] }),
    tracker.onRatesRendered({ plans, visibleGroups: ['top', 'low'] })
  ];
  release();
  await Promise.all(renders);
  assert.equal(posts, 1);
  assert.equal(world.messages.length, 1);
  assert.equal(eventRows(world).filter((row) => row.event === 'rates_displayed').length, 1);
});

test('empty and error results do not post and do not email', async () => {
  const { world, sandbox } = fresh();
  let posts = 0;
  const tracker = activity.createQuoteActivityTracker({
    storage: memoryStorage(),
    now: () => NOW,
    post(payload) {
      posts += 1;
      return { ok: callDoPost(sandbox, payload).ok === true };
    }
  });
  const empty = await tracker.onRatesRendered({ plans: [] });
  const zeros = await tracker.onRatesRendered({ plans: zeroRatePlans() });
  const failed = await tracker.onRatesRendered({ plans: null, error: new Error('plans.json is not valid JSON') });
  assert.equal(empty.classification.status, 'empty');
  assert.equal(zeros.classification.status, 'empty');
  assert.equal(failed.classification.status, 'error');
  assert.equal(posts, 0);
  assert.equal(world.messages.length, 0);
  assert.equal(world.attempts.length, 0);
  assert.equal(world.sheets.has('Quote Events'), false);
  assert.equal(sheet1Rows(world).length, 0);
});

test('all three events are recorded when mail throws, without a lead-error email for activity', () => {
  const { world, sandbox } = fresh();
  world.state.mailThrows = true;
  const sessionId = crypto.randomUUID();
  const base = {
    sessionId,
    utm_source: 'newsletter',
    utm_medium: 'email',
    utm_campaign: 'fall',
    utm_term: 'rates',
    utm_content: 'link'
  };

  const started = callDoPost(sandbox, Object.assign({ event: 'quote_started' }, base));
  assert.equal(started.ok, true);
  const rates = callDoPost(sandbox, Object.assign({ event: 'rates_displayed', firstName: 'ZZSensitiveName' }, base));
  assert.equal(rates.ok, false);
  assert.equal(rates.recorded, true);

  const activityAttempts = world.attempts.map((message) => message.subject);
  assert.deepEqual(activityAttempts, ['Anonymous quote activity']);
  assert.equal(sheet1Rows(world).length, 0);
  assert.equal(eventRows(world).map((row) => row.event).join(','), 'quote_started,rates_displayed');
  assert.equal(eventRows(world)[1].email_result, 'failed');
  assert.equal(JSON.stringify(eventRows(world)).includes('ZZSensitiveName'), false);

  const lead = leadFixture({
    event: 'lead_submitted',
    sessionId,
    utm_source: 'newsletter'
  });
  assert.throws(() => callDoPost(sandbox, lead), /smtp down/);
  assert.deepEqual(eventRows(world).map((row) => row.event), ['quote_started', 'rates_displayed', 'lead_submitted']);
  assert.equal(sheet1Rows(world).length, 1);
  assert.equal(sheet1Rows(world)[0][1], 'Ada');
  assert.equal(sheet1Rows(world)[0][2], 'ada@example.com');
  assert.ok(world.attempts.some((message) => message.subject === 'Quote Tool Lead Error'));
  assert.ok(world.attempts.some((message) => message.subject.startsWith('New Quote Tool Lead')));
  const leadEventAppend = world.log.indexOf('append:Quote Events:lead_submitted');
  const leadSheetAppend = world.log.indexOf('append:Sheet1:lead');
  const leadMail = world.log.findIndex((entry) => entry.startsWith('mail:New Quote Tool Lead'));
  assert.ok(leadEventAppend !== -1 && leadEventAppend < leadSheetAppend && leadSheetAppend < leadMail);
});

test('a rates mail failure can be retried once without a second row or a lead-error email', () => {
  const { world, sandbox } = fresh();
  const sessionId = crypto.randomUUID();
  const payload = { event: 'rates_displayed', sessionId, utm_source: 'google' };
  world.state.mailThrows = true;
  const failed = callDoPost(sandbox, payload);
  assert.equal(failed.ok, false);
  world.state.mailThrows = false;
  const recovered = callDoPost(sandbox, payload);
  assert.equal(recovered.ok, true);
  assert.equal(recovered.emailed, true);
  assert.equal(eventRows(world).filter((row) => row.event === 'rates_displayed').length, 1);
  assert.equal(eventRows(world)[0].email_result, 'sent');
  assert.equal(world.messages.length, 1);
  assert.equal(world.messages[0].subject, 'Anonymous quote activity');
  assert.equal(world.attempts.some((message) => message.subject === 'Quote Tool Lead Error'), false);
  assert.equal(sheet1Rows(world).length, 0);
});

test('lead submit sends one New Quote Tool Lead email and an unchanged Sheet1 row', () => {
  const { world, sandbox } = fresh();
  const storage = memoryStorage();
  const tracker = activity.createQuoteActivityTracker({
    storage,
    now: () => NOW,
    post() { throw new Error('lead test posts through doPost directly'); }
  });
  tracker.captureLandingUtms(UTM_QUERY);
  const payload = tracker.decorateLeadPayload(leadFixture());
  for (const key of ['firstName', 'email', 'phone', 'answers', 'contribution', 'tierMix', 'selectedPlans']) {
    assert.equal(Object.prototype.hasOwnProperty.call(payload, key), true);
  }
  assert.equal(payload.event, 'lead_submitted');
  assert.equal(payload.firstName, 'Ada');
  assert.equal(payload.answers.employees, '12');
  assert.equal(payload.contribution.model, 'percent');
  assert.equal(payload.tierMix.employeeOnly, 5);
  assert.equal(payload.selectedPlans[0].name, 'Cigna EPO 1000');

  const result = callDoPost(sandbox, payload);
  assert.equal(result.ok, true);
  assert.equal(world.messages.length, 1);
  assert.equal(world.messages[0].to, 'dan@dkbenefits.net');
  assert.equal(world.messages[0].subject, expectedLeadSubject(payload));
  assert.equal(world.messages[0].subject, 'New Quote Tool Lead: Florida | 12 Eligible | 8 Enrolling');
  assert.equal(world.messages[0].body, expectedLeadBody(payload));
  assert.equal(world.messages[0].body.split('\n').includes('a'), false);
  assert.equal(world.messages[0].body.includes('Anonymous quote activity'), false);
  assert.equal(sheet1Rows(world).length, 1);
  const leadRow = hostRow(sheet1Rows(world)[0]);
  assert.deepEqual(leadRow, expectedLeadRow(payload, leadRow));
  assert.equal(leadRow[0] instanceof Date, true);
  assert.equal(leadRow[11], 50);
  assert.equal(leadRow[12], '');
  assert.equal(leadRow[13], 'EE: 5, ES: 1, EC: 1, Family: 1');
  assert.equal(leadRow[14], 'Cigna EPO 1000 (Utilizes Cigna network)');
  assert.equal(eventRows(world).length, 1);
  assert.equal(eventRows(world)[0].event, 'lead_submitted');
  assert.equal(eventRows(world)[0].email_result, 'sent');
  assert.equal(JSON.stringify(eventRows(world)).includes('ada@example.com'), false);
  assert.equal(JSON.stringify(eventRows(world)).includes('Ada'), false);
});

test('a legacy payload with no event field keeps the Sheet1 row and lead email', () => {
  const { world, sandbox } = fresh();
  const payload = leadFixture();
  assert.equal(Object.prototype.hasOwnProperty.call(payload, 'event'), false);
  const result = callDoPost(sandbox, payload);
  assert.equal(result.ok, true);
  assert.equal(world.messages.length, 1);
  assert.equal(world.messages[0].subject, expectedLeadSubject(payload));
  assert.equal(world.messages[0].body, expectedLeadBody(payload));
  assert.equal(world.messages[0].body.split('\n').includes('a'), false);
  const legacyRow = hostRow(sheet1Rows(world)[0]);
  assert.deepEqual(legacyRow, expectedLeadRow(payload, legacyRow));
  assert.equal(world.sheets.has('Quote Events'), false);
});

test('event logging failure does not block the lead email', () => {
  const { world, sandbox } = fresh();
  world.state.failEventsWrites = true;
  const payload = leadFixture({
    event: 'lead_submitted',
    sessionId: crypto.randomUUID(),
    utm_source: 'google'
  });
  const result = callDoPost(sandbox, payload);
  assert.equal(result.ok, true);
  assert.equal(world.messages.length, 1);
  assert.equal(world.messages[0].subject, expectedLeadSubject(payload));
  assert.equal(world.messages[0].body, expectedLeadBody(payload));
  assert.equal(sheet1Rows(world).length, 1);
  assert.equal(world.attempts.some((message) => message.subject === 'Quote Tool Lead Error'), false);
});

test('activity events and unknown events never append to Sheet1', () => {
  const { world, sandbox } = fresh();
  const sessionId = crypto.randomUUID();
  callDoPost(sandbox, {
    event: 'rates_displayed',
    sessionId,
    firstName: 'Ada',
    email: 'ada@example.com',
    answers: { state: 'Florida', employees: '12', enrolling: '8' },
    utm_source: 'google'
  });
  const unknown = callDoPost(sandbox, {
    event: 'not_a_lead',
    firstName: 'Ada',
    email: 'ada@example.com'
  });
  assert.equal(unknown.ok, false);
  assert.equal(sheet1Rows(world).length, 0);
  assert.equal(world.messages.some((message) => message.subject.startsWith('New Quote Tool Lead')), false);
  assert.equal(world.messages.some((message) => message.subject === 'Quote Tool Lead Error'), false);
  assert.equal(world.messages.length, 1);
  assert.equal(world.messages[0].subject, 'Anonymous quote activity');
});

test('a missing Sheet1 still sends Quote Tool Lead Error', () => {
  const { world, sandbox } = fresh();
  world.state.omitSheet1 = true;
  const result = callDoPost(sandbox, leadFixture());
  assert.equal(result.ok, false);
  assert.equal(world.messages.length, 1);
  assert.equal(world.messages[0].subject, 'Quote Tool Lead Error');
  assert.equal(world.messages[0].to, 'dan@dkbenefits.net');
  assert.equal(world.messages[0].body.includes('Sheet named "Sheet1" not found.'), true);
});

test('the merged script is the paste-ready file and the page still posts the fields it reads', () => {
  assert.equal(serverSource.split('\n').some((line) => line.trim() === 'a'), false);
  assert.equal(serverSource.includes('New Quote Tool Lead:'), true);
  assert.equal(serverSource.includes("getSheetByName(SHEET_NAME)"), true);
  assert.equal(serverSource.includes('Quote Events'), true);
  assert.equal(serverSource.includes('AKfycby4-ZxTQfsAgIBO0JYSngccVoj5HRKtNshy6N2XlJhbxaEk2oW7b_xIRBGlcSq0CZ0z'), false);

  const page = fs.readFileSync(path.join(__dirname, '../quote-tool.js'), 'utf8');
  const classic = fs.readFileSync(path.join(__dirname, '../quote-tool-classic.html'), 'utf8');
  const legacy = fs.readFileSync(path.join(__dirname, '../preview-legacy/index.html'), 'utf8');
  const live = fs.readFileSync(path.join(__dirname, '../quote-tool.html'), 'utf8');
  const previewJs = fs.readFileSync(path.join(__dirname, '../preview/preview.js'), 'utf8');
  assert.equal(page.includes('firstName: firstName.value.trim()'), true);
  assert.equal(page.includes('email: email.value.trim()'), true);
  assert.equal(page.includes('phone: phone.value.trim()'), true);
  assert.equal(page.includes('answers: { ...answers }'), true);
  assert.equal(page.includes('tierMix,'), true);
  assert.equal(page.includes('contribution: {'), true);
  assert.equal(page.includes('selectedPlans: Array.from(selectedPlans.values())'), true);
  assert.equal(page.includes('activityTracker.decorateLeadPayload('), true);
  assert.equal(classic.indexOf('quote-activity.js') < classic.indexOf('quote-tool.js'), true);
  assert.equal(classic.includes('quote-tool.css'), true);
  assert.equal(legacy.includes('quote-activity.js'), true);
  assert.equal(legacy.includes('preview/preview.js'), true);
  assert.equal(legacy.includes('preview/preview.css'), true);
  assert.equal(legacy.includes('preview/quote-math.js'), true);
  assert.equal(legacy.includes('utm_source=preview'), false);
  assert.equal(legacy.includes('quote-tool.js'), false);
  assert.equal(legacy.includes('100vh'), false);
  assert.equal(live.includes('__rfLive'), true);
  assert.equal(live.includes('rates-first/rates-first.js'), true);
  assert.equal(live.includes('quote-activity.js'), true);
  assert.equal(live.includes('utm_source=preview'), false);
  assert.equal(live.includes('AKfycby4-ZxTQfsAgIBO0JYSngccVoj5HRKtNshy6N2XlJhbxaEk2oW7b_xIRBGlcSq0CZ0z'), false);
  assert.equal(previewJs.includes('https://script.google.com/macros/s/AKfycby4-ZxTQfsAgIBO0JYSngccVoj5HRKtNshy6N2XlJhbxaEk2oW7b_xIRBGlcSq0CZ0z/exec'), true);
});
