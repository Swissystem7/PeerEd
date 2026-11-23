const test = require("node:test");
const assert = require("node:assert/strict");
const {
	APPROVED_FREE_AI_TOOLS,
	getRecommendedToolsForTopics,
} = require("../src/lib/curriculum.js");
const { evaluatePilotReadiness } = require("../src/lib/store.js");
const { findPersonalData } = require("../src/lib/validator.js");
const { openApp } = require("../test-support/fake-dom.js");

// 1. שלמות קטלוג APPROVED_FREE_AI_TOOLS ב-3 שפות (he, ar, ru)
test("1. APPROVED_FREE_AI_TOOLS integrity across 4 topics and 3 languages (he, ar, ru)", () => {
	assert.ok(Object.isFrozen(APPROVED_FREE_AI_TOOLS), "Catalog must be frozen");

	const requiredTopics = [
		"AI_LIT_PROMPT",
		"AI_CREATIVE",
		"AI_STEM_CODE",
		"AI_ETHICS_SEC",
	];

	for (const topic of requiredTopics) {
		assert.ok(
			Object.hasOwn(APPROVED_FREE_AI_TOOLS, topic),
			`Catalog must contain topic key ${topic}`,
		);
		const tools = APPROVED_FREE_AI_TOOLS[topic];
		assert.ok(Array.isArray(tools), `Tools for ${topic} must be an array`);
		assert.ok(
			Object.isFrozen(tools),
			`Tools array for ${topic} must be frozen`,
		);
		assert.ok(tools.length >= 2, `Topic ${topic} must have at least 2 tools`);

		for (const tool of tools) {
			assert.ok(Object.isFrozen(tool), "Each tool must be frozen");
			assert.ok(
				tool.id && typeof tool.id === "string",
				"Tool must have an id string",
			);
			assert.ok(
				tool.name && typeof tool.name === "string",
				"Tool must have a name string",
			);
			assert.equal(tool.topic, topic, "Tool topic must match topic key");

			// Description in 3 languages
			assert.ok(tool.description, "Tool must have description object");
			assert.ok(
				Object.isFrozen(tool.description),
				"Tool description must be frozen",
			);
			assert.ok(tool.description.he && typeof tool.description.he === "string");
			assert.ok(tool.description.ar && typeof tool.description.ar === "string");
			assert.ok(tool.description.ru && typeof tool.description.ru === "string");

			// Zero-PII note in 3 languages
			assert.ok(tool.zeroPiiNote, "Tool must have zeroPiiNote object");
			assert.ok(
				Object.isFrozen(tool.zeroPiiNote),
				"Tool zeroPiiNote must be frozen",
			);
			assert.ok(tool.zeroPiiNote.he && typeof tool.zeroPiiNote.he === "string");
			assert.ok(tool.zeroPiiNote.ar && typeof tool.zeroPiiNote.ar === "string");
			assert.ok(tool.zeroPiiNote.ru && typeof tool.zeroPiiNote.ru === "string");

			// Zero URLs or PII inside descriptions or notes
			for (const lang of ["he", "ar", "ru"]) {
				assert.equal(tool.description[lang].includes("http://"), false);
				assert.equal(tool.description[lang].includes("https://"), false);
				assert.equal(tool.zeroPiiNote[lang].includes("http://"), false);
				assert.equal(tool.zeroPiiNote[lang].includes("https://"), false);
				assert.equal(findPersonalData(tool.description[lang]).length, 0);
				assert.equal(findPersonalData(tool.zeroPiiNote[lang]).length, 0);
			}
		}
	}
});

// 2. פונקציה getRecommendedToolsForTopics מחזירה את כל הכלים עבור 'all' או ללא פרמטר
test("2. getRecommendedToolsForTopics returns all tools when omitted, null, or 'all'", () => {
	const allTools = getRecommendedToolsForTopics();
	assert.ok(Array.isArray(allTools), "Expected array of tools");
	assert.ok(Object.isFrozen(allTools), "Returned tools list must be frozen");
	assert.ok(
		allTools.length >= 8,
		"Expected at least 8 tools across all 4 topics",
	);

	const fromAllString = getRecommendedToolsForTopics("all");
	assert.equal(fromAllString.length, allTools.length);

	const fromNull = getRecommendedToolsForTopics(null);
	assert.equal(fromNull.length, allTools.length);

	// Ensure no duplicate IDs
	const ids = allTools.map((t) => t.id);
	const uniqueIds = new Set(ids);
	assert.equal(ids.length, uniqueIds.size, "Tool IDs must be unique");
});

