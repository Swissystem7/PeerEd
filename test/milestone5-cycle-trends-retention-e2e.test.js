const test = require("node:test");
const assert = require("node:assert/strict");
const {
	compareArchiveCycles,
	computeMentorRetentionStats,
} = require("../src/lib/attendance.js");
const storeLib = require("../src/lib/store.js");
const { findPersonalData } = require("../src/lib/validator.js");
const { openApp } = require("../test-support/fake-dom.js");

// 1. חישוב דלתות בין מחזורים (peopleDelta, pairsDelta, hoursDelta, completionRateDelta)
test("1. compareArchiveCycles accurately calculates cycle deltas for growth and decrease", () => {
	const previousArchives = [
		{
			peopleCount: 15,
			pairsCount: 7,
			totalHours: 140,
			completionRate: 65,
		},
		{
			peopleCount: 20,
			pairsCount: 10,
			totalHours: 200,
			completionRate: 70,
		},
	];

	// Current cycle with positive growth compared to previous cycle (the 2nd archive)
	const currentGrowing = {
		peopleCount: 26,
		pairsCount: 13,
		totalHours: 275.5,
		completionRate: 85,
	};

	const deltaGrowth = compareArchiveCycles(previousArchives, currentGrowing);
	assert.equal(deltaGrowth.hasPrevious, true);
	assert.equal(deltaGrowth.peopleDelta, 6, "peopleDelta should be 26 - 20 = 6");
	assert.equal(deltaGrowth.pairsDelta, 3, "pairsDelta should be 13 - 10 = 3");
	assert.equal(
		deltaGrowth.hoursDelta,
		75.5,
		"hoursDelta should be 275.5 - 200 = 75.5",
	);
	assert.equal(
		deltaGrowth.completionRateDelta,
		15,
		"completionRateDelta should be 85 - 70 = 15",
	);

	// Current cycle with decrease compared to previous cycle
	const currentDecreasing = {
		peopleCount: 16,
		pairsCount: 8,
		totalHours: 150,
		completionRate: 60,
	};

	const deltaDecrease = compareArchiveCycles(
		previousArchives,
		currentDecreasing,
	);
	assert.equal(deltaDecrease.hasPrevious, true);
	assert.equal(
		deltaDecrease.peopleDelta,
		-4,
		"peopleDelta should be 16 - 20 = -4",
	);
	assert.equal(
		deltaDecrease.pairsDelta,
		-2,
		"pairsDelta should be 8 - 10 = -2",
	);
	assert.equal(
		deltaDecrease.hoursDelta,
		-50,
		"hoursDelta should be 150 - 200 = -50",
	);
	assert.equal(
		deltaDecrease.completionRateDelta,
		-10,
		"completionRateDelta should be 60 - 70 = -10",
	);
});

// 2. חישוב שיעור שימור מדריכים על בסיס מזהים אנונימיים בלבד
test("2. computeMentorRetentionStats accurately calculates retention rate and counts based on anonymous IDs", () => {
	const archives = [
		{
			people: [
				{ id: "m-001", role: "student", region: "CENTER" },
				{ id: "m-002", role: "student", region: "NORTH" },
				{ id: "m-003", role: "student", region: "SOUTH" },
				{ id: "m-004", role: "student", region: "HAIFA" },
				{ id: "pupil-001", role: "pupil", region: "CENTER" },
			],
		},
	];

	// Current cycle: m-001 and m-003 returned (2 out of 4 mentors retained = 50%), plus m-005 is a new mentor
	const currentPeople = [
		{ id: "m-001", role: "student", region: "CENTER" },
		{ id: "m-003", role: "student", region: "SOUTH" },
		{ id: "m-005", role: "student", region: "TEL_AVIV" },
		{ id: "pupil-002", role: "pupil", region: "SOUTH" },
	];

	const stats = computeMentorRetentionStats(archives, currentPeople);
	assert.equal(
		stats.previousMentorsCount,
		4,
		"Previous mentors count should ignore pupils",
	);
	assert.equal(
		stats.currentMentorsCount,
		3,
		"Current mentors count should ignore pupils",
	);
	assert.equal(stats.retainedCount, 2, "Retained mentors count should be 2");
	assert.equal(stats.newMentorsCount, 1, "New mentors count should be 1");
	assert.equal(
		stats.retentionRate,
		50,
		"Retention rate should be Math.round(2 / 4 * 100) = 50",
	);
	assert.equal(stats.retentionPercent, 50);
	assert.equal(stats.retentionRatio, 0.5);
	assert.deepEqual(stats.retainedMentorKeys, ["m-001", "m-003"]);
});

