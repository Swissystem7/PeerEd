const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const {
	escapeHtml,
	highlightSearchHits,
	filterSummaryItems,
	renderEmptyState,
	searchHighlight,
} = require("../src/lib/attendance.js");
const { openApp, ROOT } = require("../test-support/fake-dom.js");
const { findPersonalData } = require("../src/lib/validator.js");

const SCRIPT_TAG = ["<", "script", ">"].join("");
const SCRIPT_CLOSE_TAG = ["<", "/script", ">"].join("");

// 1) highlightSearchHits returns empty string for empty, null, or undefined text.
test("1) highlightSearchHits returns empty string for empty, null, or undefined text", () => {
	assert.equal(highlightSearchHits("", "test"), "");
	assert.equal(highlightSearchHits(null, "test"), "");
	assert.equal(highlightSearchHits(undefined, "test"), "");
	assert.equal(highlightSearchHits(123, "test"), "");
	assert.equal(highlightSearchHits({}, "test"), "");
	assert.equal(highlightSearchHits(false, "test"), "");
});

// 2) highlightSearchHits returns escaped text without <mark> for empty query string.
test("2) highlightSearchHits returns escaped text without <mark> for empty query string", () => {
	assert.equal(highlightSearchHits("שלום עולם", ""), "שלום עולם");
	assert.equal(
		highlightSearchHits("hello <world> & friends", ""),
		"hello &lt;world&gt; &amp; friends",
	);
	assert.equal(
		highlightSearchHits("quotes: \"single\" 'test'", ""),
		"quotes: &quot;single&quot; &#39;test&#39;",
	);
});

// 3) highlightSearchHits returns escaped text without <mark> for whitespace-only query.
test("3) highlightSearchHits returns escaped text without <mark> for whitespace-only query", () => {
	assert.equal(highlightSearchHits("שלום עולם", "   "), "שלום עולם");
	assert.equal(
		highlightSearchHits("hello <world>", "\t  \n  "),
		"hello &lt;world&gt;",
	);
	assert.equal(highlightSearchHits("טקסט לבדיקה", null), "טקסט לבדיקה");
	assert.equal(highlightSearchHits("טקסט לבדיקה", undefined), "טקסט לבדיקה");
	assert.equal(highlightSearchHits("טקסט לבדיקה", 456), "טקסט לבדיקה");
});

// 4) XSS neutralization: <script>alert(1)</script> in text is converted to &lt;script&gt; and not executable.
test("4) XSS neutralization: <script>alert(1)</script> in text is converted to &lt;script&gt; and not executable", () => {
	const raw = '<script>alert("xss")</script>';
	const res = highlightSearchHits(raw, "alert");
	assert.equal(
		res,
		'&lt;script&gt;<mark class="search-hit">alert</mark>(&quot;xss&quot;)&lt;/script&gt;',
	);
	assert.equal(res.indexOf(SCRIPT_TAG), -1);
	assert.equal(res.indexOf(SCRIPT_CLOSE_TAG), -1);

	const rawImg = '<img src=x onerror="alert(1)">';
	const resImg = highlightSearchHits(rawImg, "onerror");
	assert.equal(
		resImg,
		'&lt;img src=x <mark class="search-hit">onerror</mark>=&quot;alert(1)&quot;&gt;',
	);
	assert.equal(resImg.includes("<img"), false);
});

// 5) XSS query neutralization: <script> in query does not inject tags into the output.
test("5) XSS query neutralization: <script> in query does not inject tags into the output", () => {
	const res = highlightSearchHits("hello world", "<script>alert(1)</script>");
	assert.equal(res, "hello world");
	assert.equal(res.indexOf(SCRIPT_TAG), -1);

	const res2 = highlightSearchHits("<script>", "<script>");
	assert.equal(res2, '<mark class="search-hit">&lt;script&gt;</mark>');
	assert.equal(res2.indexOf(SCRIPT_TAG), -1);

	const res3 = highlightSearchHits("sample text", '<b onclick="steal()">');
	assert.equal(res3, "sample text");
	assert.equal(res3.includes("<b"), false);
	assert.equal(res3.includes("onclick"), false);
});

