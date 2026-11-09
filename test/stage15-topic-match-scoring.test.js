const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

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
			return k in attrs ? attrs[k] : null;
		},
		removeAttribute() {},
		click(target) {
			const ev = { target: target || this, preventDefault() {} };
			for (const fn of handlers.click || []) {
				fn.call(this, ev);
			}
		},
	};
}

function loadAppShellContext() {
	const html = fs.readFileSync(
		path.join(ROOT, "src", "app-shell.html"),
		"utf8",
	);
	const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(
		(m) => m[1],
	);
	assert.ok(scripts.length >= 3, "src/app-shell.html should carry its scripts");

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

test("badge text for 1.0, 0.5, and 0 in Hebrew, Arabic, and Russian", () => {
	assert.equal(aiTopicBadgeText(1.0, "he"), "התאמת נושאי AI: 100%");
	assert.equal(aiTopicBadgeText(0.5, "he"), "התאמת נושאי AI: 50%");
	assert.equal(aiTopicBadgeText(0, "he"), "התאמת נושאי AI: 0%");

	assert.equal(
		aiTopicBadgeText(1.0, "ar"),
		"توافق مواضيع الذكاء الاصطناعي: 100%",
	);
	assert.equal(
		aiTopicBadgeText(0.5, "ar"),
		"توافق مواضيع الذكاء الاصطناعي: 50%",
	);
	assert.equal(aiTopicBadgeText(0, "ar"), "توافق مواضيع الذكاء الاصطناعي: 0%");

	assert.equal(aiTopicBadgeText(1.0, "ru"), "Совпадение тем ИИ: 100%");
	assert.equal(aiTopicBadgeText(0.5, "ru"), "Совпадение тем ИИ: 50%");
	assert.equal(aiTopicBadgeText(0, "ru"), "Совпадение тем ИИ: 0%");
});

test("rounding of fractional match percentages (e.g. 2/3 -> 67%)", () => {
	assert.equal(aiTopicBadgeText(2 / 3, "he"), "התאמת נושאי AI: 67%");
	assert.equal(
		aiTopicBadgeText(2 / 3, "ar"),
		"توافق مواضيع الذكاء الاصطناعي: 67%",
	);
	assert.equal(aiTopicBadgeText(2 / 3, "ru"), "Совпадение тем ИИ: 67%");
	assert.equal(aiTopicBadgeText(1 / 3, "he"), "התאמת נושאי AI: 33%");
	assert.equal(aiTopicBadgeText(1 / 6, "he"), "התאמת נושאי AI: 17%");
	assert.equal(aiTopicBadgeText(5 / 6, "he"), "התאמת נושאי AI: 83%");
	assert.equal(aiTopicBadgeText(0.125, "he"), "התאמת נושאי AI: 13%");
	assert.equal(aiTopicBadgeText(0.875, "he"), "התאמת נושאי AI: 88%");
});

test("unknown language code falls back to Hebrew", () => {
	assert.equal(aiTopicBadgeText(1.0, "en"), "התאמת נושאי AI: 100%");
	assert.equal(aiTopicBadgeText(0.5, "fr"), "התאמת נושאי AI: 50%");
	assert.equal(aiTopicBadgeText(0, "de"), "התאמת נושאי AI: 0%");
	assert.equal(aiTopicBadgeText(0.5, ""), "התאמת נושאי AI: 50%");
	assert.equal(aiTopicBadgeText(0.5, null), "התאמת נושאי AI: 50%");
	assert.equal(aiTopicBadgeText(0.5, undefined), "התאמת נושאי AI: 50%");
});

test("missing or invalid topic arrays give 0 and do not throw", () => {
	assert.doesNotThrow(() => {
		assert.equal(calculateAITopicMatch(undefined, undefined), 0);
		assert.equal(calculateAITopicMatch(null, null), 0);
		assert.equal(calculateAITopicMatch([], []), 0);
		assert.equal(calculateAITopicMatch(undefined, ["AI_LIT_PROMPT"]), 0);
		assert.equal(calculateAITopicMatch(["AI_LIT_PROMPT"], undefined), 0);
		assert.equal(calculateAITopicMatch(null, ["AI_LIT_PROMPT"]), 0);
		assert.equal(calculateAITopicMatch(["AI_LIT_PROMPT"], null), 0);
		assert.equal(calculateAITopicMatch("not_an_array", ["AI_LIT_PROMPT"]), 0);
		assert.equal(calculateAITopicMatch(["AI_LIT_PROMPT"], "not_an_array"), 0);
		assert.equal(calculateAITopicMatch(123, {}), 0);
		assert.equal(calculateAITopicMatch({ a: 1 }, 456), 0);
		assert.equal(aiTopicBadgeText(undefined, "he"), "התאמת נושאי AI: 0%");
		assert.equal(aiTopicBadgeText(null, "he"), "התאמת נושאי AI: 0%");
		assert.equal(aiTopicBadgeText(NaN, "he"), "התאמת נושאי AI: 0%");
		assert.equal(aiTopicBadgeText("bad", "he"), "התאמת נושאי AI: 0%");
	});
});

test("tie-break ordering puts higher topic match first among equal scores and leaves different scores in order", () => {
	const pairs = [
		{ id: "pair-low-score-high-ai", score: 60, aiTopicMatch: 1.0 },
		{ id: "pair-mid-score-low-ai", score: 75, aiTopicMatch: 0.25 },
		{ id: "pair-high-score-zero-ai", score: 90, aiTopicMatch: 0.0 },
		{ id: "pair-mid-score-high-ai", score: 75, aiTopicMatch: 0.75 },
		{ id: "pair-mid-score-equal-ai-1", score: 75, aiTopicMatch: 0.5 },
		{ id: "pair-mid-score-equal-ai-2", score: 75, aiTopicMatch: 0.5 },
	];

	const sorted = sortMatch2Pairs(pairs);

	assert.equal(
		sorted[0].id,
		"pair-high-score-zero-ai",
		"score 90 should be first despite 0 aiTopicMatch",
	);
	assert.equal(
		sorted[1].id,
		"pair-mid-score-high-ai",
		"score 75 with aiTopicMatch 0.75 comes before lower ai matches",
	);
	assert.equal(
		sorted[2].id,
		"pair-mid-score-equal-ai-1",
		"score 75 with aiTopicMatch 0.5 comes before 0.25 (stable order 1)",
	);
	assert.equal(
		sorted[3].id,
		"pair-mid-score-equal-ai-2",
		"score 75 with aiTopicMatch 0.5 comes before 0.25 (stable order 2)",
	);
	assert.equal(
		sorted[4].id,
		"pair-mid-score-low-ai",
		"score 75 with aiTopicMatch 0.25 comes last among score 75",
	);
	assert.equal(
		sorted[5].id,
		"pair-low-score-high-ai",
		"score 60 remains last despite 1.0 aiTopicMatch",
	);

	for (let i = 0; i < sorted.length - 1; i++) {
		assert.ok(
			sorted[i].score >= sorted[i + 1].score,
			"higher scores always precede lower scores",
		);
		if (sorted[i].score === sorted[i + 1].score) {
			assert.ok(
				sorted[i].aiTopicMatch >= sorted[i + 1].aiTopicMatch,
				"equal scores tie-broken by aiTopicMatch descending",
			);
		}
	}
});

test("sortMatch2Pairs calculates aiTopicMatch from participant target_ai_topics when omitted", () => {
	const students = [
		{ target_ai_topics: ["AI_LIT_PROMPT", "AI_CREATIVE"] },
		{ target_ai_topics: ["AI_STEM_CODE"] },
	];
	const pupils = [
		{ target_ai_topics: ["AI_LIT_PROMPT", "AI_CREATIVE"] },
		{ target_ai_topics: ["AI_LIT_PROMPT"] },
	];
	const pairs = [
		{ studentIndex: 1, pupilIndex: 1, score: 70 },
		{ studentIndex: 0, pupilIndex: 0, score: 70 },
		{ studentIndex: 0, pupilIndex: 1, score: 70 },
	];
	const ranked = sortMatch2Pairs(pairs, students, pupils);
	assert.equal(ranked[0].aiTopicMatch, 1.0);
	assert.equal(ranked[1].aiTopicMatch, 1.0);
	assert.equal(ranked[2].aiTopicMatch, 0);
	assert.equal(ranked[2].studentIndex, 1);
});

test("no names, contact details, or PII in the badge output or attached view model", () => {
	const PII_REGEX =
		/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}|(?:\+?972[-.\s]?|0)(?:5\d|7[2-9])[-.\s]?\d{3}[-.\s]?\d{4}|(?<!\d)\d{9}(?!\d)|https?:\/\/|www\./;
	const BADGE_REGEX =
		/^(?:התאמת נושאי AI|توافق مواضيع الذكاء الاصطناعي|Совпадение тем ИИ): \d+%/;

	for (const lang of ["he", "ar", "ru"]) {
		for (const ratio of [0, 0.25, 0.5, 2 / 3, 1.0]) {
			const badge = aiTopicBadgeText(ratio, lang);
			assert.match(
				badge,
				BADGE_REGEX,
				"badge output follows strictly allowed label + percentage format",
			);
			assert.equal(
				PII_REGEX.test(badge),
				false,
				"badge output must contain zero PII",
			);
			assert.equal(
				/name|phone|mail|תעודת זהות/i.test(badge),
				false,
				"no identifiers in badge output",
			);
		}
	}
});
