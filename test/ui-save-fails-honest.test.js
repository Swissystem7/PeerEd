'use strict';
// When the browser refuses the write (storage full, blocked, Safari private mode), the change lives in
// memory only and is gone when the page closes. save() used to put that warning on the people card and
// the action's own "נוסף" / "הוגש" line overwrote it on the next statement, so the coordinator never saw
// it. The warning now lands on the line that reports the action, and keeps what the action said.
const test = require('node:test');
const assert = require('node:assert/strict');
const { openApp, press } = require('../test-support/fake-dom.js');

const MEMORY_ONLY = /נשמר בזיכרון בלבד/;

function addStudent($) {
  $('role').value = 'student';
  $('region').value = 'CENTER';
  press($('subjects'), 'data-subject', 'MATH');
  press($('hours'), 'data-slot', 'SUN_16');
  $('addPerson').fire('click');
}

test('adding a person when the browser refuses the write says so on the same line', () => {
  const $ = openApp({ saveFails: true });
  addStudent($);
  assert.match($('addStatus').textContent, /נוסף/);
  assert.match($('addStatus').textContent, MEMORY_ONLY);
  assert.ok($('addStatus').className.includes('bad'), $('addStatus').textContent);
});

test('the demo roster, a unit and a decision each warn when the write fails', () => {
  const $ = openApp({ saveFails: true });
  $('demoBtn').fire('click');
  assert.match($('addStatus').textContent, MEMORY_ONLY);
  $('unitDemoBtn').fire('click');
  $('submitUnit').fire('click');
  assert.match($('unitStatus').textContent, /הוגש/);
  assert.match($('unitStatus').textContent, MEMORY_ONLY);
});

test('a write that works adds no warning', () => {
  const $ = openApp();
  addStudent($);
  assert.doesNotMatch($('addStatus').textContent, MEMORY_ONLY);
  assert.ok(!$('addStatus').className.includes('bad'));
});
