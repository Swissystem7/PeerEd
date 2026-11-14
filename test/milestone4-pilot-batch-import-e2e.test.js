const test = require("node:test");
const assert = require("node:assert/strict");
const { validateBatchImportZeroPii: validateFromValidator } = require("../src/lib/validator.js");
const { validateBatchImportZeroPii: validateFromStore, createStore, memoryBackend, deserialize, DEFAULT_KEY } = require("../src/lib/store.js");
const { openApp } = require("../test-support/fake-dom.js");

// 1. קבלה של רשומות אנונימיות תקינות
test("1. acceptance of valid anonymous records with role, area, and target_ai_topics", () => {
	const validRecords = [
		{
			role: "student",
			area: "CENTER",
			target_ai_topics: ["AI_STEM_CODE"],
		},
		{
			role: "pupil",
			area: "NORTH",
			target_ai_topics: ["AI_CREATIVE", "AI_LIT_PROMPT"],
			availability: ["SUN_16", "MON_18"],
			subjects: ["MATH", "PHYSICS"],
			parentConsent: true,
		},
		{
			role: "student",
			region: "HAIFA",
			target_ai_topics: ["AI_ETHICS_SEC"],
		},
	];

	const res = validateFromValidator(validRecords);
	assert.equal(res.accepted.length, 3);
	assert.equal(res.rejectedCount, 0);
	assert.equal(res.reasons.length, 0);

	assert.equal(res.accepted[0].role, "student");
	assert.equal(res.accepted[0].area, "CENTER");
	assert.equal(res.accepted[0].region, "CENTER");
	assert.deepEqual(res.accepted[0].target_ai_topics, ["AI_STEM_CODE"]);
	assert.ok(res.accepted[0].availability.length > 0);
	assert.ok(res.accepted[0].subjects.length > 0);

	assert.equal(res.accepted[1].role, "pupil");
	assert.equal(res.accepted[1].area, "NORTH");
	assert.equal(res.accepted[1].region, "NORTH");
	assert.deepEqual(res.accepted[1].target_ai_topics, ["AI_CREATIVE", "AI_LIT_PROMPT"]);
	assert.equal(res.accepted[1].parentConsent, true);

	assert.equal(res.accepted[2].role, "student");
	assert.equal(res.accepted[2].area, "HAIFA");
	assert.equal(res.accepted[2].region, "HAIFA");
	assert.deepEqual(res.accepted[2].target_ai_topics, ["AI_ETHICS_SEC"]);
});

// 2. דחייה של רשומות עם אימייל/טלפון/שם
test("2. rejection of records containing PII fields and PII string patterns", () => {
	const piiRecords = [
		{ role: "student", area: "CENTER", name: "Israel Israeli" },
		{ role: "pupil", area: "NORTH", email: "student@school.edu" },
		{ role: "student", area: "HAIFA", phone: "050-1234567" },
		{ role: "pupil", area: "SOUTH", studentName: "Dana Levi" },
		{ role: "student", area: "CENTER", pupilName: "Yossi" },
		{ role: "student", area: "TEL_AVIV", idNumber: "123456789" },
		{ role: "pupil", area: "JERUSALEM", note: "reach me at 0541234567" },
		{ role: "student", area: "CENTER", note: "contact: teacher@example.com" },
		{ role: "pupil", area: "NORTH", target_ai_topics: ["AI_STEM_CODE", "leak@gmail.com"] },
		{ role: "student", area: "SOUTH", name: "" },
	];

	const res = validateFromValidator(piiRecords);
	assert.equal(res.accepted.length, 0);
	assert.equal(res.rejectedCount, piiRecords.length);
	assert.equal(res.reasons.length, piiRecords.length);

	for (const reason of res.reasons) {
		assert.ok(reason.includes("contains PII"), `Expected PII rejection reason, got: ${reason}`);
	}
});

