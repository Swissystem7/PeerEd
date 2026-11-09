const test = require("node:test");
const assert = require("node:assert/strict");
const { analyzeCapacity } = require("../src/lib/capacity.js");

function assertEmptyCapacity(res) {
	for (const key of Object.keys(res.bySubject)) {
		assert.equal(
			res.bySubject[key].demand,
			0,
			`demand for subject ${key} must be 0`,
		);
		assert.equal(
			res.bySubject[key].supply,
			0,
			`supply for subject ${key} must be 0`,
		);
		assert.equal(res.bySubject[key].gap, 0, `gap for subject ${key} must be 0`);
		assert.equal(
			res.bySubject[key].neededStudents,
			0,
			`neededStudents for subject ${key} must be 0`,
		);
		assert.equal(
			res.bySubject[key].neededPlaces,
			0,
			`neededPlaces for subject ${key} must be 0`,
		);
	}
	for (const key of Object.keys(res.byRegion)) {
		assert.equal(
			res.byRegion[key].demand,
			0,
			`demand for region ${key} must be 0`,
		);
		assert.equal(
			res.byRegion[key].supply,
			0,
			`supply for region ${key} must be 0`,
		);
		assert.equal(res.byRegion[key].gap, 0, `gap for region ${key} must be 0`);
		assert.equal(
			res.byRegion[key].neededStudents,
			0,
			`neededStudents for region ${key} must be 0`,
		);
		assert.equal(
			res.byRegion[key].neededPlaces,
			0,
			`neededPlaces for region ${key} must be 0`,
		);
	}
	assert.equal(res.alerts.length, 0, "alerts array must be empty");
	assert.equal(res.studentLoad.length, 0, "studentLoad array must be empty");
	assert.deepEqual(res.totals, {
		students: 0,
		pupils: 0,
		supplyPlaces: 0,
		demandPupils: 0,
	});
}

test("analyzeCapacity: empty inputs analyzeCapacity([], []) result in zero gaps and empty alerts", () => {
	const res = analyzeCapacity([], []);
	assertEmptyCapacity(res);
});

test("analyzeCapacity: fallback behavior for analyzeCapacity() with no arguments", () => {
	const res = analyzeCapacity();
	assertEmptyCapacity(res);
});

test("analyzeCapacity: fallback behavior for analyzeCapacity(null, null)", () => {
	const res = analyzeCapacity(null, null);
	assertEmptyCapacity(res);
});

