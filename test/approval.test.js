'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');

const {
  emptyQueue, submit, approve, reject, listPending, approvedUnits, statusOf, loadQueue,
  APPROVER_ROLE, NOT_PENDING_ERROR, REASON_MAX_LENGTH
} = require('../src/lib/approval.js');
const { makeUnit } = require('../src/lib/unit.js');
const { PERSONAL_DATA_ERROR, PROFANITY_ERROR } = require('../src/lib/validator.js');

const A = makeUnit({ title: 'משוואות ריבועיות', subject: 'MATH', durationMinutes: 20, body: 'פותרים שלוש משוואות.' });
const B = makeUnit({ title: 'חוק ניוטון השני', subject: 'PHYSICS', durationMinutes: 15, body: 'כוח שווה מסה כפול תאוצה.' });
const C = makeUnit({ title: 'משפט פיתגורס', subject: 'MATH', durationMinutes: 10, body: 'שלוש דוגמאות.' });

test('approval: a submitted unit is pending, invisible to pupils, and the queue is a new frozen value', () => {
  const q0 = emptyQueue();
  const q1 = submit(q0, A);
  assert.notEqual(q1, q0);
  assert.equal(Object.isFrozen(q1), true);
  assert.equal(Object.isFrozen(q1.entries), true);
  assert.equal(Object.isFrozen(q1.entries[A.id]), true);
  assert.deepEqual(Object.keys(q0.entries), []);
  assert.equal(statusOf(q1, A.id), 'pending');
  assert.equal(statusOf(q1, 'u-0000000000000000'), null);
  assert.deepEqual(listPending(q1).map((e) => e.unit.id), [A.id]);
  assert.deepEqual(approvedUnits(q1), []);
});

test('approval: only the approver role is recorded on a decision, never a person', () => {
  const q = approve(submit(emptyQueue(), A), A.id);
  const entry = q.entries[A.id];
  assert.equal(entry.status, 'approved');
  assert.equal(entry.decidedBy, APPROVER_ROLE);
  assert.deepEqual(Object.keys(entry).sort(), ['decidedBy', 'revision', 'seq', 'status', 'unit']);
  assert.deepEqual(approvedUnits(q), [A]);
  // a serialized queue carries no key that could hold a name
  assert.equal(/name|email|phone/i.test(JSON.stringify(q)), false);
});

test('approval: pending and approved lists keep submission order, not id order', () => {
  let q = emptyQueue();
  q = submit(q, C);
  q = submit(q, A);
  q = submit(q, B);
  assert.deepEqual(listPending(q).map((e) => e.unit.id), [C.id, A.id, B.id]);
  q = approve(q, B.id);
  q = approve(q, C.id);
  assert.deepEqual(approvedUnits(q).map((u) => u.id), [C.id, B.id]);
  assert.deepEqual(listPending(q).map((e) => e.unit.id), [A.id]);
});

test('approval: a rejection needs a clean reason and the reason is kept for the teacher', () => {
  const q1 = submit(emptyQueue(), A);
  const q2 = reject(q1, A.id, '  קצר מדי,   צריך דוגמה שנייה. ');
  assert.equal(q2.entries[A.id].status, 'rejected');
  assert.equal(q2.entries[A.id].reason, 'קצר מדי, צריך דוגמה שנייה.');
  assert.deepEqual(approvedUnits(q2), []);
  assert.deepEqual(listPending(q2), []);
  assert.throws(() => reject(q1, A.id, ''), /^Error: invalid reason: text too short/);
  assert.throws(() => reject(q1, A.id, '   '), /^Error: invalid reason: text too short/);
  assert.throws(() => reject(q1, A.id, 42), /invalid reason/);
  assert.throws(() => reject(q1, A.id, 'a'.repeat(REASON_MAX_LENGTH + 1)), /^Error: invalid reason: text too long/);
  assert.throws(() => reject(q1, A.id, 'תתקשר אליי 050-1234567'), { message: PERSONAL_DATA_ERROR });
  assert.throws(() => reject(q1, A.id, 'השיעור הזה מטומטם'), { message: PROFANITY_ERROR });
});

test('approval: a decision is final until the text changes; it cannot be made twice or on an unknown id', () => {
  const q1 = submit(emptyQueue(), A);
  const approved = approve(q1, A.id);
  const rejected = reject(q1, A.id, 'לא ברור');
  assert.throws(() => approve(approved, A.id), { message: NOT_PENDING_ERROR });
  assert.throws(() => reject(approved, A.id, 'x'), { message: NOT_PENDING_ERROR });
  assert.throws(() => approve(rejected, A.id), { message: NOT_PENDING_ERROR });
  assert.throws(() => approve(q1, B.id), /unknown unit id/);
  assert.throws(() => reject(q1, undefined, 'x'), /unknown unit id/);
});

