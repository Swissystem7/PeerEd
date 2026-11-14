'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const curriculum = require('../src/lib/curriculum.js');
const modes = require('../src/lib/modes.js');
const ROOT = path.join(__dirname, '..');

test('1. filterChallengeEntriesByTopic filters correctly or returns all when topic is all/empty', () => {
  const entries = [
    { pairIndex: 1, aiTopic: 'AI_LIT_PROMPT', toolTitle: 'Tool A', innovation: 4, usefulness: 5, safety: 5 },
    { pairIndex: 2, aiTopic: 'AI_CREATIVE', toolTitle: 'Tool B', innovation: 3, usefulness: 3, safety: 4 }
  ];
  const filteredLit = curriculum.filterChallengeEntriesByTopic(entries, 'AI_LIT_PROMPT');
  assert.equal(filteredLit.length, 1);
  assert.equal(filteredLit[0].pairIndex, 1);

  const filteredAll = curriculum.filterChallengeEntriesByTopic(entries, 'all');
  assert.equal(filteredAll.length, 2);

  const filteredEmpty = curriculum.filterChallengeEntriesByTopic(entries, '');
  assert.equal(filteredEmpty.length, 2);
});

test('2. buildChallengeWinnersSummary builds correct Hebrew summary and top3 structure', () => {
  const entries = [
    { pairIndex: 1, aiTopic: 'AI_LIT_PROMPT', toolTitle: 'Tool Alpha', innovation: 5, usefulness: 5, safety: 5 },
    { pairIndex: 2, aiTopic: 'AI_CREATIVE', toolTitle: 'Tool Beta', innovation: 4, usefulness: 4, safety: 5 }
  ];
  const summary = curriculum.buildChallengeWinnersSummary(entries, 'he');
  assert.ok(typeof summary.text === 'string');
  assert.ok(summary.text.includes('סיכום זוכים אנונימי'));
  assert.equal(summary.top3.length, 2);
  assert.equal(summary.top3[0].pairIndex, 1);
  assert.equal(summary.top3[0].toolTitle, 'Tool Alpha');
});

test('3. buildChallengeWinnersSummary handles Arabic and Russian languages', () => {
  const entries = [
    { pairIndex: 1, aiTopic: 'AI_LIT_PROMPT', toolTitle: 'Tool Alpha', innovation: 5, usefulness: 5, safety: 5 }
  ];
  const summaryAr = curriculum.buildChallengeWinnersSummary(entries, 'ar');
  assert.ok(summaryAr.text.includes('ملخص الفائزين'));

  const summaryRu = curriculum.buildChallengeWinnersSummary(entries, 'ru');
  assert.ok(summaryRu.text.includes('Сводка победителей'));
});

test('4. buildChallengeWinnersSummary handles empty entry lists cleanly without crashing', () => {
  const summaryHe = curriculum.buildChallengeWinnersSummary([], 'he');
  assert.equal(summaryHe.top3.length, 0);
  assert.equal(summaryHe.text, 'אין הגשות זמינות');

  const summaryAr = curriculum.buildChallengeWinnersSummary([], 'ar');
  assert.equal(summaryAr.text, 'لا توجد مشاركات');

  const summaryRu = curriculum.buildChallengeWinnersSummary([], 'ru');
  assert.equal(summaryRu.text, 'Нет заявок');
});

test('5. challenge summary output and rankings contain zero PII (no names, emails, phones)', () => {
  const entries = [
    { pairIndex: 10, aiTopic: 'AI_STEM_CODE', toolTitle: 'SecretBot', innovation: 5, usefulness: 5, safety: 5 }
  ];
  const summary = curriculum.buildChallengeWinnersSummary(entries, 'he');
  const text = summary.text;
  assert.equal(/name|email|phone|john|alice/i.test(text), false);
  assert.ok(text.includes('זוג 10'));
  assert.ok(text.includes('SecretBot'));
});

