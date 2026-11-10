// PEERED-SRV-037: match2 performance, scalability, determinism, and zero-PII guarantees.
// CommonJS on purpose. Tests match2 execution with 200 synthetic participants (100 students, 100 pupils)
// ensuring sub-150ms execution, complete cross-run determinism, zero PII leakage, and memory stability.

const test = require('node:test');
const assert = require('node:assert/strict');
const { performance } = require('node:perf_hooks');

const { match2 } = require('../src/lib/match2.js');
const { REGIONS } = require('../src/lib/regions.js');
const { SUBJECTS } = require('../src/lib/profile.js');
const { PATTERNS } = require('../src/lib/validator.js');

const VALID_SLOTS = Object.freeze([
  'SUN_8', 'SUN_9', 'SUN_10', 'SUN_11',
  'MON_14', 'MON_15', 'MON_16', 'MON_17',
  'TUE_10', 'TUE_11', 'TUE_18', 'TUE_19',
  'WED_12', 'WED_13', 'WED_16', 'WED_17',
  'THU_14', 'THU_15', 'THU_18', 'THU_19'
]);

const VALID_TOPICS = Object.freeze([
  'AI_LIT_PROMPT',
  'AI_CREATIVE',
  'AI_STEM_CODE',
  'AI_ETHICS_SEC'
]);

const VALID_LANGS = Object.freeze(['HE', 'AR', 'RU', 'EN']);

/**
 * Generates 200 synthetic participants (100 students and 100 pupils)
 * with distributed valid regions, availability slots, subjects, levels, and AI topics.
 * Optionally populates synthetic PII fields (names, phones, emails, ID numbers, personal notes).
 */
function generateSyntheticParticipants({ withPii = false } = {}) {
  const students = [];
  const pupils = [];
  const piiTokens = [];

  for (let i = 0; i < 100; i++) {
    const region = REGIONS[i % REGIONS.length];
    const slot1 = VALID_SLOTS[i % VALID_SLOTS.length];
    const slot2 = VALID_SLOTS[(i + 1) % VALID_SLOTS.length];
    const subject1 = SUBJECTS[i % SUBJECTS.length];
    const subject2 = SUBJECTS[(i + 1) % SUBJECTS.length];
    const level = (i % 5) + 1;
    const language = VALID_LANGS[i % VALID_LANGS.length];
    const aiTopic = VALID_TOPICS[i % VALID_TOPICS.length];

    const student = {
      role: 'student',
      region,
      availability: [slot1, slot2],
      subjects: [subject1, subject2],
      level,
      languages: [language],
      target_ai_topics: [aiTopic],
      maxPupils: 1
    };

    const pupil = {
      role: 'pupil',
      region,
      availability: [slot1, VALID_SLOTS[(i + 2) % VALID_SLOTS.length]],
      subjects: [subject1],
      level,
      languages: [language],
      target_ai_topics: [aiTopic],
      parentConsent: true
    };

    if (withPii) {
      const sName = `Student_${i}_Cohen`;
      const sPhone = `050-1234${String(i).padStart(3, '0')}`;
      const sEmail = `student_${i}@university.example.org`;
      const sId = `123456${String(i).padStart(3, '0')}`;
      const sNotes = `Confidential student tutor notes: ${i}; contact phone 050-1234${String(i).padStart(3, '0')}`;
      const sAddress = `Ben Yehuda ${i}, Tel Aviv`;

      student.name = sName;
      student.phone = sPhone;
      student.email = sEmail;
      student.id_number = sId;
      student.notes = sNotes;
      student.address = sAddress;

      piiTokens.push(sName, sPhone, sEmail, sId, sNotes, sAddress);

      const pName = `Pupil_${i}_Levi`;
      const pPhone = `052-9876${String(i).padStart(3, '0')}`;
      const pEmail = `pupil_${i}@school.example.com`;
      const pId = `987654${String(i).padStart(3, '0')}`;
      const pNotes = `Confidential pupil IEP notes: ${i}; emergency contact dana@example.com`;
      const pAddress = `Herzl ${i}, Jerusalem`;

      pupil.name = pName;
      pupil.phone = pPhone;
      pupil.email = pEmail;
      pupil.id_number = pId;
      pupil.notes = pNotes;
      pupil.address = pAddress;

      piiTokens.push(pName, pPhone, pEmail, pId, pNotes, pAddress);
    }

    students.push(student);
    pupils.push(pupil);
  }

  return { students, pupils, piiTokens };
}

