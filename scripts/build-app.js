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
const ORDER = ['regions', 'profile', 'match', 'validator', 'unit'];
const MARKER = '<!--MODULES-->';

// Every input is normalized to LF before it is joined. On a Windows checkout (git autocrlf) the shell and
// the modules arrive with CRLF while the blocks are joined with LF, so the build was a mixed-ending file
// that never equalled the app.html on disk: the staleness test failed on every laptop and passed on CI.
function lf(text) {
  return String(text).replace(/\r\n?/g, '\n');
}

function moduleBlock(name, code) {
  return [
    '/* ===== src/lib/' + name + '.js ===== */',
    '(function () {',
    '  var module = { exports: {} };',
    '  var exports = module.exports;',
    code.replace(/\s+$/, ''),
    '  __registry[' + JSON.stringify(name) + '] = module.exports;',
    '})();'
  ].join('\n');
}

function build(opts = {}) {
  const shell = lf(fs.readFileSync(path.join(ROOT, 'src', 'app-shell.html'), 'utf8'));
  if (shell.indexOf(MARKER) === -1) throw new Error('src/app-shell.html has no ' + MARKER + ' marker');
  const banner = '/* Built by scripts/build-app.js from src/lib/*.js - do not edit this block by hand. */';
  
  const overrides = opts.modules || {};
  
  const blocks = ORDER.map((name, index) => {
    const code = lf(overrides[name] !== undefined
      ? overrides[name]
      : fs.readFileSync(path.join(ROOT, 'src', 'lib', name + '.js'), 'utf8'));
    
    const reqRe = /require\(['"]\.\/([^'"]+)\.js['"]\)/g;
    let m;
    while ((m = reqRe.exec(code)) !== null) {
      const dep = m[1];
      const depIdx = ORDER.indexOf(dep);
      if (depIdx === -1) {
        throw new Error(`Module '${name}' requires '${dep}', which is not in ORDER.`);
      }
      if (depIdx >= index) {
        throw new Error(`Module '${name}' requires '${dep}', which is loaded after it in ORDER.`);
      }
    }
    
    return moduleBlock(name, code);
  });

  // A function replacer, not a replacement string: module code is arbitrary JavaScript, and a "$&" or
  // "$'" inside a regex or a string literal would otherwise be expanded here and inline the wrong text.
  const payload = banner + '\n' + blocks.join('\n\n');
  return shell.replace(MARKER, () => payload);
}

function main() {
  const target = path.join(ROOT, 'app.html');
  const built = build();
  if (process.argv.includes('--check')) {
    const current = fs.existsSync(target) ? lf(fs.readFileSync(target, 'utf8')) : '';
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
module.exports = { build, lf, ORDER, MARKER };
