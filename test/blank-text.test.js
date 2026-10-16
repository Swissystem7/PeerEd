'use strict';
// A box that reads as empty is empty (issue #43). The free-text gate folds invisible characters when it
// looks for personal data, but it measured the length of the text as typed, so a title, a lesson text or
// a rejection reason made of nothing but a zero-width space or an RLM counted as text and was stored:
// the units screen then showed a unit with no title, and the approver could reject a unit without
// writing a reason - the one thing reject() promises never to allow. Every assertion here fails on the
// gate as it was before this change.
const test = require('node:test');
const assert = require('node:assert/strict');

const { assertCleanText, makeReportEvent } = require('../src/lib/validator.js');
const { makeUnit } = require('../src/lib/unit.js');
const approval = require('../src/lib/approval.js');
const { openApp } = require('../test-support/fake-dom.js');

// What a phone keyboard, a Hebrew keyboard or a paste from WhatsApp leaves behind, one per name.
const ZWSP = String.fromCharCode(0x200b);   // zero-width space
const RLM = String.fromCharCode(0x200f);    // right-to-left mark
const BOM = String.fromCharCode(0xfeff);    // zero-width no-break space
const SHY = String.fromCharCode(0x00ad);    // soft hyphen

test('gate: text that takes no space on the screen is as empty as an empty box', () => {
  for (const blank of [ZWSP, RLM, BOM, SHY, RLM + ZWSP, ' ' + RLM + '\t' + ZWSP + ' ', ZWSP + '\n' + RLM]) {
    assert.throws(() => assertCleanText(blank), { message: 'text too short' },
      'accepted as text: ' + JSON.stringify(blank));
  }
});

test('gate: nothing but invisible characters is reported as empty, not as too long', () => {
  assert.throws(() => assertCleanText(ZWSP.repeat(5000)), { message: 'text too short' });
});

test('gate: one visible character is text, and the invisible ones around it are kept as written', () => {
  const lesson = 'שיעור ' + RLM + '(שברים)' + RLM + ' במתמטיקה';
  assert.equal(assertCleanText(lesson), lesson);
  assert.equal(assertCleanText(RLM + 'א' + ZWSP), RLM + 'א' + ZWSP);
  assert.equal(assertCleanText('א' + ZWSP, { minLength: 1 }), 'א' + ZWSP);
});

test('units: a title or a body that reads as blank is refused, naming the field', () => {
  const ok = { title: 'שברים פשוטים', subject: 'MATH', durationMinutes: 20, body: 'פיצה שחולקה ל-8.' };
  assert.ok(makeUnit(ok).id, 'an ordinary unit still passes');
  assert.throws(() => makeUnit(Object.assign({}, ok, { title: ZWSP })),
    { message: 'invalid title: text too short, it is empty' });
  assert.throws(() => makeUnit(Object.assign({}, ok, { body: RLM + ZWSP })),
    { message: 'invalid body: text too short, it is empty' });
});

test('approval: a rejection reason that reads as blank is not a decision', () => {
  const unit = makeUnit({ title: 'כוחות', subject: 'PHYSICS', durationMinutes: 30, body: 'חוק שני של ניוטון.' });
  const queue = approval.submit(approval.emptyQueue(), unit);
  assert.throws(() => approval.reject(queue, unit.id, BOM + RLM),
    { message: 'invalid reason: text too short, it is empty' });
  assert.equal(approval.statusOf(queue, unit.id), 'pending', 'the unit is still waiting for a real reason');
});

test('report event: a detail that reads as blank is refused', () => {
  assert.throws(() => makeReportEvent({ userId: 'p-0123abcd', detail: ZWSP }),
    { message: 'text too short' });
});

// The gate's messages are English; what the teacher reads is the Hebrew line on the screen.
test('units screen: a blank-looking title is refused in Hebrew on the line the teacher is reading', () => {
  const $ = openApp();
  $('unitSubject').value = 'MATH';
  $('unitDuration').value = '20';
  $('unitTitle').value = RLM + ZWSP;
  $('unitBody').value = 'מתחילים בפיצה שחולקה ל-8. כמה זה 3/8 ועוד 2/8?';
  $('submitUnit').fire('click');
  const status = $('unitStatus').textContent;
  assert.match(status, /הכותרת ריקה/, status);
  assert.ok($('unitStatus').className.includes('bad'), status);
  assert.match($('pendingList').innerHTML, /אין יחידות שממתינות/, 'nothing reached the queue');
});
