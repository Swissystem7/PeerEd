'use strict';
// The text gate is a demonstration: nothing in the app stores free text, and the screen must say so.
// (test/app-build.test.js already proves no text is stored; the enrichment units live on their own tab
// since the units screen landed, and test/units-screen.test.js covers that one.)
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { openApp, ROOT } = require('../test-support/fake-dom.js');

test('clean text is reported as not saved, because it is not', () => {
  const $ = openApp();
  $('checkText').value = 'שיעור על שברים: פתרו 3 תרגילים מפרק 12';
  $('checkBtn').fire('click');
  const s = $('checkStatus').textContent;
  assert.doesNotMatch(s, /יישמר|נשמר\./, s);
  assert.match(s, /לא נשמר/, s);
});

test('the screen calls the gate a demo', () => {
  const html = fs.readFileSync(path.join(ROOT, 'app.html'), 'utf8');
  const visible = html.replace(/<script>[\s\S]*?<\/script>/g, '').replace(/<style>[\s\S]*?<\/style>/g, '');
  assert.match(visible, /<h2>הדגמה: /);
});
