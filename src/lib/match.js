'use strict';
// PeerEd - deterministic matching. Same input -> same output. No clock, no randomness, no network.

const { getRetentionPolicy } = require('./retention.js');
const { isRegion } = require('./regions.js');
const { normalizeSlot, SUBJECTS } = require('./profile.js');

// Returns true if two string arrays share at least one common element.
function hasOverlap(a, b) {
  const right = new Set(Array.isArray(b) ? b : []);
  const left = Array.isArray(a) ? a : [];
  for (let i = 0; i < left.length; i += 1) {
    if (right.has(left[i])) {
      return true;
    }
  }
  return false;
}

// Sorted, de-duplicated intersection of two string arrays.
function shared(a, b) {
  const right = new Set(Array.isArray(b) ? b : []);
  const seen = new Set();
  const out = [];
  const left = Array.isArray(a) ? a : [];
  for (let i = 0; i < left.length; i += 1) {
    const v = left[i];
    if (right.has(v) && !seen.has(v)) {
      seen.add(v);
      out.push(v);
    }
  }
  return out.sort();
}

// A pupil is a minor: a text session with a student is contact, and contact needs the consent of a
// parent (PURPOSE.md, the regulation section). The profile records consent as one boolean and nothing
// else - no name, no date - and makeProfile sets it to false on every pupil that did not get it. The
// engine reads the flag here and nowhere else: a pupil without it is not in the pool, however well the
// region, the hours and the subjects fit, so no screen and no stored roster can pair a pupil whose
// parent has not said yes. Only an explicit true counts; a missing flag is treated as no.
function hasParentConsent(pupil) {
  if (pupil === null || typeof pupil !== 'object') return false;
  return pupil.parentConsent === true;
}

function compareCandidates(x, y) {
  return (y.sharedSlots.length - x.sharedSlots.length) ||
    (y.sharedSubjects.length - x.sharedSubjects.length) ||
    (x.studentIndex - y.studentIndex) ||
    (x.pupilIndex - y.pupilIndex);
}

function buildCandidate(s, p, si, pi) {
  if (!hasParentConsent(p) || p.region !== s.region) return null;
  if (!hasOverlap(s.availability, p.availability)) return null;
  const subjects = shared(s.subjects, p.subjects);
  if (subjects.length === 0) return null;
  const slots = shared(s.availability, p.availability);
  return {
    studentIndex: si,
    pupilIndex: pi,
    region: s.region,
    sharedSlots: slots,
    sharedSubjects: subjects
  };
}

function findCandidatesForStudent(s, si, P) {
  if (!s || typeof s.region !== 'string') return [];
  const list = [];
  for (let pi = 0; pi < P.length; pi += 1) {
    const candidate = buildCandidate(s, P[pi], si, pi);
    if (candidate) list.push(candidate);
  }
  return list;
}

// All valid (student, pupil) candidates, best first. A pupil without parent consent is in no candidate.
function candidatesOf(S, P) {
  const candidates = [];
  for (let si = 0; si < S.length; si += 1) {
    const studentCandidates = findCandidatesForStudent(S[si], si, P);
    for (let k = 0; k < studentCandidates.length; k += 1) {
      candidates.push(studentCandidates[k]);
    }
  }
  return candidates.sort(compareCandidates);
}

function groupCandidatesByStudent(candidates) {
  const byStudent = new Map();
  for (let i = 0; i < candidates.length; i += 1) {
    const c = candidates[i];
    let list = byStudent.get(c.studentIndex);
    if (!list) {
      list = [];
      byStudent.set(c.studentIndex, list);
    }
    list.push(c);
  }
  return byStudent;
}

function greedyAssign(candidates, ofStudent, ofPupil) {
  for (let i = 0; i < candidates.length; i += 1) {
    const c = candidates[i];
    if (ofStudent.has(c.studentIndex) || ofPupil.has(c.pupilIndex)) continue;
    ofStudent.set(c.studentIndex, c);
    ofPupil.set(c.pupilIndex, c);
  }
}

