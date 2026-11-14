const test = require("node:test");
const assert = require("node:assert/strict");
const { computeRegionalSupplyDemand } = require("../src/lib/attendance.js");
const {
	buildImpactOverviewReport,
	serialize,
	DEFAULT_KEY,
	emptyState,
} = require("../src/lib/store.js");
const { emptyQueue } = require("../src/lib/approval.js");
const { emptyLog } = require("../src/lib/session.js");
const { findPersonalData } = require("../src/lib/validator.js");
const { openApp, addPerson } = require("../test-support/fake-dom.js");

function setupTestPairAndSession($) {
	addPerson($, "student", "CENTER", ["MATH"], ["SUN_16"]);
	addPerson($, "pupil", "CENTER", ["MATH"], ["SUN_16"]);
	$("unitTitle").value = "Algebra Basics";
	$("unitSubject").value = "MATH";
	$("unitDuration").value = "20";
	$("unitBody").value = "Introductory algebra exercises";
	$("submitUnit").fire("click");
	const unitId = $("unitStatus").textContent.match(/מזהה:\s*(\S+)/)[1];
	$("pendingList").fire("click", { target: { getAttribute: () => unitId } });

	$("nav-sessions").fire("click");
	$("sessionSlot").value = "SUN_16";
	$("sessionSubject").value = "MATH";
	$("sessionUnit").value = unitId;
	$("sessionOutcome").value = "held";
	if ($("sessionDurationSelect")) $("sessionDurationSelect").value = "2";
	$("logSession").fire("click");
	return unitId;
}

// 1. חישוב מאזן אזורי (סטודנטים/היצע, תלמידים/ביקוש, ופער gap = requested - offered)
test("1. computeRegionalSupplyDemand accurately calculates students, pupils, and gap (requested - offered)", () => {
	const people = [
		{ role: "student", area: "CENTER" },
		{ role: "student", area: "CENTER" },
		{ role: "pupil", area: "CENTER" },
		{ role: "pupil", area: "CENTER" },
		{ role: "pupil", area: "CENTER" },
		{ role: "student", area: "NORTH" },
		{ role: "pupil", area: "NORTH" },
		{ role: "student", area: "SOUTH" },
		{ role: "student", area: "SOUTH" },
	];

	const res = computeRegionalSupplyDemand(people);
	assert.ok(res.CENTER, "CENTER area should exist in summary");
	assert.equal(res.CENTER.students, 2, "CENTER students should be 2");
	assert.equal(res.CENTER.offered, 2, "CENTER offered should be 2");
	assert.equal(res.CENTER.pupils, 3, "CENTER pupils should be 3");
	assert.equal(res.CENTER.requested, 3, "CENTER requested should be 3");
	assert.equal(res.CENTER.gap, 1, "CENTER gap should be 3 - 2 = 1");
	assert.equal(res.CENTER.total, 5, "CENTER total should be 5");

	assert.ok(res.NORTH, "NORTH area should exist");
	assert.equal(res.NORTH.students, 1);
	assert.equal(res.NORTH.pupils, 1);
	assert.equal(res.NORTH.gap, 0, "Balanced area has gap 0");

	assert.ok(res.SOUTH, "SOUTH area should exist");
	assert.equal(res.SOUTH.students, 2);
	assert.equal(res.SOUTH.pupils, 0);
	assert.equal(res.SOUTH.gap, -2, "Surplus area has negative gap 0 - 2 = -2");
});

