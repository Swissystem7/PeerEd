'use strict';
// PeerEd - one number per person, on every screen.
// The participants list numbers people by their place in it: #1 is the first person added, whatever the
// role. matchPairs, though, works on two filtered arrays, so its studentIndex/pupilIndex are positions
// AMONG STUDENTS and AMONG PUPILS - a different set, and therefore a different number for the same person.
// These helpers carry the participants-list number through the match, so "תלמיד #7" means the same person
// on the match screen and on the list.
// CommonJS on purpose. No clock, no randomness, no network, no personal data.

// Everyone with this role, in list order, each with its 1-based place in the whole participants list.
function byRole(people, role) {
  const list = Array.isArray(people) ? people : [];
  const out = [];
  for (let i = 0; i < list.length; i += 1) {
    if (list[i] && list[i].role === role) out.push({ number: i + 1, person: list[i] });
  }
  return out;
}

// { students, pupils } - everyone with that role, in list order, as { number, person } entries.
// These are NOT the arrays matchPairs takes. matchPairs reads .region off each element, and here the
// profile sits under .person, so a roster entry has no .region of its own. Hand matchPairs the result of
// profilesForMatch(people) instead; passing these entries is refused there with an error.
function roster(people) {
  return { students: byRole(people, 'student'), pupils: byRole(people, 'pupil') };
}

function personOf(entry) {
  return entry.person;
}

// { students, pupils } - the two plain profile arrays matchPairs takes, in exactly the order
// roster(people).students / .pupils are in. That shared order is the whole point: the studentIndex /
// pupilIndex matchPairs hands back are then positions in roster(people), which is what pairsWithNumbers
// and unmatchedWithNumbers rely on to restate them as participants-list numbers.
function profilesForMatch(people) {
  const r = roster(people);
  return { students: r.students.map(personOf), pupils: r.pupils.map(personOf) };
}

function usedIndexes(pairs) {
  const students = Object.create(null);
  const pupils = Object.create(null);
  (Array.isArray(pairs) ? pairs : []).forEach(function (p) {
    if (p && typeof p.studentIndex === 'number') students[p.studentIndex] = true;
    if (p && typeof p.pupilIndex === 'number') pupils[p.pupilIndex] = true;
  });
  return { students: students, pupils: pupils };
}

// pairs, as matchPairs returned them for profilesForMatch(people).students / .pupils, restated in list
// numbers. A pair whose index is out of range keeps a null number rather than inventing a person.
function pairsWithNumbers(people, pairs) {
  const r = roster(people);
  return (Array.isArray(pairs) ? pairs : []).map(function (p) {
    const s = r.students[p.studentIndex];
    const u = r.pupils[p.pupilIndex];
    return {
      region: p.region,
      studentNumber: s ? s.number : null,
      pupilNumber: u ? u.number : null,
      student: s ? s.person : null,
      pupil: u ? u.person : null,
      sharedSlots: p.sharedSlots,
      sharedSubjects: p.sharedSubjects
    };
  });
}

// Everyone the match left over, in list order within each role, numbered the same way.
function unmatchedWithNumbers(people, pairs) {
  const r = roster(people);
  const used = usedIndexes(pairs);
  const out = [];
  r.students.forEach(function (e, i) {
    if (!used.students[i]) out.push({ role: 'student', number: e.number, person: e.person });
  });
  r.pupils.forEach(function (e, i) {
    if (!used.pupils[i]) out.push({ role: 'pupil', number: e.number, person: e.person });
  });
  return out;
}

module.exports = { byRole, roster, profilesForMatch, pairsWithNumbers, unmatchedWithNumbers };