test('PEERED-SRV-037 test 1: Scalability / performance strictly under 150ms for 200 participants', () => {
  const { students, pupils } = generateSyntheticParticipants({ withPii: false });
  assert.equal(students.length, 100);
  assert.equal(pupils.length, 100);

  const t0 = performance.now();
  const result = match2(students, pupils);
  const durationMs = performance.now() - t0;

  // Execution must finish strictly under 150ms
  assert.ok(
    durationMs < 150,
    `match2 execution took ${durationMs.toFixed(2)}ms; required strictly < 150ms`
  );

  // Yielding valid pairs and non-empty assignments
  assert.ok(result.pairs.length > 0, 'Assignments must be non-empty');
  assert.equal(result.pairs.length, 100, 'Expected 100 paired matches from 100 student-pupil pairs');

  const pairedStudents = new Set();
  const pairedPupils = new Set();

  for (const pair of result.pairs) {
    assert.ok(Number.isInteger(pair.studentIndex), 'studentIndex must be an integer');
    assert.ok(Number.isInteger(pair.pupilIndex), 'pupilIndex must be an integer');
    assert.ok(pair.studentIndex >= 0 && pair.studentIndex < students.length, 'studentIndex out of range');
    assert.ok(pair.pupilIndex >= 0 && pair.pupilIndex < pupils.length, 'pupilIndex out of range');

    // Uniqueness and capacity constraints
    assert.ok(!pairedStudents.has(pair.studentIndex), `student ${pair.studentIndex} paired more than once`);
    assert.ok(!pairedPupils.has(pair.pupilIndex), `pupil ${pair.pupilIndex} paired more than once`);
    pairedStudents.add(pair.studentIndex);
    pairedPupils.add(pair.pupilIndex);

    // Score & breakdown bounds
    assert.ok(pair.score >= 0 && pair.score <= 100, `Score ${pair.score} out of 0..100 range`);
    assert.equal(pair.score, pair.breakdown.total, 'Score must match breakdown.total');

    // Valid explanation string
    assert.equal(typeof pair.explanationHe, 'string');
    assert.match(pair.explanationHe, /ציון \d+\/100/);
  }

  assert.equal(result.unmatchedPupils.length, 0);
  assert.equal(result.unmatchedStudents.length, 0);
  assert.ok(result.totalScore > 0, 'totalScore must be positive');
});

test('PEERED-SRV-037 test 2: Complete determinism across repeated executions on identical dataset', () => {
  const { students, pupils } = generateSyntheticParticipants({ withPii: false });

  const runs = [];
  const RUN_COUNT = 5;
  for (let i = 0; i < RUN_COUNT; i++) {
    runs.push(match2(students, pupils));
  }

  const baseline = runs[0];
  for (let r = 1; r < RUN_COUNT; r++) {
    const current = runs[r];

    // Entire top-level result object deep equality
    assert.deepEqual(current, baseline, `Run ${r + 1} did not match baseline run 1`);

    // Explicit field-by-field verification
    assert.equal(current.totalScore, baseline.totalScore);
    assert.deepEqual(current.unmatchedPupils, baseline.unmatchedPupils);
    assert.deepEqual(current.unmatchedStudents, baseline.unmatchedStudents);
    assert.equal(current.pairs.length, baseline.pairs.length);

    for (let i = 0; i < current.pairs.length; i++) {
      const pCur = current.pairs[i];
      const pBase = baseline.pairs[i];

      assert.equal(pCur.studentIndex, pBase.studentIndex, `Pair ${i} studentIndex mismatch`);
      assert.equal(pCur.pupilIndex, pBase.pupilIndex, `Pair ${i} pupilIndex mismatch`);
      assert.equal(pCur.score, pBase.score, `Pair ${i} score mismatch`);
      assert.deepEqual(pCur.breakdown, pBase.breakdown, `Pair ${i} breakdown mismatch`);
      assert.equal(pCur.explanationHe, pBase.explanationHe, `Pair ${i} explanationHe mismatch`);
    }
  }
});