// 2. סינון רשומות null/לא-אובייקט וערכים מספריים ב-area/role
test("2. computeRegionalSupplyDemand filters out null, non-objects, and numeric area/role without coercion", () => {
	const dirtyRecords = [
		null,
		undefined,
		12345,
		"just a string",
		[],
		{},
		{ role: "student", area: 123 }, // number area - MUST NOT be converted to string "123"
		{ role: "student", area: 0 },
		{ role: 100, area: "CENTER" }, // number role
		{ role: "student", area: "" }, // empty area
		{ role: "student", area: "   " }, // whitespace-only area
		{ role: "", area: "NORTH" }, // empty role
		{ role: "   ", area: "NORTH" }, // whitespace role
		{ role: "unknown_role", area: "NORTH" }, // invalid role
		{ role: "student", area: "HAIFA" }, // valid record 1
		{ role: "pupil", area: "HAIFA" }, // valid record 2
	];

	const res = computeRegionalSupplyDemand(dirtyRecords);
	const areas = Object.keys(res);
	assert.equal(areas.length, 1, "Only HAIFA should remain after filtering");
	assert.ok(!Object.hasOwn(res, "123"), "Numeric area 123 must NOT exist");
	assert.ok(!Object.hasOwn(res, "0"), "Numeric area 0 must NOT exist");
	assert.ok(
		!Object.hasOwn(res, "CENTER"),
		"Record with numeric role must be ignored",
	);
	assert.ok(
		!Object.hasOwn(res, "NORTH"),
		"Records with empty/whitespace role must be ignored",
	);
	assert.equal(res.HAIFA.students, 1);
	assert.equal(res.HAIFA.pupils, 1);
	assert.equal(res.HAIFA.gap, 0);

	// Edge cases: non-array input
	assert.deepEqual(computeRegionalSupplyDemand(null), {});
	assert.deepEqual(computeRegionalSupplyDemand(undefined), {});
	assert.deepEqual(computeRegionalSupplyDemand({}), {});
});

// 3. בניית דוח אימפקט ב-he ללא PII
test("3. buildImpactOverviewReport builds comprehensive Hebrew report with all metrics and zero PII", () => {
	const state = {
		people: [
			{ role: "student", area: "CENTER" },
			{ role: "pupil", area: "CENTER" },
			{ role: "pupil", area: "NORTH" },
		],
		pairs: [{ pairIndex: 0 }, { pairIndex: 1 }],
		attendance: [
			{ pairIndex: 0, date: "2026-09-01", status: "held", durationHours: 1.5 },
			{ pairIndex: 0, date: "2026-09-08", status: "held", durationHours: 2.0 },
			{ pairIndex: 1, date: "2026-09-02", status: "missed", durationHours: 0 },
			{ pairIndex: 1, date: "2026-09-09", status: "missed", durationHours: 0 },
		],
	};

	const report = buildImpactOverviewReport(state, "he");
	assert.equal(report.totalPairs, 2);
	assert.equal(report.heldSessions, 2);
	assert.equal(report.totalHours, 3.5);
	assert.ok(report.regionalBalance.CENTER);
	assert.equal(report.regionalBalance.CENTER.gap, 0);
	assert.equal(report.regionalBalance.NORTH.gap, 1);

	// Pair 1 had 0 held and 2 missed sessions -> in dropout risk
	assert.ok(report.atRiskPairs.length >= 1, "Should detect at-risk pair");
	assert.equal(report.atRiskPairs[0].pairIndex, 1);

	const text = report.text;
	assert.match(text, /דוח אימפקט ומאזן אזורי/);
	assert.match(text, /סך זוגות:\s*2/);
	assert.match(text, /מפגשים שהתקיימו:\s*2/);
	assert.match(text, /סך שעות חונכות:\s*3\.5/);
	assert.match(text, /מאזן אזורי:/);
	assert.match(text, /CENTER/);
	assert.match(text, /NORTH/);

	// Zero PII check
	const pii = findPersonalData(text);
	assert.equal(pii.length, 0, "Report text must contain zero PII");
});

// 4. בניית דוח אימפקט ב-ar וב-ru
test("4. buildImpactOverviewReport supports Arabic and Russian localizations", () => {
	const state = {
		people: [
			{ role: "student", area: "HAIFA" },
			{ role: "pupil", area: "HAIFA" },
		],
		pairs: [{ pairIndex: 0 }],
		attendance: [
			{ pairIndex: 0, date: "2026-09-01", status: "held", durationHours: 1.0 },
		],
	};

	const reportAr = buildImpactOverviewReport(state, "ar");
	assert.equal(reportAr.lang, "ar");
	assert.match(reportAr.text, /تقرير الأثر والتوازن الإقليمي/);
	assert.match(reportAr.text, /إجمالي الأزواج:\s*1/);
	assert.match(reportAr.text, /اللقاءات المنعقدة:\s*1/);
	assert.match(reportAr.text, /إجمالي ساعات الإرشاد:\s*1/);
	assert.match(reportAr.text, /التوازن الإقليمي:/);
	assert.match(reportAr.text, /HAIFA/);

	const reportRu = buildImpactOverviewReport(state, "ru");
	assert.equal(reportRu.lang, "ru");
	assert.match(reportRu.text, /Отчет о воздействии и региональном балансе/);
	assert.match(reportRu.text, /Всего пар:\s*1/);
	assert.match(reportRu.text, /Состоявшихся занятий:\s*1/);
	assert.match(reportRu.text, /Всего часов наставничества:\s*1/);
	assert.match(reportRu.text, /Региональный баланс:/);
	assert.match(reportRu.text, /HAIFA/);
});

