'use strict';
// PeerEd - the session log (MVP item 6): the record that a text session took place, with nothing in it
// that points at a person. A session is logged for a pair from matchPairs, but the log keeps only what
// the pair shares - region, slot, subject - plus the id of the approved unit that was taught and how
// the session ended. The pair's roster positions are never written: a position is an identity once a
// municipality sees the roster. The log is a frozen, JSON-serializable value and every operation
// returns a new log: no clock, no randomness, no network, no personal data. Order is a counter.

const { isRegion } = require('./regions.js');
const { isSlot, normalizeSlot, SUBJECTS, PERSONAL_DATA_ERROR } = require('./profile.js');
const { statusOf } = require('./approval.js');

const OUTCOMES = Object.freeze(['held', 'missed', 'cut_short']);
const ACCEPTED_FIELDS = Object.freeze(['slot', 'subject', 'unitId', 'outcome']);
// the log itself is only ever written with these two keys
const LOG_FIELDS = Object.freeze(['nextSeq', 'entries']);
const UNIT_NOT_APPROVED_ERROR = 'unit is not approved: only an approved unit can be taught';
// The largest seq a row may carry: one below the last safe integer, so nextSeq (seq + 1) is still exact.
// Past 2^53 adding 1 no longer changes the number, two rows would share a seq and the saved log could
// never be loaded again; a stored seq or nextSeq beyond this is a value the app never wrote.
const MAX_SEQ = Number.MAX_SAFE_INTEGER - 1;

function emptyLog() {
  return Object.freeze({ nextSeq: 1, entries: Object.freeze([]) });
}

function assertLog(log) {
  if (log === null || typeof log !== 'object' || Array.isArray(log)
    || !Number.isInteger(log.nextSeq) || log.nextSeq < 1 || log.nextSeq > MAX_SEQ + 1
    || !Array.isArray(log.entries)) {
    throw new Error('invalid log: expected a value from emptyLog() or loadLog()');
  }
}

// A pair is what matchPairs returns: region plus the shared slots and subjects. Only those three are
// read; the roster positions on the pair are ignored on purpose and never reach the entry.
// The two lists hold nothing but codes: slots in the one spelling makeProfile writes ('SUN_8', never
// 'SUN_08') and SUBJECTS codes, at least one of each, since candidatesOf drops a pair without. That is
// checked here, not taken on trust. Until this check the lists only had to be arrays, and the row's
// slot only had to be some spelling of an hour the pair listed: a hand-built pair with 'SUN_08' in
// sharedSlots had its session written as 'SUN_08', the one spelling loadLog refuses - so the next load
// threw the whole saved state away, roster, queue and log, over a row the app itself had written.
// A pair with anything else in it is not a pair from matchPairs() and is refused as one.
function isCodeList(list, isCode) {
  if (!Array.isArray(list) || list.length === 0) return false;
  for (let i = 0; i < list.length; i += 1) {
    if (!isCode(list[i])) return false;
  }
  return true;
}

function isCanonicalSlot(slot) {
  return normalizeSlot(slot) === slot;
}

function isSubject(code) {
  return typeof code === 'string' && SUBJECTS.indexOf(code) !== -1;
}

function assertPair(pair) {
  if (pair === null || typeof pair !== 'object' || Array.isArray(pair) || !isRegion(pair.region)
    || !isCodeList(pair.sharedSlots, isCanonicalSlot) || !isCodeList(pair.sharedSubjects, isSubject)) {
    throw new Error('invalid pair: expected a pair from matchPairs');
  }
}

// Whether a unit may stand on a session row. A new row needs the unit approved now. A stored row is
// a lesson already given, so it also stands on a unit the teacher revised after it was taught: the
// revision sends the unit back to pending (and may be rejected), and refusing the old row then threw
// the whole saved state away - roster, queue and log - on the next load. Only a unit that has had a
// revision (revision > 1) may have been approved before; one still on its first text never was.
function unitTaughtOk(queue, unitId, stored) {
  const status = statusOf(queue, unitId);
  if (status === 'approved') return true;
  return stored === true && status !== null && queue.entries[unitId].revision > 1;
}

