'use strict';
// PeerEd - routine / emergency modes (stage 11). Pure data only: no names of children, no exact
// addresses, no network, no clock, no randomness. Routine groups children by school + grade;
// emergency groups children who are present at one gathering place, counted only, by age band.
// Switching mode never deletes anything: the same groups and people are carried over untouched.

const profile = require('./profile.js');
const regions = require('./regions.js');
const curriculum = require('./curriculum.js');
const validator = require('./validator.js');

const MODES = Object.freeze(['routine', 'emergency']);
const GROUP_MAX = 12;
const SHORT_MIN = 20;
const SHORT_MAX = 30;
const AGE_BANDS = Object.freeze(['3-6', '7-9', 'mixed']);
const AGE_BAND_TRACK = Object.freeze({ '3-6': 'elementary', '7-9': 'middle', mixed: 'elementary' });

// Simple availability chips instead of the hour grid: three parts of the day, mapped onto the
// very slots profile.js accepts, so a chip choice is always a valid profile availability.
const PERIODS = Object.freeze({
  morning: Object.freeze({ labelHe: 'בוקר', hours: Object.freeze([9, 10, 11]) }),
  noon: Object.freeze({ labelHe: 'צהריים', hours: Object.freeze([13, 14]) }),
  afternoon: Object.freeze({ labelHe: 'אחה״צ', hours: Object.freeze([16, 17, 18]) })
});
const PERIOD_NAMES = Object.freeze(Object.keys(PERIODS));

function assertMode(mode) {
  if (MODES.indexOf(mode) === -1) throw new Error('invalid mode: expected routine or emergency');
  return mode;
}
function assertDay(day) {
  if (profile.DAYS.indexOf(day) === -1) throw new Error('invalid day: expected a profile day code');
  return day;
}
function assertPeriod(period) {
  if (PERIOD_NAMES.indexOf(period) === -1) throw new Error('invalid period: expected morning, noon or afternoon');
  return period;
}
function slot(day, hour) { return day + '_' + hour; }

function periodSlots(day, period) {
  assertDay(day); assertPeriod(period);
  return Object.freeze(PERIODS[period].hours.map((h) => slot(day, h)));
}
function chipsToSlots(chips) {
  const list = Array.isArray(chips) ? chips : [];
  const seen = new Set(); const out = [];
  list.forEach((c) => {
    if (!c || typeof c !== 'object') throw new Error('invalid chip: expected day and period');
    periodSlots(c.day, c.period).forEach((s) => { if (!seen.has(s)) { seen.add(s); out.push(s); } });
  });
  out.sort((a, b) => {
    const pa = a.split('_'); const pb = b.split('_');
    const d = profile.DAYS.indexOf(pa[0]) - profile.DAYS.indexOf(pb[0]);
    return d !== 0 ? d : Number(pa[1]) - Number(pb[1]);
  });
  return Object.freeze(out);
}
function slotsToChips(slots) {
  const have = new Set(Array.isArray(slots) ? slots : []);
  const out = [];
  profile.DAYS.forEach((day) => {
    PERIOD_NAMES.forEach((period) => {
      if (PERIODS[period].hours.every((h) => have.has(slot(day, h)))) out.push(Object.freeze({ day, period }));
    });
  });
  return Object.freeze(out);
}
function toggleChip(slots, day, period) {
  const mine = periodSlots(day, period);
  const have = new Set(Array.isArray(slots) ? slots : []);
  const on = mine.every((s) => have.has(s));
  mine.forEach((s) => { if (on) have.delete(s); else have.add(s); });
  return chipsToSlots(slotsToChips(Array.from(have)));
}

const ROUTINE_FIELDS = Object.freeze(['mode', 'school', 'grade', 'count']);
const EMERGENCY_FIELDS = Object.freeze(['mode', 'location', 'region', 'ageBand', 'count']);

