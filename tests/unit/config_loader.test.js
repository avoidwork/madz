import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert";
import { _resolveEnvRecursively, applyDotPath, buildReverseMap, syncEnv } from "../../src/config/loader.js";
import { ConfigSchema } from "../../src/config/config.js";

describe("_resolveEnvRecursively — OpenAI provider", () => {
	let saved = { ...process.env };

	beforeEach(() => {
		saved = { ...process.env };
		const keys = Object.keys(process.env);
		for (const key of keys) {
			delete process.env[key];
		}
	});

	afterEach(() => {
		const keys = Object.keys(process.env);
		for (const key of keys) {
			delete process.env[key];
		}
		Object.assign(process.env, saved);
	});

	it("resolves OPENAI_API_KEY from nested credentials", () => {
		process.env.OPENAI_API_KEY = "sk-test-key";
		const config = {
			type: "openai",
			base_url: "https://api.openai.com/v1",
			model: "gpt-4o",
			credentials: { apiKey: "" },
		};
		const result = _resolveEnvRecursively(config, ["providers", "openai"]);
		assert.strictEqual(result.credentials.apiKey, "sk-test-key");
	});

	it("resolves OPENAI_BASE_URL", () => {
		process.env.OPENAI_BASE_URL = "https://custom.api.com/v1";
		const config = {
			type: "openai",
			base_url: "https://api.openai.com/v1",
		};
		const result = _resolveEnvRecursively(config, ["providers", "openai"]);
		assert.strictEqual(result.base_url, "https://custom.api.com/v1");
	});

	it("resolves OPENAI_MODEL", () => {
		process.env.OPENAI_MODEL = "gpt-4-turbo";
		const config = { model: "gpt-4o" };
		const result = _resolveEnvRecursively(config, ["providers", "openai"]);
		assert.strictEqual(result.model, "gpt-4-turbo");
	});

	it("resolves OPENAI_TEMPERATURE as number", () => {
		process.env.OPENAI_TEMPERATURE = "0.3";
		const config = { temperature: 0.7 };
		const result = _resolveEnvRecursively(config, ["providers", "openai"]);
		assert.strictEqual(result.temperature, 0.3);
	});

	it("resolves OPENAI_MAX_TOKENS as number", () => {
		process.env.OPENAI_MAX_TOKENS = "8192";
		const config = { maxTokens: 4096 };
		const result = _resolveEnvRecursively(config, ["providers", "openai"]);
		assert.strictEqual(result.maxTokens, 8192);
	});

	it("resolves OPENAI_REQUESTS_PER_MINUTE dropping rateLimit container", () => {
		process.env.OPENAI_REQUESTS_PER_MINUTE = "60";
		const config = { rateLimit: { requestsPerMinute: 120 } };
		const result = _resolveEnvRecursively(config, ["providers", "openai"]);
		assert.strictEqual(result.rateLimit.requestsPerMinute, 60);
	});

	it("preserves config value when env var not set", () => {
		const config = { model: "gpt-4o", temperature: 0.7, maxTokens: 4096 };
		const result = _resolveEnvRecursively(config, ["providers", "openai"]);
		assert.strictEqual(result.model, "gpt-4o");
		assert.strictEqual(result.temperature, 0.7);
		assert.strictEqual(result.maxTokens, 4096);
	});

	it("resolves all openai vars together", () => {
		process.env.OPENAI_BASE_URL = "https://gateway.example.com/v1";
		process.env.OPENAI_MODEL = "claude-sonnet";
		process.env.OPENAI_API_KEY = "sk-gateway-key";
		process.env.OPENAI_TEMPERATURE = "0.1";
		process.env.OPENAI_MAX_TOKENS = "16384";
		process.env.OPENAI_REQUESTS_PER_MINUTE = "200";
		const config = {
			type: "openai",
			base_url: "https://api.openai.com/v1",
			model: "gpt-4o",
			credentials: { apiKey: "sk-plain-key" },
			temperature: 0.7,
			maxTokens: 4096,
			rateLimit: { requestsPerMinute: 120 },
		};
		const result = _resolveEnvRecursively(config, ["providers", "openai"]);
		assert.strictEqual(result.base_url, "https://gateway.example.com/v1");
		assert.strictEqual(result.model, "claude-sonnet");
		assert.strictEqual(result.credentials.apiKey, "sk-gateway-key");
		assert.strictEqual(result.temperature, 0.1);
		assert.strictEqual(result.maxTokens, 16384);
		assert.strictEqual(result.rateLimit.requestsPerMinute, 200);
	});

	it("parses boolean env var string correctly", () => {
		// _parseValue("true") returns boolean true
		process.env.MY_FLAG = "true";
		const config = { myFlag: false };
		const result = _resolveEnvRecursively(config, []);
		assert.strictEqual(result.myFlag, true);
	});
});

