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

test("1. computeWeeklyPaceForecast computes statuses on_track, at_risk, and completed correctly", () => {
	// Pair 0 has 10 hours completed over 4 weeks (pace = 2.5 h/wk)
	const recordsOnTrack = [
		{ pairIndex: 0, date: "2026-09-01", status: "held", durationHours: 2.5 },
		{ pairIndex: 0, date: "2026-09-08", status: "held", durationHours: 2.5 },
		{ pairIndex: 0, date: "2026-09-15", status: "held", durationHours: 2.5 },
		{ pairIndex: 0, date: "2026-09-22", status: "held", durationHours: 2.5 },
	];

	// Target 30h, 8 weeks remaining: 10 + (2.5 * 8) = 30 -> on_track
	const forecastOnTrack = attendance.computeWeeklyPaceForecast(
		recordsOnTrack,
		0,
		30,
		8,
	);
	assert.equal(forecastOnTrack.pairIndex, 0);
	assert.equal(forecastOnTrack.completedHours, 10);
	assert.equal(forecastOnTrack.targetHours, 30);
	assert.equal(forecastOnTrack.remainingWeeks, 8);
	assert.equal(forecastOnTrack.averagePace, 2.5);
	assert.equal(forecastOnTrack.projectedHours, 30);
	assert.equal(forecastOnTrack.finalForecast, 30);
	assert.equal(forecastOnTrack.status, "on_track");
	assert.equal(forecastOnTrack.hoursRemaining, 20);

	// Pair 0 has 4 hours completed over 4 weeks (pace = 1.0 h/wk)
	// Target 30h, 8 weeks remaining: 4 + (1.0 * 8) = 12 -> at_risk
	const recordsAtRisk = [
		{ pairIndex: 0, date: "2026-09-01", status: "held", durationHours: 1.0 },
		{ pairIndex: 0, date: "2026-09-08", status: "held", durationHours: 1.0 },
		{ pairIndex: 0, date: "2026-09-15", status: "held", durationHours: 1.0 },
		{ pairIndex: 0, date: "2026-09-22", status: "held", durationHours: 1.0 },
	];
	const forecastAtRisk = attendance.computeWeeklyPaceForecast(
		recordsAtRisk,
		0,
		30,
		8,
	);
	assert.equal(forecastAtRisk.completedHours, 4);
	assert.equal(forecastAtRisk.averagePace, 1.0);
	assert.equal(forecastAtRisk.projectedHours, 12);
	assert.equal(forecastAtRisk.status, "at_risk");

	// Pair 0 has 30 hours completed -> completed
	const recordsCompleted = [
		{ pairIndex: 0, date: "2026-09-01", status: "held", durationHours: 30.0 },
	];
	const forecastCompleted = attendance.computeWeeklyPaceForecast(
		recordsCompleted,
		0,
		30,
		8,
	);
	assert.equal(forecastCompleted.completedHours, 30);
	assert.equal(forecastCompleted.hoursRemaining, 0);
	assert.equal(forecastCompleted.status, "completed");
});

test("2. computeWeeklyPaceForecast handles empty inputs, null, zero weeks, negative weeks, and non-numeric gracefully", () => {
	// Empty records array
	const emptyForecast = attendance.computeWeeklyPaceForecast([], 0, 30, 8);
	assert.equal(emptyForecast.completedHours, 0);
	assert.equal(emptyForecast.averagePace, 0);
	assert.equal(emptyForecast.projectedHours, 0);
	assert.equal(emptyForecast.status, "at_risk");

	// Null and undefined inputs
	const nullForecast = attendance.computeWeeklyPaceForecast(
		null,
		null,
		null,
		null,
	);
	assert.equal(nullForecast.pairIndex, 0);
	assert.equal(nullForecast.targetHours, 30);
	assert.equal(nullForecast.remainingWeeks, 8);
	assert.equal(nullForecast.status, "at_risk");

	// Remaining weeks = 0
	const records = [
		{ pairIndex: 0, date: "2026-09-01", status: "held", durationHours: 15 },
	];
	const zeroWeeksForecast = attendance.computeWeeklyPaceForecast(
		records,
		0,
		30,
		0,
	);
	assert.equal(zeroWeeksForecast.remainingWeeks, 0);
	assert.equal(zeroWeeksForecast.completedHours, 15);
	assert.equal(zeroWeeksForecast.projectedHours, 15);
	assert.equal(zeroWeeksForecast.status, "at_risk");

	// Remaining weeks = 0 but already completed
	const recordsDone = [
		{ pairIndex: 0, date: "2026-09-01", status: "held", durationHours: 30 },
	];
	const zeroWeeksDone = attendance.computeWeeklyPaceForecast(
		recordsDone,
		0,
		30,
		0,
	);
	assert.equal(zeroWeeksDone.status, "completed");

	// Negative remaining weeks (clamped to 0)
	const negativeWeeks = attendance.computeWeeklyPaceForecast(
		records,
		0,
		30,
		-4,
	);
	assert.equal(negativeWeeks.remainingWeeks, 0);

	// String remaining weeks (parsed)
	const strWeeks = attendance.computeWeeklyPaceForecast(records, 0, 30, "10");
	assert.equal(strWeeks.remainingWeeks, 10);
});