function assertCount(count) {
  if (!Number.isInteger(count) || count < 1 || count > 500) throw new Error('invalid count: expected an integer 1..500');
  return count;
}
function assertPlaceText(value, what) {
  if (typeof value !== 'string' || value.trim() === '' || value.trim().length > 60) {
    throw new Error('invalid ' + what + ': expected short text');
  }
  const text = value.trim();
  if (validator.findPersonalData(text).length > 0 || validator.findProfanity(text).length > 0) {
    throw new Error('personal data is not accepted');
  }
  return text;
}
// An aggregate is a count of children, never a child: only the fields of its mode are accepted,
// so a name, a phone or an exact address cannot enter through this door either.
function makeGroupAggregate(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('group input must be an object');
  const mode = assertMode(input.mode);
  const allowed = mode === 'routine' ? ROUTINE_FIELDS : EMERGENCY_FIELDS;
  Object.keys(input).forEach((k) => { if (allowed.indexOf(k) === -1) throw new Error('personal data is not accepted'); });
  const count = assertCount(input.count);
  if (mode === 'routine') {
    const school = assertPlaceText(input.school, 'school');
    if (!Number.isInteger(input.grade) || input.grade < 3 || input.grade > 9) {
      throw new Error('invalid grade: expected an integer 3..9');
    }
    return Object.freeze({ mode, school, grade: input.grade, count, key: school + '|' + input.grade, track: curriculum.trackForGrade(input.grade) });
  }
  const location = assertPlaceText(input.location, 'location');
  if (!regions.isRegion(input.region)) throw new Error('invalid region: expected one of the REGIONS codes');
  if (AGE_BANDS.indexOf(input.ageBand) === -1) throw new Error('invalid age band: expected 3-6, 7-9 or mixed');
  return Object.freeze({
    mode, location, region: input.region, ageBand: input.ageBand, count,
    key: location + '|' + input.ageBand, track: AGE_BAND_TRACK[input.ageBand]
  });
}

function asAggregate(a) { return a && typeof a.track === 'string' && typeof a.key === 'string' ? a : makeGroupAggregate(a); }
function formGroups(aggregates) {
  return chunkGroups((Array.isArray(aggregates) ? aggregates : []).map(asAggregate));
}
function chunkGroups(list) {
  const out = [];
  list.forEach((a) => {
    if (a.mode === 'routine') {
      out.push(Object.freeze({ key: a.key, mode: a.mode, size: a.count, track: a.track, part: 1, parts: 1 }));
      return;
    }
    const parts = Math.ceil(a.count / GROUP_MAX);
    for (let i = 0; i < parts; i += 1) {
      const size = i === parts - 1 ? a.count - GROUP_MAX * (parts - 1) : GROUP_MAX;
      out.push(Object.freeze({ key: a.key, mode: a.mode, size, track: a.track, part: i + 1, parts }));
    }
  });
  return Object.freeze(out);
}

// One nearby mentor per group: a student counts only in their own region ("nearby"), and an
// emergency group whose place has no free student stays visibly unmet, never silently covered.
function assignStudents(groups, supply) {
  const pool = new Map();
  (Array.isArray(supply) ? supply : []).forEach((s) => {
    if (!s || !regions.isRegion(s.region) || !Number.isInteger(s.available) || s.available < 0) {
      throw new Error('invalid supply: expected region and available count');
    }
    pool.set(s.region, (pool.get(s.region) || 0) + s.available);
  });
  const assignments = []; const unmet = [];
  (Array.isArray(groups) ? groups : []).forEach((g) => {
    const regionCode = g.regionCode || null;
    if (g.mode === 'emergency' && regionCode && (pool.get(regionCode) || 0) >= 1) {
      pool.set(regionCode, pool.get(regionCode) - 1);
      assignments.push(Object.freeze({ key: g.key, part: g.part, students: 1, region: regionCode }));
    } else if (g.mode === 'routine') {
      assignments.push(Object.freeze({ key: g.key, part: g.part, students: 0, region: null }));
    } else {
      unmet.push(Object.freeze({ key: g.key, part: g.part, missing: 1, region: regionCode }));
    }
  });
  return Object.freeze({ assignments: Object.freeze(assignments), unmet: Object.freeze(unmet) });
}

