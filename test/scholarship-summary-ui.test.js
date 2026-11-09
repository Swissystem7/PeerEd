const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const { openApp, text, ROOT } = require("../test-support/fake-dom.js");
const { findPersonalData } = require("../src/lib/validator.js");

test("card and heading exist inside #tab-guide and app.html contains the card", () => {
	const html = fs.readFileSync(path.join(ROOT, "app.html"), "utf8");
	const guideIndex = html.indexOf('id="tab-guide"');
	assert.ok(guideIndex !== -1, "#tab-guide should exist in app.html");
	const guideEndIndex = html.indexOf("</section>", guideIndex);
	assert.ok(guideEndIndex !== -1, "#tab-guide section should have closing tag");
	const guideSection = html.slice(guideIndex, guideEndIndex);

	assert.ok(
		guideSection.includes('id="scholarshipHoursSummaryCard"'),
		"scholarshipHoursSummaryCard card must be inside #tab-guide",
	);
	assert.ok(
		guideSection.includes('id="scholarshipHoursSummaryHeading"'),
		"scholarshipHoursSummaryHeading must be inside #tab-guide",
	);
	assert.ok(
		guideSection.includes("סיכום שעות מלגה ומעורבות"),
		"heading text in app.html must be Hebrew",
	);
	assert.ok(
		guideSection.includes('id="scholarshipHoursSummaryList"'),
		"scholarshipHoursSummaryList container must be inside #tab-guide",
	);

	const $ = openApp();
	assert.ok(
		$("scholarshipHoursSummaryCard"),
		"scholarshipHoursSummaryCard element exists in DOM",
	);
	assert.equal(
		$("scholarshipHoursSummaryHeading").textContent,
		"סיכום שעות מלגה ומעורבות",
	);
	assert.equal($("scholarshipHoursSummaryList").getAttribute("role"), "region");
	assert.equal(
		$("scholarshipHoursSummaryList").getAttribute("aria-live"),
		"polite",
	);
});

test("empty initial attendance shows zero total hours and zero held sessions", () => {
	const $ = openApp();
	const listEl = $("scholarshipHoursSummaryList");
	const listHtml = listEl.innerHTML;

	assert.ok(
		listHtml.includes('data-metric="totalHours"'),
		"totalHours metric exists",
	);
	assert.ok(
		listHtml.includes('data-metric="totalHeldSessions"'),
		"totalHeldSessions metric exists",
	);
	assert.match(
		listHtml,
		/סה״כ שעות:[\s\S]*?<span class="meta">0<\/span>/,
		"zero total hours in initial state",
	);
	assert.match(
		listHtml,
		/מפגשים שהתקיימו:[\s\S]*?<span class="meta">0<\/span>/,
		"zero held sessions in initial state",
	);
});

test("correct aggregate hours and held sessions for sample held attendance records", () => {
	const $ = openApp();
	const card = $("scholarshipHoursSummaryCard");

	const sampleRecords = [
		{ pairIndex: 0, date: "2026-10-01", status: "held", durationHours: 1.5 },
		{ pairIndex: 0, date: "2026-10-08", status: "held", durationHours: 2.0 },
		{ pairIndex: 1, date: "2026-10-01", status: "held" },
		{ pairIndex: 1, date: "2026-10-08", status: "missed", durationHours: 2.0 },
		{
			pairIndex: 0,
			date: "2026-10-15",
			status: "postponed",
			durationHours: 1.5,
		},
		{
			pairIndex: 1,
			date: "2026-10-15",
			status: "cancelled",
			durationHours: 1.0,
		},
	];
	const samplePairs = [
		{ studentIndex: 10, pupilIndex: 20 },
		{ studentIndex: 11, pupilIndex: 21 },
	];

	card.state.attendance = sampleRecords;
	card.state.pairs = samplePairs;
	card.renderScholarshipHoursSummary();

	const listHtml = $("scholarshipHoursSummaryList").innerHTML;
	assert.match(
		listHtml,
		/סה״כ שעות:[\s\S]*?<span class="meta">4.5<\/span>/,
		"total hours should sum to 4.5",
	);
	assert.match(
		listHtml,
		/מפגשים שהתקיימו:[\s\S]*?<span class="meta">3<\/span>/,
		"held sessions count should be 3",
	);
});

