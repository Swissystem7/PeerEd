const test = require("node:test");
const assert = require("node:assert/strict");
const { stepTab, KEYS, DIRECTIONS } = require("../src/lib/tabnav.js");

test("tabnav constants: KEYS and DIRECTIONS are frozen arrays with expected elements", () => {
	assert.ok(Object.isFrozen(KEYS));
	assert.ok(Object.isFrozen(DIRECTIONS));
	assert.deepEqual(KEYS, ["ArrowLeft", "ArrowRight", "Home", "End"]);
	assert.deepEqual(DIRECTIONS, ["rtl", "ltr"]);
});

test("RTL wrapping: ArrowLeft from last tab wraps to 0 across various counts", () => {
	const counts = [2, 3, 5, 10];
	for (const count of counts) {
		assert.equal(
			stepTab(count, count - 1, "ArrowLeft", "rtl"),
			0,
			`RTL ArrowLeft from index ${count - 1} of ${count} tabs must wrap to 0`,
		);
	}
});

test("RTL wrapping: ArrowRight from index 0 wraps to count - 1 across various counts", () => {
	const counts = [2, 3, 5, 10];
	for (const count of counts) {
		assert.equal(
			stepTab(count, 0, "ArrowRight", "rtl"),
			count - 1,
			`RTL ArrowRight from index 0 of ${count} tabs must wrap to ${count - 1}`,
		);
	}
});

test("LTR wrapping: ArrowRight from last tab wraps to 0 across various counts", () => {
	const counts = [2, 3, 5, 10];
	for (const count of counts) {
		assert.equal(
			stepTab(count, count - 1, "ArrowRight", "ltr"),
			0,
			`LTR ArrowRight from index ${count - 1} of ${count} tabs must wrap to 0`,
		);
	}
});

test("LTR wrapping: ArrowLeft from index 0 wraps to count - 1 across various counts", () => {
	const counts = [2, 3, 5, 10];
	for (const count of counts) {
		assert.equal(
			stepTab(count, 0, "ArrowLeft", "ltr"),
			count - 1,
			`LTR ArrowLeft from index 0 of ${count} tabs must wrap to ${count - 1}`,
		);
	}
});

test("Home and End navigation: Home returns 0 and End returns count - 1 from every index in both rtl and ltr", () => {
	const counts = [1, 2, 3, 5, 10];
	for (const count of counts) {
		for (let current = 0; current < count; current += 1) {
			for (const dir of DIRECTIONS) {
				assert.equal(
					stepTab(count, current, "Home", dir),
					0,
					`Home from index ${current} in ${dir} (count ${count}) must return 0`,
				);
				assert.equal(
					stepTab(count, current, "End", dir),
					count - 1,
					`End from index ${current} in ${dir} (count ${count}) must return ${count - 1}`,
				);
			}
		}
	}
});

test("Single-tab edge case (count = 1, current = 0): all navigation keys evaluate to 0 in both directions", () => {
	for (const dir of DIRECTIONS) {
		for (const key of ["ArrowLeft", "ArrowRight", "Home", "End"]) {
			assert.equal(
				stepTab(1, 0, key, dir),
				0,
				`count=1, current=0 with key=${key} and dir=${dir} must return 0`,
			);
		}
	}
});

test("Invalid and unhandled keys: keys outside KEYS return -1", () => {
	const unhandledKeys = [
		"Tab",
		"Enter",
		"Escape",
		"ArrowUp",
		"ArrowDown",
		" ",
		"a",
		"PageUp",
		"PageDown",
		"",
		undefined,
		null,
	];
	for (const dir of DIRECTIONS) {
		for (const key of unhandledKeys) {
			assert.equal(
				stepTab(5, 2, key, dir),
				-1,
				`key ${String(key)} should return -1 in ${dir}`,
			);
			assert.equal(
				stepTab(1, 0, key, dir),
				-1,
				`key ${String(key)} should return -1 for single tab in ${dir}`,
			);
		}
	}
});

test("Parameter validation errors: non-positive or non-integer count throws /invalid tab count/", () => {
	const invalidCounts = [
		0,
		-1,
		-5,
		1.5,
		3.14,
		"3",
		"0",
		null,
		undefined,
		Number.NaN,
		Number.POSITIVE_INFINITY,
		Number.NEGATIVE_INFINITY,
		true,
		false,
		{},
		[],
	];
	for (const count of invalidCounts) {
		assert.throws(
			() => stepTab(count, 0, "Home", "rtl"),
			/invalid tab count/,
			`count ${String(count)} must throw /invalid tab count/`,
		);
	}
});

test("Parameter validation errors: out-of-range or non-integer current tab throws /invalid current tab/", () => {
	const count = 5;
	const invalidCurrents = [
		-1,
		-10,
		count,
		count + 1,
		100,
		1.5,
		0.5,
		"0",
		"1",
		null,
		undefined,
		Number.NaN,
		Number.POSITIVE_INFINITY,
		Number.NEGATIVE_INFINITY,
		true,
		false,
		{},
		[],
	];
	for (const current of invalidCurrents) {
		assert.throws(
			() => stepTab(count, current, "Home", "rtl"),
			/invalid current tab/,
			`current ${String(current)} for count ${count} must throw /invalid current tab/`,
		);
	}
});

test("Parameter validation errors: invalid directions throw /invalid direction/", () => {
	const invalidDirs = [
		"auto",
		"top",
		"bottom",
		"vertical",
		"horizontal",
		"",
		undefined,
		null,
		123,
		"RTL",
		"LTR",
		"right-to-left",
		{},
		[],
	];
	for (const dir of invalidDirs) {
		assert.throws(
			() => stepTab(5, 0, "Home", dir),
			/invalid direction/,
			`direction ${String(dir)} must throw /invalid direction/`,
		);
	}
});