// 5. רינדור #regionalBalanceOut ב-#tab-guide
test("5. #regionalBalanceOut renders live table with data-area and numbers in #tab-guide", () => {
	const samplePeople = [
		{
			role: "student",
			region: "CENTER",
			availability: ["SUN_16"],
			subjects: ["MATH"],
		},
		{
			role: "pupil",
			region: "CENTER",
			availability: ["SUN_16"],
			subjects: ["MATH"],
			parentConsent: true,
		},
		{
			role: "pupil",
			region: "CENTER",
			availability: ["SUN_17"],
			subjects: ["MATH"],
			parentConsent: true,
		},
		{
			role: "student",
			region: "NORTH",
			availability: ["MON_18"],
			subjects: ["PHYSICS"],
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

	$("nav-guide").fire("click");

	const container = $("regionalBalanceOut");
	assert.ok(container, "#regionalBalanceOut element must exist");

	const html = container.innerHTML;
	assert.ok(
		html.includes("regional-balance-table"),
		"Must render regional-balance-table",
	);
	assert.ok(html.includes('data-area="CENTER"'), "Must contain row for CENTER");
	assert.ok(html.includes('data-area="NORTH"'), "Must contain row for NORTH");

	// Verify center gap = 2 pupils - 1 student = 1
	assert.match(html, /data-area="CENTER"[\s\S]*?data-gap="1"/);
	// Verify north gap = 0 pupils - 1 student = -1
	assert.match(html, /data-area="NORTH"[\s\S]*?data-gap="-1"/);
});

// 6. עדכון דינמי של #regionalBalanceOut בשינויי משתתפים, מפגשים ושפה
test("6. #regionalBalanceOut updates dynamically on participant changes, sessions, and language toggle", () => {
	const $ = openApp();
	$("nav-guide").fire("click");

	// Initially empty
	let html = $("regionalBalanceOut").innerHTML;
	assert.ok(
		html.includes("אין נתוני אזורים"),
		"Initial empty state displays empty hint",
	);

	// Add participants through UI
	$("nav-people").fire("click");
	addPerson($, "student", "SOUTH", ["MATH"], ["SUN_16"]);
	addPerson($, "pupil", "SOUTH", ["MATH"], ["SUN_16"]);
	addPerson($, "pupil", "SOUTH", ["MATH"], ["SUN_17"]);

	// Check guide table
	$("nav-guide").fire("click");
	html = $("regionalBalanceOut").innerHTML;
	assert.ok(
		html.includes('data-area="SOUTH"'),
		"Updated table now includes SOUTH",
	);
	assert.match(
		html,
		/data-area="SOUTH"[\s\S]*?data-gap="1"/,
		"SOUTH gap is 2 - 1 = 1",
	);

	// Change language to Arabic
	$("langSelect").value = "ar";
	$("langSelect").fire("change");
	html = $("regionalBalanceOut").innerHTML;
	assert.ok(html.includes("المنطقة"), "Table header switches to Arabic");
	assert.ok(html.includes("الفجوة"), "Gap column switches to Arabic");

	// Change language to Russian
	$("langSelect").value = "ru";
	$("langSelect").fire("change");
	html = $("regionalBalanceOut").innerHTML;
	assert.ok(html.includes("Регион"), "Table header switches to Russian");
	assert.ok(html.includes("Разрыв"), "Gap column switches to Russian");

	// Restore Hebrew
	$("langSelect").value = "he";
	$("langSelect").fire("change");
	html = $("regionalBalanceOut").innerHTML;
	assert.ok(html.includes("אזור"), "Table header restores to Hebrew");
});

// 7. העתקת דוח ב-#copyImpactReportBtn ועדכון #impactReportStatus
test("7. #copyImpactReportBtn copies impact report to clipboard and updates #impactReportStatus", async () => {
	const $ = openApp({ clipboard: "ok" });
	setupTestPairAndSession($);

	$("nav-guide").fire("click");

	const copyBtn = $("copyImpactReportBtn");
	const statusEl = $("impactReportStatus");
	assert.ok(copyBtn, "#copyImpactReportBtn must exist");
	assert.ok(statusEl, "#impactReportStatus must exist");
	assert.equal(copyBtn.getAttribute("aria-describedby"), "impactReportStatus");
	assert.equal(copyBtn.getAttribute("type"), "button");

	copyBtn.fire("click");
	await new Promise((resolve) => setTimeout(resolve, 0));

	const copiedText = $.clipboard();
	assert.ok(
		typeof copiedText === "string" && copiedText.length > 0,
		"Clipboard must receive report text",
	);
	assert.match(copiedText, /דוח אימפקט ומאזן אזורי/);
	assert.match(copiedText, /מפגשים שהתקיימו:\s*1/);
	assert.match(copiedText, /סך שעות חונכות:\s*2/);

	assert.match(
		statusEl.textContent,
		/הועתק ללוח/,
		"Status indicates successful clipboard copy",
	);
});

// 8. אפס PII בכל מרכיבי מאזן ואימפקט (Zero PII guarantee)
test("8. Zero PII verified across computeRegionalSupplyDemand, buildImpactOverviewReport, and DOM", async () => {
	const piiSamples = [
		"yossi.cohen@gmail.com",
		"052-1234567",
		"0549998877",
		"123456789",
		"https://facebook.com/user",
	];

	const stateWithPiiAttempt = {
		people: [
			{ role: "student", area: "CENTER" },
			{ role: "pupil", area: "NORTH" },
		],
		pairs: [{ pairIndex: 0 }],
		attendance: [
			{ pairIndex: 0, date: "2026-09-01", status: "held", durationHours: 1.5 },
		],
	};

	const repHe = buildImpactOverviewReport(stateWithPiiAttempt, "he");
	const repAr = buildImpactOverviewReport(stateWithPiiAttempt, "ar");
	const repRu = buildImpactOverviewReport(stateWithPiiAttempt, "ru");

	for (const pii of piiSamples) {
		assert.equal(
			repHe.text.includes(pii),
			false,
			`Hebrew report must not contain ${pii}`,
		);
		assert.equal(
			repAr.text.includes(pii),
			false,
			`Arabic report must not contain ${pii}`,
		);
		assert.equal(
			repRu.text.includes(pii),
			false,
			`Russian report must not contain ${pii}`,
		);
	}

	assert.equal(findPersonalData(repHe.text).length, 0);
	assert.equal(findPersonalData(repAr.text).length, 0);
	assert.equal(findPersonalData(repRu.text).length, 0);

	const $ = openApp({ clipboard: "ok" });
	setupTestPairAndSession($);
	$("nav-guide").fire("click");
	$("copyImpactReportBtn").fire("click");
	await new Promise((resolve) => setTimeout(resolve, 0));

	const domText =
		$("regionalBalanceOut").innerHTML +
		" " +
		$("impactReportStatus").textContent;
	assert.equal(
		findPersonalData(domText).length,
		0,
		"DOM container must not contain any personal data",
	);

	const copied = $.clipboard() || "";
	assert.equal(
		findPersonalData(copied).length,
		0,
		"Clipboard output must not contain any personal data",
	);
});

// 9. התנהגות במצב ריק (Empty state handling)
test("9. empty state returns zeroed impact report and graceful empty balance", () => {
	const empty = emptyState();
	const report = buildImpactOverviewReport(empty, "he");
	assert.equal(report.totalPairs, 0);
	assert.equal(report.heldSessions, 0);
	assert.equal(report.totalHours, 0);
	assert.equal(report.atRiskPairs.length, 0);
	assert.deepEqual(report.regionalBalance, {});
	assert.match(report.text, /סך זוגות:\s*0/);
	assert.match(report.text, /אין נתוני אזורים/);
});
