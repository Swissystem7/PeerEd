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

test('validator: an invisible character inside a phone, an email, an id or a word does not hide it', () => {
  // RLM, LRM, zero-width space, zero-width joiner, soft hyphen, word joiner, BOM, bidi isolate
  assert.deepEqual(kindsIn('call 050‏1234567'), ['phone']);
  assert.deepEqual(kindsIn('call 050-‎123-4567'), ['phone']);
  assert.deepEqual(kindsIn('mail a​@b.com'), ['email']);
  assert.deepEqual(kindsIn('id 12345­6789'), ['id_number']);
  assert.deepEqual(kindsIn('see www.⁠example.com'), ['url']);
  assert.deepEqual(kindsIn('﻿@dana⁦_teacher'), ['handle']);
  assert.deepEqual(kindsIn('זו‍נה'), ['profanity']);
  assert.throws(() => assertCleanText('הנה 050‏1234567'), { message: PERSONAL_DATA_ERROR });
});

test('validator: invisible characters alone do not make clean text dirty, and are kept as written', () => {
  const text = 'שיעור ‏(שברים)‏ במתמטיקה';
  assert.deepEqual(findPersonalData(text), []);
  assert.equal(assertCleanText(text), text);
  assert.deepEqual(findPersonalData('​‏'), []);
});

test('validator: niqqud inside a Hebrew word does not hide it, and pointed lesson text stays clean', () => {
  // patah, qamats, shva, shuruq, dagesh, shin dot, holam, a cantillation mark, and a pointed presentation form
  for (const word of ['חָרָא', 'שַׁרְמוּטָה', 'זוֹנָה', 'מְטוּמְטָם', 'דֵּבִּיל', 'אִידְיוֹט֑', 'שׁרמוטה']) {
    assert.deepEqual(kindsIn('אתה ' + word), ['profanity'], word);
  }
  const pointed = 'הַתַּלְמִיד אַחְרַאי עַל הַשִּׁעוּר בְּמָתֶמָטִיקָה';
  assert.deepEqual(findPersonalData(pointed), []);
  assert.equal(assertCleanText(pointed), pointed, 'the stored text keeps its niqqud');
  // the maqaf is a visible hyphen, not a point: it still parts the words
  assert.deepEqual(findPersonalData('בית־ספר'), []);
});

test('validator: a phone is found however Israelis split it, and a list or a date is not a phone', () => {
  for (const phone of ['050-123-45-67', '054-12-34-567', '050 12 34 567', '050.123.4567', '(050) 1234567',
    '(03) 123-4567', '050–1234567', '+972 (50) 123-4567', '972501234567', '00972-50-1234567']) {
    assert.deepEqual(findPersonalData('הטלפון ' + phone).map((h) => [h.kind, h.match]), [['phone', phone]], phone);
  }
  for (const clean of ['הזוגיים: 0 2 4 6 8 10 12', 'המבחן ב-03.12.2024', 'בין השנים 1948-1967',
    'נפגשים 08:30-10:00', 'ציון 95.5 מתוך 100']) {
    assert.deepEqual(findPersonalData(clean), [], clean);
  }
});

test('validator: an id number with the check digit apart or in threes is still an id number', () => {
  assert.deepEqual(kindsIn('ת"ז 12345678-9'), ['id_number']);
  assert.deepEqual(kindsIn('ת"ז 123-456-789'), ['id_number']);
  assert.throws(() => assertCleanText('ת"ז 12345678-9'), { message: PERSONAL_DATA_ERROR });
});

test('validator: a bare link to a chat or a profile is a url, the host of an email stays the email', () => {
  for (const link of ['wa.me/972501234567', 't.me/dana_teacher', 'instagram.com/dana', 'edu.gov.il']) {
    assert.deepEqual(findPersonalData('כתבו לי ' + link).map((h) => [h.kind, h.match]), [['url', link]], link);
  }
  assert.deepEqual(kindsIn('dana.levi@example.co.il'), ['email']);
  for (const clean of ['console.log(x) מדפיס', 'Math.max(3, 4) הוא 4', 'פתרו 3.5 + 2.25']) {
    assert.deepEqual(findPersonalData(clean), [], clean);
  }
});

test('validator: an email spelled out with at and dot is still an email, English with at and dot is not', () => {
  for (const mail of ['dana at gmail dot com', 'dana [at] gmail [dot] com', 'dana (at) walla (dot) co (dot) il',
    'dana.levi AT gmail DOT com', 'dana at walla.co.il', 'dana@gmail dot com']) {
    assert.deepEqual(findPersonalData('כתבו לי ' + mail).map((h) => [h.kind, h.match]), [['email', mail]], mail);
  }
  assert.throws(() => assertCleanText('המייל שלי dana at gmail dot com'), { message: PERSONAL_DATA_ERROR });
  for (const clean of ['meet at noon', 'look at the dot on the map', 'the dot com bubble', 'data at home dot']) {
    assert.deepEqual(findPersonalData(clean), [], clean);
  }
});

test('validator: digits and @ from another keyboard are read as the plain ones', () => {
  // Arabic-Indic, Eastern Arabic-Indic, full-width and mathematical bold digits
  for (const phone of ['٠٥٠١٢٣٤٥٦٧', '۰۵۰۱۲۳۴۵۶۷', '０５０１２３４５６７', '𝟎𝟓𝟎𝟏𝟐𝟑𝟒𝟓𝟔𝟕']) {
    assert.deepEqual(findPersonalData('טלפון ' + phone).map((h) => [h.kind, h.match]), [['phone', '0501234567']], phone);
  }
  assert.deepEqual(kindsIn('dana＠example.com'), ['email']);
  assert.deepEqual(kindsIn('ｆｕｃｋ'), ['profanity']);
  // the gate reads the folded text, the stored text is kept as written
  assert.equal(assertCleanText('x² + 5 = 9'), 'x² + 5 = 9');
});

test('cleanText: a CR or CR LF line break stays a line break, a vertical tab or form feed is a space', () => {
  const { cleanText } = require('../src/lib/validator.js');
  assert.equal(cleanText('first line\rsecond line'), 'first line\nsecond line');
  assert.equal(cleanText('first line\r\nsecond line'), 'first line\nsecond line');
  assert.equal(cleanText('two\u000bwords\fhere'), 'two words here');
  assert.equal(cleanText('no\u0000glue'), 'noglue', 'other control characters are still dropped');
});

test('validator: a hit index is the position in the text as typed, not in the folded text', () => {
  // niqqud and an RLM before the email: the folded text is shorter, the screen shows the typed text
  const prefix = 'שָׁלוֹם‏, כִּתְבוּ לִי ל ';
  const typed = prefix + 'dana@example.com';
  const email = findPersonalData(typed).find((h) => h.kind === 'email');
  assert.ok(email);
  assert.equal(email.index, prefix.length);
  assert.equal(typed.slice(email.index, email.index + email.match.length), 'dana@example.com');
  // a full-width phone folds to the same length, so its typed index is unchanged
  const wide = 'טלפון: ０５０１２３４５６７';
  const phone = findPersonalData(wide).find((h) => h.kind === 'phone');
  assert.ok(phone);
  assert.equal(phone.index, 'טלפון: '.length);
});