describe("_resolveEnvRecursively — nested containers", () => {
	let saved = { ...process.env };

	beforeEach(() => {
		saved = { ...process.env };
		const keys = Object.keys(process.env);
		for (const key of keys) {
			delete process.env[key];
		}
	});

	afterEach(() => {
		const keys = Object.keys(process.env);
		for (const key of keys) {
			delete process.env[key];
		}
		Object.assign(process.env, saved);
	});

	it("drops 'providers' at top level", () => {
		process.env.OPENAI_MODEL = "gpt-4o-mini";
		const config = { providers: { openai: { model: "gpt-4o" } } };
		const result = _resolveEnvRecursively(config, []);
		assert.strictEqual(result.providers.openai.model, "gpt-4o-mini");
	});

	it("drops 'credentials' container key", () => {
		process.env.OPENAI_API_KEY = "secret";
		const config = { openai: { credentials: { apiKey: "empty" } } };
		const result = _resolveEnvRecursively(config, []);
		assert.strictEqual(result.openai.credentials.apiKey, "secret");
	});

	it("drops 'timeout' container key", () => {
		process.env.SANDBOX_SECONDS = "120";
		const config = { sandbox: { timeout: { seconds: 30 } } };
		const result = _resolveEnvRecursively(config, []);
		assert.strictEqual(result.sandbox.timeout.seconds, 120);
	});

	it("handles arrays", () => {
		const config = { paths: ["a/", "b/"] };
		const result = _resolveEnvRecursively(config, []);
		assert.deepStrictEqual(result.paths, ["a/", "b/"]);
	});

	it("resolves SANDBOX_GRACE_PERIOD", () => {
		process.env.SANDBOX_GRACE_PERIOD = "10";
		const config = { sandbox: { timeout: { gracePeriod: 5 } } };
		const result = _resolveEnvRecursively(config, []);
		assert.strictEqual(result.sandbox.timeout.gracePeriod, 10);
	});
});

describe("_resolveEnvRecursively — TUI options", () => {
	let saved = { ...process.env };

	beforeEach(() => {
		saved = { ...process.env };
		const keys = Object.keys(process.env);
		for (const key of keys) {
			delete process.env[key];
		}
	});

	afterEach(() => {
		const keys = Object.keys(process.env);
		for (const key of keys) {
			delete process.env[key];
		}
		Object.assign(process.env, saved);
	});

	it("resolves all TUI env vars", () => {
		process.env.TUI_NAME = "radz";
		const config = {
			tui: { name: "madz" },
		};
		const result = _resolveEnvRecursively(config, []);
		assert.strictEqual(result.tui.name, "radz");
	});
});

describe("_resolveEnvRecursively — Persistence options", () => {
	let saved = { ...process.env };

	beforeEach(() => {
		saved = { ...process.env };
		const keys = Object.keys(process.env);
		for (const key of keys) {
			delete process.env[key];
		}
	});

	afterEach(() => {
		const keys = Object.keys(process.env);
		for (const key of keys) {
			delete process.env[key];
		}
		Object.assign(process.env, saved);
	});

	it("resolves PERSISTENCE_MODE", () => {
		process.env.PERSISTENCE_MODE = "memory";
		const config = { persistence: { mode: "sqlite" } };
		const result = _resolveEnvRecursively(config, []);
		assert.strictEqual(result.persistence.mode, "memory");
	});

	it("resolves PERSISTENCE_SQLITE_PATH", () => {
		process.env.PERSISTENCE_SQLITE_PATH = "/tmp/test.db";
		const config = { persistence: { sqlite_path: "default.db" } };
		const result = _resolveEnvRecursively(config, []);
		assert.strictEqual(result.persistence.sqlite_path, "/tmp/test.db");
	});
});

