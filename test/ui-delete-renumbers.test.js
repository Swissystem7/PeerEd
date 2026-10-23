'use strict';
// A list number is a place in the participants list, and every screen names people by it: the match
// cards, the match status ("המספרים הם המקום ברשימת המשתתפים") and the pairs file, which the participants
// card says is "לפי מספרי הרשימה" and cannot be loaded back. Deleting someone who is not last moves
// everyone after them up a number, so a pairs file already on the coordinator's device now names other
// people - and the delete line said "נמחק." and nothing else. Now it says who was deleted, who moved
// and, when a file went down from this list, that the file's numbers are the ones from before.
const test = require('node:test');
const assert = require('node:assert/strict');
const { openApp, addPerson, press, text } = require('../test-support/fake-dom.js');

function three($) {
  addPerson($, 'student', 'CENTER', ['MATH'], ['SUN_16']);   // #1
  addPerson($, 'pupil', 'CENTER', ['MATH'], ['SUN_16']);     // #2
  addPerson($, 'pupil', 'NORTH', ['ENGLISH'], ['MON_18']);   // #3
}

test('deleting someone in the middle names the deleted one and who moved up', () => {
  const $ = openApp();
  three($);
  press($('peopleList'), 'data-del', '1');
  assert.equal($('addStatus').textContent, 'נמחק תלמיד #2. מי שהיה #3 הוא עכשיו #2.');
  assert.equal($('addStatus').className, 'status');
  const list = text($('peopleList').innerHTML);
  assert.match(list, /סטודנט מלמד #1/);
  assert.match(list, /תלמיד #2[\s\S]*צפון/, list);
  assert.doesNotMatch(list, /#3/);
});

test('deleting the last one moves nobody, so the line stays "נמחק."', () => {
  const $ = openApp();
  three($);
  press($('peopleList'), 'data-del', '2');
  assert.equal($('addStatus').textContent, 'נמחק.');
});

test('several people after the deleted one are named as a range', () => {
  const $ = openApp();
  three($);
  addPerson($, 'student', 'SOUTH', ['PHYSICS'], ['TUE_17']);  // #4
  press($('peopleList'), 'data-del', '0');
  assert.equal($('addStatus').textContent, 'נמחק סטודנט מלמד #1. מי שהיו #2 עד #4 ירדו במספר אחד.');
});

test('after a pairs file went down, the line says its numbers are the ones from before the deletion', () => {
  const $ = openApp();
  three($);
  $('runMatch').fire('click');
  assert.match(text($('pairs').innerHTML), /סטודנט מלמד #1 עם תלמיד #2/);
  $('exportCsv').fire('click');
  assert.equal($.downloads.length, 1);
  assert.match($.downloads[0].text, /\n1,מרכז,1,2,/, 'the file keys the pair by list numbers');
  press($('peopleList'), 'data-del', '0');
  // the pair the deleted one is in is named after this (ui-delete-file-number)
  assert.ok($('addStatus').textContent.startsWith(
    'נמחק סטודנט מלמד #1. מי שהיו #2 עד #3 ירדו במספר אחד, וקובץ הזוגות שירד קודם מתייחס למספרים שלפני המחיקה.'));
  // the match cards are reset as before: nothing on the screen describes the old numbers
  assert.match($('pairs').innerHTML, /מופיע אחרי חישוב שידוך/);
});

test('with a file down, deleting the last one moves nobody, but the file still names them (ui-delete-file-number)', () => {
  const $ = openApp();
  three($);
  $('runMatch').fire('click');
  $('exportCsv').fire('click');
  press($('peopleList'), 'data-del', '2');
  assert.match($('addStatus').textContent, /^נמחק תלמיד #3\. בקובץ הזוגות שירד קודם הוא עדיין #3/);
});

test('a file of a list that was emptied is forgotten: a new list does not inherit the warning', () => {
  const $ = openApp();
  addPerson($, 'student', 'CENTER', ['MATH'], ['SUN_16']);
  addPerson($, 'pupil', 'CENTER', ['MATH'], ['SUN_16']);
  $('runMatch').fire('click');
  $('exportCsv').fire('click');
  press($('peopleList'), 'data-del', '0');
  assert.match($('addStatus').textContent, /קובץ הזוגות שירד קודם/);
  press($('peopleList'), 'data-del', '0');
  assert.equal($('addStatus').textContent, 'נמחק.');
  three($);
  press($('peopleList'), 'data-del', '0');
  assert.equal($('addStatus').textContent, 'נמחק סטודנט מלמד #1. מי שהיו #2 עד #3 ירדו במספר אחד.');
});

test('a wipe forgets the file too', () => {
  const $ = openApp();
  three($);
  $('runMatch').fire('click');
  $('exportCsv').fire('click');
  $('wipeBtn').fire('click');
  $('wipeBtn').fire('click');
  assert.match($('wipeStatus').textContent, /^נמחק\./);
  three($);
  press($('peopleList'), 'data-del', '1');
  assert.equal($('addStatus').textContent, 'נמחק תלמיד #2. מי שהיה #3 הוא עכשיו #2.');
});
