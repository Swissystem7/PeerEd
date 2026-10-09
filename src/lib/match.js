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

// Why each participant is not in `pairs`. One code per person, the first that is true:
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
  function reason(me, others) {
    const local = others.filter((o) => o && o.region === me.region);
    if (local.length === 0) return 'NO_ONE_IN_REGION';
    const hour = local.filter((o) => shared(me.availability, o.availability).length > 0);
    const subject = local.filter((o) => shared(me.subjects, o.subjects).length > 0);
    if (hour.length === 0) return 'NO_SHARED_HOUR';
    if (subject.length === 0) return 'NO_SHARED_SUBJECT';
    const both = hour.filter((o) => subject.indexOf(o) !== -1);
    return both.length === 0 ? 'NO_HOUR_AND_SUBJECT_TOGETHER' : 'PARTNERS_TAKEN';
  }
  const out = { students: [], pupils: [] };
  S.forEach((s, i) => { if (s && !usedS.has(i)) out.students.push({ index: i, reason: reason(s, P) }); });
  P.forEach((p, i) => { if (p && !usedP.has(i)) out.pupils.push({ index: i, reason: reason(p, S) }); });
  return out;
}

module.exports = { matchPairs, explainUnmatched, shared, compareCandidates, hasOverlap };
