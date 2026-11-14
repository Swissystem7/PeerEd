'use strict';
// #tab-guide: the AI-challenge topic filter (#challengeTopicFilter) and the "copy winners summary" button
// (#copyChallengeWinnersBtn) run on curriculum.filterChallengeEntriesByTopic / buildChallengeWinnersSummary.
const test = require('node:test');
const assert = require('node:assert/strict');
const curriculum = require('../src/lib/curriculum.js');
const { openApp } = require('../test-support/fake-dom.js');

const tick = () => new Promise((r) => setImmediate(r));

function submit($, pair, topic, title, scores) {
  $('challengePairSelect').value = String(pair);
  $('challengeTopicSelect').value = topic;
  $('challengeTitleInput').value = title;
  $('challengeScoreInnovation').value = String(scores[0]);
  $('challengeScoreUsefulness').value = String(scores[1]);
  $('challengeScoreSafety').value = String(scores[2]);
  $('submitChallengeBtn').fire('click');
  assert.equal($('challengeStatus').className.includes('bad'), false, $('challengeStatus').textContent);
}

function withEntries(opts) {
  const $ = openApp(opts);
  $('nav-guide').fire('click');
  submit($, 0, 'AI_STEM_CODE', 'Math Solver', [5, 4, 5]);
  submit($, 1, 'AI_CREATIVE', 'Story Painter', [5, 5, 5]);
  submit($, 2, 'AI_STEM_CODE', 'Code Buddy', [3, 3, 3]);
  return $;
}

// as the screen numbers them: pair 1 is pairIndex 0
const asShown = (list) => list.map((e) => ({ ...e, pairIndex: e.pairIndex + 1 }));
const ENTRIES = [
  { pairIndex: 0, aiTopic: 'AI_STEM_CODE', toolTitle: 'Math Solver', innovation: 5, usefulness: 4, safety: 5 },
  { pairIndex: 1, aiTopic: 'AI_CREATIVE', toolTitle: 'Story Painter', innovation: 5, usefulness: 5, safety: 5 },
  { pairIndex: 2, aiTopic: 'AI_STEM_CODE', toolTitle: 'Code Buddy', innovation: 3, usefulness: 3, safety: 3 }
];

test('topic filter: the leaderboard shows only the chosen topic, "all" brings everything back', () => {
  const $ = withEntries();
  const board = () => $('challengeLeaderboard').innerHTML;
  for (const t of ['Math Solver', 'Story Painter', 'Code Buddy']) assert.match(board(), new RegExp(t));

  $('challengeTopicFilter').value = 'AI_STEM_CODE';
  $('challengeTopicFilter').fire('change');
  assert.match(board(), /Math Solver/);
  assert.match(board(), /Code Buddy/);
  assert.doesNotMatch(board(), /Story Painter/);
  // ranks are within the filtered topic: Math Solver (14) is 1st, Code Buddy (9) 2nd
  assert.match(board(), /data-rank="1"><td>1<\/td><td>זוג 1<\/td>/);

  $('challengeTopicFilter').value = 'AI_ETHICS_SEC';
  $('challengeTopicFilter').fire('change');
  assert.match(board(), /אין הגשות בנושא הזה/);

  $('challengeTopicFilter').value = 'all';
  $('challengeTopicFilter').fire('change');
  for (const t of ['Math Solver', 'Story Painter', 'Code Buddy']) assert.match(board(), new RegExp(t));
});

test('copy winners: the clipboard gets the library summary of the filtered entries, and the status says so', async () => {
  const $ = withEntries({ clipboard: 'ok' });
  $('copyChallengeWinnersBtn').fire('click');
  await tick();
  assert.equal($.clipboard(), curriculum.buildChallengeWinnersSummary(asShown(ENTRIES), 'he').text);
  assert.match($.clipboard(), /^סיכום זוכים אנונימי - Top 3\n#1 זוג 2 \| Story Painter/);
  assert.match($('challengeLeaderboard').innerHTML, /<td>זוג 2<\/td><td>[^<]*<\/td><td>Story Painter/, 'same pair number as the leaderboard');
  assert.equal($('challengeWinnersStatus').textContent, 'סיכום הזוכים הועתק ללוח');

  $('challengeTopicFilter').value = 'AI_STEM_CODE';
  $('challengeTopicFilter').fire('change');
  assert.equal($('challengeWinnersStatus').textContent, '', 'a new filter clears the old status');
  $('copyChallengeWinnersBtn').fire('click');
  await tick();
  const stem = curriculum.buildChallengeWinnersSummary(asShown(curriculum.filterChallengeEntriesByTopic(ENTRIES, 'AI_STEM_CODE')), 'he').text;
  assert.equal($.clipboard(), stem);
  assert.doesNotMatch($.clipboard(), /Story Painter/);
});

test('copy winners without clipboard permission or API: the summary is shown to copy by hand; no entries says so', async () => {
  const refused = withEntries({ clipboard: 'refuse' });
  refused('copyChallengeWinnersBtn').fire('click');
  await tick();
  await tick();
  assert.equal(refused('challengeWinnersStatus').textContent, curriculum.buildChallengeWinnersSummary(asShown(ENTRIES), 'he').text);

  const noApi = withEntries();
  noApi('copyChallengeWinnersBtn').fire('click');
  assert.equal(noApi('challengeWinnersStatus').textContent, curriculum.buildChallengeWinnersSummary(asShown(ENTRIES), 'he').text);

  const empty = openApp({ clipboard: 'ok' });
  empty('nav-guide').fire('click');
  empty('copyChallengeWinnersBtn').fire('click');
  await tick();
  assert.equal(empty.clipboard(), null, 'nothing to copy');
  assert.equal(empty('challengeWinnersStatus').textContent, 'אין הגשות זמינות');
});
