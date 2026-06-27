import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert";
import { _resolveEnvRecursively } from "../../src/config/loader.js";

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
		process.env.TUI_CURSOR_CHAR = "▮";
		const config = {
			tui: { name: "madz", cursorChar: "█" },
		};
		const result = _resolveEnvRecursively(config, []);
		assert.strictEqual(result.tui.name, "radz");
		assert.strictEqual(result.tui.cursorChar, "▮");
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
