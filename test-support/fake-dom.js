'use strict';
// Lives outside test/ on purpose: node --test would count a file with no tests as a passing test.
// Shared harness, no tests of its own: runs the real app.html in a tiny fake DOM so a test can press the
// buttons a coordinator presses and read what the screen would show. Only what app.html touches is faked.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.join(__dirname, '..');  // test-support/ sits next to test/

function fakeElement(id) {
  const handlers = {};
  const attrs = {};
  return {
    id, value: '', textContent: '', className: '', innerHTML: '', hidden: false, children: [], style: {},
    href: '', download: '', clicked: 0, focused: false,
    addEventListener(type, fn) { (handlers[type] = handlers[type] || []).push(fn); },
    setAttribute(k, v) { attrs[k] = String(v); },
    getAttribute(k) { return k in attrs ? attrs[k] : null; },
    removeAttribute(k) { delete attrs[k]; },
    appendChild() {}, removeChild() {},
    click() { this.clicked += 1; },
    focus() { this.focused = true; },
    fire(type, ev) { (handlers[type] || []).forEach((fn) => fn(ev || { target: this })); }
  };
}

// opts.store: initial localStorage content. opts.saveFails: setItem throws, like a full or blocked
// storage. Returns $ (element lookup) plus what the app handed out
// (downloads: every Blob the app turned into a file, with its text).
function openApp(opts) {
  opts = opts || {};
  const html = fs.readFileSync(path.join(ROOT, 'app.html'), 'utf8');
  const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
  if (scripts.length < 3) throw new Error('app.html should carry its scripts inline');
  const initialAttrs = {};
  for (const m of html.matchAll(/<([a-z0-9-]+)\b([^>]*)>/gi)) {
    const tagAttrs = m[2];
    const idMatch = tagAttrs.match(/\bid="([^"]+)"/);
    if (!idMatch) continue;
    const id = idMatch[1];
    initialAttrs[id] = initialAttrs[id] || {};
    if (/\bhidden\b/.test(tagAttrs)) initialAttrs[id].hidden = true;
    for (const attrMatch of tagAttrs.matchAll(/\b([a-z0-9-]+)="([^"]*)"/gi)) {
      initialAttrs[id][attrMatch[1]] = attrMatch[2];
    }
  }
  const els = {};
  const $ = (id) => {
    if (!els[id]) {
      const el = fakeElement(id);
      if (initialAttrs[id]) {
        if (initialAttrs[id].hidden) el.hidden = true;
        for (const [k, v] of Object.entries(initialAttrs[id])) {
          if (k !== 'hidden') el.setAttribute(k, v);
        }
      }
      els[id] = el;
    }
    return els[id];
  };
  const store = Object.assign({}, opts.store || {});
  const downloads = [];
  const created = [];
  class FakeBlob { constructor(parts, o) { this.text = parts.join(''); this.type = (o && o.type) || ''; } }
  const localStorage = {
    getItem: (k) => (k in store ? store[k] : null),
    setItem: (k, v) => {
      if (opts.saveFails) throw new Error('QuotaExceededError');
      store[k] = String(v);
    },
    removeItem: (k) => { delete store[k]; }
  };
  const ctx = {
    document: {
      getElementById: $,
      querySelectorAll: (sel) => {
        if (sel === '[role="tab"]') {
          return ['nav-people', 'nav-match', 'nav-text', 'nav-units', 'nav-sessions'].map($);
        }
        return [];
      },
      createElement: (tag) => { const e = fakeElement('<' + tag + '>'); created.push(e); return e; },
      body: fakeElement('body')
    },
    // the app reads window.localStorage, so opts.store only reaches it through window
    localStorage: localStorage,
    window: { scrollTo() {}, localStorage: localStorage },
    Blob: FakeBlob,
    URL: {
      createObjectURL: (b) => { downloads.push(b); return 'blob:fake/' + downloads.length; },
      revokeObjectURL() {}
    },
    setTimeout: (fn) => fn(),
    console
  };
  vm.createContext(ctx);
  for (const code of scripts) vm.runInContext(code, ctx);
  $.downloads = downloads;
  $.created = created;
  $.store = store;
  return $;
}

function press(el, attr, value) {
  el.fire('click', { target: { getAttribute: (k) => (k === attr ? value : null), setAttribute() {} } });
}

// Add one participant through the form, exactly as a coordinator would.
function addPerson($, role, region, subjects, slots) {
  $('role').value = role;
  $('consentRow').hidden = role !== 'pupil';
  if (role === 'pupil') $('consent').checked = true;
  $('region').value = region;
  $('consent').checked = role === 'pupil';  // the coordinator ticks parent consent (a pupil without it is never paired)
  subjects.forEach((s) => press($('subjects'), 'data-subject', s));
  slots.forEach((s) => press($('hours'), 'data-slot', s));
  $('addPerson').fire('click');
  if ($('addStatus').className.includes('bad')) throw new Error('add refused: ' + $('addStatus').textContent);
}

// innerHTML -> visible text, one line per block.
function text(html) {
  return String(html).replace(/<br>/g, '\n').replace(/<\/(div|p|li|b)>/g, '\n').replace(/<[^>]+>/g, '')
    .replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
}

module.exports = { openApp, press, addPerson, text, ROOT };
