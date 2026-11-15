const test = require("node:test");
const assert = require("node:assert/strict");
const attendance = require("../src/lib/attendance.js");
const sessionLib = require("../src/lib/session.js");
const { openApp } = require("../test-support/fake-dom.js");

function createTestStore(attendanceRecords = []) {
	return {
		peered_app_v1: JSON.stringify({
			schema: "peered/1",
			people: [
				{
					role: "student",
					region: "CENTER",
					subjects: ["MATH"],
					availability: ["SUN_16"],
				},
				{
					role: "pupil",
					region: "CENTER",
					subjects: ["MATH"],
					availability: ["SUN_16"],
					parentConsent: true,
				},
			],
			queue: { nextSeq: 1, entries: {} },
			log: { nextSeq: 1, entries: [] },
			attendance: attendanceRecords,
		}),
	};
}

test("1. filterAttendanceByDateRange filters by full range with inclusive endpoints", () => {
	const records = [
		{ pairIndex: 0, date: "2026-09-01", status: "held", durationHours: 1.5 },
		{ pairIndex: 0, date: "2026-09-05", status: "held", durationHours: 2.0 },
		{ pairIndex: 0, date: "2026-09-10", status: "held", durationHours: 1.0 },
		{ pairIndex: 0, date: "2026-09-15", status: "missed", durationHours: 0 },
	];

	const inRange = attendance.filterAttendanceByDateRange(
		records,
		"2026-09-05",
		"2026-09-10",
	);
	assert.equal(inRange.length, 2);
	assert.equal(inRange[0].date, "2026-09-05");
	assert.equal(inRange[1].date, "2026-09-10");
	assert.ok(Object.isFrozen(inRange));

	const singleDate = attendance.filterAttendanceByDateRange(
		records,
		"2026-09-01",
		"2026-09-01",
	);
	assert.equal(singleDate.length, 1);
	assert.equal(singleDate[0].date, "2026-09-01");
});

test("2. filterAttendanceByDateRange handles open ranges and inverted bounds", () => {
	const log = attendance.makeAttendanceLog();
	const r1 = { pairIndex: 0, date: "2026-08-15", status: "held" };
	const r2 = { pairIndex: 0, date: "2026-09-01", status: "held" };
	const r3 = { pairIndex: 0, date: "2026-09-20", status: "held" };
	const entries = [r1, r2, r3];

	// Open end (only startDate provided)
	const fromSept = attendance.filterAttendanceByDateRange(
		entries,
		"2026-09-01",
		"",
	);
	assert.equal(fromSept.length, 2);
	assert.equal(fromSept[0].date, "2026-09-01");
	assert.equal(fromSept[1].date, "2026-09-20");

	// Open start (only endDate provided)
	const untilSeptFirst = attendance.filterAttendanceByDateRange(
		entries,
		null,
		"2026-09-01",
	);
	assert.equal(untilSeptFirst.length, 2);
	assert.equal(untilSeptFirst[0].date, "2026-08-15");
	assert.equal(untilSeptFirst[0].pairIndex, 0);
	assert.equal(untilSeptFirst[1].date, "2026-09-01");

	// Both open (null/undefined/empty)
	const all = attendance.filterAttendanceByDateRange(entries, undefined, null);
	assert.equal(all.length, 3);

	// Inverted bounds (startDate > endDate)
	const empty = attendance.filterAttendanceByDateRange(
		entries,
		"2026-09-20",
		"2026-09-01",
	);
	assert.equal(empty.length, 0);

	// Log object support
	const fromLog = attendance.filterAttendanceByDateRange(
		log,
		"2026-01-01",
		"2026-12-31",
	);
	assert.equal(fromLog.length, 0);
});

test("3. exportScholarshipCsv produces valid CSV with expected headers and rows", () => {
	const records = [
		{
			pairIndex: 0,
			date: "2026-09-01",
			status: "held",
			durationHours: 1.5,
			aiTopic: "AI_CREATIVE",
		},
		{
			pairIndex: 0,
			date: "2026-09-08",
			status: "held",
			durationHours: 1.5,
			aiTopic: "AI_LIT_PROMPT",
		},
		{
			pairIndex: 1,
			date: "2026-09-02",
			status: "held",
			durationHours: 3.0,
			aiTopic: "AI_STEM_CODE",
		},
		{
			pairIndex: 2,
			date: "2026-09-03",
			status: "missed",
			durationHours: 0,
		},
	];
	const pairs = [{ pairIndex: 0 }, { pairIndex: 1 }, { pairIndex: 2 }];

	const csv = attendance.exportScholarshipCsv(records, pairs, 30);
	const lines = csv.trim().split("\n");

	assert.equal(
		lines[0],
		"pairIndex,heldSessions,totalHours,targetHours,completionPercent,coveredAiTopics",
	);
	assert.equal(lines.length, 4);

	// Pair 0: 2 sessions, 3 hours out of 30 (10%), AI_CREATIVE and AI_LIT_PROMPT
	assert.equal(lines[1], "0,2,3,30,10,AI_CREATIVE;AI_LIT_PROMPT");
	// Pair 1: 1 session, 3 hours out of 30 (10%), AI_STEM_CODE
	assert.equal(lines[2], "1,1,3,30,10,AI_STEM_CODE");
	// Pair 2: 0 held sessions, 0 hours out of 30 (0%), no AI topics
	assert.equal(lines[3], "2,0,0,30,0,");
});

