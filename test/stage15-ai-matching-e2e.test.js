const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const {
	match2,
	scorePair,
	aiTopicOverlap,
	AI_TOPIC_WEIGHT,
} = require("../src/lib/match2.js");

const ROOT = path.join(__dirname, "..");

function fakeElement(id) {
	const handlers = {};
	const attrs = {};
	return {
		id,
		value: "",
		textContent: "",
		className: "",
		innerHTML: "",
		hidden: false,
		children: [],
		addEventListener(type, fn) {
			if (!handlers[type]) handlers[type] = [];
			handlers[type].push(fn);
		},
		setAttribute(k, v) {
			attrs[k] = String(v);
		},
		getAttribute(k) {
			return Object.hasOwn(attrs, k) ? attrs[k] : null;
		},
		removeAttribute(k) {
			delete attrs[k];
		},
		click(target) {
			const ev = { target: target || this, preventDefault() {} };
			for (const fn of handlers.click || []) {
				fn.call(this, ev);
			}
		},
	};
}

function loadAppShellContext() {
	const shellPath = fs.existsSync(path.join(ROOT, "src", "app-shell.html"))
		? path.join(ROOT, "src", "app-shell.html")
		: path.join(ROOT, "app.html");
	const html = fs.readFileSync(shellPath, "utf8");
	const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(
		(m) => m[1],
	);
	assert.ok(scripts.length >= 3, "app shell should carry inline scripts");

	const els = {};
	const $ = (id) => (els[id] = els[id] || fakeElement(id));
	const store = {};
	const storage = {
		getItem: (k) => (Object.hasOwn(store, k) ? store[k] : null),
		setItem: (k, v) => {
			store[k] = String(v);
		},
		removeItem: (k) => {
			delete store[k];
		},
	};
	const doc = {
		getElementById: $,
		querySelectorAll: () => [],
		querySelector: () => null,
		documentElement: { lang: "he", dir: "rtl" },
		head: { appendChild() {} },
		createElement: () => fakeElement("dummy"),
	};
	const windowObj = {
		scrollTo() {},
		document: doc,
		localStorage: storage,
	};

	const ctx = {
		document: doc,
		localStorage: storage,
		window: windowObj,
		console,
		URL: { createObjectURL: () => "" },
		Blob: () => {},
	};

	vm.createContext(ctx);

	vm.runInContext(scripts[0], ctx);

	const libDir = path.join(ROOT, "src", "lib");
	for (const file of fs.readdirSync(libDir)) {
		if (file.endsWith(".js")) {
			const key = file.replace(/\.js$/, "");
			ctx.__registry[key] = require(path.join(libDir, file));
		}
	}

	vm.runInContext(scripts[2], ctx);

	return ctx.window;
}

const app = loadAppShellContext();
const { calculateAITopicMatch, aiTopicBadgeText, sortMatch2Pairs } = app;

