'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');

const {
  SCHEMA, DEFAULT_KEY, emptyState, serialize, deserialize, memoryBackend, createStore, INVALID_STATE_ERROR
} = require('../src/lib/store.js');
const { makeProfile, PERSONAL_DATA_ERROR } = require('../src/lib/profile.js');
const { emptyQueue, submit, approve, statusOf } = require('../src/lib/approval.js');
const { makeUnit } = require('../src/lib/unit.js');
const { emptyLog, logSession, summarize } = require('../src/lib/session.js');
const { matchPairs } = require('../src/lib/match.js');

const MATH = makeUnit({ title: 'משוואות ריבועיות', subject: 'MATH', durationMinutes: 20, body: 'פותרים שלוש משוואות.' });
const STUDENT = makeProfile({ role: 'student', region: 'SOUTH', availability: ['SUN_16', 'MON_18'], subjects: ['MATH', 'PHYSICS'] });
const PUPIL = makeProfile({ role: 'pupil', region: 'SOUTH', availability: ['MON_18'], subjects: ['MATH'], parentConsent: true });
const QUEUE = approve(submit(emptyQueue(), MATH), MATH.id);
const PAIR = matchPairs([STUDENT], [PUPIL])[0];
const LOG = logSession(emptyLog(), QUEUE, PAIR, { slot: 'MON_18', subject: 'MATH', unitId: MATH.id, outcome: 'held' });
const STATE = Object.freeze({ people: Object.freeze([STUDENT, PUPIL]), queue: QUEUE, log: LOG });

test('store: the empty state is frozen and serializes to a fixed document', () => {
  const s = emptyState();
  assert.ok(Object.isFrozen(s) && Object.isFrozen(s.people));
  assert.equal(s.people.length, 0);
  assert.equal(serialize(s), JSON.stringify({ schema: SCHEMA, people: [], queue: emptyQueue(), log: emptyLog() }));
});

test('store: a full state survives a round trip byte for byte', () => {
  const text = serialize(STATE);
  const back = deserialize(text);
  assert.ok(Object.isFrozen(back) && Object.isFrozen(back.people) && Object.isFrozen(back.people[0]));
  assert.deepEqual(back.people, [STUDENT, PUPIL]);
  assert.equal(statusOf(back.queue, MATH.id), 'approved');
  assert.deepEqual(summarize(back.log), summarize(LOG));
  assert.equal(serialize(back), text);
  // deserialize is a pure function of the text: same input, same output, with no clock in between.
  assert.equal(serialize(deserialize(text)), serialize(deserialize(text)));
});

test('store: a stored person with a name is refused, not trimmed', () => {
  const doc = JSON.parse(serialize(STATE));
  doc.people[1] = Object.assign({}, doc.people[1], { name: 'דנה' });
  assert.throws(() => deserialize(JSON.stringify(doc)), { message: PERSONAL_DATA_ERROR });
});

test('store: an unknown top-level key is refused with the personal-data message', () => {
  const doc = JSON.parse(serialize(STATE));
  doc.contacts = [];
  assert.throws(() => deserialize(JSON.stringify(doc)), { message: PERSONAL_DATA_ERROR });
});

test('store: a session row for a unit the stored queue did not approve is refused', () => {
  const doc = JSON.parse(serialize(STATE));
  // a well-formed pending entry: no decider, so the refusal comes from the log, not the queue
  doc.queue.entries[MATH.id].status = 'pending';
  delete doc.queue.entries[MATH.id].decidedBy;
  assert.throws(() => deserialize(JSON.stringify(doc)), /not approved/);
});

test('store: revising a unit that was already taught does not wipe the saved roster on the next load', () => {
  const fixed = makeUnit({ title: MATH.title, subject: 'MATH', durationMinutes: 20, body: 'פותרים ארבע משוואות.' });
  const state = Object.freeze({ people: STATE.people, queue: submit(QUEUE, fixed), log: LOG });
  const store = createStore(memoryBackend());
  assert.equal(store.save(state), true);
  const loaded = store.load();
  assert.equal(loaded.problem, null);
  assert.equal(loaded.state.people.length, 2);
  assert.equal(statusOf(loaded.state.queue, MATH.id), 'pending');
  assert.deepEqual(loaded.state.log, LOG);
});

test('store: garbage, a wrong schema and a non-string are errors with a stable prefix', () => {
  assert.throws(() => deserialize('{not json'), { message: INVALID_STATE_ERROR + ': not JSON' });
  assert.throws(() => deserialize('[]'), { message: INVALID_STATE_ERROR });
  assert.throws(() => deserialize(JSON.stringify({ schema: 'peered/0', people: [] })), /unknown schema/);
  assert.throws(() => deserialize(42), /expected a string/);
});

test('store: createStore saves and loads through a Web Storage shaped backend', () => {
  const backend = memoryBackend();
  const store = createStore(backend);
  assert.equal(store.key, DEFAULT_KEY);
  assert.deepEqual(store.load(), { state: emptyState(), problem: null });
  assert.equal(store.save(STATE), true);
  assert.equal(backend.getItem(DEFAULT_KEY), serialize(STATE));
  const loaded = store.load();
  assert.equal(loaded.problem, null);
  assert.equal(serialize(loaded.state), serialize(STATE));
  assert.equal(store.clear(), true);
  assert.equal(backend.getItem(DEFAULT_KEY), null);
  assert.deepEqual(store.load(), { state: emptyState(), problem: null });
});

test('store: a tampered or corrupt document loads as empty with the reason, never as half a roster', () => {
  const backend = memoryBackend();
  const store = createStore(backend, 'k');
  const doc = JSON.parse(serialize(STATE));
  doc.people[0] = Object.assign({}, doc.people[0], { phone: '050-1234567' });
  backend.setItem('k', JSON.stringify(doc));
  const tampered = store.load();
  assert.equal(tampered.problem, PERSONAL_DATA_ERROR);
  assert.deepEqual(tampered.state, emptyState());
  backend.setItem('k', '<<<');
  assert.equal(store.load().problem, INVALID_STATE_ERROR + ': not JSON');
});

test('store: a backend that throws (private mode, quota) makes save report false and load fall back to empty', () => {
  const broken = {
    getItem: function () { throw new Error('SecurityError'); },
    setItem: function () { throw new Error('QuotaExceededError'); },
    removeItem: function () { throw new Error('SecurityError'); }
  };
  const store = createStore(broken, 'k');
  assert.equal(store.save(STATE), false);
  assert.deepEqual(store.load(), { state: emptyState(), problem: null });
  assert.equal(store.clear(), false);
  assert.throws(() => createStore({}), /invalid backend/);
  assert.throws(() => createStore(memoryBackend(), ''), /invalid key/);
});

test('store: the memory backend keeps a "__proto__" key like any other key', () => {
  const store = createStore(memoryBackend(), '__proto__');
  assert.equal(store.save(STATE), true);
  assert.deepEqual(store.load(), { state: STATE, problem: null });
  assert.equal(store.clear(), true);
  assert.deepEqual(store.load(), { state: emptyState(), problem: null });
});