test("card labels and heading render and update across he, ar, and ru languages", () => {
	const $ = openApp();

	assert.equal(
		$("scholarshipHoursSummaryHeading").textContent,
		"סיכום שעות מלגה ומעורבות",
	);
	let listHtml = $("scholarshipHoursSummaryList").innerHTML;
	assert.ok(listHtml.includes("סה״כ שעות"), "Hebrew total hours label");
	assert.ok(listHtml.includes("מפגשים שהתקיימו"), "Hebrew held sessions label");

	$("langSelect").value = "ar";
	$("langSelect").fire("change");
	assert.equal(
		$("scholarshipHoursSummaryHeading").textContent,
		"ملخص ساعات المنحة والمشاركة",
	);
	listHtml = $("scholarshipHoursSummaryList").innerHTML;
	assert.ok(listHtml.includes("إجمالي الساعات"), "Arabic total hours label");
	assert.ok(
		listHtml.includes("اللقاءات المنعقدة"),
		"Arabic held sessions label",
	);

	$("langSelect").value = "ru";
	$("langSelect").fire("change");
	assert.equal(
		$("scholarshipHoursSummaryHeading").textContent,
		"Сводка стипендиальных часов и вовлеченности",
	);
	listHtml = $("scholarshipHoursSummaryList").innerHTML;
	assert.ok(listHtml.includes("Всего часов"), "Russian total hours label");
	assert.ok(
		listHtml.includes("Состоявшихся занятий"),
		"Russian held sessions label",
	);
});

test("zero PII: card displays strictly aggregate metrics, never participant names, phones, or emails", () => {
	const $ = openApp();
	const card = $("scholarshipHoursSummaryCard");

	card.state.attendance = [
		{ pairIndex: 0, date: "2026-10-01", status: "held", durationHours: 2.0 },
		{ pairIndex: 1, date: "2026-10-02", status: "held", durationHours: 1.0 },
	];
	card.state.pairs = [
		{ studentIndex: 0, pupilIndex: 1 },
		{ studentIndex: 2, pupilIndex: 3 },
	];
	card.renderScholarshipHoursSummary();

	const cardText = `${$("scholarshipHoursSummaryHeading").textContent}\n${text($("scholarshipHoursSummaryCard").innerHTML)}`;

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
		"findPersonalData must report zero PII findings on scholarship summary card",
	);
});

test("card updates safely when switching to nav-guide tab", () => {
	const $ = openApp();
	const card = $("scholarshipHoursSummaryCard");

	card.state.attendance = [
		{ pairIndex: 0, date: "2026-10-01", status: "held", durationHours: 3.5 },
	];
	$("nav-guide").fire("click");

	const listHtml = $("scholarshipHoursSummaryList").innerHTML;
	assert.match(
		listHtml,
		/סה״כ שעות:[\s\S]*?<span class="meta">3.5<\/span>/,
		"updates total hours to 3.5 on tab switch",
	);
	assert.match(
		listHtml,
		/מפגשים שהתקיימו:[\s\S]*?<span class="meta">1<\/span>/,
		"updates held sessions to 1 on tab switch",
	);
});

test("graceful fallback on invalid/empty inputs without throwing errors", () => {
	const $ = openApp();
	const card = $("scholarshipHoursSummaryCard");

	const invalidCases = [
		null,
		undefined,
		{},
		"junk",
		123,
		[{ status: "missed" }, null, undefined, {}],
	];

	for (const invalidCase of invalidCases) {
		assert.doesNotThrow(() => {
			card.state.attendance = invalidCase;
			card.renderScholarshipHoursSummary();
		});

		const listHtml = $("scholarshipHoursSummaryList").innerHTML;
		assert.match(listHtml, /סה״כ שעות:[\s\S]*?<span class="meta">0<\/span>/);
		assert.match(
			listHtml,
			/מפגשים שהתקיימו:[\s\S]*?<span class="meta">0<\/span>/,
		);
	}
});
