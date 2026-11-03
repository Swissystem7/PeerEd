'use strict';
// A reviewer or a municipality runs the Quickstart verbatim. The commands live in three places that
// drift independently - the README prose, the package.json scripts and the CI workflow - and nothing
// held them together: the README could document `npm run build` with no such script, or a script could
// point at a deleted file, and the suite would stay green. These tests are that missing guard.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const readme = fs.readFileSync(path.join(ROOT, 'README.md'), 'utf8');
const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));

// The commands of the Quickstart shell block, without their trailing `# ...` explanations.
function quickstartCommands() {
  const block = /## Quickstart[\s\S]*?```sh\r?\n([\s\S]*?)```/.exec(readme);
  assert.ok(block, 'the Quickstart section should still hold a ```sh block');
  return block[1].split(/\r?\n/).map((line) => line.replace(/#.*$/, '').trim()).filter(Boolean);
}

test('README: every command the Quickstart documents can actually be run', () => {
  const commands = quickstartCommands();
  assert.ok(commands.length >= 3, 'the Quickstart should document the suite, a single file and the build');
  for (const cmd of commands) {
    let m;
    if ((m = /^npm run ([\w:-]+)$/.exec(cmd)) || (m = /^npm (test)$/.exec(cmd))) {
      assert.ok(pkg.scripts[m[1]], 'the README runs "' + cmd + '", but package.json has no "' + m[1] + '" script');
    } else if ((m = /^node --test (\S+)$/.exec(cmd))) {
      assert.ok(fs.existsSync(path.join(ROOT, m[1])), 'the README runs "' + cmd + '", but ' + m[1] + ' does not exist');
    } else {
      assert.fail('unrecognised Quickstart command "' + cmd + '": teach this test how to check it');
    }
  }
});

test('every npm script points at a file that exists', () => {
  for (const name of Object.keys(pkg.scripts)) {
    const file = (/\b(scripts\/[\w.-]+\.js)\b/.exec(pkg.scripts[name]) || [])[1];
    if (file) {
      assert.ok(fs.existsSync(path.join(ROOT, file)), 'the "' + name + '" script runs ' + file + ', which does not exist');
    }
  }
});

test('README: no npm script is left undocumented', () => {
  // Exact command matching, not a substring: "npm run build:check" must not vouch for "build".
  const commands = new Set(quickstartCommands());
  for (const name of Object.keys(pkg.scripts)) {
    const documented = commands.has('npm run ' + name) || (name === 'test' && commands.has('npm test'));
    assert.ok(documented, 'package.json has a "' + name + '" script the Quickstart never mentions');
  }
});

test('README: the Node version the prose promises is the one package.json enforces', () => {
  const floor = /Node (\d+) or newer/.exec(readme);
  assert.ok(floor, 'the README should still state the minimum Node version');
  assert.equal(pkg.engines.node, '>=' + floor[1], 'the README and package.json engines disagree');
});

test('README: the no-install promise holds - no lockfile and no dependency', () => {
  // The README tells the reader to skip `npm install` and warns that `npm ci` fails by design.
  // Committing a lockfile or a dependency would make that paragraph a lie on the first page.
  for (const lock of ['package-lock.json', 'npm-shrinkwrap.json', 'yarn.lock', 'pnpm-lock.yaml']) {
    assert.equal(fs.existsSync(path.join(ROOT, lock)), false,
      'the README says there is no lockfile, but ' + lock + ' is committed');
  }
  assert.equal(pkg.dependencies, undefined, 'the README promises no dependencies');
  assert.equal(pkg.devDependencies, undefined, 'the README promises no dependencies');
});

test('README: build:check really is the CI gate the README calls it', () => {
  const workflow = fs.readFileSync(path.join(ROOT, '.github', 'workflows', 'test.yml'), 'utf8');
  const script = pkg.scripts['build:check'];
  assert.ok(script, 'package.json has no "build:check" script');
  // CI may invoke the script or the command it wraps; the README's claim holds either way.
  assert.ok(workflow.includes('npm run build:check') || workflow.includes(script),
    'the README calls build:check a CI gate, but the workflow runs neither it nor "' + script + '"');
  assert.ok(workflow.includes('npm test') || workflow.includes('npm run test'),
    'the workflow should run the suite');
});
