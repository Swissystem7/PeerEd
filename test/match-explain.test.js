'use strict';
// Why a participant is left without a pair: the reason codes in src/lib/match.js, and a static check
// that the match screen shows the module's reason instead of one sentence for every case.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { matchPairs, explainUnmatched, whyUnmatched, REASONS } = require('../src/lib/match.js');
const { makeProfile } = require('../src/lib/profile.js');

const ROOT = path.join(__dirname, '..');
const shell = fs.readFileSync(path.join(ROOT, 'src', 'app-shell.html'), 'utf8');
const app = shell.slice(shell.lastIndexOf('<script>'));
const matchBlock = app.slice(app.indexOf('// ---------- match'), app.indexOf('// ---------- text gate'));

function student(region, availability, subjects) {
  return makeProfile({ role: 'student', region, availability, subjects });
}
function pupil(region, availability, subjects) {
  return makeProfile({ role: 'pupil', region, availability, subjects });
}

test('explain: the four reasons are the gates of matchPairs in order, plus TAKEN', () => {
  assert.deepEqual(REASONS, ['NO_ONE_IN_REGION', 'NO_SHARED_SLOT', 'NO_SHARED_SUBJECT', 'TAKEN']);
  assert.ok(Object.isFrozen(REASONS));
});

test('explain: nobody on the other side in the region', () => {
  const s = [student('NORTH', ['SUN_16'], ['MATH'])];
  const p = [pupil('SOUTH', ['SUN_16'], ['MATH'])];
  assert.deepEqual(explainUnmatched(s, p), {
    students: [{ index: 0, reason: 'NO_ONE_IN_REGION', compatible: 0 }],
    pupils: [{ index: 0, reason: 'NO_ONE_IN_REGION', compatible: 0 }]
  });
});

test('explain: someone in the region, but no shared hour', () => {
  const s = [student('NORTH', ['SUN_16'], ['MATH'])];
  const p = [pupil('NORTH', ['MON_18'], ['MATH'])];
  const why = explainUnmatched(s, p);
  assert.equal(why.students[0].reason, 'NO_SHARED_SLOT');
  assert.equal(why.pupils[0].reason, 'NO_SHARED_SLOT');
});

test('explain: a shared hour exists, but nobody with it shares a subject', () => {
  const s = [student('NORTH', ['SUN_16'], ['MATH'])];
  const p = [
    pupil('NORTH', ['SUN_16'], ['ENGLISH']),
    pupil('NORTH', ['MON_18'], ['MATH'])
  ];
  const why = explainUnmatched(s, p);
  assert.equal(why.students[0].reason, 'NO_SHARED_SUBJECT',
    'the slot gate is passed by pupil 1, so the subject gate is what fails - same order as matchPairs');
  assert.deepEqual(why.pupils.map((x) => x.reason), ['NO_SHARED_SUBJECT', 'NO_SHARED_SLOT']);
});

test('explain: TAKEN when a compatible counterpart exists but was paired with someone else', () => {
  // two students fit the one pupil; the first wins on index, the second is left over
  const s = [student('NORTH', ['SUN_16'], ['MATH']), student('NORTH', ['SUN_16'], ['MATH'])];
  const p = [pupil('NORTH', ['SUN_16'], ['MATH'])];
  const pairs = matchPairs(s, p);
  assert.equal(pairs.length, 1);
  assert.deepEqual(explainUnmatched(s, p, pairs), {
    students: [{ index: 1, reason: 'TAKEN', compatible: 1 }],
    pupils: []
  });
  assert.deepEqual(explainUnmatched(s, p), explainUnmatched(s, p, pairs), 'omitting pairs computes them');
});