test('approval: resubmitting the same text is a no-op; a revised body goes back to pending with revision+1', () => {
  const q1 = submit(emptyQueue(), A);
  assert.equal(submit(q1, A), q1);
  assert.equal(submit(q1, makeUnit({ title: A.title, subject: 'MATH', durationMinutes: 20, body: A.body })), q1);
  const approved = approve(q1, A.id);
  assert.equal(submit(approved, A), approved, 'an approved unit resubmitted unchanged stays approved');

  const revised = makeUnit({ title: A.title, subject: 'MATH', durationMinutes: 20, body: 'פותרים חמש משוואות, עם פתרון מלא.' });
  assert.equal(revised.id, A.id, 'the body is not part of the id');
  const q2 = submit(approved, revised);
  assert.equal(q2.entries[A.id].status, 'pending');
  assert.equal(q2.entries[A.id].revision, 2);
  assert.equal(q2.entries[A.id].unit.body, revised.body);
  assert.equal(q2.entries[A.id].seq, q1.entries[A.id].seq, 'a revision keeps its place in the order');
  assert.equal(q2.nextSeq, q1.nextSeq);
  assert.deepEqual(approvedUnits(q2), [], 'the old text is no longer shown once a revision is pending');

  // a rejection reason goes with the text it was about
  const q3 = submit(reject(q1, A.id, 'קצר מדי'), revised);
  assert.equal(q3.entries[A.id].status, 'pending');
  assert.equal('reason' in q3.entries[A.id], false);
});

test('approval: only a record from makeUnit can be submitted - extra keys, forged ids and raw text are refused', () => {
  const q = emptyQueue();
  assert.throws(() => submit(q, Object.assign({}, A, { author: 'x' })), /invalid unit/);
  assert.throws(() => submit(q, Object.assign({}, A, { id: 'u-0000000000000000' })), /invalid unit/);
  assert.throws(() => submit(q, Object.assign({}, A, { body: '  לא נקי  ' })), /invalid unit/);
  assert.throws(() => submit(q, Object.assign({}, A, { body: 'מייל: a@b.co' })), { message: PERSONAL_DATA_ERROR });
  assert.throws(() => submit(q, { title: A.title, subject: 'MATH', durationMinutes: 20, body: A.body }), /invalid unit/);
  for (const bad of [null, [], 'x', undefined, 7]) assert.throws(() => submit(q, bad), /invalid unit/);
  for (const bad of [null, [], {}, { nextSeq: 0, entries: {} }, { nextSeq: 1, entries: [] }]) {
    assert.throws(() => submit(bad, A), /invalid queue/);
    assert.throws(() => listPending(bad), /invalid queue/);
  }
});

test('approval: a queue survives JSON and comes back revalidated', () => {
  let q = emptyQueue();
  q = submit(q, A);
  q = submit(q, B);
  q = submit(q, C);
  q = approve(q, B.id);
  q = reject(q, C.id, 'חסר הסבר');
  const loaded = loadQueue(JSON.parse(JSON.stringify(q)));
  assert.deepEqual(loaded, q);
  assert.equal(Object.isFrozen(loaded.entries[A.id]), true);
  // the counter is recovered from the entries when it is missing or stale
  const noSeq = loadQueue({ entries: JSON.parse(JSON.stringify(q)).entries });
  assert.equal(noSeq.nextSeq, q.nextSeq);
  assert.deepEqual(loadQueue({ nextSeq: 1, entries: {} }), emptyQueue());
});

test('approval: stored data that was edited on disk cannot smuggle personal data or a forged status', () => {
  const stored = JSON.parse(JSON.stringify(reject(submit(emptyQueue(), A), A.id, 'חסר')));
  const edit = (fn) => { const copy = JSON.parse(JSON.stringify(stored)); fn(copy); return copy; };
  assert.throws(() => loadQueue(edit((s) => { s.entries[A.id].unit.body = 'טלפון 052-1234567'; })),
    { message: PERSONAL_DATA_ERROR });
  assert.throws(() => loadQueue(edit((s) => { s.entries[A.id].unit.teacher = 'x'; })), /invalid unit/);
  assert.throws(() => loadQueue(edit((s) => { s.entries[A.id].status = 'published'; })), /bad status/);
  assert.throws(() => loadQueue(edit((s) => { s.entries[A.id].reason = 'a@b.co'; })), { message: PERSONAL_DATA_ERROR });
  assert.throws(() => loadQueue(edit((s) => { delete s.entries[A.id].reason; })), /without a reason/);
  assert.throws(() => loadQueue(edit((s) => { s.entries['u-0000000000000000'] = s.entries[A.id]; })), /id mismatch/);
  assert.throws(() => loadQueue(edit((s) => { s.entries[A.id].seq = 0; })), /bad revision or seq/);
  for (const bad of [null, [], 'x', { entries: null }]) assert.throws(() => loadQueue(bad), /invalid stored queue/);
  // a decided entry that was given a name on disk comes back with only the role
  const renamed = loadQueue(edit((s) => { s.entries[A.id].decidedBy = 'Aviran'; }));
  assert.equal(renamed.entries[A.id].decidedBy, APPROVER_ROLE);
});

