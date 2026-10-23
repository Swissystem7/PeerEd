'use strict';
// The approved list's empty line said "עדיין לא אושרה אף יחידה" also after the only approved unit was
// revised back to pending, over a log holding lessons logged with it (a row needs the unit approved
// when it is written). Now, with lessons in the log, it says no unit is approved now and that the
// lessons were logged with a unit approved then and revised since.
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

function logLesson($, id) {
  $('nav-sessions').fire('click');
  $('sessionPair').value = '0';
  $('sessionSlot').value = 'SUN_16';
  $('sessionSubject').value = 'MATH';
  $('sessionUnit').value = id;
  $('sessionOutcome').value = 'held';
  $('logSession').fire('click');
  assert.match($('sessionStatus').textContent, /^נרשם שיעור/, $('sessionStatus').textContent);
}

test('with no unit ever approved the line says none was approved yet', () => {
  const $ = openApp();
  assert.match($('approvedList').innerHTML, /עדיין לא אושרה אף יחידה/);
  submitDemoUnit($);
  assert.match($('approvedList').innerHTML, /עדיין לא אושרה אף יחידה/);
});

test('after the only approved unit is revised, lessons logged with it make the line say "אין כרגע"', () => {
  const $ = openApp();
  $('demoBtn').fire('click');
  submitDemoUnit($);
  const id = /מזהה: (\S+)/.exec($('unitStatus').textContent)[1];
  approve($, id);
  logLesson($, id);

  $('nav-units').fire('click');
  submitDemoUnit($, 'גוף מתוקן: שלושה תרגילים עם מכנה משותף.');
  const html = $('approvedList').innerHTML;
  assert.doesNotMatch(html, /עדיין לא אושרה/, html);
  assert.match(html, /אין כרגע יחידה מאושרת, אז תלמיד לא רואה כלום\./, html);
  assert.match(html, /שיעור אחד ביומן נרשם עם יחידה שהייתה מאושרת אז ועודכנה מאז/, html);
  assert.match(html, /השיעור נשאר ביומן\./, html);
});

test('two lessons are counted with a plural verb', () => {
  const $ = openApp();
  $('demoBtn').fire('click');
  submitDemoUnit($);
  const id = /מזהה: (\S+)/.exec($('unitStatus').textContent)[1];
  approve($, id);
  logLesson($, id);
  logLesson($, id);

  $('nav-units').fire('click');
  submitDemoUnit($, 'גוף מתוקן: שלושה תרגילים עם מכנה משותף.');
  const html = $('approvedList').innerHTML;
  assert.match(html, /2 שיעורים ביומן נרשמו עם יחידה שהייתה מאושרת/, html);
  assert.match(html, /השיעורים נשארים ביומן\./, html);
});