test("1. Scenario: one pupil with target_ai_topics and two identical students - overlapping student gets higher score and is matched by match2", () => {
	const pupil = {
		region: "CENTER",
		availability: ["SUN_8"],
		subjects: ["MATH"],
		level: 3,
		languages: ["HE"],
		parentConsent: true,
		target_ai_topics: ["AI_STEM_CODE", "AI_ETHICS_SEC"],
	};

	const studentOverlapping = {
		region: "CENTER",
		availability: ["SUN_8"],
		subjects: ["MATH"],
		level: 3,
		languages: ["HE"],
		target_ai_topics: ["AI_STEM_CODE", "AI_ETHICS_SEC"],
	};

	const studentPlain = {
		region: "CENTER",
		availability: ["SUN_8"],
		subjects: ["MATH"],
		level: 3,
		languages: ["HE"],
		target_ai_topics: [],
	};

	const scOverlapping = scorePair(studentOverlapping, pupil);
	const scPlain = scorePair(studentPlain, pupil);

	assert.equal(scOverlapping.breakdown.aiTopics, AI_TOPIC_WEIGHT);
	assert.equal(scOverlapping.breakdown.aiTopicsCounted, true);
	assert.equal(scPlain.breakdown.aiTopics, 0);
	assert.equal(scPlain.breakdown.aiTopicsCounted, false);

	const earnedOverlapping =
		scOverlapping.breakdown.region +
		scOverlapping.breakdown.hours +
		scOverlapping.breakdown.subject +
		scOverlapping.breakdown.level +
		scOverlapping.breakdown.language +
		scOverlapping.breakdown.preference +
		scOverlapping.breakdown.aiTopics;
	const includedOverlapping = 25 + 20 + 20 + 10 + 15 + 10 + AI_TOPIC_WEIGHT;
	const expectedScoreOverlapping = Math.round(
		(earnedOverlapping / includedOverlapping) * 100,
	);

	const earnedPlain =
		scPlain.breakdown.region +
		scPlain.breakdown.hours +
		scPlain.breakdown.subject +
		scPlain.breakdown.level +
		scPlain.breakdown.language +
		scPlain.breakdown.preference +
		scPlain.breakdown.aiTopics;
	const includedPlain = 25 + 20 + 20 + 10 + 15 + 10;
	const expectedScorePlain = Math.round((earnedPlain / includedPlain) * 100);

	assert.equal(scOverlapping.score, expectedScoreOverlapping);
	assert.equal(scPlain.score, expectedScorePlain);
	assert.equal(scOverlapping.breakdown.total, expectedScoreOverlapping);
	assert.equal(scPlain.breakdown.total, expectedScorePlain);

	assert.ok(
		scOverlapping.score > scPlain.score,
		`expected overlapping score (${scOverlapping.score}) > plain score (${scPlain.score})`,
	);
	assert.equal(scOverlapping.score, 73);
	assert.equal(scPlain.score, 67);

	const res1 = match2([studentOverlapping, studentPlain], [pupil]);
	assert.equal(res1.pairs.length, 1);
	assert.equal(res1.pairs[0].studentIndex, 0);
	assert.equal(res1.pairs[0].pupilIndex, 0);
	assert.equal(res1.pairs[0].score, scOverlapping.score);

	const res2 = match2([studentPlain, studentOverlapping], [pupil]);
	assert.equal(res2.pairs.length, 1);
	assert.equal(res2.pairs[0].studentIndex, 1);
	assert.equal(res2.pairs[0].pupilIndex, 0);
	assert.equal(res2.pairs[0].score, scOverlapping.score);
});

test("2. Student without topics gets identical score and breakdown as input without target_ai_topics (backward compatibility)", () => {
	const pupil = {
		region: "CENTER",
		availability: ["SUN_8"],
		subjects: ["MATH"],
		level: 3,
		languages: ["HE"],
		parentConsent: true,
		target_ai_topics: ["AI_STEM_CODE", "AI_ETHICS_SEC"],
	};

	const studentEmptyTopics = {
		region: "CENTER",
		availability: ["SUN_8"],
		subjects: ["MATH"],
		level: 3,
		languages: ["HE"],
		target_ai_topics: [],
	};

	const studentNoTopicField = {
		region: "CENTER",
		availability: ["SUN_8"],
		subjects: ["MATH"],
		level: 3,
		languages: ["HE"],
	};

	const pupilNoTopicField = {
		region: "CENTER",
		availability: ["SUN_8"],
		subjects: ["MATH"],
		level: 3,
		languages: ["HE"],
		parentConsent: true,
	};

	const scEmpty = scorePair(studentEmptyTopics, pupil);
	const scNoField = scorePair(studentNoTopicField, pupil);
	const scBothNoField = scorePair(studentNoTopicField, pupilNoTopicField);

	assert.equal(scEmpty.score, scNoField.score);
	assert.equal(scEmpty.score, scBothNoField.score);
	assert.deepEqual(scEmpty.breakdown, scNoField.breakdown);
	assert.deepEqual(scEmpty.breakdown, scBothNoField.breakdown);
	assert.equal(scEmpty.breakdown.aiTopics, 0);
	assert.equal(scEmpty.breakdown.aiTopicsCounted, false);
});

test("3. Localized UI badge and calculateAITopicMatch on scenario topics", () => {
	const pupilTopics = ["AI_STEM_CODE", "AI_ETHICS_SEC"];
	const overlappingTopics = ["AI_STEM_CODE", "AI_ETHICS_SEC"];
	const plainTopics = [];

	assert.equal(calculateAITopicMatch(overlappingTopics, pupilTopics), 1);
	assert.equal(calculateAITopicMatch(plainTopics, pupilTopics), 0);
	assert.equal(calculateAITopicMatch(undefined, pupilTopics), 0);
	assert.equal(aiTopicOverlap(overlappingTopics, pupilTopics), 1);
	assert.equal(aiTopicOverlap(plainTopics, pupilTopics), 0);

	assert.equal(aiTopicBadgeText(1, "he"), "התאמת נושאי AI: 100%");
	assert.equal(aiTopicBadgeText(0.5, "he"), "התאמת נושאי AI: 50%");
	assert.equal(
		aiTopicBadgeText(1, "ar"),
		"توافق مواضيع الذكاء الاصطناعي: 100%",
	);
	assert.equal(
		aiTopicBadgeText(0.5, "ar"),
		"توافق مواضيع الذكاء الاصطناعي: 50%",
	);
	assert.equal(aiTopicBadgeText(1, "ru"), "Совпадение тем ИИ: 100%");
	assert.equal(aiTopicBadgeText(0.5, "ru"), "Совпадение тем ИИ: 50%");
});

