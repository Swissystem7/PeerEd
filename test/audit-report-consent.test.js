'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { makeProfile } = require('../src/lib/profile.js');
const { generateAuditReport } = require('../src/lib/audit-report.js');

test('audit-report: the profile data collected names the pupil parent consent a stored pupil holds', () => {
  const pupil = makeProfile({ role: 'pupil', region: 'CENTER', availability: ['SUN_16'], subjects: ['MATH'] });
  assert.equal(pupil.parentConsent, false, 'a stored pupil carries the consent flag');
  const report = generateAuditReport();
  const profileLine = report.split('\n').find((line) => line.startsWith('• נתוני פרופיל'));
  assert.match(profileLine, /אישור הורה/);
});

test('audit-report: the consent is said to be a yes or a no only, and a pupil without it is not matched', () => {
  const report = generateAuditReport();
  assert.match(report, /אישור הורה נשמר ככן או לא בלבד, בלי שם ההורה/);
  assert.match(report, /תלמיד בלי אישור הורה לא נכנס לשידוך/);
});
