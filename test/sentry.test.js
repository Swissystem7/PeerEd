'use strict';
// Sentry stays off unless a deploy step replaces the placeholder. The committed app
// must not load the CDN, must not contain a DSN, and must scrub personal data if it
// is ever enabled.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const sentry = require('../src/lib/sentry.js');

const ROOT = path.join(__dirname, '..');
const VALID = 'https://example@o0.ingest.sentry.io/1';

function read(rel) {
  return fs.readFileSync(path.join(ROOT, rel), 'utf8');
}

function fakeDocument() {
  const children = [];
  return {
    head: {
      children,
      appendChild(el) {
        children.push(el);
        return el;
      }
    },
    createElement() {
      return { src: '', integrity: '', crossOrigin: '', onload: null };
    }
  };
}

function loadWith(doc, extra) {
  const opts = Object.assign({ document: doc, dsn: VALID }, extra || {});
  const result = sentry.install(opts);
  return { result, script: doc.head.children[0] };
}

test('disabled without a DSN: nothing is loaded and no DSN is committed', () => {
  const src = read('src/lib/sentry.js');
  assert.equal(sentry.PLACEHOLDER, '__SENTRY_DSN__');
  assert.equal((src.match(/__SENTRY_DSN__/g) || []).length, 1);
  assert.doesNotMatch(src, /https:\/\/[a-z0-9]+@[^\s"']*sentry\.io\/\d+/i);
  assert.match(src, /sendDefaultPii:\s*false/);
  assert.match(src, /\/bundle\.min\.js/);
  assert.doesNotMatch(src, /replayIntegration|bundle\.replay|bundle\.tracing/);

  const doc = fakeDocument();
  assert.equal(sentry.install({ document: doc }).enabled, false);
  assert.equal(sentry.install({ document: doc, dsn: '' }).enabled, false);
  assert.equal(sentry.install({ document: doc, dsn: '   ' }).enabled, false);
  assert.equal(sentry.install({ document: doc, dsn: '__SENTRY_DSN__' }).enabled, false);
  assert.equal(sentry.install({ document: doc, dsn: null }).enabled, false);
  assert.equal(doc.head.children.length, 0);

  const built = read('app.html');
  assert.equal((built.match(/__SENTRY_DSN__/g) || []).length, 1);
  assert.ok(built.includes('/* ===== src/lib/sentry.js ===== */'));
  assert.equal(sentry.pageDocument(), null);
});

test('DSN validation accepts only an https public DSN', () => {
  assert.equal(sentry.resolveDsn(undefined), '');
  assert.equal(sentry.resolveDsn(null), '');
  assert.equal(sentry.resolveDsn(''), '');
  assert.equal(sentry.resolveDsn(`  ${VALID}  `), VALID);
  assert.equal(sentry.resolveDsn('__SENTRY_DSN__'), '');
  assert.equal(sentry.resolveDsn('https://__SENTRY_DSN__@o0.ingest.sentry.io/1'), '');
  assert.equal(sentry.resolveDsn('http://example@o0.ingest.sentry.io/1'), '');
  assert.equal(sentry.resolveDsn('https://example@o0.ingest.sentry.io/1?x=1'), '');
  assert.equal(sentry.resolveDsn('https://example@o0.ingest.sentry.io/'), '');
  assert.equal(sentry.resolveDsn('https://not a dsn'), '');
  assert.equal(sentry.resolveDsn('https://ab_c@o0.ingest.sentry.io/1'), '');
  assert.equal(sentry.resolveDsn('https://abcDEF0123@o0.ingest.us.sentry.io/12345'), 'https://abcDEF0123@o0.ingest.us.sentry.io/12345');

  const missingHead = { createElement() { throw new Error('should not create a script'); } };
  assert.equal(sentry.install({ document: missingHead, dsn: VALID }).enabled, false);
  assert.equal(sentry.install({ document: { head: {} }, dsn: VALID }).enabled, false);
  assert.equal(sentry.install({ document: null, dsn: VALID }).enabled, false);
  assert.equal(sentry.install(null).enabled, false);

  const doc = fakeDocument();
  const { result, script } = loadWith(doc);
  assert.equal(result.enabled, true);
  assert.equal(script.src, sentry.SDK_SRC);
  assert.equal(script.integrity, sentry.SDK_INTEGRITY);
  assert.match(script.integrity, /^sha384-/);
  assert.equal(script.crossOrigin, 'anonymous');
  assert.match(script.src, /\/11\.10\.0\/bundle\.min\.js$/);

  let inited = null;
  const host = {};
  const quiet = fakeDocument();
  sentry.install({
    document: quiet,
    dsn: VALID,
    global: host,
    getSentry() { return null; }
  });
  assert.doesNotThrow(() => quiet.head.children[0].onload());

  const noInit = fakeDocument();
  sentry.install({
    document: noInit,
    dsn: VALID,
    getSentry() { return {}; }
  });
  assert.doesNotThrow(() => noInit.head.children[0].onload());

  const fromHost = fakeDocument();
  const hostSdk = { init(opts) { inited = opts; } };
  sentry.install({ document: fromHost, dsn: VALID, global: { Sentry: hostSdk } });
  fromHost.head.children[0].onload();
  assert.equal(inited.dsn, VALID);
  assert.equal(inited.sendDefaultPii, false);
  assert.equal(inited.dataCollection.userInfo, false);
  assert.equal(inited.tracesSampleRate, 0);
  assert.equal(inited.replaysSessionSampleRate, 0);
  assert.equal(inited.replaysOnErrorSampleRate, 0);

  const boom = fakeDocument();
  sentry.install({
    document: boom,
    dsn: VALID,
    getSentry() {
      return { init() { throw new Error('sdk failed'); } };
    }
  });
  assert.doesNotThrow(() => boom.head.children[0].onload());
});

test('beforeSend scrubs user and PII fields and drops a broken event', () => {
  const doc = fakeDocument();
  let opts = null;
  sentry.install({
    document: doc,
    dsn: VALID,
    getSentry() {
      return { init(value) { opts = value; } };
    }
  });
  doc.head.children[0].onload();

  const sent = opts.beforeSend({
    message: 'failed for dana@example.com at 050-1234567',
    user: { id: 'p-1', email: 'dana@example.com', ip_address: '127.0.0.1' },
    request: {
      url: 'https://example.test/x?e=dana@example.com',
      cookies: 'session=secret',
      headers: { Cookie: 'session=secret', Authorization: 'Bearer x' },
      data: { phone: '050-1234567', region: 'CENTER' }
    },
    extra: {
      region: 'CENTER',
      parentName: 'Dana',
      filename: 'notes.txt',
      note: 'call +972 50-123-4567',
      nested: { email: 'other@example.com', ok: true, n: 1, empty: null, missing: undefined },
      list: ['keep', 'b@c.il']
    }
  });

  assert.equal(sent.message, 'failed for [Filtered] at [Filtered]');
  assert.equal('user' in sent, false);
  assert.equal(sent.request.url, 'https://example.test/x?e=[Filtered]');
  assert.equal('cookies' in sent.request, false);
  assert.equal('headers' in sent.request, false);
  assert.equal('data' in sent.request, false);
  assert.equal(sent.extra.region, 'CENTER');
  assert.equal(sent.extra.parentName, '[Filtered]');
  assert.equal(sent.extra.filename, '[Filtered]');
  assert.equal(sent.extra.note, 'call [Filtered]');
  assert.equal(sent.extra.nested.email, '[Filtered]');
  assert.equal(sent.extra.nested.ok, true);
  assert.equal(sent.extra.nested.n, 1);
  assert.equal(sent.extra.nested.empty, null);
  assert.equal(sent.extra.nested.missing, undefined);
  assert.deepEqual(sent.extra.list, ['keep', '[Filtered]']);

  const loop = { region: 'NORTH' };
  loop.self = loop;
  const circled = sentry.scrubEvent(loop);
  assert.equal(circled.region, 'NORTH');
  assert.equal(circled.self, '[Filtered]');

  let deep = { leaf: 'ok' };
  for (let i = 0; i < 10; i += 1) deep = { child: deep };
  const buried = sentry.scrubEvent(deep);
  let cursor = buried;
  for (let i = 0; i < 8; i += 1) cursor = cursor.child;
  assert.equal(cursor.child, '[Filtered]');

  assert.equal(sentry.scrubEvent(null), null);
  assert.equal(sentry.scrubEvent('dana@example.com'), null);
  assert.equal(sentry.scrubEvent(42), null);
  assert.equal(sentry.scrubEvent(['keep']), null);
  assert.equal(sentry.scrubEvent({ request: null }).request, null);
  assert.equal(sentry.scrubEvent({ request: 'plain' }).request, 'plain');

  const evil = {};
  Object.defineProperty(evil, 'boom', {
    enumerable: true,
    get() { throw new Error('nope'); }
  });
  assert.equal(opts.beforeSend(evil), null);
});

test('install uses the page document when the caller does not pass one', () => {
  const doc = fakeDocument();
  const previous = globalThis.document;
  globalThis.document = doc;
  try {
    assert.equal(sentry.pageDocument(), doc);
    const on = sentry.install({ dsn: VALID });
    assert.equal(on.enabled, true);
    assert.equal(doc.head.children.length, 1);
    assert.equal(doc.head.children[0].src, sentry.SDK_SRC);
  } finally {
    if (previous === undefined) delete globalThis.document;
    else globalThis.document = previous;
  }
  globalThis.document = null;
  try {
    assert.equal(sentry.pageDocument(), null);
  } finally {
    delete globalThis.document;
  }
});
