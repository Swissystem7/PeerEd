const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const store = require('../src/lib/store.js');
const { makeProfile } = require('../src/lib/profile.js');
const { emptyQueue } = require('../src/lib/approval.js');
const { emptyLog } = require('../src/lib/session.js');
const { openApp } = require('../test-support/fake-dom.js');

const ROOT = path.join(__dirname, '..');
const shell = fs.readFileSync(path.join(ROOT, 'src', 'app-shell.html'), 'utf8');

test('Test 1: src/app-shell.html defines aria-describedby on #sessionPair containing sessionStatus, pairTotalHoursBadge, and pairZeroHoursHint', () => {
  const match = shell.match(/<select\b[^>]*\bid="sessionPair"[^>]*>/i);
  assert.ok(match, '#sessionPair select element must exist in src/app-shell.html');
  const describedByMatch = match[0].match(/\baria-describedby="([^"]+)"/i);
  assert.ok(describedByMatch, '#sessionPair must define aria-describedby');
  const tokens = describedByMatch[1].trim().split(/\s+/);
  assert.ok(tokens.includes('sessionStatus'), 'aria-describedby must include sessionStatus');
  assert.ok(tokens.includes('pairTotalHoursBadge'), 'aria-describedby must include pairTotalHoursBadge');
  assert.ok(tokens.includes('pairZeroHoursHint'), 'aria-describedby must include pairZeroHoursHint');
});

test('Test 2: src/app-shell.html defines aria-describedby on #sessionSlot containing sessionStatus and sessionFormHint', () => {
  const match = shell.match(/<select\b[^>]*\bid="sessionSlot"[^>]*>/i);
  assert.ok(match, '#sessionSlot select element must exist in src/app-shell.html');
  const describedByMatch = match[0].match(/\baria-describedby="([^"]+)"/i);
  assert.ok(describedByMatch, '#sessionSlot must define aria-describedby');
  const tokens = describedByMatch[1].trim().split(/\s+/);
  assert.ok(tokens.includes('sessionStatus'), 'aria-describedby must include sessionStatus');
  assert.ok(tokens.includes('sessionFormHint'), 'aria-describedby must include sessionFormHint');
});

test('Test 3: referenced elements (pairTotalHoursBadge, pairZeroHoursHint, sessionFormHint, sessionStatus) exist with appropriate role or hint content', () => {
  // Check pairTotalHoursBadge
  const badgeMatch = shell.match(/<span\b[^>]*\bid="pairTotalHoursBadge"[^>]*>([\s\S]*?)<\/span>/i);
  assert.ok(badgeMatch, '#pairTotalHoursBadge must exist in shell');
  assert.match(badgeMatch[0], /role="status"/, 'badge must have role="status"');
  assert.match(badgeMatch[0], /aria-live="polite"/, 'badge must have aria-live="polite"');
  assert.match(badgeMatch[0], /class="[^"]*\bpair-total-hours-badge\b[^"]*"/, 'badge must have pair-total-hours-badge class');

  // Check pairZeroHoursHint
  const zeroHintMatch = shell.match(/<p\b[^>]*\bid="pairZeroHoursHint"[^>]*>/i);
  assert.ok(zeroHintMatch, '#pairZeroHoursHint must exist in shell');
  assert.match(zeroHintMatch[0], /role="status"/, 'zero hours hint must have role="status"');
  assert.match(zeroHintMatch[0], /aria-live="polite"/, 'zero hours hint must have aria-live="polite"');
  assert.match(zeroHintMatch[0], /class="[^"]*\bhint\b[^"]*"/, 'zero hours hint must have hint class');

  // Check sessionFormHint
  const formHintMatch = shell.match(/<p\b[^>]*\bid="sessionFormHint"[^>]*>([\s\S]*?)<\/p>/i);
  assert.ok(formHintMatch, '#sessionFormHint must exist in shell');
  assert.match(formHintMatch[0], /class="[^"]*\bhint\b[^"]*"/, 'sessionFormHint must have hint class');
  assert.match(formHintMatch[1], /הזוגות מחושבים מחדש מהרשימה/, 'sessionFormHint must contain expected Hebrew explanation');

  // Check sessionStatus
  const statusMatch = shell.match(/<p\b[^>]*\bid="sessionStatus"[^>]*>/i);
  assert.ok(statusMatch, '#sessionStatus must exist in shell');
  assert.match(statusMatch[0], /role="status"/, 'sessionStatus must have role="status"');
  assert.match(statusMatch[0], /class="[^"]*\bstatus\b[^"]*"/, 'sessionStatus must have status class');

  // Verify in DOM via openApp()
  const $ = openApp();
  assert.equal($('pairTotalHoursBadge').getAttribute('role'), 'status');
  assert.equal($('pairTotalHoursBadge').getAttribute('aria-live'), 'polite');
  assert.equal($('pairZeroHoursHint').getAttribute('role'), 'status');
  assert.equal($('pairZeroHoursHint').getAttribute('aria-live'), 'polite');
  assert.equal($('sessionStatus').getAttribute('role'), 'status');
  assert.equal($('sessionFormHint').getAttribute('class'), 'hint');
});

