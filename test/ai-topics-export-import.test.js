const test = require("node:test");
const assert = require("node:assert/strict");

const {
	SCHEMA,
	REJECTED_SUFFIX,
	emptyState,
	serialize,
	deserialize,
	memoryBackend,
	createStore,
} = require("../src/lib/store.js");
const { makeProfile, PERSONAL_DATA_ERROR } = require("../src/lib/profile.js");
const { emptyQueue } = require("../src/lib/approval.js");
const { emptyLog } = require("../src/lib/session.js");

const STUDENT = makeProfile({
	role: "student",
	region: "SOUTH",
	availability: ["SUN_16", "MON_18"],
	subjects: ["MATH", "PHYSICS"],
});

const PUPIL = makeProfile({
	role: "pupil",
	region: "SOUTH",
	availability: ["MON_18"],
	subjects: ["MATH"],
	parentConsent: true,
});

test("export of a person with AI topics contains the exact keys", () => {
	const person = Object.freeze({
		...STUDENT,
		target_ai_topics: Object.freeze(["AI_LIT_PROMPT", "AI_CREATIVE"]),
	});
	const state = Object.freeze({
		people: Object.freeze([person]),
		queue: emptyQueue(),
		log: emptyLog(),
	});

	const text = serialize(state);
	const doc = JSON.parse(text);

	assert.deepEqual(doc.people[0].target_ai_topics, [
		"AI_LIT_PROMPT",
		"AI_CREATIVE",
	]);
	assert.match(text, /"target_ai_topics":\["AI_LIT_PROMPT","AI_CREATIVE"\]/);

	// Export cleans duplicates and unknown keys from memory representation
	const personWithDirtyTopics = Object.freeze({
		...STUDENT,
		target_ai_topics: Object.freeze([
			"AI_STEM_CODE",
			"junk_key",
			"AI_STEM_CODE",
		]),
	});
	const dirtyState = Object.freeze({
		people: Object.freeze([personWithDirtyTopics]),
		queue: emptyQueue(),
		log: emptyLog(),
	});
	const dirtyDoc = JSON.parse(serialize(dirtyState));
	assert.deepEqual(dirtyDoc.people[0].target_ai_topics, ["AI_STEM_CODE"]);

	// Export drops target_ai_topics if empty after cleaning
	const personWithEmptyTopics = Object.freeze({
		...STUDENT,
		target_ai_topics: Object.freeze(["unknown_only"]),
	});
	const emptyTopicsState = Object.freeze({
		people: Object.freeze([personWithEmptyTopics]),
		queue: emptyQueue(),
		log: emptyLog(),
	});
	const emptyTopicsDoc = JSON.parse(serialize(emptyTopicsState));
	assert.equal(
		Object.hasOwn(emptyTopicsDoc.people[0], "target_ai_topics"),
		false,
	);
});

test("import restores the exact target_ai_topics array", () => {
	const rawDoc = {
		schema: SCHEMA,
		people: [
			{
				role: "student",
				region: "SOUTH",
				availability: ["SUN_16", "MON_18"],
				subjects: ["MATH", "PHYSICS"],
				target_ai_topics: ["AI_STEM_CODE", "AI_ETHICS_SEC"],
			},
		],
		queue: emptyQueue(),
		log: emptyLog(),
	};

	const state = deserialize(JSON.stringify(rawDoc));
	const person = state.people[0];

	assert.ok(Object.isFrozen(person));
	assert.deepEqual(person.target_ai_topics, ["AI_STEM_CODE", "AI_ETHICS_SEC"]);
	assert.equal(person.role, "student");
	assert.equal(person.region, "SOUTH");
	assert.deepEqual(person.subjects, ["MATH", "PHYSICS"]);
	assert.ok(person.retention);

	// Test import via createStore
	const backend = memoryBackend();
	const store = createStore(backend, "test_key");
	backend.setItem("test_key", JSON.stringify(rawDoc));
	const loaded = store.load();
	assert.equal(loaded.problem, null);
	assert.deepEqual(loaded.state.people[0].target_ai_topics, [
		"AI_STEM_CODE",
		"AI_ETHICS_SEC",
	]);
});

