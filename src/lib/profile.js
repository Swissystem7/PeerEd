
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
const SLOT_RE = /^([A-Z]{3})_(\d{1,2})$/;

function validatorLib() {
  return require('./validator' + '.js');
}

function assertPeerUserId(id) {
  if (typeof id !== 'string' || !USER_ID_RE.test(id)) {
    throw new Error('invalid user id: expected p- followed by 8 hex digits');
  }
  return id;
}

// One parse for every reader: the matcher, the hour helper and the heatmap must all agree on what a
// slot is. An accepted slot is always returned in its canonical spelling, 'SUN_8' and never 'SUN_08'.
function parsedSlot(slot) {
  if (typeof slot !== 'string') return null;
  const m = SLOT_RE.exec(slot);
  if (m === null) return null;
  if (DAYS.indexOf(m[1]) === -1) return null;
  const hour = Number(m[2]);
  if (!Number.isInteger(hour)) return null;
  if (hour < HOUR_MIN) return null;
  if (hour > HOUR_MAX) return null;
  return { day: m[1], hour: hour };
}

// A slot is DAY_HOUR, e.g. 'SUN_16' or 'MON_18': day from DAYS, hour an integer 8..22.
// The canonical spelling has no leading zero on the hour. normalizeSlot returns that string for any
// accepted spelling, or null. The engine compares slots as strings (match.js hasOverlap / shared), so
// two spellings of one hour would never meet.
function normalizeSlot(slot) {
  const parsed = parsedSlot(slot);
  if (parsed === null) return null;
  return `${parsed.day}_${String(parsed.hour)}`;
}

function isSlot(slot) {
  return normalizeSlot(slot) !== null;
}

function isAiLevel(level) {
  if (typeof level !== 'string') return false;
  return AI_LEVELS.indexOf(level) !== -1;
}

function availabilityOf(p) {
  if (Array.isArray(p)) return p;
  if (p === null) return [];
  if (typeof p !== 'object') return [];
  if (Array.isArray(p.availability)) return p.availability;
  return [];
}

function normalizedSlotSet(list) {
  const out = new Set();
  for (let i = 0; i < list.length; i += 1) {
    const s = normalizeSlot(list[i]);
    if (s !== null) out.add(s);
  }
  return out;
}