test("3. computeWeeklyPaceForecast calculates pace correctly across multi-week sessions and 130h target (IMPACT!)", () => {
	const multiWeekRecords = [
		{ pairIndex: 0, date: "2026-09-01", status: "held", durationHours: 3.0 },
		{ pairIndex: 0, date: "2026-09-08", status: "held", durationHours: 3.0 },
		{ pairIndex: 0, date: "2026-09-15", status: "held", durationHours: 3.0 },
	];

	// Target 130h, 30 weeks remaining: 9h completed over 3 weeks -> pace 3.0 h/wk
	// projected = 9 + (3.0 * 30) = 99h < 130h -> at_risk
	const impactAtRisk = attendance.computeWeeklyPaceForecast(
		multiWeekRecords,
		0,
		130,
		30,
	);
	assert.equal(impactAtRisk.completedHours, 9);
	assert.equal(impactAtRisk.averagePace, 3.0);
	assert.equal(impactAtRisk.projectedHours, 99);
	assert.equal(impactAtRisk.status, "at_risk");

	// With 45 weeks remaining: 9 + (3.0 * 45) = 144h >= 130h -> on_track
	const impactOnTrack = attendance.computeWeeklyPaceForecast(
		multiWeekRecords,
		0,
		130,
		45,
	);
	assert.equal(impactOnTrack.projectedHours, 144);
	assert.equal(impactOnTrack.status, "on_track");
});

test("4. formatScholarshipAttestationText formats anonymous attestation in Hebrew (he)", () => {
	const reportRow = {
		pairIndex: 0,
		heldSessions: 6,
		totalHours: 12,
		targetHours: 30,
		completionPercent: 40,
	};
	const paceForecast = {
		pairIndex: 0,
		completedHours: 12,
		targetHours: 30,
		remainingWeeks: 8,
		averagePace: 2.5,
		finalForecast: 32,
		status: "on_track",
	};

	const text = attendance.formatScholarshipAttestationText(
		reportRow,
		paceForecast,
		"he",
	);
	assert.ok(text.includes("--- אישור שעות מלגה (אנונימי) ---"));
	assert.ok(text.includes("מזהה זוג: #0"));
	assert.ok(text.includes("שעות שבוצעו: 12 / 30 שעות (40%)"));
	assert.ok(text.includes("מפגשים שהתקיימו: 6"));
	assert.ok(text.includes("קצב שבועי ממוצע: 2.5 שעות/שבוע"));
	assert.ok(text.includes("שבועות נותרים: 8"));
	assert.ok(text.includes("תחזית סופית: 32 שעות"));
	assert.ok(text.includes("סטטוס תחזית: במסלול להשלמה"));
});

test("5. formatScholarshipAttestationText formats anonymous attestation in Arabic (ar) and Russian (ru)", () => {
	const reportRow = {
		pairIndex: 1,
		heldSessions: 8,
		totalHours: 16,
		targetHours: 30,
		completionPercent: 53,
	};
	const paceForecast = {
		pairIndex: 1,
		completedHours: 16,
		targetHours: 30,
		remainingWeeks: 6,
		averagePace: 2.0,
		finalForecast: 28,
		status: "at_risk",
	};

	// Arabic
	const arText = attendance.formatScholarshipAttestationText(
		reportRow,
		paceForecast,
		"ar",
	);
	assert.ok(arText.includes("--- إفادة ساعات المنحة (مجهولة الهوية) ---"));
	assert.ok(arText.includes("معرف الزوج: #1"));
	assert.ok(arText.includes("الساعات المنجزة: 16 / 30 ساعة (53%)"));
	assert.ok(arText.includes("اللقاءات المنعقدة: 8"));
	assert.ok(arText.includes("المعدل الأسبوعي: 2 ساعة/أسبوع"));
	assert.ok(arText.includes("الأسابيع المتبقية: 6"));
	assert.ok(arText.includes("التوقع النهائي: 28 ساعة"));
	assert.ok(arText.includes("حالة التوقع: في خطر"));

	// Russian
	const ruText = attendance.formatScholarshipAttestationText(
		reportRow,
		paceForecast,
		"ru",
	);
	assert.ok(
		ruText.includes("--- Подтверждение часов стипендии (анонимное) ---"),
	);
	assert.ok(ruText.includes("Идентификатор пары: #1"));
	assert.ok(ruText.includes("Выполнено часов: 16 / 30 ч (53%)"));
	assert.ok(ruText.includes("Состоявшихся занятий: 8"));
	assert.ok(ruText.includes("Средний недельный темп: 2 ч/нед"));
	assert.ok(ruText.includes("Осталось недель: 6"));
	assert.ok(ruText.includes("Итоговый прогноз: 28 ч"));
	assert.ok(ruText.includes("Статус прогноза: в зоне риска"));
});

