"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const curriculum = require("../src/lib/curriculum.js");
const modes = require("../src/lib/modes.js");
const { openApp } = require("../test-support/fake-dom.js");

// 1. שקלול ממוצע מרובה שופטים: addJudgeEvaluation computes weighted average across multiple judges
test("1. addJudgeEvaluation computes weighted average across multiple judges (coordinator 0.4, mentor_peer 0.3, industry_guest 0.3)", () => {
	let entries = curriculum.submitChallengeEntry([], {
		pairIndex: 0,
		aiTopic: "AI_STEM_CODE",
		toolTitle: "Interactive STEM Bot",
		innovation: 3,
		usefulness: 3,
		safety: 3,
	});

	assert.equal(entries.length, 1);
	assert.equal(entries[0].totalScore, 9);

	// Judge 1: coordinator (weight 0.4) -> scores: 5, 5, 5 (total 15)
	entries = curriculum.addJudgeEvaluation(entries, 0, {
		judgeRole: "coordinator",
		innovation: 5,
		usefulness: 5,
		safety: 5,
	});

	assert.equal(entries[0].evaluations.length, 1);
	assert.equal(entries[0].judgeCount, 1);
	assert.equal(entries[0].innovation, 5);
	assert.equal(entries[0].usefulness, 5);
	assert.equal(entries[0].safety, 5);
	assert.equal(entries[0].totalScore, 15);
	assert.equal(entries[0].averageScore, 5);

	// Judge 2: mentor_peer (weight 0.3) -> scores: 3, 3, 3 (total 9)
	// Total weight = 0.4 + 0.3 = 0.7
	// Weighted inno = (0.4 * 5 + 0.3 * 3) / 0.7 = 2.9 / 0.7 = 4.14
	// Weighted totalScore = 4.14 + 4.14 + 4.14 = 12.42
	entries = curriculum.addJudgeEvaluation(entries, 0, {
		judgeRole: "mentor_peer",
		innovation: 3,
		usefulness: 3,
		safety: 3,
	});

	assert.equal(entries[0].evaluations.length, 2);
	assert.equal(entries[0].judgeCount, 2);
	assert.equal(entries[0].innovation, 4.14);
	assert.equal(entries[0].usefulness, 4.14);
	assert.equal(entries[0].safety, 4.14);
	assert.equal(entries[0].totalScore, 12.42);

	// Judge 3: industry_guest (weight 0.3) -> scores: 4, 4, 4 (total 12)
	// Total weight = 0.4 + 0.3 + 0.3 = 1.0
	// Weighted inno = 0.4 * 5 + 0.3 * 3 + 0.3 * 4 = 2.0 + 0.9 + 1.2 = 4.1
	// Weighted totalScore = 4.1 + 4.1 + 4.1 = 12.3
	entries = curriculum.addJudgeEvaluation(entries, 0, {
		judgeRole: "industry_guest",
		innovation: 4,
		usefulness: 4,
		safety: 4,
	});

	assert.equal(entries[0].evaluations.length, 3);
	assert.equal(entries[0].judgeCount, 3);
	assert.equal(entries[0].innovation, 4.1);
	assert.equal(entries[0].usefulness, 4.1);
	assert.equal(entries[0].safety, 4.1);
	assert.equal(entries[0].totalScore, 12.3);
	assert.equal(entries[0].averageScore, 4.1);
	assert.ok(Object.isFrozen(entries));
	assert.ok(Object.isFrozen(entries[0]));
});