function searchAugmentingPath(si, seen, state) {
  const list = state.byStudent.get(si) || [];
  for (let i = 0; i < list.length; i += 1) {
    const c = list[i];
    if (seen.has(c.pupilIndex)) continue;
    seen.add(c.pupilIndex);
    const holder = state.ofPupil.get(c.pupilIndex);
    if (!holder || searchAugmentingPath(holder.studentIndex, seen, state)) {
      state.ofStudent.set(si, c);
      state.ofPupil.set(c.pupilIndex, c);
      return true;
    }
  }
  return false;
}

function runAugmentation(S, candidates, state) {
  const reachablePupils = new Set(candidates.map((c) => c.pupilIndex)).size;
  let seen = new Set();
  for (let si = 0; si < S.length && state.ofPupil.size < reachablePupils; si += 1) {
    if (state.ofStudent.has(si) || !state.byStudent.has(si)) continue;
    if (searchAugmentingPath(si, seen, state)) {
      seen = new Set();
    }
  }
}

// students / pupils: arrays of profiles ({ region, availability, subjects }, pupils also parentConsent).
// A pair needs a pupil with parent consent, the same region, >= 1 shared slot and >= 1 shared subject.
// Each participant is used at most once. The result has the LARGEST POSSIBLE number of pairs: candidates
// are sorted by shared slots desc, shared subjects desc, student index, pupil index and taken greedily;
// then, for every student still alone (in index order), an augmenting path is searched in that same
// candidate order (Kuhn's algorithm), which can only add a pair, never lose one. Pairs are returned in
// candidate order. No clock, no randomness.
function matchPairs(students, pupils) {
  const S = Array.isArray(students) ? students : [];
  const P = Array.isArray(pupils) ? pupils : [];
  const candidates = candidatesOf(S, P);
  const byStudent = groupCandidatesByStudent(candidates);
  const ofStudent = new Map();
  const ofPupil = new Map();
  greedyAssign(candidates, ofStudent, ofPupil);
  runAugmentation(S, candidates, { byStudent, ofStudent, ofPupil });
  return Array.from(ofStudent.values()).sort(compareCandidates);
}

const PAIR_ERROR = 'match pair must be an object from matchPairs()';
const ISO_DATE = /^(\d{4}-\d{2}-\d{2})(?:T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:\d{2}))?$/;

function parseDateString(value, bad) {
  if (typeof value !== 'string') throw bad;
  const m = ISO_DATE.exec(value);
  if (m === null) throw bad;
  const written = new Date(m[1] + 'T00:00:00Z');
  if (Number.isNaN(written.getTime()) || written.toISOString().slice(0, 10) !== m[1]) throw bad;
  return new Date(value);
}

function utcDay(value) {
  const bad = new Error('invalid recordedAt: expected a Date or an ISO date string');
  const d = (value instanceof Date) ? value : parseDateString(value, bad);
  if (Number.isNaN(d.getTime())) throw bad;
  const year = d.getUTCFullYear();
  if (year < 0 || year > 9999) throw bad;
  return d.toISOString().slice(0, 10);
}

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

function isPlainObject(val) {
  return val !== null && typeof val === 'object' && !Array.isArray(val);
}

function isValidIndex(idx) {
  return Number.isInteger(idx) && idx >= 0;
}

function resolveCrossRegions(pair) {
  if (!isRegion(pair.studentRegion)) throw new Error(PAIR_ERROR);
  if (!isRegion(pair.pupilRegion)) throw new Error(PAIR_ERROR);
  return { studentRegion: pair.studentRegion, pupilRegion: pair.pupilRegion };
}

function resolvePairRegions(pair) {
  if (typeof pair.region === 'string') {
    if (!isRegion(pair.region)) throw new Error(PAIR_ERROR);
    return { region: pair.region };
  }
  return resolveCrossRegions(pair);
}

