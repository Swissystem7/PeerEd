const test = require("node:test");
const assert = require("node:assert/strict");
const { manifestJson, swSource } = require("../src/lib/pwa.js");

test("manifestJson default properties and trailing newline", () => {
	const raw = manifestJson();
	assert.ok(raw.endsWith("\n"), "raw manifest string ends with a newline");
	const m = JSON.parse(raw);
	assert.equal(m.name, "PeerEd");
	assert.equal(m.short_name, "PeerEd");
	assert.equal(m.start_url, ".");
	assert.equal(m.scope, ".");
	assert.equal(m.display, "standalone");
	assert.equal(m.background_color, "#0f1117");
	assert.equal(m.theme_color, "#0f1117");
});

test("manifestJson icon specification", () => {
	const m = JSON.parse(manifestJson());
	assert.equal(m.icons.length, 1);
	const icon = m.icons[0];
	assert.equal(icon.sizes, "any");
	assert.equal(icon.type, "image/svg+xml");
	assert.equal(icon.purpose, "any");
	assert.ok(icon.src.startsWith("data:image/svg+xml"));
});

test("manifestJson custom name preserves short_name", () => {
	const m = JSON.parse(manifestJson({ name: "My App" }));
	assert.equal(m.name, "My App");
	assert.equal(m.short_name, "PeerEd");
});

test("manifestJson name fallback for empty, whitespace, or non-string names", () => {
	assert.equal(JSON.parse(manifestJson({ name: "" })).name, "PeerEd");
	assert.equal(JSON.parse(manifestJson({ name: "  " })).name, "PeerEd");
	assert.equal(JSON.parse(manifestJson({ name: 1 })).name, "PeerEd");
});

test("swSource validates cacheName and provides offline response without network access", () => {
	const defaultSw = swSource();
	assert.match(defaultSw, /var CACHE = 'peered-v1';/);
	assert.match(swSource({ cacheName: "" }), /var CACHE = 'peered-v1';/);
	assert.match(swSource({ cacheName: "PeerEd" }), /var CACHE = 'peered-v1';/);
	assert.match(
		swSource({ cacheName: "peered_v2" }),
		/var CACHE = 'peered-v1';/,
	);

	const customSw = swSource({ cacheName: "peered-v9" });
	assert.match(customSw, /var CACHE = 'peered-v9';/);

	assert.ok(defaultSw.includes("'./'"), "default source mentions './'");
	assert.ok(
		defaultSw.includes("'./app.html'"),
		"default source mentions './app.html'",
	);
	assert.match(defaultSw, /status:\s*503/);
	assert.ok(!defaultSw.includes("http://"), "does not contain http://");
	assert.ok(!defaultSw.includes("https://"), "does not contain https://");
});
