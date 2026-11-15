'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const profile = require('../src/lib/profile.js');
const match2 = require('../src/lib/match2.js');
const { openApp, press } = require('../test-support/fake-dom.js');

const ROOT = path.join(__dirname, '..');

function addParticipant($, role, region, subjects, slots) {
  $('role').value = role;
  $('consentRow').hidden = role !== 'pupil';
  if (role === 'pupil') $('consent').checked = true;
  $('region').value = region;
  $('consent').checked = role === 'pupil';
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

test('1. computeWeeklyAvailabilityHeatmap: accurately calculates demand vs supply and shortages', () => {
  const people = [
    { role: 'pupil', availability: ['SUN_10', 'MON_18'] },
    { role: 'pupil', availability: ['SUN_10', 'TUE_16'] },
    { role: 'pupil', availability: ['SUN_10'] },
    { role: 'student', availability: ['SUN_10'] },
    { role: 'student', availability: ['WED_12'] }
  ];

  const result = profile.computeWeeklyAvailabilityHeatmap(people);
  assert.ok(result && typeof result === 'object');
  assert.ok(Array.isArray(result.slots));
  assert.equal(result.slots.length, 105); // 7 days * 15 hours (8..22)

  const sun10 = result.slots.find((s) => s.slot === 'SUN_10');
  assert.ok(sun10);
  assert.equal(sun10.day, 'SUN');
  assert.equal(sun10.hour, 10);
  assert.equal(sun10.demand, 3);
  assert.equal(sun10.supply, 1);
  assert.equal(sun10.gap, 2);
  assert.equal(sun10.shortage, 2);

  const wed12 = result.slots.find((s) => s.slot === 'WED_12');
  assert.ok(wed12);
  assert.equal(wed12.demand, 0);
  assert.equal(wed12.supply, 1);
  assert.equal(wed12.gap, -1);
  assert.equal(wed12.shortage, 0);

  // Keyed access directly on slots array
  assert.equal(result.slots.SUN_10.demand, 3);
  assert.equal(result.slots.WED_12.supply, 1);
});

test('2. computeWeeklyAvailabilityHeatmap: handles multiple slots and ignores duplicates per person', () => {
  const people = [
    { role: 'pupil', availability: ['SUN_10', 'SUN_10', 'MON_18'] },
    { role: 'student', availability: ['SUN_10', 'SUN_10'] }
  ];

  const result = match2.computeWeeklyAvailabilityHeatmap(people);
  const sun10 = result.slots.SUN_10;
  assert.equal(sun10.demand, 1);
  assert.equal(sun10.supply, 1);
  assert.equal(sun10.gap, 0);
  assert.equal(sun10.shortage, 0);

  const mon18 = result.slots.MON_18;
  assert.equal(mon18.demand, 1);
  assert.equal(mon18.supply, 0);
  assert.equal(mon18.gap, 1);
  assert.equal(mon18.shortage, 1);
});

test('3. topShortageSlots: filters strictly to demand > supply and sorts descending by gap size', () => {
  const people = [
    // SUN_16: 4 pupils, 1 student -> gap = 3
    { role: 'pupil', availability: ['SUN_16'] },
    { role: 'pupil', availability: ['SUN_16'] },
    { role: 'pupil', availability: ['SUN_16'] },
    { role: 'pupil', availability: ['SUN_16'] },
    { role: 'student', availability: ['SUN_16'] },

    // MON_18: 3 pupils, 0 students -> gap = 3
    { role: 'pupil', availability: ['MON_18'] },
    { role: 'pupil', availability: ['MON_18'] },
    { role: 'pupil', availability: ['MON_18'] },

    // TUE_14: 2 pupils, 0 students -> gap = 2
    { role: 'pupil', availability: ['TUE_14'] },
    { role: 'pupil', availability: ['TUE_14'] },

    // WED_10: 1 pupil, 1 student -> gap = 0 (balanced, not a shortage)
    { role: 'pupil', availability: ['WED_10'] },
    { role: 'student', availability: ['WED_10'] },

    // THU_12: 0 pupils, 2 students -> gap = -2 (surplus, not a shortage)
    { role: 'student', availability: ['THU_12'] },
    { role: 'student', availability: ['THU_12'] }
  ];

  const result = profile.computeWeeklyAvailabilityHeatmap(people);
  assert.ok(Array.isArray(result.topShortageSlots));
  assert.equal(result.topShortageSlots.length, 3);

  // Highest gap first: SUN_16 (gap 3, demand 4), MON_18 (gap 3, demand 3), TUE_14 (gap 2)
  assert.equal(result.topShortageSlots[0].slot, 'SUN_16');
  assert.equal(result.topShortageSlots[0].gap, 3);
  assert.equal(result.topShortageSlots[1].slot, 'MON_18');
  assert.equal(result.topShortageSlots[1].gap, 3);
  assert.equal(result.topShortageSlots[2].slot, 'TUE_14');
  assert.equal(result.topShortageSlots[2].gap, 2);
});

test('4. topShortageSlots: returns empty array when supply meets or exceeds demand across all hours', () => {
  const people = [
    { role: 'pupil', availability: ['SUN_10'] },
    { role: 'student', availability: ['SUN_10', 'MON_18'] },
    { role: 'student', availability: ['SUN_10'] }
  ];

  const result = profile.computeWeeklyAvailabilityHeatmap(people);
  assert.ok(Array.isArray(result.topShortageSlots));
  assert.equal(result.topShortageSlots.length, 0);
});

test('5. Robustness: handles null, undefined, empty, non-array, and corrupted inputs gracefully', () => {
  const emptyRes = profile.computeWeeklyAvailabilityHeatmap([]);
  assert.equal(emptyRes.slots.length, 105);
  assert.equal(emptyRes.topShortageSlots.length, 0);

  const nullRes = profile.computeWeeklyAvailabilityHeatmap(null);
  assert.equal(nullRes.slots.length, 105);
  assert.equal(nullRes.topShortageSlots.length, 0);

  const undefRes = profile.computeWeeklyAvailabilityHeatmap(undefined);
  assert.equal(undefRes.slots.length, 105);

  const invalidRes = profile.computeWeeklyAvailabilityHeatmap('not-an-array');
  assert.equal(invalidRes.slots.length, 105);

  const corruptList = [
    null,
    undefined,
    42,
    'garbage',
    {},
    { role: 'unknown', availability: ['SUN_10'] },
    { role: 'pupil', availability: 'not-array' },
    { role: 'student', availability: ['INVALID_SLOT', 'SUN_99'] }
  ];
  const corruptRes = profile.computeWeeklyAvailabilityHeatmap(corruptList);
  assert.equal(corruptRes.slots.length, 105);
  assert.equal(corruptRes.topShortageSlots.length, 0);
});

test('6. Consistency: profile and match2 modules export identical computeWeeklyAvailabilityHeatmap', () => {
  assert.equal(typeof profile.computeWeeklyAvailabilityHeatmap, 'function');
  assert.equal(typeof match2.computeWeeklyAvailabilityHeatmap, 'function');

  const testData = [
    { role: 'pupil', availability: ['SUN_16'] },
    { role: 'student', availability: ['SUN_16'] },
    { role: 'pupil', availability: ['MON_18'] }
  ];

  const fromProfile = profile.computeWeeklyAvailabilityHeatmap(testData);
  const fromMatch2 = match2.computeWeeklyAvailabilityHeatmap(testData);

  assert.deepEqual(fromProfile, fromMatch2);
});

test('7. UI: toggleAvailabilityHeatmapBtn toggles visibility and manages aria-expanded', () => {
  const $ = openApp();

  const btn = $('toggleAvailabilityHeatmapBtn');
  const out = $('availabilityHeatmapOut');

  assert.ok(btn, 'toggleAvailabilityHeatmapBtn should exist');
  assert.ok(out, 'availabilityHeatmapOut should exist');

  assert.equal(btn.getAttribute('type'), 'button');
  assert.equal(btn.getAttribute('aria-expanded'), 'false');
  assert.equal(btn.getAttribute('aria-describedby'), 'match2Status');
  assert.equal(out.hidden, true);

  // Click to open
  btn.fire('click');
  assert.equal(btn.getAttribute('aria-expanded'), 'true');
  assert.equal(out.hidden, false);
  assert.ok(out.innerHTML.length > 0);

  // Click to close
  btn.fire('click');
  assert.equal(btn.getAttribute('aria-expanded'), 'false');
  assert.equal(out.hidden, true);
});

test('8. UI: availabilityHeatmapOut displays missing peak shortage hours with counts', () => {
  const $ = openApp();

  // Add 3 pupils and 1 student on SUN_16 (shortage of 2)
  addParticipant($, 'pupil', 'CENTER', ['MATH'], ['SUN_16']);
  addParticipant($, 'pupil', 'CENTER', ['MATH'], ['SUN_16']);
  addParticipant($, 'pupil', 'CENTER', ['MATH'], ['SUN_16']);
  addParticipant($, 'student', 'CENTER', ['MATH'], ['SUN_16']);

  $('toggleAvailabilityHeatmapBtn').fire('click');

  const out = $('availabilityHeatmapOut');
  assert.equal(out.hidden, false);
  assert.ok(out.innerHTML.includes('SUN_16'));
  assert.ok(out.innerHTML.includes('shortage-peak-item'));
  assert.ok(out.innerHTML.includes('data-gap="2"'));
  assert.ok(out.innerHTML.includes('16:00'));
});

test('9. UI i18n: translations in Hebrew, Arabic, and Russian for availability heatmap', () => {
  const $ = openApp();

  addParticipant($, 'pupil', 'CENTER', ['MATH'], ['SUN_16']);
  addParticipant($, 'pupil', 'CENTER', ['MATH'], ['SUN_16']);

  const btn = $('toggleAvailabilityHeatmapBtn');
  btn.fire('click');

  // Hebrew (default)
  let outHtml = $('availabilityHeatmapOut').innerHTML;
  assert.ok(outHtml.includes('שעות שיא חסרות למדריכים'));
  assert.ok(outHtml.includes('ביקוש: 2'));
  assert.ok(btn.textContent.includes('הסתר'));

  // Arabic
  $('langSelect').value = 'ar';
  $('langSelect').fire('change');
  outHtml = $('availabilityHeatmapOut').innerHTML;
  assert.ok(outHtml.includes('ساعات الذروة التي تفتقر للمرشدين') || outHtml.includes('الطلب: 2'));
  assert.ok(btn.textContent.includes('إخفاء') || btn.textContent.includes('خريطة'));

  // Russian
  $('langSelect').value = 'ru';
  $('langSelect').fire('change');
  outHtml = $('availabilityHeatmapOut').innerHTML;
  assert.ok(outHtml.includes('Пиковые часы нехватки наставников') || outHtml.includes('спрос: 2'));
  assert.ok(btn.textContent.includes('Скрыть') || btn.textContent.includes('доступности'));
});

test('10. Zero PII: ensures no personal data leaks into heatmap calculations or DOM', () => {
  const studentWithPii = {
    role: 'student',
    region: 'CENTER',
    availability: ['SUN_16'],
    fullName: 'Yossi Cohen',
    email: 'yossi@peer.example.org',
    phone: '052-1234567',
    notes: 'Private address details'
  };
  const pupilWithPii = {
    role: 'pupil',
    region: 'CENTER',
    availability: ['SUN_16'],
    fullName: 'Ronit Levi',
    email: 'ronit@school.example.org',
    phone: '054-7654321',
    notes: 'Confidential pupil record'
  };

  const heatmap = profile.computeWeeklyAvailabilityHeatmap([studentWithPii, pupilWithPii]);
  const serialized = JSON.stringify(heatmap);

  const forbiddenStrings = [
    'Yossi', 'Cohen', 'yossi@peer', '052-1234567', 'Private address',
    'Ronit', 'Levi', 'ronit@school', '054-7654321', 'Confidential'
  ];

  for (const forbidden of forbiddenStrings) {
    assert.equal(serialized.includes(forbidden), false, `Heatmap data exposed forbidden string: ${forbidden}`);
  }

  // Also verify shell HTML has no personal credentials or leaks
  const shell = fs.readFileSync(path.join(ROOT, 'src', 'app-shell.html'), 'utf8');
  for (const forbidden of ['yossi@', 'password', 'credit_card', '052-1234567']) {
    assert.equal(shell.includes(forbidden), false, `Shell contains forbidden string: ${forbidden}`);
  }
});
