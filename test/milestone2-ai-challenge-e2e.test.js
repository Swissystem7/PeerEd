"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const {
	submitChallengeEntry,
	rankChallengeLeaderboard,
	VALID_AI_TOPICS,
} = require("../src/lib/curriculum.js");
const { openApp } = require("../test-support/fake-dom.js");

// 1. ולידציית ציונים 1-5
test("validation of innovation, usefulness, and safety scores between 1 and 5", () => {
	const validEntry = {
		pairIndex: 0,
		aiTopic: "AI_STEM_CODE",
		toolTitle: "Code Tutor AI",
		innovation: 5,
		usefulness: 4,
		safety: 3,
	};

	// Baseline valid submission
	const res = submitChallengeEntry([], validEntry);
	assert.equal(res.length, 1);
	assert.equal(res[0].innovation, 5);
	assert.equal(res[0].usefulness, 4);
	assert.equal(res[0].safety, 3);

	// Boundary checks: 1 and 5 must be accepted
	const minEntry = { ...validEntry, innovation: 1, usefulness: 1, safety: 1 };
	const minRes = submitChallengeEntry([], minEntry);
	assert.equal(minRes[0].innovation, 1);

	// Invalid scores: < 1, > 5, non-integers, strings, null, undefined, NaN
	const invalidScores = [
		0,
		-1,
		6,
		10,
		3.5,
		4.2,
		"5",
		"1",
		null,
		undefined,
		Number.NaN,
	];
	for (const badScore of invalidScores) {
		assert.throws(
			() => submitChallengeEntry([], { ...validEntry, innovation: badScore }),
			/invalid innovation/,
			`Should reject innovation score: ${badScore}`,
		);
		assert.throws(
			() => submitChallengeEntry([], { ...validEntry, usefulness: badScore }),
			/invalid usefulness/,
			`Should reject usefulness score: ${badScore}`,
		);
		assert.throws(
			() => submitChallengeEntry([], { ...validEntry, safety: badScore }),
			/invalid safety/,
			`Should reject safety score: ${badScore}`,
		);
	}
});

// 2. דחיית aiTopic לא תקני
test("rejection of non-standard aiTopic values", () => {
	const baseEntry = {
		pairIndex: 1,
		toolTitle: "Creative Story Bot",
		innovation: 4,
		usefulness: 4,
		safety: 5,
	};

	// All 4 valid topics must be accepted
	assert.equal(VALID_AI_TOPICS.length, 4);
	for (const topic of VALID_AI_TOPICS) {
		const res = submitChallengeEntry([], { ...baseEntry, aiTopic: topic });
		assert.equal(res.length, 1);
		assert.equal(res[0].aiTopic, topic);
	}

	// Invalid topics must be rejected
	const badTopics = [
		"AI_ROBOTICS",
		"AI_UNKNOWN",
		"random_text",
		"AI_stem_code",
		"",
		" ",
		null,
		undefined,
		123,
		{},
	];
	for (const badTopic of badTopics) {
		assert.throws(
			() => submitChallengeEntry([], { ...baseEntry, aiTopic: badTopic }),
			/invalid aiTopic/,
			`Should reject invalid aiTopic: ${badTopic}`,
		);
	}
});

// 3. חישוב ציון ודירוג יורד ב-rankChallengeLeaderboard
test("calculation of total and average scores and descending ranking in leaderboard", () => {
	let entries = [];
	// Pair 0: total 15, average 5
	entries = submitChallengeEntry(entries, {
		pairIndex: 0,
		aiTopic: "AI_LIT_PROMPT",
		toolTitle: "Prompt Assistant",
		innovation: 5,
		usefulness: 5,
		safety: 5,
	});
	// Pair 1: total 9, average 3
	entries = submitChallengeEntry(entries, {
		pairIndex: 1,
		aiTopic: "AI_CREATIVE",
		toolTitle: "Drawing Bot",
		innovation: 3,
		usefulness: 3,
		safety: 3,
	});
	// Pair 2: total 12, average 4
	entries = submitChallengeEntry(entries, {
		pairIndex: 2,
		aiTopic: "AI_ETHICS_SEC",
		toolTitle: "Privacy Shield",
		innovation: 4,
		usefulness: 4,
		safety: 4,
	});

	const ranked = rankChallengeLeaderboard(entries);
	assert.equal(ranked.length, 3);

	// Pair 0 should be rank 1 (score 15)
	assert.equal(ranked[0].rank, 1);
	assert.equal(ranked[0].pairIndex, 0);
	assert.equal(ranked[0].totalScore, 15);
	assert.equal(ranked[0].averageScore, 5);

	// Pair 2 should be rank 2 (score 12)
	assert.equal(ranked[1].rank, 2);
	assert.equal(ranked[1].pairIndex, 2);
	assert.equal(ranked[1].totalScore, 12);
	assert.equal(ranked[1].averageScore, 4);

	// Pair 1 should be rank 3 (score 9)
	assert.equal(ranked[2].rank, 3);
	assert.equal(ranked[2].pairIndex, 1);
	assert.equal(ranked[2].totalScore, 9);
	assert.equal(ranked[2].averageScore, 3);
});