// 2. מניעת כפילות ל-judgeRole: duplicate evaluations with the same judgeRole on the same entry are rejected
test("2. addJudgeEvaluation prevents duplicate evaluation from the same judgeRole on the same entry", () => {
	let entries = curriculum.submitChallengeEntry([], {
		pairIndex: 1,
		aiTopic: "AI_CREATIVE",
		toolTitle: "Artistic Creator",
		innovation: 4,
		usefulness: 4,
		safety: 4,
	});

	entries = curriculum.addJudgeEvaluation(entries, 0, {
		judgeRole: "coordinator",
		innovation: 5,
		usefulness: 5,
		safety: 5,
	});

	assert.throws(
		() => {
			curriculum.addJudgeEvaluation(entries, 0, {
				judgeRole: "coordinator",
				innovation: 4,
				usefulness: 4,
				safety: 4,
			});
		},
		/duplicate judgeRole/,
		"Should throw error on duplicate evaluation by coordinator",
	);

	// Adding with another role still succeeds
	const updated = curriculum.addJudgeEvaluation(entries, 0, {
		judgeRole: "mentor_peer",
		innovation: 4,
		usefulness: 4,
		safety: 4,
	});
	assert.equal(updated[0].evaluations.length, 2);

	// Attempting duplicate mentor_peer also throws
	assert.throws(
		() => {
			curriculum.addJudgeEvaluation(updated, 0, {
				judgeRole: "mentor_peer",
				innovation: 5,
				usefulness: 5,
				safety: 5,
			});
		},
		/duplicate judgeRole/,
		"Should throw error on duplicate evaluation by mentor_peer",
	);
});

// 3. ולידציה קפדנית של addJudgeEvaluation (ערכים 1-5, judgeRole תקני, ומבנה נתונים)
test("3. addJudgeEvaluation strictly validates arguments, judgeRole, and score ranges 1-5", () => {
	const entries = curriculum.submitChallengeEntry([], {
		pairIndex: 0,
		aiTopic: "AI_ETHICS_SEC",
		toolTitle: "Guardian AI",
		innovation: 5,
		usefulness: 5,
		safety: 5,
	});

	// Invalid entries
	assert.throws(
		() =>
			curriculum.addJudgeEvaluation(null, 0, {
				judgeRole: "coordinator",
				innovation: 5,
				usefulness: 5,
				safety: 5,
			}),
		/invalid entries/,
	);
	assert.throws(
		() =>
			curriculum.addJudgeEvaluation("not-an-array", 0, {
				judgeRole: "coordinator",
				innovation: 5,
				usefulness: 5,
				safety: 5,
			}),
		/invalid entries/,
	);

	// Invalid entryIndex
	assert.throws(
		() =>
			curriculum.addJudgeEvaluation(entries, -1, {
				judgeRole: "coordinator",
				innovation: 5,
				usefulness: 5,
				safety: 5,
			}),
		/invalid entryIndex/,
	);
	assert.throws(
		() =>
			curriculum.addJudgeEvaluation(entries, 99, {
				judgeRole: "coordinator",
				innovation: 5,
				usefulness: 5,
				safety: 5,
			}),
		/entry not found/,
	);
	assert.throws(
		() =>
			curriculum.addJudgeEvaluation(entries, "0", {
				judgeRole: "coordinator",
				innovation: 5,
				usefulness: 5,
				safety: 5,
			}),
		/invalid entryIndex/,
	);

	// Invalid evaluation object
	assert.throws(
		() => curriculum.addJudgeEvaluation(entries, 0, null),
		/invalid evaluation/,
	);
	assert.throws(
		() => curriculum.addJudgeEvaluation(entries, 0, []),
		/invalid evaluation/,
	);

	// Invalid judgeRole
	assert.throws(
		() =>
			curriculum.addJudgeEvaluation(entries, 0, {
				judgeRole: "admin",
				innovation: 5,
				usefulness: 5,
				safety: 5,
			}),
		/invalid judgeRole/,
	);
	assert.throws(
		() =>
			curriculum.addJudgeEvaluation(entries, 0, {
				judgeRole: "",
				innovation: 5,
				usefulness: 5,
				safety: 5,
			}),
		/invalid judgeRole/,
	);

	// Invalid score bounds (1-5 only)
	const invalidScores = [0, 6, -1, 2.5, "5", null, undefined, Number.NaN];
	for (const bad of invalidScores) {
		assert.throws(
			() =>
				curriculum.addJudgeEvaluation(entries, 0, {
					judgeRole: "coordinator",
					innovation: bad,
					usefulness: 5,
					safety: 5,
				}),
			/invalid innovation/,
		);
		assert.throws(
			() =>
				curriculum.addJudgeEvaluation(entries, 0, {
					judgeRole: "coordinator",
					innovation: 5,
					usefulness: bad,
					safety: 5,
				}),
			/invalid usefulness/,
		);
		assert.throws(
			() =>
				curriculum.addJudgeEvaluation(entries, 0, {
					judgeRole: "coordinator",
					innovation: 5,
					usefulness: 5,
					safety: bad,
				}),
			/invalid safety/,
		);
	}
});

