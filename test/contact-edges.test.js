// Focused unit tests for src/lib/contact.js (isValidEmail, contactLink) using node:test and node:assert/strict.
const test = require("node:test");
const assert = require("node:assert/strict");
const contact = require("../src/lib/contact.js");

test("isValidEmail is true for well-formed addresses", () => {
	assert.equal(contact.isValidEmail("user@example.com"), true);
	assert.equal(contact.isValidEmail("First.Last+tag@sub.example.co.il"), true);
});

test("isValidEmail is false for invalid addresses", () => {
	assert.equal(contact.isValidEmail(""), false);
	assert.equal(contact.isValidEmail("not-an-email"), false);
	assert.equal(contact.isValidEmail("user@localhost"), false);
	assert.equal(contact.isValidEmail("user@example"), false);
	assert.equal(contact.isValidEmail("user@.com"), false);
	assert.equal(contact.isValidEmail(null), false);
	assert.equal(contact.isValidEmail(undefined), false);
	assert.equal(contact.isValidEmail(1), false);
});

test("contactLink trims input", () => {
	const form =
		"https://github.com/Swissystem7/PeerEd/issues/new?template=pilot.yml";
	assert.deepEqual(contact.contactLink("  pilot@example.org  ", form), {
		kind: "email",
		href: "mailto:pilot@example.org",
		label: "pilot@example.org",
	});
});

test("contactLink handles invalid URLs", () => {
	const form =
		"https://github.com/Swissystem7/PeerEd/issues/new?template=pilot.yml";
	assert.equal(contact.contactLink("HTTPS://example.com", form), null);
	assert.equal(contact.contactLink('https://example.com/x"y', form), null);
	assert.equal(contact.contactLink("https://example.com/a b", form), null);
});

test("contactLink handles empty and null inputs", () => {
	const form =
		"  https://github.com/Swissystem7/PeerEd/issues/new?template=pilot.yml  ";
	assert.deepEqual(contact.contactLink("", form.trim()), {
		kind: "issue",
		href: form.trim(),
		label: "טופס פנייה ב-GitHub",
	});
	assert.deepEqual(contact.contactLink(null, form.trim()), {
		kind: "issue",
		href: form.trim(),
		label: "טופס פנייה ב-GitHub",
	});
	assert.equal(contact.contactLink("javascript:alert(1)", form.trim()), null);
});
