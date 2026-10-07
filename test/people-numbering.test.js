'use strict';
// The people screen numbers a participant within its role (תלמיד #1, #2...), the same way the match
// screen, the unmatched list and the pair dropdown do: matchPairs sees students and pupils as two lists,
// so "תלמיד #4" on the match screen is the fourth pupil, not the fourth card. The screen used to number
// every card over the whole roster, so with three students first the fourth pupil was "תלמיד #7" on one
// screen and "תלמיד #4" on the next, and a coordinator obtained consent from the wrong family.
//
// There is no DOM in the test runner, so the built app runs under node:vm against a small fake DOM:
// every <script> block of app.html in order, then the clicks the coordinator makes, then the HTML the
// screens rendered. The fake knows only what the shell asks of it.
const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');

const { build } = require('../scripts/build-app.js');
const { makeProfile } = require('../src/lib/profile.js');
const { matchPairs, explainUnmatched } = require('../src/lib/match.js');

const ROOT = path.join(__dirname, '..');
const shell = fs.readFileSync(path.join(ROOT, 'src', 'app-shell.html'), 'utf8');
const app = shell.slice(shell.lastIndexOf('<script>'));
const TAB_IDS = ['nav-people', 'nav-match', 'nav-text', 'nav-units', 'nav-sessions'];

// Every script block of the built page, in document order. Plain indexOf, no tag regex.
function scriptBlocks(html) {
  const out = [];
  let at = 0;
  for (;;) {
    const open = html.indexOf('<script>', at);
    if (open === -1) return out;
    const close = html.indexOf('</script>', open);
    out.push(html.slice(open + '<script>'.length, close));
    at = close + '</script>'.length;
  }
}

function fakeElement(id) {
  const attrs = {};
  const listeners = {};
  return {
    id, attrs, listeners,
    tagName: 'DIV', innerHTML: '', textContent: '', className: '', value: '', hidden: false,
    checked: false, disabled: false, tabIndex: 0, children: [],
    getAttribute(name) { return name in attrs ? attrs[name] : null; },
    setAttribute(name, value) { attrs[name] = String(value); },
    addEventListener(type, fn) { (listeners[type] = listeners[type] || []).push(fn); },
    focus() {}, select() {},
    click(target) {
      const ev = { target: target || this, preventDefault() {} };
      (listeners.click || []).forEach((fn) => fn.call(this, ev));
    }
  };
}

function runApp() {
  const elements = {};
  const byId = (id) => elements[id] || (elements[id] = fakeElement(id));
  TAB_IDS.forEach((id) => { byId(id).setAttribute('aria-controls', id.replace('nav-', 'tab-')); });
  const document = {
    documentElement: { dir: 'rtl' },
    getElementById: byId,
    querySelector: () => null,
    querySelectorAll: (sel) => (sel === '[role="tab"]' ? TAB_IDS.map(byId) : [])
  };
  const context = {
    document,
    navigator: {},
    console,
    window: { scrollTo() {}, get localStorage() { throw new Error('no storage in the test'); } }
  };
  context.window.document = document;
  vm.createContext(context);
  scriptBlocks(build()).forEach((code, i) => vm.runInContext(code, context, { filename: 'app.html#' + i }));
  return { $: byId, context };
}

// The labels in document order: the text of every <b> that opens an item card.
function cardLabels(html) {
  const out = [];
  let at = 0;
  for (;;) {
    const open = html.indexOf('<b>', at);
    if (open === -1) return out;
    const close = html.indexOf('</b>', open);
    out.push(html.slice(open + 3, close));
    at = close;
  }
}
function cardWith(html, label) {
  const cards = html.split('<div class="item">').filter((c) => c.indexOf('<b>' + label + '</b>') !== -1);
  assert.equal(cards.length, 1, 'exactly one card is ' + label);
  return cards[0];
}

test('people screen: a participant is numbered within its role, in roster order', () => {
  const { $ } = runApp();
  $('demoBtn').click();
  const labels = cardLabels($('peopleList').innerHTML);
  assert.deepEqual(labels, ['סטודנט מלמד #1', 'סטודנט מלמד #2', 'סטודנט מלמד #3',
    'תלמיד #1', 'תלמיד #2', 'תלמיד #3', 'תלמיד #4']);
  // The delete and consent buttons still carry the roster position, which is what the handlers index.
  const html = $('peopleList').innerHTML;
  assert.ok(html.indexOf('data-del="6"') !== -1, 'the last card deletes roster position 6');
  assert.ok(html.indexOf('data-consent="6"') !== -1);
  assert.equal(html.indexOf('data-del="7"'), -1);
});