function assertValidCodes(pair) {
  if (!isCodeList(pair.sharedSlots, isCanonicalSlot)) throw new Error(PAIR_ERROR);
  if (!isCodeList(pair.sharedSubjects, isSubject)) throw new Error(PAIR_ERROR);
}

function assertValidIndexes(pair) {
  if (!isValidIndex(pair.studentIndex)) throw new Error(PAIR_ERROR);
  if (!isValidIndex(pair.pupilIndex)) throw new Error(PAIR_ERROR);
}

function assertValidRecordedAt(recordedAt) {
  if (recordedAt === undefined || recordedAt === null) {
    throw new Error('invalid recordedAt: expected a Date or an ISO date string');
  }
}

function assertValidPairRecord(pair, recordedAt) {
  if (!isPlainObject(pair)) throw new Error(PAIR_ERROR);
  assertValidIndexes(pair);
  assertValidCodes(pair);
  assertValidRecordedAt(recordedAt);
}

function makeMatchRecord(pair, recordedAt) {
  assertValidPairRecord(pair, recordedAt);
  const where = resolvePairRegions(pair);
  return Object.freeze(Object.assign({
    studentIndex: pair.studentIndex,
    pupilIndex: pair.pupilIndex
  }, where, {
    sharedSlots: Object.freeze(pair.sharedSlots.slice()),
    sharedSubjects: Object.freeze(pair.sharedSubjects.slice()),
    recordedAt: utcDay(recordedAt),
    retention: Object.freeze({ dataCategory: 'match', maxAgeDays: getRetentionPolicy().match })
  }));
}

function collectUsedIndexes(pairs) {
  const usedS = new Set();
  const usedP = new Set();
  const list = Array.isArray(pairs) ? pairs : [];
  for (let i = 0; i < list.length; i += 1) {
    usedS.add(list[i].studentIndex);
    usedP.add(list[i].pupilIndex);
  }
  return { usedS, usedP };
}

function findFreeProfiles(list, used) {
  const free = [];
  for (let i = 0; i < list.length; i += 1) {
    const item = list[i];
    const hasRegion = item && typeof item.region === 'string';
    if (hasRegion && !used.has(i)) {
      free.push(i);
    }
  }
  return free;
}

function toAnywhereProfile(x) {
  return { region: 'ANY', availability: x.availability, subjects: x.subjects, parentConsent: x.parentConsent };
}

function matchAcrossRegions(students, pupils, pairs) {
  const S = Array.isArray(students) ? students : [];
  const P = Array.isArray(pupils) ? pupils : [];
  const { usedS, usedP } = collectUsedIndexes(pairs);
  const freeS = findFreeProfiles(S, usedS);
  const freeP = findFreeProfiles(P, usedP);
  const poolS = freeS.map((i) => toAnywhereProfile(S[i]));
  const poolP = freeP.map((i) => toAnywhereProfile(P[i]));

  return matchPairs(poolS, poolP).map((c) => ({
    studentIndex: freeS[c.studentIndex],
    pupilIndex: freeP[c.pupilIndex],
    studentRegion: S[freeS[c.studentIndex]].region,
    pupilRegion: P[freeP[c.pupilIndex]].region,
    sharedSlots: c.sharedSlots,
    sharedSubjects: c.sharedSubjects
  }));
}

function checkOverlapReasons(me, local) {
  const hour = local.filter((o) => shared(me.availability, o.availability).length > 0);
  const subject = local.filter((o) => shared(me.subjects, o.subjects).length > 0);
  if (hour.length === 0) return 'NO_SHARED_HOUR';
  if (subject.length === 0) return 'NO_SHARED_SUBJECT';
  const both = hour.filter((o) => subject.indexOf(o) !== -1);
  return both.length === 0 ? 'NO_HOUR_AND_SUBJECT_TOGETHER' : 'PARTNERS_TAKEN';
}

