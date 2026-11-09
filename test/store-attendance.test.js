const test = require("node:test");
const assert = require("node:assert/strict");

const {
	SCHEMA,
	emptyState,
	serialize,
	deserialize,
	memoryBackend,
	createStore,
} = require("../src/lib/store.js");
const { emptyQueue } = require("../src/lib/approval.js");
const { emptyLog } = require("../src/lib/session.js");
const {
	makeAttendanceLog,
	recordAttendance,
} = require("../src/lib/attendance.js");

test("store attendance: roundtrip keeps durationHours", () => {
	let log = makeAttendanceLog();
	log = recordAttendance(log, {
		pairIndex: 0,
		date: "2026-09-06",
		status: "held",
		durationHours: 1.5,
	});
	log = recordAttendance(log, {
		pairIndex: 1,
		date: "2026-09-07",
		status: "missed",
	});
	const state = Object.freeze({
		people: Object.freeze([]),
		queue: emptyQueue(),
		log: emptyLog(),
		attendance: log.entries,
	});
	const back = deserialize(serialize(state));
	assert.equal(back.attendance.length, 2);
	assert.deepEqual(back.attendance[0], {
		pairIndex: 0,
		date: "2026-09-06",
		status: "held",
		durationHours: 1.5,
	});
	assert.deepEqual(back.attendance[1], {
		pairIndex: 1,
		date: "2026-09-07",
		status: "missed",
		durationHours: 1,
	});
	assert.ok(Object.isFrozen(back.attendance));
	assert.ok(Object.isFrozen(back.attendance[0]));
});

test("store attendance: old document without attendance loads as []", () => {
	const oldDoc = {
		schema: SCHEMA,
		people: [],
		queue: emptyQueue(),
		log: emptyLog(),
	};
	const back = deserialize(JSON.stringify(oldDoc));
	assert.deepEqual(back.attendance, []);
	assert.ok(Object.isFrozen(back.attendance));
});

test("store attendance: emptyState includes frozen attendance []", () => {
	const s = emptyState();
	assert.deepEqual(s.attendance, []);
	assert.ok(Object.isFrozen(s.attendance));
});

test("store attendance: serialize writes attendance key only with allowed fields", () => {
	const text = serialize(emptyState());
	const doc = JSON.parse(text);
	assert.deepEqual(Object.keys(doc).sort(), [
		"attendance",
		"log",
		"people",
		"queue",
		"schema",
	]);
	assert.deepEqual(doc.attendance, []);
});

test("store attendance: zero PII in serialized attendance rows", () => {
	const rows = [
		{
			pairIndex: 0,
			date: "2026-09-06",
			status: "held",
			durationHours: 2,
			name: "דנה",
			phone: "050",
		},
	];
	const state = Object.freeze({
		people: Object.freeze([]),
		queue: emptyQueue(),
		log: emptyLog(),
		attendance: rows,
	});
	const doc = JSON.parse(serialize(state));
	assert.equal(doc.attendance.length, 1);
	assert.deepEqual(Object.keys(doc.attendance[0]).sort(), [
		"date",
		"durationHours",
		"pairIndex",
		"status",
	]);
	assert.equal(JSON.stringify(doc.attendance).includes("דנה"), false);
	assert.equal(JSON.stringify(doc.attendance).includes("050"), false);
});

test("store attendance: createStore save/load roundtrip", () => {
	const backend = memoryBackend();
	const store = createStore(backend, "k-att");
	let log = makeAttendanceLog();
	log = recordAttendance(log, {
		pairIndex: 2,
		date: "2026-10-01",
		status: "held",
		durationHours: 0.5,
	});
	const state = Object.freeze({
		people: Object.freeze([]),
		queue: emptyQueue(),
		log: emptyLog(),
		attendance: log.entries,
	});
	assert.equal(store.save(state), true);
	const loaded = store.load();
	assert.equal(loaded.problem, null);
	assert.deepEqual(loaded.state.attendance, [
		{ pairIndex: 2, date: "2026-10-01", status: "held", durationHours: 0.5 },
	]);
});