test("analyzeCapacity: single pupil with consent and empty student roster produces gaps and alerts", () => {
	const pupils = [{ subjects: ["MATH"], region: "NORTH", parentConsent: true }];
	const students = [];
	const res = analyzeCapacity(students, pupils);

	// Requested subject
	assert.equal(res.bySubject.MATH.demand, 1);
	assert.equal(res.bySubject.MATH.supply, 0);
	assert.equal(res.bySubject.MATH.gap, 1);
	assert.equal(res.bySubject.MATH.neededPlaces, 1);
	assert.equal(res.bySubject.MATH.neededStudents, 1);

	// Other subjects have gap === 0
	for (const key of Object.keys(res.bySubject)) {
		if (key !== "MATH") {
			assert.equal(res.bySubject[key].demand, 0);
			assert.equal(res.bySubject[key].supply, 0);
			assert.equal(res.bySubject[key].gap, 0);
		}
	}

	// Requested region
	assert.equal(res.byRegion.NORTH.demand, 1);
	assert.equal(res.byRegion.NORTH.supply, 0);
	assert.equal(res.byRegion.NORTH.gap, 1);
	assert.equal(res.byRegion.NORTH.neededPlaces, 1);
	assert.equal(res.byRegion.NORTH.neededStudents, 1);

	// Other regions have gap === 0
	for (const key of Object.keys(res.byRegion)) {
		if (key !== "NORTH") {
			assert.equal(res.byRegion[key].demand, 0);
			assert.equal(res.byRegion[key].supply, 0);
			assert.equal(res.byRegion[key].gap, 0);
		}
	}

	// DEMAND_GT_SUPPLY alerts produced for both subject and region
	assert.equal(res.alerts.length, 2);
	const subjectAlert = res.alerts.find(
		(a) => a.kind === "subject" && a.codeKey === "MATH",
	);
	const regionAlert = res.alerts.find(
		(a) => a.kind === "region" && a.codeKey === "NORTH",
	);
	assert.ok(subjectAlert, "subject alert for MATH must exist");
	assert.equal(subjectAlert.code, "DEMAND_GT_SUPPLY");
	assert.equal(subjectAlert.demand, 1);
	assert.equal(subjectAlert.supply, 0);
	assert.equal(subjectAlert.gap, 1);
	assert.equal(subjectAlert.neededPlaces, 1);
	assert.equal(subjectAlert.neededStudents, 1);

	assert.ok(regionAlert, "region alert for NORTH must exist");
	assert.equal(regionAlert.code, "DEMAND_GT_SUPPLY");
	assert.equal(regionAlert.demand, 1);
	assert.equal(regionAlert.supply, 0);
	assert.equal(regionAlert.gap, 1);
	assert.equal(regionAlert.neededPlaces, 1);
	assert.equal(regionAlert.neededStudents, 1);

	// Totals
	assert.deepEqual(res.totals, {
		students: 0,
		pupils: 1,
		supplyPlaces: 0,
		demandPupils: 1,
	});
});

test("analyzeCapacity: single pupil with consent and non-matching students produces gaps for requested subject and region", () => {
	const pupils = [{ subjects: ["MATH"], region: "NORTH", parentConsent: true }];
	const students = [{ subjects: ["CS"], region: "SOUTH", maxPupils: 1 }];
	const res = analyzeCapacity(students, pupils);

	// Requested subject has gap > 0
	assert.equal(res.bySubject.MATH.demand, 1);
	assert.equal(res.bySubject.MATH.supply, 0);
	assert.equal(res.bySubject.MATH.gap, 1);
	assert.equal(res.bySubject.MATH.neededPlaces, 1);
	assert.equal(res.bySubject.MATH.neededStudents, 1);

	// Other subjects have gap === 0 (CS has supply: 1, demand: 0, gap: 0)
	for (const key of Object.keys(res.bySubject)) {
		if (key !== "MATH") {
			assert.equal(res.bySubject[key].gap, 0);
		}
	}
	assert.equal(res.bySubject.CS.supply, 1);
	assert.equal(res.bySubject.CS.demand, 0);

	// Requested region has gap > 0
	assert.equal(res.byRegion.NORTH.demand, 1);
	assert.equal(res.byRegion.NORTH.supply, 0);
	assert.equal(res.byRegion.NORTH.gap, 1);
	assert.equal(res.byRegion.NORTH.neededPlaces, 1);
	assert.equal(res.byRegion.NORTH.neededStudents, 1);

	// Other regions have gap === 0 (SOUTH has supply: 1, demand: 0, gap: 0)
	for (const key of Object.keys(res.byRegion)) {
		if (key !== "NORTH") {
			assert.equal(res.byRegion[key].gap, 0);
		}
	}
	assert.equal(res.byRegion.SOUTH.supply, 1);
	assert.equal(res.byRegion.SOUTH.demand, 0);

	// Alerts only for the deficient subject and region
	assert.equal(res.alerts.length, 2);
	assert.ok(
		res.alerts.some(
			(a) =>
				a.code === "DEMAND_GT_SUPPLY" &&
				a.kind === "subject" &&
				a.codeKey === "MATH",
		),
	);
	assert.ok(
		res.alerts.some(
			(a) =>
				a.code === "DEMAND_GT_SUPPLY" &&
				a.kind === "region" &&
				a.codeKey === "NORTH",
		),
	);

	// Totals
	assert.deepEqual(res.totals, {
		students: 1,
		pupils: 1,
		supplyPlaces: 1,
		demandPupils: 1,
	});
});

