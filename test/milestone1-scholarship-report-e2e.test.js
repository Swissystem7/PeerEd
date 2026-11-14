"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const {
	recordAttendance,
	serializeAttendance,
	deserializeAttendance,
	buildScholarshipReport,
	makeAttendanceLog,
	AI_TOPIC_KEYS,
} = require("../src/lib/attendance.js");
const { openApp, addPerson } = require("../test-support/fake-dom.js");

function setupTestPairAndUnit($) {
	addPerson($, "student", "CENTER", ["MATH"], ["SUN_16"]);
	addPerson($, "pupil", "CENTER", ["MATH"], ["SUN_16"]);
	$("unitTitle").value = "AI Logic Unit";
	$("unitSubject").value = "MATH";
	$("unitDuration").value = "20";
	$("unitBody").value = "Simple lesson body";
	$("submitUnit").fire("click");
	const unitId = $("unitStatus").textContent.match(/מזהה:\s*(\S+)/)[1];
	$("pendingList").fire("click", { target: { getAttribute: () => unitId } });
	return unitId;
}

test("serialization and backward compatibility of aiTopic and durationHours", () => {
	const legacyRecord = {
		pairIndex: 0,
		date: "2026-09-01",
		status: "held",
		durationHours: 1.5,
	};
	const serializedLegacy = serializeAttendance([legacyRecord]);
	assert.equal(serializedLegacy.length, 1);
	assert.deepEqual(Object.keys(serializedLegacy[0]).sort(), [
		"date",
		"durationHours",
		"pairIndex",
		"status",
	]);
	assert.equal(serializedLegacy[0].durationHours, 1.5);
	assert.equal(serializedLegacy[0].aiTopic, undefined);

	const deserializedLegacy = deserializeAttendance(serializedLegacy);
	assert.equal(deserializedLegacy.length, 1);
	assert.deepEqual(Object.keys(deserializedLegacy[0]).sort(), [
		"date",
		"durationHours",
		"pairIndex",
		"status",
	]);
	assert.equal(deserializedLegacy[0].durationHours, 1.5);

	const topicRecords = [
		{
			pairIndex: 1,
			date: "2026-09-02",
			status: "held",
			durationHours: 0.5,
			aiTopic: "AI_LIT_PROMPT",
		},
		{
			pairIndex: 2,
			date: "2026-09-03",
			status: "held",
			durationHours: 2,
			aiTopic: "AI_CREATIVE",
		},
		{
			pairIndex: 3,
			date: "2026-09-04",
			status: "held",
			durationHours: 1,
			aiTopic: "AI_STEM_CODE",
		},
		{
			pairIndex: 4,
			date: "2026-09-05",
			status: "held",
			durationHours: 1.5,
			aiTopic: "AI_ETHICS_SEC",
		},
		{
			pairIndex: 5,
			date: "2026-09-06",
			status: "held",
			durationHours: 1,
			aiTopic: null,
		},
	];

	const serializedTopics = serializeAttendance(topicRecords);
	assert.equal(serializedTopics.length, 5);
	assert.equal(serializedTopics[0].aiTopic, "AI_LIT_PROMPT");
	assert.equal(serializedTopics[1].aiTopic, "AI_CREATIVE");
	assert.equal(serializedTopics[2].aiTopic, "AI_STEM_CODE");
	assert.equal(serializedTopics[3].aiTopic, "AI_ETHICS_SEC");
	assert.equal(serializedTopics[4].aiTopic, null);

	const deserializedTopics = deserializeAttendance(serializedTopics);
	assert.equal(deserializedTopics.length, 5);
	assert.equal(deserializedTopics[0].aiTopic, "AI_LIT_PROMPT");
	assert.equal(deserializedTopics[1].durationHours, 2);
	assert.equal(deserializedTopics[4].aiTopic, null);

	const dirtyRecords = [
		{
			pairIndex: 0,
			date: "2026-09-01",
			status: "held",
			aiTopic: "MALICIOUS_TOPIC",
			name: "LeakedName",
		},
	];
	const cleaned = serializeAttendance(dirtyRecords);
	assert.equal(cleaned[0].aiTopic, undefined);
	assert.equal(cleaned[0].name, undefined);
});

