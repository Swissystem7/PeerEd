'use strict';
// PeerEd - local-only storage (MVP item 7). The whole app state - roster, approval queue, session log -
// is one JSON document under one key in a key-value backend such as the browser's localStorage. There
// is no server and no network call anywhere in this file or in the modules it stores: the app opens
// from a phone with the radio off and loses nothing.
//
// Loading is where the privacy gate is enforced a second time. Every stored person goes through
// makeProfile, every unit through loadQueue, every session row through loadLog, so a record edited in
// the browser's devtools or copied from another machine cannot bring a name, a phone or a forged
// status into the app. A document that does not fit is reported, not silently repaired, and the app
// starts from an empty state rather than from a half-trusted one.

const { makeProfile, PERSONAL_DATA_ERROR } = require('./profile.js');
const { emptyQueue, loadQueue } = require('./approval.js');
const { emptyLog, loadLog } = require('./session.js');

const SCHEMA = 'peered/1';
const DEFAULT_KEY = 'peered_app_v1';
const ACCEPTED_FIELDS = Object.freeze(['schema', 'people', 'queue', 'log']);
const INVALID_STATE_ERROR = 'invalid stored state';

function emptyState() {
  return Object.freeze({ people: Object.freeze([]), queue: emptyQueue(), log: emptyLog() });
}

function assertState(state) {
  if (state === null || typeof state !== 'object' || Array.isArray(state)
    || !Array.isArray(state.people) || state.queue === null || typeof state.queue !== 'object'
    || state.log === null || typeof state.log !== 'object') {
    throw new Error('invalid state: expected a value from emptyState() or deserialize()');
  }
}

// Re-validate a plain document (parsed JSON) into a frozen state. Order matters: the queue is rebuilt
// first because the log's rows are checked against it.
function fromDocument(doc) {
  if (doc === null || typeof doc !== 'object' || Array.isArray(doc)) throw new Error(INVALID_STATE_ERROR);
  const keys = Object.keys(doc);
  for (let i = 0; i < keys.length; i += 1) {
    if (ACCEPTED_FIELDS.indexOf(keys[i]) === -1) throw new Error(PERSONAL_DATA_ERROR);
  }
  if (doc.schema !== SCHEMA) throw new Error(INVALID_STATE_ERROR + ': unknown schema ' + String(doc.schema));
  if (!Array.isArray(doc.people)) throw new Error(INVALID_STATE_ERROR + ': people is not an array');
  const people = [];
  for (let i = 0; i < doc.people.length; i += 1) people.push(makeProfile(doc.people[i]));
  const queue = loadQueue(doc.queue === undefined ? emptyQueue() : doc.queue);
  const log = loadLog(doc.log === undefined ? emptyLog() : doc.log, queue);
  return Object.freeze({ people: Object.freeze(people), queue: queue, log: log });
}

// The stored form. Stable key order, no whitespace: the same state always gives the same string, so
// two devices that hold the same roster can be compared byte for byte.
function serialize(state) {
  assertState(state);
  return JSON.stringify({ schema: SCHEMA, people: state.people, queue: state.queue, log: state.log });
}

function deserialize(text) {
  if (typeof text !== 'string') throw new Error(INVALID_STATE_ERROR + ': expected a string');
  let doc;
  try { doc = JSON.parse(text); } catch (e) { throw new Error(INVALID_STATE_ERROR + ': not JSON'); }
  return fromDocument(doc);
}

// A backend is the three methods of Web Storage. This one keeps everything in a plain object: the
// fallback when localStorage throws (private mode, storage disabled) and the backend the tests use.
function memoryBackend() {
  const items = {};
  return {
    getItem: function (key) { return Object.prototype.hasOwnProperty.call(items, key) ? items[key] : null; },
    setItem: function (key, value) { items[key] = String(value); },
    removeItem: function (key) { delete items[key]; }
  };
}

function isBackend(b) {
  return b !== null && typeof b === 'object' && typeof b.getItem === 'function'
    && typeof b.setItem === 'function' && typeof b.removeItem === 'function';
}

// createStore(backend, key): save(state) writes, load() reads. load never throws: it returns
// { state, problem } where problem is null on success and the reason otherwise, with state reset to
// empty - the app keeps opening, and the screen can say why the roster is gone instead of guessing.
function createStore(backend, key) {
  if (!isBackend(backend)) throw new Error('invalid backend: expected getItem, setItem, removeItem');
  const storageKey = key === undefined ? DEFAULT_KEY : key;
  if (typeof storageKey !== 'string' || storageKey.length === 0) throw new Error('invalid key');
  return Object.freeze({
    key: storageKey,
    save: function (state) {
      const text = serialize(state);
      try { backend.setItem(storageKey, text); } catch (e) { return false; }
      return true;
    },
    load: function () {
      let text;
      try { text = backend.getItem(storageKey); } catch (e) { text = null; }
      if (text === null || text === undefined) return { state: emptyState(), problem: null };
      try {
        return { state: deserialize(text), problem: null };
      } catch (err) {
        return { state: emptyState(), problem: err.message };
      }
    },
    clear: function () {
      try { backend.removeItem(storageKey); } catch (e) { return false; }
      return true;
    }
  });
}

module.exports = {
  SCHEMA,
  DEFAULT_KEY,
  ACCEPTED_FIELDS,
  INVALID_STATE_ERROR,
  emptyState,
  serialize,
  deserialize,
  memoryBackend,
  createStore
};
