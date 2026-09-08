'use strict';
// PeerEd - deterministic matching. Same input -> same output. No clock, no randomness, no network.

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
      const slots = shared(s.availability, p.availability);
      if (slots.length === 0) continue;
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

module.exports = { matchPairs, shared, compareCandidates };