test('approval: a stored entry with a key the flow never writes is refused, not quietly dropped', () => {
  let q = submit(submit(emptyQueue(), A), B);
  q = reject(q, B.id, 'חסר');
  const stored = JSON.parse(JSON.stringify(q));
  const edit = (fn) => { const copy = JSON.parse(JSON.stringify(stored)); fn(copy); return copy; };
  // a name or a note next to the unit is personal data, with the same message as a name inside it
  for (const key of ['teacher', 'note', 'email', 'school']) {
    assert.throws(() => loadQueue(edit((s) => { s.entries[A.id][key] = 'x'; })), { message: PERSONAL_DATA_ERROR });
  }
  // a reason is a rejection's; on a pending unit it is not a record the flow could have written
  assert.throws(() => loadQueue(edit((s) => { s.entries[A.id].reason = 'חסר'; })), /reason on a unit that was not rejected/);
  // nor is a decider on it: nobody has decided a pending unit yet
  for (const who of [APPROVER_ROLE, 'Aviran']) {
    assert.throws(() => loadQueue(edit((s) => { s.entries[A.id].decidedBy = who; })), /decidedBy on a unit that is still pending/);
  }
  // every stored key the flow does write still loads, decidedBy included
  const loaded = loadQueue(edit((s) => { s.entries[B.id].decidedBy = APPROVER_ROLE; }));
  assert.deepEqual(loaded, q);
  // the counter is the order of the queue on every device: two entries cannot share one number
  assert.throws(() => loadQueue(edit((s) => { s.entries[B.id].seq = s.entries[A.id].seq; })), /seq already used/);
  // the same holds one level up: a name beside the entries is refused, not dropped
  for (const key of ['coordinator', 'school', 'note']) {
    assert.throws(() => loadQueue(edit((s) => { s[key] = 'x'; })), { message: PERSONAL_DATA_ERROR });
  }
});

test('approval: a seq or nextSeq past the safe integers is refused, so two units can never share a seq', () => {
  const stored = (seq, nextSeq) => {
    const s = JSON.parse(JSON.stringify(submit(emptyQueue(), A)));
    s.entries[A.id].seq = seq;
    if (nextSeq === undefined) delete s.nextSeq; else s.nextSeq = nextSeq;
    return s;
  };
  const top = Number.MAX_SAFE_INTEGER - 1;
  // past 2^53, seq + 1 === seq: the next unit would repeat it and the saved queue could not load again
  assert.throws(() => loadQueue(stored(2 ** 53)), /bad revision or seq/);
  assert.throws(() => loadQueue(stored(1e300)), /bad revision or seq/);
  // a nextSeq out of range is repaired from the entries, like a missing or stale one
  assert.equal(loadQueue(stored(1, 2 ** 53)).nextSeq, 2);
  // the last usable seq is still written and reloads; after it a new unit is refused instead of repeating
  const full = loadQueue(stored(top));
  assert.equal(full.nextSeq, top + 1);
  assert.deepEqual(loadQueue(JSON.parse(JSON.stringify(full))), full);
  assert.throws(() => submit(full, B), /approval queue is full/);
  // a full queue still takes a revision of a unit it holds: that reuses the unit's own seq
  const revised = makeUnit({ title: A.title, subject: A.subject, durationMinutes: A.durationMinutes, body: 'גרסה מתוקנת.' });
  assert.equal(submit(full, revised).entries[A.id].revision, 2);
  const last = loadQueue(stored(top - 1));
  assert.equal(submit(last, B).entries[B.id].seq, top);
  // a hand-built queue whose counter is already past the bound is not a queue
  assert.throws(() => submit({ nextSeq: 2 ** 53 + 2, entries: {} }, B), /invalid queue/);
});