// 6) Hebrew keyword matching wraps matches in <mark class="search-hit">.
test('6) Hebrew keyword matching wraps matches in <mark class="search-hit">', () => {
	const res = highlightSearchHits("מבוא לבינה מלאכותית ועיבוד שפה", "בינה");
	assert.equal(
		res,
		'מבוא ל<mark class="search-hit">בינה</mark> מלאכותית ועיבוד שפה',
	);

	const resPhrase = highlightSearchHits("קורס סמסטר א לשנת 2026", "סמסטר א");
	assert.equal(
		resPhrase,
		'קורס <mark class="search-hit">סמסטר א</mark> לשנת 2026',
	);
});

// 7) English keyword matching is case-insensitive.
test("7) English keyword matching is case-insensitive", () => {
	const res1 = highlightSearchHits("Deep Neural Networks Overview", "deep");
	assert.equal(
		res1,
		'<mark class="search-hit">Deep</mark> Neural Networks Overview',
	);

	const res2 = highlightSearchHits("learning python today", "PYTHON");
	assert.equal(res2, 'learning <mark class="search-hit">python</mark> today');

	const res3 = highlightSearchHits("MiXeD CasE matching", "mixed case");
	assert.equal(res3, '<mark class="search-hit">MiXeD CasE</mark> matching');
});

// 8) Mixed Hebrew and English query and text matching.
test("8) Mixed Hebrew and English query and text matching", () => {
	const res1 = highlightSearchHits(
		"הדרכת Python למתחילים בתכנות",
		"python למתחילים",
	);
	assert.equal(
		res1,
		'הדרכת <mark class="search-hit">Python למתחילים</mark> בתכנות',
	);

	const res2 = highlightSearchHits("פרויקט AI ובינה מלאכותית", "ai");
	assert.equal(
		res2,
		'פרויקט <mark class="search-hit">AI</mark> ובינה מלאכותית',
	);
});

// 9) Multiple keyword occurrences in the same string are all wrapped.
test("9) Multiple keyword occurrences in the same string are all wrapped", () => {
	const textInput = "בינה ראשונה, ואז עוד בינה, ולבסוף בינה שלישית";
	const res = highlightSearchHits(textInput, "בינה");
	assert.equal(
		res,
		'<mark class="search-hit">בינה</mark> ראשונה, ואז עוד <mark class="search-hit">בינה</mark>, ולבסוף <mark class="search-hit">בינה</mark> שלישית',
	);

	const enText = "code fast, review code, ship code";
	const enRes = highlightSearchHits(enText, "code");
	assert.equal(
		enRes,
		'<mark class="search-hit">code</mark> fast, review <mark class="search-hit">code</mark>, ship <mark class="search-hit">code</mark>',
	);
});

// 10) Regex special characters in query (., *, ?, +, (, ), [, ]) are treated literally and do not throw or regex-match arbitrary characters.
test("10) Regex special characters in query (., *, ?, +, (, ), [, ]) are treated literally and do not throw or regex-match arbitrary characters", () => {
	// Literal dot should not match 'x'
	const resDot = highlightSearchHits("test.js and testxjs", "test.js");
	assert.equal(resDot, '<mark class="search-hit">test.js</mark> and testxjs');

	// Literal asterisk should not match arbitrary repetitions
	const resStar = highlightSearchHits("a*b vs ab vs aaab", "a*b");
	assert.equal(resStar, '<mark class="search-hit">a*b</mark> vs ab vs aaab');

	// Literal question mark
	const resQuest = highlightSearchHits("ready? go!", "ready?");
	assert.equal(resQuest, '<mark class="search-hit">ready?</mark> go!');

	// Literal plus
	const resPlus = highlightSearchHits("C++ guide vs C guide", "c++");
	assert.equal(resPlus, '<mark class="search-hit">C++</mark> guide vs C guide');

	// Literal parenthesis
	const resParen = highlightSearchHits("fn(val) called", "(val)");
	assert.equal(resParen, 'fn<mark class="search-hit">(val)</mark> called');

	// Literal brackets
	const resBracket = highlightSearchHits("arr[0] item", "[0]");
	assert.equal(resBracket, 'arr<mark class="search-hit">[0]</mark> item');

	// Pipe, dollar, caret, brace
	const resMisc = highlightSearchHits("item|cost: $5 {ok}", "|cost: $5 {ok}");
	assert.equal(resMisc, 'item<mark class="search-hit">|cost: $5 {ok}</mark>');
});

// 11) Query with leading/trailing whitespace is trimmed.
test("11) Query with leading/trailing whitespace is trimmed", () => {
	const resHe = highlightSearchHits("מבוא למדעי המחשב", "   מדעי   ");
	assert.equal(resHe, 'מבוא ל<mark class="search-hit">מדעי</mark> המחשב');

	const resEn = highlightSearchHits(
		"Cloud Computing Essentials",
		"\t computing \n",
	);
	assert.equal(
		resEn,
		'Cloud <mark class="search-hit">Computing</mark> Essentials',
	);
});

