'use strict';
// Stage 14 anonymous E2E: need intake -> match, synthetic seeds only.
// Drives the real built app.html through the repo fake-DOM harness (the only
// in-repo browser surrogate: package.json has no browser automation deps, and
// no dependency may be installed for this). That is NOT a real-browser claim.
// Every seed below is a canonical code (role/region/subject/slot/consent) -
// no name, phone, email, id or free text is ever entered, and the assertions
// prove none lands in app state, localStorage, rendered pairs or downloads.
const test = require('node:test');
const assert = require('node:assert/strict');

const { openApp, addPerson, press, text } = require('../test-support/fake-dom.js');
const { runCoordinatorFlow } = require('../src/lib/flow.js');
const { makeProfile, PERSONAL_DATA_ERROR, SUBJECTS, DAYS } = require('../src/lib/profile.js');
const { createStore, memoryBackend, deserialize, DEFAULT_KEY } = require('../src/lib/store.js');
const { isTeachingDay } = require('../src/lib/semester.js');
const { ALL_LESSONS } = require('../src/lib/curriculum.js');
const i18n = require('../src/lib/i18n.js');

// Identifying-data shapes (mirrors validator.js kinds). Applied to every
// surface a seed could leak onto: stored JSON, rendered HTML, downloads.
const IDENT_RE = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}|(?:\+?972[-.\s]?|0)(?:5\d|7[2-9])[-.\s]?\d{3}[-.\s]?\d{4}|(?<!\d)\d{9}(?!\d)|https?:\/\/|www\./;
const ALLOWED_PERSON_KEYS = ['role', 'region', 'availability', 'subjects', 'parentConsent', 'blockedUsers', 'reportEvent', 'responseToReport', 'retention'];

function addPupilWithoutConsent($) {
  $('role').value = 'pupil';
  $('consentRow').hidden = false;
  $('consent').checked = false;
  $('region').value = 'CENTER';
  press($('subjects'), 'data-subject', 'MATH');
  press($('hours'), 'data-slot', 'SUN_8');
  $('addPerson').fire('click');
  assert.ok(!$('addStatus').className.includes('bad'), 'anonymous pupil intake must be accepted: ' + $('addStatus').textContent);
}

// Intake six anonymous people through the real form, then run both matches.
function seededApp() {
  const errors = [];
  const origError = console.error; const origWarn = console.warn;
  console.error = (...a) => { errors.push(a.join(' ')); };
  console.warn = (...a) => { errors.push(a.join(' ')); };
  try {
    const $ = openApp();
    addPerson($, 'student', 'CENTER', ['MATH', 'ENGLISH'], ['SUN_8', 'SUN_9', 'MON_8']); // #1
    addPerson($, 'student', 'CENTER', ['MATH'], ['SUN_8']); // #2
    addPerson($, 'pupil', 'CENTER', ['MATH'], ['SUN_8', 'SUN_9']); // #3, consent via form
    addPerson($, 'pupil', 'CENTER', ['ENGLISH'], ['SUN_9']); // #4, consent via form
    addPupilWithoutConsent($); // #5, no parent consent: must stay unmatched
    addPerson($, 'pupil', 'NORTH', ['MATH'], ['SUN_8']); // #6, consent but no NORTH student
    $('runMatch').fire('click');
    $('runMatch2').fire('click');
    return { $, errors };
  } finally {
    console.error = origError; console.warn = origWarn;
  }
}

