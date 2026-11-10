const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const store = require('../src/lib/store.js');
const { makeProfile } = require('../src/lib/profile.js');
const { makeUnit } = require('../src/lib/unit.js');
const { emptyQueue, submit, approve } = require('../src/lib/approval.js');
const { matchPairs } = require('../src/lib/match.js');
const { emptyLog, logSession } = require('../src/lib/session.js');
const { openApp } = require('../test-support/fake-dom.js');

const ROOT = path.join(__dirname, '..');
const shell = fs.readFileSync(path.join(ROOT, 'src', 'app-shell.html'), 'utf8');

function setupAppWithPairHours(durationHours) {
  const mathUnit = makeUnit({
    subject: 'MATH',
    title: 'משוואות',
    durationMinutes: 20,
    body: 'פותרים שלוש משוואות.'
  });
  const student = makeProfile({
    role: 'student',
    region: 'SOUTH',
    availability: ['SUN_16', 'MON_18'],
    subjects: ['MATH', 'PHYSICS']
  });
  const pupil = makeProfile({
    role: 'pupil',
    region: 'SOUTH',
    availability: ['MON_18'],
    subjects: ['MATH'],
    parentConsent: true
  });
  const queue = approve(submit(emptyQueue(), mathUnit), mathUnit.id);
  const pair = matchPairs([student], [pupil])[0];
  const log = logSession(emptyLog(), queue, pair, {
    slot: 'MON_18',
    subject: 'MATH',
    unitId: mathUnit.id,
    outcome: 'held'
  });

  const stateData = {
    people: [student, pupil],
    queue: queue,
    log: log,
    attendance: [
      { pairIndex: 0, date: '2026-01-01', status: 'held', durationHours: durationHours }
    ]
  };

  const serialized = store.serialize(stateData);
  const $ = openApp({ store: { [store.DEFAULT_KEY]: serialized } });
  $('nav-sessions').fire('click');
  $('sessionPair').value = '0';
  $('sessionPair').fire('change');
  return $;
}

test('#scholarshipProgressBar has role="progressbar", aria-label, and aria-live="polite"', () => {
  const $ = openApp();
  const bar = $('scholarshipProgressBar');
  assert.equal(bar.getAttribute('role'), 'progressbar');
  assert.equal(bar.getAttribute('aria-live'), 'polite');
  assert.ok(bar.getAttribute('aria-label'), 'aria-label attribute must be present');
  assert.equal(bar.getAttribute('aria-valuemin'), '0');
  assert.equal(bar.getAttribute('aria-valuemax'), '100');
  assert.equal(bar.getAttribute('aria-valuenow'), '0');

  // Verify in src/app-shell.html markup
  const barTagMatch = shell.match(/<div\b[^>]*\bid="scholarshipProgressBar"[^>]*>/);
  assert.ok(barTagMatch, 'shell must define element with id="scholarshipProgressBar"');
  assert.match(barTagMatch[0], /role="progressbar"/, 'element must have role="progressbar"');
  assert.match(barTagMatch[0], /aria-live="polite"/, 'element must have aria-live="polite"');
  assert.match(barTagMatch[0], /aria-label="[^"]+"/, 'element must have non-empty aria-label');
});

test('aria-label is descriptive Hebrew without Latin characters', () => {
  const $ = openApp();
  const bar = $('scholarshipProgressBar');
  const barLabel = bar.getAttribute('aria-label');
  assert.ok(barLabel && barLabel.trim().length > 0, 'aria-label must not be empty');
  assert.equal(/[A-Za-z]/.test(barLabel), false, 'aria-label must not contain Latin characters');
  assert.ok(/[\u0590-\u05FF]/.test(barLabel), 'aria-label must contain Hebrew characters');
  assert.match(barLabel, /התקדמות (שעות )?מלגה/, 'aria-label must describe scholarship progress');

  const container = $('scholarshipProgress');
  const containerLabel = container.getAttribute('aria-label');
  assert.ok(containerLabel && containerLabel.trim().length > 0, 'container aria-label must not be empty');
  assert.equal(/[A-Za-z]/.test(containerLabel), false, 'container aria-label must not contain Latin characters');
  assert.ok(/[\u0590-\u05FF]/.test(containerLabel), 'container aria-label must contain Hebrew characters');
  assert.equal(containerLabel, 'התקדמות מלגה');
});

