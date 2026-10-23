'use strict';
// The sessions card's hint said the export is the counts "כקובץ CSV", a card away from "הורד זוגות (CSV)",
// which does save a file - but the report export saves none: it is CSV text in a read-only box, selected,
// and the clipboard is tried on top. The hint now says it opens in the box and is not saved as a file.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { openApp } = require('../test-support/fake-dom.js');

const shell = fs.readFileSync(path.join(__dirname, '..', 'src', 'app-shell.html'), 'utf8');

function reportHint() {
  const card = shell.slice(shell.indexOf('<h2>סיכום לרשות — ספירות בלבד</h2>'), shell.indexOf('id="exportReport"'));
  const m = card.match(/<p class="hint">([\s\S]*?)<\/p>/);
  assert.ok(m, 'the hint under the sessions summary');
  return m[1].replace(/\s+/g, ' ');
}

test('report hint: no promise of a file, says where the text opens', () => {
  const hint = reportHint();
  assert.equal(/כקובץ CSV/.test(hint), false, 'the export is not a file');
  assert.match(hint, /כטקסט CSV/);
  assert.match(hint, /נפתח בתיבה למטה מסומן להעתקה/);
  assert.match(hint, /לא יורד כקובץ/);
});

test('report hint: the export really saves no file and opens the box', () => {
  const $ = openApp();
  $('nav-sessions').fire('click');
  const before = $.downloads.length;
  $('exportReport').fire('click');
  assert.equal($.downloads.length, before, 'no file went down');
  assert.equal($('reportBox').hidden, false);
  assert.match($('reportText').value, /^measure,code,count$/m);
});
