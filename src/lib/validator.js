'use strict';
// PeerEd - the gate for FREE TEXT (enrichment units, messages). The structured-field gate is
// src/lib/profile.js; this one refuses text that carries personal data or offensive language before
// it is stored - the same gate, because both are reasons a school may not pass the text on.
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

// Offensive language. Data, not a pattern: these are literal words, so the list grows without the
// matcher changing. Hebrew forms are spelled out (feminine, plural) instead of guessed with a suffix
// rule - a wrong suffix rule flags ordinary lesson words, and a quiet false positive is worse here
// than a missed word. Lower case; the matcher is case insensitive.
var PROFANITY = Object.freeze([
  // Hebrew
  'מניאק', 'מניאקית', 'מניאקים',
  'חרא',
  'שרמוטה', 'שרמוטות',
  'זונה', 'זונות',
  'מטומטם', 'מטומטמת', 'מטומטמים',
  'מפגר', 'מפגרת', 'מפגרים',
  'דביל', 'דבילה', 'דבילים',
  'אידיוט', 'אידיוטית', 'אידיוטים',
  'טמבל', 'טמבלים',
  'אהבל',
  'חלאה',
  'תזדיין', 'תזדייני', 'הזדיין', 'מזדיין',
  'כוסאמק', 'כוסאימק', 'כוסאמאק',
  'פאק', 'פאקינג',
  // English
  'fuck', 'fucks', 'fucked', 'fucking', 'fucker', 'fuckers', 'motherfucker',
  'shit', 'shits', 'shitty', 'bullshit',
  'bitch', 'bitches',
  'bastard', 'bastards',
  'asshole', 'assholes',
  'cunt', 'dickhead', 'slut', 'whore',
  'retard', 'retarded', 'faggot', 'nigger', 'nigga'
]);

// A Hebrew or a Latin letter. \b is unusable here: JS word boundaries only know [A-Za-z0-9_], so to
// them every Hebrew letter is a boundary, and "אחראי" would hand us the "חרא" sitting inside it.
var LETTER = '[A-Za-z\\u05d0-\\u05ea]';
// ו ה ש ל ב כ מ glue onto the next word in Hebrew ("והמניאק"), so up to two of them may lead a hit.
// The quantifier backtracks, so a word that itself starts with one of them still matches.
var HEBREW_PREFIX = '[\\u05d5\\u05d4\\u05e9\\u05dc\\u05d1\\u05db\\u05de]{0,2}';

// Ordinary words that the prefix rule above turns into a hit: "מזונות" is "מ" + "זונות" to the matcher
// and alimony to a reader. Matched against the whole hit, its own prefix included, so "המזונות" is
// cleared too while a bare "זונות" is still refused.
var NOT_PROFANITY = Object.freeze(['מזונות']);
// not global, so it has no lastIndex to carry between calls
var NOT_PROFANITY_RE = new RegExp('^' + HEBREW_PREFIX + '(?:' + NOT_PROFANITY.join('|') + ')$', 'i');

var PERSONAL_DATA_ERROR = 'personal data is not accepted';
var PROFANITY_ERROR = 'offensive language is not accepted';
var DEFAULT_MAX_LENGTH = 4000;
var DEFAULT_MIN_LENGTH = 1;
// every C0 control character except \t (09) and \n (0a), plus DEL
var CONTROL_RE = /[\x00-\x08\x0b-\x1f\x7f]/g;

// Longest alternative first, so "מטומטמת" is never reported as the shorter "מטומטם".
function profanityRegex() {
  var alts = PROFANITY.slice()
    .sort(function (a, b) { return b.length - a.length; })
    // a function replacer, not a replacement string: scripts/build-app.js inlines this file with
    // String.replace, so a dollar-ampersand group reference in here is expanded as the app is built
    .map(function (w) { return w.replace(/[.*+?^${}()|[\]\\]/g, function (c) { return '\\' + c; }); })
    .join('|');
  return new RegExp('(?<!' + LETTER + ')' + HEBREW_PREFIX + '(?:' + alts + ')(?!' + LETTER + ')', 'gi');
}

function findProfanity(text) {
  var re = profanityRegex();
  var hits = [];
  var m;
  while ((m = re.exec(text)) !== null) {
    if (NOT_PROFANITY_RE.test(m[0])) continue;
    hits.push({ kind: 'profanity', match: m[0], index: m.index });
  }
  return hits;
}

function contains(outer, inner) {
  return inner.index >= outer.index &&
    (inner.index + inner.match.length) <= (outer.index + outer.match.length);
}

// Every reason to refuse this text, ordered by index then kind: every hit of every pattern plus every
// offensive word, which carries kind 'profanity'. A hit fully inside a longer hit is dropped, so a
// nine-digit run inside a phone number is reported once as phone, the "@host" of an email is never
// also reported as a social handle, and a word inside a url is the url and nothing else.
function findPersonalData(text) {
  if (typeof text !== 'string' || text === '') return [];
  var raw = findProfanity(text);
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
  var hits = findPersonalData(cleaned);
  // Both refuse the text. Personal data is named first because exposing it cannot be taken back,
  // so when a message carries both, that is the reason the writer is told about.
  if (hits.some(function (h) { return h.kind !== 'profanity'; })) throw new Error(PERSONAL_DATA_ERROR);
  if (hits.length > 0) throw new Error(PROFANITY_ERROR);
  if (cleaned.length > maxLength) throw new Error('text too long');
  if (cleaned.length < minLength) throw new Error('text too short');
  return cleaned;
}

module.exports = {
  PATTERNS: PATTERNS,
  PROFANITY: PROFANITY,
  PERSONAL_DATA_ERROR: PERSONAL_DATA_ERROR,
  PROFANITY_ERROR: PROFANITY_ERROR,
  findPersonalData: findPersonalData,
  findProfanity: findProfanity,
  cleanText: cleanText,
  assertCleanText: assertCleanText
};
