'use strict';
// The check screen promises "ותראה מה נחסם". The gate reads the text after cleanText, so a phone number
// typed with two spaces inside it, or with a control character inside it, is a phone number to the gate.
// Read on the text as typed, the demo found nothing and then said "נדחה: פרטים אישיים לא מתקבלים" with
// no finding under it. The findings must be the gate's findings, and "תו N" must still count along the
// text the person typed.
const test = require('node:test');
const assert = require('node:assert/strict');
const { openApp } = require('../test-support/fake-dom.js');

function check(text) {
  const $ = openApp();
  $('checkText').value = text;
  $('checkBtn').fire('click');
  return { status: $('checkStatus').textContent, findings: $('findings').innerHTML };
}

test('a phone number with two spaces inside it is shown as the finding, not refused with nothing under it', () => {
  const r = check('050  1234567');
  assert.match(r.status, /^נחסם\. נמצא פרט אישי אחד\.$/, r.status);
  assert.doesNotMatch(r.status, /נדחה/, r.status);
  assert.match(r.findings, /מספר טלפון/, r.findings);
  assert.match(r.findings, /\(תו 1\)/, r.findings);
});

test('a phone number with a control character inside it is shown as the finding', () => {
  const r = check('050\u0001-1234567');
  assert.match(r.status, /^נחסם\./, r.status);
  assert.match(r.findings, /מספר טלפון/, r.findings);
  assert.match(r.findings, /\(תו 1\)/, r.findings);
});

test('"תו N" still counts along the text as typed, with the spaces the gate trims', () => {
  const r = check('  050-1234567');
  assert.match(r.findings, /\(תו 3\)/, r.findings);
});

test('a Windows line break and doubled spaces before the hit do not move "תו N"', () => {
  // 11 characters, CR, LF, then the number: the number starts at character 14 of the typed text.
  const r = check('אפשר להתקשר\r\n050  1234567');
  assert.match(r.status, /^נחסם\./, r.status);
  assert.match(r.findings, /\(תו 14\)/, r.findings);
});

test('an email the gate reads through doubled spaces around it is one finding at its typed position', () => {
  const r = check('כתבו  ל  dana@example.com');
  assert.match(r.status, /^נחסם\. נמצא פרט אישי אחד\.$/, r.status);
  assert.match(r.findings, /כתובת מייל/, r.findings);
  assert.match(r.findings, /\(תו 10\)/, r.findings);
});

test('a text the gate refuses as blank is still refused as blank, with no finding to show', () => {
  const r = check('\u0001 \u0001');
  assert.match(r.status, /^נדחה: /, r.status);
  assert.doesNotMatch(r.status, /פרטים אישיים|פוגענית/, r.status);
  assert.equal(r.findings, '');
});

test('"נדחה" never names personal data or offensive language: those come back as findings', () => {
  for (const text of ['050  1234567', 'ת"ז  123456789', 'הוא  מניאק', '\u0001מניאק']) {
    const r = check(text);
    assert.doesNotMatch(r.status, /^נדחה/, text + ' -> ' + r.status);
    assert.notEqual(r.findings, '', text);
  }
});
