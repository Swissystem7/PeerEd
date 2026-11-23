// PeerEd - local-only storage (MVP item 7). The whole app state - roster, approval queue, session log -
// is one JSON document under one key in a key-value backend such as the browser's localStorage. There
// is no server and no network call anywhere in this file or in the modules it stores: the app opens
// from a phone with the radio off and loses nothing.
//
// Loading is where the privacy gate is enforced a second time. Every stored person goes through
// makeProfile, every unit through loadQueue, every session row through loadLog, so a record edited in
// the browser's devtools or copied from another machine cannot bring a name, a phone or a forged
// status into the app. A document that does not fit is reported, not silently repaired, and the app
// starts from an empty state rather than from a half-trusted one.

const {
	makeProfile,
	withoutRetentionStamp,
	PERSONAL_DATA_ERROR,
} = require("./profile.js");
const {
	PROFANITY_ERROR,
	findPersonalData,
	validateBatchImportZeroPii,
} = require("./validator.js");
const { emptyQueue, loadQueue } = require("./approval.js");
const { emptyLog, loadLog } = require("./session.js");
const {
	AI_TOPIC_KEYS,
	serializeAttendance,
	deserializeAttendance,
	computeRegionalSupplyDemand,
	detectInactivePairs,
	compareArchiveCycles,
	computeMentorRetentionStats,
} = require("./attendance.js");

const SCHEMA = "peered/1";
const DEFAULT_KEY = "peered_app_v1";
const ACCEPTED_FIELDS = Object.freeze([
	"schema",
	"people",
	"queue",
	"log",
	"attendance",
]);
const INVALID_STATE_ERROR = 'invalid stored state';
const INVALID_STORED_PERSON_PREFIX = 'invalid stored person';
// Where load() puts a document it refused. The app then starts empty, and its first save writes over the
// main key: without this copy one added person erased the whole refused roster, queue and log for good.
const REJECTED_SUFFIX = ":rejected";
// A later refused load takes the next free slot (key:rejected:2, :3, ...) instead of writing over a copy
// kept before: the screen told the coordinator that copy was kept, and the README that it stays until the
// wipe, yet the next refused document - one saved after it and refused on a later visit - replaced it,
// and the roster it held was gone with no line saying so. The same document refused again goes back
// into its own slot, so reloading a refused page adds nothing.
function rejectedSlot(storageKey, n) {
	return storageKey + REJECTED_SUFFIX + (n === 1 ? "" : `:${n}`);
}
function isHeld(text) {
	return text !== null && text !== undefined;
}

function emptyState() {
	return Object.freeze({
		people: Object.freeze([]),
		queue: emptyQueue(),
		log: emptyLog(),
		attendance: Object.freeze([]),
	});
}

function attendanceRecords(attendance) {
	if (Array.isArray(attendance)) return attendance;
	if (
		attendance !== null &&
		typeof attendance === "object" &&
		Array.isArray(attendance.entries)
	) {
		return attendance.entries;
	}
	return [];
}

function assertState(state) {
	if (
		state === null ||
		typeof state !== "object" ||
		Array.isArray(state) ||
		!Array.isArray(state.people) ||
		state.queue === null ||
		typeof state.queue !== "object" ||
		state.log === null ||
		typeof state.log !== "object"
	) {
		throw new Error(
			"invalid state: expected a value from emptyState() or deserialize()",
		);
	}
	if (state.attendance !== undefined) {
		const okArray = Array.isArray(state.attendance);
		const okLog =
			state.attendance !== null &&
			typeof state.attendance === "object" &&
			!Array.isArray(state.attendance) &&
			Array.isArray(state.attendance.entries);
		if (!okArray && !okLog) {
			throw new Error(
				"invalid state: expected a value from emptyState() or deserialize()",
			);
		}
	}
}

// A stored profile carries `retention`, which makeProfile derives itself and does not accept as an
// input key. profile.js sheds it (setParentConsent does the same) and makeProfile puts today's back -
// but only a stamp profile.js could have written is shed. Until this check the key was deleted unread,
// so a name or a phone kept under it was the one thing in a stored record the gate never saw: it loaded
// without complaint and the first save wrote over it, with no copy kept. Now it is refused like a name
// beside it, and load() keeps the refused document. A record that is not an object is left to
// makeProfile, which names the problem.
function storedProfileInput(person) {
	if (person === null || typeof person !== "object" || Array.isArray(person))
		return person;
	return withoutRetentionStamp(person);
}

