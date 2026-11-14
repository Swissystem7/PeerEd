// PeerEd - attendance (stage 3): held / missed / postponed / cancelled per pair and date.
// Immutable log, internal pair indexes only. No clock: every date is passed in.

const { diffDays, parseDate } = require("./semester.js");

const ATTENDANCE_STATUSES = Object.freeze([
	"held",
	"missed",
	"postponed",
	"cancelled",
]);

const MAX_ATTENDANCE_RECORDS = 5000;

function todayLocalISO() {
	const now = new Date();
	const y = now.getFullYear();
	const m = String(now.getMonth() + 1).padStart(2, "0");
	const d = String(now.getDate()).padStart(2, "0");
	return `${y}-${m}-${d}`;
}

/** Valid YYYY-MM-DD calendar date that is not after today (local). */
function isValidAttendanceDate(dateStr) {
	try {
		parseDate(dateStr);
	} catch {
		return false;
	}
	return dateStr <= todayLocalISO();
}

function makeAttendanceLog() {
	return Object.freeze({ entries: Object.freeze([]) });
}
function assertLog(log) {
	if (!log || !Array.isArray(log.entries))
		throw new Error("invalid attendance log");
}

function validateAttendanceInput(input) {
	const o = input || {};
	if (!Number.isInteger(o.pairIndex) || o.pairIndex < 0)
		throw new Error("invalid attendance: pairIndex");
	parseDate(o.date);
	if (!isValidAttendanceDate(o.date))
		throw new Error("invalid attendance: future or invalid date");
	if (ATTENDANCE_STATUSES.indexOf(o.status) === -1)
		throw new Error("invalid attendance status");
	return o;
}

function resolveAttendanceDuration(o) {
	let durationHours = 0.0;
	if (o.status === "held") {
		durationHours = 1.0;
		if (
			typeof o.durationHours === "number" &&
			Number.isFinite(o.durationHours) &&
			o.durationHours > 0
		) {
			durationHours = o.durationHours;
		}
	}
	return durationHours;
}

function resolveAttendanceAiTopic(o) {
	if (o.aiTopic === undefined) return undefined;
	if (o.aiTopic === null) return null;
	if (typeof o.aiTopic === "string" && AI_TOPIC_KEYS.includes(o.aiTopic)) {
		return o.aiTopic;
	}
	throw new Error("invalid attendance: aiTopic");
}

function recordAttendance(log, input) {
	assertLog(log);
	const o = validateAttendanceInput(input);
	const durationHours = resolveAttendanceDuration(o);
	const aiTopic = resolveAttendanceAiTopic(o);

	const entryObj = {
		pairIndex: o.pairIndex,
		date: o.date,
		status: o.status,
		durationHours: durationHours,
	};
	if (aiTopic !== undefined) {
		entryObj.aiTopic = aiTopic;
	}
	const entry = Object.freeze(entryObj);
	const existingIdx = log.entries.findIndex(
		(e) => e.pairIndex === o.pairIndex && e.date === o.date,
	);
	if (existingIdx !== -1) {
		const updated = log.entries.slice();
		updated[existingIdx] = entry;
		return Object.freeze({ entries: Object.freeze(updated) });
	}
	let prior = log.entries;
	if (prior.length >= MAX_ATTENDANCE_RECORDS) {
		prior = prior.slice(prior.length - MAX_ATTENDANCE_RECORDS + 1);
	}
	return Object.freeze({ entries: Object.freeze(prior.concat([entry])) });
}

function sanitizeAttendanceRow(r, validateDateFn) {
	if (!r || typeof r !== "object" || Array.isArray(r)) return null;
	if (!Number.isInteger(r.pairIndex) || r.pairIndex < 0) return null;
	if (typeof r.date !== "string") return null;
	if (validateDateFn) {
		try {
			validateDateFn(r.date);
		} catch {
			return null;
		}
	}
	if (ATTENDANCE_STATUSES.indexOf(r.status) === -1) return null;
	let durationHours = 1.0;
	if (
		typeof r.durationHours === "number" &&
		Number.isFinite(r.durationHours) &&
		r.durationHours >= 0
	) {
		durationHours = r.durationHours;
	}
	const row = {
		pairIndex: r.pairIndex,
		date: r.date,
		status: r.status,
		durationHours: durationHours,
	};
	if (r.aiTopic !== undefined) {
		if (
			r.aiTopic === null ||
			(typeof r.aiTopic === "string" && AI_TOPIC_KEYS.includes(r.aiTopic))
		) {
			row.aiTopic = r.aiTopic;
		}
	}
	return Object.freeze(row);
}

function serializeAttendance(records) {
	if (!Array.isArray(records)) return [];
	const out = [];
	for (const r of records) {
		const row = sanitizeAttendanceRow(r, null);
		if (row) out.push(row);
	}
	return out;
}

function deserializeAttendance(raw) {
	if (!Array.isArray(raw)) return Object.freeze([]);
	const out = [];
	for (const r of raw) {
		const row = sanitizeAttendanceRow(r, parseDate);
		if (row) out.push(row);
	}
	return Object.freeze(out);
}

