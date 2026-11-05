'use strict';
// Guardian-review regressions: raw caller data must never reach pair output, a zero capacity must
// never become one, and the coordinator flow must not call a partial run complete.
const test = require('node:test');
const assert = require('node:assert/strict');
const { match2, rematchPartial, scorePair } = require('../src/lib/match2.js');
const { parseAvailabilityCsv } = require('../src/lib/import-availability.js');
const { runCoordinatorFlow } = require('../src/lib/flow.js');
const { reportToIcs } = require('../src/lib/reports.js');
const { makeSemester, isTeachingDay } = require('../src/lib/semester.js');

const S = (o) => Object.assign({ region: 'CENTER', availability: ['SUN_8', 'SUN_9'], subjects: ['MATH'], level: 3, languages: ['HE'] }, o);
const P = (o) => Object.assign({ region: 'CENTER', availability: ['SUN_8'], subjects: ['MATH'], level: 3, languages: ['HE'], parentConsent: true }, o);

test('hardening: personal-looking raw fields cannot leak into explanation', () => {
  const r = match2([S({ languages: ['call-me', 'HE'] })], [P({ region: 'Dana 050-1234567', languages: ['call-me', 'HE'] })]);
  assert.equal(r.pairs.length, 1);
  assert.ok(!/Dana|050|call-me/.test(r.pairs[0].explanationHe), r.pairs[0].explanationHe);
  assert.deepEqual(r.pairs[0].sharedLanguages, ['HE']);
});

test('hardening: explicit maxPupils 0 pairs nobody; absent criteria earn no credit', () => {
  assert.equal(match2([S({ maxPupils: 0 })], [P()]).pairs.length, 0);
  assert.throws(() => match2([S({ maxPupils: -1 })], [P()]), /invalid maxPupils/);
  const bare = scorePair({ region: 'CENTER', availability: ['SUN_8'], subjects: ['MATH'] }, { region: 'CENTER', availability: ['SUN_8'], subjects: ['MATH'], parentConsent: true });
  assert.equal(bare.breakdown.levelCounted, false); assert.equal(bare.breakdown.languageCounted, false);
  assert.equal(scorePair(S(), P(), { region: 100 }).breakdown.region, 100); // partial weights merged with defaults
});

test('hardening: rematch tolerates stale pairs; import keeps physical lines and drops duplicates', () => {
  const students = [S({ maxPupils: 1 })]; const pupils = [P(), P()];
  const again = rematchPartial(students, pupils, [{ studentIndex: 0, pupilIndex: 0 }, { studentIndex: 0, pupilIndex: 1 }, { studentIndex: 0, pupilIndex: 0 }], {});
  assert.equal(again.pairs.length, 1);
  const imp = parseAvailabilityCsv('role,region,subjects,availability\n\nstudent,CENTER,MATH,SUN_8\nstudent,CENTER,MATH,SUN_8\nstudent,MOON,MATH,SUN_8');
  assert.deepEqual(imp.errors.map((e) => [e.line, e.reason]), [[4, 'DUPLICATE_ROW'], [5, 'INVALID_REGION']]);
});

test('hardening: flow is partial (not ok) when a row is refused; ICS cannot be injected', () => {
  const r = runCoordinatorFlow({
    csvText: 'role,region,subjects,availability\nstudent,CENTER,MATH,SUN_8\npupil,CENTER,MATH,SUN_8\npupil,MOON,MATH,SUN_8',
    parentConsentPupilIndexes: [0],
    semester: { startDate: '2026-09-06', endDate: '2026-09-30', holidays: [] }
  });
  assert.equal(r.ok, false); assert.equal(r.partial, true); assert.equal(r.counts.importErrors, 1);
  const ics = reportToIcs([{ pairIndex: '1\r\nSUMMARY:pwned', date: '2026-09-06', slot: 'SUN_8' }, { pairIndex: 2, date: '2026-09-06', slot: 'SUN_22', durationMinutes: 90, subject: 'MATH' }]);
  assert.ok(!/pwned/.test(ics)); assert.match(ics, /DTEND:20260906T233000/);
  const sem = makeSemester({ startDate: '2025-12-14', endDate: '2025-12-24' }); // inside Hanukkah break range
  assert.equal(isTeachingDay(sem, '2025-12-17'), false);
});
