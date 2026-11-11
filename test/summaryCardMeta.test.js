const test = require("node:test");
const assert = require("node:assert/strict");

const {
	estimateReadingTimeHebrew,
	getTopicTagColor,
	getTopicTagStyle,
	getSummaryQualityScore,
	summaryCardMeta,
} = require("../src/lib/attendance.js");
const { openApp } = require("../test-support/fake-dom.js");
const { findPersonalData } = require("../src/lib/validator.js");

function parseHex(hex) {
	const clean = hex.replace("#", "");
	return {
		r: Number.parseInt(clean.substring(0, 2), 16) / 255,
		g: Number.parseInt(clean.substring(2, 4), 16) / 255,
		b: Number.parseInt(clean.substring(4, 6), 16) / 255,
	};
}

function channelLuminance(val) {
	return val <= 0.04045 ? val / 12.92 : ((val + 0.055) / 1.055) ** 2.4;
}

function relativeLuminance(hex) {
	const { r, g, b } = parseHex(hex);
	return (
		0.2126 * channelLuminance(r) +
		0.7152 * channelLuminance(g) +
		0.0722 * channelLuminance(b)
	);
}

function contrastRatio(hex1, hex2) {
	const lum1 = relativeLuminance(hex1);
	const lum2 = relativeLuminance(hex2);
	const lighter = Math.max(lum1, lum2);
	const darker = Math.min(lum1, lum2);
	return (lighter + 0.05) / (darker + 0.05);
}

// 1) estimateReadingTimeHebrew returns 0 minutes and 0 words for empty, whitespace, null, and undefined inputs.
test("1) estimateReadingTimeHebrew returns 0 minutes and 0 words for empty, whitespace, null, and undefined inputs", () => {
	const emptyInputs = ["", "   ", "\t\n\r  ", null, undefined, 123, {}];
	for (const input of emptyInputs) {
		const result = estimateReadingTimeHebrew(input);
		assert.deepEqual(result, {
			words: 0,
			minutes: 0,
			formattedHe: "0 דק׳ קריאה",
		});
	}
});

// 2) estimateReadingTimeHebrew correctly counts Hebrew words and returns at least 1 minute for short Hebrew text (<180 words).
test("2) estimateReadingTimeHebrew correctly counts Hebrew words and returns at least 1 minute for short Hebrew text (<180 words)", () => {
	const shortText = "חונכות אישית לקידום הישגים לימודיים";
	const result = estimateReadingTimeHebrew(shortText);
	assert.equal(result.words, 5);
	assert.equal(result.minutes, 1);
	assert.equal(result.formattedHe, "1 דק׳ קריאה");

	const singleWord = "שלום";
	const singleResult = estimateReadingTimeHebrew(singleWord);
	assert.equal(singleResult.words, 1);
	assert.equal(singleResult.minutes, 1);
	assert.equal(singleResult.formattedHe, "1 דק׳ קריאה");
});

// 3) estimateReadingTimeHebrew returns exact minutes for 180, 360, and longer Hebrew texts.
test("3) estimateReadingTimeHebrew returns exact minutes for 180, 360, and longer Hebrew texts", () => {
	const text180 = Array(180).fill("מילה").join(" ");
	const result180 = estimateReadingTimeHebrew(text180);
	assert.equal(result180.words, 180);
	assert.equal(result180.minutes, 1);
	assert.equal(result180.formattedHe, "1 דק׳ קריאה");

	const text181 = Array(181).fill("מילה").join(" ");
	const result181 = estimateReadingTimeHebrew(text181);
	assert.equal(result181.words, 181);
	assert.equal(result181.minutes, 2);
	assert.equal(result181.formattedHe, "2 דק׳ קריאה");

	const text360 = Array(360).fill("מילה").join(" ");
	const result360 = estimateReadingTimeHebrew(text360);
	assert.equal(result360.words, 360);
	assert.equal(result360.minutes, 2);
	assert.equal(result360.formattedHe, "2 דק׳ קריאה");

	const text540 = Array(540).fill("מילה").join(" ");
	const result540 = estimateReadingTimeHebrew(text540);
	assert.equal(result540.words, 540);
	assert.equal(result540.minutes, 3);
	assert.equal(result540.formattedHe, "3 דק׳ קריאה");
});

// 4) estimateReadingTimeHebrew respects custom wordsPerMinute argument.
test("4) estimateReadingTimeHebrew respects custom wordsPerMinute argument", () => {
	const text200 = Array(200).fill("מילה").join(" ");

	const resultWpm100 = estimateReadingTimeHebrew(text200, 100);
	assert.equal(resultWpm100.words, 200);
	assert.equal(resultWpm100.minutes, 2);
	assert.equal(resultWpm100.formattedHe, "2 דק׳ קריאה");

	const resultWpm200 = estimateReadingTimeHebrew(text200, 200);
	assert.equal(resultWpm200.words, 200);
	assert.equal(resultWpm200.minutes, 1);
	assert.equal(resultWpm200.formattedHe, "1 דק׳ קריאה");

	const resultWpm50 = estimateReadingTimeHebrew(text200, 50);
	assert.equal(resultWpm50.words, 200);
	assert.equal(resultWpm50.minutes, 4);
	assert.equal(resultWpm50.formattedHe, "4 דק׳ קריאה");
});

