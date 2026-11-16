const test = require("node:test");
const assert = require("node:assert/strict");
const validator = require("../src/lib/validator.js");
const storeLib = require("../src/lib/store.js");
const { openApp } = require("../test-support/fake-dom.js");

const HEADER = "role,area,aiTopics,aiLevel,slots";

test("1. parses a valid anonymous CSV batch", () => {
	const csv = [HEADER, "student,CENTER,AI_STEM_CODE,beginner,SUN_16|MON_18", "pupil,NORTH,AI_CREATIVE|AI_LIT_PROMPT,,SUN_16"].join("\n");
	const res = validator.parseCsvPilotBatch(csv);
	assert.equal(res.validRows.length, 2);
	assert.equal(res.invalidRows.length, 0);
	assert.equal(res.piiBlockedCount, 0);
	assert.equal(res.validRows[0].role, "student");
	assert.equal(res.validRows[0].area, "CENTER");
	assert.equal(res.validRows[0].region, "CENTER");
	assert.deepEqual([...res.validRows[0].target_ai_topics], ["AI_STEM_CODE"]);
	assert.deepEqual([...res.validRows[0].availability], ["SUN_16", "MON_18"]);
	assert.equal(res.validRows[0].aiLevel, "beginner");
	assert.equal(typeof storeLib.parseCsvPilotBatch, "function");
	assert.deepEqual(storeLib.parseCsvPilotBatch(csv).validRows.length, 2);
});

test("2. blocks rows containing an email and counts them as PII", () => {
	const csv = [HEADER, "student,CENTER,AI_STEM_CODE,,SUN_16", "pupil,SOUTH,dana@example.com,,SUN_16"].join("\n");
	const res = validator.parseCsvPilotBatch(csv);
	assert.equal(res.validRows.length, 1);
	assert.equal(res.invalidRows.length, 1);
	assert.equal(res.piiBlockedCount, 1);
	assert.equal(res.invalidRows[0].isPii, true);
});

test("3. blocks rows containing an Israeli phone number", () => {
	const csv = [HEADER, "pupil,SOUTH,AI_CREATIVE,,050-1234567", "student,HAIFA,AI_ETHICS_SEC,advanced,MON_18"].join("\n");
	const res = validator.parseCsvPilotBatch(csv);
	assert.equal(res.validRows.length, 1);
	assert.equal(res.piiBlockedCount, 1);
	assert.equal(res.invalidRows[0].isPii, true);
});

test("4. blocks every row when the CSV has a name column", () => {
	const csv = ["role,area,name,aiTopics,aiLevel,slots", "student,CENTER,Dana Levi,AI_STEM_CODE,,SUN_16", "pupil,NORTH,Yossi,AI_CREATIVE,,SUN_16"].join("\n");
	const res = validator.parseCsvPilotBatch(csv);
	assert.equal(res.validRows.length, 0);
	assert.equal(res.invalidRows.length, 2);
	assert.equal(res.piiBlockedCount, 2);
});

test("5. collects invalid enum rows without blocking valid ones", () => {
	const csv = [HEADER, "teacher,CENTER,AI_STEM_CODE,,SUN_16", "pupil,ATLANTIS,AI_CREATIVE,,SUN_16", "student,CENTER,AI_STEM_CODE,expert,SUN_16", "student,CENTER,AI_STEM_CODE,,FUNDAY_99", "pupil,SOUTH,AI_LIT_PROMPT,,TUE_17"].join("\n");
	const res = validator.parseCsvPilotBatch(csv);
	assert.equal(res.validRows.length, 1);
	assert.equal(res.invalidRows.length, 4);
	assert.equal(res.piiBlockedCount, 0);
	assert.equal(res.validRows[0].role, "pupil");
	const empty = validator.parseCsvPilotBatch("");
	assert.deepEqual(empty, { validRows: [], invalidRows: [], piiBlockedCount: 0 });
});

test("6. commitPilotCsvBatch adds approved rows into state.people", () => {
	const csv = [HEADER, "student,CENTER,AI_STEM_CODE,beginner,SUN_16|MON_18", "pupil,NORTH,AI_CREATIVE,,SUN_16"].join("\n");
	const { validRows } = validator.parseCsvPilotBatch(csv);
	const s0 = storeLib.emptyState();
	const s1 = storeLib.commitPilotCsvBatch(s0, validRows);
	assert.equal(s0.people.length, 0);
	assert.equal(s1.people.length, 2);
	assert.equal(s1.people[0].role, "student");
	assert.equal(s1.people[0].region, "CENTER");
	assert.deepEqual([...s1.people[0].target_ai_topics], ["AI_STEM_CODE"]);
	assert.equal(s1.people[1].role, "pupil");
	assert.equal(s1.people[1].parentConsent, true);
	assert.equal(typeof validator.commitPilotCsvBatch, "function");
	const mutable = { people: [] };
	const out = validator.commitPilotCsvBatch(mutable, validRows);
	assert.equal(out.people.length, 2);
	assert.equal(mutable.people.length, 2);
});

