const test = require("node:test");
const assert = require("node:assert/strict");
const {
	makeBackupEnvelope,
	openBackupEnvelope,
	backupFilename,
	MIN_ITER,
} = require("../src/lib/backup.js");

// Helper stub primitives
function stubEncryptFactory(returnHex) {
	return (_plain, _opts) => {
		// ignore inputs, just return the supplied hex string
		return returnHex;
	};
}
function stubDecryptFactory(returnPlain) {
	return (ciphertext, _opts) => {
		// ensure ciphertext is passed through unchanged for sanity checks
		assert.ok(typeof ciphertext === "string");
		return returnPlain;
	};
}

/* -------------------------------------------------------------------------- */
/* backupFilename tests                                                       */
/* -------------------------------------------------------------------------- */
test("backupFilename: valid date produces correct filename", () => {
	const fn = backupFilename("2026-11-10");
	assert.equal(fn, "peered-backup-2026-11-10.json");
});

test("backupFilename: invalid dates throw with proper message", () => {
	const badDates = ["2026-11-1", "20261110", "", 2026];
	for (const d of badDates) {
		assert.throws(() => backupFilename(d), /invalid date: expected YYYY-MM-DD/);
	}
});

/* -------------------------------------------------------------------------- */
/* makeBackupEnvelope validation tests                                        */
/* -------------------------------------------------------------------------- */
test("makeBackupEnvelope: rejects empty plaintext", () => {
	const opts = {
		saltHex: "aabbccddeeff00112233445566778899",
		ivHex: "0102030405060708090a0b0c",
		encrypt: stubEncryptFactory("a".repeat(64)),
	};
	assert.throws(
		() => makeBackupEnvelope("", opts),
		/invalid backup: expected non-empty text/,
	);
});

test("makeBackupEnvelope: rejects uppercase hex salt", () => {
	const opts = {
		saltHex: "AABBCCDDEEFF00112233445566778899",
		ivHex: "0102030405060708090a0b0c",
		encrypt: stubEncryptFactory("a".repeat(64)),
	};
	assert.throws(
		() => makeBackupEnvelope("x", opts),
		/invalid backup: salt must be at least 16 bytes/,
	);
});

test("makeBackupEnvelope: rejects odd-length salt", () => {
	const opts = {
		saltHex: "aabbccddeeff0011223344556677889",
		ivHex: "0102030405060708090a0b0c",
		encrypt: stubEncryptFactory("a".repeat(64)),
	};
	assert.throws(
		() => makeBackupEnvelope("x", opts), // 31 chars
		/invalid backup: salt must be at least 16 bytes/,
	);
});

test("makeBackupEnvelope: rejects short salt (<32 chars)", () => {
	const opts = {
		saltHex: "aabbccdd",
		ivHex: "0102030405060708090a0b0c",
		encrypt: stubEncryptFactory("a".repeat(64)),
	};
	assert.throws(
		() => makeBackupEnvelope("x", opts),
		/invalid backup: salt must be at least 16 bytes/,
	);
});

test("makeBackupEnvelope: rejects bad iv length", () => {
	const opts = {
		saltHex: "aabbccddeeff00112233445566778899",
		ivHex: "01020304", // too short
		encrypt: stubEncryptFactory("a".repeat(64)),
	};
	assert.throws(
		() => makeBackupEnvelope("x", opts),
		/invalid backup: salt must be at least 16 bytes and iv exactly 12 bytes of hex/,
	);
});

test("makeBackupEnvelope: rejects iteration count below MIN_ITER", () => {
	const opts = {
		saltHex: "aabbccddeeff00112233445566778899",
		ivHex: "0102030405060708090a0b0c",
		iter: MIN_ITER - 1,
		encrypt: stubEncryptFactory("a".repeat(64)),
	};
	assert.throws(
		() => makeBackupEnvelope("x", opts),
		/invalid backup: iteration count out of range/,
	);
});

test("makeBackupEnvelope: rejects missing encrypt primitive", () => {
	const opts = {
		saltHex: "aabbccddeeff00112233445566778899",
		ivHex: "0102030405060708090a0b0c",
	};
	assert.throws(
		() => makeBackupEnvelope("x", opts),
		/invalid backup: encrypt primitive is required/,
	);
});

test("makeBackupEnvelope: succeeds with iter === MIN_ITER and returns frozen envelope", () => {
	const opts = {
		saltHex: "aabbccddeeff00112233445566778899",
		ivHex: "0102030405060708090a0b0c",
		iter: MIN_ITER,
		encrypt: stubEncryptFactory("b".repeat(64)), // 64 hex chars, lowercase
	};
	const env = makeBackupEnvelope("payload", opts);
	assert.ok(Object.isFrozen(env), "envelope should be frozen");
	assert.equal(env.v, 1);
	assert.equal(env.kdf, "PBKDF2-SHA256");
	assert.equal(env.iter, MIN_ITER);
	assert.equal(env.salt, opts.saltHex);
	assert.equal(env.iv, opts.ivHex);
	assert.equal(env.ciphertext, "b".repeat(64));
});

/* -------------------------------------------------------------------------- */
/* openBackupEnvelope edge cases                                             */
/* -------------------------------------------------------------------------- */
test("openBackupEnvelope: generic failures for malformed envelopes", () => {
	const validOpts = { decrypt: stubDecryptFactory("ok") };
	const goodEnv = makeBackupEnvelope("ok", {
		saltHex: "aabbccddeeff00112233445566778899",
		ivHex: "0102030405060708090a0b0c",
		encrypt: stubEncryptFactory("c".repeat(64)),
	});

	const malformed = [
		null,
		[],
		// missing field (remove ciphertext)
		(() => {
			const copy = { ...goodEnv };
			delete copy.ciphertext;
			return copy;
		})(),
		// wrong version
		(() => {
			const copy = { ...goodEnv, v: 2 };
			return copy;
		})(),
		// wrong kdf
		(() => {
			const copy = { ...goodEnv, kdf: "PBKDF2-MD5" };
			return copy;
		})(),
		// uppercase ciphertext (invalid hex)
		(() => {
			const copy = { ...goodEnv, ciphertext: goodEnv.ciphertext.toUpperCase() };
			return copy;
		})(),
	];

	for (const env of malformed) {
		assert.throws(
			() => openBackupEnvelope(env, validOpts),
			/cannot open backup/,
		);
	}
});

test("openBackupEnvelope: returns plaintext on valid envelope, rejects empty plaintext from decrypt", () => {
	const plaintext = "secret data";
	const env = makeBackupEnvelope(plaintext, {
		saltHex: "aabbccddeeff00112233445566778899",
		ivHex: "0102030405060708090a0b0c",
		encrypt: stubEncryptFactory("d".repeat(64)),
	});

	// Successful decryption
	const result = openBackupEnvelope(env, {
		decrypt: stubDecryptFactory(plaintext),
	});
	assert.equal(result, plaintext);

	// Decrypt returns empty string -> generic error
	assert.throws(
		() => openBackupEnvelope(env, { decrypt: stubDecryptFactory("") }),
		/cannot open backup/,
	);
});
