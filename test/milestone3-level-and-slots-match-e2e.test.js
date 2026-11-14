'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const profile = require('../src/lib/profile.js');
const match2 = require('../src/lib/match2.js');
const { openApp, press, text } = require('../test-support/fake-dom.js');

function addPersonWithLevel($, role, region, subjects, slots, aiLevel) {
  $('role').value = role;
  $('consentRow').hidden = role !== 'pupil';
  if (role === 'pupil') $('consent').checked = true;
  $('region').value = region;
  $('consent').checked = role === 'pupil';
  if ($('participantAiLevelSelect')) {
    $('participantAiLevelSelect').value = aiLevel || '';
  }
  for (const s of subjects) {
    press($('subjects'), 'data-subject', s);
  }
  for (const s of slots) {
    press($('hours'), 'data-slot', s);
  }
  $('addPerson').fire('click');
  if ($('addStatus').className.includes('bad')) {
    throw new Error(`add refused: ${$('addStatus').textContent}`);
  }
}

test('1. getWeeklyOverlapSlots: correctly calculates intersecting weekly time windows between participants', () => {
  const personA = {
    availability: ['SUN_10', 'MON_18', 'TUE_16']
  };
  const personB = {
    availability: ['MON_18', 'WED_14', 'SUN_10']
  };

  const overlap1 = profile.getWeeklyOverlapSlots(personA, personB);
  const overlap2 = match2.getWeeklyOverlapSlots(personA, personB);

  assert.deepEqual(overlap1, ['MON_18', 'SUN_10']);
  assert.deepEqual(overlap2, ['MON_18', 'SUN_10']);

  // Accepts raw arrays of slot strings as well
  const rawOverlap = profile.getWeeklyOverlapSlots(['TUE_16', 'WED_14'], ['WED_14', 'THU_10']);
  assert.deepEqual(rawOverlap, ['WED_14']);

  // Normalizes slots with leading zero (e.g. SUN_08 -> SUN_8)
  const normOverlap = profile.getWeeklyOverlapSlots(['SUN_08', 'MON_18'], ['SUN_8', 'TUE_10']);
  assert.deepEqual(normOverlap, ['SUN_8']);

  // No overlap returns empty array
  const emptyOverlap = profile.getWeeklyOverlapSlots(['SUN_10'], ['MON_18']);
  assert.deepEqual(emptyOverlap, []);

  // Gracefully handles null, undefined, or missing availability
  assert.deepEqual(profile.getWeeklyOverlapSlots(null, personB), []);
  assert.deepEqual(profile.getWeeklyOverlapSlots(personA, null), []);
  assert.deepEqual(profile.getWeeklyOverlapSlots({}, {}), []);
});

test('2. Backward compatibility: scorePair and match2 behave identically when aiLevel is absent', () => {
  const studentNoLevel = {
    region: 'CENTER',
    availability: ['SUN_16', 'MON_18'],
    subjects: ['MATH', 'CS']
  };
  const pupilNoLevel = {
    region: 'CENTER',
    availability: ['SUN_16'],
    subjects: ['MATH'],
    parentConsent: true
  };

  const scBothNoLevel = match2.scorePair(studentNoLevel, pupilNoLevel);
  assert.equal(scBothNoLevel.breakdown.aiLevelCounted, false);
  assert.equal(scBothNoLevel.breakdown.aiLevelBonus, 0);
  assert.equal(scBothNoLevel.breakdown.aiLevelMatch, false);

  // When only one side defines aiLevel, it remains uncounted for backward compatibility
  const studentWithLevel = { ...studentNoLevel, aiLevel: 'beginner' };
  const scOneSideLevel = match2.scorePair(studentWithLevel, pupilNoLevel);
  assert.equal(scOneSideLevel.score, scBothNoLevel.score);
  assert.equal(scOneSideLevel.breakdown.total, scBothNoLevel.breakdown.total);
  assert.equal(scOneSideLevel.breakdown.aiLevelCounted, false);
  assert.equal(scOneSideLevel.breakdown.aiLevelBonus, 0);

  const pupilWithLevel = { ...pupilNoLevel, aiLevel: 'advanced' };
  const scPupilOnlyLevel = match2.scorePair(studentNoLevel, pupilWithLevel);
  assert.equal(scPupilOnlyLevel.score, scBothNoLevel.score);
  assert.equal(scPupilOnlyLevel.breakdown.aiLevelCounted, false);
});