test("7. preview from the UI in #tab-people shows counts without importing", () => {
	const $ = openApp();
	const tab = $("tab-people");
	assert.ok(tab);
	for (const id of ["pilotCsvInput", "previewPilotCsvBtn", "commitPilotCsvBtn", "pilotCsvPreviewOut", "pilotCsvStatus"]) assert.ok($(id), id + " should exist");
	assert.equal($("previewPilotCsvBtn").getAttribute("type"), "button");
	assert.equal($("previewPilotCsvBtn").getAttribute("aria-describedby"), "pilotCsvStatus");
	assert.equal($("commitPilotCsvBtn").getAttribute("type"), "button");
	assert.equal($("commitPilotCsvBtn").getAttribute("aria-describedby"), "pilotCsvStatus");
	$("pilotCsvInput").value = [HEADER, "student,CENTER,AI_STEM_CODE,,SUN_16", "pupil,SOUTH,dana@example.com,,SUN_16"].join("\n");
	$("previewPilotCsvBtn").fire("click");
	assert.ok($("pilotCsvPreviewOut").textContent.includes("1"));
	assert.ok($("pilotCsvStatus").textContent.includes("1"));
	const raw = $.store[storeLib.DEFAULT_KEY];
	const savedPeople = raw ? storeLib.deserialize(raw).people : [];
	assert.equal(savedPeople.length, 0);
});

test("8. commit from the UI in #tab-people imports valid rows into state.people", () => {
	const $ = openApp();
	$("pilotCsvInput").value = [HEADER, "student,CENTER,AI_STEM_CODE,,SUN_16", "pupil,HAIFA,AI_ETHICS_SEC,,MON_18", "pupil,SOUTH,AI_CREATIVE,,052-1234567"].join("\n");
	$("previewPilotCsvBtn").fire("click");
	$("commitPilotCsvBtn").fire("click");
	const saved = storeLib.deserialize($.store[storeLib.DEFAULT_KEY]);
	assert.equal(saved.people.length, 2);
	assert.equal(saved.people[0].region, "CENTER");
	assert.equal(saved.people[1].region, "HAIFA");
	assert.ok($("peopleList").innerHTML.includes("סטודנט מלמד #1"));
	assert.ok($("pilotCsvStatus").textContent.length > 0);
});

test("9. CSV panel and status are translated in he, ar and ru", () => {
	const $ = openApp();
	$("pilotCsvInput").value = [HEADER, "student,CENTER,AI_STEM_CODE,,SUN_16"].join("\n");
	$("previewPilotCsvBtn").fire("click");
	assert.equal($("pilotCsvHeading").textContent, "ייבוא CSV אנונימי לכיתה");
	assert.ok($("pilotCsvStatus").textContent.includes("תקינות: 1"));
	$("langSelect").value = "ar";
	$("langSelect").fire("change");
	assert.equal($("pilotCsvHeading").textContent, "استيراد CSV مجهول للفصل");
	assert.equal($("previewPilotCsvBtn").textContent, "معاينة");
	assert.ok($("pilotCsvStatus").textContent.includes("صالح: 1"));
	$("langSelect").value = "ru";
	$("langSelect").fire("change");
	assert.equal($("pilotCsvHeading").textContent, "Анонимный импорт CSV для класса");
	assert.equal($("previewPilotCsvBtn").textContent, "Предпросмотр");
	assert.ok($("pilotCsvStatus").textContent.includes("Валидных: 1"));
	$("langSelect").value = "he";
	$("langSelect").fire("change");
	assert.equal($("pilotCsvHeading").textContent, "ייבוא CSV אנונימי לכיתה");
});

test("10. zero PII: valid output and stored state never contain blocked data", () => {
	const csv = [HEADER, "student,CENTER,AI_STEM_CODE,,SUN_16", "pupil,SOUTH,AI_CREATIVE,,dana@example.com"].join("\n");
	const res = validator.parseCsvPilotBatch(csv);
	const json = JSON.stringify(res.validRows);
	assert.equal(json.includes("dana@example.com"), false);
	assert.equal(json.includes('"name"'), false);
	assert.equal(json.includes('"email"'), false);
	assert.equal(json.includes('"phone"'), false);
	const s1 = storeLib.commitPilotCsvBatch(storeLib.emptyState(), res.validRows);
	const stored = JSON.stringify(s1.people);
	assert.equal(stored.includes("dana@example.com"), false);
	const direct = storeLib.commitPilotCsvBatch(storeLib.emptyState(), [{ role: "student", area: "CENTER", email: "leak@x.com" }]);
	assert.equal(direct.people.length, 0);
});