function attendanceSummary(log, opts) {
	assertLog(log);
	const o = opts || {};
	const byStatus = { held: 0, missed: 0, postponed: 0, cancelled: 0 };
	const byPair = {};
	log.entries.forEach((e) => {
		if (o.from && e.date < o.from) return;
		if (o.to && e.date > o.to) return;
		byStatus[e.status] += 1;
		byPair[e.pairIndex] = byPair[e.pairIndex] || {
			held: 0,
			missed: 0,
			postponed: 0,
			cancelled: 0,
		};
		byPair[e.pairIndex][e.status] += 1;
	});
	const decided = byStatus.held + byStatus.missed;
	return {
		byStatus,
		byPair,
		heldRate:
			decided === 0
				? null
				: Math.round((byStatus.held / decided) * 1000) / 1000,
	};
}

// Mirrors AI_TOPICS in src/app-shell.html
const AI_TOPICS = Object.freeze({
	AI_LIT_PROMPT: Object.freeze({
		he: "אוריינות בינה מלאכותית והנחיה",
		ar: "محو الأمية في التوجيهات",
		ru: "Грамотность в ИИ и промптинг",
	}),
	AI_CREATIVE: Object.freeze({
		he: "יצירתיות ובינה יוצרת",
		ar: "إنشاء المحتوى والوسائط",
		ru: "Творчество и генеративный ИИ",
	}),
	AI_STEM_CODE: Object.freeze({
		he: "מדעים, טכנולוגיה ותכנות",
		ar: "كفاءة الذكاء الاصطناعي والبرمجة",
		ru: "STEM и программирование",
	}),
	AI_ETHICS_SEC: Object.freeze({
		he: "אתיקה, פרטיות ובטיחות",
		ar: "الأخلاق والأمان",
		ru: "Этика и безопасность ИИ",
	}),
});

const AI_TOPIC_KEYS = Object.freeze([
	"AI_LIT_PROMPT",
	"AI_CREATIVE",
	"AI_STEM_CODE",
	"AI_ETHICS_SEC",
]);

function isAITopicList(topics) {
	if (!Array.isArray(topics) || topics.length === 0) return false;
	return topics.every(
		(t) => typeof t === "string" && AI_TOPIC_KEYS.includes(t),
	);
}

function getAITopicsSummary(participants) {
	const result = {
		AI_LIT_PROMPT: { total: 0, requested: 0, offered: 0 },
		AI_CREATIVE: { total: 0, requested: 0, offered: 0 },
		AI_STEM_CODE: { total: 0, requested: 0, offered: 0 },
		AI_ETHICS_SEC: { total: 0, requested: 0, offered: 0 },
	};
	if (!Array.isArray(participants) || participants.length === 0) {
		return result;
	}
	for (const p of participants) {
		if (!p || typeof p !== "object" || Array.isArray(p)) continue;
		const topics = p.target_ai_topics;
		if (!Array.isArray(topics)) continue;
		const uniqueTopics = new Set(topics);
		for (const topic of uniqueTopics) {
			if (!isAITopicList([topic])) continue;
			result[topic].total += 1;
			if (p.role === "student") {
				result[topic].offered += 1;
			} else if (p.role === "pupil") {
				result[topic].requested += 1;
			}
		}
	}
	return result;
}

// Pairs with no 'held' session for at least `days` days (default 14) as of asOfISO.
function stalePairs(pairs, log, asOfISO, opts) {
	assertLog(log);
	parseDate(asOfISO);
	const days = opts && Number.isInteger(opts.days) ? opts.days : 14;
	const since = opts?.since ? opts.since : null;
	if (since) parseDate(since);
	const last = new Map();
	log.entries.forEach((e) => {
		if (
			e.status === "held" &&
			(!last.has(e.pairIndex) || e.date > last.get(e.pairIndex))
		)
			last.set(e.pairIndex, e.date);
	});
	const out = [];
	(Array.isArray(pairs) ? pairs : []).forEach((pair, pairIndex) => {
		const idx =
			pair && Number.isInteger(pair.pairIndex) ? pair.pairIndex : pairIndex;
		const lastHeld = last.get(idx) || null;
		const ref = lastHeld || since;
		if (ref === null) return; // without a semester start there is no honest baseline
		const gap = diffDays(ref, asOfISO);
		if (gap >= days)
			out.push({
				pairIndex: idx,
				lastHeldDate: lastHeld,
				daysSince: gap,
				alertHe: `הזוג לא נפגש כבר ${gap} ימים`,
			});
	});
	return out.sort(
		(a, b) => b.daysSince - a.daysSince || a.pairIndex - b.pairIndex,
	);
}

function getRecordDurationHours(record) {
	if (
		record &&
		typeof record.durationHours === "number" &&
		Number.isFinite(record.durationHours) &&
		record.durationHours > 0
	) {
		return record.durationHours;
	}
	return 1.0;
}

// Sums durations for records with r.pairIndex === pairIndex and r.status === 'held'.
// Default duration is 1.0 per held session unless record.durationHours is a positive finite number.
// Returns 0 for non-array inputs, invalid pairIndex, or when no matching held records exist.
function calculatePairHours(attendanceRecords, pairIndex) {
	if (!Array.isArray(attendanceRecords)) return 0;
	if (!Number.isInteger(pairIndex) || pairIndex < 0) return 0;
	let total = 0;
	for (const r of attendanceRecords) {
		if (!r || typeof r !== "object") continue;
		if (r.pairIndex === pairIndex && r.status === "held") {
			total += getRecordDurationHours(r);
		}
	}
	return total;
}