// 4. שבירת שוויון דטרמיניסטית
test("deterministic tie-breaking by pairIndex ascending when total scores are tied", () => {
	let entries = [];
	// Pair 4: score 13 (5 + 4 + 4)
	entries = submitChallengeEntry(entries, {
		pairIndex: 4,
		aiTopic: "AI_STEM_CODE",
		toolTitle: "Pair 4 Tool",
		innovation: 5,
		usefulness: 4,
		safety: 4,
	});
	// Pair 1: score 13 (4 + 5 + 4)
	entries = submitChallengeEntry(entries, {
		pairIndex: 1,
		aiTopic: "AI_CREATIVE",
		toolTitle: "Pair 1 Tool",
		innovation: 4,
		usefulness: 5,
		safety: 4,
	});
	// Pair 3: score 13 (4 + 4 + 5)
	entries = submitChallengeEntry(entries, {
		pairIndex: 3,
		aiTopic: "AI_LIT_PROMPT",
		toolTitle: "Pair 3 Tool",
		innovation: 4,
		usefulness: 4,
		safety: 5,
	});
	// Pair 0: score 10
	entries = submitChallengeEntry(entries, {
		pairIndex: 0,
		aiTopic: "AI_ETHICS_SEC",
		toolTitle: "Pair 0 Tool",
		innovation: 3,
		usefulness: 3,
		safety: 4,
	});

	const ranked = rankChallengeLeaderboard(entries);
	assert.equal(ranked.length, 4);

	// Tied pairs with score 13 must appear in ascending pairIndex order: Pair 1, then Pair 3, then Pair 4
	assert.equal(ranked[0].pairIndex, 1);
	assert.equal(ranked[0].totalScore, 13);
	assert.equal(ranked[0].rank, 1);

	assert.equal(ranked[1].pairIndex, 3);
	assert.equal(ranked[1].totalScore, 13);
	assert.equal(ranked[1].rank, 2);

	assert.equal(ranked[2].pairIndex, 4);
	assert.equal(ranked[2].totalScore, 13);
	assert.equal(ranked[2].rank, 3);

	// Pair 0 with lower score comes last
	assert.equal(ranked[3].pairIndex, 0);
	assert.equal(ranked[3].totalScore, 10);
	assert.equal(ranked[3].rank, 4);
});

// 5. ניהול הגשות ועדכון עבור אותו pairIndex
test("updating and replacing existing submission for the same pairIndex", () => {
	let entries = [];
	entries = submitChallengeEntry(entries, {
		pairIndex: 2,
		aiTopic: "AI_LIT_PROMPT",
		toolTitle: "Initial Draft",
		innovation: 2,
		usefulness: 2,
		safety: 2,
	});
	assert.equal(entries.length, 1);
	assert.equal(entries[0].toolTitle, "Initial Draft");
	assert.equal(entries[0].totalScore, 6);

	// Resubmit for same pairIndex with improved scores and title
	entries = submitChallengeEntry(entries, {
		pairIndex: 2,
		aiTopic: "AI_STEM_CODE",
		toolTitle: "Polished App",
		innovation: 5,
		usefulness: 5,
		safety: 5,
	});
	assert.equal(
		entries.length,
		1,
		"Should update in place without adding duplicate row",
	);
	assert.equal(entries[0].toolTitle, "Polished App");
	assert.equal(entries[0].aiTopic, "AI_STEM_CODE");
	assert.equal(entries[0].totalScore, 15);

	// Invalid pairIndex tests
	assert.throws(
		() =>
			submitChallengeEntry(entries, {
				pairIndex: -1,
				aiTopic: "AI_CREATIVE",
				toolTitle: "Bad",
				innovation: 5,
				usefulness: 5,
				safety: 5,
			}),
		/invalid pairIndex/,
	);
	assert.throws(
		() =>
			submitChallengeEntry(entries, {
				pairIndex: 1.5,
				aiTopic: "AI_CREATIVE",
				toolTitle: "Bad",
				innovation: 5,
				usefulness: 5,
				safety: 5,
			}),
		/invalid pairIndex/,
	);
});