// 5) estimateReadingTimeHebrew handles mixed Hebrew, English, punctuation, and numbers.
test("5) estimateReadingTimeHebrew handles mixed Hebrew, English, punctuation, and numbers", () => {
	const mixedText =
		"בשיעור ה-1 למדנו Python ו-JavaScript עם 42 תלמידים! מצוין, תודה.";
	const result = estimateReadingTimeHebrew(mixedText);
	assert.equal(result.words, 10);
	assert.equal(result.minutes, 1);
	assert.equal(result.formattedHe, "1 דק׳ קריאה");
});

// 6) getTopicTagColor returns consistent deterministic colors (same topic key yields identical color across repeated calls).
test("6) getTopicTagColor returns consistent deterministic colors (same topic key yields identical color across repeated calls)", () => {
	const keys = ["AI_LIT_PROMPT", "AI_CREATIVE", "MATH", "PHYSICS", "CHEMISTRY"];
	for (const key of keys) {
		const initialColor = getTopicTagColor(key);
		for (let i = 0; i < 50; i += 1) {
			const repeatColor = getTopicTagColor(key);
			assert.equal(
				repeatColor,
				initialColor,
				`Color must be deterministic for ${key}`,
			);
		}
	}
});

// 7) getTopicTagColor produces distinct pastel colors for different topic keys.
test("7) getTopicTagColor produces distinct pastel colors for different topic keys", () => {
	const aiKeys = [
		"AI_LIT_PROMPT",
		"AI_CREATIVE",
		"AI_STEM_CODE",
		"AI_ETHICS_SEC",
	];
	const colors = new Set(aiKeys.map((key) => getTopicTagColor(key)));
	assert.equal(
		colors.size,
		4,
		"All 4 AI topic keys should map to distinct colors",
	);

	for (const color of colors) {
		assert.ok(
			summaryCardMeta.TOPIC_PASTEL_PALETTE.includes(color),
			`Color ${color} should belong to TOPIC_PASTEL_PALETTE`,
		);
	}
});

// 8) getTopicTagColor colors meet WCAG AA contrast against card background (#171a23 / #0f1117).
test("8) getTopicTagColor colors meet WCAG AA contrast against card background (#171a23 / #0f1117)", () => {
	const backgrounds = ["#0f1117", "#171a23"];
	for (const color of summaryCardMeta.TOPIC_PASTEL_PALETTE) {
		for (const bg of backgrounds) {
			const ratio = contrastRatio(color, bg);
			assert.ok(
				ratio >= 4.5,
				`Color ${color} against ${bg} must have contrast >= 4.5:1 (got ${ratio.toFixed(2)})`,
			);
		}
	}

	const testKeys = [
		"AI_LIT_PROMPT",
		"AI_CREATIVE",
		"AI_STEM_CODE",
		"AI_ETHICS_SEC",
		"MATH",
		"ENGLISH",
	];
	for (const key of testKeys) {
		const color = getTopicTagColor(key);
		for (const bg of backgrounds) {
			const ratio = contrastRatio(color, bg);
			assert.ok(
				ratio >= 4.5,
				`Key ${key} color ${color} against ${bg} must meet WCAG AA >= 4.5:1 (got ${ratio.toFixed(2)})`,
			);
		}
	}
});