function findPairObject(pairs, pairIndex) {
	if (!pairs) return null;
	if (Array.isArray(pairs)) {
		const candidate = pairs[pairIndex];
		if (candidate && typeof candidate === "object" && !Array.isArray(candidate)) {
			const hasExplicitIndex = Number.isInteger(candidate.pairIndex);
			if (!hasExplicitIndex || candidate.pairIndex === pairIndex) {
				return candidate;
			}
		}
		return pairs.find(
			(p) =>
				p &&
				typeof p === "object" &&
				!Array.isArray(p) &&
				p.pairIndex === pairIndex,
		) || null;
	}
	if (typeof pairs === "object") {
		const candidate = pairs[pairIndex];
		if (candidate && typeof candidate === "object" && !Array.isArray(candidate)) {
			const hasExplicitIndex = Number.isInteger(candidate.pairIndex);
			if (!hasExplicitIndex || candidate.pairIndex === pairIndex) {
				return candidate;
			}
		}
	}
	return null;
}

function accumulateScholarshipRecord(r, pairs, result) {
	if (!r || typeof r !== "object") return;
	if (!Number.isInteger(r.pairIndex) || r.pairIndex < 0) return;
	if (r.status !== "held") return;

	const duration = getRecordDurationHours(r);
	result.totalHeldSessions += 1;
	result.totalHours += duration;
	result.byPair[r.pairIndex] = (result.byPair[r.pairIndex] || 0) + duration;

	const pair = findPairObject(pairs, r.pairIndex);
	if (pair && typeof pair === "object" && !Array.isArray(pair)) {
		const participants = new Set();
		if (Number.isInteger(pair.studentIndex) && pair.studentIndex >= 0) {
			participants.add(pair.studentIndex);
		}
		if (Number.isInteger(pair.pupilIndex) && pair.pupilIndex >= 0) {
			participants.add(pair.pupilIndex);
		}
		for (const pIdx of participants) {
			result.byParticipant[pIdx] =
				(result.byParticipant[pIdx] || 0) + duration;
		}
	}
}

function getScholarshipHoursSummary(attendanceRecords, pairs) {
	const result = {
		byPair: {},
		totalHeldSessions: 0,
		totalHours: 0,
		byParticipant: {},
		sortedParticipants: [],
	};
	if (!Array.isArray(attendanceRecords) || attendanceRecords.length === 0) {
		return result;
	}
	for (const r of attendanceRecords) {
		accumulateScholarshipRecord(r, pairs, result);
	}
	result.sortedParticipants = Object.keys(result.byParticipant)
		.map((k) => {
			const index = Number(k);
			return {
				index,
				totalHours: result.byParticipant[index],
			};
		})
		.sort((a, b) => b.totalHours - a.totalHours || a.index - b.index);
	return result;
}

function getCleanAttendanceRecords(records) {
	return Array.isArray(records)
		? records
		: records && Array.isArray(records.entries)
			? records.entries
			: [];
}

function collectPairIndexes(cleanRecords, pairs) {
	const pairIndexes = new Set();
	if (Array.isArray(pairs)) {
		pairs.forEach((p, idx) => {
			const pIdx =
				p && Number.isInteger(p.pairIndex) && p.pairIndex >= 0
					? p.pairIndex
					: idx;
			pairIndexes.add(pIdx);
		});
	}
	for (const r of cleanRecords) {
		if (r && Number.isInteger(r.pairIndex) && r.pairIndex >= 0) {
			pairIndexes.add(r.pairIndex);
		}
	}
	return Array.from(pairIndexes).sort((a, b) => a - b);
}

function computePairReport(pIdx, cleanRecords, target) {
	let heldSessions = 0;
	let totalHours = 0;
	const statusCounts = { held: 0, missed: 0, postponed: 0, cancelled: 0 };
	const coveredAiTopicsSet = new Set();

	for (const r of cleanRecords) {
		if (!r || typeof r !== "object" || r.pairIndex !== pIdx) continue;
		if (Object.hasOwn(statusCounts, r.status)) {
			statusCounts[r.status] += 1;
		}
		if (r.status === "held") {
			heldSessions += 1;
			const duration = getRecordDurationHours(r);
			totalHours += duration;
			if (
				r.aiTopic &&
				typeof r.aiTopic === "string" &&
				AI_TOPIC_KEYS.includes(r.aiTopic)
			) {
				coveredAiTopicsSet.add(r.aiTopic);
			}
		}
	}

	const completionPercent =
		target > 0 ? Math.round((totalHours / target) * 100) : 0;

	return {
		pairReport: Object.freeze({
			pairIndex: pIdx,
			heldSessions,
			totalHours,
			targetHours: target,
			completionPercent,
			coveredAiTopics: Object.freeze(Array.from(coveredAiTopicsSet).sort()),
			statusCounts: Object.freeze(statusCounts),
		}),
		metrics: {
			heldSessions,
			totalHours,
			statusCounts,
			coveredAiTopics: coveredAiTopicsSet,
		},
	};
}

/**
 * Builds an anonymous scholarship report by pairs and overall summary.
 * Zero PII.
 *
 * @param {Array<Object>|Object} records Attendance records or log
 * @param {Array<Object>} pairs Matched pairs list
 * @param {number} targetHours Target scholarship hours (default 30)
 * @returns {Object} Report containing pairs list, byPair lookup, and summary
 */
