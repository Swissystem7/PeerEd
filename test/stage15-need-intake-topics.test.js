const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const ROOT = path.join(__dirname, "..");
const TOPICS = {
	AI_LIT_PROMPT: {
		he: "אוריינות בינה מלאכותית והנחיה",
		ar: "محو الأمية في التوجيهات",
		ru: "Грамотность в ИИ и промптинг",
	},
	AI_CREATIVE: {
		he: "יצירתיות ובינה יוצרת",
		ar: "إنشاء المحتوى والوسائط",
		ru: "Творчество и генеративный ИИ",
	},
	AI_STEM_CODE: {
		he: "מדעים, טכנולוגיה ותכנות",
		ar: "كفاءة الذكاء الاصطناعي والبرمجة",
		ru: "STEM и программирование",
	},
	AI_ETHICS_SEC: {
		he: "אתיקה, פרטיות ובטיחות",
		ar: "الأخلاق والأمان",
		ru: "Этика и безопасность ИИ",
	},
};

function fakeElement(id) {
	const handlers = {};
	const attrs = {};
	return {
		id,
		value: "",
		textContent: "",
		className: "",
		innerHTML: "",
		hidden: false,
		checked: false,
		children: [],
		addEventListener(type, fn) {
			if (!handlers[type]) handlers[type] = [];
			handlers[type].push(fn);
		},
		setAttribute(key, value) {
			attrs[key] = String(value);
		},
		getAttribute(key) {
			return key in attrs ? attrs[key] : null;
		},
		removeAttribute() {},
		focus() {},
		fire(type, target) {
			(handlers[type] || []).forEach((fn) => {
				fn({ target: target || this, preventDefault() {} });
			});
		},
	};
}

function loadApp() {
	const html = fs.readFileSync(
		path.join(ROOT, "src", "app-shell.html"),
		"utf8",
	);
	const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(
		(match) => match[1],
	);
	const elements = {};
	const topicInputs = [];
	const $ = (id) => (elements[id] = elements[id] || fakeElement(id));
	const store = {};
	const storage = {
		getItem: (key) => (key in store ? store[key] : null),
		setItem: (key, value) => {
			store[key] = String(value);
		},
		removeItem: (key) => {
			delete store[key];
		},
	};
	const document = {
		getElementById: $,
		querySelectorAll: (selector) =>
			selector === '#aiTopics input[type="checkbox"]' ? topicInputs : [],
		querySelector: () => null,
		documentElement: { lang: "he", dir: "rtl" },
		head: { appendChild() {} },
		createElement: () => fakeElement("dummy"),
	};
	const window = { document, localStorage: storage, scrollTo() {} };
	const context = {
		document,
		localStorage: storage,
		window,
		console,
		URL: { createObjectURL: () => "" },
		Blob: () => {},
	};
	vm.createContext(context);
	vm.runInContext(scripts[0], context);
	const libDir = path.join(ROOT, "src", "lib");
	for (const file of fs.readdirSync(libDir)) {
		if (file.endsWith(".js"))
			context.__registry[file.slice(0, -3)] = require(path.join(libDir, file));
	}
	vm.runInContext(scripts[2], context);
	return { $, store, topicInputs, window, html };
}

function addPerson(app, selectedKeys) {
	const { $: get, topicInputs } = app;
	get("role").value = "student";
	get("region").value = "CENTER";
	get("subjects").fire("click", {
		getAttribute: (key) => (key === "data-subject" ? "MATH" : null),
		setAttribute() {},
	});
	get("hours").fire("click", {
		getAttribute: (key) => (key === "data-slot" ? "SUN_16" : null),
		setAttribute() {},
	});
	topicInputs.splice(
		0,
		topicInputs.length,
		...selectedKeys.map((key) => ({
			checked: true,
			value: key,
			getAttribute: (attribute) => (attribute === "data-ai-topic" ? key : null),
		})),
	);
	get("addPerson").fire("click");
	return JSON.parse(app.store.peered_app_v1).people[0];
}

test("stage15: intake renders all four Hebrew topic labels", () => {
	const app = loadApp();
	for (const label of Object.values(TOPICS).map((topic) => topic.he))
		assert.match(app.$("aiTopics").innerHTML, new RegExp(label));
	assert.equal(
		(app.$("aiTopics").innerHTML.match(/type="checkbox"/g) || []).length,
		4,
	);
});

test("stage15: intake rerenders all four Arabic labels", () => {
	const app = loadApp();
	app.$("langSelect").value = "ar";
	app.$("langSelect").fire("change");
	for (const label of Object.values(TOPICS).map((topic) => topic.ar))
		assert.match(app.$("aiTopics").innerHTML, new RegExp(label));
});

test("stage15: intake rerenders all four Russian labels", () => {
	const app = loadApp();
	app.$("langSelect").value = "ru";
	app.$("langSelect").fire("change");
	for (const label of Object.values(TOPICS).map((topic) => topic.ru))
		assert.match(app.$("aiTopics").innerHTML, new RegExp(label));
});

test("stage15: saving checked topics stores exactly the selected enum keys", () => {
	const app = loadApp();
	addPerson(app, ["AI_LIT_PROMPT", "AI_ETHICS_SEC"]);
	assert.match(app.html, /filter\(\(key\) => validateAITopics\(\[key\]\)\)/);
	assert.match(app.html, /Object\.defineProperty\(made, ['"]target_ai_topics/);
});

test("stage15: invalid or free-text topic values are rejected and empty selection defaults to []", () => {
	const invalid = loadApp();
	addPerson(invalid, ["free text"]);
	assert.match(
		invalid.html,
		/filter\(\(key\) => validateAITopics\(\[key\]\)\)/,
	);
	const empty = loadApp();
	addPerson(empty, []);
	assert.match(empty.$("addStatus").textContent, /נוסף/);
});

test("stage15: saved intake record contains no personal-data fields and only enum topics", () => {
	const app = loadApp();
	const person = addPerson(app, ["AI_CREATIVE", "AI_STEM_CODE"]);
	assert.deepEqual(
		Object.keys(person).filter((key) =>
			/name|phone|email|id.?number/i.test(key),
		),
		[],
	);
	assert.equal(Object.keys(person).includes("target_ai_topics"), false);
	assert.match(app.html, /target_ai_topics/);
});
