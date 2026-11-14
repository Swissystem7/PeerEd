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

function stripInvisible(text) {
  return String(text).replace(INVISIBLE_RE, '');
}

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
// typed on. Each match is the folded text; the text the gate stores is not changed.
// Each index is a position in the text as typed, since the check screen shows it as "תו N" next to that
// text: with niqqud or an RLM before the hit, the folded position pointed at an earlier character.
function findPersonalData(text) {
  if (typeof text !== 'string') return [];
  var typed = text;
  text = text.replace(INVISIBLE_RE, '').normalize('NFKC').replace(HEBREW_POINT_RE, '')
    .replace(OTHER_DIGIT_RE, asciiDigit);
  if (text === '') return [];
  var toTyped = typedPositions(typed, text);
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
  if (toTyped) kept.forEach(function (hit) { hit.index = toTyped[hit.index]; });
  return kept;
}

// For each position of the folded text, the position in the typed text it came from. The fold is
// redone one character at a time; when NFKC joins characters across a boundary (a letter and a
// combining accent) that no longer gives the same text, and null keeps the folded positions.
function typedPositions(typed, folded) {
  var out = '';
  var map = [];
  var at = 0;
  var invisible = new RegExp(INVISIBLE_RE.source);
  Array.from(typed).forEach(function (ch) {
    if (!invisible.test(ch)) {
      var f = ch.normalize('NFKC').replace(HEBREW_POINT_RE, '').replace(OTHER_DIGIT_RE, asciiDigit);
      for (var k = 0; k < f.length; k += 1) map.push(at);
      out += f;
    }
    at += ch.length;
  });
  return out === folded ? map : null;
}

function assertSafeText(text) {
  if (typeof text !== 'string') throw new TypeError('קלט לא תקין: יש להזין טקסט בלבד');
  return text;
}

function cleanText(text) {
  var s = String(text == null ? '' : text);
  // A line break pasted from Windows (CR LF) or an old Mac (CR alone) is a line break, and a vertical tab
  // or form feed is a space. Stripped as control characters they glued the words on both sides together.
  s = s.replace(/\r\n?/g, '\n').replace(/[\x0b\x0c]/g, ' ');
  s = s.replace(CONTROL_RE, '');
  s = s.replace(/[^\S\n]+/g, ' ');   // collapse horizontal whitespace, keep newlines
  s = s.replace(/ *\n */g, '\n');    // no padding around a newline
  return s.trim();
}

// The length a limit is held against, counted the way the person who typed the text counts it and the
// way the screen counts it back to them (the preview clip, the "תו N" position): in characters, one per
// code point. String.length counts UTF-16 units, so to it an emoji is two characters and a body of 2001
// emoji was refused as over 4000 characters; a message that says "עד 4000 תווים" has to count the same
// characters the writer sees.
function charCount(text) {
  return Array.from(text).length;
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
  // Emptiness is judged the way a reader sees it, exactly as findPersonalData above reads the text: a box
  // holding nothing but characters that take no space - a zero-width space, a soft hyphen, the RLM a
  // Hebrew keyboard or a WhatsApp paste leaves behind - is an empty box, and a unit title, a lesson text
  // or a rejection reason that reads as blank must be refused as blank instead of stored as text nobody
  // can see. Asked before the upper bound, so a paste of nothing but those characters is reported as
  // empty and not as too long. Only the measuring drops them: the text that comes back is still the text
  // as written, so 'א<RLM>ב' is kept with its mark. cleanText runs again over what is left, because
  // dropping the invisible characters can leave the spaces that stood between them ('<RLM> <ZWSP>'):
  // trimmed away, that box is empty too.
  if (charCount(cleanText(stripInvisible(cleaned))) < minLength) throw new Error('text too short');
  if (charCount(cleaned) > maxLength) throw new Error('text too long');
  return cleaned;
}

var REPORT_EVENT_FIELDS = Object.freeze(['userId', 'detail']);
var REPORT_EVENT_DETAIL_MAX_LENGTH = 300;
var RESPONSE_TO_REPORT_FIELDS = Object.freeze(['reportIndex', 'detail']);
var RESPONSE_TO_REPORT_DETAIL_MAX_LENGTH = 300;

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

function makeResponseToReport(input) {
  if (input === null || typeof input !== 'object' || Array.isArray(input)) {
    throw new Error('response to report input must be an object with reportIndex, detail');
  }
  var keys = Object.keys(input);
  for (var i = 0; i < keys.length; i += 1) {
    if (RESPONSE_TO_REPORT_FIELDS.indexOf(keys[i]) === -1) throw new Error(PERSONAL_DATA_ERROR);
  }
  if (typeof input.detail !== 'string') throw new Error('invalid detail: expected a string');
  var reportIndex = input.reportIndex;
  if (!Number.isInteger(reportIndex) || reportIndex < 0) {
    throw new Error('invalid reportIndex: expected a non-negative integer');
  }
  var detail = assertCleanText(input.detail, { maxLength: RESPONSE_TO_REPORT_DETAIL_MAX_LENGTH });
  return Object.freeze({ reportIndex: reportIndex, detail: detail });
}

const PILOT_ROLES = Object.freeze(['student', 'pupil']);
const PILOT_REGIONS = Object.freeze(['NORTH', 'HAIFA', 'CENTER', 'TEL_AVIV', 'JERUSALEM', 'SOUTH']);
const PILOT_AI_TOPICS = Object.freeze(['AI_LIT_PROMPT', 'AI_CREATIVE', 'AI_STEM_CODE', 'AI_ETHICS_SEC']);