// 3. סינון aiTopics לא חוקיים
test("3. filtering of invalid aiTopics while retaining valid keys", () => {
	const recordsWithJunkTopics = [
		{
			role: "student",
			area: "CENTER",
			target_ai_topics: ["AI_STEM_CODE", "UNKNOWN_TOPIC", "AI_CREATIVE", "INVALID_123"],
		},
		{
			role: "pupil",
			area: "SOUTH",
			target_ai_topics: ["AI_ETHICS_SEC", "RANDOM_STRING"],
		},
		{
			role: "student",
			area: "NORTH",
			target_ai_topics: ["NON_EXISTENT_KEY"],
		},
	];

	const res = validateFromValidator(recordsWithJunkTopics);
	assert.equal(res.accepted.length, 3);
	assert.equal(res.rejectedCount, 0);

	assert.deepEqual(res.accepted[0].target_ai_topics, ["AI_STEM_CODE", "AI_CREATIVE"]);
	assert.deepEqual(res.accepted[1].target_ai_topics, ["AI_ETHICS_SEC"]);
	assert.deepEqual(res.accepted[2].target_ai_topics, []);
});

// 4. אימות ספירת accepted ו-rejectedCount
test("4. accurate counting of accepted and rejectedCount across mixed records", () => {
	const mixedBatch = [
		{ role: "student", area: "CENTER", target_ai_topics: ["AI_STEM_CODE"] },
		null,
		"invalid non-object string",
		{ role: "teacher", area: "CENTER" }, // invalid role
		{ role: "pupil", area: "ATLANTIS" }, // invalid area
		{ role: "pupil", area: "NORTH", email: "secret@test.com" }, // PII
		{ role: "pupil", area: "SOUTH", target_ai_topics: ["AI_LIT_PROMPT"] },
	];

	const res = validateFromValidator(mixedBatch);
	assert.equal(res.accepted.length, 2);
	assert.equal(res.rejectedCount, 5);
	assert.equal(res.reasons.length, 5);

	// Empty array
	const emptyRes = validateFromValidator([]);
	assert.equal(emptyRes.accepted.length, 0);
	assert.equal(emptyRes.rejectedCount, 0);
	assert.equal(emptyRes.reasons.length, 0);

	// Non-array
	const nonArrayRes = validateFromValidator(null);
	assert.equal(nonArrayRes.accepted.length, 0);
	assert.equal(nonArrayRes.rejectedCount, 0);
	assert.equal(nonArrayRes.reasons.length, 1);
});

// 5. אינטגרציית כפתור האימות ב-#tab-people והצגת סטטוס
test("5. UI integration of #pilotBatchInput and #validatePilotBatchBtn in #tab-people", () => {
	const $ = openApp();

	const input = $("pilotBatchInput");
	const validateBtn = $("validatePilotBatchBtn");
	const status = $("pilotBatchStatus");

	assert.ok(input, "#pilotBatchInput should exist");
	assert.ok(validateBtn, "#validatePilotBatchBtn should exist");
	assert.ok(status, "#pilotBatchStatus should exist");

	assert.equal(validateBtn.getAttribute("type"), "button");
	assert.equal(validateBtn.getAttribute("aria-describedby"), "pilotBatchStatus");

	// Validate empty input
	input.value = "";
	validateBtn.fire("click");
	assert.ok(status.textContent.length > 0);
	assert.ok(status.className.includes("bad"));

	// Validate invalid JSON
	input.value = "not valid json";
	validateBtn.fire("click");
	assert.ok(status.textContent.includes("JSON"));

	// Validate valid batch with mixed records
	const testBatch = [
		{ role: "student", area: "CENTER", target_ai_topics: ["AI_STEM_CODE"] },
		{ role: "pupil", area: "NORTH", target_ai_topics: ["AI_CREATIVE"] },
		{ role: "pupil", area: "SOUTH", email: "leak@school.edu" },
	];
	input.value = JSON.stringify(testBatch);
	validateBtn.fire("click");

	// Status should report 2 approved and 1 rejected
	assert.ok(status.textContent.includes("2"), `Status should show 2 approved: ${status.textContent}`);
	assert.ok(status.textContent.includes("1"), `Status should show 1 rejected: ${status.textContent}`);
	assert.ok(status.textContent.includes("אושרו"));
	assert.ok(status.textContent.includes("נדחו"));
});

