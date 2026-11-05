'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { GUIDE_SECTIONS, guideToc, guideSection, guideText, searchGuide } = require('../src/lib/guide-he.js');
const { findPersonalData } = require('../src/lib/validator.js');

test('guide: all coordinator topics, Hebrew text, no personal data inside the guide itself', () => {
  assert.deepEqual(guideToc().map((s) => s.id), ['start', 'import', 'match', 'schedule', 'attendance', 'reports', 'backup', 'privacy']);
  assert.ok(GUIDE_SECTIONS.every((s) => s.stepsHe.length >= 3));
  assert.deepEqual(findPersonalData(guideText()), []);
  assert.match(guideText(), /שער הפרטיות/);
  assert.equal(guideSection('match').titleHe, 'שידוך');
  assert.throws(() => guideSection('nope'), /unknown guide section/);
});

test('guide: search finds sections and a query with personal data is refused', () => {
  assert.deepEqual(searchGuide('מוצפן').map((s) => s.id), ['backup']);
  assert.deepEqual(searchGuide(''), []);
  assert.deepEqual(searchGuide('מילה שלא קיימת'), []);
  assert.throws(() => searchGuide('050-1234567'), /personal data is not accepted/);
});