test("4. exportScholarshipCsv computes correct metrics for 130 hours IMPACT target", () => {
	const records = [
		{
			pairIndex: 0,
			date: "2026-09-01",
			status: "held",
			durationHours: 65,
			aiTopic: "AI_ETHICS_SEC",
		},
		{
			pairIndex: 1,
			date: "2026-09-01",
			status: "held",
			durationHours: 130,
			aiTopic: "AI_CREATIVE",
		},
		{
			pairIndex: 2,
			date: "2026-09-01",
			status: "held",
			durationHours: 13,
		},
	];
	const pairs = [{ pairIndex: 0 }, { pairIndex: 1 }, { pairIndex: 2 }];

	const csv = attendance.exportScholarshipCsv(records, pairs, 130);
	const lines = csv.trim().split("\n");

	assert.equal(lines[1], "0,1,65,130,50,AI_ETHICS_SEC");
	assert.equal(lines[2], "1,1,130,130,100,AI_CREATIVE");
	assert.equal(lines[3], "2,1,13,130,10,");
});

test("5. UI date range inputs #sessionStartDate and #sessionEndDate update hours badge", () => {
	const initialRecords = [
		{ pairIndex: 0, date: "2026-08-01", status: "held", durationHours: 2.0 },
		{ pairIndex: 0, date: "2026-09-01", status: "held", durationHours: 1.5 },
	];
	const $ = openApp({ store: createTestStore(initialRecords) });

	$("nav-sessions").fire("click");

	// Initial total: 3.5 hours
	assert.equal($("pairTotalHoursBadge").textContent, "סך שעות: 3.5");

	// Filter from September 1st: only 1.5 hours
	$("sessionStartDate").value = "2026-09-01";
	$("sessionStartDate").fire("input");
	assert.equal($("pairTotalHoursBadge").textContent, "סך שעות: 1.5");

	// Filter with date range excluding all sessions: 0 hours
	$("sessionStartDate").value = "2026-10-01";
	$("sessionEndDate").value = "2026-10-31";
	$("sessionEndDate").fire("change");
	assert.equal($("pairTotalHoursBadge").textContent, "סך שעות: 0");

	// Clear dates to restore full total
	$("sessionStartDate").value = "";
	$("sessionEndDate").value = "";
	$("sessionStartDate").fire("input");
	assert.equal($("pairTotalHoursBadge").textContent, "סך שעות: 3.5");
});

test("6. UI date range inputs filter #scholarshipReportOut display", () => {
	const initialRecords = [
		{
			pairIndex: 0,
			date: "2026-08-01",
			status: "held",
			durationHours: 2.0,
			aiTopic: "AI_CREATIVE",
		},
		{
			pairIndex: 0,
			date: "2026-09-01",
			status: "held",
			durationHours: 1.5,
			aiTopic: "AI_STEM_CODE",
		},
	];
	const $ = openApp({ store: createTestStore(initialRecords) });

	$("nav-sessions").fire("click");
	$("generateScholarshipReportBtn").fire("click");

	let reportHtml = $("scholarshipReportOut").innerHTML;
	assert.ok(reportHtml.includes("3.5"));

	// Filter to September only
	$("sessionStartDate").value = "2026-09-01";
	$("sessionStartDate").fire("input");

	reportHtml = $("scholarshipReportOut").innerHTML;
	assert.ok(reportHtml.includes("1.5"));
	assert.ok(!reportHtml.includes("3.5"));
});

test("7. #exportScholarshipCsvBtn copies anonymous CSV to clipboard and updates #scholarshipCsvStatus", async () => {
	const initialRecords = [
		{
			pairIndex: 0,
			date: "2026-09-01",
			status: "held",
			durationHours: 3.0,
			aiTopic: "AI_CREATIVE",
		},
	];
	const $ = openApp({
		clipboard: "ok",
		store: createTestStore(initialRecords),
	});

	$("nav-sessions").fire("click");

	const exportBtn = $("exportScholarshipCsvBtn");
	assert.equal(exportBtn.getAttribute("type"), "button");
	assert.equal(
		exportBtn.getAttribute("aria-describedby"),
		"scholarshipCsvStatus",
	);

	exportBtn.fire("click");
	await new Promise((resolve) => setTimeout(resolve, 0));

	const copied = $.clipboard();
	assert.ok(typeof copied === "string" && copied.length > 0);
	assert.ok(
		copied.startsWith(
			"pairIndex,heldSessions,totalHours,targetHours,completionPercent,coveredAiTopics",
		),
	);
	assert.ok(copied.includes("0,1,3,30,10,AI_CREATIVE"));

	const status = $("scholarshipCsvStatus");
	assert.equal(status.textContent, "דוח שעות מלגה (CSV) הועתק ללוח.");
});

