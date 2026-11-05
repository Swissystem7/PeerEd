'use strict';
// PeerEd - multi-criteria matching (stage 1). Global optimum, never greedy: the assignment maximises
// pair count first and total score second, via deterministic min-cost max-flow. No clock/random/network.
// Extended profile fields (level, languages, preferredSubjects) are read here only; makeProfile's
// privacy gate is untouched and a pupil still needs parentConsent === true to be paired at all.

const { shared, hasParentConsent } = require('./match.js');

const DEFAULT_WEIGHTS = Object.freeze({ region: 25, hours: 20, subject: 20, level: 15, language: 10, preference: 10 });
const PAIR_BONUS = 1000; // > max score of one pair (100), so one more pair always beats a better score

function weightsOf(opts) {
  const w = Object.assign({}, DEFAULT_WEIGHTS, (opts && opts.weights) || {});
  for (const k of Object.keys(DEFAULT_WEIGHTS)) if (!(Number(w[k]) >= 0)) w[k] = DEFAULT_WEIGHTS[k];
  return w;
}
function normLevel(x) { const n = Number(x && x.level); return Number.isFinite(n) ? Math.min(5, Math.max(1, n)) : null; }
function langs(x) { return Array.isArray(x && x.languages) ? x.languages.filter((v) => typeof v === 'string') : []; }
function prefs(x) { return Array.isArray(x && x.preferredSubjects) ? x.preferredSubjects : []; }
function capacityOf(s, opts) {
  const c = s && s.maxPupils !== undefined ? Number(s.maxPupils) : (opts && opts.studentCapacity);
  return Number.isInteger(c) && c > 0 ? c : 1;
}

function scorePair(student, pupil, weights) {
  const w = weights || DEFAULT_WEIGHTS;
  const sharedSlots = shared(student.availability, pupil.availability);
  const sharedSubjects = shared(student.subjects, pupil.subjects);
  const sharedLanguages = shared(langs(student), langs(pupil));
  const regionSame = typeof student.region === 'string' && student.region === pupil.region;
  const sl = normLevel(student); const pl = normLevel(pupil);
  const levelFit = sl === null || pl === null ? 0.5 : 1 - Math.abs(sl - pl) / 4;
  const langFit = langs(student).length === 0 || langs(pupil).length === 0 ? 0.5
    : (sharedLanguages.length > 0 ? 1 : 0);
  const prefHits = shared(prefs(student), pupil.subjects).length + shared(prefs(pupil), student.subjects).length;
  const prefFit = Math.min(1, prefHits / 2);
  const b = {
    region: Math.round(w.region * (regionSame ? 1 : 0)),
    hours: Math.round(w.hours * Math.min(1, sharedSlots.length / 3)),
    subject: Math.round(w.subject * Math.min(1, sharedSubjects.length / 2)),
    level: Math.round(w.level * levelFit),
    language: Math.round(w.language * langFit),
    preference: Math.round(w.preference * prefFit)
  };
  b.total = b.region + b.hours + b.subject + b.level + b.language + b.preference;
  return { score: b.total, breakdown: b, sharedSlots, sharedSubjects, sharedLanguages, regionSame, levelFit };
}

