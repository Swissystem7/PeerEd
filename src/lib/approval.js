'use strict';
// PeerEd - the approval flow (MVP item 5): nothing reaches a pupil until the approver has read it.
// The approver is a role, not a person: the owner's decision (7.9.2026) is that Aviran approves every
// unit in the MVP, and the queue records only that the role decided, never who. The queue is a plain,
// frozen, JSON-serializable value and every operation returns a new queue: no clock, no randomness, no
// network, no personal data. Order is a submission counter, so a list of pending units is the same on
// every device that replays the same submissions.

const { makeUnit } = require('./unit.js');
const { assertCleanText } = require('./validator.js');

const STATUSES = Object.freeze(['pending', 'approved', 'rejected']);
const APPROVER_ROLE = 'owner';
const REASON_MAX_LENGTH = 300;
const NOT_PENDING_ERROR = 'unit is not pending: only a pending unit can be approved or rejected';

function emptyQueue() {
  return Object.freeze({ nextSeq: 1, entries: Object.freeze({}) });
}

function assertQueue(queue) {
  if (queue === null || typeof queue !== 'object' || Array.isArray(queue)
    || !Number.isInteger(queue.nextSeq) || queue.nextSeq < 1
    || queue.entries === null || typeof queue.entries !== 'object' || Array.isArray(queue.entries)) {
    throw new Error('invalid queue: expected a value from emptyQueue() or loadQueue()');
  }
}

// A unit is accepted only if it is exactly what makeUnit produces for its own fields: the privacy
// gate and the id rule are re-applied here, so a hand-built record with an extra key, a forged id or
// an uncleaned body cannot enter the queue through a stale copy.
function assertUnit(unit) {
  if (unit === null || typeof unit !== 'object' || Array.isArray(unit)) {
    throw new Error('invalid unit: expected a record from makeUnit');
  }
  const rebuilt = makeUnit({
    title: unit.title, subject: unit.subject, durationMinutes: unit.durationMinutes, body: unit.body
  });
  const keys = Object.keys(unit).sort();
  if (keys.join(',') !== 'body,durationMinutes,id,subject,title' || rebuilt.id !== unit.id
    || rebuilt.title !== unit.title || rebuilt.body !== unit.body) {
    throw new Error('invalid unit: expected a record from makeUnit');
  }
  return rebuilt;
}

function withEntry(queue, id, entry, nextSeq) {
  const entries = Object.assign({}, queue.entries);
  entries[id] = Object.freeze(entry);
  return Object.freeze({ nextSeq: nextSeq, entries: Object.freeze(entries) });
}

// A teacher submits a unit. A new id becomes pending. The same id with the same text is a repeat and
// changes nothing, not even the counter. The same id with a different body is a revision: it goes back
// to pending with the revision number raised, whatever the previous decision was, because the approver
// has not read the new text. A rejection reason is dropped with the text it was about.
function submit(queue, unit) {
  assertQueue(queue);
  const clean = assertUnit(unit);
  const existing = queue.entries[clean.id];
  if (existing && existing.unit.body === clean.body && existing.unit.title === clean.title) return queue;
  if (existing) {
    return withEntry(queue, clean.id, {
      unit: clean, status: 'pending', revision: existing.revision + 1, seq: existing.seq
    }, queue.nextSeq);
  }
  return withEntry(queue, clean.id, { unit: clean, status: 'pending', revision: 1, seq: queue.nextSeq },
    queue.nextSeq + 1);
}

function pendingEntry(queue, id) {
  assertQueue(queue);
  if (typeof id !== 'string' || !Object.prototype.hasOwnProperty.call(queue.entries, id)) {
    throw new Error('unknown unit id: ' + String(id));
  }
  const entry = queue.entries[id];
  if (entry.status !== 'pending') throw new Error(NOT_PENDING_ERROR);
  return entry;
}

function approve(queue, id) {
  const entry = pendingEntry(queue, id);
  return withEntry(queue, id, {
    unit: entry.unit, status: 'approved', revision: entry.revision, seq: entry.seq, decidedBy: APPROVER_ROLE
  }, queue.nextSeq);
}