test('6. app-shell.html includes #challengeTopicFilter, #challengeLeaderboard, and #copyChallengeWinnersBtn', () => {
  const shell = fs.readFileSync(path.join(ROOT, 'src', 'app-shell.html'), 'utf8');
  assert.ok(shell.includes('id="challengeTopicFilter"'));
  assert.ok(shell.includes('id="challengeLeaderboard"'));
  assert.ok(shell.includes('id="copyChallengeWinnersBtn"'));
  assert.ok(shell.includes('id="challengeWinnersStatus"'));
  assert.ok(shell.includes('type="button"'));
  assert.ok(shell.includes('aria-describedby="challengeWinnersStatus"'));
});

test('7. app.html is up to date and contains challenge filtering and export integration', () => {
  const appHtml = fs.readFileSync(path.join(ROOT, 'app.html'), 'utf8');
  assert.ok(appHtml.includes('challengeTopicFilter'));
  assert.ok(appHtml.includes('copyChallengeWinnersBtn'));
  assert.ok(appHtml.includes('filterChallengeEntriesByTopic'));
  assert.ok(appHtml.includes('buildChallengeWinnersSummary'));
});

test('8. modes.js and curriculum.js modules export their required filtering and summary functions properly', () => {
  assert.equal(typeof curriculum.filterChallengeEntriesByTopic, 'function');
  assert.equal(typeof curriculum.buildChallengeWinnersSummary, 'function');
  assert.equal(typeof curriculum.rankChallengeLeaderboard, 'function');
  assert.equal(typeof curriculum.submitChallengeEntry, 'function');
});

test('9. submitChallengeEntry and rankChallengeLeaderboard correctly compute scores and ranks', () => {
  let entries = [];
  entries = curriculum.submitChallengeEntry(entries, {
    pairIndex: 3,
    aiTopic: 'AI_CREATIVE',
    toolTitle: 'ArtGen',
    innovation: 4,
    usefulness: 4,
    safety: 4
  });
  entries = curriculum.submitChallengeEntry(entries, {
    pairIndex: 1,
    aiTopic: 'AI_LIT_PROMPT',
    toolTitle: 'StoryBot',
    innovation: 5,
    usefulness: 5,
    safety: 5
  });

  const ranked = curriculum.rankChallengeLeaderboard(entries);
  assert.equal(ranked.length, 2);
  assert.equal(ranked[0].pairIndex, 1);
  assert.equal(ranked[0].rank, 1);
  assert.equal(ranked[0].totalScore, 15);
  assert.equal(ranked[1].pairIndex, 3);
  assert.equal(ranked[1].rank, 2);
});

test('10. filterChallengeEntriesByTopic returns independent array copy and handles non-array inputs safely', () => {
  const entries = [
    { pairIndex: 1, aiTopic: 'AI_LIT_PROMPT', toolTitle: 'Tool A', innovation: 4, usefulness: 4, safety: 4 }
  ];
  const resNull = curriculum.filterChallengeEntriesByTopic(null, 'AI_LIT_PROMPT');
  assert.equal(resNull.length, 0);

  const resFiltered = curriculum.filterChallengeEntriesByTopic(entries, 'AI_CREATIVE');
  assert.equal(resFiltered.length, 0);
  assert.notEqual(resFiltered, entries);
});

test('11. buildChallengeWinnersSummary top3 object contains exact required anonymized fields', () => {
  const entries = [
    { pairIndex: 5, aiTopic: 'AI_ETHICS_SEC', toolTitle: 'SafeGuard', innovation: 5, usefulness: 4, safety: 5 }
  ];
  const summary = curriculum.buildChallengeWinnersSummary(entries, 'he');
  assert.equal(summary.top3.length, 1);
  const item = summary.top3[0];
  assert.deepEqual(Object.keys(item).sort(), ['aiTopic', 'pairIndex', 'totalScore', 'toolTitle'].sort());
  assert.equal(item.pairIndex, 5);
  assert.equal(item.toolTitle, 'SafeGuard');
  assert.equal(item.aiTopic, 'AI_ETHICS_SEC');
  assert.equal(item.totalScore, 14);
});
