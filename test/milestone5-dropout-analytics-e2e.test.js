const test = require("node:test");
const assert = require("node:assert/strict");
const { detectInactivePairs } = require("../src/lib/attendance.js");
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

// 1. זיהוי זוגות מתחת לסף held
test("detectInactivePairs identifies pairs below held threshold with default and custom options", () => {
	const pairs = [{ pairIndex: 0 }, { pairIndex: 1 }, { pairIndex: 2 }];
	const records = [
		// Pair 0: 0 held sessions
		{ pairIndex: 0, date: "2026-09-01", status: "missed" },
		// Pair 1: 1 held session
		{ pairIndex: 1, date: "2026-09-01", status: "held" },
		// Pair 2: 2 held sessions
		{ pairIndex: 2, date: "2026-09-01", status: "held" },
		{ pairIndex: 2, date: "2026-09-08", status: "held" },
	];

	// Default threshold: 2
	const defaultResult = detectInactivePairs(records, pairs);
	assert.equal(defaultResult.length, 2);
	const p0 = defaultResult.find((p) => p.pairIndex === 0);
	const p1 = defaultResult.find((p) => p.pairIndex === 1);
	const p2 = defaultResult.find((p) => p.pairIndex === 2);

	assert.ok(p0, "Pair 0 should be at risk");
	assert.equal(p0.heldCount, 0);
	assert.equal(p0.missedOrCancelledCount, 1);
	assert.match(p0.riskReason, /מתחת לסף מפגשים/);

	assert.ok(p1, "Pair 1 should be at risk");
	assert.equal(p1.heldCount, 1);
	assert.equal(p1.missedOrCancelledCount, 0);
	assert.match(p1.riskReason, /מתחת לסף מפגשים/);

	assert.equal(
		p2,
		undefined,
		"Pair 2 met threshold 2 so should not be at risk",
	);

	// Custom threshold as number: 1
	const threshold1Result = detectInactivePairs(records, pairs, 1);
	assert.equal(threshold1Result.length, 1);
	assert.equal(threshold1Result[0].pairIndex, 0);

	// Custom threshold in options object: 3
	const threshold3Result = detectInactivePairs(records, pairs, {
		minHeldCount: 3,
	});
	assert.equal(threshold3Result.length, 3);
	assert.ok(threshold3Result.some((p) => p.pairIndex === 2));
});

// 2. זיהוי רצף ביטולים/החמצות
test("detectInactivePairs identifies pairs with cancellation or missed streaks even when meeting held threshold", () => {
	const pairs = [{ pairIndex: 0 }, { pairIndex: 1 }];
	const records = [
		// Pair 0: meets threshold (2 held), but has 2 consecutive cancellations/misses
		{ pairIndex: 0, date: "2026-09-01", status: "held" },
		{ pairIndex: 0, date: "2026-09-08", status: "held" },
		{ pairIndex: 0, date: "2026-09-15", status: "cancelled" },
		{ pairIndex: 0, date: "2026-09-22", status: "missed" },
		// Pair 1: meets threshold (2 held), only 1 cancellation (no streak >= 2)
		{ pairIndex: 1, date: "2026-09-01", status: "held" },
		{ pairIndex: 1, date: "2026-09-08", status: "held" },
		{ pairIndex: 1, date: "2026-09-15", status: "cancelled" },
	];

	const result = detectInactivePairs(records, pairs, { minHeldCount: 2 });
	assert.equal(result.length, 1);
	assert.equal(result[0].pairIndex, 0);
	assert.equal(result[0].heldCount, 2);
	assert.equal(result[0].missedOrCancelledCount, 2);
	assert.match(result[0].riskReason, /רצף ביטולים או החמצות/);
});

