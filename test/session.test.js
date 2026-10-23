'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');

const {
  emptyLog, logSession, summarize, reportCsv, REPORT_HEADER, loadLog, OUTCOMES, ACCEPTED_FIELDS, UNIT_NOT_APPROVED_ERROR
} = require('../src/lib/session.js');
const { emptyQueue, submit, approve, reject } = require('../src/lib/approval.js');
const { makeUnit } = require('../src/lib/unit.js');
const { makeProfile, PERSONAL_DATA_ERROR } = require('../src/lib/profile.js');
const { matchPairs } = require('../src/lib/match.js');

const MATH = makeUnit({ title: 'משוואות ריבועיות', subject: 'MATH', durationMinutes: 20, body: 'פותרים שלוש משוואות.' });
const PHYSICS = makeUnit({ title: 'חוק ניוטון השני', subject: 'PHYSICS', durationMinutes: 15, body: 'כוח שווה מסה כפול תאוצה.' });
const PENDING = makeUnit({ title: 'משפט פיתגורס', subject: 'MATH', durationMinutes: 10, body: 'שלוש דוגמאות.' });
const REJECTED = makeUnit({ title: 'גבולות', subject: 'MATH', durationMinutes: 10, body: 'שתי דוגמאות.' });

// MATH and PHYSICS approved, PENDING still pending, REJECTED rejected with a reason.
const QUEUE = reject(
  submit(submit(approve(approve(submit(submit(emptyQueue(), MATH), PHYSICS), MATH.id), PHYSICS.id), PENDING), REJECTED),
  REJECTED.id,
  'לא מתאים'
);

const STUDENT = makeProfile({ role: 'student', region: 'SOUTH', availability: ['SUN_16', 'MON_18'], subjects: ['MATH', 'PHYSICS'] });
const PUPIL = makeProfile({ role: 'pupil', region: 'SOUTH', availability: ['MON_18', 'TUE_17'], subjects: ['MATH', 'CS'], parentConsent: true });
const PAIR = matchPairs([STUDENT], [PUPIL])[0];
const HELD = { slot: 'MON_18', subject: 'MATH', unitId: MATH.id, outcome: 'held' };

test('session: the pair from matchPairs is the input the log is written for', () => {
  assert.deepEqual(PAIR, {
    studentIndex: 0, pupilIndex: 0, region: 'SOUTH', sharedSlots: ['MON_18'], sharedSubjects: ['MATH']
  });
});

test('session: a logged session is a new frozen log with region, slot, subject, unit id and outcome only', () => {
  const l0 = emptyLog();
  const l1 = logSession(l0, QUEUE, PAIR, HELD);
  assert.notEqual(l1, l0);
  assert.deepEqual(l0.entries, []);
  assert.equal(Object.isFrozen(l1), true);
  assert.equal(Object.isFrozen(l1.entries), true);
  assert.equal(Object.isFrozen(l1.entries[0]), true);
  assert.deepEqual(l1.entries, [
    { region: 'SOUTH', slot: 'MON_18', subject: 'MATH', unitId: MATH.id, outcome: 'held', seq: 1 }
  ]);
  assert.equal(l1.nextSeq, 2);
});

test('session: the roster positions of the pair never reach the log, and no key could hold a name', () => {
  const l = logSession(logSession(emptyLog(), QUEUE, PAIR, HELD), QUEUE, PAIR,
    { slot: 'MON_18', subject: 'MATH', unitId: MATH.id, outcome: 'missed' });
  const text = JSON.stringify(l);
  assert.equal(/Index|student|pupil|name|email|phone/i.test(text), false);
  assert.deepEqual(Object.keys(l.entries[1]).sort(), ['outcome', 'region', 'seq', 'slot', 'subject', 'unitId']);
  assert.deepEqual(ACCEPTED_FIELDS, ['slot', 'subject', 'unitId', 'outcome']);
});

test('session: any key outside the accepted fields is refused as personal data, before anything else', () => {
  for (const extra of [{ pupil: 'דנה' }, { note: '' }, { studentIndex: 0 }, { '': '' }]) {
    assert.throws(() => logSession(emptyLog(), QUEUE, PAIR, Object.assign({ outcome: 'bogus' }, extra)),
      { message: PERSONAL_DATA_ERROR });
  }
});