function diagnoseUnmatchedReason(me, others, isPupil) {
  if (isPupil && !hasParentConsent(me)) return 'NO_PARENT_CONSENT';
  const inRegion = others.filter((o) => o && o.region === me.region);
  if (inRegion.length === 0) return 'NO_ONE_IN_REGION';
  const local = isPupil ? inRegion : inRegion.filter(hasParentConsent);
  if (local.length === 0) return 'NO_PARENT_CONSENT';
  return checkOverlapReasons(me, local);
}

function mapUnmatched(list, used, others, isPupil) {
  const out = [];
  for (let i = 0; i < list.length; i += 1) {
    const item = list[i];
    if (item && !used.has(i)) {
      out.push({ index: i, reason: diagnoseUnmatchedReason(item, others, isPupil) });
    }
  }
  return out;
}

function explainUnmatched(students, pupils, pairs) {
  const S = Array.isArray(students) ? students : [];
  const P = Array.isArray(pupils) ? pupils : [];
  const { usedS, usedP } = collectUsedIndexes(pairs);
  return {
    students: mapUnmatched(S, usedS, P, false),
    pupils: mapUnmatched(P, usedP, S, true)
  };
}

function studentMatchesPupil(s, me) {
  if (!s || s.region !== me.region) return false;
  if (!hasOverlap(s.availability, me.availability)) return false;
  return hasOverlap(s.subjects, me.subjects);
}

function hasMatchingStudent(me, students) {
  for (let i = 0; i < students.length; i += 1) {
    if (studentMatchesPupil(students[i], me)) return true;
  }
  return false;
}

function computeConsentStats(shortPupils, students) {
  let noConsent = 0;
  let noConsentNoStudent = 0;
  for (let i = 0; i < shortPupils.length; i += 1) {
    const x = shortPupils[i];
    if (!x || x.reason !== 'NO_PARENT_CONSENT') continue;
    noConsent += 1;
    const me = x.e && x.e.person;
    if (!me || !hasMatchingStudent(me, students)) {
      noConsentNoStudent += 1;
    }
  }
  return {
    noConsent,
    noConsentNoStudent,
    noConsentFits: noConsent - noConsentNoStudent
  };
}

function recordMissingPupilSubjects(p, missingCounts) {
  const reg = p.region || 'UNKNOWN';
  const subs = Array.isArray(p.subjects) ? p.subjects : [];
  for (let j = 0; j < subs.length; j += 1) {
    const code = reg + '_' + subs[j];
    missingCounts[code] = (missingCounts[code] || 0) + 1;
  }
}

function computeMissingRegionSubjects(shortPupils) {
  const missingCounts = {};
  for (let i = 0; i < shortPupils.length; i += 1) {
    const x = shortPupils[i];
    if (!x || x.reason === 'NO_PARENT_CONSENT') continue;
    const p = x.e && x.e.person;
    if (p) recordMissingPupilSubjects(p, missingCounts);
  }
  return missingCounts;
}

function getArrayLength(obj, prop) {
  return (obj && Array.isArray(obj[prop])) ? obj[prop].length : 0;
}

function summarizeMatch(m, people) {
  const S = (Array.isArray(people) ? people : []).filter((p) => p && p.role === 'student');
  const left = (m && Array.isArray(m.left)) ? m.left : [];
  const shortPupils = left.filter((x) => x && x.role === 'pupil');
  const shortStudents = left.length - shortPupils.length;
  const consent = computeConsentStats(shortPupils, S);
  const missingCounts = computeMissingRegionSubjects(shortPupils);

  return {
    pairs: getArrayLength(m, 'pairs'),
    pupilsWithoutStudent: shortPupils.length - consent.noConsent,
    studentsWithoutPupil: shortStudents,
    crossRegionPairs: getArrayLength(m, 'across'),
    waitingConsentFits: consent.noConsentFits,
    waitingConsentNoStudent: consent.noConsentNoStudent,
    missingByRegionSubject: missingCounts
  };
}

