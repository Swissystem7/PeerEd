const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const {
	FOCUS_READER_FONT_SIZES,
	FOCUS_READER_LINE_WIDTH,
	DEFAULT_FOCUS_READER_CONFIG,
	validateFocusReaderConfig,
	toggleFocusReader,
	setFocusReaderFontSize,
	getFocusReaderStyles,
	formatInlineFormulas,
	saveFocusReaderConfig,
	loadFocusReaderConfig,
	focusReaderConfig,
} = require("../src/lib/attendance.js");
const { memoryBackend } = require("../src/lib/store.js");
const { findPersonalData } = require("../src/lib/validator.js");
const { openApp, ROOT } = require("../test-support/fake-dom.js");

const SCRIPT_TAG = ["<", "script", ">"].join("");
const SCRIPT_CLOSE_TAG = ["<", "/script", ">"].join("");

// 1) DEFAULT_FOCUS_READER_CONFIG is frozen with expected keys and defaults.
test("1) DEFAULT_FOCUS_READER_CONFIG is frozen with expected keys and defaults", () => {
	assert.ok(Object.isFrozen(DEFAULT_FOCUS_READER_CONFIG));
	assert.deepEqual(DEFAULT_FOCUS_READER_CONFIG, {
		enabled: false,
		fontSize: "normal",
		maxWidth: "65ch",
		rtl: true,
		inlineFormulas: true,
	});
	assert.ok(Object.isFrozen(FOCUS_READER_FONT_SIZES));
	assert.deepEqual(FOCUS_READER_FONT_SIZES, ["normal", "large", "huge"]);
	assert.equal(FOCUS_READER_LINE_WIDTH, "65ch");
	assert.ok(Object.isFrozen(focusReaderConfig));
});

// 2) validateFocusReaderConfig handles null, undefined, primitives, and empty objects gracefully.
test("2) validateFocusReaderConfig handles null, undefined, primitives, and empty objects gracefully", () => {
	for (const bad of [
		null,
		undefined,
		42,
		"hello",
		true,
		false,
		Symbol("test"),
		[],
	]) {
		const res = validateFocusReaderConfig(bad);
		assert.ok(Object.isFrozen(res));
		assert.deepEqual(res, DEFAULT_FOCUS_READER_CONFIG);
	}
	const emptyRes = validateFocusReaderConfig({});
	assert.ok(Object.isFrozen(emptyRes));
	assert.deepEqual(emptyRes, DEFAULT_FOCUS_READER_CONFIG);
});

// 3) validateFocusReaderConfig preserves valid configs for normal, large, and huge font sizes.
test("3) validateFocusReaderConfig preserves valid configs for normal, large, and huge font sizes", () => {
	for (const size of ["normal", "large", "huge"]) {
		const config = {
			enabled: true,
			fontSize: size,
			maxWidth: "70ch",
			rtl: false,
			inlineFormulas: false,
		};
		const validated = validateFocusReaderConfig(config);
		assert.ok(Object.isFrozen(validated));
		assert.equal(validated.enabled, true);
		assert.equal(validated.fontSize, size);
		assert.equal(validated.maxWidth, "70ch");
		assert.equal(validated.rtl, false);
		assert.equal(validated.inlineFormulas, false);
	}
});

// 4) validateFocusReaderConfig normalizes invalid font sizes to 'normal'.
test("4) validateFocusReaderConfig normalizes invalid font sizes to 'normal'", () => {
	for (const badSize of [
		"small",
		"extra-large",
		"",
		null,
		undefined,
		123,
		{},
	]) {
		const validated = validateFocusReaderConfig({ fontSize: badSize });
		assert.equal(validated.fontSize, "normal");
	}
});

// 5) toggleFocusReader toggles enabled state and produces frozen object without modifying original.
test("5) toggleFocusReader toggles enabled state and produces frozen object without modifying original", () => {
	const initial = Object.freeze({
		enabled: false,
		fontSize: "large",
		maxWidth: "65ch",
		rtl: true,
		inlineFormulas: true,
	});
	const toggled = toggleFocusReader(initial);
	assert.ok(Object.isFrozen(toggled));
	assert.equal(toggled.enabled, true);
	assert.equal(toggled.fontSize, "large");
	assert.equal(initial.enabled, false);

	const toggledBack = toggleFocusReader(toggled);
	assert.ok(Object.isFrozen(toggledBack));
	assert.equal(toggledBack.enabled, false);
});

// 6) setFocusReaderFontSize changes font size to large or huge, and rejects invalid font size string.
test("6) setFocusReaderFontSize changes font size to large or huge, and rejects invalid font size string", () => {
	const initial = validateFocusReaderConfig({ fontSize: "normal" });
	const large = setFocusReaderFontSize(initial, "large");
	assert.ok(Object.isFrozen(large));
	assert.equal(large.fontSize, "large");

	const huge = setFocusReaderFontSize(large, "huge");
	assert.ok(Object.isFrozen(huge));
	assert.equal(huge.fontSize, "huge");

	const rejected = setFocusReaderFontSize(huge, "invalid-size");
	assert.ok(Object.isFrozen(rejected));
	assert.equal(rejected.fontSize, "huge");
});

