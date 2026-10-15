'use strict';
// Parent consent is a gate of the matching, not a field that is stored and forgotten. PR #10 added
// parentConsent to the pupil's record; until this change nothing read it, so a pupil whose parent had
// not said yes was paired and taught like any other. Now matchPairs skips such a pupil, explainUnmatched
// says so, and the people screen is where the flag is set - through the profile module, never by hand.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { matchPairs, explainUnmatched, hasParentConsent } = require('../src/lib/match.js');
const profile = require('../src/lib/profile.js');
const session = require('../src/lib/session.js');
const approval = require('../src/lib/approval.js');
const { makeUnit } = require('../src/lib/unit.js');
const { serialize, deserialize } = require('../src/lib/store.js');

const ROOT = path.join(__dirname, '..');
const shell = fs.readFileSync(path.join(ROOT, 'src', 'app-shell.html'), 'utf8');
const app = shell.slice(shell.lastIndexOf('<script>'));
const peopleBlock = app.slice(app.indexOf('function renderPeople()'), app.indexOf('// ---------- match'));

const STUDENT = profile.makeProfile({ role: 'student', region: 'NORTH', availability: ['SUN_16', 'MON_18'], subjects: ['MATH', 'CS'] });
function pupil(consent, extra) {
  return profile.makeProfile(Object.assign(
    { role: 'pupil', region: 'NORTH', availability: ['SUN_16', 'MON_18'], subjects: ['MATH', 'CS'] },
    consent === undefined ? {} : { parentConsent: consent }, extra || {}));
}

test('consent: a pupil without parent consent is never paired, however well everything else fits', () => {
  const noConsent = pupil();
  assert.equal(noConsent.parentConsent, false, 'makeProfile defaults a pupil to no consent');
  assert.deepEqual(matchPairs([STUDENT], [noConsent]), []);
  assert.deepEqual(matchPairs([STUDENT], [pupil(false)]), []);
  // The same pupil with consent is the perfect match: two shared hours, two shared subjects.
  assert.deepEqual(matchPairs([STUDENT], [pupil(true)]), [
    { studentIndex: 0, pupilIndex: 0, region: 'NORTH', sharedSlots: ['MON_18', 'SUN_16'], sharedSubjects: ['CS', 'MATH'] }
  ]);
  // Consent granted through the module - what the people screen's button does - opens the gate;
  // revoked closes it again. The record itself is untouched: a new frozen profile each time.
  const granted = profile.grantParentConsent(noConsent);
  assert.equal(matchPairs([STUDENT], [granted]).length, 1);
  assert.equal(matchPairs([STUDENT], [profile.revokeParentConsent(granted)]).length, 0);
  assert.equal(noConsent.parentConsent, false);
});

test('consent: only an explicit true counts; a missing or forged flag is treated as no', () => {
  assert.equal(hasParentConsent(pupil(true)), true);
  assert.equal(hasParentConsent(pupil(false)), false);
  for (const bad of [null, undefined, 'yes', 1, {}, { parentConsent: 'true' }, { parentConsent: 1 }, []]) {
    assert.equal(hasParentConsent(bad), false, JSON.stringify(bad));
  }
  // A plain object (not from makeProfile) with no flag cannot be matched either: the gate does not
  // trust the caller to have validated.
  const plain = { region: 'NORTH', availability: ['SUN_16'], subjects: ['MATH'] };
  assert.deepEqual(matchPairs([STUDENT], [plain]), []);
  assert.equal(matchPairs([STUDENT], [Object.assign({ parentConsent: true }, plain)]).length, 1);
});

test('consent: the better-fitting pupil loses to a consented one, and the roster order of pairs is unchanged otherwise', () => {
  // Pupil 0 shares two hours and two subjects but has no consent; pupil 1 shares one of each and has it.
  const pupils = [pupil(false), pupil(true, { availability: ['SUN_16'], subjects: ['MATH'] })];
  assert.deepEqual(matchPairs([STUDENT], pupils), [
    { studentIndex: 0, pupilIndex: 1, region: 'NORTH', sharedSlots: ['SUN_16'], sharedSubjects: ['MATH'] }
  ]);
  assert.deepEqual(matchPairs([STUDENT], pupils), matchPairs([STUDENT], pupils.slice()), 'same input, same pairs');
});

test('consent: NO_PARENT_CONSENT is the first reason, about the pupil alone, before anyone else is looked at', () => {
  // No student anywhere, no shared hour, no shared subject - none of it matters without consent.
  const far = pupil(false, { region: 'SOUTH', availability: ['THU_20'], subjects: ['HISTORY'] });
  assert.deepEqual(explainUnmatched([STUDENT], [far], []), {
    students: [{ index: 0, reason: 'NO_ONE_IN_REGION' }],
    pupils: [{ index: 0, reason: 'NO_PARENT_CONSENT' }]
  });
  assert.deepEqual(explainUnmatched([], [pupil(false)], []).pupils, [{ index: 0, reason: 'NO_PARENT_CONSENT' }]);
  // With consent the same far pupil gets the region reason, as before this change.
  assert.equal(explainUnmatched([STUDENT], [profile.grantParentConsent(far)], []).pupils[0].reason, 'NO_ONE_IN_REGION');
});

