const test = require("node:test");
const assert = require("node:assert/strict");
const attendance = require("../src/lib/attendance.js");
const approval = require("../src/lib/approval.js");
const { PERSONAL_DATA_ERROR } = require("../src/lib/profile.js");
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

test("1. computeScholarshipMilestones computes 4 checkpoints (25%, 50%, 75%, 100%) for 30 hours target", () => {
	const pairs = [{ pairIndex: 0 }];

	// 0 hours
	let m = attendance.computeScholarshipMilestones([], pairs, 30);
	assert.equal(m.length, 1);
	assert.equal(m[0].pairIndex, 0);
	assert.equal(m[0].targetHours, 30);
	assert.equal(m[0].totalHours, 0);
	assert.equal(m[0].reached25, false);
	assert.equal(m[0].reached50, false);
	assert.equal(m[0].reached75, false);
	assert.equal(m[0].reached100, false);
	assert.equal(m[0].nextMilestoneHours, 7.5);

	// 7.5 hours (25%)
	const records25 = [
		{ pairIndex: 0, date: "2026-09-01", status: "held", durationHours: 7.5 },
	];
	m = attendance.computeScholarshipMilestones(records25, pairs, 30);
	assert.equal(m[0].reached25, true);
	assert.equal(m[0].reached50, false);
	assert.equal(m[0].reached75, false);
	assert.equal(m[0].reached100, false);
	assert.equal(m[0].nextMilestoneHours, 15);

	// 15 hours (50%)
	const records50 = [
		{ pairIndex: 0, date: "2026-09-01", status: "held", durationHours: 15.0 },
	];
	m = attendance.computeScholarshipMilestones(records50, pairs, 30);
	assert.equal(m[0].reached25, true);
	assert.equal(m[0].reached50, true);
	assert.equal(m[0].reached75, false);
	assert.equal(m[0].reached100, false);
	assert.equal(m[0].nextMilestoneHours, 22.5);

	// 22.5 hours (75%)
	const records75 = [
		{ pairIndex: 0, date: "2026-09-01", status: "held", durationHours: 22.5 },
	];
	m = attendance.computeScholarshipMilestones(records75, pairs, 30);
	assert.equal(m[0].reached25, true);
	assert.equal(m[0].reached50, true);
	assert.equal(m[0].reached75, true);
	assert.equal(m[0].reached100, false);
	assert.equal(m[0].nextMilestoneHours, 30);

	// 30 hours (100%)
	const records100 = [
		{ pairIndex: 0, date: "2026-09-01", status: "held", durationHours: 30.0 },
	];
	m = attendance.computeScholarshipMilestones(records100, pairs, 30);
	assert.equal(m[0].reached25, true);
	assert.equal(m[0].reached50, true);
	assert.equal(m[0].reached75, true);
	assert.equal(m[0].reached100, true);
	assert.equal(m[0].nextMilestoneHours, 30);
});

test("2. computeScholarshipMilestones computes 4 checkpoints for 130 hours target (IMPACT! scholarship)", () => {
	const pairs = [{ pairIndex: 0 }];

	// 32.5 hours (25% of 130)
	const records25 = [
		{ pairIndex: 0, date: "2026-09-01", status: "held", durationHours: 32.5 },
	];
	let m = attendance.computeScholarshipMilestones(records25, pairs, 130);
	assert.equal(m[0].targetHours, 130);
	assert.equal(m[0].reached25, true);
	assert.equal(m[0].reached50, false);
	assert.equal(m[0].nextMilestoneHours, 65);

	// 65 hours (50% of 130)
	const records50 = [
		{ pairIndex: 0, date: "2026-09-01", status: "held", durationHours: 65.0 },
	];
	m = attendance.computeScholarshipMilestones(records50, pairs, 130);
	assert.equal(m[0].reached25, true);
	assert.equal(m[0].reached50, true);
	assert.equal(m[0].reached75, false);
	assert.equal(m[0].nextMilestoneHours, 97.5);

	// 97.5 hours (75% of 130)
	const records75 = [
		{ pairIndex: 0, date: "2026-09-01", status: "held", durationHours: 97.5 },
	];
	m = attendance.computeScholarshipMilestones(records75, pairs, 130);
	assert.equal(m[0].reached25, true);
	assert.equal(m[0].reached50, true);
	assert.equal(m[0].reached75, true);
	assert.equal(m[0].reached100, false);
	assert.equal(m[0].nextMilestoneHours, 130);

	// 130 hours (100% of 130)
	const records100 = [
		{ pairIndex: 0, date: "2026-09-01", status: "held", durationHours: 130.0 },
	];
	m = attendance.computeScholarshipMilestones(records100, pairs, 130);
	assert.equal(m[0].reached25, true);
	assert.equal(m[0].reached50, true);
	assert.equal(m[0].reached75, true);
	assert.equal(m[0].reached100, true);
	assert.equal(m[0].nextMilestoneHours, 130);
});

