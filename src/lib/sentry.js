'use strict';
// PeerEd - browser errors through the Sentry CDN. Off unless a deploy step replaces
// INJECTED_DSN. PLACEHOLDER is built from pieces so that replace does not rewrite the
// check that keeps a leftover token from loading the SDK. No DSN is committed.
// Errors only: the plain browser bundle, no tracing and no Session Replay.
// PeerEd is zero-PII, so beforeSend drops event.user and any personal-data field.

const PLACEHOLDER = '__' + 'SENTRY_DSN' + '__';
const INJECTED_DSN = '__SENTRY_DSN__';
// Errors-only bundle (no tracing, no Session Replay). Sentry CDN 11.10.0.
const SDK_SRC = 'https://browser.sentry-cdn.com/11.10.0/bundle.min.js';
const SDK_INTEGRITY = 'sha384-O/8YQaGGVy/n9jIUzcOiaiJVm4t5+JMNiK/zOa0fWvlSld+FquXemEcwJxQ3x/Lr';
const DSN_RE = /^https:\/\/[a-zA-Z0-9]+@[^/?#\s]+\/\d+$/;
// Same kinds of key the profile gate refuses, plus the fields Sentry adds on its own.
const PII_KEY = /name|email|e-?mail|phone|tel|mobile|id_?number|tz|zehut|address|user|ip_?address|cookie|authorization|password|secret|token|(?:^|_)ip(?:$|_)/i;

function resolveDsn(raw) {
  const dsn = String(raw === undefined || raw === null ? '' : raw).trim();
  if (dsn === '' || dsn === PLACEHOLDER || dsn.includes(PLACEHOLDER)) return '';
  if (!DSN_RE.test(dsn)) return '';
  return dsn;
}

function scrubString(value) {
  return value
    .replace(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, '[Filtered]')
    .replace(/(?:\+972[\s.-]?|0)(?:5\d|[23489])[\s.-]?\d{3}[\s.-]?\d{4}/g, '[Filtered]');
}

function scrub(value, depth, seen) {
  if (typeof value === 'string') return scrubString(value);
  if (value === null || typeof value !== 'object') return value;
  if (depth > 8 || seen.has(value)) return '[Filtered]';
  seen.add(value);
  if (Array.isArray(value)) return value.map((item) => scrub(item, depth + 1, seen));
  const out = {};
  for (const key of Object.keys(value)) {
    out[key] = PII_KEY.test(key) ? '[Filtered]' : scrub(value[key], depth + 1, seen);
  }
  return out;
}

function scrubEvent(event) {
  const clean = scrub(event, 0, new WeakSet());
  if (clean === null || typeof clean !== 'object' || Array.isArray(clean)) return null;
  delete clean.user;
  if (clean.request && typeof clean.request === 'object') {
    delete clean.request.cookies;
    delete clean.request.headers;
    delete clean.request.data;
  }
  return clean;
}

function initOptions(dsn) {
  return {
    dsn,
    sendDefaultPii: false,
    dataCollection: { userInfo: false },
    tracesSampleRate: 0,
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 0,
    beforeSend(event) {
      try {
        return scrubEvent(event);
      } catch {
        return null;
      }
    }
  };
}

function pageDocument() {
  const doc = globalThis.document;
  if (doc === undefined || doc === null) return null;
  return doc;
}

function install(opts) {
  const options = opts || {};
  const host = options.global || globalThis;
  const doc = Object.hasOwn(options, 'document') ? options.document : pageDocument();
  const rawDsn = Object.hasOwn(options, 'dsn') ? options.dsn : INJECTED_DSN;
  const dsn = resolveDsn(rawDsn);
  if (!dsn || !doc || typeof doc.createElement !== 'function' || !doc.head) {
    return { enabled: false };
  }
  const script = doc.createElement('script');
  script.src = SDK_SRC;
  script.integrity = SDK_INTEGRITY;
  script.crossOrigin = 'anonymous';
  script.onload = () => {
    try {
      const Sentry = typeof options.getSentry === 'function' ? options.getSentry() : host.Sentry;
      if (!Sentry || typeof Sentry.init !== 'function') return;
      Sentry.init(initOptions(dsn));
    } catch {
      return;
    }
  };
  doc.head.appendChild(script);
  return { enabled: true };
}

// Runs when the built page loads. With the committed placeholder this returns immediately.
install();

module.exports = {
  PLACEHOLDER,
  SDK_SRC,
  SDK_INTEGRITY,
  resolveDsn,
  scrubEvent,
  pageDocument,
  install
};
