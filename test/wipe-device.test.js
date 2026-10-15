'use strict';
// The wipe button on the people screen: everything the app holds - roster, approval queue, session log -
// sits under one key of the browser's storage, and ending a pilot or handing the phone on means that key
// is removed, not overwritten with an empty document. The screen asks twice (a second click on the same
// button, or cancel), empties the in-memory state and every screen, and says whether the storage obeyed.
//
// Same idea as test-support/fake-dom.js: the built app runs under node:vm against a small fake
// DOM. Here the fake window also offers a localStorage, so the test can look at the key itself.
const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');

const { build } = require('../scripts/build-app.js');
const { DEFAULT_KEY } = require('../src/lib/store.js');

const ROOT = path.join(__dirname, '..');
const shell = fs.readFileSync(path.join(ROOT, 'src', 'app-shell.html'), 'utf8');
const app = shell.slice(shell.lastIndexOf('<script>'));
const TAB_IDS = ['nav-people', 'nav-match', 'nav-text', 'nav-units', 'nav-sessions'];

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

// A Web Storage shaped backend the test can inspect. `refuseRemove` makes removeItem throw, the way a
// browser with a locked storage would, while reads and writes still work.
function fakeStorage(opts = {}) {
  const items = {};
  return {
    items,
    getItem(key) { return Object.prototype.hasOwnProperty.call(items, key) ? items[key] : null; },
    setItem(key, value) { items[key] = String(value); },
    removeItem(key) {
      if (opts.refuseRemove) throw new Error('storage is locked');
      delete items[key];
    }
  };
}

function runApp(storage) {
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
    window: {
      scrollTo() {},
      get localStorage() {
        if (!storage) throw new Error('no storage in the test');
        return storage;
      }
    }
  };
  context.window.document = document;
  vm.createContext(context);
  scriptBlocks(build()).forEach((code, i) => vm.runInContext(code, context, { filename: 'app.html#' + i }));
  return { $: byId, context };
}

function attrValue(html, name) {
  const at = html.indexOf(name + '="');
  assert.notEqual(at, -1, name + ' is in the html');
  const from = at + name.length + 2;
  return html.slice(from, html.indexOf('"', from));
}
function clickWith(el, attr, value) {
  el.click({ getAttribute: (n) => (n === attr ? value : null), setAttribute() {} });
}

// Roster, one approved unit and one logged session: a device that has been used for a while.
function fillDevice($) {
  $('demoBtn').click();
  $('unitDemoBtn').click();
  $('submitUnit').click();
  const unitId = attrValue($('pendingList').innerHTML, 'data-approve');
  clickWith($('pendingList'), 'data-approve', unitId);
  assert.equal($('approvedList').innerHTML.indexOf('<div class="item') !== -1, true, 'the unit is approved');
  $('nav-sessions').click();
  $('sessionPair').value = '0';
  $('sessionSlot').value = 'SUN_16';
  $('sessionSubject').value = 'MATH';
  $('sessionUnit').value = unitId;
  $('sessionOutcome').value = 'held';
  $('logSession').click();
  assert.equal($('sessionStatus').textContent.indexOf('נרשם שיעור 1') === 0, true, $('sessionStatus').textContent);
  $('nav-people').click();
  return unitId;
}

test('wipe: the first click only arms the button; nothing is deleted until the second click', () => {
  const storage = fakeStorage();
  const { $ } = runApp(storage);
  fillDevice($);
  assert.equal(typeof storage.items[DEFAULT_KEY], 'string', 'the device holds a document');
  assert.equal($('wipeCancel').hidden, true);

  $('wipeBtn').click();
  assert.equal($('wipeBtn').textContent, 'כן, מחק הכול');
  assert.equal($('wipeCancel').hidden, false);
  assert.equal($('wipeStatus').textContent.indexOf('יימחקו 7 משתתפים, 1 יחידות ו-1 שיעורים') === 0, true,
    $('wipeStatus').textContent);
  assert.equal(typeof storage.items[DEFAULT_KEY], 'string', 'arming deletes nothing');
  assert.equal($('peopleList').innerHTML.split('<div class="item">').length - 1, 7, 'the cards are still there');

  $('wipeBtn').click();
  assert.equal(storage.getItem(DEFAULT_KEY), null, 'the key is removed, not overwritten');
  assert.equal(Object.keys(storage.items).length, 0, 'and nothing else was written in its place');
  assert.equal($('wipeStatus').textContent.indexOf('נמחק.') === 0, true, $('wipeStatus').textContent);
  assert.equal($('wipeStatus').className, 'status');
  assert.equal($('wipeBtn').textContent, 'מחק הכול מהמכשיר הזה');
  assert.equal($('wipeCancel').hidden, true);
  // Every screen is empty, not only the people screen.
  assert.equal($('peopleList').innerHTML.indexOf('אין עדיין משתתפים') !== -1, true);
  assert.equal($('pendingList').innerHTML.indexOf('<div class="item'), -1);
  assert.equal($('approvedList').innerHTML.indexOf('<div class="item'), -1);
  assert.equal($('sessionSummary').innerHTML.indexOf('עדיין לא נרשם שיעור') !== -1, true);
  assert.equal($('sessionList').innerHTML.indexOf('היומן ריק') !== -1, true);
  assert.equal($('sessionPair').disabled, true, 'no pair to log a session for');
  assert.equal($('reportBox').hidden, true);
  assert.equal($('addStatus').textContent, '', 'stale status lines are cleared');
  assert.equal($('sessionStatus').textContent, '');
  // The device starts over cleanly: a new demo numbers from #1 again and is stored under the key.
  $('demoBtn').click();
  assert.equal($('peopleList').innerHTML.indexOf('<b>סטודנט מלמד #1</b>') !== -1, true);
  assert.equal(typeof storage.items[DEFAULT_KEY], 'string');
});

