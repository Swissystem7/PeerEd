const test = require("node:test");
const assert = require("node:assert/strict");
const {
	makeAttendanceLog,
	recordAttendance,
	recordPairHoursConfirmation,
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
	assert.equal(log.entries[0].durationHours, 0);
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
	assert.equal(log.entries[1].durationHours, 0);
});

test("recordPairHoursConfirmation upserts matching pairIndex and role in place", () => {
	let confirmations = [];
	confirmations = recordPairHoursConfirmation(confirmations, {
		pairIndex: 0,
		role: "student",
		confirmedHours: 10,
		date: "2026-09-01",
	});
	confirmations = recordPairHoursConfirmation(confirmations, {
		pairIndex: 1,
		role: "coordinator",
		confirmedHours: 12,
		date: "2026-09-02",
	});
	confirmations = recordPairHoursConfirmation(confirmations, {
		pairIndex: 0,
		role: "coordinator",
		confirmedHours: 8,
		date: "2026-09-03",
	});
	assert.equal(confirmations.length, 3);

	// Updating pairIndex: 0, role: "student"
	confirmations = recordPairHoursConfirmation(confirmations, {
		pairIndex: 0,
		role: "student",
		confirmedHours: 15,
		date: "2026-09-04",
	});
	assert.equal(confirmations.length, 3);
	assert.equal(confirmations[0].pairIndex, 0);
	assert.equal(confirmations[0].role, "student");
	assert.equal(confirmations[0].confirmedHours, 15);
	assert.equal(confirmations[0].date, "2026-09-04");
	assert.equal(confirmations[1].pairIndex, 1);
	assert.equal(confirmations[2].pairIndex, 0);
	assert.equal(confirmations[2].role, "coordinator");
});

test("recordPairHoursConfirmation keeps distinct records for student and coordinator roles on same pair", () => {
	let list = [];
	list = recordPairHoursConfirmation(list, {
		pairIndex: 5,
		role: "student",
		confirmedHours: 10,
		date: "2026-09-01",
	});
	list = recordPairHoursConfirmation(list, {
		pairIndex: 5,
		role: "coordinator",
		confirmedHours: 12,
		date: "2026-09-02",
	});
	assert.equal(list.length, 2);
	assert.equal(list[0].role, "student");
	assert.equal(list[1].role, "coordinator");
});

test("recordPairHoursConfirmation keeps distinct records across different pair indices", () => {
	let list = [];
	list = recordPairHoursConfirmation(list, {
		pairIndex: 0,
		role: "student",
		confirmedHours: 4,
		date: "2026-09-01",
	});
	list = recordPairHoursConfirmation(list, {
		pairIndex: 1,
		role: "student",
		confirmedHours: 6,
		date: "2026-09-01",
	});
	assert.equal(list.length, 2);
	assert.equal(list[0].pairIndex, 0);
	assert.equal(list[1].pairIndex, 1);
});

test("recordPairHoursConfirmation preserves object container with entries property", () => {
	const container = { entries: [] };
	const updated = recordPairHoursConfirmation(container, {
		pairIndex: 0,
		role: "student",
		confirmedHours: 5,
		date: "2026-09-01",
	});
	assert.ok(!Array.isArray(updated));
	assert.ok(Array.isArray(updated.entries));
	assert.equal(updated.entries.length, 1);
	assert.equal(updated.entries[0].confirmedHours, 5);
	assert.equal(updated.entries.entries, updated.entries);
});

test("recordPairHoursConfirmation handles null or undefined confirmations safely", () => {
	const fromNull = recordPairHoursConfirmation(null, {
		pairIndex: 0,
		role: "student",
		confirmedHours: 3,
		date: "2026-09-01",
	});
	assert.ok(Array.isArray(fromNull));
	assert.equal(fromNull.length, 1);

	const fromUndefined = recordPairHoursConfirmation(undefined, {
		pairIndex: 1,
		role: "coordinator",
		confirmedHours: 4,
		date: "2026-09-01",
	});
	assert.ok(Array.isArray(fromUndefined));
	assert.equal(fromUndefined.length, 1);
});

test("recordPairHoursConfirmation rejects non-object entry argument", () => {
	assert.throws(
		() => recordPairHoursConfirmation([], null),
		/invalid confirmation entry: expected object/,
	);
	assert.throws(
		() => recordPairHoursConfirmation([], "entry"),
		/invalid confirmation entry: expected object/,
	);
	assert.throws(
		() => recordPairHoursConfirmation([], 42),
		/invalid confirmation entry: expected object/,
	);
});

test("recordPairHoursConfirmation rejects entry with unexpected or personal data keys", () => {
	assert.throws(
		() =>
			recordPairHoursConfirmation([], {
				pairIndex: 0,
				role: "student",
				confirmedHours: 5,
				date: "2026-09-01",
				studentName: "John Doe",
			}),
		/personal data/,
	);
	assert.throws(
		() =>
			recordPairHoursConfirmation([], {
				pairIndex: 0,
				role: "student",
				confirmedHours: 5,
				date: "2026-09-01",
				extra: true,
			}),
		/personal data/,
	);
});

test("recordPairHoursConfirmation rejects invalid pairIndex or negative values", () => {
	assert.throws(
		() =>
			recordPairHoursConfirmation([], {
				pairIndex: -1,
				role: "student",
				confirmedHours: 5,
				date: "2026-09-01",
			}),
		/invalid pairIndex/,
	);
	assert.throws(
		() =>
			recordPairHoursConfirmation([], {
				pairIndex: "0",
				role: "student",
				confirmedHours: 5,
				date: "2026-09-01",
			}),
		/invalid pairIndex/,
	);
	assert.throws(
		() =>
			recordPairHoursConfirmation([], {
				pairIndex: 1.5,
				role: "student",
				confirmedHours: 5,
				date: "2026-09-01",
			}),
		/invalid pairIndex/,
	);
});

test("recordPairHoursConfirmation rejects invalid roles other than student or coordinator", () => {
	assert.throws(
		() =>
			recordPairHoursConfirmation([], {
				pairIndex: 0,
				role: "pupil",
				confirmedHours: 5,
				date: "2026-09-01",
			}),
		/role must be student or coordinator/,
	);
	assert.throws(
		() =>
			recordPairHoursConfirmation([], {
				pairIndex: 0,
				role: "admin",
				confirmedHours: 5,
				date: "2026-09-01",
			}),
		/role must be student or coordinator/,
	);
	assert.throws(
		() =>
			recordPairHoursConfirmation([], {
				pairIndex: 0,
				role: 123,
				confirmedHours: 5,
				date: "2026-09-01",
			}),
		/role must be student or coordinator/,
	);
});
