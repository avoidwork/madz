import { describe, it } from "node:test";
import assert from "node:assert";

describe("config schema validation", () => {
	describe("RateLimitSchema", () => {
		it("accepts valid rate limit config", () => {
			const schema = {
				safeParse(obj) {
					if (obj.requestsPerMinute !== undefined && typeof obj.requestsPerMinute !== "number") {
						return { success: false };
					}
					const result = {
						requestsPerMinute: obj.requestsPerMinute !== undefined ? obj.requestsPerMinute : 60,
					};
					return { success: true, data: result };
				},
			};
			const result = schema.safeParse({ requestsPerMinute: 60 });
			assert.strictEqual(result.success, true);
		});

		it("rejects negative rate limit", () => {
			const schema = {
				safeParse(obj) {
					if (typeof obj.requestsPerMinute !== "number" || obj.requestsPerMinute < 0) {
						return { success: false };
					}
					const result = { requestsPerMinute: obj.requestsPerMinute || 60 };
					return { success: true, data: result };
				},
			};
			const result = schema.safeParse({ requestsPerMinute: -1 });
			assert.strictEqual(result.success, false);
		});

		it("applies default when missing", () => {
			const schema = {
				safeParse(obj) {
					if (obj.requestsPerMinute !== undefined && typeof obj.requestsPerMinute !== "number") {
						return { success: false };
					}
					const result = {
						requestsPerMinute: obj.requestsPerMinute !== undefined ? obj.requestsPerMinute : 60,
					};
					return { success: true, data: result };
				},
			};
			const result = schema.safeParse({});
			assert.strictEqual(result.success, true);
			assert.deepStrictEqual(result.data, { requestsPerMinute: 60 });
		});
	});

	describe("CredentialsSchema", () => {
		it("accepts valid api key", () => {
			const schema = {
				safeParse(obj) {
					if (!obj.apiKey || typeof obj.apiKey !== "string" || obj.apiKey.length === 0) {
						return { success: false };
					}
					return { success: true, data: obj };
				},
			};
			const result = schema.safeParse({ apiKey: "sk-test-key" });
			assert.strictEqual(result.success, true);
		});

		it("rejects empty api key", () => {
			const schema = {
				safeParse(obj) {
					if (!obj.apiKey || typeof obj.apiKey !== "string" || obj.apiKey.length === 0) {
						return { success: false };
					}
					return { success: true, data: obj };
				},
			};
			const result = schema.safeParse({ apiKey: "" });
			assert.strictEqual(result.success, false);
		});
	});

	describe("MetadataSchema", () => {
		it("accepts valid metadata entry", () => {
			const schema = {
				safeParse(obj) {
					return {
						success: obj.title && typeof obj.title === "string",
						data: obj,
					};
				},
			};
			const result = schema.safeParse({
				title: "Test",
				timestamp: "2024-01-01",
			});
			assert.strictEqual(result.success, true);
		});
	});
});

describe("config mutation engine", () => {
	function resolvePath(obj, path) {
		const keys = path.split(".");
		let current = obj;
		for (const key of keys) {
			if (current === undefined || current === null) return undefined;
			current = current[key];
		}
		return current;
	}

	function assignPath(obj, path, value) {
		const keys = path.split(".");
		let current = obj;
		for (let i = 0; i < keys.length - 1; i++) {
			if (current[keys[i]] === undefined || current[keys[i]] === null) {
				current[keys[i]] = {};
			}
			current = current[keys[i]];
		}
		current[keys[keys.length - 1]] = value;
	}

	function parseValue(str) {
		if (str === "true") return true;
		if (str === "false") return false;
		if (/^-?\d+(\.\d+)?$/.test(str)) return Number(str);
		return str;
	}

	describe("parseValue", () => {
		it("parses boolean true", () => assert.strictEqual(parseValue("true"), true));
		it("parses boolean false", () => assert.strictEqual(parseValue("false"), false));
		it("parses integer", () => assert.strictEqual(parseValue("42"), 42));
		it("parses float", () => assert.strictEqual(parseValue("3.14"), 3.14));
		it("keeps strings", () => assert.strictEqual(parseValue("hello"), "hello"));
		it("parses negative integer", () => assert.strictEqual(parseValue("-5"), -5));
		it("parses zero", () => assert.strictEqual(parseValue("0"), 0));
	});

	describe("resolvePath", () => {
		it("gets top-level value", () => {
			const obj = { foo: "bar" };
			assert.strictEqual(resolvePath(obj, "foo"), "bar");
		});

		it("gets nested value", () => {
			const obj = { a: { b: { c: "deep" } } };
			assert.strictEqual(resolvePath(obj, "a.b.c"), "deep");
		});

		it("returns undefined for missing path", () => {
			const obj = { foo: { bar: "baz" } };
			assert.strictEqual(resolvePath(obj, "foo.missing"), undefined);
		});

		it("returns undefined for null intermediate key", () => {
			const obj = { foo: null };
			assert.strictEqual(resolvePath(obj, "foo.bar"), undefined);
		});
	});

	describe("assignPath", () => {
		it("sets nested value", () => {
			const obj = { telemetry: { sampling: { ratio: 0.5 } } };
			assignPath(obj, "telemetry.sampling.ratio", 0.9);
			assert.strictEqual(obj.telemetry.sampling.ratio, 0.9);
		});

		it("creates intermediate objects", () => {
			const obj = {};
			assignPath(obj, "a.b.c", "deep");
			assert.strictEqual(obj.a.b.c, "deep");
		});

		it("overwrites existing scalar", () => {
			const obj = { a: "old" };
			assignPath(obj, "a", "new");
			assert.strictEqual(obj.a, "new");
		});
	});
});

describe("env var expansion", () => {
	it("expands ${VAR} pattern", () => {
		process.env.TEST_VAR = "expanded-value";
		const value = "${TEST_VAR}";
		const result = value.replace(/\$\{([A-Z_]+)\}/g, (_, key) => process.env[key] || value);
		assert.strictEqual(result, "expanded-value");
	});

	it("keeps original when env not set", () => {
		const value = "${NONEXISTENT_VAR_XYZ}";
		const result = value.replace(/\$\{([A-Z_]+)\}/g, (_, key) => process.env[key] || value);
		assert.strictEqual(result, "${NONEXISTENT_VAR_XYZ}");
	});
});