function explainHe(scored, student, pupil) {
  const b = scored.breakdown; const parts = [];
  parts.push(scored.regionSame ? '\u05d0\u05d5\u05ea\u05d5 \u05d0\u05d6\u05d5\u05e8 (' + pupil.region + ')' : '\u05d0\u05d6\u05d5\u05e8\u05d9\u05dd \u05e9\u05d5\u05e0\u05d9\u05dd');
  parts.push(scored.sharedSlots.length + ' \u05e9\u05e2\u05d5\u05ea \u05de\u05e9\u05d5\u05ea\u05e4\u05d5\u05ea (' + scored.sharedSlots.join(', ') + ')');
  parts.push('\u05de\u05e7\u05e6\u05d5\u05e2\u05d5\u05ea \u05de\u05e9\u05d5\u05ea\u05e4\u05d9\u05dd: ' + scored.sharedSubjects.join(', '));
  if (normLevel(student) !== null && normLevel(pupil) !== null) parts.push('\u05d4\u05ea\u05d0\u05de\u05ea \u05e8\u05de\u05d4 ' + student.level + ' \u05de\u05d5\u05dc ' + pupil.level);
  if (scored.sharedLanguages.length) parts.push('\u05e9\u05e4\u05d4 \u05de\u05e9\u05d5\u05ea\u05e4\u05ea: ' + scored.sharedLanguages.join(', '));
  return '\u05e6\u05d9\u05d5\u05df ' + b.total + '/100 \u2014 ' + parts.join('; ') + ' [\u05d0\u05d6\u05d5\u05e8 ' + b.region + ', \u05e9\u05e2\u05d5\u05ea ' + b.hours + ', \u05de\u05e7\u05e6\u05d5\u05e2 ' + b.subject + ', \u05e8\u05de\u05d4 ' + b.level + ', \u05e9\u05e4\u05d4 ' + b.language + ', \u05d4\u05e2\u05d3\u05e4\u05d5\u05ea ' + b.preference + ']';
}

function isCandidate(student, pupil, opts, si, pi) {
  if (!student || !pupil || !hasParentConsent(pupil)) return false;
  if ((opts && opts.requireSameRegion) && student.region !== pupil.region) return false;
  const blocked = (opts && opts.blockedPairs) || [];
  return shared(student.availability, pupil.availability).length > 0 &&
    shared(student.subjects, pupil.subjects).length > 0 && !blocked.some((x) => x && x.studentIndex === si && x.pupilIndex === pi);
}

// Deterministic min-cost max-flow (SPFA, edges scanned in insertion order, strict improvement only).
function maxFlowAssignment(ns, np, edges, caps) {
  // nodes: 0 source, 1..ns students, ns+1..ns+np pupils, last sink
  const N = ns + np + 2; const SRC = 0; const SNK = N - 1;
  const g = Array.from({ length: N }, () => []);
  function add(u, v, cap, cost) { g[u].push({ to: v, rev: g[v].length, cap, cost }); g[v].push({ to: u, rev: g[u].length - 1, cap: 0, cost: -cost }); }
  for (let i = 0; i < ns; i += 1) add(SRC, 1 + i, caps[i], 0);
  const edgeRef = [];
  edges.forEach((e) => { add(1 + e.s, 1 + ns + e.p, 1, -(PAIR_BONUS + e.score)); edgeRef.push(g[1 + e.s][g[1 + e.s].length - 1]); });
  for (let j = 0; j < np; j += 1) add(1 + ns + j, SNK, 1, 0);
  for (;;) {
    const dist = Array(N).fill(Infinity); const prev = Array(N).fill(null); const inQ = Array(N).fill(false);
    dist[SRC] = 0; const q = [SRC]; inQ[SRC] = true;
    while (q.length) {
      const u = q.shift(); inQ[u] = false;
      g[u].forEach((e, ei) => { if (e.cap > 0 && dist[u] + e.cost < dist[e.to]) { dist[e.to] = dist[u] + e.cost; prev[e.to] = { u, ei }; if (!inQ[e.to]) { q.push(e.to); inQ[e.to] = true; } } });
    }
    if (!prev[SNK]) break;
    let v = SNK; while (v !== SRC) { const { u, ei } = prev[v]; const e = g[u][ei]; e.cap -= 1; g[v][e.rev].cap += 1; v = u; }
  }
  return edges.filter((e, i) => edgeRef[i].cap === 0);
}

