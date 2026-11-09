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

const { makeProfile, withoutRetentionStamp, PERSONAL_DATA_ERROR } = require('./profile.js');
const { PROFANITY_ERROR } = require('./validator.js');
const { emptyQueue, loadQueue } = require('./approval.js');
const { emptyLog, loadLog } = require('./session.js');
const { AI_TOPIC_KEYS } = require('./attendance.js');

const SCHEMA = 'peered/1';
const DEFAULT_KEY = 'peered_app_v1';
const ACCEPTED_FIELDS = Object.freeze(['schema', 'people', 'queue', 'log']);
const INVALID_STATE_ERROR = 'invalid stored state';
// Where load() puts a document it refused. The app then starts empty, and its first save writes over the
// main key: without this copy one added person erased the whole refused roster, queue and log for good.
const REJECTED_SUFFIX = ':rejected';
// A later refused load takes the next free slot (key:rejected:2, :3, ...) instead of writing over a copy
// kept before: the screen told the coordinator that copy was kept, and the README that it stays until the
// wipe, yet the next refused document - one saved after it and refused on a later visit - replaced it,
// and the roster it held was gone with no line saying so. The same document refused again goes back
// into its own slot, so reloading a refused page adds nothing.
function rejectedSlot(storageKey, n) {
  return storageKey + REJECTED_SUFFIX + (n === 1 ? '' : ':' + n);
}
function isHeld(text) { return text !== null && text !== undefined; }

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

// A stored profile carries `retention`, which makeProfile derives itself and does not accept as an
// input key. profile.js sheds it (setParentConsent does the same) and makeProfile puts today's back -
// but only a stamp profile.js could have written is shed. Until this check the key was deleted unread,
// so a name or a phone kept under it was the one thing in a stored record the gate never saw: it loaded
// without complaint and the first save wrote over it, with no copy kept. Now it is refused like a name
// beside it, and load() keeps the refused document. A record that is not an object is left to
// makeProfile, which names the problem.
function storedProfileInput(person) {
  if (person === null || typeof person !== 'object' || Array.isArray(person)) return person;
  return withoutRetentionStamp(person);
}

function cleanAITopics(value) {
  if (!Array.isArray(value)) return [];
  const out = [];
  for (let i = 0; i < value.length; i += 1) {
    const item = value[i];
    if (typeof item === 'string' && AI_TOPIC_KEYS.includes(item) && !out.includes(item)) {
      out.push(item);
    }
  }
  return out;
}

// A stored person goes through the same gate as one the coordinator just added - makeProfile - and that
// gate words a refusal for the add form: 'invalid availability: expected a non-empty array' is the line
// "mark at least one free hour", 'invalid subjects:' is "choose at least one subject". On load nobody
// filled the form, so a stored person the gate refuses is refused as a stored person, named by its place
// in the list the way loadLog names a row and loadQueue an entry. Until this the participants card
// reported a saved roster whose person had no hours as "the saved list was refused and not loaded: you
// need to mark at least one free hour" - an instruction about a form nobody filled - while a line for
// a stored person did not exist. The gate's personal-data and profanity refusals pass through unchanged,
// as they read the same on every screen; so does a bad retention stamp, which only a stored record
// carries and whose line already names the record.
function storedPerson(person, at) {
  let input = person;
  let hasTopics = false;
  let rawTopics;
  if (person !== null && typeof person === 'object' && !Array.isArray(person) && Object.hasOwn(person, 'target_ai_topics')) {
    hasTopics = true;
    rawTopics = person.target_ai_topics;
    input = { ...person };
    delete input.target_ai_topics;
  }
  try {
    const profile = makeProfile(storedProfileInput(input));
    if (hasTopics) {
      const cleaned = cleanAITopics(rawTopics);
      if (cleaned.length > 0) {
        return Object.freeze({ ...profile, target_ai_topics: Object.freeze(cleaned) });
      }
    }
    return profile;
  } catch (err) {
    if (err.message === PERSONAL_DATA_ERROR || err.message === PROFANITY_ERROR
      || err.message.indexOf('invalid retention:') === 0) throw err;
    throw new Error('invalid stored person at ' + at + ': ' + err.message);
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
  for (let i = 0; i < doc.people.length; i += 1) people.push(storedPerson(doc.people[i], i));
  const queue = loadQueue(doc.queue === undefined ? emptyQueue() : doc.queue);
  const log = loadLog(doc.log === undefined ? emptyLog() : doc.log, queue);
  return Object.freeze({ people: Object.freeze(people), queue: queue, log: log });
}

function serializedPerson(person) {
  if (person === null || typeof person !== 'object' || Array.isArray(person) || !Object.hasOwn(person, 'target_ai_topics')) {
    return person;
  }
  const cleaned = cleanAITopics(person.target_ai_topics);
  if (cleaned.length === 0) {
    const copy = { ...person };
    delete copy.target_ai_topics;
    return copy;
  }
  return { ...person, target_ai_topics: cleaned };
}

// The stored form. Stable key order, no whitespace: the same state always gives the same string, so
// two devices that hold the same roster can be compared byte for byte.
function serialize(state) {
  assertState(state);
  const people = state.people.map(serializedPerson);
  return JSON.stringify({ schema: SCHEMA, people: people, queue: state.queue, log: state.log });
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
  // No prototype: with a plain {} the key "__proto__" saved into the prototype slot and never loaded.
  const items = Object.create(null);
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
// { state, problem, kept } where problem is null on success and the reason otherwise, with state reset
// to empty - the app keeps opening, and the screen can say why the roster is gone instead of guessing.
// A refused document is copied as is to key + REJECTED_SUFFIX (or the next free slot after it) before
// anything can overwrite it; kept says whether that copy was written. copies() counts the copies held,
// and clear() removes the key and every copy.
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
      if (text === null || text === undefined) return { state: emptyState(), problem: null, kept: false };
      try {
        return { state: deserialize(text), problem: null, kept: false };
      } catch (err) {
        let kept = true;
        try {
          let n = 1;
          let held = backend.getItem(rejectedSlot(storageKey, n));
          while (isHeld(held) && held !== String(text)) {
            n += 1;
            held = backend.getItem(rejectedSlot(storageKey, n));
          }
          backend.setItem(rejectedSlot(storageKey, n), String(text));
        } catch (e) { kept = false; }
        return { state: emptyState(), problem: err.message, kept: kept };
      }
    },
    // How many refused documents are kept beside the key, from this visit or an earlier one.
    copies: function () {
      let n = 0;
      try {
        while (isHeld(backend.getItem(rejectedSlot(storageKey, n + 1)))) n += 1;
      } catch (e) { return 0; }
      return n;
    },
    clear: function () {
      try {
        backend.removeItem(storageKey);
        for (let n = 1; ; n += 1) {
          const held = backend.getItem(rejectedSlot(storageKey, n));
          backend.removeItem(rejectedSlot(storageKey, n));
          if (!isHeld(held)) break;
        }
      } catch (e) { return false; }
      return true;
    }
  });
}

module.exports = {
  SCHEMA,
  DEFAULT_KEY,
  ACCEPTED_FIELDS,
  INVALID_STATE_ERROR,
  REJECTED_SUFFIX,
  emptyState,
  serialize,
  deserialize,
  memoryBackend,
  createStore
};
