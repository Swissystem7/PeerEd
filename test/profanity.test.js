'use strict';
// F1: the free-text gate refuses offensive language the same way it refuses personal data.
// Two things are being proven here: a curse word is reported as a hit with kind 'profanity',
// and ordinary Hebrew lesson text that merely *contains* those letters is still clean.
const test = require('node:test');
const assert = require('node:assert/strict');

const { PROFANITY, PROFANITY_ERROR, PERSONAL_DATA_ERROR, findPersonalData, findProfanity,
        assertCleanText } = require('../src/lib/validator.js');

function kindsIn(text) {
  return findPersonalData(text).map((h) => h.kind);
}

test('profanity: findPersonalData reports a curse word as the first hit', () => {
  const hits = findPersonalData('איזה מניאק אתה');
  assert.ok(hits.length > 0, 'nothing was flagged');
  assert.equal(hits[0].kind, 'profanity');
  assert.equal(hits[0].match, 'מניאק');
  assert.equal(hits[0].index, 'איזה '.length);
});

test('profanity: PROFANITY is a frozen list of lower-case words', () => {
  assert.ok(Object.isFrozen(PROFANITY));
  assert.ok(PROFANITY.length > 10);
  PROFANITY.forEach((w) => {
    assert.equal(typeof w, 'string');
    assert.equal(w, w.toLowerCase(), w);
    assert.equal(w.trim(), w, w);
  });
});

test('profanity: Hebrew words are found with their exact text and position', () => {
  for (const word of ['חרא', 'מטומטם', 'מפגר', 'דביל', 'שרמוטה', 'זונה', 'אהבל', 'חלאה', 'טמבל']) {
    const prefix = 'אתה ';
    const hits = findPersonalData(prefix + word + ' לגמרי');
    const bad = hits.find((h) => h.kind === 'profanity');
    assert.ok(bad, word + ' -> ' + JSON.stringify(hits));
    assert.equal(bad.match, word);
    assert.equal(bad.index, prefix.length);
  }
});

test('profanity: a feminine or plural form is reported whole, not as its shorter stem', () => {
  for (const word of ['מטומטמת', 'מטומטמים', 'מפגרת', 'דבילים', 'זונות', 'אידיוטית']) {
    const hits = findProfanity('קבוצת ' + word + ' כאן');
    assert.equal(hits.length, 1, word + ' -> ' + JSON.stringify(hits));
    assert.equal(hits[0].match, word);
  }
});

test('profanity: a glued Hebrew prefix is part of the hit, not a way around it', () => {
  for (const [text, expected] of [['המניאק הזה', 'המניאק'], ['והחרא הזה', 'והחרא'],
    ['שהמטומטם ההוא', 'שהמטומטם'], ['לך תזדיין', 'תזדיין'], ['בא לי להזדיין', 'להזדיין']]) {
    const hits = findProfanity(text);
    assert.equal(hits.length, 1, text + ' -> ' + JSON.stringify(hits));
    assert.equal(hits[0].match, expected);
  }
});

test('profanity: English curse words are found whatever their case', () => {
  for (const word of ['fuck', 'FUCK', 'Fucking', 'shit', 'bullshit', 'bitch', 'asshole', 'bastard',
    'retarded', 'whore']) {
    assert.ok(kindsIn('you ' + word + ' here').includes('profanity'), word);
  }
});

test('profanity: an ordinary word that merely contains the letters stays clean', () => {
  // The whole risk of a word list is this: flagging real lesson text. "אחראי" holds "חרא",
  // "תזונה" holds "זונה", "country" holds "cunt" - none of them is a curse word.
  for (const clean of ['התלמיד אחראי על החומר', 'האחראית תגיע בשני',
    'שיעור על תזונה נכונה', 'תזונת ספורטאים',
    'מזונות הם נושא בשיעור אזרחות', 'דיני המזונות בבית הדין',
    'קיבלתי ציון 90 וזה לא ביזיון', 'המחלה חלפה',
    'she comes from another country', 'the class passed the test', 'a night class in Haifa',
    'פתרו 3 תרגילים מפרק 12 בעמוד 45', 'נפגשים בשעה 16:30 ליד הספרייה']) {
    assert.deepEqual(findPersonalData(clean), [], clean);
  }
});

test('profanity: clearing "מזונות" does not clear the curse word inside it', () => {
  assert.deepEqual(findProfanity('מזונות').map((h) => h.match), []);
  assert.deepEqual(findProfanity('המזונות').map((h) => h.match), []);
  assert.deepEqual(findProfanity('זונות').map((h) => h.match), ['זונות']);
  assert.deepEqual(findProfanity('הזונות').map((h) => h.match), ['הזונות']);
});

test('profanity: every hit in a sentence is reported, in reading order', () => {
  const hits = findProfanity('מניאק אחד ועוד חרא של דביל');
  assert.deepEqual(hits.map((h) => h.match), ['מניאק', 'חרא', 'דביל']);
  assert.deepEqual(hits.map((h) => h.index).slice().sort((a, b) => a - b), hits.map((h) => h.index));
});

test('profanity: personal data and offensive language are reported together', () => {
  const hits = findPersonalData('מניאק, תתקשר 050-1234567');
  assert.deepEqual(hits.map((h) => h.kind), ['profanity', 'phone']);
});

test('profanity: assertCleanText refuses the text, with its own message', () => {
  assert.throws(() => assertCleanText('אתה מטומטם'), { message: PROFANITY_ERROR });
  assert.throws(() => assertCleanText('this is bullshit'), { message: PROFANITY_ERROR });
  assert.equal(PROFANITY_ERROR, 'offensive language is not accepted');
  assert.notEqual(PROFANITY_ERROR, PERSONAL_DATA_ERROR);
});

test('profanity: when a text carries both, the personal data is the reason it is refused', () => {
  assert.throws(() => assertCleanText('מניאק, תתקשר 050-1234567'), { message: PERSONAL_DATA_ERROR });
});

test('profanity: clean lesson text still passes the gate unchanged', () => {
  assert.equal(assertCleanText('  שיעור   על   שברים  '), 'שיעור על שברים');
  assert.equal(assertCleanText('התלמיד אחראי על תזונה נכונה'), 'התלמיד אחראי על תזונה נכונה');
});