function cleanAITopics(value) {
	if (!Array.isArray(value)) return [];
	const out = [];
	for (let i = 0; i < value.length; i += 1) {
		const item = value[i];
		if (
			typeof item === "string" &&
			AI_TOPIC_KEYS.includes(item) &&
			!out.includes(item)
		) {
			out.push(item);
		}
	}
	return out;
}

// A stored person goes through the same gate as one the coordinator just added - makeProfile - and that
// gate words a refusal for the add form: 'invalid availability: expected a non-empty array' is the line
// "mark at least one free hour", 'invalid subjects:' is "choose at least one subject". On load nobody
// filled the form, so a stored person the gate refuses is refused as a stored person, named by its place
// in the list the way loadLog names a row and loadQueue an entry. Until this the participants card
// reported a saved roster whose person had no hours as "the saved list was refused and not loaded: you
// need to mark at least one free hour" - an instruction about a form nobody filled - while a line for
// a stored person did not exist. The gate's personal-data and profanity refusals pass through unchanged,
// as they read the same on every screen; so does a bad retention stamp, which only a stored record
// carries and whose line already names the record.
function storedPerson(person, at) {
	let input = person;
	let hasTopics = false;
	let rawTopics;
	let rawArea;
	if (person !== null && typeof person === "object" && !Array.isArray(person)) {
		if (Object.hasOwn(person, "target_ai_topics")) {
			hasTopics = true;
			rawTopics = person.target_ai_topics;
			input = { ...person };
			delete input.target_ai_topics;
		}
		if (Object.hasOwn(input, "area")) {
			rawArea = input.area;
			input = { ...input };
			if (!input.region) input.region = input.area;
			delete input.area;
		}
	}
	try {
		const profile = makeProfile(storedProfileInput(input));
		let res = profile;
		if (hasTopics) {
			const cleaned = cleanAITopics(rawTopics);
			if (cleaned.length > 0) {
				res = Object.freeze({
					...res,
					target_ai_topics: Object.freeze(cleaned),
				});
			}
		}
		if (rawArea) {
			res = Object.freeze({
				...res,
				area: rawArea,
			});
		}
		return res;
	} catch (err) {
		if (
			err.message === PERSONAL_DATA_ERROR ||
			err.message === PROFANITY_ERROR ||
			err.message.indexOf("invalid retention:") === 0
		)
			throw err;
		throw new Error(`${INVALID_STORED_PERSON_PREFIX} at ${at}: ${err.message}`);
	}
}

// Re-validate a plain document (parsed JSON) into a frozen state. Order matters: the queue is rebuilt
// first because the log's rows are checked against it.
function fromDocument(doc) {
	if (doc === null || typeof doc !== "object" || Array.isArray(doc))
		throw new Error(INVALID_STATE_ERROR);
	const keys = Object.keys(doc);
	for (let i = 0; i < keys.length; i += 1) {
		if (ACCEPTED_FIELDS.indexOf(keys[i]) === -1)
			throw new Error(PERSONAL_DATA_ERROR);
	}
	if (doc.schema !== SCHEMA)
		throw new Error(
			`${INVALID_STATE_ERROR}: unknown schema ${String(doc.schema)}`,
		);
	if (!Array.isArray(doc.people))
		throw new Error(`${INVALID_STATE_ERROR}: people is not an array`);
	const people = [];
	for (let i = 0; i < doc.people.length; i += 1)
		people.push(storedPerson(doc.people[i], i));
	const queue = loadQueue(doc.queue === undefined ? emptyQueue() : doc.queue);
	const log = loadLog(doc.log === undefined ? emptyLog() : doc.log, queue);
	const attendance = deserializeAttendance(
		doc.attendance === undefined ? [] : doc.attendance,
	);
	return Object.freeze({
		people: Object.freeze(people),
		queue: queue,
		log: log,
		attendance: attendance,
	});
}

