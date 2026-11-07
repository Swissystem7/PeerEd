'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.join(__dirname, '..');

function fakeElement(id) {
  const handlers = {};
  const attrs = {};
  return {
    id,
    value: '',
    textContent: '',
    className: '',
    innerHTML: '',
    hidden: false,
    children: [],
    addEventListener(type, fn) { (handlers[type] = handlers[type] || []).push(fn); },
    setAttribute(k, v) { attrs[k] = String(v); },
    getAttribute(k) { return k in attrs ? attrs[k] : null; },
    removeAttribute() {},
    click(target) {
      const ev = { target: target || this, preventDefault() {} };
      (handlers.click || []).forEach((fn) => fn.call(this, ev));
    }
  };
}

function loadAppShellContext() {
  const html = fs.readFileSync(path.join(ROOT, 'src', 'app-shell.html'), 'utf8');
  const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
  assert.ok(scripts.length >= 3, 'src/app-shell.html should carry its scripts');

  const els = {};
  const $ = (id) => (els[id] = els[id] || fakeElement(id));
  const store = {};
  const storage = {
    getItem: (k) => (Object.prototype.hasOwnProperty.call(store, k) ? store[k] : null),
    setItem: (k, v) => { store[k] = String(v); },
    removeItem: (k) => { delete store[k]; }
  };
  const doc = {
    getElementById: $,
    querySelectorAll: () => [],
    querySelector: () => null,
    documentElement: { lang: 'he', dir: 'rtl' },
    head: { appendChild() {} },
    createElement: () => fakeElement('dummy')
  };
  const windowObj = {
    scrollTo() {},
    document: doc,
    localStorage: storage
  };

  const ctx = {
    document: doc,
    localStorage: storage,
    window: windowObj,
    console,
    URL: { createObjectURL: () => '' },
    Blob: function () {}
  };

  vm.createContext(ctx);

  // Execute script 0 to setup __registry and require
  vm.runInContext(scripts[0], ctx);

  // Populate __registry with the library modules so script 2 dependencies resolve
  const libDir = path.join(ROOT, 'src', 'lib');
  for (const file of fs.readdirSync(libDir)) {
    if (file.endsWith('.js')) {
      const key = file.replace(/\.js$/, '');
      ctx.__registry[key] = require(path.join(libDir, file));
    }
  }

  // Execute script 2 (the main app script)
  vm.runInContext(scripts[2], ctx);

  return ctx.window;
}

const app = loadAppShellContext();
const { AI_TOPICS, validateAITopics, calculateAITopicMatch } = app;

test('Test 1: AI_TOPICS contains exactly the 4 required keys and is frozen', () => {
  assert.ok(AI_TOPICS, 'AI_TOPICS should exist');
  assert.ok(Object.isFrozen(AI_TOPICS), 'AI_TOPICS should be frozen');
  const expectedKeys = ['AI_CREATIVE', 'AI_ETHICS_SEC', 'AI_LIT_PROMPT', 'AI_STEM_CODE'];
  assert.deepEqual(Object.keys(AI_TOPICS).sort(), expectedKeys);
});