function match2(students, pupils, opts) {
  const o = opts || {}; const S = Array.isArray(students) ? students : []; const P = Array.isArray(pupils) ? pupils : [];
  const w = weightsOf(o);
  const locked = Array.isArray(o.locked) ? o.locked : [];
  const usedS = new Map(); const usedP = new Set(); const pairs = [];
  function pushPair(si, pi) {
    const sc = scorePair(S[si], P[pi], w);
    pairs.push({ studentIndex: si, pupilIndex: pi, score: sc.score, breakdown: sc.breakdown, sharedSlots: sc.sharedSlots, sharedSubjects: sc.sharedSubjects, sharedLanguages: sc.sharedLanguages, locked: true, explanationHe: explainHe(sc, S[si], P[pi]) });
  }
  locked.forEach((lk) => {
    const si = lk && lk.studentIndex; const pi = lk && lk.pupilIndex;
    if (!Number.isInteger(si) || !Number.isInteger(pi) || !S[si] || !P[pi] || usedP.has(pi) || (usedS.get(si) || 0) >= capacityOf(S[si], o) || !isCandidate(S[si], P[pi], o, si, pi)) throw new Error('invalid locked pair: not a valid candidate');
    usedS.set(si, (usedS.get(si) || 0) + 1); usedP.add(pi); pushPair(si, pi);
  });
  const edges = [];
  for (let si = 0; si < S.length; si += 1) for (let pi = 0; pi < P.length; pi += 1) {
    if (usedP.has(pi) || !isCandidate(S[si], P[pi], o, si, pi)) continue;
    const sc = scorePair(S[si], P[pi], w);
    edges.push({ s: si, p: pi, score: sc.score, sc });
  }
  edges.sort((a, b) => (b.score - a.score) || (a.s - b.s) || (a.p - b.p));
  const caps = S.map((s, i) => Math.max(0, capacityOf(s, o) - (usedS.get(i) || 0)));
  maxFlowAssignment(S.length, P.length, edges, caps).forEach((e) => {
    pairs.push({ studentIndex: e.s, pupilIndex: e.p, score: e.score, breakdown: e.sc.breakdown, sharedSlots: e.sc.sharedSlots, sharedSubjects: e.sc.sharedSubjects, sharedLanguages: e.sc.sharedLanguages, locked: false, explanationHe: explainHe(e.sc, S[e.s], P[e.p]) });
  });
  pairs.sort((a, b) => (a.studentIndex - b.studentIndex) || (a.pupilIndex - b.pupilIndex));
  const pairedP = new Set(pairs.map((x) => x.pupilIndex)); const countS = new Map();
  pairs.forEach((x) => countS.set(x.studentIndex, (countS.get(x.studentIndex) || 0) + 1));
  const unmatchedPupils = P.map((p, i) => i).filter((i) => !pairedP.has(i)).map((i) => ({ pupilIndex: i, reason: !hasParentConsent(P[i]) ? 'NO_PARENT_CONSENT' : 'NO_FEASIBLE_PAIR' }));
  const unmatchedStudents = S.map((s, i) => i).filter((i) => (countS.get(i) || 0) < capacityOf(S[i], o)).map((i) => ({ studentIndex: i, reason: 'NO_FEASIBLE_PAIR' }));
  return { pairs, unmatchedPupils, unmatchedStudents, totalScore: pairs.reduce((a, x) => a + x.score, 0), weights: w };
}

// Partial re-match: pairs of participants not released are kept (if still valid); the rest are re-optimised.
function rematchPartial(students, pupils, existingPairs, opts) {
  const o = opts || {}; const relS = new Set(o.releaseStudentIndexes || []); const relP = new Set(o.releasePupilIndexes || []);
  const keep = (Array.isArray(existingPairs) ? existingPairs : []).filter((x) => x && !relS.has(x.studentIndex) && !relP.has(x.pupilIndex) && students[x.studentIndex] && pupils[x.pupilIndex] && isCandidate(students[x.studentIndex], pupils[x.pupilIndex], o, x.studentIndex, x.pupilIndex));
  const locked = keep.map((x) => ({ studentIndex: x.studentIndex, pupilIndex: x.pupilIndex })).concat(Array.isArray(o.locked) ? o.locked : []);
  return match2(students, pupils, Object.assign({}, o, { locked }));
}

module.exports = { match2, rematchPartial, scorePair, explainHe, DEFAULT_WEIGHTS };
