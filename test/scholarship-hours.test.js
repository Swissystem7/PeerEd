const test = require("node:test");
const assert = require("node:assert/strict");
const {
	calculatePairHours,
	getScholarshipHoursSummary,
} = require("../src/lib/attendance.js");

test("only held counted (missed/postponed/cancelled ignored)", () => {
	const records = [
		{ pairIndex: 0, date: "2026-10-01", status: "held" },
		{ pairIndex: 0, date: "2026-10-08", status: "missed" },
		{ pairIndex: 0, date: "2026-10-15", status: "postponed" },
		{ pairIndex: 0, date: "2026-10-22", status: "cancelled" },
		{ pairIndex: 1, date: "2026-10-01", status: "missed" },
		{ pairIndex: 1, date: "2026-10-08", status: "cancelled" },
	];
	const pairs = [
		{ studentIndex: 10, pupilIndex: 20 },
		{ studentIndex: 11, pupilIndex: 21 },
	];

	assert.equal(calculatePairHours(records, 0), 1);
	assert.equal(calculatePairHours(records, 1), 0);

	const summary = getScholarshipHoursSummary(records, pairs);
	assert.equal(summary.totalHeldSessions, 1);
	assert.equal(summary.totalHours, 1);
	assert.deepEqual(summary.byPair, { 0: 1 });
	assert.deepEqual(summary.byParticipant, { 10: 1, 20: 1 });
});

test("empty/invalid input = 0 and does not throw", () => {
	const invalidInputs = [
		null,
		undefined,
		{},
		[],
		"string",
		123,
		true,
		{ entries: [] },
	];

	for (const input of invalidInputs) {
		assert.equal(calculatePairHours(input, 0), 0);
		assert.equal(calculatePairHours(input, -1), 0);
		const summary = getScholarshipHoursSummary(input, []);
		assert.deepEqual(summary, {
			byPair: {},
			totalHeldSessions: 0,
			totalHours: 0,
			byParticipant: {},
			sortedParticipants: [],
		});
	}

	const validRecords = [{ pairIndex: 0, status: "held" }];
	assert.equal(calculatePairHours(validRecords, -1), 0);
	assert.equal(calculatePairHours(validRecords, 1.5), 0);
	assert.equal(calculatePairHours(validRecords, "0"), 0);
	assert.equal(calculatePairHours(validRecords, null), 0);
	assert.equal(calculatePairHours(validRecords, undefined), 0);
	assert.equal(calculatePairHours(validRecords, Number.NaN), 0);
	assert.equal(calculatePairHours(validRecords, 999), 0);

	const junkRecords = [
		null,
		undefined,
		"held",
		123,
		{},
		{ pairIndex: -1, status: "held" },
		{ pairIndex: 1.5, status: "held" },
		{ pairIndex: "0", status: "held" },
	];
	assert.equal(calculatePairHours(junkRecords, 0), 0);
	assert.deepEqual(getScholarshipHoursSummary(junkRecords, null), {
		byPair: {},
		totalHeldSessions: 0,
		totalHours: 0,
		byParticipant: {},
		sortedParticipants: [],
	});
});

test("exact sums with durationHours (and invalid durationHours -> 1.0)", () => {
	const records = [
		{ pairIndex: 0, status: "held", durationHours: 1.5 },
		{ pairIndex: 0, status: "held", durationHours: 2.25 },
		{ pairIndex: 0, status: "held", durationHours: 0.75 },
		{ pairIndex: 0, status: "held", durationHours: 0 },
		{ pairIndex: 0, status: "held", durationHours: -1 },
		{ pairIndex: 0, status: "held", durationHours: -2.5 },
		{ pairIndex: 0, status: "held", durationHours: Number.NaN },
		{ pairIndex: 0, status: "held", durationHours: Number.POSITIVE_INFINITY },
		{ pairIndex: 0, status: "held", durationHours: Number.NEGATIVE_INFINITY },
		{ pairIndex: 0, status: "held", durationHours: "2.0" },
		{ pairIndex: 0, status: "held", durationHours: null },
		{ pairIndex: 0, status: "held", durationHours: undefined },
		{ pairIndex: 0, status: "held" },
	];

	assert.equal(calculatePairHours(records, 0), 14.5);

	const summary = getScholarshipHoursSummary(records, [
		{ studentIndex: 2, pupilIndex: 5 },
	]);
	assert.equal(summary.totalHeldSessions, 13);
	assert.equal(summary.totalHours, 14.5);
	assert.equal(summary.byPair[0], 14.5);
	assert.equal(summary.byParticipant[2], 14.5);
	assert.equal(summary.byParticipant[5], 14.5);
});