test('#scholarshipProgress container has accessible label and aria-live="polite"', () => {
  const $ = openApp();
  const container = $('scholarshipProgress');
  assert.equal(container.getAttribute('aria-label'), 'התקדמות מלגה');
  assert.equal(container.getAttribute('aria-live'), 'polite');

  // Verify container element in shell markup
  const containerTagMatch = shell.match(/<div\b[^>]*\bid="scholarshipProgress"[^>]*>/);
  assert.ok(containerTagMatch, 'shell must define element with id="scholarshipProgress"');
  assert.match(containerTagMatch[0], /\baria-label="התקדמות מלגה"/, 'shell must include aria-label on #scholarshipProgress');
  assert.match(containerTagMatch[0], /\baria-live="polite"/, 'shell must include aria-live="polite" on #scholarshipProgress');
});

test('dynamic progress updates correctly maintain progressbar attributes (aria-valuenow, aria-valuemin="0", aria-valuemax="100")', () => {
  // Test with initial unselected / 0 hours
  const $init = openApp();
  const barInit = $init('scholarshipProgressBar');
  assert.equal(barInit.getAttribute('role'), 'progressbar');
  assert.equal(barInit.getAttribute('aria-valuemin'), '0');
  assert.equal(barInit.getAttribute('aria-valuemax'), '100');
  assert.equal(barInit.getAttribute('aria-valuenow'), '0');
  assert.equal(barInit.getAttribute('aria-live'), 'polite');
  assert.ok(barInit.getAttribute('aria-label'));

  // Test with 15 hours (50% of 30 hours target)
  const $half = setupAppWithPairHours(15);
  const barHalf = $half('scholarshipProgressBar');
  assert.equal(barHalf.getAttribute('role'), 'progressbar');
  assert.equal(barHalf.getAttribute('aria-valuemin'), '0');
  assert.equal(barHalf.getAttribute('aria-valuemax'), '100');
  assert.equal(barHalf.getAttribute('aria-valuenow'), '50');
  assert.equal(barHalf.getAttribute('aria-live'), 'polite');
  assert.ok(barHalf.getAttribute('aria-label'));
  assert.equal($half('scholarshipProgressFill').style.width, '50%');

  // Test with 30 hours (100% of 30 hours target)
  const $full = setupAppWithPairHours(30);
  const barFull = $full('scholarshipProgressBar');
  assert.equal(barFull.getAttribute('role'), 'progressbar');
  assert.equal(barFull.getAttribute('aria-valuemin'), '0');
  assert.equal(barFull.getAttribute('aria-valuemax'), '100');
  assert.equal(barFull.getAttribute('aria-valuenow'), '100');
  assert.equal(barFull.getAttribute('aria-live'), 'polite');
  assert.ok(barFull.getAttribute('aria-label'));
  assert.equal($full('scholarshipProgressFill').style.width, '100%');

  // Test with 45 hours (capped at 100%)
  const $over = setupAppWithPairHours(45);
  const barOver = $over('scholarshipProgressBar');
  assert.equal(barOver.getAttribute('role'), 'progressbar');
  assert.equal(barOver.getAttribute('aria-valuemin'), '0');
  assert.equal(barOver.getAttribute('aria-valuemax'), '100');
  assert.equal(barOver.getAttribute('aria-valuenow'), '100');
  assert.equal(barOver.getAttribute('aria-live'), 'polite');
  assert.ok(barOver.getAttribute('aria-label'));
  assert.equal($over('scholarshipProgressFill').style.width, '100%');
});
