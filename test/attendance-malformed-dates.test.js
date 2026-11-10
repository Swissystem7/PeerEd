const test = require("node:test");
const assert = require("node:assert/strict");
const {
	calculatePairHours,
	getScholarshipHoursSummary,
} = require("../src/lib/attendance.js");

test("records with invalid or non-ISO date strings do not throw or fail calculations", () => {
	const invalidDateStrings = [
		"not-a-date",
		"2026-99-99",
		"invalid-date",
		"2026/10/01",
		"yesterday",
		"2026-02-31",
		"2026-13-45",
		"2026-10-01T12:00:00Z",
	];

	const records = invalidDateStrings.map((dateStr) => ({
		pairIndex: 0,
		date: dateStr,
		status: "held",
		durationHours: 1.5,
	}));

	assert.doesNotThrow(() => {
		const total = calculatePairHours(records, 0);
		assert.equal(total, invalidDateStrings.length * 1.5);
	});

	assert.doesNotThrow(() => {
		const summary = getScholarshipHoursSummary(records, [
			{ studentIndex: 1, pupilIndex: 2 },
		]);
		assert.equal(summary.totalHeldSessions, invalidDateStrings.length);
		assert.equal(summary.totalHours, invalidDateStrings.length * 1.5);
		assert.deepEqual(summary.byPair, { 0: invalidDateStrings.length * 1.5 });
		assert.deepEqual(summary.byParticipant, {
			1: invalidDateStrings.length * 1.5,
			2: invalidDateStrings.length * 1.5,
		});
	});
});

test("records with non-string date values do not throw or fail calculations", () => {
	const nonStringDates = [
		null,
		undefined,
		12345,
		0,
		true,
		false,
		{},
		{ year: 2026, month: 10, day: 1 },
		[],
		["2026-10-01"],
		Number.NaN,
		new Date(),
	];

	const records = nonStringDates.map((val) => ({
		pairIndex: 1,
		date: val,
		status: "held",
		durationHours: 2.0,
	}));

	assert.doesNotThrow(() => {
		const pairHours = calculatePairHours(records, 1);
		assert.equal(pairHours, nonStringDates.length * 2.0);
	});

	assert.doesNotThrow(() => {
		const summary = getScholarshipHoursSummary(records, [
			null,
			{ studentIndex: 10, pupilIndex: 20 },
		]);
		assert.equal(summary.totalHeldSessions, nonStringDates.length);
		assert.equal(summary.totalHours, nonStringDates.length * 2.0);
		assert.deepEqual(summary.byPair, { 1: nonStringDates.length * 2.0 });
		assert.deepEqual(summary.byParticipant, {
			10: nonStringDates.length * 2.0,
			20: nonStringDates.length * 2.0,
		});
	});
});

test("records with empty string, whitespace date values, or omitted date property", () => {
	const records = [
		{ pairIndex: 0, date: "", status: "held", durationHours: 1.0 },
		{ pairIndex: 0, date: "   ", status: "held", durationHours: 1.5 },
		{ pairIndex: 0, date: "\t\n", status: "held", durationHours: 2.0 },
		{ pairIndex: 0, status: "held", durationHours: 2.5 },
	];

	assert.doesNotThrow(() => {
		const hours = calculatePairHours(records, 0);
		assert.equal(hours, 7.0);
	});

	assert.doesNotThrow(() => {
		const summary = getScholarshipHoursSummary(records, [
			{ studentIndex: 5, pupilIndex: 6 },
		]);
		assert.equal(summary.totalHeldSessions, 4);
		assert.equal(summary.totalHours, 7.0);
		assert.deepEqual(summary.byPair, { 0: 7.0 });
		assert.deepEqual(summary.byParticipant, { 5: 7.0, 6: 7.0 });
	});
});

test("calculatePairHours with mixed arrays containing valid records, malformed date records, and various statuses", () => {
	const mixedRecords = [
		{ pairIndex: 0, date: "2026-10-01", status: "held", durationHours: 1.5 },
		{ pairIndex: 0, date: "not-a-date", status: "held", durationHours: 2.0 },
		{ pairIndex: 0, date: null, status: "held" },
		{ pairIndex: 0, date: "", status: "missed", durationHours: 3.0 },
		{ pairIndex: 0, date: 9999, status: "cancelled", durationHours: 1.0 },
		{
			pairIndex: 0,
			date: "2026-10-15",
			status: "postponed",
			durationHours: 2.0,
		},
		{ pairIndex: 1, date: "2026-10-01", status: "held", durationHours: 2.5 },
		{ pairIndex: 1, date: "2026-99-99", status: "held", durationHours: 1.0 },
		{ pairIndex: 1, date: true, status: "missed", durationHours: 1.5 },
		{
			pairIndex: 1,
			date: "invalid-date",
			status: "cancelled",
			durationHours: 2.0,
		},
		{ pairIndex: 2, status: "held", durationHours: 0.5 },
		{ pairIndex: 2, date: {}, status: "cancelled", durationHours: 4.0 },
	];

	assert.equal(calculatePairHours(mixedRecords, 0), 4.5);
	assert.equal(calculatePairHours(mixedRecords, 1), 3.5);
	assert.equal(calculatePairHours(mixedRecords, 2), 0.5);
	assert.equal(calculatePairHours(mixedRecords, 3), 0);
	assert.equal(calculatePairHours(mixedRecords, -1), 0);
});

test("getScholarshipHoursSummary with records containing malformed dates aggregates accurate summary", () => {
	const records = [
		{ pairIndex: 0, date: "not-a-date", status: "held", durationHours: 2.0 },
		{ pairIndex: 0, date: null, status: "held", durationHours: 1.5 },
		{ pairIndex: 0, date: "2026-99-99", status: "missed", durationHours: 1.0 },
		{ pairIndex: 1, date: undefined, status: "held", durationHours: 3.0 },
		{
			pairIndex: 1,
			date: "2026/10/01",
			status: "cancelled",
			durationHours: 2.0,
		},
		{ pairIndex: 2, date: "", status: "held" },
		{
			pairIndex: 2,
			date: [2026, 10, 1],
			status: "postponed",
			durationHours: 1.0,
		},
		{
			pairIndex: 3,
			date: "invalid-date",
			status: "missed",
			durationHours: 2.0,
		},
		{ pairIndex: 0, status: "held", durationHours: 0.5 },
	];

	const pairs = [
		{ studentIndex: 10, pupilIndex: 20 },
		{ studentIndex: 10, pupilIndex: 21 },
		{ studentIndex: 12, pupilIndex: 22 },
		{ studentIndex: 13, pupilIndex: 23 },
	];

	const summary = getScholarshipHoursSummary(records, pairs);

	assert.equal(summary.totalHeldSessions, 5);
	assert.equal(summary.totalHours, 8.0);

	assert.deepEqual(summary.byPair, {
		0: 4.0,
		1: 3.0,
		2: 1.0,
	});
	assert.equal(Object.hasOwn(summary.byPair, "3"), false);

	assert.deepEqual(summary.byParticipant, {
		10: 7.0,
		20: 4.0,
		21: 3.0,
		12: 1.0,
		22: 1.0,
	});

	assert.deepEqual(summary.sortedParticipants, [
		{ index: 10, totalHours: 7.0 },
		{ index: 20, totalHours: 4.0 },
		{ index: 21, totalHours: 3.0 },
		{ index: 12, totalHours: 1.0 },
		{ index: 22, totalHours: 1.0 },
	]);
});
