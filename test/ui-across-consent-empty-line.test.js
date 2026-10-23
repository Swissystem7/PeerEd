'use strict';
// The cross-region card drops the region rule only: a pupil without parent consent is in no pair there
// either (matchAcrossRegions runs the same engine, consent gate included). When nothing came out of that
// pass, the card said "אף אחד מאלה שנשארו לא חולק שעה ומקצוע עם מישהו מאזור אחר" - over a pupil who was
// left out for consent and does share an hour and a subject with a free student from another region. The
// participants list says such a pupil "לא נכנס לשידוך", the unmatched card says the consent is missing,
// and the one card that could have offered the pair blamed the hours and the subjects. Now the empty
// line counts those pupils and names the consent as the bar, with where to mark it; the old line stays
// for the case it is true for.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { openApp, addPerson, press, text, ROOT } = require('../test-support/fake-dom.js');

function addPupilWithoutConsent($, region, subjects, slots) {
  $('role').value = 'pupil';
  $('consentRow').hidden = false;
  $('region').value = region;
  $('consent').checked = false;
  subjects.forEach((s) => press($('subjects'), 'data-subject', s));
  slots.forEach((s) => press($('hours'), 'data-slot', s));
  $('addPerson').fire('click');
  if ($('addStatus').className.includes('bad')) throw new Error('add refused: ' + $('addStatus').textContent);
}
function across($) {
  $('runMatch').fire('click');
  return text($('across').innerHTML);
}

test('a pupil without consent who shares an hour and a subject with a free student elsewhere: the line names the consent', () => {
  const $ = openApp();
  addPerson($, 'student', 'NORTH', ['HISTORY'], ['THU_16']);         // #1, alone in the north
  addPupilWithoutConsent($, 'JERUSALEM', ['HISTORY'], ['THU_16']);  // #2, same hour and subject, no consent
  const a = across($);
  assert.doesNotMatch(a, /לא חולק שעה ומקצוע/, a);
  assert.match(a, /אין הצעה: תלמיד אחד שנשאר בלי זוג חולק שעה ומקצוע עם סטודנט פנוי מאזור אחר/, a);
  assert.match(a, /בלי אישור הורה תלמיד לא נכנס לשידוך בכלל, גם לא בין אזורים/, a);
  assert.match(a, /מסמנים אישור במסך "אנשים"/, a);
  // the other two cards still say what they said: the pupil is out for consent, the student has nobody
  assert.match(text($('unmatched').innerHTML), /תלמיד #2[\s\S]*אין עדיין אישור הורה/);
  assert.match(text($('unmatched').innerHTML), /סטודנט מלמד #1[\s\S]*אין באזור הזה אף תלמיד/);
  assert.match($('peopleList').innerHTML, /בלי אישור הורה התלמיד לא נכנס לשידוך/);
});

test('marking the consent where the line points turns the same two into a suggestion', () => {
  const $ = openApp();
  addPerson($, 'student', 'NORTH', ['HISTORY'], ['THU_16']);
  addPupilWithoutConsent($, 'JERUSALEM', ['HISTORY'], ['THU_16']);
  assert.match(across($), /אין הצעה: תלמיד אחד/);
  press($('peopleList'), 'data-consent', '1');
  assert.match($('addStatus').textContent, /סומן אישור הורה/);
  const a = across($);
  assert.doesNotMatch(a, /אין הצעה/, a);
  assert.match(a, /תלמיד #2 \(ירושלים\) עם סטודנט מלמד #1 \(צפון\)/, a);
});

test('two such pupils are counted in the plural', () => {
  const $ = openApp();
  addPerson($, 'student', 'NORTH', ['HISTORY', 'MATH'], ['THU_16', 'SUN_16']);  // #1
  addPupilWithoutConsent($, 'JERUSALEM', ['HISTORY'], ['THU_16']);              // #2
  addPupilWithoutConsent($, 'SOUTH', ['MATH'], ['SUN_16']);                     // #3
  const a = across($);
  assert.match(a, /אין הצעה: 2 תלמידים שנשארו בלי זוג חולקים שעה ומקצוע עם סטודנט פנוי מאזור אחר/, a);
});

test('a pupil without consent whose only fit is in the same region keeps the old line: nobody from another region', () => {
  const $ = openApp();
  addPerson($, 'student', 'CENTER', ['MATH'], ['SUN_16']);        // #1: left because its pupil has no consent
  addPupilWithoutConsent($, 'CENTER', ['MATH'], ['SUN_16']);     // #2
  const a = across($);
  assert.match(a, /אין הצעה: אף אחד מאלה שנשארו לא חולק שעה ומקצוע עם מישהו מאזור אחר/, a);
  assert.doesNotMatch(a, /אישור הורה/, a);
  assert.match(text($('unmatched').innerHTML), /סטודנט מלמד #1[\s\S]*לאף תלמיד באזור אין עדיין אישור הורה/);
});

test('a pupil without consent who shares no hour with the free student elsewhere keeps the old line too', () => {
  const $ = openApp();
  addPerson($, 'student', 'NORTH', ['HISTORY'], ['THU_16']);
  addPupilWithoutConsent($, 'JERUSALEM', ['HISTORY'], ['WED_17']);
  const a = across($);
  assert.match(a, /אין הצעה: אף אחד מאלה שנשארו לא חולק שעה ומקצוע עם מישהו מאזור אחר/, a);
  assert.doesNotMatch(a, /אישור הורה/, a);
});

test('a free student taken by the cross-region pass is not counted as free for a second, consent-less pupil', () => {
  const $ = openApp();
  addPerson($, 'student', 'NORTH', ['HISTORY'], ['THU_16']);          // #1
  addPerson($, 'pupil', 'JERUSALEM', ['HISTORY'], ['THU_16']);        // #2, with consent: the suggestion
  addPupilWithoutConsent($, 'SOUTH', ['HISTORY'], ['THU_16']);       // #3, no consent, same fit
  const a = across($);
  // there is a suggestion, so the empty line is not on the screen at all
  assert.doesNotMatch(a, /אין הצעה/, a);
  assert.match(a, /תלמיד #2 \(ירושלים\) עם סטודנט מלמד #1 \(צפון\)/, a);
});

test('the card hint says a pupil needs parent consent here as well', () => {
  const shell = fs.readFileSync(path.join(ROOT, 'src', 'app-shell.html'), 'utf8');
  const m = /<h2>שידוך בין אזורים \(חירום\)<\/h2>\s*<p class="hint">([\s\S]*?)<\/p>/.exec(shell);
  assert.ok(m, 'the cross-region card has a hint under its heading');
  const h = m[1].replace(/\s+/g, ' ');
  assert.match(h, /כאן רק מי שנשאר בלי זוג, עם שעה ומקצוע משותפים, ולתלמיד גם אישור הורה/, h);
});
