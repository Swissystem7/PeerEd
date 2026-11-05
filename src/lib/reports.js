'use strict';
// PeerEd - coordinator reports (stage 4): weekly / monthly / semester, SVG bars, CSV / ICS / print.
// Internal identifiers only (pairIndex, region/subject codes). Every date/stamp is caller-passed.

const { addDays, parseDate } = require('./semester.js');
const { stalePairs } = require('./attendance.js');

const CODE = /^[A-Z0-9_]+$/;
function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
function inRange(date, from, to) { return date >= from && date <= to; }

function buildReport(data, from, to, kind) {
  const d = data || {}; parseDate(from); parseDate(to);
  const sessions = (Array.isArray(d.sessions) ? d.sessions : []).filter((s) => s && s.date && inRange(s.date, from, to));
  const entries = (d.attendance && Array.isArray(d.attendance.entries) ? d.attendance.entries : []).filter((e) => inRange(e.date, from, to));
  const byStatus = { held: 0, missed: 0, postponed: 0, cancelled: 0 };
  entries.forEach((e) => { if (byStatus[e.status] !== undefined) byStatus[e.status] += 1; });
  const bySubject = {}; const byRegion = {};
  sessions.forEach((s) => {
    if (typeof s.subject === 'string' && CODE.test(s.subject)) bySubject[s.subject] = (bySubject[s.subject] || 0) + 1;
    if (typeof s.region === 'string' && CODE.test(s.region)) byRegion[s.region] = (byRegion[s.region] || 0) + 1;
  });
  const decided = byStatus.held + byStatus.missed;
  const pairs = Array.isArray(d.pairs) ? d.pairs : sessions.map((s, i) => ({ pairIndex: Number.isInteger(s.pairIndex) ? s.pairIndex : i }));
  return Object.freeze({
    kind, from, to, scheduled: sessions.length,
    byStatus: Object.freeze(byStatus), bySubject: Object.freeze(bySubject), byRegion: Object.freeze(byRegion),
    heldRate: decided === 0 ? null : Math.round((byStatus.held / decided) * 1000) / 1000,
    stale: Object.freeze(d.attendance ? stalePairs(pairs, d.attendance, to, { since: from }) : [])
  });
}
function weeklyReport(data, weekStartISO) { parseDate(weekStartISO); return buildReport(data, weekStartISO, addDays(weekStartISO, 6), 'weekly'); }
function monthlyReport(data, month) {
  const m = typeof month === 'string' && /^(\d{4})-(\d{2})$/.exec(month);
  if (!m) throw new Error('invalid month: expected YYYY-MM');
  const from = month + '-01'; parseDate(from);
  const next = Number(m[2]) === 12 ? (Number(m[1]) + 1) + '-01-01' : m[1] + '-' + String(Number(m[2]) + 1).padStart(2, '0') + '-01';
  return buildReport(data, from, addDays(next, -1), 'monthly');
}
function semesterReport(data, semester) {
  if (!semester || !semester.startDate || !semester.endDate) throw new Error('invalid semester');
  return buildReport(data, semester.startDate, semester.endDate, 'semester');
}

function reportToCsv(report) {
  const lines = ['measure,code,count'];
  lines.push('scheduled,,' + report.scheduled);
  ['held', 'missed', 'postponed', 'cancelled'].forEach((s) => lines.push('status_' + s + ',,' + report.byStatus[s]));
  Object.keys(report.bySubject).sort().forEach((k) => lines.push('subject,' + k + ',' + report.bySubject[k]));
  Object.keys(report.byRegion).sort().forEach((k) => lines.push('region,' + k + ',' + report.byRegion[k]));
  lines.push('stale_pairs,,' + report.stale.length);
  return lines.join('\n') + '\n';
}
function icsEscape(s) { return String(s).replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n'); }
// Dated sessions -> iCalendar text. dtstampISO is caller-passed (YYYYMMDDTHHMMSSZ or YYYY-MM-DD).
function reportToIcs(sessions, opts) {
  const stamp = String((opts && opts.dtstamp) || '20260101T000000Z').replace(/[^0-9TZ]/gi, '');
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//PeerEd//Coordinator//EN'];
  (Array.isArray(sessions) ? sessions : []).forEach((s) => {
    if (!s || !s.date) return;
    const m = /^([A-Z]{3})_(\d{1,2})$/.exec(s.slot || 'SUN_8'); const hour = m ? Number(m[2]) : 8;
    const ymd = s.date.replace(/-/g, ''); const hh = String(hour).padStart(2, '0');
    lines.push('BEGIN:VEVENT', 'UID:peered-' + s.pairIndex + '-' + ymd + '-' + (s.slot || 'x') + '@peered', 'DTSTAMP:' + stamp,
      'DTSTART:' + ymd + 'T' + hh + '0000', 'DTEND:' + ymd + 'T' + String(hour + Math.max(1, Math.round((s.durationMinutes || 60) / 60))).padStart(2, '0') + '0000',
      'SUMMARY:' + icsEscape('PeerEd pair ' + s.pairIndex + ' ' + (s.subject || '')), 'END:VEVENT');
  });
  lines.push('END:VCALENDAR');
  return lines.join('\r\n') + '\r\n';
}
function svgBarChart(data, opts) {
  const rows = (Array.isArray(data) ? data : []).filter((r) => r && CODE.test(String(r.code)));
  const w = 320; const rowH = 22; const h = Math.max(40, rows.length * rowH + 28); const max = Math.max(1, ...rows.map((r) => Number(r.count) || 0));
  let out = '<svg xmlns="http://www.w3.org/2000/svg" width="' + w + '" height="' + h + '" role="img" aria-label="' + esc((opts && opts.title) || 'chart') + '">';
  rows.forEach((r, i) => {
    const y = 18 + i * rowH; const bw = Math.round(((Number(r.count) || 0) / max) * 180);
    out += '<text x="4" y="' + (y + 4) + '" font-size="11">' + esc(r.code) + '</text><rect x="100" y="' + (y - 8) + '" width="' + bw + '" height="12" fill="#2563eb"></rect><text x="' + (106 + bw) + '" y="' + (y + 4) + '" font-size="11">' + (Number(r.count) || 0) + '</text>';
  });
  return out + '</svg>';
}
// Printable fragment: the coordinator prints it to PDF from the browser. No scripts, no external assets.
function printableHtml(report) {
  const bars = svgBarChart(Object.keys(report.bySubject).sort().map((k) => ({ code: k, count: report.bySubject[k] })), { title: 'subjects' });
  const rows = Object.keys(report.byStatus).map((k) => '<tr><th scope="row">' + esc(k) + '</th><td>' + report.byStatus[k] + '</td></tr>').join('');
  return '<section dir="rtl" lang="he"><h2>דוח רכז ' + esc(report.kind) + ' ' + esc(report.from) + ' – ' + esc(report.to) + '</h2>' +
    '<p>מפגשים מתוכננים: ' + report.scheduled + ' | שיעור קיום: ' + (report.heldRate === null ? '—' : Math.round(report.heldRate * 100) + '%') + '</p>' +
    '<table><caption>לפי סטטוס</caption>' + rows + '</table>' + bars + '<p>זוגות שלא נפגשו שבועיים: ' + report.stale.length + '</p></section>';
}

module.exports = { buildReport, weeklyReport, monthlyReport, semesterReport, reportToCsv, reportToIcs, svgBarChart, printableHtml };
