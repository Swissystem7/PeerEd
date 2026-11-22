'use strict';
// PeerEd - the ONLY record shape the system stores. It is impossible to store personal data of a minor:
// any key outside the accepted fields is rejected, even with an empty value.

const { isRegion } = require('./regions.js');
const { getRetentionPolicy } = require('./retention.js');

const ROLES = Object.freeze(['student', 'pupil']);
const DAYS = Object.freeze(['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT']);
const SUBJECTS = Object.freeze(['MATH', 'PHYSICS', 'CHEMISTRY', 'BIOLOGY', 'ENGLISH', 'HEBREW', 'HISTORY', 'CS', 'CIVICS']);
const ACCEPTED_FIELDS = Object.freeze(['role', 'region', 'availability', 'subjects', 'parentConsent', 'blockedUsers', 'reportEvent', 'responseToReport']);
const AI_LEVELS = Object.freeze(['beginner', 'advanced']);
// the stamp makeProfile derives and writes next to those fields is only ever these two keys
const RETENTION_FIELDS = Object.freeze(['dataCategory', 'maxAgeDays']);
const PERSONAL_DATA_ERROR = 'personal data is not accepted';
const HOUR_MIN = 8;
const HOUR_MAX = 22;
const USER_ID_RE = /^p-[0-9a-f]{8}$/;

function validatorLib() {
  return require('./validator' + '.js');
}

function assertPeerUserId(id) {
  if (typeof id !== 'string' || !USER_ID_RE.test(id)) {
    throw new Error('invalid user id: expected p- followed by 8 hex digits');
  }
  return id;
}

function isPlainObject(obj) {
  if (obj === null || typeof obj !== 'object') return false;
  return !Array.isArray(obj);
}

// A slot is DAY_HOUR, e.g. 'SUN_16' or 'MON_18': day from DAYS, hour an integer 8..22.
// The canonical spelling has no leading zero on the hour: 'SUN_8', never 'SUN_08'. The engine compares
// slots as strings (match.js hasOverlap / shared), so two spellings of one hour would never meet.
// normalizeSlot returns the canonical string for any accepted spelling, or null.
function isHourInRange(hour) {
  return Number.isInteger(hour) && hour >= HOUR_MIN && hour <= HOUR_MAX;
}

function normalizeSlot(slot) {
  if (typeof slot !== 'string') return null;
  const m = /^([A-Z]{3})_(\d{1,2})$/.exec(slot);
  if (!m || DAYS.indexOf(m[1]) === -1) return null;
  const hour = Number(m[2]);
  if (!isHourInRange(hour)) return null;
  return m[1] + '_' + String(hour);
}

function isSlot(slot) {
  return normalizeSlot(slot) !== null;
}

function isAiLevel(level) {
  return typeof level === 'string' && AI_LEVELS.indexOf(level) !== -1;
}

function extractSlotSet(person) {
  const raw = Array.isArray(person) ? person : (person && Array.isArray(person.availability) ? person.availability : []);
  const set = new Set();
  for (let i = 0; i < raw.length; i += 1) {
    const s = normalizeSlot(raw[i]);
    if (s !== null) set.add(s);
  }
  return set;
}

function getWeeklyOverlapSlots(personA, personB) {
  const right = extractSlotSet(personB);
  const aRaw = Array.isArray(personA) ? personA : (personA && Array.isArray(personA.availability) ? personA.availability : []);
  const seen = new Set();
  const out = [];
  for (let i = 0; i < aRaw.length; i += 1) {
    const s = normalizeSlot(aRaw[i]);
    if (s !== null && right.has(s)) {
      if (!seen.has(s)) {
        seen.add(s);
        out.push(s);
      }
    }
  }
  return out.sort();
}

// Order kept, repeats dropped: the people screen counts availability.length as free hours and the
// match screen counts shared subjects, so a slot ticked twice (or stored twice) must not count twice.
function unique(list) {
  const out = [];
  for (let i = 0; i < list.length; i += 1) {
    if (out.indexOf(list[i]) === -1) out.push(list[i]);
  }
  return out;
}

function getSlotHour(slot) {
  if (!isSlot(slot)) {
    throw new Error('invalid slot: ' + String(slot));
  }
  const m = /^([A-Z]{3})_(\d{1,2})$/.exec(slot);
  return Number(m[2]);
}

