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
  return pupil !== null && typeof pupil === 'object' && pupil.parentConsent === true;
}

function compareCandidates(x, y) {
  return (y.sharedSlots.length - x.sharedSlots.length) ||
    (y.sharedSubjects.length - x.sharedSubjects.length) ||
    (x.studentIndex - y.studentIndex) ||
    (x.pupilIndex - y.pupilIndex);
}

// All valid (student, pupil) candidates, best first. A pupil without parent consent is in no candidate.
function candidatesOf(S, P) {
  const candidates = [];
  for (let si = 0; si < S.length; si += 1) {
    const s = S[si];
    if (!s || typeof s.region !== 'string') continue;
    for (let pi = 0; pi < P.length; pi += 1) {
      const p = P[pi];
      if (!hasParentConsent(p)) continue;
      if (p.region !== s.region) continue;
      if (!hasOverlap(s.availability, p.availability)) continue;
      const slots = shared(s.availability, p.availability);
      const subjects = shared(s.subjects, p.subjects);
      if (subjects.length === 0) continue;
      candidates.push({
        studentIndex: si,
        pupilIndex: pi,
        region: s.region,
        sharedSlots: slots,
        sharedSubjects: subjects
      });
    }
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
function matchPairs(students, pupils) {
  const S = Array.isArray(students) ? students : [];
  const P = Array.isArray(pupils) ? pupils : [];
  const candidates = candidatesOf(S, P);
  const byStudent = new Map();
  for (let i = 0; i < candidates.length; i += 1) {
    const c = candidates[i];
    if (!byStudent.has(c.studentIndex)) byStudent.set(c.studentIndex, []);
    byStudent.get(c.studentIndex).push(c);
  }
  const ofStudent = new Map();   // studentIndex -> candidate
  const ofPupil = new Map();     // pupilIndex -> candidate
  for (let i = 0; i < candidates.length; i += 1) {
    const c = candidates[i];
    if (ofStudent.has(c.studentIndex) || ofPupil.has(c.pupilIndex)) continue;
    ofStudent.set(c.studentIndex, c);
    ofPupil.set(c.pupilIndex, c);
  }
  function augment(si, seen) {
    const list = byStudent.get(si) || [];
    for (let i = 0; i < list.length; i += 1) {
      const c = list[i];
      if (seen.has(c.pupilIndex)) continue;
      seen.add(c.pupilIndex);
      const holder = ofPupil.get(c.pupilIndex);
      if (!holder || augment(holder.studentIndex, seen)) {
        ofStudent.set(si, c);
        ofPupil.set(c.pupilIndex, c);
        return true;
      }
    }
    return false;
  }
  // A failed search leaves every pupil it visited unable to reach a free pupil until some search
  // succeeds, so the visited set is kept across failures and cleared only after a success.
  const reachablePupils = new Set(candidates.map((c) => c.pupilIndex)).size;
  let seen = new Set();
  for (let si = 0; si < S.length && ofPupil.size < reachablePupils; si += 1) {
    if (ofStudent.has(si) || !byStudent.has(si)) continue;
    if (augment(si, seen)) seen = new Set();
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

function utcDay(value) {
  const bad = new Error('invalid recordedAt: expected a Date or an ISO date string');
  let d = value;
  if (!(value instanceof Date)) {
    const m = typeof value === 'string' ? ISO_DATE.exec(value) : null;
    if (m === null) throw bad;
    const written = new Date(m[1] + 'T00:00:00Z');
    if (Number.isNaN(written.getTime()) || written.toISOString().slice(0, 10) !== m[1]) throw bad;
    d = new Date(value);
  }
  if (Number.isNaN(d.getTime())) throw bad;
  // Only a year the sweep can read back. Past 9999 toISOString writes '+010000-01-01...' and the row
  // would keep '+010000-01'; before the year 0 it writes '-000001-...' and the row would keep '-000001-1'.
  // Either way the cycle manager refuses the stored row, and with it the whole sweep. The years 0-99 the
  // sweep reads in their own century, so they are stored like any other day.
  const year = d.getUTCFullYear();
  if (year < 0 || year > 9999) throw bad;
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
function makeMatchRecord(pair, recordedAt) {
  if (pair === null || typeof pair !== 'object' || Array.isArray(pair)) throw new Error(PAIR_ERROR);
  // an index is a position in the students / pupils arrays: -1 would be a stored row that points at nobody
  if (!Number.isInteger(pair.studentIndex) || pair.studentIndex < 0) throw new Error(PAIR_ERROR);
  if (!Number.isInteger(pair.pupilIndex) || pair.pupilIndex < 0) throw new Error(PAIR_ERROR);
  if (!isCodeList(pair.sharedSlots, isCanonicalSlot) || !isCodeList(pair.sharedSubjects, isSubject)) {
    throw new Error(PAIR_ERROR);
  }
  // a local pair names one region, a matchAcrossRegions() pair names both; a row with neither would be
  // stored with no region at all (JSON drops an undefined key). 'ANY', the placeholder the cross-region
  // pass matches under, is not a region either: a pair that still carries it never left that pass.
  const local = typeof pair.region === 'string';
  if (local ? !isRegion(pair.region) : (!isRegion(pair.studentRegion) || !isRegion(pair.pupilRegion))) {
    throw new Error(PAIR_ERROR);
  }
  if (recordedAt === undefined || recordedAt === null) {
    throw new Error('invalid recordedAt: expected a Date or an ISO date string');
  }
  const where = local ? { region: pair.region } : { studentRegion: pair.studentRegion, pupilRegion: pair.pupilRegion };
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
function matchAcrossRegions(students, pupils, pairs) {
  const S = Array.isArray(students) ? students : [];
  const P = Array.isArray(pupils) ? pupils : [];
  const usedS = new Set(); const usedP = new Set();
  (Array.isArray(pairs) ? pairs : []).forEach((p) => { usedS.add(p.studentIndex); usedP.add(p.pupilIndex); });
  const freeS = []; const freeP = [];
  S.forEach((s, i) => { if (s && typeof s.region === 'string' && !usedS.has(i)) freeS.push(i); });
  P.forEach((p, i) => { if (p && typeof p.region === 'string' && !usedP.has(i)) freeP.push(i); });
  const anywhere = (x) => ({ region: 'ANY', availability: x.availability, subjects: x.subjects, parentConsent: x.parentConsent });
  return matchPairs(freeS.map((i) => anywhere(S[i])), freeP.map((i) => anywhere(P[i]))).map((c) => ({
    studentIndex: freeS[c.studentIndex],
    pupilIndex: freeP[c.pupilIndex],
    studentRegion: S[freeS[c.studentIndex]].region,
    pupilRegion: P[freeP[c.pupilIndex]].region,
    sharedSlots: c.sharedSlots,
    sharedSubjects: c.sharedSubjects
  }));
}

function explainUnmatched(students, pupils, pairs) {
  const S = Array.isArray(students) ? students : [];
  const P = Array.isArray(pupils) ? pupils : [];
  const usedS = new Set(); const usedP = new Set();
  (Array.isArray(pairs) ? pairs : []).forEach((p) => { usedS.add(p.studentIndex); usedP.add(p.pupilIndex); });
  function reason(me, others, isPupil) {
    if (isPupil && !hasParentConsent(me)) return 'NO_PARENT_CONSENT';
    const inRegion = others.filter((o) => o && o.region === me.region);
    if (inRegion.length === 0) return 'NO_ONE_IN_REGION';
    // the same gate candidatesOf applies: a pupil without consent is no partner for a student
    const local = isPupil ? inRegion : inRegion.filter(hasParentConsent);
    if (local.length === 0) return 'NO_PARENT_CONSENT';
    const hour = local.filter((o) => shared(me.availability, o.availability).length > 0);
    const subject = local.filter((o) => shared(me.subjects, o.subjects).length > 0);
    if (hour.length === 0) return 'NO_SHARED_HOUR';
    if (subject.length === 0) return 'NO_SHARED_SUBJECT';
    const both = hour.filter((o) => subject.indexOf(o) !== -1);
    return both.length === 0 ? 'NO_HOUR_AND_SUBJECT_TOGETHER' : 'PARTNERS_TAKEN';
  }
  const out = { students: [], pupils: [] };
  S.forEach((s, i) => { if (s && !usedS.has(i)) out.students.push({ index: i, reason: reason(s, P, false) }); });
  P.forEach((p, i) => { if (p && !usedP.has(i)) out.pupils.push({ index: i, reason: reason(p, S, true) }); });
  return out;
}

function summarizeMatch(m, people) {
  const S = (Array.isArray(people) ? people : []).filter((p) => p && p.role === 'student');
  const left = (m && Array.isArray(m.left)) ? m.left : [];
  const shortPupils = left.filter((x) => x && x.role === 'pupil');
  const shortStudents = left.length - shortPupils.length;

  const noConsent = shortPupils.filter((x) => x && x.reason === 'NO_PARENT_CONSENT').length;
  const noConsentNoStudent = shortPupils.filter((x) => {
    if (!x || x.reason !== 'NO_PARENT_CONSENT') return false;
    const me = x.e && x.e.person;
    if (!me) return false;
    return !S.some((s) =>
      s && s.region === me.region &&
      hasOverlap(s.availability, me.availability) &&
      hasOverlap(s.subjects, me.subjects)
    );
  }).length;
  const noConsentFits = noConsent - noConsentNoStudent;

  const missingCounts = {};
  shortPupils.forEach((x) => {
    if (!x || x.reason === 'NO_PARENT_CONSENT') return;
    const p = x.e && x.e.person;
    if (!p) return;
    const reg = p.region || 'UNKNOWN';
    (Array.isArray(p.subjects) ? p.subjects : []).forEach((sub) => {
      const code = reg + '_' + sub;
      missingCounts[code] = (missingCounts[code] || 0) + 1;
    });
  });

  return {
    pairs: (m && Array.isArray(m.pairs)) ? m.pairs.length : 0,
    pupilsWithoutStudent: shortPupils.length - noConsent,
    studentsWithoutPupil: shortStudents,
    crossRegionPairs: (m && Array.isArray(m.across)) ? m.across.length : 0,
    waitingConsentFits: noConsentFits,
    waitingConsentNoStudent: noConsentNoStudent,
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

function extractValidSlots(p) {
  if (!p) return [];
  const raw = Array.isArray(p) ? p : (p && Array.isArray(p.availability) ? p.availability : []);
  const seen = new Set();
  const out = [];
  for (let i = 0; i < raw.length; i += 1) {
    const s = normalizeSlot(raw[i]);
    if (s !== null && !seen.has(s)) {
      seen.add(s);
      const m = /^([A-Z]{3})_(\d{1,2})$/.exec(s);
      if (m) {
        out.push({ day: m[1], hour: Number(m[2]), slot: s });
      }
    }
  }
  return out;
}

function getCleanTopics(x) {
  const raw = Array.isArray(x)
    ? x
    : (x && Array.isArray(x.target_ai_topics)
      ? x.target_ai_topics
      : (x && Array.isArray(x.aiTopics)
        ? x.aiTopics
        : (x && Array.isArray(x.topics) ? x.topics : [])));
  return raw.filter((v) => typeof v === 'string' && AI_TOPIC_RE.test(v));
}

function getLevel(x) {
  const n = x && x.level;
  return Number.isInteger(n) && n >= 1 && n <= 5 ? n : null;
}

// suggestScheduleShift(personA, personB):
// Calculates the closest hour shift on schedule that enables overlap, with zero PII.
function suggestScheduleShift(personA, personB) {
  const slotsA = extractValidSlots(personA);
  const slotsB = extractValidSlots(personB);
  if (slotsA.length === 0 || slotsB.length === 0) {
    return null;
  }

  let best = null;
  for (let i = 0; i < slotsA.length; i += 1) {
    const a = slotsA[i];
    for (let j = 0; j < slotsB.length; j += 1) {
      const b = slotsB[j];
      if (a.day === b.day) {
        const diff = Math.abs(a.hour - b.hour);
        if (best === null || diff < best.shiftHours || (diff === best.shiftHours && a.slot < best.slotA)) {
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
  }

  if (!best) {
    return null;
  }

  const d = best.day;
  const dayHe = (DAY_LABELS.he && DAY_LABELS.he[d]) || d;
  const dayAr = (DAY_LABELS.ar && DAY_LABELS.ar[d]) || d;
  const dayRu = (DAY_LABELS.ru && DAY_LABELS.ru[d]) || d;

  let textHe;
  let textAr;
  let textRu;

  if (best.shiftHours === 0) {
    textHe = `יש חפיפת שעות ב-${dayHe} (${best.slotA})`;
    textAr = `يوجد تداخل ساعات في ${dayAr} (${best.slotA})`;
    textRu = `Есть совпадение часов в ${dayRu} (${best.slotA})`;
  } else if (best.shiftHours === 1) {
    textHe = `הזזה מומלצת: שעה אחת ב-${dayHe} לקראת חפיפה ב-${best.targetSlot}`;
    textAr = `الإزاحة المقترحة: ساعة واحدة في ${dayAr} نحو التوافق في ${best.targetSlot}`;
    textRu = `Рекомендуемый сдвиг: 1 час в ${dayRu} для совпадения в ${best.targetSlot}`;
  } else {
    textHe = `הזזה מומלצת: ${best.shiftHours} שעות ב-${dayHe} לקראת חפיפה ב-${best.targetSlot}`;
    textAr = `الإزاحة المقترحة: ${best.shiftHours} ساعات في ${dayAr} نحو التوافق في ${best.targetSlot}`;
    textRu = `Рекомендуемый сдвиг: ${best.shiftHours} ч. в ${dayRu} для совпадения в ${best.targetSlot}`;
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
    explanation: Object.freeze({
      he: textHe,
      ar: textAr,
      ru: textRu
    })
  });
}

// findNearMissCandidates(person, candidates, options):
// Finds near-miss backup candidates with explicit gap reasons ('missing_one_slot', 'adjacent_level', 'partial_ai_topic').
function findNearMissCandidates(person, candidates, options) {
  if (!person || typeof person !== 'object' || !Array.isArray(candidates) || candidates.length === 0) {
    return [];
  }
  const opts = options || {};

  // A pupil must have parent consent
  if (person.role === 'pupil' && !hasParentConsent(person)) {
    return [];
  }

  const pSubjects = Array.isArray(person.subjects) ? person.subjects.filter((s) => SUBJECTS.indexOf(s) !== -1) : [];
  const pSlots = extractValidSlots(person).map((s) => s.slot);
  const pTopics = getCleanTopics(person);
  const pLevel = getLevel(person);

  const results = [];

  for (let idx = 0; idx < candidates.length; idx += 1) {
    const raw = candidates[idx];
    if (!raw || typeof raw !== 'object') continue;
    const c = raw.person || raw;
    const cIdx = Number.isInteger(raw.index) ? raw.index : idx;

    if (person.role && c.role && person.role === c.role && !opts.allowSameRole) {
      continue;
    }

    if (c.role === 'pupil' && !hasParentConsent(c)) {
      continue;
    }

    if (opts.requireSameRegion && person.region && c.region && person.region !== c.region) {
      continue;
    }

    const cSubjects = Array.isArray(c.subjects) ? c.subjects.filter((s) => SUBJECTS.indexOf(s) !== -1) : [];
    const cSlots = extractValidSlots(c).map((s) => s.slot);
    const cTopics = getCleanTopics(c);
    const cLevel = getLevel(c);

    const sharedSubs = shared(pSubjects, cSubjects);
    const sharedSl = shared(pSlots, cSlots);
    const sharedTop = shared(pTopics, cTopics);

    const hasSubjectOrTopic = sharedSubs.length > 0 || sharedTop.length > 0;
    if (!hasSubjectOrTopic) {
      continue;
    }

    const shift = suggestScheduleShift(person, c);
    const reasons = [];

    // Reason 1: missing_one_slot
    if (sharedSl.length === 0 && shift && shift.shiftHours === 1) {
      reasons.push('missing_one_slot');
    }

    // Reason 2: adjacent_level
    if (pLevel !== null && cLevel !== null && Math.abs(pLevel - cLevel) === 1) {
      reasons.push('adjacent_level');
    } else if (pLevel === null && cLevel === null && person.aiLevel && c.aiLevel && person.aiLevel !== c.aiLevel) {
      reasons.push('adjacent_level');
    }

    // Reason 3: partial_ai_topic
    if (pTopics.length > 0 && cTopics.length > 0 && sharedTop.length > 0 &&
        (sharedTop.length < pTopics.length || sharedTop.length < cTopics.length)) {
      reasons.push('partial_ai_topic');
    }

    if (reasons.length === 0) {
      continue;
    }

    if (opts.reason && !reasons.includes(opts.reason)) {
      continue;
    }

    const primaryReason = reasons[0];
    const reasonExplHe = (GAP_REASON_LABELS[primaryReason] && GAP_REASON_LABELS[primaryReason].he) || primaryReason;
    const reasonExplAr = (GAP_REASON_LABELS[primaryReason] && GAP_REASON_LABELS[primaryReason].ar) || primaryReason;
    const reasonExplRu = (GAP_REASON_LABELS[primaryReason] && GAP_REASON_LABELS[primaryReason].ru) || primaryReason;

    const candidateSummary = Object.freeze({
      index: cIdx,
      candidateIndex: cIdx,
      role: c.role || null,
      region: c.region || null,
      subjects: Object.freeze(cSubjects.slice()),
      availability: Object.freeze(cSlots.slice()),
      level: cLevel,
      aiLevel: c.aiLevel || null,
      target_ai_topics: Object.freeze(cTopics.slice())
    });

    const item = {
      index: cIdx,
      candidateIndex: cIdx,
      candidate: candidateSummary,
      role: c.role || null,
      region: c.region || null,
      subjects: Object.freeze(cSubjects.slice()),
      availability: Object.freeze(cSlots.slice()),
      level: cLevel,
      aiLevel: c.aiLevel || null,
      target_ai_topics: Object.freeze(cTopics.slice()),
      reason: primaryReason,
      gapReason: primaryReason,
      reasons: Object.freeze(reasons.slice()),
      sharedSubjects: Object.freeze(sharedSubs),
      sharedSlots: Object.freeze(sharedSl),
      sharedAiTopics: Object.freeze(sharedTop),
      shift: shift,
      suggestedShift: shift,
      explanation: Object.freeze({
        he: reasonExplHe,
        ar: reasonExplAr,
        ru: reasonExplRu
      })
    };
    results.push(Object.freeze(item));
  }

  results.sort((x, y) => {
    const shiftX = (x.suggestedShift && x.suggestedShift.shiftHours !== null) ? x.suggestedShift.shiftHours : 999;
    const shiftY = (y.suggestedShift && y.suggestedShift.shiftHours !== null) ? y.suggestedShift.shiftHours : 999;
    return (shiftX - shiftY) ||
      (y.sharedSubjects.length - x.sharedSubjects.length) ||
      (y.sharedAiTopics.length - x.sharedAiTopics.length) ||
      (x.candidateIndex - y.candidateIndex);
  });

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