// Groups formed from aggregates keep their region, so the matcher above can stay nearby-only.
function formGroupsWithRegion(aggregates) {
  const list = (Array.isArray(aggregates) ? aggregates : []).map(asAggregate);
  const groups = chunkGroups(list);
  const regionByKey = new Map(list.map((a) => [a.key, a.mode === 'emergency' ? a.region : null]));
  return Object.freeze(groups.map((g) => Object.freeze(Object.assign({}, g, { regionCode: regionByKey.get(g.key) || null }))));
}

function shortLesson(lesson, minutes) {
  const mins = minutes === undefined ? 25 : minutes;
  if (!Number.isInteger(mins) || mins < SHORT_MIN || mins > SHORT_MAX) {
    throw new Error('invalid short lesson minutes: expected an integer 20..30');
  }
  if (!lesson || typeof lesson.id !== 'string') throw new Error('invalid lesson');
  return Object.freeze({
    lessonId: lesson.id, titleHe: lesson.titleHe, titleKey: lesson.titleKey, minutes: mins,
    activityHe: lesson.unpluggedHe, goalsHe: Object.freeze(lesson.goalsHe.slice(0, 2)),
    flowHe: Object.freeze([
      Object.freeze({ minutes: 5, stepHe: lesson.flowHe[0].stepHe }),
      Object.freeze({ minutes: mins - 10, stepHe: lesson.unpluggedHe }),
      Object.freeze({ minutes: 5, stepHe: lesson.wrapUpHe[0] })
    ])
  });
}
function lessonForGroup(group, index) {
  if (!group || curriculum.TRACKS.indexOf(group.track) === -1) throw new Error('invalid group: missing track');
  const list = curriculum.lessonsForTrack(group.track);
  if (!Number.isInteger(index) || index < 0) throw new Error('invalid lesson index for group');
  const lesson = list[index % list.length];
  return group.mode === 'emergency' ? shortLesson(lesson) : lesson;
}

// Switching mode is a view change, not a data change: people and groups pass through untouched.
function switchMode(state, mode) {
  assertMode(mode);
  if (!state || typeof state !== 'object') throw new Error('invalid mode state');
  return Object.freeze(Object.assign({}, state, { mode }));
}
function emptyModeState() { return Object.freeze({ mode: 'routine', groups: Object.freeze([]) }); }

function groupReport(groups, assignment) {
  const assigned = new Map();
  (assignment && Array.isArray(assignment.assignments) ? assignment.assignments : [])
    .forEach((a) => assigned.set(a.key + '|' + a.part, a.students));
  const byKey = new Map();
  (Array.isArray(groups) ? groups : []).forEach((g) => {
    if (!byKey.has(g.key)) byKey.set(g.key, { key: g.key, mode: g.mode, children: 0, groups: 0, students: 0 });
    const row = byKey.get(g.key);
    row.children += g.size; row.groups += 1; row.students += assigned.get(g.key + '|' + g.part) || 0;
  });
  const rows = Array.from(byKey.values()).sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0))
    .map((r) => Object.freeze(Object.assign({}, r, { unmetGroups: r.groups - Math.min(r.students, r.groups) })));
  return Object.freeze(rows);
}
function groupReportCsv(report) {
  const lines = ['mode,key,children,groups,students,unmet_groups'];
  (Array.isArray(report) ? report : []).forEach((r) => {
    lines.push([r.mode, '"' + String(r.key).replace(/"/g, '""') + '"', r.children, r.groups, r.students, r.unmetGroups].join(','));
  });
  return lines.join('\n') + '\n';
}

module.exports = {
  PERIODS, PERIOD_NAMES,
  periodSlots, chipsToSlots, slotsToChips, toggleChip,
  makeGroupAggregate, formGroups, formGroupsWithRegion, assignStudents,
  shortLesson, lessonForGroup, switchMode, emptyModeState, groupReport, groupReportCsv
};
