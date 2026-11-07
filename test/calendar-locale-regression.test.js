'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { DAYS } = require('../src/lib/profile.js');

const ROOT = path.join(__dirname, '..');
const SHELL_PATH = path.join(ROOT, 'src', 'app-shell.html');

function extractDayDefinitions() {
  const shell = fs.readFileSync(SHELL_PATH, 'utf8');

  const dayHeMatch = shell.match(/var\s+DAY_HE\s*=\s*({[^}]+});/);
  assert.ok(dayHeMatch, 'DAY_HE definition must exist in src/app-shell.html');
  const DAY_HE = Function('return ' + dayHeMatch[1])();

  const dayNamesMatch = shell.match(/var\s+DAY_NAMES\s*=\s*({[\s\S]*?});/);
  assert.ok(dayNamesMatch, 'DAY_NAMES definition must exist in src/app-shell.html');
  const DAY_NAMES = Function('return ' + dayNamesMatch[1])();

  return { DAY_HE, DAY_NAMES };
}

test('extract day name definitions (DAY_HE and DAY_NAMES for he, ar, and ru) from src/app-shell.html', () => {
  const { DAY_HE, DAY_NAMES } = extractDayDefinitions();
  assert.ok(DAY_HE && typeof DAY_HE === 'object', 'DAY_HE must be an object');
  assert.ok(DAY_NAMES && typeof DAY_NAMES === 'object', 'DAY_NAMES must be an object');
  assert.ok('ar' in DAY_NAMES, 'DAY_NAMES must have ar');
  assert.ok('ru' in DAY_NAMES, 'DAY_NAMES must have ru');
  assert.ok('he' in DAY_NAMES, 'DAY_NAMES must have he key');
});

test('verify day name definitions for each supported language (he, ar, ru)', () => {
  const { DAY_HE, DAY_NAMES } = extractDayDefinitions();

  const scriptPatterns = {
    he: /[\u0590-\u05FF]/,
    ar: /[\u0600-\u06FF]/,
    ru: /[\u0400-\u04FF]/
  };

  const tables = {
    he: DAY_HE,
    ar: DAY_NAMES.ar,
    ru: DAY_NAMES.ru
  };

  for (const lang of ['he', 'ar', 'ru']) {
    const table = tables[lang];
    assert.ok(table, `Day name table for ${lang} must exist`);

    const keys = Object.keys(table);
    assert.equal(keys.length, 7, `${lang} must have exactly 7 day names defined`);
    assert.deepEqual(keys.slice().sort(), [...DAYS].sort(), `${lang} day keys must match profile.DAYS`);

    for (const day of DAYS) {
      const val = table[day];
      assert.notEqual(val, undefined, `${lang}.${day} must not be undefined`);
      assert.notEqual(val, null, `${lang}.${day} must not be null`);
      assert.equal(typeof val, 'string', `${lang}.${day} must be a string`);
      assert.notEqual(val.trim(), '', `${lang}.${day} must not be empty string`);
      assert.notEqual(val, day, `${lang}.${day} must not fall back to English identifier`);
      assert.doesNotMatch(val, /[a-zA-Z]/, `${lang}.${day} must not contain Latin characters`);
      assert.match(val, scriptPatterns[lang], `${lang}.${day} must contain native script characters for ${lang}`);
    }
  }
});

test('verify day name translations across language switching transitions (he -> ar -> ru -> he)', () => {
  const { DAY_HE, DAY_NAMES } = extractDayDefinitions();

  const scriptPatterns = {
    he: /[\u0590-\u05FF]/,
    ar: /[\u0600-\u06FF]/,
    ru: /[\u0400-\u04FF]/
  };

  function resolveLocaleTable(lang) {
    if (lang === 'he') {
      return DAY_NAMES.he || DAY_HE;
    }
    return DAY_NAMES[lang] || DAY_HE;
  }

  const transitions = ['he', 'ar', 'ru', 'he'];

  for (let i = 0; i < transitions.length; i++) {
    const lang = transitions[i];
    const table = resolveLocaleTable(lang);

    assert.ok(table, `Locale table must be defined at transition step ${i} (${lang})`);
    const keys = Object.keys(table);
    assert.equal(keys.length, 7, `Transition ${lang} must have exactly 7 day names`);
    assert.deepEqual(keys.slice().sort(), [...DAYS].sort(), `Transition ${lang} keys must match profile.DAYS`);

    for (const day of DAYS) {
      const val = table[day];
      assert.ok(val !== undefined && val !== null && val !== '', `Transition ${lang}.${day} must be defined and non-empty`);
      assert.doesNotMatch(val, /[a-zA-Z]/, `Transition ${lang}.${day} must not contain Latin characters`);
      assert.match(val, scriptPatterns[lang], `Transition ${lang}.${day} must contain native script characters`);
    }
  }
});