test('Test 2: Each topic key has non-empty string labels for he, ar, and ru and is frozen', () => {
  const expectedValues = {
    AI_LIT_PROMPT: {
      he: 'אוריינות בינה מלאכותית והנחיה',
      ar: 'الذكاء الاصطناعي وهندسة الأوامר',
      ru: 'Грамотность в ИИ и промптинг'
    },
    AI_CREATIVE: {
      he: 'יצירתיות ובינה יוצרת',
      ar: 'الإبداع والذكاء التوليدي',
      ru: 'Творчество и генеративный ИИ'
    },
    AI_STEM_CODE: {
      he: 'מדעים, טכנולוגיה ותכנות',
      ar: 'العلوم والتقنية والברמجة',
      ru: 'STEM и программирование'
    },
    AI_ETHICS_SEC: {
      he: 'אתיקה, פרטיות ובטיחות',
      ar: 'الأخلاقيات والأمان والخصوصية',
      ru: 'Этика и безопасность ИИ'
    }
  };

  for (const [key, labels] of Object.entries(expectedValues)) {
    const topic = AI_TOPICS[key];
    assert.ok(topic, `AI_TOPICS[${key}] should exist`);
    assert.ok(Object.isFrozen(topic), `AI_TOPICS[${key}] child object should be frozen`);

    for (const lang of ['he', 'ar', 'ru']) {
      assert.strictEqual(typeof topic[lang], 'string', `${key}.${lang} should be a string`);
      assert.ok(topic[lang].trim().length > 0, `${key}.${lang} should be non-empty`);
      assert.strictEqual(topic[lang], labels[lang], `${key}.${lang} should match expected specification label`);
    }
  }
});

test('Test 3: validateAITopics returns true for valid arrays containing single or multiple valid keys', () => {
  assert.strictEqual(validateAITopics(['AI_LIT_PROMPT']), true);
  assert.strictEqual(validateAITopics(['AI_CREATIVE']), true);
  assert.strictEqual(validateAITopics(['AI_STEM_CODE']), true);
  assert.strictEqual(validateAITopics(['AI_ETHICS_SEC']), true);
  assert.strictEqual(validateAITopics(['AI_LIT_PROMPT', 'AI_CREATIVE']), true);
  assert.strictEqual(validateAITopics(['AI_STEM_CODE', 'AI_ETHICS_SEC']), true);
  assert.strictEqual(validateAITopics(['AI_LIT_PROMPT', 'AI_CREATIVE', 'AI_STEM_CODE', 'AI_ETHICS_SEC']), true);
});

test('Test 4: validateAITopics returns false for non-arrays (null, undefined, number, string, object) and empty arrays', () => {
  assert.strictEqual(validateAITopics(null), false);
  assert.strictEqual(validateAITopics(undefined), false);
  assert.strictEqual(validateAITopics(42), false);
  assert.strictEqual(validateAITopics('AI_LIT_PROMPT'), false);
  assert.strictEqual(validateAITopics({}), false);
  assert.strictEqual(validateAITopics({ AI_LIT_PROMPT: true }), false);
  assert.strictEqual(validateAITopics([]), false);
});

test('Test 5: validateAITopics returns false for arrays containing free text or unknown keys', () => {
  assert.strictEqual(validateAITopics(['UNKNOWN_KEY']), false);
  assert.strictEqual(validateAITopics(['AI_LIT_PROMPT', 'UNKNOWN_KEY']), false);
  assert.strictEqual(validateAITopics(['free text description']), false);
  assert.strictEqual(validateAITopics(['AI_LIT_PROMPT', 'prompt injection attack']), false);
  assert.strictEqual(validateAITopics(['toString']), false);
  assert.strictEqual(validateAITopics(['AI_LIT_PROMPT', null]), false);
  assert.strictEqual(validateAITopics(['AI_LIT_PROMPT', 123]), false);
  assert.strictEqual(validateAITopics(['AI_LIT_PROMPT', {}]), false);
});

test('Test 6: calculateAITopicMatch returns 1.0 for 100% overlap', () => {
  assert.strictEqual(calculateAITopicMatch(['AI_LIT_PROMPT'], ['AI_LIT_PROMPT']), 1.0);
  assert.strictEqual(calculateAITopicMatch(['AI_LIT_PROMPT', 'AI_CREATIVE'], ['AI_LIT_PROMPT', 'AI_CREATIVE']), 1.0);
  assert.strictEqual(
    calculateAITopicMatch(['AI_LIT_PROMPT', 'AI_CREATIVE', 'AI_STEM_CODE'], ['AI_LIT_PROMPT', 'AI_CREATIVE']),
    1.0
  );
  assert.strictEqual(
    calculateAITopicMatch(
      ['AI_LIT_PROMPT', 'AI_CREATIVE', 'AI_STEM_CODE', 'AI_ETHICS_SEC'],
      ['AI_LIT_PROMPT', 'AI_CREATIVE', 'AI_STEM_CODE', 'AI_ETHICS_SEC']
    ),
    1.0
  );
});

