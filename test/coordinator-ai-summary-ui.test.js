const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const { openApp, press, text, ROOT } = require("../test-support/fake-dom.js");
const { serialize, DEFAULT_KEY } = require("../src/lib/store.js");
const { emptyQueue } = require("../src/lib/approval.js");
const { emptyLog } = require("../src/lib/session.js");
const { findPersonalData } = require("../src/lib/validator.js");

test("card and heading exist inside #tab-guide and app.html contains the card", () => {
	const html = fs.readFileSync(path.join(ROOT, "app.html"), "utf8");
	const guideIndex = html.indexOf('id="tab-guide"');
	assert.ok(guideIndex !== -1, "#tab-guide should exist in app.html");
	const guideEndIndex = html.indexOf("</section>", guideIndex);
	assert.ok(guideEndIndex !== -1, "#tab-guide section should have closing tag");
	const guideSection = html.slice(guideIndex, guideEndIndex);

	assert.ok(
		guideSection.includes('id="aiTopicsSummaryCard"'),
		"aiTopicsSummaryCard card must be inside #tab-guide",
	);
	assert.ok(
		guideSection.includes('id="aiTopicsSummaryHeading"'),
		"aiTopicsSummaryHeading must be inside #tab-guide",
	);
	assert.ok(
		guideSection.includes("פילוח נושאי בינה מלאכותית"),
		"heading text in app.html must be Hebrew",
	);
	assert.ok(
		guideSection.includes('id="aiTopicsSummaryList"'),
		"aiTopicsSummaryList container must be inside #tab-guide",
	);

	const $ = openApp();
	assert.ok($("aiTopicsSummaryCard"), "card element exists in DOM");
	assert.equal(
		$("aiTopicsSummaryHeading").textContent,
		"פילוח נושאי בינה מלאכותית",
	);
	assert.equal($("aiTopicsSummaryList").getAttribute("role"), "region");
	assert.equal($("aiTopicsSummaryList").getAttribute("aria-live"), "polite");
});

test("empty participant list shows zeros for all 4 AI topics", () => {
	const $ = openApp();
	const listEl = $("aiTopicsSummaryList");
	const listHtml = listEl.innerHTML;

	for (const topicKey of [
		"AI_LIT_PROMPT",
		"AI_CREATIVE",
		"AI_STEM_CODE",
		"AI_ETHICS_SEC",
	]) {
		assert.ok(
			listHtml.includes(`data-topic="${topicKey}"`),
			`missing topic key ${topicKey}`,
		);
	}

	assert.ok(
		listHtml.includes("אוריינות בינה מלאכותית והנחיה"),
		"Hebrew topic 1 rendered",
	);
	assert.ok(
		listHtml.includes("יצירתיות ובינה יוצרת"),
		"Hebrew topic 2 rendered",
	);
	assert.ok(
		listHtml.includes("מדעים, טכנולוגיה ותכנות"),
		"Hebrew topic 3 rendered",
	);
	assert.ok(
		listHtml.includes("אתיקה, פרטיות ובטיחות"),
		"Hebrew topic 4 rendered",
	);

	const zeroMatches = listHtml.match(
		/סה״כ:\s*0\s*\(מבוקש:\s*0,\s*מוצע:\s*0\)/g,
	);
	assert.equal(
		zeroMatches?.length,
		4,
		"all 4 topics must show 0 total, 0 requested, 0 offered",
	);
});

