'use strict';
// A write the browser refuses over a storage it does hand out (full, or a mode that reads but does not
// write) leaves the document from the last write that worked under the key, and the next visit opens on
// it. The line said "הדפדפן לא מאפשר אחסון מקומי" over a storage the list had just been loaded from, and
// "וזה ייעלם כשהדף ייסגר" as if nothing would be there then. It now says what the storage holds.
const test = require('node:test');
const assert = require('node:assert/strict');
const { openApp, press } = require('../test-support/fake-dom.js');
const { DEFAULT_KEY, emptyState, serialize } = require('../src/lib/store.js');
const profile = require('../src/lib/profile.js');

function storedRoster() {
  const s = emptyState();
  const people = [
    profile.makeProfile({ role: 'student', region: 'CENTER', availability: ['SUN_16'], subjects: ['MATH'] }),
    profile.makeProfile({ role: 'pupil', region: 'CENTER', availability: ['SUN_16'], subjects: ['MATH'], parentConsent: true })
  ];
  return { [DEFAULT_KEY]: serialize({ people: people, queue: s.queue, log: s.log }) };
}

test('a refused write over a saved list names the list the next visit loads, not a blocked storage', () => {
  const $ = openApp({ store: storedRoster(), saveFails: true });
  press($('peopleList'), 'data-del', '1');
  const line = $('addStatus').textContent;
  assert.match(line, /נשמר בזיכרון בלבד/);
  assert.match(line, /סירב לכתוב/);
  assert.match(line, /בפתיחה הבאה ייטען .*2 משתתפים, 0 יחידות ו-0 שיעורים/);
  assert.doesNotMatch(line, /לא מאפשר אחסון מקומי/);
  assert.ok($('addStatus').className.includes('bad'));
});

test('a refused consent change says the saved list, with the consent as it was, opens next time', () => {
  const $ = openApp({ store: storedRoster(), saveFails: true });
  press($('peopleList'), 'data-consent', '1');
  assert.match($('addStatus').textContent, /האישור בוטל/);
  assert.match($('addStatus').textContent, /ולא מה שעל המסך עכשיו/);
});

test('a refused first write on an empty storage says the next visit starts empty', () => {
  const $ = openApp({ saveFails: true });
  $('demoBtn').fire('click');
  assert.match($('addStatus').textContent, /באחסון לא נשמר עדיין דבר, אז הפתיחה הבאה תתחיל ריקה/);
});

test('a refused write over a refused saved document says the next visit opens without it again', () => {
  const $ = openApp({ store: { [DEFAULT_KEY]: '{"schema":1,"people":[],"teacher":"x"}' }, saveFails: true });
  $('demoBtn').fire('click');
  assert.match($('addStatus').textContent, /הנתונים השמורים שנדחו בטעינה/);
});

test('a blocked storage keeps its own line', () => {
  const $ = openApp({ noStorage: true });
  $('demoBtn').fire('click');
  assert.match($('addStatus').textContent, /לא מאפשר אחסון מקומי/);
  assert.doesNotMatch($('addStatus').textContent, /סירב לכתוב/);
});
