import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert";

describe("getConfig tool", () => {
	it("returns a structured object with ok: true and the config object when loadConfig succeeds", async () => {
		const { getConfig } = await import("../../../src/tools/config/index.js");
		// Invoke the tool with empty input
		const result = await getConfig.invoke({});
		// The result should be a native structured object, not a string
		assert.strictEqual(result.ok, true);
		assert.ok(typeof result.config === "object" && result.config !== null);
		// The config should have expected top-level keys from config.yaml
		assert.ok(result.config.agent !== undefined);
		assert.ok(result.config.providers !== undefined);
	});

	it("returns the parsed config object directly (not a stringified copy)", async () => {
		const { getConfig } = await import("../../../src/tools/config/index.js");
		const result = await getConfig.invoke({});
		assert.strictEqual(result.ok, true);
		// The config must be a native object, not a JSON string
		assert.ok(typeof result.config === "object" && result.config !== null);
		assert.ok(!(typeof result.config === "string"));
	});

	it("returns { ok: false, error } when loadConfig throws", async () => {
		// Force loadConfig to throw by setting an out-of-range env var that
		// fails schema validation. Reset the config cache so it re-reads.
		const loader = await import("../../../src/config/loader.js");
		loader._resetConfigCache();
		process.env.SUB_AGENTS_TEMPERATURE_CODING = "5";
		try {
			const { getConfig } = await import("../../../src/tools/config/index.js");
			const result = await getConfig.invoke({});
			assert.strictEqual(result.ok, false);
			assert.ok(typeof result.error === "string" && result.error.length > 0);
		} finally {
			delete process.env.SUB_AGENTS_TEMPERATURE_CODING;
			loader._resetConfigCache();
		}
	});

	it("rejects extraneous input via schema validation", async () => {
		const { getConfig } = await import("../../../src/tools/config/index.js");
		// The schema is z.object({}).strict(), so extra keys should throw
		await assert.rejects(
			async () => getConfig.invoke({ unexpectedKey: "value" }),
			/Unrecognized key|unexpected|Unexpected/i,
		);
	});

	it("accepts empty object input", async () => {
		const { getConfig } = await import("../../../src/tools/config/index.js");
		const result = await getConfig.invoke({});
		assert.strictEqual(result.ok, true);
		assert.ok(typeof result.config === "object");
	});

	it("has correct tool metadata", async () => {
		const { getConfig } = await import("../../../src/tools/config/index.js");
		assert.strictEqual(getConfig.name, "getConfig");
		assert.ok(typeof getConfig.description === "string");
		assert.ok(getConfig.description.length > 0);
	});
});

describe("getConfig tool - secret masking", () => {
	let loader;
	let mod;

	beforeEach(async () => {
		loader = await import("../../../src/config/loader.js");
		mod = await import("../../../src/tools/config/index.js");
		loader._resetConfigCache();
		mod._resetGetConfigCache();
	});

	afterEach(() => {
		delete process.env.OPENAI_API_KEY;
		delete process.env.FAL_API_KEY;
		loader._resetConfigCache();
		mod._resetGetConfigCache();
	});

	it("masks resolved apiKey values in the config output", async () => {
		process.env.OPENAI_API_KEY = "sk-test-secret-123";
		process.env.FAL_API_KEY = "fal-secret-456";
		const result = await mod.getConfig.invoke({});
		assert.strictEqual(result.ok, true);
		assert.strictEqual(result.config.providers.openai.credentials.apiKey, "***");
		assert.strictEqual(result.config.providers.fal.credentials.apiKey, "***");
	});

	it("preserves empty-string credentials (not configured)", async () => {
		const result = await mod.getConfig.invoke({});
		// bing apiKey is empty in config.yaml and not set via env
		assert.strictEqual(result.config.search.bing.apiKey, "");
	});

	it("does not mutate the source config object", async () => {
		process.env.OPENAI_API_KEY = "sk-test-secret-123";
		const config = loader.loadConfig();
		const before = config.providers.openai.credentials.apiKey;
		await mod.getConfig.invoke({});
		assert.strictEqual(config.providers.openai.credentials.apiKey, before);
	});

	it("caches the masked result and reuses it across calls", async () => {
		const r1 = await mod.getConfig.invoke({});
		const r2 = await mod.getConfig.invoke({});
		assert.strictEqual(r1.config, r2.config);
	});

	it("recomputes after cache reset", async () => {
		const r1 = await mod.getConfig.invoke({});
		mod._resetGetConfigCache();
		const r2 = await mod.getConfig.invoke({});
		assert.notStrictEqual(r1.config, r2.config);
	});
});