// The checks shared by a live report and a stored record: the slot and subject are ones the pair
// shares, the unit is approved in the queue (or was, for a stored row - unitTaughtOk), and the
// subject is the unit's own subject.
// `at` is the row's index in the stored log, undefined for a live report. A refusal names what the
// coordinator did - 'expected a slot the pair shares': the hour is in the grid, the subject in the
// list - or, for a stored row, the row, the way loadLog already names a bad region or seq. A stored
// row has no pair and nobody chose anything on it; with the live wording a row that did not fit was
// reported on load as the screen's line for an hour the pair is not free at, a sentence about a pair
// that does not exist, while the line for a stored row that does not fit went unused.
function cleanEntry(queue, region, sharedSlots, sharedSubjects, input, at) {
  const stored = at !== undefined;
  const refused = (live, what) => new Error(stored ? 'invalid stored session: ' + what + ' at ' + at : live);
  if (input === null || typeof input !== 'object' || Array.isArray(input)) {
    throw new Error('session input must be an object with slot, subject, unitId, outcome');
  }
  // Privacy gate first, same as the profile and the unit: an unknown key (pupil, student, note,
  // studentIndex...) is refused before anything else is looked at, with the same message.
  const keys = Object.keys(input);
  for (let i = 0; i < keys.length; i += 1) {
    if (ACCEPTED_FIELDS.indexOf(keys[i]) === -1) throw new Error(PERSONAL_DATA_ERROR);
  }
  if (!isSlot(input.slot) || sharedSlots.indexOf(input.slot) === -1) {
    throw refused('invalid slot: expected a slot the pair shares', 'bad slot');
  }
  if (SUBJECTS.indexOf(input.subject) === -1 || sharedSubjects.indexOf(input.subject) === -1) {
    throw refused('invalid subject: expected a subject the pair shares', 'bad subject');
  }
  if (OUTCOMES.indexOf(input.outcome) === -1) {
    throw refused('invalid outcome: expected one of ' + OUTCOMES.join(', '), 'bad outcome');
  }
  if (typeof input.unitId !== 'string' || !unitTaughtOk(queue, input.unitId, stored)) {
    throw refused(UNIT_NOT_APPROVED_ERROR, 'unit not approved');
  }
  if (queue.entries[input.unitId].unit.subject !== input.subject) {
    throw refused('invalid subject: expected the subject of the unit', 'subject is not the unit\'s');
  }
  return { region: region, slot: input.slot, subject: input.subject, unitId: input.unitId, outcome: input.outcome };
}

// Record one session of a matched pair. queue is the approval queue the unit was approved in.
function logSession(log, queue, pair, input) {
  assertLog(log);
  assertPair(pair);
  if (log.nextSeq > MAX_SEQ) throw new Error('session log is full: no sequence number left');
  const clean = cleanEntry(queue, pair.region, pair.sharedSlots, pair.sharedSubjects, input);
  clean.seq = log.nextSeq;
  const entries = log.entries.slice();
  entries.push(Object.freeze(clean));
  return Object.freeze({ nextSeq: log.nextSeq + 1, entries: Object.freeze(entries) });
}

function countBy(entries, key) {
  const out = {};
  for (let i = 0; i < entries.length; i += 1) {
    const v = entries[i][key];
    out[v] = (out[v] || 0) + 1;
  }
  return Object.freeze(out);
}

// What a municipality gets: counts, never rows about anyone. Keys are sorted on output by JSON
// consumers; here the counts are plain objects keyed by the enum codes.
function summarize(log) {
  assertLog(log);
  const entries = log.entries;
  return Object.freeze({
    sessions: entries.length,
    byRegion: countBy(entries, 'region'),
    bySubject: countBy(entries, 'subject'),
    byOutcome: countBy(entries, 'outcome'),
    byUnit: countBy(entries, 'unitId')
  });
}

