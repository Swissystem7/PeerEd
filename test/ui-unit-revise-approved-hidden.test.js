'use strict';
// The approve line says "מעכשיו תלמידים רואים את היחידה". A teacher who then fixes the body of that
// approved unit sends it back to pending: it leaves the approved list ("מה שתלמיד רואה") and the lessons
// form. The submit line said only "חזרה להמתנה כגרסה 2", so the approve line's promise went off unsaid.
// Now it says pupils do not see it and no lesson can be logged with it until it is approved again, and
// that lessons already logged with it stay in the log.
const test = require('node:test');
const assert = require('node:assert/strict');
const { openApp } = require('../test-support/fake-dom.js');

function submitDemoUnit($, body) {
  $('unitDemoBtn').fire('click');
  if (body) $('unitBody').value = body;
  $('submitUnit').fire('click');
}

function approve($, id) {
  $('pendingList').fire('click', { target: { getAttribute: (k) => (k === 'data-approve' ? id : null) } });
}

test('revising an approved unit says pupils no longer see it and lessons cannot be logged with it', () => {
  const $ = openApp();
  submitDemoUnit($);
  const id = /מזהה: (\S+)/.exec($('unitStatus').textContent)[1];
  approve($, id);
  assert.match($('decideStatus').textContent, /מעכשיו תלמידים רואים את היחידה/);

  submitDemoUnit($, 'גוף מתוקן: שלושה תרגילים עם מכנה משותף.');
  const line = $('unitStatus').textContent;
  assert.match(line, /^הטקסט עודכן, היחידה חזרה להמתנה כגרסה 2\./, line);
  assert.match(line, /עד שתאושר שוב תלמידים לא רואים אותה/, line);
  assert.match(line, /אי אפשר לרשום איתה שיעור/, line);
  assert.match(line, /שיעורים שכבר נרשמו איתה נשארים ביומן/, line);
  assert.doesNotMatch($('approvedList').innerHTML, new RegExp(id), 'the unit left the approved list');
});

test('the lessons form no longer offers the revised unit, and the lesson logged with it stays', () => {
  const $ = openApp();
  $('demoBtn').fire('click');
  submitDemoUnit($);
  const id = /מזהה: (\S+)/.exec($('unitStatus').textContent)[1];
  approve($, id);
  $('nav-sessions').fire('click');
  $('sessionPair').value = '0';
  $('sessionSlot').value = 'SUN_16';
  $('sessionSubject').value = 'MATH';
  $('sessionUnit').value = id;
  $('sessionOutcome').value = 'held';
  $('logSession').fire('click');
  assert.match($('sessionStatus').textContent, /^נרשם שיעור 1/, $('sessionStatus').textContent);

  $('nav-units').fire('click');
  submitDemoUnit($, 'גוף מתוקן: שלושה תרגילים עם מכנה משותף.');
  $('nav-sessions').fire('click');
  assert.doesNotMatch($('sessionUnit').innerHTML, new RegExp('value="' + id + '"'), $('sessionUnit').innerHTML);
  assert.match($('sessionList').innerHTML, new RegExp(id), 'the logged lesson is still in the log');
});

test('revising a pending unit or a rejected one does not get the approved note', () => {
  const $ = openApp();
  submitDemoUnit($);
  submitDemoUnit($, 'גוף אחר לגמרי, עדיין ממתין.');
  assert.match($('unitStatus').textContent, /^הטקסט עודכן, היחידה עדיין ממתינה לאישור/);
  assert.doesNotMatch($('unitStatus').textContent, /תלמידים לא רואים/);

  const id = /data-reject="([^"]+)"/.exec($('pendingList').innerHTML)[1];
  $('reason-' + id).value = 'קצר מדי';
  $('pendingList').fire('click', { target: { getAttribute: (k) => (k === 'data-reject' ? id : null) } });
  submitDemoUnit($, 'גוף שלישי אחרי הדחייה.');
  // Typed from scratch, not loaded by "טען לטופס לעריכה": the line also names the text it replaced.
  assert.match($('unitStatus').textContent, /^הטקסט עודכן, היחידה חזרה להמתנה כגרסה 3\. הטקסט הקודם של /, $('unitStatus').textContent);
  assert.doesNotMatch($('unitStatus').textContent, /תלמידים לא רואים/);
});