// 4. אפס PII ב-addJudgeEvaluation: דחיית מפתחות זיהוי אישי
test("4. zero PII enforcement: addJudgeEvaluation rejects personal data keys", () => {
	const entries = curriculum.submitChallengeEntry([], {
		pairIndex: 0,
		aiTopic: "AI_LIT_PROMPT",
		toolTitle: "Prompt Helper",
		innovation: 4,
		usefulness: 4,
		safety: 4,
	});

	const piiKeys = [
		"name",
		"judgeName",
		"studentName",
		"pupilName",
		"email",
		"phone",
		"idNumber",
		"notes",
	];
	for (const pii of piiKeys) {
		assert.throws(
			() => {
				curriculum.addJudgeEvaluation(entries, 0, {
					judgeRole: "coordinator",
					innovation: 5,
					usefulness: 5,
					safety: 5,
					[pii]: "Sensitive Info",
				});
			},
			/personal data is not accepted/,
			`Should reject evaluation containing PII key: ${pii}`,
		);
	}
});

// 5. בחירת פיינליסטים ב-selectChallengeFinalists: החזרת המובילים בסדר יורד דטרמיניסטי ושבירת שוויון לפי pairIndex
test("5. selectChallengeFinalists selects top finalists in deterministic descending order with pairIndex tie-break", () => {
	let entries = [];
	entries = curriculum.submitChallengeEntry(entries, {
		pairIndex: 10,
		aiTopic: "AI_CREATIVE",
		toolTitle: "Tool A",
		innovation: 4,
		usefulness: 4,
		safety: 4,
	}); // total 12
	entries = curriculum.submitChallengeEntry(entries, {
		pairIndex: 2,
		aiTopic: "AI_STEM_CODE",
		toolTitle: "Tool B",
		innovation: 5,
		usefulness: 5,
		safety: 5,
	}); // total 15
	entries = curriculum.submitChallengeEntry(entries, {
		pairIndex: 5,
		aiTopic: "AI_ETHICS_SEC",
		toolTitle: "Tool C",
		innovation: 4,
		usefulness: 4,
		safety: 4,
	}); // total 12 (tie with Tool A)
	entries = curriculum.submitChallengeEntry(entries, {
		pairIndex: 8,
		aiTopic: "AI_LIT_PROMPT",
		toolTitle: "Tool D",
		innovation: 3,
		usefulness: 3,
		safety: 3,
	}); // total 9
	entries = curriculum.submitChallengeEntry(entries, {
		pairIndex: 1,
		aiTopic: "AI_STEM_CODE",
		toolTitle: "Tool E",
		innovation: 5,
		usefulness: 4,
		safety: 5,
	}); // total 14

	const finalists = curriculum.selectChallengeFinalists(entries, 3);
	assert.equal(finalists.length, 3);

	// Rank 1: Tool B (total 15, pair 2)
	assert.equal(finalists[0].rank, 1);
	assert.equal(finalists[0].pairIndex, 2);
	assert.equal(finalists[0].totalScore, 15);
	assert.equal(finalists[0].isFinalist, true);

	// Rank 2: Tool E (total 14, pair 1)
	assert.equal(finalists[1].rank, 2);
	assert.equal(finalists[1].pairIndex, 1);
	assert.equal(finalists[1].totalScore, 14);
	assert.equal(finalists[1].isFinalist, true);

	// Rank 3: Tie between pair 5 and pair 10 (both total 12). Deterministic tie-breaker: pair 5 comes first
	assert.equal(finalists[2].rank, 3);
	assert.equal(finalists[2].pairIndex, 5);
	assert.equal(finalists[2].totalScore, 12);
	assert.equal(finalists[2].isFinalist, true);
});