function buildScholarshipReport(records, pairs, targetHours) {
	const target =
		typeof targetHours === "number" &&
		Number.isFinite(targetHours) &&
		targetHours > 0
			? targetHours
			: 30;

	const cleanRecords = getCleanAttendanceRecords(records);
	const sortedPairIndexes = collectPairIndexes(cleanRecords, pairs);

	const pairReports = [];
	const byPair = {};
	let overallHeldSessions = 0;
	let overallTotalHours = 0;
	const overallStatusCounts = {
		held: 0,
		missed: 0,
		postponed: 0,
		cancelled: 0,
	};
	const overallAiTopics = new Set();

	for (const pIdx of sortedPairIndexes) {
		const { pairReport, metrics } = computePairReport(pIdx, cleanRecords, target);
		pairReports.push(pairReport);
		byPair[pIdx] = pairReport;

		overallHeldSessions += metrics.heldSessions;
		overallTotalHours += metrics.totalHours;
		for (const st of Object.keys(overallStatusCounts)) {
			overallStatusCounts[st] += metrics.statusCounts[st];
		}
		for (const top of metrics.coveredAiTopics) {
			overallAiTopics.add(top);
		}
	}

	const totalPairs = sortedPairIndexes.length;
	const expectedTotalHours = totalPairs * target;
	const overallCompletionPercent =
		expectedTotalHours > 0
			? Math.round((overallTotalHours / expectedTotalHours) * 100)
			: 0;

	const summary = Object.freeze({
		totalPairs,
		totalHeldSessions: overallHeldSessions,
		totalHours: overallTotalHours,
		targetHours: target,
		completionPercent: overallCompletionPercent,
		coveredAiTopics: Object.freeze(Array.from(overallAiTopics).sort()),
		statusCounts: Object.freeze(overallStatusCounts),
	});

	return Object.freeze({
		pairs: Object.freeze(pairReports),
		byPair: Object.freeze(byPair),
		summary,
		totalPairs,
		totalHeldSessions: overallHeldSessions,
		totalHours: overallTotalHours,
		targetHours: target,
		completionPercent: overallCompletionPercent,
		coveredAiTopics: summary.coveredAiTopics,
		statusCounts: summary.statusCounts,
	});
}

const TOPIC_PASTEL_PALETTE = Object.freeze([
	"#93c5fd", // pastel blue
	"#86efac", // pastel green
	"#c4b5fd", // pastel purple
	"#fde047", // pastel yellow
	"#fca5a5", // pastel rose
	"#67e8f9", // pastel cyan
	"#fdba74", // pastel amber
]);

function hashTopicKey(str) {
	let hash = 5381;
	for (let i = 0; i < str.length; i += 1) {
		hash = (hash << 5) + hash + str.charCodeAt(i);
		hash |= 0;
	}
	return Math.abs(hash);
}