const MATCH_REPORT_HEADER = 'measure,code,count';

function matchSummaryCsv(m, people) {
  const s = summarizeMatch(m, people);
  const lines = [
    MATCH_REPORT_HEADER,
    'pairs,,' + s.pairs,
    'pupils_without_student,,' + s.pupilsWithoutStudent,
    'students_without_pupil,,' + s.studentsWithoutPupil,
    'cross_region_pairs,,' + s.crossRegionPairs,
    'waiting_parent_consent_fits,,' + s.waitingConsentFits,
    'waiting_parent_consent_no_student,,' + s.waitingConsentNoStudent
  ];
  const missingCodes = Object.keys(s.missingByRegionSubject).sort();
  for (let i = 0; i < missingCodes.length; i += 1) {
    lines.push('missing_student,' + missingCodes[i] + ',' + s.missingByRegionSubject[missingCodes[i]]);
  }
  return lines.join('\n') + '\n';
}

const DAY_LABELS = Object.freeze({
  he: Object.freeze({ SUN: 'יום ראשון', MON: 'יום שני', TUE: 'יום שלישי', WED: 'יום רביעי', THU: 'יום חמישי', FRI: 'יום שישי', SAT: 'יום שבת' }),
  ar: Object.freeze({ SUN: 'الأحد', MON: 'الاثنين', TUE: 'الثلاثاء', WED: 'الأربعاء', THU: 'الخميس', FRI: 'الجمعة', SAT: 'السبت' }),
  ru: Object.freeze({ SUN: 'Воскресенье', MON: 'Понедельник', TUE: 'Вторник', WED: 'Среда', THU: 'Четверг', FRI: 'Пятница', SAT: 'Суббота' })
});

const GAP_REASON_LABELS = Object.freeze({
  missing_one_slot: Object.freeze({
    he: 'פער של שעה אחת בלוח הזמנים',
    ar: 'فارق ساعة واحدة في الجدول الزمني',
    ru: 'Разница в один час в расписании'
  }),
  adjacent_level: Object.freeze({
    he: 'התאמת רמה קרובה (רמה סמוכה)',
    ar: 'مستوى دراسي متقارب (مستوى مجاور)',
    ru: 'Близкий уровень обучения (соседний уровень)'
  }),
  partial_ai_topic: Object.freeze({
    he: 'חפיפה חלקית בנושאי בינה מלאכותית',
    ar: 'تطابق جزئي في موضوعات الذكاء الاصطناعي',
    ru: 'Частичное совпадение тем ИИ'
  })
});

const AI_TOPIC_RE = /^[A-Z0-9_]+$/;

function parseSingleSlot(rawItem, seen) {
  const s = normalizeSlot(rawItem);
  if (s === null || seen.has(s)) return null;
  seen.add(s);
  const m = /^([A-Z]{3})_(\d{1,2})$/.exec(s);
  if (!m) return null;
  return { day: m[1], hour: Number(m[2]), slot: s };
}

function extractValidSlots(p) {
  if (!p) return [];
  const raw = Array.isArray(p) ? p : (Array.isArray(p.availability) ? p.availability : []);
  const seen = new Set();
  const out = [];
  for (let i = 0; i < raw.length; i += 1) {
    const parsed = parseSingleSlot(raw[i], seen);
    if (parsed) out.push(parsed);
  }
  return out;
}

function extractRawTopicList(x) {
  if (Array.isArray(x)) return x;
  if (!x || typeof x !== 'object') return [];
  if (Array.isArray(x.target_ai_topics)) return x.target_ai_topics;
  if (Array.isArray(x.aiTopics)) return x.aiTopics;
  if (Array.isArray(x.topics)) return x.topics;
  return [];
}

function getCleanTopics(x) {
  const raw = extractRawTopicList(x);
  return raw.filter((v) => typeof v === 'string' && AI_TOPIC_RE.test(v));
}

