'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const shell = fs.readFileSync(path.join(__dirname, '..', 'src', 'app-shell.html'), 'utf8');

test('tab-match has #btn-sort-ai-match with he/ar/ru labels', () => {
  assert.match(shell, /id="tab-match"/);
  assert.match(shell, /id="btn-sort-ai-match"/);
  assert.match(shell, /SORT_AI_MATCH_LABELS/);
  assert.match(shell, /מיין לפי חפיפת נושאי AI/);
  assert.match(shell, /ترتيب حسب تداخل مواضيع الذكاء الاصطناعي/);
  assert.match(shell, /Сортировать по пересечению тем ИИ/);
});

test('sort compares AI-overlap descending then total score', () => {
  assert.match(shell, /function compareMatch2PairsByAi/);
  assert.match(shell, /function sortMatch2PairsByAi/);
  assert.match(shell, /btn-sort-ai-match'\)\.addEventListener\('click'/);
});

test('match cards expose data-ai-overlap and data-score for ordering checks', () => {
  assert.match(shell, /data-ai-overlap="/);
  assert.match(shell, /data-score="/);
});

test('sorting stays local — participant data and match2 lib are not rewritten', () => {
  assert.doesNotMatch(shell, /btn-sort-ai-match[\s\S]{0,400}match2Lib\.match2/);
  assert.match(shell, /sortMatch2PairsByAi\(lastMatch2\.pairs/);
});
