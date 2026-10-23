'use strict';
// A saved list that fails the check on load is dropped, and the participants card says why. The reason
// comes from store.js in English; the card is Hebrew, so it goes through the same table as every other
// status line instead of being pasted in raw.
const test = require('node:test');
const assert = require('node:assert/strict');
const { openApp } = require('../test-support/fake-dom.js');

const KEY = 'peered_app_v1';
const REJECTED_KEY = KEY + ':rejected';
const LATIN = /[A-Za-z]/;

function openWith(text) {
  const store = {};
  store[KEY] = text;
  return openApp({ store: store });
}

test('a saved list that is not JSON is reported in Hebrew', () => {
  const $ = openWith('{not json');
  assert.ok($('addStatus').className.includes('bad'), $('addStatus').textContent);
  assert.match($('addStatus').textContent, /נדחתה/);
  assert.match($('addStatus').textContent, /הקובץ השמור פגום/);
  assert.match($('addStatus').textContent, /עותק שלה נשמר בצד/);
  assert.equal($.store[REJECTED_KEY], '{not json');
  assert.doesNotMatch($('addStatus').textContent, LATIN, $('addStatus').textContent);
});

test('a saved list with a name in it is reported in Hebrew', () => {
  const $ = openWith(JSON.stringify({
    schema: 'peered/1',
    people: [{ role: 'student', region: 'CENTER', availability: ['SUN_16'], subjects: ['MATH'], name: 'Dana' }]
  }));
  assert.match($('addStatus').textContent, /פרטים אישיים לא מתקבלים/);
  assert.doesNotMatch($('addStatus').textContent, LATIN, $('addStatus').textContent);
});

test('a saved session row that does not load is reported in Hebrew', () => {
  const $ = openWith(JSON.stringify({
    schema: 'peered/1', people: [],
    log: { nextSeq: 2, entries: [{ seq: 1, region: 'MOON', slot: 'SUN_16', subject: 'MATH', unitId: 'u-x', outcome: 'held' }] }
  }));
  assert.match($('addStatus').textContent, /שיעור שמור לא תקין/);
  assert.doesNotMatch($('addStatus').textContent, LATIN, $('addStatus').textContent);
});

test('a good saved list loads with no complaint', () => {
  const $ = openWith(JSON.stringify({ schema: 'peered/1', people: [] }));
  assert.equal($('addStatus').textContent, '');
});
