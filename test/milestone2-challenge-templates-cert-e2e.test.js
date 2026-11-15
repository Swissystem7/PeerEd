const test = require("node:test");
const assert = require("node:assert/strict");
const curriculum = require("../src/lib/curriculum.js");
const modes = require("../src/lib/modes.js");
const { openApp } = require("../test-support/fake-dom.js");

const tick = () => new Promise((resolve) => setImmediate(resolve));

function submitEntry($, pair, topic, title, scores) {
	$("challengePairSelect").value = String(pair);
	$("challengeTopicSelect").value = topic;
	$("challengeTitleInput").value = title;
	$("challengeScoreInnovation").value = String(scores[0]);
	$("challengeScoreUsefulness").value = String(scores[1]);
	$("challengeScoreSafety").value = String(scores[2]);
	$("submitChallengeBtn").fire("click");
}

test("1. AI_CHALLENGE_TEMPLATES completeness: exactly 4 templates matching AI_TOPICS exported from curriculum and modes", () => {
	const expectedTopics = [
		"AI_LIT_PROMPT",
		"AI_CREATIVE",
		"AI_STEM_CODE",
		"AI_ETHICS_SEC",
	];
	assert.ok(Array.isArray(curriculum.AI_CHALLENGE_TEMPLATES));
	assert.ok(Array.isArray(modes.AI_CHALLENGE_TEMPLATES));
	assert.equal(curriculum.AI_CHALLENGE_TEMPLATES.length, 4);
	assert.equal(modes.AI_CHALLENGE_TEMPLATES.length, 4);
	assert.ok(Object.isFrozen(curriculum.AI_CHALLENGE_TEMPLATES));

	const topicsCurriculum = curriculum.AI_CHALLENGE_TEMPLATES.map(
		(item) => item.aiTopic || item.topic,
	);
	const topicsModes = modes.AI_CHALLENGE_TEMPLATES.map(
		(item) => item.aiTopic || item.topic,
	);

	for (const topic of expectedTopics) {
		assert.ok(
			topicsCurriculum.includes(topic),
			`curriculum catalog should contain ${topic}`,
		);
		assert.ok(
			topicsModes.includes(topic),
			`modes catalog should contain ${topic}`,
		);
	}
});

test("2. AI_CHALLENGE_TEMPLATES has valid identifiers, multilingual titles (he, ar, ru) and main judging criteria", () => {
	for (const template of curriculum.AI_CHALLENGE_TEMPLATES) {
		assert.ok(typeof template.id === "string" && template.id.length > 0);
		assert.ok(typeof (template.aiTopic || template.topic) === "string");

		// Title in 3 languages
		assert.ok(template.title, "template has title object");
		assert.ok(
			typeof template.title.he === "string" && template.title.he.length > 0,
		);
		assert.ok(
			typeof template.title.ar === "string" && template.title.ar.length > 0,
		);
		assert.ok(
			typeof template.title.ru === "string" && template.title.ru.length > 0,
		);

		// Main criterion in 3 languages
		const crit = template.criterion || template.mainCriterion;
		assert.ok(crit, "template has criterion object");
		assert.ok(typeof crit.he === "string" && crit.he.length > 0);
		assert.ok(typeof crit.ar === "string" && crit.ar.length > 0);
		assert.ok(typeof crit.ru === "string" && crit.ru.length > 0);
	}
});

test("3. generateChallengeCertificateText generates proper Hebrew appreciation certificate with all required fields", () => {
	const entry = {
		pairIndex: 3,
		toolTitle: "Prompt Helper",
		aiTopic: "AI_LIT_PROMPT",
		totalScore: 14,
	};

	const certHe = curriculum.generateChallengeCertificateText(entry, 1, "he");
	assert.ok(typeof certHe === "string");
	assert.ok(certHe.includes("תעודת הוקרה"));
	assert.ok(certHe.includes("#1") || certHe.includes("1"));
	assert.ok(certHe.includes("3"));
	assert.ok(certHe.includes("Prompt Helper"));
	assert.ok(certHe.includes("AI_LIT_PROMPT"));
	assert.ok(certHe.includes("14"));
});

test("4. generateChallengeCertificateText handles Arabic and Russian languages accurately", () => {
	const entry = {
		pairIndex: 2,
		toolTitle: "Code Debugger",
		aiTopic: "AI_STEM_CODE",
		totalScore: 15,
		rank: 1,
	};

	const certAr = curriculum.generateChallengeCertificateText(entry, 1, "ar");
	assert.ok(certAr.includes("شهادة تقدير"));
	assert.ok(certAr.includes("Code Debugger"));
	assert.ok(certAr.includes("AI_STEM_CODE"));
	assert.ok(certAr.includes("15"));
	assert.ok(certAr.includes("2"));

	const certRu = curriculum.generateChallengeCertificateText(entry, 1, "ru");
	assert.ok(certRu.includes("Почётная грамота"));
	assert.ok(certRu.includes("Code Debugger"));
	assert.ok(certRu.includes("AI_STEM_CODE"));
	assert.ok(certRu.includes("15"));
	assert.ok(certRu.includes("2"));
});

