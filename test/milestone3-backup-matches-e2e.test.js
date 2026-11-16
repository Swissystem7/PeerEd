'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const match = require('../src/lib/match.js');
const match2 = require('../src/lib/match2.js');
const { openApp, press } = require('../test-support/fake-dom.js');

function addPerson($, role, region, subjects, slots, extra) {
  $('role').value = role;
  $('consentRow').hidden = role !== 'pupil';
  if (role === 'pupil') $('consent').checked = true;
  $('region').value = region;
  if ($('participantAiLevelSelect') && extra && extra.aiLevel) {
    $('participantAiLevelSelect').value = extra.aiLevel;
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

test('1. suggestScheduleShift: calculates closest hour shift between participants on the same day', () => {
  const student = {
    role: 'student',
    region: 'CENTER',
    availability: ['SUN_10'],
    subjects: ['MATH']
  };
  const pupil = {
    role: 'pupil',
    region: 'CENTER',
    availability: ['SUN_11'],
    subjects: ['MATH'],
    parentConsent: true
  };

  const shift = match2.suggestScheduleShift(student, pupil);
  assert.ok(shift, 'should return a shift recommendation');
  assert.equal(shift.shiftHours, 1);
  assert.equal(shift.day, 'SUN');
  assert.equal(shift.slotA, 'SUN_10');
  assert.equal(shift.slotB, 'SUN_11');
  assert.equal(shift.targetSlot, 'SUN_11');
  assert.ok(shift.explanation.he.includes('שעה אחת'));
  assert.ok(shift.explanation.ar.includes('ساعة واحدة'));
  assert.ok(shift.explanation.ru.includes('1 час'));
});

test('2. suggestScheduleShift: returns shiftHours: 0 when participants already share an overlapping slot', () => {
  const student = {
    availability: ['SUN_10', 'MON_18']
  };
  const pupil = {
    availability: ['SUN_10', 'WED_14']
  };

  const shift = match2.suggestScheduleShift(student, pupil);
  assert.ok(shift);
  assert.equal(shift.shiftHours, 0);
  assert.equal(shift.day, 'SUN');
  assert.ok(shift.explanation.he.includes('יש חפיפת שעות'));
});

test('3. suggestScheduleShift: resilience to empty, null, undefined, or missing day overlap', () => {
  assert.equal(match2.suggestScheduleShift(null, null), null);
  assert.equal(match2.suggestScheduleShift({}, {}), null);
  assert.equal(match2.suggestScheduleShift({ availability: [] }, { availability: [] }), null);
  assert.equal(match2.suggestScheduleShift({ availability: ['SUN_10'] }, { availability: ['MON_10'] }), null);
  assert.equal(match.suggestScheduleShift(null, null), null);
});

test('4. findNearMissCandidates: detects missing_one_slot when candidates differ by 1 hour on schedule', () => {
  const student = {
    role: 'student',
    region: 'CENTER',
    availability: ['SUN_10'],
    subjects: ['MATH']
  };
  const pupil = {
    role: 'pupil',
    region: 'CENTER',
    availability: ['SUN_11'],
    subjects: ['MATH'],
    parentConsent: true
  };

  const nearMisses = match2.findNearMissCandidates(student, [pupil]);
  assert.equal(nearMisses.length, 1);
  assert.equal(nearMisses[0].reason, 'missing_one_slot');
  assert.equal(nearMisses[0].gapReason, 'missing_one_slot');
  assert.ok(nearMisses[0].reasons.includes('missing_one_slot'));
  assert.ok(nearMisses[0].suggestedShift);
  assert.equal(nearMisses[0].suggestedShift.shiftHours, 1);
  assert.equal(nearMisses[0].explanation.he, 'פער של שעה אחת בלוח הזמנים');
});

test('5. findNearMissCandidates: detects adjacent_level when participants have adjacent learning levels', () => {
  const student = {
    role: 'student',
    region: 'CENTER',
    availability: ['SUN_10'],
    subjects: ['MATH'],
    level: 3
  };
  const pupil = {
    role: 'pupil',
    region: 'CENTER',
    availability: ['SUN_10'],
    subjects: ['MATH'],
    level: 4,
    parentConsent: true
  };

  const nearMisses = match2.findNearMissCandidates(student, [pupil]);
  assert.equal(nearMisses.length, 1);
  assert.equal(nearMisses[0].reason, 'adjacent_level');
  assert.ok(nearMisses[0].reasons.includes('adjacent_level'));
  assert.equal(nearMisses[0].explanation.he, 'התאמת רמה קרובה (רמה סמוכה)');
});

test('6. findNearMissCandidates: detects partial_ai_topic when curriculum AI topics partially overlap', () => {
  const student = {
    role: 'student',
    region: 'CENTER',
    availability: ['SUN_10'],
    subjects: ['CS'],
    target_ai_topics: ['AI_LIT_PROMPT', 'AI_CREATIVE']
  };
  const pupil = {
    role: 'pupil',
    region: 'CENTER',
    availability: ['SUN_10'],
    subjects: ['CS'],
    target_ai_topics: ['AI_LIT_PROMPT', 'AI_STEM_CODE'],
    parentConsent: true
  };

  const nearMisses = match2.findNearMissCandidates(student, [pupil]);
  assert.equal(nearMisses.length, 1);
  assert.equal(nearMisses[0].reason, 'partial_ai_topic');
  assert.ok(nearMisses[0].reasons.includes('partial_ai_topic'));
  assert.deepEqual(Array.from(nearMisses[0].sharedAiTopics), ['AI_LIT_PROMPT']);
  assert.equal(nearMisses[0].explanation.he, 'חפיפה חלקית בנושאי בינה מלאכותית');
});

test('7. findNearMissCandidates: resilience to empty inputs, enforces parent consent and zero PII', () => {
  assert.deepEqual(match2.findNearMissCandidates(null, null), []);
  assert.deepEqual(match2.findNearMissCandidates({}, []), []);

  const student = {
    role: 'student',
    region: 'CENTER',
    availability: ['SUN_10'],
    subjects: ['MATH']
  };
  const pupilNoConsent = {
    role: 'pupil',
    region: 'CENTER',
    availability: ['SUN_11'],
    subjects: ['MATH'],
    parentConsent: false
  };

  // Pupil without consent must never be returned
  assert.deepEqual(match2.findNearMissCandidates(student, [pupilNoConsent]), []);

  // Pupil with consent and injected PII
  const pupilWithPii = {
    role: 'pupil',
    region: 'CENTER',
    availability: ['SUN_11'],
    subjects: ['MATH'],
    parentConsent: true,
    fullName: 'Private Name',
    phoneNumber: '0501234567',
    email: 'private@test.com'
  };

  const res = match2.findNearMissCandidates(student, [pupilWithPii]);
  assert.equal(res.length, 1);
  const outJson = JSON.stringify(res[0]);
  assert.equal(outJson.includes('Private Name'), false);
  assert.equal(outJson.includes('0501234567'), false);
  assert.equal(outJson.includes('private@test.com'), false);
});

test('8. Both match.js and match2.js export findNearMissCandidates and suggestScheduleShift', () => {
  assert.equal(typeof match.findNearMissCandidates, 'function');
  assert.equal(typeof match.suggestScheduleShift, 'function');
  assert.equal(typeof match2.findNearMissCandidates, 'function');
  assert.equal(typeof match2.suggestScheduleShift, 'function');
});

test('9. UI: toggleBackupMatchesBtn toggles backupMatchesOut visibility and updates aria-expanded', () => {
  const $ = openApp();

  const btn = $('toggleBackupMatchesBtn');
  const out = $('backupMatchesOut');

  assert.ok(btn, '#toggleBackupMatchesBtn must exist in app-shell');
  assert.ok(out, '#backupMatchesOut must exist in app-shell');
  assert.equal(btn.getAttribute('type'), 'button');
  assert.equal(btn.getAttribute('aria-expanded'), 'false');
  assert.equal(btn.getAttribute('aria-describedby'), 'match2Status');
  assert.equal(out.hidden, true);

  // Click to open
  btn.fire('click');
  assert.equal(btn.getAttribute('aria-expanded'), 'true');
  assert.equal(out.hidden, false);

  // Click to close
  btn.fire('click');
  assert.equal(btn.getAttribute('aria-expanded'), 'false');
  assert.equal(out.hidden, true);
});

test('10. UI & i18n: multi-language (he, ar, ru) rendering of backup matches and zero PII in DOM', () => {
  const $ = openApp();

  // Add student and pupil with 1-hour schedule shift
  addPerson($, 'student', 'CENTER', ['MATH'], ['SUN_10']);
  addPerson($, 'pupil', 'CENTER', ['MATH'], ['SUN_11']);

  const btn = $('toggleBackupMatchesBtn');
  const out = $('backupMatchesOut');

  // Open panel
  btn.fire('click');
  assert.equal(btn.getAttribute('aria-expanded'), 'true');

  // Hebrew
  assert.ok(out.innerHTML.includes('סטודנט 1 ↔ תלמיד 1'));
  assert.ok(out.innerHTML.includes('backup-reason-missing_one_slot'));
  assert.ok(out.innerHTML.includes('שעה אחת'));

  // Switch to Arabic
  $('langSelect').value = 'ar';
  $('langSelect').fire('change');
  assert.ok(out.innerHTML.includes('طالب 1 ↔ تلميذ 1'));
  assert.ok(out.innerHTML.includes('ساعة واحدة'));

  // Switch to Russian
  $('langSelect').value = 'ru';
  $('langSelect').fire('change');
  assert.ok(out.innerHTML.includes('Студент 1 ↔ Ученик 1'));
  assert.ok(out.innerHTML.includes('1 час'));

  // Verify zero PII strings
  for (const forbidden of ['email@', 'password', 'phone', 'undefined', 'null']) {
    assert.equal(out.innerHTML.includes(forbidden), false);
  }
});