// 6. selectChallengeFinalists מקרי קצה (רשימה ריקה, topN=0, topN גדול מכמות ההגשות, וברירת מחדל topN=3)
test("6. selectChallengeFinalists handles edge cases: empty list, topN=0, topN exceeding entries, and default topN=3", () => {
	assert.deepEqual(curriculum.selectChallengeFinalists([], 3), []);
	assert.deepEqual(curriculum.selectChallengeFinalists(null, 3), []);
	assert.deepEqual(curriculum.selectChallengeFinalists(undefined, 3), []);

	const entries = [
		{
			pairIndex: 0,
			aiTopic: "AI_CREATIVE",
			toolTitle: "T1",
			innovation: 5,
			usefulness: 5,
			safety: 5,
			totalScore: 15,
		},
		{
			pairIndex: 1,
			aiTopic: "AI_STEM_CODE",
			toolTitle: "T2",
			innovation: 4,
			usefulness: 4,
			safety: 4,
			totalScore: 12,
		},
	];

	// topN = 0
	assert.deepEqual(curriculum.selectChallengeFinalists(entries, 0), []);

	// Default topN = 3 when omitted
	const defaultFinalists = curriculum.selectChallengeFinalists(entries);
	assert.equal(defaultFinalists.length, 2);
	assert.equal(defaultFinalists[0].pairIndex, 0);

	// topN exceeds length
	const largeN = curriculum.selectChallengeFinalists(entries, 10);
	assert.equal(largeN.length, 2);
});

// 7. שליחת הערכת שופט מה-UI ב-#judgeSubmitBtn ועדכון הסטטוס והדירוג בזמן אמת
test("7. UI: submitting a judge evaluation via #judgeSubmitBtn updates score, status, and leaderboard", () => {
	const $ = openApp();
	$("nav-guide").fire("click");

	// Submit initial challenge entry for pair 0
	$("challengePairSelect").value = "0";
	$("challengeTopicSelect").value = "AI_STEM_CODE";
	$("challengeTitleInput").value = "AI Math Solver";
	$("challengeScoreInnovation").value = "3";
	$("challengeScoreUsefulness").value = "3";
	$("challengeScoreSafety").value = "3";
	$("submitChallengeBtn").fire("click");

	// Leaderboard initially shows total score 9
	assert.match($("challengeLeaderboard").innerHTML, /AI Math Solver/);
	assert.match($("challengeLeaderboard").innerHTML, /<b>9<\/b>/);

	// Now evaluate as coordinator with 5, 5, 5
	$("challengePairSelect").value = "0";
	$("judgeRoleSelect").value = "coordinator";
	$("challengeScoreInnovation").value = "5";
	$("challengeScoreUsefulness").value = "5";
	$("challengeScoreSafety").value = "5";
	$("judgeSubmitBtn").fire("click");

	// Status message in #challengeWinnersStatus
	const status = $("challengeWinnersStatus");
	assert.match(status.textContent, /הערכת שופט נוספה בהצלחה/);

	// Leaderboard now shows updated score (15)
	assert.match($("challengeLeaderboard").innerHTML, /<b>15<\/b>/);

	// Submitting again with coordinator triggers duplicate error in status
	$("judgeSubmitBtn").fire("click");
	assert.match(
		status.textContent,
		/duplicate judgeRole|כבר נרשמה הערכה|כפילות/i,
	);
});

