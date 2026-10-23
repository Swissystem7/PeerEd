'use strict';
// The units banner promises "אותה כותרת, מקצוע ומשך — אותו מזהה", and unit.js keeps that promise for a
// title pasted from WhatsApp with the RLM such a paste leaves behind: same id. But the queue compared the
// stored title character by character, so an approved unit pasted back unchanged went back to pending as
// "גרסה 2" - pulled from every pupil's screen over a mark nobody can see - and the status line said the
// text was updated when nothing a reader sees had changed. A repeat is a repeat on the screen too.
const test = require('node:test');
const assert = require('node:assert/strict');
const { openApp } = require('../test-support/fake-dom.js');

const TITLE = 'שברים פשוטים: חיבור וחיסור';
const BODY = 'מתחילים בפיצה שחולקה ל-8. כמה זה 3/8 ועוד 2/8?';

function submitUnit($, title, body) {
  $('unitSubject').value = 'MATH';
  $('unitDuration').value = '20';
  $('unitTitle').value = title;
  $('unitBody').value = body;
  $('submitUnit').fire('click');
}

function approveFirst($) {
  const id = /data-approve="([^"]+)"/.exec($('pendingList').innerHTML)[1];
  $('pendingList').fire('click', { target: { getAttribute: (k) => (k === 'data-approve' ? id : null) } });
  return id;
}

test('an approved unit pasted back with an RLM in its title stays approved and the line says so', () => {
  const $ = openApp();
  submitUnit($, TITLE, BODY);
  const id = approveFirst($);
  assert.match($('approvedList').innerHTML, new RegExp(id));

  submitUnit($, TITLE + '‏', BODY);
  assert.match($('unitStatus').textContent, /^כבר מאושרת, ללא שינוי/, $('unitStatus').textContent);
  assert.doesNotMatch($('unitStatus').textContent, /עודכן|גרסה/, $('unitStatus').textContent);
  assert.match($('approvedList').innerHTML, new RegExp(id), 'pupils still see the unit');
  assert.doesNotMatch($('pendingList').innerHTML, new RegExp(id), 'nothing went back to the queue');
  assert.doesNotMatch($('approvedList').innerHTML, /גרסה 2/);
});

test('a pending unit pasted back with an RLM in its title is still its first version', () => {
  const $ = openApp();
  submitUnit($, TITLE, BODY);
  submitUnit($, '‏' + TITLE, BODY);
  assert.match($('unitStatus').textContent, /^כבר בתור, ללא שינוי/, $('unitStatus').textContent);
  assert.match($('pendingList').innerHTML, /גרסה 1/);
  assert.doesNotMatch($('pendingList').innerHTML, /גרסה 2/);
});

test('a revised body with that title is still a revision, as before', () => {
  const $ = openApp();
  submitUnit($, TITLE, BODY);
  approveFirst($);
  submitUnit($, TITLE + '‏', BODY + ' אחר כך 3 תרגילים.');
  assert.match($('unitStatus').textContent, /חזרה להמתנה כגרסה 2/, $('unitStatus').textContent);
  assert.match($('pendingList').innerHTML, /גרסה 2/);
});
