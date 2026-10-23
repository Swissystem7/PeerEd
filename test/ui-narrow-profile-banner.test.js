'use strict';
// The participants screen's banner said "הרשומה היחידה שנשמרת היא תפקיד, אזור, שעות פנויות ומקצועות"
// and the privacy tab's hint said the only free text kept is a unit's title and body and a rejection
// reason - over a profile.makeProfile that also takes blockedUsers, reportEvent and responseToReport
// (whose details pass the text gate) and writes a retention stamp of its own. The README said the same
// until #322. Both lines now name what the record takes.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { ROOT } = require('../test-support/fake-dom.js');
const profile = require('../src/lib/profile.js');

const shell = fs.readFileSync(path.join(ROOT, 'src', 'app-shell.html'), 'utf8');

function peopleBanner() {
  const m = /id="tab-people"[\s\S]*?<div class="banner">([\s\S]*?)<\/div>/.exec(shell);
  assert.ok(m, 'the participants screen has a banner');
  return m[1].replace(/\s+/g, ' ');
}

test('the banner does not call the four fields and the flag the only record kept', () => {
  const b = peopleBanner();
  assert.doesNotMatch(b, /הרשומה היחידה/, b);
  assert.match(b, /חותמת שמירה/, b);
  assert.match(b, /חסומים/, b);
  assert.match(b, /דיווחים ותגובות לדיווח/, b);
  assert.match(b, /שער הטקסט/, b);
  assert.match(b, /כל שדה אחר/, b);
});

test('what the banner names is what makeProfile takes and writes', () => {
  assert.deepEqual(profile.ACCEPTED_FIELDS.slice().sort(), ['availability', 'blockedUsers', 'parentConsent',
    'region', 'reportEvent', 'responseToReport', 'role', 'subjects']);
  const p = profile.makeProfile({ role: 'student', region: 'CENTER', availability: ['SUN_16'], subjects: ['MATH'] });
  assert.ok(p.retention, 'makeProfile writes the retention stamp');
});

test('the privacy hint names the report details as stored free text', () => {
  const m = /<h2>הדגמה: שער הטקסט<\/h2>\s*<p class="hint">([\s\S]*?)<\/p>/.exec(shell);
  assert.ok(m);
  const h = m[1].replace(/\s+/g, ' ');
  assert.doesNotMatch(h, /הוא רק כותרת/, h);
  assert.match(h, /תגובה לדיווח/, h);
});
