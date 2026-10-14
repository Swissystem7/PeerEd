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

const { getRetentionPolicy } = require('./retention.js');

const ROW_ERROR = 'stored row must be an object with recordedAt and retention.dataCategory';

function utcMidnight(value, what) {
  const d = value instanceof Date ? value : new Date(String(value));
  if (Number.isNaN(d.getTime())) {
    throw new Error('invalid ' + what + ': expected a Date or an ISO date string');
  }
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
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

module.exports = { ageInDays: ageInDays, isExpired: isExpired, sweep: sweep };
