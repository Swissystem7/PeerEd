
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
  return pupil !== null && typeof pupil === 'object' && pupil.parentConsent === true;
}

function compareCandidates(x, y) {
  return (y.sharedSlots.length - x.sharedSlots.length) ||
    (y.sharedSubjects.length - x.sharedSubjects.length) ||
    (x.studentIndex - y.studentIndex) ||
    (x.pupilIndex - y.pupilIndex);
}

// One (student, pupil) candidate, or null when the pair is not eligible: a pupil without parent consent,
// another region, no shared hour, or no shared subject.
function candidateFor(si, s, pi, p) {
  if (!hasParentConsent(p)) return null;
  if (p.region !== s.region) return null;
  if (!hasOverlap(s.availability, p.availability)) return null;
  const subjects = shared(s.subjects, p.subjects);
  if (subjects.length === 0) return null;
  return {
    studentIndex: si,
    pupilIndex: pi,
    region: s.region,
    sharedSlots: shared(s.availability, p.availability),
    sharedSubjects: subjects
  };
}

function addCandidatesForStudent(candidates, si, s, P) {
  for (let pi = 0; pi < P.length; pi += 1) {
    const candidate = candidateFor(si, s, pi, P[pi]);
    if (candidate !== null) candidates.push(candidate);
  }
}

// All valid (student, pupil) candidates, best first. A pupil without parent consent is in no candidate.
function candidatesOf(S, P) {
  const candidates = [];
  for (let si = 0; si < S.length; si += 1) {
    const s = S[si];
    if (!s || typeof s.region !== 'string') continue;
    addCandidatesForStudent(candidates, si, s, P);
  }
  return candidates.sort(compareCandidates);
}

// students / pupils: arrays of profiles ({ region, availability, subjects }, pupils also parentConsent).
// A pair needs a pupil with parent consent, the same region, >= 1 shared slot and >= 1 shared subject.
// Each participant is used at most once. The result has the LARGEST POSSIBLE number of pairs: candidates
// are sorted by shared slots desc, shared subjects desc, student index, pupil index and taken greedily;
// then, for every student still alone (in index order), an augmenting path is searched in that same
// candidate order (Kuhn's algorithm), which can only add a pair, never lose one. Pairs are returned in
// candidate order. No clock, no randomness.
// Candidates grouped by the student that could take each: a Map studentIndex -> candidate list in the
// same (best-first) order the candidates were returned.
function groupCandidatesByStudent(candidates) {
  const byStudent = new Map();
  for (let i = 0; i < candidates.length; i += 1) {
    const c = candidates[i];
    if (!byStudent.has(c.studentIndex)) byStudent.set(c.studentIndex, []);
    byStudent.get(c.studentIndex).push(c);
  }
  return byStudent;
}

// First pass: take each candidate in order while both its student and its pupil are still free. One map
// per direction records who took whom; a candidate already claimed on either side is skipped.
function greedyAssign(candidates) {
  const ofStudent = new Map();   // studentIndex -> candidate
  const ofPupil = new Map();     // pupilIndex -> candidate
  for (let i = 0; i < candidates.length; i += 1) {
    const c = candidates[i];
    if (ofStudent.has(c.studentIndex) || ofPupil.has(c.pupilIndex)) continue;
    ofStudent.set(c.studentIndex, c);
    ofPupil.set(c.pupilIndex, c);
  }
  return { ofStudent: ofStudent, ofPupil: ofPupil };
}

// Kuhn's augmenting path: try to give student `si` a pupil, displacing the student that currently holds
// one when that student can itself find another. `seen` guards against revisiting a pupil in one search.
function augmentMatching(si, seen, matching) {
  const list = matching.byStudent.get(si) || [];
  for (let i = 0; i < list.length; i += 1) {
    const c = list[i];
    if (seen.has(c.pupilIndex)) continue;
    seen.add(c.pupilIndex);
    const holder = matching.ofPupil.get(c.pupilIndex);
    if (!holder || augmentMatching(holder.studentIndex, seen, matching)) {
      matching.ofStudent.set(si, c);
      matching.ofPupil.set(c.pupilIndex, c);
      return true;
    }
  }
  return false;
}

