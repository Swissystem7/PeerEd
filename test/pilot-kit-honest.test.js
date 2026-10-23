'use strict';
// The pilot kit is what the owner follows with the first real coordinator. Its round must name the
// parent-consent tick (without it the engine pairs no pupil) and the wipe the app asks for at a pilot's end.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const kit = fs.readFileSync(path.join(root, 'docs', 'launch', 'PILOT-KIT.md'), 'utf8');
const shell = fs.readFileSync(path.join(root, 'src', 'app-shell.html'), 'utf8');
const round = kit.slice(kit.indexOf('## סבב השיבוץ'), kit.indexOf('## מה מודדים'));

test('pilot kit: entering participants names the parent-consent tick', () => {
  const enter = round.split(/\r?\n/).find((l) => l.includes('מזינים כל משתתף'));
  assert.match(enter, /אישור הורה/, enter);
  assert.match(enter, /לא משובץ/, enter);
});

test('pilot kit: the round ends with the wipe button the screen has and the downloaded file', () => {
  const wipe = shell.match(/id="wipeBtn"[^>]*>([^<]+)</)[1];
  assert.ok(round.includes('"' + wipe + '"'), round);
  assert.ok(round.includes('peered-pairs.csv'), round);
});
