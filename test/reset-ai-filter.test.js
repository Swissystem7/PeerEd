const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const shell = fs.readFileSync(
	path.join(__dirname, "..", "src", "app-shell.html"),
	"utf8",
);

test("resetAiFilter button exists beside peopleAiFilter", () => {
	assert.match(shell, /id="peopleAiFilter"/);
	assert.match(shell, /id="resetAiFilter"/);
	assert.match(shell, /type="button"[^>]*id="resetAiFilter"|id="resetAiFilter"[^>]*type="button"/);
	const filterIdx = shell.indexOf('id="peopleAiFilter"');
	const resetIdx = shell.indexOf('id="resetAiFilter"');
	const countIdx = shell.indexOf('id="ai-filter-count"');
	assert.ok(resetIdx > filterIdx);
	assert.ok(countIdx > resetIdx || countIdx > filterIdx);
});

test("localized reset labels he/ar/ru", () => {
	assert.match(shell, /AI_FILTER_RESET_LABELS/);
	assert.match(shell, /איפוס סינון/);
	assert.match(shell, /إعادة ضبط التصفية/);
	assert.match(shell, /Сбросить фильтр/);
});

test("click clears select to all topics", () => {
	assert.match(shell, /resetAiFilterEl\.addEventListener\('click'/);
	assert.match(shell, /sel\.value = ''/);
	assert.match(shell, /dispatchEvent\(new Event\('change'\)\)/);
});

test("reset refreshes people list / count path", () => {
	assert.match(shell, /resetAiFilter[\s\S]*renderPeople\(\)/);
});