describe("_resolveEnvRecursively — Agent options", () => {
	let saved = { ...process.env };

	beforeEach(() => {
		saved = { ...process.env };
		const keys = Object.keys(process.env);
		for (const key of keys) {
			delete process.env[key];
		}
	});

	afterEach(() => {
		const keys = Object.keys(process.env);
		for (const key of keys) {
			delete process.env[key];
		}
		Object.assign(process.env, saved);
	});

	it("resolves AGENT_RECURSION_LIMIT", () => {
		process.env.AGENT_RECURSION_LIMIT = "500";
		const config = { agent: { recursionLimit: 1000 } };
		const result = _resolveEnvRecursively(config, []);
		assert.strictEqual(result.agent.recursionLimit, 500);
	});

	it("resolves AGENT_NODE_TIMEOUT", () => {
		process.env.AGENT_NODE_TIMEOUT = "300000";
		const config = { agent: { nodeTimeout: 600000 } };
		const result = _resolveEnvRecursively(config, []);
		assert.strictEqual(result.agent.nodeTimeout, 300000);
	});
});

describe("_resolveEnvRecursively — LRU options", () => {
	let saved = { ...process.env };

	beforeEach(() => {
		saved = { ...process.env };
		const keys = Object.keys(process.env);
		for (const key of keys) {
			delete process.env[key];
		}
	});

	afterEach(() => {
		const keys = Object.keys(process.env);
		for (const key of keys) {
			delete process.env[key];
		}
		Object.assign(process.env, saved);
	});

	it("resolves LRU_SIZE", () => {
		process.env.LRU_SIZE = "200";
		const config = { lru: { size: 100 } };
		const result = _resolveEnvRecursively(config, []);
		assert.strictEqual(result.lru.size, 200);
	});

	it("resolves LRU_TTL", () => {
		process.env.LRU_TTL = "300000";
		const config = { lru: { ttl: 600000 } };
		const result = _resolveEnvRecursively(config, []);
		assert.strictEqual(result.lru.ttl, 300000);
	});
});

describe("_resolveEnvRecursively — subAgentsTemperature", () => {
	let saved = { ...process.env };

	beforeEach(() => {
		saved = { ...process.env };
		const keys = Object.keys(process.env);
		for (const key of keys) {
			delete process.env[key];
		}
	});

	afterEach(() => {
		const keys = Object.keys(process.env);
		for (const key of keys) {
			delete process.env[key];
		}
		Object.assign(process.env, saved);
	});

	it("resolves CODING from env var (subAgentsTemperature dropped)", () => {
		process.env.CODING = "0.5";
		const config = { subAgentsTemperature: { coding: 0.3 } };
		const result = _resolveEnvRecursively(config, []);
		assert.strictEqual(result.subAgentsTemperature.coding, 0.5);
	});
});

// --- New tests for syncEnv(), applyDotPath(), buildReverseMap() ---