test('PEERED-SRV-037 test 3: Zero PII leakage and memory stability across repeated match iterations', () => {
  const { students, pupils, piiTokens } = generateSyntheticParticipants({ withPii: true });
  assert.ok(piiTokens.length >= 600, 'Should have populated a rich set of synthetic PII tokens');

  const result = match2(students, pupils);
  const serializedResult = JSON.stringify(result);

  // Regexes for Israeli phone, email, and 9-digit ID numbers
  const phoneRe = new RegExp(PATTERNS.phone.source, 'i');
  const emailRe = new RegExp(PATTERNS.email.source, 'i');
  const idRe = new RegExp(PATTERNS.id_number.source, 'i');

  // Verify serialized result contains zero PII regex hits
  assert.doesNotMatch(serializedResult, phoneRe, 'Serialized result matched Israeli phone regex');
  assert.doesNotMatch(serializedResult, emailRe, 'Serialized result matched email regex');
  assert.doesNotMatch(serializedResult, idRe, 'Serialized result matched 9-digit id regex');

  // Verify zero synthetic PII tokens are present in serialized result
  for (const token of piiTokens) {
    assert.ok(
      !serializedResult.includes(token),
      `Synthetic PII token "${token}" leaked into JSON.stringify(result)`
    );
  }

  // Verify breakdown and explanation strings of each pair contain zero PII
  for (const pair of result.pairs) {
    const serializedBreakdown = JSON.stringify(pair.breakdown);
    assert.doesNotMatch(serializedBreakdown, phoneRe);
    assert.doesNotMatch(serializedBreakdown, emailRe);
    assert.doesNotMatch(serializedBreakdown, idRe);

    assert.doesNotMatch(pair.explanationHe, phoneRe);
    assert.doesNotMatch(pair.explanationHe, emailRe);
    assert.doesNotMatch(pair.explanationHe, idRe);

    for (const token of piiTokens) {
      assert.ok(
        !serializedBreakdown.includes(token),
        `Synthetic PII token "${token}" found in pair breakdown`
      );
      assert.ok(
        !pair.explanationHe.includes(token),
        `Synthetic PII token "${token}" found in pair explanationHe`
      );
    }
  }

  // Memory stability: loop of 20 runs must not exhibit unbounded heap growth
  if (typeof global.gc === 'function') {
    global.gc();
  }
  const heapBefore = process.memoryUsage().heapUsed;

  const LOOP_ITERATIONS = 20;
  for (let i = 0; i < LOOP_ITERATIONS; i++) {
    const loopResult = match2(students, pupils);
    assert.equal(loopResult.pairs.length, 100, `Iteration ${i} must yield valid pairs`);
  }

  if (typeof global.gc === 'function') {
    global.gc();
  }
  const heapAfter = process.memoryUsage().heapUsed;
  const heapGrowthBytes = heapAfter - heapBefore;

  // Bounded heap growth check across 20 match iterations (< 35 MB)
  assert.ok(
    heapGrowthBytes < 35 * 1024 * 1024,
    `Heap growth across ${LOOP_ITERATIONS} iterations was ${(heapGrowthBytes / 1024 / 1024).toFixed(2)} MB; expected < 35MB`
  );
});