// 12) filterSummaryItems filters items accurately by query.
test("12) filterSummaryItems filters items accurately by query", () => {
	const items = [
		{
			id: 1,
			title: "מבוא לבינה מלאכותית",
			text: "מושגי יסוד ולמידת מכונה",
			topic: "AI_LIT_PROMPT",
		},
		{
			id: 2,
			title: "סדנת קוד בפייתון",
			text: "פונקציות ומבני נתונים",
			topic: "AI_STEM_CODE",
		},
		{
			id: 3,
			title: "אתיקה בטכנולוגיה",
			text: "דילמות מוסריות בבינה מלאכותית",
			topic: "AI_ETHICS_SEC",
		},
	];

	// Query matching title
	const matchTitle = filterSummaryItems(items, { query: "פייתון" });
	assert.deepEqual(
		matchTitle.map((i) => i.id),
		[2],
	);

	// Query matching text
	const matchText = filterSummaryItems(items, { query: "מוסריות" });
	assert.deepEqual(
		matchText.map((i) => i.id),
		[3],
	);

	// Query matching topic key
	const matchTopic = filterSummaryItems(items, { query: "AI_LIT_PROMPT" });
	assert.deepEqual(
		matchTopic.map((i) => i.id),
		[1],
	);

	// Query matching multiple items
	const matchMulti = filterSummaryItems(items, { query: "בינה" });
	assert.deepEqual(
		matchMulti.map((i) => i.id),
		[1, 3],
	);

	// Query with no matches
	const noMatch = filterSummaryItems(items, { query: "ביולוגיה" });
	assert.deepEqual(noMatch, []);
});

// 13) filterSummaryItems filters items by semester and difficulty.
test("13) filterSummaryItems filters items by semester and difficulty", () => {
	const items = [
		{ id: 10, title: "אלגברה א", semester: "A", difficulty: "easy" },
		{ id: 20, title: "אלגברה ב", semester: "B", difficulty: "medium" },
		{ id: 30, title: "חדווא 1", semester: "A", difficulty: "hard" },
		{ id: 40, title: "פיזיקה 1", semester: "B", difficulty: "hard" },
	];

	// Filter by semester
	const semA = filterSummaryItems(items, { semester: "A" });
	assert.deepEqual(
		semA.map((i) => i.id),
		[10, 30],
	);

	// Filter by difficulty
	const diffHard = filterSummaryItems(items, { difficulty: "hard" });
	assert.deepEqual(
		diffHard.map((i) => i.id),
		[30, 40],
	);

	// Filter by both semester and difficulty
	const semADiffHard = filterSummaryItems(items, {
		semester: "A",
		difficulty: "hard",
	});
	assert.deepEqual(
		semADiffHard.map((i) => i.id),
		[30],
	);

	// Filter by topic filter criteria as well
	const topicItems = [
		{ id: 1, topic: "AI_CREATIVE", semester: "A", difficulty: "easy" },
		{ id: 2, topic: "AI_STEM_CODE", semester: "A", difficulty: "hard" },
	];
	const filteredTopic = filterSummaryItems(topicItems, {
		topic: "AI_CREATIVE",
	});
	assert.deepEqual(
		filteredTopic.map((i) => i.id),
		[1],
	);

	// Semester 'all' or empty should not filter out
	const allSem = filterSummaryItems(items, { semester: "all" });
	assert.deepEqual(
		allSem.map((i) => i.id),
		[10, 20, 30, 40],
	);
});

// 14) filterSummaryItems returns empty array for null/empty inputs or no matches.
test("14) filterSummaryItems returns empty array for null/empty inputs or no matches", () => {
	assert.deepEqual(filterSummaryItems(null, { query: "test" }), []);
	assert.deepEqual(filterSummaryItems(undefined, { query: "test" }), []);
	assert.deepEqual(filterSummaryItems([], { query: "test" }), []);
	assert.deepEqual(filterSummaryItems("not an array", { query: "test" }), []);
	assert.deepEqual(
		filterSummaryItems([{ title: "מבחן" }], { query: "לא קיים" }),
		[],
	);
});

