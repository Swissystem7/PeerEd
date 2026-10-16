'use strict';
// PeerEd - an enrichment unit: the short, text-only lesson a teacher submits for approval (MVP item 4).
// Its id is a hash of title + subject + duration, so the same unit submitted twice gets the same id and
// a municipality can refer to a unit without any record of who wrote it. No clock, no randomness, no
// network, no personal data: title and body go through the free-text gate before anything is kept.
// CommonJS on purpose, and no node:crypto - this file is inlined into app.html and must run in a browser.

const { SUBJECTS, PERSONAL_DATA_ERROR } = require('./profile.js');
const { assertCleanText } = require('./validator.js');

const ACCEPTED_FIELDS = Object.freeze(['title', 'subject', 'durationMinutes', 'body']);
const TITLE_MAX_LENGTH = 120;
const BODY_MAX_LENGTH = 4000;
// "short" is the point: a unit is one sitting of text, not a course
const DURATION_MIN = 5;
const DURATION_MAX = 60;
const ID_PREFIX = 'u-';

// FNV-1a over the UTF-16 code units of the string, 32 bits, with a caller-chosen offset basis so two
// passes give 64 bits of id. Pure integer arithmetic: the same string hashes the same in Node and in
// every browser. Math.imul keeps the multiply inside 32 bits.
function fnv1a32(text, basis) {
  let hash = basis >>> 0;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash >>> 0;
}

function hex8(n) {
  return ('00000000' + n.toString(16)).slice(-8);
}

// A title is compared the way a reader compares it: case and spacing do not make a new unit, and neither
// does the code-point order of the same letters. A Hebrew title with niqqud, or a Latin letter with an
// accent, arrives composed or decomposed depending on the keyboard and the OS; NFC folds both spellings
// into one, so the same title typed on a phone and on a laptop gets the same id. NFC leaves ASCII alone,
// so no id already on file moves.
function normalizeTitle(title) {
  return String(title).normalize('NFC').replace(/\s+/g, ' ').trim().toLowerCase();
}

// The id of a unit from the three fields that define it. Exported so a caller can ask whether a unit
// already exists before building the whole record. The body is NOT part of the id on purpose: a teacher
// who fixes a typo in the text resubmits the same unit, and the approval flow sees a revision, not a new
// unit. The separator cannot occur in a cleaned title (control characters are stripped by the gate).
function unitId(title, subject, durationMinutes) {
  const key = [normalizeTitle(title), String(subject), String(durationMinutes)].join('\u0000');
  return ID_PREFIX + hex8(fnv1a32(key, 0x811c9dc5)) + hex8(fnv1a32(key, 0x050c5d1f));
}

// The gate's length errors name no field, so the teacher saw 'text too short' and could not tell whether
// the title or the body was empty. They are re-thrown naming the field and the limit. The personal-data
// and profanity errors pass through unchanged: they read the same on every screen.
function cleanField(name, text, maxLength) {
  try {
    return assertCleanText(text, { maxLength: maxLength });
  } catch (err) {
    if (err.message === 'text too short') throw new Error('invalid ' + name + ': text too short, it is empty');
    if (err.message === 'text too long') {
      throw new Error('invalid ' + name + ': text too long, at most ' + maxLength + ' characters');
    }
    throw err;
  }
}

function makeUnit(input) {
  if (input === null || typeof input !== 'object' || Array.isArray(input)) {
    throw new Error('unit input must be an object with title, subject, durationMinutes, body');
  }
  // Privacy gate first, same as the profile: an unknown key (author, school, email...) is refused
  // before anything else is looked at, with the same message, so the rule reads the same everywhere.
  const keys = Object.keys(input);
  for (let i = 0; i < keys.length; i += 1) {
    if (ACCEPTED_FIELDS.indexOf(keys[i]) === -1) throw new Error(PERSONAL_DATA_ERROR);
  }
  if (typeof input.subject !== 'string' || SUBJECTS.indexOf(input.subject) === -1) {
    throw new Error('invalid subject: expected one of the SUBJECTS codes');
  }
  const duration = input.durationMinutes;
  if (!Number.isInteger(duration) || duration < DURATION_MIN || duration > DURATION_MAX) {
    throw new Error('invalid durationMinutes: expected an integer ' + DURATION_MIN + '..' + DURATION_MAX);
  }
  if (typeof input.title !== 'string') throw new Error('invalid title: expected a string');
  if (typeof input.body !== 'string') throw new Error('invalid body: expected a string');
  // The gate throws the personal-data or profanity error itself; a title is one line.
  const title = cleanField('title', input.title, TITLE_MAX_LENGTH);
  if (title.indexOf('\n') !== -1) throw new Error('invalid title: expected a single line');
  const body = cleanField('body', input.body, BODY_MAX_LENGTH);

  return Object.freeze({
    id: unitId(title, input.subject, duration),
    title: title,
    subject: input.subject,
    durationMinutes: duration,
    body: body
  });
}

module.exports = {
  ACCEPTED_FIELDS,
  TITLE_MAX_LENGTH,
  BODY_MAX_LENGTH,
  DURATION_MIN,
  DURATION_MAX,
  unitId,
  makeUnit
};
