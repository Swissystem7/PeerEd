const test = require("node:test");
const assert = require("node:assert/strict");
const { getScholarshipHoursSummary } = require("../src/lib/attendance.js");

test("Test 1: pairs is null or undefined with valid held records calculates totals and keeps participants empty", () => {
	const records = [
		{ pairIndex: 0, status: "held", durationHours: 2.0 },
		{ pairIndex: 1, status: "held", durationHours: 1.5 },
		{ pairIndex: 2, status: "missed", durationHours: 1.0 },
	];

	for (const pairsArg of [null, undefined]) {
		let summary;
		assert.doesNotThrow(() => {
			summary = getScholarshipHoursSummary(records, pairsArg);
		});

		assert.equal(summary.totalHeldSessions, 2);
		assert.equal(summary.totalHours, 3.5);
		assert.deepEqual(summary.byPair, { 0: 2.0, 1: 1.5 });
		assert.deepEqual(summary.byParticipant, {});
		assert.deepEqual(summary.sortedParticipants, []);
	}

	let summaryOmitted;
	assert.doesNotThrow(() => {
		summaryOmitted = getScholarshipHoursSummary(records);
	});
	assert.equal(summaryOmitted.totalHeldSessions, 2);
	assert.equal(summaryOmitted.totalHours, 3.5);
	assert.deepEqual(summaryOmitted.byPair, { 0: 2.0, 1: 1.5 });
	assert.deepEqual(summaryOmitted.byParticipant, {});
	assert.deepEqual(summaryOmitted.sortedParticipants, []);
});

test("Test 2: pairs as primitives (string, number, boolean, function) provides graceful zero-participant fallback", () => {
	const records = [
		{ pairIndex: 0, status: "held", durationHours: 1.5 },
		{ pairIndex: 2, status: "held", durationHours: 2.5 },
		{ pairIndex: 3, status: "cancelled", durationHours: 1.0 },
	];

	const primitiveValues = [
		"pairs",
		"",
		123,
		0,
		Number.NaN,
		Number.POSITIVE_INFINITY,
		true,
		false,
		() => {},
		() => [{ studentIndex: 1, pupilIndex: 2 }],
		Symbol("pairs"),
		BigInt(42),
	];

	for (const prim of primitiveValues) {
		let summary;
		assert.doesNotThrow(() => {
			summary = getScholarshipHoursSummary(records, prim);
		});

		assert.equal(summary.totalHeldSessions, 2);
		assert.equal(summary.totalHours, 4.0);
		assert.deepEqual(summary.byPair, { 0: 1.5, 2: 2.5 });
		assert.deepEqual(summary.byParticipant, {});
		assert.deepEqual(summary.sortedParticipants, []);
	}
});

test("Test 3: pairs array containing null, undefined, non-objects, and missing/invalid indices", () => {
	const pairs = [
		null,
		undefined,
		"corrupted",
		12345,
		{},
		{ studentIndex: "invalid", pupilIndex: null },
		{ studentIndex: -1, pupilIndex: -2 },
		{ studentIndex: 1.5, pupilIndex: Number.NaN },
		{ studentIndex: 100, pupilIndex: 200 },
		{ studentIndex: 101, pupilIndex: "not-a-number" },
	];

	const records = [
		{ pairIndex: 0, status: "held", durationHours: 1.0 },
		{ pairIndex: 1, status: "held", durationHours: 1.0 },
		{ pairIndex: 2, status: "held", durationHours: 1.0 },
		{ pairIndex: 3, status: "held", durationHours: 1.0 },
		{ pairIndex: 4, status: "held", durationHours: 1.0 },
		{ pairIndex: 5, status: "held", durationHours: 1.0 },
		{ pairIndex: 6, status: "held", durationHours: 1.0 },
		{ pairIndex: 7, status: "held", durationHours: 1.0 },
		{ pairIndex: 8, status: "held", durationHours: 2.5 },
		{ pairIndex: 9, status: "held", durationHours: 1.5 },
	];

	let summary;
	assert.doesNotThrow(() => {
		summary = getScholarshipHoursSummary(records, pairs);
	});

	assert.equal(summary.totalHeldSessions, 10);
	assert.equal(summary.totalHours, 12.0);
	assert.deepEqual(summary.byPair, {
		0: 1.0,
		1: 1.0,
		2: 1.0,
		3: 1.0,
		4: 1.0,
		5: 1.0,
		6: 1.0,
		7: 1.0,
		8: 2.5,
		9: 1.5,
	});

	assert.deepEqual(summary.byParticipant, {
		100: 2.5,
		200: 2.5,
		101: 1.5,
	});

	assert.deepEqual(summary.sortedParticipants, [
		{ index: 100, totalHours: 2.5 },
		{ index: 200, totalHours: 2.5 },
		{ index: 101, totalHours: 1.5 },
	]);
});

test("Test 4: pairs as an object map with null/invalid entries alongside valid pair entries", () => {
	const pairsMap = {
		0: { studentIndex: 10, pupilIndex: 20 },
		1: null,
		2: undefined,
		3: "corrupted_string",
		4: { studentIndex: "invalid", pupilIndex: null },
		5: { studentIndex: -5, pupilIndex: 25 },
		6: { pairIndex: 999, studentIndex: 50, pupilIndex: 60 },
		7: { pairIndex: 7, studentIndex: 70, pupilIndex: 80 },
	};

	const records = [
		{ pairIndex: 0, status: "held", durationHours: 2.0 },
		{ pairIndex: 1, status: "held", durationHours: 1.0 },
		{ pairIndex: 2, status: "held", durationHours: 1.0 },
		{ pairIndex: 3, status: "held", durationHours: 1.0 },
		{ pairIndex: 4, status: "held", durationHours: 1.0 },
		{ pairIndex: 5, status: "held", durationHours: 1.5 },
		{ pairIndex: 6, status: "held", durationHours: 1.0 },
		{ pairIndex: 7, status: "held", durationHours: 3.0 },
	];

	let summary;
	assert.doesNotThrow(() => {
		summary = getScholarshipHoursSummary(records, pairsMap);
	});

	assert.equal(summary.totalHeldSessions, 8);
	assert.equal(summary.totalHours, 11.5);
	assert.deepEqual(summary.byPair, {
		0: 2.0,
		1: 1.0,
		2: 1.0,
		3: 1.0,
		4: 1.0,
		5: 1.5,
		6: 1.0,
		7: 3.0,
	});

	assert.deepEqual(summary.byParticipant, {
		10: 2.0,
		20: 2.0,
		25: 1.5,
		70: 3.0,
		80: 3.0,
	});

	assert.deepEqual(summary.sortedParticipants, [
		{ index: 70, totalHours: 3.0 },
		{ index: 80, totalHours: 3.0 },
		{ index: 10, totalHours: 2.0 },
		{ index: 20, totalHours: 2.0 },
		{ index: 25, totalHours: 1.5 },
	]);
});