test("4. Shell tie-break ranking sorts higher aiTopicMatch first among equal scores", () => {
	assert.equal(typeof sortMatch2Pairs, "function");

	const students = [
		{
			target_ai_topics: ["AI_STEM_CODE", "AI_ETHICS_SEC"],
		},
		{
			target_ai_topics: [],
		},
	];
	const pupils = [
		{
			target_ai_topics: ["AI_STEM_CODE", "AI_ETHICS_SEC"],
		},
	];

	const equalScorePairs = [
		{ studentIndex: 1, pupilIndex: 0, score: 75 },
		{ studentIndex: 0, pupilIndex: 0, score: 75 },
	];

	const ranked = sortMatch2Pairs(equalScorePairs, students, pupils);
	assert.equal(ranked.length, 2);
	assert.equal(
		ranked[0].studentIndex,
		0,
		"overlapping student (studentIndex 0) should rank first among equal scores",
	);
	assert.equal(ranked[0].aiTopicMatch, 1);
	assert.equal(
		ranked[1].studentIndex,
		1,
		"plain student (studentIndex 1) should rank second",
	);
	assert.equal(ranked[1].aiTopicMatch, 0);

	const explicitAiPairs = [
		{ id: "pair-plain", score: 80, aiTopicMatch: 0 },
		{ id: "pair-overlap", score: 80, aiTopicMatch: 1.0 },
	];
	const sortedExplicit = sortMatch2Pairs(explicitAiPairs);
	assert.equal(sortedExplicit[0].id, "pair-overlap");
	assert.equal(sortedExplicit[1].id, "pair-plain");
});

test("5. Serialization: full state with target_ai_topics and match2 result survives JSON round-trip deep-equal", () => {
	const students = [
		{
			region: "CENTER",
			availability: ["SUN_8", "SUN_9"],
			subjects: ["MATH", "ENGLISH"],
			level: 3,
			languages: ["HE"],
			target_ai_topics: ["AI_STEM_CODE", "AI_ETHICS_SEC"],
		},
		{
			region: "NORTH",
			availability: ["MON_10"],
			subjects: ["SCIENCE"],
			level: 4,
			languages: ["AR"],
			target_ai_topics: ["AI_LIT_PROMPT"],
		},
	];

	const pupils = [
		{
			region: "CENTER",
			availability: ["SUN_8"],
			subjects: ["MATH"],
			level: 3,
			languages: ["HE"],
			parentConsent: true,
			target_ai_topics: ["AI_STEM_CODE", "AI_ETHICS_SEC"],
		},
		{
			region: "NORTH",
			availability: ["MON_10"],
			subjects: ["SCIENCE"],
			level: 4,
			languages: ["AR"],
			parentConsent: true,
			target_ai_topics: ["AI_LIT_PROMPT", "AI_CREATIVE"],
		},
	];

	const matchResult = match2(students, pupils);
	const fullState = {
		students,
		pupils,
		matchResult,
	};

	const serialized = JSON.stringify(fullState);
	const restored = JSON.parse(serialized);

	assert.deepEqual(restored, fullState);
	assert.deepEqual(restored.students[0].target_ai_topics, [
		"AI_STEM_CODE",
		"AI_ETHICS_SEC",
	]);
	assert.deepEqual(restored.students[1].target_ai_topics, ["AI_LIT_PROMPT"]);
	assert.deepEqual(restored.pupils[0].target_ai_topics, [
		"AI_STEM_CODE",
		"AI_ETHICS_SEC",
	]);
	assert.deepEqual(restored.pupils[1].target_ai_topics, [
		"AI_LIT_PROMPT",
		"AI_CREATIVE",
	]);
	assert.equal(restored.matchResult.pairs.length, 2);
	assert.equal(
		restored.matchResult.pairs[0].breakdown.aiTopics,
		AI_TOPIC_WEIGHT,
	);
	assert.equal(restored.matchResult.pairs[0].breakdown.aiTopicsCounted, true);
});

