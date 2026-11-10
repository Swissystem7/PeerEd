const test = require("node:test");
const assert = require("node:assert/strict");

const {
	SCHEMA,
	deserialize,
	memoryBackend,
	createStore,
} = require("../src/lib/store.js");
const { emptyQueue } = require("../src/lib/approval.js");
const { emptyLog } = require("../src/lib/session.js");

function createTestDoc(people) {
	return {
		schema: SCHEMA,
		people,
		queue: emptyQueue(),
		log: emptyLog(),
		attendance: [],
	};
}

test("html tags and script injection in target_ai_topics are discarded during deserialize", () => {
	const allInjectionsDoc = createTestDoc([
		{
			role: "student",
			region: "SOUTH",
			availability: ["SUN_16", "MON_18"],
			subjects: ["MATH", "PHYSICS"],
			target_ai_topics: [
				"<script>alert(1)</script>",
				"<b>AI_LIT_PROMPT</b>",
				"<img src=x onerror=alert(1)>",
				"<div>AI_ETHICS_SEC</div>",
				"<iframe src='javascript:void(0)'></iframe>",
			],
		},
	]);

	const cleanState = deserialize(JSON.stringify(allInjectionsDoc));
	const person = cleanState.people[0];
	assert.equal(Object.hasOwn(person, "target_ai_topics"), false);
	assert.equal(person.target_ai_topics, undefined);

	const mixedHtmlDoc = createTestDoc([
		{
			role: "pupil",
			region: "SOUTH",
			availability: ["MON_18"],
			subjects: ["MATH"],
			parentConsent: true,
			target_ai_topics: [
				"<script>alert(1)</script>",
				"AI_LIT_PROMPT",
				"<b>AI_LIT_PROMPT</b>",
				"<img src=x onerror=alert(1)>",
				"AI_ETHICS_SEC",
				"<div>AI_ETHICS_SEC</div>",
			],
		},
	]);

	const mixedState = deserialize(JSON.stringify(mixedHtmlDoc));
	const mixedPerson = mixedState.people[0];
	assert.deepEqual(mixedPerson.target_ai_topics, [
		"AI_LIT_PROMPT",
		"AI_ETHICS_SEC",
	]);
	assert.ok(Object.isFrozen(mixedPerson.target_ai_topics));
});

test("whitespace-padded and newline-laden topic strings are rejected and removed", () => {
	const whitespaceDoc = createTestDoc([
		{
			role: "student",
			region: "SOUTH",
			availability: ["SUN_16", "MON_18"],
			subjects: ["MATH", "PHYSICS"],
			target_ai_topics: [
				" AI_LIT_PROMPT",
				"AI_LIT_PROMPT ",
				"\tAI_STEM_CODE",
				"AI_CREATIVE\n",
				"AI LIT PROMPT",
				"  AI_ETHICS_SEC  ",
				"\r\nAI_STEM_CODE\r\n",
			],
		},
	]);

	const state = deserialize(JSON.stringify(whitespaceDoc));
	const person = state.people[0];
	assert.equal(Object.hasOwn(person, "target_ai_topics"), false);
	assert.equal(person.target_ai_topics, undefined);

	const mixedWhitespaceDoc = createTestDoc([
		{
			role: "student",
			region: "SOUTH",
			availability: ["SUN_16", "MON_18"],
			subjects: ["MATH", "PHYSICS"],
			target_ai_topics: [
				" AI_LIT_PROMPT",
				"AI_LIT_PROMPT",
				"AI_STEM_CODE\t",
				"AI_CREATIVE\n",
				"AI_ETHICS_SEC",
			],
		},
	]);

	const mixedState = deserialize(JSON.stringify(mixedWhitespaceDoc));
	assert.deepEqual(mixedState.people[0].target_ai_topics, [
		"AI_LIT_PROMPT",
		"AI_ETHICS_SEC",
	]);
});

test("mixed arrays with valid keys, HTML tags, padded keys, and illegal characters keep only exact valid keys and freeze profile", () => {
	const mixedDoc = createTestDoc([
		{
			role: "student",
			region: "SOUTH",
			availability: ["SUN_16", "MON_18"],
			subjects: ["MATH", "PHYSICS"],
			target_ai_topics: [
				"<script>alert(1)</script>",
				"AI_LIT_PROMPT",
				" AI_LIT_PROMPT",
				"<b>AI_STEM_CODE</b>",
				"AI_STEM_CODE",
				"AI_CREATIVE\n",
				"AI_ETHICS_SEC<script>",
				"!!AI_ETHICS_SEC",
				null,
				123,
				"AI_STEM_CODE",
			],
		},
	]);

	const state = deserialize(JSON.stringify(mixedDoc));
	const person = state.people[0];

	assert.deepEqual(person.target_ai_topics, [
		"AI_LIT_PROMPT",
		"AI_STEM_CODE",
	]);
	assert.ok(Object.isFrozen(person));
	assert.ok(Object.isFrozen(person.target_ai_topics));
	assert.throws(() => {
		person.target_ai_topics.push("AI_CREATIVE");
	}, TypeError);
});

test("full store import via createStore load() strictly sanitizes HTML and whitespace-laden AI topics", () => {
	const backend = memoryBackend();
	const store = createStore(backend, "test_key");

	const rawDoc = createTestDoc([
		{
			role: "student",
			region: "SOUTH",
			availability: ["SUN_16", "MON_18"],
			subjects: ["MATH", "PHYSICS"],
			target_ai_topics: [
				"<script>evil()</script>",
				"AI_LIT_PROMPT",
				" AI_LIT_PROMPT ",
				"AI_ETHICS_SEC",
				"<style>body{color:red}</style>",
			],
		},
		{
			role: "pupil",
			region: "SOUTH",
			availability: ["MON_18"],
			subjects: ["MATH"],
			parentConsent: true,
			target_ai_topics: [
				"<script>alert(2)</script>",
				" AI_CREATIVE ",
				"\tAI_STEM_CODE\n",
			],
		},
		{
			role: "student",
			region: "SOUTH",
			availability: ["SUN_16"],
			subjects: ["PHYSICS"],
			target_ai_topics: ["AI_STEM_CODE"],
		},
	]);

	backend.setItem("test_key", JSON.stringify(rawDoc));

	const loaded = store.load();
	assert.equal(loaded.problem, null);
	assert.equal(loaded.kept, false);
	assert.ok(Object.isFrozen(loaded.state));
	assert.equal(loaded.state.people.length, 3);

	const [p1, p2, p3] = loaded.state.people;

	assert.deepEqual(p1.target_ai_topics, ["AI_LIT_PROMPT", "AI_ETHICS_SEC"]);
	assert.ok(Object.isFrozen(p1));
	assert.ok(Object.isFrozen(p1.target_ai_topics));

	assert.equal(Object.hasOwn(p2, "target_ai_topics"), false);
	assert.equal(p2.target_ai_topics, undefined);
	assert.ok(Object.isFrozen(p2));

	assert.deepEqual(p3.target_ai_topics, ["AI_STEM_CODE"]);
	assert.ok(Object.isFrozen(p3));
	assert.ok(Object.isFrozen(p3.target_ai_topics));
});
