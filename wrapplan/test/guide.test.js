const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { loadBrowserScripts, baseInput, root } = require('./helpers');

function boot() { return loadBrowserScripts(); }

test('business phone is required and the SPD does not use a records fallback', function () {
  const context = boot();
  const missing = context.WpModel.validate(baseInput({ phone: '' }));
  assert.equal(missing.ok, false);
  assert.ok(missing.errors.some(function (error) { return error.field === 'phone'; }));
  const pack = context.WpModel.validate(baseInput());
  const spd = context.WpDocgen.plainText(context.WpDocgen.spdParagraphs(pack.plan));
  assert.match(spd, /407-555-0148/);
  assert.doesNotMatch(spd, /the number on the employer's records/);
  const blank = context.WpDocgen.plainText(context.WpDocgen.spdParagraphs(context.WpModel.normalize(baseInput({
    phone: '',
    carrier_addresses: { medical: '', dental: '', vision: '' }
  }))));
  assert.match(blank, /Address: ________________ \(copy it from your certificate\)/);
  assert.doesNotMatch(blank, /the number on the employer's records/);
});

test('January is a calendar year and July ends in June', function () {
  const Wp = boot().WpModel;
  const january = Wp.planYearFromStart(1);
  assert.equal(january.plan_year_type, 'calendar');
  assert.equal(january.plan_year_end_month, '12');
  const july = Wp.planYearFromStart(7);
  assert.equal(july.plan_year_type, 'fiscal');
  assert.equal(july.plan_year_end_month, '6');
  const plan = Wp.normalize(baseInput({ plan_year_start_month: '7' }));
  assert.equal(plan.plan_year_type, 'fiscal');
  assert.equal(plan.plan_year_end_month, '6');
});

test('effective date choices stay correct in the last month of the plan year', function () {
  const Wp = boot().WpModel;
  for (var month = 1; month <= 12; month++) {
    const mid = Wp.effectiveDateChoices(month, new Date(2026, month - 1, 15));
    assert.equal(mid.current, '2026-' + String(month).padStart(2, '0') + '-01');
    assert.equal(mid.next.slice(0, 4), '2027');
    const lastMonth = month === 1 ? 12 : month - 1;
    const lastYear = month === 1 ? 2026 : 2026;
    const asOf = new Date(lastYear, lastMonth - 1, 20);
    const edge = Wp.effectiveDateChoices(month, asOf);
    if (month === 1) {
      assert.equal(edge.current, '2026-01-01');
      assert.equal(edge.next, '2027-01-01');
    } else {
      assert.equal(edge.current, '2025-' + String(month).padStart(2, '0') + '-01');
      assert.equal(edge.next, '2026-' + String(month).padStart(2, '0') + '-01');
    }
  }
});

test('voluntary benefits can be included, left out, or forced in by tax treatment', function () {
  const context = boot();
  const Wp = context.WpModel;
  const base = {
    benefits: ['vol_life'],
    carriers: { vol_life: 'Aflac' },
    tax: { vol_life: 'aftertax' },
    vol_contrib: '',
    vol_voluntary: '',
    vol_endorse: '',
    vol_payroll_only: '',
    vol_consideration: ''
  };
  const left = Wp.normalize(baseInput(Object.assign({}, base, { vol_include: 'no' })));
  assert.equal(Wp.wrappedBenefits(left).indexOf('vol_life'), -1);
  const included = Wp.normalize(baseInput(Object.assign({}, base, { vol_include: 'yes' })));
  assert.ok(Wp.wrappedBenefits(included).indexOf('vol_life') !== -1);
  const forced = Wp.normalize(baseInput(Object.assign({}, base, { tax: { vol_life: 'pretax' }, vol_include: 'no' })));
  assert.ok(Wp.wrappedBenefits(forced).indexOf('vol_life') !== -1);
  const paid = Wp.normalize(baseInput(Object.assign({}, base, { tax: { vol_life: 'none' } })));
  assert.ok(Wp.wrappedBenefits(paid).indexOf('vol_life') !== -1);
  const spd = context.WpDocgen.plainText(context.WpDocgen.spdParagraphs(left));
  const schedule = context.WpDocgen.plainText(context.WpDocgen.scheduleParagraphs(left));
  assert.doesNotMatch(spd, /Voluntary life/);
  assert.doesNotMatch(schedule, /Voluntary life/);
});

test('guide calendar rows follow funding, size, and the Form 5500 month', function () {
  const Wp = boot().WpModel;
  const small = Wp.normalize(baseInput({
    employee_count: '12',
    census: { a: '10', b: '0', c: '0', d: '0' },
    benefits: ['medical'],
    carriers: { medical: 'Florida Blue' },
    funding: 'insured',
    cobra: 'yes'
  }));
  assert.equal(small.cobra, 'no');
  const smallRows = Wp.guideCalendar(small);
  const smallText = smallRows.yearly.concat(smallRows.hire, smallRows.changes).join(' ');
  assert.doesNotMatch(smallText, /PCORI|COBRA|5500|ACA/);
  const level = Wp.normalize(baseInput({
    employer_name: 'Northwind Manufacturing Inc',
    employee_count: '150',
    census: { a: '140', b: '0', c: '0', d: '0' },
    funding: 'level',
    benefits: ['medical', 'dental', 'hra', 'health_fsa'],
    carriers: { medical: 'Allied', dental: 'Sun Life', hra: 'Allied', health_fsa: 'WEX' },
    tpa_name: 'Allied',
    tpa_document: 'Allied booklet',
    stop_loss: 'yes',
    hra_type: 'integrated',
    cobra: 'yes',
    phi: 'yes'
  }));
  const levelRows = Wp.guideCalendar(level);
  const levelText = levelRows.yearly.join(' ');
  assert.match(levelText, /PCORI/);
  assert.match(levelText, /5500/);
  assert.match(levelText, /summary annual report/);
  assert.match(levelText, /ACA/);
  assert.match(levelRows.hire.join(' '), /COBRA general notice to the employee and spouse within 90 days after coverage starts/);
  function at(rows, pattern) {
    const index = rows.findIndex(function (row) { return pattern.test(row); });
    assert.ok(index >= 0, String(pattern));
    return index;
  }
  const year = levelRows.yearly;
  assert.ok(at(year, /ACA/) < at(year, /by March 1/));
  assert.ok(at(year, /by March 1/) < at(year, /RxDC/));
  assert.ok(at(year, /RxDC/) < at(year, /PCORI/));
  assert.ok(at(year, /PCORI/) < at(year, /Form 5500/));
  assert.ok(at(year, /Medicare Part D/) < at(year, /Renewal/));
  const july = Wp.guideCalendar(Wp.normalize(baseInput({ plan_year_start_month: '7', benefits: ['medical'], funding: 'insured' })));
  assert.match(july.yearly.join(' '), /by August 29/);
  const calendar = Wp.form5500Due(Wp.normalize(baseInput({ plan_year_type: 'calendar' })));
  assert.equal(calendar.label, 'July 31');
  const fiscal = Wp.form5500Due(Wp.normalize(baseInput({ plan_year_start_month: '7' })));
  assert.equal(fiscal.label, 'the following January 31');
});

test('the SPD file has its own cover and a certificate page', function () {
  const context = boot();
  const result = context.WpModel.validate(baseInput());
  const cover = context.WpDocgen.plainText(context.WpDocgen.spdCoverParagraphs(result.plan));
  const spd = context.WpDocgen.plainText(context.WpDocgen.spdParagraphs(result.plan));
  assert.match(cover, /Summary Plan Description/);
  assert.match(cover, /Keep this with your benefit certificates/);
  assert.match(cover, /407-555-0148/);
  assert.match(spd, /Your benefit certificates/);
  assert.match(spd, /Your employer attaches these behind this page/);
  assert.match(spd, /Medical: Florida Blue certificate of coverage/);
  const bytes = context.WpDocgen.buildPacketDocx([
    { rows: context.WpDocgen.spdCoverParagraphs(result.plan), footer: 'SPD', pageNumbers: false },
    { rows: context.WpDocgen.spdParagraphs(result.plan), footer: 'SPD' }
  ], { title: 'SPD' });
  assert.ok(bytes.length > 100);
  const xml = Buffer.from(bytes).toString('latin1');
  const coverFooter = xml.split('word/footer1.xml')[1].split('word/footer2.xml')[0];
  assert.doesNotMatch(coverFooter, /PAGE/);
  assert.match(xml, /PAGE/);
});

test('the employee email template does not use the visitor name', function () {
  const context = boot();
  const guide = context.WpDocgen.plainText(context.WpDocgen.guideParagraphs(context.WpModel.normalize(baseInput())));
  assert.match(guide, /Hi \[employee name\],/);
  assert.doesNotMatch(guide, /Hi Alex/);
  assert.match(guide, /Alex Rivera, Managing Member, signs the adoption resolution and the wrap signature page/);
  assert.match(guide, /Print more copies of this page as needed/);
});

test('blank insurer addresses and HIPAA job titles are named for the guide and the done screen', function () {
  const context = boot();
  const Wp = context.WpModel;
  const dental = Wp.normalize(baseInput({
    carrier_addresses: { medical: '1 Main', dental: '', vision: '' }
  }));
  assert.equal(
    Wp.missingAddressGuideLine(dental),
    'Fill in the Dental and Vision insurer addresses in the Word version of the SPD, then save it as a PDF. Copy the address from your certificate.'
  );
  assert.equal(Wp.blankAddressDoneText(2), 'Your SPD has 2 blank insurer addresses. Add them now or fill them in the Word file before you hand it out.');
  const one = Wp.normalize(baseInput({
    benefits: ['dental'],
    carriers: { dental: 'Sun Life' },
    carrier_addresses: { dental: '' }
  }));
  assert.equal(
    Wp.missingAddressGuideLine(one),
    'Fill in the Dental insurer address in the Word version of the SPD, then save it as a PDF. Copy the address from your certificate.'
  );
  const phi = Wp.normalize(baseInput({ phi: 'yes', phi_classes: '' }));
  assert.match(Wp.missingPhiGuideLine(phi), /Word version of the HIPAA amendment/);
  assert.match(Wp.blankPhiDoneText(), /blank job-title line/);
  const guide = context.WpDocgen.plainText(context.WpDocgen.guideParagraphs(dental));
  assert.match(guide, /Fill in the Dental and Vision insurer addresses in the Word version of the SPD/);
  const page = fs.readFileSync(path.join(root, 'wrapplan.js'), 'utf8');
  assert.match(page, /blankAddressDoneText/);
  assert.match(page, /showStep\(3\)/);
  assert.match(page, /blankPhiDoneText/);
});

test('a saved draft is restored and start over clears it', async function () {
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  const js = fs.readFileSync(path.join(root, 'wrapplan.js'), 'utf8');
  assert.match(html, /Welcome back\. We kept your answers\./);
  assert.match(html, /Start over/);
  assert.match(html, /Back to review/);
  assert.match(html, /Change my answers/);
  assert.match(js, /localStorage\.getItem\(DRAFT_KEY\)/);
  assert.match(js, /localStorage\.removeItem\(DRAFT_KEY\)/);
  assert.match(js, /fromReview = true/);
  const chrome = '/usr/local/bin/google-chrome';
  if (!fs.existsSync(chrome)) return;
  const http = require('http');
  const { spawn } = require('child_process');
  const port = 8796;
  const debug = 9356;
  const server = http.createServer(function (req, res) {
    const file = path.join(root, req.url.split('?')[0] === '/' ? 'index.html' : req.url.split('?')[0]);
    if (!file.startsWith(root) || !fs.existsSync(file)) { res.writeHead(404); res.end('no'); return; }
    res.writeHead(200); fs.createReadStream(file).pipe(res);
  }).listen(port, '127.0.0.1');
  const child = spawn(chrome, ['--headless=new', '--disable-gpu', '--no-sandbox', '--remote-debugging-port=' + debug, '--user-data-dir=/tmp/wp-draft-chrome', 'about:blank'], { stdio: 'ignore' });
  await new Promise(function (resolve) { setTimeout(resolve, 700); });
  const tab = await fetch('http://127.0.0.1:' + debug + '/json/new?http://127.0.0.1:' + port + '/index.html', { method: 'PUT' }).then(function (res) { return res.json(); });
  const ws = new WebSocket(tab.webSocketDebuggerUrl);
  await new Promise(function (resolve) { ws.addEventListener('open', resolve); });
  let seq = 0;
  const pending = new Map();
  ws.addEventListener('message', function (ev) {
    const msg = JSON.parse(ev.data);
    if (msg.id && pending.has(msg.id)) {
      const job = pending.get(msg.id);
      pending.delete(msg.id);
      if (msg.error) job.reject(new Error(JSON.stringify(msg.error)));
      else job.resolve(msg.result);
    }
  });
  function send(method, params) {
    const id = ++seq;
    return new Promise(function (resolve, reject) {
      pending.set(id, { resolve: resolve, reject: reject });
      ws.send(JSON.stringify({ id: id, method: method, params: params || {} }));
    });
  }
  function waitExpr(body) {
    return `new Promise(function (resolve, reject) {
      var started = Date.now();
      var timer = setInterval(function () {
        try {
          var value = (${body})();
          if (value) { clearInterval(timer); resolve(value); }
        } catch (err) {}
        if (Date.now() - started > 8000) { clearInterval(timer); reject(new Error('timed out')); }
      }, 40);
    })`;
  }
  await send('Page.enable');
  await send('Runtime.evaluate', {
    awaitPromise: true,
    expression: waitExpr(`function () { return !!document.querySelector('label[for="employer_ein"] .info'); }`)
  });
  await send('Runtime.evaluate', {
    expression: `document.getElementById('employer_name').value = 'Harbor Dental Group LLC';
      document.getElementById('employer_name').dispatchEvent(new Event('input', { bubbles: true }));`
  });
  await send('Page.reload', { ignoreCache: true });
  const restored = await send('Runtime.evaluate', {
    awaitPromise: true,
    returnByValue: true,
    expression: waitExpr(`function () {
      var note = document.getElementById('resumeNote');
      var name = document.getElementById('employer_name');
      if (note && name && !note.hidden && name.value === 'Harbor Dental Group LLC') return note.textContent;
      return '';
    }`)
  });
  assert.match(restored.result.value, /Welcome back/);
  await send('Runtime.evaluate', { expression: `document.getElementById('startOver').click()` });
  const cleared = await send('Runtime.evaluate', {
    awaitPromise: true,
    returnByValue: true,
    expression: waitExpr(`function () {
      var note = document.getElementById('resumeNote');
      var name = document.getElementById('employer_name');
      if (note && name && note.hidden && name.value === '' && document.querySelector('.info')) return true;
      return false;
    }`)
  });
  assert.equal(cleared.result.value, true);
  child.kill();
  server.close();
  ws.close();
});

test('info icons are 18px, do not inflate fields, and open on click', async function () {
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  const js = fs.readFileSync(path.join(root, 'wrapplan.js'), 'utf8');
  const css = fs.readFileSync(path.join(root, 'wrapplan.css'), 'utf8');
  const tips = fs.readFileSync(path.join(root, 'wp-tips.js'), 'utf8');
  assert.match(html, /wp-tips\.js/);
  assert.match(css, /\.info\s*\{[^}]*min-height:\s*0/);
  assert.match(css, /\.info\s*\{[^}]*height:\s*18px/);
  assert.match(css, /\.info\s*\{[^}]*width:\s*18px/);
  assert.match(css, /\.info\s*\{[^}]*padding:\s*0/);
  assert.match(css, /\.info\s*\{[^}]*border-radius:\s*50%/);
  assert.match(css, /\.info::before\s*\{[^}]*width:\s*24px/);
  assert.match(css, /\.info::before\s*\{[^}]*height:\s*24px/);
  assert.match(js, /className = 'info'/);
  assert.match(js, /aria-expanded/);
  assert.match(js, /role', 'dialog'/);
  assert.match(js, /Escape/);
  assert.doesNotMatch(html + js + css, /class="bubble"|role="tooltip"/);
  assert.doesNotMatch(tips, /\u2014|\u2013/);
  assert.match(tips, /ein:/);
  assert.match(tips, /waiting_period:/);
  const context = boot();
  const guide = context.WpDocgen.guideParagraphs(context.WpModel.normalize(baseInput()));
  const log = guide.filter(function (item) { return item.columns; })[0];
  assert.ok(log);
  assert.equal(log.blankRows, 15);
  assert.equal(log.columns[0], 'Employee');
  assert.equal(log.columns[1], 'Delivered by (hand, mail, email)');
  const heading = guide.filter(function (item) { return item.text === 'Delivery log'; })[0];
  assert.equal(heading.pageBreak, true);
  assert.match(context.WpDocgen.plainText(guide), /\[ \] Step 1\./);
  const bytes = context.WpDocgen.buildDocx(guide, { title: 'Guide', footer: 'Guide' });
  const xml = Buffer.from(bytes).toString('latin1');
  assert.match(xml, /<w:tbl>/);
  assert.equal(xml.split('<w:tr>').length - 1, 16);
  const chrome = '/usr/local/bin/google-chrome';
  if (!fs.existsSync(chrome)) return;
  const http = require('http');
  const { spawn } = require('child_process');
  const port = 8788;
  const debug = 9344;
  const server = http.createServer(function (req, res) {
    const file = path.join(root, req.url.split('?')[0] === '/' ? 'index.html' : req.url.split('?')[0]);
    if (!file.startsWith(root) || !fs.existsSync(file)) { res.writeHead(404); res.end('no'); return; }
    res.writeHead(200); fs.createReadStream(file).pipe(res);
  }).listen(port, '127.0.0.1');
  const child = spawn(chrome, ['--headless=new', '--disable-gpu', '--no-sandbox', '--remote-debugging-port=' + debug, '--user-data-dir=/tmp/wp-tip-chrome', 'about:blank'], { stdio: 'ignore' });
  await new Promise(function (resolve) { setTimeout(resolve, 700); });
  const tab = await fetch('http://127.0.0.1:' + debug + '/json/new?http://127.0.0.1:' + port + '/index.html', { method: 'PUT' }).then(function (res) { return res.json(); });
  const ws = new WebSocket(tab.webSocketDebuggerUrl);
  await new Promise(function (resolve) { ws.addEventListener('open', resolve); });
  let seq = 0;
  const pending = new Map();
  ws.addEventListener('message', function (ev) {
    const msg = JSON.parse(ev.data);
    if (msg.id && pending.has(msg.id)) {
      const job = pending.get(msg.id);
      pending.delete(msg.id);
      if (msg.error) job.reject(new Error(JSON.stringify(msg.error)));
      else job.resolve(msg.result);
    }
  });
  function send(method, params) {
    const id = ++seq;
    return new Promise(function (resolve, reject) {
      pending.set(id, { resolve: resolve, reject: reject });
      ws.send(JSON.stringify({ id: id, method: method, params: params || {} }));
    });
  }
  await send('Page.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false });
  await send('Runtime.evaluate', {
    awaitPromise: true,
    expression: `new Promise(function (resolve) {
      var timer = setInterval(function () {
        if (document.querySelector('label[for="employer_ein"] .info')) { clearInterval(timer); resolve(true); }
      }, 40);
    })`
  });
  await send('Runtime.evaluate', { expression: "document.getElementById('nextBtn').click()", awaitPromise: true });
  const measured = await send('Runtime.evaluate', {
    returnByValue: true,
    expression: `(function () {
      var info = document.querySelector('label[for="employer_ein"] .info');
      var name = document.getElementById('employer_name');
      var ein = document.getElementById('employer_ein');
      info.click();
      var pop = document.getElementById('tipPopover');
      var open = {
        height: Math.round(info.getBoundingClientRect().height),
        width: Math.round(info.getBoundingClientRect().width),
        nameH: Math.round(name.getBoundingClientRect().height),
        einH: Math.round(ein.getBoundingClientRect().height),
        expanded: info.getAttribute('aria-expanded'),
        role: pop.getAttribute('role'),
        hidden: pop.hidden,
        text: document.getElementById('tipBody').textContent
      };
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      open.closed = document.getElementById('tipPopover').hidden;
      return open;
    })()`
  });
  child.kill();
  server.close();
  ws.close();
  const open = measured.result.value;
  assert.equal(open.height, 18);
  assert.equal(open.width, 18);
  assert.equal(open.nameH, open.einH);
  assert.equal(open.einH, 44);
  assert.equal(open.expanded, 'true');
  assert.equal(open.role, 'dialog');
  assert.equal(open.hidden, false);
  assert.match(open.text, /employer identification number/);
  assert.equal(open.closed, true);
});
