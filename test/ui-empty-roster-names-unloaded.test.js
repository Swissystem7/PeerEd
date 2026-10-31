'use strict';
// The participants card's empty line said "אין עדיין משתתפים. אפשר לטעון דוגמה." - no list on this
// device yet - over a saved document load() had just refused (roster, units queue and lessons log in
// one), and over a blocked storage that could not read a list saved on an earlier visit. The reason
// sits on the add card above, in a line the next action overwrites; the list's own line now names it.
const test = require('node:test');
const assert = require('node:assert/strict');
const { openApp, press } = require('../test-support/fake-dom.js');

const KEY = 'peered_app_v1';
const BAD = '{not json';
const PLAIN = 'אין עדיין משתתפים. אפשר לטעון דוגמה.';

function openRefused(opts) {
  const store = {};
  store[KEY] = BAD;
  return openApp(Object.assign({ store: store }, opts || {}));
}
function emptyLine($) { return $('peopleList').innerHTML; }

test('a refused document whose copy was kept: the empty list says it was refused and the copy kept', () => {
  const $ = openRefused();
  const line = emptyLine($);
  assert.equal(line.indexOf(PLAIN), -1, line);
  assert.match(line, /נדחו בטעינה ולא נטענו/, line);
  assert.match(line, /ועותק שלהם נשמר בצד באחסון המקומי/, line);
});

test('a refused document with no copy kept: the empty list says the next person or demo is saved over it', () => {
  const $ = openRefused({ saveFails: true });
  const line = emptyLine($);
  assert.equal(line.indexOf(PLAIN), -1, line);
  assert.match(line, /נדחו בטעינה ולא נטענו/, line);
  assert.match(line, /עותק שלהם לא נשמר בצד: משתתף חדש או דוגמה יישמרו מעליהם/, line);
});

test('the copy stays after the roster is filled and emptied again, and the line still names it', () => {
  const $ = openRefused();
  $('role').value = 'student';
  $('region').value = 'CENTER';
  press($('subjects'), 'data-subject', 'MATH');
  press($('hours'), 'data-slot', 'SUN_16');
  $('addPerson').fire('click');
  assert.equal($.store[KEY + ':rejected'], BAD, 'the copy is still beside the key');
  press($('peopleList'), 'data-del', '0');
  const line = emptyLine($);
  assert.match(line, /^<p class="empty">אין משתתפים על המסך\. עותק של הנתונים השמורים שנדחו בטעינה נשמר בצד/, line);
  assert.doesNotMatch(line, /ולא נטענו/, 'the key now holds the list saved since: ' + line);
});

test('a blocked storage: the empty list says a list from an earlier visit was not read and new ones live in memory', () => {
  const $ = openApp({ noStorage: true });
  const line = emptyLine($);
  assert.match(line, /אין עדיין משתתפים בביקור הזה/, line);
  assert.match(line, /רשימה שנשמרה כאן בביקור קודם, אם יש כזו, לא נטענה/, line);
  assert.match(line, /יישמר בזיכרון בלבד/, line);
});

test('after the wipe removes the refused document and its copy, the plain line is back', () => {
  const $ = openRefused();
  $('wipeBtn').fire('click');
  $('wipeBtn').fire('click');
  assert.ok(emptyLine($).indexOf(PLAIN) !== -1, emptyLine($));
});

test('a device with nothing stored keeps the plain line', () => {
  const $ = openApp();
  assert.ok(emptyLine($).indexOf(PLAIN) !== -1, emptyLine($));
});

test('coming back to the people tab re-renders the line', () => {
  const $ = openRefused();
  $('nav-units').fire('click');
  $('nav-people').fire('click');
  assert.match(emptyLine($), /נדחו בטעינה/, emptyLine($));
});
