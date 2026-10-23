'use strict';
// The "רישום שיעור" card's hint says the pairs are derived from the roster ("הזוגות מחושבים מחדש
// מהרשימה"), and the form indeed reads them from the roster on every render - no click on the match
// screen is involved. Yet the pair select's empty option said "הוסף משתתפים וחשב שידוך", sending the
// coordinator to a button that shows pairs but does not make them; the unit select said "בחר זוג
// תחילה" over a pair list with nothing in it; and the hour and subject selects said there were no free
// hours / shared subjects "to choose", as if a pair existed and lacked them - a pair always shares an
// hour and a subject (match.candidatesOf), so those lists are empty only when there is no pair at all.
// Now all four options say there is no pair, and the pair option says where pairs come from and what
// "חשב שידוך" is for.
const test = require('node:test');
const assert = require('node:assert/strict');
const { openApp, press, addPerson, text } = require('../test-support/fake-dom.js');

function emptyOptions($) {
  return {
    pair: $('sessionPair').innerHTML,
    slot: $('sessionSlot').innerHTML,
    subject: $('sessionSubject').innerHTML,
    unit: $('sessionUnit').innerHTML
  };
}

function assertNoPair($) {
  const o = emptyOptions($);
  assert.match(o.pair, /^<option value="">/, o.pair);
  const pairText = text(o.pair);  // esc() writes the quotes as &quot;
  assert.match(pairText, /^אין עדיין זוג\. הזוגות נגזרים מהרשימה במסך "אנשים"/, pairText);
  assert.match(pairText, /"חשב שידוך" במסך השידוך רק מציג אותם/, pairText);
  assert.equal(pairText.indexOf('וחשב שידוך'), -1, 'no instruction to compute: ' + pairText);
  assert.equal(o.slot, '<option value="">אין זוג, אז אין שעה לבחירה</option>');
  assert.equal(o.subject, '<option value="">אין זוג, אז אין מקצוע לבחירה</option>');
  assert.equal(o.unit, '<option value="">אין זוג, אז אין יחידה לבחירה</option>');
  assert.equal(o.unit.indexOf('בחר זוג'), -1, 'no pick from an empty list: ' + o.unit);
  ['sessionPair', 'sessionSlot', 'sessionSubject', 'sessionUnit'].forEach((id) => {
    assert.equal($(id).disabled, true, id + ' is disabled');
  });
}

test('an empty roster: every select says there is no pair, and the pair option says where pairs come from', () => {
  const $ = openApp();
  $('nav-sessions').fire('click');
  assertNoPair($);
});

test('a student and a pupil who share nothing: still no pair, and the hour/subject options do not describe a pair', () => {
  const $ = openApp();
  addPerson($, 'student', 'NORTH', ['MATH'], ['SUN_16']);
  addPerson($, 'pupil', 'NORTH', ['HEBREW'], ['MON_16']);
  $('nav-sessions').fire('click');
  assertNoPair($);
  // the log button agrees: there is no pair to log for
  $('logSession').fire('click');
  assert.match($('sessionStatus').textContent, /^אין זוג לרשום לו שיעור/, $('sessionStatus').textContent);
});

test('pairs reach the form from the roster alone, without "חשב שידוך" - as the hint says', () => {
  const $ = openApp();
  addPerson($, 'student', 'NORTH', ['MATH'], ['SUN_16']);
  addPerson($, 'pupil', 'NORTH', ['MATH'], ['SUN_16']);
  // "חשב שידוך" was never clicked
  assert.equal($('pairs').innerHTML.indexOf('זוג 1'), -1, 'the match screen shows nothing yet');
  $('nav-sessions').fire('click');
  assert.equal($('sessionPair').disabled, false);
  assert.match($('sessionPair').innerHTML, /זוג 1 · /, $('sessionPair').innerHTML);
  assert.equal($('sessionPair').innerHTML.indexOf('אין עדיין זוג'), -1);
  assert.equal($('sessionSlot').disabled, false);
  assert.equal($('sessionSubject').disabled, false);
});

test('a pupil without parent consent is no pair; ticking the consent makes the pair appear in the form', () => {
  const $ = openApp();
  addPerson($, 'student', 'NORTH', ['MATH'], ['SUN_16']);
  addPerson($, 'pupil', 'NORTH', ['MATH'], ['SUN_16']);
  press($('peopleList'), 'data-consent', '1');  // withdraw the consent the helper ticked
  assert.match($('addStatus').textContent, /אישור/, $('addStatus').textContent);
  $('nav-sessions').fire('click');
  assertNoPair($);
  $('nav-people').fire('click');
  press($('peopleList'), 'data-consent', '1');
  $('nav-sessions').fire('click');
  assert.match($('sessionPair').innerHTML, /זוג 1 · /, $('sessionPair').innerHTML);
});

test('a pair with no approved unit in its subject keeps the units-screen line, not the no-pair one', () => {
  const $ = openApp();
  addPerson($, 'student', 'NORTH', ['MATH'], ['SUN_16']);
  addPerson($, 'pupil', 'NORTH', ['MATH'], ['SUN_16']);
  $('nav-sessions').fire('click');
  $('sessionSubject').value = 'MATH';
  $('sessionSubject').fire('change');
  assert.equal($('sessionUnit').innerHTML, '<option value="">אין יחידה מאושרת במקצוע הזה - אשר אחת במסך יחידות</option>');
  assert.equal($('sessionUnit').disabled, true);
});
