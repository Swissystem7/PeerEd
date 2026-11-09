const test = require("node:test");
const assert = require("node:assert/strict");
const {
	makeAttendanceLog,
	recordAttendance,
	MAX_ATTENDANCE_RECORDS,
} = require("../src/lib/attendance.js");

test("MAX_ATTENDANCE_RECORDS is 5000", () => {
	assert.equal(MAX_ATTENDANCE_RECORDS, 5000);
});

test("under limit keeps all records", () => {
	let log = makeAttendanceLog();
	for (let i = 0; i < 3; i++) {
		log = recordAttendance(log, {
			pairIndex: i,
			date: `2026-01-${String(i + 1).padStart(2, "0")}`,
			status: "held",
		});
	}
	assert.equal(log.entries.length, 3);
	assert.equal(log.entries[0].pairIndex, 0);
});

test("at limit FIFO drops oldest when adding", () => {
	let log = makeAttendanceLog();
	// Seed MAX past dates only (SRV-022 rejects future dates).
	const start = Date.UTC(2000, 0, 1);
	for (let i = 0; i < MAX_ATTENDANCE_RECORDS; i++) {
		const d = new Date(start + i * 86400000);
		const iso = d.toISOString().slice(0, 10);
		log = recordAttendance(log, {
			pairIndex: i % 50,
			date: iso,
			status: "held",
		});
	}
	assert.equal(log.entries.length, MAX_ATTENDANCE_RECORDS);
	const oldest = log.entries[0].date;
	const newestPrior = log.entries[log.entries.length - 1].date;
	const overflowDate = new Date(start + MAX_ATTENDANCE_RECORDS * 86400000)
		.toISOString()
		.slice(0, 10);
	log = recordAttendance(log, {
		pairIndex: 99,
		date: overflowDate,
		status: "missed",
		durationHours: 2,
	});
	assert.equal(log.entries.length, MAX_ATTENDANCE_RECORDS);
	assert.notEqual(log.entries[0].date, oldest);
	assert.equal(log.entries[log.entries.length - 1].date, overflowDate);
	assert.equal(log.entries[log.entries.length - 1].pairIndex, 99);
	assert.equal(
		log.entries.some((e) => e.date === oldest),
		false,
	);
	assert.equal(
		log.entries.some((e) => e.date === newestPrior),
		true,
	);
});

test("zero PII: only anonymous fields kept", () => {
	let log = makeAttendanceLog();
	log = recordAttendance(log, {
		pairIndex: 0,
		date: "2026-02-01",
		status: "held",
		name: "דנה",
		phone: "050",
	});
	assert.deepEqual(Object.keys(log.entries[0]).sort(), [
		"date",
		"durationHours",
		"pairIndex",
		"status",
	]);
});
