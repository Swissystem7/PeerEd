'use strict';
// The README's "On screen" paragraph said the pairs CSV holds "list numbers only", over a file whose rows
// carry each pair's region, shared subjects and shared hours, and a "לא שובצו" section with the role,
// region, subjects and reason of everyone left out - for a pupil without parent consent the reason says so.
// The screen hints were corrected for the same words in #289 and #291; the README must say what is in it.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { openApp, addPerson, press, ROOT } = require('../test-support/fake-dom.js');

const readme = fs.readFileSync(path.join(ROOT, 'README.md'), 'utf8');
const para = readme.split(/\r?\n\r?\n/).find(function (p) { return p.startsWith('On screen:'); }).replace(/\s+/g, ' ');

function addPupilWithoutConsent($, region, subjects, slots) {
  $('role').value = 'pupil';
  $('consentRow').hidden = false;
  $('region').value = region;
  $('consent').checked = false;
  subjects.forEach((s) => press($('subjects'), 'data-subject', s));
  slots.forEach((s) => press($('hours'), 'data-slot', s));
  $('addPerson').fire('click');
  if ($('addStatus').className.includes('bad')) throw new Error('add refused: ' + $('addStatus').textContent);
}

test('the pairs file holds more than list numbers: region, subjects, hours and the reason', () => {
  const $ = openApp();
  addPerson($, 'student', 'CENTER', ['MATH'], ['SUN_16']);
  addPerson($, 'pupil', 'CENTER', ['MATH'], ['SUN_16']);
  addPupilWithoutConsent($, 'CENTER', ['MATH'], ['SUN_16']);
  $('runMatch').fire('click');
  $('exportCsv').fire('click');
  const csv = $.downloads[0].text;
  assert.match(csv, /שעות משותפות/);
  assert.match(csv, /לא שובצו/);
  assert.match(csv, /אישור הורה/);
});

test('README: the "On screen" paragraph says what the pairs file holds, not "list numbers only"', () => {
  assert.doesNotMatch(para, /list numbers only/);
  assert.match(para, /people by list number, never by name/);
  assert.match(para, /region, shared subjects and shared hours/);
  assert.match(para, /"לא שובצו" section/);
  assert.match(para, /for a pupil without parent consent that reason says so/);
  assert.match(para, /nothing loads it back/);
});