test('3. Preference for matching aiLevel in scorePair and match2', () => {
  const student = {
    region: 'CENTER',
    availability: ['SUN_16', 'MON_18'],
    subjects: ['MATH'],
    aiLevel: 'beginner'
  };

  const pupilMatching = {
    region: 'CENTER',
    availability: ['SUN_16'],
    subjects: ['MATH'],
    parentConsent: true,
    aiLevel: 'beginner'
  };

  const pupilMismatch = {
    region: 'CENTER',
    availability: ['SUN_16'],
    subjects: ['MATH'],
    parentConsent: true,
    aiLevel: 'advanced'
  };

  const scMatch = match2.scorePair(student, pupilMatching);
  const scMismatch = match2.scorePair(student, pupilMismatch);

  assert.equal(scMatch.breakdown.aiLevelCounted, true);
  assert.equal(scMatch.breakdown.aiLevelMatch, true);
  assert.ok(scMatch.breakdown.aiLevelBonus > 0);

  assert.equal(scMismatch.breakdown.aiLevelCounted, true);
  assert.equal(scMismatch.breakdown.aiLevelMatch, false);
  assert.equal(scMismatch.breakdown.aiLevelBonus, 0);

  // Matching level achieves strictly higher score than mismatched level
  assert.ok(scMatch.score > scMismatch.score, `scMatch (${scMatch.score}) should exceed scMismatch (${scMismatch.score})`);

  // match2 assignment prioritizes matching aiLevel pupil over mismatched pupil
  const res = match2.match2([student], [pupilMismatch, pupilMatching]);
  assert.equal(res.pairs.length, 1);
  assert.equal(res.pairs[0].studentIndex, 0);
  assert.equal(res.pairs[0].pupilIndex, 1, 'matching aiLevel pupil at index 1 is preferred over index 0');
});

test('4. UI: participant form in #tab-people saves aiLevel and clears draft', () => {
  const $ = openApp();

  const select = $('participantAiLevelSelect');
  assert.ok(select, '#participantAiLevelSelect selector must exist in #tab-people');

  // Add student with beginner level
  addPersonWithLevel($, 'student', 'CENTER', ['MATH'], ['SUN_16'], 'beginner');
  const storedPeople1 = JSON.parse($.store.peered_app_v1).people;
  assert.equal(storedPeople1[0].aiLevel, 'beginner');

  // After submit, draft select is cleared
  assert.equal($('participantAiLevelSelect').value, '');

  // Add pupil with advanced level
  addPersonWithLevel($, 'pupil', 'CENTER', ['MATH'], ['SUN_16'], 'advanced');
  const storedPeople2 = JSON.parse($.store.peered_app_v1).people;
  assert.equal(storedPeople2[1].aiLevel, 'advanced');

  // Add student without level
  addPersonWithLevel($, 'student', 'CENTER', ['MATH'], ['SUN_16'], '');
  const storedPeople3 = JSON.parse($.store.peered_app_v1).people;
  assert.equal(storedPeople3[2].aiLevel, undefined);
});

test('5. UI: parent consent toggle preserves participant aiLevel', () => {
  const $ = openApp();

  addPersonWithLevel($, 'student', 'CENTER', ['MATH'], ['SUN_16'], 'beginner');
  addPersonWithLevel($, 'pupil', 'CENTER', ['MATH'], ['SUN_16'], 'beginner');

  assert.ok($('peopleList').innerHTML.includes('data-consent="1"'), 'consent button for pupil exists');

  // Revoke consent
  press($('peopleList'), 'data-consent', '1');
  let people = JSON.parse($.store.peered_app_v1).people;
  assert.equal(people[1].parentConsent, false);
  assert.equal(people[1].aiLevel, 'beginner');

  // Grant consent back
  press($('peopleList'), 'data-consent', '1');
  people = JSON.parse($.store.peered_app_v1).people;
  assert.equal(people[1].parentConsent, true);
  assert.equal(people[1].aiLevel, 'beginner');
});

