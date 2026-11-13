const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const { openApp, press, ROOT } = require("../test-support/fake-dom.js");
const { serialize, DEFAULT_KEY } = require("../src/lib/store.js");
const { emptyQueue } = require("../src/lib/approval.js");
const { emptyLog } = require("../src/lib/session.js");
const i18n = require("../src/lib/i18n.js");
const { tExtra } = require("../src/lib/lang-extra.js");

const shell = fs.readFileSync(path.join(ROOT, "src", "app-shell.html"), "utf8");

test("מצב ברירת מחדל כבוי: מסנן ללא נושאי AI כבוי כברירת מחדל עם aria-pressed='false' ומציג את כל המשתתפים", () => {
	assert.match(shell, /id="btn-filter-missing-ai"/);
	assert.match(shell, /id="resetAiFilter"/);

	const resetIdx = shell.indexOf('id="resetAiFilter"');
	const missingIdx = shell.indexOf('id="btn-filter-missing-ai"');
	assert.ok(
		missingIdx > resetIdx,
		"#btn-filter-missing-ai should be adjacent to #resetAiFilter",
	);

	const samplePeople = [
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
			target_ai_topics: [],
		},
		{
			role: "student",
			region: "NORTH",
			availability: ["MON_18"],
			subjects: ["PHYSICS"],
		},
		{
			role: "pupil",
			region: "NORTH",
			availability: ["MON_18"],
			subjects: ["PHYSICS"],
			parentConsent: true,
			target_ai_topics: ["AI_LIT_PROMPT"],
		},
	];

	const $ = openApp({
		store: {
			[DEFAULT_KEY]: serialize({
				people: samplePeople,
				queue: emptyQueue(),
				log: emptyLog(),
			}),
		},
	});

	const missingBtn = $("btn-filter-missing-ai");
	assert.ok(missingBtn, "#btn-filter-missing-ai must exist");
	assert.equal(missingBtn.getAttribute("aria-pressed"), "false");
	assert.equal(missingBtn.textContent.trim(), "ללא נושאי AI");

	const emptyEl = $("ai-filter-empty-message");
	assert.ok(emptyEl, "#ai-filter-empty-message must exist");
	assert.equal(emptyEl.hidden, true);

	const countEl = $("ai-filter-count");
	assert.ok(countEl, "#ai-filter-count must exist");
	assert.equal(countEl.textContent.trim(), "סה״כ משתתפים: 4");

	const listHtml = $("peopleList").innerHTML;
	assert.match(listHtml, /סטודנט מלמד #1/);
	assert.match(listHtml, /תלמיד #2/);
	assert.match(listHtml, /סטודנט מלמד #3/);
	assert.match(listHtml, /תלמיד #4/);
});

test("סינון משתתפים ללא נושאי AI בהפעלה ועדכון aria-pressed ו-#ai-filter-count", () => {
	const samplePeople = [
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
			target_ai_topics: [],
		},
		{
			role: "student",
			region: "NORTH",
			availability: ["MON_18"],
			subjects: ["PHYSICS"],
		},
		{
			role: "pupil",
			region: "NORTH",
			availability: ["MON_18"],
			subjects: ["PHYSICS"],
			parentConsent: true,
			target_ai_topics: ["AI_LIT_PROMPT"],
		},
	];

	const $ = openApp({
		store: {
			[DEFAULT_KEY]: serialize({
				people: samplePeople,
				queue: emptyQueue(),
				log: emptyLog(),
			}),
		},
	});

	$("btn-filter-missing-ai").fire("click");

	assert.equal($("btn-filter-missing-ai").getAttribute("aria-pressed"), "true");
	assert.equal($("ai-filter-count").textContent.trim(), "מוצגים 2 מתוך 4");
	assert.equal($("ai-filter-empty-message").hidden, true);

	const listHtml = $("peopleList").innerHTML;
	assert.doesNotMatch(listHtml, /סטודנט מלמד #1/);
	assert.match(listHtml, /תלמיד #2/);
	assert.match(listHtml, /סטודנט מלמד #3/);
	assert.doesNotMatch(listHtml, /תלמיד #4/);
});

test("הצגת #ai-filter-empty-message כשלכולם יש נושאים", () => {
	const allWithAi = [
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
			target_ai_topics: ["AI_CREATIVE"],
		},
		{
			role: "pupil",
			region: "NORTH",
			availability: ["MON_18"],
			subjects: ["PHYSICS"],
			parentConsent: true,
			target_ai_topics: ["AI_LIT_PROMPT"],
		},
	];

	const $ = openApp({
		store: {
			[DEFAULT_KEY]: serialize({
				people: allWithAi,
				queue: emptyQueue(),
				log: emptyLog(),
			}),
		},
	});

	$("btn-filter-missing-ai").fire("click");

	assert.equal($("btn-filter-missing-ai").getAttribute("aria-pressed"), "true");
	assert.equal($("peopleList").innerHTML.trim(), "");
	assert.equal($("ai-filter-empty-message").hidden, false);
	assert.match(
		$("ai-filter-empty-message").textContent,
		/לא נמצאו משתתפים בנושא זה/,
	);
	assert.equal($("ai-filter-count").textContent.trim(), "מוצגים 0 מתוך 3");
});

test("כיבוי דרך לחיצה חוזרת או #resetAiFilter ותוויות ב-he/ar/ru", () => {
	assert.equal(tExtra("people.missingAiFilter", "he"), "ללא נושאי AI");
	assert.equal(
		tExtra("people.missingAiFilter", "ar"),
		"بدون مواضيع ذكاء اصطناعي",
	);
	assert.equal(tExtra("people.missingAiFilter", "ru"), "Без тем ИИ");

	assert.equal(tExtra("peopleMissingAiFilter", "he"), "ללא נושאי AI");
	assert.equal(
		tExtra("peopleMissingAiFilter", "ar"),
		"بدون مواضيع ذكاء اصطناعي",
	);
	assert.equal(tExtra("peopleMissingAiFilter", "ru"), "Без тем ИИ");

	assert.equal(i18n.t("peopleMissingAiFilter", "he"), "ללא נושאי AI");
	assert.equal(
		i18n.t("peopleMissingAiFilter", "ar"),
		"بدون مواضيع ذكاء اصطناعي",
	);
	assert.equal(i18n.t("peopleMissingAiFilter", "ru"), "Без тем ИИ");

	const samplePeople = [
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
			target_ai_topics: [],
		},
	];

	const $ = openApp({
		store: {
			[DEFAULT_KEY]: serialize({
				people: samplePeople,
				queue: emptyQueue(),
				log: emptyLog(),
			}),
		},
	});

	// Toggle on
	$("btn-filter-missing-ai").fire("click");
	assert.equal($("btn-filter-missing-ai").getAttribute("aria-pressed"), "true");
	assert.equal($("ai-filter-count").textContent.trim(), "מוצגים 1 מתוך 2");

	// Turn off via repeat click
	$("btn-filter-missing-ai").fire("click");
	assert.equal(
		$("btn-filter-missing-ai").getAttribute("aria-pressed"),
		"false",
	);
	assert.equal($("ai-filter-count").textContent.trim(), "סה״כ משתתפים: 2");
	assert.match($("peopleList").innerHTML, /סטודנט מלמד #1/);
	assert.match($("peopleList").innerHTML, /תלמיד #2/);

	// Toggle on again
	$("btn-filter-missing-ai").fire("click");
	assert.equal($("btn-filter-missing-ai").getAttribute("aria-pressed"), "true");
	assert.equal($("ai-filter-count").textContent.trim(), "מוצגים 1 מתוך 2");

	// Turn off via #resetAiFilter
	$("resetAiFilter").fire("click");
	assert.equal(
		$("btn-filter-missing-ai").getAttribute("aria-pressed"),
		"false",
	);
	assert.equal($("ai-filter-count").textContent.trim(), "סה״כ משתתפים: 2");
	assert.match($("peopleList").innerHTML, /סטודנט מלמד #1/);
	assert.match($("peopleList").innerHTML, /תלמיד #2/);

	// Check UI translations on language switch
	assert.equal($("btn-filter-missing-ai").textContent.trim(), "ללא נושאי AI");

	$("langSelect").value = "ar";
	$("langSelect").fire("change");
	assert.equal(
		$("btn-filter-missing-ai").textContent.trim(),
		"بدون مواضيع ذكاء اصطناعي",
	);

	$("langSelect").value = "ru";
	$("langSelect").fire("change");
	assert.equal($("btn-filter-missing-ai").textContent.trim(), "Без тем ИИ");

	$("langSelect").value = "he";
	$("langSelect").fire("change");
	assert.equal($("btn-filter-missing-ai").textContent.trim(), "ללא נושאי AI");
});

test("אינטראקציה בין מסנן ללא נושאי AI לבין בחירת נושא מתיבת הבחירה ופעולות שורה", () => {
	const samplePeople = [
		{
			role: "student",
			region: "CENTER",
			availability: ["SUN_16"],
			subjects: ["MATH"],
			target_ai_topics: ["AI_STEM_CODE"],
		},
		{
			role: "pupil",
			region: "NORTH",
			availability: ["MON_18"],
			subjects: ["PHYSICS"],
			parentConsent: false,
			target_ai_topics: [],
		},
		{
			role: "pupil",
			region: "SOUTH",
			availability: ["TUE_17"],
			subjects: ["ENGLISH"],
			parentConsent: true,
			target_ai_topics: [],
		},
	];

	const $ = openApp({
		store: {
			[DEFAULT_KEY]: serialize({
				people: samplePeople,
				queue: emptyQueue(),
				log: emptyLog(),
			}),
		},
	});

	// Activate missing AI filter
	$("btn-filter-missing-ai").fire("click");
	assert.equal($("btn-filter-missing-ai").getAttribute("aria-pressed"), "true");
	assert.equal($("peopleAiFilter").value, "");

	// Selecting a topic dropdown turns off missing AI filter
	$("peopleAiFilter").value = "AI_STEM_CODE";
	$("peopleAiFilter").fire("change");
	assert.equal(
		$("btn-filter-missing-ai").getAttribute("aria-pressed"),
		"false",
	);
	assert.equal($("ai-filter-count").textContent.trim(), "מוצגים 1 מתוך 3");

	// Activating missing AI filter resets select to empty string
	$("btn-filter-missing-ai").fire("click");
	assert.equal($("btn-filter-missing-ai").getAttribute("aria-pressed"), "true");
	assert.equal($("peopleAiFilter").value, "");
	assert.equal($("ai-filter-count").textContent.trim(), "מוצגים 2 מתוך 3");

	// Check action buttons maintain proper indices in filtered view
	assert.ok($("peopleList").innerHTML.includes('id="consentBtn-1"'));
	assert.ok($("peopleList").innerHTML.includes('id="delBtn-1"'));
	assert.ok($("peopleList").innerHTML.includes('id="consentBtn-2"'));
	assert.ok($("peopleList").innerHTML.includes('id="delBtn-2"'));

	press($("peopleList"), "data-consent", "1");
	assert.ok($("peopleList").innerHTML.includes("בטל אישור הורה"));
});
