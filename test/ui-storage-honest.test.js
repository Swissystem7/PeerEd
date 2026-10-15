'use strict';
// The list lives in this browser's localStorage only. A coordinator who clears browsing data, or opens
// the app on another phone, finds an empty list; the screen has to say so before they rely on it.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { ROOT } = require('../test-support/fake-dom.js');

test('the participants card says where the list is kept and when it is lost', () => {
  const html = fs.readFileSync(path.join(ROOT, 'app.html'), 'utf8');
  const card = html.slice(html.indexOf('<h2>המשתתפים</h2>'), html.indexOf('id="peopleList"'));
  assert.match(card, /בדפדפן הזה בלבד/);
  assert.match(card, /נתוני הגלישה/);
  assert.match(card, /CSV/, 'and points at the export as the way to keep a copy');
});
