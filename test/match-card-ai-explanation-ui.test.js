const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const match2 = require("../src/lib/match2.js");

const shell = fs.readFileSync(path.join(__dirname, "..", "src", "app-shell.html"), "utf8");

test("app-shell renders ai-match-explanation class for AI overlap", () => {
	assert.match(shell, /ai-match-explanation/);
	assert.match(shell, /scorePair/);
	assert.match(shell, /aiExplanation/);
});

test("explainAiTopics returns empty-ish when no overlap sharedCount", () => {
	const expl = match2.explainAiTopics({
		counted: true,
		sharedCount: 0,
		points: 0,
		topics: [],
	});
	assert.equal(expl.sharedCount, 0);
	assert.ok(expl.he.includes("0"));
});

test("explainAiTopics returns he/ar/ru with shared topics", () => {
	const expl = match2.explainAiTopics({
		counted: true,
		sharedCount: 1,
		points: 20,
		topics: ["AI_LIT_PROMPT"],
	});
	assert.ok(expl.he.length > 0);
	assert.ok(expl.ar.length > 0);
	assert.ok(expl.ru.length > 0);
	assert.equal(expl.sharedCount, 1);
});

test("scorePair exposes aiExplanation for overlapping AI topics", () => {
	const student = {
		region: "center",
		availability: ["SUN_16"],
		subjects: ["MATH"],
		target_ai_topics: ["AI_LIT_PROMPT", "AI_CREATIVE"],
	};
	const pupil = {
		region: "center",
		availability: ["SUN_16"],
		subjects: ["MATH"],
		parentConsent: true,
		target_ai_topics: ["AI_LIT_PROMPT"],
	};
	const scored = match2.scorePair(student, pupil);
	assert.ok(scored.aiExplanation);
	assert.ok(scored.aiExplanation.sharedCount >= 1);
	assert.ok(scored.aiExplanation.he.length > 0);
});

test("no ai-match-explanation markup path without sharedCount", () => {
	assert.match(shell, /sharedCount > 0/);
});