test("rejection of invalid aiTopic on recordAttendance", () => {
	const log = makeAttendanceLog();

	assert.throws(() => {
		recordAttendance(log, {
			pairIndex: 0,
			date: "2026-09-01",
			status: "held",
			aiTopic: "UNKNOWN_AI_TOPIC",
		});
	}, /invalid attendance: aiTopic/);

	assert.throws(() => {
		recordAttendance(log, {
			pairIndex: 0,
			date: "2026-09-01",
			status: "held",
			aiTopic: 42,
		});
	}, /invalid attendance: aiTopic/);

	assert.throws(() => {
		recordAttendance(log, {
			pairIndex: 0,
			date: "2026-09-01",
			status: "held",
			aiTopic: { topic: "AI_CREATIVE" },
		});
	}, /invalid attendance: aiTopic/);

	assert.throws(() => {
		recordAttendance(log, {
			pairIndex: 0,
			date: "2026-09-01",
			status: "held",
			aiTopic: ["AI_CREATIVE"],
		});
	}, /invalid attendance: aiTopic/);

	for (const validTopic of AI_TOPIC_KEYS) {
		const updated = recordAttendance(log, {
			pairIndex: 0,
			date: "2026-09-01",
			status: "held",
			aiTopic: validTopic,
		});
		assert.equal(updated.entries[0].aiTopic, validTopic);
	}

	const nullTopicLog = recordAttendance(log, {
		pairIndex: 0,
		date: "2026-09-01",
		status: "held",
		aiTopic: null,
	});
	assert.equal(nullTopicLog.entries[0].aiTopic, null);

	const omittedTopicLog = recordAttendance(log, {
		pairIndex: 0,
		date: "2026-09-01",
		status: "held",
	});
	assert.equal(omittedTopicLog.entries[0].aiTopic, undefined);
});

test("buildScholarshipReport computes metrics for 30 hours target", () => {
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
			aiTopic: "AI_CREATIVE",
		},
		{ pairIndex: 0, date: "2026-09-15", status: "missed", durationHours: 0 },
		{
			pairIndex: 1,
			date: "2026-09-01",
			status: "held",
			durationHours: 15,
			aiTopic: "AI_STEM_CODE",
		},
		{
			pairIndex: 2,
			date: "2026-09-01",
			status: "held",
			durationHours: 30,
			aiTopic: "AI_LIT_PROMPT",
		},
	];
	const pairs = [{ pairIndex: 0 }, { pairIndex: 1 }, { pairIndex: 2 }];

	const report = buildScholarshipReport(records, pairs, 30);
	assert.equal(report.targetHours, 30);
	assert.equal(report.pairs.length, 3);

	const p0 = report.byPair[0];
	assert.equal(p0.pairIndex, 0);
	assert.equal(p0.heldSessions, 2);
	assert.equal(p0.totalHours, 3);
	assert.equal(p0.targetHours, 30);
	assert.equal(p0.completionPercent, 10);
	assert.deepEqual(p0.coveredAiTopics, ["AI_CREATIVE"]);
	assert.deepEqual(p0.statusCounts, {
		held: 2,
		missed: 1,
		postponed: 0,
		cancelled: 0,
	});

	const p1 = report.byPair[1];
	assert.equal(p1.pairIndex, 1);
	assert.equal(p1.heldSessions, 1);
	assert.equal(p1.totalHours, 15);
	assert.equal(p1.completionPercent, 50);
	assert.deepEqual(p1.coveredAiTopics, ["AI_STEM_CODE"]);

	const p2 = report.byPair[2];
	assert.equal(p2.pairIndex, 2);
	assert.equal(p2.totalHours, 30);
	assert.equal(p2.completionPercent, 100);

	assert.equal(report.summary.totalPairs, 3);
	assert.equal(report.summary.totalHeldSessions, 4);
	assert.equal(report.summary.totalHours, 48);
	assert.equal(report.summary.targetHours, 30);
	assert.equal(report.summary.completionPercent, 53);
	assert.deepEqual(report.summary.coveredAiTopics, [
		"AI_CREATIVE",
		"AI_LIT_PROMPT",
		"AI_STEM_CODE",
	]);
	assert.deepEqual(report.summary.statusCounts, {
		held: 4,
		missed: 1,
		postponed: 0,
		cancelled: 0,
	});
});

test("buildScholarshipReport computes metrics for 130 hours IMPACT target", () => {
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
		{ pairIndex: 2, date: "2026-09-01", status: "missed", durationHours: 0 },
		{ pairIndex: 3, date: "2026-09-01", status: "held", durationHours: 13 },
	];
	const pairs = [
		{ pairIndex: 0 },
		{ pairIndex: 1 },
		{ pairIndex: 2 },
		{ pairIndex: 3 },
	];

	const report = buildScholarshipReport(records, pairs, 130);
	assert.equal(report.targetHours, 130);
	assert.equal(report.summary.targetHours, 130);

	const p0 = report.byPair[0];
	assert.equal(p0.totalHours, 65);
	assert.equal(p0.targetHours, 130);
	assert.equal(p0.completionPercent, 50);

	const p1 = report.byPair[1];
	assert.equal(p1.totalHours, 130);
	assert.equal(p1.targetHours, 130);
	assert.equal(p1.completionPercent, 100);

	const p2 = report.byPair[2];
	assert.equal(p2.totalHours, 0);
	assert.equal(p2.completionPercent, 0);

	const p3 = report.byPair[3];
	assert.equal(p3.totalHours, 13);
	assert.equal(p3.completionPercent, 10);

	assert.equal(report.summary.totalPairs, 4);
	assert.equal(report.summary.totalHours, 208);
	assert.equal(report.summary.completionPercent, 40);
});

