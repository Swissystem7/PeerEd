const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const attendance = require("../src/lib/attendance.js");

const shell = fs.readFileSync(path.join(__dirname, "..", "src", "app-shell.html"), "utf8");

test("app-shell has pair-total-hours-badge element and updater", () => {
	assert.match(shell, /pair-total-hours-badge/);
	assert.match(shell, /id="pairTotalHoursBadge"/);
	assert.match(shell, /updatePairTotalHoursBadge/);
	assert.match(shell, /calculatePairHours/);
});

test("badge labels cover he/ar/ru", () => {
	assert.match(shell, /סך שעות:/);
	assert.match(shell, /إجمالي الساعات:/);
	assert.match(shell, /Всего часов:/);
});

test("calculatePairHours totals held sessions for a pair", () => {
	const records = [
		{ pairIndex: 0, status: "held", durationHours: 1.5 },
		{ pairIndex: 0, status: "missed", durationHours: 1 },
		{ pairIndex: 1, status: "held", durationHours: 2 },
	];
	assert.equal(attendance.calculatePairHours(records, 0), 1.5);
	assert.equal(attendance.calculatePairHours(records, 1), 2);
	assert.equal(attendance.calculatePairHours(records, 2), 0);
});

test("badge updates after held session path is wired", () => {
	assert.match(shell, /updatePairTotalHoursBadge\(\)/);
});