test("6. Zero PII guarantee: formatScholarshipAttestationText and computeWeeklyPaceForecast contain zero PII", () => {
	const contaminatedRow = {
		pairIndex: 0,
		heldSessions: 5,
		totalHours: 10,
		targetHours: 30,
		completionPercent: 33,
		studentName: "Avi Ron",
		pupilName: "Dan Din",
		email: "test@school.edu",
		phone: "054-9876543",
		address: "Herzl 1, Haifa",
		id_number: "987654321",
	};
	const contaminatedForecast = {
		pairIndex: 0,
		completedHours: 10,
		targetHours: 30,
		remainingWeeks: 8,
		averagePace: 2.0,
		finalForecast: 26,
		status: "at_risk",
		mentorIdentity: "SECRET_MENTOR",
		pupilIdentity: "SECRET_PUPIL",
	};

	const forbidden = [
		"Avi Ron",
		"Dan Din",
		"test@school.edu",
		"054-9876543",
		"Herzl 1",
		"987654321",
		"SECRET_MENTOR",
		"SECRET_PUPIL",
	];

	for (const lang of ["he", "ar", "ru"]) {
		const formatted = attendance.formatScholarshipAttestationText(
			contaminatedRow,
			contaminatedForecast,
			lang,
		);
		for (const pii of forbidden) {
			assert.ok(
				!formatted.includes(pii),
				`Attestation (${lang}) must not leak PII: ${pii}`,
			);
		}
	}
});

test("7. src/lib/session.js parity with src/lib/attendance.js for computeWeeklyPaceForecast and formatScholarshipAttestationText", () => {
	assert.equal(typeof sessionLib.computeWeeklyPaceForecast, "function");
	assert.equal(typeof sessionLib.formatScholarshipAttestationText, "function");

	const records = [
		{ pairIndex: 0, date: "2026-09-01", status: "held", durationHours: 2.0 },
		{ pairIndex: 0, date: "2026-09-08", status: "held", durationHours: 2.0 },
	];

	const forecastFromAttendance = attendance.computeWeeklyPaceForecast(
		records,
		0,
		30,
		8,
	);
	const forecastFromSession = sessionLib.computeWeeklyPaceForecast(
		records,
		0,
		30,
		8,
	);
	assert.deepEqual(forecastFromAttendance, forecastFromSession);

	const reportRow = {
		pairIndex: 0,
		heldSessions: 2,
		totalHours: 4,
		targetHours: 30,
		completionPercent: 13,
	};
	const textFromAttendance = attendance.formatScholarshipAttestationText(
		reportRow,
		forecastFromAttendance,
		"he",
	);
	const textFromSession = sessionLib.formatScholarshipAttestationText(
		reportRow,
		forecastFromSession,
		"he",
	);
	assert.equal(textFromAttendance, textFromSession);
});

test("8. UI: #remainingWeeksInput defaults to 8 and updates #paceForecastBadge dynamically on change", () => {
	const records = [
		{ pairIndex: 0, date: "2026-09-01", status: "held", durationHours: 2.0 },
		{ pairIndex: 0, date: "2026-09-08", status: "held", durationHours: 2.0 },
	];
	const $ = openApp({ store: createTestStore(records) });

	$("nav-sessions").fire("click");

	const weeksInput = $("remainingWeeksInput");
	assert.ok(weeksInput);
	assert.equal(weeksInput.getAttribute("type"), "number");
	assert.equal(weeksInput.value, "8");

	const badge = $("paceForecastBadge");
	assert.ok(badge);
	// 4 hours in 2 weeks -> pace 2.0 h/wk. With 8 weeks remaining -> 4 + 16 = 20 < 30 -> at_risk
	assert.ok(badge.textContent.includes("בסיכון ליעד"));
	assert.equal(badge.getAttribute("data-status"), "at_risk");

	// Change remaining weeks to 15: 4 + (2.0 * 15) = 34 >= 30 -> on_track
	weeksInput.value = "15";
	weeksInput.fire("input");
	assert.ok(badge.textContent.includes("במסלול להשלמה"));
	assert.equal(badge.getAttribute("data-status"), "on_track");

	// Change remaining weeks to 0: 4 + 0 = 4 < 30 -> at_risk
	weeksInput.value = "0";
	weeksInput.fire("change");
	assert.ok(badge.textContent.includes("בסיכון ליעד"));
	assert.equal(badge.getAttribute("data-status"), "at_risk");
});