function estimateReadingTimeHebrew(text, wordsPerMinute = 180) {
	if (typeof text !== "string") {
		return { words: 0, minutes: 0, formattedHe: "0 דק׳ קריאה" };
	}
	const trimmed = text.trim();
	if (!trimmed) {
		return { words: 0, minutes: 0, formattedHe: "0 דק׳ קריאה" };
	}
	const wpm =
		typeof wordsPerMinute === "number" && wordsPerMinute > 0
			? wordsPerMinute
			: 180;
	const tokens = trimmed.match(/[\p{L}\p{N}]+(?:["'’״׳־-][\p{L}\p{N}]+)*/gu);
	const words = tokens ? tokens.length : 0;
	if (words === 0) {
		return { words: 0, minutes: 0, formattedHe: "0 דק׳ קריאה" };
	}
	const minutes = Math.max(1, Math.ceil(words / wpm));
	return {
		words,
		minutes,
		formattedHe: `${minutes} דק׳ קריאה`,
	};
}

function getTopicTagColor(topicKey) {
	if (typeof topicKey !== "string" || !topicKey.trim()) {
		return TOPIC_PASTEL_PALETTE[0];
	}
	const clean = topicKey.trim();
	const hash = hashTopicKey(clean);
	return TOPIC_PASTEL_PALETTE[hash % TOPIC_PASTEL_PALETTE.length];
}

function hexToRgbValues(hex) {
	const clean = hex.replace("#", "");
	const r = Number.parseInt(clean.substring(0, 2), 16);
	const g = Number.parseInt(clean.substring(2, 4), 16);
	const b = Number.parseInt(clean.substring(4, 6), 16);
	return { r, g, b };
}

function getTopicTagStyle(topicKey) {
	const color = getTopicTagColor(topicKey);
	const { r, g, b } = hexToRgbValues(color);
	return {
		background: `rgba(${r}, ${g}, ${b}, 0.15)`,
		color,
		borderColor: color,
	};
}

function scoreAiSummary(summary, keys) {
	let totalCount = 0;
	let activeTopics = 0;
	let balancedTopics = 0;
	const topicKeys = keys.filter(
		(k) => summary[k] && typeof summary[k] === "object",
	);
	if (topicKeys.length === 0) {
		return { score: 0, rating: "empty", labelHe: "ללא נתונים" };
	}
	for (const k of topicKeys) {
		const item = summary[k];
		const tot = typeof item.total === "number" ? item.total : 0;
		const req = typeof item.requested === "number" ? item.requested : 0;
		const off = typeof item.offered === "number" ? item.offered : 0;
		totalCount += tot;
		if (tot > 0) activeTopics += 1;
		if (req > 0 && off > 0) balancedTopics += 1;
	}
	if (totalCount === 0) {
		return { score: 0, rating: "empty", labelHe: "ללא נתונים" };
	}
	const diversityScore = (activeTopics / Math.max(1, topicKeys.length)) * 40;
	const volumeScore = Math.min(35, totalCount * 7);
	const balanceScore = (balancedTopics / Math.max(1, activeTopics)) * 25;
	return Math.round(diversityScore + volumeScore + balanceScore);
}

function scoreScholarshipSummary(summary) {
	const totalHours =
		typeof summary.totalHours === "number" ? summary.totalHours : 0;
	const totalHeld =
		typeof summary.totalHeldSessions === "number"
			? summary.totalHeldSessions
			: 0;
	const participantCount =
		summary.byParticipant && typeof summary.byParticipant === "object"
			? Object.keys(summary.byParticipant).length
			: 0;
	if (totalHours === 0 && totalHeld === 0 && participantCount === 0) {
		return { score: 0, rating: "empty", labelHe: "ללא נתונים" };
	}
	const hoursScore = Math.min(45, totalHours * 5);
	const sessionsScore = Math.min(35, totalHeld * 7);
	const participantScore = Math.min(20, participantCount * 10);
	return Math.round(hoursScore + sessionsScore + participantScore);
}

function scoreAttendanceSummary(summary) {
	const st = summary.byStatus;
	const held = typeof st.held === "number" ? st.held : 0;
	const missed = typeof st.missed === "number" ? st.missed : 0;
	const postponed = typeof st.postponed === "number" ? st.postponed : 0;
	const cancelled = typeof st.cancelled === "number" ? st.cancelled : 0;
	const total = held + missed + postponed + cancelled;
	if (total === 0) {
		return { score: 0, rating: "empty", labelHe: "ללא נתונים" };
	}
	const heldRate =
		typeof summary.heldRate === "number"
			? summary.heldRate
			: held / Math.max(1, held + missed);
	const volumeScore = Math.min(50, total * 5);
	const rateScore = heldRate * 50;
	return Math.round(volumeScore + rateScore);
}

function scoreGenericSummary(summary, keys) {
	let sumNumbers = 0;
	let nonZeroCount = 0;
	for (const k of keys) {
		const val = summary[k];
		if (typeof val === "number" && Number.isFinite(val)) {
			sumNumbers += Math.abs(val);
			if (val > 0) nonZeroCount += 1;
		}
	}
	if (sumNumbers === 0 && nonZeroCount === 0) {
		return { score: 0, rating: "empty", labelHe: "ללא נתונים" };
	}
	return Math.min(
		100,
		Math.max(10, Math.round(nonZeroCount * 25 + sumNumbers * 2)),
	);
}

function getSummaryQualityScore(summary) {
	if (!summary || typeof summary !== "object" || Array.isArray(summary)) {
		return { score: 0, rating: "empty", labelHe: "ללא נתונים" };
	}

	const keys = Object.keys(summary);
	if (keys.length === 0) {
		return { score: 0, rating: "empty", labelHe: "ללא נתונים" };
	}

	const isAiSummary =
		keys.some((k) => AI_TOPIC_KEYS.includes(k)) ||
		keys.some(
			(k) =>
				summary[k] && typeof summary[k] === "object" && "total" in summary[k],
		);

	const isScholarshipSummary =
		"totalHours" in summary || "totalHeldSessions" in summary;

	const isAttendanceSummary =
		"byStatus" in summary &&
		summary.byStatus &&
		typeof summary.byStatus === "object";

	let rawScore = 0;

	if (isAiSummary) {
		const res = scoreAiSummary(summary, keys);
		if (typeof res === "object") return res;
		rawScore = res;
	} else if (isScholarshipSummary) {
		const res = scoreScholarshipSummary(summary);
		if (typeof res === "object") return res;
		rawScore = res;
	} else if (isAttendanceSummary) {
		const res = scoreAttendanceSummary(summary);
		if (typeof res === "object") return res;
		rawScore = res;
	} else {
		const res = scoreGenericSummary(summary, keys);
		if (typeof res === "object") return res;
		rawScore = res;
	}

	const score = Math.max(1, Math.min(100, rawScore));
	let rating = "low";
	let labelHe = "בסיסי";
	if (score >= 80) {
		rating = "high";
		labelHe = "מצוין";
	} else if (score >= 45) {
		rating = "medium";
		labelHe = "טוב";
	}

	return { score, rating, labelHe };
}

const summaryCardMeta = Object.freeze({
	estimateReadingTimeHebrew,
	getTopicTagColor,
	getTopicTagStyle,
	getSummaryQualityScore,
	TOPIC_PASTEL_PALETTE,
});

/**
 * Escapes &, <, >, ", ' in text.
 * Returns empty string for null, undefined, or non-string inputs.
 */
function escapeHtml(text) {
	if (typeof text !== "string" || text.length === 0) return "";
	return text
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;")
		.replace(/'/g, "&#39;");
}

/**
 * XSS-safe search keyword highlighter.
 * Safely escapes text first before wrapping matched keywords in <mark class="search-hit">$1</mark>.
 */
function highlightSearchHits(text, query) {
	if (typeof text !== "string" || text.length === 0) {
		return "";
	}
	if (typeof query !== "string" || query.trim().length === 0) {
		return escapeHtml(text);
	}
	const escapedText = escapeHtml(text);
	const escapedQuery = escapeHtml(query.trim());
	const safePattern = escapedQuery.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
	if (!safePattern) {
		return escapedText;
	}
	// nosemgrep: javascript.lang.security.audit.detect-non-literal-regexp.detect-non-literal-regexp
	const regex = new RegExp(`(${safePattern})`, "gi");
	return escapedText.replace(regex, '<mark class="search-hit">$1</mark>');
}

/**
 * Filters an array of summary items based on criteria { query, semester, difficulty, topic }.
 * Safely returns [] when items is null, undefined, or empty.
 */
function matchesQuery(item, q) {
	if (!q) return true;
	const parts = [];
	if (typeof item.title === "string") parts.push(item.title);
	if (typeof item.text === "string") parts.push(item.text);
	if (typeof item.description === "string") parts.push(item.description);
	if (typeof item.name === "string") parts.push(item.name);
	if (typeof item.topic === "string") {
		parts.push(item.topic);
	} else if (Array.isArray(item.topic)) {
		parts.push(item.topic.join(" "));
	}
	return parts.join(" ").toLowerCase().includes(q);
}

function matchesCriterion(itemVal, filterVal, isArrayTarget = false) {
	if (filterVal === null) return true;
	if (itemVal == null) return false;

	const normalize = (v) => String(v).toLowerCase();

	if (isArrayTarget) {
		const itemTopics = Array.isArray(itemVal)
			? itemVal.map(normalize)
			: [normalize(itemVal)];
		const targetTopics = Array.isArray(filterVal)
			? filterVal.map(normalize)
			: [normalize(filterVal)];
		return itemTopics.some((t) => targetTopics.includes(t));
	}

	if (Array.isArray(filterVal)) {
		const semStrings = filterVal.map(normalize);
		return semStrings.includes(normalize(itemVal));
	}

	return normalize(itemVal) === normalize(filterVal);
}

function filterSummaryItems(items, filters) {
	if (!Array.isArray(items) || items.length === 0) {
		return [];
	}
	if (!filters || typeof filters !== "object") {
		return items.slice();
	}

	const q =
		typeof filters.query === "string" ? filters.query.trim().toLowerCase() : "";

	const cleanFilter = (val) => {
		if (val == null || val === "" || val === "all") return null;
		return val;
	};

	const filterSemester = cleanFilter(filters.semester);
	const filterDifficulty = cleanFilter(filters.difficulty);
	const filterTopic = cleanFilter(filters.topic);

	return items.filter((item) => {
		if (!item || typeof item !== "object") return false;

		if (!matchesQuery(item, q)) {
			return false;
		}

		if (filterSemester !== null) {
			if (!matchesCriterion(item.semester, filterSemester)) {
				return false;
			}
		}

		if (filterDifficulty !== null) {
			if (!matchesCriterion(item.difficulty, filterDifficulty)) {
				return false;
			}
		}

		if (filterTopic !== null) {
			if (!matchesCriterion(item.topic, filterTopic, true)) {
				return false;
			}
		}

		return true;
	});
}

/**
 * Returns accessible HTML for empty results.
 */
function renderEmptyState(messageHe) {
	const msg =
		typeof messageHe === "string" && messageHe.trim().length > 0
			? messageHe.trim()
			: "לא נמצאו תוצאות מתאימות";
	return `<div class="empty-state" role="status" aria-live="polite"><p class="empty">${escapeHtml(msg)}</p></div>`;
}

const searchHighlight = Object.freeze({
	escapeHtml,
	highlightSearchHits,
	filterSummaryItems,
	renderEmptyState,
});

const FOCUS_READER_FONT_SIZES = Object.freeze(["normal", "large", "huge"]);
const FOCUS_READER_LINE_WIDTH = "65ch";
const DEFAULT_FOCUS_READER_CONFIG = Object.freeze({
	enabled: false,
	fontSize: "normal",
	maxWidth: "65ch",
	rtl: true,
	inlineFormulas: true,
});

const FONT_SIZE_REM_MAP = Object.freeze({
	normal: "1rem",
	large: "1.25rem",
	huge: "1.5rem",
});

function validateFocusReaderConfig(config) {
	if (!config || typeof config !== "object" || Array.isArray(config)) {
		return Object.freeze({ ...DEFAULT_FOCUS_READER_CONFIG });
	}
	const enabled = typeof config.enabled === "boolean" ? config.enabled : false;
	const fontSize = FOCUS_READER_FONT_SIZES.includes(config.fontSize)
		? config.fontSize
		: "normal";
	const maxWidth =
		typeof config.maxWidth === "string" && config.maxWidth.trim().length > 0
			? config.maxWidth.trim()
			: FOCUS_READER_LINE_WIDTH;
	const rtl = typeof config.rtl === "boolean" ? config.rtl : true;
	const inlineFormulas =
		typeof config.inlineFormulas === "boolean" ? config.inlineFormulas : true;

	return Object.freeze({
		enabled,
		fontSize,
		maxWidth,
		rtl,
		inlineFormulas,
	});
}

function toggleFocusReader(currentConfig) {
	const normalized = validateFocusReaderConfig(currentConfig);
	return Object.freeze({
		...normalized,
		enabled: !normalized.enabled,
	});
}

function setFocusReaderFontSize(currentConfig, fontSize) {
	const normalized = validateFocusReaderConfig(currentConfig);
	const validSize = FOCUS_READER_FONT_SIZES.includes(fontSize)
		? fontSize
		: normalized.fontSize;
	return Object.freeze({
		...normalized,
		fontSize: validSize,
	});
}

function getFocusReaderStyles(config) {
	const normalized = validateFocusReaderConfig(config);
	return Object.freeze({
		maxWidth: normalized.maxWidth,
		direction: normalized.rtl ? "rtl" : "ltr",
		textAlign: normalized.rtl ? "right" : "left",
		fontSize: FONT_SIZE_REM_MAP[normalized.fontSize] || "1rem",
	});
}

function formatInlineFormulas(text) {
	if (typeof text !== "string" || text.length === 0) {
		return "";
	}
	const escaped = escapeHtml(text);
	return escaped.replace(
		/(\$\$[^\r\n]+?\$\$|\$[^$\r\n]+?\$|\\\([^\r\n]+?\\\)|\\\[[^\r\n]+?\\\])/g,
		'<span class="math-inline" dir="ltr">$1</span>',
	);
}

function saveFocusReaderConfig(
	backend,
	config,
	key = "peered_focus_reader_v1",
) {
	try {
		if (!backend || typeof backend.setItem !== "function") {
			return { ok: false, error: "invalid backend" };
		}
		const storageKey =
			typeof key === "string" && key.length > 0
				? key
				: "peered_focus_reader_v1";
		const normalized = validateFocusReaderConfig(config);
		backend.setItem(storageKey, JSON.stringify(normalized));
		return { ok: true };
	} catch (err) {
		return {
			ok: false,
			error: err?.message ? err.message : String(err),
		};
	}
}

function loadFocusReaderConfig(backend, key = "peered_focus_reader_v1") {
	try {
		if (!backend || typeof backend.getItem !== "function") {
			return DEFAULT_FOCUS_READER_CONFIG;
		}
		const storageKey =
			typeof key === "string" && key.length > 0
				? key
				: "peered_focus_reader_v1";
		const raw = backend.getItem(storageKey);
		if (
			raw === null ||
			raw === undefined ||
			(typeof raw === "string" && raw.trim().length === 0)
		) {
			return DEFAULT_FOCUS_READER_CONFIG;
		}
		const parsed = JSON.parse(raw);
		return validateFocusReaderConfig(parsed);
	} catch {
		return DEFAULT_FOCUS_READER_CONFIG;
	}
}

const focusReaderConfig = Object.freeze({
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
});

function getDropoutRiskReason(
	heldCount,
	minHeld,
	consecutiveStreak,
	_missedCount,
	lang = "he",
) {
	const belowThreshold = heldCount < minHeld;
	const hasStreak = consecutiveStreak >= 2;

	if (lang === "ar") {
		if (belowThreshold && hasStreak) {
			return `أقل من الحد الأدنى للجلسات (${heldCount}/${minHeld}) وتتالي الإلغاءات/الغياب (${consecutiveStreak})`;
		}
		if (belowThreshold) {
			return `أقل من الحد الأدنى للجلسات (${heldCount} من ${minHeld})`;
		}
		return `تتالي الإلغاءات أو الغياب (${consecutiveStreak} متتالية)`;
	}

	if (lang === "ru") {
		if (belowThreshold && hasStreak) {
			return `Ниже порога занятий (${heldCount}/${minHeld}) и серия отмен/пропусков (${consecutiveStreak})`;
		}
		if (belowThreshold) {
			return `Ниже порога проведенных занятий (${heldCount} из ${minHeld})`;
		}
		return `Серия отмен или пропусков (${consecutiveStreak} подряд)`;
	}

	// Hebrew (default)
	if (belowThreshold && hasStreak) {
		return `מתחת לסף מפגשים (${heldCount}/${minHeld}) ורצף ביטולים/החמצות (${consecutiveStreak})`;
	}
	if (belowThreshold) {
		return `מתחת לסף מפגשים שהתקיימו (${heldCount} מתוך ${minHeld})`;
	}
	return `רצף ביטולים או החמצות (${consecutiveStreak} ברצף)`;
}

function detectInactivePairs(records, pairs, options) {
	const rawMin =
		typeof options === "number"
			? options
			: options && typeof options.minHeldCount === "number"
				? options.minHeldCount
				: 2;
	const minHeld = Number.isFinite(rawMin) ? rawMin : 2;
	const lang =
		options && (options.lang === "ar" || options.lang === "ru")
			? options.lang
			: "he";
	const consecutiveThreshold = 2;

	const cleanRecords = Array.isArray(records)
		? records
		: records && Array.isArray(records.entries)
			? records.entries
			: [];

	const pairIndexes = new Set();
	if (Array.isArray(pairs)) {
		pairs.forEach((p, idx) => {
			const pIdx =
				p && Number.isInteger(p.pairIndex) && p.pairIndex >= 0
					? p.pairIndex
					: idx;
			pairIndexes.add(pIdx);
		});
	}
	for (const r of cleanRecords) {
		if (r && Number.isInteger(r.pairIndex) && r.pairIndex >= 0) {
			pairIndexes.add(r.pairIndex);
		}
	}

	if (pairIndexes.size === 0) {
		return Object.freeze([]);
	}

	const sortedPairIndexes = Array.from(pairIndexes).sort((a, b) => a - b);
	const atRiskPairs = [];

	for (const pIdx of sortedPairIndexes) {
		const pairRecords = [];
		for (const r of cleanRecords) {
			if (!r || typeof r !== "object" || r.pairIndex !== pIdx) continue;
			pairRecords.push(r);
		}

		pairRecords.sort((a, b) => (a.date || "").localeCompare(b.date || ""));

		let heldCount = 0;
		let missedOrCancelledCount = 0;
		let currentStreak = 0;
		let maxStreak = 0;

		for (const r of pairRecords) {
			if (r.status === "held") {
				heldCount += 1;
				currentStreak = 0;
			} else if (r.status === "missed" || r.status === "cancelled") {
				missedOrCancelledCount += 1;
				currentStreak += 1;
				if (currentStreak > maxStreak) {
					maxStreak = currentStreak;
				}
			}
		}

		const isBelowThreshold = heldCount < minHeld;
		const hasStreak = maxStreak >= consecutiveThreshold;

		if (isBelowThreshold || hasStreak) {
			const riskReason = getDropoutRiskReason(
				heldCount,
				minHeld,
				maxStreak,
				missedOrCancelledCount,
				lang,
			);
			const belowGap = Math.max(0, minHeld - heldCount);
			const riskScore =
				belowGap * 1000 +
				maxStreak * 100 +
				missedOrCancelledCount * 10 -
				heldCount;

			atRiskPairs.push({
				pairIndex: pIdx,
				heldCount,
				missedOrCancelledCount,
				riskReason,
				_riskScore: riskScore,
			});
		}
	}

	atRiskPairs.sort((a, b) => {
		if (b._riskScore !== a._riskScore) {
			return b._riskScore - a._riskScore;
		}
		return a.pairIndex - b.pairIndex;
	});

	const result = atRiskPairs.map((p) =>
		Object.freeze({
			pairIndex: p.pairIndex,
			heldCount: p.heldCount,
			missedOrCancelledCount: p.missedOrCancelledCount,
			riskReason: p.riskReason,
		}),
	);

	return Object.freeze(result);
}

module.exports = {
	filterAttendanceRecords,
	getPairSessionTimeline,
	updateSessionOutcome,
	ATTENDANCE_STATUSES,
	makeAttendanceLog,
	recordAttendance,
	attendanceSummary,
	stalePairs,
	AI_TOPICS,
	AI_TOPIC_KEYS,
	getAITopicsSummary,
	calculatePairHours,
	getScholarshipHoursSummary,
	buildScholarshipReport,
	serializeAttendance,
	deserializeAttendance,
	MAX_ATTENDANCE_RECORDS,
	isValidAttendanceDate,
	estimateReadingTimeHebrew,
	getTopicTagColor,
	getTopicTagStyle,
	getSummaryQualityScore,
	summaryCardMeta,
	escapeHtml,
	highlightSearchHits,
	filterSummaryItems,
	renderEmptyState,
	searchHighlight,
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
	detectInactivePairs,
};

function filterAttendanceRecords(records, filters) {
	const clean = getCleanAttendanceRecords(records);
	const f = filters || {};
	return Object.freeze(clean.filter((r) => {
		if (!r || typeof r !== 'object') return false;
		if (f.status && f.status !== 'all' && r.status !== f.status) return false;
		if (f.pairIndex !== undefined && f.pairIndex !== null && r.pairIndex !== f.pairIndex) return false;
		if (f.aiTopic && r.aiTopic !== f.aiTopic) return false;
		return true;
	}));
}

function getPairSessionTimeline(records, pairIndex) {
	const clean = getCleanAttendanceRecords(records);
	const filtered = clean.filter((r) => r && r.pairIndex === pairIndex);
	filtered.sort((a, b) => (a.date || '').localeCompare(b.date || ''));
	return Object.freeze(filtered);
}

function updateSessionOutcome(records, pairIndex, date, patch) {
	const clean = getCleanAttendanceRecords(records);
	const idx = clean.findIndex((r) => r && r.pairIndex === pairIndex && r.date === date);
	if (idx === -1) {
		throw new Error('session record not found');
	}
	const target = clean[idx];
	const updatedRow = {
		pairIndex: target.pairIndex,
		date: target.date,
		status: patch && patch.status !== undefined ? patch.status : target.status,
		durationHours: patch && patch.durationHours !== undefined ? patch.durationHours : target.durationHours,
	};
	if (patch && patch.aiTopic !== undefined) {
		updatedRow.aiTopic = patch.aiTopic;
	} else if (target.aiTopic !== undefined) {
		updatedRow.aiTopic = target.aiTopic;
	}
	const validated = sanitizeAttendanceRow(updatedRow, parseDate);
	if (!validated) {
		throw new Error('invalid attendance patch');
	}
	const updatedList = clean.slice();
	updatedList[idx] = validated;
	return Object.freeze({ entries: Object.freeze(updatedList) });
}