// The reason is shown to the teacher, so it passes the same free-text gate as a unit: no personal data,
// no profanity, bounded length. An empty reason is refused - a rejection without a reason is not a decision.
function reject(queue, id, reason) {
  const entry = pendingEntry(queue, id);
  if (typeof reason !== 'string') throw new Error('invalid reason: expected a string');
  const clean = assertCleanText(reason, { maxLength: REASON_MAX_LENGTH });
  return withEntry(queue, id, {
    unit: entry.unit, status: 'rejected', revision: entry.revision, seq: entry.seq,
    decidedBy: APPROVER_ROLE, reason: clean
  }, queue.nextSeq);
}

function entriesByStatus(queue, status) {
  assertQueue(queue);
  const ids = Object.keys(queue.entries);
  const out = [];
  for (let i = 0; i < ids.length; i += 1) {
    const entry = queue.entries[ids[i]];
    if (entry.status === status) out.push(entry);
  }
  out.sort((a, b) => a.seq - b.seq);
  return out;
}

function listPending(queue) {
  return entriesByStatus(queue, 'pending');
}

// What a pupil or a student may see: approved units only, oldest submission first.
function approvedUnits(queue) {
  return entriesByStatus(queue, 'approved').map((entry) => entry.unit);
}

function statusOf(queue, id) {
  assertQueue(queue);
  if (typeof id !== 'string' || !Object.prototype.hasOwnProperty.call(queue.entries, id)) return null;
  return queue.entries[id].status;
}

// Rebuild a queue from stored JSON (localStorage, a file). Every unit goes through makeUnit again and
// every reason through the text gate, so a record edited on disk cannot bring personal data or a
// forged status into the app. Anything that does not fit is an error, not a silent drop.
function loadQueue(data) {
  if (data === null || typeof data !== 'object' || Array.isArray(data)
    || data.entries === null || typeof data.entries !== 'object' || Array.isArray(data.entries)) {
    throw new Error('invalid stored queue');
  }
  const ids = Object.keys(data.entries);
  const entries = {};
  let maxSeq = 0;
  for (let i = 0; i < ids.length; i += 1) {
    const raw = data.entries[ids[i]];
    if (raw === null || typeof raw !== 'object') throw new Error('invalid stored entry: ' + ids[i]);
    const unit = assertUnit(raw.unit);
    if (unit.id !== ids[i]) throw new Error('invalid stored entry: id mismatch for ' + ids[i]);
    if (STATUSES.indexOf(raw.status) === -1) throw new Error('invalid stored entry: bad status for ' + ids[i]);
    if (!Number.isInteger(raw.revision) || raw.revision < 1 || !Number.isInteger(raw.seq) || raw.seq < 1) {
      throw new Error('invalid stored entry: bad revision or seq for ' + ids[i]);
    }
    const entry = { unit: unit, status: raw.status, revision: raw.revision, seq: raw.seq };
    if (raw.status !== 'pending') entry.decidedBy = APPROVER_ROLE;
    if (raw.status === 'rejected') {
      if (typeof raw.reason !== 'string') {
        throw new Error('invalid stored entry: rejected without a reason: ' + ids[i]);
      }
      entry.reason = assertCleanText(raw.reason, { maxLength: REASON_MAX_LENGTH });
    }
    entries[unit.id] = Object.freeze(entry);
    if (raw.seq > maxSeq) maxSeq = raw.seq;
  }
  const nextSeq = Number.isInteger(data.nextSeq) && data.nextSeq > maxSeq ? data.nextSeq : maxSeq + 1;
  return Object.freeze({ nextSeq: nextSeq, entries: Object.freeze(entries) });
}

module.exports = {
  STATUSES,
  APPROVER_ROLE,
  REASON_MAX_LENGTH,
  NOT_PENDING_ERROR,
  emptyQueue,
  submit,
  approve,
  reject,
  listPending,
  approvedUnits,
  statusOf,
  loadQueue
};