// 15) renderEmptyState generates accessible markup with role="status" and escaped message.
test('15) renderEmptyState generates accessible markup with role="status" and escaped message', () => {
	// Default message
	const defaultHtml = renderEmptyState();
	assert.ok(defaultHtml.includes('role="status"'));
	assert.ok(defaultHtml.includes('aria-live="polite"'));
	assert.ok(defaultHtml.includes('class="empty-state"'));
	assert.ok(defaultHtml.includes('<p class="empty">'));
	assert.ok(defaultHtml.includes("לא נמצאו תוצאות מתאימות"));

	// Custom message
	const customHtml = renderEmptyState("לא נמצאו סיכומים בסמסטר זה");
	assert.ok(customHtml.includes("לא נמצאו סיכומים בסמסטר זה"));

	// XSS neutralization in message
	const xssHtml = renderEmptyState('<script>alert("xss")</script>');
	assert.ok(
		xssHtml.includes("&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;"),
	);
	assert.equal(xssHtml.indexOf(SCRIPT_TAG), -1);
});

// 16) Integration test with openApp() verifying search-hit class and rendering without errors in fake DOM.
test("16) Integration test with openApp() verifying search-hit class and rendering without errors in fake DOM", () => {
	const html = fs.readFileSync(path.join(ROOT, "app.html"), "utf8");
	assert.ok(
		html.includes("mark.search-hit"),
		"app.html should contain CSS for mark.search-hit",
	);
	assert.ok(
		html.includes(".empty-state"),
		"app.html should contain CSS for .empty-state",
	);
	assert.ok(
		html.includes("window.highlightSearchHits"),
		"app.html should expose window.highlightSearchHits",
	);
	assert.ok(
		html.includes("window.filterSummaryItems"),
		"app.html should expose window.filterSummaryItems",
	);
	assert.ok(
		html.includes("window.renderEmptyState"),
		"app.html should expose window.renderEmptyState",
	);
	assert.ok(
		html.includes("window.searchHighlight"),
		"app.html should expose window.searchHighlight",
	);

	const $ = openApp();
	const container = $("tab-guide");
	assert.ok(container, "tab-guide container should exist in fake DOM");

	const renderedHit = highlightSearchHits("מדריך בינה מלאכותית", "בינה");
	container.textContent = renderedHit;
	assert.ok(
		container.textContent.includes('<mark class="search-hit">בינה</mark>'),
	);

	const emptyHtml = renderEmptyState("אין תוצאות זמינות");
	container.textContent = emptyHtml;
	assert.ok(container.textContent.includes('class="empty-state"'));
	assert.ok(container.textContent.includes('role="status"'));
	assert.ok(container.textContent.includes("אין תוצאות זמינות"));
});

// 17) Verification that helpers leak zero PII (validator.findPersonalData).
test("17) Verification that helpers leak zero PII (validator.findPersonalData)", () => {
	const text1 = highlightSearchHits("מבוא לבינה מלאכותית 2026", "בינה");
	const filtered = filterSummaryItems(
		[
			{ title: "קורס בינה", semester: "A", difficulty: "easy" },
			{ title: "סדנת תכנות", semester: "B", difficulty: "medium" },
		],
		{ query: "בינה", semester: "A" },
	);
	const emptyMarkup = renderEmptyState("אין תוצאות");
	const escaped = escapeHtml("שלום לכולם & ברוכים הבאים");

	const payload = JSON.stringify({
		text1,
		filtered,
		emptyMarkup,
		escaped,
		searchHighlightKeys: Object.keys(searchHighlight),
	});

	const findings = findPersonalData(payload);
	assert.deepEqual(findings, [], "Helpers must not leak any personal data");
});

// 18) escapeHtml escapes all special characters and searchHighlight is frozen.
test("18) escapeHtml escapes all special characters and searchHighlight is frozen", () => {
	assert.equal(escapeHtml(null), "");
	assert.equal(escapeHtml(undefined), "");
	assert.equal(escapeHtml(123), "");
	assert.equal(escapeHtml({}), "");
	assert.equal(
		escapeHtml("<div id=\"x\" class='y'>A & B</div>"),
		"&lt;div id=&quot;x&quot; class=&#39;y&#39;&gt;A &amp; B&lt;/div&gt;",
	);

	assert.ok(Object.isFrozen(searchHighlight));
	assert.equal(typeof searchHighlight.escapeHtml, "function");
	assert.equal(typeof searchHighlight.highlightSearchHits, "function");
	assert.equal(typeof searchHighlight.filterSummaryItems, "function");
	assert.equal(typeof searchHighlight.renderEmptyState, "function");
});
