'use strict';
// PE-410: Arabic (RTL) and Russian (LTR) localization on top of Hebrew default.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
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

test('LANG_META has expected properties and getLanguageMeta falls back to Hebrew', () => {
  assert.deepEqual(i18n.getLanguageMeta('he'), { code: 'he', dir: 'rtl', label: 'עברית', needsNativeReview: false });
  assert.deepEqual(i18n.getLanguageMeta('ar'), { code: 'ar', dir: 'rtl', label: 'العربية', needsNativeReview: true });
  assert.deepEqual(i18n.getLanguageMeta('ru'), { code: 'ru', dir: 'ltr', label: 'Русский', needsNativeReview: true });
  assert.deepEqual(i18n.LANG_META.he, { code: 'he', dir: 'rtl', label: 'עברית', needsNativeReview: false });
  assert.deepEqual(i18n.LANG_META.ar, { code: 'ar', dir: 'rtl', label: 'العربية', needsNativeReview: true });
  assert.deepEqual(i18n.LANG_META.ru, { code: 'ru', dir: 'ltr', label: 'Русский', needsNativeReview: true });

  assert.deepEqual(i18n.getLanguageMeta('unknown'), i18n.getLanguageMeta('he'));
  assert.deepEqual(i18n.getLanguageMeta(''), i18n.getLanguageMeta('he'));
  assert.deepEqual(i18n.getLanguageMeta(null), i18n.getLanguageMeta('he'));
  assert.deepEqual(i18n.getLanguageMeta(undefined), i18n.getLanguageMeta('he'));

  assert.equal(i18n.dirFor('unknown'), 'rtl');
  assert.equal(i18n.dirFor(''), 'rtl');
  assert.equal(i18n.dirFor(null), 'rtl');
  assert.equal(i18n.dirFor(undefined), 'rtl');
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

test('t() returns translation, falls back to Hebrew or key name, and handles unknown languages', () => {
  assert.equal(i18n.t('appName', 'he'), 'PeerEd');
  assert.equal(i18n.t('appName', 'ar'), 'PeerEd');
  assert.equal(i18n.t('appName', 'ru'), 'PeerEd');

  // Fallback to Hebrew when lang is not supported or falsy
  assert.equal(i18n.t('tabPeople', 'unknown_lang'), 'אנשים');
  assert.equal(i18n.t('tabPeople', null), 'אנשים');
  assert.equal(i18n.t('tabPeople', undefined), 'אנשים');
  assert.equal(i18n.t('tabPeople', false), 'אנשים');
  assert.equal(i18n.t('tabPeople', ''), 'אנשים');
  assert.equal(i18n.t('tabPeople'), 'אנשים');

  // Fallback to key when missing in both requested language and Hebrew
  assert.equal(i18n.t('nonexistent_key_xyz', 'ar'), 'nonexistent_key_xyz');
  assert.equal(i18n.t('nonexistent_key_xyz', 'he'), 'nonexistent_key_xyz');
  assert.equal(i18n.t('nonexistent_key_xyz'), 'nonexistent_key_xyz');

  // Fallback to Hebrew when key exists in Hebrew but is missing or non-string in target language
  try {
    i18n.STRINGS.he.__test_key__ = 'עברית מקורית';
    assert.equal(i18n.t('__test_key__', 'ar'), 'עברית מקורית');
    assert.equal(i18n.t('__test_key__', 'ru'), 'עברית מקורית');

    i18n.STRINGS.ar.__test_key__ = 12345;
    assert.equal(i18n.t('__test_key__', 'ar'), 'עברית מקורית');

    // Empty string in Hebrew preserved even when falling back
    i18n.STRINGS.he.__empty_key__ = '';
    assert.equal(i18n.t('__empty_key__', 'unknown_lang'), '');
    assert.equal(i18n.t('__empty_key__', 'he'), '');
    assert.equal(i18n.t('__empty_key__'), '');
  } finally {
    delete i18n.STRINGS.he.__test_key__;
    delete i18n.STRINGS.ar.__test_key__;
    delete i18n.STRINGS.he.__empty_key__;
  }
});

test('verifyLanguageParity detects missing keys, non-strings, and whitespace in non-default languages', () => {
  const initial = i18n.verifyLanguageParity();
  assert.equal(initial.ok, true);
  assert.deepEqual(initial.missingKeys, {});

  const testKey = 'appName';
  const arOrig = i18n.STRINGS.ar[testKey];
  const ruOrig = i18n.STRINGS.ru[testKey];

  // 1. Missing key in Arabic
  try {
    delete i18n.STRINGS.ar[testKey];
    const res = i18n.verifyLanguageParity();
    assert.equal(res.ok, false);
    assert.deepEqual(res.missingKeys.ar, [testKey]);
  } finally {
    i18n.STRINGS.ar[testKey] = arOrig;
  }

  // 2. Non-string value in Russian
  try {
    i18n.STRINGS.ru[testKey] = 999;
    const res = i18n.verifyLanguageParity();
    assert.equal(res.ok, false);
    assert.deepEqual(res.missingKeys.ru, [testKey]);
  } finally {
    i18n.STRINGS.ru[testKey] = ruOrig;
  }

  // 3. Empty string in Russian
  try {
    i18n.STRINGS.ru[testKey] = '';
    const res = i18n.verifyLanguageParity();
    assert.equal(res.ok, false);
    assert.deepEqual(res.missingKeys.ru, [testKey]);
  } finally {
    i18n.STRINGS.ru[testKey] = ruOrig;
  }

  // 4. Whitespace-only string in Arabic
  try {
    i18n.STRINGS.ar[testKey] = '   \t  \n ';
    const res = i18n.verifyLanguageParity();
    assert.equal(res.ok, false);
    assert.deepEqual(res.missingKeys.ar, [testKey]);
  } finally {
    i18n.STRINGS.ar[testKey] = arOrig;
  }

  // 5. Entire language dictionary missing from STRINGS
  const origRuTable = i18n.STRINGS.ru;
  try {
    delete i18n.STRINGS.ru;
    const res = i18n.verifyLanguageParity();
    assert.equal(res.ok, false);
    assert.equal(res.missingKeys.ru.length, i18n.getAllKeys().length);
  } finally {
    i18n.STRINGS.ru = origRuTable;
  }

  // 6. DEFAULT_LANGUAGE (he) is skipped in verifyLanguageParity
  try {
    i18n.STRINGS.he.__only_in_he__ = 'בדיקה';
    i18n.STRINGS.he.__he_empty__ = '';
    const res = i18n.verifyLanguageParity();
    assert.equal(res.ok, false);
    assert.ok(res.missingKeys.ar.includes('__only_in_he__'));
    assert.ok(res.missingKeys.ru.includes('__only_in_he__'));
    assert.equal(res.missingKeys.he, undefined);
  } finally {
    delete i18n.STRINGS.he.__only_in_he__;
    delete i18n.STRINGS.he.__he_empty__;
  }
});

test('UMD wrapper exports to module.exports in CommonJS and global in browser', () => {
  const code = fs.readFileSync(path.join(ROOT, 'src/lib/i18n.js'), 'utf8');

  // Case A: Browser environment with globalThis (no module)
  const browserGlobal = { process, __stryker__: globalThis.__stryker__ };
  browserGlobal.globalThis = browserGlobal;
  vm.runInNewContext(code, browserGlobal);
  assert.ok(browserGlobal.PeerEdI18n);
  assert.equal(browserGlobal.PeerEdI18n.DEFAULT_LANGUAGE, 'he');

  // Case B: Browser environment where globalThis is shadowed/undefined
  const oldBrowser = { process, __stryker__: globalThis.__stryker__ };
  vm.runInNewContext(`(function(globalThis) { ${code} }).call(this, undefined)`, oldBrowser);
  assert.ok(oldBrowser.PeerEdI18n);
  assert.equal(oldBrowser.PeerEdI18n.DEFAULT_LANGUAGE, 'he');

  // Case C: module is an object but module.exports is falsy/null
  const fakeRoot = { process, __stryker__: globalThis.__stryker__ };
  fakeRoot.globalThis = fakeRoot;
  const fakeMod = { exports: null };
  vm.runInNewContext(code, { ...fakeRoot, module: fakeMod });
  assert.ok(fakeRoot.PeerEdI18n);
  assert.equal(fakeMod.exports, null);

  // Case D: globalThis is passed but `this` is a different object
  const customGlobal = { process, __stryker__: globalThis.__stryker__ };
  vm.runInNewContext(`(function(globalThis) { ${code} }).call({}, customGlobal)`, {
    customGlobal,
    process,
    __stryker__: globalThis.__stryker__
  });
  assert.ok(customGlobal.PeerEdI18n);
  assert.equal(customGlobal.PeerEdI18n.DEFAULT_LANGUAGE, 'he');
});