function assertAllowedProfileKeys(input) {
  const keys = Object.keys(input);
  for (let i = 0; i < keys.length; i += 1) {
    if (ACCEPTED_FIELDS.indexOf(keys[i]) === -1 && keys[i] !== 'aiLevel') {
      throw new Error(PERSONAL_DATA_ERROR);
    }
  }
}

function assertValidRoleAndRegion(role, region) {
  if (ROLES.indexOf(role) === -1) throw new Error('invalid role: expected student or pupil');
  if (!isRegion(region)) throw new Error('invalid region: expected one of the REGIONS codes');
}

function parseProfileSlots(availability) {
  if (!Array.isArray(availability) || availability.length === 0) {
    throw new Error('invalid availability: expected a non-empty array of DAY_HOUR slots');
  }
  const slots = [];
  for (let i = 0; i < availability.length; i += 1) {
    const slot = normalizeSlot(availability[i]);
    if (slot === null) throw new Error('invalid availability slot: ' + String(availability[i]));
    slots.push(slot);
  }
  return slots;
}

function assertValidSubjects(subjects) {
  if (!Array.isArray(subjects) || subjects.length === 0) {
    throw new Error('invalid subjects: expected a non-empty array');
  }
  for (let i = 0; i < subjects.length; i += 1) {
    if (typeof subjects[i] !== 'string' || SUBJECTS.indexOf(subjects[i]) === -1) {
      throw new Error('invalid subjects entry: ' + String(subjects[i]));
    }
  }
}

function parseBlockedUsers(inputBlocked) {
  if (inputBlocked === undefined) return undefined;
  if (!Array.isArray(inputBlocked)) throw new Error('invalid blockedUsers: expected an array');
  const blockedUsers = [];
  for (let i = 0; i < inputBlocked.length; i += 1) {
    const uid = assertPeerUserId(inputBlocked[i]);
    if (blockedUsers.indexOf(uid) === -1) blockedUsers.push(uid);
  }
  return Object.freeze(blockedUsers);
}

function parseReportEvents(inputReport) {
  if (inputReport === undefined) return undefined;
  if (!Array.isArray(inputReport)) throw new Error('invalid reportEvent: expected an array');
  const makeReportEvent = validatorLib().makeReportEvent;
  const reportEvents = [];
  for (let i = 0; i < inputReport.length; i += 1) {
    reportEvents.push(makeReportEvent(inputReport[i]));
  }
  return Object.freeze(reportEvents);
}

function parseResponseToReports(inputResponse) {
  if (inputResponse === undefined) return undefined;
  if (!Array.isArray(inputResponse)) throw new Error('invalid responseToReport: expected an array');
  const makeResponseToReport = validatorLib().makeResponseToReport;
  const responseToReports = [];
  for (let i = 0; i < inputResponse.length; i += 1) {
    responseToReports.push(makeResponseToReport(inputResponse[i]));
  }
  return Object.freeze(responseToReports);
}

function assignOptionalProfileFields(profile, input) {
  if (input.role === 'pupil' || input.parentConsent !== undefined) {
    profile.parentConsent = typeof input.parentConsent === 'boolean' ? input.parentConsent : false;
  }
  if (input.blockedUsers !== undefined) {
    profile.blockedUsers = parseBlockedUsers(input.blockedUsers);
  }
  if (input.reportEvent !== undefined) {
    profile.reportEvent = parseReportEvents(input.reportEvent);
  }
  if (input.responseToReport !== undefined) {
    profile.responseToReport = parseResponseToReports(input.responseToReport);
  }
  if (input.aiLevel !== undefined) {
    profile.aiLevel = input.aiLevel;
  }
}

function assertValidAiLevel(aiLevel) {
  if (aiLevel !== undefined && !isAiLevel(aiLevel)) {
    throw new Error('invalid aiLevel: expected beginner or advanced');
  }
}

function assertValidParentConsent(consent) {
  if (consent !== undefined && typeof consent !== 'boolean') {
    throw new Error('invalid parentConsent: expected boolean');
  }
}

