'use strict';
// The summary is the page a coordinator forwards to the funder (docs/launch/PILOT-KIT.md, step 5). With one
// pupil left out it used to read "1 תלמידים בלי סטודנט" and "1 זוגות": broken Hebrew on the one page that
// leaves the coordinator's hands. One of anything reads "X אחד"; other counts keep the number.
const test = require('node:test');
const assert = require('node:assert/strict');
const { openApp, addPerson, text } = require('../test-support/fake-dom.js');

test('a count of one reads as Hebrew in the status, the summary and the download note', () => {
  const $ = openApp();
  addPerson($, 'student', 'CENTER', ['MATH'], ['SUN_16']); // #1
  addPerson($, 'pupil', 'CENTER', ['MATH'], ['SUN_16']);   // #2 pairs with #1
  addPerson($, 'pupil', 'NORTH', ['HISTORY'], ['THU_16']); // #3 no student in NORTH
  $('runMatch').fire('click');
  const status = $('matchStatus').textContent;
  assert.match(status, /^זוג אחד מתוך סטודנט אחד ו-2 תלמידים\./, status);
  const s = text($('summary').innerHTML);
  assert.match(s, /זוג אחד\. תלמיד אחד בלי סטודנט, 0 סטודנטים בלי תלמיד\./, s);
  assert.doesNotMatch(s, /(^|[^0-9])1 (זוגות|תלמידים|סטודנטים)/, s);
  $('exportCsv').fire('click');
  assert.match($('matchStatus').textContent, /זוג אחד ואחד שלא שובץ\.$/);
});

test('counts above one keep the number and the plural', () => {
  const $ = openApp();
  addPerson($, 'student', 'CENTER', ['MATH'], ['SUN_16']);
  addPerson($, 'student', 'CENTER', ['MATH'], ['SUN_16']);
  addPerson($, 'pupil', 'CENTER', ['MATH'], ['SUN_16']);
  addPerson($, 'pupil', 'CENTER', ['MATH'], ['SUN_16']);
  addPerson($, 'pupil', 'NORTH', ['HISTORY'], ['THU_16']);
  addPerson($, 'pupil', 'NORTH', ['HISTORY'], ['THU_16']);
  $('runMatch').fire('click');
  assert.match($('matchStatus').textContent, /^2 זוגות מתוך 2 סטודנטים ו-4 תלמידים\./);
  assert.match(text($('summary').innerHTML), /2 זוגות\. 2 תלמידים בלי סטודנט, 0 סטודנטים בלי תלמיד\./);
  $('exportCsv').fire('click');
  assert.match($('matchStatus').textContent, /2 זוגות ו-2 שלא שובצו\.$/);
});

test('the privacy demo says "one personal detail" when it finds one', () => {
  const $ = openApp();
  $('checkText').value = 'אפשר להתקשר 050-1234567';
  $('checkBtn').fire('click');
  assert.match($('checkStatus').textContent, /נמצא פרט אישי אחד\./, $('checkStatus').textContent);
});
