'use strict';
// A saved list that fails the check on load is dropped, and the participants card says why. The reason
// comes from store.js in English; the card is Hebrew, so it goes through the same table as every other
// status line instead of being pasted in raw.
const test = require('node:test');
const assert = require('node:assert/strict');
const { openApp } = require('../test-support/fake-dom.js');
const { makeUnit } = require('../src/lib/unit.js');
const approval = require('../src/lib/approval.js');

const KEY = 'peered_app_v1';
const REJECTED_KEY = KEY + ':rejected';
const LATIN = /[A-Za-z]/;

function openWith(text) {
  const store = {};
  store[KEY] = text;
  return openApp({ store: store });
}

test('a saved list that is not JSON is reported in Hebrew', () => {
  const $ = openWith('{not json');
  assert.ok($('addStatus').className.includes('bad'), $('addStatus').textContent);
  assert.match($('addStatus').textContent, /נדחתה/);
  assert.match($('addStatus').textContent, /הקובץ השמור פגום/);
  assert.match($('addStatus').textContent, /עותק שלה נשמר בצד/);
  assert.equal($.store[REJECTED_KEY], '{not json');
  assert.doesNotMatch($('addStatus').textContent, LATIN, $('addStatus').textContent);
});

test('a saved list with a name in it is reported in Hebrew', () => {
  const $ = openWith(JSON.stringify({
    schema: 'peered/1',
    people: [{ role: 'student', region: 'CENTER', availability: ['SUN_16'], subjects: ['MATH'], name: 'Dana' }]
  }));
  assert.match($('addStatus').textContent, /פרטים אישיים לא מתקבלים/);
  assert.doesNotMatch($('addStatus').textContent, LATIN, $('addStatus').textContent);
});

test('a saved session row that does not load is reported in Hebrew', () => {
  const $ = openWith(JSON.stringify({
    schema: 'peered/1', people: [],
    log: { nextSeq: 2, entries: [{ seq: 1, region: 'MOON', slot: 'SUN_16', subject: 'MATH', unitId: 'u-x', outcome: 'held' }] }
  }));
  assert.match($('addStatus').textContent, /שיעור שמור לא תקין/);
  assert.doesNotMatch($('addStatus').textContent, LATIN, $('addStatus').textContent);
});

test('a saved session row with an hour, a subject or a unit that does not fit is reported as a bad stored row, not as a pair', () => {
  // nobody picked an hour or a subject on load and there is no pair: the line for a stored row is the one
  // that shows, not "בשעה הזאת הזוג לא פנוי יחד" or "אפשר לרשום רק יחידה מאושרת"
  for (const patch of [{ slot: 'SUN_08' }, { subject: 'ART' }, { outcome: 'great' }, {}]) {
    const $ = openWith(JSON.stringify({
      schema: 'peered/1', people: [],
      log: { nextSeq: 2, entries: [Object.assign(
        { seq: 1, region: 'CENTER', slot: 'SUN_16', subject: 'MATH', unitId: 'u-x', outcome: 'held' }, patch)] }
    }));
    assert.match($('addStatus').textContent, /נדחתה ולא נטענה: שיעור שמור לא תקין\./, JSON.stringify(patch));
    assert.doesNotMatch($('addStatus').textContent, /הזוג|יחידה מאושרת/, JSON.stringify(patch));
    assert.doesNotMatch($('addStatus').textContent, LATIN, $('addStatus').textContent);
  }
});

test('a saved person whose retention stamp is not one the app writes is reported in Hebrew', () => {
  const $ = openWith(JSON.stringify({
    schema: 'peered/1',
    people: [{ role: 'student', region: 'CENTER', availability: ['SUN_16'], subjects: ['MATH'], retention: 'Dana 0501234567' }]
  }));
  assert.match($('addStatus').textContent, /חותמת השמירה ברשומה לא תקינה/);
  assert.doesNotMatch($('addStatus').textContent, LATIN, $('addStatus').textContent);
});