function makeProfile(input) {
  if (!isPlainObject(input)) {
    throw new Error('profile input must be an object with role, region, availability, subjects');
  }
  assertAllowedProfileKeys(input);
  assertValidAiLevel(input.aiLevel);
  assertValidRoleAndRegion(input.role, input.region);
  const slots = parseProfileSlots(input.availability);
  assertValidSubjects(input.subjects);
  assertValidParentConsent(input.parentConsent);

  const profile = {
    role: input.role,
    region: input.region,
    availability: Object.freeze(unique(slots)),
    subjects: Object.freeze(unique(input.subjects))
  };

  assignOptionalProfileFields(profile, input);
  profile.retention = Object.freeze({
    dataCategory: 'profile',
    maxAgeDays: getRetentionPolicy().profile
  });

  return Object.freeze(profile);
}

// The one key a profile carries that makeProfile does not take as input: the retention stamp it derives
// itself. A record on its way back in - from storage (store.js), or a stale copy handed to
// setParentConsent, blockUser, reportEvent or responseToReport - sheds the stamp before it is re-validated,
// and makeProfile puts today's back. Only a stamp this module could have written is shed: the category is
// 'profile' and the day count is a whole number, 0 or more - any whole number, since an older, longer
// policy stamped the rows it wrote and cycle-manager.js judges a row by today's limit, never by the stamp.
// Anything else under the key was dropped unread: the gate checked every other key of a stored record, and
// the one it skipped was the one place a name or a phone written on disk could sit without being refused.
// A third field in the stamp is refused with the same message as a name beside it; a stamp of another
// shape (a string, a list, another category, no day count) is a record the app never wrote.
function assertProfileObject(profile) {
  if (!isPlainObject(profile)) {
    throw new Error('profile must be an object');
  }
}

function isValidRetentionDays(days) {
  return Number.isInteger(days) && days >= 0;
}

function assertValidRetentionKeys(keys) {
  for (let i = 0; i < keys.length; i += 1) {
    if (RETENTION_FIELDS.indexOf(keys[i]) === -1) throw new Error(PERSONAL_DATA_ERROR);
  }
}

function assertValidRetentionStamp(stamp) {
  if (!isPlainObject(stamp)) {
    throw new Error('invalid retention: expected the stamp makeProfile writes');
  }
  assertValidRetentionKeys(Object.keys(stamp));
  if (stamp.dataCategory !== 'profile' || !isValidRetentionDays(stamp.maxAgeDays)) {
    throw new Error('invalid retention: expected the stamp makeProfile writes');
  }
}

function withoutRetentionStamp(profile) {
  const stamp = profile.retention;
  if (stamp !== undefined) {
    assertValidRetentionStamp(stamp);
  }
  const input = Object.assign({}, profile);
  delete input.retention;
  return input;
}

// Returns a new frozen profile with parentConsent set. The result goes through makeProfile again, so
// the privacy gate holds here too: a plain object with a name or a phone cannot be turned into a
// "profile" by asking for consent on it, and a stale or hand-built record is re-validated on the way.
// consent must be a real boolean (or omitted, meaning true): a form value 'false' or 'no' is truthy, and
// coercing it would record a parent's consent that was never given.
function setParentConsent(profile, consent) {
  assertProfileObject(profile);
  if (consent !== undefined && typeof consent !== 'boolean') {
    throw new Error('invalid parentConsent: expected boolean');
  }
  const consentValue = consent === undefined ? true : consent;
  const input = withoutRetentionStamp(profile);
  return makeProfile(Object.assign(input, { parentConsent: consentValue }));
}

function grantParentConsent(profile) {
  return setParentConsent(profile, true);
}

function revokeParentConsent(profile) {
  return setParentConsent(profile, false);
}

function checkBlocked(profile, userId) {
  assertPeerUserId(userId);
  assertProfileObject(profile);
  if (!Array.isArray(profile.blockedUsers)) return false;
  return profile.blockedUsers.indexOf(userId) !== -1;
}

function blockUser(profile, userId) {
  assertProfileObject(profile);
  assertPeerUserId(userId);
  const input = withoutRetentionStamp(profile);
  const current = Array.isArray(profile.blockedUsers) ? profile.blockedUsers.slice() : [];
  if (current.indexOf(userId) === -1) current.push(userId);
  return makeProfile(Object.assign(input, { blockedUsers: current }));
}