// The export of that summary: one CSV text a municipality can paste into a spreadsheet. It is built from
// summarize() only, so it holds exactly the counts the screen shows - no row, no pair, no position -
// and the same log always gives the same text: measures in a fixed order, codes sorted, LF line ends.
// Every code is an enum value or a unit id, so there is nothing to quote; a code that would need
// quoting is a bug upstream and is refused here rather than written.
const REPORT_HEADER = 'measure,code,count';
const REPORT_MEASURES = Object.freeze([
  ['outcome', 'byOutcome'], ['region', 'byRegion'], ['subject', 'bySubject'], ['unit', 'byUnit']
]);

function reportCsv(log) {
  const s = summarize(log);
  const lines = [REPORT_HEADER, 'sessions,,' + s.sessions];
  for (let m = 0; m < REPORT_MEASURES.length; m += 1) {
    const measure = REPORT_MEASURES[m][0];
    const counts = s[REPORT_MEASURES[m][1]];
    const codes = Object.keys(counts).sort();
    for (let i = 0; i < codes.length; i += 1) {
      if (!/^[A-Za-z0-9_-]+$/.test(codes[i])) throw new Error('invalid report code: ' + codes[i]);
      lines.push(measure + ',' + codes[i] + ',' + counts[codes[i]]);
    }
  }
  return lines.join('\n') + '\n';
}

// Rebuild a log from stored JSON. Every row is re-checked against the queue it is loaded with, so a
// row edited on disk cannot bring an extra key, an unapproved unit or a foreign region into the app.
// A stored row carries its own region and no pair, so the slot and subject are checked for shape and
// the unit for approval and subject; the pair check happened when the row was written. The slot must be
// in its canonical spelling: assertPair lets only slots in makeProfile's spelling onto a pair, so
// logSession only ever writes 'SUN_8', and a stored 'SUN_08' is a row the app never wrote - refused,
// not quietly kept.
function loadLog(data, queue) {
  if (data === null || typeof data !== 'object' || Array.isArray(data) || !Array.isArray(data.entries)) {
    throw new Error('invalid stored log');
  }
  // a key next to the rows (a coordinator name, a school) is refused like one inside a row
  const logKeys = Object.keys(data);
  for (let k = 0; k < logKeys.length; k += 1) {
    if (LOG_FIELDS.indexOf(logKeys[k]) === -1) throw new Error(PERSONAL_DATA_ERROR);
  }
  const entries = [];
  let lastSeq = 0;
  for (let i = 0; i < data.entries.length; i += 1) {
    const raw = data.entries[i];
    if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
      throw new Error('invalid stored session: ' + i);
    }
    const keys = Object.keys(raw);
    for (let k = 0; k < keys.length; k += 1) {
      if (keys[k] !== 'region' && keys[k] !== 'seq' && ACCEPTED_FIELDS.indexOf(keys[k]) === -1) {
        throw new Error(PERSONAL_DATA_ERROR);
      }
    }
    if (!isRegion(raw.region)) throw new Error('invalid stored session: bad region at ' + i);
    if (!Number.isInteger(raw.seq) || raw.seq <= lastSeq || raw.seq > MAX_SEQ) {
      throw new Error('invalid stored session: seq out of order at ' + i);
    }
    const clean = cleanEntry(queue, raw.region, [normalizeSlot(raw.slot)], [raw.subject],
      { slot: raw.slot, subject: raw.subject, unitId: raw.unitId, outcome: raw.outcome }, i);
    clean.seq = raw.seq;
    entries.push(Object.freeze(clean));
    lastSeq = raw.seq;
  }
  const nextSeq = Number.isInteger(data.nextSeq) && data.nextSeq > lastSeq && data.nextSeq <= MAX_SEQ + 1
    ? data.nextSeq : lastSeq + 1;
  return Object.freeze({ nextSeq: nextSeq, entries: Object.freeze(entries) });
}

module.exports = {
  OUTCOMES,
  ACCEPTED_FIELDS,
  UNIT_NOT_APPROVED_ERROR,
  emptyLog,
  logSession,
  summarize,
  reportCsv,
  REPORT_HEADER,
  loadLog
};