test("UI session recording connects duration and AI topic selectors", () => {
	const $ = openApp();
	const unitId = setupTestPairAndUnit($);

	$("nav-sessions").fire("click");
	$("sessionSlot").value = "SUN_16";
	$("sessionSubject").value = "MATH";
	$("sessionUnit").value = unitId;
	$("sessionOutcome").value = "held";
	$("sessionDurationSelect").value = "1.5";
	$("sessionAiTopicSelect").value = "AI_STEM_CODE";

	$("logSession").fire("click");

	const status = $("sessionStatus");
	assert.equal(
		status.className.includes("bad"),
		false,
		`session logging must succeed: ${status.textContent}`,
	);
	assert.match(status.textContent, /נרשם שיעור 1/);

	const badge = $("pairTotalHoursBadge");
	assert.match(badge.textContent, /1\.5/);

	const attRecords = $.store.peered_app_v1
		? JSON.parse($.store.peered_app_v1).attendance
		: null;
	assert.ok(Array.isArray(attRecords), "stored attendance should be an array");
	assert.equal(attRecords.length, 1);
	assert.equal(attRecords[0].pairIndex, 0);
	assert.equal(attRecords[0].durationHours, 1.5);
	assert.equal(attRecords[0].aiTopic, "AI_STEM_CODE");
	assert.equal(attRecords[0].status, "held");
});

test("UI generates scholarship report in #scholarshipReportOut", () => {
	const $ = openApp();
	const unitId = setupTestPairAndUnit($);

	$("nav-sessions").fire("click");
	$("sessionSlot").value = "SUN_16";
	$("sessionSubject").value = "MATH";
	$("sessionUnit").value = unitId;
	$("sessionOutcome").value = "held";
	$("sessionDurationSelect").value = "2";
	$("sessionAiTopicSelect").value = "AI_CREATIVE";
	$("logSession").fire("click");

	$("scholarshipTargetSelect").value = "130";
	$("generateScholarshipReportBtn").fire("click");

	const out = $("scholarshipReportOut");
	assert.ok(out.innerHTML.includes("130"), "report should display target 130");
	assert.ok(out.innerHTML.includes("2"), "report should display 2 hours");
	assert.ok(
		out.innerHTML.includes("2%") || out.innerHTML.includes("2 %"),
		"report should display completion percent",
	);
	assert.ok(
		out.innerHTML.includes("AI_CREATIVE") || out.innerHTML.includes("יצירתיות"),
		"report should display topic",
	);

	const reportStatus = $("scholarshipReportStatus");
	assert.match(reportStatus.textContent, /דוח שעות המלגה הופק/);

	$("scholarshipTargetSelect").value = "30";
	$("generateScholarshipReportBtn").fire("click");
	assert.ok(out.innerHTML.includes("30"), "report should update to target 30");
	assert.ok(
		out.innerHTML.includes("7%"),
		"report should update completion percent (2/30 = 7%)",
	);
});

test("UI copies scholarship report and updates #scholarshipReportStatus", async () => {
	const $ = openApp({ clipboard: "ok" });
	const unitId = setupTestPairAndUnit($);

	$("nav-sessions").fire("click");
	$("sessionSlot").value = "SUN_16";
	$("sessionSubject").value = "MATH";
	$("sessionUnit").value = unitId;
	$("sessionOutcome").value = "held";
	$("sessionDurationSelect").value = "1.5";
	$("sessionAiTopicSelect").value = "AI_ETHICS_SEC";
	$("logSession").fire("click");

	assert.equal(
		$("generateScholarshipReportBtn").getAttribute("aria-describedby"),
		"scholarshipReportStatus",
	);
	assert.equal(
		$("copyScholarshipReportBtn").getAttribute("aria-describedby"),
		"scholarshipReportStatus",
	);

	$("generateScholarshipReportBtn").fire("click");
	$("copyScholarshipReportBtn").fire("click");

	await new Promise((resolve) => setTimeout(resolve, 0));

	const copied = $.clipboard();
	assert.ok(
		typeof copied === "string" && copied.length > 0,
		"clipboard should receive report text",
	);
	assert.match(copied, /דוח שעות מלגה/);
	assert.match(copied, /1\.5/);

	const status = $("scholarshipReportStatus");
	assert.match(status.textContent, /הועתק ללוח/);
});

