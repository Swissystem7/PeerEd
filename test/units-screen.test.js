'use strict';
// The units screen in app.html (MVP items 4 and 5 on a phone). There is no DOM in the test runner, so
// this is a static check of the shell plus a replay of exactly the calls the screen makes against the
// real modules: the screen must only ever reach the queue through makeUnit, submit, approve and reject.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { makeUnit } = require('../src/lib/unit.js');
const approval = require('../src/lib/approval.js');
const { emptyState, serialize, deserialize } = require('../src/lib/store.js');
const { openApp } = require('../test-support/fake-dom.js');

const ROOT = path.join(__dirname, '..');
const shell = fs.readFileSync(path.join(ROOT, 'src', 'app-shell.html'), 'utf8');

test('units screen: the shell has the tab, the form and the three lists', () => {
  for (const id of ['tab-units', 'nav-units', 'unitTitle', 'unitSubject', 'unitDuration', 'unitBody',
    'submitUnit', 'unitDemoBtn', 'clearUnitBtn', 'pendingList', 'approvedList', 'rejectedList']) {
    assert.ok(shell.indexOf('id="' + id + '"') !== -1, 'missing #' + id);
  }
  const tabs = shell.match(/role="tab"/g) || [];
  const panels = shell.match(/role="tabpanel"/g) || [];
  assert.equal(tabs.length, panels.length, 'every tab needs a panel and vice versa');
});

test('units screen: the shell goes through the modules, never builds a queue entry by hand', () => {
  const app = shell.slice(shell.lastIndexOf('<script>'));
  assert.ok(app.indexOf('unitLib.makeUnit(') !== -1);
  assert.ok(app.indexOf('approval.submit(') !== -1);
  assert.ok(app.indexOf('approval.approve(') !== -1);
  assert.ok(app.indexOf('approval.reject(') !== -1);
  assert.equal(/status\s*:\s*['"](pending|approved|rejected)['"]/.test(app), false,
    'the screen must not write a status itself');
  assert.equal(/entries\[[^\]]+\]\s*=/.test(app), false, 'the screen must not assign into queue.entries');
  // The screen shows the decision, never a person: no field for who approved.
  assert.equal(/decidedBy/.test(app), false);
});

test('units screen: the replayed flow - submit, approve, reject, revise - survives a save and a load', () => {
  // The same four calls the screen makes, in the order a teacher and the approver would make them.
  let state = { people: [], queue: emptyState().queue, log: emptyState().log };
  const a = makeUnit({ title: 'שברים פשוטים', subject: 'MATH', durationMinutes: 20, body: 'פיצה שחולקה ל-8.' });
  const b = makeUnit({ title: 'כוחות', subject: 'PHYSICS', durationMinutes: 30, body: 'חוק שני של ניוטון.' });
  state.queue = approval.submit(state.queue, a);
  state.queue = approval.submit(state.queue, b);
  assert.equal(approval.listPending(state.queue).length, 2);
  // A repeat is the "no change" branch the screen reports.
  assert.equal(approval.submit(state.queue, a), state.queue);

  state.queue = approval.approve(state.queue, a.id);
  // The reject box on the screen starts empty: an empty reason must be refused, not stored.
  assert.throws(() => approval.reject(state.queue, b.id, ''));
  state.queue = approval.reject(state.queue, b.id, 'קצר מדי לתלמיד י');
  assert.deepEqual(approval.approvedUnits(state.queue).map((u) => u.id), [a.id]);
  assert.equal(approval.statusOf(state.queue, b.id), 'rejected');

  // The teacher fixes the text: same id, back to pending, revision 2, reason gone.
  const b2 = makeUnit({ title: 'כוחות', subject: 'PHYSICS', durationMinutes: 30, body: 'חוק שני של ניוטון, עם 3 דוגמאות.' });
  assert.equal(b2.id, b.id);
  state.queue = approval.submit(state.queue, b2);
  assert.equal(state.queue.entries[b.id].status, 'pending');
  assert.equal(state.queue.entries[b.id].revision, 2);
  assert.equal(state.queue.entries[b.id].reason, undefined);

  // Round trip through the store, exactly what save() and load() do on the screen.
  const loaded = deserialize(serialize(state));
  assert.equal(approval.listPending(loaded.queue).length, 1);
  assert.deepEqual(approval.approvedUnits(loaded.queue).map((u) => u.id), [a.id]);
  // A pending unit is invisible to pupils until approved - the "approved" list is the only pupil view.
  assert.equal(approval.approvedUnits(loaded.queue).some((u) => u.id === b.id), false);
});

test('units screen: a unit with a phone number in its body never reaches the queue', () => {
  const q = emptyState().queue;
  assert.throws(() => makeUnit({ title: 'שיעור', subject: 'MATH', durationMinutes: 20,
    body: 'תתקשרו אליי 050-1234567' }), /personal data/);
  assert.equal(approval.listPending(q).length, 0);
});

test('units screen: clear button resets form fields, clears status, and focuses title input', () => {
  const $ = openApp();
  $('unitSubject').value = 'PHYSICS';
  $('unitDuration').value = '45';
  $('unitTitle').value = 'כוחות ותנועה';
  $('unitBody').value = 'שיעור על חוקי ניוטון בכיתה';
  $('unitStatus').textContent = 'הדוגמה מולאה.';

  $('unitTitle').focused = false;
  $('clearUnitBtn').fire('click');

  assert.equal($('unitTitle').value, '');
  assert.equal($('unitBody').value, '');
  assert.equal($('unitDuration').value, '20');
  assert.equal($('unitSubject').value, 'MATH');
  assert.equal($('unitStatus').textContent, '');
  assert.equal($('unitTitle').focused, true, 'unitTitle should receive focus after clearing');
});
