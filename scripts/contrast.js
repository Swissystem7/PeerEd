'use strict';
// Contrast audit of the shell's colours, the WCAG 2 arithmetic in plain JavaScript. A dev tool like
// build-app.js, not an app module: nothing here is inlined into app.html. test/contrast.test.js runs
// the audit on every test run, so a palette edit that makes a label unreadable fails the suite instead
// of waiting for someone with weaker eyes to notice.
//
//   node scripts/contrast.js            print every audited pair and its ratio
//   node scripts/contrast.js --check    exit 1 if any pair is below its minimum
//
// Thresholds are WCAG 2.1: 4.5:1 for text (success criterion 1.4.3, AA), 3:1 for the visual parts of
// a control such as a focus ring or the selected-tab line (1.4.11, non-text contrast).

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const TEXT = 4.5;
const NON_TEXT = 3;

// '#rgb', '#rrggbb', 'rgb(r,g,b)', 'rgba(r,g,b,a)' -> { r, g, b, a }. Anything else is refused: a
// colour that cannot be parsed cannot be audited, and a silent guess would hide exactly the mistake
// the audit exists to catch.
function parseColor(text) {
  const s = String(text).trim();
  let m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(s);
  if (m) {
    const hex = m[1].length === 3 ? m[1].split('').map((c) => c + c).join('') : m[1];
    const n = parseInt(hex, 16);
    return { r: n >> 16, g: (n >> 8) & 255, b: n & 255, a: 1 };
  }
  m = /^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*(0|1|0?\.\d+)\s*)?\)$/i.exec(s);
  if (m) {
    const c = [m[1], m[2], m[3]].map(Number);
    if (c.some((v) => v > 255)) throw new Error('invalid colour: ' + s);
    return { r: c[0], g: c[1], b: c[2], a: m[4] === undefined ? 1 : Number(m[4]) };
  }
  throw new Error('invalid colour: ' + s);
}

// Source-over compositing of a translucent colour on an opaque one, the way the browser paints a
// rgba() background over the element behind it. The result is opaque.
function composite(top, under) {
  if (under.a !== 1) throw new Error('the colour under a translucent one must be opaque');
  const a = top.a;
  return {
    r: Math.round(top.r * a + under.r * (1 - a)),
    g: Math.round(top.g * a + under.g * (1 - a)),
    b: Math.round(top.b * a + under.b * (1 - a)),
    a: 1
  };
}

function channel(v) {
  const c = v / 255;
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

// Relative luminance of an opaque colour, the WCAG 2 definition over sRGB.
function luminance(color) {
  return 0.2126 * channel(color.r) + 0.7152 * channel(color.g) + 0.0722 * channel(color.b);
}

// Contrast ratio between a foreground and a background, 1 to 21. A translucent background is painted
// on `under` first (which must then be given), a translucent foreground on the background.
function contrast(fg, bg, under) {
  let back = parseColor(bg);
  if (back.a < 1) {
    if (under === undefined) throw new Error('a translucent background needs the colour under it');
    back = composite(back, parseColor(under));
  }
  let front = parseColor(fg);
  if (front.a < 1) front = composite(front, back);
  const l1 = luminance(front);
  const l2 = luminance(back);
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
}

// ---------- reading the shell's stylesheet

function stylesheet(html) {
  const open = html.indexOf('<style>');
  const close = html.indexOf('</style>');
  if (open === -1 || close === -1) throw new Error('no <style> block in the shell');
  return html.slice(open + '<style>'.length, close);
}

// The custom properties declared on :root, { bg: '#0f1117', ... }.
function palette(css) {
  const m = /:root\s*\{([^}]*)\}/.exec(css);
  if (!m) throw new Error('no :root rule in the shell');
  const out = {};
  const re = /--([a-z][\w-]*)\s*:\s*([^;]+);/gi;
  let d;
  while ((d = re.exec(m[1])) !== null) out[d[1]] = d[2].trim();
  return out;
}

// The declarations of the rule whose selector list is exactly `selector`.
function rule(css, selector) {
  const re = /([^{}]+)\{([^}]*)\}/g;
  let m;
  while ((m = re.exec(css)) !== null) {
    if (m[1].trim() === selector) return m[2];
  }
  throw new Error('no rule for selector: ' + selector);
}

// The value of one property in a rule, with var(--x) resolved through the palette.
function prop(css, selector, name) {
  const decls = rule(css, selector);
  const re = new RegExp('(?:^|;)\\s*' + name + '\\s*:\\s*([^;]+)');
  const m = re.exec(decls);
  if (!m) throw new Error(selector + ' has no ' + name);
  const vars = palette(css);
  return m[1].trim().replace(/var\(--([\w-]+)\)/g, (whole, id) => {
    if (!(id in vars)) throw new Error('unknown variable --' + id + ' in ' + selector);
    return vars[id];
  });
}

