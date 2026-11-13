const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const { openApp, ROOT } = require("../test-support/fake-dom.js");
const { serialize, DEFAULT_KEY } = require("../src/lib/store.js");
const { emptyQueue } = require("../src/lib/approval.js");
const { emptyLog } = require("../src/lib/session.js");
const i18n = require("../src/lib/i18n.js");
const { tExtra } = require("../src/lib/lang-extra.js");

const shell = fs.readFileSync(path.join(ROOT, "src", "app-shell.html"), "utf8");

test("default state is off (aria-pressed=false) and all match cards are displayed", () => {
	assert.match(shell, /id="btn-filter-ai-only"/);
	assert.match(shell, /id="matchAiOnlyEmpty"/);
	assert.match(shell, /aria-pressed="false"/);

	const people = [
		{
			role: "student",
			region: "CENTER",
			availability: ["SUN_16"],
			subjects: ["MATH"],
			target_ai_topics: ["AI_STEM_CODE"],
		},
		{
			role: "pupil",
			region: "CENTER",
			availability: ["SUN_16"],
			subjects: ["MATH"],
			parentConsent: true,
			target_ai_topics: ["AI_STEM_CODE"],
		},
		{
			role: "student",
			region: "NORTH",
			availability: ["MON_18"],
			subjects: ["PHYSICS"],
			target_ai_topics: [],
		},
		{
			role: "pupil",
			region: "NORTH",
			availability: ["MON_18"],
			subjects: ["PHYSICS"],
			parentConsent: true,
			target_ai_topics: [],
		},
	];

	const $ = openApp({
		store: {
			[DEFAULT_KEY]: serialize({
				people: people,
				queue: emptyQueue(),
				log: emptyLog(),
			}),
		},
	});

	const filterBtn = $("btn-filter-ai-only");
	assert.ok(filterBtn, "#btn-filter-ai-only should exist");
	assert.equal(filterBtn.getAttribute("aria-pressed"), "false");
	assert.equal(filterBtn.textContent.trim(), "התאמת AI בלבד");

	const emptyEl = $("matchAiOnlyEmpty");
	assert.ok(emptyEl, "#matchAiOnlyEmpty should exist");
	assert.equal(emptyEl.hidden, true);

	$("runMatch2").fire("click");

	assert.equal(filterBtn.getAttribute("aria-pressed"), "false");
	const outHtml = $("match2Out").innerHTML;
	assert.match(outHtml, /סטודנט 1 · תלמיד 1/);
	assert.match(outHtml, /סטודנט 2 · תלמיד 2/);
	assert.equal(emptyEl.hidden, true);
});

test("activating filter updates aria-pressed to true and shows only cards with AI topic overlap", () => {
	const people = [
		{
			role: "student",
			region: "CENTER",
			availability: ["SUN_16"],
			subjects: ["MATH"],
			target_ai_topics: ["AI_STEM_CODE"],
		},
		{
			role: "pupil",
			region: "CENTER",
			availability: ["SUN_16"],
			subjects: ["MATH"],
			parentConsent: true,
			target_ai_topics: ["AI_STEM_CODE"],
		},
		{
			role: "student",
			region: "NORTH",
			availability: ["MON_18"],
			subjects: ["PHYSICS"],
			target_ai_topics: ["AI_LIT_PROMPT"],
		},
		{
			role: "pupil",
			region: "NORTH",
			availability: ["MON_18"],
			subjects: ["PHYSICS"],
			parentConsent: true,
			target_ai_topics: ["AI_CREATIVE"],
		},
	];

	const $ = openApp({
		store: {
			[DEFAULT_KEY]: serialize({
				people: people,
				queue: emptyQueue(),
				log: emptyLog(),
			}),
		},
	});

	$("runMatch2").fire("click");
	assert.match($("match2Out").innerHTML, /סטודנט 1 · תלמיד 1/);
	assert.match($("match2Out").innerHTML, /סטודנט 2 · תלמיד 2/);

	$("btn-filter-ai-only").fire("click");
	assert.equal($("btn-filter-ai-only").getAttribute("aria-pressed"), "true");

	const filteredHtml = $("match2Out").innerHTML;
	assert.match(filteredHtml, /סטודנט 1 · תלמיד 1/);
	assert.doesNotMatch(filteredHtml, /סטודנט 2 · תלמיד 2/);
	assert.equal($("matchAiOnlyEmpty").hidden, true);
});