test("tri-lingual labels for session duration, AI topic and scholarship report (he, ar, ru)", () => {
	const $ = openApp();
	$("nav-sessions").fire("click");

	assert.match($("sessionDurationLabel").textContent, /משך שיעור/);
	assert.match($("sessionAiTopicLabel").textContent, /נושא בינה מלאכותית/);
	assert.match($("scholarshipReportHeading").textContent, /דוח שעות מלגה/);
	assert.match(
		$("generateScholarshipReportBtn").textContent,
		/הפק דוח שעות מלגה/,
	);
	assert.match($("copyScholarshipReportBtn").textContent, /העתק דוח/);
	assert.match($("scholarshipTargetLabel").textContent, /יעד שעות מלגה/);

	$("langSelect").value = "ar";
	$("langSelect").fire("change");
	assert.match($("sessionDurationLabel").textContent, /مدة/);
	assert.match($("sessionAiTopicLabel").textContent, /الذكاء الاصطناعي/);
	assert.match($("scholarshipReportHeading").textContent, /تقرير ساعات المنحة/);
	assert.match(
		$("generateScholarshipReportBtn").textContent,
		/إنشاء تقرير ساعات المنحة/,
	);
	assert.match($("copyScholarshipReportBtn").textContent, /نسخ/);
	assert.match($("scholarshipTargetLabel").textContent, /هدف/);

	$("langSelect").value = "ru";
	$("langSelect").fire("change");
	assert.match($("sessionDurationLabel").textContent, /Длительность/);
	assert.match($("sessionAiTopicLabel").textContent, /Тема/);
	assert.match(
		$("scholarshipReportHeading").textContent,
		/Отчет о часах стипендии/,
	);
	assert.match(
		$("generateScholarshipReportBtn").textContent,
		/Сформировать отчет/,
	);
	assert.match($("copyScholarshipReportBtn").textContent, /Копировать/);
	assert.match($("scholarshipTargetLabel").textContent, /Цель/);
});

test("zero PII guarantee in buildScholarshipReport, UI display, and clipboard", async () => {
	const contaminatedRecords = [
		{
			pairIndex: 0,
			date: "2026-09-01",
			status: "held",
			durationHours: 2,
			aiTopic: "AI_CREATIVE",
			name: "ישראל ישראלי",
			studentName: "דנה לוי",
			pupilName: "יוסי כהן",
			email: "secret@example.com",
			phone: "0501234567",
			idNumber: "123456789",
		},
	];
	const contaminatedPairs = [
		{
			pairIndex: 0,
			studentName: "דנה לוי",
			pupilName: "יוסי כהן",
			studentPhone: "0520000000",
			pupilEmail: "pupil@school.edu",
		},
	];

	const report = buildScholarshipReport(
		contaminatedRecords,
		contaminatedPairs,
		30,
	);
	const json = JSON.stringify(report);
	for (const pii of [
		"ישראל",
		"דנה",
		"יוסי",
		"secret@example.com",
		"0501234567",
		"123456789",
		"0520000000",
		"pupil@school.edu",
	]) {
		assert.equal(
			json.includes(pii),
			false,
			`Report JSON must not contain PII: ${pii}`,
		);
	}

	const $ = openApp({
		clipboard: "ok",
		store: {
			peered_app_v1: JSON.stringify({
				schema: 1,
				people: [],
				queue: { nextId: 1, entries: {} },
				log: { nextSeq: 1, entries: [] },
				attendance: contaminatedRecords,
			}),
		},
	});

	$("nav-sessions").fire("click");
	$("generateScholarshipReportBtn").fire("click");
	$("copyScholarshipReportBtn").fire("click");
	await new Promise((resolve) => setTimeout(resolve, 0));

	const uiHtml = $("scholarshipReportOut").innerHTML;
	const clipboard = $.clipboard() || "";

	for (const pii of [
		"ישראל",
		"דנה",
		"יוסי",
		"secret@example.com",
		"0501234567",
		"123456789",
	]) {
		assert.equal(
			uiHtml.includes(pii),
			false,
			`UI HTML must not contain PII: ${pii}`,
		);
		assert.equal(
			clipboard.includes(pii),
			false,
			`Clipboard text must not contain PII: ${pii}`,
		);
	}
});
