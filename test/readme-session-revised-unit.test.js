'use strict';
// The README's session.js row said "an unapproved unit cannot be logged" and that loading "re-checks every row
// against the approval queue", and its approval.js row named pending, approved and rejected with no revision - over
// a queue where a new body sends an approved unit back to pending and a log whose stored rows stay on such a unit
// (unitTaughtOk) and are still counted in the summary. The README must say both.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const approval = require('../src/lib/approval.js');
const session = require('../src/lib/session.js');
const { makeUnit } = require('../src/lib/unit.js');

const root = path.join(__dirname, '..');
const readme = fs.readFileSync(path.join(root, 'README.md'), 'utf8');
function rowOf(file) {
  return readme.split('\n').find(function (line) { return line.startsWith('| `src/lib/' + file + '`'); });
}

const PAIR = { region: 'NORTH', sharedSlots: ['SUN_16'], sharedSubjects: ['MATH'] };
const FIELDS = { title: 'שברים פשוטים', subject: 'MATH', durationMinutes: 20 };
const first = makeUnit(Object.assign({ body: 'פיצה שחולקה ל-8.' }, FIELDS));
const second = makeUnit(Object.assign({ body: 'פיצה שחולקה ל-6.' }, FIELDS));

test('approval + session: a row on an approved unit revised later is kept and counted', () => {
  let queue = approval.approve(approval.submit(approval.emptyQueue(), first), first.id);
  const log = session.logSession(session.emptyLog(), queue, PAIR,
    { slot: 'SUN_16', subject: 'MATH', unitId: first.id, outcome: 'held' });
  queue = approval.submit(queue, second);
  assert.equal(queue.entries[first.id].status, 'pending');
  assert.equal(queue.entries[first.id].revision, 2);
  const stored = JSON.parse(JSON.stringify(log));
  assert.equal(session.loadLog(stored, queue).entries.length, 1);
  queue = approval.reject(queue, first.id, 'חסרה דוגמה');
  const kept = session.loadLog(stored, queue);
  assert.equal(session.summarize(kept).byUnit[first.id], 1);
  assert.throws(() => session.logSession(kept, queue, PAIR,
    { slot: 'SUN_16', subject: 'MATH', unitId: first.id, outcome: 'held' }), /unit is not approved/);
});

test('session: a stored row on a unit never approved is refused', () => {
  const queue = approval.submit(approval.emptyQueue(), first);
  const stored = { nextSeq: 2, entries: [{ region: 'NORTH', slot: 'SUN_16', subject: 'MATH', unitId: first.id, outcome: 'held', seq: 1 }] };
  assert.throws(() => session.loadLog(stored, queue), /unit not approved/);
});

test('README: the approval row names the revision and the session row names the kept rows', () => {
  const approvalRow = rowOf('approval.js');
  const sessionRow = rowOf('session.js');
  assert.ok(approvalRow && sessionRow);
  assert.match(approvalRow, /next revision and goes back to pending/);
  assert.match(approvalRow, /an approved unit included/);
  assert.match(sessionRow, /pending or rejected today but has had a revision/);
  assert.match(sessionRow, /the summary and the CSV still count it/);
  assert.match(sessionRow, /never approved, is refused/);
});
