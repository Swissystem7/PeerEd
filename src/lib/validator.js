'use strict';
// PeerEd - the gate for FREE TEXT (enrichment units, messages). The structured-field gate is
// src/lib/profile.js; this one refuses text that carries personal data before it is stored.
// CommonJS on purpose. No clock, no randomness, no network, no dependencies.

var PATTERNS = Object.freeze({
  // name@host.tld - deliberately narrow, we only need to detect, not to validate deliverability
  email: /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g,
  // Israeli mobile and landline: 050-1234567, 0501234567, 03-1234567, +972-50-1234567, +972501234567
  phone: /(?:\+972[-\s]?|0)(?:5\d|7[2-9]|[23489])[-\s]?\d{3}[-\s]?\d{4}/g,
  // exactly nine digits, not part of a longer run (an Israeli id number)
  id_number: /(?<!\d)\d{9}(?!\d)/g,
  url: /(?:https?:\/\/|www\.)[^\s<>"']+/g,
  handle: /@\w{3,}/g
});

var PERSONAL_DATA_ERROR = 'personal data is not accepted';
var DEFAULT_MAX_LENGTH = 4000;
var DEFAULT_MIN_LENGTH = 1;
// every C0 control character except \t (09) and \n (0a), plus DEL
var CONTROL_RE = /[\x00-\x08\x0b-\x1f\x7f]/g;

function contains(outer, inner) {
  return inner.index >= outer.index &&
    (inner.index + inner.match.length) <= (outer.index + outer.match.length);
}

// Every hit of every pattern, ordered by index then kind. A hit fully inside a longer hit is dropped,
// so a nine-digit run inside a phone number is reported once as phone, and the "@host" of an email is
// never also reported as a social handle.
function findPersonalData(text) {
  if (typeof text !== 'string' || text === '') return [];
  var raw = [];
  Object.keys(PATTERNS).forEach(function (kind) {
    var re = new RegExp(PATTERNS[kind].source, 'g');
    var m;
    while ((m = re.exec(text)) !== null) {
      if (m[0] === '') { re.lastIndex += 1; continue; }
      raw.push({ kind: kind, match: m[0], index: m.index });
    }
  });
  // earliest first, longest first on a tie: the container is seen before anything it swallows
  raw.sort(function (a, b) {
    return (a.index - b.index) || (b.match.length - a.match.length) ||
      (a.kind < b.kind ? -1 : (a.kind > b.kind ? 1 : 0));
  });
  var kept = [];
  raw.forEach(function (hit) {
    var swallowed = kept.some(function (k) {
      var sameSpan = k.index === hit.index && k.match.length === hit.match.length;
      return !sameSpan && contains(k, hit);
    });
    if (!swallowed) kept.push(hit);
  });
  kept.sort(function (a, b) {
    return (a.index - b.index) || (a.kind < b.kind ? -1 : (a.kind > b.kind ? 1 : 0));
  });
  return kept;
}

function cleanText(text) {
  var s = String(text == null ? '' : text);
  s = s.replace(CONTROL_RE, '');
  s = s.replace(/[^\S\n]+/g, ' ');   // collapse horizontal whitespace, keep newlines
  s = s.replace(/ *\n */g, '\n');    // no padding around a newline
  return s.trim();
}

function assertCleanText(text, opts) {
  opts = opts || {};
  var maxLength = typeof opts.maxLength === 'number' ? opts.maxLength : DEFAULT_MAX_LENGTH;
  var minLength = typeof opts.minLength === 'number' ? opts.minLength : DEFAULT_MIN_LENGTH;
  var cleaned = cleanText(text);
  if (findPersonalData(cleaned).length > 0) throw new Error(PERSONAL_DATA_ERROR);
  if (cleaned.length > maxLength) throw new Error('text too long');
  if (cleaned.length < minLength) throw new Error('text too short');
  return cleaned;
}

module.exports = {
  PATTERNS: PATTERNS,
  PERSONAL_DATA_ERROR: PERSONAL_DATA_ERROR,
  findPersonalData: findPersonalData,
  cleanText: cleanText,
  assertCleanText: assertCleanText
};
