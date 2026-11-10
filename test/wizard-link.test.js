const test = require("node:test");
const assert = require("node:assert/strict");
const {
	encodeAvailabilityLink,
	decodeAvailabilityLink,
	fnv1a,
} = require("../src/lib/wizard-link.js");
const { makeProfile } = require("../src/lib/profile.js");

function makeLinkWithPayload(payloadString) {
	const bytes = new TextEncoder().encode(payloadString);
	let bin = "";
	bytes.forEach((b) => {
		bin += String.fromCharCode(b);
	});
	const payload = btoa(bin)
		.replace(/\+/g, "-")
		.replace(/\//g, "_")
		.replace(/=+$/, "");
	return `#a=${payload}.${fnv1a(payload)}`;
}

// ---------------------------------------------------------------------------
// 1. fnv1a function
// ---------------------------------------------------------------------------
test("fnv1a: empty string gives 811c9dc5", () => {
	assert.equal(fnv1a(""), "811c9dc5");
});

test("fnv1a: returns deterministic 8-character hex output", () => {
	const inputs = [
		"",
		"a",
		"hello",
		"PeerEd",
		'{"role":"student"}',
		"שבת_16",
		"1234567890",
	];
	for (const input of inputs) {
		const hash = fnv1a(input);
		assert.equal(typeof hash, "string");
		assert.equal(hash.length, 8, `Hash length should be 8 for input: ${input}`);
		assert.match(
			hash,
			/^[0-9a-f]{8}$/,
			`Hash should be lowercase 8-hex for input: ${input}`,
		);
	}
});

test("fnv1a: known strings produce consistent hashes across calls", () => {
	assert.equal(fnv1a("a"), "e40c292c");
	assert.equal(fnv1a("test"), "afd071e5");
	assert.equal(fnv1a("PeerEd"), "f9e0e760");

	// Determinism over multiple iterations
	for (let i = 0; i < 10; i += 1) {
		assert.equal(fnv1a(""), "811c9dc5");
		assert.equal(fnv1a("a"), "e40c292c");
		assert.equal(fnv1a("test"), "afd071e5");
		assert.equal(fnv1a("PeerEd"), "f9e0e760");
	}
});

test("fnv1a: different inputs produce different hashes", () => {
	const samples = [
		"",
		"a",
		"b",
		"A",
		"student",
		"pupil",
		"NORTH",
		"CENTER",
		"MATH",
		"PHYSICS",
		"SUN_8",
		"SUN_9",
	];
	const hashes = new Set();
	for (const str of samples) {
		const h = fnv1a(str);
		assert.equal(
			hashes.has(h),
			false,
			`Collision detected between ${str} and previous sample with hash ${h}`,
		);
		hashes.add(h);
	}
});

// ---------------------------------------------------------------------------
// 2. encodeAvailabilityLink / decodeAvailabilityLink roundtrip
// ---------------------------------------------------------------------------
test("roundtrip: valid student profile inputs roundtrip successfully and return makeProfile result", () => {
	const input = {
		role: "student",
		region: "CENTER",
		subjects: ["MATH", "PHYSICS"],
		availability: ["SUN_8", "MON_10"],
	};

	const link = encodeAvailabilityLink(input);
	const profile = decodeAvailabilityLink(link);
	const expected = makeProfile(input);

	assert.equal(profile.role, "student");
	assert.equal(profile.region, "CENTER");
	assert.deepEqual(Array.from(profile.subjects), ["MATH", "PHYSICS"]);
	assert.deepEqual(Array.from(profile.availability), ["SUN_8", "MON_10"]);
	assert.deepEqual(profile, expected);
	assert.ok(Object.isFrozen(profile));
	assert.ok(Object.isFrozen(profile.subjects));
	assert.ok(Object.isFrozen(profile.availability));
	assert.equal(profile.retention.dataCategory, "profile");
});

test("roundtrip: valid pupil profile inputs roundtrip successfully and assign parentConsent: false", () => {
	const input = {
		role: "pupil",
		region: "NORTH",
		subjects: ["ENGLISH", "CS"],
		availability: ["TUE_14", "WED_16", "THU_18"],
	};

	const link = encodeAvailabilityLink(input);
	const profile = decodeAvailabilityLink(link);
	const expected = makeProfile(input);

	assert.equal(profile.role, "pupil");
	assert.equal(profile.region, "NORTH");
	assert.equal(profile.parentConsent, false);
	assert.deepEqual(profile, expected);
	assert.ok(Object.isFrozen(profile));
});

test("roundtrip: profiles across multiple regions roundtrip successfully", () => {
	const regions = [
		"NORTH",
		"HAIFA",
		"CENTER",
		"TEL_AVIV",
		"JERUSALEM",
		"SOUTH",
	];
	for (const region of regions) {
		const input = {
			role: "student",
			region: region,
			subjects: ["BIOLOGY"],
			availability: ["FRI_9"],
		};
		const link = encodeAvailabilityLink(input);
		const profile = decodeAvailabilityLink(link);
		assert.equal(profile.region, region);
		assert.deepEqual(profile, makeProfile(input));
	}
});

test("roundtrip: fragment formatting matches /^#a=[A-Za-z0-9_-]+\\.[0-9a-f]{8}$/", () => {
	const inputs = [
		{
			role: "student",
			region: "CENTER",
			subjects: ["MATH"],
			availability: ["SUN_8"],
		},
		{
			role: "pupil",
			region: "SOUTH",
			subjects: ["HISTORY", "CIVICS", "HEBREW"],
			availability: ["MON_12", "TUE_15", "WED_19"],
		},
	];

	for (const input of inputs) {
		const link = encodeAvailabilityLink(input);
		assert.match(link, /^#a=[A-Za-z0-9_-]+\.[0-9a-f]{8}$/);
		assert.ok(link.startsWith("#a="));
		const parts = link.slice(3).split(".");
		assert.equal(parts.length, 2);
		assert.match(parts[0], /^[A-Za-z0-9_-]+$/);
		assert.match(parts[1], /^[0-9a-f]{8}$/);
		assert.equal(fnv1a(parts[0]), parts[1]);
	}
});

test("roundtrip: decodeAvailabilityLink tolerates surrounding whitespace (trimming)", () => {
	const input = {
		role: "student",
		region: "TEL_AVIV",
		subjects: ["CS"],
		availability: ["MON_11"],
	};
	const link = encodeAvailabilityLink(input);
	const expected = makeProfile(input);

	const paddedCases = [
		` ${link}`,
		`${link} `,
		`   ${link}   `,
		`\t${link}\n`,
		`\r\n  ${link}  \r\n`,
	];

	for (const padded of paddedCases) {
		const decoded = decodeAvailabilityLink(padded);
		assert.deepEqual(decoded, expected);
	}
});

// ---------------------------------------------------------------------------
// 3. Integrity and tampering checks
// ---------------------------------------------------------------------------
test("integrity: changing a byte in the payload throws /invalid availability link/", () => {
	const input = {
		role: "student",
		region: "CENTER",
		subjects: ["MATH"],
		availability: ["SUN_8"],
	};
	const link = encodeAvailabilityLink(input);
	const [prefixAndPayload, checksum] = link.split(".");
	const prefix = "#a=";
	const payload = prefixAndPayload.slice(prefix.length);

	// Flip the first character of the payload
	const tamperedChar = payload[0] === "A" ? "B" : "A";
	const tamperedPayload = tamperedChar + payload.slice(1);
	const tamperedLink = `${prefix + tamperedPayload}.${checksum}`;

	assert.throws(
		() => decodeAvailabilityLink(tamperedLink),
		/invalid availability link/,
	);

	// Truncate payload by 1 character
	assert.throws(
		() =>
			decodeAvailabilityLink(`${prefix + payload.slice(0, -1)}.${checksum}`),
		/invalid availability link/,
	);

	// Extend payload by 1 character
	assert.throws(
		() => decodeAvailabilityLink(`${prefix + payload}x.${checksum}`),
		/invalid availability link/,
	);
});

test("integrity: changing a byte in the checksum throws /invalid availability link/", () => {
	const input = {
		role: "student",
		region: "CENTER",
		subjects: ["MATH"],
		availability: ["SUN_8"],
	};
	const link = encodeAvailabilityLink(input);
	const [prefixAndPayload, checksum] = link.split(".");

	// Flip the last hex digit of the checksum
	const tamperedHex = checksum.endsWith("0") ? "1" : "0";
	const tamperedChecksum = checksum.slice(0, -1) + tamperedHex;
	const tamperedLink = `${prefixAndPayload}.${tamperedChecksum}`;

	assert.throws(
		() => decodeAvailabilityLink(tamperedLink),
		/invalid availability link/,
	);

	// Replace with an arbitrary 8-hex checksum
	assert.throws(
		() => decodeAvailabilityLink(`${prefixAndPayload}.00000000`),
		/invalid availability link/,
	);
	assert.throws(
		() => decodeAvailabilityLink(`${prefixAndPayload}.ffffffff`),
		/invalid availability link/,
	);
});

test("integrity: non-string inputs throw /invalid availability link/", () => {
	const nonStrings = [null, undefined, 12345, true, false, {}, [], () => {}];
	for (const val of nonStrings) {
		assert.throws(
			() => decodeAvailabilityLink(val),
			/invalid availability link/,
		);
	}
});

test("integrity: malformed link format throws /invalid availability link/", () => {
	const input = {
		role: "student",
		region: "CENTER",
		subjects: ["MATH"],
		availability: ["SUN_8"],
	};
	const link = encodeAvailabilityLink(input);
	const rawBody = link.slice(3); // without '#a='

	// Missing or bad prefix
	assert.throws(() => decodeAvailabilityLink(""), /invalid availability link/);
	assert.throws(
		() => decodeAvailabilityLink("#a"),
		/invalid availability link/,
	);
	assert.throws(
		() => decodeAvailabilityLink("#a="),
		/invalid availability link/,
	);
	assert.throws(
		() => decodeAvailabilityLink(rawBody),
		/invalid availability link/,
	);
	assert.throws(
		() => decodeAvailabilityLink(`a=${rawBody}`),
		/invalid availability link/,
	);
	assert.throws(
		() => decodeAvailabilityLink(`#b=${rawBody}`),
		/invalid availability link/,
	);
	assert.throws(
		() => decodeAvailabilityLink(`#=${rawBody}`),
		/invalid availability link/,
	);

	// Bad or missing separator
	assert.throws(
		() => decodeAvailabilityLink(link.replace(".", "_")),
		/invalid availability link/,
	);
	assert.throws(
		() => decodeAvailabilityLink(link.replace(".", ":")),
		/invalid availability link/,
	);
	assert.throws(
		() => decodeAvailabilityLink(link.replace(".", "")),
		/invalid availability link/,
	);
	assert.throws(
		() => decodeAvailabilityLink(link.replace(".", "..")),
		/invalid availability link/,
	);

	// Non-hex checksum
	const [prefixAndPayload] = link.split(".");
	assert.throws(
		() => decodeAvailabilityLink(`${prefixAndPayload}.zzzzzzzz`),
		/invalid availability link/,
	);
	assert.throws(
		() => decodeAvailabilityLink(`${prefixAndPayload}.1234567g`),
		/invalid availability link/,
	);
	assert.throws(
		() => decodeAvailabilityLink(`${prefixAndPayload}.1234567G`),
		/invalid availability link/,
	);
	assert.throws(
		() => decodeAvailabilityLink(`${prefixAndPayload}.1234567`),
		/invalid availability link/,
	); // 7 chars
	assert.throws(
		() => decodeAvailabilityLink(`${prefixAndPayload}.123456789`),
		/invalid availability link/,
	); // 9 chars
	assert.throws(
		() => decodeAvailabilityLink(`${prefixAndPayload}.1234-567`),
		/invalid availability link/,
	);

	// Disallowed characters in base64url payload
	assert.throws(
		() => decodeAvailabilityLink("#a=abc+def.12345678"),
		/invalid availability link/,
	);
	assert.throws(
		() => decodeAvailabilityLink("#a=abc/def.12345678"),
		/invalid availability link/,
	);
	assert.throws(
		() => decodeAvailabilityLink("#a=abc=def.12345678"),
		/invalid availability link/,
	);

	// Payload that decodes to non-JSON
	const nonJsonLink = makeLinkWithPayload("this is not json");
	assert.throws(
		() => decodeAvailabilityLink(nonJsonLink),
		/invalid availability link/,
	);

	// Payload that decodes to non-object
	const arrayPayloadLink = makeLinkWithPayload(
		JSON.stringify(["student", "CENTER"]),
	);
	assert.throws(
		() => decodeAvailabilityLink(arrayPayloadLink),
		/invalid availability link/,
	);
	const stringPayloadLink = makeLinkWithPayload(
		JSON.stringify("a plain string"),
	);
	assert.throws(
		() => decodeAvailabilityLink(stringPayloadLink),
		/invalid availability link/,
	);
	const nullPayloadLink = makeLinkWithPayload(JSON.stringify(null));
	assert.throws(
		() => decodeAvailabilityLink(nullPayloadLink),
		/invalid availability link/,
	);
});

test("integrity: extra or missing keys in encodeAvailabilityLink throw /invalid availability link/", () => {
	const base = {
		role: "student",
		region: "CENTER",
		subjects: ["MATH"],
		availability: ["SUN_8"],
	};

	// Extra keys (including personal data or unexpected fields)
	assert.throws(
		() => encodeAvailabilityLink(Object.assign({}, base, { name: "Alice" })),
		/invalid availability link/,
	);
	assert.throws(
		() =>
			encodeAvailabilityLink(Object.assign({}, base, { phone: "050-1234567" })),
		/invalid availability link/,
	);
	assert.throws(
		() =>
			encodeAvailabilityLink(Object.assign({}, base, { parentConsent: true })),
		/invalid availability link/,
	);
	assert.throws(
		() =>
			encodeAvailabilityLink(Object.assign({}, base, { extraKey: "value" })),
		/invalid availability link/,
	);

	// Missing keys
	assert.throws(
		() =>
			encodeAvailabilityLink({
				region: "CENTER",
				subjects: ["MATH"],
				availability: ["SUN_8"],
			}),
		/invalid availability link/,
	);
	assert.throws(
		() =>
			encodeAvailabilityLink({
				role: "student",
				subjects: ["MATH"],
				availability: ["SUN_8"],
			}),
		/invalid availability link/,
	);
	assert.throws(
		() =>
			encodeAvailabilityLink({
				role: "student",
				region: "CENTER",
				availability: ["SUN_8"],
			}),
		/invalid availability link/,
	);
	assert.throws(
		() =>
			encodeAvailabilityLink({
				role: "student",
				region: "CENTER",
				subjects: ["MATH"],
			}),
		/invalid availability link/,
	);
	assert.throws(() => encodeAvailabilityLink({}), /invalid availability link/);

	// Non-objects
	assert.throws(
		() => encodeAvailabilityLink(null),
		/invalid availability link/,
	);
	assert.throws(
		() => encodeAvailabilityLink(undefined),
		/invalid availability link/,
	);
	assert.throws(
		() => encodeAvailabilityLink("student,CENTER"),
		/invalid availability link/,
	);
	assert.throws(
		() => encodeAvailabilityLink(["student", "CENTER"]),
		/invalid availability link/,
	);
	assert.throws(() => encodeAvailabilityLink(42), /invalid availability link/);
});

test("integrity: extra or missing keys in decodeAvailabilityLink throw /invalid availability link/", () => {
	// Extra key with valid checksum
	const extraKeyLink = makeLinkWithPayload(
		JSON.stringify({
			role: "student",
			region: "CENTER",
			subjects: ["MATH"],
			availability: ["SUN_8"],
			name: "Alice",
		}),
	);
	assert.throws(
		() => decodeAvailabilityLink(extraKeyLink),
		/invalid availability link/,
	);

	// Missing key with valid checksum
	const missingRoleLink = makeLinkWithPayload(
		JSON.stringify({
			region: "CENTER",
			subjects: ["MATH"],
			availability: ["SUN_8"],
		}),
	);
	assert.throws(
		() => decodeAvailabilityLink(missingRoleLink),
		/invalid availability link/,
	);

	const missingAvailLink = makeLinkWithPayload(
		JSON.stringify({
			role: "student",
			region: "CENTER",
			subjects: ["MATH"],
		}),
	);
	assert.throws(
		() => decodeAvailabilityLink(missingAvailLink),
		/invalid availability link/,
	);
});

test("validation: payload with invalid profile data in encodeAvailabilityLink throws makeProfile errors", () => {
	const base = {
		role: "student",
		region: "CENTER",
		subjects: ["MATH"],
		availability: ["SUN_8"],
	};

	// Invalid role (including 'tutor' which makeProfile rejects)
	assert.throws(
		() => encodeAvailabilityLink(Object.assign({}, base, { role: "tutor" })),
		/invalid role: expected student or pupil/,
	);
	assert.throws(
		() => encodeAvailabilityLink(Object.assign({}, base, { role: "admin" })),
		/invalid role: expected student or pupil/,
	);

	// Invalid region
	assert.throws(
		() => encodeAvailabilityLink(Object.assign({}, base, { region: "MOON" })),
		/invalid region: expected one of the REGIONS codes/,
	);
	assert.throws(
		() => encodeAvailabilityLink(Object.assign({}, base, { region: "center" })),
		/invalid region: expected one of the REGIONS codes/,
	);

	// Invalid subjects
	assert.throws(
		() => encodeAvailabilityLink(Object.assign({}, base, { subjects: [] })),
		/invalid subjects: expected a non-empty array/,
	);
	assert.throws(
		() => encodeAvailabilityLink(Object.assign({}, base, { subjects: "MATH" })),
		/invalid subjects: expected a non-empty array/,
	);
	assert.throws(
		() =>
			encodeAvailabilityLink(
				Object.assign({}, base, { subjects: ["UNKNOWN_SUBJECT"] }),
			),
		/invalid subjects entry: UNKNOWN_SUBJECT/,
	);

	// Invalid availability
	assert.throws(
		() => encodeAvailabilityLink(Object.assign({}, base, { availability: [] })),
		/invalid availability: expected a non-empty array of DAY_HOUR slots/,
	);
	assert.throws(
		() =>
			encodeAvailabilityLink(
				Object.assign({}, base, { availability: "SUN_8" }),
			),
		/invalid availability: expected a non-empty array of DAY_HOUR slots/,
	);
	assert.throws(
		() =>
			encodeAvailabilityLink(
				Object.assign({}, base, { availability: ["INVALID_SLOT"] }),
			),
		/invalid availability slot: INVALID_SLOT/,
	);
	assert.throws(
		() =>
			encodeAvailabilityLink(
				Object.assign({}, base, { availability: ["SUN_25"] }),
			),
		/invalid availability slot: SUN_25/,
	);
});

test("validation: payload with invalid profile data in decodeAvailabilityLink throws makeProfile errors", () => {
	// Craft links with all 4 canonical keys and matching checksum, but invalid values
	const invalidRoleLink = makeLinkWithPayload(
		JSON.stringify({
			role: "tutor",
			region: "CENTER",
			subjects: ["MATH"],
			availability: ["SUN_8"],
		}),
	);
	assert.throws(
		() => decodeAvailabilityLink(invalidRoleLink),
		/invalid role: expected student or pupil/,
	);

	const invalidRegionLink = makeLinkWithPayload(
		JSON.stringify({
			role: "student",
			region: "ATLANTIS",
			subjects: ["MATH"],
			availability: ["SUN_8"],
		}),
	);
	assert.throws(
		() => decodeAvailabilityLink(invalidRegionLink),
		/invalid region: expected one of the REGIONS codes/,
	);

	const emptySubjectsLink = makeLinkWithPayload(
		JSON.stringify({
			role: "student",
			region: "CENTER",
			subjects: [],
			availability: ["SUN_8"],
		}),
	);
	assert.throws(
		() => decodeAvailabilityLink(emptySubjectsLink),
		/invalid subjects: expected a non-empty array/,
	);

	const invalidSubjectEntryLink = makeLinkWithPayload(
		JSON.stringify({
			role: "student",
			region: "CENTER",
			subjects: ["POTIONS"],
			availability: ["SUN_8"],
		}),
	);
	assert.throws(
		() => decodeAvailabilityLink(invalidSubjectEntryLink),
		/invalid subjects entry: POTIONS/,
	);

	const emptyAvailabilityLink = makeLinkWithPayload(
		JSON.stringify({
			role: "student",
			region: "CENTER",
			subjects: ["MATH"],
			availability: [],
		}),
	);
	assert.throws(
		() => decodeAvailabilityLink(emptyAvailabilityLink),
		/invalid availability: expected a non-empty array of DAY_HOUR slots/,
	);

	const invalidSlotLink = makeLinkWithPayload(
		JSON.stringify({
			role: "student",
			region: "CENTER",
			subjects: ["MATH"],
			availability: ["MON_99"],
		}),
	);
	assert.throws(
		() => decodeAvailabilityLink(invalidSlotLink),
		/invalid availability slot: MON_99/,
	);
});
