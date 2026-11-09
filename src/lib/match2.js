'use strict';
// PeerEd - multi-criteria matching (stage 1). Global optimum, never greedy: the assignment maximises
// pair count first and total score second, via deterministic min-cost max-flow. No clock/random/network.
// Extended profile fields (level, languages, preferredSubjects) are read here only; makeProfile's
// privacy gate is untouched and a pupil still needs parentConsent === true to be paired at all.

const { shared, hasParentConsent } = require('./match.js');
const { isRegion } = require('./regions.js');
const { SUBJECTS, normalizeSlot } = require('./profile.js');
const LANG_CODES = Object.freeze(['HE', 'AR', 'RU', 'EN']); // closed list: raw caller strings never reach output
const AI_TOPIC_KEY_RE = /^[A-Z0-9_]+$/;
const AI_TOPIC_WEIGHT = 20;
const AI_TOPIC_LABELS = Object.freeze({
  AI_LIT_PROMPT: Object.freeze({ he: 'אוריינות בינה מלאכותית והנחיה', ar: 'معرفة الذكاء الاصطناعي والتوجيه', ru: 'ИИ-грамотность и промпты' }),
  AI_CREATIVE: Object.freeze({ he: 'יצירתיות ובינה יוצרת', ar: 'الإبداع والذكاء التوليدي', ru: 'Креативность и генеративный ИИ' }),
  AI_STEM_CODE: Object.freeze({ he: 'מדעים, טכנולוגיה ותכנות', ar: 'العلوم والتكنولوجيا والبرمجة', ru: 'Наука, технологии и программирование' }),
  AI_ETHICS_SEC: Object.freeze({ he: 'אתיקה, פרטיות ובטיחות', ar: 'الأخلاق والخصوصية والأمان', ru: 'Этика, конфиденциальность и безопасность' }),
});

const DEFAULT_WEIGHTS = Object.freeze({ region: 25, hours: 20, subject: 20, level: 15, language: 10, preference: 10, aiTopics: AI_TOPIC_WEIGHT });
const PAIR_BONUS = 1000; // > max score of one pair (100), so one more pair always beats a better score

function cleanTopics(x) {
  return Array.isArray(x) ? x.filter((v) => typeof v === 'string' && AI_TOPIC_KEY_RE.test(v)) : [];
}

function aiTopicOverlap(studentTopics, pupilTopics) {
  const s = cleanTopics(studentTopics);
  const p = cleanTopics(pupilTopics);
  if (s.length === 0 || p.length === 0) return 0;
  let matched = 0;
  for (const t of p) {
    if (s.includes(t)) matched += 1;
  }
  return matched / p.length;
}

function weightsOf(opts) {
  const w = Object.assign({}, DEFAULT_WEIGHTS, (opts && opts.weights) || {});
  for (const k of Object.keys(DEFAULT_WEIGHTS)) if (!(Number(w[k]) >= 0)) w[k] = DEFAULT_WEIGHTS[k];
  return w;
}
function normLevel(x) { const n = x && x.level; return Number.isInteger(n) && n >= 1 && n <= 5 ? n : null; }
function langs(x) { return Array.isArray(x && x.languages) ? x.languages.filter((v) => LANG_CODES.indexOf(v) !== -1) : []; }
function prefs(x) { return Array.isArray(x && x.preferredSubjects) ? x.preferredSubjects.filter((v) => SUBJECTS.indexOf(v) !== -1) : []; }
function capacityOf(s, opts) {
  // absent means 1; an explicit 0 means this student takes nobody (it never silently becomes 1)
  if (s && s.maxPupils !== undefined) { const c = Number(s.maxPupils); if (!Number.isInteger(c) || c < 0) throw new Error('invalid maxPupils'); return c; }
  if (opts && opts.studentCapacity !== undefined) { const c = Number(opts.studentCapacity); if (!Number.isInteger(c) || c < 0) throw new Error('invalid studentCapacity'); return c; }
  return 1;
}

function scorePair(student, pupil, weights) {
  const w = weightsOf({ weights: weights });
  const s = student || {}; const p = pupil || {};
  // only canonical codes are ever scored or printed: slots, subjects, languages, region
  const sharedSlots = shared(s.availability, p.availability).filter((x) => normalizeSlot(x) === x);
  const sharedSubjects = shared(s.subjects, p.subjects).filter((x) => SUBJECTS.indexOf(x) !== -1);
  const sharedLanguages = shared(langs(s), langs(p));
  const regionSame = isRegion(s.region) && s.region === p.region;
  const sl = normLevel(s); const pl = normLevel(p);
  const levelIn = sl !== null && pl !== null;
  const langIn = langs(s).length > 0 && langs(p).length > 0;
  const sTopics = cleanTopics(s?.target_ai_topics);
  const pTopics = cleanTopics(p?.target_ai_topics);
  const aiIn = sTopics.length > 0 && pTopics.length > 0;
  const overlap = aiIn ? aiTopicOverlap(sTopics, pTopics) : 0;
  const levelFit = levelIn ? 1 - Math.abs(sl - pl) / 4 : 0;
  const langFit = langIn && sharedLanguages.length > 0 ? 1 : 0;
  const prefHits = shared(prefs(s), (p.subjects || []).filter((x) => SUBJECTS.indexOf(x) !== -1)).length +
    shared(prefs(p), (s.subjects || []).filter((x) => SUBJECTS.indexOf(x) !== -1)).length;
  const prefFit = Math.min(1, prefHits / 2);
  const b = {
    region: Math.round(w.region * (regionSame ? 1 : 0)),
    hours: Math.round(w.hours * Math.min(1, sharedSlots.length / 3)),
    subject: Math.round(w.subject * Math.min(1, sharedSubjects.length / 2)),
    level: levelIn ? Math.round(w.level * levelFit) : 0,
    language: langIn ? Math.round(w.language * langFit) : 0,
    preference: Math.round(w.preference * prefFit),
    aiTopics: aiIn ? Math.round(w.aiTopics * overlap) : 0
  };
  // criteria with no data on either side are excluded, not credited: the total is renormalised to 100
  let included = w.region + w.hours + w.subject + w.preference;
  if (levelIn) included += w.level;
  if (langIn) included += w.language;
  if (aiIn) included += w.aiTopics;
  const earned = b.region + b.hours + b.subject + b.level + b.language + b.preference + b.aiTopics;
  b.total = included > 0 ? Math.round((earned / included) * 100) : 0;
  b.levelCounted = levelIn; b.languageCounted = langIn; b.aiTopicsCounted = aiIn;
  const sharedAiTopics = aiIn
    ? cleanTopics(pTopics).filter((t) => sTopics.includes(t))
    : [];
  const aiExplanation = explainAiTopics({
    counted: aiIn,
    sharedCount: sharedAiTopics.length,
    points: b.aiTopics,
    topics: sharedAiTopics,
  });
  return {
    score: b.total,
    breakdown: b,
    sharedSlots,
    sharedSubjects,
    sharedLanguages,
    sharedAiTopics,
    aiExplanation,
    regionSame,
    levelFit,
  };
}


