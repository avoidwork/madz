import { describe, it } from "node:test";
import { strictEqual, throws } from "node:assert";
import { ConfigSchema, DEFAULT_CONFIG } from "../../../src/config/config.js";

describe("SkillAgentMap config", () => {
	it("should have default skillAgentMap entries", () => {
		strictEqual(DEFAULT_CONFIG.skillAgentMap.length, 3);
		strictEqual(DEFAULT_CONFIG.skillAgentMap[0].pattern, "^openspec-");
		strictEqual(DEFAULT_CONFIG.skillAgentMap[0].agent, "coding");
		strictEqual(DEFAULT_CONFIG.skillAgentMap[1].pattern, "^audit-");
		strictEqual(DEFAULT_CONFIG.skillAgentMap[1].agent, "security-audit");
		strictEqual(DEFAULT_CONFIG.skillAgentMap[2].pattern, ".*");
		strictEqual(DEFAULT_CONFIG.skillAgentMap[2].agent, "general-purpose");
	});

	it("should validate valid skillAgentMap config", () => {
		const config = ConfigSchema.parse({
			...DEFAULT_CONFIG,
			skillAgentMap: [
				{ pattern: "^test-", agent: "coding" },
				{ pattern: ".*", agent: "general-purpose" },
			],
		});
		strictEqual(config.skillAgentMap.length, 2);
	});

	it("should reject invalid pattern type", () => {
		throws(() => {
			ConfigSchema.parse({
				...DEFAULT_CONFIG,
				skillAgentMap: [{ pattern: 123, agent: "coding" }],
			});
		});
	});

	it("should reject missing agent field", () => {
		throws(() => {
			ConfigSchema.parse({
				...DEFAULT_CONFIG,
				skillAgentMap: [{ pattern: "^test-" }],
			});
		});
	});

	it("should accept empty array", () => {
		const config = ConfigSchema.parse({
			...DEFAULT_CONFIG,
			skillAgentMap: [],
		});
		strictEqual(config.skillAgentMap.length, 0);
	});
});
