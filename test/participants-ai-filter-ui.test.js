const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const { openApp, press, ROOT } = require("../test-support/fake-dom.js");
const { serialize, DEFAULT_KEY } = require("../src/lib/store.js");
const { emptyQueue } = require("../src/lib/approval.js");
const { emptyLog } = require("../src/lib/session.js");

test("select with 5 options exists in #tab-people and app.html contains the select", () => {
	const html = fs.readFileSync(path.join(ROOT, "app.html"), "utf8");
	const peopleTabIndex = html.indexOf('id="tab-people"');
	assert.ok(peopleTabIndex !== -1, "#tab-people must exist in app.html");
	const peopleTabEndIndex = html.indexOf("</section>", peopleTabIndex);
	assert.ok(peopleTabEndIndex !== -1, "#tab-people closing tag must exist");
	const peopleSection = html.slice(peopleTabIndex, peopleTabEndIndex);

	assert.ok(
		peopleSection.includes('id="peopleAiFilter"'),
		"#peopleAiFilter select must exist in #tab-people",
	);
	assert.ok(
		peopleSection.includes('for="peopleAiFilter"'),
		'label for="peopleAiFilter" must exist in #tab-people',
	);

	const selectIndex = peopleSection.indexOf('id="peopleAiFilter"');
	const peopleListIndex = peopleSection.indexOf('id="peopleList"');
	assert.ok(
		selectIndex < peopleListIndex,
		"select must appear above #peopleList",
	);

	const $ = openApp();
	const filterSelect = $("peopleAiFilter");
	assert.ok(filterSelect, "peopleAiFilter element exists in DOM");
	assert.equal(
		$("peopleAiFilterLabel")?.textContent,
		"נושאי בינה מלאכותית",
		"default label is Hebrew group label",
	);

	const selectHtml = filterSelect.innerHTML;
	const optionMatches = [
		...selectHtml.matchAll(/<option\b[^>]*value="([^"]*)"/g),
	];
	assert.equal(optionMatches.length, 5, "select must have exactly 5 options");
	assert.equal(optionMatches[0]?.[1], "", "first option value must be empty");
	assert.equal(optionMatches[1]?.[1], "AI_LIT_PROMPT");
	assert.equal(optionMatches[2]?.[1], "AI_CREATIVE");
	assert.equal(optionMatches[3]?.[1], "AI_STEM_CODE");
	assert.equal(optionMatches[4]?.[1], "AI_ETHICS_SEC");
	assert.ok(
		selectHtml.includes("כל הנושאים"),
		"Hebrew default option label must be 'כל הנושאים'",
	);
});