// 7) getFocusReaderStyles returns correct CSS properties (maxWidth 65ch, RTL direction, correct rem sizes).
test("7) getFocusReaderStyles returns correct CSS properties (maxWidth 65ch, RTL direction, correct rem sizes)", () => {
	const defaultStyles = getFocusReaderStyles(DEFAULT_FOCUS_READER_CONFIG);
	assert.deepEqual(defaultStyles, {
		maxWidth: "65ch",
		direction: "rtl",
		textAlign: "right",
		fontSize: "1rem",
	});

	const largeStyles = getFocusReaderStyles({ fontSize: "large", rtl: true });
	assert.equal(largeStyles.fontSize, "1.25rem");
	assert.equal(largeStyles.direction, "rtl");
	assert.equal(largeStyles.textAlign, "right");
	assert.equal(largeStyles.maxWidth, "65ch");

	const hugeStyles = getFocusReaderStyles({ fontSize: "huge", rtl: false });
	assert.equal(hugeStyles.fontSize, "1.5rem");
	assert.equal(hugeStyles.direction, "ltr");
	assert.equal(hugeStyles.textAlign, "left");
});

// 8) formatInlineFormulas returns empty string for empty/null/undefined inputs.
test("8) formatInlineFormulas returns empty string for empty/null/undefined inputs", () => {
	assert.equal(formatInlineFormulas(""), "");
	assert.equal(formatInlineFormulas(null), "");
	assert.equal(formatInlineFormulas(undefined), "");
	assert.equal(formatInlineFormulas(12345), "");
	assert.equal(formatInlineFormulas({}), "");
	assert.equal(formatInlineFormulas([]), "");
});

// 9) formatInlineFormulas escapes HTML tags (<script>) to ensure XSS safety.
test("9) formatInlineFormulas escapes HTML tags (<script>) to ensure XSS safety", () => {
	const malicious = `${SCRIPT_TAG}alert("xss")${SCRIPT_CLOSE_TAG}<img src="x" onerror="evil()"/>`;
	const formatted = formatInlineFormulas(malicious);
	assert.equal(formatted.includes(SCRIPT_TAG), false);
	assert.equal(formatted.includes(SCRIPT_CLOSE_TAG), false);
	assert.equal(formatted.includes("&lt;script&gt;"), true);
	assert.equal(formatted.includes("&lt;img src=&quot;x&quot;"), true);
});

// 10) formatInlineFormulas wraps $x + y = z$ in <span class="math-inline" dir="ltr">.
test('10) formatInlineFormulas wraps $x + y = z$ in <span class="math-inline" dir="ltr">', () => {
	const formulaText = "הנוסחה היא $x + y = z$ בדוק תוצאה";
	const formatted = formatInlineFormulas(formulaText);
	assert.ok(
		formatted.includes(
			'<span class="math-inline" dir="ltr">$x + y = z$</span>',
		),
	);

	const latexParen = "נוסחת השטח: \\(A = \\pi r^2\\)";
	const formattedParen = formatInlineFormulas(latexParen);
	assert.ok(
		formattedParen.includes(
			'<span class="math-inline" dir="ltr">\\(A = \\pi r^2\\)</span>',
		),
	);
});

// 11) saveFocusReaderConfig persists normalized JSON into backend (using memoryBackend from store.js).
test("11) saveFocusReaderConfig persists normalized JSON into backend (using memoryBackend from store.js)", () => {
	const backend = memoryBackend();
	const configToSave = { enabled: true, fontSize: "large" };
	const result = saveFocusReaderConfig(backend, configToSave);
	assert.deepEqual(result, { ok: true });

	const stored = backend.getItem("peered_focus_reader_v1");
	assert.ok(stored, "stored data should exist");
	const parsed = JSON.parse(stored);
	assert.equal(parsed.enabled, true);
	assert.equal(parsed.fontSize, "large");
	assert.equal(parsed.maxWidth, "65ch");
	assert.equal(parsed.rtl, true);
	assert.equal(parsed.inlineFormulas, true);
});

// 12) saveFocusReaderConfig catches storage exceptions (e.g. QuotaExceededError) and returns { ok: false }.
test("12) saveFocusReaderConfig catches storage exceptions (e.g. QuotaExceededError) and returns { ok: false }", () => {
	const throwingBackend = {
		getItem: () => null,
		setItem: () => {
			const err = new Error("QuotaExceededError: storage limit reached");
			err.name = "QuotaExceededError";
			throw err;
		},
		removeItem: () => {},
	};

	const res = saveFocusReaderConfig(throwingBackend, { enabled: true });
	assert.equal(res.ok, false);
	assert.ok(typeof res.error === "string");
	assert.ok(res.error.includes("QuotaExceededError"));
});

