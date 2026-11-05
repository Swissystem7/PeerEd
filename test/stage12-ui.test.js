'use strict';
// Stage 12 wiring, behavioural: drive the real built app.html through the fake DOM
// exactly as a coordinator would (guide search, advanced match, schedule, reports).
// The fake DOM has no navigator/location, so loading the app here also proves the
// guarded SW registration is a silent no-op when the worker API is unavailable
// and the single file stays fully usable without a worker.
const test = require('node:test');
const assert = require('node:assert/strict');
const { openApp, addPerson, text } = require('../test-support/fake-dom.js');

function matchedApp() {
  const $ = openApp();
  addPerson($, 'student', 'CENTER', ['MATH'], ['SUN_16']);
  addPerson($, 'pupil', 'CENTER', ['MATH'], ['SUN_16']);
  $('runMatch2').fire('click');
  return $;
}

test('stage12 ui: app loads and guide works with no service-worker API available', () => {
  const $ = openApp();
  $('guideAllBtn').fire('click');
  assert.match($('guideStatus').textContent, /כל המדריך מוצג/);
  assert.ok(text($('guideList').innerHTML).trim().length > 0, 'guide sections rendered');
});

test('stage12 ui: guide search finds sections, blocks personal data and stores nothing', () => {
  const $ = openApp();
  $('guideSearch').value = 'שידוך';
  $('guideSearchBtn').fire('click');
  assert.match($('guideStatus').textContent, /נמצאו \d+ פרקים/);
  assert.ok(text($('guideList').innerHTML).trim().length > 0);
  const before = JSON.stringify($.store);
  $('guideSearch').value = 'call 050-1234567';
  $('guideSearchBtn').fire('click');
  assert.match($('guideStatus').textContent, /החיפוש לא נשמר/);
  assert.equal($('guideStatus').className.includes('bad'), true);
  assert.equal(JSON.stringify($.store), before, 'blocked search stored nothing');
});

test('stage12 ui: match2 pairs roster with Hebrew explanation; schedule and reports refuse before match', () => {
  const $ = openApp();
  $('runSchedule').fire('click');
  assert.match($('scheduleStatus').textContent, /קודם לחצו/);
  $('rematch2').fire('click');
  assert.match($('match2Status').textContent, /קודם לחצו/);
  addPerson($, 'student', 'CENTER', ['MATH'], ['SUN_16']);
  addPerson($, 'pupil', 'CENTER', ['MATH'], ['SUN_16']);
  $('runMatch2').fire('click');
  assert.match($('match2Status').textContent, /נוצרו 1 זוגות\. ציון כולל: \d+\./);
  assert.ok(text($('match2Out').innerHTML).includes('סטודנט 1'), 'pair rendered');
  assert.ok($('match2Out').innerHTML.includes('data-lock="0-0"'), 'lock toggle rendered');
});

test('stage12 ui: locked pair survives partial rematch', () => {
  const $ = matchedApp();
  // fire the pair row's lock checkbox through the delegated click handler
  $('match2Out').fire('click', { target: { getAttribute: (k) => (k === 'data-lock' ? '0-0' : null), setAttribute() {} } });
  $('rematch2').fire('click');
  assert.match($('match2Status').textContent, /נוצרו 1 זוגות/);
  assert.ok($('match2Out').innerHTML.includes('data-lock="0-0"'));
});

test('stage12 ui: schedule builds from match2, reports weekly/monthly/semester and exports', () => {
  const $ = matchedApp();
  $('runSchedule').fire('click');
  assert.match(text($('scheduleOut').innerHTML), /מפגשים בלוח: 1/);
  assert.match(text($('scheduleOut').innerHTML), /התנגשויות: 0/);

  // downloads and print refuse before a report exists
  $('dlReportCsv').fire('click');
  assert.match($('report2Status').textContent, /קודם הפיקו דוח/);
  assert.equal($.downloads.length, 0);
  $('printReport').fire('click');
  assert.match($('report2Status').textContent, /ההדפסה לא זמינה כאן|קודם הפיקו דוח/);

  // report refuses without a period start date
  $('runReport').fire('click');
  assert.match($('report2Status').textContent, /בחרו תאריך תחילת תקופה/);

  // monthly normalises to the 1st of the chosen month; weekly/semester start on the chosen date
  for (const [period, expectFrom] of [['weekly', '2026-01-04'], ['monthly', '2026-01-01'], ['semester', '2026-01-04']]) {
    $('reportPeriod').value = period;
    $('reportFrom').value = '2026-01-04';
    $('runReport').fire('click');
    assert.match($('report2Status').textContent, new RegExp('הדוח הופק: ' + expectFrom + ' עד '), period);
    assert.match(text($('reportOut').innerHTML), /מפגשים מתוכננים:/, period);
    assert.ok($('reportOut').innerHTML.includes('<svg'), period + ' renders inline SVG chart');
  }

  $('dlReportCsv').fire('click');
  const csv = $.downloads[$.downloads.length - 1];
  assert.ok(csv.text.startsWith('measure,code,count'), 'CSV download: ' + csv.text.slice(0, 60));
  $('dlReportIcs').fire('click');
  const ics = $.downloads[$.downloads.length - 1];
  assert.match(ics.text, /BEGIN:VCALENDAR|BEGIN:VEVENT/, 'ICS download');
});

test('stage12 ui: report with no schedule built is an honest zero, not a crash', () => {
  const $ = openApp();
  $('reportPeriod').value = 'weekly';
  $('reportFrom').value = '2026-01-04';
  $('runReport').fire('click');
  assert.match($('report2Status').textContent, /הדוח הופק/);
  assert.match(text($('reportOut').innerHTML), /מפגשים מתוכננים: 0/);
  assert.match(text($('reportOut').innerHTML), /אין מפגשים בתקופה/);
});
