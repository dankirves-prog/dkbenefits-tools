/**
 * One visitor id per browser session. The first calculation emails Dan once.
 * Later calculations update the same row. The form emails Dan once.
 */
(function (root, factory) {
  var api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.AcaLeads = api;
})(typeof window !== 'undefined' ? window : globalThis, function () {
  var SESSION_KEY = 'dkb_aca_session_id';
  var CALC_KEY = 'dkb_aca_calc_sent';
  var UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

  function endpointOf(value) {
    var url = typeof value === 'string' ? value.trim() : '';
    return /^https?:\/\//i.test(url) ? url : '';
  }

  function isSessionId(value) {
    return typeof value === 'string' && UUID_PATTERN.test(value);
  }

  function createSessionId() {
    if (globalThis.crypto && typeof globalThis.crypto.randomUUID === 'function') {
      return globalThis.crypto.randomUUID();
    }
    var bytes = [];
    for (var i = 0; i < 16; i++) bytes.push(Math.floor(Math.random() * 256));
    bytes[6] = (bytes[6] & 15) | 64;
    bytes[8] = (bytes[8] & 63) | 128;
    var hex = bytes.map(function (n) { return n.toString(16).padStart(2, '0'); }).join('');
    return hex.slice(0, 8) + '-' + hex.slice(8, 12) + '-' + hex.slice(12, 16) + '-' + hex.slice(16, 20) + '-' + hex.slice(20);
  }

  function memoryStorage() {
    var map = {};
    return {
      getItem: function (key) { return Object.prototype.hasOwnProperty.call(map, key) ? map[key] : null; },
      setItem: function (key, value) { map[String(key)] = String(value); },
      removeItem: function (key) { delete map[key]; }
    };
  }

  function createSafeWebStorage() {
    try {
      var storage = window.sessionStorage;
      var probe = '__aca_probe__';
      storage.setItem(probe, '1');
      storage.removeItem(probe);
      return storage;
    } catch (err) {
      return memoryStorage();
    }
  }

  function buildPayload(options) {
    var result = options.result || {};
    return {
      event: options.event,
      sessionId: options.sessionId,
      test: !!options.test,
      hp: options.hp || '',
      pageUrl: options.pageUrl || '',
      referrer: options.referrer || '',
      startedAt: options.startedAt || '',
      submittedAt: options.submittedAt || '',
      summary: result.summary || {},
      report: result.report || '',
      contact: options.contact || null
    };
  }

  function createAcaTracker(options) {
    if (!options || !options.storage || typeof options.post !== 'function') {
      throw new Error('createAcaTracker requires storage and post');
    }
    var storage = options.storage;
    var post = options.post;
    var endpoint = endpointOf(options.endpoint);
    var chain = Promise.resolve();

    function sessionId() {
      var current = storage.getItem(SESSION_KEY);
      if (isSessionId(current)) return current;
      var created = createSessionId();
      storage.setItem(SESSION_KEY, created);
      return created;
    }

    function payload(eventName, result, contact) {
      return buildPayload({
        event: eventName,
        sessionId: sessionId(),
        test: !!options.test,
        hp: options.hp || '',
        pageUrl: options.pageUrl || '',
        referrer: options.referrer || '',
        startedAt: options.startedAt || '',
        submittedAt: options.now ? options.now().toISOString() : new Date().toISOString(),
        result: result,
        contact: contact || null
      });
    }

    function enqueue(work) {
      var run = chain.then(work, work);
      chain = run.then(function () { return null; }, function () { return null; });
      return run;
    }

    function onCalculated(result) {
      return enqueue(function () {
        if (!endpoint) return { skipped: true, reason: 'no_endpoint' };
        var first = storage.getItem(CALC_KEY) !== '1';
        var eventName = first ? 'calculation_run' : 'calculation_update';
        return Promise.resolve(post(payload(eventName, result))).then(function (response) {
          var emailed = response && response.emailed || [];
          if (response && response.ok && first && (emailed.indexOf('calc') !== -1 || response.alreadyNotified)) {
            storage.setItem(CALC_KEY, '1');
          }
          return response;
        });
      });
    }

    function onLead(result, contact) {
      return enqueue(function () {
        if (!endpoint) return { skipped: true, reason: 'no_endpoint' };
        return Promise.resolve(post(payload('lead_submitted', result, contact))).then(function (response) {
          var emailed = response && response.emailed || [];
          if (response && response.ok && (emailed.indexOf('lead') !== -1 || response.alreadyNotified)) {
            storage.setItem('dkb_aca_lead_sent', '1');
          }
          return response;
        });
      });
    }

    return {
      endpoint: endpoint,
      sessionId: sessionId,
      onCalculated: onCalculated,
      onLead: onLead
    };
  }

  return {
    SESSION_KEY: SESSION_KEY,
    CALC_KEY: CALC_KEY,
    endpointOf: endpointOf,
    isSessionId: isSessionId,
    createSessionId: createSessionId,
    memoryStorage: memoryStorage,
    createSafeWebStorage: createSafeWebStorage,
    buildPayload: buildPayload,
    createAcaTracker: createAcaTracker
  };
});
