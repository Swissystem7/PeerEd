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

function compareCandidates(x, y) {
  return (y.sharedSlots.length - x.sharedSlots.length) ||
    (y.sharedSubjects.length - x.sharedSubjects.length) ||
    (x.studentIndex - y.studentIndex) ||
    (x.pupilIndex - y.pupilIndex);
}

// students / pupils: arrays of profiles ({ region, availability, subjects }).
// A pair needs the same region, >= 1 shared slot and >= 1 shared subject. Each participant is used at most once.
// Candidates are sorted by shared slots desc, shared subjects desc, student index, pupil index, then taken greedily.
function matchPairs(students, pupils) {
  const S = Array.isArray(students) ? students : [];
  const P = Array.isArray(pupils) ? pupils : [];
  const candidates = [];
  for (let si = 0; si < S.length; si += 1) {
    const s = S[si];
    if (!s || typeof s.region !== 'string') continue;
    for (let pi = 0; pi < P.length; pi += 1) {
      const p = P[pi];
      if (!p || p.region !== s.region) continue;
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
  candidates.sort(compareCandidates);
  const usedStudents = new Set();
  const usedPupils = new Set();
  const pairs = [];
  for (let i = 0; i < candidates.length; i += 1) {
    const c = candidates[i];
    if (usedStudents.has(c.studentIndex) || usedPupils.has(c.pupilIndex)) continue;
    usedStudents.add(c.studentIndex);
    usedPupils.add(c.pupilIndex);
    pairs.push(c);
  }
  return pairs;
}

// Why a participant is left without a pair. The coordinator needs this to act: recruit in a region,
// ask for more availability hours, or accept that the other side ran out. The reasons are checked in
// the same order matchPairs filters - region, then slot, then subject - and the first gate that nobody
// on the other side passes is the reason. TAKEN means at least one compatible counterpart exists but
// every one of them was paired with someone else, so the roster, not the profile, is what is short.
const REASONS = Object.freeze(['NO_ONE_IN_REGION', 'NO_SHARED_SLOT', 'NO_SHARED_SUBJECT', 'TAKEN']);

function whyUnmatched(me, others) {
  const O = Array.isArray(others) ? others : [];
  if (!me || typeof me.region !== 'string') return { reason: 'NO_ONE_IN_REGION', compatible: 0 };
  let inRegion = 0;
  let withSlot = 0;
  let compatible = 0;
  for (let i = 0; i < O.length; i += 1) {
    const o = O[i];
    if (!o || o.region !== me.region) continue;
    inRegion += 1;
    if (!hasOverlap(me.availability, o.availability)) continue;
    withSlot += 1;
    if (!hasOverlap(me.subjects, o.subjects)) continue;
    compatible += 1;
  }
  if (inRegion === 0) return { reason: 'NO_ONE_IN_REGION', compatible: 0 };
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
  const side = (mine, theirs, paired) => {
    const out = [];
    for (let i = 0; i < mine.length; i += 1) {
      if (paired.has(i)) continue;
      const why = whyUnmatched(mine[i], theirs);
      out.push({ index: i, reason: why.reason, compatible: why.compatible });
    }
    return out;
  };
  return { students: side(S, P, pairedStudents), pupils: side(P, S, pairedPupils) };
}

module.exports = { matchPairs, shared, compareCandidates, hasOverlap, REASONS, whyUnmatched, explainUnmatched };
