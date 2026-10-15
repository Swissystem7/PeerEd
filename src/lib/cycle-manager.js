'use strict';
// PeerEd — drop stored match and profile records that exceeded their retention window. Inputs are never mutated.

function toUtcDayIndex(value) {
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) {
    throw new Error('invalid date: ' + String(value));
  }
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

function ageInDays(recordedAt, currentDate) {
  const recorded = toUtcDayIndex(recordedAt);
  const asOf = toUtcDayIndex(currentDate);
  return Math.floor((asOf - recorded) / 86400000);
}

function isRetained(record, currentDate) {
  if (record === null || typeof record !== 'object') {
    throw new Error('retention record must be an object');
  }
  if (!record.retention || typeof record.retention.maxAgeDays !== 'number') {
    throw new Error('retention record is missing maxAgeDays');
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
  applyRetentionPolicy,
  ageInDays
};
