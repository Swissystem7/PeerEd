const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const shell = fs.readFileSync(
	path.join(__dirname, "..", "src", "app-shell.html"),
	"utf8",
);

test("ai-filter-count element exists next to peopleAiFilter", () => {
	assert.match(shell, /id="peopleAiFilter"/);
	assert.match(shell, /id="ai-filter-count"/);
	const filterIdx = shell.indexOf('id="peopleAiFilter"');
	const countIdx = shell.indexOf('id="ai-filter-count"');
	assert.ok(countIdx > filterIdx);
});

test("updateAiFilterCount helper present", () => {
	assert.match(shell, /function updateAiFilterCount/);
	assert.match(shell, /AI_FILTER_COUNT_LABELS/);
});

test("localized count labels he/ar/ru", () => {
	assert.match(shell, /סה״כ משתתפים/);
	assert.match(shell, /إجمالي المشاركين/);
	assert.match(shell, /Всего участников/);
	assert.match(shell, /מוצגים \{shown\} מתוך \{total\}/);
});

test("renderPeople updates the count", () => {
	assert.match(shell, /updateAiFilterCount\(rows\.length, state\.people\.length\)/);
	assert.match(shell, /updateAiFilterCount\(0, state\.people\.length\)/);
});