// Every text-on-background pair the shell paints, read from the stylesheet rather than copied here,
// so the audit follows a palette edit. `under` is what a translucent background is painted over:
// the element's parent, as laid out in the shell's HTML.
function pairs(css) {
  const v = palette(css);
  const field = prop(css, 'input, select, textarea', 'background');
  const nav = prop(css, 'nav', 'background');
  const item = prop(css, '.item', 'background');
  const ink = prop(css, 'body', 'color');
  return [
    { what: 'body text', fg: ink, bg: v.bg, min: TEXT },
    { what: 'card border', fg: prop(css, '.card', 'border').split(/\s+/).pop(), bg: v.bg, min: NON_TEXT },
    { what: 'form-field border', fg: prop(css, 'input, select, textarea', 'border').split(/\s+/).pop(), bg: v.card, min: NON_TEXT },
    { what: 'muted text on the page (header)', fg: prop(css, 'header p', 'color'), bg: v.bg, min: TEXT },
    { what: 'muted text in a card (label, hint, empty)', fg: prop(css, 'label', 'color'), bg: v.card, min: TEXT },
    { what: 'card heading', fg: ink, bg: v.card, min: TEXT },
    { what: 'consent checkbox label', fg: prop(css, 'label.check', 'color'), bg: v.card, min: TEXT },
    { what: 'tab bar, unselected tab', fg: prop(css, 'nav button', 'color'), bg: nav, min: TEXT },
    { what: 'tab bar, selected tab', fg: prop(css, 'nav button[aria-selected="true"]', 'color'), bg: nav, min: TEXT },
    { what: 'tab bar, selected-tab line', fg: prop(css, 'nav button[aria-selected="true"]', 'border-top-color'), bg: nav, min: NON_TEXT },
    { what: 'tab bar, focus ring', fg: prop(css, 'nav button:focus-visible', 'outline').split(/\s+/).pop(), bg: nav, min: NON_TEXT },
    { what: 'typed text in a field', fg: prop(css, 'input, select, textarea', 'color'), bg: field, min: TEXT },
    { what: 'primary button', fg: prop(css, 'button.act', 'color'), bg: prop(css, 'button.act', 'background'), min: TEXT },
    { what: 'secondary button', fg: prop(css, 'button.ghost', 'color'), bg: prop(css, 'button.ghost', 'background'), min: TEXT },
    { what: 'subject chip', fg: prop(css, '.chip', 'color'), bg: prop(css, '.chip', 'background'), min: TEXT },
    { what: 'subject chip, pressed', fg: prop(css, '.chip[aria-pressed="true"]', 'color'),
      bg: prop(css, '.chip[aria-pressed="true"]', 'background'), under: v.card, min: TEXT },
    { what: 'hours grid, day and hour labels', fg: prop(css, '.grid-hours span', 'color'), bg: v.card, min: TEXT },
    { what: 'hours grid, pressed slot', fg: prop(css, '.grid-hours button[aria-pressed="true"]', 'color'),
      bg: prop(css, '.grid-hours button[aria-pressed="true"]', 'background'), min: TEXT },
    { what: 'list item, title', fg: ink, bg: item, min: TEXT },
    { what: 'list item, meta line', fg: prop(css, '.item .meta', 'color'), bg: item, min: TEXT },
    { what: 'pill', fg: prop(css, '.pill', 'color'), bg: prop(css, '.pill', 'background'), min: TEXT },
    { what: 'status line, ok', fg: prop(css, '.status', 'color'), bg: v.card, min: TEXT },
    { what: 'status line, error', fg: prop(css, '.status.bad', 'color'), bg: v.card, min: TEXT },
    { what: 'banner', fg: prop(css, '.banner', 'color'), bg: prop(css, '.banner', 'background'), under: v.bg, min: TEXT },
    { what: 'flag in a card (text gate findings)', fg: prop(css, '.flag', 'color'), bg: prop(css, '.flag', 'background'), under: v.card, min: TEXT },
    { what: 'flag in a list item (rejection reason)', fg: prop(css, '.flag', 'color'), bg: prop(css, '.flag', 'background'), under: item, min: TEXT }
  ];
}

// Run the audit on a shell: every pair with its ratio, rounded to two decimals, and whether it passes.
function audit(html) {
  const css = stylesheet(html);
  return pairs(css).map((p) => {
    const ratio = Math.round(contrast(p.fg, p.bg, p.under) * 100) / 100;
    return { what: p.what, fg: p.fg, bg: p.bg, under: p.under, ratio, min: p.min, ok: ratio >= p.min };
  });
}

function main() {
  const html = fs.readFileSync(path.join(ROOT, 'src', 'app-shell.html'), 'utf8');
  const rows = audit(html);
  const width = Math.max.apply(null, rows.map((r) => r.what.length));
  for (const r of rows) {
    process.stdout.write((r.ok ? 'ok   ' : 'FAIL ') + r.what.padEnd(width) + '  ' +
      r.ratio.toFixed(2).padStart(6) + ':1  (min ' + r.min + ':1)  ' + r.fg + ' on ' + r.bg +
      (r.under ? ' over ' + r.under : '') + '\n');
  }
  const failed = rows.filter((r) => !r.ok).length;
  if (process.argv.includes('--check') && failed > 0) {
    process.stderr.write(failed + ' pair(s) below the WCAG minimum\n');
    process.exit(1);
  }
}

if (require.main === module) main();
module.exports = { parseColor, composite, luminance, contrast, stylesheet, palette, rule, prop, pairs, audit, TEXT, NON_TEXT };