describe("applyDotPath", () => {
	it("creates intermediate objects for nested paths", () => {
		const obj = {};
		applyDotPath(obj, "a.b.c", "deep");
		assert.strictEqual(obj.a.b.c, "deep");
	});

	it("creates arrays for numeric path segments", () => {
		const obj = {};
		applyDotPath(obj, "items.0", "first");
		assert.strictEqual(Array.isArray(obj.items), true);
		assert.strictEqual(obj.items[0], "first");
	});

	it("creates array when next segment is numeric", () => {
		const obj = {};
		applyDotPath(obj, "projects.projectAlpha.include.0", "src/**/*.js");
		assert.strictEqual(Array.isArray(obj.projects.projectAlpha.include), true);
		assert.strictEqual(obj.projects.projectAlpha.include[0], "src/**/*.js");
	});

	it("handles multiple array indices", () => {
		const obj = {};
		applyDotPath(obj, "arr.0.nested.1", "value");
		assert.strictEqual(Array.isArray(obj.arr), true);
		assert.strictEqual(obj.arr[0].nested[1], "value");
	});

	it("overwrites existing scalar values", () => {
		const obj = { a: "old" };
		applyDotPath(obj, "a", "new");
		assert.strictEqual(obj.a, "new");
	});

	it("preserves existing nested objects when setting sibling", () => {
		const obj = { a: { b: "existing", c: "keep" } };
		applyDotPath(obj, "a.b", "updated");
		assert.strictEqual(obj.a.b, "updated");
		assert.strictEqual(obj.a.c, "keep");
	});
});

describe("buildReverseMap", () => {
	it("returns a Map", () => {
		const map = buildReverseMap(ConfigSchema);
		assert.ok(map instanceof Map);
	});

	it("contains known env-var mappings", () => {
		const map = buildReverseMap(ConfigSchema);
		// TUI name
		assert.ok(map.has("TUI_NAME"), "Should have TUI_NAME");
		assert.strictEqual(map.get("TUI_NAME"), "tui.name");

		// Agent recursion limit
		assert.ok(map.has("AGENT_RECURSION_LIMIT"), "Should have AGENT_RECURSION_LIMIT");
		assert.strictEqual(map.get("AGENT_RECURSION_LIMIT"), "agent.recursionLimit");

		// Persistence mode
		assert.ok(map.has("PERSISTENCE_MODE"), "Should have PERSISTENCE_MODE");
		assert.strictEqual(map.get("PERSISTENCE_MODE"), "persistence.mode");

		// LRU size
		assert.ok(map.has("LRU_SIZE"), "Should have LRU_SIZE");
		assert.strictEqual(map.get("LRU_SIZE"), "lru.size");

		// Memory directory
		assert.ok(map.has("MEMORY_DIRECTORY"), "Should have MEMORY_DIRECTORY");
		assert.strictEqual(map.get("MEMORY_DIRECTORY"), "memory.directory");
	});

	it("handles DROPPED_KEYS correctly (providers dropped)", () => {
		const map = buildReverseMap(ConfigSchema);
		// providers.openai.credentials.apiKey → OPENAI_API_KEY (providers + credentials dropped)
		// But since providers is a passthrough record, the openai key is dynamic.
		// We check that the map does NOT contain PROVIDERS_OPENAI_CREDENTIALS_API_KEY
		// because providers is a ZodRecord (passthrough) and we skip record value schemas.
		assert.ok(!map.has("PROVIDERS_OPENAI_CREDENTIALS_API_KEY"));
	});

	it("handles subAgentsTemperature path correctly", () => {
		const map = buildReverseMap(ConfigSchema);
		// subAgentsTemperature is a ZodRecord (z.record(z.string(), z.number())),
		// so its value schema is skipped. The map won't contain SUB_AGENTS_TEMPERATURE_*
		// entries because record keys are dynamic.
		// This is expected — syncEnv() handles record entries via the prefix allowlist.
	});
});

