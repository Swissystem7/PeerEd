'use strict';
// check:i18n - dependency-free checks over the UI string tables:
//   missing-key   a key that one language of a translation table has and another lacks
//   empty-value   a UI string that is empty or only whitespace
//   unclosed-tag  a UI string whose HTML tags do not balance (e.g. "<b>bold" or "<p>..</div>")
// Translation tables are listed in TABLES below. Every other .js/.json file in MODULE_DIRS is loaded
// (read-only) and its exported strings are scanned for unclosed tags; label maps (objects with
// 3+ entries that are all strings) and per-language fields ({ he: '...' }) are checked for empty
// values, and a sibling list where some entries carry a language field and others do not is
// reported as missing-key (when at least 3/4 of 3+ siblings have it). Issues that existed when the check was added are listed in
// .i18n-baseline.json and reported; only NEW issues fail the run.
//   node <this file>                    check (exit 1 on new issues)
//   node <this file> --update-baseline  rewrite the baseline from the current state
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const BASELINE = path.join(ROOT, '.i18n-baseline.json');
const MODULE_DIRS = ['src/lib'];
// { name, langs: { code: [file, exportPath] } } - exportPath '' means the whole module export
const TABLES = [
  { name: 'i18n.STRINGS', langs: { he: ['src/lib/i18n.js', 'STRINGS.he'], ar: ['src/lib/i18n.js', 'STRINGS.ar'], ru: ['src/lib/i18n.js', 'STRINGS.ru'] } },
  { name: 'lang-extra', langs: { he: ['src/lib/lang-he.js', ''], ar: ['src/lib/lang-ar.js', ''], ru: ['src/lib/lang-ru.js', ''] } },
];
const LANG_KEYS = ['he', 'en', 'ar', 'ru'];
const VOID = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'source', 'track', 'wbr']);

const issues = [];
const add = (rule, where, detail) => issues.push({ rule, where, detail });

function jsFiles(dir) {
  const abs = path.join(ROOT, dir);
  if (!fs.existsSync(abs)) return [];
  return fs.readdirSync(abs, { withFileTypes: true }).flatMap((e) => {
    const rel = path.posix.join(dir, e.name);
    if (e.isDirectory()) return e.name === 'node_modules' ? [] : jsFiles(rel);
    return /\.(c?js|json)$/.test(e.name) ? [rel] : [];
  });
}

function load(file) {
  try {
    return { ok: true, value: require(path.join(ROOT, file)) };
  } catch (err) {
    return { ok: false, error: err };
  }
}

const at = (obj, p) => (p ? p.split('.').reduce((o, k) => (o == null ? o : o[k]), obj) : obj);

function unclosed(s) {
  if (typeof s !== 'string' || !/<\/?[a-z][a-z0-9-]*\b[^<>]*>/i.test(s)) return null;
  const stack = [];
  for (const m of s.matchAll(/<(\/?)([a-z][a-z0-9-]*)\b[^<>]*?(\/?)>/gi)) {
    const name = m[2].toLowerCase();
    if (VOID.has(name) || m[3]) continue;
    if (!m[1]) stack.push(name);
    else if (stack[stack.length - 1] === name) stack.pop();
    else return '</' + name + '> without matching open tag';
  }
  return stack.length ? '<' + stack.join('>, <') + '> not closed' : null;
}

const short = (s) => JSON.stringify(s.length > 60 ? s.slice(0, 57) + '...' : s);

