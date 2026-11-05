'use strict';
// PE-410: Arabic (RTL) and Russian (LTR) localization on top of Hebrew default.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const i18n = require('../src/lib/i18n');

const ROOT = path.join(__dirname, '..');

test('every key exists in he, ar and ru with no empty strings', () => {
  const keys = i18n.getAllKeys();
  assert.ok(keys.length >= 60, 'expected the full UI string set, got ' + keys.length);
  for (const lang of ['he', 'ar', 'ru']) {
    for (const key of keys) {
      const value = i18n.STRINGS[lang][key];
      assert.equal(typeof value, 'string', lang + '.' + key + ' must be a string');
      assert.notEqual(value.trim(), '', lang + '.' + key + ' must not be empty');
    }
  }
  assert.equal(i18n.verifyLanguageParity().ok, true);
});

test('dir attribute is correct per language and Hebrew is the default', () => {
  assert.equal(i18n.DEFAULT_LANGUAGE, 'he');
  assert.equal(i18n.dirFor('he'), 'rtl');
  assert.equal(i18n.dirFor('ar'), 'rtl');
  assert.equal(i18n.dirFor('ru'), 'ltr');
  assert.deepEqual(i18n.SUPPORTED_LANGUAGES, ['he', 'ar', 'ru']);
});

test('language selector offers Hebrew, Arabic and Russian in shell and built app', () => {
  for (const rel of ['src/app-shell.html', 'app.html']) {
    const html = fs.readFileSync(path.join(ROOT, rel), 'utf8');
    assert.match(html, /id="langSelect"/, rel + ' must carry the language selector');
    assert.match(html, /<option value="he">/, rel + ' must offer Hebrew');
    assert.match(html, /<option value="ar">/, rel + ' must offer Arabic');
    assert.match(html, /<option value="ru">/, rel + ' must offer Russian');
    assert.match(html, /applyLanguage/, rel + ' must wire language switching');
    assert.match(html, /dirFor/, rel + ' must set dir per language');
  }
});

test('Arabic and Russian strings are real translations, not Hebrew copies', () => {
  for (const key of ['tabPeople', 'participantsHeading', 'submitUnitBtn', 'logHeading']) {
    assert.notEqual(i18n.t(key, 'ar'), i18n.t(key, 'he'), 'ar.' + key);
    assert.notEqual(i18n.t(key, 'ru'), i18n.t(key, 'he'), 'ru.' + key);
  }
  assert.match(i18n.t('tabPeople', 'ar'), /[\u0600-\u06FF]/);
  assert.match(i18n.t('tabPeople', 'ru'), /[\u0400-\u04FF]/);
});
