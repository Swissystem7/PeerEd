'use strict';
// The viewport meta says viewport-fit=cover, so on a phone with a notch or a home indicator the page is
// drawn under them. The tab bar is fixed to the bottom: without the safe-area inset its buttons sit under
// the iPhone home bar, and the last card on every screen hides behind the taller bar.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { ROOT } = require('../test-support/fake-dom.js');

const html = fs.readFileSync(path.join(ROOT, 'app.html'), 'utf8');
const css = html.slice(html.indexOf('<style>'), html.indexOf('</style>'));
function rule(selector) {
  const m = css.match(new RegExp('(?:^|\\n)\\s*' + selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*\\{([^}]*)\\}'));
  assert.ok(m, 'no CSS rule for ' + selector);
  return m[1];
}

test('the page opts into drawing under the notch, so it must handle the insets', () => {
  assert.match(html, /<meta name="viewport"[^>]*viewport-fit=cover/);
});

test('the fixed tab bar clears the home indicator', () => {
  const nav = rule('nav');
  assert.match(nav, /position:fixed/);
  assert.match(nav, /padding-bottom:env\(safe-area-inset-bottom, 0px\)/);
});

test('the content leaves room for the taller tab bar', () => {
  assert.match(rule('body'), /padding-bottom:calc\(78px \+ env\(safe-area-inset-bottom, 0px\)\)/);
});

test('side insets are physical left/right, not logical, because the page is RTL', () => {
  assert.match(html, /<html lang="he" dir="rtl">/);
  for (const sel of ['nav', '.wrap']) {
    const body = rule(sel);
    assert.match(body, /padding-left:[^;]*env\(safe-area-inset-left, 0px\)/, sel);
    assert.match(body, /padding-right:[^;]*env\(safe-area-inset-right, 0px\)/, sel);
    assert.doesNotMatch(body, /padding-inline:[^;]*safe-area/, sel + ' must not map a physical inset to a logical side');
  }
});
