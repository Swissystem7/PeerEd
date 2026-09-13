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

// Every element must be a profile - an object whose region is a string. Anything else is refused here, by
// position, instead of being skipped. A skipped element only ever shows up as fewer pairs, and "fewer
// pairs" is indistinguishable from "nobody matched", so the caller is told nothing. The mistake this is
// here to catch: a roster() entry ({ number, person }) passed in place of its .person, which has no
// .region of its own and would silently match nobody.
// An empty array is not an error - no students or no pupils simply yields no pairs.
function assertProfiles(list, name) {
  if (!Array.isArray(list)) {
    throw new TypeError('matchPairs: ' + name + ' must be an array of profiles, got ' + typeof list);
  }
  for (let i = 0; i < list.length; i += 1) {
    const x = list[i];
    if (x && typeof x === 'object' && typeof x.region !== 'string' && x.person) {
      throw new TypeError('matchPairs: ' + name + '[' + i + '] is not a profile - it wraps one as .person. ' +
        'Pass roster.profilesForMatch(people).' + name + ', not roster(people).' + name + '.');
    }
    if (!x || typeof x !== 'object' || typeof x.region !== 'string') {
      throw new TypeError('matchPairs: ' + name + '[' + i + '] is not a profile (no string region)');
    }
  }
}

// students / pupils: arrays of profiles ({ region, availability, subjects }), such as the two arrays
// roster.profilesForMatch(people) returns. Either array may be empty. A non-array, or an element that is
// not a profile, throws: matchPairs never returns fewer pairs merely because its input was the wrong shape.
// A pair needs the same region, >= 1 shared slot and >= 1 shared subject. Each participant is used at most once.
// Candidates are sorted by shared slots desc, shared subjects desc, student index, pupil index, then taken greedily.
function matchPairs(students, pupils) {
  assertProfiles(students, 'students');
  assertProfiles(pupils, 'pupils');
  const S = students;
  const P = pupils;
  const candidates = [];
  for (let si = 0; si < S.length; si += 1) {
    const s = S[si];
    for (let pi = 0; pi < P.length; pi += 1) {
      const p = P[pi];
      if (p.region !== s.region) continue;
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

module.exports = { matchPairs, shared, compareCandidates, assertProfiles };