test("choosing a topic shows only matching people and empty message when no matches", () => {
	const samplePeople = [
		{
			role: "student",
			region: "CENTER",
			availability: ["SUN_16"],
			subjects: ["MATH"],
			target_ai_topics: ["AI_LIT_PROMPT", "AI_CREATIVE"],
		},
		{
			role: "student",
			region: "NORTH",
			availability: ["MON_18"],
			subjects: ["PHYSICS"],
			target_ai_topics: ["AI_LIT_PROMPT"],
		},
		{
			role: "pupil",
			region: "CENTER",
			availability: ["SUN_16"],
			subjects: ["MATH"],
			parentConsent: true,
			target_ai_topics: ["AI_STEM_CODE"],
		},
		{
			role: "pupil",
			region: "SOUTH",
			availability: ["TUE_17"],
			subjects: ["ENGLISH"],
			parentConsent: true,
			target_ai_topics: ["AI_ETHICS_SEC"],
		},
		{
			role: "pupil",
			region: "JERUSALEM",
			availability: ["WED_16"],
			subjects: ["HISTORY"],
			parentConsent: true,
		},
	];

	const $ = openApp({
		store: {
			[DEFAULT_KEY]: serialize({
				people: samplePeople,
				queue: emptyQueue(),
				log: emptyLog(),
			}),
		},
	});

	$("peopleAiFilter").value = "AI_LIT_PROMPT";
	$("peopleAiFilter").fire("change");
	let listHtml = $("peopleList").innerHTML;
	assert.ok(listHtml.includes("סטודנט מלמד #1"));
	assert.ok(listHtml.includes("סטודנט מלמד #2"));
	assert.ok(!listHtml.includes("תלמיד #3"));
	assert.ok(!listHtml.includes("תלמיד #4"));
	assert.ok(!listHtml.includes("תלמיד #5"));

	$("peopleAiFilter").value = "AI_STEM_CODE";
	$("peopleAiFilter").fire("change");
	listHtml = $("peopleList").innerHTML;
	assert.ok(!listHtml.includes("סטודנט מלמד #1"));
	assert.ok(!listHtml.includes("סטודנט מלמד #2"));
	assert.ok(listHtml.includes("תלמיד #3"));
	assert.ok(!listHtml.includes("תלמיד #4"));
	assert.ok(!listHtml.includes("תלמיד #5"));

	const noCreativePupils = [
		{
			role: "pupil",
			region: "CENTER",
			availability: ["SUN_16"],
			subjects: ["MATH"],
			parentConsent: true,
			target_ai_topics: ["AI_LIT_PROMPT"],
		},
	];
	const $empty = openApp({
		store: {
			[DEFAULT_KEY]: serialize({
				people: noCreativePupils,
				queue: emptyQueue(),
				log: emptyLog(),
			}),
		},
	});
	$empty("peopleAiFilter").value = "AI_CREATIVE";
	$empty("peopleAiFilter").fire("change");
	const emptyListHtml = $empty("peopleList").innerHTML;
	assert.ok(
		emptyListHtml.includes('class="empty"'),
		"empty message must have empty class",
	);
	assert.ok(
		emptyListHtml.includes("אין משתתפים"),
		"empty message must state no matching participants",
	);
});

test("'' shows all participants after filtering", () => {
	const samplePeople = [
		{
			role: "student",
			region: "CENTER",
			availability: ["SUN_16"],
			subjects: ["MATH"],
			target_ai_topics: ["AI_LIT_PROMPT"],
		},
		{
			role: "pupil",
			region: "NORTH",
			availability: ["MON_18"],
			subjects: ["PHYSICS"],
			parentConsent: true,
			target_ai_topics: ["AI_ETHICS_SEC"],
		},
	];

	const $ = openApp({
		store: {
			[DEFAULT_KEY]: serialize({
				people: samplePeople,
				queue: emptyQueue(),
				log: emptyLog(),
			}),
		},
	});

	$("peopleAiFilter").value = "AI_LIT_PROMPT";
	$("peopleAiFilter").fire("change");
	assert.ok($("peopleList").innerHTML.includes("סטודנט מלמד #1"));
	assert.ok(!$("peopleList").innerHTML.includes("תלמיד #2"));

	$("peopleAiFilter").value = "";
	$("peopleAiFilter").fire("change");
	const allHtml = $("peopleList").innerHTML;
	assert.ok(allHtml.includes("סטודנט מלמד #1"));
	assert.ok(allHtml.includes("תלמיד #2"));
});

