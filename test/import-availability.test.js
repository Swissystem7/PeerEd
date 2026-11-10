const test = require("node:test");
const assert = require("node:assert/strict");
const { parseAvailabilityCsv } = require("../src/lib/import-availability.js");

test("valid one‑row CSV returns a frozen profile and no errors", () => {
	const csv = [
		"role,region,subjects,availability",
		"student,CENTER,MATH,SUN_16",
	].join("\n");

	const result = parseAvailabilityCsv(csv);
	assert.ok(Object.isFrozen(result), "result should be frozen");
	assert.ok(
		Object.isFrozen(result.profiles),
		"profiles array should be frozen",
	);
	assert.ok(Object.isFrozen(result.errors), "errors array should be frozen");
	assert.strictEqual(result.profiles.length, 1);
	assert.strictEqual(result.errors.length, 0);
	const profile = result.profiles[0];
	assert.ok(Object.isFrozen(profile), "profile should be frozen");
	// basic sanity checks on profile fields
	assert.strictEqual(profile.role, "student");
	assert.strictEqual(profile.region, "CENTER");
	assert.deepStrictEqual(profile.subjects, ["MATH"]);
	assert.deepStrictEqual(profile.availability, ["SUN_16"]);
});

test("non‑string input throws with expected message", () => {
	assert.throws(
		() => parseAvailabilityCsv(null),
		(err) => /invalid import: expected text/.test(err.message),
		"Expected error for non‑string input",
	);
});

test("CSV containing personal data (email) throws personal‑data error", () => {
	const csv = [
		"role,region,subjects,availability",
		"student,CENTER,a@b.com,SUN_16",
	].join("\n");

	assert.throws(
		() => parseAvailabilityCsv(csv),
		(err) => /personal data is not accepted/.test(err.message),
		"Expected personal‑data rejection error",
	);
});

test("wrong header throws import‑header error", () => {
	const csv = [
		"role,region,subjects", // missing availability column
		"student,CENTER,MATH,SUN_16",
	].join("\n");

	assert.throws(
		() => parseAvailabilityCsv(csv),
		(err) => /invalid import header/.test(err.message),
		"Expected header validation error",
	);
});

test("row‑level errors are recorded correctly", () => {
	const csv = [
		"role,region,subjects,availability",
		// WRONG_COLUMNS (only 3 columns)
		"student,CENTER,MATH",
		// INVALID_ROLE
		"teacher,CENTER,MATH,SUN_16",
		// INVALID_REGION
		"student,UNKNOWN,MATH,SUN_16",
		// INVALID_SUBJECT (unknown subject)
		"student,CENTER,ASTROLOGY,SUN_16",
		// INVALID_SLOT (slot that normalizeSlot will reject)
		"student,CENTER,MATH,BAD_SLOT",
		// DUPLICATE_ROW (first good row)
		"student,CENTER,MATH,SUN_16",
		// duplicate of the previous good row
		"student,CENTER,MATH,SUN_16",
		// a valid row after errors
		"pupil,HAIFA,ENGLISH;MATH,MON_10;TUE_12",
		// blank line should be ignored
		"",
	].join("\n");

	const result = parseAvailabilityCsv(csv);
	// Expect two valid profiles (the first good row and the last pupil row)
	assert.strictEqual(result.profiles.length, 2);
	// Expect errors for the 7 problematic rows (lines are 1‑based)
	const expected = [
		{ line: 2, reason: "WRONG_COLUMNS" },
		{ line: 3, reason: "INVALID_ROLE" },
		{ line: 4, reason: "INVALID_REGION" },
		{ line: 5, reason: "INVALID_SUBJECT" },
		{ line: 6, reason: "INVALID_SLOT" },
		{ line: 8, reason: "DUPLICATE_ROW" },
	];
	assert.deepStrictEqual(result.errors, expected);
});

test("empty or whitespace‑only CSV returns empty frozen arrays", () => {
	const emptyCsv = "   \n  \r\n";
	const result = parseAvailabilityCsv(emptyCsv);
	assert.ok(Object.isFrozen(result), "result should be frozen");
	assert.strictEqual(result.profiles.length, 0);
	assert.strictEqual(result.errors.length, 0);
});