function getLevel(x) {
  const n = x && x.level;
  return Number.isInteger(n) && n >= 1 && n <= 5 ? n : null;
}

function isCloserShift(diff, aSlot, best) {
  if (best === null) return true;
  if (diff < best.shiftHours) return true;
  return diff === best.shiftHours && aSlot < best.slotA;
}

function createShiftCandidate(a, b, diff) {
  return {
    shiftHours: diff,
    day: a.day,
    slotA: a.slot,
    slotB: b.slot,
    fromSlot: a.slot,
    toSlot: b.slot,
    targetSlot: b.slot,
    suggestedSlot: b.slot,
    hourA: a.hour,
    hourB: b.hour
  };
}

function updateBestShiftForSlot(a, slotsB, currentBest) {
  let best = currentBest;
  for (let j = 0; j < slotsB.length; j += 1) {
    const b = slotsB[j];
    if (a.day !== b.day) continue;
    const diff = Math.abs(a.hour - b.hour);
    if (isCloserShift(diff, a.slot, best)) {
      best = createShiftCandidate(a, b, diff);
    }
  }
  return best;
}

function findBestShift(slotsA, slotsB) {
  let best = null;
  for (let i = 0; i < slotsA.length; i += 1) {
    best = updateBestShiftForSlot(slotsA[i], slotsB, best);
  }
  return best;
}

function getDayName(lang, day) {
  const dict = DAY_LABELS[lang];
  return (dict && dict[day]) || day;
}

function getShiftTexts(hours, dayName, targetSlot, slotA) {
  if (hours === 0) {
    return {
      he: `יש חפיפת שעות ב-${dayName.he} (${slotA})`,
      ar: `يوجد تداخل ساعات في ${dayName.ar} (${slotA})`,
      ru: `Есть совпадение часов в ${dayName.ru} (${slotA})`
    };
  }
  if (hours === 1) {
    return {
      he: `הזזה מומלצת: שעה אחת ב-${dayName.he} לקראת חפיפה ב-${targetSlot}`,
      ar: `الإזاحة المقترحة: ساعة واحدة في ${dayName.ar} نحو التوافق في ${targetSlot}`,
      ru: `Рекомендуемый сдвиг: 1 час в ${dayName.ru} для совпадения в ${targetSlot}`
    };
  }
  return {
    he: `הזזה מומלצת: ${hours} שעות ב-${dayName.he} לקראת חפיפה ב-${targetSlot}`,
    ar: `الإזاحة المقترحة: ${hours} ساعات في ${dayName.ar} نحو التوافق في ${targetSlot}`,
    ru: `Рекомендуемый сдвиг: ${hours} ч. в ${dayName.ru} для совпадения в ${targetSlot}`
  };
}

function formatShiftExplanation(best) {
  const d = best.day;
  const dayName = {
    he: getDayName('he', d),
    ar: getDayName('ar', d),
    ru: getDayName('ru', d)
  };
  const texts = getShiftTexts(best.shiftHours, dayName, best.targetSlot, best.slotA);
  return Object.freeze(texts);
}

// suggestScheduleShift(personA, personB):
// Calculates the closest hour shift on schedule that enables overlap, with zero PII.
function suggestScheduleShift(personA, personB) {
  const slotsA = extractValidSlots(personA);
  const slotsB = extractValidSlots(personB);
  if (slotsA.length === 0 || slotsB.length === 0) {
    return null;
  }
  const best = findBestShift(slotsA, slotsB);
  if (!best) {
    return null;
  }
  return Object.freeze(Object.assign({}, best, {
    explanation: formatShiftExplanation(best)
  }));
}

function checkMissingOneSlot(sharedSl, shift) {
  return sharedSl.length === 0 && Boolean(shift && shift.shiftHours === 1);
}

