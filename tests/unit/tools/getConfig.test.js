import { describe, it } from "node:test";
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