test("correct counts for a sample people list with student and pupil AI topics", () => {
	const samplePeople = [
		{
			role: "student",
			region: "CENTER",
			availability: ["SUN_16"],
			subjects: ["MATH"],
			target_ai_topics: ["AI_LIT_PROMPT", "AI_CREATIVE"],
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
			target_ai_topics: ["AI_ETHICS_SEC"],
		},
		{
			role: "pupil",
			region: "JERUSALEM",
			availability: ["WED_16"],
			subjects: ["HISTORY"],
			parentConsent: true,
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

	assert.match(
		listHtml,
		/data-topic="AI_LIT_PROMPT"[\s\S]*?סה״כ:\s*3\s*\(מבוקש:\s*1,\s*מוצע:\s*2\)/,
		"AI_LIT_PROMPT has 3 total (1 requested, 2 offered)",
	);
	assert.match(
		listHtml,
		/data-topic="AI_CREATIVE"[\s\S]*?סה״כ:\s*1\s*\(מבוקש:\s*0,\s*מוצע:\s*1\)/,
		"AI_CREATIVE has 1 total (0 requested, 1 offered)",
	);
	assert.match(
		listHtml,
		/data-topic="AI_STEM_CODE"[\s\S]*?סה״כ:\s*1\s*\(מבוקש:\s*1,\s*מוצע:\s*0\)/,
		"AI_STEM_CODE has 1 total (1 requested, 0 offered)",
	);
	assert.match(
		listHtml,
		/data-topic="AI_ETHICS_SEC"[\s\S]*?סה״כ:\s*1\s*\(מבוקש:\s*1,\s*מוצע:\s*0\)/,
		"AI_ETHICS_SEC has 1 total (1 requested, 0 offered)",
	);

	press($("peopleList"), "data-del", "0");
	const afterDeleteHtml = $("aiTopicsSummaryList").innerHTML;

	assert.match(
		afterDeleteHtml,
		/data-topic="AI_LIT_PROMPT"[\s\S]*?סה״כ:\s*2\s*\(מבוקש:\s*1,\s*מוצע:\s*1\)/,
		"AI_LIT_PROMPT updated to 2 after deleting first student",
	);
	assert.match(
		afterDeleteHtml,
		/data-topic="AI_CREATIVE"[\s\S]*?סה״כ:\s*0\s*\(מבוקש:\s*0,\s*מוצע:\s*0\)/,
		"AI_CREATIVE updated to 0 after deleting first student",
	);
});

test("topic names and heading render in he, ar, and ru languages", () => {
	const $ = openApp();

	assert.equal(
		$("aiTopicsSummaryHeading").textContent,
		"פילוח נושאי בינה מלאכותית",
	);
	let listHtml = $("aiTopicsSummaryList").innerHTML;
	assert.ok(
		listHtml.includes("אוריינות בינה מלאכותית והנחיה"),
		"Hebrew prompt literacy",
	);
	assert.ok(listHtml.includes("יצירתיות ובינה יוצרת"), "Hebrew creativity");
	assert.ok(listHtml.includes("מדעים, טכנולוגיה ותכנות"), "Hebrew STEM");
	assert.ok(listHtml.includes("אתיקה, פרטיות ובטיחות"), "Hebrew ethics");
	assert.ok(listHtml.includes("סה״כ:"), "Hebrew total label");

	$("langSelect").value = "ar";
	$("langSelect").fire("change");
	assert.equal(
		$("aiTopicsSummaryHeading").textContent,
		"توزيع موضوعات الذكاء الاصطناعي",
	);
	listHtml = $("aiTopicsSummaryList").innerHTML;
	assert.ok(
		listHtml.includes("محو الأمية في التوجيهات"),
		"Arabic prompt literacy",
	);
	assert.ok(listHtml.includes("إنشاء المحتوى والوسائط"), "Arabic media");
	assert.ok(
		listHtml.includes("كفاءة الذكاء الاصطناعي والبرمجة"),
		"Arabic STEM",
	);
	assert.ok(listHtml.includes("الأخلاق والأمان"), "Arabic ethics");
	assert.ok(listHtml.includes("المجموع:"), "Arabic total label");

	$("langSelect").value = "ru";
	$("langSelect").fire("change");
	assert.equal($("aiTopicsSummaryHeading").textContent, "Распределение тем ИИ");
	listHtml = $("aiTopicsSummaryList").innerHTML;
	assert.ok(
		listHtml.includes("Грамотность в ИИ и промптинг"),
		"Russian prompt literacy",
	);
	assert.ok(
		listHtml.includes("Творчество и генеративный ИИ"),
		"Russian creativity",
	);
	assert.ok(listHtml.includes("STEM и программирование"), "Russian STEM");
	assert.ok(listHtml.includes("Этика и безопасность ИИ"), "Russian ethics");
	assert.ok(listHtml.includes("Всего:"), "Russian total label");
});

test("zero PII: card shows only topic names and numbers, never participant names or phones", () => {
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

	const cardText = `${$("aiTopicsSummaryHeading").textContent}\n${text($("aiTopicsSummaryCard").innerHTML)}`;

	const forbiddenPatterns = [
		"050-",
		"052-",
		"054-",
		"ישראל",
		"כהן",
		"לוי",
		"@example.com",
		"student #",
		"pupil #",
		"סטודנט #",
		"תלמיד #",
		"כיתה",
	];
	for (const pattern of forbiddenPatterns) {
		assert.equal(
			cardText.includes(pattern),
			false,
			`card must not expose personal data or participant labels: ${pattern}`,
		);
	}

	const findings = findPersonalData(cardText);
	assert.deepEqual(
		findings,
		[],
		"findPersonalData must report zero PII findings on summary card",
	);
});

test("card updates safely when switching to nav-guide tab", () => {
	const $ = openApp();
	$("nav-guide").fire("click");
	assert.ok(
		$("aiTopicsSummaryList").innerHTML.includes("data-topic="),
		"summary renders on tab switch to guide",
	);
});
