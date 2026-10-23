'use strict';
// The roster, the units queue and the lessons log are saved as one document, so a document load()
// refuses takes all three with it - a broken log row empties the roster too. The participants card said
// "הרשימה השמורה נדחתה" over a reason about the queue or the log, and the units and lessons screens then
// said "עדיין לא אושרה אף יחידה" and "עדיין לא נרשם שיעור" over a stored queue and log that were refused,
// not empty. The load line names all three, and those two lines say the stored part was not loaded.
const test = require('node:test');
const assert = require('node:assert/strict');
const { openApp } = require('../test-support/fake-dom.js');

const KEY = 'peered_app_v1';

function openWith(text, opts) {
  const store = {};
  store[KEY] = text;
  return openApp(Object.assign({ store: store }, opts || {}));
}

const BAD_LOG = JSON.stringify({
  schema: 'peered/1',
  people: [{ role: 'student', region: 'CENTER', availability: ['SUN_16'], subjects: ['MATH'] }],
  log: { nextSeq: 2, entries: [{ seq: 1, region: 'MOON', slot: 'SUN_16', subject: 'MATH', unitId: 'u-x', outcome: 'held' }] }
});

test('a refused log row: the load line says the roster, the queue and the log were all left out', () => {
  const $ = openWith(BAD_LOG);
  const line = $('addStatus').textContent;
  assert.match(line, /^הנתונים השמורים נדחו ולא נטענו: שיעור שמור לא תקין\./, line);
  assert.match(line, /רשימת המשתתפים, תור היחידות ויומן השיעורים לא נטענו יחד/, line);
  assert.doesNotMatch(line, /הרשימה השמורה נדחתה/, line);
  assert.match($('peopleList').innerHTML, /אין עדיין משתתפים/, 'the valid roster went with the bad log row');
});

test('after a refused load the units and lessons screens do not say nothing was ever approved or logged', () => {
  const $ = openWith('{not json');
  const approved = $('approvedList').innerHTML;
  assert.doesNotMatch(approved, /עדיין לא אושרה אף יחידה/, approved);
  assert.match(approved, /תור היחידות השמור נדחה בטעינה/, approved);
  const summary = $('sessionSummary').innerHTML;
  assert.doesNotMatch(summary, /עדיין לא נרשם שיעור/, summary);
  assert.match(summary, /יומן השיעורים השמור נדחה בטעינה/, summary);
});

test('after the wipe removes the refused document the two lines go back to "עדיין"', () => {
  const $ = openWith('{not json');
  $('wipeBtn').fire('click');
  $('wipeBtn').fire('click');
  assert.match($('approvedList').innerHTML, /עדיין לא אושרה אף יחידה/);
  assert.match($('sessionSummary').innerHTML, /עדיין לא נרשם שיעור/);
});

test('a clean start keeps the plain lines', () => {
  const $ = openApp();
  assert.match($('approvedList').innerHTML, /עדיין לא אושרה אף יחידה/);
  assert.match($('sessionSummary').innerHTML, /עדיין לא נרשם שיעור/);
  assert.doesNotMatch($('approvedList').innerHTML + $('sessionSummary').innerHTML, /נדחה בטעינה/);
});
