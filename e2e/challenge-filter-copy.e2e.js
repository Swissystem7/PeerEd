'use strict';
// Local check (not part of `npm test` or CI): in Chromium, the #tab-guide AI-challenge topic filter really
// narrows the leaderboard and "העתק סיכום זוכים" really puts the anonymous winners summary on the clipboard.
//   npm i --no-save playwright@1.64.1 && npx playwright install chromium   (once)
//   npm run test:e2e
// Without playwright installed the test is skipped with that hint.
const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const curriculum = require('../src/lib/curriculum.js');

let playwright = null;
try {
  playwright = require('playwright');
} catch {
  playwright = null;
}

const ROOT = path.join(__dirname, '..');

function serve() {
  const server = http.createServer((req, res) => {
    const p = decodeURIComponent(req.url.split('?')[0]);
    const file = path.join(ROOT, path.normalize(p === '/' ? '/app.html' : p));
    if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
      res.writeHead(404);
      res.end();
      return;
    }
    res.writeHead(200, { 'content-type': file.endsWith('.html') ? 'text/html; charset=utf-8' : 'application/octet-stream' });
    fs.createReadStream(file).pipe(res);
  });
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve(server)));
}

// as the screen numbers them: pair 1 is pairIndex 0
const asShown = (list) => list.map((e) => ({ ...e, pairIndex: e.pairIndex + 1 }));
const ENTRIES = [
  { pairIndex: 0, aiTopic: 'AI_STEM_CODE', toolTitle: 'Math Solver', innovation: 5, usefulness: 4, safety: 5 },
  { pairIndex: 1, aiTopic: 'AI_CREATIVE', toolTitle: 'Story Painter', innovation: 5, usefulness: 5, safety: 5 },
  { pairIndex: 2, aiTopic: 'AI_STEM_CODE', toolTitle: 'Code Buddy', innovation: 3, usefulness: 3, safety: 3 }
];

test('AI challenge: topic filter narrows the leaderboard, copy puts the winners summary on the clipboard', { skip: !playwright && 'playwright not installed: npm i --no-save playwright@1.64.1 && npx playwright install chromium' }, async () => {
  const server = await serve();
  let browser = null;
  const errors = [];
  const observed = {};
  try {
    browser = await playwright.chromium.launch();
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const origin = 'http://127.0.0.1:' + server.address().port;
    await context.grantPermissions(['clipboard-read', 'clipboard-write'], { origin });
    const page = await context.newPage();
    page.on('pageerror', (e) => errors.push(String(e)));
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
    await page.route(/^https?:\/\/(?!127\.0\.0\.1)/, (route) => route.fulfill({ status: 204, body: '' }));
    await page.goto(origin + '/app.html');

    // sample participants give the pair list the challenge form chooses from
    await page.click('#demoBtn');
    await page.click('#nav-guide');
    await page.waitForSelector('#submitChallengeBtn', { state: 'visible' });
    observed.pairOptions = await page.$$eval('#challengePairSelect option', (o) => o.length);
    for (const e of ENTRIES) {
      await page.selectOption('#challengePairSelect', String(e.pairIndex));
      await page.selectOption('#challengeTopicSelect', e.aiTopic);
      await page.fill('#challengeTitleInput', e.toolTitle);
      await page.selectOption('#challengeScoreInnovation', String(e.innovation));
      await page.selectOption('#challengeScoreUsefulness', String(e.usefulness));
      await page.selectOption('#challengeScoreSafety', String(e.safety));
      await page.click('#submitChallengeBtn');
    }
    const titles = () => page.$$eval('#challengeLeaderboard tbody tr td:nth-child(4)', (tds) => tds.map((t) => t.textContent));
    observed.all = await titles();

    await page.selectOption('#challengeTopicFilter', 'AI_STEM_CODE');
    observed.stem = await titles();
    await page.click('#copyChallengeWinnersBtn');
    await page.waitForFunction(() => document.getElementById('challengeWinnersStatus').textContent !== '');
    observed.stemStatus = await page.textContent('#challengeWinnersStatus');
    observed.stemClipboard = await page.evaluate(() => navigator.clipboard.readText());

    await page.selectOption('#challengeTopicFilter', 'AI_ETHICS_SEC');
    observed.ethicsBoard = (await page.textContent('#challengeLeaderboard')).trim();
    observed.statusAfterFilter = await page.textContent('#challengeWinnersStatus');

    await page.selectOption('#challengeTopicFilter', 'all');
    observed.allAgain = await titles();
    await page.click('#copyChallengeWinnersBtn');
    await page.waitForFunction(() => document.getElementById('challengeWinnersStatus').textContent !== '');
    observed.allClipboard = await page.evaluate(() => navigator.clipboard.readText());
  } finally {
    if (browser) await browser.close();
    server.close();
  }
  console.log(JSON.stringify(observed));

  assert.ok(observed.pairOptions >= 3, 'the demo roster gives at least 3 pairs');
  assert.deepEqual(observed.all, ['Story Painter', 'Math Solver', 'Code Buddy']);
  assert.deepEqual(observed.stem, ['Math Solver', 'Code Buddy']);
  assert.equal(observed.stemStatus, 'סיכום הזוכים הועתק ללוח');
  assert.equal(observed.stemClipboard, curriculum.buildChallengeWinnersSummary(asShown(curriculum.filterChallengeEntriesByTopic(ENTRIES, 'AI_STEM_CODE')), 'he').text);
  assert.doesNotMatch(observed.stemClipboard, /Story Painter/);
  assert.equal(observed.ethicsBoard, 'אין הגשות בנושא הזה');
  assert.equal(observed.statusAfterFilter, '');
  assert.deepEqual(observed.allAgain, observed.all);
  assert.equal(observed.allClipboard, curriculum.buildChallengeWinnersSummary(asShown(ENTRIES), 'he').text);
  assert.deepEqual(errors, []);
});