test('people screen: the number on a card is the number the match screen uses for the same person', () => {
  const { $ } = runApp();
  $('demoBtn').click();
  $('runMatch').click();
  // The pupil in Jerusalem has no consent, so the match screen names it as left out; with the old
  // numbering the people screen called it #7.
  const left = $('unmatched').innerHTML;
  assert.ok(left.indexOf('<b>תלמיד #4</b>') !== -1, 'the match screen names the fourth pupil: ' + left);
  assert.ok(cardWith(left, 'תלמיד #4').indexOf('ירושלים') !== -1);
  assert.ok(cardWith($('peopleList').innerHTML, 'תלמיד #4').indexOf('ירושלים') !== -1,
    'the people screen must point at the same pupil');
  // The pairs name the same numbers: pair 1 is student 1 with pupil 1, and the people card "תלמיד #1"
  // is a CENTER pupil with CS, exactly the one matchPairs paired.
  const pairs = $('pairs').innerHTML;
  assert.ok(pairs.indexOf('סטודנט #1 עם תלמיד #1') !== -1, pairs);
  const first = cardWith($('peopleList').innerHTML, 'תלמיד #1');
  assert.ok(first.indexOf('מרכז') !== -1 && first.indexOf('מדעי המחשב') !== -1);
  // The whole relation, checked against the engine: every pair's pupilIndex + 1 is a people-screen label.
  const people = $('peopleList').innerHTML;
  const demo = ['student', 'student', 'student', 'pupil', 'pupil', 'pupil', 'pupil'];
  assert.deepEqual(cardLabels(people).map((l) => l.replace(/^.* #/, '')), ['1', '2', '3', '1', '2', '3', '4']);
  assert.deepEqual(cardLabels(people).map((l) => (l.indexOf('תלמיד') === 0 ? 'pupil' : 'student')), demo);
});

test('people screen: adding and deleting keep the per-role numbers in step with the match screen', () => {
  const { $ } = runApp();
  $('demoBtn').click();
  // Delete the second student (roster position 1): the third student becomes #2 on both screens.
  $('peopleList').click({ getAttribute: (n) => (n === 'data-consent' ? null : n === 'data-del' ? '1' : null) });
  assert.deepEqual(cardLabels($('peopleList').innerHTML), ['סטודנט מלמד #1', 'סטודנט מלמד #2',
    'תלמיד #1', 'תלמיד #2', 'תלמיד #3', 'תלמיד #4']);
  assert.ok($('addStatus').textContent.indexOf('נמחק') === 0);
  // Add a pupil through the form: the status says which number it got, and that number is the one
  // the engine would use (pupils.length, since it is last among the pupils).
  $('role').value = 'pupil';
  $('region').value = 'SOUTH';
  $('subjects').click({ getAttribute: (n) => (n === 'data-subject' ? 'ENGLISH' : null), setAttribute() {} });
  $('hours').click({ getAttribute: (n) => (n === 'data-slot' ? 'WED_17' : null), setAttribute() {} });
  $('consent').checked = true;
  $('addPerson').click();
  assert.ok($('addStatus').textContent.indexOf('נוסף כתלמיד #5') === 0, $('addStatus').textContent);
  assert.equal(cardLabels($('peopleList').innerHTML).pop(), 'תלמיד #5');
  $('runMatch').click();
  // The new pupil shares SOUTH / WED_17 / ENGLISH with the SOUTH student, who was taken by pupil #3
  // (ranked first by input order), so pupil #5 is left out as TAKEN under the same number.
  assert.ok($('unmatched').innerHTML.indexOf('<b>תלמיד #5</b>') !== -1, $('unmatched').innerHTML);
});

test('people screen: the rule is the engine\'s - the label index equals the index matchPairs reports', () => {
  // Independent of the screen: for any roster, the ordinal within the role equals the position in the
  // list matchPairs / explainUnmatched index, so the two numberings can never drift apart.
  const roster = [
    { role: 'pupil', region: 'NORTH', availability: ['SUN_16'], subjects: ['MATH'], parentConsent: true },
    { role: 'student', region: 'NORTH', availability: ['SUN_16'], subjects: ['MATH'] },
    { role: 'pupil', region: 'NORTH', availability: ['SUN_16'], subjects: ['MATH'], parentConsent: true },
    { role: 'student', region: 'SOUTH', availability: ['SUN_16'], subjects: ['MATH'] }
  ].map(makeProfile);
  const students = roster.filter((p) => p.role === 'student');
  const pupils = roster.filter((p) => p.role === 'pupil');
  const pairs = matchPairs(students, pupils);
  const why = explainUnmatched(students, pupils, pairs);
  const ordinal = (i) => roster.slice(0, i + 1).filter((p) => p.role === roster[i].role).length;
  assert.deepEqual(roster.map((p, i) => p.role + ' #' + ordinal(i)), ['pupil #1', 'student #1', 'pupil #2', 'student #2']);
  assert.deepEqual(pairs.map((p) => [p.studentIndex + 1, p.pupilIndex + 1]), [[1, 1]]);
  assert.deepEqual(why.pupils.map((x) => x.index + 1), [2]);
  assert.deepEqual(why.students.map((x) => x.index + 1), [2]);
  // And the shell never shows the roster position as a label.
  const peopleBlock = app.slice(app.indexOf('function roleOrdinal'), app.indexOf('$(\'subjects\').addEventListener'));
  assert.ok(peopleBlock.indexOf('roleLabel(p, i)') !== -1, 'the card label comes from roleLabel');
  assert.equal(/'#' \+ \(i \+ 1\)|' #' \+ \(i \+ 1\)/.test(peopleBlock), false, 'no card is numbered by roster position');
});
