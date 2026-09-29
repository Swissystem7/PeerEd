'use strict';
// A coordinator cannot run a tutoring round from a screen: they need the pairs as a file to line up with
// the sheet where the names live (names never enter PeerEd). A funder asks one question: which subjects
// are short of tutors, where. Both are built only from list numbers and the four accepted fields.
const test = require('node:test');
const assert = require('node:assert/strict');
const { openApp, addPerson, text } = require('../test-support/fake-dom.js');

function roster($) {
  addPerson($, 'pupil', 'NORTH', ['HISTORY'], ['THU_16']);                 // #1 no student in NORTH
  addPerson($, 'student', 'CENTER', ['MATH', 'CS'], ['SUN_16', 'MON_18']); // #2
  addPerson($, 'pupil', 'CENTER', ['CS', 'MATH'], ['SUN_16', 'MON_18']);   // #3 pairs with #2
  addPerson($, 'pupil', 'CENTER', ['MATH'], ['SUN_16']);                   // #4 partner taken
}

test('the pairs download as a CSV with list numbers, Hebrew headers and the reason for each one left out', () => {
  const $ = openApp();
  roster($);
  $('exportCsv').fire('click');
  assert.equal($.downloads.length, 0, 'no file before a match was computed');
  assert.ok($('matchStatus').className.includes('bad'));

  $('runMatch').fire('click');
  $('exportCsv').fire('click');
  assert.equal($.downloads.length, 1);
  const csv = $.downloads[0].text;
  assert.match($.downloads[0].type, /text\/csv/);
  assert.equal(csv.charCodeAt(0), 0xfeff, 'BOM, so Excel opens Hebrew correctly');
  const lines = csv.slice(1).split('\r\n');
  assert.equal(lines[0], 'זוג,אזור,סטודנט (מספר ברשימה),תלמיד (מספר ברשימה),מקצועות משותפים,שעות משותפות');
  assert.equal(lines[1], '1,מרכז,2,3,מדעי המחשב / מתמטיקה,יום ב 18:00 / יום א 16:00');
  assert.ok(lines.includes('תפקיד,מספר ברשימה,אזור,מקצועות,סיבה'), csv);
  assert.ok(lines.some((l) => l.startsWith('תלמיד,1,צפון,היסטוריה,אין באזור')), csv);
  assert.ok(lines.some((l) => l.startsWith('תלמיד,4,מרכז,מתמטיקה,"היו התאמות')), csv);
  const a = $.created.find((e) => e.download);
  assert.ok(a && /\.csv$/.test(a.download) && a.clicked === 1, 'the file is offered for download');
});

test('the summary for a funder counts unmatched pupils by region and subject', () => {
  const $ = openApp();
  roster($);
  $('runMatch').fire('click');
  const s = text($('summary').innerHTML);
  assert.match(s, /זוג אחד\./, s);
  assert.match(s, /2 תלמידים בלי סטודנט/, s);
  assert.match(s, /צפון · היסטוריה: 1/, s);
  assert.match(s, /מרכז · מתמטיקה: 1/, s);
});