test("9. UI: #paceForecastBadge reflects completed, on_track, and at_risk statuses based on attendance and #scholarshipTargetSelect", () => {
	// Pair 0 has 30 hours completed
	const records = [
		{ pairIndex: 0, date: "2026-09-01", status: "held", durationHours: 30 },
	];
	const $ = openApp({ store: createTestStore(records) });

	$("nav-sessions").fire("click");

	const badge = $("paceForecastBadge");
	assert.ok(badge);
	// At 30h target with 30h completed -> completed
	assert.equal(badge.getAttribute("data-status"), "completed");
	assert.ok(badge.textContent.includes("יעד הושלם"));

	// Change target to 130h: 30h < 130h, pace 30 h/wk, 8 weeks -> 30 + (30*8) = 270 >= 130 -> on_track
	$("scholarshipTargetSelect").value = "130";
	$("scholarshipTargetSelect").fire("change");
	assert.equal(badge.getAttribute("data-status"), "on_track");
	assert.ok(badge.textContent.includes("במסלול להשלמה"));

	// Change remaining weeks to 1: 30 + 30 = 60 < 130 -> at_risk
	$("remainingWeeksInput").value = "1";
	$("remainingWeeksInput").fire("input");
	assert.equal(badge.getAttribute("data-status"), "at_risk");
	assert.ok(badge.textContent.includes("בסיכון ליעד"));
});

test("10. UI: #copyAttestationBtn copies anonymous attestation to clipboard and updates #attestationStatus", () => {
	const records = [
		{ pairIndex: 0, date: "2026-09-01", status: "held", durationHours: 15 },
	];
	const $ = openApp({
		store: createTestStore(records),
		clipboard: "ok",
	});

	$("nav-sessions").fire("click");

	const btn = $("copyAttestationBtn");
	assert.ok(btn);
	assert.equal(btn.getAttribute("type"), "button");
	assert.equal(btn.getAttribute("aria-describedby"), "attestationStatus");

	const status = $("attestationStatus");
	assert.ok(status);
	assert.equal(status.textContent, "");

	btn.fire("click");

	assert.equal(status.textContent, "אישור הגשה אנונימי הועתק ללוח.");
	const copied = $.clipboard();
	assert.ok(copied);
	assert.ok(copied.includes("--- אישור שעות מלגה (אנונימי) ---"));
	assert.ok(copied.includes("מזהה זוג: #0"));
	assert.ok(copied.includes("שעות שבוצעו: 15 / 30 שעות"));
});

test("11. UI: trilingual support for attestation UI, badges, and buttons across he/ar/ru", () => {
	const records = [
		{ pairIndex: 0, date: "2026-09-01", status: "held", durationHours: 10 },
	];
	const $ = openApp({
		store: createTestStore(records),
		clipboard: "ok",
	});

	$("nav-sessions").fire("click");

	// Arabic
	$("langSelect").value = "ar";
	$("langSelect").fire("change");
	assert.equal($("copyAttestationBtn").textContent, "نسخ إفادة التقديم");
	assert.equal($("remainingWeeksLabel").textContent, "الأسابيع المتبقية");
	$("copyAttestationBtn").fire("click");
	assert.equal(
		$("attestationStatus").textContent,
		"تم نسخ إفادة التقديم إلى الحافظة.",
	);
	let copied = $.clipboard();
	assert.ok(copied.includes("--- إفادة ساعات المنحة (مجهولة الهوية) ---"));

	// Russian
	$("langSelect").value = "ru";
	$("langSelect").fire("change");
	assert.equal($("copyAttestationBtn").textContent, "Копировать подтверждение");
	assert.equal($("remainingWeeksLabel").textContent, "Осталось недель");
	$("copyAttestationBtn").fire("click");
	assert.equal(
		$("attestationStatus").textContent,
		"Анонимное подтверждение скопировано в буфер обмена.",
	);
	copied = $.clipboard();
	assert.ok(
		copied.includes("--- Подтверждение часов стипендии (анонимное) ---"),
	);

	// Hebrew
	$("langSelect").value = "he";
	$("langSelect").fire("change");
	assert.equal($("copyAttestationBtn").textContent, "העתקת אישור הגשה");
	assert.equal($("remainingWeeksLabel").textContent, "שבועות נותרים");
	$("copyAttestationBtn").fire("click");
	assert.equal(
		$("attestationStatus").textContent,
		"אישור הגשה אנונימי הועתק ללוח.",
	);
});
