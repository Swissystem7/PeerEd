'use strict';
// PeerEd - the gate for FREE TEXT (enrichment units, messages). The structured-field gate is
// src/lib/profile.js; this one refuses text that carries personal data or offensive language before
// it is stored - the same gate, because both are reasons a school may not pass the text on.
// CommonJS on purpose. No clock, no randomness, no network, no dependencies.

var PATTERNS = Object.freeze({
  // name@host.tld - deliberately narrow, we only need to detect, not to validate deliverability.
  // Also the address spelled out to get past a filter: dana at gmail dot com, dana [at] gmail [dot] com,
  // dana (at) walla.co.il. It has to end on a common top-level domain, so ordinary English with at and
  // dot in it (meet at noon, a dot on the map) is not an address.
  email: /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}|[A-Za-z0-9._%+-]+\s*(?:@|\[\s*[Aa][Tt]\s*\]|\(\s*[Aa][Tt]\s*\)|\b[Aa][Tt]\b)\s*[A-Za-z0-9-]+(?:\s*(?:\.|\[\s*[Dd][Oo][Tt]\s*\]|\(\s*[Dd][Oo][Tt]\s*\)|\b[Dd][Oo][Tt]\b)\s*[A-Za-z0-9-]+)*\s*(?:\.|\[\s*[Dd][Oo][Tt]\s*\]|\(\s*[Dd][Oo][Tt]\s*\)|\b[Dd][Oo][Tt]\b)\s*(?:com|net|org|il|co|io|me)(?![A-Za-z0-9-])/g,
  // Israeli mobile and landline, in the ways people write them: 050-1234567, 0501234567, 03-1234567,
  // 050-123-45-67, 050.123.4567, (050) 1234567, 054 12 34 567, +972-50-1234567, +972 (50) 123-4567,
  // 972501234567. The seven subscriber digits may be split 3-4, 3-2-2 or 2-2-3, never digit by digit,
  // so a list such as "0 2 4 6 8 10 12" stays a list. A date (03.12.2024) has too few digits to fit.
  phone: /(?:(?:\+|00)?972[-\s.]?\(?0?|\(?0)(?:5\d|7[2-9]|[23489])\)?[-\s.–—]?(?:\d{3}[-\s.–—]?\d{4}|\d{3}[-\s.–—]?\d{2}[-\s.–—]?\d{2}|\d{2}[-\s.–—]?\d{2}[-\s.–—]?\d{3})/g,
  // an Israeli id number: nine digits not part of a longer run, also as written on forms with the check
  // digit apart (12345678-9) or in threes (123-456-789)
  id_number: /(?<!\d)(?:\d{9}|\d{8}[-–]\d|\d{3}-\d{3}-\d{3})(?!\d)/g,
  // a link with a scheme or www, or a bare domain on a common top-level domain: wa.me/972..., t.me/name,
  // instagram.com/name, gov.il. Not after a letter, a dot or an @, so the host of an email is the email.
  url: /(?:https?:\/\/|www\.)[^\s<>"']+|(?<![A-Za-z0-9.@_-])(?:[A-Za-z0-9-]+\.)+(?:com|net|org|il|me|io|gg|ly|ee|co|app|tv|info)(?![A-Za-z0-9-])(?:\/[^\s<>"']*)?/g,
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
var USER_ID_PREFIX = 'p-';
var USER_ID_RE = /^p-[0-9a-f]{8}$/;

function isUserId(id) {
  return typeof id === 'string' && USER_ID_RE.test(id);
}

// Opaque peer ids only: the same personal-data gate as free text, plus a fixed shape so a name or a
// phone cannot be stored as a "user id" when a parent blocks someone.
function assertUserId(id) {
  if (!isUserId(id)) throw new Error('invalid user id: expected p- followed by 8 hex digits');
  if (findPersonalData(id).length > 0) throw new Error(PERSONAL_DATA_ERROR);
  return id;
}
var DEFAULT_MAX_LENGTH = 4000;
var DEFAULT_MIN_LENGTH = 1;
// every C0 control character except \t (09) and \n (0a), plus DEL
var CONTROL_RE = /[\x00-\x08\x0b-\x1f\x7f]/g;
// Characters that take no space on the screen: soft hyphen, zero-width space/joiners, the bidi marks a
// Hebrew keyboard or WhatsApp drops into text (RLM, LRM, embeddings, isolates), word joiner, BOM. A
// reader does not see them, so "050<RLM>1234567" is a phone number to a reader and to nobody else.
var INVISIBLE_RE = /[­᠎​-‏‪-‮⁠-⁤⁦-⁩﻿]/g;

// Digits a phone keyboard can type that NFKC leaves alone: Arabic-Indic and Eastern Arabic-Indic.
// Both blocks start at a code point ending in 0, so the low four bits are the digit's value.
var OTHER_DIGIT_RE = /[٠-٩۰-۹]/g;

// Hebrew vowel points (niqqud), shin/sin dots, dagesh and cantillation: a phone keyboard types them on a
// long press and they sit between the letters, so "חָרָא" is the same word to a reader and not to the
// matcher. The maqaf, paseq and sof pasuq (05be, 05c0, 05c3, 05c6) take space and stay. Dropped after
// NFKC, which spreads a pointed presentation form (U+FB2A...) into letter + points.
var HEBREW_POINT_RE = /[֑-ׇֽֿׁׂׅׄ]/g;

function asciiDigit(d) {
  return String.fromCharCode(48 + (d.charCodeAt(0) & 15));
}

// Longest alternative first, so "מטומטמת" is never reported as the shorter "מטומטם".
// Every letter may repeat, so a word stretched to get past a filter (fuuuck, חרררא, shiiit) is the same
// word. No ordinary word in the list's languages is a listed word with a letter doubled.
function profanityAlternatives() {
  return PROFANITY.slice()
    .sort(function (a, b) { return b.length - a.length; })
    // a function replacer, not a replacement string: scripts/build-app.js inlines this file with
    // String.replace, so a dollar-ampersand group reference in here is expanded as the app is built
    .map(function (w) {
      return w.split('').map(function (c) {
        return c.replace(/[.*+?^${}()|[\]\\]/g, function (x) { return '\\' + x; }) + '+';
      }).join('');
    })
    .join('|');
}

function profanityRegex() {
  return new RegExp('(?<!' + LETTER + ')' + HEBREW_PREFIX + '(?:' + profanityAlternatives() + ')(?!' + LETTER + ')', 'gi');
}

// A word spelled one letter at a time with the same mark between every letter: f.u.c.k, s h i t,
// ז-ו-נ-ה, b*i*t*c*h. A run of single letters is read without its marks and every stretch of four
// letters or more in it is checked whole, so "I f u c k" still yields "fuck". Four, not three: a
// grammar lesson writes a Hebrew root this way (ש.מ.ר, ח-ר-א), and a root has three letters.
var SPELLED_RE = new RegExp('(?<!' + LETTER + ')' + LETTER + '([-.*_\\u00b7\\s])' + LETTER +
  '(?:\\1' + LETTER + ')+(?!' + LETTER + '|\\1' + LETTER + ')', 'g');
var SPELLED_MIN_LETTERS = 4;

function findSpelledProfanity(text) {
  var whole = new RegExp('^' + HEBREW_PREFIX + '(?:' + profanityAlternatives() + ')$', 'i');
  var re = new RegExp(SPELLED_RE.source, 'g');
  var hits = [];
  var m;
  while ((m = re.exec(text)) !== null) {
    var run = m[0];
    // the position of every letter in the run: letters sit at even offsets, one mark between each two
    var letters = [];
    for (var k = 0; k < run.length; k += 2) letters.push(k);
    for (var i = 0; i + SPELLED_MIN_LETTERS <= letters.length; i++) {
      for (var j = letters.length; j - i >= SPELLED_MIN_LETTERS; j--) {
        var word = '';
        for (var n = i; n < j; n++) word += run.charAt(letters[n]);
        if (!whole.test(word)) continue;
        // a cleared word ("מזונות") takes its letters with it, so the "זונות" inside is not tried next
        if (!NOT_PROFANITY_RE.test(word)) hits.push({ kind: 'profanity', match: run.slice(letters[i], letters[j - 1] + 1), index: m.index + letters[i] });
        i = j - 1;
        break;
      }
    }
  }
  return hits;
}

function findProfanity(text) {
  var re = profanityRegex();
  var hits = [];
  var m;
  while ((m = re.exec(text)) !== null) {
    if (NOT_PROFANITY_RE.test(m[0])) continue;
    hits.push({ kind: 'profanity', match: m[0], index: m.index });
  }
  return hits.concat(findSpelledProfanity(text)).sort(function (a, b) { return a.index - b.index; });
}

function contains(outer, inner) {
  return inner.index >= outer.index &&
    (inner.index + inner.match.length) <= (outer.index + outer.match.length);
}

// Every reason to refuse this text, ordered by index then kind: every hit of every pattern plus every
// offensive word, which carries kind 'profanity'. A hit fully inside a longer hit is dropped, so a
// nine-digit run inside a phone number is reported once as phone, the "@host" of an email is never
// also reported as a social handle, and a word inside a url is the url and nothing else.
// The text is read the way a reader sees it: invisible characters are dropped first, so a phone, an
// email or an offensive word cannot be hidden by a zero-width character, a bidi mark or niqqud inside it, and
// look-alike characters are folded to the plain ones (NFKC: full-width digits and @, mathematical
// digits; then Arabic-Indic digits to 0-9), so a number does not pass because of the keyboard it was
// typed on. Each match and index refers to that folded text; the text the gate stores is not changed.
function findPersonalData(text) {
  if (typeof text !== 'string') return [];
  text = text.replace(INVISIBLE_RE, '').normalize('NFKC').replace(HEBREW_POINT_RE, '')
    .replace(OTHER_DIGIT_RE, asciiDigit);
  if (text === '') return [];
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

var SUBJECTS = require('./profile.js').SUBJECTS;
var REPORT_EVENT_FIELDS = Object.freeze(['userId', 'detail']);
var REPORT_EVENT_DETAIL_MAX_LENGTH = 300;

var UNIT_FIELDS = Object.freeze(['title', 'subject', 'minutes', 'text']);
var UNIT_TITLE_MAX_LENGTH = 120;
var UNIT_MINUTES_MIN = 1;
var UNIT_MINUTES_MAX = 60;
var UNIT_ID_PREFIX = 'u-';

function fnv1a32(text) {
  var hash = 0x811c9dc5 >>> 0;
  for (var i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash >>> 0;
}

function hex8(n) {
  return ('00000000' + n.toString(16)).slice(-8);
}

function unitRecordId(title, subject, minutes) {
  var key = title + '|' + subject + '|' + String(minutes);
  return UNIT_ID_PREFIX + hex8(fnv1a32(key));
}

function makeReportEvent(input) {
  if (input === null || typeof input !== 'object' || Array.isArray(input)) {
    throw new Error('report event input must be an object with userId, detail');
  }
  var keys = Object.keys(input);
  for (var i = 0; i < keys.length; i += 1) {
    if (REPORT_EVENT_FIELDS.indexOf(keys[i]) === -1) throw new Error(PERSONAL_DATA_ERROR);
  }
  if (typeof input.detail !== 'string') throw new Error('invalid detail: expected a string');
  var userId = assertUserId(input.userId);
  var detail = assertCleanText(input.detail, { maxLength: REPORT_EVENT_DETAIL_MAX_LENGTH });
  return Object.freeze({ userId: userId, detail: detail });
}

function makeUnit(input) {
  if (input === null || typeof input !== 'object' || Array.isArray(input)) {
    throw new Error('unit input must be an object with title, subject, minutes, text');
  }
  var keys = Object.keys(input);
  for (var i = 0; i < keys.length; i += 1) {
    if (UNIT_FIELDS.indexOf(keys[i]) === -1) throw new Error(PERSONAL_DATA_ERROR);
  }
  var subject = input.subject;
  if (typeof subject !== 'string' || SUBJECTS.indexOf(subject) === -1) {
    throw new Error('invalid subject: expected one of the SUBJECTS codes');
  }
  var minutes = input.minutes;
  if (!Number.isInteger(minutes) || minutes < UNIT_MINUTES_MIN || minutes > UNIT_MINUTES_MAX) {
    throw new Error('invalid minutes: expected an integer ' + UNIT_MINUTES_MIN + '..' + UNIT_MINUTES_MAX);
  }
  if (typeof input.title !== 'string') throw new Error('invalid title: expected a string');
  if (typeof input.text !== 'string') throw new Error('invalid text: expected a string');
  var title = assertCleanText(input.title, { maxLength: UNIT_TITLE_MAX_LENGTH });
  var text = assertCleanText(input.text);
  return Object.freeze({
    id: unitRecordId(title, subject, minutes),
    title: title,
    subject: subject,
    minutes: minutes,
    text: text
  });
}

module.exports = {
  PATTERNS: PATTERNS,
  PROFANITY: PROFANITY,
  PERSONAL_DATA_ERROR: PERSONAL_DATA_ERROR,
  PROFANITY_ERROR: PROFANITY_ERROR,
  USER_ID_PREFIX: USER_ID_PREFIX,
  isUserId: isUserId,
  assertUserId: assertUserId,
  findPersonalData: findPersonalData,
  findProfanity: findProfanity,
  cleanText: cleanText,
  assertCleanText: assertCleanText,
  REPORT_EVENT_FIELDS: REPORT_EVENT_FIELDS,
  REPORT_EVENT_DETAIL_MAX_LENGTH: REPORT_EVENT_DETAIL_MAX_LENGTH,
  makeReportEvent: makeReportEvent,
  UNIT_FIELDS: UNIT_FIELDS,
  makeUnit: makeUnit
};
