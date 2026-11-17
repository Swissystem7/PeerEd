const test = require("node:test");
const assert = require("node:assert/strict");
const {
	makeAttendanceLog,
	recordAttendance,
	isValidAttendanceDate,
	recordPairHoursConfirmation,
} = require("../src/lib/attendance.js");

function todayLocalISO() {
	const now = new Date();
	const y = now.getFullYear();
	const m = String(now.getMonth() + 1).padStart(2, "0");
	const d = String(now.getDate()).padStart(2, "0");
	return `${y}-${m}-${d}`;
}

test("valid today accepted", () => {
	const today = todayLocalISO();
	assert.equal(isValidAttendanceDate(today), true);
	const log = recordAttendance(makeAttendanceLog(), {
		pairIndex: 0,
		date: today,
		status: "held",
	});
	assert.equal(log.entries.length, 1);
});
test("past date accepted", () => {
	assert.equal(isValidAttendanceDate("2020-01-15"), true);
});
test("future date rejected", () => {
	assert.equal(isValidAttendanceDate("2099-01-01"), false);
	assert.throws(
		() =>
			recordAttendance(makeAttendanceLog(), {
				pairIndex: 0,
				date: "2099-01-01",
				status: "held",
			}),
		/future|invalid date/i,
	);
});
test("invalid string rejected", () => {
	assert.equal(isValidAttendanceDate("2024-13-40"), false);
	assert.equal(isValidAttendanceDate("not-a-date"), false);
	assert.equal(isValidAttendanceDate(""), false);
});
test("invalid calendar day rejected", () => {
	assert.equal(isValidAttendanceDate("2024-02-30"), false);
});

test("recordPairHoursConfirmation accepts valid today date", () => {
	const today = todayLocalISO();
	const res = recordPairHoursConfirmation([], {
		pairIndex: 0,
		role: "student",
		confirmedHours: 10,
		date: today,
	});
	assert.equal(res[0].date, today);
});

test("recordPairHoursConfirmation accepts valid past date", () => {
	const res = recordPairHoursConfirmation([], {
		pairIndex: 0,
		role: "student",
		confirmedHours: 10,
		date: "2025-06-15",
	});
	assert.equal(res[0].date, "2025-06-15");
});

test("recordPairHoursConfirmation rejects future dates", () => {
	assert.throws(
		() =>
			recordPairHoursConfirmation([], {
				pairIndex: 0,
				role: "student",
				confirmedHours: 10,
				date: "2099-01-01",
			}),
		/date cannot be in the future/,
	);
});

test("recordPairHoursConfirmation rejects malformed date strings", () => {
	assert.throws(
		() =>
			recordPairHoursConfirmation([], {
				pairIndex: 0,
				role: "student",
				confirmedHours: 10,
				date: "not-a-date",
			}),
		/invalid date/,
	);
	assert.throws(
		() =>
			recordPairHoursConfirmation([], {
				pairIndex: 0,
				role: "student",
				confirmedHours: 10,
				date: "2024-13-40",
			}),
		/invalid date/,
	);
});

test("recordPairHoursConfirmation rejects non-string dates", () => {
	assert.throws(
		() =>
			recordPairHoursConfirmation([], {
				pairIndex: 0,
				role: "student",
				confirmedHours: 10,
				date: 12345,
			}),
		/date must be string/,
	);
	assert.throws(
		() =>
			recordPairHoursConfirmation([], {
				pairIndex: 0,
				role: "student",
				confirmedHours: 10,
				date: null,
			}),
		/date must be string/,
	);
});