// 8. הצגת תג פיינליסט (.challenge-finalist-badge) ל-3 המקומות הראשונים ב-#challengeLeaderboard
test("8. UI: #challengeLeaderboard displays .challenge-finalist-badge for top 3 places with zero PII", () => {
	const $ = openApp();
	$("nav-guide").fire("click");

	// Submit 4 entries with scores: 15, 14, 12, 9
	const testSubmissions = [
		{
			pair: "0",
			topic: "AI_STEM_CODE",
			title: "Top First",
			inno: "5",
			use: "5",
			safe: "5",
		},
		{
			pair: "1",
			topic: "AI_CREATIVE",
			title: "Top Second",
			inno: "5",
			use: "5",
			safe: "4",
		},
		{
			pair: "2",
			topic: "AI_ETHICS_SEC",
			title: "Top Third",
			inno: "4",
			use: "4",
			safe: "4",
		},
		{
			pair: "3",
			topic: "AI_LIT_PROMPT",
			title: "Fourth Place",
			inno: "3",
			use: "3",
			safe: "3",
		},
	];

	for (const sub of testSubmissions) {
		$("challengePairSelect").value = sub.pair;
		$("challengeTopicSelect").value = sub.topic;
		$("challengeTitleInput").value = sub.title;
		$("challengeScoreInnovation").value = sub.inno;
		$("challengeScoreUsefulness").value = sub.use;
		$("challengeScoreSafety").value = sub.safe;
		$("submitChallengeBtn").fire("click");
	}

	const boardHtml = $("challengeLeaderboard").innerHTML;
	const badgeMatches =
		boardHtml.match(/class="challenge-finalist-badge"/g) || [];
	assert.equal(
		badgeMatches.length,
		3,
		"Exactly 3 finalist badges should be displayed",
	);

	// Top 3 entries have the finalist badge next to title
	assert.match(
		boardHtml,
		/Top First <span class="challenge-finalist-badge">פיינליסט<\/span>/,
	);
	assert.match(
		boardHtml,
		/Top Second <span class="challenge-finalist-badge">פיינליסט<\/span>/,
	);
	assert.match(
		boardHtml,
		/Top Third <span class="challenge-finalist-badge">פיינליסט<\/span>/,
	);

	// 4th place does NOT have the badge
	assert.doesNotMatch(
		boardHtml,
		/Fourth Place <span class="challenge-finalist-badge">/,
	);

	// Zero PII check
	const piiRegex = /Israel|Dana|Cohen|05\d|@|gmail|hotmail|identity/i;
	assert.doesNotMatch(
		boardHtml,
		piiRegex,
		"Leaderboard must contain zero personal data",
	);
});

// 9. תרגום מלא he/ar/ru לבורר תפקיד שופט, כפתור הערכה, ותג פיינליסט
test("9. UI & i18n: full Hebrew, Arabic, and Russian translations for judge role selector, submit button, and finalist badge", () => {
	const $ = openApp();
	$("nav-guide").fire("click");

	// Submit an entry
	$("challengePairSelect").value = "0";
	$("challengeTopicSelect").value = "AI_STEM_CODE";
	$("challengeTitleInput").value = "Polyglot AI";
	$("challengeScoreInnovation").value = "5";
	$("challengeScoreUsefulness").value = "5";
	$("challengeScoreSafety").value = "5";
	$("submitChallengeBtn").fire("click");

	// Hebrew
	assert.equal($("judgeRoleLabel").textContent, "תפקיד שופט");
	assert.equal($("judgeSubmitBtn").textContent, "הוסף הערכת שופט");
	assert.match(
		$("challengeLeaderboard").innerHTML,
		/<span class="challenge-finalist-badge">פיינליסט<\/span>/,
	);

	// Switch to Arabic
	$("langSelect").value = "ar";
	$("langSelect").fire("change");
	assert.equal($("judgeRoleLabel").textContent, "دور المحكّم");
	assert.equal($("judgeSubmitBtn").textContent, "إضافة تقييم المحكّم");
	assert.match(
		$("challengeLeaderboard").innerHTML,
		/<span class="challenge-finalist-badge">مرشح نهائي<\/span>/,
	);

	// Switch to Russian
	$("langSelect").value = "ru";
	$("langSelect").fire("change");
	assert.equal($("judgeRoleLabel").textContent, "Роль судьи");
	assert.equal($("judgeSubmitBtn").textContent, "Добавить оценку судьи");
	assert.match(
		$("challengeLeaderboard").innerHTML,
		/<span class="challenge-finalist-badge">Финалист<\/span>/,
	);
});

// 10. modes module re-exports addJudgeEvaluation and selectChallengeFinalists
test("10. modes module re-exports addJudgeEvaluation, selectChallengeFinalists, and constants", () => {
	assert.equal(typeof modes.addJudgeEvaluation, "function");
	assert.equal(typeof modes.selectChallengeFinalists, "function");
	assert.equal(modes.addJudgeEvaluation, curriculum.addJudgeEvaluation);
	assert.equal(
		modes.selectChallengeFinalists,
		curriculum.selectChallengeFinalists,
	);
	assert.deepEqual(modes.VALID_JUDGE_ROLES, curriculum.VALID_JUDGE_ROLES);
	assert.deepEqual(modes.JUDGE_ROLE_WEIGHTS, curriculum.JUDGE_ROLE_WEIGHTS);
});