// 3. פונקציה getRecommendedToolsForTopics מסננת לפי נושא יחיד או מערך נושאים
test("3. getRecommendedToolsForTopics filters correctly by single topic or array of topics", () => {
	const stemTools = getRecommendedToolsForTopics("AI_STEM_CODE");
	assert.ok(stemTools.length >= 2, "Expected at least 2 STEM tools");
	for (const tool of stemTools) {
		assert.equal(tool.topic, "AI_STEM_CODE");
	}

	const multiTools = getRecommendedToolsForTopics([
		"AI_LIT_PROMPT",
		"AI_CREATIVE",
	]);
	assert.ok(multiTools.length >= 4, "Expected combined tools for both topics");
	for (const tool of multiTools) {
		assert.ok(
			tool.topic === "AI_LIT_PROMPT" || tool.topic === "AI_CREATIVE",
			"Tool topic must be one of requested topics",
		);
	}

	const unknownTopicTools = getRecommendedToolsForTopics("UNKNOWN_TOPIC");
	assert.equal(
		unknownTopicTools.length,
		0,
		"Unknown topic should return empty list",
	);

	const emptyTools = getRecommendedToolsForTopics([]);
	assert.equal(emptyTools.length, 0, "Empty array should return empty list");
});

// 4. evaluatePilotReadiness: מוכן לפיילוט (ready === true) כאשר יש כיסוי מלא, זוגות ואפס PII
test("4. evaluatePilotReadiness returns ready: true and all checks passing when roster is clean and complete", () => {
	const cleanState = {
		people: [
			{
				id: "s-001",
				role: "student",
				region: "CENTER",
				availability: ["SUN_16", "MON_18"],
				subjects: ["CS", "MATH"],
				target_ai_topics: ["AI_STEM_CODE", "AI_LIT_PROMPT"],
			},
			{
				id: "s-002",
				role: "student",
				region: "CENTER",
				availability: ["TUE_17", "WED_18"],
				subjects: ["CS"],
				target_ai_topics: ["AI_CREATIVE", "AI_ETHICS_SEC"],
			},
			{
				id: "p-001",
				role: "pupil",
				region: "CENTER",
				availability: ["SUN_16", "MON_18"],
				subjects: ["CS"],
				parentConsent: true,
				target_ai_topics: ["AI_STEM_CODE"],
			},
			{
				id: "p-002",
				role: "pupil",
				region: "CENTER",
				availability: ["TUE_17", "WED_18"],
				subjects: ["CS"],
				parentConsent: true,
				target_ai_topics: ["AI_CREATIVE"],
			},
		],
		pairs: [
			{ student: 0, pupil: 0, slot: "SUN_16" },
			{ student: 1, pupil: 1, slot: "TUE_17" },
		],
	};

	const res = evaluatePilotReadiness(cleanState);
	assert.equal(res.ready, true, "Pilot should be ready");
	assert.equal(res.checks.zeroPii, true, "Zero-PII check must pass");
	assert.equal(
		res.checks.mentorCoverage,
		true,
		"Mentor coverage check must pass",
	);
	assert.equal(res.checks.pairs, true, "Pairs check must pass");
	assert.equal(res.checks.pairsCount, 2);
	assert.equal(res.checks.uncoveredTopics.length, 0);

	assert.ok(res.summary.he.includes("מוכן לפיילוט"));
	assert.ok(res.summary.ar.includes("جاهز للبرنامج التجريبي"));
	assert.ok(res.summary.ru.includes("Готов к пилоту"));
});

