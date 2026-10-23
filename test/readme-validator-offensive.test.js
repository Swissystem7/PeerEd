'use strict';
// The README's validator.js row listed only personal data (email, phone, id, link, handle) over a gate that
// also refuses offensive language with a message of its own (PROFANITY_ERROR), finds a word with a Hebrew
// prefix, stretched or spelled letter by letter, drops niqqud, and reads an address spelled out with at/dot.
// The row must name the offensive-language half and the privacy tab that demonstrates it.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { findPersonalData, assertCleanText, PROFANITY_ERROR, PERSONAL_DATA_ERROR } = require('../src/lib/validator.js');

const root = path.join(__dirname, '..');
const readme = fs.readFileSync(path.join(root, 'README.md'), 'utf8');
const row = readme.split('\n').find(function (line) { return line.startsWith('| `src/lib/validator.js`'); });

function kinds(text) {
  return findPersonalData(text).map(function (h) { return h.kind; });
}

test('validator: the forms the README names are what the gate does', () => {
  assert.deepEqual(kinds('dana at gmail dot com'), ['email']);
  assert.deepEqual(kinds('dana [at] walla [dot] co.il'), ['email']);
  ['fuuuck', 'חרררא', 'f.u.c.k', 'ז-ו-נ-ה', 'והמניאק', 'חָרָא'].forEach(function (t) {
    assert.deepEqual(kinds(t), ['profanity'], t);
  });
  ['ש.מ.ר', 'מזונות', 'אחראי'].forEach(function (t) {
    assert.deepEqual(kinds(t), [], t);
  });
  assert.throws(function () { assertCleanText('חרא'); }, { message: PROFANITY_ERROR });
  assert.throws(function () { assertCleanText('זונה 0501234567'); }, { message: PERSONAL_DATA_ERROR });
});

test('README: the validator.js row names offensive language and the privacy tab', () => {
  assert.ok(row, 'the README has a validator.js row');
  assert.match(row, /also refuses offensive language, with a message of its own/);
  assert.match(row, /dana at gmail dot com/);
  assert.match(row, /fuuuck, חרררא/);
  assert.match(row, /f\.u\.c\.k, ז-ו-נ-ה/);
  assert.match(row, /מזונות, אחראי/);
  assert.match(row, /refused for the personal data/);
  assert.match(row, /"פרטיות"\) runs this gate on whatever is pasted into it and stores nothing/);
  assert.match(row, /invisible characters and niqqud are dropped/);
});