function topicLabel(key, lang) {
  const row = AI_TOPIC_LABELS[key];
  if (!row) return key;
  return row[lang] || row.he || key;
}

function explainAiTopics({ counted, sharedCount, points, topics }) {
  const namesHe = (topics || []).map((t) => topicLabel(t, 'he')).join(', ');
  const namesAr = (topics || []).map((t) => topicLabel(t, 'ar')).join(', ');
  const namesRu = (topics || []).map((t) => topicLabel(t, 'ru')).join(', ');
  if (!counted) {
    return Object.freeze({
      he: '',
      ar: '',
      ru: '',
      sharedCount: 0,
      points: 0,
    });
  }
  if (!sharedCount) {
    return Object.freeze({
      he: 'נושאי בינה מלאכותית: אין חפיפה (0 נק׳)',
      ar: 'موضوعات الذكاء الاصطناعي: لا تداخل (0 نقطة)',
      ru: 'Темы ИИ: нет пересечения (0 баллов)',
      sharedCount: 0,
      points: 0,
    });
  }
  return Object.freeze({
    he: 'נושאי בינה מלאכותית משותפים: ' + sharedCount + ' (' + namesHe + ') — ' + points + ' נק׳',
    ar: 'موضوعات ذكاء اصطناعي مشتركة: ' + sharedCount + ' (' + namesAr + ') — ' + points + ' نقطة',
    ru: 'Общие темы ИИ: ' + sharedCount + ' (' + namesRu + ') — ' + points + ' баллов',
    sharedCount,
    points,
  });
}

function explainHe(scored, student, pupil) {
  const b = scored.breakdown; const parts = [];
  parts.push(scored.regionSame ? '\u05d0\u05d5\u05ea\u05d5 \u05d0\u05d6\u05d5\u05e8 (' + pupil.region + ')' : '\u05d0\u05d6\u05d5\u05e8\u05d9\u05dd \u05e9\u05d5\u05e0\u05d9\u05dd');
  parts.push(scored.sharedSlots.length + ' \u05e9\u05e2\u05d5\u05ea \u05de\u05e9\u05d5\u05ea\u05e4\u05d5\u05ea (' + scored.sharedSlots.join(', ') + ')');
  parts.push('\u05de\u05e7\u05e6\u05d5\u05e2\u05d5\u05ea \u05de\u05e9\u05d5\u05ea\u05e4\u05d9\u05dd: ' + scored.sharedSubjects.join(', '));
  if (normLevel(student) !== null && normLevel(pupil) !== null) parts.push('\u05d4\u05ea\u05d0\u05de\u05ea \u05e8\u05de\u05d4 ' + student.level + ' \u05de\u05d5\u05dc ' + pupil.level);
  if (scored.sharedLanguages.length) parts.push('\u05e9\u05e4\u05d4 \u05de\u05e9\u05d5\u05ea\u05e4\u05ea: ' + scored.sharedLanguages.join(', '));
  if (scored.aiExplanation && scored.aiExplanation.he) parts.push(scored.aiExplanation.he);
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
  // stale kept pairs (duplicate pupil, capacity since lowered) are dropped, never thrown on
  const seenP = new Set(); const countS = new Map();
  const keep = (Array.isArray(existingPairs) ? existingPairs : []).filter((x) => {
    if (!x || relS.has(x.studentIndex) || relP.has(x.pupilIndex) || !students[x.studentIndex] || !pupils[x.pupilIndex]) return false;
    if (seenP.has(x.pupilIndex) || !isCandidate(students[x.studentIndex], pupils[x.pupilIndex], o, x.studentIndex, x.pupilIndex)) return false;
    if ((countS.get(x.studentIndex) || 0) >= capacityOf(students[x.studentIndex], o)) return false;
    seenP.add(x.pupilIndex); countS.set(x.studentIndex, (countS.get(x.studentIndex) || 0) + 1); return true;
  });
  const locked = keep.map((x) => ({ studentIndex: x.studentIndex, pupilIndex: x.pupilIndex })).concat(Array.isArray(o.locked) ? o.locked : []);
  return match2(students, pupils, Object.assign({}, o, { locked }));
}

module.exports = { match2, rematchPartial, scorePair, explainHe, explainAiTopics, DEFAULT_WEIGHTS, AI_TOPIC_WEIGHT, aiTopicOverlap, AI_TOPIC_LABELS };
