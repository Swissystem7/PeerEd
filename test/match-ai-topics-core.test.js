const test = require("node:test");
const assert = require("node:assert/strict");
const {
	match2,
	scorePair,
	aiTopicOverlap,
	AI_TOPIC_WEIGHT,
	DEFAULT_WEIGHTS,
} = require("../src/lib/match2.js");

const S = (o) =>
	Object.assign(
		{
			region: "CENTER",
			availability: ["SUN_8", "SUN_9"],
			subjects: ["MATH"],
			level: 3,
			languages: ["HE"],
		},
		o,
	);

const P = (o) =>
	Object.assign(
		{
			region: "CENTER",
			availability: ["SUN_8"],
			subjects: ["MATH"],
			level: 3,
			languages: ["HE"],
			parentConsent: true,
		},
		o,
	);

test("aiTopicOverlap helper semantics and exported constants", () => {
	assert.equal(AI_TOPIC_WEIGHT, 20);
	assert.equal(DEFAULT_WEIGHTS.aiTopics, 20);
	assert.equal(
		aiTopicOverlap(
			["AI_LIT_PROMPT", "AI_CREATIVE"],
			["AI_LIT_PROMPT", "AI_CREATIVE"],
		),
		1,
	);
	assert.equal(
		aiTopicOverlap(["AI_LIT_PROMPT"], ["AI_LIT_PROMPT", "AI_CREATIVE"]),
		0.5,
	);
	assert.equal(aiTopicOverlap(["AI_STEM_CODE"], ["AI_LIT_PROMPT"]), 0);
	assert.equal(aiTopicOverlap([], ["AI_LIT_PROMPT"]), 0);
	assert.equal(aiTopicOverlap(["AI_LIT_PROMPT"], []), 0);
	assert.equal(aiTopicOverlap(null, ["AI_LIT_PROMPT"]), 0);
	assert.equal(aiTopicOverlap(["AI_LIT_PROMPT"], undefined), 0);
	assert.equal(aiTopicOverlap("not-an-array", ["AI_LIT_PROMPT"]), 0);
	assert.equal(aiTopicOverlap(["AI_LIT_PROMPT"], "not-an-array"), 0);
});

test("candidate with 100% overlap scores higher than otherwise identical candidate with 0% overlap", () => {
	const student = S({ target_ai_topics: ["AI_LIT_PROMPT", "AI_CREATIVE"] });
	const pupilFull = P({ target_ai_topics: ["AI_LIT_PROMPT", "AI_CREATIVE"] });
	const pupilZero = P({ target_ai_topics: ["AI_STEM_CODE", "AI_ETHICS_SEC"] });

	const scFull = scorePair(student, pupilFull);
	const scZero = scorePair(student, pupilZero);

	assert.ok(
		scFull.score > scZero.score,
		`full overlap score (${scFull.score}) should exceed zero overlap score (${scZero.score})`,
	);
	assert.equal(scFull.breakdown.aiTopicsCounted, true);
	assert.equal(scZero.breakdown.aiTopicsCounted, true);
	assert.ok(scFull.breakdown.aiTopics > scZero.breakdown.aiTopics);
	assert.equal(scZero.breakdown.aiTopics, 0);
});

test("partial overlap (1 of 2) sits strictly between 100% and 0% overlap", () => {
	const student = S({ target_ai_topics: ["AI_LIT_PROMPT", "AI_CREATIVE"] });
	const pupilFull = P({ target_ai_topics: ["AI_LIT_PROMPT", "AI_CREATIVE"] });
	const pupilPartial = P({
		target_ai_topics: ["AI_LIT_PROMPT", "AI_STEM_CODE"],
	});
	const pupilZero = P({ target_ai_topics: ["AI_STEM_CODE", "AI_ETHICS_SEC"] });

	const scFull = scorePair(student, pupilFull);
	const scPartial = scorePair(student, pupilPartial);
	const scZero = scorePair(student, pupilZero);

	assert.ok(
		scFull.score > scPartial.score,
		`full (${scFull.score}) > partial (${scPartial.score})`,
	);
	assert.ok(
		scPartial.score > scZero.score,
		`partial (${scPartial.score}) > zero (${scZero.score})`,
	);
	assert.equal(scPartial.breakdown.aiTopicsCounted, true);
	assert.ok(scFull.breakdown.aiTopics > scPartial.breakdown.aiTopics);
	assert.ok(scPartial.breakdown.aiTopics > scZero.breakdown.aiTopics);
});