test('Test 4: using openApp(), verify sessionPair and sessionSlot DOM elements have aria-describedby properly initialized and switching pairs updates badge text while keeping accessibility association intact', () => {
  const student1 = makeProfile({
    role: 'student',
    region: 'CENTER',
    availability: ['SUN_16', 'MON_18'],
    subjects: ['MATH']
  });
  const pupil1 = makeProfile({
    role: 'pupil',
    region: 'CENTER',
    availability: ['SUN_16'],
    subjects: ['MATH'],
    parentConsent: true
  });
  const student2 = makeProfile({
    role: 'student',
    region: 'NORTH',
    availability: ['TUE_18'],
    subjects: ['PHYSICS']
  });
  const pupil2 = makeProfile({
    role: 'pupil',
    region: 'NORTH',
    availability: ['TUE_18'],
    subjects: ['PHYSICS'],
    parentConsent: true
  });

  const stateData = {
    people: [student1, pupil1, student2, pupil2],
    queue: emptyQueue(),
    log: emptyLog(),
    attendance: [
      { pairIndex: 0, date: '2026-01-01', status: 'held', durationHours: 4.5 }
    ]
  };

  const serialized = store.serialize(stateData);
  const $ = openApp({ store: { [store.DEFAULT_KEY]: serialized } });
  $('nav-sessions').fire('click');

  const pairEl = $('sessionPair');
  const slotEl = $('sessionSlot');

  // Verify initial aria-describedby associations
  assert.equal(pairEl.getAttribute('aria-describedby'), 'sessionStatus pairTotalHoursBadge pairZeroHoursHint');
  assert.equal(slotEl.getAttribute('aria-describedby'), 'sessionStatus sessionFormHint');

  // Initial pair selected is 0
  pairEl.value = '0';
  pairEl.fire('change');
  assert.equal($('pairTotalHoursBadge').textContent, 'סך שעות: 4.5');
  assert.equal($('pairZeroHoursHint').hidden, true);

  // Switch to pair 1 (which has 0 hours recorded)
  pairEl.value = '1';
  pairEl.fire('change');
  assert.equal($('pairTotalHoursBadge').textContent, 'סך שעות: 0');
  assert.equal($('pairZeroHoursHint').hidden, false);
  assert.match($('pairZeroHoursHint').textContent, /טרם נרשמו שעות מאושרות לזוג זה/);

  // Accessibility association remains intact after switching
  assert.equal(pairEl.getAttribute('aria-describedby'), 'sessionStatus pairTotalHoursBadge pairZeroHoursHint');
  assert.equal(slotEl.getAttribute('aria-describedby'), 'sessionStatus sessionFormHint');

  // Switch back to pair 0
  pairEl.value = '0';
  pairEl.fire('change');
  assert.equal($('pairTotalHoursBadge').textContent, 'סך שעות: 4.5');
  assert.equal($('pairZeroHoursHint').hidden, true);
  assert.equal(pairEl.getAttribute('aria-describedby'), 'sessionStatus pairTotalHoursBadge pairZeroHoursHint');
  assert.equal(slotEl.getAttribute('aria-describedby'), 'sessionStatus sessionFormHint');
});