// 3. עמידות כשאין ארכיונים קודמים (missing, null, empty array, non-array)
test("3. compareArchiveCycles and computeMentorRetentionStats handle empty or missing archives safely", () => {
	const current = {
		peopleCount: 10,
		pairsCount: 5,
		totalHours: 120,
		completionRate: 80,
		people: [
			{ id: "m-101", role: "student" },
			{ id: "m-102", role: "student" },
		],
	};

	// Test variations of missing / empty archives: null, undefined, empty array, non-array object
	const cases = [null, undefined, [], {}];

	for (const emptyArchive of cases) {
		const delta = compareArchiveCycles(emptyArchive, current);
		assert.equal(delta.hasPrevious, false);
		assert.equal(delta.peopleDelta, 0, "peopleDelta should safely be 0");
		assert.equal(delta.pairsDelta, 0, "pairsDelta should safely be 0");
		assert.equal(delta.hoursDelta, 0, "hoursDelta should safely be 0");
		assert.equal(
			delta.completionRateDelta,
			0,
			"completionRateDelta should safely be 0",
		);

		const retention = computeMentorRetentionStats(emptyArchive, current.people);
		assert.equal(retention.previousMentorsCount, 0);
		assert.equal(retention.retainedCount, 0);
		assert.equal(retention.retentionRate, 0);
		assert.equal(retention.retentionRatio, 0);
		assert.deepEqual(retention.retainedMentorKeys, []);
	}
});

// 4. תצוגת הכרטיס ב-#tab-guide: #cycleTrendsOut ו-#mentorRetentionBadge
test("4. #tab-guide renders #cycleTrendsCard, #cycleTrendsOut and #mentorRetentionBadge", () => {
	const $ = openApp();
	$("nav-guide").fire("click");

	const card = $("cycleTrendsCard");
	assert.ok(card, "#cycleTrendsCard must exist in DOM");

	const out = $("cycleTrendsOut");
	assert.ok(out, "#cycleTrendsOut must exist in DOM");
	assert.equal(out.getAttribute("role"), "region");
	assert.equal(out.getAttribute("aria-live"), "polite");

	const badge = $("mentorRetentionBadge");
	assert.ok(badge, "#mentorRetentionBadge must exist in DOM");
	assert.match(badge.textContent, /שימור מדריכים/);

	const btn = $("refreshCycleTrendsBtn");
	assert.ok(btn, "#refreshCycleTrendsBtn must exist");
	assert.equal(btn.getAttribute("type"), "button");
	assert.equal(btn.getAttribute("aria-describedby"), "cycleTrendsStatus");

	const status = $("cycleTrendsStatus");
	assert.ok(status, "#cycleTrendsStatus element must exist");
	assert.equal(status.getAttribute("role"), "status");
});

