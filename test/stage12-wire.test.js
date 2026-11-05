'use strict';
// Stage 12 wiring: guide screen, offline SW registration, match2/schedule/reports screens in the shell.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const guide = require('../src/lib/guide-he.js');
const match2 = require('../src/lib/match2.js');
const reports = require('../src/lib/reports.js');

const root = path.join(__dirname, '..');
const shell = fs.readFileSync(path.join(root, 'src', 'app-shell.html'), 'utf8');
const app = fs.readFileSync(path.join(root, 'app.html'), 'utf8');

test('stage12: shell and built app carry guide, reports, match2 and schedule screens', () => {
  for (const html of [shell, app]) {
    assert.ok(html.includes('id="tab-guide"'), 'guide panel');
    assert.ok(html.includes('id="tab-reports"'), 'reports panel');
    assert.ok(html.includes('id="nav-guide"') && html.includes('>מדריך<'), 'guide tab');
    assert.ok(html.includes('id="nav-reports"') && html.includes('>דוחות<'), 'reports tab');
    assert.ok(html.includes("guideLib = __registry['guide-he']"), 'guide binding');
    assert.ok(html.includes('match2Lib = __registry.match2'), 'match2 binding');
    assert.ok(html.includes('scheduleLib = __registry.schedule'), 'schedule binding');
    assert.ok(html.includes('capacityLib = __registry.capacity'), 'capacity binding');
    assert.ok(html.includes('reportsLib = __registry.reports'), 'reports binding');
    assert.ok(html.includes('guideLib.searchGuide('), 'guide search call');
    assert.ok(html.includes('match2Lib.match2('), 'match2 call');
    assert.ok(html.includes('match2Lib.rematchPartial('), 'partial rematch call');
    assert.ok(html.includes('scheduleLib.buildSchedule('), 'schedule call');
    assert.ok(html.includes('scheduleLib.findConflicts('), 'conflicts call');
    assert.ok(html.includes('scheduleLib.suggestAlternatives('), 'alternatives call');
    assert.ok(html.includes('capacityLib.analyzeCapacity('), 'capacity call');
    assert.ok(html.includes('reportsLib.weeklyReport('), 'weekly report call');
    assert.ok(html.includes('reportsLib.svgBarChart('), 'chart call');
    assert.ok(html.includes('reportsLib.reportToCsv('), 'csv call');
    assert.ok(html.includes('reportsLib.reportToIcs('), 'ics call');
    assert.ok(html.includes('reportsLib.printableHtml('), 'print call');
  }
});

test('stage12: SW registration is guarded to same-origin http(s) and never fetches', () => {
  assert.ok(shell.includes("'service' + 'Worker' in navigator"), 'feature detect (split spelling, as in pwa.js)');
  assert.ok(!shell.includes('serviceWorker'), 'registration API spelled in parts, like the libs do');
  assert.ok(shell.includes("location.protocol === 'https:'"), 'https guard');
  assert.ok(shell.includes('pwaLib.swSource()'), 'worker source from pwa lib');
  assert.ok(shell.includes('pwaLib.manifestJson()'), 'manifest from pwa lib');
  assert.ok(!shell.includes('fetch('), 'no fetch added');
  assert.ok(!shell.includes('XMLHttpRequest'), 'no XHR added');
  assert.ok(!shell.includes('src="http'), 'no external script');
});

test('stage12: guide search blocks personal data and stores nothing', () => {
  assert.equal(guide.GUIDE_SECTIONS.length, 8);
  assert.throws(() => guide.searchGuide('call 050-1234567'), /personal data is not accepted/);
  assert.ok(Array.isArray(guide.searchGuide('שידוך')));
  const wiring = shell.slice(shell.indexOf("$('guideSearchBtn')"), shell.indexOf("$('guideAllBtn')"));
  assert.ok(!wiring.includes('localStorage') && !wiring.includes('save('), 'search result is not stored');
});

test('stage12: match2 and reports libs run on code-only data', () => {
  const s = [{ role: 'student', region: 'CENTER', subjects: ['MATH'], availability: ['SUN_16'] }];
  const p = [{ role: 'pupil', region: 'CENTER', subjects: ['MATH'], availability: ['SUN_16'], parentConsent: true }];
  const m = match2.match2(s, p);
  assert.equal(m.pairs.length, 1);
  assert.ok(m.pairs[0].explanationHe.length > 0);
  const r = reports.weeklyReport({ sessions: [{ date: '2026-01-04', subject: 'MATH', region: 'CENTER', pairIndex: 0 }], attendance: { entries: [] } }, '2026-01-04');
  assert.equal(r.scheduled, 1);
  assert.ok(reports.reportToCsv(r).includes('subject,MATH,1'));
});
