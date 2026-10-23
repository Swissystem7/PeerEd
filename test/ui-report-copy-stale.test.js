'use strict';
// The export line is careful about the clipboard: it says "הועתק גם ללוח" only after the browser took
// the text, and says nothing about the clipboard when the browser refused or has no clipboard API,
// because a refused copy must not look like a copy. The line written when the log changes while the
// report box is open was not: it said "what was copied to the clipboard before is the earlier report"
// whatever had happened, so after a refused copy, or on a browser without the API, the coordinator was
// told the clipboard holds an old report when it holds nothing of theirs. Now that line says the
// clipboard holds an old report only when a copy did go through, and otherwise that nothing was copied.
const test = require('node:test');
const assert = require('node:assert/strict');
const { openApp, press } = require('../test-support/fake-dom.js');

const tick = () => new Promise((resolve) => setImmediate(resolve));

function approveUnit($, body) {
  $('unitSubject').value = 'MATH';
  $('unitDuration').value = '20';
  $('unitTitle').value = 'שברים פשוטים';
  $('unitBody').value = body;
  $('submitUnit').fire('click');
  assert.doesNotMatch($('unitStatus').className, /bad/, $('unitStatus').textContent);
  const m = /data-approve="([^"]+)"/.exec($('pendingList').innerHTML);
  assert.ok(m, 'one unit waits: ' + $('pendingList').innerHTML);
  press($('pendingList'), 'data-approve', m[1]);
  return m[1];
}

function logSession($, unitId, outcome) {
  $('nav-sessions').fire('click');
  $('sessionPair').value = '0';
  $('sessionSlot').value = 'SUN_16';
  $('sessionSubject').value = 'MATH';
  $('sessionUnit').value = unitId;
  $('sessionOutcome').value = outcome;
  $('logSession').fire('click');
  assert.match($('sessionStatus').textContent, /^נרשם שיעור/, $('sessionStatus').textContent);
}

function ready($, opts) {
  const $app = openApp(opts);
  $app('demoBtn').fire('click');
  const id = approveUnit($app, 'פיצה שחולקה ל-8: כמה זה 3/8 ועוד 2/8?');
  logSession($app, id, 'held');
  return { $: $app, id };
}

const UPDATED = /^היומן השתנה, אז הדוח שבתיבה עודכן: \d+ שורות של ספירות\. /;
const OLD_IN_CLIPBOARD = 'מה שהועתק קודם ללוח הוא דוח ישן, לא זה - לחץ שוב כדי להעתיק את זה.';
const NOTHING_COPIED = 'ללוח לא הועתק דבר - לחץ שוב כדי לסמן את הדוח המעודכן להעתקה.';

test('a browser without a clipboard API: the updated-report line says nothing was copied', () => {
  const { $, id } = ready();
  $('exportReport').fire('click');
  assert.doesNotMatch($('reportStatus').textContent, /הועתק/, $('reportStatus').textContent);
  logSession($, id, 'missed');
  const line = $('reportStatus').textContent;
  assert.match(line, UPDATED, line);
  assert.ok(line.endsWith(NOTHING_COPIED), line);
  assert.equal(line.indexOf('הועתק קודם'), -1, line);
  assert.ok($('reportText').value.indexOf('outcome,missed,1') !== -1, 'the box follows the log');
});

test('a browser that refuses the copy: the updated-report line says nothing was copied', async () => {
  const { $, id } = ready(undefined, { clipboard: 'refuse' });
  $('exportReport').fire('click');
  await tick();
  assert.doesNotMatch($('reportStatus').textContent, /הועתק/, $('reportStatus').textContent);
  assert.equal($.clipboard(), null, 'the clipboard took nothing');
  logSession($, id, 'missed');
  const line = $('reportStatus').textContent;
  assert.match(line, UPDATED, line);
  assert.ok(line.endsWith(NOTHING_COPIED), line);
});

test('a copy that went through: the updated-report line says the clipboard holds an old report', async () => {
  const { $, id } = ready(undefined, { clipboard: 'ok' });
  $('exportReport').fire('click');
  await tick();
  assert.match($('reportStatus').textContent, /הועתק גם ללוח\.$/, $('reportStatus').textContent);
  const copied = $.clipboard();
  assert.equal(copied, $('reportText').value);
  logSession($, id, 'missed');
  const line = $('reportStatus').textContent;
  assert.match(line, UPDATED, line);
  assert.ok(line.endsWith(OLD_IN_CLIPBOARD), line);
  assert.equal($.clipboard(), copied, 'the clipboard was not touched by the log change');
  assert.notEqual($('reportText').value, copied, 'the box has the new report, the clipboard the old one');
});

test('a refused copy after one that went through leaves the earlier report in the clipboard, and the line says so', async () => {
  const opts = { clipboard: 'ok' };
  const { $, id } = ready(undefined, opts);
  $('exportReport').fire('click');
  await tick();
  const first = $.clipboard();
  assert.ok(first, 'the first copy went through');
  logSession($, id, 'missed');
  assert.ok($('reportStatus').textContent.endsWith(OLD_IN_CLIPBOARD), $('reportStatus').textContent);

  opts.clipboard = 'refuse';
  $('exportReport').fire('click');
  await tick();
  assert.doesNotMatch($('reportStatus').textContent, /הועתק/, $('reportStatus').textContent);
  logSession($, id, 'cut_short');
  const line = $('reportStatus').textContent;
  // the refusal left the first report in the clipboard, so "an old report" is still the truth
  assert.ok(line.endsWith(OLD_IN_CLIPBOARD), line);
  assert.equal($.clipboard(), first);
});

test('the export line itself is unchanged: "הועתק גם ללוח" only after the browser took the text', async () => {
  const ok = ready(undefined, { clipboard: 'ok' });
  ok.$('exportReport').fire('click');
  await tick();
  assert.match(ok.$('reportStatus').textContent, /^הדוח מוכן: .* הועתק גם ללוח\.$/, ok.$('reportStatus').textContent);
  const none = ready();
  none.$('exportReport').fire('click');
  assert.match(none.$('reportStatus').textContent, /^הדוח מוכן: /, none.$('reportStatus').textContent);
  assert.doesNotMatch(none.$('reportStatus').textContent, /הועתק/);
});