// 5. evaluatePilotReadiness: אינו מוכן כאשר חסר כיסוי מדריכים לנושא AI פעיל
test("5. evaluatePilotReadiness returns ready: false when mentor coverage is missing for an active AI topic", () => {
	const uncoveredState = {
		people: [
			{
				id: "s-001",
				role: "student",
				region: "CENTER",
				availability: ["SUN_16"],
				subjects: ["CS"],
				target_ai_topics: ["AI_LIT_PROMPT"], // Mentors only know AI_LIT_PROMPT
			},
			{
				id: "p-001",
				role: "pupil",
				region: "CENTER",
				availability: ["SUN_16"],
				subjects: ["CS"],
				parentConsent: true,
				target_ai_topics: ["AI_LIT_PROMPT", "AI_ETHICS_SEC"], // Pupil needs AI_ETHICS_SEC
			},
		],
		pairs: [{ student: 0, pupil: 0, slot: "SUN_16" }],
	};

	const res = evaluatePilotReadiness(uncoveredState);
	assert.equal(
		res.ready,
		false,
		"Pilot should NOT be ready when topic coverage is missing",
	);
	assert.equal(res.checks.zeroPii, true, "Zero-PII should still be true");
	assert.equal(
		res.checks.mentorCoverage,
		false,
		"Mentor coverage must be false",
	);
	assert.ok(res.checks.uncoveredTopics.includes("AI_ETHICS_SEC"));
	assert.ok(res.summary.he.includes("חסר כיסוי מדריכים"));
});

// 6. evaluatePilotReadiness: אינו מוכן כאשר קיימים פרטי PII ברשימת המשתתפים
test("6. evaluatePilotReadiness returns ready: false and flags zeroPii violation when PII is present", () => {
	const contaminatedState = {
		people: [
			{
				id: "s-001",
				role: "student",
				name: "Dana Mentor", // PII key!
				region: "CENTER",
				availability: ["SUN_16"],
				subjects: ["CS"],
				target_ai_topics: ["AI_LIT_PROMPT"],
			},
			{
				id: "p-001",
				role: "pupil",
				region: "CENTER",
				phone: "050-7654321", // PII key & phone pattern!
				availability: ["SUN_16"],
				subjects: ["CS"],
				parentConsent: true,
				target_ai_topics: ["AI_LIT_PROMPT"],
			},
		],
		pairs: [{ student: 0, pupil: 0, slot: "SUN_16" }],
	};

	const res = evaluatePilotReadiness(contaminatedState);
	assert.equal(res.ready, false, "Pilot should NOT be ready when PII exists");
	assert.equal(res.checks.zeroPii, false, "zeroPii check must be false");
	assert.ok(res.summary.he.includes("הפרת Zero-PII"));
});

// 7. evaluatePilotReadiness: אינו מוכן כאשר אין זוגות משובצים
test("7. evaluatePilotReadiness returns ready: false when no pairs exist", () => {
	const noPairsState = {
		people: [
			{
				id: "s-001",
				role: "student",
				region: "CENTER",
				availability: ["SUN_16"],
				subjects: ["MATH"],
				target_ai_topics: ["AI_STEM_CODE"],
			},
			{
				id: "p-001",
				role: "pupil",
				region: "NORTH", // different region, no match
				availability: ["MON_18"],
				subjects: ["HISTORY"],
				parentConsent: true,
				target_ai_topics: ["AI_STEM_CODE"],
			},
		],
		pairs: [],
	};

	const res = evaluatePilotReadiness(noPairsState);
	assert.equal(
		res.ready,
		false,
		"Pilot should NOT be ready when no pairs exist",
	);
	assert.equal(res.checks.pairs, false, "Pairs check must be false");
	assert.equal(res.checks.pairsCount, 0);
	assert.ok(res.summary.he.includes("אין זוגות משובצים"));
});

// 8. UI: סינון כלים ב-#pilotToolsTopicFilter ב-#tab-guide
test("8. UI: #pilotToolsTopicFilter filters #pilotToolsList dynamically in #tab-guide", () => {
	const $ = openApp();
	$("nav-guide").fire("click");

	const card = $("pilotToolsCard");
	assert.ok(card, "#pilotToolsCard must exist in DOM");

	const filterEl = $("pilotToolsTopicFilter");
	const listEl = $("pilotToolsList");
	assert.ok(filterEl, "#pilotToolsTopicFilter must exist");
	assert.ok(listEl, "#pilotToolsList must exist");

	// Initial render shows all tools
	const initialMatches = listEl.innerHTML.match(/<strong>/g) || [];
	assert.ok(
		initialMatches.length >= 8,
		"Initial list should show all tools (>=8)",
	);

	// Filter by AI_CREATIVE
	filterEl.value = "AI_CREATIVE";
	filterEl.fire("change");

	const creativeMatches = listEl.innerHTML.match(/<strong>/g) || [];
	assert.ok(
		creativeMatches.length >= 2,
		"Filtered list should have AI_CREATIVE tools",
	);
	assert.ok(
		creativeMatches.length < initialMatches.length,
		"Filtered count should be less than all",
	);
	assert.ok(listEl.innerHTML.includes("AutoDraw"));

	// Filter back to all
	filterEl.value = "all";
	filterEl.fire("change");

	const resetMatches = listEl.innerHTML.match(/<strong>/g) || [];
	assert.equal(
		resetMatches.length,
		initialMatches.length,
		"Reset filter should restore all tools",
	);
});

