const test = require("node:test");
const assert = require("node:assert/strict");
const {
	makeAttendanceLog,
	recordAttendance,
	serializeAttendance,
	deserializeAttendance,
} = require("../src/lib/attendance.js");

test("recordAttendance keeps custom durationHours", () => {
	let log = makeAttendanceLog();
	log = recordAttendance(log, {
		pairIndex: 0,
		date: "2026-01-15",
		status: "held",
		durationHours: 1.5,
	});
	assert.equal(log.entries[0].durationHours, 1.5);
});

test("recordAttendance defaults durationHours to 1.0", () => {
	let log = makeAttendanceLog();
	log = recordAttendance(log, {
		pairIndex: 0,
		date: "2026-01-15",
		status: "held",
	});
	assert.equal(log.entries[0].durationHours, 1.0);
	log = makeAttendanceLog();
	log = recordAttendance(log, {
		pairIndex: 1,
		date: "2026-01-16",
		status: "held",
		durationHours: 0,
	});
	assert.equal(log.entries[0].durationHours, 1.0);
});

test("serializeAttendance keeps only allowed fields", () => {
	const rows = serializeAttendance([
		{
			pairIndex: 0,
			date: "2026-01-15",
			status: "held",
			durationHours: 2,
			name: "secret",
		},
	]);
	assert.deepEqual(Object.keys(rows[0]).sort(), [
		"date",
		"durationHours",
		"pairIndex",
		"status",
	]);
	assert.equal(rows[0].durationHours, 2);
});

test("deserializeAttendance drops invalid rows", () => {
	const rows = deserializeAttendance([
		{ pairIndex: 0, date: "2026-01-15", status: "held", durationHours: 1.25 },
		{ pairIndex: -1, date: "2026-01-15", status: "held" },
		{ pairIndex: 1, date: "bad", status: "held" },
		{ pairIndex: 2, date: "2026-01-15", status: "nope" },
		null,
	]);
	assert.equal(rows.length, 1);
	assert.equal(rows[0].durationHours, 1.25);
});

test("serialize/deserialize round-trip", () => {
	let log = makeAttendanceLog();
	log = recordAttendance(log, {
		pairIndex: 3,
		date: "2026-02-01",
		status: "missed",
		durationHours: 0.5,
	});
	// non-held statuses always store 0.0 durationHours
	const ser = serializeAttendance(log.entries);
	const back = deserializeAttendance(ser);
	assert.equal(back.length, 1);
	assert.equal(back[0].pairIndex, 3);
	assert.equal(back[0].status, "missed");
	assert.equal(back[0].durationHours, 0);
});

test("zero PII in serialized output", () => {
	const ser = serializeAttendance([
		{
			pairIndex: 0,
			date: "2026-01-15",
			status: "held",
			durationHours: 1,
			studentName: "דני",
			email: "a@b.c",
		},
	]);
	const text = JSON.stringify(ser);
	assert.equal(text.includes("דני"), false);
	assert.equal(text.includes("a@b.c"), false);
	assert.equal(text.includes("studentName"), false);
});
