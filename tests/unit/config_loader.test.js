import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert";
import {
	_resolveEnvRecursively,
	applyDotPath,
	buildReverseMap,
	syncEnv,
} from "../../src/config/loader.js";
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

	it("resolves all Persistence env vars", () => {
		process.env.PERSISTENCE_MODE = "sqlite";
		process.env.PERSISTENCE_SQLITE_PATH = "/data/madz.db";
		const config = {
			persistence: { mode: "memory", sqlite_path: "memory/checkpoints.db" },
		};
		const result = _resolveEnvRecursively(config, []);
		assert.strictEqual(result.persistence.mode, "sqlite");
		assert.strictEqual(result.persistence.sqlite_path, "/data/madz.db");
	});
});

describe("_resolveEnvRecursively — SubAgent temperature config", () => {
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

	it("preserves subAgent temperature from config", () => {
		const config = { process: { subAgent: { temperature: 0.5 } } };
		const result = _resolveEnvRecursively(config, []);
		assert.strictEqual(result.process.subAgent.temperature, 0.5);
	});

	it("preserves subAgent temperature when set in config", () => {
		const config = { process: { subAgent: { temperature: 0.7 } } };
		const result = _resolveEnvRecursively(config, []);
		assert.strictEqual(result.process.subAgent.temperature, 0.7);
	});

	it("preserves all subAgent config fields", () => {
		const config = {
			process: {
				subAgent: {
					timeout: 300000,
					maxConcurrent: 2,
					sessionMode: "shared",
					defaultStrategy: "sequential",
					defaultOnError: "fail-fast",
					temperature: 0.9,
				},
			},
		};
		const result = _resolveEnvRecursively(config, []);
		assert.strictEqual(result.process.subAgent.timeout, 300000);
		assert.strictEqual(result.process.subAgent.maxConcurrent, 2);
		assert.strictEqual(result.process.subAgent.sessionMode, "shared");
		assert.strictEqual(result.process.subAgent.defaultStrategy, "sequential");
		assert.strictEqual(result.process.subAgent.defaultOnError, "fail-fast");
		assert.strictEqual(result.process.subAgent.temperature, 0.9);
	});
});

describe("applyDotPath", () => {
	it("creates intermediate objects for simple path", () => {
		const obj = {};
		applyDotPath(obj, "a.b.c", "value");
		assert.strictEqual(obj.a.b.c, "value");
	});

	it("creates arrays for numeric segments", () => {
		const obj = {};
		applyDotPath(obj, "arr.0", "first");
		assert.deepStrictEqual(obj.arr, ["first"]);
	});

	it("fills array gaps with null", () => {
		const obj = {};
		applyDotPath(obj, "arr.2", "third");
		assert.deepStrictEqual(obj.arr, [null, null, "third"]);
	});

	it("creates nested objects inside arrays", () => {
		const obj = {};
		applyDotPath(obj, "items.0.name", "alpha");
		assert.strictEqual(obj.items[0].name, "alpha");
	});

	it("is idempotent — does not override existing values", () => {
		const obj = { a: { b: "existing" } };
		const result = applyDotPath(obj, "a.b", "new");
		assert.strictEqual(result, false);
		assert.strictEqual(obj.a.b, "existing");
	});

	it("returns true when value was set (path was missing)", () => {
		const obj = {};
		const result = applyDotPath(obj, "x", "new");
		assert.strictEqual(result, true);
		assert.strictEqual(obj.x, "new");
	});

	it("handles mixed object/array paths", () => {
		const obj = {};
		applyDotPath(obj, "projects.myProject.include.0", "src/**/*.js");
		assert.strictEqual(obj.projects.myProject.include[0], "src/**/*.js");
	});

	it("returns false for non-array numeric index", () => {
		const obj = { a: "string" };
		const result = applyDotPath(obj, "a.0", "value");
		assert.strictEqual(result, false);
	});
});