test('6. UI: match cards in #tab-match display weekly overlap slots tag (.match-overlap-slots)', () => {
  const $ = openApp();

  addPersonWithLevel($, 'student', 'CENTER', ['MATH', 'PHYSICS'], ['SUN_16', 'MON_18', 'TUE_16'], 'beginner');
  addPersonWithLevel($, 'pupil', 'CENTER', ['MATH'], ['SUN_16', 'MON_18'], 'beginner');

  // Trigger basic matching
  $('runMatch').fire('click');

  const pairsHtml = $('pairs').innerHTML;
  assert.match(pairsHtml, /class="[^"]*match-overlap-slots/);
  assert.match(pairsHtml, /SUN_16/);
  assert.match(pairsHtml, /MON_18/);
  assert.match(pairsHtml, /חפיפת שעות שבועיות/);

  // Trigger advanced matching (#runMatch2)
  $('runMatch2').fire('click');
  const match2Html = $('match2Out').innerHTML;
  assert.match(match2Html, /class="[^"]*match-overlap-slots/);
  assert.match(match2Html, /SUN_16/);
  assert.match(match2Html, /MON_18/);
});

test('7. UI: match cards in #tab-match display learning level fit indication (.match-ai-level)', () => {
  const $ = openApp();

  // Student and pupil with matching beginner level
  addPersonWithLevel($, 'student', 'CENTER', ['MATH'], ['SUN_16'], 'beginner');
  addPersonWithLevel($, 'pupil', 'CENTER', ['MATH'], ['SUN_16'], 'beginner');

  $('runMatch').fire('click');
  let cardText = text($('pairs').innerHTML);
  assert.match(cardText, /התאמת רמת למידה/);
  assert.match(cardText, /מתחיל/);

  // Clear and test mismatched levels
  const $2 = openApp();
  addPersonWithLevel($2, 'student', 'CENTER', ['MATH'], ['SUN_16'], 'advanced');
  addPersonWithLevel($2, 'pupil', 'CENTER', ['MATH'], ['SUN_16'], 'beginner');
  $2('runMatch').fire('click');
  cardText = text($2('pairs').innerHTML);
  assert.match(cardText, /התאמת רמת למידה/);
  assert.match(cardText, /שונה|מתקדם.*מתחיל/);

  // Clear and test missing level
  const $3 = openApp();
  addPersonWithLevel($3, 'student', 'CENTER', ['MATH'], ['SUN_16'], '');
  addPersonWithLevel($3, 'pupil', 'CENTER', ['MATH'], ['SUN_16'], '');
  $3('runMatch').fire('click');
  cardText = text($3('pairs').innerHTML);
  assert.match(cardText, /לא הוגדרה רמה/);
});

test('8. UI & i18n: translations in Hebrew, Arabic, and Russian for level fit and overlap slots', () => {
  const $ = openApp();

  addPersonWithLevel($, 'student', 'CENTER', ['MATH'], ['SUN_16'], 'beginner');
  addPersonWithLevel($, 'pupil', 'CENTER', ['MATH'], ['SUN_16'], 'beginner');

  // Default: Hebrew
  $('runMatch').fire('click');
  assert.match($('pairs').innerHTML, /חפיפת שעות שבועיות/);
  assert.match($('pairs').innerHTML, /התאמת רמת למידה/);

  // Arabic
  $('langSelect').value = 'ar';
  $('langSelect').fire('change');
  assert.equal($('participantAiLevelLabel').textContent, 'مستوى التعلم');
  assert.match($('participantAiLevelSelect').innerHTML, /مبتدئ/);
  assert.match($('participantAiLevelSelect').innerHTML, /متقدم/);
  assert.match($('pairs').innerHTML, /تداخل الساعات الأسبوعية/);
  assert.match($('pairs').innerHTML, /تطابق مستوى التعلم/);

  // Russian
  $('langSelect').value = 'ru';
  $('langSelect').fire('change');
  assert.equal($('participantAiLevelLabel').textContent, 'Уровень обучения');
  assert.match($('participantAiLevelSelect').innerHTML, /начинающий/);
  assert.match($('participantAiLevelSelect').innerHTML, /продвинутый/);
  assert.match($('pairs').innerHTML, /Еженедельные пересекающиеся часы/);
  assert.match($('pairs').innerHTML, /Соответствие уровня обучения/);
});