function serializedPerson(person) {
	if (
		person === null ||
		typeof person !== "object" ||
		Array.isArray(person) ||
		!Object.hasOwn(person, "target_ai_topics")
	) {
		return person;
	}
	const cleaned = cleanAITopics(person.target_ai_topics);
	if (cleaned.length === 0) {
		const copy = { ...person };
		delete copy.target_ai_topics;
		return copy;
	}
	return { ...person, target_ai_topics: cleaned };
}

// The stored form. Stable key order, no whitespace: the same state always gives the same string, so
// two devices that hold the same roster can be compared byte for byte.
function serialize(state) {
	assertState(state);
	const people = state.people.map(serializedPerson);
	const attendance = serializeAttendance(attendanceRecords(state.attendance));
	return JSON.stringify({
		schema: SCHEMA,
		people: people,
		queue: state.queue,
		log: state.log,
		attendance: attendance,
	});
}

function deserialize(text) {
	if (typeof text !== "string")
		throw new Error(`${INVALID_STATE_ERROR}: expected a string`);
	let doc;
	try {
		doc = JSON.parse(text);
	} catch (_e) {
		throw new Error(`${INVALID_STATE_ERROR}: not JSON`);
	}
	return fromDocument(doc);
}

// A backend is the three methods of Web Storage. This one keeps everything in a plain object: the
// fallback when localStorage throws (private mode, storage disabled) and the backend the tests use.
function memoryBackend() {
	// No prototype: with a plain {} the key "__proto__" saved into the prototype slot and never loaded.
	const items = Object.create(null);
	return {
		getItem: (key) => (Object.hasOwn(items, key) ? items[key] : null),
		setItem: (key, value) => {
			items[key] = String(value);
		},
		removeItem: (key) => {
			delete items[key];
		},
	};
}

function isBackend(b) {
	return (
		b !== null &&
		typeof b === "object" &&
		typeof b.getItem === "function" &&
		typeof b.setItem === "function" &&
		typeof b.removeItem === "function"
	);
}

function isQuotaExceededError(err) {
	if (!err) return false;
	if (typeof err === "string" && /quota/i.test(err)) return true;
	if (typeof err === "object" || typeof err === "function") {
		if (
			err.name === "QuotaExceededError" ||
			err.name === "NS_ERROR_DOM_QUOTA_REACHED"
		)
			return true;
		if (err.code === 22 || err.code === 1014) return true;
		if (err.number === -2146828281) return true;
		if (typeof err.name === "string" && /quota/i.test(err.name)) return true;
		if (typeof err.message === "string" && /quota/i.test(err.message))
			return true;
	}
	return false;
}
const isQuotaExceeded = isQuotaExceededError;

// createStore(backend, key): save(state) writes, load() reads. load never throws: it returns
// { state, problem, kept } where problem is null on success and the reason otherwise, with state reset
// to empty - the app keeps opening, and the screen can say why the roster is gone instead of guessing.
// A refused document is copied as is to key + REJECTED_SUFFIX (or the next free slot after it) before
// anything can overwrite it; kept says whether that copy was written. copies() counts the copies held,
// and clear() removes the key and every copy.
function createStore(backend, key) {
	if (!isBackend(backend))
		throw new Error("invalid backend: expected getItem, setItem, removeItem");
	const storageKey = key === undefined ? DEFAULT_KEY : key;
	if (typeof storageKey !== "string" || storageKey.length === 0)
		throw new Error("invalid key");
	return Object.freeze({
		key: storageKey,
		save: (state) => {
			try {
				const text = serialize(state);
				backend.setItem(storageKey, text);
				return true;
			} catch (_e) {
				return false;
			}
		},
		safeSave: (state) => {
			try {
				const text = serialize(state);
				backend.setItem(storageKey, text);
				return { ok: true, quotaExceeded: false, error: null };
			} catch (err) {
				return {
					ok: false,
					quotaExceeded: isQuotaExceededError(err),
					error: err?.message ? err.message : String(err),
				};
			}
		},
		load: () => {
			let text;
			try {
				text = backend.getItem(storageKey);
			} catch (_e) {
				text = null;
			}
			if (text === null || text === undefined)
				return { state: emptyState(), problem: null, kept: false };
			try {
				return { state: deserialize(text), problem: null, kept: false };
			} catch (err) {
				let kept = true;
				try {
					let n = 1;
					let held = backend.getItem(rejectedSlot(storageKey, n));
					while (isHeld(held) && held !== String(text)) {
						n += 1;
						held = backend.getItem(rejectedSlot(storageKey, n));
					}
					backend.setItem(rejectedSlot(storageKey, n), String(text));
				} catch (_e) {
					kept = false;
				}
				return { state: emptyState(), problem: err.message, kept: kept };
			}
		},
		// How many refused documents are kept beside the key, from this visit or an earlier one.
		copies: () => {
			let n = 0;
			try {
				while (isHeld(backend.getItem(rejectedSlot(storageKey, n + 1)))) n += 1;
			} catch (_e) {
				return 0;
			}
			return n;
		},
		clear: () => {
			try {
				backend.removeItem(storageKey);
				for (let n = 1; ; n += 1) {
					const held = backend.getItem(rejectedSlot(storageKey, n));
					backend.removeItem(rejectedSlot(storageKey, n));
					if (!isHeld(held)) break;
				}
			} catch (_e) {
				return false;
			}
			return true;
		},
	});
}

