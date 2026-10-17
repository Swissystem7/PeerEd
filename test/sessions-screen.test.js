'use strict';
// The sessions screen in app.html (MVP item 6 on a phone). No DOM in the test runner, so this is a
// static check of the shell plus a replay of exactly the calls the screen makes against the real
// modules: the pair from matchPairs over the roster, the row through logSession against the stored
// queue, the municipality view through summarize, and the whole state through the store.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { makeProfile } = require('../src/lib/profile.js');
const { matchPairs } = require('../src/lib/match.js');
const { makeUnit } = require('../src/lib/unit.js');
const approval = require('../src/lib/approval.js');
const session = require('../src/lib/session.js');
const { emptyState, serialize, deserialize } = require('../src/lib/store.js');
const { openApp, text } = require('../test-support/fake-dom.js');

const ROOT = path.join(__dirname, '..');
const shell = fs.readFileSync(path.join(ROOT, 'src', 'app-shell.html'), 'utf8');
const app = shell.slice(shell.lastIndexOf('<script>'));
const sessionsBlock = app.slice(app.indexOf('// ---------- sessions'), app.indexOf('// ---------- tabs'));

// The same roster the "load demo" button on the people screen fills in.
const DEMO = [
  { role: 'student', region: 'CENTER', availability: ['SUN_16', 'MON_18', 'TUE_16'], subjects: ['MATH', 'CS'] },
  { role: 'student', region: 'CENTER', availability: ['SUN_16'], subjects: ['MATH'] },
  { role: 'student', region: 'SOUTH', availability: ['TUE_17', 'WED_17'], subjects: ['PHYSICS', 'ENGLISH'] },
  { role: 'pupil', region: 'CENTER', availability: ['SUN_16', 'MON_18'], subjects: ['CS', 'MATH', 'HEBREW'], parentConsent: true },
  { role: 'pupil', region: 'CENTER', availability: ['SUN_16'], subjects: ['MATH', 'PHYSICS'], parentConsent: true },
  { role: 'pupil', region: 'SOUTH', availability: ['WED_17'], subjects: ['ENGLISH'], parentConsent: true },
  { role: 'pupil', region: 'JERUSALEM', availability: ['THU_16'], subjects: ['HISTORY'] }
];

function pairsOf(people) {
  return matchPairs(people.filter((p) => p.role === 'student'), people.filter((p) => p.role === 'pupil'));
}

test('sessions screen: the shell has the tab, the form, the summary and the log', () => {
  for (const id of ['tab-sessions', 'nav-sessions', 'sessionPair', 'sessionSlot', 'sessionSubject', 'sessionUnit',
    'sessionOutcome', 'logSession', 'sessionStatus', 'sessionSummary', 'sessionList']) {
    assert.ok(shell.indexOf('id="' + id + '"') !== -1, 'missing #' + id);
  }
  const tabs = shell.match(/role="tab"/g) || [];
  const panels = shell.match(/role="tabpanel"/g) || [];
  assert.equal(tabs.length, panels.length, 'every tab needs a panel and vice versa');
  assert.ok(sessionsBlock.length > 0, 'the sessions block is missing from the app script');
});

