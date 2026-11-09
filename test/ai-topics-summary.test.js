const test = require("node:test");
const assert = require("node:assert/strict");
const {
	getAITopicsSummary,
	AI_TOPIC_KEYS,
} = require("../src/lib/attendance.js");

const EXPECTED_EMPTY = {
	AI_LIT_PROMPT: { total: 0, requested: 0, offered: 0 },
	AI_CREATIVE: { total: 0, requested: 0, offered: 0 },
	AI_STEM_CODE: { total: 0, requested: 0, offered: 0 },
	AI_ETHICS_SEC: { total: 0, requested: 0, offered: 0 },
};

test("empty array, null, undefined and non-array -> all 4 keys zeroed", () => {
	const nonArrays = [
		[],
		null,
		undefined,
		"not-an-array",
		123,
		true,
		{},
		{ target_ai_topics: ["AI_LIT_PROMPT"] },
	];

	for (const input of nonArrays) {
		const res = getAITopicsSummary(input);
		assert.deepEqual(res, EXPECTED_EMPTY);
		assert.deepEqual(Object.keys(res).sort(), [...AI_TOPIC_KEYS].sort());
	}

	const noArgRes = getAITopicsSummary();
	assert.deepEqual(noArgRes, EXPECTED_EMPTY);

	const first = getAITopicsSummary([]);
	const second = getAITopicsSummary([]);
	assert.notEqual(first, second);
	first.AI_LIT_PROMPT.total = 999;
	assert.equal(second.AI_LIT_PROMPT.total, 0);
});

test("one participant with several topics adds exactly 1 to each of them", () => {
	const participant = {
		role: "student",
		target_ai_topics: ["AI_LIT_PROMPT", "AI_CREATIVE"],
	};

	const res = getAITopicsSummary([participant]);
	assert.deepEqual(res.AI_LIT_PROMPT, { total: 1, requested: 0, offered: 1 });
	assert.deepEqual(res.AI_CREATIVE, { total: 1, requested: 0, offered: 1 });
	assert.deepEqual(res.AI_STEM_CODE, { total: 0, requested: 0, offered: 0 });
	assert.deepEqual(res.AI_ETHICS_SEC, { total: 0, requested: 0, offered: 0 });
});

test("duplicates in one participant count once", () => {
	const p1 = {
		role: "pupil",
		target_ai_topics: [
			"AI_STEM_CODE",
			"AI_STEM_CODE",
			"AI_STEM_CODE",
			"AI_ETHICS_SEC",
			"AI_ETHICS_SEC",
		],
	};
	const p2 = {
		role: "student",
		target_ai_topics: ["AI_STEM_CODE", "AI_STEM_CODE"],
	};

	const res = getAITopicsSummary([p1, p2]);
	assert.deepEqual(res.AI_STEM_CODE, { total: 2, requested: 1, offered: 1 });
	assert.deepEqual(res.AI_ETHICS_SEC, { total: 1, requested: 1, offered: 0 });
	assert.deepEqual(res.AI_LIT_PROMPT, { total: 0, requested: 0, offered: 0 });
	assert.deepEqual(res.AI_CREATIVE, { total: 0, requested: 0, offered: 0 });
});

test("student vs pupil split into offered/requested", () => {
	const roster = [
		{ role: "student", target_ai_topics: ["AI_LIT_PROMPT", "AI_ETHICS_SEC"] },
		{ role: "pupil", target_ai_topics: ["AI_LIT_PROMPT", "AI_STEM_CODE"] },
		{ role: "observer", target_ai_topics: ["AI_LIT_PROMPT"] },
		{ target_ai_topics: ["AI_CREATIVE"] },
	];

	const res = getAITopicsSummary(roster);
	assert.deepEqual(res.AI_LIT_PROMPT, { total: 3, requested: 1, offered: 1 });
	assert.deepEqual(res.AI_CREATIVE, { total: 1, requested: 0, offered: 0 });
	assert.deepEqual(res.AI_STEM_CODE, { total: 1, requested: 1, offered: 0 });
	assert.deepEqual(res.AI_ETHICS_SEC, { total: 1, requested: 0, offered: 1 });
});

