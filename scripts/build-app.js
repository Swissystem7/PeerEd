'use strict';
// Build app.html: the shell plus every tested module inlined, so the app is ONE file that opens from a
// phone or a static host with no bundler and no second copy of the logic. The modules are the same files
// the test suite runs; test/app-build.test.js fails if app.html is stale.
//
//   node scripts/build-app.js            write app.html
//   node scripts/build-app.js --check    exit 1 if app.html does not match a fresh build

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
// dependency order: a module may only require one listed before it
const ORDER = ['regions', 'profile', 'match', 'validator'];
const MARKER = '<!--MODULES-->';

function moduleBlock(name) {
  const code = fs.readFileSync(path.join(ROOT, 'src', 'lib', name + '.js'), 'utf8').replace(/\s+$/, '');
  return [
    '/* ===== src/lib/' + name + '.js ===== */',
    '(function () {',
    '  var module = { exports: {} };',
    '  var exports = module.exports;',
    code,
    '  __registry[' + JSON.stringify(name) + '] = module.exports;',
    '})();'
  ].join('\n');
}

function build() {
  const shell = fs.readFileSync(path.join(ROOT, 'src', 'app-shell.html'), 'utf8');
  if (shell.indexOf(MARKER) === -1) throw new Error('src/app-shell.html has no ' + MARKER + ' marker');
  const banner = '/* Built by scripts/build-app.js from src/lib/*.js - do not edit this block by hand. */';
  return shell.replace(MARKER, banner + '\n' + ORDER.map(moduleBlock).join('\n\n'));
}

function main() {
  const target = path.join(ROOT, 'app.html');
  const built = build();
  if (process.argv.includes('--check')) {
    const current = fs.existsSync(target) ? fs.readFileSync(target, 'utf8') : '';
    if (current !== built) {
      process.stderr.write('app.html is stale - run: node scripts/build-app.js\n');
      process.exit(1);
    }
    process.stdout.write('app.html is up to date\n');
    return;
  }
  fs.writeFileSync(target, built, 'utf8');
  process.stdout.write('wrote app.html (' + built.length + ' bytes, ' + ORDER.length + ' modules)\n');
}

if (require.main === module) main();
module.exports = { build, ORDER, MARKER };
