'use strict';
// PeerEd - capacity vs demand (stage 2). Counts only: codes and numbers, never personal data.
// Deterministic, no clock/randomness/network.

const { SUBJECTS } = require('./profile.js');
const { REGIONS } = require('./regions.js');
const { hasParentConsent } = require('./match.js');

function capOf(s, o) { const c = s && s.maxPupils !== undefined ? Number(s.maxPupils) : Number(o && o.studentCapacity); return Number.isInteger(c) && c > 0 ? c : 1; }

function analyzeCapacity(students, pupils, opts) {
  const o = opts || {};
  const S = Array.isArray(students) ? students : []; const P = Array.isArray(pupils) ? pupils : [];
  const eligible = P.filter(hasParentConsent);
  return finish(S, eligible, o);
}

function finish(S, eligible, o) {
  function make(keys) { const out = {}; keys.forEach((k) => { out[k] = { demand: 0, supply: 0, gap: 0, neededStudents: 0 }; }); return out; }
  const bySubject = make(SUBJECTS); const byRegion = make(REGIONS);
  eligible.forEach((p) => { (p.subjects || []).forEach((k) => { if (bySubject[k]) bySubject[k].demand += 1; }); if (byRegion[p.region]) byRegion[p.region].demand += 1; });
  const studentLoad = S.map((s, studentIndex) => ({ studentIndex, capacity: capOf(s, o), region: s.region || null, subjects: (s.subjects || []).slice() }));
  S.forEach((s) => { (s.subjects || []).forEach((k) => { if (bySubject[k]) bySubject[k].supply += capOf(s, o); }); if (byRegion[s.region]) byRegion[s.region].supply += capOf(s, o); });
  const alerts = [];
  [bySubject, byRegion].forEach((table, ti) => {
    Object.keys(table).forEach((k) => {
      const b = table[k]; b.gap = Math.max(0, b.demand - b.supply); b.neededStudents = b.gap;
      if (b.gap > 0) alerts.push({ code: 'DEMAND_GT_SUPPLY', kind: ti === 0 ? 'subject' : 'region', codeKey: k, demand: b.demand, supply: b.supply, gap: b.gap, neededStudents: b.gap, neededStudentsNoteHe: ti === 0 ? 'צריך עוד ' + b.gap + ' מקומות חונכות במקצוע ' + k : 'צריך עוד ' + b.gap + ' מקומות חונכות באזור ' + k });
    });
  });
  alerts.sort((a, b) => (a.kind < b.kind ? -1 : a.kind > b.kind ? 1 : (a.codeKey < b.codeKey ? -1 : 1)));
  return Object.freeze({ bySubject, byRegion, studentLoad: Object.freeze(studentLoad), alerts: Object.freeze(alerts), totals: Object.freeze({ students: S.length, pupils: eligible.length, supplyPlaces: S.reduce((a, s) => a + capOf(s, o), 0), demandPupils: eligible.length }) });
}

module.exports = { analyzeCapacity };
