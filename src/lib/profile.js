'use strict';
// PeerEd - the ONLY record shape the system stores. It is impossible to store personal data of a minor:
// any key outside the accepted fields is rejected, even with an empty value.

const { isRegion } = require('./regions.js');

const ROLES = Object.freeze(['student', 'pupil']);
const DAYS = Object.freeze(['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT']);
const SUBJECTS = Object.freeze(['MATH', 'PHYSICS', 'CHEMISTRY', 'BIOLOGY', 'ENGLISH', 'HEBREW', 'HISTORY', 'CS', 'CIVICS']);
const ACCEPTED_FIELDS = Object.freeze(['role', 'region', 'availability', 'subjects', 'parentConsent']);
const PERSONAL_DATA_ERROR = 'personal data is not accepted';
const HOUR_MIN = 8;
const HOUR_MAX = 22;

// A slot is DAY_HOUR, e.g. 'SUN_16' or 'MON_18': day from DAYS, hour an integer 8..22.
function isSlot(slot) {
  if (typeof slot !== 'string') return false;
  const m = /^([A-Z]{3})_(\d{1,2})$/.exec(slot);
  if (!m || DAYS.indexOf(m[1]) === -1) return false;
  const hour = Number(m[2]);
  return Number.isInteger(hour) && hour >= HOUR_MIN && hour <= HOUR_MAX;
}

function makeProfile(input) {
  if (input === null || typeof input !== 'object' || Array.isArray(input)) {
    throw new Error('profile input must be an object with role, region, availability, subjects');
  }
  // Privacy gate first: an unknown key is rejected before anything else is looked at.
  const keys = Object.keys(input);
  for (let i = 0; i < keys.length; i += 1) {
    if (ACCEPTED_FIELDS.indexOf(keys[i]) === -1) throw new Error(PERSONAL_DATA_ERROR);
  }
  const role = input.role;
  const region = input.region;
  const availability = input.availability;
  const subjects = input.subjects;

  if (ROLES.indexOf(role) === -1) throw new Error('invalid role: expected student or pupil');
  if (!isRegion(region)) throw new Error('invalid region: expected one of the REGIONS codes');
  if (!Array.isArray(availability) || availability.length === 0) {
    throw new Error('invalid availability: expected a non-empty array of DAY_HOUR slots');
  }
  for (let i = 0; i < availability.length; i += 1) {
    if (!isSlot(availability[i])) throw new Error('invalid availability slot: ' + String(availability[i]));
  }
  if (!Array.isArray(subjects) || subjects.length === 0) {
    throw new Error('invalid subjects: expected a non-empty array');
  }
  for (let i = 0; i < subjects.length; i += 1) {
    if (typeof subjects[i] !== 'string' || SUBJECTS.indexOf(subjects[i]) === -1) {
      throw new Error('invalid subjects entry: ' + String(subjects[i]));
    }
  }

  if (input.parentConsent !== undefined && typeof input.parentConsent !== 'boolean') {
    throw new Error('invalid parentConsent: expected boolean');
  }

  const profile = {
    role: role,
    region: region,
    availability: Object.freeze(availability.slice()),
    subjects: Object.freeze(subjects.slice())
  };

  if (role === 'pupil' || input.parentConsent !== undefined) {
    profile.parentConsent = typeof input.parentConsent === 'boolean' ? input.parentConsent : false;
  }

  return Object.freeze(profile);
}

// Returns a new frozen profile with parentConsent set. The result goes through makeProfile again, so
// the privacy gate holds here too: a plain object with a name or a phone cannot be turned into a
// "profile" by asking for consent on it, and a stale or hand-built record is re-validated on the way.
function setParentConsent(profile, consent) {
  if (profile === null || typeof profile !== 'object' || Array.isArray(profile)) {
    throw new Error('profile must be an object');
  }
  const consentValue = consent === undefined ? true : Boolean(consent);
  return makeProfile(Object.assign({}, profile, { parentConsent: consentValue }));
}

function grantParentConsent(profile) {
  return setParentConsent(profile, true);
}

function revokeParentConsent(profile) {
  return setParentConsent(profile, false);
}

module.exports = {
  ROLES,
  DAYS,
  SUBJECTS,
  ACCEPTED_FIELDS,
  PERSONAL_DATA_ERROR,
  isSlot,
  makeProfile,
  setParentConsent,
  grantParentConsent,
  revokeParentConsent
};