// 9) getTopicTagStyle returns valid styling object with color and background.
test("9) getTopicTagStyle returns valid styling object with color and background", () => {
	const style = getTopicTagStyle("AI_LIT_PROMPT");
	assert.ok(style && typeof style === "object");
	assert.match(style.color, /^#[0-9a-f]{6}$/i);
	assert.match(style.borderColor, /^#[0-9a-f]{6}$/i);
	assert.match(style.background, /^rgba\(\d+,\s*\d+,\s*\d+,\s*[\d.]+\)$/);
	assert.equal(style.color, getTopicTagColor("AI_LIT_PROMPT"));
});

// 10) getTopicTagColor handles empty string, null, and undefined without throwing.
test("10) getTopicTagColor handles empty string, null, and undefined without throwing", () => {
	const invalidKeys = ["", "   ", null, undefined, 42, {}];
	for (const key of invalidKeys) {
		assert.doesNotThrow(() => {
			const color = getTopicTagColor(key);
			assert.match(color, /^#[0-9a-f]{6}$/i);
		});
	}
});

// 11) getSummaryQualityScore returns 0 / 'empty' for null, undefined, or empty summary objects.
test("11) getSummaryQualityScore returns 0 / 'empty' for null, undefined, or empty summary objects", () => {
	const emptyInputs = [
		null,
		undefined,
		{},
		[],
		"not an object",
		{ totalHours: 0, totalHeldSessions: 0 },
		{ AI_LIT_PROMPT: { total: 0, requested: 0, offered: 0 } },
		{ byStatus: { held: 0, missed: 0, postponed: 0, cancelled: 0 } },
		{ metricA: 0, metricB: 0 },
	];
	for (const input of emptyInputs) {
		const result = getSummaryQualityScore(input);
		assert.deepEqual(result, {
			score: 0,
			rating: "empty",
			labelHe: "ללא נתונים",
		});
	}
});

// 12) getSummaryQualityScore calculates appropriate score and label for populated summaries.
test("12) getSummaryQualityScore calculates appropriate score and label for populated summaries", () => {
	const aiSummary = {
		AI_LIT_PROMPT: { total: 4, requested: 2, offered: 2 },
		AI_CREATIVE: { total: 3, requested: 1, offered: 2 },
		AI_STEM_CODE: { total: 2, requested: 1, offered: 1 },
		AI_ETHICS_SEC: { total: 1, requested: 1, offered: 0 },
	};
	const aiScore = getSummaryQualityScore(aiSummary);
	assert.ok(aiScore.score > 0 && aiScore.score <= 100);
	assert.notEqual(aiScore.rating, "empty");
	assert.ok(["low", "medium", "high"].includes(aiScore.rating));
	assert.ok(typeof aiScore.labelHe === "string" && aiScore.labelHe.length > 0);

	const scholarshipSummary = {
		totalHours: 24,
		totalHeldSessions: 16,
		byParticipant: { 0: 8, 1: 8, 2: 8 },
	};
	const schScore = getSummaryQualityScore(scholarshipSummary);
	assert.ok(schScore.score > 0 && schScore.score <= 100);
	assert.notEqual(schScore.rating, "empty");

	const attendanceSummaryData = {
		byStatus: { held: 12, missed: 2, postponed: 1, cancelled: 0 },
		heldRate: 0.857,
	};
	const attScore = getSummaryQualityScore(attendanceSummaryData);
	assert.ok(attScore.score > 0 && attScore.score <= 100);
	assert.notEqual(attScore.rating, "empty");
});

// 13) Integration: openApp() verifies summary card elements render with accessible attributes and topic tags in fake DOM without errors.
test("13) Integration: openApp() verifies summary card elements render with accessible attributes and topic tags in fake DOM without errors", () => {
	const $ = openApp();
	const card = $("aiTopicsSummaryCard");
	const heading = $("aiTopicsSummaryHeading");
	const list = $("aiTopicsSummaryList");
	const meta = $("aiTopicsSummaryMeta");

	assert.ok(card, "aiTopicsSummaryCard must exist");
	assert.ok(heading, "aiTopicsSummaryHeading must exist");
	assert.ok(list, "aiTopicsSummaryList must exist");
	assert.equal(list.getAttribute("role"), "region");
	assert.equal(list.getAttribute("aria-live"), "polite");

	const listHtml = list.innerHTML;
	for (const topicKey of [
		"AI_LIT_PROMPT",
		"AI_CREATIVE",
		"AI_STEM_CODE",
		"AI_ETHICS_SEC",
	]) {
		assert.ok(
			listHtml.includes(`data-topic="${topicKey}"`),
			`Must contain data-topic="${topicKey}"`,
		);
		const expectedColor = getTopicTagColor(topicKey);
		assert.ok(
			listHtml.includes(expectedColor),
			`List HTML must include deterministic color ${expectedColor} for ${topicKey}`,
		);
	}

	assert.ok(meta, "aiTopicsSummaryMeta indicator element must exist");
	assert.ok(
		meta.textContent.includes("קריאה") || meta.textContent.includes("איכות"),
	);
});

// 14) Ensure no personal data is leaked by any helper.
test("14) Ensure no personal data is leaked by any helper", () => {
	const readingResult = estimateReadingTimeHebrew("שלום וברכה, תלמיד יקר");
	const tagColor = getTopicTagColor("AI_LIT_PROMPT");
	const tagStyle = getTopicTagStyle("AI_LIT_PROMPT");
	const qualityScore = getSummaryQualityScore({
		AI_LIT_PROMPT: { total: 2, requested: 1, offered: 1 },
	});

	const helpersPayload = JSON.stringify({
		readingResult,
		tagColor,
		tagStyle,
		qualityScore,
		summaryCardMetaKeys: Object.keys(summaryCardMeta),
	});

	const findings = findPersonalData(helpersPayload);
	assert.deepEqual(
		findings,
		[],
		"None of the summary card metadata helpers should leak personal data",
	);
});
