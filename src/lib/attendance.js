'use strict';
// PeerEd - attendance (stage 3): held / missed / postponed / cancelled per pair and date.
// Immutable log, internal pair indexes only. No clock: every date is passed in.

const { diffDays, parseDate } = require('./semester.js');

const ATTENDANCE_STATUSES = Object.freeze(['held', 'missed', 'postponed', 'cancelled']);

function makeAttendanceLog() { return Object.freeze({ entries: Object.freeze([]) }); }
function assertLog(log) { if (!log || !Array.isArray(log.entries)) throw new Error('invalid attendance log'); }

function recordAttendance(log, input) {
  assertLog(log); const o = input || {};
  if (!Number.isInteger(o.pairIndex) || o.pairIndex < 0) throw new Error('invalid attendance: pairIndex');
  parseDate(o.date);
  if (ATTENDANCE_STATUSES.indexOf(o.status) === -1) throw new Error('invalid attendance status');
  if (log.entries.some((e) => e.pairIndex === o.pairIndex && e.date === o.date)) throw new Error('duplicate attendance for pair and date');
  const entry = Object.freeze({ pairIndex: o.pairIndex, date: o.date, status: o.status });
  return Object.freeze({ entries: Object.freeze(log.entries.concat([entry])) });
}

function attendanceSummary(log, opts) {
  assertLog(log); const o = opts || {};
  const byStatus = { held: 0, missed: 0, postponed: 0, cancelled: 0 }; const byPair = {};
  log.entries.forEach((e) => {
    if (o.from && e.date < o.from) return; if (o.to && e.date > o.to) return;
    byStatus[e.status] += 1; byPair[e.pairIndex] = byPair[e.pairIndex] || { held: 0, missed: 0, postponed: 0, cancelled: 0 }; byPair[e.pairIndex][e.status] += 1;
  });
  const decided = byStatus.held + byStatus.missed;
  return { byStatus, byPair, heldRate: decided === 0 ? null : Math.round((byStatus.held / decided) * 1000) / 1000 };
}

// Mirrors AI_TOPICS in src/app-shell.html
const AI_TOPIC_KEYS = Object.freeze(['AI_LIT_PROMPT', 'AI_CREATIVE', 'AI_STEM_CODE', 'AI_ETHICS_SEC']);

function isAITopicList(topics) {
  if (!Array.isArray(topics) || topics.length === 0) return false;
  return topics.every((t) => typeof t === 'string' && AI_TOPIC_KEYS.includes(t));
}

function getAITopicsSummary(participants) {
  const result = {
    AI_LIT_PROMPT: { total: 0, requested: 0, offered: 0 },
    AI_CREATIVE: { total: 0, requested: 0, offered: 0 },
    AI_STEM_CODE: { total: 0, requested: 0, offered: 0 },
    AI_ETHICS_SEC: { total: 0, requested: 0, offered: 0 }
  };
  if (!Array.isArray(participants) || participants.length === 0) {
    return result;
  }
  for (const p of participants) {
    if (!p || typeof p !== 'object' || Array.isArray(p)) continue;
    const topics = p.target_ai_topics;
    if (!Array.isArray(topics)) continue;
    const uniqueTopics = new Set(topics);
    for (const topic of uniqueTopics) {
      if (!isAITopicList([topic])) continue;
      result[topic].total += 1;
      if (p.role === 'student') {
        result[topic].offered += 1;
      } else if (p.role === 'pupil') {
        result[topic].requested += 1;
      }
    }
  }
  return result;
}

// Pairs with no 'held' session for at least `days` days (default 14) as of asOfISO.
function stalePairs(pairs, log, asOfISO, opts) {
  assertLog(log); parseDate(asOfISO); const days = opts && Number.isInteger(opts.days) ? opts.days : 14;
  const since = opts && opts.since ? opts.since : null; if (since) parseDate(since);
  const last = new Map();
  log.entries.forEach((e) => { if (e.status === 'held' && (!last.has(e.pairIndex) || e.date > last.get(e.pairIndex))) last.set(e.pairIndex, e.date); });
  const out = [];
  (Array.isArray(pairs) ? pairs : []).forEach((pair, pairIndex) => {
    const idx = pair && Number.isInteger(pair.pairIndex) ? pair.pairIndex : pairIndex;
    const lastHeld = last.get(idx) || null;
    const ref = lastHeld || since;
    if (ref === null) return; // without a semester start there is no honest baseline
    const gap = diffDays(ref, asOfISO);
    if (gap >= days) out.push({ pairIndex: idx, lastHeldDate: lastHeld, daysSince: gap, alertHe: 'הזוג לא נפגש כבר ' + gap + ' ימים' });
  });
  return out.sort((a, b) => (b.daysSince - a.daysSince) || (a.pairIndex - b.pairIndex));
}

module.exports = {
  ATTENDANCE_STATUSES,
  makeAttendanceLog,
  recordAttendance,
  attendanceSummary,
  stalePairs,
  AI_TOPIC_KEYS,
  getAITopicsSummary
};
