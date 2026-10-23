'use strict';
// When the browser does not hand out its storage at all (site data blocked in the settings, a sandboxed
// frame, some private modes), the shell falls back to a memory store so the app keeps working for the
// visit. That fallback was silent: the participants card promised the list is kept in this browser,
// every add said "נוסף" as if it were, and the roster was gone when the page closed - while the same
// browser refusing one write got the "נשמר בזיכרון בלבד" warning. Now the blocked storage is said at the
// start, on the participants card, and on every save, with the one line a refused write already has.
const test = require('node:test');
const assert = require('node:assert/strict');
const { openApp, press, addPerson } = require('../test-support/fake-dom.js');

const MEMORY_ONLY = /נשמר בזיכרון בלבד/;
const BLOCKED_AT_START = /^הדפדפן לא מאפשר אחסון מקומי/;

function addStudent($) {
  $('role').value = 'student';
  $('region').value = 'CENTER';
  press($('subjects'), 'data-subject', 'MATH');
  press($('hours'), 'data-slot', 'SUN_16');
  $('addPerson').fire('click');
}

test('a blocked storage is said when the page opens, before anything is typed', () => {
  const $ = openApp({ noStorage: true });
  const line = $('addStatus').textContent;
  assert.match(line, BLOCKED_AT_START, line);
  assert.match(line, /לא נטענה/, 'a list saved on an earlier visit is not on the screen: ' + line);
  assert.match(line, /יישמר בזיכרון בלבד/, line);
  assert.match(line, /ייעלם כשהדף ייסגר/, line);
  assert.equal($('addStatus').className, 'status bad');
  assert.equal(Object.keys($.store).length, 0, 'nothing was written anywhere');
});

test('adding a person with the storage blocked says the person was added and is kept in memory only', () => {
  const $ = openApp({ noStorage: true });
  addStudent($);
  const line = $('addStatus').textContent;
  assert.match(line, /^נוסף\. סך הכול משתתף אחד\. /, line);
  assert.match(line, MEMORY_ONLY, line);
  assert.match(line, /ייעלם כשהדף ייסגר/, line);
  assert.equal($('addStatus').className, 'status bad');
  assert.ok($('peopleList').innerHTML.indexOf('סטודנט מלמד #1') !== -1, 'the person is on the screen for this visit');
  assert.equal(Object.keys($.store).length, 0, 'and in no storage');
});

test('the demo roster, a unit, a decision and a lesson each warn, exactly as when one write fails', () => {
  const $ = openApp({ noStorage: true });
  $('demoBtn').fire('click');
  assert.match($('addStatus').textContent, /^נטענו 7 משתתפים/, $('addStatus').textContent);
  assert.match($('addStatus').textContent, MEMORY_ONLY);
  $('unitDemoBtn').fire('click');
  $('submitUnit').fire('click');
  assert.match($('unitStatus').textContent, /^הוגש וממתין לאישור/, $('unitStatus').textContent);
  assert.match($('unitStatus').textContent, MEMORY_ONLY);
  const unitId = $('pendingList').innerHTML.match(/data-approve="([^"]+)"/)[1];
  press($('pendingList'), 'data-approve', unitId);
  assert.match($('decideStatus').textContent, /^אושר\. /, $('decideStatus').textContent);
  assert.match($('decideStatus').textContent, MEMORY_ONLY);
  $('nav-sessions').fire('click');
  $('sessionPair').value = '0';
  $('sessionSlot').value = 'SUN_16';
  $('sessionSubject').value = 'MATH';
  $('sessionUnit').value = unitId;
  $('sessionOutcome').value = 'held';
  $('logSession').fire('click');
  assert.match($('sessionStatus').textContent, /^נרשם שיעור 1\. /, $('sessionStatus').textContent);
  assert.match($('sessionStatus').textContent, MEMORY_ONLY);
  assert.equal(Object.keys($.store).length, 0);
});

test('the warning for a blocked storage and for a refused write are the same line', () => {
  const blocked = openApp({ noStorage: true });
  addStudent(blocked);
  const refused = openApp({ saveFails: true });
  addStudent(refused);
  const tail = (line) => line.slice(line.indexOf('נשמר בזיכרון בלבד'));
  assert.equal(tail(blocked('addStatus').textContent), tail(refused('addStatus').textContent));
});

test('with the storage available nothing is said at the start and nothing is added to "נוסף"', () => {
  const $ = openApp();
  assert.equal($('addStatus').textContent, '');
  addPerson($, 'student', 'CENTER', ['MATH'], ['SUN_16']);
  assert.doesNotMatch($('addStatus').textContent, MEMORY_ONLY);
  assert.equal($('addStatus').className, 'status');
  assert.equal(typeof $.store.peered_app_v1, 'string', 'the roster reached the storage');
});

test('a wipe with the storage blocked still empties the screen and reports it as done', () => {
  const $ = openApp({ noStorage: true });
  $('demoBtn').fire('click');
  $('wipeBtn').fire('click');
  assert.match($('wipeStatus').textContent, /^יימחקו 7 משתתפים/, $('wipeStatus').textContent);
  $('wipeBtn').fire('click');
  assert.match($('wipeStatus').textContent, /^נמחק\. /, $('wipeStatus').textContent);
  assert.equal($('wipeStatus').className, 'status');
  assert.ok($('peopleList').innerHTML.indexOf('אין עדיין משתתפים') !== -1);
  // the next change says again where it lands
  addStudent($);
  assert.match($('addStatus').textContent, MEMORY_ONLY);
});
