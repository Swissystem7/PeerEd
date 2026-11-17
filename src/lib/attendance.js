// PeerEd - attendance (stage 3): held / missed / postponed / cancelled per pair and date.
// Immutable log, internal pair indexes only. No clock: every date is passed in.

const { diffDays, parseDate } = require("./semester.js");
const { PERSONAL_DATA_ERROR } = require("./profile.js");

const ATTENDANCE_STATUSES = Object.freeze([
	"held",
	"missed",
	"postponed",
	"cancelled",
]);

const MAX_ATTENDANCE_RECORDS = 5000;

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

function isPlainObject(val) {
	if (!val) return false;
	if (typeof val !== "object") return false;
	return !Array.isArray(val);
}

function isValidPairIndex(idx) {
	if (!Number.isInteger(idx)) return false;
	return idx >= 0;
}

function isValidDuration(dur) {
	if (typeof dur !== "number") return false;
	if (!Number.isFinite(dur)) return false;
	return dur > 0;
}

function isValidNonNegativeDuration(dur) {
	if (typeof dur !== "number") return false;
	if (!Number.isFinite(dur)) return false;
	return dur >= 0;
}

function isValidAiTopic(topic) {
	if (typeof topic !== "string") return false;
	return AI_TOPIC_KEYS.includes(topic);
}

function sanitizeAiTopic(topic) {
	if (topic === undefined) return undefined;
	if (topic === null) return null;
	if (isValidAiTopic(topic)) return topic;
	return undefined;
}

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
	if (!isValidPairIndex(o.pairIndex))
		throw new Error("invalid attendance: pairIndex");
	parseDate(o.date);
	if (!isValidAttendanceDate(o.date))
		throw new Error("invalid attendance: future or invalid date");
	if (!ATTENDANCE_STATUSES.includes(o.status))
		throw new Error("invalid attendance status");
	return o;
}

function resolveAttendanceDuration(o) {
	if (o.status !== "held") return 0.0;
	if (isValidDuration(o.durationHours)) {
		return o.durationHours;
	}
	return 1.0;
}

function resolveAttendanceAiTopic(o) {
	if (o.aiTopic === undefined) return undefined;
	if (o.aiTopic === null) return null;
	if (isValidAiTopic(o.aiTopic)) {
		return o.aiTopic;
	}
	throw new Error("invalid attendance: aiTopic");
}

function buildAttendanceEntry(o, durationHours, aiTopic) {
	const entryObj = {
		pairIndex: o.pairIndex,
		date: o.date,
		status: o.status,
		durationHours: durationHours,
	};
	if (aiTopic !== undefined) {
		entryObj.aiTopic = aiTopic;
	}
	return Object.freeze(entryObj);
}

function replaceAttendanceEntry(entries, existingIdx, entry) {
	const updated = entries.slice();
	updated[existingIdx] = entry;
	return Object.freeze({ entries: Object.freeze(updated) });
}

function appendAttendanceEntry(entries, entry) {
	let prior = entries;
	if (prior.length >= MAX_ATTENDANCE_RECORDS) {
		prior = prior.slice(prior.length - MAX_ATTENDANCE_RECORDS + 1);
	}
	return Object.freeze({ entries: Object.freeze(prior.concat([entry])) });
}

function findExistingEntryIndex(entries, o) {
	return entries.findIndex(
		(e) => e.pairIndex === o.pairIndex && e.date === o.date,
	);
}

function recordAttendance(log, input) {
	assertLog(log);
	const o = validateAttendanceInput(input);
	const entry = buildAttendanceEntry(
		o,
		resolveAttendanceDuration(o),
		resolveAttendanceAiTopic(o),
	);
	const existingIdx = findExistingEntryIndex(log.entries, o);
	if (existingIdx !== -1) {
		return replaceAttendanceEntry(log.entries, existingIdx, entry);
	}
	return appendAttendanceEntry(log.entries, entry);
}

function isRowDateAcceptable(r, validateDateFn) {
	if (typeof r.date !== "string") return false;
	if (!validateDateFn) return true;
	try {
		validateDateFn(r.date);
	} catch {
		return false;
	}
	return true;
}

function resolveSanitizedDuration(r) {
	if (isValidNonNegativeDuration(r.durationHours)) return r.durationHours;
	return 1.0;
}