test("3. computeScholarshipMilestones calculates hoursRemaining and nextMilestoneHours progression", () => {
	const pairs = [{ pairIndex: 0 }];

	// 30h target with 10h completed
	let records = [
		{ pairIndex: 0, date: "2026-09-01", status: "held", durationHours: 10 },
	];
	let m = attendance.computeScholarshipMilestones(records, pairs, 30);
	assert.equal(m[0].hoursRemaining, 20);
	assert.equal(m[0].nextMilestoneHours, 15);
	assert.equal(m[0].completionPercent, 33);

	// 30h target with 25h completed
	records = [
		{ pairIndex: 0, date: "2026-09-01", status: "held", durationHours: 25 },
	];
	m = attendance.computeScholarshipMilestones(records, pairs, 30);
	assert.equal(m[0].hoursRemaining, 5);
	assert.equal(m[0].nextMilestoneHours, 30);

	// 30h target exceeded with 35h
	records = [
		{ pairIndex: 0, date: "2026-09-01", status: "held", durationHours: 35 },
	];
	m = attendance.computeScholarshipMilestones(records, pairs, 30);
	assert.equal(m[0].hoursRemaining, 0);
	assert.equal(m[0].nextMilestoneHours, 30);

	// 130h target with 50h completed
	records = [
		{ pairIndex: 0, date: "2026-09-01", status: "held", durationHours: 50 },
	];
	m = attendance.computeScholarshipMilestones(records, pairs, 130);
	assert.equal(m[0].hoursRemaining, 80);
	assert.equal(m[0].nextMilestoneHours, 65);
});

test("4. recordPairHoursConfirmation stores anonymous bilateral confirmation for student and coordinator", () => {
	let confirmations = [];

	// Student confirmation
	confirmations = attendance.recordPairHoursConfirmation(confirmations, {
		pairIndex: 0,
		role: "student",
		confirmedHours: 15,
		date: "2026-09-01",
	});
	assert.equal(confirmations.length, 1);
	assert.equal(confirmations[0].pairIndex, 0);
	assert.equal(confirmations[0].role, "student");
	assert.equal(confirmations[0].confirmedHours, 15);
	assert.equal(confirmations[0].date, "2026-09-01");

	// Coordinator confirmation for the same pair
	confirmations = attendance.recordPairHoursConfirmation(confirmations, {
		pairIndex: 0,
		role: "coordinator",
		confirmedHours: 15,
		date: "2026-09-02",
	});
	assert.equal(confirmations.length, 2);
	assert.equal(confirmations[1].pairIndex, 0);
	assert.equal(confirmations[1].role, "coordinator");
	assert.equal(confirmations[1].confirmedHours, 15);

	// Updating coordinator confirmation with new hours
	confirmations = attendance.recordPairHoursConfirmation(confirmations, {
		pairIndex: 0,
		role: "coordinator",
		confirmedHours: 20,
		date: "2026-09-10",
	});
	assert.equal(confirmations.length, 2);
	const coordConf = confirmations.find(
		(c) => c.pairIndex === 0 && c.role === "coordinator",
	);
	assert.equal(coordConf.confirmedHours, 20);
	assert.equal(coordConf.date, "2026-09-10");
});

