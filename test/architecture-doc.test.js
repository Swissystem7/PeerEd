'use strict';
// ARCHITECTURE.md lists the modules in build order. A module added to, renamed in or dropped from
// scripts/build-app.js would leave the doc describing an app that no longer exists; this keeps them equal.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const doc = fs.readFileSync(path.join(ROOT, 'ARCHITECTURE.md'), 'utf8');
const build = fs.readFileSync(path.join(ROOT, 'scripts', 'build-app.js'), 'utf8');

function buildOrder() {
  const m = /const ORDER = \[([^\]]*)\]/.exec(build);
  assert.ok(m, 'scripts/build-app.js should still declare const ORDER = [...]');
  return [...m[1].matchAll(/'([\w-]+)'/g)].map((x) => x[1]);
}

function documentedOrder() {
  const section = /## Modules, in build order\r?\n([\s\S]*?)\r?\n## /.exec(doc);
  assert.ok(section, 'ARCHITECTURE.md should still have a "Modules, in build order" section');
  return [...section[1].matchAll(/^\| `([\w-]+)` \|/gm)].map((x) => x[1]);
}

test('ARCHITECTURE.md lists exactly the build modules, in build order', () => {
  assert.deepEqual(documentedOrder(), buildOrder());
});

test('every module ARCHITECTURE.md lists exists under src/lib', () => {
  for (const name of documentedOrder()) {
    assert.ok(fs.existsSync(path.join(ROOT, 'src', 'lib', name + '.js')), 'src/lib/' + name + '.js is missing');
  }
});

test('every path in the ARCHITECTURE.md layout table exists', () => {
  const paths = [...doc.matchAll(/^\| `([^`*]+?)`/gm)].map((x) => x[1]).filter((p) => p.includes('/') || p.includes('.'));
  assert.ok(paths.length >= 5, 'the layout table should list the main paths');
  for (const p of paths) {
    assert.ok(fs.existsSync(path.join(ROOT, p.replace(/\/$/, ''))), p + ' is listed in ARCHITECTURE.md but does not exist');
  }
});
