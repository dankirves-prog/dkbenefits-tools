const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const http = require('http');
const path = require('path');
const { spawn } = require('child_process');

const root = path.join(__dirname, '..');

test('typing in the HIPAA job-title field keeps focus, and so does every other text field', async function () {
  const js = fs.readFileSync(path.join(root, 'wrapplan.js'), 'utf8');
  assert.match(js, /phiField\.parentNode !== phiHome/);
  const chrome = '/usr/local/bin/google-chrome';
  if (!fs.existsSync(chrome)) return;
  const port = 8814;
  const debug = 9376;
  const server = http.createServer(function (req, res) {
    const rel = decodeURIComponent(req.url.split('?')[0]);
    const file = path.join(root, rel === '/' ? 'index.html' : rel);
    if (!file.startsWith(root) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
      res.writeHead(404);
      res.end('no');
      return;
    }
    const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' };
    res.writeHead(200, { 'Content-Type': (types[path.extname(file)] || 'application/octet-stream') + '; charset=utf-8' });
    fs.createReadStream(file).pipe(res);
  });
  await new Promise(function (resolve) { server.listen(port, '127.0.0.1', resolve); });
  const child = spawn(chrome, [
    '--headless=new', '--disable-gpu', '--no-sandbox',
    '--remote-debugging-port=' + debug, '--user-data-dir=/tmp/wp-focus-chrome', 'about:blank'
  ], { stdio: 'ignore' });
  try {
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
    async function evalJs(expression) {
      const res = await send('Runtime.evaluate', { expression: expression, returnByValue: true, awaitPromise: true });
      if (res.exceptionDetails) throw new Error(JSON.stringify(res.exceptionDetails));
      return res.result ? res.result.value : undefined;
    }
    await send('Page.enable');
    const ready = await evalJs(`new Promise(function (resolve, reject) {
      var start = Date.now();
      var timer = setInterval(function () {
        if (document.querySelector('input[name="benefits"][value="medical"]') && document.querySelector('input[name="funding"][value="level"]')) {
          clearInterval(timer);
          resolve(true);
        } else if (Date.now() - start > 8000) {
          clearInterval(timer);
          reject(new Error('timeout'));
        }
      }, 40);
    })`);
    assert.equal(ready, true);
    const report = JSON.parse(await evalJs(`(function () {
      function choose(selector) {
        var el = document.querySelector(selector);
        el.checked = true;
        el.dispatchEvent(new Event('change', { bubbles: true }));
      }
      function typeInto(el, text) {
        var home = document.getElementById('phiStep');
        var lost = [];
        var moved = [];
        el.focus();
        var canFocus = document.activeElement === el;
        for (var i = 0; i < text.length; i++) {
          var parent = home.parentNode;
          el.value = text.slice(0, i + 1);
          el.dispatchEvent(new Event('input', { bubbles: true }));
          if (home.parentNode !== parent) moved.push(el.value);
          if (canFocus && document.activeElement !== el) lost.push(el.value);
        }
        return { lost: lost, moved: moved, parent: home.parentNode && home.parentNode.id, canFocus: canFocus };
      }
      choose('input[name="benefits"][value="medical"]');
      choose('input[name="funding"][value="level"]');
      document.querySelector('[data-step="5"]').hidden = false;
      var field = document.getElementById('phi_classes');
      var selfReport = typeInto(field, 'Benefits manager');
      choose('input[name="funding"][value="insured"]');
      document.querySelector('[data-step="6"]').hidden = false;
      document.getElementById('lessCommon').open = true;
      choose('input[name="phi"][value="yes"]');
      var insuredReport = typeInto(field, 'Owner');
      document.querySelectorAll('[data-step]').forEach(function (section) { section.hidden = false; });
      document.querySelectorAll('[hidden]').forEach(function (el) { el.hidden = false; });
      var failed = [];
      var checked = 0;
      document.querySelectorAll('input[type="text"], input[type="tel"], input[type="email"], textarea').forEach(function (el) {
        if (!el.id || el.id === 'company_website') return;
        var parent = el.parentNode;
        el.focus();
        var canFocus = document.activeElement === el;
        el.dispatchEvent(new Event('input', { bubbles: true }));
        checked += 1;
        if (el.parentNode !== parent) failed.push(el.id + ':moved');
        if (canFocus && document.activeElement !== el) failed.push(el.id + ':blur');
      });
      return JSON.stringify({
        selfReport: selfReport,
        insuredReport: insuredReport,
        failed: failed,
        checked: checked
      });
    })()`));
    assert.equal(report.selfReport.parent, 'selfMedicalStep');
    assert.deepEqual(report.selfReport.lost, []);
    assert.deepEqual(report.selfReport.moved, []);
    assert.equal(report.insuredReport.parent, 'phiLess');
    assert.deepEqual(report.insuredReport.lost, []);
    assert.deepEqual(report.insuredReport.moved, []);
    assert.deepEqual(report.failed, []);
    assert.ok(report.checked > 8, JSON.stringify(report));
    ws.close();
  } finally {
    child.kill();
    await new Promise(function (resolve) { server.close(resolve); });
  }
});