// 5. עדכון #cycleTrendsOut ו-#mentorRetentionBadge עם נתוני מחזורים
test("5. #cycleTrendsOut and #mentorRetentionBadge update with accurate metrics and attributes", () => {
	const $ = openApp();
	$("nav-guide").fire("click");

	const archives = [
		{
			peopleCount: 12,
			pairsCount: 6,
			totalHours: 100,
			completionRate: 60,
			people: [
				{ id: "m-01", role: "student" },
				{ id: "m-02", role: "student" },
			],
		},
	];
	const current = {
		peopleCount: 16,
		pairsCount: 8,
		totalHours: 160,
		completionRate: 80,
		people: [
			{ id: "m-01", role: "student" },
			{ id: "m-03", role: "student" },
		],
	};

	// Supply archives and current cycle to the card
	const card = $("cycleTrendsCard");
	card.archives = archives;
	card.currentSnapshot = current;

	// Render cycle trends
	if (typeof card.renderCycleTrends === "function") {
		card.renderCycleTrends(archives, current);
	}

	const out = $("cycleTrendsOut");
	assert.equal(out.getAttribute("data-people-delta"), "4");
	assert.equal(out.getAttribute("data-pairs-delta"), "2");
	assert.equal(out.getAttribute("data-hours-delta"), "60");
	assert.equal(out.getAttribute("data-completion-delta"), "20");
	assert.equal(out.getAttribute("data-retention-rate"), "50");
	assert.equal(out.getAttribute("data-has-previous"), "true");

	const badge = $("mentorRetentionBadge");
	assert.equal(badge.getAttribute("data-rate"), "50");
	assert.match(badge.textContent, /50%/);
});

// 6. לחיצה על #refreshCycleTrendsBtn מעדכנת את #cycleTrendsStatus
test("6. clicking #refreshCycleTrendsBtn triggers refresh and updates #cycleTrendsStatus", () => {
	const $ = openApp();
	$("nav-guide").fire("click");

	const btn = $("refreshCycleTrendsBtn");
	const status = $("cycleTrendsStatus");

	// Initial status is empty
	assert.equal(status.textContent, "");

	// Click refresh button
	btn.fire("click");

	// Status line is updated in Hebrew
	assert.match(status.textContent, /עודכנו בהצלחה/);
});

// 7. תרגום he/ar/ru של כפתור הרענון, תגית השימור והסטטוס
test("7. supports seamless translations across he, ar, and ru for status and labels", () => {
	const $ = openApp();
	$("nav-guide").fire("click");

	// Hebrew check
	$("refreshCycleTrendsBtn").fire("click");
	assert.match($("cycleTrendsStatus").textContent, /עודכנו בהצלחה/);
	assert.match($("mentorRetentionBadge").textContent, /שימור מדריכים/);
	assert.match($("refreshCycleTrendsBtn").textContent, /רענן מגמות/);

	// Arabic switch
	$("langSelect").value = "ar";
	$("langSelect").fire("change");
	$("refreshCycleTrendsBtn").fire("click");
	assert.match($("cycleTrendsStatus").textContent, /تم تحديث بيانات الاتجاهات/);
	assert.match($("mentorRetentionBadge").textContent, /استبقاء المرشدين/);
	assert.match($("refreshCycleTrendsBtn").textContent, /تحديث الاتجاهات/);

	// Russian switch
	$("langSelect").value = "ru";
	$("langSelect").fire("change");
	$("refreshCycleTrendsBtn").fire("click");
	assert.match($("cycleTrendsStatus").textContent, /успешно обновлены/);
	assert.match($("mentorRetentionBadge").textContent, /Удержание наставников/);
	assert.match($("refreshCycleTrendsBtn").textContent, /Обновить тренды/);
});

// 8. בדיקת אפס PII בכל התוצרים, החישובים, והטקסטים
test("8. enforces zero PII across calculations, retention keys, and rendered HTML output", () => {
	const $ = openApp();
	$("nav-guide").fire("click");

	const archives = [
		{
			people: [
				{ id: "anon-mentor-1", role: "student" },
				{ id: "anon-mentor-2", role: "student" },
			],
		},
	];
	const current = [
		{ id: "anon-mentor-1", role: "student" },
		{ id: "anon-mentor-3", role: "student" },
	];

	const stats = computeMentorRetentionStats(archives, current);

	// Zero PII in returned object
	const piiInKeys = findPersonalData(stats.retainedMentorKeys.join(" "));
	assert.equal(piiInKeys.length, 0, "No personal data in retained mentor keys");

	// Zero PII in rendered HTML
	const outHtml = $("cycleTrendsOut").innerHTML;
	const piiInHtml = findPersonalData(outHtml);
	assert.equal(piiInHtml.length, 0, "No personal data in rendered trends HTML");

	const statusText = $("cycleTrendsStatus").textContent;
	const piiInStatus = findPersonalData(statusText);
	assert.equal(piiInStatus.length, 0, "No personal data in status message");

	// Rejection when explicit PII string (Israeli phone, email, or Israeli 9-digit ID) is present
	assert.throws(
		() => {
			computeMentorRetentionStats(archives, [
				{ id: "050-1234567", role: "student" },
			]);
		},
		/personal data/,
		"Should reject Israeli phone number",
	);

	assert.throws(
		() => {
			computeMentorRetentionStats(archives, [
				{ id: "test@example.com", role: "student" },
			]);
		},
		/personal data/,
		"Should reject email address",
	);

	assert.throws(
		() => {
			computeMentorRetentionStats(archives, [
				{ id: "123456789", role: "student" },
			]);
		},
		/personal data/,
		"Should reject 9-digit Israeli ID number",
	);
});

