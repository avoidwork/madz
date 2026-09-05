import { describe, it, beforeEach, afterEach } from "node:test";
import { strictEqual, throws } from "node:assert";
import { ConfigSchema } from "../../../src/config/config.js";
import { _resolveEnvRecursively } from "../../../src/config/loader.js";

function makeBase() {
	return {
		providers: {},
		email: { provider: { type: "gmail" } },
		calendar: {},
		sandbox: {
			paths: ["./", "!node_modules/", "/tmp"],
			timeout: { seconds: 30, gracePeriod: 5 },
			memoryLimit: "512m",
			safety: { urlFilter: true, pythonImportHook: true },
			env: { allowlist: ["PATH", "HOME", "NODE_ENV"] },
			permissions: [],
			maxReadSize: "1mb",
			skillScanPaths: [".skills/", "skills/"],
			trustProjectSkills: true,
		},
		search: {},
		memory: {
			directory: "memory/",
			contextDir: "memory/context/",
			toolsDir: "memory/tools/",
			errorsDir: "memory/errors/",
			schedulesDir: "memory/schedules/",
		},
		telemetry: {
			enabled: false,
			exporter: { protocol: "console", endpoint: "http://localhost:4318", batch: { maxSize: 512, scheduledDelay: 5000 } },
			sampling: { ratio: 0.1 },
			redact: { paths: ["credentials.apiKey"] },
		},
		schedules: { maxConcurrent: 1, entries: [] },
		tui: { name: "madz" },
		agent: {},
		lru: {},
		persistence: { mode: "memory", sqlite_path: "memory/checkpoints.db" },
		cwd: "",
	};
}

describe("SkillAgentMap config", () => {
	const defaults = ConfigSchema.parse({});

	it("should have default skillAgentMap entries", () => {
		strictEqual(defaults.skillAgentMap.length, 0);
	});

	it("should validate valid skillAgentMap config", () => {
		const config = ConfigSchema.parse({
			...makeBase(),
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
				...makeBase(),
				skillAgentMap: [{ pattern: 123, agent: "coding" }],
			});
		});
	});

	it("should reject missing agent field", () => {
		throws(() => {
			ConfigSchema.parse({
				...makeBase(),
				skillAgentMap: [{ pattern: "^test-" }],
			});
		});
	});

	it("should accept empty array", () => {
		const config = ConfigSchema.parse({
			...makeBase(),
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
			...makeBase(),
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
			...makeBase(),
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
			...makeBase(),
			skillAgentMap: [{ pattern: "^test-", agent: "coding" }],
		};
		const resolved = _resolveEnvRecursively(rawConfig, []);
		const config = ConfigSchema.parse(resolved);
		strictEqual(config.skillAgentMap[0].pattern, "^test-");
		strictEqual(config.skillAgentMap[0].agent, "coding");
	});

	it("resolves nested skillAgentMap entries", () => {
		process.env.SKILL_AGENT_MAP_0_PATTERN = "nested-pattern";
		process.env.SKILL_AGENT_MAP_0_AGENT = "nested-agent";
		const rawConfig = {
			...makeBase(),
			skillAgentMap: [
				{ pattern: "^openspec-", agent: "coding" },
			],
		};
		const resolved = _resolveEnvRecursively(rawConfig, []);
		const config = ConfigSchema.parse(resolved);
		strictEqual(config.skillAgentMap[0].pattern, "nested-pattern");
		strictEqual(config.skillAgentMap[0].agent, "nested-agent");
	});
});
