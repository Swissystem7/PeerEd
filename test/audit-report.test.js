'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { getRetentionPolicy } = require('../src/lib/retention.js');
const { generateAuditReport } = require('../src/lib/audit-report.js');

test('audit-report: Hebrew statement reflects active retention limits and deletion protocol', () => {
  const policy = getRetentionPolicy();
  const report = generateAuditReport();

  assert.match(report, /[\u0590-\u05FF]/, 'report must be localized Hebrew text');
  assert.ok(report.includes(String(policy.profile)), 'must state profile retention duration in days');
  assert.ok(report.includes(String(policy.match)), 'must state match retention duration in days');
  assert.match(report, /נתוני פרופיל/, 'must describe profile data collected');
  assert.match(report, /התאמות/, 'must describe match data collected');
  assert.match(report, /פרוטוקול מחיקה/, 'must document deletion protocol for audits');
  assert.match(report, /מוסרות|מחיקה/, 'must explain how data is removed after retention');
  assert.match(report, /לא נשמר עותק ארכיוני/, 'must state that archival copies are not kept');
});

test('audit-report: durations track the frozen policy object, not hard-coded literals', () => {
  const policy = getRetentionPolicy();
  const report = generateAuditReport();
  const profileLine = report.split('\n').find((line) => line.includes('נתוני פרופיל') && line.includes('ימים'));
  const matchLine = report.split('\n').find((line) => line.includes('נתוני התאמות') && line.includes('ימים'));

  assert.ok(profileLine && profileLine.includes(String(policy.profile)));
  assert.ok(matchLine && matchLine.includes(String(policy.match)));
});

test('audit-report: generateAuditReport uses a supplied policy when one is passed', () => {
  const report = generateAuditReport({ profile: 100, match: 50 });
  assert.ok(report.includes('100'), 'profile retention must come from the passed policy');
  assert.ok(report.includes('50'), 'match retention must come from the passed policy');
  assert.doesNotMatch(report, /\b730\b|\b365\b/, 'must not embed the live policy when another is supplied');
});

test('audit-report: a policy missing a category or stating a non-whole number of days is refused', () => {
  assert.throws(() => generateAuditReport({ profile: 100 }), /invalid policy: match/);
  assert.throws(() => generateAuditReport({ match: 50 }), /invalid policy: profile/);
  for (const bad of [Infinity, NaN, -1, 1.5, '100', null]) {
    assert.throws(() => generateAuditReport({ profile: bad, match: 50 }), /invalid policy: profile/, String(bad));
  }
  for (const bad of [null, [], 'policy', 7]) {
    assert.throws(() => generateAuditReport(bad), /invalid policy/, String(bad));
  }
  assert.ok(generateAuditReport({ profile: 0, match: 0 }).includes('עד 0 ימים'), '0 days is a real policy');
});