test('9. Zero PII: zero personal data exposed in cards, badges, or match structures', () => {
  const studentWithPii = {
    role: 'student',
    region: 'CENTER',
    availability: ['SUN_16'],
    subjects: ['MATH'],
    aiLevel: 'beginner',
    fullName: 'David Cohen',
    email: 'david@example.com',
    phone: '054-1234567'
  };

  const pupilWithPii = {
    role: 'pupil',
    region: 'CENTER',
    availability: ['SUN_16'],
    subjects: ['MATH'],
    parentConsent: true,
    aiLevel: 'beginner',
    studentName: 'Yoni Levi',
    parentPhone: '052-9876543',
    address: 'Herzl 12, Tel Aviv'
  };

  // scorePair should not leak any personal property
  const sc = match2.scorePair(studentWithPii, pupilWithPii);
  const scStr = JSON.stringify(sc);

  const forbiddenPii = [
    /David/,
    /Cohen/,
    /david@example\.com/,
    /054-1234567/,
    /Yoni/,
    /Levi/,
    /052-9876543/,
    /Herzl/
  ];

  for (const pattern of forbiddenPii) {
    assert.doesNotMatch(scStr, pattern);
  }

  // UI match rendering zero PII test
  const $ = openApp();
  addPersonWithLevel($, 'student', 'CENTER', ['MATH'], ['SUN_16'], 'beginner');
  addPersonWithLevel($, 'pupil', 'CENTER', ['MATH'], ['SUN_16'], 'beginner');
  $('runMatch').fire('click');

  const renderedHtml = $('pairs').innerHTML;
  for (const pattern of forbiddenPii) {
    assert.doesNotMatch(renderedHtml, pattern);
  }
  assert.doesNotMatch(renderedHtml, /@/);
  assert.doesNotMatch(renderedHtml, /05\d/);
});

test('10. Profile validation: makeProfile validates aiLevel strictly', () => {
  // Valid levels
  const p1 = profile.makeProfile({
    role: 'student',
    region: 'CENTER',
    availability: ['SUN_16'],
    subjects: ['MATH'],
    aiLevel: 'beginner'
  });
  assert.equal(p1.aiLevel, 'beginner');

  const p2 = profile.makeProfile({
    role: 'pupil',
    region: 'CENTER',
    availability: ['SUN_16'],
    subjects: ['MATH'],
    aiLevel: 'advanced'
  });
  assert.equal(p2.aiLevel, 'advanced');

  // Invalid level string throws error
  assert.throws(() => {
    profile.makeProfile({
      role: 'student',
      region: 'CENTER',
      availability: ['SUN_16'],
      subjects: ['MATH'],
      aiLevel: 'expert'
    });
  }, /invalid aiLevel/);

  // Non-string level throws error
  assert.throws(() => {
    profile.makeProfile({
      role: 'student',
      region: 'CENTER',
      availability: ['SUN_16'],
      subjects: ['MATH'],
      aiLevel: 123
    });
  }, /invalid aiLevel/);

  // Any unauthorized personal data field throws personal data error
  assert.throws(() => {
    profile.makeProfile({
      role: 'student',
      region: 'CENTER',
      availability: ['SUN_16'],
      subjects: ['MATH'],
      aiLevel: 'beginner',
      phone: '050-1111111'
    });
  }, /personal data is not accepted/);
});