test("byPair and totals across multiple pairs", () => {
	const records = [
		{ pairIndex: 0, status: "held", durationHours: 1.5 },
		{ pairIndex: 0, status: "held", durationHours: 1.0 },
		{ pairIndex: 1, status: "held", durationHours: 2.0 },
		{ pairIndex: 1, status: "missed", durationHours: 2.0 },
		{ pairIndex: 2, status: "postponed", durationHours: 1.5 },
		{ pairIndex: 2, status: "cancelled", durationHours: 1.5 },
	];
	const pairs = [
		{ studentIndex: 10, pupilIndex: 20 },
		{ studentIndex: 11, pupilIndex: 21 },
		{ studentIndex: 12, pupilIndex: 22 },
	];

	const summary = getScholarshipHoursSummary(records, pairs);

	assert.equal(summary.totalHeldSessions, 3);
	assert.equal(summary.totalHours, 4.5);
	assert.deepEqual(summary.byPair, { 0: 2.5, 1: 2.0 });
	assert.equal(summary.byPair[0], 2.5);
	assert.equal(summary.byPair[1], 2.0);
	assert.equal(Object.hasOwn(summary.byPair, "2"), false);
});

test("participant mapping via pairs and handling missing pairs", () => {
	const records = [
		{ pairIndex: 0, status: "held", durationHours: 2 },
		{ pairIndex: 1, status: "held", durationHours: 1.5 },
		{ pairIndex: 2, status: "held", durationHours: 3 },
	];
	const pairs = [
		{ studentIndex: 10, pupilIndex: 20 },
		{ studentIndex: 10, pupilIndex: 21 },
	];

	const summary = getScholarshipHoursSummary(records, pairs);

	assert.deepEqual(summary.byPair, { 0: 2, 1: 1.5, 2: 3 });
	assert.equal(summary.totalHeldSessions, 3);
	assert.equal(summary.totalHours, 6.5);
	assert.deepEqual(summary.byParticipant, {
		10: 3.5,
		20: 2,
		21: 1.5,
	});

	const noPairsSummary = getScholarshipHoursSummary(records);
	assert.deepEqual(noPairsSummary.byPair, { 0: 2, 1: 1.5, 2: 3 });
	assert.equal(noPairsSummary.totalHours, 6.5);
	assert.deepEqual(noPairsSummary.byParticipant, {});
});

test("no PII fields in the output (only numeric keys/values)", () => {
	const records = [
		{
			pairIndex: 0,
			status: "held",
			durationHours: 1.5,
			studentName: "Israel Israeli",
			pupilName: "Dan Cohen",
			email: "israel@example.com",
			phone: "050-1234567",
			notes: "PII note",
		},
		{
			pairIndex: 1,
			status: "held",
			durationHours: 2.0,
			name: "Secret User",
		},
	];
	const pairs = [
		{
			studentIndex: 100,
			pupilIndex: 200,
			studentName: "Israel Israeli",
			pupilName: "Dan Cohen",
		},
		{
			studentIndex: 101,
			pupilIndex: 201,
			name: "Secret User",
		},
	];

	const summary = getScholarshipHoursSummary(records, pairs);

	const topKeys = Object.keys(summary).sort();
	assert.deepEqual(topKeys, [
		"byPair",
		"byParticipant",
		"sortedParticipants",
		"totalHeldSessions",
		"totalHours",
	]);
	assert.ok(Array.isArray(summary.sortedParticipants));
	for (const row of summary.sortedParticipants) {
		assert.equal(typeof row.index, "number");
		assert.equal(typeof row.totalHours, "number");
		assert.deepEqual(Object.keys(row).sort(), ["index", "totalHours"]);
	}

	assert.equal(typeof summary.totalHeldSessions, "number");
	assert.equal(typeof summary.totalHours, "number");

	for (const [k, v] of Object.entries(summary.byPair)) {
		assert.match(k, /^\d+$/);
		assert.equal(typeof v, "number");
	}

	for (const [k, v] of Object.entries(summary.byParticipant)) {
		assert.match(k, /^\d+$/);
		assert.equal(typeof v, "number");
	}

	const serialized = JSON.stringify(summary);
	assert.doesNotMatch(
		serialized,
		/Israel|Israeli|Dan|Cohen|Secret|email|phone|notes|name/i,
	);
});

test("inputs not mutated", () => {
	const originalRecords = [
		{ pairIndex: 0, status: "held", durationHours: 2 },
		{ pairIndex: 1, status: "missed", durationHours: 1 },
	];
	const originalPairs = [
		{ studentIndex: 5, pupilIndex: 8 },
		{ studentIndex: 6, pupilIndex: 9 },
	];

	const recordsCopy = JSON.parse(JSON.stringify(originalRecords));
	const pairsCopy = JSON.parse(JSON.stringify(originalPairs));

	calculatePairHours(recordsCopy, 0);
	assert.deepEqual(recordsCopy, originalRecords);

	getScholarshipHoursSummary(recordsCopy, pairsCopy);
	assert.deepEqual(recordsCopy, originalRecords);
	assert.deepEqual(pairsCopy, originalPairs);

	const frozenRecords = Object.freeze([
		Object.freeze({ pairIndex: 0, status: "held", durationHours: 1.5 }),
	]);
	const frozenPairs = Object.freeze([
		Object.freeze({ studentIndex: 1, pupilIndex: 2 }),
	]);

	assert.doesNotThrow(() => {
		calculatePairHours(frozenRecords, 0);
		getScholarshipHoursSummary(frozenRecords, frozenPairs);
	});
});