// 6. אינטגרציית כפתור האישור ב-#tab-people ועדכון state.people
test("6. UI integration of #confirmPilotBatchBtn updating state.people and rendering in #peopleList", () => {
	const $ = openApp();

	const input = $("pilotBatchInput");
	const confirmBtn = $("confirmPilotBatchBtn");
	const status = $("pilotBatchStatus");

	assert.ok(confirmBtn, "#confirmPilotBatchBtn should exist");
	assert.equal(confirmBtn.getAttribute("type"), "button");
	assert.equal(confirmBtn.getAttribute("aria-describedby"), "pilotBatchStatus");

	const batchToImport = [
		{ role: "student", area: "CENTER", target_ai_topics: ["AI_STEM_CODE"] },
		{ role: "pupil", area: "HAIFA", target_ai_topics: ["AI_ETHICS_SEC"] },
		{ role: "pupil", area: "JERUSALEM", phone: "0509999999" }, // Rejected PII
	];

	input.value = JSON.stringify(batchToImport);
	confirmBtn.fire("click");

	// Status should report 2 approved and 1 rejected
	assert.ok(status.textContent.includes("2"));
	assert.ok(status.textContent.includes("1"));

	// Check state.people was saved into storage with exactly 2 accepted participants
	const savedState = deserialize($.store[DEFAULT_KEY]);
	const people = savedState.people;
	assert.equal(people.length, 2);
	assert.equal(people[0].role, "student");
	assert.equal(people[0].region, "CENTER");
	assert.deepEqual(people[0].target_ai_topics, ["AI_STEM_CODE"]);
	assert.equal(people[1].role, "pupil");
	assert.equal(people[1].region, "HAIFA");
	assert.deepEqual(people[1].target_ai_topics, ["AI_ETHICS_SEC"]);

	// #peopleList should reflect the imported participants
	const peopleListHtml = $("peopleList").innerHTML;
	assert.ok(peopleListHtml.includes("סטודנט מלמד #1"));
	assert.ok(peopleListHtml.includes("תלמיד #2"));
});

// 7. תרגום he/ar/ru של הודעת הסטטוס והפאנל
test("7. multilingual status messages in Hebrew, Arabic, and Russian", () => {
	const $ = openApp();

	const input = $("pilotBatchInput");
	const validateBtn = $("validatePilotBatchBtn");
	const status = $("pilotBatchStatus");

	const testBatch = [
		{ role: "student", area: "CENTER", target_ai_topics: ["AI_STEM_CODE"] },
		{ role: "pupil", area: "NORTH", name: "Leaked Name" },
	];
	input.value = JSON.stringify(testBatch);

	// Hebrew (default)
	validateBtn.fire("click");
	assert.ok(status.textContent.includes("אושרו: 1"));
	assert.ok(status.textContent.includes("נדחו: 1"));

	// Switch to Arabic
	$("langSelect").value = "ar";
	$("langSelect").fire("change");
	assert.ok(status.textContent.includes("تم قبول: 1"));
	assert.ok(status.textContent.includes("تم رفض: 1"));
	assert.equal($("pilotBatchHeading").textContent, "استيراد دفعة للبرنامج التجريبي");
	assert.equal($("validatePilotBatchBtn").textContent, "التحقق من الدفعة");

	// Switch to Russian
	$("langSelect").value = "ru";
	$("langSelect").fire("change");
	assert.ok(status.textContent.includes("Одобрено: 1"));
	assert.ok(status.textContent.includes("отклонено: 1"));
	assert.equal($("pilotBatchHeading").textContent, "Пакетный импорт для пилота");
	assert.equal($("validatePilotBatchBtn").textContent, "Проверить пакет");

	// Switch back to Hebrew
	$("langSelect").value = "he";
	$("langSelect").fire("change");
	assert.ok(status.textContent.includes("אושרו: 1"));
	assert.ok(status.textContent.includes("נדחו: 1"));
	assert.equal($("pilotBatchHeading").textContent, "ייבוא אצווה לפיילוט");
	assert.equal($("validatePilotBatchBtn").textContent, "אימות אצווה");
});

