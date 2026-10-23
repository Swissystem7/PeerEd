'use strict';
// The README's "What does not exist" names every municipality report the screen has. The match screen has
// its own "סיכום לרשות" card besides the sessions one, so "beyond the session counts" alone left it out.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const readme = fs.readFileSync(path.join(root, 'README.md'), 'utf8').replace(/\s+/g, ' ');
const shell = fs.readFileSync(path.join(root, 'src', 'app-shell.html'), 'utf8');

test('readme: both "סיכום לרשות" cards of the screen are named', () => {
  assert.equal((shell.match(/<h2>סיכום לרשות/g) || []).length, 2);
  const gap = readme.match(/no reports for a municipality beyond ([^;]+?\))/);
  assert.ok(gap, 'the municipality line');
  assert.match(gap[1], /two on-screen count cards/);
  assert.match(gap[1], /match screen/);
  assert.match(gap[1], /sessions screen/);
});

test('readme: the match summary counts the pupils waiting for consent apart and has no file', () => {
  const on = readme.match(/On screen: (.+?)## What does not exist/)[1];
  assert.match(on, /סיכום לרשות/);
  assert.match(on, /waiting for a parent's consent counted apart/);
  assert.match(on, /no file to download/);
});