function walk(value, where, seen, depth) {
  if (value == null || depth > 8) return;
  if (typeof value === 'string') {
    const u = unclosed(value);
    if (u) add('unclosed-tag', where, u + ' in ' + short(value));
    return;
  }
  if (typeof value !== 'object' || seen.has(value)) return;
  seen.add(value);
  const entries = Array.isArray(value) ? value.map((v, i) => [String(i), v]) : Object.entries(value);
  if (!Array.isArray(value)) {
    const vals = entries.map((e) => e[1]);
    if (vals.length >= 3 && vals.every((v) => typeof v === 'string')) {
      for (const [k, v] of entries) if (!v.trim()) add('empty-value', where + '.' + k, '""');
    }
    for (const lang of LANG_KEYS) {
      if (typeof value[lang] === 'string' && !value[lang].trim()) add('empty-value', where + '.' + lang, '""');
    }
  }
  const objs = entries.filter(([, v]) => v && typeof v === 'object' && !Array.isArray(v));
  if (objs.length >= 3) {
    for (const lang of LANG_KEYS) {
      const have = objs.filter(([, v]) => lang in v);
      if (have.length >= 2 && have.length < objs.length && have.length >= objs.length * 0.75) {
        for (const [k, v] of objs) if (!(lang in v)) add('missing-key', where + '.' + k, 'no "' + lang + '" while ' + have.length + '/' + objs.length + ' siblings have one');
      }
    }
  }
  for (const [k, v] of entries) walk(v, where + '.' + k, seen, depth + 1);
}

let tableKeys = 0;
const tableFiles = new Set();
for (const t of TABLES) {
  const dicts = {};
  for (const [lang, [file, p]] of Object.entries(t.langs)) {
    tableFiles.add(file);
    const r = load(file);
    const d = r.ok ? at(r.value, p) : null;
    if (!d || typeof d !== 'object') {
      add('missing-key', t.name + '.' + lang, 'table not loadable from ' + file + (p ? ' (' + p + ')' : ''));
      continue;
    }
    dicts[lang] = d;
  }
  const all = [...new Set(Object.values(dicts).flatMap((d) => Object.keys(d)))].sort();
  tableKeys += all.length;
  for (const [lang, d] of Object.entries(dicts)) {
    for (const k of all) {
      if (!(k in d)) add('missing-key', t.name + '.' + lang + '.' + k, 'present in ' + Object.keys(dicts).filter((l) => k in dicts[l]).join('/'));
      else if (typeof d[k] === 'string' && !d[k].trim()) add('empty-value', t.name + '.' + lang + '.' + k, '""');
      else if (typeof d[k] === 'string') {
        const u = unclosed(d[k]);
        if (u) add('unclosed-tag', t.name + '.' + lang + '.' + k, u + ' in ' + short(d[k]));
      }
    }
  }
}

let scanned = 0;
const skipped = [];
for (const file of MODULE_DIRS.flatMap(jsFiles)) {
  if (tableFiles.has(file)) continue;
  const r = load(file);
  if (!r.ok) {
    skipped.push(file);
    continue;
  }
  scanned += 1;
  walk(r.value, file, new WeakSet(), 0);
}

const key = (i) => i.rule + '|' + i.where + '|' + i.detail;
if (process.argv.includes('--update-baseline')) {
  const counts = {};
  for (const i of issues) counts[key(i)] = (counts[key(i)] || 0) + 1;
  fs.writeFileSync(BASELINE, JSON.stringify(counts, null, 2) + '\n');
  console.log('check:i18n: baseline written with ' + issues.length + ' existing issue(s)');
  process.exit(0);
}
const baseline = fs.existsSync(BASELINE) ? JSON.parse(fs.readFileSync(BASELINE, 'utf8')) : {};
const seenKeys = {};
const fresh = [];
let known = 0;
for (const i of issues) {
  const k = key(i);
  seenKeys[k] = (seenKeys[k] || 0) + 1;
  if (seenKeys[k] <= (baseline[k] || 0)) known += 1;
  else fresh.push(i);
}
const byRule = {};
for (const i of issues) byRule[i.rule] = (byRule[i.rule] || 0) + 1;
const summary = Object.keys(byRule).length ? Object.entries(byRule).map(([r, n]) => r + ' ' + n).join(', ') : 'none';
console.log(
  'check:i18n: ' + TABLES.length + ' translation table(s) (' + tableKeys + ' keys), ' + scanned + ' module(s) scanned' +
    (skipped.length ? ', ' + skipped.length + ' not loadable in Node (skipped)' : '') +
    '; issues: ' + summary + ' (' + known + ' known in baseline, ' + fresh.length + ' new)',
);
if (process.argv.includes('--verbose')) for (const f of skipped) console.log('  skipped ' + f);
for (const i of fresh) console.error('  NEW ' + i.rule + '  ' + i.where + '  ' + i.detail);
if (fresh.length) process.exitCode = 1;