// 6. הוספת הגשה דרך ה-UI ועדכון #challengeLeaderboard
test("submitting challenge entry via UI form and live updating #challengeLeaderboard", () => {
	const $ = openApp();

	$("nav-guide").fire("click");

	// Initial leaderboard should display empty state
	assert.match(
		$("challengeLeaderboard").innerHTML,
		/אין עדיין הגשות לתחרות כלי AI/,
		"Should show empty leaderboard initially",
	);

	// Populate form fields
	$("challengePairSelect").value = "0";
	$("challengeTopicSelect").value = "AI_STEM_CODE";
	$("challengeTitleInput").value = "Interactive Math Solver";
	$("challengeScoreInnovation").value = "5";
	$("challengeScoreUsefulness").value = "4";
	$("challengeScoreSafety").value = "5";

	// Submit entry
	$("submitChallengeBtn").fire("click");

	const status = $("challengeStatus");
	assert.equal(
		status.className.includes("bad"),
		false,
		`Submission should succeed: ${status.textContent}`,
	);
	assert.match(status.textContent, /ההגשה נשמרה בהצלחה/);

	// Title input should be reset
	assert.equal($("challengeTitleInput").value, "");

	// Leaderboard must now contain the entry
	const boardHtml = $("challengeLeaderboard").innerHTML;
	assert.match(
		boardHtml,
		/Interactive Math Solver/,
		"Leaderboard must show tool title",
	);
	assert.match(
		boardHtml,
		/מדעים, טכנולוגיה ותכנות/,
		"Leaderboard must show Hebrew topic name",
	);
	assert.match(boardHtml, /14/, "Leaderboard must show total score (5+4+5=14)");
	assert.match(boardHtml, /זוג 1/, "Leaderboard must show pair label");
});

// 7. החלפת שפה he/ar/ru
test("multilingual support and language switching across Hebrew, Arabic, and Russian", () => {
	const $ = openApp();
	$("nav-guide").fire("click");

	// Submit an entry first in Hebrew
	$("challengePairSelect").value = "0";
	$("challengeTopicSelect").value = "AI_CREATIVE";
	$("challengeTitleInput").value = "Art Creator";
	$("challengeScoreInnovation").value = "5";
	$("challengeScoreUsefulness").value = "5";
	$("challengeScoreSafety").value = "5";
	$("submitChallengeBtn").fire("click");

	// Verify Hebrew UI
	assert.equal($("challengeHeading").textContent, "תחרות כלי AI");
	assert.equal($("submitChallengeBtn").textContent, "הגש אתגר");
	assert.match($("challengeLeaderboard").innerHTML, /יצירתיות ובינה יוצרת/);
	assert.match($("challengeLeaderboard").innerHTML, /מקום/);
	assert.match($("challengeLeaderboard").innerHTML, /זוג 1/);

	// Switch to Arabic
	$("langSelect").value = "ar";
	$("langSelect").fire("change");
	assert.equal(
		$("challengeHeading").textContent,
		"تحدي أدوات الذكاء الاصطناعي",
	);
	assert.equal($("submitChallengeBtn").textContent, "إرسال التحدي");
	assert.match($("challengeLeaderboard").innerHTML, /إنشاء المحتوى والوسائط/);
	assert.match($("challengeLeaderboard").innerHTML, /المرتبة/);
	assert.match($("challengeLeaderboard").innerHTML, /الزوج/);
	assert.match($("challengeLeaderboard").innerHTML, /زوج 1/);

	// Switch to Russian
	$("langSelect").value = "ru";
	$("langSelect").fire("change");
	assert.equal($("challengeHeading").textContent, "Конкурс инструментов ИИ");
	assert.equal($("submitChallengeBtn").textContent, "Отправить работу");
	assert.match(
		$("challengeLeaderboard").innerHTML,
		/Творчество и генеративный ИИ/,
	);
	assert.match($("challengeLeaderboard").innerHTML, /Место/);
	assert.match($("challengeLeaderboard").innerHTML, /Пара 1/);
});