function sanitizeAttendanceRow(r, validateDateFn) {
	if (!isPlainObject(r)) return null;
	if (!isValidPairIndex(r.pairIndex)) return null;
	if (!isRowDateAcceptable(r, validateDateFn)) return null;
	if (!ATTENDANCE_STATUSES.includes(r.status)) return null;
	const row = {
		pairIndex: r.pairIndex,
		date: r.date,
		status: r.status,
		durationHours: resolveSanitizedDuration(r),
	};
	const topic = sanitizeAiTopic(r.aiTopic);
	if (topic !== undefined) {
		row.aiTopic = topic;
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

function isWithinSummaryRange(e, o) {
	if (o.from && e.date < o.from) return false;
	if (o.to && e.date > o.to) return false;
	return true;
}

function emptyStatusCounts() {
	return { held: 0, missed: 0, postponed: 0, cancelled: 0 };
}

function accumulateSummaryEntry(e, byStatus, byPair) {
	byStatus[e.status] += 1;
	if (!byPair[e.pairIndex]) {
		byPair[e.pairIndex] = emptyStatusCounts();
	}
	byPair[e.pairIndex][e.status] += 1;
}

function computeHeldRate(byStatus) {
	const decided = byStatus.held + byStatus.missed;
	if (decided === 0) return null;
	return Math.round((byStatus.held / decided) * 1000) / 1000;
}

function attendanceSummary(log, opts) {
	assertLog(log);
	const o = opts || {};
	const byStatus = emptyStatusCounts();
	const byPair = {};
	log.entries.forEach((e) => {
		if (!isWithinSummaryRange(e, o)) return;
		accumulateSummaryEntry(e, byStatus, byPair);
	});
	return {
		byStatus,
		byPair,
		heldRate: computeHeldRate(byStatus),
	};
}

function applyParticipantTopic(p, result, topic) {
	if (!isValidAiTopic(topic)) return;
	result[topic].total += 1;
	if (p.role === "student") {
		result[topic].offered += 1;
	} else if (p.role === "pupil") {
		result[topic].requested += 1;
	}
}

function applyParticipantTopics(p, result) {
	if (!isPlainObject(p)) return;
	if (!Array.isArray(p.target_ai_topics)) return;
	const uniqueTopics = new Set(p.target_ai_topics);
	for (const topic of uniqueTopics) {
		applyParticipantTopic(p, result, topic);
	}
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
		applyParticipantTopics(p, result);
	}
	return result;
}

function recordLastHeldDate(lastMap, e) {
	if (e.status !== "held") return;
	const prevDate = lastMap.get(e.pairIndex);
	if (!prevDate || e.date > prevDate) {
		lastMap.set(e.pairIndex, e.date);
	}
}

function buildLastHeldMap(entries) {
	const last = new Map();
	for (const e of entries) {
		recordLastHeldDate(last, e);
	}
	return last;
}

function resolveStalePairIndex(pair, pairIndex) {
	if (isPlainObject(pair) && Number.isInteger(pair.pairIndex)) {
		return pair.pairIndex;
	}
	return pairIndex;
}

function evaluatePairStaleness(pair, pairIndex, last, ctx) {
	const idx = resolveStalePairIndex(pair, pairIndex);
	const lastHeld = last.get(idx) || null;
	const ref = lastHeld || ctx.since;
	if (ref === null) return null;
	const gap = diffDays(ref, ctx.asOfISO);
	if (gap < ctx.days) return null;
	return {
		pairIndex: idx,
		lastHeldDate: lastHeld,
		daysSince: gap,
		alertHe: `הזוג לא נפגש כבר ${gap} ימים`,
	};
}

function resolveStaleDays(opts) {
	if (opts && Number.isInteger(opts.days)) return opts.days;
	return 14;
}

function resolveStaleSince(opts) {
	const since = opts?.since || null;
	if (since) parseDate(since);
	return since;
}

// Pairs with no 'held' session for at least `days` days (default 14) as of asOfISO.
function stalePairs(pairs, log, asOfISO, opts) {
	assertLog(log);
	parseDate(asOfISO);
	const ctx = {
		days: resolveStaleDays(opts),
		since: resolveStaleSince(opts),
		asOfISO,
	};
	const last = buildLastHeldMap(log.entries);
	const pairList = Array.isArray(pairs) ? pairs : [];
	const out = [];
	pairList.forEach((pair, pairIndex) => {
		const item = evaluatePairStaleness(pair, pairIndex, last, ctx);
		if (item) out.push(item);
	});
	return out.sort(
		(a, b) => b.daysSince - a.daysSince || a.pairIndex - b.pairIndex,
	);
}

function getRecordDurationHours(record) {
	if (!record) return 1.0;
	if (isValidDuration(record.durationHours)) {
		return record.durationHours;
	}
	return 1.0;
}

function isHeldPairRecord(r, pairIndex) {
	if (!r) return false;
	if (r.pairIndex !== pairIndex) return false;
	return r.status === "held";
}

// Sums durations for records with r.pairIndex === pairIndex and r.status === 'held'.
// Default duration is 1.0 per held session unless record.durationHours is a positive finite number.
// Returns 0 for non-array inputs, invalid pairIndex, or when no matching held records exist.
function calculatePairHours(attendanceRecords, pairIndex) {
	if (!Array.isArray(attendanceRecords)) return 0;
	if (!isValidPairIndex(pairIndex)) return 0;
	let total = 0;
	for (const r of attendanceRecords) {
		if (isHeldPairRecord(r, pairIndex)) {
			total += getRecordDurationHours(r);
		}
	}
	return total;
}

function matchesPairIndex(candidate, pairIndex) {
	if (!isPlainObject(candidate)) return false;
	if (!Number.isInteger(candidate.pairIndex)) return true;
	return candidate.pairIndex === pairIndex;
}

function findPairInArray(pairs, pairIndex) {
	const candidate = pairs[pairIndex];
	if (matchesPairIndex(candidate, pairIndex)) {
		return candidate;
	}
	return (
		pairs.find((p) => isPlainObject(p) && p.pairIndex === pairIndex) || null
	);
}

function findPairObject(pairs, pairIndex) {
	if (!pairs) return null;
	if (Array.isArray(pairs)) {
		return findPairInArray(pairs, pairIndex);
	}
	if (typeof pairs === "object") {
		const candidate = pairs[pairIndex];
		if (matchesPairIndex(candidate, pairIndex)) {
			return candidate;
		}
	}
	return null;
}

function addParticipantHours(result, pair, duration) {
	if (!isPlainObject(pair)) return;
	const participants = new Set();
	if (isValidPairIndex(pair.studentIndex)) {
		participants.add(pair.studentIndex);
	}
	if (isValidPairIndex(pair.pupilIndex)) {
		participants.add(pair.pupilIndex);
	}
	for (const pIdx of participants) {
		result.byParticipant[pIdx] = (result.byParticipant[pIdx] || 0) + duration;
	}
}

function accumulateScholarshipRecord(r, pairs, result) {
	if (!isPlainObject(r)) return;
	if (!isValidPairIndex(r.pairIndex)) return;
	if (r.status !== "held") return;

	const duration = getRecordDurationHours(r);
	result.totalHeldSessions += 1;
	result.totalHours += duration;
	result.byPair[r.pairIndex] = (result.byPair[r.pairIndex] || 0) + duration;

	const pair = findPairObject(pairs, r.pairIndex);
	addParticipantHours(result, pair, duration);
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
				isPlainObject(p) && isValidPairIndex(p.pairIndex) ? p.pairIndex : idx;
			pairIndexes.add(pIdx);
		});
	}
	for (const r of cleanRecords) {
		if (r && isValidPairIndex(r.pairIndex)) {
			pairIndexes.add(r.pairIndex);
		}
	}
	return Array.from(pairIndexes).sort((a, b) => a - b);
}

