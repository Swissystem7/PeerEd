'use strict';
// The text gate is a demonstration: nothing in the app stores free text, and "enrichment units" do not
// exist. The screen must not promise either. (test/app-build.test.js already proves no text is stored.)
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

test('the screen does not sell enrichment units that do not exist, and calls the gate a demo', () => {
  const html = fs.readFileSync(path.join(ROOT, 'app.html'), 'utf8');
  const visible = html.replace(/<script>[\s\S]*?<\/script>/g, '').replace(/<style>[\s\S]*?<\/style>/g, '');
  assert.doesNotMatch(visible, /יחיד(ת|ות) העשרה/);
  assert.match(visible, /<h2>הדגמה: /);
});