// Pure helper to filter a participants array by an AI topic key.
// Never mutates inputs; returns the same participant objects unchanged.
// If participants is not an array, returns [].
// If topicId is '' / null / undefined, returns participants itself unchanged.
// If topicId is not a valid AI topic key in AI_TOPIC_KEYS, returns [].
function filterParticipantsByAITopic(participants, topicId) {
	if (!Array.isArray(participants)) return [];
	if (topicId === "" || topicId === null || topicId === undefined)
		return participants;
	if (typeof topicId !== "string" || !AI_TOPIC_KEYS.includes(topicId))
		return [];
	return participants.filter((p) =>
		Boolean(
			p &&
				Array.isArray(p.target_ai_topics) &&
				p.target_ai_topics.includes(topicId),
		),
	);
}

function buildImpactOverviewReport(state, lang) {
	const s = state || emptyState();
	const l = lang === "ar" || lang === "ru" || lang === "he" ? lang : "he";

	const people = Array.isArray(s.people) ? s.people : [];
	const records = attendanceRecords(s.attendance);

	let totalHeldSessions = 0;
	let totalHours = 0.0;
	for (const r of records) {
		if (r && r.status === "held") {
			totalHeldSessions += 1;
			const dur =
				typeof r.durationHours === "number" &&
				Number.isFinite(r.durationHours) &&
				r.durationHours > 0
					? r.durationHours
					: 1.0;
			totalHours += dur;
		}
	}
	totalHours = Math.round(totalHours * 10) / 10;

	const pairSet = new Set();
	if (Array.isArray(s.pairs)) {
		s.pairs.forEach((p, idx) => {
			const pIdx =
				p && Number.isInteger(p.pairIndex) && p.pairIndex >= 0
					? p.pairIndex
					: idx;
			pairSet.add(pIdx);
		});
	}
	for (const r of records) {
		if (r && Number.isInteger(r.pairIndex) && r.pairIndex >= 0) {
			pairSet.add(r.pairIndex);
		}
	}
	const totalPairs =
		Array.isArray(s.pairs) && s.pairs.length > pairSet.size
			? s.pairs.length
			: pairSet.size;

	const regionalBalance = computeRegionalSupplyDemand(people);

	const pairsList =
		Array.isArray(s.pairs) && s.pairs.length > 0
			? s.pairs
			: Array.from(pairSet)
					.sort((a, b) => a - b)
					.map((idx) => ({ pairIndex: idx }));

	const atRiskPairs =
		typeof detectInactivePairs === "function"
			? detectInactivePairs(records, pairsList, { minHeldCount: 2, lang: l })
			: Object.freeze([]);

	const titles = {
		he: {
			header: "=== דוח אימפקט ומאזן אזורי ===",
			pairs: "סך זוגות:",
			held: "מפגשים שהתקיימו:",
			hours: "סך שעות חונכות:",
			atRisk: "זוגות בסיכון נשירה:",
			regional: "מאזן אזורי:",
			noRegions: "  אין נתוני אזורים",
			regionRow: (a, st, pu, gp) =>
				`  ${a}: סטודנטים: ${st}, תלמידים: ${pu}, פער: ${gp}`,
			riskDetails: "פרטי סיכון:",
			riskRow: (idx, reason, h, m) =>
				`  - זוג ${idx + 1}: ${reason} (התקיימו: ${h}, ביטולים/החמצות: ${m})`,
		},
		ar: {
			header: "=== تقرير الأثر والتوازن الإقليمي ===",
			pairs: "إجمالي الأزواج:",
			held: "اللقاءات المنعقدة:",
			hours: "إجمالي ساعات الإرشاد:",
			atRisk: "الأزواج المعرضون لخطر التسرب:",
			regional: "التوازن الإقليمي:",
			noRegions: "  لا توجد بيانات للمناطق",
			regionRow: (a, st, pu, gp) =>
				`  ${a}: طلاب مرشدون: ${st}, تلاميذ: ${pu}, الفجوة: ${gp}`,
			riskDetails: "تفاصيل الخطر:",
			riskRow: (idx, reason, h, m) =>
				`  - الزوج ${idx + 1}: ${reason} (المنعقدة: ${h}, إلغاءات/غياب: ${m})`,
		},
		ru: {
			header: "=== Отчет о воздействии и региональном балансе ===",
			pairs: "Всего пар:",
			held: "Состоявшихся занятий:",
			hours: "Всего часов наставничества:",
			atRisk: "Пары в группе риска отсева:",
			regional: "Региональный баланс:",
			noRegions: "  Нет данных по регионам",
			regionRow: (a, st, pu, gp) =>
				`  ${a}: наставники: ${st}, ученики: ${pu}, разрыв: ${gp}`,
			riskDetails: "Детали риска:",
			riskRow: (idx, reason, h, m) =>
				`  - Пара ${idx + 1}: ${reason} (проведено: ${h}, отмен/пропусков: ${m})`,
		},
	};

	const t = titles[l];
	const lines = [
		t.header,
		`${t.pairs} ${totalPairs}`,
		`${t.held} ${totalHeldSessions}`,
		`${t.hours} ${totalHours}`,
		`${t.atRisk} ${atRiskPairs.length}`,
		t.regional,
	];

	const regionKeys = Object.keys(regionalBalance);
	if (regionKeys.length === 0) {
		lines.push(t.noRegions);
	} else {
		for (const key of regionKeys) {
			const item = regionalBalance[key];
			lines.push(t.regionRow(key, item.students, item.pupils, item.gap));
		}
	}

	if (atRiskPairs.length > 0) {
		lines.push(t.riskDetails);
		for (const item of atRiskPairs) {
			lines.push(
				t.riskRow(
					item.pairIndex,
					item.riskReason,
					item.heldCount,
					item.missedOrCancelledCount,
				),
			);
		}
	}

	const reportText = lines.join("\n");

	const report = {
		totalPairs,
		pairsCount: totalPairs,
		heldSessions: totalHeldSessions,
		totalHeldSessions,
		heldCount: totalHeldSessions,
		totalHours,
		hours: totalHours,
		regionalBalance,
		atRiskPairs,
		atRiskCount: atRiskPairs.length,
		lang: l,
		text: reportText,
		summary: Object.freeze({
			totalPairs,
			totalHeldSessions,
			totalHours,
			atRiskCount: atRiskPairs.length,
		}),
	};

	report.toString = function () {
		return this.text;
	};
	report.valueOf = function () {
		return this.text;
	};
	report[Symbol.toPrimitive] = function () {
		return this.text;
	};
	report.includes = function (s) {
		return this.text.includes(s);
	};
	report.indexOf = function (s) {
		return this.text.indexOf(s);
	};
	report.startsWith = function (s) {
		return this.text.startsWith(s);
	};
	report.endsWith = function (s) {
		return this.text.endsWith(s);
	};

	return Object.freeze(report);
}

