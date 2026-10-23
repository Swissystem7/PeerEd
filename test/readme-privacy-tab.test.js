'use strict';
// The README's opening paragraph listed the screens as people, matching, units and sessions over a tab bar
// with five tabs, the third of them "פרטיות": a text box run through the free-text gate, two sample buttons,
// and a button that tries to save a participant with a phone field. The paragraph must name that tab.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const readme = fs.readFileSync(path.join(root, 'README.md'), 'utf8');
const shell = fs.readFileSync(path.join(root, 'src', 'app-shell.html'), 'utf8');
const intro = readme.slice(readme.indexOf('Besides people'), readme.indexOf('| File |'));

test('the opening paragraph names every tab of the tab bar', () => {
  const tabs = shell.match(/<button role="tab"[^>]*>[^<]*<\/button>/g);
  assert.equal(tabs.length, 5);
  assert.ok(tabs.some(function (t) { return t.includes('>פרטיות<'); }));
  assert.match(intro, /privacy tab \("פרטיות"\)/);
  assert.match(intro, /units screen/);
  assert.match(intro, /sessions screen/);
});

test('the privacy tab is what the paragraph says it is', () => {
  const panel = shell.slice(shell.indexOf('id="tab-text"'), shell.indexOf('id="tab-units"'));
  ['id="checkText"', 'id="badBtn"', 'id="rudeBtn"', 'id="gateBtn"'].forEach(function (id) {
    assert.ok(panel.includes(id), id);
  });
  assert.match(intro, /saves nothing/);
  assert.match(intro, /phone field/);
});