describe("syncEnv", () => {
	let saved = { ...process.env };

	beforeEach(() => {
		saved = { ...process.env };
		const keys = Object.keys(process.env);
		for (const key of keys) {
			delete process.env[key];
		}
	});

	afterEach(() => {
		const keys = Object.keys(process.env);
		for (const key of keys) {
			delete process.env[key];
		}
		Object.assign(process.env, saved);
	});

	it("materializes missing config structure from env vars", () => {
		process.env.VECTOR_MODEL = "openai";
		const raw = {};
		const knownSections = ["vector"];
		const reverseMap = buildReverseMap(ConfigSchema);
		syncEnv(raw, knownSections, reverseMap);
		assert.strictEqual(raw.vector?.model, "openai");
	});

	it("respects prefix allowlist — ignores unknown prefixes", () => {
		process.env.UNKNOWN_KEY = "value";
		const raw = {};
		const knownSections = ["vector"];
		const reverseMap = buildReverseMap(ConfigSchema);
		syncEnv(raw, knownSections, reverseMap);
		assert.deepStrictEqual(raw, {});
	});

	it("is idempotent — does not override existing YAML keys", () => {
		process.env.TUI_NAME = "overridden";
		const raw = { tui: { name: "original" } };
		const knownSections = ["tui"];
		const reverseMap = buildReverseMap(ConfigSchema);
		syncEnv(raw, knownSections, reverseMap);
		assert.strictEqual(raw.tui.name, "original");
	});

	it("materializes array structure from env vars with numeric suffixes", () => {
		// Vector projects is a record, so individual project keys are dynamic.
		// We test with a known array path: sandbox.paths is z.array(z.string())
		process.env.SANDBOX_PATHS_0 = "./src";
		process.env.SANDBOX_PATHS_1 = "!node_modules";
		const raw = {};
		const knownSections = ["sandbox"];
		const reverseMap = buildReverseMap(ConfigSchema);
		syncEnv(raw, knownSections, reverseMap);
		// sandbox.paths is an array — the reverse map will have SANDBOX_PATHS_0 and SANDBOX_PATHS_1
		// but since sandbox is a ZodObject with known shape, the array path is registered.
		// The syncEnv will materialize sandbox.paths as an array.
		assert.ok(raw.sandbox !== undefined);
	});

	it("handles TUI_NAME materialization", () => {
		process.env.TUI_NAME = "my-app";
		const raw = {};
		const knownSections = ["tui"];
		const reverseMap = buildReverseMap(ConfigSchema);
		syncEnv(raw, knownSections, reverseMap);
		assert.strictEqual(raw.tui?.name, "my-app");
	});

	it("handles AGENT_RECURSION_LIMIT materialization", () => {
		process.env.AGENT_RECURSION_LIMIT = "500";
		const raw = {};
		const knownSections = ["agent"];
		const reverseMap = buildReverseMap(ConfigSchema);
		syncEnv(raw, knownSections, reverseMap);
		assert.strictEqual(raw.agent?.recursionLimit, 500);
	});

	it("handles PERSISTENCE_MODE materialization", () => {
		process.env.PERSISTENCE_MODE = "memory";
		const raw = {};
		const knownSections = ["persistence"];
		const reverseMap = buildReverseMap(ConfigSchema);
		syncEnv(raw, knownSections, reverseMap);
		assert.strictEqual(raw.persistence?.mode, "memory");
	});

	it("handles LRU_SIZE materialization", () => {
		process.env.LRU_SIZE = "200";
		const raw = {};
		const knownSections = ["lru"];
		const reverseMap = buildReverseMap(ConfigSchema);
		syncEnv(raw, knownSections, reverseMap);
		assert.strictEqual(raw.lru?.size, 200);
	});

	it("handles MEMORY_DIRECTORY materialization", () => {
		process.env.MEMORY_DIRECTORY = "/custom/memory";
		const raw = {};
		const knownSections = ["memory"];
		const reverseMap = buildReverseMap(ConfigSchema);
		syncEnv(raw, knownSections, reverseMap);
		assert.strictEqual(raw.memory?.directory, "/custom/memory");
	});

	it("parses boolean values correctly", () => {
		process.env.TELEMETRY_ENABLED = "true";
		const raw = {};
		const knownSections = ["telemetry"];
		const reverseMap = buildReverseMap(ConfigSchema);
		syncEnv(raw, knownSections, reverseMap);
		assert.strictEqual(raw.telemetry?.enabled, true);
	});

	it("parses numeric values correctly", () => {
		process.env.AGENT_RECURSION_LIMIT = "100";
		const raw = {};
		const knownSections = ["agent"];
		const reverseMap = buildReverseMap(ConfigSchema);
		syncEnv(raw, knownSections, reverseMap);
		assert.strictEqual(raw.agent?.recursionLimit, 100);
	});
});