const PII_KEY_REGEX = /(?:name|first_?name|last_?name|email|mail|phone|tel|mobile|id_?number|tz|zehut|address)/i;

function checkValueZeroPii(val) {
	if (val === null || val === undefined) return true;
	if (typeof val === "string") {
		const hits = findPersonalData(val);
		for (let i = 0; i < hits.length; i += 1) {
			if (hits[i].kind !== "profanity") return false;
		}
		if (/@/.test(val)) return false;
		if (/(?:^|[^\d])05\d[- ]?\d{7}(?:[^\d]|$)/.test(val)) return false;
		return true;
	}
	if (Array.isArray(val)) {
		for (let i = 0; i < val.length; i += 1) {
			if (!checkValueZeroPii(val[i])) return false;
		}
		return true;
	}
	if (typeof val === "object") {
		const keys = Object.keys(val);
		for (let k = 0; k < keys.length; k += 1) {
			if (PII_KEY_REGEX.test(keys[k])) return false;
			if (!checkValueZeroPii(val[keys[k]])) return false;
		}
		return true;
	}
	return true;
}

function isPersonZeroPii(person) {
	if (!person || typeof person !== "object") return false;
	const keys = Object.keys(person);
	for (let i = 0; i < keys.length; i += 1) {
		if (PII_KEY_REGEX.test(keys[i])) return false;
	}
	return checkValueZeroPii(person);
}