function matchPairs(students, pupils) {
  const S = Array.isArray(students) ? students : [];
  const P = Array.isArray(pupils) ? pupils : [];
  const candidates = candidatesOf(S, P);
  const greedy = greedyAssign(candidates);
  const matching = {
    byStudent: groupCandidatesByStudent(candidates),
    ofStudent: greedy.ofStudent,
    ofPupil: greedy.ofPupil
  };
  const ofStudent = matching.ofStudent;
  const ofPupil = matching.ofPupil;
  // A failed search leaves every pupil it visited unable to reach a free pupil until some search
  // succeeds, so the visited set is kept across failures and cleared only after a success.
  const reachablePupils = new Set(candidates.map((c) => c.pupilIndex)).size;
  let seen = new Set();
  for (let si = 0; si < S.length && ofPupil.size < reachablePupils; si += 1) {
    if (ofStudent.has(si) || !matching.byStudent.has(si)) continue;
    if (augmentMatching(si, seen, matching)) seen = new Set();
  }
  return Array.from(ofStudent.values()).sort(compareCandidates);
}

const PAIR_ERROR = 'match pair must be an object from matchPairs()';

// The UTC calendar day of a timestamp, as YYYY-MM-DD. Retention is counted in days, so the day is
// everything a stored row needs - and the hour at which a particular minor was matched says more about
// the person than the policy ever asks.
// A string must be an ISO day, or an ISO timestamp that says its own offset: the engine's legacy parser
// reads '3/4/2026' on the machine's clock, '12' as the year 2001 and rolls '2026-02-30' into March, and
// the row would then be stored - and later swept - under a day nobody wrote down.
const ISO_DATE = /^(\d{4}-\d{2}-\d{2})(?:T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:\d{2}))?$/;

function invalidRecordedAt() {
  return new Error('invalid recordedAt: expected a Date or an ISO date string');
}

function parseIsoDay(value) {
  const m = typeof value === 'string' ? ISO_DATE.exec(value) : null;
  if (m === null) throw invalidRecordedAt();
  const written = new Date(`${m[1]}T00:00:00Z`);
  if (Number.isNaN(written.getTime()) || written.toISOString().slice(0, 10) !== m[1]) throw invalidRecordedAt();
  return new Date(value);
}

// Only a year the sweep can read back. Past 9999 toISOString writes '+010000-01-01...' and the row
// would keep '+010000-01'; before the year 0 it writes '-000001-...' and the row would keep '-000001-1'.
// Either way the cycle manager refuses the stored row, and with it the whole sweep. The years 0-99 the
// sweep reads in their own century, so they are stored like any other day.
function assertStorableYear(d) {
  const year = d.getUTCFullYear();
  if (year < 0 || year > 9999) throw invalidRecordedAt();
}

function utcDay(value) {
  const d = value instanceof Date ? value : parseIsoDay(value);
  if (Number.isNaN(d.getTime())) throw invalidRecordedAt();
  assertStorableYear(d);
  return d.toISOString().slice(0, 10);
}

// A non-empty list in which every item is a code: what shared() leaves on a pair, since candidatesOf
// drops a pair with no shared hour or no shared subject before it is ever returned.
function isCodeList(list, isCode) {
  if (!Array.isArray(list) || list.length === 0) return false;
  for (let i = 0; i < list.length; i += 1) {
    if (!isCode(list[i])) return false;
  }
  return true;
}

// The pair's slots come from makeProfile, so they are already in the one spelling it writes ('SUN_8',
// never 'SUN_08'); a slot in any other spelling is not one of them.
function isCanonicalSlot(slot) {
  return normalizeSlot(slot) === slot;
}

function isSubject(code) {
  return typeof code === 'string' && SUBJECTS.indexOf(code) !== -1;
}

