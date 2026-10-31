'use strict';
// "רשום שיעור" with no unit to choose - the subject has no approved unit, and the unit select under it
// says so ("אין יחידה מאושרת במקצוע הזה ...") - was refused with the engine's line alone, "לא נרשם:
// אפשר לרשום רק יחידה מאושרת", as if an unapproved unit had been picked. That is the demo's first
// click on this screen. Now the line says no unit was chosen, names the subject and what the queue
// holds in it, and names a subject the pair shares that does have an approved unit.
const test = require('node:test');
const assert = require('node:assert/strict');
const { openApp } = require('../test-support/fake-dom.js');

function submitDemoUnit($) {
  $('unitDemoBtn').fire('click');
  $('submitUnit').fire('click');
  return /מזהה: (\S+)/.exec($('unitStatus').textContent)[1];
}

// the fake DOM does not pick a select's first option, so the form is filled as a browser shows it
function fill($, pair, subject, unitId) {
  $('sessionPair').value = pair;
  $('sessionPair').fire('change');
  $('sessionSlot').value = 'SUN_16';                       // both demo pairs are free then
  $('sessionSubject').value = subject;
  $('sessionSubject').fire('change');
  $('sessionUnit').value = unitId || '';
  $('sessionOutcome').value = 'held';
}

function approve($, id) {
  $('pendingList').fire('click', { target: { getAttribute: (k) => (k === 'data-approve' ? id : null) } });
}

test('no unit in the subject and none waiting: the line says no unit was chosen and how to get one', () => {
  const $ = openApp();
  $('demoBtn').fire('click');
  $('nav-sessions').fire('click');
  fill($, '0', 'MATH');
  $('logSession').fire('click');
  const line = $('sessionStatus').textContent;
  assert.ok($('sessionStatus').className.includes('bad'), line);
  assert.match(line, /^לא נרשם: אפשר לרשום רק יחידה מאושרת, ולא נבחרה יחידה - אין יחידה מאושרת במקצוע \S/, line);
  assert.match(line, /ואף אחת לא ממתינה לאישור - מגישים יחידה במקצוע/, line);
  assert.doesNotMatch(line, /בחר אות/, line);
  assert.equal($('sessionList').innerHTML.includes('שיעור 1'), false, 'nothing was logged');
});

test('a unit waiting in the subject is counted', () => {
  const $ = openApp();
  $('demoBtn').fire('click');
  submitDemoUnit($);
  $('nav-sessions').fire('click');
  fill($, '0', 'MATH');
  $('logSession').fire('click');
  const line = $('sessionStatus').textContent;
  assert.match(line, /אין יחידה מאושרת במקצוע מתמטיקה - אחת ממתינה לאישור במסך יחידות\./, line);
});

test('after a switch to a subject with no approved unit, the line names the shared subject that has one', () => {
  const $ = openApp();
  $('demoBtn').fire('click');
  approve($, submitDemoUnit($));
  $('nav-sessions').fire('click');
  // the demo pair that shares computer science as well as maths
  let found = false;
  for (const v of ['0', '1']) {
    $('sessionPair').value = v;
    $('sessionPair').fire('change');
    if ($('sessionSubject').innerHTML.includes('value="CS"')) { found = true; break; }
  }
  assert.ok(found, 'a demo pair shares CS');
  assert.equal($('sessionSubject').value, 'MATH', 'the form starts on the subject with an approved unit');
  fill($, $('sessionPair').value, 'CS');
  $('logSession').fire('click');
  const line = $('sessionStatus').textContent;
  assert.match(line, /אין יחידה מאושרת במקצוע מדעי המחשב, ואף אחת לא ממתינה/, line);
  assert.match(line, /לזוג הזה יש יחידה מאושרת במקצוע מתמטיקה - בחר אותו ברשימת המקצועות\.$/, line);
  assert.equal($('sessionSubject').focused, true, 'focus goes to the subject select');
});

test('with an approved unit chosen the lesson is logged as before', () => {
  const $ = openApp();
  $('demoBtn').fire('click');
  const id = submitDemoUnit($);
  approve($, id);
  $('nav-sessions').fire('click');
  fill($, '0', 'MATH', id);
  $('logSession').fire('click');
  assert.match($('sessionStatus').textContent, /^נרשם שיעור 1/, $('sessionStatus').textContent);
});