// 3. מיון לפי סיכון מהגבוה לנמוך
test("detectInactivePairs sorts pairs from highest to lowest risk with deterministic tie-break", () => {
	const pairs = [
		{ pairIndex: 0 },
		{ pairIndex: 1 },
		{ pairIndex: 2 },
		{ pairIndex: 3 },
	];
	const records = [
		// Pair 0: 0 held sessions + 2 missed (highest risk)
		{ pairIndex: 0, date: "2026-09-01", status: "missed" },
		{ pairIndex: 0, date: "2026-09-08", status: "missed" },
		// Pair 1: 0 held sessions + 0 missed (high risk)
		// Pair 2: 1 held session + 0 missed (moderate risk)
		{ pairIndex: 2, date: "2026-09-01", status: "held" },
		// Pair 3: 2 held sessions + 2 cancellations streak (streak risk)
		{ pairIndex: 3, date: "2026-09-01", status: "held" },
		{ pairIndex: 3, date: "2026-09-08", status: "held" },
		{ pairIndex: 3, date: "2026-09-15", status: "cancelled" },
		{ pairIndex: 3, date: "2026-09-22", status: "cancelled" },
	];

	const sorted = detectInactivePairs(records, pairs, { minHeldCount: 2 });
	assert.equal(sorted.length, 4);
	assert.equal(
		sorted[0].pairIndex,
		0,
		"Pair 0 should be rank 1 (held 0 + missed 2)",
	);
	assert.equal(
		sorted[1].pairIndex,
		1,
		"Pair 1 should be rank 2 (held 0 + missed 0)",
	);
	assert.equal(sorted[2].pairIndex, 2, "Pair 2 should be rank 3 (held 1)");
	assert.equal(
		sorted[3].pairIndex,
		3,
		"Pair 3 should be rank 4 (held 2 + streak 2)",
	);

	// Deterministic tie-break by pairIndex ascending when identical stats
	const tiePairs = [{ pairIndex: 5 }, { pairIndex: 2 }];
	const tieResult = detectInactivePairs([], tiePairs, 2);
	assert.equal(tieResult[0].pairIndex, 2);
	assert.equal(tieResult[1].pairIndex, 5);
});

// 4. טיפול בקלט ריק
test("detectInactivePairs safely handles empty, null, undefined and invalid inputs", () => {
	assert.deepEqual(detectInactivePairs([], []), []);
	assert.deepEqual(detectInactivePairs(null, null), []);
	assert.deepEqual(detectInactivePairs(undefined, undefined), []);
	assert.deepEqual(detectInactivePairs({}, {}), []);
	assert.deepEqual(detectInactivePairs("bad", 123), []);

	// Records passed as { entries: [...] }
	const entriesObject = {
		entries: [{ pairIndex: 0, date: "2026-09-01", status: "held" }],
	};
	const fromEntries = detectInactivePairs(entriesObject, [{ pairIndex: 0 }], 2);
	assert.equal(fromEntries.length, 1);
	assert.equal(fromEntries[0].heldCount, 1);

	// Pair objects without explicit pairIndex use array index
	const fallbackPairIdx = detectInactivePairs([], [{}], 2);
	assert.equal(fallbackPairIdx.length, 1);
	assert.equal(fallbackPairIdx[0].pairIndex, 0);

	// Records with invalid pairIndex or invalid object shape are ignored
	const malformedRecords = [
		null,
		undefined,
		"invalid",
		{ pairIndex: -1, status: "held" },
		{ pairIndex: "abc", status: "held" },
		{ pairIndex: 0, status: "unknown_status" },
	];
	const res = detectInactivePairs(malformedRecords, [{ pairIndex: 0 }], 2);
	assert.equal(res.length, 1);
	assert.equal(res[0].pairIndex, 0);
	assert.equal(res[0].heldCount, 0);
});

// 5. רינדור #dropoutRiskList ו-#dropoutRiskCount ב-#tab-guide
test("UI renders #dropoutRiskList and #dropoutRiskCount in #tab-guide", () => {
	const $ = openApp();
	setupTestPairAndUnit($);

	$("nav-guide").fire("click");

	const card = $("dropoutRiskCard");
	assert.ok(card, "#dropoutRiskCard should exist in DOM");

	const select = $("dropoutThresholdSelect");
	assert.ok(select, "#dropoutThresholdSelect should exist");
	assert.equal(select.value, "2", "Default threshold should be 2");

	const count = $("dropoutRiskCount");
	assert.ok(count, "#dropoutRiskCount should exist");
	assert.equal(
		count.textContent,
		"1",
		"Should count 1 pair at risk (held 0 < 2)",
	);

	const list = $("dropoutRiskList");
	assert.ok(list, "#dropoutRiskList should exist");
	assert.match(list.innerHTML, /dropout-risk-item/);
	assert.match(list.innerHTML, /זוג 1/);
	assert.match(list.innerHTML, /מפגשים שהתקיימו/);
	assert.match(list.innerHTML, /החמצות וביטולים/);
	assert.match(list.innerHTML, /סיבת סיכון/);
});

