'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { generateAuditReport } = require('../src/lib/audit-report.js');

function protocol(report) {
  return report.slice(report.indexOf('פרוטוקול מחיקה:'));
}

test('audit-report: the deletion protocol does not promise an automatic removal no screen performs', () => {
  const p = protocol(generateAuditReport());
  assert.doesNotMatch(p, /מוסרות מהמערכת/, 'no screen runs the sweep, so expired rows are not removed on their own');
  assert.match(p, /לא מוחקת רשומה מעצמה/);
  assert.match(p, /מחק הכול מהמכשיר הזה/, 'names the wipe the coordinator actually has');
  assert.match(p, /בדפדפן של המכשיר בלבד/);
  assert.match(p, /קובץ זוגות שהורד/, 'names the downloaded pairs file the wipe cannot reach');
});

test('audit-report: the match line says pairs are recomputed and not stored', () => {
  const line = generateAuditReport().split('\n').find((l) => l.includes('נתוני התאמות חונכות'));
  assert.ok(line);
  assert.match(line, /לא נשמרים/);
  assert.match(line, /קובץ זוגות/);
});
