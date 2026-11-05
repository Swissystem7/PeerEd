'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const {
  TRACKS, TRACK_GRADES, ALL_LESSONS, lessonsForTrack, getLesson, lessonById, trackForGrade,
  flowMinutes, assignLessons, todayLesson, makeDeliveryLog, setDelivered, isDelivered,
  lessonProgress, progressToCsv
} = require('../src/lib/curriculum.js');
const { findPersonalData, findProfanity } = require('../src/lib/validator.js');
const { tExtra, verifyExtraParity } = require('../src/lib/lang-extra.js');

test('curriculum: two tracks, 12 lessons each, full 45-minute shape, clean text', () => {
  assert.deepEqual(TRACKS, ['elementary', 'middle']);
  assert.deepEqual(TRACK_GRADES.elementary, [3, 4, 5, 6]);
  assert.deepEqual(TRACK_GRADES.middle, [7, 8, 9]);
  assert.equal(ALL_LESSONS.length, 24);
  for (const track of TRACKS) {
    const list = lessonsForTrack(track);
    assert.equal(list.length, 12, track);
    list.forEach((l, i) => {
      assert.equal(l.index, i); assert.equal(l.track, track);
      assert.ok(l.titleHe && l.goalsHe.length >= 2 && l.materialsHe.length >= 1 && l.wrapUpHe.length >= 2);
      assert.ok(l.activityHe && l.unpluggedHe, l.id + ' needs activity and unplugged variant');
      assert.equal(flowMinutes(l), 45, l.id + ' must total 45 minutes');
      assert.equal(getLesson(track, i), l);
      assert.equal(lessonById(l.id), l);
      assert.equal(tExtra(l.titleKey, 'he'), l.titleHe, l.titleKey + ' he title parity');
      assert.ok(tExtra(l.titleKey, 'ar') && tExtra(l.titleKey, 'ru'), l.titleKey);
      const text = [l.titleHe, ...l.goalsHe, ...l.flowHe.map((f) => f.stepHe), l.activityHe, l.unpluggedHe, ...l.materialsHe, ...l.wrapUpHe].join(' ');
      assert.deepEqual(findPersonalData(text), [], l.id);
      assert.deepEqual(findProfanity(text), [], l.id);
    });
  }
  assert.throws(() => lessonsForTrack('high'), /invalid track/);
  assert.throws(() => getLesson('elementary', 12), /invalid lesson index/);
  assert.throws(() => lessonById('nope'), /unknown lesson id/);
});

test('curriculum: required topics in both tracks; grade routing', () => {
  const ids = (t) => lessonsForTrack(t).map((l) => l.id).join(' ');
  for (const t of TRACKS) {
    const s = ids(t);
    assert.match(s, /what-is-ai/); assert.match(s, /image-recognition/); assert.match(s, /data-bias/); assert.match(s, /mini-project/);
  }
  assert.match(ids('elementary'), /chatbots/); assert.match(ids('elementary'), /safety-privacy/);
  assert.match(ids('middle'), /llm-chatbots/); assert.match(ids('middle'), /privacy-safety/);
  assert.equal(trackForGrade(3), 'elementary'); assert.equal(trackForGrade(6), 'elementary');
  assert.equal(trackForGrade(7), 'middle'); assert.equal(trackForGrade(9), 'middle');
  assert.throws(() => trackForGrade(2), /invalid grade/);
  assert.equal(tExtra('cur.today', 'he'), 'השיעור של היום');
  assert.equal(verifyExtraParity().ok, true);
});

test('curriculum: sessions get sequential lessons per group track, cycle wraps, unknown track refused', () => {
  const sessions = [];
  for (let w = 0; w < 14; w += 1) sessions.push({ pairIndex: 0, studentIndex: 0, pupilIndex: 0, slot: 'SUN_8', week: w });
  sessions.push({ pairIndex: 1, studentIndex: 1, pupilIndex: 1, slot: 'MON_9', week: 0 });
  const a = assignLessons(sessions, { 0: 'elementary', 1: 'middle' });
  assert.equal(a[0].lessonId, 'elementary-what-is-ai');
  assert.equal(a[1].lessonIndex, 1);
  assert.equal(a[12].lessonIndex, 0); assert.equal(a[12].cycle, 2);
  assert.equal(a[13].lessonIndex, 1); assert.equal(a[13].cycle, 2);
  assert.equal(a[14].lessonId, 'middle-what-is-ai');
  // shuffled input still assigns by week order within the group
  const shuffled = assignLessons([{ pairIndex: 0, week: 1, slot: 'SUN_8' }, { pairIndex: 0, week: 0, slot: 'SUN_8' }], () => 'middle');
  assert.equal(shuffled[0].lessonIndex, 1); assert.equal(shuffled[1].lessonIndex, 0);
  assert.throws(() => assignLessons(sessions, { 0: 'elementary' }), /missing track for pair 1/);
  assert.throws(() => assignLessons([{ pairIndex: -1 }], {}), /invalid session/);
  assert.throws(() => assignLessons(sessions, { 0: 'x', 1: 'middle' }), /invalid track/);
});

test('curriculum: today lesson, delivered checkbox state, coordinator progress + CSV', () => {
  const sessions = [
    { pairIndex: 0, week: 0, slot: 'SUN_8' }, { pairIndex: 0, week: 1, slot: 'SUN_8' },
    { pairIndex: 1, week: 0, slot: 'MON_9' }
  ];
  const a = assignLessons(sessions, { 0: 'elementary', 1: 'middle' });
  assert.equal(todayLesson(a, 0, []).lesson.id, 'elementary-what-is-ai');
  assert.equal(todayLesson(a, 99, []), null);
  let log = makeDeliveryLog();
  assert.equal(isDelivered(log, { pairIndex: 0, lessonId: 'elementary-what-is-ai' }), false);
  log = setDelivered(log, { pairIndex: 0, lessonId: 'elementary-what-is-ai' }, true);
  assert.equal(isDelivered(log, { pairIndex: 0, lessonId: 'elementary-what-is-ai' }), true);
  assert.equal(setDelivered(log, { pairIndex: 0, lessonId: 'elementary-what-is-ai' }, true), log, 'idempotent');
  assert.equal(todayLesson(a, 0, log.delivered).lesson.id, 'elementary-learn-examples');
  log = setDelivered(log, { pairIndex: 0, lessonId: 'elementary-what-is-ai' }, false);
  assert.equal(isDelivered(log, { pairIndex: 0, lessonId: 'elementary-what-is-ai' }), false);
  assert.throws(() => setDelivered(log, { pairIndex: 0, lessonId: 'nope' }), /unknown lesson id/);
  log = setDelivered(log, a[0], true);
  const p = lessonProgress(a, log);
  assert.equal(p.total, 3); assert.equal(p.delivered, 1);
  assert.deepEqual(p.byPair.map((r) => [r.pairIndex, r.total, r.delivered, r.nextLessonId]),
    [[0, 2, 1, 'elementary-learn-examples'], [1, 1, 0, 'middle-what-is-ai']]);
  const csv = progressToCsv(p);
  assert.ok(csv.startsWith('pair,track,total,delivered,percent,next_lesson\n'));
  assert.match(csv, /0,elementary,2,1,0\.5,elementary-learn-examples/);
});