// 6. שינוי סף ב-#dropoutThresholdSelect
test("UI dynamically updates #dropoutRiskList and #dropoutRiskCount when #dropoutThresholdSelect changes", () => {
	const $ = openApp();
	const unitId = setupTestPairAndUnit($);

	// Log 1 held session for Pair 0
	$("nav-sessions").fire("click");
	$("sessionSlot").value = "SUN_16";
	$("sessionSubject").value = "MATH";
	$("sessionUnit").value = unitId;
	$("sessionOutcome").value = "held";
	$("logSession").fire("click");

	$("nav-guide").fire("click");

	// At default threshold 2: pair has 1 held session < 2, so count is 1
	assert.equal($("dropoutRiskCount").textContent, "1");

	// Change threshold to 1: pair meets threshold 1!
	$("dropoutThresholdSelect").value = "1";
	$("dropoutThresholdSelect").fire("change");

	assert.equal($("dropoutRiskCount").textContent, "0");
	assert.match($("dropoutRiskList").innerHTML, /אין כרגע זוגות בסיכון נשירה/);

	// Change threshold to 3: pair has 1 held session < 3 -> at risk again!
	$("dropoutThresholdSelect").value = "3";
	$("dropoutThresholdSelect").fire("change");

	assert.equal($("dropoutRiskCount").textContent, "1");
	assert.match($("dropoutRiskList").innerHTML, /זוג 1/);
});

// 7. תרגום he/ar/ru
test("multilingual translations for Hebrew, Arabic, and Russian in logic and UI", () => {
	const pairs = [{ pairIndex: 0 }];
	const recordsBelowOnly = [
		{ pairIndex: 0, date: "2026-09-01", status: "held" },
	];
	const recordsBelowAndStreak = [
		{ pairIndex: 0, date: "2026-09-01", status: "held" },
		{ pairIndex: 0, date: "2026-09-08", status: "missed" },
		{ pairIndex: 0, date: "2026-09-15", status: "cancelled" },
	];
	const recordsStreakOnly = [
		{ pairIndex: 0, date: "2026-09-01", status: "held" },
		{ pairIndex: 0, date: "2026-09-08", status: "held" },
		{ pairIndex: 0, date: "2026-09-15", status: "missed" },
		{ pairIndex: 0, date: "2026-09-22", status: "cancelled" },
	];

	// Logic translations - Hebrew
	const resHeBelow = detectInactivePairs(recordsBelowOnly, pairs, {
		minHeldCount: 2,
		lang: "he",
	});
	assert.match(resHeBelow[0].riskReason, /מתחת לסף מפגשים שהתקיימו/);

	const resHeBoth = detectInactivePairs(recordsBelowAndStreak, pairs, {
		minHeldCount: 2,
		lang: "he",
	});
	assert.match(
		resHeBoth[0].riskReason,
		/מתחת לסף מפגשים \(1\/2\) ורצף ביטולים\/החמצות \(2\)/,
	);

	const resHeStreak = detectInactivePairs(recordsStreakOnly, pairs, {
		minHeldCount: 2,
		lang: "he",
	});
	assert.match(resHeStreak[0].riskReason, /רצף ביטולים או החמצות \(2 ברצף\)/);

	// Logic translations - Arabic
	const resArBelow = detectInactivePairs(recordsBelowOnly, pairs, {
		minHeldCount: 2,
		lang: "ar",
	});
	assert.match(
		resArBelow[0].riskReason,
		/أقل من الحد الأدنى للجلسات \(1 من 2\)/,
	);

	const resArBoth = detectInactivePairs(recordsBelowAndStreak, pairs, {
		minHeldCount: 2,
		lang: "ar",
	});
	assert.match(
		resArBoth[0].riskReason,
		/أقل من الحد الأدنى للجلسات \(1\/2\) وتتالي الإلغاءات\/الغياب \(2\)/,
	);

	const resArStreak = detectInactivePairs(recordsStreakOnly, pairs, {
		minHeldCount: 2,
		lang: "ar",
	});
	assert.match(
		resArStreak[0].riskReason,
		/تتالي الإلغاءات أو الغياب \(2 متتالية\)/,
	);

	// Logic translations - Russian
	const resRuBelow = detectInactivePairs(recordsBelowOnly, pairs, {
		minHeldCount: 2,
		lang: "ru",
	});
	assert.match(
		resRuBelow[0].riskReason,
		/Ниже порога проведенных занятий \(1 из 2\)/,
	);

	const resRuBoth = detectInactivePairs(recordsBelowAndStreak, pairs, {
		minHeldCount: 2,
		lang: "ru",
	});
	assert.match(
		resRuBoth[0].riskReason,
		/Ниже порога занятий \(1\/2\) и серия отмен\/пропусков \(2\)/,
	);

	const resRuStreak = detectInactivePairs(recordsStreakOnly, pairs, {
		minHeldCount: 2,
		lang: "ru",
	});
	assert.match(
		resRuStreak[0].riskReason,
		/Серия отмен или пропусков \(2 подряд\)/,
	);

	// UI translations
	const $ = openApp();
	setupTestPairAndUnit($);
	$("nav-guide").fire("click");

	// Hebrew check
	assert.equal($("dropoutRiskHeading").textContent, "זוגות בסיכון נשירה");
	assert.equal($("dropoutThresholdLabel").textContent, "סף מינימום מפגשים");
	assert.equal($("dropoutRiskCountLabel").textContent, "התראות פעילות");

	// Switch to Arabic
	$("langSelect").value = "ar";
	$("langSelect").fire("change");

	assert.equal(
		$("dropoutRiskHeading").textContent,
		"الأزواج المعرضون لخطر التسرب",
	);
	assert.equal($("dropoutThresholdLabel").textContent, "الحد الأدنى للجلسات");
	assert.equal($("dropoutRiskCountLabel").textContent, "التنبيهات النشطة");
	assert.match($("dropoutRiskList").innerHTML, /الزوج 1/);
	assert.match($("dropoutRiskList").innerHTML, /اللقاءات المنعقدة/);
	assert.match($("dropoutRiskList").innerHTML, /إلغاءات وغياب/);
	assert.match($("dropoutRiskList").innerHTML, /سبب الخطر/);

	// Switch to Russian
	$("langSelect").value = "ru";
	$("langSelect").fire("change");

	assert.equal(
		$("dropoutRiskHeading").textContent,
		"Пары в группе риска отсева",
	);
	assert.equal(
		$("dropoutThresholdLabel").textContent,
		"Минимальный порог занятий",
	);
	assert.equal($("dropoutRiskCountLabel").textContent, "Активные оповещения");
	assert.match($("dropoutRiskList").innerHTML, /Пара 1/);
	assert.match($("dropoutRiskList").innerHTML, /Проведено занятий/);
	assert.match($("dropoutRiskList").innerHTML, /Отмен и пропусков/);
	assert.match($("dropoutRiskList").innerHTML, /Причина риска/);
});