test("row buttons and labels keep original indices in state.people when filtered", () => {
	const samplePeople = [
		{
			role: "student",
			region: "CENTER",
			availability: ["SUN_16"],
			subjects: ["MATH"],
		},
		{
			role: "pupil",
			region: "NORTH",
			availability: ["MON_18"],
			subjects: ["PHYSICS"],
			parentConsent: false,
			target_ai_topics: ["AI_STEM_CODE"],
		},
		{
			role: "pupil",
			region: "SOUTH",
			availability: ["TUE_17"],
			subjects: ["ENGLISH"],
			parentConsent: true,
			target_ai_topics: ["AI_STEM_CODE"],
		},
	];

	const $ = openApp({
		store: {
			[DEFAULT_KEY]: serialize({
				people: samplePeople,
				queue: emptyQueue(),
				log: emptyLog(),
			}),
		},
	});

	$("peopleAiFilter").value = "AI_STEM_CODE";
	$("peopleAiFilter").fire("change");

	const listHtml = $("peopleList").innerHTML;
	assert.ok(!listHtml.includes("סטודנט מלמד #1"));
	assert.ok(listHtml.includes("תלמיד #2"));
	assert.ok(listHtml.includes("תלמיד #3"));

	assert.ok(listHtml.includes('id="consentBtn-1"'));
	assert.ok(listHtml.includes('data-consent="1"'));
	assert.ok(listHtml.includes('id="delBtn-1"'));
	assert.ok(listHtml.includes('data-del="1"'));

	assert.ok(listHtml.includes('id="consentBtn-2"'));
	assert.ok(listHtml.includes('data-consent="2"'));
	assert.ok(listHtml.includes('id="delBtn-2"'));
	assert.ok(listHtml.includes('data-del="2"'));

	press($("peopleList"), "data-consent", "1");
	assert.ok($("peopleList").innerHTML.includes('id="consentBtn-1"'));
	assert.ok($("peopleList").innerHTML.includes("בטל אישור הורה"));

	press($("peopleList"), "data-del", "1");
	const afterDeleteHtml = $("peopleList").innerHTML;
	assert.ok(!afterDeleteHtml.includes("סטודנט מלמד #1"));
	assert.ok(afterDeleteHtml.includes("תלמיד #2"));
	assert.ok(afterDeleteHtml.includes('id="delBtn-1"'));

	$("peopleAiFilter").value = "";
	$("peopleAiFilter").fire("change");
	const allAfterDeleteHtml = $("peopleList").innerHTML;
	assert.ok(allAfterDeleteHtml.includes("סטודנט מלמד #1"));
	assert.ok(allAfterDeleteHtml.includes("תלמיד #2"));
});

test("labels in he, ar, and ru update on language switch", () => {
	const $ = openApp();

	assert.equal($("peopleAiFilterLabel")?.textContent, "נושאי בינה מלאכותית");
	let filterHtml = $("peopleAiFilter").innerHTML;
	assert.ok(filterHtml.includes("כל הנושאים"));
	assert.ok(filterHtml.includes("אוריינות בינה מלאכותית והנחיה"));
	assert.ok(filterHtml.includes("יצירתיות ובינה יוצרת"));
	assert.ok(filterHtml.includes("מדעים, טכנולוגיה ותכנות"));
	assert.ok(filterHtml.includes("אתיקה, פרטיות ובטיחות"));

	$("langSelect").value = "ar";
	$("langSelect").fire("change");
	assert.equal(
		$("peopleAiFilterLabel")?.textContent,
		"موضوعات الذكاء الاصطناعي",
	);
	filterHtml = $("peopleAiFilter").innerHTML;
	assert.ok(filterHtml.includes("كل المواضيع"));
	assert.ok(filterHtml.includes("محو الأمية في التوجيهات"));
	assert.ok(filterHtml.includes("إنشاء المحتوى والوسائط"));
	assert.ok(filterHtml.includes("كفاءة الذكاء الاصطناعي والبرمجة"));
	assert.ok(filterHtml.includes("الأخلاق والأمان"));

	$("langSelect").value = "ru";
	$("langSelect").fire("change");
	assert.equal(
		$("peopleAiFilterLabel")?.textContent,
		"Темы искусственного интеллекта",
	);
	filterHtml = $("peopleAiFilter").innerHTML;
	assert.ok(filterHtml.includes("Все темы"));
	assert.ok(filterHtml.includes("Грамотность в ИИ и промптинг"));
	assert.ok(filterHtml.includes("Творчество и генеративный ИИ"));
	assert.ok(filterHtml.includes("STEM и программирование"));
	assert.ok(filterHtml.includes("Этика и безопасность ИИ"));

	$("langSelect").value = "he";
	$("langSelect").fire("change");
	assert.equal($("peopleAiFilterLabel")?.textContent, "נושאי בינה מלאכותית");
	filterHtml = $("peopleAiFilter").innerHTML;
	assert.ok(filterHtml.includes("כל הנושאים"));
});

