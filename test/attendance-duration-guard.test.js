const test = require("node:test");
const assert = require("node:assert/strict");
const {
	makeAttendanceLog,
	recordAttendance,
	recordPairHoursConfirmation,
} = require("../src/lib/attendance.js");

test("held zero/negative/nonfinite normalize to 1.0", () => {
	let log = makeAttendanceLog();
	log = recordAttendance(log, {
		pairIndex: 0,
		date: "2026-01-10",
		status: "held",
		durationHours: 0,
	});
	assert.equal(log.entries[0].durationHours, 1.0);
	log = recordAttendance(log, {
		pairIndex: 1,
		date: "2026-01-10",
		status: "held",
		durationHours: -2,
	});
	assert.equal(log.entries[1].durationHours, 1.0);
	log = recordAttendance(log, {
		pairIndex: 2,
		date: "2026-01-10",
		status: "held",
		durationHours: NaN,
	});
	assert.equal(log.entries[2].durationHours, 1.0);
});

test("held positive preserved", () => {
	let log = makeAttendanceLog();
	log = recordAttendance(log, {
		pairIndex: 0,
		date: "2026-01-11",
		status: "held",
		durationHours: 2.5,
	});
	assert.equal(log.entries[0].durationHours, 2.5);
});

test("cancelled accrues 0.0 even if duration provided", () => {
	let log = makeAttendanceLog();
	log = recordAttendance(log, {
		pairIndex: 0,
		date: "2026-01-12",
		status: "cancelled",
		durationHours: 3,
	});
	assert.equal(log.entries[0].durationHours, 0.0);
});

test("missed/postponed accrue 0.0", () => {
	let log = makeAttendanceLog();
	log = recordAttendance(log, {
		pairIndex: 0,
		date: "2026-01-13",
		status: "missed",
		durationHours: 2,
	});
	log = recordAttendance(log, {
		pairIndex: 1,
		date: "2026-01-13",
		status: "postponed",
	});
	assert.equal(log.entries[0].durationHours, 0.0);
	assert.equal(log.entries[1].durationHours, 0.0);
});

test("recordPairHoursConfirmation rejects negative confirmedHours", () => {
	assert.throws(
		() =>
			recordPairHoursConfirmation([], {
				pairIndex: 0,
				role: "student",
				confirmedHours: -1,
				date: "2026-09-01",
			}),
		/invalid confirmedHours/,
	);
	assert.throws(
		() =>
			recordPairHoursConfirmation([], {
				pairIndex: 0,
				role: "student",
				confirmedHours: -0.1,
				date: "2026-09-01",
			}),
		/invalid confirmedHours/,
	);
});

test("recordPairHoursConfirmation rejects non-finite confirmedHours", () => {
	assert.throws(
		() =>
			recordPairHoursConfirmation([], {
				pairIndex: 0,
				role: "student",
				confirmedHours: NaN,
				date: "2026-09-01",
			}),
		/invalid confirmedHours/,
	);
	assert.throws(
		() =>
			recordPairHoursConfirmation([], {
				pairIndex: 0,
				role: "student",
				confirmedHours: Infinity,
				date: "2026-09-01",
			}),
		/invalid confirmedHours/,
	);
	assert.throws(
		() =>
			recordPairHoursConfirmation([], {
				pairIndex: 0,
				role: "student",
				confirmedHours: -Infinity,
				date: "2026-09-01",
			}),
		/invalid confirmedHours/,
	);
});

test("recordPairHoursConfirmation rejects non-numeric confirmedHours types", () => {
	assert.throws(
		() =>
			recordPairHoursConfirmation([], {
				pairIndex: 0,
				role: "student",
				confirmedHours: "10",
				date: "2026-09-01",
			}),
		/invalid confirmedHours/,
	);
	assert.throws(
		() =>
			recordPairHoursConfirmation([], {
				pairIndex: 0,
				role: "student",
				confirmedHours: null,
				date: "2026-09-01",
			}),
		/invalid confirmedHours/,
	);
	assert.throws(
		() =>
			recordPairHoursConfirmation([], {
				pairIndex: 0,
				role: "student",
				confirmedHours: undefined,
				date: "2026-09-01",
			}),
		/invalid confirmedHours/,
	);
});

test("recordPairHoursConfirmation accepts zero confirmedHours", () => {
	const valid = recordPairHoursConfirmation([], {
		pairIndex: 0,
		role: "student",
		confirmedHours: 0,
		date: "2026-09-01",
	});
	assert.equal(valid[0].confirmedHours, 0);
});

test("recordPairHoursConfirmation accepts fractional positive confirmedHours", () => {
	const valid = recordPairHoursConfirmation([], {
		pairIndex: 0,
		role: "student",
		confirmedHours: 3.75,
		date: "2026-09-01",
	});
	assert.equal(valid[0].confirmedHours, 3.75);
});