test("5. generateChallengeCertificateText handles edge cases cleanly without crashing", () => {
	assert.equal(curriculum.generateChallengeCertificateText(null), "");
	assert.equal(curriculum.generateChallengeCertificateText(undefined), "");

	const defaultRankCert = curriculum.generateChallengeCertificateText({
		pairIndex: 1,
		toolTitle: "Creative Bot",
		aiTopic: "AI_CREATIVE",
		totalScore: 12,
	});
	assert.ok(defaultRankCert.includes("#1"));
	assert.ok(defaultRankCert.includes("Creative Bot"));

	// Test export from modes.js matches curriculum.js
	const certFromModes = modes.generateChallengeCertificateText(
		{
			pairIndex: 1,
			toolTitle: "Creative Bot",
			aiTopic: "AI_CREATIVE",
			totalScore: 12,
		},
		1,
		"he",
	);
	assert.equal(certFromModes, defaultRankCert);
});

test("6. Zero PII assurance in challenge templates and generated certificates", () => {
	const piiRegex =
		/@|05\d-?\d{7}|id_number|תעודת זהות|john|alice|טלפון|אימייל/i;

	for (const template of curriculum.AI_CHALLENGE_TEMPLATES) {
		const raw = JSON.stringify(template);
		assert.equal(
			piiRegex.test(raw),
			false,
			"Template catalog must contain zero PII",
		);
	}

	const sampleEntry = {
		pairIndex: 7,
		toolTitle: "Safe Shield",
		aiTopic: "AI_ETHICS_SEC",
		totalScore: 15,
	};

	for (const language of ["he", "ar", "ru"]) {
		const cert = curriculum.generateChallengeCertificateText(
			sampleEntry,
			1,
			language,
		);
		assert.equal(
			piiRegex.test(cert),
			false,
			`Certificate in ${language} must contain zero PII`,
		);
	}
});

test("7. UI: selecting #challengeTemplateSelect auto-fills AI topic and challenge title in the form", () => {
	const $ = openApp();
	$("nav-guide").fire("click");

	const templateSelect = $("challengeTemplateSelect");
	assert.ok(templateSelect, "#challengeTemplateSelect element exists in DOM");

	// Find stem code template id
	const stemTemplate = curriculum.AI_CHALLENGE_TEMPLATES.find(
		(item) => (item.aiTopic || item.topic) === "AI_STEM_CODE",
	);
	assert.ok(stemTemplate);

	templateSelect.value = stemTemplate.id;
	templateSelect.fire("change");

	assert.equal($("challengeTopicSelect").value, "AI_STEM_CODE");
	const expectedTitle = stemTemplate.title.he;
	assert.equal($("challengeTitleInput").value, expectedTitle);
});

test("8. UI: #copyTopChallengeCertBtn copies top winner certificate to clipboard when entries exist", async () => {
	const $ = openApp({ clipboard: "ok" });
	$("nav-guide").fire("click");

	submitEntry($, 0, "AI_STEM_CODE", "Tutor Alpha", [5, 5, 5]);
	submitEntry($, 1, "AI_CREATIVE", "Painter Beta", [4, 4, 4]);

	const copyCertButton = $("copyTopChallengeCertBtn");
	assert.ok(copyCertButton, "#copyTopChallengeCertBtn exists");
	assert.equal(copyCertButton.getAttribute("type"), "button");
	assert.equal(
		copyCertButton.getAttribute("aria-describedby"),
		"challengeWinnersStatus",
	);

	copyCertButton.fire("click");
	await tick();

	assert.equal(
		$("challengeWinnersStatus").textContent,
		"תעודת ההוקרה הועתקה ללוח",
	);
	const clipboardText = $.clipboard();
	assert.ok(typeof clipboardText === "string");
	assert.ok(clipboardText.includes("Tutor Alpha"));
	assert.ok(clipboardText.includes("AI_STEM_CODE"));
	assert.ok(clipboardText.includes("15"));
});

test("9. UI: #copyTopChallengeCertBtn updates #challengeWinnersStatus with empty message when leaderboard is empty", async () => {
	const $ = openApp({ clipboard: "ok" });
	$("nav-guide").fire("click");

	const copyCertButton = $("copyTopChallengeCertBtn");
	copyCertButton.fire("click");
	await tick();

	assert.equal($.clipboard(), null, "clipboard should remain empty");
	assert.equal($("challengeWinnersStatus").textContent, "אין הגשות זמינות");
});

test("10. UI: #copyTopChallengeCertBtn fallback when clipboard API is refused or absent", async () => {
	const refusedApp = openApp({ clipboard: "refuse" });
	refusedApp("nav-guide").fire("click");

	submitEntry(refusedApp, 0, "AI_LIT_PROMPT", "Prompt Master", [5, 4, 5]);

	refusedApp("copyTopChallengeCertBtn").fire("click");
	await tick();
	await tick();

	const statusText = refusedApp("challengeWinnersStatus").textContent;
	assert.ok(statusText.includes("Prompt Master"));
	assert.ok(statusText.includes("תעודת הוקרה"));
});
