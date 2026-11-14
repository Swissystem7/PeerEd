'use strict';
// Local check (not part of `npm test` or CI): in Chromium, the #tab-sessions session-history filters
// (status / pair / AI topic) really narrow the list, and a status corrected in a row is saved.
//   npm i --no-save playwright@1.64.1 && npx playwright install chromium   (once)
//   npm run test:e2e
// Without playwright installed the test is skipped with that hint.
const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const store = require('../src/lib/store.js');
const { emptyQueue } = require('../src/lib/approval.js');
const { emptyLog } = require('../src/lib/session.js');

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

const RECORDS = [
  { pairIndex: 0, date: '2026-01-01', status: 'held', durationHours: 2, aiTopic: 'AI_LIT_PROMPT' },
  { pairIndex: 0, date: '2026-01-08', status: 'missed', durationHours: 1 },
  { pairIndex: 1, date: '2026-01-02', status: 'held', durationHours: 1.5 }
];

test('session history: filters narrow the list, a status edit is saved and survives a reload', { skip: !playwright && 'playwright not installed: npm i --no-save playwright@1.64.1 && npx playwright install chromium' }, async () => {
  const server = await serve();
  let browser = null;
  const errors = [];
  const observed = {};
  try {
    browser = await playwright.chromium.launch();
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const origin = 'http://127.0.0.1:' + server.address().port;
    const page = await context.newPage();
    page.on('pageerror', (e) => errors.push(String(e)));
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
    await page.route(/^https?:\/\/(?!127\.0\.0\.1)/, (route) => route.fulfill({ status: 204, body: '' }));
    await page.goto(origin + '/app.html');
    const saved = store.serialize({ people: [], queue: emptyQueue(), log: emptyLog(), attendance: RECORDS });
    await page.evaluate(([k, v]) => localStorage.setItem(k, v), [store.DEFAULT_KEY, saved]);
    await page.reload();
    await page.click('#nav-sessions');
    await page.waitForSelector('#sessionHistoryStatusFilter', { state: 'visible' });
    const rows = () => page.$$eval('#sessionHistoryList .item b', (b) => b.map((x) => x.textContent));
    const count = () => page.textContent('#sessionHistoryCount');
    observed.all = await rows();
    observed.allCount = await count();

    await page.selectOption('#sessionHistoryStatusFilter', 'missed');
    observed.missed = await rows();
    await page.selectOption('#sessionHistoryStatusFilter', 'cancelled');
    observed.cancelledCount = await count();
    observed.emptyVisible = await page.isVisible('#sessionHistoryEmpty');
    await page.selectOption('#sessionHistoryStatusFilter', 'all');
    await page.selectOption('#sessionHistoryPairFilter', '1');
    observed.pair2 = await rows();
    await page.selectOption('#sessionHistoryPairFilter', 'all');
    await page.selectOption('#sessionHistoryAiTopicFilter', 'AI_LIT_PROMPT');
    observed.topic = await rows();
    await page.selectOption('#sessionHistoryAiTopicFilter', 'all');

    // correct the missed lesson to "postponed": saved, and still there after a reload
    await page.selectOption('#sessionHistoryList select[data-date="2026-01-08"]', 'postponed');
    observed.editStatus = await page.textContent('#sessionHistoryStatus');
    await page.reload();
    await page.click('#nav-sessions');
    await page.selectOption('#sessionHistoryStatusFilter', 'postponed');
    observed.postponedAfterReload = await rows();
  } finally {
    if (browser) await browser.close();
    server.close();
  }
  console.log(JSON.stringify(observed));

  assert.deepEqual(observed.all, ['זוג 1, 2026-01-08', 'זוג 2, 2026-01-02', 'זוג 1, 2026-01-01']);
  assert.equal(observed.allCount, '3 מפגשים');
  assert.deepEqual(observed.missed, ['זוג 1, 2026-01-08']);
  assert.equal(observed.cancelledCount, '0 מפגשים');
  assert.equal(observed.emptyVisible, true);
  assert.deepEqual(observed.pair2, ['זוג 2, 2026-01-02']);
  assert.deepEqual(observed.topic, ['זוג 1, 2026-01-01']);
  assert.equal(observed.editStatus, 'עודכן: זוג 1, 2026-01-08.');
  assert.deepEqual(observed.postponedAfterReload, ['זוג 1, 2026-01-08']);
  assert.deepEqual(errors, []);
});