function getWeeklyOverlapSlots(personA, personB) {
  const right = normalizedSlotSet(availabilityOf(personB));
  const seen = new Set();
  const out = [];
  const left = availabilityOf(personA);
  for (let i = 0; i < left.length; i += 1) {
    const s = normalizeSlot(left[i]);
    if (s === null) continue;
    if (!right.has(s)) continue;
    if (seen.has(s)) continue;
    seen.add(s);
    out.push(s);
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
  const parsed = parsedSlot(slot);
  if (parsed === null) throw new Error(`invalid slot: ${String(slot)}`);
  return parsed.hour;
}

function profileInputError() {
  return new Error('profile input must be an object with role, region, availability, subjects');
}

function assertProfileInput(input) {
  if (input === null) throw profileInputError();
  if (typeof input !== 'object') throw profileInputError();
  if (Array.isArray(input)) throw profileInputError();
}

function assertAcceptedFields(input) {
  const keys = Object.keys(input);
  for (let i = 0; i < keys.length; i += 1) {
    if (ACCEPTED_FIELDS.indexOf(keys[i]) !== -1) continue;
    if (keys[i] === 'aiLevel') continue;
    throw new Error(PERSONAL_DATA_ERROR);
  }
}

function assertAiLevelInput(input) {
  if (input.aiLevel === undefined) return;
  if (!isAiLevel(input.aiLevel)) throw new Error('invalid aiLevel: expected beginner or advanced');
}

function assertRole(role) {
  if (ROLES.indexOf(role) === -1) throw new Error('invalid role: expected student or pupil');
}

function assertRegion(region) {
  if (!isRegion(region)) throw new Error('invalid region: expected one of the REGIONS codes');
}

function normalizedAvailability(availability) {
  if (!Array.isArray(availability)) throw new Error('invalid availability: expected a non-empty array of DAY_HOUR slots');
  if (availability.length === 0) throw new Error('invalid availability: expected a non-empty array of DAY_HOUR slots');
  const slots = [];
  for (let i = 0; i < availability.length; i += 1) {
    const slot = normalizeSlot(availability[i]);
    if (slot === null) throw new Error(`invalid availability slot: ${String(availability[i])}`);
    slots.push(slot);
  }
  return unique(slots);
}

function invalidSubject(subject) {
  return new Error(`invalid subjects entry: ${String(subject)}`);
}

function assertSubject(subject) {
  if (typeof subject !== 'string') throw invalidSubject(subject);
  if (SUBJECTS.indexOf(subject) === -1) throw invalidSubject(subject);
}

function validatedSubjects(subjects) {
  if (!Array.isArray(subjects)) throw new Error('invalid subjects: expected a non-empty array');
  if (subjects.length === 0) throw new Error('invalid subjects: expected a non-empty array');
  for (let i = 0; i < subjects.length; i += 1) {
    assertSubject(subjects[i]);
  }
  return unique(subjects);
}

function assertParentConsentInput(input) {
  if (input.parentConsent === undefined) return;
  if (typeof input.parentConsent !== 'boolean') throw new Error('invalid parentConsent: expected boolean');
}

function blockedUsersOf(input) {
  if (input.blockedUsers === undefined) return null;
  if (!Array.isArray(input.blockedUsers)) throw new Error('invalid blockedUsers: expected an array');
  const out = [];
  for (let i = 0; i < input.blockedUsers.length; i += 1) {
    const uid = assertPeerUserId(input.blockedUsers[i]);
    if (out.indexOf(uid) === -1) out.push(uid);
  }
  return out;
}

function reportEventsOf(input) {
  if (input.reportEvent === undefined) return null;
  if (!Array.isArray(input.reportEvent)) throw new Error('invalid reportEvent: expected an array');
  const makeReportEvent = validatorLib().makeReportEvent;
  const out = [];
  for (let i = 0; i < input.reportEvent.length; i += 1) {
    out.push(makeReportEvent(input.reportEvent[i]));
  }
  return out;
}

function responseToReportsOf(input) {
  if (input.responseToReport === undefined) return null;
  if (!Array.isArray(input.responseToReport)) throw new Error('invalid responseToReport: expected an array');
  const makeResponseToReport = validatorLib().makeResponseToReport;
  const out = [];
  for (let i = 0; i < input.responseToReport.length; i += 1) {
    out.push(makeResponseToReport(input.responseToReport[i]));
  }
  return out;
}

function profileRetention() {
  return Object.freeze({ dataCategory: 'profile', maxAgeDays: getRetentionPolicy().profile });
}

function makeProfile(input) {
  assertProfileInput(input);
  assertAcceptedFields(input);
  assertAiLevelInput(input);
  assertRole(input.role);
  assertRegion(input.region);
  const availability = normalizedAvailability(input.availability);
  const subjects = validatedSubjects(input.subjects);
  assertParentConsentInput(input);

  const blockedUsers = blockedUsersOf(input);
  const reportEvents = reportEventsOf(input);
  const responseToReports = responseToReportsOf(input);

  const profile = {
    role: input.role,
    region: input.region,
    availability: Object.freeze(availability),
    subjects: Object.freeze(subjects)
  };

  if (input.role === 'pupil' || input.parentConsent !== undefined) {
    profile.parentConsent = typeof input.parentConsent === 'boolean' ? input.parentConsent : false;
  }
  if (blockedUsers !== null) profile.blockedUsers = Object.freeze(blockedUsers.slice());
  if (reportEvents !== null) profile.reportEvent = Object.freeze(reportEvents.slice());
  if (responseToReports !== null) profile.responseToReport = Object.freeze(responseToReports.slice());
  if (input.aiLevel !== undefined) profile.aiLevel = input.aiLevel;
  profile.retention = profileRetention();

  return Object.freeze(profile);
}

function invalidRetention() {
  return new Error('invalid retention: expected the stamp makeProfile writes');
}

function assertStampShape(stamp) {
  if (stamp === null) throw invalidRetention();
  if (typeof stamp !== 'object') throw invalidRetention();
  if (Array.isArray(stamp)) throw invalidRetention();
}

function assertStampKeys(stamp) {
  const keys = Object.keys(stamp);
  for (let i = 0; i < keys.length; i += 1) {
    if (RETENTION_FIELDS.indexOf(keys[i]) === -1) throw new Error(PERSONAL_DATA_ERROR);
  }
}

function assertStampValues(stamp) {
  if (stamp.dataCategory !== 'profile') throw invalidRetention();
  if (!Number.isInteger(stamp.maxAgeDays)) throw invalidRetention();
  if (stamp.maxAgeDays < 0) throw invalidRetention();
}

function assertRetentionStamp(stamp) {
  assertStampShape(stamp);
  assertStampKeys(stamp);
  assertStampValues(stamp);
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
function withoutRetentionStamp(profile) {
  if (profile.retention !== undefined) assertRetentionStamp(profile.retention);
  const input = Object.assign({}, profile);
  delete input.retention;
  return input;
}

function assertProfileObject(profile) {
  if (profile === null) throw new Error('profile must be an object');
  if (typeof profile !== 'object') throw new Error('profile must be an object');
  if (Array.isArray(profile)) throw new Error('profile must be an object');
}

// Returns a new frozen profile with parentConsent set. The result goes through makeProfile again, so
// the privacy gate holds here too: a plain object with a name or a phone cannot be turned into a
// "profile" by asking for consent on it, and a stale or hand-built record is re-validated on the way.
// consent must be a real boolean (or omitted, meaning true): a form value 'false' or 'no' is truthy, and
// coercing it would record a parent's consent that was never given.
function setParentConsent(profile, consent) {
  assertProfileObject(profile);
  let consentValue;
  if (consent === undefined) consentValue = true;
  else {
    if (typeof consent !== 'boolean') throw new Error('invalid parentConsent: expected boolean');
    consentValue = consent;
  }
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

function appendProfileList(profile, field, makeItem) {
  assertProfileObject(profile);
  const item = makeItem();
  const base = withoutRetentionStamp(profile);
  const current = Array.isArray(profile[field]) ? profile[field].slice() : [];
  current.push(item);
  const patch = {};
  patch[field] = current;
  return makeProfile(Object.assign(base, patch));
}

function reportEvent(profile, input) {
  return appendProfileList(profile, 'reportEvent', () => validatorLib().makeReportEvent(input));
}

function responseToReport(profile, input) {
  return appendProfileList(profile, 'responseToReport', () => validatorLib().makeResponseToReport(input));
}

function roleOf(p) {
  if (p === null) return null;
  if (typeof p !== 'object') return null;
  if (Array.isArray(p)) return null;
  if (typeof p.role !== 'string') return null;
  const role = p.role.trim().toLowerCase();
  if (role === 'student') return role;
  if (role === 'pupil') return role;
  return null;
}

function countOf(map, key) {
  const n = map.get(key);
  if (n === undefined) return 0;
  return n;
}

function addAvailabilityCounts(dMap, sMap, p) {
  const role = roleOf(p);
  if (role === null) return;
  const avail = Array.isArray(p.availability) ? p.availability : [];
  const seenSlots = new Set();
  const target = role === 'pupil' ? dMap : sMap;
  for (let j = 0; j < avail.length; j += 1) {
    const norm = normalizeSlot(avail[j]);
    if (norm === null) continue;
    if (seenSlots.has(norm)) continue;
    seenSlots.add(norm);
    const previous = target.get(norm);
    target.set(norm, previous === undefined ? 1 : previous + 1);
  }
}

function slotKeyOf(day, hour) {
  return `${day}_${hour}`;
}

function heatmapSlot(day, hour, demand, supply) {
  const gap = demand - supply;
  return Object.freeze({
    slot: slotKeyOf(day, hour),
    day: day,
    hour: hour,
    demand: demand,
    supply: supply,
    gap: gap,
    shortage: Math.max(gap, 0),
    pupils: demand,
    students: supply
  });
}

function compareTopShortage(a, b) {
  if (b.gap !== a.gap) return b.gap - a.gap;
  if (b.demand !== a.demand) return b.demand - a.demand;
  const dayDiff = DAYS.indexOf(a.day) - DAYS.indexOf(b.day);
  if (dayDiff !== 0) return dayDiff;
  return a.hour - b.hour;
}

function addSlotsForDay(day, ctx) {
  for (let h = HOUR_MIN; h <= HOUR_MAX; h += 1) {
    const slotKey = slotKeyOf(day, h);
    const demand = countOf(ctx.dMap, slotKey);
    const supply = countOf(ctx.sMap, slotKey);
    const slotObj = heatmapSlot(day, h, demand, supply);
    ctx.slots.push(slotObj);
    ctx.slots[slotKey] = slotObj;
    if (demand > supply) ctx.topShortageSlots.push(slotObj);
  }
}

function addHeatmapSlots(ctx) {
  for (let di = 0; di < DAYS.length; di += 1) {
    addSlotsForDay(DAYS[di], ctx);
  }
}

function computeWeeklyAvailabilityHeatmap(people) {
  const dMap = new Map();
  const sMap = new Map();
  if (Array.isArray(people)) {
    for (let i = 0; i < people.length; i += 1) {
      addAvailabilityCounts(dMap, sMap, people[i]);
    }
  }

  const slots = [];
  const topShortageSlots = [];
  addHeatmapSlots({ dMap: dMap, sMap: sMap, slots: slots, topShortageSlots: topShortageSlots });
  topShortageSlots.sort(compareTopShortage);
  return Object.freeze({
    slots: Object.freeze(slots),
    topShortageSlots: Object.freeze(topShortageSlots)
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
