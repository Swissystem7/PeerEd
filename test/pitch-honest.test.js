'use strict';
// The pitch goes to organisations as "רק מה שקיים בקוד". Its subject list must be the one the engine
// accepts, and its record and match lines must name the parent consent a pupil needs to be paired.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { SUBJECTS } = require('../src/lib/profile.js');

const root = path.join(__dirname, '..');
const pitch = fs.readFileSync(path.join(root, 'docs', 'launch', 'PITCH.md'), 'utf8');
const shell = fs.readFileSync(path.join(root, 'src', 'app-shell.html'), 'utf8');
const lines = pitch.split(/\r?\n/);

test('pitch: the subject line counts and names every subject the engine accepts', () => {
  const line = lines.find((l) => /\*\*\d+ מקצועות:\*\*/.test(l));
  assert.equal(Number(line.match(/\*\*(\d+) מקצועות/)[1]), SUBJECTS.length, line);
  SUBJECTS.forEach((code) => {
    const he = shell.match(new RegExp(code + ": '([^']+)'"))[1];
    assert.ok(line.includes(he), code + ' / ' + he + ': ' + line);
  });
});

test('pitch: the record, match and reason lines name the parent consent', () => {
  ['רשומה אחת בלבד', '**שידוך:**', 'מי נשאר בלי זוג'].forEach((key) => {
    const line = lines.find((l) => l.includes(key));
    assert.match(line, /אישור הורה/, line);
  });
});