// 13) loadFocusReaderConfig retrieves saved config and returns normalized object.
test("13) loadFocusReaderConfig retrieves saved config and returns normalized object", () => {
	const backend = memoryBackend();
	const customKey = "custom_reader_key";
	saveFocusReaderConfig(
		backend,
		{ enabled: true, fontSize: "huge" },
		customKey,
	);

	const loaded = loadFocusReaderConfig(backend, customKey);
	assert.ok(Object.isFrozen(loaded));
	assert.equal(loaded.enabled, true);
	assert.equal(loaded.fontSize, "huge");
	assert.equal(loaded.maxWidth, "65ch");
});

// 14) loadFocusReaderConfig returns default config on null/empty/corrupted JSON.
test("14) loadFocusReaderConfig returns default config on null/empty/corrupted JSON", () => {
	const backend = memoryBackend();
	assert.deepEqual(loadFocusReaderConfig(backend), DEFAULT_FOCUS_READER_CONFIG);

	backend.setItem("peered_focus_reader_v1", "   ");
	assert.deepEqual(loadFocusReaderConfig(backend), DEFAULT_FOCUS_READER_CONFIG);

	backend.setItem("peered_focus_reader_v1", "{corrupted json :::");
	assert.deepEqual(loadFocusReaderConfig(backend), DEFAULT_FOCUS_READER_CONFIG);

	assert.deepEqual(loadFocusReaderConfig(null), DEFAULT_FOCUS_READER_CONFIG);
});

// 15) Full roundtrip: configure -> save -> load -> match properties.
test("15) Full roundtrip: configure -> save -> load -> match properties", () => {
	const backend = memoryBackend();
	let config = validateFocusReaderConfig({});
	config = toggleFocusReader(config);
	config = setFocusReaderFontSize(config, "large");

	const saveRes = saveFocusReaderConfig(backend, config);
	assert.equal(saveRes.ok, true);

	const loaded = loadFocusReaderConfig(backend);
	assert.deepEqual(loaded, config);
	assert.equal(loaded.enabled, true);
	assert.equal(loaded.fontSize, "large");
	assert.equal(loaded.maxWidth, "65ch");
	assert.equal(loaded.rtl, true);
	assert.equal(loaded.inlineFormulas, true);
});

// 16) Zero PII verification with validator.findPersonalData.
test("16) Zero PII verification with validator.findPersonalData", () => {
	const testConfig = {
		enabled: true,
		fontSize: "large",
		maxWidth: "65ch",
		rtl: true,
		inlineFormulas: true,
	};
	const styles = getFocusReaderStyles(testConfig);
	const mathFormatted = formatInlineFormulas(
		"נוסחה $x + y = 10$ וקריאה ממוקדת",
	);
	const payload = JSON.stringify({
		testConfig,
		styles,
		mathFormatted,
		keys: Object.keys(focusReaderConfig),
	});

	const findings = findPersonalData(payload);
	assert.deepEqual(
		findings,
		[],
		"Focus reader config and styles must leak zero personal data",
	);
});

// 17) app.html exposes focus reader functions on window and includes required CSS rules.
test("17) app.html exposes focus reader functions on window and includes required CSS rules", () => {
	const appHtml = fs.readFileSync(path.join(ROOT, "app.html"), "utf8");
	assert.ok(
		appHtml.includes(".focus-reader-view"),
		"CSS should define .focus-reader-view",
	);
	assert.ok(
		appHtml.includes(".focus-reader-view.font-normal"),
		"CSS should define .font-normal",
	);
	assert.ok(
		appHtml.includes(".focus-reader-view.font-large"),
		"CSS should define .font-large",
	);
	assert.ok(
		appHtml.includes(".focus-reader-view.font-huge"),
		"CSS should define .font-huge",
	);
	assert.ok(
		appHtml.includes("span.math-inline"),
		"CSS should define span.math-inline",
	);

	openApp();
	assert.ok(
		appHtml.includes("window.focusReaderConfig = attendance.focusReaderConfig"),
	);
	assert.ok(
		appHtml.includes(
			"window.validateFocusReaderConfig = attendance.validateFocusReaderConfig",
		),
	);
	assert.ok(
		appHtml.includes("window.toggleFocusReader = attendance.toggleFocusReader"),
	);
	assert.ok(
		appHtml.includes(
			"window.setFocusReaderFontSize = attendance.setFocusReaderFontSize",
		),
	);
	assert.ok(
		appHtml.includes(
			"window.getFocusReaderStyles = attendance.getFocusReaderStyles",
		),
	);
	assert.ok(
		appHtml.includes(
			"window.formatInlineFormulas = attendance.formatInlineFormulas",
		),
	);
	assert.ok(
		appHtml.includes(
			"window.saveFocusReaderConfig = attendance.saveFocusReaderConfig",
		),
	);
	assert.ok(
		appHtml.includes(
			"window.loadFocusReaderConfig = attendance.loadFocusReaderConfig",
		),
	);
});
