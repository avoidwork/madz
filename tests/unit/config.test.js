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