test('session: a pair whose shared lists hold anything but codes is not a pair from matchPairs', () => {
  const bad = (patch) => Object.assign({}, PAIR, patch);
  // a hand-built pair with the one spelling makeProfile never writes wrote a row loadLog then refused
  const pair08 = bad({ sharedSlots: ['SUN_08'] });
  assert.throws(() => logSession(emptyLog(), QUEUE, pair08, Object.assign({}, HELD, { slot: 'SUN_08' })),
    /expected a pair from matchPairs/);
  for (const slots of [['SUN_8', 'MON_018'], ['דנה כהן'], ['0501234567'], [], 'MON_18', null]) {
    assert.throws(() => logSession(emptyLog(), QUEUE, bad({ sharedSlots: slots }), HELD), /expected a pair from matchPairs/);
  }
  for (const subjects of [['MATH', 'ART'], ['דנה כהן'], [''], [], 'MATH', null]) {
    assert.throws(() => logSession(emptyLog(), QUEUE, bad({ sharedSubjects: subjects }), HELD),
      /expected a pair from matchPairs/);
  }
  // so every slot the log holds is canonical and the saved state reloads
  const l = logSession(emptyLog(), QUEUE, PAIR, HELD);
  assert.deepEqual(loadLog(JSON.parse(JSON.stringify(l)), QUEUE), l);
});

test('session: a slot or a subject the pair does not share is refused', () => {
  assert.throws(() => logSession(emptyLog(), QUEUE, PAIR, Object.assign({}, HELD, { slot: 'SUN_16' })), /slot the pair shares/);
  assert.throws(() => logSession(emptyLog(), QUEUE, PAIR, Object.assign({}, HELD, { slot: 'MON_7' })), /slot the pair shares/);
  assert.throws(() => logSession(emptyLog(), QUEUE, PAIR, Object.assign({}, HELD, { subject: 'PHYSICS', unitId: PHYSICS.id })),
    /subject the pair shares/);
  assert.throws(() => logSession(emptyLog(), QUEUE, PAIR, Object.assign({}, HELD, { subject: 'ART' })), /subject the pair shares/);
});

test('session: only an approved unit can be taught - pending, rejected and unknown ids are refused', () => {
  for (const id of [PENDING.id, REJECTED.id, 'u-0000000000000000', 42, undefined]) {
    assert.throws(() => logSession(emptyLog(), QUEUE, PAIR, Object.assign({}, HELD, { unitId: id })),
      { message: UNIT_NOT_APPROVED_ERROR });
  }
});

test('session: the subject must be the subject of the unit that was taught', () => {
  const wide = { region: 'SOUTH', sharedSlots: ['MON_18'], sharedSubjects: ['MATH', 'PHYSICS'] };
  assert.throws(() => logSession(emptyLog(), QUEUE, wide, Object.assign({}, HELD, { unitId: PHYSICS.id })),
    /subject of the unit/);
  assert.equal(logSession(emptyLog(), QUEUE, wide, { slot: 'MON_18', subject: 'PHYSICS', unitId: PHYSICS.id, outcome: 'held' })
    .entries[0].subject, 'PHYSICS');
});

test('session: the outcome is one of the fixed codes', () => {
  assert.deepEqual(OUTCOMES, ['held', 'missed', 'cut_short']);
  assert.throws(() => logSession(emptyLog(), QUEUE, PAIR, Object.assign({}, HELD, { outcome: 'great' })), /invalid outcome/);
  assert.throws(() => logSession(emptyLog(), QUEUE, PAIR, Object.assign({}, HELD, { outcome: 'HELD' })), /invalid outcome/);
});

test('session: a bad log, pair or queue is an error, not a silent drop', () => {
  assert.throws(() => logSession({ entries: [] }, QUEUE, PAIR, HELD), /invalid log/);
  assert.throws(() => logSession(emptyLog(), QUEUE, { region: 'SOUTH' }, HELD), /invalid pair/);
  assert.throws(() => logSession(emptyLog(), QUEUE, Object.assign({}, PAIR, { region: 'MARS' }), HELD), /invalid pair/);
  assert.throws(() => logSession(emptyLog(), {}, PAIR, HELD), /invalid queue/);
  assert.throws(() => logSession(emptyLog(), QUEUE, PAIR, 'MON_18'), /session input must be an object/);
});

