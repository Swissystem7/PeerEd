'use strict';
// "תו N" on the check screen is for a person counting along the text they typed: the first character is
// 1, and an emoji before the hit counts as one character, not as the two UTF-16 units it takes in JS.
const test = require('node:test');
const assert = require('node:assert/strict');
const { openApp } = require('../test-support/fake-dom.js');

function findings($) { return $('findings').innerHTML; }

test('a hit at the very start is character 1, not 0', () => {
  const $ = openApp();
  $('checkText').value = '050-1234567 זה הטלפון';
  $('checkBtn').fire('click');
  assert.match(findings($), /\(תו 1\)/, findings($));
  assert.doesNotMatch(findings($), /\(תו 0\)/, findings($));
});

test('an emoji before the hit counts as one character', () => {
  const $ = openApp();
  $('checkText').value = '😀 050-1234567';
  $('checkBtn').fire('click');
  assert.match(findings($), /\(תו 3\)/, findings($));
});
