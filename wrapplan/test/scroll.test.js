const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const http = require('http');
const path = require('path');
const { spawn } = require('child_process');

const root = path.join(__dirname, '..');

test('a step change scrolls to the top and tells the Wix parent', async function () {
  const js = fs.readFileSync(path.join(root, 'wrapplan.js'), 'utf8');
  const css = fs.readFileSync(path.join(root, 'wrapplan.css'), 'utf8');
  const embed = fs.readFileSync(path.join(root, 'embed.html'), 'utf8');
  assert.match(js, /type: 'wp-scroll'/);
  assert.match(js, /https:\/\/www-dkbenefits-net\.filesusr\.com/);
  assert.match(js, /window\.scrollTo\(\{ top: 0, left: 0, behavior: 'auto' \}\)/);
  assert.match(js, /scrollIntoView\(\{ block: 'start', behavior: 'auto' \}\)/);
  assert.match(js, /showStep\(0, \{ scroll: false \}\)/);
  assert.doesNotMatch(js, /postMessage\([^)]*'\*'/);
  assert.match(js, /showStep\(step \+ 1\)/);
  assert.match(js, /showStep\(step - 1\)/);
  assert.match(js, /showStep\(line\[0\]\)/);
  assert.match(js, /showStep\(6\)/);
  assert.match(js, /showStep\(3\)/);
  assert.match(js, /showStep\(7\)/);
  assert.match(css, /scroll-margin-top:\s*90px/);
  assert.match(embed, /www-dkbenefits-net\.filesusr\.com/);

  const chrome = '/usr/local/bin/google-chrome';
  if (!fs.existsSync(chrome)) return;
  const port = 8812;
  const debug = 9372;
  const parentHtml = '<!DOCTYPE html><html><head><meta charset="utf-8"></head><body style="margin:0">' +
    '<div style="height:900px">above</div><iframe id="tool" title="Wrap plan" style="width:100%;height:420px;border:0"></iframe>' +
    '<div style="height:900px">below</div><script>' +
    'window.__calls=[];var orig=window.postMessage.bind(window);' +
    'window.postMessage=function(data,origin){window.__calls.push({data:data,origin:origin});try{return orig(data,origin);}catch(err){return undefined;}};' +
    'document.getElementById("tool").src="/index.html";' +
    '</script></body></html>';
  const server = http.createServer(function (req, res) {
    const rel = decodeURIComponent(req.url.split('?')[0]);
    if (rel === '/scroll-parent.html') {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(parentHtml);
      return;
    }
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
    '--headless=new', '--disable-gpu', '--no-sandbox', '--hide-scrollbars',
    '--remote-debugging-port=' + debug, '--user-data-dir=/tmp/wp-scroll-chrome', 'about:blank'
  ], { stdio: 'ignore' });
  try {
    await new Promise(function (resolve) { setTimeout(resolve, 700); });
    const tab = await fetch('http://127.0.0.1:' + debug + '/json/new?about:blank', { method: 'PUT' }).then(function (res) { return res.json(); });
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
    async function waitFor(expression) {
      const ok = await evalJs(`new Promise(function (resolve, reject) {
        var start = Date.now();
        var timer = setInterval(function () {
          var value;
          try { value = (${expression}); } catch (err) { value = null; }
          if (value) { clearInterval(timer); resolve(true); }
          else if (Date.now() - start > 8000) { clearInterval(timer); reject(new Error('timeout')); }
        }, 40);
      })`);
      assert.equal(ok, true);
    }

    await send('Page.enable');
    await send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 700, deviceScaleFactor: 1, mobile: false });
    await send('Page.navigate', { url: 'http://127.0.0.1:' + port + '/index.html' });
    await waitFor(`document.querySelector('#nextBtn') && document.querySelector('#benefitGroups .benefit-item')`);
    const standalone = JSON.parse(await evalJs(`(async function () {
      document.body.style.minHeight = '2400px';
      window.scrollTo(0, 900);
      var before = window.scrollY;
      document.getElementById('nextBtn').click();
      await new Promise(function (resolve) { setTimeout(resolve, 50); });
      var afterNext = window.scrollY;
      var nextTitle = document.getElementById('stepTitle').textContent;
      window.scrollTo(0, 900);
      document.getElementById('backBtn').click();
      await new Promise(function (resolve) { setTimeout(resolve, 50); });
      return JSON.stringify({ before: before, afterNext: afterNext, afterBack: window.scrollY, nextTitle: nextTitle, step: document.getElementById('stepTitle').textContent });
    })()`));
    assert.ok(standalone.before > 100, JSON.stringify(standalone));
    assert.ok(standalone.afterNext < 5, JSON.stringify(standalone));
    assert.equal(standalone.nextTitle, 'Your company');
    assert.ok(standalone.afterBack < 5, JSON.stringify(standalone));
    assert.equal(standalone.step, 'Build your wrap plan document');

    await send('Page.navigate', { url: 'http://127.0.0.1:' + port + '/scroll-parent.html' });
    await waitFor(`document.getElementById('tool') && document.getElementById('tool').contentDocument && document.getElementById('tool').contentDocument.querySelector('#nextBtn') && document.getElementById('tool').contentDocument.querySelector('#benefitGroups .benefit-item')`);
    const embedded = JSON.parse(await evalJs(`(async function () {
      var frame = document.getElementById('tool');
      var doc = frame.contentDocument;
      var before = window.__calls.filter(function (call) { return call.data && call.data.type === 'wp-scroll'; });
      frame.style.height = '4000px';
      window.scrollTo(0, 900);
      doc.getElementById('nextBtn').click();
      await new Promise(function (resolve) { setTimeout(resolve, 50); });
      var calls = window.__calls.filter(function (call) { return call.data && call.data.type === 'wp-scroll'; });
      var files = calls.filter(function (call) { return call.origin === 'https://www-dkbenefits-net.filesusr.com'; });
      var message = files.length ? files[files.length - 1].data : null;
      if (message) {
        var frameTop = frame.getBoundingClientRect().top + window.scrollY;
        window.scrollTo(0, Math.max(0, frameTop + message.top - 90));
      }
      var title = doc.getElementById('stepTitle').getBoundingClientRect();
      var frameBox = frame.getBoundingClientRect();
      return JSON.stringify({
        before: before.length,
        count: calls.length,
        origins: files.length,
        message: message,
        keys: message ? Object.keys(message).sort() : [],
        parentTitleTop: Math.round(frameBox.top + title.top),
        iframeTop: Math.round(frameBox.top),
        stepText: doc.getElementById('stepTitle').textContent
      });
    })()`));
    assert.equal(embedded.before, 0, JSON.stringify(embedded));
    assert.ok(embedded.origins >= 1, JSON.stringify(embedded));
    assert.equal(embedded.message.type, 'wp-scroll');
    assert.equal(embedded.message.step, 1);
    assert.equal(typeof embedded.message.top, 'number');
    assert.ok(embedded.message.top > 0);
    assert.deepEqual(embedded.keys, ['step', 'top', 'type']);
    assert.equal(embedded.stepText, 'Your company');
    assert.ok(embedded.parentTitleTop >= 70 && embedded.parentTitleTop <= 120, JSON.stringify(embedded));
    ws.close();
  } finally {
    child.kill();
    await new Promise(function (resolve) { server.close(resolve); });
  }
});
