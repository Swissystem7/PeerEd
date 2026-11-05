'use strict';
// Stage 14 (Figma v2 finish): the lesson's 45-minute flow renders as a vertical
// timeline, cards are glass with a solid fallback, and the emergency header
// gradient shows in חירום mode. Shell contracts read the real stylesheet;
// behaviour drives the real built app.html through the fake DOM.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { ALL_LESSONS, flowTimeline, flowMinutes } = require('../src/lib/curriculum.js');
const { shortLesson } = require('../src/lib/modes.js');
const { openApp, text } = require('../test-support/fake-dom.js');

const ROOT = path.join(__dirname, '..');
const shell = fs.readFileSync(path.join(ROOT, 'src', 'app-shell.html'), 'utf8');

test('stage14: flowTimeline splits every lesson flow into titled, timed steps totalling 45 minutes', () => {
  for (const lesson of ALL_LESSONS) {
    const steps = flowTimeline(lesson);
    assert.equal(steps.length, lesson.flowHe.length, lesson.id);
    assert.equal(steps.reduce((n, s) => n + s.minutes, 0), 45, lesson.id);
    assert.equal(flowMinutes(lesson), 45, lesson.id);
    steps.forEach((s, i) => {
      assert.equal(s.minutes, lesson.flowHe[i].minutes, lesson.id);
      assert.ok(s.titleHe.length > 0, lesson.id + ' step ' + i + ' has a title');
      assert.ok(s.bodyHe.length > 0, lesson.id + ' step ' + i + ' has a body');
    });
  }
  const first = flowTimeline(ALL_LESSONS[0]);
  assert.equal(first[0].titleHe, 'פתיחה');
  assert.match(first[0].bodyHe, /מציגים שני חפצים/);
  assert.throws(() => flowTimeline(null), /invalid lesson: flowHe/);
  assert.throws(() => flowTimeline({ flowHe: [] }), /invalid lesson: flowHe/);
  assert.throws(() => flowTimeline({ flowHe: [{ minutes: 0, stepHe: 'x' }] }), /invalid lesson: flowHe/);
});

test('stage14: emergency short lesson also timelines, totalling its short minutes', () => {
  const short = shortLesson(ALL_LESSONS[0]);
  const steps = flowTimeline(short);
  assert.equal(steps.length, 3);
  assert.equal(steps.reduce((n, s) => n + s.minutes, 0), short.minutes);
});

test('stage14: shell paints the Figma v2 timeline, glass cards with fallback, emergency gradient', () => {
  // vertical timeline: 28px circles #CCFBF1 / 2px #0F766E, connecting line 2px #99F6E4
  assert.match(shell, /\.tl-dot \{[^}]*width:28px; height:28px;[^}]*background:#CCFBF1; border:2px solid #0F766E;/);
  assert.match(shell, /\.tl-step::before \{[^}]*width:2px; background:#99F6E4;/);
  assert.match(shell, /class="lesson-timeline"|lesson-timeline/);
  assert.ok(shell.includes('curriculumLib.flowTimeline(l)'), 'lesson screen renders the flow timeline');
  assert.ok(shell.includes('class="tl-step"') || shell.includes('"tl-step"'), 'timeline steps rendered');
  // glass cards: blur(20px) over rgba(255,255,255,.9), 1px white border, r24, Figma shadow; solid fallback
  assert.match(shell, /@supports \(\(backdrop-filter: blur\(20px\)\)/);
  assert.match(shell, /\.card, \.action-card \{ background:rgba\(255,255,255,\.9\);[^}]*backdrop-filter:blur\(20px\); border:1px solid #FFFFFF; \}/);
  assert.match(shell, /@supports not \(\(backdrop-filter: blur\(20px\)\) or \(-webkit-backdrop-filter: blur\(20px\)\)\) \{\s*\.card, \.action-card \{ background:#FFFFFF; \}/);
  assert.match(shell, /\.card \{ background:var\(--card\);[^}]*border-radius:24px;[^}]*box-shadow:0 8px 24px rgba\(49,46,129,\.10\); \}/);
  // emergency header gradient #C2410C -> #9A3412 -> #F7F5FF
  assert.match(shell, /\.hero\.emergency \{[^}]*linear-gradient\(180deg,#C2410C 0,#9A3412 78%,#F7F5FF 100%\)/);
  assert.ok(shell.includes("emg ? 'hero emergency' : 'hero'"), 'hero switches to the emergency gradient class');
});

test('stage14 ui: today lesson renders one timeline step per flow step, with minutes', () => {
  const $ = openApp();
  const html = $('todayLesson').innerHTML;
  assert.ok(html.includes('<ol class="lesson-timeline">'), 'timeline list rendered');
  assert.equal((html.match(/class="tl-step"/g) || []).length, ALL_LESSONS[0].flowHe.length, 'one step per flow step');
  assert.ok(html.includes('class="tl-dot"'), 'timeline circles rendered');
  assert.match(text(html), /פתיחה/);
  assert.match(text(html), /5 דק׳/);
  assert.match(text(html), /20 דק׳/);
});

test('stage14 ui: selecting חירום shows the emergency hero and a short-lesson timeline', () => {
  const $ = openApp();
  assert.equal($('homeHero').className, 'hero');
  assert.equal($('emgBanner').hidden, true);
  $('modeEmergency').fire('click');
  assert.equal($('homeHero').className, 'hero emergency', 'emergency gradient class on the header');
  assert.equal($('modeEmergency').getAttribute('aria-pressed'), 'true');
  assert.equal($('emgBanner').hidden, false);
  const html = $('todayLesson').innerHTML;
  assert.equal((html.match(/class="tl-step"/g) || []).length, 3, 'short lesson timelines in 3 steps');
  assert.match(text(html), /שיעור קצר/);
  $('modeRoutine').fire('click');
  assert.equal($('homeHero').className, 'hero', 'routine gradient restored');
  assert.equal((($('todayLesson').innerHTML.match(/class="tl-step"/g) || []).length), ALL_LESSONS[0].flowHe.length);
});
