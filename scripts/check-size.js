'use strict';
// Size budget for the files a phone actually downloads, measured with size-limit + @size-limit/file
// (brotli, the size-limit default). The repository promises no dependencies and no lockfile
// (test/readme-commands.test.js), so the tools are not devDependencies: `npm run check:size` fetches the
// pinned versions with `npx -p ...` and this script loads them from npx's own node_modules.
//
//   npm run check:size    exit 1 if any entry of .size-limit.json is over its limit

const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const ROOT = path.join(__dirname, '..');
const UNITS = { b: 1, kb: 1000, mb: 1000 * 1000 };

function npxModules() {
  for (const dir of (process.env.PATH || '').split(path.delimiter)) {
    if (path.basename(dir) === '.bin' && fs.existsSync(path.join(dir, '..', 'size-limit', 'package.json'))) {
      return path.dirname(dir);
    }
  }
  throw new Error('size-limit was not found on PATH - run this through `npm run check:size`');
}

function parseLimit(text) {
  const m = /^\s*([\d.]+)\s*(b|kb|mb)\s*$/i.exec(text);
  if (!m) throw new Error('cannot read size limit "' + text + '"');
  return Number(m[1]) * UNITS[m[2].toLowerCase()];
}

function expand(pattern) {
  if (!pattern.includes('*')) return [path.join(ROOT, pattern)];
  const dir = path.join(ROOT, path.dirname(pattern));
  const re = new RegExp('^' + path.basename(pattern).replace(/[.]/g, '\\.').replace(/\*/g, '[^/]*') + '$');
  return fs.readdirSync(dir).filter((name) => re.test(name)).sort().map((name) => path.join(dir, name));
}

async function main() {
  const modules = npxModules();
  const load = (name) => import(pathToFileURL(path.join(modules, name, 'index.js')).href);
  const sizeLimit = (await load('size-limit')).default;
  const filePlugin = (await load(path.join('@size-limit', 'file'))).default;
  const checks = JSON.parse(fs.readFileSync(path.join(ROOT, '.size-limit.json'), 'utf8'));
  let failed = false;
  for (const check of checks) {
    const files = expand(check.path);
    const [{ size }] = await sizeLimit([filePlugin], files);
    const limit = parseLimit(check.limit);
    const over = size > limit;
    if (over) failed = true;
    console.log((over ? 'FAIL ' : 'ok   ') + check.name + ': ' + (size / 1000).toFixed(2) + ' kB brotli, limit ' + check.limit + ' (' + files.length + ' file' + (files.length === 1 ? '' : 's') + ')');
  }
  if (failed) process.exitCode = 1;
}

main().catch((err) => {
  console.error(err.message);
  process.exitCode = 1;
});
