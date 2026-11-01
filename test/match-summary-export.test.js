'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const match = require('../src/lib/match.js');
const profile = require('../src/lib/profile.js');
const { openApp, addPerson } = require('../test-support/fake-dom.js');

const ROOT = path.join(__dirname, '..');
const shell = fs.readFileSync(path.join(ROOT, 'src', 'app-shell.html'), 'utf8');

function pupil(region, subjects, availability, consent) {
  return profile.makeProfile({
    role: 'pupil',
    region,
    subjects,
    availability,
    parentConsent: consent === undefined ? true : consent
  });
}

function student(region, subjects, availability) {
  return profile.makeProfile({
    role: 'student',
    region,
    subjects,
    availability
  });
}

test('matchSummaryCsv: exports counts only, strictly adhering to measure,code,count format', () => {
  const p1 = pupil('NORTH', ['MATH'], ['SUN_16'], true);
  const s1 = student('NORTH', ['MATH'], ['SUN_16']);
  const p2 = pupil('NORTH', ['HISTORY'], ['MON_18'], false); // no consent
  const p3 = pupil('CENTER', ['CS'], ['TUE_17'], true);       // pupil without student

  const students = [s1];
  const pupils = [p1, p2, p3];
  const pairs = match.matchPairs(students, pupils);
  const unmatched = match.explainUnmatched(students, pupils, pairs);
  const across = match.matchAcrossRegions(students, pupils, pairs);

  const matchRecord = {
    pairs,
    left: unmatched.pupils.map((u) => ({ role: 'pupil', e: { number: u.index + 1, person: pupils[u.index] }, reason: u.reason }))
      .concat(unmatched.students.map((u) => ({ role: 'student', e: { number: u.index + 1, person: students[u.index] }, reason: u.reason }))),
    across
  };

  const allPeople = [s1, p1, p2, p3];
  const summary = match.summarizeMatch(matchRecord, allPeople);
  assert.equal(summary.pairs, 1);
  assert.equal(summary.pupilsWithoutStudent, 1); // p3
  assert.equal(summary.studentsWithoutPupil, 0);
  assert.equal(summary.waitingConsentNoStudent + summary.waitingConsentFits, 1); // p2

  const csv = match.matchSummaryCsv(matchRecord, allPeople);
  assert.equal(match.MATCH_REPORT_HEADER, 'measure,code,count');
  assert.equal(csv.indexOf('\r'), -1, 'LF only line endings');

  const lines = csv.trim().split('\n');
  assert.equal(lines[0], 'measure,code,count');
  assert.ok(lines.includes('pairs,,1'));
  assert.ok(lines.includes('pupils_without_student,,1'));
  assert.ok(lines.includes('students_without_pupil,,0'));
  assert.ok(lines.includes('missing_student,CENTER_CS,1'));

  // Ensure no sensitive profile or personal fields leak into the counts CSV
  assert.equal(/name|phone|email|notes|SUN_|MON_|TUE_|studentIndex|pupilIndex/i.test(csv), false,
    'no names, contacts, slots or personal identifiers leaked');
});

test('matchSummary export button: accessible markup, disallows export before match, downloads valid CSV', () => {
  assert.ok(/<button type="button" class="ghost" id="exportMatchSummary"[^>]*aria-label="הורד קובץ סיכום לרשות בפורמט CSV"[^>]*aria-describedby="matchStatus"/.test(shell),
    'exportMatchSummary must have proper accessible label and aria-describedby');

  const $ = openApp();
  addPerson($, 'student', 'NORTH', ['MATH'], ['SUN_16']);
  addPerson($, 'pupil', 'NORTH', ['MATH'], ['SUN_16']);

  // Click before running match
  $('exportMatchSummary').fire('click');
  assert.equal($.downloads.length, 0, 'no download before match');
  assert.ok($('matchStatus').className.includes('bad'));

  // Compute match and export
  $('runMatch').fire('click');
  $('exportMatchSummary').fire('click');

  assert.equal($.downloads.length, 1);
  const dl = $.downloads[0];
  assert.match(dl.type, /text\/csv/);
  assert.equal(dl.text.charCodeAt(0), 0xfeff, 'UTF-8 BOM present');

  const textWithoutBom = dl.text.slice(1);
  assert.ok(textWithoutBom.startsWith('measure,code,count\npairs,,1\n'));
  assert.ok(textWithoutBom.includes('pupils_without_student,,0'));

  const a = $.created.find((e) => e.download === 'peered-match-summary.csv');
  assert.ok(a && a.clicked === 1, 'file downloaded as peered-match-summary.csv');
});
