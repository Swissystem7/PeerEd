'use strict';
// PeerEd - keyboard navigation of the bottom tab bar. The WAI-ARIA tabs pattern says a tab list is one
// tab stop: the selected tab is focusable, the others are not, and the arrow keys move between them.
// This module is the arithmetic of that pattern and nothing else: given how many tabs there are, which
// one has focus, which key was pressed and the writing direction, it answers which tab to select next,
// or -1 for a key that is not ours (so the browser keeps it). No DOM, no clock, no state.
//
// Direction matters because the screen is Hebrew: in a right-to-left tab bar the next tab is to the
// LEFT, so ArrowLeft goes forward and ArrowRight goes back. Both ends wrap. Home and End are the first
// and last tab in either direction.

const DIRECTIONS = Object.freeze(['rtl', 'ltr']);
const KEYS = Object.freeze(['ArrowLeft', 'ArrowRight', 'Home', 'End']);

function stepTab(count, current, key, dir) {
  if (!Number.isInteger(count) || count < 1) throw new Error('invalid tab count: expected a positive integer');
  if (!Number.isInteger(current) || current < 0 || current >= count) {
    throw new Error('invalid current tab: expected an index below the count');
  }
  if (DIRECTIONS.indexOf(dir) === -1) throw new Error('invalid direction: expected rtl or ltr');
  if (key === 'Home') return 0;
  if (key === 'End') return count - 1;
  const forward = dir === 'rtl' ? 'ArrowLeft' : 'ArrowRight';
  const back = dir === 'rtl' ? 'ArrowRight' : 'ArrowLeft';
  if (key === forward) return (current + 1) % count;
  if (key === back) return (current + count - 1) % count;
  return -1;
}

module.exports = { DIRECTIONS, KEYS, stepTab };