test("guard falls back to showing all participants when storeLib.filterParticipantsByAITopic is missing", () => {
	const samplePeople = [
		{
			role: "student",
			region: "CENTER",
			availability: ["SUN_16"],
			subjects: ["MATH"],
			target_ai_topics: ["AI_LIT_PROMPT"],
		},
		{
			role: "pupil",
			region: "NORTH",
			availability: ["MON_18"],
			subjects: ["PHYSICS"],
			parentConsent: true,
			target_ai_topics: ["AI_ETHICS_SEC"],
		},
	];

	const html = fs.readFileSync(path.join(ROOT, "app.html"), "utf8");
	const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(
		(m) => m[1],
	);
	scripts[1] = scripts[1].replace(
		"filterParticipantsByAITopic\n",
		"/* removed filterParticipantsByAITopic */\n",
	);

	const initialAttrs = {};
	for (const m of html.matchAll(/<([a-z0-9-]+)\b([^>]*)>/gi)) {
		const tagAttrs = m[2];
		const idMatch = tagAttrs.match(/\bid="([^"]+)"/);
		if (!idMatch) continue;
		const id = idMatch[1];
		initialAttrs[id] = initialAttrs[id] || {};
		if (/\bhidden\b/.test(tagAttrs)) initialAttrs[id].hidden = true;
		for (const attrMatch of tagAttrs.matchAll(/\b([a-z0-9-]+)="([^"]*)"/gi)) {
			initialAttrs[id][attrMatch[1]] = attrMatch[2];
		}
	}
	const els = {};
	const fakeElement = (id) => {
		const handlers = {};
		const attrs = {};
		return {
			id,
			value: "",
			textContent: "",
			className: "",
			innerHTML: "",
			hidden: false,
			children: [],
			style: {},
			checked: false,
			addEventListener(type, fn) {
				if (!handlers[type]) {
					handlers[type] = [];
				}
				handlers[type].push(fn);
			},
			setAttribute(k, v) {
				attrs[k] = String(v);
			},
			getAttribute(k) {
				return k in attrs ? attrs[k] : null;
			},
			fire(type, ev) {
				for (const fn of handlers[type] || []) {
					fn(ev || { target: this });
				}
			},
		};
	};
	const $ = (id) => {
		if (!els[id]) {
			const el = fakeElement(id);
			if (initialAttrs[id]) {
				if (initialAttrs[id].hidden) el.hidden = true;
				for (const [k, v] of Object.entries(initialAttrs[id])) {
					if (k !== "hidden") el.setAttribute(k, v);
				}
			}
			els[id] = el;
		}
		return els[id];
	};
	const store = {
		[DEFAULT_KEY]: serialize({
			people: samplePeople,
			queue: emptyQueue(),
			log: emptyLog(),
		}),
	};
	const ctx = {
		document: {
			documentElement: { dir: "rtl" },
			getElementById: $,
			querySelectorAll: () => [],
			querySelector: () => null,
		},
		localStorage: {
			getItem: (k) => (k in store ? store[k] : null),
			setItem: (k, v) => {
				store[k] = String(v);
			},
			removeItem: (k) => {
				delete store[k];
			},
		},
		window: {
			scrollTo() {},
			get localStorage() {
				return ctx.localStorage;
			},
		},
		setTimeout: (fn) => fn(),
		console,
	};
	vm.createContext(ctx);
	for (const code of scripts) {
		vm.runInContext(code, ctx);
	}

	$("peopleAiFilter").value = "AI_LIT_PROMPT";
	$("peopleAiFilter").fire("change");
	const htmlResult = $("peopleList").innerHTML;
	assert.ok(htmlResult.includes("סטודנט מלמד #1"));
	assert.ok(htmlResult.includes("תלמיד #2"));
});
