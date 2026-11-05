'use strict';
// PeerEd - paste import of availability (stage 5). The whole paste passes the free-text privacy gate
// BEFORE parsing: one email/phone/id anywhere refuses everything, and nothing is partially stored.
// Columns: role,region,subjects,availability  (subjects ';'-separated, slots ';'-separated DAY_HOUR).
// parentConsent is never read from a paste: an imported pupil has no consent until granted elsewhere.

const { findPersonalData, PERSONAL_DATA_ERROR } = require('./validator.js');
const { makeProfile, normalizeSlot, SUBJECTS } = require('./profile.js');
const { normalizeRegion } = require('./regions.js');

function parseAvailabilityCsv(text) {
  if (typeof text !== 'string') throw new Error('invalid import: expected text');
  const hits = findPersonalData(text);
  if (hits.length > 0) throw new Error(PERSONAL_DATA_ERROR);
  // physical line numbers are kept (blank lines included), so an error names the row the coordinator sees
  const lines = text.replace(/\r\n?/g, '\n').split('\n');
  const firstData = lines.findIndex((l) => l.trim() !== '');
  if (firstData === -1) return Object.freeze({ profiles: Object.freeze([]), errors: Object.freeze([]) });
  const header = lines[firstData].split(',').map((h) => h.trim().toLowerCase());
  const want = ['role', 'region', 'subjects', 'availability'];
  if (header.length !== 4 || !want.every((w, i) => header[i] === w)) throw new Error('invalid import header: expected role,region,subjects,availability');
  const profiles = []; const errors = []; const seenRows = new Set();
  for (let i = firstData + 1; i < lines.length; i += 1) {
    if (lines[i].trim() === '') continue;
    const cells = lines[i].split(',');
    if (cells.length !== 4) { errors.push(Object.freeze({ line: i + 1, reason: 'WRONG_COLUMNS' })); continue; }
    const role = cells[0].trim().toLowerCase();
    const region = normalizeRegion(cells[1]);
    const subjects = cells[2].split(';').map((s) => s.trim().toUpperCase()).filter(Boolean);
    const availability = cells[3].split(';').map((s) => normalizeSlot(s.trim().toUpperCase())).filter(Boolean);
    if (role !== 'student' && role !== 'pupil') { errors.push(Object.freeze({ line: i + 1, reason: 'INVALID_ROLE' })); continue; }
    if (region === null) { errors.push(Object.freeze({ line: i + 1, reason: 'INVALID_REGION' })); continue; }
    if (subjects.length === 0 || subjects.some((s) => SUBJECTS.indexOf(s) === -1)) { errors.push(Object.freeze({ line: i + 1, reason: 'INVALID_SUBJECT' })); continue; }
    if (availability.length === 0 || availability.length !== cells[3].split(';').filter((s) => s.trim() !== '').length) { errors.push(Object.freeze({ line: i + 1, reason: 'INVALID_SLOT' })); continue; }
    const rowKey = role + '|' + region + '|' + subjects.slice().sort().join(';') + '|' + availability.slice().sort().join(';');
    if (seenRows.has(rowKey)) { errors.push(Object.freeze({ line: i + 1, reason: 'DUPLICATE_ROW' })); continue; }
    seenRows.add(rowKey);
    try { profiles.push(makeProfile({ role, region, availability, subjects })); }
    catch (e) { errors.push(Object.freeze({ line: i + 1, reason: 'PROFILE_REJECTED' })); }
  }
  return Object.freeze({ profiles: Object.freeze(profiles), errors: Object.freeze(errors) });
}

module.exports = { parseAvailabilityCsv };
