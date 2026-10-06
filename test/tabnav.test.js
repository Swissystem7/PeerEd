'use strict';
// Keyboard navigation of the tab bar: the arithmetic in src/lib/tabnav.js, and a static check that the
// shell wires it the way the WAI-ARIA tabs pattern asks (one tab stop, roving tabindex, arrows walk).
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { stepTab, KEYS, DIRECTIONS } = require('../src/lib/tabnav.js');

const ROOT = path.join(__dirname, '..');
const shell = fs.readFileSync(path.join(ROOT, 'src', 'app-shell.html'), 'utf8');
const app = shell.slice(shell.lastIndexOf('<script>'));
const tabsBlock = app.slice(app.indexOf('// ---------- tabs'));

test('tabnav: on a right-to-left screen ArrowLeft goes forward and ArrowRight goes back, both wrap', () => {
  assert.equal(stepTab(5, 0, 'ArrowLeft', 'rtl'), 1);
  assert.equal(stepTab(5, 3, 'ArrowLeft', 'rtl'), 4);
  assert.equal(stepTab(5, 4, 'ArrowLeft', 'rtl'), 0, 'past the last tab comes the first');
  assert.equal(stepTab(5, 1, 'ArrowRight', 'rtl'), 0);
  assert.equal(stepTab(5, 0, 'ArrowRight', 'rtl'), 4, 'before the first tab comes the last');
});

test('tabnav: on a left-to-right screen the arrows swap, so the key always moves the way it points', () => {
  for (let i = 0; i < 5; i += 1) {
    assert.equal(stepTab(5, i, 'ArrowRight', 'ltr'), stepTab(5, i, 'ArrowLeft', 'rtl'));
    assert.equal(stepTab(5, i, 'ArrowLeft', 'ltr'), stepTab(5, i, 'ArrowRight', 'rtl'));
  }
});

test('tabnav: Home and End are the ends in either direction, and a single tab always stays put', () => {
  for (const dir of DIRECTIONS) {
    assert.equal(stepTab(5, 2, 'Home', dir), 0);
    assert.equal(stepTab(5, 2, 'End', dir), 4);
    for (const key of KEYS) assert.equal(stepTab(1, 0, key, dir), 0);
  }
});

test('tabnav: a key that is not ours is -1, so the browser keeps Tab, Enter, Space and letters', () => {
  for (const key of ['Tab', 'Enter', ' ', 'ArrowUp', 'ArrowDown', 'a', 'Escape', '', undefined]) {
    assert.equal(stepTab(5, 2, key, 'rtl'), -1, String(key));
  }
  assert.deepEqual(KEYS, ['ArrowLeft', 'ArrowRight', 'Home', 'End']);
});

test('tabnav: a bad count, index or direction is refused rather than guessed', () => {
  assert.throws(() => stepTab(0, 0, 'Home', 'rtl'), /invalid tab count/);
  assert.throws(() => stepTab(2.5, 0, 'Home', 'rtl'), /invalid tab count/);
  assert.throws(() => stepTab(5, 5, 'Home', 'rtl'), /invalid current tab/);
  assert.throws(() => stepTab(5, -1, 'Home', 'rtl'), /invalid current tab/);
  assert.throws(() => stepTab(5, 0, 'Home', 'auto'), /invalid direction/);
  assert.throws(() => stepTab(5, 0, 'Home'), /invalid direction/);
});

test('tabnav: the shell is one tab stop - the selected tab has tabindex 0, every other tab -1', () => {
  const tabs = shell.match(/<button role="tab"[^>]*>/g) || [];
  assert.ok(tabs.length >= 2, 'expected a tab bar');
  const selected = tabs.filter((t) => t.indexOf('aria-selected="true"') !== -1);
  assert.equal(selected.length, 1, 'exactly one tab starts selected');
  for (const t of tabs) {
    const on = t.indexOf('aria-selected="true"') !== -1;
    assert.ok(t.indexOf(on ? 'tabindex="0"' : 'tabindex="-1"') !== -1, t);
  }
  assert.ok(/<html lang="he" dir="rtl">/.test(shell), 'the screen is right-to-left, so the rtl rule is the one in use');
});

test('tabnav: the shell asks tabnav.stepTab where to go, moves the roving tabindex and focuses the new tab', () => {
  assert.ok(tabsBlock.indexOf('tabnav.stepTab(') !== -1, 'the arrow arithmetic must come from the module');
  assert.ok(tabsBlock.indexOf("addEventListener('keydown'") !== -1);
  assert.ok(/\.tabIndex = on \? 0 : -1/.test(tabsBlock), 'the selected tab is the only one in the Tab order');
  assert.ok(tabsBlock.indexOf('ev.preventDefault()') !== -1, 'a handled arrow must not also scroll the page');
  assert.ok(tabsBlock.indexOf('tab.focus()') !== -1, 'focus follows the selection');
  assert.ok(tabsBlock.indexOf("documentElement.dir === 'ltr' ? 'ltr' : 'rtl'") !== -1, 'the direction is read from the document');
  assert.equal(/['"](ArrowLeft|ArrowRight|Home|End)['"]/.test(tabsBlock), false,
    'the shell must not re-implement the key table');
  assert.ok(app.indexOf('tabnav = __registry.tabnav') !== -1, 'tabnav.js is inlined and picked up');
});
