// #tab-sessions session history: the status / pair / AI-topic filters were in the page with nothing
// listening to them, and the count stayed "0 מפגשים" whatever was recorded. These tests open the app
// with recorded attendance and check the filters reach attendance.filterAttendanceRecords.
const test = require('node:test');
const assert = require('node:assert/strict');
const store = require('../src/lib/store.js');
const { emptyQueue } = require('../src/lib/approval.js');
const { emptyLog } = require('../src/lib/session.js');
const { openApp } = require('../test-support/fake-dom.js');

function openWithAttendance(attendance) {
  const serialized = store.serialize({ people: [], queue: emptyQueue(), log: emptyLog(), attendance });
  const $ = openApp({ store: { [store.DEFAULT_KEY]: serialized } });
  $('nav-sessions').fire('click');
  return $;
}

const RECORDS = [
  { pairIndex: 0, date: '2026-01-01', status: 'held', durationHours: 2, aiTopic: 'AI_LIT_PROMPT' },
  { pairIndex: 0, date: '2026-01-08', status: 'missed', durationHours: 1 },
  { pairIndex: 1, date: '2026-01-02', status: 'held', durationHours: 1.5 }
];

test('session history lists the recorded sessions and counts them', () => {
  const $ = openWithAttendance(RECORDS);
  assert.equal($('sessionHistoryCount').textContent, '3 מפגשים');
  const html = $('sessionHistoryList').innerHTML;
  assert.match(html, /זוג 1, 2026-01-01/);
  assert.match(html, /זוג 1, 2026-01-08/);
  assert.match(html, /זוג 2, 2026-01-02/);
  // the pair filter offers the pairs that have records
  assert.match($('sessionHistoryPairFilter').innerHTML, /<option value="1">זוג 2<\/option>/);
});

test('the status filter narrows the list', () => {
  const $ = openWithAttendance(RECORDS);
  $('sessionHistoryStatusFilter').value = 'missed';
  $('sessionHistoryStatusFilter').fire('change');
  assert.equal($('sessionHistoryCount').textContent, 'מפגש אחד');
  assert.match($('sessionHistoryList').innerHTML, /2026-01-08/);
  assert.doesNotMatch($('sessionHistoryList').innerHTML, /2026-01-01/);
});

test('the pair filter narrows the list', () => {
  const $ = openWithAttendance(RECORDS);
  $('sessionHistoryPairFilter').value = '1';
  $('sessionHistoryPairFilter').fire('change');
  assert.equal($('sessionHistoryCount').textContent, 'מפגש אחד');
  assert.match($('sessionHistoryList').innerHTML, /זוג 2, 2026-01-02/);
});

test('a filter with no match shows the empty line', () => {
  const $ = openWithAttendance(RECORDS);
  $('sessionHistoryStatusFilter').value = 'cancelled';
  $('sessionHistoryStatusFilter').fire('change');
  assert.equal($('sessionHistoryCount').textContent, '0 מפגשים');
  assert.equal($('sessionHistoryList').innerHTML, '');
  assert.equal($('sessionHistoryEmpty').style.display, '');
});

test('the AI topic filter narrows the list and names the topic in Hebrew', () => {
  const $ = openWithAttendance(RECORDS);
  $('sessionHistoryAiTopicFilter').value = 'AI_LIT_PROMPT';
  $('sessionHistoryAiTopicFilter').fire('change');
  assert.equal($('sessionHistoryCount').textContent, 'מפגש אחד');
  assert.match($('sessionHistoryList').innerHTML, /2026-01-01/);
  assert.match($('sessionHistoryList').innerHTML, /אוריינות בינה מלאכותית והנחיה/);
});