test("6. Zero PII: synthetic names, phones, emails do not appear in match2 result, breakdown, explanationHe, or badge", () => {
	const fakePii = [
		"Test Name",
		"050-0000000",
		"x@example.com",
		"Pupil Name",
		"052-1234567",
		"pupil@example.com",
		"123456789",
		"987654321",
	];

	const studentWithPii = {
		name: "Test Name",
		phone: "050-0000000",
		email: "x@example.com",
		id_number: "123456789",
		region: "CENTER",
		availability: ["SUN_8"],
		subjects: ["MATH"],
		level: 3,
		languages: ["HE"],
		target_ai_topics: ["AI_STEM_CODE", "AI_ETHICS_SEC"],
	};

	const pupilWithPii = {
		name: "Pupil Name",
		phone: "052-1234567",
		email: "pupil@example.com",
		id_number: "987654321",
		region: "CENTER",
		availability: ["SUN_8"],
		subjects: ["MATH"],
		level: 3,
		languages: ["HE"],
		parentConsent: true,
		target_ai_topics: ["AI_STEM_CODE", "AI_ETHICS_SEC"],
	};

	const matchResult = match2([studentWithPii], [pupilWithPii]);
	assert.equal(matchResult.pairs.length, 1);

	const pair = matchResult.pairs[0];
	const serializedResult = JSON.stringify(matchResult);
	const serializedBreakdown = JSON.stringify(pair.breakdown);
	const explanation = pair.explanationHe;
	const badges = [
		aiTopicBadgeText(1, "he"),
		aiTopicBadgeText(0.5, "he"),
		aiTopicBadgeText(1, "ar"),
		aiTopicBadgeText(1, "ru"),
	];

	for (const pii of fakePii) {
		assert.equal(
			serializedResult.includes(pii),
			false,
			`match2 result should not include PII token "${pii}"`,
		);
		assert.equal(
			serializedBreakdown.includes(pii),
			false,
			`breakdown should not include PII token "${pii}"`,
		);
		assert.equal(
			explanation.includes(pii),
			false,
			`explanationHe should not include PII token "${pii}"`,
		);
		for (const badge of badges) {
			assert.equal(
				badge.includes(pii),
				false,
				`badge text should not include PII token "${pii}"`,
			);
		}
	}

	const PII_REGEX =
		/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}|(?:\+?972[-.\s]?|0)(?:5\d|7[2-9])[-.\s]?\d{3}[-.\s]?\d{4}|(?<!\d)\d{9}(?!\d)|https?:\/\/|www\./;
	assert.equal(PII_REGEX.test(serializedResult), false);
	assert.equal(PII_REGEX.test(serializedBreakdown), false);
	assert.equal(PII_REGEX.test(explanation), false);
	for (const badge of badges) {
		assert.equal(PII_REGEX.test(badge), false);
	}
});

test("7. Partial overlap (50%) sits strictly between 100% overlap and 0% overlap in scoring, breakdown, and UI badge", () => {
	const pupil = {
		region: "CENTER",
		availability: ["SUN_8"],
		subjects: ["MATH"],
		level: 3,
		languages: ["HE"],
		parentConsent: true,
		target_ai_topics: ["AI_STEM_CODE", "AI_ETHICS_SEC"],
	};

	const studentFull = {
		region: "CENTER",
		availability: ["SUN_8"],
		subjects: ["MATH"],
		level: 3,
		languages: ["HE"],
		target_ai_topics: ["AI_STEM_CODE", "AI_ETHICS_SEC"],
	};

	const studentPartial = {
		region: "CENTER",
		availability: ["SUN_8"],
		subjects: ["MATH"],
		level: 3,
		languages: ["HE"],
		target_ai_topics: ["AI_STEM_CODE"],
	};

	const studentZero = {
		region: "CENTER",
		availability: ["SUN_8"],
		subjects: ["MATH"],
		level: 3,
		languages: ["HE"],
		target_ai_topics: ["AI_LIT_PROMPT"],
	};

	const scFull = scorePair(studentFull, pupil);
	const scPartial = scorePair(studentPartial, pupil);
	const scZero = scorePair(studentZero, pupil);

	assert.equal(scFull.breakdown.aiTopics, 20);
	assert.equal(scPartial.breakdown.aiTopics, 10);
	assert.equal(scZero.breakdown.aiTopics, 0);

	assert.ok(scFull.score > scPartial.score);
	assert.ok(scPartial.score > scZero.score);

	assert.equal(
		calculateAITopicMatch(
			studentPartial.target_ai_topics,
			pupil.target_ai_topics,
		),
		0.5,
	);
	assert.equal(aiTopicBadgeText(0.5, "he"), "התאמת נושאי AI: 50%");
});