test("analyzeCapacity: single pupil with parentConsent: false is excluded from demand", () => {
	const pupils = [
		{ subjects: ["MATH"], region: "NORTH", parentConsent: false },
	];
	const students = [];
	const res = analyzeCapacity(students, pupils);

	for (const key of Object.keys(res.bySubject)) {
		assert.equal(
			res.bySubject[key].demand,
			0,
			`demand for subject ${key} must be 0`,
		);
		assert.equal(res.bySubject[key].gap, 0, `gap for subject ${key} must be 0`);
	}
	for (const key of Object.keys(res.byRegion)) {
		assert.equal(
			res.byRegion[key].demand,
			0,
			`demand for region ${key} must be 0`,
		);
		assert.equal(res.byRegion[key].gap, 0, `gap for region ${key} must be 0`);
	}
	assert.equal(res.alerts.length, 0, "alerts array must be empty");
	assert.deepEqual(res.totals, {
		students: 0,
		pupils: 0,
		supplyPlaces: 0,
		demandPupils: 0,
	});
});

test("analyzeCapacity: single pupil with omitted parentConsent is excluded from demand", () => {
	const pupils = [{ subjects: ["MATH"], region: "NORTH" }];
	const students = [];
	const res = analyzeCapacity(students, pupils);

	for (const key of Object.keys(res.bySubject)) {
		assert.equal(
			res.bySubject[key].demand,
			0,
			`demand for subject ${key} must be 0`,
		);
		assert.equal(res.bySubject[key].gap, 0, `gap for subject ${key} must be 0`);
	}
	for (const key of Object.keys(res.byRegion)) {
		assert.equal(
			res.byRegion[key].demand,
			0,
			`demand for region ${key} must be 0`,
		);
		assert.equal(res.byRegion[key].gap, 0, `gap for region ${key} must be 0`);
	}
	assert.equal(res.alerts.length, 0, "alerts array must be empty");
	assert.deepEqual(res.totals, {
		students: 0,
		pupils: 0,
		supplyPlaces: 0,
		demandPupils: 0,
	});
});

test("analyzeCapacity: balanced supply and demand yields demand: 1, supply: 1, gap: 0, and no alerts", () => {
	const pupils = [{ subjects: ["MATH"], region: "NORTH", parentConsent: true }];
	const students = [{ subjects: ["MATH"], region: "NORTH", maxPupils: 1 }];
	const res = analyzeCapacity(students, pupils);

	assert.equal(res.bySubject.MATH.demand, 1);
	assert.equal(res.bySubject.MATH.supply, 1);
	assert.equal(res.bySubject.MATH.gap, 0);
	assert.equal(res.bySubject.MATH.neededPlaces, 0);
	assert.equal(res.bySubject.MATH.neededStudents, 0);

	assert.equal(res.byRegion.NORTH.demand, 1);
	assert.equal(res.byRegion.NORTH.supply, 1);
	assert.equal(res.byRegion.NORTH.gap, 0);
	assert.equal(res.byRegion.NORTH.neededPlaces, 0);
	assert.equal(res.byRegion.NORTH.neededStudents, 0);

	// All other subjects and regions have gap === 0
	for (const key of Object.keys(res.bySubject)) {
		assert.equal(res.bySubject[key].gap, 0);
	}
	for (const key of Object.keys(res.byRegion)) {
		assert.equal(res.byRegion[key].gap, 0);
	}

	assert.equal(
		res.alerts.length,
		0,
		"alerts array must be empty for balanced supply and demand",
	);
	assert.deepEqual(res.totals, {
		students: 1,
		pupils: 1,
		supplyPlaces: 1,
		demandPupils: 1,
	});
});
