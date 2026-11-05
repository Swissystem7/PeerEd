'use strict';
// PeerEd - weekly multi-week scheduling (stage 2). Deterministic: pairs in input order, slots in
// canonical day/hour order. No clock, no randomness, no network. Internal indexes only.

const { normalizeSlot, DAYS, SUBJECTS } = require('./profile.js');

function slotKey(slot) {
  const c = normalizeSlot(slot);
  if (c === null) return null;
  const m = /^([A-Z]{3})_(\d{1,2})$/.exec(c);
  return DAYS.indexOf(m[1]) * 100 + Number(m[2]);
}
function sortSlots(slots) {
  return (Array.isArray(slots) ? slots : []).map(normalizeSlot).filter(Boolean)
    .filter((v, i, a) => a.indexOf(v) === i).sort((a, b) => slotKey(a) - slotKey(b));
}
function intOr(v, d, min, max) { const n = Number(v); return Number.isInteger(n) && n >= min && n <= max ? n : d; }

// pairs: match2 pairs. profiles: { students:[], pupils:[] } (or { people:[] } split by pair indexes is not needed).
// opts: { sessionsPerWeek=1, durationMinutes=60, weeks=1, maxSessionsPerPupilWeek=2, students, pupils }
function buildSchedule(pairs, opts) {
  const o = opts || {};
  const sessionsPerWeek = intOr(o.sessionsPerWeek, 1, 1, 7);
  const durationMinutes = intOr(o.durationMinutes, 60, 15, 180);
  const weeks = intOr(o.weeks, 1, 1, 52);
  const maxPupil = intOr(o.maxSessionsPerPupilWeek, 2, 1, 14);
  const students = Array.isArray(o.students) ? o.students : [];
  const pupils = Array.isArray(o.pupils) ? o.pupils : [];
  const sessions = []; const waitlist = []; const unscheduled = [];
  const studentSlot = new Set(); // studentIndex|week|slot
  const pupilSlot = new Set();
  const pupilWeekCount = new Map(); // pupilIndex|week -> n
  (Array.isArray(pairs) ? pairs : []).forEach((pair, pairIndex) => {
    if (!pair || !Number.isInteger(pair.studentIndex) || !Number.isInteger(pair.pupilIndex)) { unscheduled.push({ pairIndex, reason: 'INVALID_PAIR' }); return; }
    const slots = sortSlots(pair.sharedSlots);
    const subjects = (Array.isArray(pair.sharedSubjects) ? pair.sharedSubjects : []).filter((s) => SUBJECTS.indexOf(s) !== -1);
    if (slots.length === 0 || subjects.length === 0) { unscheduled.push({ pairIndex, reason: 'NO_SHARED_SLOT_OR_SUBJECT' }); waitlist.push({ pairIndex, reason: 'NO_SHARED_SLOT_OR_SUBJECT' }); return; }
    let placedAny = false; let blockedReason = null;
    for (let w = 0; w < weeks; w += 1) {
      let placedThisWeek = 0;
      for (let i = 0; i < slots.length && placedThisWeek < sessionsPerWeek; i += 1) {
        const slot = slots[i];
        const sk = pair.studentIndex + '|' + w + '|' + slot; const pk = pair.pupilIndex + '|' + w + '|' + slot;
        const ck = pair.pupilIndex + '|' + w;
        if (studentSlot.has(sk)) { blockedReason = 'STUDENT_DOUBLE_BOOKED'; continue; }
        if (pupilSlot.has(pk)) { blockedReason = 'PUPIL_DOUBLE_BOOKED'; continue; }
        if ((pupilWeekCount.get(ck) || 0) >= maxPupil) { blockedReason = 'PUPIL_OVER_CAP'; continue; }
        studentSlot.add(sk); pupilSlot.add(pk); pupilWeekCount.set(ck, (pupilWeekCount.get(ck) || 0) + 1);
        sessions.push(Object.freeze({ pairIndex, studentIndex: pair.studentIndex, pupilIndex: pair.pupilIndex, slot, subject: subjects[(placedThisWeek + w) % subjects.length], durationMinutes, week: w }));
        placedThisWeek += 1; placedAny = true;
      }
      if (placedThisWeek === 0 && blockedReason === 'PUPIL_OVER_CAP') break;
    }
    if (!placedAny) { const reason = blockedReason || 'NO_FREE_SLOT'; unscheduled.push({ pairIndex, reason }); waitlist.push({ pairIndex, reason }); }
  });
  return Object.freeze({ sessions: Object.freeze(sessions), unscheduled: Object.freeze(unscheduled), waitlist: Object.freeze(waitlist), conflicts: findConflicts(sessions, o) });
}

function findConflicts(sessions, opts) {
  const maxPupil = intOr(opts && opts.maxSessionsPerPupilWeek, 2, 1, 14);
  const out = []; const byStudent = new Map(); const byPupil = new Map(); const pupilWeek = new Map();
  (Array.isArray(sessions) ? sessions : []).forEach((s, index) => {
    if (!s) return;
    const sk = s.studentIndex + '|' + s.week + '|' + s.slot; const pk = s.pupilIndex + '|' + s.week + '|' + s.slot; const ck = s.pupilIndex + '|' + s.week;
    if (byStudent.has(sk)) out.push({ type: 'STUDENT_DOUBLE_BOOKED', index, firstIndex: byStudent.get(sk), studentIndex: s.studentIndex, slot: s.slot, week: s.week });
    else byStudent.set(sk, index);
    if (byPupil.has(pk)) out.push({ type: 'PUPIL_DOUBLE_BOOKED', index, firstIndex: byPupil.get(pk), pupilIndex: s.pupilIndex, slot: s.slot, week: s.week });
    else byPupil.set(pk, index);
    pupilWeek.set(ck, (pupilWeek.get(ck) || 0) + 1);
    if (pupilWeek.get(ck) === maxPupil + 1) out.push({ type: 'PUPIL_OVER_CAP', index, pupilIndex: s.pupilIndex, week: s.week, maxSessionsPerPupilWeek: maxPupil });
  });
  return out;
}

// Up to 3 alternative slots for a session/pair: shared slots that create no conflict in `sessions`.
function suggestAlternatives(pair, sessions, opts) {
  if (!pair) return [];
  const taken = new Set(); const pupilTaken = new Set();
  (Array.isArray(sessions) ? sessions : []).forEach((s) => { if (s.studentIndex === pair.studentIndex) taken.add(s.week + '|' + s.slot); if (s.pupilIndex === pair.pupilIndex) pupilTaken.add(s.week + '|' + s.slot); });
  const weeks = intOr(opts && opts.weeks, 1, 1, 52); const out = [];
  for (let w = 0; w < weeks && out.length < 3; w += 1) {
    for (const slot of sortSlots(pair.sharedSlots)) {
      if (out.length >= 3) break;
      if (taken.has(w + '|' + slot) || pupilTaken.has(w + '|' + slot)) continue;
      out.push({ slot, week: w, subject: (pair.sharedSubjects || [])[0] || null });
    }
  }
  return out.slice(0, 3);
}

module.exports = { buildSchedule, findConflicts, suggestAlternatives, sortSlots };