test('stage14 anon e2e: form intake -> match pairs only consented pupils, no console errors', () => {
  const { $, errors } = seededApp();
  assert.deepEqual(errors, [], 'no console error/warning while loading, seeding or matching');
  assert.equal($('addStatus').className.includes('bad'), false);
  const pairs = text($('pairs').innerHTML);
  assert.match(pairs, /#1/, pairs);
  assert.match(pairs, /#4/, pairs);
  assert.match(pairs, /#2/, pairs);
  assert.match(pairs, /#3/, pairs);
  assert.match($('matchStatus').textContent, /2 זוגות/);
  assert.match($('match2Status').textContent, /נוצרו 2 זוגות\. ציון כולל: \d+\./);
  const left = text($('unmatched').innerHTML);
  assert.match(left, /#5/, 'pupil without parent consent is listed as unmatched');
  assert.match(left, /#6/, 'consented pupil with no regional student is listed as unmatched');
  assert.doesNotMatch(left, /#3|#4/, 'matched pupils are not also listed as unmatched');
  // stage-14 lesson timeline still renders after intake and matching
  assert.equal(($('todayLesson').innerHTML.match(/class="tl-step"/g) || []).length, ALL_LESSONS[0].flowHe.length);
  assert.equal($.downloads.length, 0, 'intake and matching download nothing');
});

test('stage14 anon e2e: no identifying data in localStorage, rendered pairs or pair explanations', () => {
  const { $ } = seededApp();
  assert.deepEqual(Object.keys($.store), [DEFAULT_KEY], 'only the one app key is written');
  const raw = $.store[DEFAULT_KEY];
  assert.doesNotMatch(raw, IDENT_RE, 'stored JSON carries no email/phone/id/url');
  const doc = JSON.parse(raw);
  assert.deepEqual(Object.keys(doc).sort(), ['attendance', 'log', 'people', 'queue', 'schema']);
  assert.equal(doc.schema, 'peered/1');
  assert.equal(doc.people.length, 6);
  for (const person of doc.people) {
    for (const key of Object.keys(person)) assert.ok(ALLOWED_PERSON_KEYS.includes(key), 'stored person key is an accepted field: ' + key);
    assert.deepEqual(Object.keys(person.retention).sort(), ['dataCategory', 'maxAgeDays']);
    assert.ok(['student', 'pupil'].includes(person.role));
    assert.ok(/^[A-Z_]+$/.test(person.region), 'region is a canonical code: ' + person.region);
    for (const s of person.subjects) assert.ok(SUBJECTS.includes(s), 'subject is a canonical code: ' + s);
    for (const slot of person.availability) assert.ok(/^(SUN|MON|TUE|WED|THU|FRI|SAT)_([89]|1\d|2[0-2])$/.test(slot), 'slot is canonical: ' + slot);
    if (person.role === 'pupil') assert.equal(typeof person.parentConsent, 'boolean');
  }
  // the stored document re-validates through the real storage gate, unchanged
  assert.deepEqual(deserialize(raw).people.length, 6);
  const surfaces = raw + $('pairs').innerHTML + $('unmatched').innerHTML + $('match2Out').innerHTML + $('peopleList').innerHTML;
  assert.doesNotMatch(surfaces, IDENT_RE);
  assert.doesNotMatch(surfaces, /Synthetic|seed@example|050-|12345678/, 'no synthetic identifier appears on any surface');
});

test('stage14 anon e2e: identifying intake is refused at every gate and stored nowhere', () => {
  const clean = ['role,region,subjects,availability',
    'student,CENTER,MATH;ENGLISH,SUN_8;SUN_9;MON_8',
    'pupil,CENTER,MATH,SUN_8;SUN_9',
    'pupil,CENTER,ENGLISH,SUN_9'].join('\n');
  for (const poison of ['seed@example.test', '050-1234567', '123456789']) {
    const r = runCoordinatorFlow({
      csvText: clean + '\npupil,CENTER,MATH,' + poison,
      parentConsentPupilIndexes: [0, 1],
      semester: { startDate: '2026-09-06', endDate: '2026-09-30', holidays: [] }
    });
    assert.equal(r.ok, false, poison);
    assert.equal(r.stage, 'import', poison + ' stops at intake, nothing downstream runs');
    assert.match(r.error, /personal data/);
  }
  for (const key of ['name', 'phone', 'email', 'idNumber']) {
    assert.throws(
      () => makeProfile({ role: 'pupil', region: 'CENTER', availability: ['SUN_8'], subjects: ['MATH'], [key]: 'synthetic' }),
      (e) => e.message === PERSONAL_DATA_ERROR, key + ' key is refused by makeProfile');
  }
  // a hand-edited stored document carrying a name is refused on load and kept aside, never loaded
  const backend = memoryBackend();
  const store = createStore(backend);
  backend.setItem(DEFAULT_KEY, JSON.stringify({
    schema: 'peered/1',
    people: [{ role: 'pupil', region: 'CENTER', availability: ['SUN_8'], subjects: ['MATH'], name: 'Synthetic Name' }],
    queue: { entries: {} }, log: { entries: [] }
  }));
  const loaded = store.load();
  assert.equal(loaded.problem, PERSONAL_DATA_ERROR);
  assert.equal(loaded.state.people.length, 0, 'refused roster is not loaded into app state');
  assert.equal(loaded.kept, true, 'refused document is kept in the rejected slot, not silently dropped');
});

test('stage14 anon e2e: CSV intake -> match is deterministic and calendar-safe', () => {
  const input = {
    csvText: ['role,region,subjects,availability',
      'student,CENTER,MATH;ENGLISH,SUN_8;SUN_9;MON_8',
      'student,CENTER,MATH,SUN_8',
      'pupil,CENTER,MATH,SUN_8;SUN_9',
      'pupil,CENTER,ENGLISH,SUN_9',
      'pupil,NORTH,MATH,SUN_8'].join('\n'),
    parentConsentPupilIndexes: [0, 1], // third pupil: no consent, must stay unmatched
    semester: { startDate: '2026-09-06', endDate: '2026-09-30', holidays: [] },
    scheduleOpts: { weeks: 2 },
    dtstamp: '20260901T000000Z'
  };
  const r = runCoordinatorFlow(input);
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.equal(r.matching.pairs.length, 2);
  assert.deepEqual(r.matching.unmatchedPupils, [{ pupilIndex: 2, reason: 'NO_PARENT_CONSENT' }]);
  for (const pair of r.matching.pairs) {
    assert.doesNotMatch(JSON.stringify(pair), IDENT_RE, 'pair record holds codes and scores only');
    assert.ok(pair.sharedSlots.length > 0 && pair.sharedSubjects.length > 0);
  }
  // calendar regression: every dated session lands on its slot weekday, inside
  // the semester, on a teaching day (never a holiday / Fri / Sat)
  assert.ok(r.dated.sessions.length >= 2);
  for (const s of r.dated.sessions) {
    const dayCode = s.slot.split('_')[0];
    assert.equal(new Date(s.date + 'T00:00:00Z').getUTCDay(), DAYS.indexOf(dayCode), s.date + ' is a ' + dayCode);
    assert.ok(s.date >= r.semester.startDate && s.date <= r.semester.endDate, s.date + ' inside the semester');
    assert.equal(isTeachingDay(r.semester, s.date), true, s.date + ' is a teaching day');
  }
  const again = runCoordinatorFlow(input);
  assert.deepEqual(again.matching.pairs, r.matching.pairs, 'same anonymous seeds, same match');
  assert.deepEqual(again.dated.sessions.map((s) => s.date), r.dated.sessions.map((s) => s.date), 'same calendar expansion');
});

test('stage14 anon e2e: matching renders in Hebrew, Arabic and Russian, and Hebrew days return', () => {
  assert.equal(i18n.verifyLanguageParity().ok, true);
  assert.equal(i18n.dirFor('he'), 'rtl'); assert.equal(i18n.dirFor('ar'), 'rtl'); assert.equal(i18n.dirFor('ru'), 'ltr');
  const { $, errors } = seededApp();
  const expected = { he: /מרכז/, ar: /المركز/, ru: /Центр/ };
  for (const lang of ['he', 'ar', 'ru', 'he']) {
    $('langSelect').value = lang;
    $('langSelect').fire('change');
    $('runMatch').fire('click');
    const pairs = text($('pairs').innerHTML);
    assert.match(pairs, expected[lang], lang + ' pair renders its region name: ' + pairs);
    assert.match($('matchStatus').textContent, /2/, lang + ' match still produces both pairs');
    assert.equal(($('todayLesson').innerHTML.match(/class="tl-step"/g) || []).length,
      ALL_LESSONS[0].flowHe.length, lang + ' keeps the stage-14 timeline');
  }
  // after ar -> ru -> he the slot day names are Hebrew again (regression: DAY_NAMES.he was null)
  const pairsHe = text($('pairs').innerHTML);
  assert.match(pairsHe, /יום א/, 'Hebrew day name restored after language round-trip: ' + pairsHe);
  assert.doesNotMatch(pairsHe, /Вс|الأحد/, 'no stale Russian/Arabic day name after returning to Hebrew');
  assert.deepEqual(errors, [], 'no console errors across language switches');
});
