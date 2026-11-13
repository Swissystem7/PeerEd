const test = require("node:test");
const assert = require("node:assert/strict");

const { openApp, press, text } = require("../test-support/fake-dom.js");
const { serialize, DEFAULT_KEY } = require("../src/lib/store.js");
const { emptyQueue } = require("../src/lib/approval.js");
const { emptyLog } = require("../src/lib/session.js");
const { findPersonalData } = require("../src/lib/validator.js");

test("guide AI summary: displays accurate numeric gap when requested > offered", () => {
	// Pupil 1 and 2 request AI_LIT_PROMPT, Student 1 offers AI_LIT_PROMPT -> requested: 2, offered: 1 -> gap: 1
	// Pupil 1, 2, and 3 request AI_STEM_CODE, 0 students offer it -> requested: 3, offered: 0 -> gap: 3
	const samplePeople = [
		{
			role: "student",
			region: "CENTER",
			availability: ["SUN_16"],
			subjects: ["MATH"],
			target_ai_topics: ["AI_LIT_PROMPT"],
		},
		{
			role: "pupil",
			region: "CENTER",
			availability: ["SUN_16"],
			subjects: ["MATH"],
			parentConsent: true,
			target_ai_topics: ["AI_LIT_PROMPT", "AI_STEM_CODE"],
		},
		{
			role: "pupil",
			region: "NORTH",
			availability: ["MON_18"],
			subjects: ["PHYSICS"],
			parentConsent: true,
			target_ai_topics: ["AI_LIT_PROMPT", "AI_STEM_CODE"],
		},
		{
			role: "pupil",
			region: "SOUTH",
			availability: ["TUE_17"],
			subjects: ["ENGLISH"],
			parentConsent: true,
			target_ai_topics: ["AI_STEM_CODE"],
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

	const listHtml = $("aiTopicsSummaryList").innerHTML;

	// Verify topic AI_LIT_PROMPT has gap 1
	assert.match(
		listHtml,
		/data-topic="AI_LIT_PROMPT"[\s\S]*?חסר מדריכים:\s*1/,
		"AI_LIT_PROMPT displays gap label 'חסר מדריכים: 1'",
	);
	assert.match(
		listHtml,
		/data-topic="AI_LIT_PROMPT"[\s\S]*?data-gap="1"/,
		"AI_LIT_PROMPT contains data-gap='1'",
	);

	// Verify topic AI_STEM_CODE has gap 3
	assert.match(
		listHtml,
		/data-topic="AI_STEM_CODE"[\s\S]*?חסר מדריכים:\s*3/,
		"AI_STEM_CODE displays gap label 'חסר מדריכים: 3'",
	);
	assert.match(
		listHtml,
		/data-topic="AI_STEM_CODE"[\s\S]*?data-gap="3"/,
		"AI_STEM_CODE contains data-gap='3'",
	);

	// Dynamically delete pupil at index 3 (the one only requesting AI_STEM_CODE)
	press($("peopleList"), "data-del", "3");
	const updatedHtml = $("aiTopicsSummaryList").innerHTML;

	// Now AI_STEM_CODE requested count decreased from 3 to 2 -> gap should now be 2
	assert.match(
		updatedHtml,
		/data-topic="AI_STEM_CODE"[\s\S]*?חסר מדריכים:\s*2/,
		"AI_STEM_CODE dynamically updates to gap of 2 after removing a pupil",
	);
});

test("guide AI summary: displays balanced status when offered >= requested and requested > 0", () => {
	// AI_LIT_PROMPT: requested = 2, offered = 2 (offered == requested > 0) -> balanced ('מאוזן')
	// AI_CREATIVE: requested = 1, offered = 3 (offered > requested > 0) -> balanced ('מאוזן')
	// AI_STEM_CODE: requested = 0, offered = 2 (requested == 0 -> no balanced badge)
	// AI_ETHICS_SEC: requested = 0, offered = 0 -> no badge
	const samplePeople = [
		{
			role: "student",
			region: "CENTER",
			availability: ["SUN_16"],
			subjects: ["MATH"],
			target_ai_topics: ["AI_LIT_PROMPT", "AI_CREATIVE", "AI_STEM_CODE"],
		},
		{
			role: "student",
			region: "NORTH",
			availability: ["MON_18"],
			subjects: ["PHYSICS"],
			target_ai_topics: ["AI_LIT_PROMPT", "AI_CREATIVE", "AI_STEM_CODE"],
		},
		{
			role: "student",
			region: "SOUTH",
			availability: ["TUE_17"],
			subjects: ["ENGLISH"],
			target_ai_topics: ["AI_CREATIVE"],
		},
		{
			role: "pupil",
			region: "CENTER",
			availability: ["SUN_16"],
			subjects: ["MATH"],
			parentConsent: true,
			target_ai_topics: ["AI_LIT_PROMPT", "AI_CREATIVE"],
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

	const listHtml = $("aiTopicsSummaryList").innerHTML;

	// AI_LIT_PROMPT (req: 2, off: 2) -> balanced
	assert.match(
		listHtml,
		/data-topic="AI_LIT_PROMPT"[\s\S]*?data-status="balanced"[\s\S]*?מאוזן/,
		"AI_LIT_PROMPT displays balanced badge 'מאוזן' when offered equals requested",
	);

	// AI_CREATIVE (req: 1, off: 3) -> balanced
	assert.match(
		listHtml,
		/data-topic="AI_CREATIVE"[\s\S]*?data-status="balanced"[\s\S]*?מאוזן/,
		"AI_CREATIVE displays balanced badge 'מאוזן' when offered exceeds requested",
	);

	// AI_STEM_CODE (req: 0, off: 2) -> neither balanced nor gap
	const stemItem =
		listHtml.match(/data-topic="AI_STEM_CODE"[\s\S]*?<\/div>/)?.[0] ?? "";
	assert.equal(
		stemItem.includes("מאוזן"),
		false,
		"AI_STEM_CODE with 0 requests must not display 'מאוזן'",
	);
	assert.equal(
		stemItem.includes("חסר מדריכים"),
		false,
		"AI_STEM_CODE with 0 requests must not display 'חסר מדריכים'",
	);

	// AI_ETHICS_SEC (req: 0, off: 0) -> neither balanced nor gap
	const ethicsItem =
		listHtml.match(/data-topic="AI_ETHICS_SEC"[\s\S]*?<\/div>/)?.[0] ?? "";
	assert.equal(
		ethicsItem.includes("מאוזן"),
		false,
		"AI_ETHICS_SEC with 0 requests must not display 'מאוזן'",
	);
	assert.equal(
		ethicsItem.includes("חסר מדריכים"),
		false,
		"AI_ETHICS_SEC with 0 requests must not display 'חסר מדריכים'",
	);
});

test("guide AI summary: updates gap and balanced tags on language switch (he, ar, ru)", () => {
	const samplePeople = [
		{
			role: "student",
			region: "CENTER",
			availability: ["SUN_16"],
			subjects: ["MATH"],
			target_ai_topics: ["AI_LIT_PROMPT"],
		},
		{
			role: "pupil",
			region: "CENTER",
			availability: ["SUN_16"],
			subjects: ["MATH"],
			parentConsent: true,
			target_ai_topics: ["AI_LIT_PROMPT", "AI_STEM_CODE"],
		},
		{
			role: "pupil",
			region: "SOUTH",
			availability: ["TUE_17"],
			subjects: ["ENGLISH"],
			parentConsent: true,
			target_ai_topics: ["AI_STEM_CODE"],
		},
	];
	// AI_LIT_PROMPT: req = 1, off = 1 -> balanced
	// AI_STEM_CODE: req = 2, off = 0 -> gap = 2

	const $ = openApp({
		store: {
			[DEFAULT_KEY]: serialize({
				people: samplePeople,
				queue: emptyQueue(),
				log: emptyLog(),
			}),
		},
	});

	// 1. Hebrew (default)
	let html = $("aiTopicsSummaryList").innerHTML;
	assert.match(
		html,
		/data-topic="AI_LIT_PROMPT"[\s\S]*?מאוזן/,
		"Hebrew balanced badge 'מאוזן'",
	);
	assert.match(
		html,
		/data-topic="AI_STEM_CODE"[\s\S]*?חסר מדריכים:\s*2/,
		"Hebrew gap badge 'חסר מדריכים: 2'",
	);

	// 2. Arabic ('ar')
	$("langSelect").value = "ar";
	$("langSelect").fire("change");
	html = $("aiTopicsSummaryList").innerHTML;
	assert.match(
		html,
		/data-topic="AI_LIT_PROMPT"[\s\S]*?متوازن/,
		"Arabic balanced badge 'متوازن'",
	);
	assert.match(
		html,
		/data-topic="AI_STEM_CODE"[\s\S]*?نقص مدربين:\s*2/,
		"Arabic gap badge 'نقص مدربين: 2'",
	);

	// 3. Russian ('ru')
	$("langSelect").value = "ru";
	$("langSelect").fire("change");
	html = $("aiTopicsSummaryList").innerHTML;
	assert.match(
		html,
		/data-topic="AI_LIT_PROMPT"[\s\S]*?Сбалансировано/,
		"Russian balanced badge 'Сбалансировано'",
	);
	assert.match(
		html,
		/data-topic="AI_STEM_CODE"[\s\S]*?Нехватка наставников:\s*2/,
		"Russian gap badge 'Нехватка наставников: 2'",
	);

	// 4. Back to Hebrew ('he')
	$("langSelect").value = "he";
	$("langSelect").fire("change");
	html = $("aiTopicsSummaryList").innerHTML;
	assert.match(
		html,
		/data-topic="AI_LIT_PROMPT"[\s\S]*?מאוזן/,
		"Restored Hebrew balanced badge 'מאוזן'",
	);
	assert.match(
		html,
		/data-topic="AI_STEM_CODE"[\s\S]*?חסר מדריכים:\s*2/,
		"Restored Hebrew gap badge 'חסר מדריכים: 2'",
	);
});

test("guide AI summary: DOM contains zero PII across topic gap elements and card", () => {
	const samplePeople = [
		{
			role: "student",
			region: "CENTER",
			availability: ["SUN_16"],
			subjects: ["MATH"],
			target_ai_topics: ["AI_LIT_PROMPT", "AI_CREATIVE"],
		},
		{
			role: "pupil",
			region: "CENTER",
			availability: ["SUN_16"],
			subjects: ["MATH"],
			parentConsent: true,
			target_ai_topics: ["AI_LIT_PROMPT", "AI_STEM_CODE", "AI_ETHICS_SEC"],
		},
		{
			role: "pupil",
			region: "NORTH",
			availability: ["MON_18"],
			subjects: ["PHYSICS"],
			parentConsent: true,
			target_ai_topics: ["AI_STEM_CODE"],
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

	const cardHtml = $("aiTopicsSummaryCard").innerHTML;
	const cardText = `${$("aiTopicsSummaryHeading").textContent}\n${text(cardHtml)}`;

	// Validator findPersonalData must return empty array
	const findings = findPersonalData(cardText);
	assert.deepEqual(
		findings,
		[],
		"Summary card text must contain zero PII findings",
	);

	// Raw card HTML should also be checked with findPersonalData
	const htmlFindings = findPersonalData(cardHtml);
	assert.deepEqual(
		htmlFindings,
		[],
		"Summary card HTML must contain zero PII findings",
	);

	// Ensure common PII patterns and participant identifier formats never appear in the card
	const forbiddenTokens = [
		"050-",
		"052-",
		"053-",
		"054-",
		"055-",
		"058-",
		"ישראל",
		"כהן",
		"לוי",
		"@example.com",
		"student #",
		"pupil #",
		"סטודנט #",
		"תלמיד #",
		"כיתה",
		"בית ספר",
	];

	for (const token of forbiddenTokens) {
		assert.equal(
			cardHtml.includes(token),
			false,
			`aiTopicsSummaryCard must not contain forbidden token: ${token}`,
		);
	}
});