// A pair on its way into storage: a matchPairs() candidate plus the day it was kept and the retention
// category a cycle sweep reads. Frozen and JSON-serializable, and with no clock of its own - the caller
// passes recordedAt, so the same arguments always produce the same row. Still a module: nothing on
// screen stores a match yet.
// A candidate holds nothing but codes: a region from REGIONS (one for a local pair, two for a
// matchAcrossRegions() pair), slots from makeProfile and subjects from SUBJECTS, at least one of each.
// Those are checked here, not taken on trust. Until this check only the indexes and the day were read
// and the three lists were copied as handed in, so a hand-built "pair" with a name or a phone in
// sharedSlots became a stored row - the one row the privacy gate never looked at - and the sweep later
// kept or dropped it on the policy's terms like any other. A pair with anything else in it is not a
// pair from matchPairs() and is refused as one, with the same message as a missing index.
// The regions a pair names: a local pair has one region, a matchAcrossRegions() pair has two. Returns
// null when neither holds - a missing region, or a region that is not one of REGIONS (the cross-region
// placeholder 'ANY' is not one either). The caller turns null into the same refusal a bad index gets.
function pairRegions(pair) {
  if (typeof pair.region === 'string') {
    return isRegion(pair.region) ? { region: pair.region } : null;
  }
  if (isRegion(pair.studentRegion) && isRegion(pair.pupilRegion)) {
    return { studentRegion: pair.studentRegion, pupilRegion: pair.pupilRegion };
  }
  return null;
}

// an index is a position in the students / pupils arrays: -1 would be a stored row that points at nobody
function assertPairIndex(value) {
  if (!Number.isInteger(value) || value < 0) throw new Error(PAIR_ERROR);
}

function assertPairCodes(pair) {
  if (!isCodeList(pair.sharedSlots, isCanonicalSlot) || !isCodeList(pair.sharedSubjects, isSubject)) {
    throw new Error(PAIR_ERROR);
  }
}

function isPlainObject(value) {
  if (value === null || typeof value !== 'object') return false;
  return !Array.isArray(value);
}

function assertRecordPair(pair) {
  if (!isPlainObject(pair)) throw new Error(PAIR_ERROR);
  assertPairIndex(pair.studentIndex);
  assertPairIndex(pair.pupilIndex);
  assertPairCodes(pair);
  // a local pair names one region, a matchAcrossRegions() pair names both; a row with neither would be
  // stored with no region at all (JSON drops an undefined key). 'ANY', the placeholder the cross-region
  // pass matches under, is not a region either: a pair that still carries it never left that pass.
  const where = pairRegions(pair);
  if (where === null) throw new Error(PAIR_ERROR);
  return where;
}