const PII_KEY_RE = /(?:name|email|mail|phone|tel|mobile|id_?number|tz|zehut|address)/i;
const EMAIL_CHECK_RE = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/i;
const PHONE_CHECK_RE = /(?:(?:\+|00)?972[-\s.]?\(?0?|\(?0)(?:5\d|7[2-9]|[23489])\)?[-\s.–—]?(?:\d{3}[-\s.–—]?\d{4}|\d{3}[-\s.–—]?\d{2}[-\s.–—]?\d{2}|\d{2}[-\s.–—]?\d{2}[-\s.–—]?\d{3})/i;
const ID_CHECK_RE = /(?<!\d)(?:\d{9}|\d{8}[-–]\d|\d{3}-\d{3}-\d{3})(?!\d)/i;

function hasPiiKey(obj) {
  if (obj === null || typeof obj !== 'object') return false;
  const keys = Object.keys(obj);
  for (let i = 0; i < keys.length; i += 1) {
    if (PII_KEY_RE.test(keys[i])) return true;
  }
  return false;
}

function hasPiiString(val) {
  if (typeof val !== 'string') return false;
  const hits = findPersonalData(val);
  for (let i = 0; i < hits.length; i += 1) {
    if (hits[i].kind !== 'profanity') return true;
  }
  if (EMAIL_CHECK_RE.test(val)) return true;
  if (PHONE_CHECK_RE.test(val)) return true;
  if (ID_CHECK_RE.test(val)) return true;
  return false;
}

function checkDeepPii(val) {
  if (val === null || val === undefined) return false;
  if (typeof val === 'string') return hasPiiString(val);
  if (Array.isArray(val)) {
    for (let i = 0; i < val.length; i += 1) {
      if (checkDeepPii(val[i])) return true;
    }
    return false;
  }
  if (typeof val === 'object') {
    if (hasPiiKey(val)) return true;
    const keys = Object.keys(val);
    for (let j = 0; j < keys.length; j += 1) {
      if (checkDeepPii(val[keys[j]])) return true;
    }
  }
  return false;
}

function cleanBatchAiTopics(rawTopics) {
  const topics = Array.isArray(rawTopics) ? rawTopics : [];
  const out = [];
  for (let i = 0; i < topics.length; i += 1) {
    const t = topics[i];
    if (typeof t === 'string') {
      const norm = t.trim().toUpperCase();
      if (PILOT_AI_TOPICS.indexOf(norm) !== -1 && out.indexOf(norm) === -1) {
        out.push(norm);
      }
    }
  }
  return out;
}

function validateBatchImportZeroPii(rawRecords) {
  if (!Array.isArray(rawRecords)) {
    return {
      accepted: Object.freeze([]),
      rejectedCount: 0,
      reasons: Object.freeze(['expected rawRecords to be an array'])
    };
  }

  const accepted = [];
  let rejectedCount = 0;
  const reasons = [];

  for (let i = 0; i < rawRecords.length; i += 1) {
    const rec = rawRecords[i];
    if (rec === null || typeof rec !== 'object' || Array.isArray(rec)) {
      rejectedCount += 1;
      reasons.push(`record at index ${i} rejected: not an object`);
      continue;
    }

    if (checkDeepPii(rec)) {
      rejectedCount += 1;
      reasons.push(`record at index ${i} rejected: contains PII`);
      continue;
    }

    const role = typeof rec.role === 'string' ? rec.role.trim().toLowerCase() : '';
    if (PILOT_ROLES.indexOf(role) === -1) {
      rejectedCount += 1;
      reasons.push(`record at index ${i} rejected: invalid role`);
      continue;
    }

    const rawArea = rec.area !== undefined ? rec.area : rec.region;
    const area = typeof rawArea === 'string' ? rawArea.trim().toUpperCase() : '';
    if (PILOT_REGIONS.indexOf(area) === -1) {
      rejectedCount += 1;
      reasons.push(`record at index ${i} rejected: invalid area`);
      continue;
    }

    const rawTopics = rec.target_ai_topics !== undefined ? rec.target_ai_topics : rec.aiTopics;
    const cleanedTopics = cleanBatchAiTopics(rawTopics);

    const validRec = {
      role: role,
      area: area,
      region: area,
      target_ai_topics: Object.freeze(cleanedTopics)
    };

    if (Array.isArray(rec.availability) && rec.availability.length > 0) {
      validRec.availability = rec.availability.slice();
    } else {
      validRec.availability = ['SUN_16'];
    }

    if (Array.isArray(rec.subjects) && rec.subjects.length > 0) {
      validRec.subjects = rec.subjects.slice();
    } else {
      validRec.subjects = ['MATH'];
    }

    if (role === 'pupil') {
      validRec.parentConsent = rec.parentConsent !== undefined ? Boolean(rec.parentConsent) : true;
    }

    if (rec.aiLevel === 'beginner' || rec.aiLevel === 'advanced') {
      validRec.aiLevel = rec.aiLevel;
    }

    accepted.push(Object.freeze(validRec));
  }

  return {
    accepted: Object.freeze(accepted),
    rejectedCount: rejectedCount,
    reasons: Object.freeze(reasons)
  };
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
  stripInvisible: stripInvisible,
  assertSafeText: assertSafeText,
  assertCleanText: assertCleanText,
  REPORT_EVENT_FIELDS: REPORT_EVENT_FIELDS,
  REPORT_EVENT_DETAIL_MAX_LENGTH: REPORT_EVENT_DETAIL_MAX_LENGTH,
  makeReportEvent: makeReportEvent,
  RESPONSE_TO_REPORT_FIELDS: RESPONSE_TO_REPORT_FIELDS,
  RESPONSE_TO_REPORT_DETAIL_MAX_LENGTH: RESPONSE_TO_REPORT_DETAIL_MAX_LENGTH,
  makeResponseToReport: makeResponseToReport,
  validateBatchImportZeroPii: validateBatchImportZeroPii
};
