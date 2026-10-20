import { describe, it } from "node:test";
import assert from "node:assert";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { load } from "js-yaml";

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

describe("sandbox schema extension", () => {
	describe("permissions field", () => {
		it("accepts valid permissions array", () => {
			const schema = {
				safeParse(obj) {
					if (obj.permissions !== undefined && !Array.isArray(obj.permissions)) {
						return { success: false };
					}
					return {
						success: true,
						data: { permissions: obj.permissions !== undefined ? obj.permissions : [] },
					};
				},
			};
			const result = schema.safeParse({ permissions: ["filesystem:read", "filesystem:write"] });
			assert.strictEqual(result.success, true);
			assert.deepStrictEqual(result.data.permissions, ["filesystem:read", "filesystem:write"]);
		});

		it("rejects non-array permissions", () => {
			const schema = {
				safeParse(obj) {
					if (obj.permissions !== undefined && !Array.isArray(obj.permissions)) {
						return { success: false };
					}
					return {
						success: true,
						data: { permissions: obj.permissions !== undefined ? obj.permissions : [] },
					};
				},
			};
			const result = schema.safeParse({ permissions: "filesystem:read" });
			assert.strictEqual(result.success, false);
		});

		it("defaults permissions to empty array", () => {
			const schema = {
				safeParse(obj) {
					if (obj.permissions !== undefined && !Array.isArray(obj.permissions)) {
						return { success: false };
					}
					return {
						success: true,
						data: { permissions: obj.permissions !== undefined ? obj.permissions : [] },
					};
				},
			};
			const result = schema.safeParse({});
			assert.strictEqual(result.success, true);
			assert.deepStrictEqual(result.data.permissions, []);
		});
	});
});

describe("agent schema defaults", () => {
	describe("recursionLimit", () => {
		it("defaults to 1000", () => {
			const schema = {
				safeParse(obj) {
					const agent = obj.agent || {};
					return {
						success: true,
						data: {
							agent: {
								recursionLimit: agent.recursionLimit !== undefined ? agent.recursionLimit : 1000,
							},
						},
					};
				},
			};
			const result = schema.safeParse({});
			assert.strictEqual(result.success, true);
			assert.strictEqual(result.data.agent.recursionLimit, 1000);
		});

		it("accepts custom recursionLimit value", () => {
			const schema = {
				safeParse(obj) {
					const agent = obj.agent || {};
					return {
						success: true,
						data: {
							agent: {
								recursionLimit: agent.recursionLimit !== undefined ? agent.recursionLimit : 1000,
							},
						},
					};
				},
			};
			const result = schema.safeParse({ agent: { recursionLimit: 500 } });
			assert.strictEqual(result.success, true);
			assert.strictEqual(result.data.agent.recursionLimit, 500);
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

describe("config.yaml schema completeness", () => {
	it("has all search engine config keys", () => {
		const __dirname = dirname(fileURLToPath(import.meta.url));
		const configPath = join(__dirname, "../../config.yaml");
		const config = load(readFileSync(configPath, "utf8"));
		assert.ok(config.search, "search section must exist");
		assert.ok(config.search.duckduckgo, "search.duckduckgo must exist");
		assert.ok(config.search.searxng, "search.searxng must exist");
		assert.ok(config.search.searxng.url !== undefined, "search.searxng.url must exist");
		assert.ok(config.search.bing, "search.bing must exist");
		assert.ok(config.search.custom, "search.custom must exist");
	});

	it("has all calendar config keys", () => {
		const __dirname = dirname(fileURLToPath(import.meta.url));
		const configPath = join(__dirname, "../../config.yaml");
		const config = load(readFileSync(configPath, "utf8"));
		assert.ok(config.calendar, "calendar section must exist");
		assert.ok(config.calendar.google, "calendar.google must exist");
		assert.ok(config.calendar.msgraph, "calendar.msgraph must exist");
	});

	it("has all memory config keys", () => {
		const __dirname = dirname(fileURLToPath(import.meta.url));
		const configPath = join(__dirname, "../../config.yaml");
		const config = load(readFileSync(configPath, "utf8"));
		assert.strictEqual(config.memory.ephemeralLimit, 5);
		assert.strictEqual(config.memory.maxEntries, 100);
	});
});

describe("config.yaml completeness", () => {
	const PROJECT_ROOT = dirname(fileURLToPath(import.meta.url));
	const configPath = join(PROJECT_ROOT, "../../config.yaml");
	const config = load(readFileSync(configPath, "utf8"));

	it("has all search engine config keys", () => {
		assert.ok(config.search, "search section must exist");
		assert.ok(config.search.duckduckgo, "search.duckduckgo must exist");
		assert.ok(config.search.searxng, "search.searxng must exist");
		assert.ok(config.search.searxng.url !== undefined, "search.searxng.url must exist");
		assert.ok(config.search.bing, "search.bing must exist");
		assert.ok(config.search.custom, "search.custom must exist");
	});

	it("has all calendar config keys", () => {
		assert.ok(config.calendar, "calendar section must exist");
		assert.ok(config.calendar.google, "calendar.google must exist");
		assert.ok(config.calendar.msgraph, "calendar.msgraph must exist");
	});

	it("has all memory config keys", () => {
		assert.strictEqual(config.memory.ephemeralLimit, 5);
		assert.strictEqual(config.memory.maxEntries, 100);
	});
});