test("5. recordPairHoursConfirmation rejects invalid input (invalid pairIndex, role, confirmedHours, date, non-object)", () => {
	// Non-object
	assert.throws(
		() => attendance.recordPairHoursConfirmation([], null),
		/invalid confirmation/,
	);
	assert.throws(
		() => attendance.recordPairHoursConfirmation([], "string"),
		/invalid confirmation/,
	);

	// Invalid pairIndex
	assert.throws(
		() =>
			attendance.recordPairHoursConfirmation([], {
				pairIndex: -1,
				role: "student",
				confirmedHours: 10,
				date: "2026-09-01",
			}),
		/invalid pairIndex/,
	);
	assert.throws(
		() =>
			attendance.recordPairHoursConfirmation([], {
				pairIndex: "0",
				role: "student",
				confirmedHours: 10,
				date: "2026-09-01",
			}),
		/invalid pairIndex/,
	);

	// Invalid role
	assert.throws(
		() =>
			attendance.recordPairHoursConfirmation([], {
				pairIndex: 0,
				role: "teacher",
				confirmedHours: 10,
				date: "2026-09-01",
			}),
		/role must be student or coordinator/,
	);
	assert.throws(
		() =>
			attendance.recordPairHoursConfirmation([], {
				pairIndex: 0,
				role: "",
				confirmedHours: 10,
				date: "2026-09-01",
			}),
		/role must be student or coordinator/,
	);

	// Invalid confirmedHours
	assert.throws(
		() =>
			attendance.recordPairHoursConfirmation([], {
				pairIndex: 0,
				role: "student",
				confirmedHours: -5,
				date: "2026-09-01",
			}),
		/invalid confirmedHours/,
	);
	assert.throws(
		() =>
			attendance.recordPairHoursConfirmation([], {
				pairIndex: 0,
				role: "student",
				confirmedHours: NaN,
				date: "2026-09-01",
			}),
		/invalid confirmedHours/,
	);

	// Invalid date
	assert.throws(
		() =>
			attendance.recordPairHoursConfirmation([], {
				pairIndex: 0,
				role: "student",
				confirmedHours: 10,
				date: "bad-date",
			}),
		/invalid date/,
	);
	assert.throws(
		() =>
			attendance.recordPairHoursConfirmation([], {
				pairIndex: 0,
				role: "student",
				confirmedHours: 10,
				date: "2099-01-01",
			}),
		/date cannot be in the future/,
	);
});

test("6. recordPairHoursConfirmation enforces zero PII and throws PERSONAL_DATA_ERROR on forbidden fields", () => {
	// Forbidden fields: name, phone, email, notes
	assert.throws(
		() =>
			attendance.recordPairHoursConfirmation([], {
				pairIndex: 0,
				role: "student",
				confirmedHours: 10,
				date: "2026-09-01",
				name: "Dana",
			}),
		new RegExp(PERSONAL_DATA_ERROR),
	);

	assert.throws(
		() =>
			attendance.recordPairHoursConfirmation([], {
				pairIndex: 0,
				role: "student",
				confirmedHours: 10,
				date: "2026-09-01",
				phone: "050-1234567",
			}),
		new RegExp(PERSONAL_DATA_ERROR),
	);

	assert.throws(
		() =>
			attendance.recordPairHoursConfirmation([], {
				pairIndex: 0,
				role: "coordinator",
				confirmedHours: 10,
				date: "2026-09-01",
				email: "coord@school.edu",
			}),
		new RegExp(PERSONAL_DATA_ERROR),
	);

	assert.throws(
		() =>
			attendance.recordPairHoursConfirmation([], {
				pairIndex: 0,
				role: "student",
				confirmedHours: 10,
				date: "2026-09-01",
				notes: "Confirmed all hours",
			}),
		new RegExp(PERSONAL_DATA_ERROR),
	);

	// Clean entry has strictly the 4 allowed keys and zero PII
	const conf = attendance.recordPairHoursConfirmation([], {
		pairIndex: 0,
		role: "student",
		confirmedHours: 12.5,
		date: "2026-09-01",
	});
	assert.deepEqual(Object.keys(conf[0]).sort(), [
		"confirmedHours",
		"date",
		"pairIndex",
		"role",
	]);
});

test("7. UI: #scholarshipMilestonesBar updates checkpoints dynamically based on attendance and #scholarshipTargetSelect", () => {
	const records = [
		{ pairIndex: 0, date: "2026-09-01", status: "held", durationHours: 15 },
	];
	const $ = openApp({ store: createTestStore(records) });

	$("nav-sessions").fire("click");

	const bar = $("scholarshipMilestonesBar");
	assert.ok(bar);
	// section is an implicit region; the live region contract is aria-live.
	assert.equal(bar.getAttribute("aria-live"), "polite");

	// At 30h target, 15h reaches 25% and 50%
	let html = bar.innerHTML;
	assert.ok(html.includes("25%"));
	assert.ok(html.includes("50%"));
	assert.ok(html.includes("75%"));
	assert.ok(html.includes("100%"));
	assert.ok(html.includes('data-checkpoint="25"'));
	assert.ok(html.includes('data-checkpoint="50"'));
	assert.ok(html.includes('data-checkpoint="75"'));
	assert.ok(html.includes('data-checkpoint="100"'));

	// Check reached class
	assert.ok(
		html.includes(
			'data-checkpoint="25">\n  <span class="checkpoint-pct">25%</span>',
		) ||
			html.includes(
				'scholarship-milestone-checkpoint reached" data-checkpoint="25"',
			),
	);
	assert.ok(
		html.includes(
			'scholarship-milestone-checkpoint reached" data-checkpoint="50"',
		),
	);
	assert.ok(
		!html.includes(
			'scholarship-milestone-checkpoint reached" data-checkpoint="75"',
		),
	);
	assert.ok(
		!html.includes(
			'scholarship-milestone-checkpoint reached" data-checkpoint="100"',
		),
	);

	// Switch target to 130h
	$("scholarshipTargetSelect").value = "130";
	$("scholarshipTargetSelect").fire("change");

	html = bar.innerHTML;
	// At 130h, 15h does not reach 25% (32.5h required)
	assert.ok(
		!html.includes(
			'scholarship-milestone-checkpoint reached" data-checkpoint="25"',
		),
	);
	assert.ok(
		!html.includes(
			'scholarship-milestone-checkpoint reached" data-checkpoint="50"',
		),
	);

	// Switch target back to 30h
	$("scholarshipTargetSelect").value = "30";
	$("scholarshipTargetSelect").fire("change");

	html = bar.innerHTML;
	assert.ok(
		html.includes(
			'scholarship-milestone-checkpoint reached" data-checkpoint="25"',
		),
	);
	assert.ok(
		html.includes(
			'scholarship-milestone-checkpoint reached" data-checkpoint="50"',
		),
	);
});

