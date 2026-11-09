const test = require("node:test");
const assert = require("node:assert/strict");
const {
	makeAttendanceLog,
	recordAttendance,
} = require("../src/lib/attendance.js");

test("repeat recording upserts same pairIndex+date", () => {
	let log = makeAttendanceLog();
	log = recordAttendance(log, {
		pairIndex: 0,
		date: "2026-01-10",
		status: "held",
		durationHours: 1,
	});
	log = recordAttendance(log, {
		pairIndex: 0,
		date: "2026-01-10",
		status: "missed",
		durationHours: 2,
	});
	assert.equal(log.entries.length, 1);
	assert.equal(log.entries[0].status, "missed");
	assert.equal(log.entries[0].durationHours, 2);
});

test("updated status replaces in place", () => {
	let log = makeAttendanceLog();
	log = recordAttendance(log, {
		pairIndex: 1,
		date: "2026-01-11",
		status: "postponed",
	});
	log = recordAttendance(log, {
		pairIndex: 1,
		date: "2026-01-11",
		status: "held",
		durationHours: 1.5,
	});
	assert.equal(log.entries[0].status, "held");
	assert.equal(log.entries[0].durationHours, 1.5);
});

test("length unchanged on upsert", () => {
	let log = makeAttendanceLog();
	log = recordAttendance(log, {
		pairIndex: 0,
		date: "2026-01-12",
		status: "held",
	});
	log = recordAttendance(log, {
		pairIndex: 2,
		date: "2026-01-12",
		status: "cancelled",
	});
	const before = log.entries.length;
	log = recordAttendance(log, {
		pairIndex: 0,
		date: "2026-01-12",
		status: "missed",
	});
	assert.equal(log.entries.length, before);
});

test("order preserved on upsert", () => {
	let log = makeAttendanceLog();
	log = recordAttendance(log, {
		pairIndex: 0,
		date: "2026-01-13",
		status: "held",
	});
	log = recordAttendance(log, {
		pairIndex: 1,
		date: "2026-01-13",
		status: "held",
	});
	log = recordAttendance(log, {
		pairIndex: 2,
		date: "2026-01-13",
		status: "held",
	});
	log = recordAttendance(log, {
		pairIndex: 1,
		date: "2026-01-13",
		status: "missed",
		durationHours: 3,
	});
	assert.deepEqual(
		log.entries.map((e) => e.pairIndex),
		[0, 1, 2],
	);
	assert.equal(log.entries[1].status, "missed");
	assert.equal(log.entries[1].durationHours, 3);
});