// 9. ייצוא ותאימות בין attendance.js ל-store.js
test("9. store module properly re-exports compareArchiveCycles and computeMentorRetentionStats", () => {
	assert.equal(typeof storeLib.compareArchiveCycles, "function");
	assert.equal(typeof storeLib.computeMentorRetentionStats, "function");

	const archives = [
		{
			peopleCount: 10,
			pairsCount: 5,
			totalHours: 50,
			completionRate: 50,
			people: [{ id: "m-1", role: "student" }],
		},
	];
	const current = {
		peopleCount: 12,
		pairsCount: 6,
		totalHours: 70,
		completionRate: 60,
		people: [{ id: "m-1", role: "student" }],
	};

	const delta = storeLib.compareArchiveCycles(archives, current);
	assert.equal(delta.peopleDelta, 2);
	assert.equal(delta.pairsDelta, 1);
	assert.equal(delta.hoursDelta, 20);
	assert.equal(delta.completionRateDelta, 10);

	const retention = storeLib.computeMentorRetentionStats(
		archives,
		current.people,
	);
	assert.equal(retention.retentionRate, 100);
});

// 10. כיסוי מלא של תצורות snapshot, מזהים מספריים ועטיפות אובייקטים
test("10. supports flexible snapshot schemas, numeric IDs, and object containers", () => {
	// Snapshot using hours and completionPercent, plus people/pairs arrays
	const prevSnapshot = {
		people: [
			{ id: 101, role: "student" },
			{ id: 102, role: "student" },
		],
		pairs: [{ mentorId: 101, pupilId: "p1" }],
		hours: 45.5,
		completionPercent: 55,
	};
	const currentSnapshot = {
		people: [
			{ id: 101, role: "student" },
			{ id: 103, role: "student" },
			{ id: 999, role: "other" },
			null,
		],
		pairs: [
			{ mentorId: 101, pupilId: "p1" },
			{ mentorId: 103, pupilId: "p2" },
		],
		hours: 90.5,
		completionPercent: 85,
	};

	// Passing archives as a single object (not an array)
	const delta = compareArchiveCycles(prevSnapshot, currentSnapshot);
	assert.equal(delta.hasPrevious, true);
	assert.equal(delta.peopleDelta, 2);
	assert.equal(delta.pairsDelta, 1);
	assert.equal(delta.hoursDelta, 45);
	assert.equal(delta.completionRateDelta, 30);

	// Both archives and currentPeople as objects with .people property
	const retention = computeMentorRetentionStats(
		{ people: prevSnapshot.people },
		{ people: currentSnapshot.people },
	);
	assert.equal(retention.previousMentorsCount, 2);
	assert.equal(retention.currentMentorsCount, 2);
	assert.equal(retention.retainedCount, 1);
	assert.equal(retention.retentionRate, 50);
	assert.deepEqual(retention.retainedMentorKeys, ["101"]);

	// Handle null / non-object snapshot
	const nullDelta = compareArchiveCycles(null, null);
	assert.equal(nullDelta.hasPrevious, false);
	assert.equal(nullDelta.peopleDelta, 0);
	assert.equal(nullDelta.current.people, 0);
});