test("import of a record whose topics contain junk / unknown keys / PII-looking strings keeps only valid keys", () => {
	const rawDoc = {
		schema: SCHEMA,
		people: [
			{
				role: "student",
				region: "SOUTH",
				availability: ["SUN_16", "MON_18"],
				subjects: ["MATH", "PHYSICS"],
				target_ai_topics: [
					"dana@example.com",
					"AI_LIT_PROMPT",
					"0501234567",
					"AI_LIT_PROMPT",
					"unknown_topic",
					42,
					null,
					"AI_ETHICS_SEC",
					"https://phishing.site",
				],
			},
		],
		queue: emptyQueue(),
		log: emptyLog(),
	};

	const state = deserialize(JSON.stringify(rawDoc));
	assert.deepEqual(state.people[0].target_ai_topics, [
		"AI_LIT_PROMPT",
		"AI_ETHICS_SEC",
	]);

	// When all keys are invalid or PII, target_ai_topics is dropped completely
	const allJunkDoc = {
		schema: SCHEMA,
		people: [
			{
				role: "student",
				region: "SOUTH",
				availability: ["SUN_16", "MON_18"],
				subjects: ["MATH", "PHYSICS"],
				target_ai_topics: ["dana@example.com", "0501234567", "random_key"],
			},
		],
		queue: emptyQueue(),
		log: emptyLog(),
	};
	const cleanState = deserialize(JSON.stringify(allJunkDoc));
	assert.equal(Object.hasOwn(cleanState.people[0], "target_ai_topics"), false);
	assert.equal(cleanState.people[0].target_ai_topics, undefined);

	// Non-array target_ai_topics is dropped without throwing
	for (const badTopics of ["AI_LIT_PROMPT", 123, null, true, {}]) {
		const nonArrayDoc = {
			schema: SCHEMA,
			people: [
				{
					role: "student",
					region: "SOUTH",
					availability: ["SUN_16", "MON_18"],
					subjects: ["MATH", "PHYSICS"],
					target_ai_topics: badTopics,
				},
			],
			queue: emptyQueue(),
			log: emptyLog(),
		};
		const resState = deserialize(JSON.stringify(nonArrayDoc));
		assert.equal(Object.hasOwn(resState.people[0], "target_ai_topics"), false);
	}
});

test("a full export -> import -> export cycle is identical", () => {
	const studentWithTopics = Object.freeze({
		...STUDENT,
		target_ai_topics: Object.freeze(["AI_LIT_PROMPT", "AI_CREATIVE"]),
	});
	const pupilWithTopics = Object.freeze({
		...PUPIL,
		target_ai_topics: Object.freeze(["AI_STEM_CODE"]),
	});
	const pupilWithoutTopics = PUPIL;

	const state = Object.freeze({
		people: Object.freeze([
			studentWithTopics,
			pupilWithTopics,
			pupilWithoutTopics,
		]),
		queue: emptyQueue(),
		log: emptyLog(),
	});

	const text1 = serialize(state);
	const state2 = deserialize(text1);
	const text2 = serialize(state2);

	assert.equal(text1, text2);
	assert.deepEqual(state2.people, state.people);

	// Repeated cycle produces identical result
	const state3 = deserialize(text2);
	const text3 = serialize(state3);
	assert.equal(text2, text3);
});

test("a stored person with target_ai_topics plus a name field is still refused with 'personal data is not accepted'", () => {
	const doc = {
		schema: SCHEMA,
		people: [
			{
				role: "student",
				region: "SOUTH",
				availability: ["SUN_16", "MON_18"],
				subjects: ["MATH", "PHYSICS"],
				target_ai_topics: ["AI_LIT_PROMPT"],
				name: "Dana",
			},
		],
		queue: emptyQueue(),
		log: emptyLog(),
	};

	assert.throws(() => deserialize(JSON.stringify(doc)), {
		message: PERSONAL_DATA_ERROR,
	});

	// Check other PII fields
	for (const piiKey of ["phone", "email", "id", "socialHandle"]) {
		const piiDoc = {
			schema: SCHEMA,
			people: [
				{
					role: "student",
					region: "SOUTH",
					availability: ["SUN_16", "MON_18"],
					subjects: ["MATH", "PHYSICS"],
					target_ai_topics: ["AI_LIT_PROMPT"],
					[piiKey]: "pii_value",
				},
			],
			queue: emptyQueue(),
			log: emptyLog(),
		};
		assert.throws(() => deserialize(JSON.stringify(piiDoc)), {
			message: PERSONAL_DATA_ERROR,
		});
	}

	// Verify rejected state is saved by createStore
	const backend = memoryBackend();
	const store = createStore(backend, "test_store");
	backend.setItem("test_store", JSON.stringify(doc));
	const loaded = store.load();
	assert.equal(loaded.problem, PERSONAL_DATA_ERROR);
	assert.deepEqual(loaded.state, emptyState());
	assert.equal(
		backend.getItem(`test_store${REJECTED_SUFFIX}`),
		JSON.stringify(doc),
	);
});

test("states without target_ai_topics serialize exactly as before", () => {
	const state = Object.freeze({
		people: Object.freeze([STUDENT, PUPIL]),
		queue: emptyQueue(),
		log: emptyLog(),
	});

	const expected = JSON.stringify({
		schema: SCHEMA,
		people: [STUDENT, PUPIL],
		queue: emptyQueue(),
		log: emptyLog(),
		attendance: [],
	});

	assert.equal(serialize(state), expected);

	// Empty state check
	assert.equal(
		serialize(emptyState()),
		JSON.stringify({
			schema: SCHEMA,
			people: [],
			queue: emptyQueue(),
			log: emptyLog(),
			attendance: [],
		}),
	);

	// Round-trip check
	const back = deserialize(expected);
	assert.deepEqual(back.people, [STUDENT, PUPIL]);
	assert.equal(serialize(back), expected);
});
