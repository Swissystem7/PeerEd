'use strict';
// PeerEd - deterministic matching. Same input -> same output. No clock, no randomness, no network.

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

// Why a participant is left without a pair. The coordinator needs this to act: obtain a parent's
// consent, recruit in a region, ask for more availability hours, or accept that the other side ran
// out. The reasons are checked in the same order candidatesOf filters - consent, region, slot, subject -
// and the first gate that nobody on the other side passes is the reason. For a pupil,
// NO_PARENT_CONSENT is about the pupil alone: without consent the pupil is not in the pool, so the
// other side is not even looked at. For a student it means pupils exist in the region but none of
// them has consent yet. TAKEN means at least one compatible counterpart exists but every one of them
// was paired with someone else, so the roster, not the profile, is what is short.
const REASONS = Object.freeze(['NO_PARENT_CONSENT', 'NO_ONE_IN_REGION', 'NO_SHARED_SLOT', 'NO_SHARED_SUBJECT', 'TAKEN']);

// side is 'student' or 'pupil': which array of matchPairs `me` came from. It decides where the consent
// gate applies - on me when I am the pupil, on each of the others when they are. When omitted it is
// read from me.role, and a record without a role is treated as a student.
function whyUnmatched(me, others, side) {
  const O = Array.isArray(others) ? others : [];
  const mine = side === undefined ? (me && me.role === 'pupil' ? 'pupil' : 'student') : side;
  if (mine !== 'student' && mine !== 'pupil') throw new Error('invalid side: expected student or pupil');
  if (mine === 'pupil' && !hasParentConsent(me)) return { reason: 'NO_PARENT_CONSENT', compatible: 0 };
  if (!me || typeof me.region !== 'string') return { reason: 'NO_ONE_IN_REGION', compatible: 0 };
  let inRegion = 0;
  let withConsent = 0;
  let withSlot = 0;
  let compatible = 0;
  for (let i = 0; i < O.length; i += 1) {
    const o = O[i];
    if (!o || o.region !== me.region) continue;
    inRegion += 1;
    if (mine === 'student' && !hasParentConsent(o)) continue;
    withConsent += 1;
    if (!hasOverlap(me.availability, o.availability)) continue;
    withSlot += 1;
    if (!hasOverlap(me.subjects, o.subjects)) continue;
    compatible += 1;
  }
  if (inRegion === 0) return { reason: 'NO_ONE_IN_REGION', compatible: 0 };
  if (withConsent === 0) return { reason: 'NO_PARENT_CONSENT', compatible: 0 };
  if (withSlot === 0) return { reason: 'NO_SHARED_SLOT', compatible: 0 };
  if (compatible === 0) return { reason: 'NO_SHARED_SUBJECT', compatible: 0 };
  return { reason: 'TAKEN', compatible: compatible };
}

// students / pupils as given to matchPairs; pairs is its result for the same two arrays (computed here
// when omitted). Returns the unmatched participants of each side, in roster order, each with the index
// matchPairs would have used, the reason and the number of compatible counterparts (non-zero only for
// TAKEN). Nothing about a person is copied into the answer: an index, a reason code, a count.
function explainUnmatched(students, pupils, pairs) {
  const S = Array.isArray(students) ? students : [];
  const P = Array.isArray(pupils) ? pupils : [];
  const given = pairs === undefined ? matchPairs(S, P) : pairs;
  if (!Array.isArray(given)) throw new Error('invalid pairs: expected the result of matchPairs');
  const pairedStudents = new Set();
  const pairedPupils = new Set();
  for (let i = 0; i < given.length; i += 1) {
    const c = given[i];
    if (!c || !Number.isInteger(c.studentIndex) || !Number.isInteger(c.pupilIndex)) {
      throw new Error('invalid pairs: expected the result of matchPairs');
    }
    pairedStudents.add(c.studentIndex);
    pairedPupils.add(c.pupilIndex);
  }
  const side = (mine, theirs, paired, which) => {
    const out = [];
    for (let i = 0; i < mine.length; i += 1) {
      if (paired.has(i)) continue;
      const why = whyUnmatched(mine[i], theirs, which);
      out.push({ index: i, reason: why.reason, compatible: why.compatible });
    }
    return out;
  };
  return { students: side(S, P, pairedStudents, 'student'), pupils: side(P, S, pairedPupils, 'pupil') };
}

module.exports = {
  matchPairs, shared, compareCandidates, hasOverlap, hasParentConsent, REASONS, whyUnmatched, explainUnmatched
};