function checkAdjacentLevel(pLevel, cLevel, personAiLevel, cAiLevel) {
  if (pLevel !== null && cLevel !== null) {
    return Math.abs(pLevel - cLevel) === 1;
  }
  if (pLevel === null && cLevel === null) {
    return Boolean(personAiLevel && cAiLevel && personAiLevel !== cAiLevel);
  }
  return false;
}

function checkPartialAiTopic(pTopics, cTopics, sharedTop) {
  if (pTopics.length === 0) return false;
  if (cTopics.length === 0) return false;
  const sCount = sharedTop.length;
  if (sCount === 0) return false;
  return sCount < pTopics.length || sCount < cTopics.length;
}

function extractCleanPersonSubjects(p) {
  const subs = Array.isArray(p.subjects) ? p.subjects : [];
  return subs.filter((s) => SUBJECTS.indexOf(s) !== -1);
}

function buildCandidateSummary(cIdx, c, details) {
  return Object.freeze({
    index: cIdx,
    candidateIndex: cIdx,
    role: c.role || null,
    region: c.region || null,
    subjects: Object.freeze(details.cSubjects.slice()),
    availability: Object.freeze(details.cSlots.slice()),
    level: details.cLevel,
    aiLevel: c.aiLevel || null,
    target_ai_topics: Object.freeze(details.cTopics.slice())
  });
}

function getReasonExplanations(primaryReason) {
  const labelObj = GAP_REASON_LABELS[primaryReason];
  return {
    he: (labelObj && labelObj.he) || primaryReason,
    ar: (labelObj && labelObj.ar) || primaryReason,
    ru: (labelObj && labelObj.ru) || primaryReason
  };
}

function buildNearMissRecord(cIdx, c, details) {
  const primaryReason = details.reasons[0];
  const candidateSummary = buildCandidateSummary(cIdx, c, details);

  return Object.freeze({
    index: cIdx,
    candidateIndex: cIdx,
    candidate: candidateSummary,
    role: c.role || null,
    region: c.region || null,
    subjects: candidateSummary.subjects,
    availability: candidateSummary.availability,
    level: details.cLevel,
    aiLevel: c.aiLevel || null,
    target_ai_topics: candidateSummary.target_ai_topics,
    reason: primaryReason,
    gapReason: primaryReason,
    reasons: Object.freeze(details.reasons.slice()),
    sharedSubjects: Object.freeze(details.sharedSubs),
    sharedSlots: Object.freeze(details.sharedSl),
    sharedAiTopics: Object.freeze(details.sharedTop),
    shift: details.shift,
    suggestedShift: details.shift,
    explanation: Object.freeze(getReasonExplanations(primaryReason))
  });
}

function isCandidateRoleBlocked(personRole, cRole, allowSameRole) {
  if (allowSameRole) return false;
  if (!personRole || !cRole) return false;
  return personRole === cRole;
}

function isCandidateRegionBlocked(personRegion, cRegion, requireSameRegion) {
  if (!requireSameRegion) return false;
  if (!personRegion || !cRegion) return false;
  return personRegion !== cRegion;
}

function collectCandidateDetails(c) {
  return {
    cSubjects: extractCleanPersonSubjects(c),
    cSlots: extractValidSlots(c).map((s) => s.slot),
    cTopics: getCleanTopics(c),
    cLevel: getLevel(c),
    aiLevel: c.aiLevel || null
  };
}

function collectGapReasons(pData, cDetails, sharedTop, shift) {
  const reasons = [];
  if (checkMissingOneSlot(cDetails.sharedSl, shift)) {
    reasons.push('missing_one_slot');
  }
  if (checkAdjacentLevel(pData.level, cDetails.cLevel, pData.aiLevel, cDetails.aiLevel)) {
    reasons.push('adjacent_level');
  }
  if (checkPartialAiTopic(pData.topics, cDetails.cTopics, sharedTop)) {
    reasons.push('partial_ai_topic');
  }
  return reasons;
}