// 9. UI: הרצת בדיקת מוכנות ע״י #checkPilotReadinessBtn ותצוגת תוצאות
test("9. UI: #checkPilotReadinessBtn triggers readiness check and updates status and output", () => {
	const $ = openApp();
	$("nav-guide").fire("click");

	const btn = $("checkPilotReadinessBtn");
	const statusEl = $("pilotReadinessStatus");
	const outEl = $("pilotReadinessOut");

	assert.ok(btn, "#checkPilotReadinessBtn must exist");
	assert.equal(
		btn.getAttribute("type"),
		"button",
		"Button type must be 'button'",
	);
	assert.equal(
		btn.getAttribute("aria-describedby"),
		"pilotReadinessStatus",
		"aria-describedby must point to pilotReadinessStatus",
	);
	assert.ok(statusEl, "#pilotReadinessStatus must exist");
	assert.ok(outEl, "#pilotReadinessOut must exist");

	// Trigger readiness check on empty/initial state
	btn.fire("click");

	assert.ok(
		statusEl.textContent.length > 0,
		"Status must show readiness result",
	);
	assert.ok(
		outEl.innerHTML.length > 0,
		"Output container must display check details",
	);
	assert.ok(outEl.innerHTML.includes("Zero-PII"));
	assert.ok(outEl.innerHTML.includes("AI"));
});

// 10. תרגום שפות he/ar/ru ואפס PII בכל השכבות
test("10. Multilingual switching updates pilot tools and readiness UI across he, ar, ru with zero PII", () => {
	const $ = openApp();
	$("nav-guide").fire("click");

	// Trigger readiness check in Hebrew
	$("checkPilotReadinessBtn").fire("click");
	assert.equal(
		$("pilotToolsHeading").textContent,
		"כלי AI חינמיים ומוכנות פיילוט",
	);
	assert.equal($("checkPilotReadinessBtn").textContent, "בדוק מוכנות פיילוט");

	// Switch to Arabic
	$("langSelect").value = "ar";
	$("langSelect").fire("change");

	assert.equal(
		$("pilotToolsHeading").textContent,
		"أدوات الذكاء الاصطناعي المجانية وجاهزية البرنامج التجريبي",
	);
	assert.equal(
		$("checkPilotReadinessBtn").textContent,
		"فحص جاهزية البرنامج التجريبي",
	);
	assert.ok($("pilotToolsTopicFilter").innerHTML.includes("جميع المواضيع"));

	// Switch to Russian
	$("langSelect").value = "ru";
	$("langSelect").fire("change");

	assert.equal(
		$("pilotToolsHeading").textContent,
		"Бесплатные инструменты ИИ и готовность к пилоту",
	);
	assert.equal(
		$("checkPilotReadinessBtn").textContent,
		"Проверить готовность к пилоту",
	);
	assert.ok($("pilotToolsTopicFilter").innerHTML.includes("Все темы"));

	// Verify complete lack of PII in the rendered guide tab DOM
	const guideHtml = $("tab-guide").innerHTML;
	for (const piiForbidden of [
		"name",
		"email",
		"phone",
		"studentName",
		"pupilName",
		"address",
	]) {
		assert.equal(
			new RegExp(`\\b${piiForbidden}\\s*[:=]`, "i").test(guideHtml),
			false,
			`DOM must not leak PII attribute: ${piiForbidden}`,
		);
	}
	assert.equal(
		findPersonalData(guideHtml).length,
		0,
		"findPersonalData must detect 0 hits in guide DOM",
	);
});
