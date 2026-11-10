const test = require("node:test");
const assert = require("node:assert/strict");
const {
	weeklyReport,
	monthlyReport,
	semesterReport,
	reportToCsv,
} = require("../src/lib/reports.js");

// 1. monthlyReport: normal month, December rollover, leap & non-leap February
test("monthlyReport: normal month, December rollover, leap & non-leap February", () => {
	const nov = monthlyReport({}, "2026-11");
	assert.equal(nov.kind, "monthly");
	assert.equal(nov.from, "2026-11-01");
	assert.equal(nov.to, "2026-11-30");

	const dec = monthlyReport({}, "2026-12");
	assert.equal(dec.from, "2026-12-01");
	assert.equal(dec.to, "2026-12-31");

	const febNonLeap = monthlyReport({}, "2025-02");
	assert.equal(febNonLeap.from, "2025-02-01");
	assert.equal(febNonLeap.to, "2025-02-28");

	const febLeap = monthlyReport({}, "2024-02");
	assert.equal(febLeap.from, "2024-02-01");
	assert.equal(febLeap.to, "2024-02-29");
});

// 2. weeklyReport: start date plus six days bounds and kind
test("weeklyReport: start plus six days bounds and kind", () => {
	const w = weeklyReport({}, "2026-11-10");
	assert.equal(w.kind, "weekly");
	assert.equal(w.from, "2026-11-10");
	assert.equal(w.to, "2026-11-16");
});

// 3. monthlyReport: invalid month formats
test("monthlyReport: rejects malformed month strings", () => {
	assert.throws(
		() => monthlyReport({}, "2026-11-01"),
		/invalid month: expected YYYY-MM/,
	);
	assert.throws(() => monthlyReport({}, ""), /invalid month: expected YYYY-MM/);
	assert.throws(
		() => monthlyReport({}, "2026-1"),
		/invalid month: expected YYYY-MM/,
	);
	assert.throws(
		() => monthlyReport({}, null),
		/invalid month: expected YYYY-MM/,
	);
});

// 4. monthlyReport: month number out of range (13) triggers date-parse error
test("monthlyReport: out-of-range month number throws date-parse error", () => {
	assert.throws(
		() => monthlyReport({}, "2026-13"),
		/invalid date: expected YYYY-MM-DD/,
	);
});

// 5. semesterReport: validation of input object and correct window bounds
test("semesterReport: validates input and returns correct bounds", () => {
	assert.throws(() => semesterReport({}, {}), /invalid semester/);
	assert.throws(
		() => semesterReport({}, { startDate: "2026-09-01" }),
		/invalid semester/,
	);

	const sem = semesterReport(
		{},
		{ startDate: "2026-09-01", endDate: "2027-01-31" },
	);
	assert.equal(sem.kind, "semester");
	assert.equal(sem.from, "2026-09-01");
	assert.equal(sem.to, "2027-01-31");
});

// 6. reportToCsv: formats weekly report CSV correctly
test("reportToCsv: formats weekly report CSV correctly", () => {
	const r = weeklyReport({}, "2026-11-10");
	const csv = reportToCsv(r);
	assert.ok(csv.startsWith("measure,code,count"));
	assert.ok(csv.includes("scheduled,,0"));
	assert.ok(csv.endsWith("\n"));
});