describe("buildReverseMap", () => {
	it("returns a Map", () => {
		const map = buildReverseMap(ConfigSchema);
		assert.ok(map instanceof Map);
	});

	it("contains sandbox paths with timeout dropped", () => {
		const map = buildReverseMap(ConfigSchema);
		assert.ok(map.has("SANDBOX_SECONDS"), "Should have SANDBOX_SECONDS");
		assert.strictEqual(map.get("SANDBOX_SECONDS"), "sandbox.timeout.seconds");
	});

	it("contains vector config paths", () => {
		const map = buildReverseMap(ConfigSchema);
		// vector.projects is a record, so we should have paths from VectorProjectSchema
		assert.ok(map.has("VECTOR_MODEL"), "Should have VECTOR_MODEL");
		assert.ok(map.has("VECTOR_SEARCH_MODE"), "Should have VECTOR_SEARCH_MODE");
	});

	it("contains memory paths", () => {
		const map = buildReverseMap(ConfigSchema);
		assert.ok(map.has("MEMORY_DIRECTORY"), "Should have MEMORY_DIRECTORY");
	});

	it("contains telemetry paths", () => {
		const map = buildReverseMap(ConfigSchema);
		assert.ok(map.has("TELEMETRY_ENABLED"), "Should have TELEMETRY_ENABLED");
	});

	it("contains tui paths", () => {
		const map = buildReverseMap(ConfigSchema);
		assert.ok(map.has("TUI_NAME"), "Should have TUI_NAME");
	});

	it("contains email paths", () => {
		const map = buildReverseMap(ConfigSchema);
		assert.ok(map.has("EMAIL_DEFAULT_FOLDER"), "Should have EMAIL_DEFAULT_FOLDER");
	});

	it("contains cwd (runtime-only, but schema has it)", () => {
		const map = buildReverseMap(ConfigSchema);
		// cwd is a plain z.string() in the schema, so it appears in the map.
		// syncEnv() filters it out via KNOWN_SECTIONS prefix allowlist.
		assert.ok(map.has("CWD"), "Should have CWD since it's in the schema");
	});
});

describe("syncEnv", () => {
	let savedEnv;

	beforeEach(() => {
		savedEnv = { ...process.env };
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
		Object.assign(process.env, savedEnv);
	});

	it("materializes a simple config value from env var", () => {
		process.env.TUI_NAME = "test-tui";
		const raw = {};
		syncEnv(raw, ["tui"]);
		assert.strictEqual(raw.tui.name, "test-tui");
	});

	it("materializes nested structure with DROPPED_KEYS", () => {
		// SANDBOX_SECONDS maps to sandbox.timeout.seconds — "timeout" is a DROPPED_KEY
		process.env.SANDBOX_SECONDS = "120";
		const raw = {};
		syncEnv(raw, ["sandbox"]);
		assert.strictEqual(raw.sandbox.timeout.seconds, 120);
	});

	it("materializes sandbox timeout path", () => {
		process.env.SANDBOX_SECONDS = "120";
		const raw = {};
		syncEnv(raw, ["sandbox"]);
		assert.strictEqual(raw.sandbox.timeout.seconds, 120);
	});

	it("is idempotent — does not override existing YAML keys", () => {
		process.env.TUI_NAME = "env-name";
		const raw = { tui: { name: "yaml-name" } };
		syncEnv(raw, ["tui"]);
		assert.strictEqual(raw.tui.name, "yaml-name");
	});

	it("ignores env vars with unknown prefixes", () => {
		process.env.PATH = "/usr/bin";
		process.env.HOME = "/root";
		const raw = {};
		syncEnv(raw, ["tui"]);
		// Should not have created anything from PATH or HOME
		assert.deepStrictEqual(raw, {});
	});

	it("materializes array values from env vars", () => {
		process.env.VECTOR_FULLTEXT = "true";
		const raw = {};
		syncEnv(raw, ["vector"]);
		assert.strictEqual(raw.vector.fulltext, true);
	});

	it("handles boolean env var values", () => {
		process.env.TELEMETRY_ENABLED = "false";
		const raw = {};
		syncEnv(raw, ["telemetry"]);
		assert.strictEqual(raw.telemetry.enabled, false);
	});

	it("handles numeric env var values", () => {
		process.env.SANDBOX_SECONDS = "300";
		const raw = {};
		syncEnv(raw, ["sandbox"]);
		assert.strictEqual(raw.sandbox.timeout.seconds, 300);
	});

	it("handles multiple env vars together", () => {
		process.env.TUI_NAME = "multi-tui";
		process.env.TELEMETRY_ENABLED = "true";
		process.env.MEMORY_DIRECTORY = "/custom/memory/";
		const raw = {};
		syncEnv(raw, ["tui", "telemetry", "memory"]);
		assert.strictEqual(raw.tui.name, "multi-tui");
		assert.strictEqual(raw.telemetry.enabled, true);
		assert.strictEqual(raw.memory.directory, "/custom/memory/");
	});

	it("returns the raw object (same reference)", () => {
		process.env.TUI_NAME = "ref-test";
		const raw = {};
		const result = syncEnv(raw, ["tui"]);
		assert.strictEqual(result, raw);
	});
});
