const test = require("node:test");
const assert = require("node:assert/strict");
const { getScholarshipHoursSummary } = require("../src/lib/attendance.js");

test("descending totalHours", () => {
	const records = [
		{ pairIndex: 0, status: "held", durationHours: 1 },
		{ pairIndex: 1, status: "held", durationHours: 3 },
		{ pairIndex: 2, status: "held", durationHours: 2 },
	];
	const pairs = [
		{ pairIndex: 0, studentIndex: 10, pupilIndex: 11 },
		{ pairIndex: 1, studentIndex: 20, pupilIndex: 21 },
		{ pairIndex: 2, studentIndex: 30, pupilIndex: 31 },
	];
	const summary = getScholarshipHoursSummary(records, pairs);
	const hours = summary.sortedParticipants.map((p) => p.totalHours);
	assert.deepEqual(hours, [...hours].sort((a, b) => b - a));
	assert.equal(summary.sortedParticipants[0].totalHours, 3);
});

test("tie-break by numeric index ascending", () => {
	const records = [
		{ pairIndex: 0, status: "held", durationHours: 2 },
		{ pairIndex: 1, status: "held", durationHours: 2 },
	];
	const pairs = [
		{ pairIndex: 0, studentIndex: 5, pupilIndex: 50 },
		{ pairIndex: 1, studentIndex: 2, pupilIndex: 20 },
	];
	const summary = getScholarshipHoursSummary(records, pairs);
	const tied = summary.sortedParticipants.filter((p) => p.totalHours === 2);
	const indexes = tied.map((p) => p.index);
	assert.deepEqual(indexes, [...indexes].sort((a, b) => a - b));
});

test("empty result", () => {
	const summary = getScholarshipHoursSummary([], []);
	assert.deepEqual(summary.sortedParticipants, []);
});

test("numeric ids only / no PII fields", () => {
	const summary = getScholarshipHoursSummary(
		[{ pairIndex: 0, status: "held", durationHours: 1 }],
		[{ pairIndex: 0, studentIndex: 7, pupilIndex: 8 }],
	);
	for (const row of summary.sortedParticipants) {
		assert.equal(typeof row.index, "number");
		assert.equal(typeof row.totalHours, "number");
		assert.equal(Object.keys(row).sort().join(","), "index,totalHours");
	}
});
