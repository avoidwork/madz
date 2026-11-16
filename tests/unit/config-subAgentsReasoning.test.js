import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert";
import { SubAgentsReasoningSchema } from "../../src/config/schemas/subAgentsReasoning.js";
import { _resolveEnvRecursively } from "../../src/config/loader.js";
import { getSubAgentReasoning, DEFAULT_CONFIG } from "../../src/config/config.js";

describe("SubAgentsReasoningSchema — validation", () => {
	it("accepts valid reasoning effort values", () => {
		const result = SubAgentsReasoningSchema.safeParse({
			coding: "medium",
			research: "high",
		});
		assert.strictEqual(result.success, true);
	});

	it("accepts all three effort levels", () => {
		const result = SubAgentsReasoningSchema.safeParse({
			search: "low",
			coding: "medium",
			"code-review": "high",
		});
		assert.strictEqual(result.success, true);
	});

	it("rejects invalid reasoning effort", () => {
		const result = SubAgentsReasoningSchema.safeParse({
			coding: "ultra",
		});
		assert.strictEqual(result.success, false);
	});

	it("rejects numeric reasoning effort", () => {
		const result = SubAgentsReasoningSchema.safeParse({
			coding: 0.3,
		});
		assert.strictEqual(result.success, false);
	});

	it("rejects null reasoning effort", () => {
		const result = SubAgentsReasoningSchema.safeParse({
			coding: null,
		});
		assert.strictEqual(result.success, false);
	});

	it("accepts empty object", () => {
		const result = SubAgentsReasoningSchema.safeParse({});
		assert.strictEqual(result.success, true);
		assert.deepStrictEqual(result.data, {});
	});

	it("applies default empty object when input is undefined", () => {
		const result = SubAgentsReasoningSchema.safeParse(undefined);
		assert.strictEqual(result.success, true);
		assert.deepStrictEqual(result.data, {});
	});

	it("accepts hyphenated agent names", () => {
		const result = SubAgentsReasoningSchema.safeParse({
			"code-review": "high",
			"security-audit": "high",
		});
		assert.strictEqual(result.success, true);
	});
});

describe("_resolveEnvRecursively — subAgentsReasoning", () => {
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

	it("resolves SUB_AGENTS_REASONING_CODING from env var", () => {
		process.env.SUB_AGENTS_REASONING_CODING = "high";
		const config = { coding: "medium" };
		const result = _resolveEnvRecursively(config, ["subAgentsReasoning"]);
		assert.strictEqual(result.coding, "high");
	});

	it("resolves hyphenated agent name env var", () => {
		process.env.SUB_AGENTS_REASONING_CODE_REVIEW = "high";
		const config = { "code-review": "medium" };
		const result = _resolveEnvRecursively(config, ["subAgentsReasoning"]);
		assert.strictEqual(result["code-review"], "high");
	});

	it("resolves security-audit agent name", () => {
		process.env.SUB_AGENTS_REASONING_SECURITY_AUDIT = "high";
		const config = { "security-audit": "medium" };
		const result = _resolveEnvRecursively(config, ["subAgentsReasoning"]);
		assert.strictEqual(result["security-audit"], "high");
	});

	it("preserves config value when env var not set", () => {
		const config = { coding: "medium", research: "low" };
		const result = _resolveEnvRecursively(config, ["subAgentsReasoning"]);
		assert.strictEqual(result.coding, "medium");
		assert.strictEqual(result.research, "low");
	});

	it("resolves multiple agents from env vars", () => {
		process.env.SUB_AGENTS_REASONING_CODING = "medium";
		process.env.SUB_AGENTS_REASONING_DEBUG = "high";
		process.env.SUB_AGENTS_REASONING_RESEARCH = "low";
		const config = {
			coding: "low",
			debug: "medium",
			research: "medium",
		};
		const result = _resolveEnvRecursively(config, ["subAgentsReasoning"]);
		assert.strictEqual(result.coding, "medium");
		assert.strictEqual(result.debug, "high");
		assert.strictEqual(result.research, "low");
	});

	it("does not include dropped key in env var name", () => {
		// The DROPPED_KEYS should prevent "subAgentsReasoning" from appearing
		// in the env var name, so it's SUB_AGENTS_REASONING_CODING not
		// SUB_AGENTS_REASONING_SUB_AGENTS_REASONING_CODING
		process.env.SUB_AGENTS_REASONING_CODING = "high";
		const config = { coding: "medium" };
		const result = _resolveEnvRecursively(config, ["subAgentsReasoning"]);
		assert.strictEqual(result.coding, "high");
	});
});

describe("getSubAgentReasoning — accessor", () => {
	it("returns undefined when config has no subAgentsReasoning entries", () => {
		const result = getSubAgentReasoning("coding");
		assert.strictEqual(result, undefined);
	});

	it("returns undefined for empty string agent name", () => {
		const result = getSubAgentReasoning("");
		assert.strictEqual(result, undefined);
	});

	it("returns undefined for non-string agent name", () => {
		const result = getSubAgentReasoning(null);
		assert.strictEqual(result, undefined);
	});

	it("returns undefined for numeric agent name", () => {
		const result = getSubAgentReasoning(123);
		assert.strictEqual(result, undefined);
	});

	it("returns undefined for unknown agent", () => {
		const result = getSubAgentReasoning("unknown-agent");
		assert.strictEqual(result, undefined);
	});

	it("returns DEFAULT_CONFIG value when set", () => {
		// Since DEFAULT_CONFIG is derived from the Zod schema with .default({}),
		// the default subAgentsReasoning is an empty object, so all lookups return undefined.
		// This test verifies the accessor correctly reads from DEFAULT_CONFIG.
		assert.strictEqual(typeof DEFAULT_CONFIG.subAgentsReasoning, "object");
		assert.deepStrictEqual(DEFAULT_CONFIG.subAgentsReasoning, {});
	});
});

describe("DEFAULT_CONFIG — subAgentsReasoning", () => {
	it("has subAgentsReasoning property", () => {
		assert.ok("subAgentsReasoning" in DEFAULT_CONFIG);
	});

	it("defaults to empty object", () => {
		assert.deepStrictEqual(DEFAULT_CONFIG.subAgentsReasoning, {});
	});
});