test('sessions screen: the shell goes through the modules, never builds a log row by hand', () => {
  assert.ok(sessionsBlock.indexOf('match.matchPairs(') !== -1, 'pairs must come from matchPairs');
  assert.ok(sessionsBlock.indexOf('session.logSession(') !== -1);
  assert.ok(sessionsBlock.indexOf('session.summarize(') !== -1);
  assert.equal(/entries\.push\(/.test(sessionsBlock), false, 'the screen must not append to the log itself');
  assert.equal(/seq\s*:/.test(sessionsBlock), false, 'the screen must not number a row itself');
  assert.equal(/outcome\s*:\s*['"]/.test(sessionsBlock), false, 'the outcome comes from the select, not a literal');
  // List numbers name a pair in the dropdown only; the log row and the stored log never read them.
  assert.ok(sessionsBlock.indexOf('shown in the dropdown and never reach the log') !== -1);
  const sessionRowOnly = sessionsBlock.slice(
    sessionsBlock.indexOf('function sessionRow('),
    sessionsBlock.indexOf('function countRow('));
  assert.equal(/studentIndex|pupilIndex/.test(sessionRowOnly), false);
  assert.ok(/renderSessionForm[\s\S]*studentIndex/.test(sessionsBlock), 'pair dropdown uses roster list numbers');
  // Every outcome the module accepts is offered, through the module's own list.
  assert.ok(sessionsBlock.indexOf('OUTCOME_HE') !== -1);
  assert.ok(app.indexOf('session.OUTCOMES') !== -1, 'the outcome select is filled from session.OUTCOMES');
  for (const outcome of session.OUTCOMES) {
    assert.ok(new RegExp(outcome + "\\s*:\\s*'").test(sessionsBlock), 'no Hebrew label for outcome ' + outcome);
  }
});

test('sessions screen: the replayed flow - demo roster, approved unit, log, summary - survives a save and a load', () => {
  let state = { people: DEMO.map(makeProfile), queue: emptyState().queue, log: emptyState().log };
  const pairs = pairsOf(state.people);
  assert.ok(pairs.length >= 2, 'the demo roster gives at least two pairs');

  // The teacher submits, the approver approves: exactly the two calls the units screen makes.
  const unit = makeUnit({ title: 'שברים פשוטים', subject: 'MATH', durationMinutes: 20, body: 'פיצה שחולקה ל-8.' });
  state.queue = approval.approve(approval.submit(state.queue, unit), unit.id);

  // What the dropdowns offer for pair 1: its shared slots and subjects, and the approved units of the
  // chosen subject. The MATH unit is the only one, so it is the only choice.
  const pair = pairs[0];
  assert.ok(pair.sharedSubjects.indexOf('MATH') !== -1);
  const choices = approval.approvedUnits(state.queue).filter((u) => u.subject === 'MATH');
  assert.deepEqual(choices.map((u) => u.id), [unit.id]);

  // The "log session" button: slot, subject, unit and outcome read from the selects.
  state.log = session.logSession(state.log, state.queue, pair,
    { slot: pair.sharedSlots[0], subject: 'MATH', unitId: unit.id, outcome: 'held' });
  state.log = session.logSession(state.log, state.queue, pair,
    { slot: pair.sharedSlots[0], subject: 'MATH', unitId: unit.id, outcome: 'missed' });
  assert.equal(state.log.entries.length, 2);
  assert.equal(state.log.nextSeq - 1, 2, 'the status line reports the seq of the row just written');

  // The municipality card: counts only.
  const s = session.summarize(state.log);
  assert.equal(s.sessions, 2);
  assert.deepEqual(s.byOutcome, { held: 1, missed: 1 });
  assert.deepEqual(s.byRegion, { CENTER: 2 });
  assert.deepEqual(s.bySubject, { MATH: 2 });
  assert.deepEqual(s.byUnit, { [unit.id]: 2 });

  // Round trip through the store, exactly what save() and load() do on the screen.
  const text = serialize(state);
  assert.equal(/Index|student|pupil|name|email|phone/i.test(JSON.stringify(state.log)), false,
    'the stored log must not point at anyone');
  const loaded = deserialize(text);
  assert.deepEqual(loaded.log, state.log);
  assert.deepEqual(session.summarize(loaded.log), s);

  // After a load the pairs are recomputed from the roster, not stored: same roster, same pairs.
  assert.deepEqual(pairsOf(loaded.people), pairs);
});

test('sessions screen: the CSV export is session.reportCsv over the stored log, never assembled on the screen', () => {
  for (const id of ['exportReport', 'reportBox', 'reportText', 'reportStatus']) {
    assert.ok(shell.indexOf('id="' + id + '"') !== -1, 'missing #' + id);
  }
  assert.ok(/<textarea id="reportText" readonly/.test(shell), 'the report box is read-only');
  assert.ok(sessionsBlock.indexOf('session.reportCsv(') !== -1, 'the export must come from the module');
  assert.equal(/measure|join\(','\)|','\s*\+/.test(sessionsBlock), false, 'the screen must not build a CSV line itself');
  // The export cannot leave the device by itself: no download link, no object URL, no send.
  assert.equal(/createObjectURL|download|Blob\(/.test(sessionsBlock), false);
  // Replay: the same log the summary card shows gives the same report, with the counts and nothing else.
  let state = { people: DEMO.map(makeProfile), queue: emptyState().queue, log: emptyState().log };
  const pair = pairsOf(state.people)[0];
  const unit = makeUnit({ title: 'שברים פשוטים', subject: 'MATH', durationMinutes: 20, body: 'פיצה שחולקה ל-8.' });
  state.queue = approval.approve(approval.submit(state.queue, unit), unit.id);
  state.log = session.logSession(state.log, state.queue, pair,
    { slot: pair.sharedSlots[0], subject: 'MATH', unitId: unit.id, outcome: 'held' });
  const text = session.reportCsv(state.log);
  assert.equal(text, 'measure,code,count\nsessions,,1\noutcome,held,1\nregion,CENTER,1\nsubject,MATH,1\nunit,' + unit.id + ',1\n');
  // The status line counts the rows of counts: the lines minus the header and the trailing newline.
  assert.equal(text.split('\n').length - 2, 5);
  assert.equal(session.reportCsv(deserialize(serialize(state)).log), text, 'the export survives a save and a load');
});

test('sessions screen: a pending unit, a foreign subject or an extra key never reaches the log', () => {
  const state = { people: DEMO.map(makeProfile), queue: emptyState().queue, log: emptyState().log };
  const pair = pairsOf(state.people)[0];
  const pending = makeUnit({ title: 'משפט פיתגורס', subject: 'MATH', durationMinutes: 10, body: 'שלוש דוגמאות.' });
  const physics = makeUnit({ title: 'כוחות', subject: 'PHYSICS', durationMinutes: 30, body: 'חוק שני של ניוטון.' });
  state.queue = approval.submit(state.queue, pending);
  state.queue = approval.approve(approval.submit(state.queue, physics), physics.id);

  assert.throws(() => session.logSession(state.log, state.queue, pair,
    { slot: pair.sharedSlots[0], subject: 'MATH', unitId: pending.id, outcome: 'held' }), /not approved/);
  // PHYSICS is approved, but pair 1 does not share it: the subject select would never offer it.
  assert.throws(() => session.logSession(state.log, state.queue, pair,
    { slot: pair.sharedSlots[0], subject: 'PHYSICS', unitId: physics.id, outcome: 'held' }), /invalid subject/);
  assert.throws(() => session.logSession(state.log, state.queue, pair,
    { slot: pair.sharedSlots[0], subject: 'MATH', unitId: pending.id, outcome: 'held', pupil: 'דנה' }), /personal data/);
  // With no pair at all - an empty roster - the screen refuses before calling the module.
  assert.equal(pairsOf([]).length, 0);
  assert.equal(state.log.entries.length, 0);
});

test('sessions screen: the pair dropdown names the same list numbers as the match screen', () => {
  const $ = openApp();
  $('demoBtn').fire('click');
  $('runMatch').fire('click');
  const m = text($('pairs').innerHTML).match(/סטודנט מלמד #(\d+) עם תלמיד #(\d+)/);
  assert.ok(m, text($('pairs').innerHTML));
  $('nav-sessions').fire('click');
  assert.match($('sessionPair').innerHTML, new RegExp('סטודנט מלמד #' + m[1] + ' עם תלמיד #' + m[2]));
});

test('sessions screen: form selects have informative empty state options on load', () => {
  const $ = openApp();
  assert.equal($('sessionPair').disabled, true);
  assert.match($('sessionPair').innerHTML, /אין עדיין זוגות משודכים/);
  assert.equal($('sessionSlot').disabled, true);
  assert.match($('sessionSlot').innerHTML, /אין שעות פנויות לבחירה/);
  assert.equal($('sessionSubject').disabled, true);
  assert.match($('sessionSubject').innerHTML, /אין מקצועות משותפים לבחירה/);
  assert.equal($('sessionUnit').disabled, true);
  assert.match($('sessionUnit').innerHTML, /אין יחידה לבחירה — בחר זוג תחילה/);
});

test('sessions screen: report export with one count line reads as Hebrew "שורה אחת"', () => {
  const $ = openApp();
  $('exportReport').fire('click');
  assert.match($('reportStatus').textContent, /שורה אחת של ספירות/);
  assert.doesNotMatch($('reportStatus').textContent, /1 שורות/);
});

test('sessions screen: a report exported from an empty log says the log is empty', () => {
  const $ = openApp();
  $('exportReport').fire('click');
  assert.match($('reportStatus').textContent, /0 שיעורים, כי היומן ריק/);
  assert.match($('reportText').value, /^sessions,,0$/m);
});



test('sessions screen: an open report that follows a newly logged lesson says so, not the old count and copy', () => {
  const $ = openApp();
  $('demoBtn').fire('click');
  $('unitDemoBtn').fire('click');
  $('submitUnit').fire('click');
  const id = /מזהה: (\S+)/.exec($('unitStatus').textContent)[1];
  $('pendingList').fire('click', { target: { getAttribute: (k) => (k === 'data-approve' ? id : null) } });
  $('exportReport').fire('click');
  assert.match($('reportStatus').textContent, /שורה אחת של ספירות/);

  $('sessionPair').value = '0';
  $('sessionSlot').value = 'SUN_16';
  $('sessionSubject').value = 'MATH';
  $('sessionUnit').value = id;
  $('sessionOutcome').value = 'held';
  $('logSession').fire('click');
  assert.match($('reportText').value, /^sessions,,1$/m);
  const lines = $('reportText').value.split('\n').length - 2;
  assert.match($('reportStatus').textContent, new RegExp('הדוח שבתיבה עודכן: ' + lines + ' שורות'));
  assert.doesNotMatch($('reportStatus').textContent, /שורה אחת|הועתק גם ללוח/);
});