function isCandidateBlocked(person, c, opts) {
  if (isCandidateRoleBlocked(person.role, c.role, opts.allowSameRole)) return true;
  if (c.role === 'pupil' && !hasParentConsent(c)) return true;
  return isCandidateRegionBlocked(person.region, c.region, opts.requireSameRegion);
}

function evaluateCandidateMatch(person, pData, candidateContext, opts) {
  const { c, cIdx } = candidateContext;
  if (isCandidateBlocked(person, c, opts)) return null;

  const cDetails = collectCandidateDetails(c);
  const sharedSubs = shared(pData.subjects, cDetails.cSubjects);
  const sharedSl = shared(pData.slots, cDetails.cSlots);
  const sharedTop = shared(pData.topics, cDetails.cTopics);

  if (sharedSubs.length === 0 && sharedTop.length === 0) return null;

  const shift = suggestScheduleShift(person, c);
  cDetails.sharedSl = sharedSl;
  const reasons = collectGapReasons(pData, cDetails, sharedTop, shift);

  if (reasons.length === 0) return null;
  if (opts.reason && !reasons.includes(opts.reason)) return null;

  cDetails.reasons = reasons;
  cDetails.sharedSubs = sharedSubs;
  cDetails.sharedTop = sharedTop;
  cDetails.shift = shift;
  return buildNearMissRecord(cIdx, c, cDetails);
}

function compareNearMissCandidates(x, y) {
  const shiftX = (x.suggestedShift && x.suggestedShift.shiftHours !== null) ? x.suggestedShift.shiftHours : 999;
  const shiftY = (y.suggestedShift && y.suggestedShift.shiftHours !== null) ? y.suggestedShift.shiftHours : 999;
  return (shiftX - shiftY) ||
    (y.sharedSubjects.length - x.sharedSubjects.length) ||
    (y.sharedAiTopics.length - x.sharedAiTopics.length) ||
    (x.candidateIndex - y.candidateIndex);
}

function isValidCandidateSearch(person, candidates) {
  if (!isPlainObject(person)) return false;
  if (!Array.isArray(candidates) || candidates.length === 0) return false;
  if (person.role === 'pupil' && !hasParentConsent(person)) return false;
  return true;
}

function collectNearMissResults(person, pData, candidates, opts) {
  const results = [];
  for (let idx = 0; idx < candidates.length; idx += 1) {
    const raw = candidates[idx];
    if (!raw || typeof raw !== 'object') continue;
    const c = raw.person || raw;
    const cIdx = Number.isInteger(raw.index) ? raw.index : idx;
    const item = evaluateCandidateMatch(person, pData, { c, cIdx }, opts);
    if (item) results.push(item);
  }
  return results;
}

// findNearMissCandidates(person, candidates, options):
// Finds near-miss backup candidates with explicit gap reasons ('missing_one_slot', 'adjacent_level', 'partial_ai_topic').
function findNearMissCandidates(person, candidates, options) {
  if (!isValidCandidateSearch(person, candidates)) {
    return [];
  }
  const opts = options || {};
  const pData = {
    subjects: extractCleanPersonSubjects(person),
    slots: extractValidSlots(person).map((s) => s.slot),
    topics: getCleanTopics(person),
    level: getLevel(person),
    aiLevel: person.aiLevel || null
  };

  const results = collectNearMissResults(person, pData, candidates, opts);
  results.sort(compareNearMissCandidates);
  if (Number.isInteger(opts.limit) && opts.limit > 0) {
    return results.slice(0, opts.limit);
  }
  return results;
}

module.exports = {
  matchPairs,
  explainUnmatched,
  matchAcrossRegions,
  shared,
  hasOverlap,
  hasParentConsent,
  makeMatchRecord,
  summarizeMatch,
  matchSummaryCsv,
  MATCH_REPORT_HEADER,
  findNearMissCandidates,
  suggestScheduleShift
};
