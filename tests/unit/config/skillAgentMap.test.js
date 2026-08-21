import { describe, it, beforeEach, afterEach } from "node:test";
import { strictEqual, throws } from "node:assert";
import { ConfigSchema, DEFAULT_CONFIG } from "../../../src/config/config.js";
import { _resolveEnvRecursively } from "../../../src/config/loader.js";

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

describe("SkillAgentMap env var resolution", () => {
	let savedEnv;

	beforeEach(() => {
		savedEnv = { ...process.env };
	});

	afterEach(() => {
		process.env = savedEnv;
	});

	it("resolves SKILL_AGENT_MAP_0_PATTERN from env", () => {
		process.env.SKILL_AGENT_MAP_0_PATTERN = "env-pattern";
		process.env.SKILL_AGENT_MAP_0_AGENT = "env-agent";
		const rawConfig = {
			...DEFAULT_CONFIG,
			skillAgentMap: [{ pattern: "^openspec-", agent: "coding" }],
		};
		const resolved = _resolveEnvRecursively(rawConfig, []);
		const config = ConfigSchema.parse(resolved);
		strictEqual(config.skillAgentMap[0].pattern, "env-pattern");
		strictEqual(config.skillAgentMap[0].agent, "env-agent");
	});

	it("resolves SKILL_AGENT_MAP_1_PATTERN from env", () => {
		process.env.SKILL_AGENT_MAP_1_PATTERN = "audit-env";
		process.env.SKILL_AGENT_MAP_1_AGENT = "security-audit-env";
		const rawConfig = {
			...DEFAULT_CONFIG,
			skillAgentMap: [
				{ pattern: "^openspec-", agent: "coding" },
				{ pattern: "^audit-", agent: "security-audit" },
			],
		};
		const resolved = _resolveEnvRecursively(rawConfig, []);
		const config = ConfigSchema.parse(resolved);
		strictEqual(config.skillAgentMap[1].pattern, "audit-env");
		strictEqual(config.skillAgentMap[1].agent, "security-audit-env");
	});

	it("leaves config value when env var is not set", () => {
		delete process.env.SKILL_AGENT_MAP_0_PATTERN;
		const rawConfig = {
			...DEFAULT_CONFIG,
			skillAgentMap: [{ pattern: "^test-", agent: "coding" }],
		};
		const resolved = _resolveEnvRecursively(rawConfig, []);
		const config = ConfigSchema.parse(resolved);
		strictEqual(config.skillAgentMap[0].pattern, "^test-");
	});

	it("resolves nested skillAgentMap entries", () => {
		process.env.SKILL_AGENT_MAP_0_PATTERN = "first";
		process.env.SKILL_AGENT_MAP_1_PATTERN = "second";
		process.env.SKILL_AGENT_MAP_2_PATTERN = "third";
		const rawConfig = {
			...DEFAULT_CONFIG,
			skillAgentMap: [
				{ pattern: "a", agent: "x" },
				{ pattern: "b", agent: "y" },
				{ pattern: "c", agent: "z" },
			],
		};
		const resolved = _resolveEnvRecursively(rawConfig, []);
		const config = ConfigSchema.parse(resolved);
		strictEqual(config.skillAgentMap[0].pattern, "first");
		strictEqual(config.skillAgentMap[1].pattern, "second");
		strictEqual(config.skillAgentMap[2].pattern, "third");
	});
});
