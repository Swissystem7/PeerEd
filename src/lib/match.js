'use strict';
// PeerEd - deterministic matching. Same input -> same output. No clock, no randomness, no network.

const { getRetentionPolicy } = require('./retention.js');

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
function utcDay(value) {
  const d = value instanceof Date ? value : new Date(String(value));
  if (Number.isNaN(d.getTime())) {
    throw new Error('invalid recordedAt: expected a Date or an ISO date string');
  }
  return d.toISOString().slice(0, 10);
}

// A pair on its way into storage: a matchPairs() candidate plus the day it was kept and the retention
// category a cycle sweep reads. Frozen and JSON-serializable, and with no clock of its own - the caller
// passes recordedAt, so the same arguments always produce the same row. Still a module: nothing on
// screen stores a match yet.
function makeMatchRecord(pair, recordedAt) {
  if (pair === null || typeof pair !== 'object' || Array.isArray(pair)) throw new Error(PAIR_ERROR);
  if (!Number.isInteger(pair.studentIndex) || !Number.isInteger(pair.pupilIndex)) throw new Error(PAIR_ERROR);
  if (!Array.isArray(pair.sharedSlots) || !Array.isArray(pair.sharedSubjects)) throw new Error(PAIR_ERROR);
  if (recordedAt === undefined || recordedAt === null) {
    throw new Error('invalid recordedAt: expected a Date or an ISO date string');
  }
  return Object.freeze({
    studentIndex: pair.studentIndex,
    pupilIndex: pair.pupilIndex,
    region: pair.region,
    sharedSlots: Object.freeze(pair.sharedSlots.slice()),
    sharedSubjects: Object.freeze(pair.sharedSubjects.slice()),
    recordedAt: utcDay(recordedAt),
    retention: Object.freeze({ dataCategory: 'match', maxAgeDays: getRetentionPolicy().match })
  });
}

module.exports = { matchPairs, explainUnmatched, shared, compareCandidates, hasOverlap, hasParentConsent, makeMatchRecord };
// Why each participant is not in `pairs`. One code per person, the first that is true:
//   NO_PARENT_CONSENT              a pupil: no parent consent, so not in the pool at all (nobody else is
//                                  looked at); a student: pupils in the region, but none has consent yet
//   NO_ONE_IN_REGION               nobody of the other role in the same region
//   NO_SHARED_HOUR                 somebody in the region, but never free at the same hour
//   NO_SHARED_SUBJECT              somebody in the region, but no subject in common
//   NO_HOUR_AND_SUBJECT_TOGETHER   one shares an hour, another a subject, nobody both
//   PARTNERS_TAKEN                 had possible partners; the largest matching needed all of them elsewhere
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

