const test = require("node:test");
const assert = require("node:assert/strict");
const {
	A11Y_SCREENS,
	A11Y_FEATURES,
	A11Y_REQUIREMENTS,
	checkScreenSpec,
} = require("../src/lib/flow.js");

test("A11Y_SCREENS is exactly the expected array in the expected order", () => {
	assert.deepEqual(A11Y_SCREENS, [
		"schedule",
		"capacity",
		"semester",
		"reports",
		"import",
		"wizard",
		"backup",
		"guide",
	]);
});

test("A11Y_FEATURES is exactly the expected array in the expected order", () => {
	assert.deepEqual(A11Y_FEATURES, [
		"label",
		"keyboard",
		"live-region",
		"focus-visible",
		"min-target-44",
		"narrow-360",
	]);
});

test("A11Y_REQUIREMENTS has length 8 and every entry has needs equal to A11Y_FEATURES", () => {
	assert.equal(A11Y_REQUIREMENTS.length, 8);
	for (const req of A11Y_REQUIREMENTS) {
		assert.deepEqual(req.needs, A11Y_FEATURES);
	}
});

test("checkScreenSpec with null or empty object returns unknown-screen error", () => {
	const result1 = checkScreenSpec(null);
	assert.equal(result1.ok, false);
	assert.deepEqual(result1.missing, ["unknown-screen"]);

	const result2 = checkScreenSpec({});
	assert.equal(result2.ok, false);
	assert.deepEqual(result2.missing, ["unknown-screen"]);
});

test("checkScreenSpec with valid screen and all features returns ok true", () => {
	const result = checkScreenSpec({
		screen: "guide",
		features: Array.from(A11Y_FEATURES),
	});
	assert.equal(result.ok, true);
	assert.equal(result.screen, "guide");
	assert.deepEqual(result.missing, []);
});

test("checkScreenSpec with valid screen and missing features returns false with correct missing list", () => {
	const result = checkScreenSpec({
		screen: "guide",
		features: ["label"],
	});
	assert.equal(result.ok, false);
	assert.equal(result.screen, "guide");
	assert.deepEqual(result.missing, [
		"keyboard",
		"live-region",
		"focus-visible",
		"min-target-44",
		"narrow-360",
	]);
});

test("checkScreenSpec with valid screen but no features array returns false with all features missing", () => {
	const result = checkScreenSpec({
		screen: "guide",
	});
	assert.equal(result.ok, false);
	assert.equal(result.screen, "guide");
	assert.deepEqual(result.missing, A11Y_FEATURES);
});

test("checkScreenSpec with valid screen and extra features still returns ok true", () => {
	const result = checkScreenSpec({
		screen: "guide",
		features: [...A11Y_FEATURES, "foo"],
	});
	assert.equal(result.ok, true);
	assert.equal(result.screen, "guide");
	assert.deepEqual(result.missing, []);
});
