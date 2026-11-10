const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { openApp } = require('../test-support/fake-dom.js');

const ROOT = path.join(__dirname, '..');

test('Test 1: Verify in src/app-shell.html markup that #peopleAiFilter has role="combobox", aria-expanded="false", and aria-controls="peopleList"', () => {
  const shell = fs.readFileSync(path.join(ROOT, 'src', 'app-shell.html'), 'utf8');
  const match = shell.match(/<select\b[^>]*id="peopleAiFilter"[^>]*>/);
  assert.ok(match, 'select#peopleAiFilter tag must exist in src/app-shell.html');
  const tag = match[0];
  assert.match(tag, /\brole="combobox"/, '#peopleAiFilter must include role="combobox"');
  assert.match(tag, /\baria-expanded="false"/, '#peopleAiFilter must include aria-expanded="false"');
  assert.match(tag, /\baria-controls="peopleList"/, '#peopleAiFilter must include aria-controls="peopleList"');
});

test('Test 2: Verify in src/app-shell.html markup that #resetAiFilter has aria-controls="peopleAiFilter peopleList"', () => {
  const shell = fs.readFileSync(path.join(ROOT, 'src', 'app-shell.html'), 'utf8');
  const match = shell.match(/<button\b[^>]*id="resetAiFilter"[^>]*>/);
  assert.ok(match, 'button#resetAiFilter tag must exist in src/app-shell.html');
  const tag = match[0];
  assert.match(tag, /\baria-controls="peopleAiFilter peopleList"/, '#resetAiFilter must include aria-controls="peopleAiFilter peopleList"');
});

test('Test 3: Verify with openApp() that selecting an AI topic (firing change event on peopleAiFilter) updates aria-expanded to "true"', () => {
  const $ = openApp();
  const filter = $('peopleAiFilter');
  assert.ok(filter, '#peopleAiFilter must exist');
  assert.equal(filter.getAttribute('role'), 'combobox', 'role must be combobox');
  assert.equal(filter.getAttribute('aria-controls'), 'peopleList', 'aria-controls must point to peopleList');
  assert.equal(filter.getAttribute('aria-expanded'), 'false', 'initial aria-expanded must be "false"');

  filter.value = 'AI_LIT_PROMPT';
  filter.fire('change');
  assert.equal(filter.getAttribute('aria-expanded'), 'true', 'aria-expanded must be "true" when topic is selected');

  filter.value = 'AI_STEM_CODE';
  filter.fire('change');
  assert.equal(filter.getAttribute('aria-expanded'), 'true', 'aria-expanded must stay "true" for another selected topic');
});

test('Test 4: Verify that changing peopleAiFilter back to empty string or clicking resetAiFilter updates aria-expanded back to "false"', () => {
  const $ = openApp();
  const filter = $('peopleAiFilter');
  const resetBtn = $('resetAiFilter');
  assert.ok(filter, '#peopleAiFilter must exist');
  assert.ok(resetBtn, '#resetAiFilter must exist');
  assert.equal(resetBtn.getAttribute('aria-controls'), 'peopleAiFilter peopleList', 'reset button aria-controls must match');

  // 1. Select a topic
  filter.value = 'AI_LIT_PROMPT';
  filter.fire('change');
  assert.equal(filter.getAttribute('aria-expanded'), 'true', 'aria-expanded must be "true" when topic is selected');

  // 2. Change peopleAiFilter back to empty string
  filter.value = '';
  filter.fire('change');
  assert.equal(filter.getAttribute('aria-expanded'), 'false', 'changing peopleAiFilter to empty string updates aria-expanded to "false"');

  // 3. Select a topic again
  filter.value = 'AI_CREATIVE';
  filter.fire('change');
  assert.equal(filter.getAttribute('aria-expanded'), 'true', 'aria-expanded must be "true" again');

  // 4. Click resetAiFilter
  resetBtn.fire('click');
  assert.equal(filter.getAttribute('aria-expanded'), 'false', 'clicking resetAiFilter updates aria-expanded back to "false"');
  assert.equal(filter.value, '', 'filter value must be empty string after reset');
});