test('session: the summary is counts only and the same for the same log', () => {
  const north = { region: 'NORTH', sharedSlots: ['TUE_17'], sharedSubjects: ['PHYSICS'] };
  let l = emptyLog();
  l = logSession(l, QUEUE, PAIR, HELD);
  l = logSession(l, QUEUE, PAIR, Object.assign({}, HELD, { outcome: 'missed' }));
  l = logSession(l, QUEUE, north, { slot: 'TUE_17', subject: 'PHYSICS', unitId: PHYSICS.id, outcome: 'held' });
  const s = summarize(l);
  assert.equal(Object.isFrozen(s), true);
  assert.deepEqual(s, {
    sessions: 3,
    byRegion: { SOUTH: 2, NORTH: 1 },
    bySubject: { MATH: 2, PHYSICS: 1 },
    byOutcome: { held: 2, missed: 1 },
    byUnit: { [MATH.id]: 2, [PHYSICS.id]: 1 }
  });
  assert.deepEqual(summarize(l), s);
  assert.deepEqual(summarize(emptyLog()), { sessions: 0, byRegion: {}, bySubject: {}, byOutcome: {}, byUnit: {} });
});

test('session: the CSV report is the summary and nothing else - fixed order, sorted codes, same text for the same log', () => {
  const north = { region: 'NORTH', sharedSlots: ['TUE_17'], sharedSubjects: ['PHYSICS'] };
  let l = emptyLog();
  l = logSession(l, QUEUE, north, { slot: 'TUE_17', subject: 'PHYSICS', unitId: PHYSICS.id, outcome: 'held' });
  l = logSession(l, QUEUE, PAIR, Object.assign({}, HELD, { outcome: 'missed' }));
  l = logSession(l, QUEUE, PAIR, HELD);
  const text = reportCsv(l);
  assert.equal(REPORT_HEADER, 'measure,code,count');
  // Unit ids are hashes, so their order in the report is the sorted order of the ids, not of the log.
  const units = [['unit,' + MATH.id + ',2', MATH.id], ['unit,' + PHYSICS.id + ',1', PHYSICS.id]]
    .sort((a, b) => (a[1] < b[1] ? -1 : 1)).map((u) => u[0]);
  assert.deepEqual(text.split('\n'), [
    'measure,code,count',
    'sessions,,3',
    'outcome,held,2',
    'outcome,missed,1',
    'region,NORTH,1',
    'region,SOUTH,2',
    'subject,MATH,2',
    'subject,PHYSICS,1',
    units[0],
    units[1],
    ''
  ]);
  assert.equal(reportCsv(l), text);
  assert.equal(text.indexOf('\r'), -1, 'LF only, whatever the platform');
  // Every number in the report is a count from summarize(): the rows of the log are not in it.
  const s = summarize(l);
  const counted = text.split('\n').filter((line) => line && line !== REPORT_HEADER).length;
  assert.equal(counted, 1 + Object.keys(s.byOutcome).length + Object.keys(s.byRegion).length +
    Object.keys(s.bySubject).length + Object.keys(s.byUnit).length);
  assert.equal(/slot|seq|MON_|TUE_|Index|student|pupil|name|email|phone/i.test(text), false,
    'no slot, no sequence number, nothing that points at a row or a person');
  // An empty log still exports: the header and a zero, so a municipality sees "nothing yet", not an error.
  assert.equal(reportCsv(emptyLog()), 'measure,code,count\nsessions,,0\n');
  assert.throws(() => reportCsv({ entries: [] }), /invalid log/);
});

test('session: a stored log round-trips through JSON and is re-checked against the queue on load', () => {
  const l = logSession(logSession(emptyLog(), QUEUE, PAIR, HELD), QUEUE, PAIR,
    Object.assign({}, HELD, { outcome: 'cut_short' }));
  const back = loadLog(JSON.parse(JSON.stringify(l)), QUEUE);
  assert.deepEqual(back, l);
  assert.equal(Object.isFrozen(back.entries[1]), true);
  // the queue the log is loaded with decides: with the unit no longer approved, the row is refused
  const queueWithout = submit(submit(emptyQueue(), MATH), PHYSICS);
  assert.throws(() => loadLog(JSON.parse(JSON.stringify(l)), queueWithout), { message: UNIT_NOT_APPROVED_ERROR });
  // nextSeq is repaired from the rows when it is missing or stale
  assert.equal(loadLog({ entries: JSON.parse(JSON.stringify(l.entries)) }, QUEUE).nextSeq, 3);
});

test('session: a lesson already logged still loads after its unit is revised, pending or rejected', () => {
  const l = logSession(emptyLog(), QUEUE, PAIR, HELD);
  const fixed = makeUnit({ title: MATH.title, subject: 'MATH', durationMinutes: 20, body: 'פותרים ארבע משוואות.' });
  const revised = submit(QUEUE, fixed);
  assert.equal(revised.entries[MATH.id].status, 'pending');
  assert.deepEqual(loadLog(JSON.parse(JSON.stringify(l)), revised), l);
  assert.deepEqual(loadLog(JSON.parse(JSON.stringify(l)), reject(revised, MATH.id, 'עוד לא')), l);
  // a new lesson on the revised text still waits for the approver
  assert.throws(() => logSession(l, revised, PAIR, HELD), { message: UNIT_NOT_APPROVED_ERROR });
  // a unit on its first text was never approved: a stored row on it is still refused
  const neverApproved = Object.assign({}, HELD, { unitId: PENDING.id });
  assert.throws(() => loadLog({ entries: [Object.assign({ region: 'SOUTH', seq: 1 }, neverApproved)] }, QUEUE),
    { message: UNIT_NOT_APPROVED_ERROR });
});

