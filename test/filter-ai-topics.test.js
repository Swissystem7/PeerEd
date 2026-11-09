const test = require("node:test");
const assert = require("node:assert/strict");
const { filterParticipantsByAITopic } = require("../src/lib/store.js");
const { AI_TOPIC_KEYS } = require("../src/lib/attendance.js");
const { makeProfile } = require("../src/lib/profile.js");

const BASE_STUDENT = makeProfile({
	role: "student",
	region: "SOUTH",
	availability: ["SUN_16"],
	subjects: ["MATH"],
});

const BASE_PUPIL = makeProfile({
	role: "pupil",
	region: "SOUTH",
	availability: ["SUN_16"],
	subjects: ["MATH"],
	parentConsent: true,
});

test("valid topic returns only matching participants", () => {
	const p1 = Object.freeze({
		...BASE_STUDENT,
		target_ai_topics: Object.freeze(["AI_LIT_PROMPT", "AI_CREATIVE"]),
	});
	const p2 = Object.freeze({
		...BASE_PUPIL,
		target_ai_topics: Object.freeze(["AI_STEM_CODE"]),
	});
	const p3 = Object.freeze({
		...BASE_STUDENT,
		target_ai_topics: Object.freeze(["AI_ETHICS_SEC", "AI_LIT_PROMPT"]),
	});

	const list = [p1, p2, p3];

	const litPromptMatches = filterParticipantsByAITopic(list, "AI_LIT_PROMPT");
	assert.equal(litPromptMatches.length, 2);
	assert.equal(litPromptMatches[0], p1);
	assert.equal(litPromptMatches[1], p3);

	const stemMatches = filterParticipantsByAITopic(list, "AI_STEM_CODE");
	assert.equal(stemMatches.length, 1);
	assert.equal(stemMatches[0], p2);

	for (const key of AI_TOPIC_KEYS) {
		const result = filterParticipantsByAITopic(list, key);
		assert.ok(Array.isArray(result));
		for (const participant of result) {
			assert.ok(participant.target_ai_topics.includes(key));
		}
	}
});

test("invalid topic returns empty array", () => {
	const p1 = Object.freeze({
		...BASE_STUDENT,
		target_ai_topics: Object.freeze(["AI_LIT_PROMPT"]),
	});
	const list = [p1];

	assert.deepEqual(filterParticipantsByAITopic(list, "UNKNOWN_TOPIC"), []);
	assert.deepEqual(filterParticipantsByAITopic(list, "AI_NONEXISTENT"), []);
	assert.deepEqual(filterParticipantsByAITopic(list, 123), []);
	assert.deepEqual(filterParticipantsByAITopic(list, false), []);
	assert.deepEqual(filterParticipantsByAITopic(list, {}), []);
	assert.deepEqual(filterParticipantsByAITopic(list, ["AI_LIT_PROMPT"]), []);
});

test("empty string, null, and undefined topicId return full participants list unchanged", () => {
	const p1 = Object.freeze({
		...BASE_STUDENT,
		target_ai_topics: Object.freeze(["AI_LIT_PROMPT"]),
	});
	const p2 = Object.freeze({
		...BASE_PUPIL,
		target_ai_topics: Object.freeze(["AI_STEM_CODE"]),
	});
	const list = Object.freeze([p1, p2]);

	const onEmptyString = filterParticipantsByAITopic(list, "");
	assert.equal(onEmptyString, list);
	assert.deepEqual(onEmptyString, list);

	const onNull = filterParticipantsByAITopic(list, null);
	assert.equal(onNull, list);
	assert.deepEqual(onNull, list);

	const onUndefined = filterParticipantsByAITopic(list, undefined);
	assert.equal(onUndefined, list);
	assert.deepEqual(onUndefined, list);

	const onOmitted = filterParticipantsByAITopic(list);
	assert.equal(onOmitted, list);
	assert.deepEqual(onOmitted, list);
});

test("empty input returns empty array without throwing", () => {
	assert.deepEqual(filterParticipantsByAITopic([], "AI_LIT_PROMPT"), []);
	assert.deepEqual(filterParticipantsByAITopic([], ""), []);
	assert.deepEqual(filterParticipantsByAITopic([], null), []);
	assert.deepEqual(filterParticipantsByAITopic([], undefined), []);
	assert.deepEqual(filterParticipantsByAITopic([], "INVALID"), []);
});

test("non-array participants input returns empty array", () => {
	assert.deepEqual(filterParticipantsByAITopic(null, "AI_LIT_PROMPT"), []);
	assert.deepEqual(filterParticipantsByAITopic(undefined, "AI_LIT_PROMPT"), []);
	assert.deepEqual(
		filterParticipantsByAITopic("not an array", "AI_LIT_PROMPT"),
		[],
	);
	assert.deepEqual(filterParticipantsByAITopic(12345, "AI_LIT_PROMPT"), []);
	assert.deepEqual(
		filterParticipantsByAITopic({ people: [] }, "AI_LIT_PROMPT"),
		[],
	);
	assert.deepEqual(filterParticipantsByAITopic(true, "AI_LIT_PROMPT"), []);
});

test("participants without target_ai_topics or with invalid values are skipped", () => {
	const valid = Object.freeze({
		...BASE_STUDENT,
		target_ai_topics: Object.freeze(["AI_LIT_PROMPT"]),
	});
	const noTopics = Object.freeze({ ...BASE_PUPIL });
	const nullTopics = Object.freeze({
		...BASE_STUDENT,
		target_ai_topics: null,
	});
	const stringTopics = Object.freeze({
		...BASE_PUPIL,
		target_ai_topics: "AI_LIT_PROMPT",
	});
	const emptyTopics = Object.freeze({
		...BASE_STUDENT,
		target_ai_topics: Object.freeze([]),
	});

	const list = [
		null,
		undefined,
		valid,
		noTopics,
		nullTopics,
		stringTopics,
		emptyTopics,
	];
	const filtered = filterParticipantsByAITopic(list, "AI_LIT_PROMPT");

	assert.equal(filtered.length, 1);
	assert.equal(filtered[0], valid);
});

test("inputs are never mutated and deep-equal snapshot matches before and after", () => {
	const p1 = {
		role: "student",
		region: "SOUTH",
		availability: ["SUN_16"],
		subjects: ["MATH"],
		target_ai_topics: ["AI_LIT_PROMPT", "AI_CREATIVE"],
	};
	const p2 = {
		role: "pupil",
		region: "SOUTH",
		availability: ["SUN_16"],
		subjects: ["MATH"],
		parentConsent: true,
		target_ai_topics: ["AI_STEM_CODE"],
	};
	const list = [p1, p2];

	const snapshotList = JSON.parse(JSON.stringify(list));
	const topicId = "AI_LIT_PROMPT";

	const result = filterParticipantsByAITopic(list, topicId);

	assert.deepEqual(list, snapshotList);
	assert.deepEqual(list[0], snapshotList[0]);
	assert.deepEqual(list[1], snapshotList[1]);
	assert.equal(result[0], p1);
	assert.deepEqual(Object.keys(result[0]), Object.keys(snapshotList[0]));
});
