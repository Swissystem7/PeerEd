const test = require("node:test");
const assert = require("node:assert/strict");
const {
	scorePair,
	explainAiTopics,
	AI_TOPIC_LABELS,
} = require("../src/lib/match2.js");

const baseStudent = {
	region: "CENTER",
	availability: ["SUN_16"],
	subjects: ["MATH"],
	level: 3,
	languages: ["HE"],
	target_ai_topics: ["AI_LIT_PROMPT", "AI_CREATIVE"],
};
const basePupil = {
	region: "CENTER",
	availability: ["SUN_16"],
	subjects: ["MATH"],
	level: 3,
	languages: ["HE"],
	parentConsent: true,
	target_ai_topics: ["AI_LIT_PROMPT"],
};

test("overlap shares topic count and points", () => {
	const sc = scorePair(baseStudent, basePupil);
	assert.equal(sc.sharedAiTopics.length, 1);
	assert.equal(sc.sharedAiTopics[0], "AI_LIT_PROMPT");
	assert.ok(sc.breakdown.aiTopics > 0);
	assert.match(sc.aiExplanation.he, /נושאי בינה מלאכותית משותפים/);
	assert.ok(sc.aiExplanation.points > 0);
});

test("no overlap yields 0 points with explicit zero line", () => {
	const sc = scorePair(
		{ ...baseStudent, target_ai_topics: ["AI_CREATIVE"] },
		{ ...basePupil, target_ai_topics: ["AI_STEM_CODE"] },
	);
	assert.deepEqual(sc.sharedAiTopics, []);
	assert.equal(sc.breakdown.aiTopics, 0);
	assert.match(sc.aiExplanation.he, /אין חפיפה/);
	assert.equal(sc.aiExplanation.points, 0);
});

test("translations ar/ru present on overlap", () => {
	const sc = scorePair(baseStudent, basePupil);
	assert.match(sc.aiExplanation.ar, /موضوعات/);
	assert.match(sc.aiExplanation.ru, /ИИ/);
	assert.ok(AI_TOPIC_LABELS.AI_LIT_PROMPT.he);
});

test("no AI data: empty explanation strings (no error line)", () => {
	const sc = scorePair(
		{ ...baseStudent, target_ai_topics: [] },
		{ ...basePupil, target_ai_topics: [] },
	);
	assert.equal(sc.aiExplanation.he, "");
	assert.equal(sc.aiExplanation.ar, "");
	assert.equal(sc.aiExplanation.ru, "");
	const direct = explainAiTopics({
		counted: false,
		sharedCount: 0,
		points: 0,
		topics: [],
	});
	assert.equal(direct.he, "");
});