test("8. UI: #confirmPairHoursBtn records confirmation and updates #scholarshipConfirmationStatus", () => {
	const records = [
		{ pairIndex: 0, date: "2026-09-01", status: "held", durationHours: 20 },
	];
	const $ = openApp({ store: createTestStore(records) });

	$("nav-sessions").fire("click");

	const btn = $("confirmPairHoursBtn");
	assert.ok(btn);
	assert.equal(btn.getAttribute("type"), "button");
	assert.equal(
		btn.getAttribute("aria-describedby"),
		"scholarshipConfirmationStatus",
	);

	const status = $("scholarshipConfirmationStatus");
	assert.ok(status);
	assert.equal(status.textContent, "");

	btn.fire("click");

	assert.equal(status.textContent, "שעות המלגה אושרו בהצלחה.");
});

test("9. UI: trilingual support for #confirmPairHoursBtn and #scholarshipConfirmationStatus across he/ar/ru", () => {
	const records = [
		{ pairIndex: 0, date: "2026-09-01", status: "held", durationHours: 10 },
	];
	const $ = openApp({ store: createTestStore(records) });

	$("nav-sessions").fire("click");

	// Arabic
	$("langSelect").value = "ar";
	$("langSelect").fire("change");
	assert.equal($("confirmPairHoursBtn").textContent, "تأكيد الساعات");
	$("confirmPairHoursBtn").fire("click");
	assert.equal(
		$("scholarshipConfirmationStatus").textContent,
		"تم تأكيد ساعات المنحة بنجاح.",
	);

	// Russian
	$("langSelect").value = "ru";
	$("langSelect").fire("change");
	assert.equal($("confirmPairHoursBtn").textContent, "Подтверждение часов");
	$("confirmPairHoursBtn").fire("click");
	assert.equal(
		$("scholarshipConfirmationStatus").textContent,
		"Часы стипендии успешно подтверждены.",
	);

	// Hebrew
	$("langSelect").value = "he";
	$("langSelect").fire("change");
	assert.equal($("confirmPairHoursBtn").textContent, "אישור שעות");
	$("confirmPairHoursBtn").fire("click");
	assert.equal(
		$("scholarshipConfirmationStatus").textContent,
		"שעות המלגה אושרו בהצלחה.",
	);
});

test("10. Both attendance.js and approval.js export computeScholarshipMilestones and recordPairHoursConfirmation", () => {
	assert.equal(typeof attendance.computeScholarshipMilestones, "function");
	assert.equal(typeof attendance.recordPairHoursConfirmation, "function");
	assert.equal(typeof approval.computeScholarshipMilestones, "function");
	assert.equal(typeof approval.recordPairHoursConfirmation, "function");

	const records = [
		{ pairIndex: 0, date: "2026-09-01", status: "held", durationHours: 15 },
	];
	const pairs = [{ pairIndex: 0 }];

	const fromAttendance = attendance.computeScholarshipMilestones(
		records,
		pairs,
		30,
	);
	const fromApproval = approval.computeScholarshipMilestones(
		records,
		pairs,
		30,
	);
	assert.deepEqual(fromAttendance, fromApproval);

	const entry = {
		pairIndex: 0,
		role: "student",
		confirmedHours: 15,
		date: "2026-09-01",
	};
	const confAttendance = attendance.recordPairHoursConfirmation([], entry);
	const confApproval = approval.recordPairHoursConfirmation([], entry);
	assert.deepEqual(confAttendance, confApproval);
});