test('wipe: a reload after the wipe finds an empty device and reports no problem', () => {
  const storage = fakeStorage();
  const first = runApp(storage);
  fillDevice(first.$);
  first.$('wipeBtn').click();
  first.$('wipeBtn').click();
  const second = runApp(storage);
  assert.equal(second.$('addStatus').textContent, '', 'no stored document means no complaint on load');
  assert.equal(second.$('peopleList').innerHTML.indexOf('אין עדיין משתתפים') !== -1, true);
  assert.equal(second.$('approvedList').innerHTML.indexOf('<div class="item'), -1);
  assert.equal(second.$('sessionList').innerHTML.indexOf('היומן ריק') !== -1, true);
});

test('wipe: cancel disarms the button and deletes nothing', () => {
  const storage = fakeStorage();
  const { $ } = runApp(storage);
  fillDevice($);
  const before = storage.items[DEFAULT_KEY];
  $('wipeBtn').click();
  $('wipeCancel').click();
  assert.equal($('wipeBtn').textContent, 'מחק הכול מהמכשיר הזה');
  assert.equal($('wipeCancel').hidden, true);
  assert.equal($('wipeStatus').textContent, 'בוטל. לא נמחק דבר.');
  assert.equal(storage.items[DEFAULT_KEY], before, 'the document is byte for byte what it was');
  assert.equal($('peopleList').innerHTML.split('<div class="item">').length - 1, 7);
  // The next click arms again rather than deleting: cancel is a real reset of the two-step.
  $('wipeBtn').click();
  assert.equal($('wipeBtn').textContent, 'כן, מחק הכול');
  assert.equal(storage.items[DEFAULT_KEY], before);
});

test('wipe: a storage that refuses to remove the key still loses the screen, and the status says so', () => {
  const storage = fakeStorage({ refuseRemove: true });
  const { $ } = runApp(storage);
  fillDevice($);
  $('wipeBtn').click();
  $('wipeBtn').click();
  assert.equal(typeof storage.items[DEFAULT_KEY], 'string', 'the browser kept the key');
  assert.equal($('peopleList').innerHTML.indexOf('אין עדיין משתתפים') !== -1, true, 'but the roster is off the screen');
  assert.equal($('approvedList').innerHTML.indexOf('<div class="item'), -1);
  assert.equal($('wipeStatus').className, 'status bad');
  assert.equal($('wipeStatus').textContent.indexOf('הדפדפן לא אפשר למחוק') !== -1, true, $('wipeStatus').textContent);
});

test('wipe: without any storage (private mode) the wipe still empties the screen and reports success', () => {
  const { $ } = runApp(null);
  $('demoBtn').click();
  $('wipeBtn').click();
  $('wipeBtn').click();
  assert.equal($('peopleList').innerHTML.indexOf('אין עדיין משתתפים') !== -1, true);
  assert.equal($('wipeStatus').textContent.indexOf('נמחק.') === 0, true, $('wipeStatus').textContent);
});

test('wipe: the shell removes the key through store.clear and never saves an empty document instead', () => {
  const block = app.slice(app.indexOf('wipe this device'), app.indexOf('---------- tabs'));
  assert.notEqual(block.length, 0, 'the wipe block is in the shell');
  assert.equal(block.indexOf('store.clear()') !== -1, true, 'the key is removed through the store module');
  assert.equal(block.indexOf('save()'), -1, 'a wipe is not a save of an empty state');
  assert.equal(block.indexOf('confirm('), -1, 'no window.confirm');
  assert.equal(block.indexOf('storeLib.emptyState()') !== -1, true, 'the fresh state comes from the store module');
});