function reportEvent(profile, input) {
  assertProfileObject(profile);
  const event = validatorLib().makeReportEvent(input);
  const base = withoutRetentionStamp(profile);
  const current = Array.isArray(profile.reportEvent) ? profile.reportEvent.slice() : [];
  current.push(event);
  return makeProfile(Object.assign(base, { reportEvent: current }));
}

function responseToReport(profile, input) {
  assertProfileObject(profile);
  const response = validatorLib().makeResponseToReport(input);
  const base = withoutRetentionStamp(profile);
  const current = Array.isArray(profile.responseToReport) ? profile.responseToReport.slice() : [];
  current.push(response);
  return makeProfile(Object.assign(base, { responseToReport: current }));
}

function recordPersonSlots(avail, role, dMap, sMap) {
  const seenSlots = new Set();
  for (let j = 0; j < avail.length; j += 1) {
    const norm = normalizeSlot(avail[j]);
    if (norm !== null && !seenSlots.has(norm)) {
      seenSlots.add(norm);
      if (role === 'pupil') {
        dMap.set(norm, (dMap.get(norm) || 0) + 1);
      } else if (role === 'student') {
        sMap.set(norm, (sMap.get(norm) || 0) + 1);
      }
    }
  }
}

function processPersonHeatmap(p, dMap, sMap) {
  if (!isPlainObject(p)) return;
  const role = typeof p.role === 'string' ? p.role.trim().toLowerCase() : '';
  if (role !== 'student' && role !== 'pupil') return;
  const avail = Array.isArray(p.availability) ? p.availability : [];
  recordPersonSlots(avail, role, dMap, sMap);
}

function compareShortageSlots(a, b) {
  if (b.gap !== a.gap) return b.gap - a.gap;
  if (b.demand !== a.demand) return b.demand - a.demand;
  const dayDiff = DAYS.indexOf(a.day) - DAYS.indexOf(b.day);
  if (dayDiff !== 0) return dayDiff;
  return a.hour - b.hour;
}

function buildSlotForHour(day, h, dMap, sMap) {
  const slotKey = day + '_' + h;
  const demand = dMap.get(slotKey) || 0;
  const supply = sMap.get(slotKey) || 0;
  const gap = demand - supply;
  return Object.freeze({
    slot: slotKey,
    day: day,
    hour: h,
    demand: demand,
    supply: supply,
    gap: gap,
    shortage: Math.max(gap, 0),
    pupils: demand,
    students: supply
  });
}

function populateDaySlots(day, maps, out) {
  for (let h = HOUR_MIN; h <= HOUR_MAX; h += 1) {
    const slotObj = buildSlotForHour(day, h, maps.dMap, maps.sMap);
    out.slots.push(slotObj);
    out.slots[slotObj.slot] = slotObj;
    if (slotObj.demand > slotObj.supply) {
      out.topShortageSlots.push(slotObj);
    }
  }
}

function computeWeeklyAvailabilityHeatmap(people) {
  const dMap = new Map();
  const sMap = new Map();

  if (Array.isArray(people)) {
    for (let i = 0; i < people.length; i += 1) {
      processPersonHeatmap(people[i], dMap, sMap);
    }
  }

  const maps = { dMap, sMap };
  const out = { slots: [], topShortageSlots: [] };

  for (let di = 0; di < DAYS.length; di += 1) {
    populateDaySlots(DAYS[di], maps, out);
  }

  out.topShortageSlots.sort(compareShortageSlots);

  return Object.freeze({
    slots: Object.freeze(out.slots),
    topShortageSlots: Object.freeze(out.topShortageSlots)
  });
}

module.exports = {
  DAYS,
  SUBJECTS,
  ACCEPTED_FIELDS,
  AI_LEVELS,
  PERSONAL_DATA_ERROR,
  HOUR_MIN,
  HOUR_MAX,
  isSlot,
  normalizeSlot,
  isAiLevel,
  getWeeklyOverlapSlots,
  computeWeeklyAvailabilityHeatmap,
  makeProfile,
  withoutRetentionStamp,
  getSlotHour,
  setParentConsent,
  grantParentConsent,
  revokeParentConsent,
  checkBlocked,
  blockUser,
  reportEvent,
  responseToReport
};
