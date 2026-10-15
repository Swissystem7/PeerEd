'use strict';
// Contrast audit: the WCAG 2 arithmetic in scripts/contrast.js, and the audit of the shell's palette.
// The audit reads colours out of the stylesheet, so this is the test that fails when a palette edit
// makes a label, a status line or a flag unreadable.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const C = require('../scripts/contrast.js');

const ROOT = path.join(__dirname, '..');
const shell = fs.readFileSync(path.join(ROOT, 'src', 'app-shell.html'), 'utf8');

test('contrast: hex and rgb() forms are read, anything else is refused', () => {
  assert.deepEqual(C.parseColor('#fff'), { r: 255, g: 255, b: 255, a: 1 });
  assert.deepEqual(C.parseColor(' #0F1117 '), { r: 15, g: 17, b: 23, a: 1 });
  assert.deepEqual(C.parseColor('rgb(1, 2, 3)'), { r: 1, g: 2, b: 3, a: 1 });
  assert.deepEqual(C.parseColor('rgba(124,196,255,.16)'), { r: 124, g: 196, b: 255, a: 0.16 });
  for (const bad of ['white', 'var(--key)', '#ggg', '#12345', 'rgb(256,0,0)', 'hsl(0,0%,0%)', '', undefined]) {
    assert.throws(() => C.parseColor(bad), /invalid colour/, String(bad));
  }
});

test('contrast: the WCAG numbers - black on white is 21, a colour on itself is 1, #777 on white is just under AA', () => {
  assert.equal(C.contrast('#000', '#fff'), 21);
  assert.equal(C.contrast('#fff', '#000'), 21, 'the ratio does not depend on which one is the text');
  assert.equal(C.contrast('#7cc4ff', '#7cc4ff'), 1);
  assert.equal(Math.round(C.contrast('#777', '#fff') * 100) / 100, 4.48);
  assert.equal(Math.round(C.contrast('#767676', '#fff') * 100) / 100, 4.54, 'the classic AA grey');
  assert.equal(Math.round(C.luminance(C.parseColor('#808080')) * 1000) / 1000, 0.216);
});

test('contrast: a translucent colour is painted on what is under it before it is measured', () => {
  const top = C.parseColor('rgba(255,0,0,0)');
  assert.deepEqual(C.composite(top, C.parseColor('#123456')), C.parseColor('#123456'), 'alpha 0 is the colour under');
  assert.deepEqual(C.composite(C.parseColor('rgba(255,0,0,1)'), C.parseColor('#123456')), C.parseColor('#f00'));
  assert.deepEqual(C.composite(C.parseColor('rgba(255,255,255,.5)'), C.parseColor('#000')), C.parseColor('#808080'));
  assert.throws(() => C.composite(top, C.parseColor('rgba(0,0,0,.5)')), /must be opaque/);
  // the shell's banner: the same text on the same translucent tint reads differently over different parents
  assert.ok(C.contrast('#7cc4ff', 'rgba(124,196,255,.08)', '#0f1117') > C.contrast('#7cc4ff', 'rgba(124,196,255,.08)', '#171a23'));
  assert.throws(() => C.contrast('#fff', 'rgba(0,0,0,.5)'), /needs the colour under it/);
});

test('contrast: the stylesheet reader resolves var() anywhere in a value and refuses what it cannot find', () => {
  const css = ':root { --ink:#f2f4f8; --key:#7cc4ff; }\n' +
    'body { color:var(--ink); }\n' +
    'nav button:focus-visible { outline:2px solid var(--key); outline-offset:-2px; }\n' +
    '.x { background:none; border-color:var(--nope); }\n';
  assert.deepEqual(C.palette(css), { ink: '#f2f4f8', key: '#7cc4ff' });
  assert.equal(C.prop(css, 'body', 'color'), '#f2f4f8');
  assert.equal(C.prop(css, 'nav button:focus-visible', 'outline'), '2px solid #7cc4ff');
  assert.equal(C.prop(css, 'nav button:focus-visible', 'outline-offset'), '-2px', 'a property is not matched by its prefix');
  assert.throws(() => C.prop(css, '.x', 'border-color'), /unknown variable --nope/);
  assert.throws(() => C.prop(css, '.x', 'color'), /has no color/);
  assert.throws(() => C.prop(css, '.y', 'color'), /no rule for selector/);
  assert.throws(() => C.stylesheet('<html></html>'), /no <style> block/);
  assert.throws(() => C.palette('body { }'), /no :root rule/);
});

test('contrast: every text-on-background pair the shell paints meets WCAG AA (4.5:1), controls 3:1', () => {
  const rows = C.audit(shell);
  assert.ok(rows.length >= 20, 'the audit covers the shell, not a sample');
  const failed = rows.filter((r) => !r.ok).map((r) => r.what + ' ' + r.ratio + ':1 < ' + r.min + ':1');
  assert.deepEqual(failed, []);
  for (const r of rows) {
    assert.ok(r.ratio >= 1 && r.ratio <= 21, r.what);
    assert.equal(r.ratio, Math.round(r.ratio * 100) / 100, 'two decimals, so the printed table is what was judged');
  }
  assert.ok(rows.some((r) => r.under !== undefined), 'the translucent tints are measured over their parent');
  assert.ok(rows.some((r) => r.min === C.NON_TEXT), 'the focus ring and the selected-tab line are in');
  assert.equal(C.TEXT, 4.5);
  assert.equal(C.NON_TEXT, 3);
});

test('contrast: every colour the stylesheet paints text with is in the audit', () => {
  // A new text style with a colour nobody audited would otherwise slip past this file.
  const css = C.stylesheet(shell);
  const vars = C.palette(css);
  const painted = new Set();
  const re = /(?:^|[\s;{])color\s*:\s*([^;]+);/g;
  let m;
  while ((m = re.exec(css)) !== null) {
    const value = m[1].trim().replace(/var\(--([\w-]+)\)/g, (w, id) => vars[id]);
    if (value !== 'transparent') painted.add(value);
  }
  assert.ok(painted.size >= 5);
  const audited = new Set(C.pairs(css).map((p) => p.fg));
  for (const colour of painted) assert.ok(audited.has(colour), colour + ' is painted but not audited');
});

test('contrast: the audit follows the palette - dimming the muted grey fails it', () => {
  // Not a tautology: the same audit on a shell with one variable changed must say no.
  const dim = shell.replace('--muted:#9aa2b4', '--muted:#5a6070');
  assert.notEqual(dim, shell, 'the muted variable is where this test expects it');
  const failed = C.audit(dim).filter((r) => !r.ok);
  assert.ok(failed.length >= 5, 'every muted pair should fail');
  assert.ok(failed.every((r) => r.fg === '#5a6070'));
  assert.ok(failed.some((r) => r.what === 'tab bar, unselected tab'));
});

test('contrast: the script is a dev tool like build-app.js, never inlined into the app', () => {
  const app = fs.readFileSync(path.join(ROOT, 'app.html'), 'utf8');
  assert.equal(app.indexOf('scripts/contrast.js'), -1);
  assert.equal(app.indexOf('luminance'), -1);
  assert.equal(fs.existsSync(path.join(ROOT, 'src', 'lib', 'contrast.js')), false, 'it lives in scripts/, outside the build ORDER');
});
