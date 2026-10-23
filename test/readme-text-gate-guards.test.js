'use strict';
// The README said "The gateway for AI content in PURPOSE.md is not offered; the text gate stays as a
// demonstration of the privacy rule" - PURPOSE.md names no such gateway (it says PeerEd is not an AI content
// tool), and the gate is not a demonstration: makeUnit and approval.reject run it before anything is stored.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const readme = fs.readFileSync(path.join(root, 'README.md'), 'utf8');
const purpose = fs.readFileSync(path.join(root, 'PURPOSE.md'), 'utf8');
const { makeUnit } = require('../src/lib/unit.js');
const approval = require('../src/lib/approval.js');

test('the README does not call the gate a demonstration or point at an AI gateway', () => {
  assert.doesNotMatch(readme, /stays as a demonstration/);
  assert.doesNotMatch(readme, /gateway for AI/i);
  assert.doesNotMatch(purpose, /gateway|שער/i);
  assert.match(readme, /The\s+text gate is not a demonstration/);
});

test('a unit title, a unit body and a rejection reason are refused by the gate', () => {
  const unit = { title: 'שברים', subject: 'MATH', durationMinutes: 30, body: 'חיבור שברים במכנה משותף' };
  assert.throws(() => makeUnit(Object.assign({}, unit, { title: 'שברים 050-1234567' })), /personal data/);
  assert.throws(() => makeUnit(Object.assign({}, unit, { body: 'כתבו לי dana@gmail.com' })), /personal data/);
  const made = makeUnit(unit);
  const queue = approval.submit(approval.emptyQueue(), made);
  assert.equal(approval.statusOf(queue, made.id), 'pending');
  assert.throws(() => approval.reject(queue, made.id, 'תתקשר 050-1234567'), /personal data/);
});