function makeMatchRecord(pair, recordedAt) {
  const where = assertRecordPair(pair);
  if (recordedAt === undefined || recordedAt === null) {
    throw new Error('invalid recordedAt: expected a Date or an ISO date string');
  }
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

// A second, opt-in pass for an emergency: sessions are text only, so a pupil whose own region has no
// free student (an evacuated town, a region whose students left) can still learn with a student from
// another region. Only the people `pairs` left out take part; the region rule is the only one dropped
// (a shared hour and a shared subject are still required), and the same largest-matching engine runs on
// them, so the parent-consent gate holds here too. The local pairs are never touched, so this can only
// add pairs. Each result names both regions;
// indexes are positions in the original students / pupils arrays. Same input -> same output.
function isFreeRegionProfile(x, used, index) {
  if (!x || typeof x.region !== 'string') return false;
  return !used.has(index);
}

function freeRegionIndexes(list, used) {
  const free = [];
  for (let i = 0; i < list.length; i += 1) {
    if (isFreeRegionProfile(list[i], used, i)) free.push(i);
  }
  return free;
}

function anyRegionProfile(x) {
  return { region: 'ANY', availability: x.availability, subjects: x.subjects, parentConsent: x.parentConsent };
}

function crossRegionPair(c, free, people) {
  const studentIndex = free.students[c.studentIndex];
  const pupilIndex = free.pupils[c.pupilIndex];
  return {
    studentIndex: studentIndex,
    pupilIndex: pupilIndex,
    studentRegion: people.S[studentIndex].region,
    pupilRegion: people.P[pupilIndex].region,
    sharedSlots: c.sharedSlots,
    sharedSubjects: c.sharedSubjects
  };
}

function matchAcrossRegions(students, pupils, pairs) {
  const S = Array.isArray(students) ? students : [];
  const P = Array.isArray(pupils) ? pupils : [];
  const used = usedIndexes(pairs);
  const free = { students: freeRegionIndexes(S, used.students), pupils: freeRegionIndexes(P, used.pupils) };
  const localPairs = matchPairs(
    free.students.map((i) => anyRegionProfile(S[i])),
    free.pupils.map((i) => anyRegionProfile(P[i]))
  );
  return localPairs.map((c) => crossRegionPair(c, free, { S: S, P: P }));
}

// The indexes already taken by the pairs a previous pass returned: student indexes in one set, pupil
// indexes in the other. Anything here is skipped when explaining who is still unmatched.
function usedIndexes(pairs) {
  const students = new Set();
  const pupils = new Set();
  (Array.isArray(pairs) ? pairs : []).forEach((p) => { students.add(p.studentIndex); pupils.add(p.pupilIndex); });
  return { students: students, pupils: pupils };
}

// Why one person is still unmatched, checked against everyone on the other side: a missing consent, an
// empty region, a partner without consent, no shared hour, no shared subject, or no one with both.
function inSameRegion(me, others) {
  return others.filter((o) => o && o.region === me.region);
}

function overlapReason(me, local) {
  const hour = local.filter((o) => hasOverlap(me.availability, o.availability));
  if (hour.length === 0) return 'NO_SHARED_HOUR';
  const subject = local.filter((o) => hasOverlap(me.subjects, o.subjects));
  if (subject.length === 0) return 'NO_SHARED_SUBJECT';
  return hour.some((o) => subject.indexOf(o) !== -1) ? 'PARTNERS_TAKEN' : 'NO_HOUR_AND_SUBJECT_TOGETHER';
}

function unmatchedReason(me, others, isPupil) {
  if (isPupil && !hasParentConsent(me)) return 'NO_PARENT_CONSENT';
  const inRegion = inSameRegion(me, others);
  if (inRegion.length === 0) return 'NO_ONE_IN_REGION';
  // the same gate candidatesOf applies: a pupil without consent is no partner for a student
  const local = isPupil ? inRegion : inRegion.filter(hasParentConsent);
  if (local.length === 0) return 'NO_PARENT_CONSENT';
  return overlapReason(me, local);
}

function explainUnmatched(students, pupils, pairs) {
  const S = Array.isArray(students) ? students : [];
  const P = Array.isArray(pupils) ? pupils : [];
  const used = usedIndexes(pairs);
  const out = { students: [], pupils: [] };
  S.forEach((s, i) => { if (s && !used.students.has(i)) out.students.push({ index: i, reason: unmatchedReason(s, P, false) }); });
  P.forEach((p, i) => { if (p && !used.pupils.has(i)) out.pupils.push({ index: i, reason: unmatchedReason(p, S, true) }); });
  return out;
}

// Whether any student on the roster could take this pupil on region, hour and subject - the test behind
// "waiting for consent but a partner fits". A person with no person record is never counted as fitting.
function hasFittingStudent(students, me) {
  return students.some((s) =>
    s && s.region === me.region &&
    hasOverlap(s.availability, me.availability) &&
    hasOverlap(s.subjects, me.subjects)
  );
}

// Count, per "REGION_SUBJECT" code, how many short pupils each region/subject is missing a partner for.
// A pupil already waiting on consent is skipped here: its gap is a consent gap, not a subject gap.
function missingByRegionSubject(shortPupils) {
  const counts = {};
  shortPupils.forEach((x) => {
    if (!x || x.reason === 'NO_PARENT_CONSENT') return;
    const p = x.e?.person;
    if (!p) return;
    const reg = p.region || 'UNKNOWN';
    (Array.isArray(p.subjects) ? p.subjects : []).forEach((sub) => {
      const code = `${reg}_${sub}`;
      counts[code] = (counts[code] || 0) + 1;
    });
  });
  return counts;
}

function consentGapCounts(shortPupils, students) {
  let noConsent = 0;
  let noConsentNoStudent = 0;
  shortPupils.forEach((x) => {
    if (x?.reason !== 'NO_PARENT_CONSENT') return;
    noConsent += 1;
    const me = x.e?.person;
    if (me && !hasFittingStudent(students, me)) noConsentNoStudent += 1;
  });
  return { noConsent: noConsent, noConsentNoStudent: noConsentNoStudent, noConsentFits: noConsent - noConsentNoStudent };
}

function listLength(m, key) {
  return (m && Array.isArray(m[key])) ? m[key].length : 0;
}

function summarizeMatch(m, people) {
  const S = (Array.isArray(people) ? people : []).filter((p) => p && p.role === 'student');
  const left = (m && Array.isArray(m.left)) ? m.left : [];
  const shortPupils = left.filter((x) => x && x.role === 'pupil');
  const shortStudents = left.length - shortPupils.length;
  const gaps = consentGapCounts(shortPupils, S);

  return {
    pairs: listLength(m, 'pairs'),
    pupilsWithoutStudent: shortPupils.length - gaps.noConsent,
    studentsWithoutPupil: shortStudents,
    crossRegionPairs: listLength(m, 'across'),
    waitingConsentFits: gaps.noConsentFits,
    waitingConsentNoStudent: gaps.noConsentNoStudent,
    missingByRegionSubject: missingByRegionSubject(shortPupils)
  };
}

const MATCH_REPORT_HEADER = 'measure,code,count';

function matchSummaryCsv(m, people) {
  const s = summarizeMatch(m, people);
  const lines = [
    MATCH_REPORT_HEADER,
    `pairs,,${s.pairs}`,
    `pupils_without_student,,${s.pupilsWithoutStudent}`,
    `students_without_pupil,,${s.studentsWithoutPupil}`,
    `cross_region_pairs,,${s.crossRegionPairs}`,
    `waiting_parent_consent_fits,,${s.waitingConsentFits}`,
    `waiting_parent_consent_no_student,,${s.waitingConsentNoStudent}`
  ];
  const missingCodes = Object.keys(s.missingByRegionSubject).sort();
  for (let i = 0; i < missingCodes.length; i += 1) {
    lines.push(`missing_student,${missingCodes[i]},${s.missingByRegionSubject[missingCodes[i]]}`);
  }
  return `${lines.join('\n')}\n`;
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

function slotEntry(slot) {
  const m = /^([A-Z]{3})_(\d{1,2})$/.exec(slot);
  return m ? { day: m[1], hour: Number(m[2]), slot: slot } : null;
}

function availabilityList(p) {
  if (!p) return [];
  if (Array.isArray(p)) return p;
  return Array.isArray(p.availability) ? p.availability : [];
}

function extractValidSlots(p) {
  const raw = availabilityList(p);
  const seen = new Set();
  const out = [];
  for (let i = 0; i < raw.length; i += 1) {
    const s = normalizeSlot(raw[i]);
    if (s === null || seen.has(s)) continue;
    seen.add(s);
    const entry = slotEntry(s);
    if (entry !== null) out.push(entry);
  }
  return out;
}

// The topic list a person carries, under any of the three spellings a caller might hand in: an array
// itself, a target_ai_topics / aiTopics / topics field, in that order of preference. A field that is not
// an array is skipped (an empty array is still chosen, it just holds no topics).
function topicSource(x) {
  if (Array.isArray(x)) return x;
  if (x && Array.isArray(x.target_ai_topics)) return x.target_ai_topics;
  if (x && Array.isArray(x.aiTopics)) return x.aiTopics;
  if (x && Array.isArray(x.topics)) return x.topics;
  return [];
}

function getCleanTopics(x) {
  return topicSource(x).filter((v) => typeof v === 'string' && AI_TOPIC_RE.test(v));
}

function getLevel(x) {
  const n = x?.level;
  return Number.isInteger(n) && n >= 1 && n <= 5 ? n : null;
}

function betterSlotPair(diff, slotA, best) {
  if (best === null) return true;
  if (diff !== best.shiftHours) return diff < best.shiftHours;
  return slotA < best.slotA;
}

// The pair of slots (one from each side) that is closest together on the same day: the smallest hour
// gap, ties broken by the smaller slotA. Returns null when the two share no day at all.
function closestSlotPair(slotsA, slotsB) {
  let best = null;
  for (let i = 0; i < slotsA.length; i += 1) {
    const a = slotsA[i];
    for (let j = 0; j < slotsB.length; j += 1) {
      const b = slotsB[j];
      if (a.day !== b.day) continue;
      const diff = Math.abs(a.hour - b.hour);
      if (betterSlotPair(diff, a.slot, best)) {
        best = {
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
    }
  }
  return best;
}

function dayLabel(lang, day) {
  const labels = DAY_LABELS[lang];
  return (labels?.[day]) || day;
}

function zeroShiftExplanation(dayHe, dayAr, dayRu, best) {
  return {
    he: `יש חפיפת שעות ב-${dayHe} (${best.slotA})`,
    ar: `يوجد تداخل ساعات في ${dayAr} (${best.slotA})`,
    ru: `Есть совпадение часов в ${dayRu} (${best.slotA})`
  };
}

function oneHourShiftExplanation(dayHe, dayAr, dayRu, best) {
  return {
    he: `הזזה מומלצת: שעה אחת ב-${dayHe} לקראת חפיפה ב-${best.targetSlot}`,
    ar: `الإزاحة المقترحة: ساعة واحدة في ${dayAr} نحو التوافق في ${best.targetSlot}`,
    ru: `Рекомендуемый сдвиг: 1 час в ${dayRu} для совпадения в ${best.targetSlot}`
  };
}

function manyHoursShiftExplanation(dayHe, dayAr, dayRu, best) {
  return {
    he: `הזזה מומלצת: ${best.shiftHours} שעות ב-${dayHe} לקראת חפיפה ב-${best.targetSlot}`,
    ar: `الإزاحة المقترحة: ${best.shiftHours} ساعات في ${dayAr} نحو التوافق ב-${best.targetSlot}`,
    ru: `Рекомендуемый сдвиг: ${best.shiftHours} ч. в ${dayRu} для совпадения в ${best.targetSlot}`
  };
}

// The three-language sentence for a closest-slot pair: "already overlap" at 0, "one hour" at 1, and a
// general "N hours" beyond that, each language written independently but for the same shift and slot.
function shiftExplanation(best) {
  const dayHe = dayLabel('he', best.day);
  const dayAr = dayLabel('ar', best.day);
  const dayRu = dayLabel('ru', best.day);
  if (best.shiftHours === 0) return zeroShiftExplanation(dayHe, dayAr, dayRu, best);
  if (best.shiftHours === 1) return oneHourShiftExplanation(dayHe, dayAr, dayRu, best);
  return manyHoursShiftExplanation(dayHe, dayAr, dayRu, best);
}

// suggestScheduleShift(personA, personB):
// Calculates the closest hour shift on schedule that enables overlap, with zero PII.
function suggestScheduleShift(personA, personB) {
  const slotsA = extractValidSlots(personA);
  const slotsB = extractValidSlots(personB);
  if (slotsA.length === 0 || slotsB.length === 0) {
    return null;
  }

  const best = closestSlotPair(slotsA, slotsB);
  if (!best) {
    return null;
  }

  return Object.freeze({
    shiftHours: best.shiftHours,
    day: best.day,
    slotA: best.slotA,
    slotB: best.slotB,
    fromSlot: best.fromSlot,
    toSlot: best.toSlot,
    targetSlot: best.targetSlot,
    suggestedSlot: best.suggestedSlot,
    hourA: best.hourA,
    hourB: best.hourB,
    explanation: Object.freeze(shiftExplanation(best))
  });
}

// A person reduced to the codes the matcher understands: valid SUBJECTS, canonical slot strings, clean
// AI-topic keys, and the numeric level (or null). The same view is used for both sides of a comparison.
function profileFacts(p) {
  return {
    subjects: Array.isArray(p.subjects) ? p.subjects.filter((s) => SUBJECTS.indexOf(s) !== -1) : [],
    slots: extractValidSlots(p).map((s) => s.slot),
    topics: getCleanTopics(p),
    level: getLevel(p)
  };
}

function sameRoleClash(person, c, opts) {
  return !!(person.role && c.role && person.role === c.role && !opts.allowSameRole);
}

function isUnconsentedPupil(c) {
  return c.role === 'pupil' && !hasParentConsent(c);
}

function regionMismatch(person, c, opts) {
  return !!(opts.requireSameRegion && person.region && c.region && person.region !== c.region);
}

// Whether a candidate is filtered out before any comparison: a role clash (unless allowSameRole), a pupil
// without parent consent, or a region mismatch when the caller asked for same-region matches only.
function skipCandidate(person, c, opts) {
  return sameRoleClash(person, c, opts) || isUnconsentedPupil(c) || regionMismatch(person, c, opts);
}

// Neighbouring levels: one numeric step apart, or - when neither side has a numeric level - a differing
// aiLevel on both sides. A side with no level at all (null) on one side only is never adjacent.
function hasAdjacentLevel(pLevel, cLevel, pAiLevel, cAiLevel) {
  if (pLevel !== null && cLevel !== null) return Math.abs(pLevel - cLevel) === 1;
  return pLevel === null && cLevel === null && !!pAiLevel && !!cAiLevel && pAiLevel !== cAiLevel;
}

// A partial topic overlap: both sides list topics, they share at least one, but not all of either side's.
function hasPartialTopic(pCount, cCount, sharedCount) {
  return pCount > 0 && cCount > 0 && sharedCount > 0 && (sharedCount < pCount || sharedCount < cCount);
}

// The gap reasons a candidate is a near-miss for, in the fixed order the report shows them. `ctx` bundles
// the person and its facts, the candidate and its facts, the three shared lists, and the schedule shift
// already computed for the pair (null when the pair shares no day).
function isMissingOneSlot(sharedSl, shift) {
  return sharedSl.length === 0 && !!shift && shift.shiftHours === 1;
}

function nearMissReasons(ctx) {
  const { person, pFacts, c, cFacts, sharedSl, sharedTop, shift } = ctx;
  const reasons = [];
  if (isMissingOneSlot(sharedSl, shift)) reasons.push('missing_one_slot');
  if (hasAdjacentLevel(pFacts.level, cFacts.level, person.aiLevel, c.aiLevel)) reasons.push('adjacent_level');
  if (hasPartialTopic(pFacts.topics.length, cFacts.topics.length, sharedTop.length)) reasons.push('partial_ai_topic');
  return reasons;
}

function candidateSummary(c, cIdx, cFacts) {
  return Object.freeze({
    index: cIdx,
    candidateIndex: cIdx,
    role: c.role || null,
    region: c.region || null,
    subjects: Object.freeze(cFacts.subjects.slice()),
    availability: Object.freeze(cFacts.slots.slice()),
    level: cFacts.level,
    aiLevel: c.aiLevel || null,
    target_ai_topics: Object.freeze(cFacts.topics.slice())
  });
}

function reasonExplanation(primaryReason) {
  const label = GAP_REASON_LABELS[primaryReason] || {};
  return Object.freeze({
    he: label.he || primaryReason,
    ar: label.ar || primaryReason,
    ru: label.ru || primaryReason
  });
}

// The frozen backup-candidate item the report renders: the candidate's public facts (never any PII),
// the primary reason and all reasons, the three shared lists, and the schedule shift. `ctx` is the same
// bundle nearMissReasons read.
function nearMissItem(ctx, reasons) {
  const { c, cIdx, cFacts, sharedSubs, sharedSl, sharedTop, shift } = ctx;
  const primaryReason = reasons[0];
  const summary = candidateSummary(c, cIdx, cFacts);
  return Object.freeze({
    index: cIdx,
    candidateIndex: cIdx,
    candidate: summary,
    role: summary.role,
    region: summary.region,
    subjects: summary.subjects,
    availability: summary.availability,
    level: summary.level,
    aiLevel: summary.aiLevel,
    target_ai_topics: summary.target_ai_topics,
    reason: primaryReason,
    gapReason: primaryReason,
    reasons: Object.freeze(reasons.slice()),
    sharedSubjects: Object.freeze(sharedSubs),
    sharedSlots: Object.freeze(sharedSl),
    sharedAiTopics: Object.freeze(sharedTop),
    shift: shift,
    suggestedShift: shift,
    explanation: reasonExplanation(primaryReason)
  });
}

function nearMissContext(self, raw, index, opts) {
  if (!raw || typeof raw !== 'object') return null;
  const { person, facts: pFacts } = self;
  const c = raw.person || raw;
  if (skipCandidate(person, c, opts)) return null;
  const cFacts = profileFacts(c);
  const sharedSubs = shared(pFacts.subjects, cFacts.subjects);
  const sharedSl = shared(pFacts.slots, cFacts.slots);
  const sharedTop = shared(pFacts.topics, cFacts.topics);
  if (sharedSubs.length === 0 && sharedTop.length === 0) return null;
  return {
    person: person,
    pFacts: pFacts,
    c: c,
    cIdx: Number.isInteger(raw.index) ? raw.index : index,
    cFacts: cFacts,
    sharedSubs: sharedSubs,
    sharedSl: sharedSl,
    sharedTop: sharedTop,
    shift: suggestScheduleShift(person, c)
  };
}

// One candidate -> a near-miss item, or null when it is filtered out or not a near-miss at all. `self`
// is the person together with its facts, computed once; everything else is per candidate.
function evaluateCandidate(self, raw, index, opts) {
  const ctx = nearMissContext(self, raw, index, opts);
  if (ctx === null) return null;
  const reasons = nearMissReasons(ctx);
  if (reasons.length === 0) return null;
  if (opts.reason && !reasons.includes(opts.reason)) return null;
  return nearMissItem(ctx, reasons);
}

// Closest shift first (999 when a candidate shares no day), then most shared subjects, then most shared
// AI topics, then the original candidate order.
function nearMissShiftOf(item) {
  return (item.suggestedShift && item.suggestedShift.shiftHours !== null) ? item.suggestedShift.shiftHours : 999;
}

function compareNearMisses(x, y) {
  return (nearMissShiftOf(x) - nearMissShiftOf(y)) ||
    (y.sharedSubjects.length - x.sharedSubjects.length) ||
    (y.sharedAiTopics.length - x.sharedAiTopics.length) ||
    (x.candidateIndex - y.candidateIndex);
}

function collectNearMisses(person, candidates, opts) {
  const self = { person: person, facts: profileFacts(person) };
  const results = [];
  for (let idx = 0; idx < candidates.length; idx += 1) {
    const item = evaluateCandidate(self, candidates[idx], idx, opts);
    if (item !== null) results.push(item);
  }
  results.sort(compareNearMisses);
  return results;
}

function isNonEmptyArray(value) {
  return Array.isArray(value) && value.length > 0;
}

function hasNearMissInput(person, candidates) {
  return !!person && typeof person === 'object' && isNonEmptyArray(candidates);
}

// findNearMissCandidates(person, candidates, options):
// Finds near-miss backup candidates with explicit gap reasons ('missing_one_slot', 'adjacent_level', 'partial_ai_topic').
function findNearMissCandidates(person, candidates, options) {
  if (!hasNearMissInput(person, candidates)) return [];
  const opts = options || {};
  // A pupil must have parent consent
  if (person.role === 'pupil' && !hasParentConsent(person)) {
    return [];
  }
  const results = collectNearMisses(person, candidates, opts);
  return (Number.isInteger(opts.limit) && opts.limit > 0) ? results.slice(0, opts.limit) : results;
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