test('a saved queue entry whose unit or reason does not pass the gate is reported as a bad stored entry, not as a form the teacher filled', () => {
  // nobody typed a title or a reason on load: the line for a stored queue entry is the one that shows,
  // not the unit form's "הכותרת ארוכה מדי" or the check-text demo's "אין טקסט לבדוק"
  const unit = makeUnit({ title: 'שברים', subject: 'MATH', durationMinutes: 20, body: 'גוף תקין.' });
  const queue = approval.reject(approval.submit(approval.emptyQueue(), unit), unit.id, 'חסר הסבר');
  const cases = [
    (e) => { e.unit.title = 'א'.repeat(121); },
    (e) => { e.unit.body = ''; },
    (e) => { e.unit.durationMinutes = 99; },
    (e) => { e.unit.teacher = 'x'; },
    (e) => { e.reason = ''; },
    (e) => { e.reason = 'א'.repeat(approval.REASON_MAX_LENGTH + 1); },
    (e) => { e.reason = '  חסר   הסבר  '; }   // was loaded without a word, cleaned on the way in
  ];
  for (const patch of cases) {
    const doc = JSON.parse(JSON.stringify({ schema: 'peered/1', people: [], queue: queue }));
    patch(doc.queue.entries[unit.id]);
    const $ = openWith(JSON.stringify(doc));
    assert.match($('addStatus').textContent, /נדחתה ולא נטענה: רשומה שמורה בתור לא תקינה\./, patch.toString());
    assert.doesNotMatch($('addStatus').textContent, /הכותרת|תוכן היחידה|משך הזמן|טקסט לבדוק|הטקסט ארוך|היחידה לא בנויה/, patch.toString());
    assert.doesNotMatch($('addStatus').textContent, LATIN, $('addStatus').textContent);
  }
  // the queue as the flow wrote it still loads with no complaint
  const $ = openWith(JSON.stringify({ schema: 'peered/1', people: [], queue: queue }));
  assert.equal($('addStatus').textContent, '');
});

test('a saved person with no hours, no subject or a bad role is reported as a bad stored person, not as a form the coordinator filled', () => {
  // nobody filled the add form on load: the line for a stored person is the one that shows, not the
  // form's "צריך לסמן לפחות שעה פנויה אחת" or "צריך לבחור לפחות מקצוע אחד"
  const good = { role: 'pupil', region: 'CENTER', availability: ['SUN_16'], subjects: ['MATH'], parentConsent: true };
  const cases = [{ availability: [] }, { availability: ['SUN_7'] }, { subjects: [] }, { subjects: ['ART'] },
    { role: 'teacher' }, { region: 'MOON' }, { parentConsent: 'yes' }];
  for (const patch of cases) {
    const $ = openWith(JSON.stringify({ schema: 'peered/1', people: [Object.assign({}, good, patch)] }));
    assert.match($('addStatus').textContent, /נדחתה ולא נטענה: משתתף שמור ברשימה לא תקין\./, JSON.stringify(patch));
    assert.doesNotMatch($('addStatus').textContent, /צריך ל|שאינה בלוח|שאינו ברשימה|לא מוכר|אישור ההורה/, JSON.stringify(patch));
    assert.doesNotMatch($('addStatus').textContent, LATIN, $('addStatus').textContent);
  }
  // a person that is not a record at all is a bad stored person too
  const $ = openWith(JSON.stringify({ schema: 'peered/1', people: ['דנה'] }));
  assert.match($('addStatus').textContent, /משתתף שמור ברשימה לא תקין/);
  // the roster as the app wrote it still loads with no complaint
  assert.equal(openWith(JSON.stringify({ schema: 'peered/1', people: [good] }))('addStatus').textContent, '');
});

test('a good saved list loads with no complaint', () => {
  const $ = openWith(JSON.stringify({ schema: 'peered/1', people: [] }));
  assert.equal($('addStatus').textContent, '');
});