test('Test 7: calculateAITopicMatch returns 0.5 for 50% overlap', () => {
  assert.strictEqual(calculateAITopicMatch(['AI_LIT_PROMPT'], ['AI_LIT_PROMPT', 'AI_CREATIVE']), 0.5);
  assert.strictEqual(
    calculateAITopicMatch(
      ['AI_STEM_CODE', 'AI_ETHICS_SEC'],
      ['AI_STEM_CODE', 'AI_LIT_PROMPT', 'AI_CREATIVE', 'AI_ETHICS_SEC']
    ),
    0.5
  );
});

test('Test 8: calculateAITopicMatch returns 0.0 for 0% overlap', () => {
  assert.strictEqual(calculateAITopicMatch(['AI_STEM_CODE'], ['AI_LIT_PROMPT']), 0.0);
  assert.strictEqual(calculateAITopicMatch(['AI_STEM_CODE', 'AI_ETHICS_SEC'], ['AI_LIT_PROMPT', 'AI_CREATIVE']), 0.0);
});

test('Test 9: calculateAITopicMatch returns 0 when needTopics is empty or not an array', () => {
  assert.strictEqual(calculateAITopicMatch(['AI_LIT_PROMPT'], []), 0);
  assert.strictEqual(calculateAITopicMatch(['AI_LIT_PROMPT'], null), 0);
  assert.strictEqual(calculateAITopicMatch(['AI_LIT_PROMPT'], undefined), 0);
  assert.strictEqual(calculateAITopicMatch(['AI_LIT_PROMPT'], 123), 0);
  assert.strictEqual(calculateAITopicMatch(['AI_LIT_PROMPT'], 'AI_LIT_PROMPT'), 0);
  assert.strictEqual(calculateAITopicMatch(['AI_LIT_PROMPT'], {}), 0);
  assert.strictEqual(calculateAITopicMatch([], ['AI_LIT_PROMPT']), 0);
  assert.strictEqual(calculateAITopicMatch(null, ['AI_LIT_PROMPT']), 0);
  assert.strictEqual(calculateAITopicMatch(undefined, ['AI_LIT_PROMPT']), 0);
  assert.strictEqual(calculateAITopicMatch(42, ['AI_LIT_PROMPT']), 0);
  assert.strictEqual(calculateAITopicMatch('AI_LIT_PROMPT', ['AI_LIT_PROMPT']), 0);
  assert.strictEqual(calculateAITopicMatch({}, ['AI_LIT_PROMPT']), 0);
});

test('Test 10: calculateAITopicMatch output is strictly numeric with no personal data fields exposed', () => {
  const result1 = calculateAITopicMatch(['AI_LIT_PROMPT'], ['AI_LIT_PROMPT']);
  assert.strictEqual(typeof result1, 'number');
  assert.ok(Number.isFinite(result1));
  assert.strictEqual(Object.keys(Object(result1)).length, 0);

  // Even if caller passes objects with personal data, output must be purely numeric
  const personalDataTopics = [
    { name: 'Israel Israeli', phone: '0501234567', id_number: '123456789' }
  ];
  const result2 = calculateAITopicMatch(personalDataTopics, ['AI_LIT_PROMPT']);
  assert.strictEqual(typeof result2, 'number');
  assert.strictEqual(result2, 0);

  const result3 = calculateAITopicMatch(['AI_LIT_PROMPT'], ['AI_LIT_PROMPT', 'AI_CREATIVE']);
  assert.strictEqual(typeof result3, 'number');
  assert.strictEqual(result3, 0.5);
});
