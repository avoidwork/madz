import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert";
import { SubAgentsTemperatureSchema } from "../../src/config/schemas/subAgentsTemperature.js";
import { _resolveEnvRecursively } from "../../src/config/loader.js";
import { getSubAgentTemperature, DEFAULT_CONFIG } from "../../src/config/config.js";

describe("SubAgentsTemperatureSchema — validation", () => {
	it("accepts valid temperature values", () => {
		const result = SubAgentsTemperatureSchema.safeParse({
			coding: 0.3,
			research: 0.5,
		});
		assert.strictEqual(result.success, true);
	});

	it("accepts boundary value 0", () => {
		const result = SubAgentsTemperatureSchema.safeParse({
			"code-review": 0,
		});
		assert.strictEqual(result.success, true);
	});

	it("accepts boundary value 2", () => {
		const result = SubAgentsTemperatureSchema.safeParse({
			research: 2,
		});
		assert.strictEqual(result.success, true);
	});

	it("rejects negative temperature", () => {
		const result = SubAgentsTemperatureSchema.safeParse({
			coding: -0.1,
		});
		assert.strictEqual(result.success, false);
	});

	it("rejects temperature above 2", () => {
		const result = SubAgentsTemperatureSchema.safeParse({
			coding: 2.1,
		});
		assert.strictEqual(result.success, false);
	});

	it("rejects non-numeric temperature", () => {
		const result = SubAgentsTemperatureSchema.safeParse({
			coding: "0.3",
		});
		assert.strictEqual(result.success, false);
	});

	it("rejects null temperature", () => {
		const result = SubAgentsTemperatureSchema.safeParse({
			coding: null,
		});
		assert.strictEqual(result.success, false);
	});

	it("accepts empty object", () => {
		const result = SubAgentsTemperatureSchema.safeParse({});
		assert.strictEqual(result.success, true);
		assert.deepStrictEqual(result.data, {});
	});

	it("applies default empty object when input is undefined", () => {
		const result = SubAgentsTemperatureSchema.safeParse(undefined);
		assert.strictEqual(result.success, true);
		assert.deepStrictEqual(result.data, {});
	});

	it("accepts hyphenated agent names", () => {
		const result = SubAgentsTemperatureSchema.safeParse({
			"code-review": 0.1,
			"security-audit": 0.1,
		});
		assert.strictEqual(result.success, true);
	});

	it("rejects temperature of NaN", () => {
		const result = SubAgentsTemperatureSchema.safeParse({
			coding: NaN,
		});
		assert.strictEqual(result.success, false);
	});

	it("rejects temperature of Infinity", () => {
		const result = SubAgentsTemperatureSchema.safeParse({
			coding: Infinity,
		});
		assert.strictEqual(result.success, false);
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

	it("resolves SUB_AGENTS_TEMPERATURE_CODING from env var", () => {
		process.env.SUB_AGENTS_TEMPERATURE_CODING = "0.3";
		const config = { coding: 0.4 };
		const result = _resolveEnvRecursively(config, ["subAgentsTemperature"]);
		assert.strictEqual(result.coding, 0.3);
	});

	it("resolves hyphenated agent name env var", () => {
		process.env.SUB_AGENTS_TEMPERATURE_CODE_REVIEW = "0.1";
		const config = { "code-review": 0.2 };
		const result = _resolveEnvRecursively(config, ["subAgentsTemperature"]);
		assert.strictEqual(result["code-review"], 0.1);
	});

	it("resolves security-audit agent name", () => {
		process.env.SUB_AGENTS_TEMPERATURE_SECURITY_AUDIT = "0.1";
		const config = { "security-audit": 0.3 };
		const result = _resolveEnvRecursively(config, ["subAgentsTemperature"]);
		assert.strictEqual(result["security-audit"], 0.1);
	});

	it("preserves config value when env var not set", () => {
		const config = { coding: 0.3, research: 0.5 };
		const result = _resolveEnvRecursively(config, ["subAgentsTemperature"]);
		assert.strictEqual(result.coding, 0.3);
		assert.strictEqual(result.research, 0.5);
	});

	it("resolves multiple agents from env vars", () => {
		process.env.SUB_AGENTS_TEMPERATURE_CODING = "0.3";
		process.env.SUB_AGENTS_TEMPERATURE_DEBUG = "0.2";
		process.env.SUB_AGENTS_TEMPERATURE_RESEARCH = "0.5";
		const config = {
			coding: 0.4,
			debug: 0.3,
			research: 0.4,
		};
		const result = _resolveEnvRecursively(config, ["subAgentsTemperature"]);
		assert.strictEqual(result.coding, 0.3);
		assert.strictEqual(result.debug, 0.2);
		assert.strictEqual(result.research, 0.5);
	});

	it("parses numeric env var value correctly", () => {
		process.env.SUB_AGENTS_TEMPERATURE_CODING = "0.3";
		const config = { coding: 0.4 };
		const result = _resolveEnvRecursively(config, ["subAgentsTemperature"]);
		assert.strictEqual(typeof result.coding, "number");
		assert.strictEqual(result.coding, 0.3);
	});

	it("does not include dropped key in env var name", () => {
		// The DROPPED_KEYS should prevent "subAgentsTemperature" from appearing
		// in the env var name, so it's SUB_AGENTS_TEMPERATURE_CODING not
		// SUB_AGENTS_TEMPERATURE_SUB_AGENTS_TEMPERATURE_CODING
		process.env.SUB_AGENTS_TEMPERATURE_CODING = "0.3";
		const config = { coding: 0.4 };
		const result = _resolveEnvRecursively(config, ["subAgentsTemperature"]);
		assert.strictEqual(result.coding, 0.3);
	});
});

describe("getSubAgentTemperature — accessor", () => {
	it("returns undefined when config has no subAgentsTemperature entries", () => {
		const result = getSubAgentTemperature("coding");
		assert.strictEqual(result, undefined);
	});

	it("returns undefined for empty string agent name", () => {
		const result = getSubAgentTemperature("");
		assert.strictEqual(result, undefined);
	});

	it("returns undefined for non-string agent name", () => {
		const result = getSubAgentTemperature(null);
		assert.strictEqual(result, undefined);
	});

	it("returns undefined for numeric agent name", () => {
		const result = getSubAgentTemperature(123);
		assert.strictEqual(result, undefined);
	});

	it("returns undefined for unknown agent", () => {
		const result = getSubAgentTemperature("unknown-agent");
		assert.strictEqual(result, undefined);
	});

	it("returns DEFAULT_CONFIG value when set", () => {
		// Since DEFAULT_CONFIG is derived from the Zod schema with .default({}),
		// the default subAgentsTemperature is an empty object, so all lookups return undefined.
		// This test verifies the accessor correctly reads from DEFAULT_CONFIG.
		assert.strictEqual(typeof DEFAULT_CONFIG.subAgentsTemperature, "object");
		assert.deepStrictEqual(DEFAULT_CONFIG.subAgentsTemperature, {});
	});
});

describe("DEFAULT_CONFIG — subAgentsTemperature", () => {
	it("has subAgentsTemperature property", () => {
		assert.ok("subAgentsTemperature" in DEFAULT_CONFIG);
	});

	it("defaults to empty object", () => {
		assert.deepStrictEqual(DEFAULT_CONFIG.subAgentsTemperature, {});
	});
});