function evaluatePilotReadiness(state) {
	const s = state || emptyState();
	const people = Array.isArray(s.people) ? s.people : [];

	let zeroPii = true;
	for (let i = 0; i < people.length; i += 1) {
		if (!isPersonZeroPii(people[i])) {
			zeroPii = false;
			break;
		}
	}

	let activeTopics = [];
	if (Array.isArray(s.activeTopics) && s.activeTopics.length > 0) {
		activeTopics = s.activeTopics.filter((t) => typeof t === "string" && AI_TOPIC_KEYS.includes(t));
	} else if (Array.isArray(s.activeAiTopics) && s.activeAiTopics.length > 0) {
		activeTopics = s.activeAiTopics.filter((t) => typeof t === "string" && AI_TOPIC_KEYS.includes(t));
	} else {
		const pupilsWithTopics = people.filter((p) => p && p.role === "pupil" && Array.isArray(p.target_ai_topics));
		const topicSet = new Set();
		for (let i = 0; i < pupilsWithTopics.length; i += 1) {
			const tList = pupilsWithTopics[i].target_ai_topics;
			for (let j = 0; j < tList.length; j += 1) {
				if (typeof tList[j] === "string" && AI_TOPIC_KEYS.includes(tList[j])) {
					topicSet.add(tList[j]);
				}
			}
		}
		if (topicSet.size > 0) {
			activeTopics = Array.from(topicSet);
		} else {
			for (let i = 0; i < people.length; i += 1) {
				const p = people[i];
				if (p && Array.isArray(p.target_ai_topics)) {
					for (let j = 0; j < p.target_ai_topics.length; j += 1) {
						if (typeof p.target_ai_topics[j] === "string" && AI_TOPIC_KEYS.includes(p.target_ai_topics[j])) {
							topicSet.add(p.target_ai_topics[j]);
						}
					}
				}
			}
			activeTopics = topicSet.size > 0 ? Array.from(topicSet) : AI_TOPIC_KEYS.slice();
		}
	}

	const students = people.filter((p) => p && p.role === "student");
	const pupils = people.filter((p) => p && p.role === "pupil");

	const coveredTopics = activeTopics.filter((topic) =>
		students.some((s) => Array.isArray(s.target_ai_topics) && s.target_ai_topics.includes(topic))
	);
	const uncoveredTopics = activeTopics.filter((topic) => !coveredTopics.includes(topic));
	const mentorCoverage = Boolean(students.length > 0 && activeTopics.length > 0 && uncoveredTopics.length === 0);

	let pairsCount = 0;
	if (Array.isArray(s.pairs)) {
		pairsCount = s.pairs.length;
	} else if (s.pairs && typeof s.pairs === "object" && Array.isArray(s.pairs.pairs)) {
		pairsCount = s.pairs.pairs.length;
	} else if (Array.isArray(s.matchedPairs)) {
		pairsCount = s.matchedPairs.length;
	} else {
		try {
			const matchLib = require("./match.js");
			if (students.length > 0 && pupils.length > 0) {
				const computed = matchLib.matchPairs(students, pupils);
				pairsCount = computed.length;
			}
		} catch (_e) {
			pairsCount = 0;
		}
	}
	const hasPairs = pairsCount > 0;

	const ready = Boolean(zeroPii && mentorCoverage && hasPairs);

	const reasonsHe = [];
	const reasonsAr = [];
	const reasonsRu = [];

	if (!zeroPii) {
		reasonsHe.push("זוהו פרטים אישיים (הפרת Zero-PII)");
		reasonsAr.push("تم العثور على بيانات شخصية (انتهاك Zero-PII)");
		reasonsRu.push("Обнаружены персональные данные (нарушение Zero-PII)");
	}
	if (!mentorCoverage) {
		if (students.length === 0) {
			reasonsHe.push("אין מדריכים (סטודנטים) ברשימה");
			reasonsAr.push("لا يوجد مرشدون في القائمة");
			reasonsRu.push("В списке нет наставников");
		} else if (uncoveredTopics.length > 0) {
			reasonsHe.push("חסר כיסוי מדריכים לנושאים: " + uncoveredTopics.join(", "));
			reasonsAr.push("نقص في تغطية المرشدين للمواضيع: " + uncoveredTopics.join(", "));
			reasonsRu.push("Отсутствует покрытие наставников для тем: " + uncoveredTopics.join(", "));
		} else {
			reasonsHe.push("אין נושאי AI פעילים מוגדרים");
			reasonsAr.push("لا توجد مواضيع ذكاء اصطناعي نشطة محددة");
			reasonsRu.push("Нет активных тем ИИ");
		}
	}
	if (!hasPairs) {
		reasonsHe.push("אין זוגות משובצים לפיילוט");
		reasonsAr.push("لا توجد أزواج مطابقة للبرنامج التجريبي");
		reasonsRu.push("Нет сформированных пар для пилота");
	}

	const summaryHe = ready
		? `מוכן לפיילוט: אפס פרטים מזהים (Zero-PII), כיסוי מלא של ${coveredTopics.length} נושאי AI פעילים, ו-${pairsCount} זוגות משובצים.`
		: `הפיילוט אינו מוכן: ${reasonsHe.join("; ")}.`;
	const summaryAr = ready
		? `جاهز للبرنامج التجريبي: صفر بيانات شخصية (Zero-PII)، تغطية كاملة لـ ${coveredTopics.length} مواضيع ذكاء اصطناعي نشطة، و${pairsCount} أزواج مطابقة.`
		: `البرنامج التجريبي غير جاهز: ${reasonsAr.join("; ")}.`;
	const summaryRu = ready
		? `Готов к пилоту: ноль персональных данных (Zero-PII), полное покрытие ${coveredTopics.length} активных тем ИИ и ${pairsCount} сформированных пар.`
		: `Пилотный проект не готов: ${reasonsRu.join("; ")}.`;

	return Object.freeze({
		ready,
		checks: Object.freeze({
			zeroPii,
			hasZeroPii: zeroPii,
			zeroPiiPassed: zeroPii,
			mentorCoverage,
			topicCoverage: mentorCoverage,
			aiTopicCoverage: mentorCoverage,
			pairs: hasPairs,
			hasPairs,
			pairsExist: hasPairs,
			pairsCount,
			mentorCount: students.length,
			pupilCount: pupils.length,
			activeTopics: Object.freeze(activeTopics.slice()),
			coveredTopics: Object.freeze(coveredTopics.slice()),
			uncoveredTopics: Object.freeze(uncoveredTopics.slice()),
			reasons: Object.freeze(reasonsHe.slice())
		}),
		summary: Object.freeze({
			he: summaryHe,
			ar: summaryAr,
			ru: summaryRu,
			text: summaryHe,
			ready,
			toString() {
				return this.he;
			}
		})
	});
}

module.exports = {
	SCHEMA,
	DEFAULT_KEY,
	INVALID_STATE_ERROR,
	REJECTED_SUFFIX,
	emptyState,
	serialize,
	deserialize,
	memoryBackend,
	createStore,
	isQuotaExceededError,
	isQuotaExceeded,
	validateBatchImportZeroPii,
	parseCsvPilotBatch: require("./validator.js").parseCsvPilotBatch,
	commitPilotCsvBatch: require("./validator.js").commitPilotCsvBatch,
	computeRegionalSupplyDemand,
	buildImpactOverviewReport,
	compareArchiveCycles,
	computeMentorRetentionStats,
	evaluatePilotReadiness,
	filterParticipantsByAITopic
};