// 8. אפס PII בכל השכבות
test("8. strict zero PII guarantee in validation logic, storage, and UI", () => {
	const contaminatedBatch = [
		{
			role: "student",
			area: "CENTER",
			target_ai_topics: ["AI_STEM_CODE"],
			name: "Israel Israeli",
			email: "leak@peered.org",
			phone: "050-1112233",
		},
		{
			role: "pupil",
			area: "TEL_AVIV",
			target_ai_topics: ["AI_CREATIVE"],
			note: "contact 052-3344556 or email test@gov.il",
		},
	];

	const res = validateFromValidator(contaminatedBatch);
	assert.equal(res.accepted.length, 0);
	assert.equal(res.rejectedCount, 2);

	// Ensure reasons do not leak personal data
	for (const r of res.reasons) {
		assert.ok(!r.includes("Israel Israeli"));
		assert.ok(!r.includes("leak@peered.org"));
		assert.ok(!r.includes("050-1112233"));
		assert.ok(!r.includes("052-3344556"));
		assert.ok(!r.includes("test@gov.il"));
	}

	// Ensure accepted output is free of PII keys
	const cleanRes = validateFromValidator([
		{ role: "student", area: "SOUTH", target_ai_topics: ["AI_STEM_CODE"] },
	]);
	const jsonOut = JSON.stringify(cleanRes.accepted);
	for (const piiKey of ["name", "email", "phone", "studentName", "pupilName", "address"]) {
		assert.equal(jsonOut.includes(`"${piiKey}"`), false, `Output JSON should not contain key: ${piiKey}`);
	}
});

// 9. ייבוא ואימות דרך store.js ותאימות שמירה
test("9. validateBatchImportZeroPii in store.js and persistence roundtrip", () => {
	// Function must be exported from store.js
	assert.equal(typeof validateFromStore, "function");

	const batch = [
		{ role: "student", area: "CENTER", target_ai_topics: ["AI_STEM_CODE"] },
		{ role: "pupil", area: "HAIFA", target_ai_topics: ["AI_ETHICS_SEC"] },
	];

	const valRes = validateFromValidator(batch);
	const storeRes = validateFromStore(batch);
	assert.deepEqual(valRes, storeRes);

	// Test store save and reload with imported participants
	const backend = memoryBackend();
	const store = createStore(backend, "test_store_batch");

	const loaded = store.load();
	const state = { ...loaded.state, people: storeRes.accepted.slice() };
	assert.ok(store.save(state));

	const reloaded = store.load();
	assert.equal(reloaded.problem, null);
	assert.equal(reloaded.state.people.length, 2);
	assert.equal(reloaded.state.people[0].role, "student");
	assert.equal(reloaded.state.people[0].region, "CENTER");
	assert.deepEqual(reloaded.state.people[0].target_ai_topics, ["AI_STEM_CODE"]);
});

// 10. אימות חוסן קלט UI ושגיאות תחביר
test("10. robustness with non-array JSON inputs and empty confirm clicks", () => {
	const $ = openApp();
	const input = $("pilotBatchInput");
	const confirmBtn = $("confirmPilotBatchBtn");
	const status = $("pilotBatchStatus");

	// Non-array JSON input (e.g. single object)
	input.value = JSON.stringify({ role: "student", area: "CENTER" });
	confirmBtn.fire("click");
	assert.ok(status.textContent.includes("מערך") || status.textContent.includes("JSON") || status.textContent.includes("مصفوفة"));

	// Empty click on confirm
	input.value = "";
	confirmBtn.fire("click");
	assert.ok(status.textContent.includes("JSON"));
});
