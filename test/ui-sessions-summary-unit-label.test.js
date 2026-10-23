'use strict';
// The sessions summary's "לפי יחידה" row named every unit by its title alone. A unit's id is title +
// subject + duration, so two approved units with the same title and a different duration were two
// identical labels with different counts, while the CSV beside the card ("אותן ספירות") keys them by id
// and the "רשום שיעור" select the coordinator just used named each one with its duration and id. The
// row now carries the same name as that select: title, duration, id.
const test = require('node:test');
const assert = require('node:assert/strict');
const { openApp, press, text } = require('../test-support/fake-dom.js');

const TITLE = 'שברים פשוטים';

function approveUnit($, subject, duration, body) {
  $('unitSubject').value = subject;
  $('unitDuration').value = String(duration);
  $('unitTitle').value = TITLE;
  $('unitBody').value = body;
  $('submitUnit').fire('click');
  assert.doesNotMatch($('unitStatus').className, /bad/, $('unitStatus').textContent);
  const ids = [];
  const re = /data-approve="([^"]+)"/g;
  let m;
  while ((m = re.exec($('pendingList').innerHTML)) !== null) ids.push(m[1]);
  assert.equal(ids.length, 1, 'exactly one unit waits: ' + ids.join(','));
  press($('pendingList'), 'data-approve', ids[0]);
  assert.match($('approvedList').innerHTML, new RegExp(ids[0]), 'the unit is approved');
  return ids[0];
}

function logSession($, subject, unitId) {
  $('nav-sessions').fire('click');
  $('sessionPair').value = '0';
  $('sessionSlot').value = 'SUN_16';
  $('sessionSubject').value = subject;
  $('sessionUnit').value = unitId;
  $('sessionOutcome').value = 'held';
  $('logSession').fire('click');
  assert.match($('sessionStatus').textContent, /^נרשם שיעור/, $('sessionStatus').textContent);
}

function unitRow($) {
  const lines = text($('sessionSummary').innerHTML).split('\n');
  const i = lines.indexOf('לפי יחידה');
  assert.notEqual(i, -1, 'no "לפי יחידה" row in: ' + lines.join(' | '));
  return lines[i + 1];
}

test('two approved units with one title and different durations are two different names in the summary', () => {
  const $ = openApp();
  $('demoBtn').fire('click');
  const short = approveUnit($, 'MATH', 20, 'פיצה שחולקה ל-8: כמה זה 3/8 ועוד 2/8?');
  const long = approveUnit($, 'MATH', 30, 'פיצה שחולקה ל-8, ואחר כך 3 תרגילים מפרק 12.');
  assert.notEqual(short, long, 'a different duration is a different unit');

  logSession($, 'MATH', short);
  logSession($, 'MATH', long);
  logSession($, 'MATH', long);

  const row = unitRow($);
  const labels = row.split(' · ').length > 2 ? row : '';
  assert.ok(labels, 'the row holds more than a title: ' + row);
  assert.ok(row.indexOf(TITLE + ' · 20 דקות · ' + short + ': 1') !== -1, row);
  assert.ok(row.indexOf(TITLE + ' · 30 דקות · ' + long + ': 2') !== -1, row);
  // Not two identical titles with different counts.
  assert.equal(row.indexOf(TITLE + ': '), -1, row);
});

test('the summary names a unit the way the "רשום שיעור" select did', () => {
  const $ = openApp();
  $('demoBtn').fire('click');
  const id = approveUnit($, 'MATH', 25, 'פיצה שחולקה ל-8: כמה זה 3/8 ועוד 2/8?');
  logSession($, 'MATH', id);
  const option = new RegExp('>([^<]*' + id + '[^<]*)<').exec($('sessionUnit').innerHTML);
  assert.ok(option, 'the select has an option for the unit: ' + $('sessionUnit').innerHTML);
  assert.equal(unitRow($), option[1] + ': 1');
});

test('a single unit is still named by its title, and the log row and the CSV agree on the id', () => {
  const $ = openApp();
  $('demoBtn').fire('click');
  const id = approveUnit($, 'MATH', 20, 'פיצה שחולקה ל-8: כמה זה 3/8 ועוד 2/8?');
  logSession($, 'MATH', id);
  assert.match(unitRow($), new RegExp('^' + TITLE + ' · 20 דקות · ' + id + ': 1$'));
  $('exportReport').fire('click');
  assert.ok($('reportText').value.indexOf('unit,' + id + ',1') !== -1, $('reportText').value);
});
