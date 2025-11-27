// Lightweight browser cache helper used by multiple dashboards.
// Goal: centralise localStorage caching WITHOUT changing any API data shapes.
// Each page passes a "page" id and keyParts; the helper returns exactly the
// same payload object that was originally cached by that page.

(function (global) {
  'use strict';

  const STORAGE_PREFIX = '__cache__';

  // Per-page logical versions so we can bump if we ever change semantics.
  // For keywords we reuse the existing analytics_v3 version string so old
  // entries remain valid for that logic.
  const PAGE_VERSION = {
    kw: 'analytics_v3',
    biz: 'biz_v1',
    trend: 'trend_v1'
  };

  // Default TTLs (in ms) – keep these aligned with the existing behaviour.
  const DEFAULT_TTL = {
    kw: 60 * 60 * 1000,      // 1 hour for keyword analytics
    biz: 60 * 60 * 1000,     // 1 hour for business reports
    trend: 60 * 60 * 1000    // 1 hour for trend reports (if used)
  };

  const MAX_ENTRIES_PER_PAGE = 30;

  function hasLocalStorage() {
    try {
      return typeof window !== 'undefined' && !!window.localStorage;
    } catch (_) {
      return false;
    }
  }

  function getNextNoon() {
    const now = new Date();
    const noon = new Date(now);
    noon.setHours(12, 0, 0, 0);
    if (now > noon) {
      noon.setDate(noon.getDate() + 1);
    }
    return noon.getTime();
  }

  function makeKey(page, keyParts) {
    const version = PAGE_VERSION[page] || 'v1';
    const suffix = (keyParts || []).map(String).join(':');
    return [STORAGE_PREFIX, page, version, suffix].join(':');
  }

  function get(page, keyParts) {
    if (!hasLocalStorage()) return null;
    const cacheKey = makeKey(page, keyParts);
    const raw = localStorage.getItem(cacheKey);
    if (!raw) return null;

    try {
      const parsed = JSON.parse(raw);
      const now = Date.now();

      // Daily noon-based invalidation (matches existing behaviour)
      const nextNoon = getNextNoon();
      const lastNoon = nextNoon - (24 * 60 * 60 * 1000);
      if (parsed.timestamp && parsed.timestamp <= lastNoon) {
        localStorage.removeItem(cacheKey);
        return null;
      }

      const ttl = typeof parsed.ttlMs === 'number'
        ? parsed.ttlMs
        : (DEFAULT_TTL[page] || 0);

      if (ttl && parsed.timestamp && now - parsed.timestamp > ttl) {
        localStorage.removeItem(cacheKey);
        return null;
      }

      // If a stored version is present and differs, drop it
      if (parsed.version && parsed.version !== (PAGE_VERSION[page] || parsed.version)) {
        localStorage.removeItem(cacheKey);
        return null;
      }

      return parsed.data;
    } catch (_) {
      // Corrupt entry – remove it
      localStorage.removeItem(cacheKey);
      return null;
    }
  }

  function set(page, keyParts, payload, ttlMs) {
    if (!hasLocalStorage()) return;
    const cacheKey = makeKey(page, keyParts);
    const entry = {
      version: PAGE_VERSION[page] || 'v1',
      data: payload,
      timestamp: Date.now(),
      ttlMs: typeof ttlMs === 'number' ? ttlMs : DEFAULT_TTL[page]
    };

    try {
      localStorage.setItem(cacheKey, JSON.stringify(entry));
    } catch (e) {
      // On quota issues, attempt a simple LRU-style cleanup for this page
      try {
        const keys = Object.keys(localStorage);
        const pagePrefix = `${STORAGE_PREFIX}:${page}:`;
        const pageKeys = keys.filter(k => k.startsWith(pagePrefix));
        if (pageKeys.length >= MAX_ENTRIES_PER_PAGE) {
          const entries = pageKeys.map(k => {
            try {
              const parsed = JSON.parse(localStorage.getItem(k));
              return { key: k, ts: parsed && parsed.timestamp ? parsed.timestamp : 0 };
            } catch (_) {
              return { key: k, ts: 0 };
            }
          }).sort((a, b) => a.ts - b.ts);

          entries.slice(0, 5).forEach(e2 => localStorage.removeItem(e2.key));
        }
        // Retry once
        localStorage.setItem(cacheKey, JSON.stringify(entry));
      } catch (_) {
        // Give up silently – cache is an optimisation only
      }
    }
  }

  function clearExpired(page) {
    if (!hasLocalStorage()) return;
    const keys = Object.keys(localStorage);
    const pagePrefix = `${STORAGE_PREFIX}:${page}:`;
    const nextNoon = getNextNoon();
    const lastNoon = nextNoon - (24 * 60 * 60 * 1000);

    keys.forEach(k => {
      if (!k.startsWith(pagePrefix)) return;
      try {
        const parsed = JSON.parse(localStorage.getItem(k));
        const ts = parsed && parsed.timestamp ? parsed.timestamp : 0;
        const ttl = typeof parsed.ttlMs === 'number'
          ? parsed.ttlMs
          : (DEFAULT_TTL[page] || 0);
        const now = Date.now();
        if (!ts || ts <= lastNoon || (ttl && now - ts > ttl)) {
          localStorage.removeItem(k);
        }
      } catch (_) {
        localStorage.removeItem(k);
      }
    });
  }

  global.BrowserCache = {
    get,
    set,
    clearExpired,
    makeKey
  };

})(typeof window !== 'undefined' ? window : this);


