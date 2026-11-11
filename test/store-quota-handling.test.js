const test = require("node:test");
const assert = require("node:assert/strict");

const {
	createStore,
	emptyState,
	memoryBackend,
	isQuotaExceededError,
	isQuotaExceeded,
	REJECTED_SUFFIX,
	INVALID_STATE_ERROR,
} = require("../src/lib/store.js");

test("isQuotaExceededError detects quota errors and handles negative cases", () => {
	// DOMException with QuotaExceededError name
	const domErr =
		typeof DOMException !== "undefined"
			? new DOMException("The quota has been exceeded.", "QuotaExceededError")
			: {
					name: "QuotaExceededError",
					code: 22,
					message: "The quota has been exceeded.",
				};
	assert.equal(isQuotaExceededError(domErr), true);
	assert.equal(isQuotaExceeded(domErr), true);

	// Error by name
	assert.equal(isQuotaExceededError({ name: "QuotaExceededError" }), true);
	assert.equal(
		isQuotaExceededError({ name: "NS_ERROR_DOM_QUOTA_REACHED" }),
		true,
	);

	// Error by code
	assert.equal(isQuotaExceededError({ code: 22 }), true);
	assert.equal(isQuotaExceededError({ code: 1014 }), true);

	// Error by number (IE/Edge legacy)
	assert.equal(isQuotaExceededError({ number: -2146828281 }), true);

	// Regex match on name or message
	assert.equal(isQuotaExceededError(new Error("Storage quota exceeded")), true);
	assert.equal(
		isQuotaExceededError({ name: "StorageQuotaException", message: "failed" }),
		true,
	);
	assert.equal(
		isQuotaExceededError({ name: "Error", message: "QUOTA_EXCEEDED_ERR" }),
		true,
	);

	// Negative cases
	assert.equal(isQuotaExceededError(new Error("Generic failure")), false);
	assert.equal(isQuotaExceededError(new TypeError("Invalid argument")), false);
	assert.equal(
		isQuotaExceededError({
			code: 18,
			name: "SecurityError",
			message: "access denied",
		}),
		false,
	);
	assert.equal(isQuotaExceededError({}), false);
	assert.equal(isQuotaExceededError(null), false);
	assert.equal(isQuotaExceededError(undefined), false);
	assert.equal(isQuotaExceededError(0), false);
	assert.equal(isQuotaExceededError(""), false);
	assert.equal(isQuotaExceededError("random string error"), false);
	assert.equal(isQuotaExceededError(false), false);
});

test("store.save returns false safely without throwing when backend.setItem throws QuotaExceededError", () => {
	const backend = memoryBackend();
	backend.setItem = () => {
		const err =
			typeof DOMException !== "undefined"
				? new DOMException("Storage quota reached", "QuotaExceededError")
				: new Error("QuotaExceededError");
		throw err;
	};

	const store = createStore(backend, "test_quota_key");
	assert.doesNotThrow(() => {
		const result = store.save(emptyState());
		assert.equal(result, false);
	});
});

test("store.save returns false safely without throwing when given invalid state that fails serialization", () => {
	const backend = memoryBackend();
	const store = createStore(backend, "test_invalid_state_key");

	assert.doesNotThrow(() => {
		assert.equal(store.save(null), false);
	});
	assert.doesNotThrow(() => {
		assert.equal(store.save(undefined), false);
	});
	assert.doesNotThrow(() => {
		assert.equal(store.save({ people: "not an array" }), false);
	});
	assert.doesNotThrow(() => {
		assert.equal(store.save({}), false);
	});
});

test("store.safeSave returns { ok, quotaExceeded, error } on success, quota error, and serialization error", () => {
	const normalBackend = memoryBackend();
	const normalStore = createStore(normalBackend, "test_safe_key");

	// Successful write
	const successResult = normalStore.safeSave(emptyState());
	assert.deepEqual(successResult, {
		ok: true,
		quotaExceeded: false,
		error: null,
	});
	assert.ok(normalBackend.getItem("test_safe_key") !== null);

	// Quota exceeded write error
	const quotaBackend = memoryBackend();
	quotaBackend.setItem = () => {
		const err = new Error("QuotaExceededError: storage is full");
		err.name = "QuotaExceededError";
		err.code = 22;
		throw err;
	};
	const quotaStore = createStore(quotaBackend, "test_quota_safe_key");
	const quotaResult = quotaStore.safeSave(emptyState());
	assert.equal(quotaResult.ok, false);
	assert.equal(quotaResult.quotaExceeded, true);
	assert.match(quotaResult.error, /QuotaExceededError/);

	// Non-quota error (e.g. invalid state)
	const invalidResult = normalStore.safeSave(null);
	assert.equal(invalidResult.ok, false);
	assert.equal(invalidResult.quotaExceeded, false);
	assert.ok(
		typeof invalidResult.error === "string" && invalidResult.error.length > 0,
	);
});

test("store.load resilience when storage throws QuotaExceededError while saving rejected copies", () => {
	const main = memoryBackend();
	const rejected = memoryBackend();
	const backend = {
		getItem: (key) => main.getItem(key),
		setItem: (key, value) => {
			if (key.endsWith(REJECTED_SUFFIX)) return rejected.setItem(key, value);
			return main.setItem(key, value);
		},
		removeItem: (key) => {
			main.removeItem(key);
			rejected.removeItem(key);
		},
	};

	// When rejected copy is written, throw QuotaExceededError
	rejected.setItem = () => {
		const err =
			typeof DOMException !== "undefined"
				? new DOMException("Storage quota reached", "QuotaExceededError")
				: new Error("QuotaExceededError");
		throw err;
	};

	const store = createStore(backend, "k_rejected_quota");
	main.setItem("k_rejected_quota", "not valid json state <<<!");

	const loaded = store.load();
	assert.equal(loaded.kept, false);
	assert.equal(loaded.problem, `${INVALID_STATE_ERROR}: not JSON`);
	assert.deepEqual(loaded.state, emptyState());
});
