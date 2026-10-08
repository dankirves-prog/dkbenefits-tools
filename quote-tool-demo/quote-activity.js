(function (root, factory) {
  var api = factory();
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
  if (root) {
    root.QuoteActivity = api;
  }
})(typeof window !== 'undefined' ? window : globalThis, function () {
  var UTM_KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content'];
  var RATE_KEYS = ['employeeOnly', 'employeeSpouse', 'employeeChildren', 'family'];
  var DEFAULT_VISIBLE_GROUPS = ['top', 'low'];
  var SESSION_KEY = 'dkb_quote_session_id';
  var UTMS_KEY = 'dkb_quote_utms';
  var STARTED_KEY = 'dkb_quote_started';
  var RATES_KEY = 'dkb_rates_notified';
  var ACCESSED_KEY = 'dkb_quote_accessed';
  var GROUP_KEY = 'dkb_group_size';
  var CONTRIB_KEY = 'dkb_contribution_identified';
  var UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

  function hasDisplayableRates(plan) {
    if (!plan || typeof plan.rates !== 'object' || plan.rates === null) return false;
    return RATE_KEYS.every(function (key) {
      var value = plan.rates[key];
      return typeof value === 'number' && Number.isFinite(value) && value > 0;
    });
  }

  /**
   * ok: at least one visible plan card can show real dollar rates.
   * empty: plans loaded, but nothing visible has usable rates.
   * error: plans failed to load, render failed, or the catalog is missing.
   * Minimum Essential Coverage is hidden until the visitor opens it, so those
   * cards count only when that section is included in visibleGroups.
   */
  function classifyDisplayedRates(plans, options) {
    var settings = options || {};
    if (settings.error) {
      return { status: 'error', count: 0, reason: 'load_or_render_error' };
    }
    if (!Array.isArray(plans)) {
      return { status: 'error', count: 0, reason: 'plans_unavailable' };
    }
    var visibleGroups = settings.visibleGroups || DEFAULT_VISIBLE_GROUPS;
    var count = plans.filter(function (plan) {
      return plan && visibleGroups.indexOf(plan.group) !== -1 && hasDisplayableRates(plan);
    }).length;
    if (count === 0) {
      return { status: 'empty', count: 0, reason: 'no_visible_rates' };
    }
    return { status: 'ok', count: count, reason: 'rates_visible' };
  }

  function sanitizeUtm(value) {
    if (value == null) return '';
    var text = String(value).replace(/[\r\n\t]/g, ' ').replace(/new\s+lead/ig, '').trim();
    if (!text || text.indexOf('@') !== -1) return '';
    return text.slice(0, 120);
  }

  function parseUtms(search) {
    var query = search || '';
    if (query.charAt(0) === '?') query = query.slice(1);
    var params = new URLSearchParams(query);
    var utms = {};
    UTM_KEYS.forEach(function (key) {
      var cleaned = sanitizeUtm(params.get(key));
      if (cleaned) utms[key] = cleaned;
    });
    return utms;
  }

  function createSessionId() {
    if (globalThis.crypto && typeof globalThis.crypto.randomUUID === 'function') {
      return globalThis.crypto.randomUUID();
    }
    throw new Error('crypto.randomUUID is not available');
  }

  function isSessionId(value) {
    return typeof value === 'string' && UUID_PATTERN.test(value);
  }

  function createSafeWebStorage() {
    try {
      var storage = window.sessionStorage;
      var probe = '__dkb_probe__';
      storage.setItem(probe, '1');
      storage.removeItem(probe);
      return storage;
    } catch (error) {
      var map = new Map();
      return {
        getItem: function (key) { return map.has(key) ? map.get(key) : null; },
        setItem: function (key, value) { map.set(String(key), String(value)); },
        removeItem: function (key) { map.delete(key); }
      };
    }
  }

  function createQuoteActivityTracker(options) {
    if (!options || typeof options.post !== 'function' || !options.storage) {
      throw new Error('createQuoteActivityTracker requires storage and post');
    }
    var storage = options.storage;
    var post = options.post;
    var now = options.now || function () { return new Date(); };
    var pending = {};

    function readUtms() {
      var raw = storage.getItem(UTMS_KEY);
      if (!raw) return {};
      try {
        var parsed = JSON.parse(raw);
        return parsed && typeof parsed === 'object' ? parsed : {};
      } catch (error) {
        return {};
      }
    }

    function captureLandingUtms(search) {
      if (storage.getItem(UTMS_KEY)) return readUtms();
      var utms = parseUtms(search || '');
      storage.setItem(UTMS_KEY, JSON.stringify(utms));
      return utms;
    }

    function ensureSessionId() {
      var current = storage.getItem(SESSION_KEY);
      if (isSessionId(current)) return current;
      var created = createSessionId();
      storage.setItem(SESSION_KEY, created);
      return created;
    }

    function buildUsagePayload(eventName) {
      var payload = {
        event: eventName,
        sessionId: ensureSessionId(),
        timestamp: now().toISOString()
      };
      var utms = readUtms();
      UTM_KEYS.forEach(function (key) {
        if (utms[key]) payload[key] = utms[key];
      });
      return payload;
    }

    function buildActivityPayload(eventName, details) {
      var payload = buildUsagePayload(eventName);
      if (!details) return payload;
      Object.keys(details).forEach(function (key) {
        payload[key] = details[key];
      });
      return payload;
    }

    function postOnce(storageKey, eventName, details) {
      if (storage.getItem(storageKey) === '1') {
        return Promise.resolve({ skipped: true, reason: 'already_recorded' });
      }
      if (pending[eventName]) return pending[eventName];
      pending[eventName] = Promise.resolve()
        .then(function () { return post(buildActivityPayload(eventName, details)); })
        .then(function (result) {
          if (!result || result.ok !== true) {
            throw new Error('activity request failed');
          }
          storage.setItem(storageKey, '1');
          return { sent: true, result: result };
        })
        .finally(function () {
          pending[eventName] = null;
        });
      return pending[eventName];
    }

    function onQuoteStarted(details) {
      return postOnce(STARTED_KEY, 'quote_started', details).catch(function (error) {
        return { sent: false, error: error };
      });
    }

    function onQuoteAccessed(details) {
      return postOnce(ACCESSED_KEY, 'quote_accessed', details).catch(function (error) {
        return { sent: false, error: error };
      });
    }

    function onGroupSize(details) {
      return postOnce(GROUP_KEY, 'group_size', details).catch(function (error) {
        return { sent: false, error: error };
      });
    }

    function onContributionIdentified(details) {
      return postOnce(CONTRIB_KEY, 'contribution_identified', details).catch(function (error) {
        return { sent: false, error: error };
      });
    }

    function onRatesRendered(input) {
      var classification = classifyDisplayedRates(input && input.plans, {
        error: input && input.error,
        visibleGroups: input && input.visibleGroups
      });
      if (classification.status !== 'ok') {
        return Promise.resolve({ skipped: true, classification: classification });
      }
      return postOnce(RATES_KEY, 'rates_displayed', input && input.details)
        .then(function (outcome) {
          outcome.classification = classification;
          return outcome;
        })
        .catch(function (error) {
          return { sent: false, error: error, classification: classification };
        });
    }

    function decorateLeadPayload(payload) {
      try {
        var usage = buildUsagePayload('lead_submitted');
        return Object.assign({}, payload, usage);
      } catch (error) {
        return payload;
      }
    }

    return {
      captureLandingUtms: captureLandingUtms,
      getSessionId: ensureSessionId,
      getUtms: readUtms,
      onQuoteStarted: onQuoteStarted,
      onRatesRendered: onRatesRendered,
      onQuoteAccessed: onQuoteAccessed,
      onGroupSize: onGroupSize,
      onContributionIdentified: onContributionIdentified,
      decorateLeadPayload: decorateLeadPayload
    };
  }

  return {
    UTM_KEYS: UTM_KEYS,
    classifyDisplayedRates: classifyDisplayedRates,
    hasDisplayableRates: hasDisplayableRates,
    parseUtms: parseUtms,
    sanitizeUtm: sanitizeUtm,
    createSafeWebStorage: createSafeWebStorage,
    createQuoteActivityTracker: createQuoteActivityTracker
  };
});
