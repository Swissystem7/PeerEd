'use strict';
// Issue #54 (war): a pupil whose region has no free student can be offered one from another region,
// because sessions are text only. Local pairs never change; only the people left out take part.
const test = require('node:test');
const assert = require('node:assert/strict');
const { makeProfile } = require('../src/lib/profile.js');
const { matchPairs, matchAcrossRegions } = require('../src/lib/match.js');
const { openApp, addPerson, text } = require('../test-support/fake-dom.js');

const st = (region, availability, subjects) => makeProfile({ role: 'student', region, availability, subjects });
const pu = (region, availability, subjects) => makeProfile({ role: 'pupil', region, availability, subjects, parentConsent: true });

test('matchAcrossRegions: only the people left out, hour and subject still required, both regions named', () => {
  const S = [st('CENTER', ['SUN_16'], ['MATH']), st('CENTER', ['MON_18'], ['ENGLISH']), st('SOUTH', ['TUE_17'], ['MATH'])];
  const P = [
    pu('CENTER', ['SUN_16'], ['MATH']),     // local pair with s0
    pu('NORTH', ['MON_18'], ['ENGLISH']),   // no student in NORTH: s1 from CENTER fits
    pu('NORTH', ['TUE_17'], ['HISTORY']),   // s2 free then, but nothing in common to learn
    pu('NORTH', ['SUN_16'], ['MATH'])       // s0 would fit, but s0 is already in a local pair
  ];
  const pairs = matchPairs(S, P);
  assert.deepEqual(pairs.map((p) => [p.studentIndex, p.pupilIndex]), [[0, 0]]);
  assert.deepEqual(matchAcrossRegions(S, P, pairs), [{
    studentIndex: 1, pupilIndex: 1, studentRegion: 'CENTER', pupilRegion: 'NORTH',
    sharedSlots: ['MON_18'], sharedSubjects: ['ENGLISH']
  }]);
});

test('matchAcrossRegions: the largest number of extra pairs, and the same answer every time', () => {
  const S = [st('CENTER', ['SUN_16', 'MON_18'], ['MATH']), st('SOUTH', ['SUN_16'], ['MATH'])];
  const P = [pu('NORTH', ['SUN_16'], ['MATH']), pu('HAIFA', ['MON_18'], ['MATH'])];
  const extra = matchAcrossRegions(S, P, matchPairs(S, P));
  assert.equal(extra.length, 2);
  assert.deepEqual(extra, matchAcrossRegions(S, P, matchPairs(S, P)));
  assert.deepEqual(matchAcrossRegions([], P, []), []);
  assert.deepEqual(matchAcrossRegions(undefined, undefined, undefined), []);
});

test('screen: the emergency card offers the cross-region pair and the CSV carries it', () => {
  const $ = openApp();
  addPerson($, 'student', 'CENTER', ['ENGLISH'], ['MON_18']);
  addPerson($, 'pupil', 'NORTH', ['ENGLISH'], ['MON_18']);
  $('runMatch').fire('click');
  assert.match(text($('pairs').innerHTML), /לא נוצר אף זוג/);
  const card = text($('across').innerHTML);
  assert.match(card, /תלמיד #2 \(צפון\) עם סטודנט מלמד #1 \(מרכז\)/);
  assert.match(card, /אנגלית/);
  assert.match(text($('summary').innerHTML), /אפשר עוד זוג אחד בין אזורים/);
  $('exportCsv').fire('click');
  const csv = $.downloads[$.downloads.length - 1].text;
  assert.match(csv, /הצעות בין אזורים/);
  assert.match(csv, /\r\n2,צפון,1,מרכז,אנגלית,/);
});