test("invalid / unknown / non-string topics and non-array target_ai_topics are ignored without throwing", () => {
	const noisyRoster = [
		null,
		undefined,
		42,
		"not an object",
		[],
		{ role: "student", target_ai_topics: "AI_LIT_PROMPT" },
		{ role: "student", target_ai_topics: null },
		{ role: "student", target_ai_topics: undefined },
		{ role: "student", target_ai_topics: 123 },
		{ role: "student", target_ai_topics: {} },
		{
			role: "student",
			target_ai_topics: [
				null,
				undefined,
				123,
				"",
				"UNKNOWN_TOPIC",
				"toString",
				"constructor",
				true,
				{},
				["nested"],
				"AI_CREATIVE",
			],
		},
	];

	assert.doesNotThrow(() => {
		const res = getAITopicsSummary(noisyRoster);
		assert.deepEqual(res.AI_CREATIVE, { total: 1, requested: 0, offered: 1 });
		assert.deepEqual(res.AI_LIT_PROMPT, { total: 0, requested: 0, offered: 0 });
		assert.deepEqual(res.AI_STEM_CODE, { total: 0, requested: 0, offered: 0 });
		assert.deepEqual(res.AI_ETHICS_SEC, { total: 0, requested: 0, offered: 0 });
	});
});

test("output has exactly the 4 keys with integer counters and JSON of the output contains no participant name/id/region given in the input", () => {
	const roster = [
		{
			id: "SECRET-ID-999",
			name: "Ada Lovelace",
			region: "NORTH-DISTRICT",
			email: "ada@example.org",
			phone: "050-9998877",
			role: "student",
			target_ai_topics: ["AI_ETHICS_SEC", "AI_STEM_CODE"],
		},
		{
			id: "SECRET-ID-888",
			name: "Alan Turing",
			region: "SOUTH-DISTRICT",
			email: "alan@example.org",
			phone: "052-1112233",
			role: "pupil",
			target_ai_topics: ["AI_ETHICS_SEC"],
		},
	];

	const res = getAITopicsSummary(roster);
	const keys = Object.keys(res).sort();
	assert.deepEqual(keys, [
		"AI_CREATIVE",
		"AI_ETHICS_SEC",
		"AI_LIT_PROMPT",
		"AI_STEM_CODE",
	]);

	for (const key of keys) {
		const counter = res[key];
		assert.deepEqual(Object.keys(counter).sort(), [
			"offered",
			"requested",
			"total",
		]);
		for (const field of ["total", "requested", "offered"]) {
			assert.equal(Number.isInteger(counter[field]), true);
			assert.equal(counter[field] >= 0, true);
		}
	}

	const json = JSON.stringify(res);
	const forbiddenStrings = [
		"SECRET-ID-999",
		"SECRET-ID-888",
		"Ada",
		"Lovelace",
		"Alan",
		"Turing",
		"NORTH-DISTRICT",
		"SOUTH-DISTRICT",
		"ada@example.org",
		"alan@example.org",
		"050-9998877",
		"052-1112233",
		"id",
		"name",
		"region",
		"email",
		"phone",
	];

	for (const term of forbiddenStrings) {
		assert.equal(
			json.includes(term),
			false,
			`JSON output leaked personal/participant field: ${term}`,
		);
	}
});

test("input is not mutated", () => {
	const topics1 = Object.freeze(["AI_LIT_PROMPT", "AI_CREATIVE"]);
	const p1 = Object.freeze({
		id: "P1",
		role: "student",
		target_ai_topics: topics1,
	});
	const topics2 = Object.freeze(["AI_LIT_PROMPT"]);
	const p2 = Object.freeze({
		id: "P2",
		role: "pupil",
		target_ai_topics: topics2,
	});
	const roster = Object.freeze([p1, p2]);

	const snapshotBefore = JSON.stringify(roster);
	const res = getAITopicsSummary(roster);

	assert.equal(JSON.stringify(roster), snapshotBefore);
	assert.deepEqual(p1.target_ai_topics, ["AI_LIT_PROMPT", "AI_CREATIVE"]);
	assert.deepEqual(p2.target_ai_topics, ["AI_LIT_PROMPT"]);
	assert.equal(res.AI_LIT_PROMPT.total, 2);
});