test('session: a seq or nextSeq past the safe integers is refused, so two rows can never share a seq', () => {
  const row = { region: 'SOUTH', slot: 'MON_18', subject: 'MATH', unitId: MATH.id, outcome: 'held', seq: 1 };
  const top = Number.MAX_SAFE_INTEGER - 1;
  // past 2^53, seq + 1 === seq: such a row would make the next one a duplicate and the log unloadable
  assert.throws(() => loadLog({ entries: [Object.assign({}, row, { seq: 2 ** 53 })] }, QUEUE), /seq out of order/);
  assert.throws(() => loadLog({ entries: [Object.assign({}, row, { seq: 1e300 })] }, QUEUE), /seq out of order/);
  // a nextSeq out of range is repaired from the rows, like a missing or stale one
  assert.equal(loadLog({ nextSeq: 2 ** 53, entries: [row] }, QUEUE).nextSeq, 2);
  // the last usable seq is still written and reloads; after it the log refuses to grow instead of repeating
  const full = loadLog({ entries: [Object.assign({}, row, { seq: top })] }, QUEUE);
  assert.equal(full.nextSeq, top + 1);
  assert.deepEqual(loadLog(JSON.parse(JSON.stringify(full)), QUEUE), full);
  assert.throws(() => logSession(full, QUEUE, PAIR, HELD), /session log is full/);
  const last = loadLog({ entries: [Object.assign({}, row, { seq: top - 1 })] }, QUEUE);
  assert.equal(logSession(last, QUEUE, PAIR, HELD).entries[1].seq, top);
});

test('session: a row edited on disk cannot bring an extra key, a bad region or a reordered seq into the app', () => {
  const row = { region: 'SOUTH', slot: 'MON_18', subject: 'MATH', unitId: MATH.id, outcome: 'held', seq: 1 };
  assert.throws(() => loadLog({ entries: [Object.assign({}, row, { pupil: 'x' })] }, QUEUE), { message: PERSONAL_DATA_ERROR });
  assert.throws(() => loadLog({ entries: [Object.assign({}, row, { region: 'MARS' })] }, QUEUE), /bad region/);
  assert.throws(() => loadLog({ entries: [Object.assign({}, row, { slot: 'MON_7' })] }, QUEUE), /invalid slot/);
  // logSession only writes the canonical spelling of an hour, so a stored 'MON_018' or 'SUN_08' is refused
  assert.throws(() => loadLog({ entries: [Object.assign({}, row, { slot: 'MON_018' })] }, QUEUE), /invalid slot/);
  assert.throws(() => loadLog({ entries: [Object.assign({}, row, { slot: 'SUN_08' })] }, QUEUE), /invalid slot/);
  assert.equal(loadLog({ entries: [Object.assign({}, row, { slot: 'SUN_8' })] }, QUEUE).entries[0].slot, 'SUN_8');
  assert.throws(() => loadLog({ entries: [Object.assign({}, row, { outcome: 'x' })] }, QUEUE), /invalid outcome/);
  assert.throws(() => loadLog({ entries: [row, Object.assign({}, row, { seq: 1 })] }, QUEUE), /seq out of order/);
  assert.throws(() => loadLog({ entries: [null] }, QUEUE), /invalid stored session/);
  assert.throws(() => loadLog({ entries: {} }, QUEUE), /invalid stored log/);
  assert.throws(() => loadLog([], QUEUE), /invalid stored log/);
});

test('session: a stored log with a key beside the rows is refused as personal data, not dropped', () => {
  const stored = JSON.parse(JSON.stringify(logSession(emptyLog(), QUEUE, PAIR, HELD)));
  for (const key of ['coordinator', 'school', 'note']) {
    assert.throws(() => loadLog(Object.assign({}, stored, { [key]: 'x' }), QUEUE), { message: PERSONAL_DATA_ERROR });
  }
  assert.deepEqual(loadLog(stored, QUEUE), logSession(emptyLog(), QUEUE, PAIR, HELD));
});