function processPairRecordForReport(r, pIdx, state) {
	if (!isPlainObject(r)) return;
	if (r.pairIndex !== pIdx) return;
	if (Object.hasOwn(state.statusCounts, r.status)) {
		state.statusCounts[r.status] += 1;
	}
	if (r.status !== "held") return;
	state.heldSessions += 1;
	state.totalHours += getRecordDurationHours(r);
	if (isValidAiTopic(r.aiTopic)) {
		state.coveredAiTopicsSet.add(r.aiTopic);
	}
}

function computePairReport(pIdx, cleanRecords, target) {
	const state = {
		heldSessions: 0,
		totalHours: 0,
		statusCounts: emptyStatusCounts(),
		coveredAiTopicsSet: new Set(),
	};

	for (const r of cleanRecords) {
		processPairRecordForReport(r, pIdx, state);
	}

	const completionPercent = computeCompletionPercent(state.totalHours, target);

	return {
		pairReport: Object.freeze({
			pairIndex: pIdx,
			heldSessions: state.heldSessions,
			totalHours: state.totalHours,
			targetHours: target,
			completionPercent,
			coveredAiTopics: Object.freeze(
				Array.from(state.coveredAiTopicsSet).sort(),
			),
			statusCounts: Object.freeze(state.statusCounts),
		}),
		metrics: {
			heldSessions: state.heldSessions,
			totalHours: state.totalHours,
			statusCounts: state.statusCounts,
			coveredAiTopics: state.coveredAiTopicsSet,
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
function resolveScholarshipTarget(targetHours) {
	if (typeof targetHours !== "number") return 30;
	if (!Number.isFinite(targetHours)) return 30;
	if (targetHours > 0) return targetHours;
	return 30;
}

function createScholarshipTotals() {
	return {
		heldSessions: 0,
		totalHours: 0,
		statusCounts: emptyStatusCounts(),
		aiTopics: new Set(),
	};
}

function mergePairMetrics(totals, metrics) {
	totals.heldSessions += metrics.heldSessions;
	totals.totalHours += metrics.totalHours;
	for (const st of Object.keys(totals.statusCounts)) {
		totals.statusCounts[st] += metrics.statusCounts[st];
	}
	for (const top of metrics.coveredAiTopics) {
		totals.aiTopics.add(top);
	}
}

function computeCompletionPercent(totalHours, expectedTotalHours) {
	if (expectedTotalHours > 0) {
		return Math.round((totalHours / expectedTotalHours) * 100);
	}
	return 0;
}

function buildScholarshipReport(records, pairs, targetHours) {
	const target = resolveScholarshipTarget(targetHours);

	const cleanRecords = getCleanAttendanceRecords(records);
	const sortedPairIndexes = collectPairIndexes(cleanRecords, pairs);

	const pairReports = [];
	const byPair = {};
	const totals = createScholarshipTotals();

	for (const pIdx of sortedPairIndexes) {
		const { pairReport, metrics } = computePairReport(
			pIdx,
			cleanRecords,
			target,
		);
		pairReports.push(pairReport);
		byPair[pIdx] = pairReport;
		mergePairMetrics(totals, metrics);
	}

	const overallHeldSessions = totals.heldSessions;
	const overallTotalHours = totals.totalHours;
	const overallStatusCounts = totals.statusCounts;
	const overallAiTopics = totals.aiTopics;

	const totalPairs = sortedPairIndexes.length;
	const expectedTotalHours = totalPairs * target;
	const overallCompletionPercent = computeCompletionPercent(
		overallTotalHours,
		expectedTotalHours,
	);

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

function normalizeMilestonePairs(pairs) {
	if (Array.isArray(pairs)) return pairs;
	if (isPlainObject(pairs)) return [pairs];
	if (Number.isInteger(pairs) && pairs >= 0) return [{ pairIndex: pairs }];
	return [];
}

/**
 * Computes scholarship completion milestones (25%, 50%, 75%, 100%) for pairs.
 * Zero PII.
 *
 * @param {Array<Object>|Object} records Attendance records or log
 * @param {Array<Object>|Object|number} pairs Matched pairs or pair index
 * @param {number} targetHours Target scholarship hours (default 30)
 * @returns {Array<Object>} List of milestones per pair, with byPair lookup
 */
function computeScholarshipMilestones(records, pairs, targetHours) {
	const target = resolveScholarshipTarget(targetHours);
	const cleanRecords = getCleanAttendanceRecords(records);
	const pairList = normalizeMilestonePairs(pairs);
	const sortedPairIndexes = collectPairIndexes(cleanRecords, pairList);

	const pairMilestones = [];
	const byPair = {};

	for (const pIdx of sortedPairIndexes) {
		const totalHours = calculatePairHours(cleanRecords, pIdx);
		const m25 = target * 0.25;
		const m50 = target * 0.5;
		const m75 = target * 0.75;
		const m100 = target;

		const reached25 = totalHours >= m25;
		const reached50 = totalHours >= m50;
		const reached75 = totalHours >= m75;
		const reached100 = totalHours >= m100;

		let nextMilestoneHours = m25;
		if (reached75) {
			nextMilestoneHours = m100;
		} else if (reached50) {
			nextMilestoneHours = m75;
		} else if (reached25) {
			nextMilestoneHours = m50;
		}

		const hoursRemaining = Math.max(0, target - totalHours);
		const completionPercent = computeCompletionPercent(totalHours, target);

		const item = Object.freeze({
			pairIndex: pIdx,
			totalHours,
			targetHours: target,
			reached25,
			reached50,
			reached75,
			reached100,
			nextMilestoneHours,
			hoursRemaining,
			completionPercent,
		});

		pairMilestones.push(item);
		byPair[pIdx] = item;
	}

	pairMilestones.byPair = Object.freeze(byPair);
	pairMilestones.pairs = pairMilestones;
	return Object.freeze(pairMilestones);
}

const CONFIRMATION_ROLES = Object.freeze(["student", "coordinator"]);
const CONFIRMATION_ALLOWED_KEYS = Object.freeze([
	"confirmedHours",
	"date",
	"pairIndex",
	"role",
]);

function validateConfirmationEntry(entry) {
	if (!isPlainObject(entry)) {
		throw new Error("invalid confirmation entry: expected object");
	}

	const keys = Object.keys(entry);
	for (const k of keys) {
		if (!CONFIRMATION_ALLOWED_KEYS.includes(k)) {
			throw new Error(PERSONAL_DATA_ERROR);
		}
	}

	if (!Number.isInteger(entry.pairIndex) || entry.pairIndex < 0) {
		throw new Error("invalid confirmation: invalid pairIndex");
	}

	if (
		typeof entry.role !== "string" ||
		!CONFIRMATION_ROLES.includes(entry.role)
	) {
		throw new Error(
			"invalid confirmation: role must be student or coordinator",
		);
	}

	if (
		typeof entry.confirmedHours !== "number" ||
		!Number.isFinite(entry.confirmedHours) ||
		entry.confirmedHours < 0
	) {
		throw new Error("invalid confirmation: invalid confirmedHours");
	}

	if (typeof entry.date !== "string") {
		throw new Error("invalid confirmation: date must be string");
	}

	try {
		parseDate(entry.date);
	} catch {
		throw new Error("invalid confirmation: invalid date");
	}

	if (!isValidAttendanceDate(entry.date)) {
		throw new Error("invalid confirmation: date cannot be in the future");
	}

	return Object.freeze({
		pairIndex: entry.pairIndex,
		role: entry.role,
		confirmedHours: entry.confirmedHours,
		date: entry.date,
	});
}

function extractConfirmationList(confirmations) {
	if (Array.isArray(confirmations)) {
		return confirmations.slice();
	}
	if (confirmations && Array.isArray(confirmations.entries)) {
		return confirmations.entries.slice();
	}
	return [];
}

function upsertConfirmationRecord(list, record) {
	const existingIdx = list.findIndex(
		(c) => c && c.pairIndex === record.pairIndex && c.role === record.role,
	);

	if (existingIdx !== -1) {
		list[existingIdx] = record;
	} else {
		list.push(record);
	}

	list.entries = list;
	return Object.freeze(list);
}

function wrapConfirmations(confirmations, frozenList) {
	if (
		confirmations &&
		isPlainObject(confirmations) &&
		!Array.isArray(confirmations)
	) {
		return Object.freeze({ entries: frozenList });
	}
	return frozenList;
}

/**
 * Records an anonymous bilateral hours confirmation per pair and role.
 * Zero PII.
 *
 * @param {Array<Object>|Object} confirmations Existing confirmations
 * @param {Object} entry Confirmation entry
 * @returns {Array<Object>|Object} Updated confirmations
 */
function recordPairHoursConfirmation(confirmations, entry) {
	const cleanRecord = validateConfirmationEntry(entry);
	const existingList = extractConfirmationList(confirmations);
	const frozenList = upsertConfirmationRecord(existingList, cleanRecord);
	return wrapConfirmations(confirmations, frozenList);
}

function cleanDateParam(val) {
	if (typeof val !== "string") return null;
	const trimmed = val.trim();
	return trimmed.length > 0 ? trimmed : null;
}

function isRecordInDateRange(r, start, end) {
	if (!isPlainObject(r)) return false;
	if (typeof r.date !== "string") return false;
	if (start && r.date < start) return false;
	if (end && r.date > end) return false;
	return true;
}

/**
 * Filters attendance records by date range (inclusive, YYYY-MM-DD).
 * Supports open ranges (null/undefined/empty string).
 *
 * @param {Array<Object>|Object} records Attendance records or log
 * @param {string|null|undefined} startDate Minimum date (inclusive)
 * @param {string|null|undefined} endDate Maximum date (inclusive)
 * @returns {Array<Object>} Filtered frozen records
 */
function filterAttendanceByDateRange(records, startDate, endDate) {
	const clean = getCleanAttendanceRecords(records);
	const start = cleanDateParam(startDate);
	const end = cleanDateParam(endDate);
	const filtered = clean.filter((r) => isRecordInDateRange(r, start, end));
	return Object.freeze(filtered);
}

/**
 * Exports anonymous scholarship report in CSV format.
 * Zero PII.
 *
 * @param {Array<Object>|Object} records Attendance records or log
 * @param {Array<Object>} pairs Matched pairs list
 * @param {number} targetHours Target scholarship hours (default 30)
 * @returns {string} Anonymous CSV text
 */
function exportScholarshipCsv(records, pairs, targetHours) {
	const report = buildScholarshipReport(records, pairs, targetHours);
	const lines = [
		"pairIndex,heldSessions,totalHours,targetHours,completionPercent,coveredAiTopics",
	];
	for (const p of report.pairs) {
		const topics =
			Array.isArray(p.coveredAiTopics) && p.coveredAiTopics.length > 0
				? p.coveredAiTopics.join(";")
				: "";
		lines.push(
			`${p.pairIndex},${p.heldSessions},${p.totalHours},${p.targetHours},${p.completionPercent},${topics}`,
		);
	}
	return `${lines.join("\n")}\n`;
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

function accumulateAiTopicScore(item, acc) {
	const tot = typeof item.total === "number" ? item.total : 0;
	const req = typeof item.requested === "number" ? item.requested : 0;
	const off = typeof item.offered === "number" ? item.offered : 0;
	acc.totalCount += tot;
	if (tot > 0) acc.activeTopics += 1;
	if (req > 0 && off > 0) acc.balancedTopics += 1;
}

function scoreAiSummary(summary, keys) {
	const topicKeys = keys.filter(
		(k) => summary[k] && typeof summary[k] === "object",
	);
	if (topicKeys.length === 0) {
		return { score: 0, rating: "empty", labelHe: "ללא נתונים" };
	}
	const acc = { totalCount: 0, activeTopics: 0, balancedTopics: 0 };
	for (const k of topicKeys) {
		accumulateAiTopicScore(summary[k], acc);
	}
	if (acc.totalCount === 0) {
		return { score: 0, rating: "empty", labelHe: "ללא נתונים" };
	}
	const diversityScore =
		(acc.activeTopics / Math.max(1, topicKeys.length)) * 40;
	const volumeScore = Math.min(35, acc.totalCount * 7);
	const balanceScore =
		(acc.balancedTopics / Math.max(1, acc.activeTopics)) * 25;
	return Math.round(diversityScore + volumeScore + balanceScore);
}

function isScholarshipEmpty(totalHours, totalHeld, participantCount) {
	if (totalHours > 0) return false;
	if (totalHeld > 0) return false;
	return participantCount === 0;
}

function scoreScholarshipSummary(summary) {
	const totalHours =
		typeof summary.totalHours === "number" ? summary.totalHours : 0;
	const totalHeld =
		typeof summary.totalHeldSessions === "number"
			? summary.totalHeldSessions
			: 0;
	const participantCount = isPlainObject(summary.byParticipant)
		? Object.keys(summary.byParticipant).length
		: 0;
	if (isScholarshipEmpty(totalHours, totalHeld, participantCount)) {
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

function detectSummaryType(summary, keys) {
	const isAi =
		keys.some((k) => AI_TOPIC_KEYS.includes(k)) ||
		keys.some((k) => isPlainObject(summary[k]) && "total" in summary[k]);
	if (isAi) return "ai";
	if ("totalHours" in summary || "totalHeldSessions" in summary)
		return "scholarship";
	if ("byStatus" in summary && isPlainObject(summary.byStatus))
		return "attendance";
	return "generic";
}

function dispatchSummaryScore(summary, keys, type) {
	if (type === "ai") return scoreAiSummary(summary, keys);
	if (type === "scholarship") return scoreScholarshipSummary(summary);
	if (type === "attendance") return scoreAttendanceSummary(summary);
	return scoreGenericSummary(summary, keys);
}

function getSummaryQualityScore(summary) {
	if (!isPlainObject(summary)) {
		return { score: 0, rating: "empty", labelHe: "ללא נתונים" };
	}

	const keys = Object.keys(summary);
	if (keys.length === 0) {
		return { score: 0, rating: "empty", labelHe: "ללא נתונים" };
	}

	const type = detectSummaryType(summary, keys);
	const res = dispatchSummaryScore(summary, keys, type);
	if (typeof res === "object") return res;

	const score = Math.max(1, Math.min(100, res));
	const { rating, labelHe } = ratingForScore(score);
	return { score, rating, labelHe };
}

function ratingForScore(score) {
	if (score >= 80) return { rating: "high", labelHe: "מצוין" };
	if (score >= 45) return { rating: "medium", labelHe: "טוב" };
	return { rating: "low", labelHe: "בסיסי" };
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

function normalizeCriterionValue(v) {
	return String(v).toLowerCase();
}

function toNormalizedList(v) {
	if (Array.isArray(v)) return v.map(normalizeCriterionValue);
	return [normalizeCriterionValue(v)];
}

function matchesArrayCriterion(itemVal, filterVal) {
	const itemTopics = toNormalizedList(itemVal);
	const targetTopics = toNormalizedList(filterVal);
	return itemTopics.some((t) => targetTopics.includes(t));
}

function matchesCriterion(itemVal, filterVal, isArrayTarget = false) {
	if (filterVal === null) return true;
	if (itemVal == null) return false;
	if (isArrayTarget) return matchesArrayCriterion(itemVal, filterVal);
	if (Array.isArray(filterVal)) {
		return toNormalizedList(filterVal).includes(
			normalizeCriterionValue(itemVal),
		);
	}
	return (
		normalizeCriterionValue(itemVal) === normalizeCriterionValue(filterVal)
	);
}

function cleanFilterValue(val) {
	if (val == null) return null;
	if (val === "") return null;
	if (val === "all") return null;
	return val;
}

function matchesFilterCriteria(item, filters) {
	const { semester, difficulty, topic } = filters;
	if (semester !== null && !matchesCriterion(item.semester, semester)) {
		return false;
	}
	if (difficulty !== null && !matchesCriterion(item.difficulty, difficulty)) {
		return false;
	}
	if (topic !== null && !matchesCriterion(item.topic, topic, true)) {
		return false;
	}
	return true;
}

function itemMatchesFilters(item, q, filters) {
	if (!isPlainObject(item)) return false;
	if (!matchesQuery(item, q)) return false;
	return matchesFilterCriteria(item, filters);
}

function filterSummaryItems(items, filters) {
	if (!Array.isArray(items) || items.length === 0) {
		return [];
	}
	if (!isPlainObject(filters)) {
		return items.slice();
	}

	const q =
		typeof filters.query === "string" ? filters.query.trim().toLowerCase() : "";
	const filterCriteria = {
		semester: cleanFilterValue(filters.semester),
		difficulty: cleanFilterValue(filters.difficulty),
		topic: cleanFilterValue(filters.topic),
	};

	return items.filter((item) => itemMatchesFilters(item, q, filterCriteria));
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

function resolveMaxWidth(maxWidth) {
	if (typeof maxWidth !== "string") return FOCUS_READER_LINE_WIDTH;
	const trimmed = maxWidth.trim();
	return trimmed.length > 0 ? trimmed : FOCUS_READER_LINE_WIDTH;
}

function resolveFocusFontSize(config) {
	if (FOCUS_READER_FONT_SIZES.includes(config.fontSize)) return config.fontSize;
	return "normal";
}

function resolveFocusBool(value, fallback) {
	if (typeof value === "boolean") return value;
	return fallback;
}

function validateFocusReaderConfig(config) {
	if (!isPlainObject(config)) {
		return Object.freeze({ ...DEFAULT_FOCUS_READER_CONFIG });
	}
	const enabled = resolveFocusBool(config.enabled, false);
	const fontSize = resolveFocusFontSize(config);
	const maxWidth = resolveMaxWidth(config.maxWidth);
	const rtl = resolveFocusBool(config.rtl, true);
	const inlineFormulas = resolveFocusBool(config.inlineFormulas, true);

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

function isBlankRawStorage(raw) {
	if (raw == null) return true;
	if (typeof raw === "string") return raw.trim().length === 0;
	return false;
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
		if (isBlankRawStorage(raw)) {
			return DEFAULT_FOCUS_READER_CONFIG;
		}
		return validateFocusReaderConfig(JSON.parse(raw));
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

function formatRiskReasonAr(heldCount, minHeld, streak) {
	const below = heldCount < minHeld;
	const hasStreak = streak >= 2;
	if (below && hasStreak) {
		return `أقل من الحد الأدنى للجلسات (${heldCount}/${minHeld}) وتتالي الإلغاءات/الغياب (${streak})`;
	}
	if (below) {
		return `أقل من الحد الأدنى للجلسات (${heldCount} من ${minHeld})`;
	}
	return `تتالي الإلغاءات أو الغياب (${streak} متتالية)`;
}

function formatRiskReasonRu(heldCount, minHeld, streak) {
	const below = heldCount < minHeld;
	const hasStreak = streak >= 2;
	if (below && hasStreak) {
		return `Ниже порога занятий (${heldCount}/${minHeld}) и серия отмен/пропусков (${streak})`;
	}
	if (below) {
		return `Ниже порога проведенных занятий (${heldCount} из ${minHeld})`;
	}
	return `Серия отмен или пропусков (${streak} подряд)`;
}

function formatRiskReasonHe(heldCount, minHeld, streak) {
	const below = heldCount < minHeld;
	const hasStreak = streak >= 2;
	if (below && hasStreak) {
		return `מתחת לסף מפגשים (${heldCount}/${minHeld}) ורצף ביטולים/החמצות (${streak})`;
	}
	if (below) {
		return `מתחת לסף מפגשים שהתקיימו (${heldCount} מתוך ${minHeld})`;
	}
	return `רצף ביטולים או החמצות (${streak} ברצף)`;
}

function getDropoutRiskReason(heldCount, minHeld, streak, ...rest) {
	const lang = rest.find((arg) => typeof arg === "string") || "he";
	if (lang === "ar") {
		return formatRiskReasonAr(heldCount, minHeld, streak);
	}
	if (lang === "ru") {
		return formatRiskReasonRu(heldCount, minHeld, streak);
	}
	return formatRiskReasonHe(heldCount, minHeld, streak);
}

function resolveMinHeldCount(options) {
	let rawMin = 2;
	if (typeof options === "number") {
		rawMin = options;
	} else if (options && typeof options.minHeldCount === "number") {
		rawMin = options.minHeldCount;
	}
	if (Number.isFinite(rawMin)) return rawMin;
	return 2;
}

function resolveDropoutLang(options) {
	if (!options) return "he";
	if (options.lang === "ar") return "ar";
	if (options.lang === "ru") return "ru";
	return "he";
}

function resolveDropoutOptions(options) {
	return {
		minHeld: resolveMinHeldCount(options),
		lang: resolveDropoutLang(options),
	};
}

function collectDropoutPairIndexes(cleanRecords, pairs) {
	const pairIndexes = new Set();
	if (Array.isArray(pairs)) {
		pairs.forEach((p, idx) => {
			const pIdx =
				isPlainObject(p) && isValidPairIndex(p.pairIndex) ? p.pairIndex : idx;
			pairIndexes.add(pIdx);
		});
	}
	for (const r of cleanRecords) {
		if (r && isValidPairIndex(r.pairIndex)) {
			pairIndexes.add(r.pairIndex);
		}
	}
	return Array.from(pairIndexes).sort((a, b) => a - b);
}

function stepPairStreak(r, acc) {
	if (r.status === "held") {
		acc.heldCount += 1;
		acc.currentStreak = 0;
		return;
	}
	if (r.status === "missed" || r.status === "cancelled") {
		acc.missedOrCancelledCount += 1;
		acc.currentStreak += 1;
		acc.maxStreak = Math.max(acc.maxStreak, acc.currentStreak);
	}
}

function analyzePairStreak(pairRecords) {
	const acc = {
		heldCount: 0,
		missedOrCancelledCount: 0,
		currentStreak: 0,
		maxStreak: 0,
	};
	for (const r of pairRecords) {
		stepPairStreak(r, acc);
	}
	return acc;
}

function evaluatePairDropoutRisk(pIdx, cleanRecords, opts) {
	const pairRecords = [];
	for (const r of cleanRecords) {
		if (isPlainObject(r) && r.pairIndex === pIdx) {
			pairRecords.push(r);
		}
	}

	pairRecords.sort((a, b) => (a.date || "").localeCompare(b.date || ""));
	const { heldCount, missedOrCancelledCount, maxStreak } =
		analyzePairStreak(pairRecords);

	const isBelowThreshold = heldCount < opts.minHeld;
	const hasStreak = maxStreak >= 2;

	if (!isBelowThreshold && !hasStreak) {
		return null;
	}

	const riskReason = getDropoutRiskReason(
		heldCount,
		opts.minHeld,
		maxStreak,
		missedOrCancelledCount,
		opts.lang,
	);
	const belowGap = Math.max(0, opts.minHeld - heldCount);
	const riskScore =
		belowGap * 1000 + maxStreak * 100 + missedOrCancelledCount * 10 - heldCount;

	return {
		pairIndex: pIdx,
		heldCount,
		missedOrCancelledCount,
		riskReason,
		_riskScore: riskScore,
	};
}

function detectInactivePairs(records, pairs, options) {
	const opts = resolveDropoutOptions(options);
	const cleanRecords = getCleanAttendanceRecords(records);
	const sortedPairIndexes = collectDropoutPairIndexes(cleanRecords, pairs);

	if (sortedPairIndexes.length === 0) {
		return Object.freeze([]);
	}

	const atRiskPairs = [];
	for (const pIdx of sortedPairIndexes) {
		const risk = evaluatePairDropoutRisk(pIdx, cleanRecords, opts);
		if (risk) {
			atRiskPairs.push(risk);
		}
	}

	atRiskPairs.sort(
		(a, b) => b._riskScore - a._riskScore || a.pairIndex - b.pairIndex,
	);

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

function extractPersonRegion(p) {
	if (!isPlainObject(p)) return null;
	if (typeof p.role !== "string") return null;
	const role = p.role.trim().toLowerCase();
	if (role !== "student" && role !== "pupil") return null;

	const rawArea = p.area !== undefined ? p.area : p.region;
	if (typeof rawArea !== "string") return null;
	const area = rawArea.trim();
	if (area === "") return null;

	return { role, area };
}

function recordPersonSupplyDemand(summary, p) {
	const info = extractPersonRegion(p);
	if (!info) return;
	const { role, area } = info;

	if (!Object.hasOwn(summary, area)) {
		summary[area] = {
			area,
			students: 0,
			offered: 0,
			pupils: 0,
			requested: 0,
			gap: 0,
			total: 0,
		};
	}
	const item = summary[area];
	if (role === "student") {
		item.students += 1;
		item.offered += 1;
	} else if (role === "pupil") {
		item.pupils += 1;
		item.requested += 1;
	}
	item.gap = item.requested - item.offered;
	item.total = item.students + item.pupils;
}

function computeRegionalSupplyDemand(people) {
	const summary = {};
	if (!Array.isArray(people)) {
		return Object.freeze(summary);
	}
	for (const p of people) {
		recordPersonSupplyDemand(summary, p);
	}

	for (const key of Object.keys(summary)) {
		Object.freeze(summary[key]);
	}

	Object.defineProperty(summary, Symbol.iterator, {
		value: function* () {
			for (const key of Object.keys(summary)) {
				yield summary[key];
			}
		},
		enumerable: false,
		configurable: true,
	});

	return Object.freeze(summary);
}

function filterMatchesStatus(statusFilter, recordStatus) {
	if (!statusFilter || statusFilter === "all") return true;
	return recordStatus === statusFilter;
}

function filterMatchesPairIndex(targetIndex, recordIndex) {
	if (targetIndex == null) return true;
	return recordIndex === targetIndex;
}

function filterMatchesAiTopic(targetTopic, recordTopic) {
	if (!targetTopic) return true;
	return recordTopic === targetTopic;
}

function matchesRecordFilter(r, f) {
	if (!isPlainObject(r)) return false;
	if (!filterMatchesStatus(f.status, r.status)) return false;
	if (!filterMatchesPairIndex(f.pairIndex, r.pairIndex)) return false;
	if (!filterMatchesAiTopic(f.aiTopic, r.aiTopic)) return false;
	return true;
}

function filterAttendanceRecords(records, filters) {
	const clean = getCleanAttendanceRecords(records);
	const f = filters || {};
	return Object.freeze(clean.filter((r) => matchesRecordFilter(r, f)));
}

function getPairSessionTimeline(records, pairIndex) {
	const clean = getCleanAttendanceRecords(records);
	const filtered = clean.filter((r) => r && r.pairIndex === pairIndex);
	filtered.sort((a, b) => (a.date || "").localeCompare(b.date || ""));
	return Object.freeze(filtered);
}

function buildUpdatedOutcomeRow(target, patch) {
	const p = patch || {};
	const status = p.status !== undefined ? p.status : target.status;
	const durationHours =
		p.durationHours !== undefined ? p.durationHours : target.durationHours;
	const row = {
		pairIndex: target.pairIndex,
		date: target.date,
		status,
		durationHours,
	};
	if (p.aiTopic !== undefined) {
		row.aiTopic = p.aiTopic;
	} else if (target.aiTopic !== undefined) {
		row.aiTopic = target.aiTopic;
	}
	return row;
}

function updateSessionOutcome(records, pairIndex, date, patch) {
	const clean = getCleanAttendanceRecords(records);
	const idx = clean.findIndex(
		(r) => r && r.pairIndex === pairIndex && r.date === date,
	);
	if (idx === -1) {
		throw new Error("session record not found");
	}
	const target = clean[idx];
	const updatedRow = buildUpdatedOutcomeRow(target, patch);
	const validated = sanitizeAttendanceRow(updatedRow, parseDate);
	if (!validated) {
		throw new Error("invalid attendance patch");
	}
	const updatedList = clean.slice();
	updatedList[idx] = validated;
	return Object.freeze({ entries: Object.freeze(updatedList) });
}

function extractCycleSnapshotMetrics(snap) {
	if (!snap || typeof snap !== "object") {
		return { people: 0, pairs: 0, hours: 0, completionRate: 0 };
	}
	let people = 0;
	if (
		typeof snap.peopleCount === "number" &&
		Number.isFinite(snap.peopleCount)
	) {
		people = snap.peopleCount;
	} else if (Array.isArray(snap.people)) {
		people = snap.people.length;
	}

	let pairs = 0;
	if (typeof snap.pairsCount === "number" && Number.isFinite(snap.pairsCount)) {
		pairs = snap.pairsCount;
	} else if (Array.isArray(snap.pairs)) {
		pairs = snap.pairs.length;
	}

	let hours = 0;
	if (typeof snap.totalHours === "number" && Number.isFinite(snap.totalHours)) {
		hours = snap.totalHours;
	} else if (typeof snap.hours === "number" && Number.isFinite(snap.hours)) {
		hours = snap.hours;
	}

	let completionRate = 0;
	if (
		typeof snap.completionRate === "number" &&
		Number.isFinite(snap.completionRate)
	) {
		completionRate = snap.completionRate;
	} else if (
		typeof snap.completionPercent === "number" &&
		Number.isFinite(snap.completionPercent)
	) {
		completionRate = snap.completionPercent;
	}

	return {
		people,
		pairs,
		hours: Math.round(hours * 100) / 100,
		completionRate: Math.round(completionRate * 100) / 100,
	};
}

function compareArchiveCycles(archives, currentSnapshot) {
	const current = extractCycleSnapshotMetrics(currentSnapshot);

	let prevSnapshot = null;
	if (Array.isArray(archives)) {
		if (archives.length > 0) {
			prevSnapshot = archives[archives.length - 1];
		}
	} else if (archives && typeof archives === "object") {
		prevSnapshot = archives;
	}

	if (!prevSnapshot || Object.keys(prevSnapshot).length === 0) {
		return Object.freeze({
			hasPrevious: false,
			peopleDelta: 0,
			pairsDelta: 0,
			hoursDelta: 0,
			completionRateDelta: 0,
			current: Object.freeze(current),
			previous: null,
		});
	}

	const prev = extractCycleSnapshotMetrics(prevSnapshot);
	const peopleDelta = current.people - prev.people;
	const pairsDelta = current.pairs - prev.pairs;
	const hoursDelta = Math.round((current.hours - prev.hours) * 100) / 100;
	const completionRateDelta =
		Math.round((current.completionRate - prev.completionRate) * 100) / 100;

	return Object.freeze({
		hasPrevious: true,
		peopleDelta,
		pairsDelta,
		hoursDelta,
		completionRateDelta,
		current: Object.freeze(current),
		previous: Object.freeze(prev),
	});
}

const PII_CHECK_PATTERNS = [
	/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/,
	/05\d[- ]?\d{7}/,
	/\b\d{9}\b/,
];

function assertZeroPiiString(val) {
	if (typeof val !== "string") return;
	for (const pattern of PII_CHECK_PATTERNS) {
		if (pattern.test(val)) {
			throw new Error(PERSONAL_DATA_ERROR);
		}
	}
}

function extractMentorAnonymousKey(p) {
	if (!p || typeof p !== "object" || Array.isArray(p)) return null;
	if (p.role && p.role === "pupil") return null;
	if (p.role && p.role !== "student") return null;

	if (typeof p.name === "string") assertZeroPiiString(p.name);
	if (typeof p.phone === "string") assertZeroPiiString(p.phone);
	if (typeof p.email === "string") assertZeroPiiString(p.email);

	let key = null;
	if (typeof p.id === "string" && p.id.trim()) {
		key = p.id.trim();
	} else if (typeof p.id === "number") {
		key = String(p.id);
	}

	if (key) {
		assertZeroPiiString(key);
	}
	return key;
}

function extractArchiveMentors(archives) {
	const mentorKeys = new Set();
	if (!archives) return mentorKeys;

	let prevPeopleList = [];
	if (Array.isArray(archives)) {
		if (archives.length === 0) return mentorKeys;
		const lastCycle = archives[archives.length - 1];
		if (lastCycle && typeof lastCycle === "object") {
			if (Array.isArray(lastCycle.people)) prevPeopleList = lastCycle.people;
		}
	} else if (typeof archives === "object") {
		if (Array.isArray(archives.people)) prevPeopleList = archives.people;
	}

	for (const p of prevPeopleList) {
		const k = extractMentorAnonymousKey(p);
		if (k) mentorKeys.add(k);
	}
	return mentorKeys;
}

function extractCurrentMentors(currentPeople) {
	const mentorKeys = new Set();
	let peopleList = [];
	if (Array.isArray(currentPeople)) {
		peopleList = currentPeople;
	} else if (currentPeople && typeof currentPeople === "object") {
		if (Array.isArray(currentPeople.people)) peopleList = currentPeople.people;
	}

	for (const p of peopleList) {
		const k = extractMentorAnonymousKey(p);
		if (k) mentorKeys.add(k);
	}
	return mentorKeys;
}

function computeMentorRetentionStats(archives, currentPeople) {
	const prevKeys = extractArchiveMentors(archives);
	const currKeys = extractCurrentMentors(currentPeople);

	const previousMentorsCount = prevKeys.size;
	const currentMentorsCount = currKeys.size;

	const retainedMentorKeys = [];
	for (const k of currKeys) {
		if (prevKeys.has(k)) {
			retainedMentorKeys.push(k);
		}
	}
	retainedMentorKeys.sort();

	const retainedCount = retainedMentorKeys.length;
	const newMentorsCount = Math.max(0, currentMentorsCount - retainedCount);
	const retentionRate =
		previousMentorsCount > 0
			? Math.round((retainedCount / previousMentorsCount) * 100)
			: 0;
	const retentionRatio =
		previousMentorsCount > 0
			? Math.round((retainedCount / previousMentorsCount) * 10000) / 10000
			: 0;

	return Object.freeze({
		previousMentorsCount,
		currentMentorsCount,
		retainedCount,
		newMentorsCount,
		retentionRate,
		retentionPercent: retentionRate,
		retentionRatio,
		retainedMentorKeys: Object.freeze(retainedMentorKeys),
	});
}

module.exports = {
	compareArchiveCycles,
	computeMentorRetentionStats,
	filterAttendanceByDateRange,
	exportScholarshipCsv,
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
	computeRegionalSupplyDemand,
	computeScholarshipMilestones,
	recordPairHoursConfirmation,
};