// 8. אפס PII בלוגיקה וב-DOM (Zero PII)
test("Zero PII: no personal identifiable information is exposed in logic or rendered DOM", () => {
	const pairs = [
		{
			pairIndex: 0,
			student: 1,
			pupil: 2,
			name: "SecretName",
			phone: "050-1234567",
			email: "user@example.com",
		},
	];
	const records = [
		{
			pairIndex: 0,
			date: "2026-09-01",
			status: "missed",
			studentName: "SecretStudent",
		},
	];

	const result = detectInactivePairs(records, pairs, 2);
	assert.equal(result.length, 1);
	const keys = Object.keys(result[0]).sort();
	assert.deepEqual(keys, [
		"heldCount",
		"missedOrCancelledCount",
		"pairIndex",
		"riskReason",
	]);
	assert.equal(result[0].name, undefined);
	assert.equal(result[0].phone, undefined);
	assert.equal(result[0].email, undefined);
	assert.equal(result[0].studentName, undefined);

	// UI zero PII check
	const $ = openApp();
	setupTestPairAndUnit($);
	$("nav-guide").fire("click");

	const listHtml = $("dropoutRiskList").innerHTML;
	assert.equal(
		/05\d-?\d{7}/.test(listHtml),
		false,
		"Must not contain phone numbers",
	);
	assert.equal(/@/.test(listHtml), false, "Must not contain emails");
	assert.equal(
		/student|pupil|name/i.test(listHtml),
		false,
		"Must not expose internal roles or names",
	);
});

// 9. עדכון אוטומטי של הרשימה והמונה בעת שינוי נוכחות
test("UI updates dynamically on attendance recording changes without page reload", () => {
	const $ = openApp();
	const unitId = setupTestPairAndUnit($);

	$("nav-guide").fire("click");
	$("dropoutThresholdSelect").value = "1";
	$("dropoutThresholdSelect").fire("change");

	// Initial: 0 held sessions, threshold 1 -> count is 1
	assert.equal($("dropoutRiskCount").textContent, "1");

	// Log held session through UI
	$("nav-sessions").fire("click");
	$("sessionSlot").value = "SUN_16";
	$("sessionSubject").value = "MATH";
	$("sessionUnit").value = unitId;
	$("sessionOutcome").value = "held";
	$("logSession").fire("click");

	$("nav-guide").fire("click");
	// Pair now has 1 held session >= threshold 1 -> count updates to 0!
	assert.equal($("dropoutRiskCount").textContent, "0");
	assert.match($("dropoutRiskList").innerHTML, /אין כרגע זוגות בסיכון נשירה/);

	// Overwrite today's session with 'missed' outcome through UI
	$("nav-sessions").fire("click");
	$("sessionOutcome").value = "missed";
	$("logSession").fire("click");

	$("nav-guide").fire("click");
	// Pair now has 0 held sessions < threshold 1 -> count updates back to 1!
	assert.equal($("dropoutRiskCount").textContent, "1");
	assert.match($("dropoutRiskList").innerHTML, /מתחת לסף מפגשים/);
});
