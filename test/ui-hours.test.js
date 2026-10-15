'use strict';
// The engine accepts 8:00 to 22:00. Tutoring before school, in a morning off, or after a reserve-duty
// shift is real; a grid that stops at 14:00-20:00 silently loses those people.
const test = require('node:test');
const assert = require('node:assert/strict');
const profile = require('../src/lib/profile.js');
const { openApp, addPerson, text } = require('../test-support/fake-dom.js');

test('the hours grid offers every hour the engine accepts, and nothing else', () => {
  const $ = openApp();
  const grid = $('hours').innerHTML;
  const slots = [...grid.matchAll(/data-slot="([A-Z]{3}_\d+)"/g)].map((m) => m[1]);
  assert.equal(profile.HOUR_MIN, 8);
  assert.equal(profile.HOUR_MAX, 22);
  assert.equal(slots.length, 7 * (profile.HOUR_MAX - profile.HOUR_MIN + 1));
  assert.ok(slots.includes('SUN_8') && slots.includes('SAT_22'), 'morning and late evening are offered');
  for (const s of slots) assert.ok(profile.isSlot(s), s);
});

test('a morning pair can be made from the screen', () => {
  const $ = openApp();
  assert.match($('hours').innerHTML, /data-slot="MON_9"/, 'the grid must have a 9:00 button to press');
  addPerson($, 'student', 'HAIFA', ['MATH'], ['MON_9']);
  addPerson($, 'pupil', 'HAIFA', ['MATH'], ['MON_9']);
  $('runMatch').fire('click');
  assert.match(text($('pairs').innerHTML), /9:00/);
});
