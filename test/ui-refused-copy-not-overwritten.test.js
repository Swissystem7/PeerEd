'use strict';
// A refused saved document is copied to key:rejected, and the participants card says the copy is kept "so
// a new change does not delete it"; the README says it stays until the wipe. But load() wrote every refused
// document to that one slot, so a list saved after the first refusal and refused on a later visit replaced
// the first copy, and the roster it held was gone with no line saying so. A later refusal now takes the
// next free slot, the line says the earlier copy is still there, and the wipe names and removes them all.
const test = require('node:test');
const assert = require('node:assert/strict');
const { openApp } = require('../test-support/fake-dom.js');
const { createStore, memoryBackend } = require('../src/lib/store.js');

const KEY = 'peered_app_v1';
const FIRST = KEY + ':rejected';
const SECOND = KEY + ':rejected:2';
const OLD = '{not json, the first refused list';
const NEW = '{not json, the second refused list';

test('store: a second refused document goes to the next slot and the first copy stays', () => {
  const backend = memoryBackend();
  const store = createStore(backend);
  backend.setItem(KEY, OLD);
  assert.equal(store.load().kept, true);
  assert.equal(store.copies(), 1);
  backend.setItem(KEY, NEW);
  assert.equal(store.load().kept, true);
  assert.equal(backend.getItem(FIRST), OLD, 'the first copy is not written over');
  assert.equal(backend.getItem(SECOND), NEW);
  assert.equal(store.copies(), 2);
  // the same document refused again goes back into its own slot: a reload adds nothing
  assert.equal(store.load().kept, true);
  assert.equal(store.copies(), 2);
  assert.equal(store.clear(), true);
  assert.equal(backend.getItem(KEY), null);
  assert.equal(backend.getItem(FIRST), null);
  assert.equal(backend.getItem(SECOND), null);
  assert.equal(store.copies(), 0);
});

test('a refusal over an earlier copy says that copy is still there, and the wipe removes both', () => {
  const items = {};
  items[KEY] = NEW;
  items[FIRST] = OLD;
  const $ = openApp({ store: items });
  const line = $('addStatus').textContent;
  assert.match(line, /עותק שלהם נשמר בצד/, line);
  assert.ok(line.indexOf('גם העותק שנשמר בצד בטעינה שנדחתה קודם נשאר כמו שהיה, ולא נכתב עליו.') !== -1, line);
  assert.equal($.store[FIRST], OLD, 'the earlier copy is not written over');
  assert.equal($.store[SECOND], NEW);

  $('wipeBtn').fire('click');
  $('wipeBtn').fire('click');
  assert.equal(KEY in $.store, false);
  assert.equal(FIRST in $.store, false);
  assert.equal(SECOND in $.store, false);
});

test('a load that goes through over an earlier copy: the wipe names the copy before removing it', () => {
  const items = {};
  items[FIRST] = OLD;
  const $ = openApp({ store: items });
  assert.equal($('addStatus').textContent, '', 'nothing was refused on this visit');
  $('wipeBtn').fire('click');
  const armed = $('wipeStatus').textContent;
  assert.match(armed, /באחסון עדיין יש העותק שנשמר בצד/, armed);
  $('wipeBtn').fire('click');
  assert.equal(FIRST in $.store, false);
  assert.match($('wipeStatus').textContent, /כבר לא באחסון/, $('wipeStatus').textContent);
});