test('explain: the count of compatible counterparts is how many passed all three gates', () => {
  const me = student('CENTER', ['SUN_16', 'MON_18'], ['MATH', 'CS']);
  const others = [
    pupil('CENTER', ['SUN_16'], ['MATH']),
    pupil('CENTER', ['MON_18'], ['CS']),
    pupil('CENTER', ['MON_18'], ['ENGLISH']),
    pupil('CENTER', ['TUE_16'], ['MATH']),
    pupil('NORTH', ['SUN_16'], ['MATH'])
  ];
  assert.deepEqual(whyUnmatched(me, others), { reason: 'TAKEN', compatible: 2 });
  assert.deepEqual(whyUnmatched(me, []), { reason: 'NO_ONE_IN_REGION', compatible: 0 });
  assert.deepEqual(whyUnmatched(me, null), { reason: 'NO_ONE_IN_REGION', compatible: 0 });
  assert.deepEqual(whyUnmatched(null, others), { reason: 'NO_ONE_IN_REGION', compatible: 0 });
});

test('explain: everyone paired means two empty lists, and the answer never copies a profile', () => {
  const s = [student('NORTH', ['SUN_16'], ['MATH'])];
  const p = [pupil('NORTH', ['SUN_16'], ['MATH'])];
  assert.deepEqual(explainUnmatched(s, p), { students: [], pupils: [] });
  const why = explainUnmatched(s, [pupil('SOUTH', ['SUN_16'], ['MATH'])]);
  for (const row of why.students.concat(why.pupils)) {
    assert.deepEqual(Object.keys(row).sort(), ['compatible', 'index', 'reason']);
  }
});

test('explain: same input, same answer; roster order is kept', () => {
  const s = [
    student('NORTH', ['SUN_16'], ['MATH']),
    student('SOUTH', ['SUN_16'], ['MATH']),
    student('NORTH', ['MON_18'], ['MATH'])
  ];
  const p = [pupil('NORTH', ['SUN_16'], ['MATH'])];
  const a = explainUnmatched(s, p);
  const b = explainUnmatched(s.slice(), p.slice());
  assert.deepEqual(a, b);
  assert.deepEqual(a.students.map((x) => x.index), [1, 2]);
  assert.deepEqual(a.students.map((x) => x.reason), ['NO_ONE_IN_REGION', 'NO_SHARED_SLOT']);
});

test('explain: pairs that are not the shape matchPairs returns are refused', () => {
  const s = [student('NORTH', ['SUN_16'], ['MATH'])];
  const p = [pupil('NORTH', ['SUN_16'], ['MATH'])];
  assert.throws(() => explainUnmatched(s, p, 'pairs'), /invalid pairs/);
  assert.throws(() => explainUnmatched(s, p, [{ studentIndex: 0 }]), /invalid pairs/);
  assert.throws(() => explainUnmatched(s, p, [null]), /invalid pairs/);
  assert.deepEqual(explainUnmatched(s, p, []), {
    students: [{ index: 0, reason: 'TAKEN', compatible: 1 }],
    pupils: [{ index: 0, reason: 'TAKEN', compatible: 1 }]
  }, 'an empty pair list means everyone is unmatched, and a compatible counterpart counts as TAKEN');
});

test('explain: the match screen asks the module why, and has one Hebrew sentence per reason', () => {
  assert.ok(matchBlock.indexOf('match.explainUnmatched(') !== -1, 'the reason must come from the module');
  const table = app.slice(app.indexOf('var REASON_HE = {'), app.indexOf('// ---------- match'));
  assert.ok(table.length > 0, 'expected a REASON_HE table before the match screen code');
  for (const code of REASONS) {
    assert.ok(table.indexOf(code + ':') !== -1, 'REASON_HE lacks ' + code);
  }
  assert.ok(matchBlock.indexOf('REASON_HE[x.why.reason]') !== -1, 'the screen looks the reason up in the table');
  assert.equal(matchBlock.indexOf('אין באזור שלו מישהו עם שעה ומקצוע משותפים'), -1,
    'the one-sentence-for-every-case text is gone');
  assert.ok(app.indexOf('match = __registry.match') !== -1, 'match.js is inlined and picked up');
});
