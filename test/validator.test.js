'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');

const { PATTERNS, PERSONAL_DATA_ERROR, findPersonalData, assertCleanText } = require('../src/lib/validator.js');

function kindsIn(text) {
  return findPersonalData(text).map((h) => h.kind);
}

test('validator: PATTERNS is a frozen table of regexes', () => {
  assert.ok(Object.isFrozen(PATTERNS));
  assert.deepEqual(Object.keys(PATTERNS).sort(), ['email', 'handle', 'id_number', 'phone', 'url']);
  Object.keys(PATTERNS).forEach((k) => assert.ok(PATTERNS[k] instanceof RegExp, k));
  assert.equal(PERSONAL_DATA_ERROR, 'personal data is not accepted');
});

test('validator: an email is detected with its exact text and position', () => {
  const prefix = 'שלחו אלי ל ';
  const hits = findPersonalData(prefix + 'dana.levi@example.co.il ותודה');
  const email = hits.find((h) => h.kind === 'email');
  assert.ok(email, JSON.stringify(hits));
  assert.equal(email.match, 'dana.levi@example.co.il');
  assert.equal(email.index, prefix.length);
  assert.ok(!hits.some((h) => h.kind === 'handle'), 'the @host of an email is not also a handle');
});

test('validator: every Israeli phone form is detected', () => {
  for (const phone of ['050-1234567', '0501234567', '03-1234567', '+972-50-1234567', '+972501234567',
    '052 123 4567', '077-1234567']) {
    const hits = findPersonalData('אפשר להתקשר ' + phone + ' בערב');
    assert.ok(hits.some((h) => h.kind === 'phone'), phone + ' -> ' + JSON.stringify(hits));
  }
});

test('validator: a nine-digit id is detected, and a phone is never double-reported as one', () => {
  assert.deepEqual(kindsIn('תעודת זהות 123456789'), ['id_number']);
  const phoneHits = findPersonalData('0501234567');
  assert.deepEqual(phoneHits.map((h) => h.kind), ['phone']);
  assert.equal(phoneHits.length, 1, JSON.stringify(phoneHits));
});

test('validator: urls and social handles are detected', () => {
  assert.ok(kindsIn('הנה הקישור https://drive.google.com/file/d/abc/view').includes('url'));
  assert.ok(kindsIn('ראו www.example.com/lesson').includes('url'));
  assert.ok(kindsIn('אפשר למצוא אותי ב @dana_teacher').includes('handle'));
});

test('validator: ordinary Hebrew lesson text with numbers is clean', () => {
  for (const clean of ['פתרו 3 תרגילים מפרק 12 בעמוד 45',
    'טווח השנים 202026 אינו מספר זהות',
    'שיעור על משוואות: 2x + 5 = 15, לכן x = 5',
    'נפגשים בשעה 16:30 ליד הספרייה']) {
    assert.deepEqual(findPersonalData(clean), [], clean);
  }
});

test('validator: assertCleanText refuses personal data with the same message as the profile gate', () => {
  assert.throws(() => assertCleanText('כתבו לי ל dana@example.com'), { message: PERSONAL_DATA_ERROR });
  assert.throws(() => assertCleanText('הטלפון שלי 050-1234567'), { message: PERSONAL_DATA_ERROR });
  assert.throws(() => assertCleanText('תעודת זהות 123456789'), { message: PERSONAL_DATA_ERROR });
});

test('validator: assertCleanText enforces length bounds on the cleaned text', () => {
  assert.throws(() => assertCleanText('א'.repeat(4001)), { message: 'text too long' });
  assert.equal(assertCleanText('א'.repeat(4000)).length, 4000);
  assert.throws(() => assertCleanText('   '), { message: 'text too short' });
  assert.throws(() => assertCleanText(''), { message: 'text too short' });
  assert.throws(() => assertCleanText('אב', { minLength: 5 }), { message: 'text too short' });
  assert.throws(() => assertCleanText('אבגדה', { maxLength: 4 }), { message: 'text too long' });
});

test('validator: assertCleanText returns trimmed, collapsed text and keeps a single newline', () => {
  assert.equal(assertCleanText('  שיעור   על   שברים  '), 'שיעור על שברים');
  assert.equal(assertCleanText('שורה ראשונה \n  שורה שנייה'), 'שורה ראשונה\nשורה שנייה');
  assert.equal(assertCleanText('טקסט' + String.fromCharCode(0, 7, 27) + ' נקי'), 'טקסט נקי',
    'control characters are stripped, not turned into spaces');
  assert.equal(assertCleanText('טקסט\tעם\tטאב'), 'טקסט עם טאב');
});
