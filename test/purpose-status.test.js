'use strict';
// PURPOSE.md ended on "ריפו מקומי בלבד. לא עולה ל-GitHub עד אישור של אבירן" - the repo has been on GitHub
// since 12.9.2026 (private), and the app's contact fallback links to its issue form there. The status line
// now says where the repo is, and that the app itself still sends nothing (test/offline.test.js).
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const purpose = fs.readFileSync(path.join(root, 'PURPOSE.md'), 'utf8');
const contact = require('../src/lib/contact.js');

test('PURPOSE.md does not say the repo is local only while the app links to it on GitHub', () => {
  assert.match(contact.ISSUE_FORM, /^https:\/\/github\.com\/Swissystem7\/PeerEd\//);
  assert.doesNotMatch(purpose, /ריפו מקומי בלבד/);
  assert.doesNotMatch(purpose, /לא עולה ל-GitHub/);
  assert.match(purpose, /ב-GitHub כריפו פרטי \(Swissystem7\/PeerEd/);
  assert.match(purpose, /האפליקציה עצמה לא שולחת דבר לרשת/);
});
