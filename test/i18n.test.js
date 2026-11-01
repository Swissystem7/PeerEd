const test = require('node:test');
const assert = require('node:assert/strict');
const i18n = require('../src/lib/i18n');

test('i18n defaults to Hebrew with RTL', () => {
  assert.equal(i18n.DEFAULT_LANGUAGE, 'he');
  const meta = i18n.getLanguageMeta('he');
  assert.equal(meta.code, 'he');
  assert.equal(meta.dir, 'rtl');
  assert.equal(meta.needsNativeReview, false);
});

test('Arabic is RTL and marked for native-speaker review', () => {
  const meta = i18n.getLanguageMeta('ar');
  assert.equal(meta.code, 'ar');
  assert.equal(meta.dir, 'rtl');
  assert.equal(meta.needsNativeReview, true);
});

test('Russian is LTR and marked for native-speaker review', () => {
  const meta = i18n.getLanguageMeta('ru');
  assert.equal(meta.code, 'ru');
  assert.equal(meta.dir, 'ltr');
  assert.equal(meta.needsNativeReview, true);
});

test('100% string key parity between Hebrew, Arabic, and Russian', () => {
  const parity = i18n.verifyLanguageParity();
  assert.equal(parity.ok, true, 'Every key in Hebrew must exist in Arabic and Russian: ' + JSON.stringify(parity.missingKeys));
});

test('t() returns translated string and falls back to Hebrew for unknown keys or languages', () => {
  assert.equal(i18n.t('tabPeople', 'he'), 'אנשים');
  assert.equal(i18n.t('tabPeople', 'ar'), 'الأشخاص');
  assert.equal(i18n.t('tabPeople', 'ru'), 'Люди');
  assert.equal(i18n.t('tabPeople', 'unknown'), 'אנשים');
});
