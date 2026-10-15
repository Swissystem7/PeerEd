'use strict';
// MVP item 7, the "works without network" half: a static check that nothing in the core or the shell
// can reach out. The patterns are deliberately broad; a false positive costs a clearer comment, a false
// negative costs the whole privacy promise.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const LIB = path.join(ROOT, 'src', 'lib');

// Ways JavaScript can leave the file.
const CALLS = [
  /\bfetch\s*\(/, /XMLHttpRequest/, /WebSocket/, /EventSource/, /sendBeacon/, /importScripts/,
  /\bimport\s*\(/, /require\(['"](node:)?(http|https|net|dns|tls|dgram|child_process)['"]\)/,
  /navigator\.onLine/, /serviceWorker/
];
// Ways HTML can leave the file: anything with a src or href that is not a fragment, plus CSS url()
// (lower case on purpose: URL.createObjectURL(...) is the CSV download, it never leaves the page).
const MARKUP = [
  /<script[^>]+src=/i, /<link\b/i, /<iframe/i, /<img/i, /<video/i, /<audio/i, /<object/i, /<embed/i,
  /\bhref=["'](?!#)/i, /\burl\(/, /@import/i, /https?:\/\/[a-z0-9]/i
];

function offenders(text, patterns) {
  return patterns.filter((re) => re.test(text)).map(String);
}

test('offline: no module in src/lib can reach the network', () => {
  const files = fs.readdirSync(LIB).filter((f) => f.endsWith('.js')).sort();
  assert.ok(files.indexOf('store.js') !== -1, 'expected the MVP modules in src/lib');
  for (const f of files) {
    assert.deepEqual(offenders(fs.readFileSync(path.join(LIB, f), 'utf8'), CALLS), [], f);
  }
});

test('offline: the app shell and the built app load nothing from outside the file', () => {
  for (const name of ['src/app-shell.html', 'app.html']) {
    const html = fs.readFileSync(path.join(ROOT, name), 'utf8');
    assert.deepEqual(offenders(html, CALLS), [], name);
    // The markup patterns run on the markup. The inlined modules hold two URLs as text (contact.js: the
    // feedback form and the issue form the user may click); a string is not the page loading anything,
    // and the first assertion already proves no code path reaches out.
    const markup = html.replace(/<script>[\s\S]*?<\/script>/g, '');
    assert.deepEqual(offenders(markup, MARKUP), [], name);
  }
});

test('offline: the check itself catches a script tag with a src, a stylesheet and a fetch call', () => {
  assert.ok(offenders('<script src="https://cdn.example.com/x.js"></script>', MARKUP).length >= 2);
  assert.ok(offenders('<link rel="stylesheet" href="x.css">', MARKUP).length >= 2);
  assert.equal(offenders('fetch("/api")', CALLS).length, 1);
  assert.deepEqual(offenders('const x = require("./regions.js"); // a fetched pupil', CALLS), []);
  assert.deepEqual(offenders('<a href="#tab-match">', MARKUP), []);
});
