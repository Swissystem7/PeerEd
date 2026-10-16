'use strict';
// PeerEd - the end of a cycle: drop every stored row that has outlived its retention window.
//
// retention.js states the limits and match.js stamps a row with its category; this is the sweep that
// acts on them, so "nothing is kept indefinitely" is something the code does and not only something the
// README says. A row is anything carrying a day and a category:
//
//   { recordedAt: '2026-03-04', retention: { dataCategory: 'match' }, ... }
//
// Whatever sits beside those two fields is never read, so a caller wraps what it stores: a profile
// record cannot hold a recordedAt of its own, since makeProfile() refuses every key it does not know.
// The limit always comes from today's getRetentionPolicy() and never from the row - shortening a window
// in retention.js must delete more at the next sweep, not leave old rows on their old terms. No clock
// of its own either: the caller passes the day the cycle ends, and the caller's arrays are untouched.
//
// Two entry points share the same day arithmetic:
//   sweep(rows, asOf)                 - one flat array, judged by the policy's limit for the row's category
//   applyRetentionPolicy(stored, asOf) - { matches, profiles }, judged by the maxAgeDays stamped on the row

const { getRetentionPolicy } = require('./retention.js');

const ROW_ERROR = 'stored row must be an object with recordedAt and retention.dataCategory';

// An ISO day, or an ISO timestamp that says its own offset. Anything looser goes through the engine's
// legacy parser, which reads '3/4/2026' on the machine's clock, '12' as the year 2001 and rolls
// '2026-02-30' into March - and a sweep would then delete a row on a day nobody wrote down.
const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})(?:T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:\d{2}))?$/;

function utcMidnight(value, what) {
  const bad = new Error('invalid ' + what + ': expected a Date or an ISO date string');
  let d = value;
  if (!(value instanceof Date)) {
    const m = typeof value === 'string' ? ISO_DATE.exec(value) : null;
    if (m === null) throw bad;
    // setUTCFullYear, not Date.UTC: Date.UTC reads a year 0-99 as 1900-1999
    const day = new Date(0);
    day.setUTCFullYear(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
    if (day.getUTCFullYear() !== Number(m[1]) || day.getUTCMonth() !== Number(m[2]) - 1 || day.getUTCDate() !== Number(m[3])) {
      throw bad;
    }
    d = new Date(value);
  }
  if (Number.isNaN(d.getTime())) throw bad;
  return Math.floor(d.getTime() / 86400000) * 86400000;
}

// Whole days between two timestamps, on the UTC calendar, so an evening row is no older than a morning one.
function ageInDays(recordedAt, asOf) {
  return Math.floor((utcMidnight(asOf, 'asOf') - utcMidnight(recordedAt, 'recordedAt')) / 86400000);
}

// A row is kept through the last day of its window and dropped the day after. A category the policy
// does not name is refused, not kept forever.
function isExpired(record, asOf) {
  if (record === null || typeof record !== 'object' || Array.isArray(record)) throw new Error(ROW_ERROR);
  if (record.retention === null || typeof record.retention !== 'object') throw new Error(ROW_ERROR);
  if (record.recordedAt === undefined || record.recordedAt === null) {
    throw new Error('invalid recordedAt: expected a Date or an ISO date string');
  }
  const limit = getRetentionPolicy()[record.retention.dataCategory];
  if (!Number.isInteger(limit)) {
    throw new Error('invalid retention: the policy has no limit for ' + String(record.retention.dataCategory));
  }
  return ageInDays(record.recordedAt, asOf) > limit;
}

// Split stored rows into the ones the policy still allows and the ones this cycle must delete. Both
// halves come back, so a sweep can be shown to a coordinator before it is written back.
function sweep(records, asOf) {
  if (!Array.isArray(records)) throw new Error('sweep expects an array of stored rows');
  const kept = [];
  const dropped = [];
  for (let i = 0; i < records.length; i += 1) {
    (isExpired(records[i], asOf) ? dropped : kept).push(records[i]);
  }
  return Object.freeze({ kept: kept, dropped: dropped });
}

// The row-level check behind applyRetentionPolicy(): the limit is the maxAgeDays the row was stamped with.
// A stamp that is not a whole number of days (Infinity, NaN, -1, 1.5) is refused: Infinity would keep the
// row forever, which retention.js promises never happens.
function isRetained(record, currentDate) {
  if (record === null || typeof record !== 'object') {
    throw new Error('retention record must be an object');
  }
  if (!record.retention || record.retention.maxAgeDays === undefined) {
    throw new Error('retention record is missing maxAgeDays');
  }
  if (!Number.isInteger(record.retention.maxAgeDays) || record.retention.maxAgeDays < 0) {
    throw new Error('invalid maxAgeDays: expected a whole number of days, 0 or more');
  }
  if (record.recordedAt === undefined || record.recordedAt === null) {
    throw new Error('retention record is missing recordedAt');
  }
  return ageInDays(record.recordedAt, currentDate) <= record.retention.maxAgeDays;
}

// { matches, profiles } are parallel arrays of stored records (each with recordedAt + retention metadata).
function applyRetentionPolicy(stored, currentDate) {
  if (stored === null || typeof stored !== 'object' || Array.isArray(stored)) {
    throw new Error('stored input must be an object with matches and profiles arrays');
  }
  const matches = Array.isArray(stored.matches) ? stored.matches : [];
  const profiles = Array.isArray(stored.profiles) ? stored.profiles : [];
  return {
    matches: matches.filter((r) => isRetained(r, currentDate)),
    profiles: profiles.filter((r) => isRetained(r, currentDate))
  };
}

module.exports = {
  applyRetentionPolicy: applyRetentionPolicy,
  ageInDays: ageInDays,
  isExpired: isExpired,
  sweep: sweep
};