test("8. Trilingual support for #scholarshipCsvStatus and export button labels across he/ar/ru", async () => {
	const initialRecords = [
		{ pairIndex: 0, date: "2026-09-01", status: "held", durationHours: 2.0 },
	];
	const $ = openApp({
		clipboard: "ok",
		store: createTestStore(initialRecords),
	});

	$("nav-sessions").fire("click");

	// Arabic
	$("langSelect").value = "ar";
	$("langSelect").fire("change");
	assert.equal($("sessionStartDateLabel").textContent, "من تاريخ");
	assert.equal($("sessionEndDateLabel").textContent, "إلى تاريخ");
	assert.equal($("exportScholarshipCsvBtn").textContent, "تصدير CSV مجهول");

	$("exportScholarshipCsvBtn").fire("click");
	await new Promise((resolve) => setTimeout(resolve, 0));
	assert.equal(
		$("scholarshipCsvStatus").textContent,
		"تم نسخ تقرير ساعات المنحة (CSV) إلى الحافظة.",
	);

	// Russian
	$("langSelect").value = "ru";
	$("langSelect").fire("change");
	assert.equal($("sessionStartDateLabel").textContent, "С даты");
	assert.equal($("sessionEndDateLabel").textContent, "По дату");
	assert.equal(
		$("exportScholarshipCsvBtn").textContent,
		"Экспорт анонимного CSV",
	);

	$("exportScholarshipCsvBtn").fire("click");
	await new Promise((resolve) => setTimeout(resolve, 0));
	assert.equal(
		$("scholarshipCsvStatus").textContent,
		"Отчет о часах стипендии (CSV) скопирован в буфер обмена.",
	);

	// Hebrew
	$("langSelect").value = "he";
	$("langSelect").fire("change");
	assert.equal($("sessionStartDateLabel").textContent, "מתאריך");
	assert.equal($("sessionEndDateLabel").textContent, "עד תאריך");
	assert.equal($("exportScholarshipCsvBtn").textContent, "ייצוא CSV אנונימי");

	$("exportScholarshipCsvBtn").fire("click");
	await new Promise((resolve) => setTimeout(resolve, 0));
	assert.equal(
		$("scholarshipCsvStatus").textContent,
		"דוח שעות מלגה (CSV) הועתק ללוח.",
	);
});

test("9. Zero PII guarantee in exportScholarshipCsv, UI display, and clipboard", async () => {
	const contaminatedRecords = [
		{
			pairIndex: 0,
			date: "2026-09-01",
			status: "held",
			durationHours: 3.0,
			aiTopic: "AI_STEM_CODE",
			coordinatorNote: "Confidential private notes",
			studentName: "Israel Israeli",
			pupilEmail: "secret@example.com",
		},
	];
	const contaminatedPairs = [
		{
			pairIndex: 0,
			studentName: "Israel Israeli",
			pupilName: "Sarah Pupil",
			phone: "050-1234567",
		},
	];

	const $ = openApp({
		clipboard: "ok",
		store: createTestStore(contaminatedRecords),
	});

	$("nav-sessions").fire("click");
	$("generateScholarshipReportBtn").fire("click");
	$("exportScholarshipCsvBtn").fire("click");
	await new Promise((resolve) => setTimeout(resolve, 0));

	const csv = attendance.exportScholarshipCsv(
		contaminatedRecords,
		contaminatedPairs,
		30,
	);
	const copied = $.clipboard() || "";
	const uiHtml = $("scholarshipReportOut").innerHTML || "";

	const forbidden = [
		"Israel",
		"Israeli",
		"secret@example.com",
		"050-1234567",
		"Sarah",
		"Pupil",
		"Confidential",
		"coordinatorNote",
	];

	for (const pii of forbidden) {
		assert.ok(!csv.includes(pii), `CSV must not leak PII: ${pii}`);
		assert.ok(!copied.includes(pii), `Clipboard must not leak PII: ${pii}`);
		assert.ok(!uiHtml.includes(pii), `UI report must not leak PII: ${pii}`);
	}
});

test("10. src/lib/session.js parity with src/lib/attendance.js for new exported functions", () => {
	assert.equal(typeof sessionLib.filterAttendanceByDateRange, "function");
	assert.equal(typeof sessionLib.exportScholarshipCsv, "function");

	const records = [
		{
			pairIndex: 0,
			date: "2026-09-01",
			status: "held",
			durationHours: 1.5,
			aiTopic: "AI_CREATIVE",
		},
	];
	const pairs = [{ pairIndex: 0 }];

	const filteredFromAttendance = attendance.filterAttendanceByDateRange(
		records,
		"2026-09-01",
		"2026-09-01",
	);
	const filteredFromSession = sessionLib.filterAttendanceByDateRange(
		records,
		"2026-09-01",
		"2026-09-01",
	);
	assert.deepEqual(filteredFromAttendance, filteredFromSession);

	const csvFromAttendance = attendance.exportScholarshipCsv(records, pairs, 30);
	const csvFromSession = sessionLib.exportScholarshipCsv(records, pairs, 30);
	assert.equal(csvFromAttendance, csvFromSession);
});