test("shows #matchAiOnlyEmpty when no AI matches exist, and toggling off restores full list", () => {
	const people = [
		{
			role: "student",
			region: "NORTH",
			availability: ["MON_18"],
			subjects: ["PHYSICS"],
			target_ai_topics: ["AI_LIT_PROMPT"],
		},
		{
			role: "pupil",
			region: "NORTH",
			availability: ["MON_18"],
			subjects: ["PHYSICS"],
			parentConsent: true,
			target_ai_topics: ["AI_CREATIVE"],
		},
	];

	const $ = openApp({
		store: {
			[DEFAULT_KEY]: serialize({
				people: people,
				queue: emptyQueue(),
				log: emptyLog(),
			}),
		},
	});

	$("runMatch2").fire("click");
	assert.match($("match2Out").innerHTML, /סטודנט 1 · תלמיד 1/);

	$("btn-filter-ai-only").fire("click");
	assert.equal($("btn-filter-ai-only").getAttribute("aria-pressed"), "true");
	assert.equal($("match2Out").innerHTML, "");
	assert.equal($("matchAiOnlyEmpty").hidden, false);
	assert.equal(
		$("matchAiOnlyEmpty").textContent.trim(),
		"אין שידוכים עם חפיפת AI",
	);

	$("btn-filter-ai-only").fire("click");
	assert.equal($("btn-filter-ai-only").getAttribute("aria-pressed"), "false");
	assert.equal($("matchAiOnlyEmpty").hidden, true);
	assert.match($("match2Out").innerHTML, /סטודנט 1 · תלמיד 1/);
});

test("labels are properly localized in Hebrew, Arabic, and Russian", () => {
	assert.equal(i18n.t("matchAiOnlyFilter", "he"), "התאמת AI בלבד");
	assert.equal(i18n.t("matchAiOnlyFilter", "ar"), "تطابق الذكاء الاصطناعي فقط");
	assert.equal(i18n.t("matchAiOnlyFilter", "ru"), "Только совпадения ИИ");

	assert.equal(i18n.t("matchAiOnlyEmpty", "he"), "אין שידוכים עם חפיפת AI");
	assert.equal(
		i18n.t("matchAiOnlyEmpty", "ar"),
		"لا توجد مطابقات بتطابق الذكاء الاصطناعي",
	);
	assert.equal(i18n.t("matchAiOnlyEmpty", "ru"), "Нет совпадений по темам ИИ");

	assert.equal(tExtra("match.aiOnlyFilter", "he"), "התאמת AI בלבד");
	assert.equal(
		tExtra("match.aiOnlyFilter", "ar"),
		"تطابق الذكاء الاصطناعي فقط",
	);
	assert.equal(tExtra("match.aiOnlyFilter", "ru"), "Только совпадения ИИ");

	assert.equal(tExtra("match.aiOnlyEmpty", "he"), "אין שידוכים עם חפיפת AI");
	assert.equal(
		tExtra("match.aiOnlyEmpty", "ar"),
		"لا توجد مطابقات بتطابق الذكاء الاصطناعي",
	);
	assert.equal(tExtra("match.aiOnlyEmpty", "ru"), "Нет совпадений по темам ИИ");

	const peopleWithoutAi = [
		{
			role: "student",
			region: "NORTH",
			availability: ["MON_18"],
			subjects: ["PHYSICS"],
			target_ai_topics: [],
		},
		{
			role: "pupil",
			region: "NORTH",
			availability: ["MON_18"],
			subjects: ["PHYSICS"],
			parentConsent: true,
			target_ai_topics: [],
		},
	];

	const $ = openApp({
		store: {
			[DEFAULT_KEY]: serialize({
				people: peopleWithoutAi,
				queue: emptyQueue(),
				log: emptyLog(),
			}),
		},
	});

	$("runMatch2").fire("click");
	$("btn-filter-ai-only").fire("click");

	assert.equal($("btn-filter-ai-only").textContent.trim(), "התאמת AI בלבד");
	assert.equal(
		$("matchAiOnlyEmpty").textContent.trim(),
		"אין שידוכים עם חפיפת AI",
	);

	$("langSelect").value = "ar";
	$("langSelect").fire("change");
	assert.equal(
		$("btn-filter-ai-only").textContent.trim(),
		"تطابق الذكاء الاصطناعي فقط",
	);
	assert.equal(
		$("matchAiOnlyEmpty").textContent.trim(),
		"لا توجد مطابقات بتطابق الذكاء الاصطناعي",
	);

	$("langSelect").value = "ru";
	$("langSelect").fire("change");
	assert.equal(
		$("btn-filter-ai-only").textContent.trim(),
		"Только совпадения ИИ",
	);
	assert.equal(
		$("matchAiOnlyEmpty").textContent.trim(),
		"Нет совпадений по темам ИИ",
	);

	$("langSelect").value = "he";
	$("langSelect").fire("change");
	assert.equal($("btn-filter-ai-only").textContent.trim(), "התאמת AI בלבד");
	assert.equal(
		$("matchAiOnlyEmpty").textContent.trim(),
		"אין שידוכים עם חפיפת AI",
	);
});
