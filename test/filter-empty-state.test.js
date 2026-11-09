const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const shell = fs.readFileSync(
	path.join(__dirname, "..", "src", "app-shell.html"),
	"utf8",
);

test("ai-filter-empty-message element exists in tab-people area", () => {
	assert.match(shell, /id="ai-filter-empty-message"/);
	assert.match(shell, /id="peopleAiFilter"/);
	const filterIdx = shell.indexOf('id="peopleAiFilter"');
	const emptyIdx = shell.indexOf('id="ai-filter-empty-message"');
	assert.ok(emptyIdx > filterIdx);
});

test("trilingual empty-state copy", () => {
	assert.match(shell, /לא נמצאו משתתפים בנושא זה/);
	assert.match(shell, /لم يتم العثور على مشاركين في هذا الموضوع/);
	assert.match(shell, /Участники по этой теме не найдены/);
});

test("setAiFilterEmptyMessage helper toggles visibility", () => {
	assert.match(shell, /function setAiFilterEmptyMessage/);
	assert.match(shell, /el\.hidden = false/);
	assert.match(shell, /el\.hidden = true/);
});

test("empty shown on no matches and hidden when results or reset path", () => {
	assert.match(shell, /setAiFilterEmptyMessage\(true\)/);
	assert.match(shell, /setAiFilterEmptyMessage\(false\)/);
});