test('consent: for a student, pupils in the region without consent are the reason, and are no partners', () => {
  // One pupil in the region, no consent: the student is told so, not "nobody in the region".
  assert.deepEqual(explainUnmatched([STUDENT], [pupil(false)], []), {
    students: [{ index: 0, reason: 'NO_PARENT_CONSENT' }],
    pupils: [{ index: 0, reason: 'NO_PARENT_CONSENT' }]
  });
  // Region gate first: a pupil elsewhere, with or without consent, is "nobody in the region".
  assert.equal(explainUnmatched([STUDENT], [pupil(false, { region: 'SOUTH' })], []).students[0].reason, 'NO_ONE_IN_REGION');
  // Consent before hours: a consented pupil with other hours makes it the hour gate that fails.
  assert.equal(explainUnmatched([STUDENT], [pupil(false), pupil(true, { availability: ['THU_20'] })], []).students[0].reason,
    'NO_SHARED_HOUR');
  // Two students fit one consented pupil and one not: the leftover student's only partner was taken.
  const students = [STUDENT, profile.makeProfile({ role: 'student', region: 'NORTH', availability: ['SUN_16'], subjects: ['MATH'] })];
  const pupils = [pupil(false), pupil(true)];
  const pairs = matchPairs(students, pupils);
  assert.deepEqual(pairs.map((p) => [p.studentIndex, p.pupilIndex]), [[0, 1]]);
  assert.deepEqual(explainUnmatched(students, pupils, pairs), {
    students: [{ index: 1, reason: 'PARTNERS_TAKEN' }],
    pupils: [{ index: 0, reason: 'NO_PARENT_CONSENT' }]
  });
});

test('consent: no session can be logged for a pupil without consent, because no pair exists to log it for', () => {
  const unit = makeUnit({ title: 'שברים פשוטים', subject: 'MATH', durationMinutes: 20, body: 'פיצה שחולקה ל-8.' });
  const queue = approval.approve(approval.submit(approval.emptyQueue(), unit), unit.id);
  // The sessions screen takes its pairs from matchPairs over the roster: an empty list, nothing to pick.
  assert.deepEqual(matchPairs([STUDENT], [pupil(false)]), []);
  // A pair faked by hand is refused by the log's shape check, so the screen cannot work around the gate.
  assert.throws(() => session.logSession(session.emptyLog(), queue, { region: 'NORTH' },
    { slot: 'SUN_16', subject: 'MATH', unitId: unit.id, outcome: 'held' }), /invalid pair/);
  // A stored roster with a consented pupil stays consented through a save and a load, and one edited
  // on disk to hold anything but a boolean is refused by the gate on load.
  const state = { people: [STUDENT, pupil(true)], queue, log: session.emptyLog() };
  const back = deserialize(serialize(state));
  assert.equal(back.people[1].parentConsent, true);
  assert.equal(matchPairs([back.people[0]], [back.people[1]]).length, 1);
  assert.throws(() => deserialize(serialize(state).replace('"parentConsent":true', '"parentConsent":"true"')), /parentConsent/);
  // The flag is the only thing added to the record: no parent's name, no date, no document.
  assert.deepEqual(Object.keys(pupil(true)).sort(), ['availability', 'parentConsent', 'region', 'role', 'subjects']);
  assert.throws(() => profile.makeProfile(Object.assign({}, pupil(true), { consentDate: '2026-10-06' })),
    { message: profile.PERSONAL_DATA_ERROR });
});

test('consent: the people screen has the checkbox, sets the flag through the profile module, and says why a pupil is out', () => {
  assert.ok(/<input type="checkbox" id="consent">/.test(shell), 'the consent checkbox is missing');
  assert.ok(/id="consentRow" hidden/.test(shell), 'the consent row starts hidden (the default role is a student)');
  assert.ok(app.indexOf("$('consentRow').hidden = $('role').value !== 'pupil'") !== -1, 'the row follows the role');
  // The add button passes the flag for a pupil only, so a student record stays four fields.
  assert.ok(app.indexOf("if (candidate.role === 'pupil') candidate.parentConsent = $('consent').checked;") !== -1);
  // Flipping consent on the roster goes through the module, which re-validates the record.
  assert.ok(peopleBlock.indexOf('profile.grantParentConsent(') !== -1);
  assert.ok(peopleBlock.indexOf('profile.revokeParentConsent(') !== -1);
  // The only assignment of the flag is on the candidate handed to makeProfile; a stored record is never
  // edited in place, it is replaced by what the module returns.
  const assigned = app.match(/[\w$)\]]+\.parentConsent\s*=[^=]/g) || [];
  assert.deepEqual(assigned.map((s) => s.replace(/\s*=.*$/, '')), ['candidate.parentConsent']);
  // The roster card reads the flag through the same predicate the engine uses.
  assert.ok(peopleBlock.indexOf('match.hasParentConsent(') !== -1);
  assert.ok(peopleBlock.indexOf('אישור הורה') !== -1);
  // The match screen has a sentence for the new reason, for each side.
  const table = app.slice(app.indexOf('function reasonHe('), app.indexOf('function computeMatch('));
  assert.ok(table.indexOf("case 'NO_PARENT_CONSENT':") !== -1);
  assert.ok(table.indexOf('אין עדיין אישור הורה') !== -1, 'the pupil-side sentence');
  assert.ok(table.indexOf('לאף אחד מהם אין עדיין אישור הורה') !== -1, 'the student-side sentence');
  // The demo roster has at least one pupil with consent and one without, so the screen shows both.
  const demo = app.slice(app.indexOf("$('demoBtn')"), app.indexOf('// ---------- match'));
  const demoPupils = demo.match(/role: 'pupil'[^\n]*/g) || [];
  assert.ok(demoPupils.some((l) => l.indexOf('parentConsent: true') !== -1), 'a demo pupil with consent');
  assert.ok(demoPupils.some((l) => l.indexOf('parentConsent') === -1), 'a demo pupil without consent');
});
