'use strict';
// The match screen holds four cards: summary, pairs, unmatched and across-region suggestions.
// Before a match is computed, all four must show the consistent empty message ("מופיע אחרי חישוב שידוך.").
// When the roster is modified (person added or deleted, demo loaded), any previously computed match
// is stale: the cards must reset to the empty state so a coordinator never sees pairs for a roster
// that no longer matches the screen.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { openApp, addPerson, text, ROOT } = require('../test-support/fake-dom.js');

test('match screen: the shell has empty states for pairs and unmatched on initial load', () => {
  const shell = fs.readFileSync(path.join(ROOT, 'src', 'app-shell.html'), 'utf8');
  assert.ok(
    shell.includes('<div id="pairs"><p class="empty">מופיע אחרי חישוב שידוך.</p></div>'),
    'pairs container should have initial empty state'
  );
  assert.ok(
    shell.includes('<div id="unmatched"><p class="empty">מופיע אחרי חישוב שידוך.</p></div>'),
    'unmatched container should have initial empty state'
  );
});

test('match screen: all match cards start with the empty state on load', () => {
  const $ = openApp();
  assert.match($('summary').innerHTML, /מופיע אחרי חישוב שידוך/);
  assert.match($('pairs').innerHTML, /מופיע אחרי חישוב שידוך/);
  assert.match($('unmatched').innerHTML, /מופיע אחרי חישוב שידוך/);
  assert.match($('across').innerHTML, /מופיע אחרי חישוב שידוך/);
});

test('match screen: modifying participants resets stale match results', () => {
  const $ = openApp();
  addPerson($, 'pupil', 'CENTER', ['MATH'], ['SUN_16']);
  addPerson($, 'student', 'CENTER', ['MATH'], ['SUN_16']);

  $('runMatch').fire('click');
  assert.match(text($('pairs').innerHTML), /סטודנט מלמד #2 עם תלמיד #1/);

  // Adding a new participant resets the match cards to the empty state
  addPerson($, 'pupil', 'NORTH', ['ENGLISH'], ['MON_18']);
  assert.match($('summary').innerHTML, /מופיע אחרי חישוב שידוך/);
  assert.match($('pairs').innerHTML, /מופיע אחרי חישוב שידוך/);
  assert.match($('unmatched').innerHTML, /מופיע אחרי חישוב שידוך/);
  assert.match($('across').innerHTML, /מופיע אחרי חישוב שידוך/);

  // Export is blocked until a fresh match is calculated
  $('exportCsv').fire('click');
  assert.equal($.downloads.length, 0, 'export must be blocked when match is reset');
  assert.ok($('matchStatus').className.includes('bad'));

  // Re-running the match updates with the new roster
  $('runMatch').fire('click');
  assert.match(text($('pairs').innerHTML), /סטודנט מלמד #2 עם תלמיד #1/);
  assert.match(text($('unmatched').innerHTML), /תלמיד #3/);

  // Deleting a participant also resets the match cards
  $('peopleList').fire('click', { target: { getAttribute: (k) => (k === 'data-del' ? '2' : null) } });
  assert.match($('summary').innerHTML, /מופיע אחרי חישוב שידוך/);
  assert.match($('pairs').innerHTML, /מופיע אחרי חישוב שידוך/);
  assert.match($('unmatched').innerHTML, /מופיע אחרי חישוב שידוך/);
  assert.match($('across').innerHTML, /מופיע אחרי חישוב שידוך/);
});

test('match screen: failed computeMatch clears stale results and shows error', () => {
  const $ = openApp();
  addPerson($, 'pupil', 'CENTER', ['MATH'], ['SUN_16']);
  addPerson($, 'student', 'CENTER', ['MATH'], ['SUN_16']);

  $('runMatch').fire('click');
  assert.match(text($('pairs').innerHTML), /סטודנט מלמד #2 עם תלמיד #1/);

  // Delete student (#2, index 1)
  $('peopleList').fire('click', { target: { getAttribute: (k) => (k === 'data-del' ? '1' : null) } });

  // Click compute match with no student
  $('runMatch').fire('click');
  assert.ok($('matchStatus').className.includes('bad'));
  assert.match($('matchStatus').textContent, /צריך לפחות סטודנט אחד ותלמיד אחד/);
  assert.match($('pairs').innerHTML, /מופיע אחרי חישוב שידוך/);
});

test('match screen: toggling parent consent resets stale match results and blocks export', () => {
  const $ = openApp();
  addPerson($, 'pupil', 'CENTER', ['MATH'], ['SUN_16']);
  addPerson($, 'student', 'CENTER', ['MATH'], ['SUN_16']);

  $('runMatch').fire('click');
  assert.match(text($('pairs').innerHTML), /סטודנט מלמד #2 עם תלמיד #1/);

  // Toggle parent consent off for pupil (#1, index 0)
  $('peopleList').fire('click', { target: { getAttribute: (k) => (k === 'data-consent' ? '0' : null) } });
  assert.match($('summary').innerHTML, /מופיע אחרי חישוב שידוך/);
  assert.match($('pairs').innerHTML, /מופיע אחרי חישוב שידוך/);
  assert.match($('unmatched').innerHTML, /מופיע אחרי חישוב שידוך/);
  assert.match($('across').innerHTML, /מופיע אחרי חישוב שידוך/);

  // Export is blocked until recomputed
  $('exportCsv').fire('click');
  assert.equal($.downloads.length, 0, 'export must be blocked when match is reset');
  assert.ok($('matchStatus').className.includes('bad'));
});

test('match screen: wiping the device resets match cards and prevents exporting wiped data', () => {
  const $ = openApp();
  addPerson($, 'pupil', 'CENTER', ['MATH'], ['SUN_16']);
  addPerson($, 'student', 'CENTER', ['MATH'], ['SUN_16']);

  $('runMatch').fire('click');
  assert.match(text($('pairs').innerHTML), /סטודנט מלמד #2 עם תלמיד #1/);

  // Arm and confirm device wipe
  $('wipeBtn').fire('click');
  $('wipeBtn').fire('click');

  assert.match($('summary').innerHTML, /מופיע אחרי חישוב שידוך/);
  assert.match($('pairs').innerHTML, /מופיע אחרי חישוב שידוך/);
  assert.match($('unmatched').innerHTML, /מופיע אחרי חישוב שידוך/);
  assert.match($('across').innerHTML, /מופיע אחרי חישוב שידוך/);

  // Export is blocked rather than exporting the wiped roster's pairs
  $('exportCsv').fire('click');
  assert.equal($.downloads.length, 0, 'export must be blocked after device wipe');
  assert.ok($('matchStatus').className.includes('bad'));
  assert.match($('matchStatus').textContent, /קודם לחץ "חשב שידוך"/);
});