test("candidates without target_ai_topics get exactly the same score/breakdown total as before", () => {
	const baseStudent = S();
	const basePupil = P();
	const baseSc = scorePair(baseStudent, basePupil);

	const edgeCases = [
		[S({ target_ai_topics: [] }), P({ target_ai_topics: [] })],
		[S({ target_ai_topics: null }), P()],
		[S(), P({ target_ai_topics: null })],
		[S({ target_ai_topics: undefined }), P({ target_ai_topics: undefined })],
		[S({ target_ai_topics: "AI_LIT_PROMPT" }), P({ target_ai_topics: 123 })],
		[S({ target_ai_topics: {} }), P({ target_ai_topics: ["AI_LIT_PROMPT"] })],
		[S({ target_ai_topics: ["AI_LIT_PROMPT"] }), P({ target_ai_topics: [] })],
		[S({ target_ai_topics: ["AI_LIT_PROMPT"] }), P()],
		[S(), P({ target_ai_topics: ["AI_LIT_PROMPT"] })],
	];

	for (const [st, pu] of edgeCases) {
		const sc = scorePair(st, pu);
		assert.equal(sc.score, baseSc.score);
		assert.equal(sc.breakdown.total, baseSc.breakdown.total);
		assert.equal(sc.breakdown.aiTopics, 0);
		assert.equal(sc.breakdown.aiTopicsCounted, false);
	}
});

test("match2() ranking prefers the full-overlap pupil when everything else is equal", () => {
	const student = S({ maxPupils: 1, target_ai_topics: ["AI_LIT_PROMPT"] });
	const pupilZero = P({ target_ai_topics: ["AI_STEM_CODE"] });
	const pupilFull = P({ target_ai_topics: ["AI_LIT_PROMPT"] });

	const r = match2([student], [pupilZero, pupilFull]);
	assert.equal(r.pairs.length, 1);
	assert.equal(r.pairs[0].studentIndex, 0);
	assert.equal(
		r.pairs[0].pupilIndex,
		1,
		"full overlap pupil (index 1) should be selected despite higher index",
	);

	const rReverse = match2([student], [pupilFull, pupilZero]);
	assert.equal(rReverse.pairs.length, 1);
	assert.equal(rReverse.pairs[0].studentIndex, 0);
	assert.equal(
		rReverse.pairs[0].pupilIndex,
		0,
		"full overlap pupil (index 0) selected",
	);
});

test("determinism: same input twice yields deep-equal result", () => {
	const students = [
		S({ maxPupils: 2, target_ai_topics: ["AI_LIT_PROMPT", "AI_CREATIVE"] }),
		S({
			region: "NORTH",
			languages: ["AR"],
			target_ai_topics: ["AI_STEM_CODE"],
		}),
	];
	const pupils = [
		P({ target_ai_topics: ["AI_LIT_PROMPT"] }),
		P({
			region: "NORTH",
			languages: ["AR"],
			target_ai_topics: ["AI_STEM_CODE"],
		}),
		P({ target_ai_topics: ["AI_CREATIVE", "AI_ETHICS_SEC"] }),
	];

	const res1 = match2(students, pupils);
	const res2 = match2(students, pupils);
	assert.deepEqual(res1, res2);

	const sc1 = scorePair(students[0], pupils[0]);
	const sc2 = scorePair(students[0], pupils[0]);
	assert.deepEqual(sc1, sc2);
});

test("zero PII: only enum keys are read, invalid topic strings ignored, no PII leaked in score/breakdown/explanation", () => {
	const studentWithPii = S({
		name: "Israel Israeli",
		email: "israel@example.com",
		phone: "050-1234567",
		id_number: "123456789",
		free_text: "Looking for a math tutor in Tel Aviv",
		target_ai_topics: [
			"AI_LIT_PROMPT",
			"invalid topic name",
			"attacker@example.com",
			"050-9999999",
			"AI_CREATIVE",
			"nested_lower_case",
			"AI-DASH",
		],
	});

	const pupilWithPii = P({
		name: "Dana Cohen",
		email: "dana@example.com",
		phone: "052-7654321",
		id_number: "987654321",
		notes: "Needs help with homework",
		target_ai_topics: [
			"AI_LIT_PROMPT",
			"https://malicious.site",
			{ object: "bad" },
			12345,
			null,
			undefined,
			"AI_STEM_CODE",
		],
	});

	const overlap = aiTopicOverlap(
		studentWithPii.target_ai_topics,
		pupilWithPii.target_ai_topics,
	);
	assert.equal(overlap, 0.5);

	const sc = scorePair(studentWithPii, pupilWithPii);
	assert.equal(sc.breakdown.aiTopicsCounted, true);
	assert.equal(sc.breakdown.aiTopics, 10);

	const r = match2([studentWithPii], [pupilWithPii]);
	assert.equal(r.pairs.length, 1);

	const serializedSc = JSON.stringify(sc);
	const serializedPair = JSON.stringify(r.pairs[0]);

	const piiPatterns = [
		/Israel/,
		/israel@example\.com/,
		/050-1234567/,
		/123456789/,
		/Tel Aviv/,
		/Dana/,
		/dana@example\.com/,
		/052-7654321/,
		/987654321/,
		/attacker@example\.com/,
		/050-9999999/,
		/malicious\.site/,
	];

	for (const pattern of piiPatterns) {
		assert.doesNotMatch(serializedSc, pattern);
		assert.doesNotMatch(serializedPair, pattern);
	}

	assert.doesNotMatch(r.pairs[0].explanationHe, /AI_LIT_PROMPT/);
	assert.doesNotMatch(r.pairs[0].explanationHe, /AI_CREATIVE/);
	assert.doesNotMatch(r.pairs[0].explanationHe, /AI_STEM_CODE/);
});