// 8. אפס PII
test("strict zero PII guarantee in logic functions, UI validation, and rendered output", () => {
	const contaminatedEntry = {
		pairIndex: 0,
		aiTopic: "AI_ETHICS_SEC",
		toolTitle: "Safe Classifier",
		innovation: 5,
		usefulness: 5,
		safety: 5,
		name: "Israel Israeli",
		studentName: "Dana Levi",
		pupilName: "Yossi Cohen",
		email: "secret@example.com",
		phone: "0501234567",
		idNumber: "123456789",
	};

	// submitChallengeEntry must reject forbidden / personal data keys
	assert.throws(
		() => submitChallengeEntry([], contaminatedEntry),
		/personal data is not accepted/,
		"Should reject entry containing personal data keys",
	);

	// Rejection of PII within toolTitle itself (emails, Israeli phones, ID numbers, URLs)
	const piiTitles = [
		"Contact me at user@school.edu",
		"Call 050-1234567 for help",
		"Student ID 123456789 app",
		"Visit https://external-leak.com",
	];
	for (const badTitle of piiTitles) {
		assert.throws(
			() =>
				submitChallengeEntry([], {
					pairIndex: 0,
					aiTopic: "AI_ETHICS_SEC",
					toolTitle: badTitle,
					innovation: 5,
					usefulness: 5,
					safety: 5,
				}),
			/personal data is not accepted/,
			`Should reject PII inside toolTitle: ${badTitle}`,
		);
	}

	// rankChallengeLeaderboard output must have no PII fields
	const cleanRes = submitChallengeEntry([], {
		pairIndex: 0,
		aiTopic: "AI_ETHICS_SEC",
		toolTitle: "Safe Classifier",
		innovation: 5,
		usefulness: 5,
		safety: 5,
	});
	const ranked = rankChallengeLeaderboard(cleanRes);
	const rankedJson = JSON.stringify(ranked);
	for (const pii of ["name", "email", "phone", "student", "pupil", "secret"]) {
		assert.equal(
			rankedJson.includes(`"${pii}"`),
			false,
			`Output JSON should not contain key: ${pii}`,
		);
	}

	// UI validation rejects PII in title input
	const $ = openApp();
	$("nav-guide").fire("click");
	$("challengePairSelect").value = "0";
	$("challengeTopicSelect").value = "AI_ETHICS_SEC";
	$("challengeTitleInput").value = "Contact me 0501234567";
	$("submitChallengeBtn").fire("click");

	const status = $("challengeStatus");
	assert.equal(
		status.className.includes("bad"),
		true,
		"Status must show error for PII in UI",
	);
	assert.match(
		status.textContent,
		/personal data is not accepted|פרטים אישיים/,
	);
	assert.equal(
		$("challengeLeaderboard").innerHTML.includes("0501234567"),
		false,
		"PII must never appear on leaderboard",
	);
});

// 9. טיפול במקרי קצה וקריאות עם קלט ריק או חסר
test("safe handling of edge cases and empty or missing inputs in curriculum challenge logic", () => {
	// Empty or non-array entries to rankChallengeLeaderboard
	assert.deepEqual(rankChallengeLeaderboard([]), []);
	assert.deepEqual(rankChallengeLeaderboard(null), []);
	assert.deepEqual(rankChallengeLeaderboard(undefined), []);

	// Passing null or undefined as entries list to submitChallengeEntry starts fresh list
	const first = submitChallengeEntry(null, {
		pairIndex: 0,
		aiTopic: "AI_LIT_PROMPT",
		toolTitle: "Tool One",
		innovation: 4,
		usefulness: 4,
		safety: 4,
	});
	assert.equal(first.length, 1);

	// Empty toolTitle or whitespace-only toolTitle is rejected
	assert.throws(
		() =>
			submitChallengeEntry([], {
				pairIndex: 0,
				aiTopic: "AI_LIT_PROMPT",
				toolTitle: "",
				innovation: 5,
				usefulness: 5,
				safety: 5,
			}),
		/text too short/,
	);
	assert.throws(
		() =>
			submitChallengeEntry([], {
				pairIndex: 0,
				aiTopic: "AI_LIT_PROMPT",
				toolTitle: "   ",
				innovation: 5,
				usefulness: 5,
				safety: 5,
			}),
		/text too short/,
	);
});
