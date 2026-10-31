'use strict';
// The cross-region card said "זו הצעה: הרכז מחליט" and nothing more, so a coordinator who said yes to a
// suggestion looked for that pair on the lessons screen. Its pair list is matchPairs over the roster (same
// region only) and session.logSession refuses a pair with no single region, so a lesson of such a pair is
// never logged and never counted for the municipality. The hint now says so where the suggestion is made.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { text } = require('../test-support/fake-dom.js');
const profile = require('../src/lib/profile.js');
const match = require('../src/lib/match.js');
const session = require('../src/lib/session.js');
const approval = require('../src/lib/approval.js');
const unit = require('../src/lib/unit.js');

const app = fs.readFileSync(path.join(__dirname, '..', 'app.html'), 'utf8');
const card = app.slice(app.indexOf('<h2>שידוך בין אזורים (חירום)</h2>'), app.indexOf('id="across"'));

test('the cross-region hint says such a pair cannot be logged on the lessons screen', () => {
  const hint = text(card.slice(card.indexOf('<p class="hint">'))).replace(/\s+/g, ' ');
  assert.ok(hint.indexOf('הרכז מחליט') !== -1, hint);
  assert.ok(hint.indexOf('יומן השיעורים רושם רק זוג מאותו אזור') !== -1, hint);
  assert.ok(hint.indexOf('לא מופיע במסך "שיעורים"') !== -1, hint);
  assert.ok(hint.indexOf('לא נספר בסיכום לרשות') !== -1, hint);
});

test('what the hint says: a cross-region suggestion is refused by the log', () => {
  const students = [profile.makeProfile({ role: 'student', region: 'SOUTH', availability: ['SUN_16'], subjects: ['MATH'] })];
  const pupils = [profile.makeProfile({ role: 'pupil', region: 'NORTH', availability: ['SUN_16'], subjects: ['MATH'], parentConsent: true })];
  const pairs = match.matchPairs(students, pupils);
  assert.equal(pairs.length, 0, 'no same-region pair, so the lessons screen lists none');
  const across = match.matchAcrossRegions(students, pupils, pairs);
  assert.equal(across.length, 1, 'the card suggests one cross-region pair');

  const made = unit.makeUnit({ title: 'שברים', subject: 'MATH', durationMinutes: 20, body: 'שלושה תרגילים בשברים פשוטים.' });
  const queue = approval.approve(approval.submit(approval.emptyQueue(), made), made.id);
  assert.throws(() => session.logSession(session.emptyLog(), queue, across[0], {
    slot: 'SUN_16', subject: 'MATH', unitId: made.id, outcome: 'held'
  }), /invalid pair/);
});
