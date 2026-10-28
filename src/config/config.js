import { z } from "zod";
import {
	ProvidersSchema,
	SearchConfigSchema,
	EmailConfigSchema,
	CalendarConfigSchema,
	AzureProviderConfigSchema,
} from "./schemas/providers.js";
import { SandboxScopeSchema } from "./schemas/sandbox.js";
import { MemorySchema } from "./schemas/memory.js";
import { TelemetrySchema } from "./schemas/telemetry.js";
import { SchedulesSchema } from "./schemas/schedules.js";
import { TuiSchema } from "./schemas/tui.js";
import { AgentSchema } from "./schemas/agent.js";
import { PersistenceSchema } from "./schemas/persistence.js";
import { SkillAgentMapSchema } from "./schemas/skillAgentMap.js";
import { SubAgentsTemperatureSchema } from "./schemas/subAgentsTemperature.js";
import { SummarizationSchema } from "./schemas/summarization.js";
import { VectorConfigSchema } from "./schemas/vector.js";
import { ImageSchema } from "./schemas/image.js";
import { McpSchema } from "./schemas/mcp.js";

// Re-export individual schemas for backward compatibility
export {
	ProvidersSchema,
	SearchConfigSchema,
	EmailConfigSchema,
	SandboxScopeSchema,
	MemorySchema,
	TelemetrySchema,
	SchedulesSchema,
	TuiSchema,
	AgentSchema,
	PersistenceSchema,
	SkillAgentMapSchema,
	VectorConfigSchema,
	McpSchema,
	AzureProviderConfigSchema,
};

// --- Root config ---

export const ConfigSchema = z.object({
	providers: ProvidersSchema.default({}),
	email: EmailConfigSchema.default({
		provider: { type: "gmail" },
	}),
	calendar: CalendarConfigSchema.default({}),
	sandbox: SandboxScopeSchema.default({}),
	search: SearchConfigSchema.default({}),
	memory: MemorySchema.default({}),
	telemetry: TelemetrySchema.default({
		enabled: false,
		exporter: {
			protocol: "console",
			endpoint: "http://localhost:4318",
		},
		sampling: { ratio: 0.1 },
	}),
	schedules: SchedulesSchema.default({}),
	tui: TuiSchema.default({}),
	agent: AgentSchema.default({}),
	persistence: PersistenceSchema.default({}),
	skillAgentMap: SkillAgentMapSchema,
	cwd: z.string().default(""),
	subAgentsTemperature: SubAgentsTemperatureSchema,
	summarization: SummarizationSchema.default({}),
	vector: VectorConfigSchema.default({}),
	image: ImageSchema.default({}),
	mcp: McpSchema,
});

// Derive defaults from Zod schema — config.yaml is the source of truth,
// this is only used as a validation scaffold for merging.
export const DEFAULT_CONFIG = ConfigSchema.parse({});

/**
 * Get the temperature for a specific sub-agent.
 * @param {string} agentName - The agent name (e.g., "coding", "code-review")
 * @returns {number | undefined} The temperature value, or undefined if not configured
 */
export function getSubAgentTemperature(agentName) {
	if (!agentName || typeof agentName !== "string") {
		return undefined;
	}
	// Read from the module-level resolved config set by loader.js,
	// falling back to DEFAULT_CONFIG if not yet loaded.
	const resolved = getResolvedConfig?.() ?? DEFAULT_CONFIG;
	return resolved.subAgentsTemperature?.[agentName];
}

// Module-level reference to the resolved config, set by loader.js after loadConfig()
let resolvedConfig = null;

/**
 * Normalize the sandbox allowlist so it is robust regardless of the process
 * working directory. Replaces relative `"./"` entries (which resolve against
 * `process.cwd()` and can drift) with the absolute `config.cwd`, so every
 * consumer — path validation, tool allowlists, subagent scopes — sees the
 * project root explicitly.
 * @param {Object} config - The resolved config object (mutated in place)
 */
function normalizeSandboxPaths(config) {
	const sandbox = config?.sandbox;
	const paths = sandbox?.paths;
	const cwd = config?.cwd;
	if (!Array.isArray(paths) || !cwd) return;

	// Drop relative "." / "./" entries; they resolve against process.cwd().
	const filtered = paths.filter((p) => p !== "." && p !== "./");
	// Append the absolute cwd if it isn't already present.
	if (!filtered.includes(cwd)) {
		filtered.push(cwd);
	}
	sandbox.paths = filtered;
}

/**
 * @internal - Called by loader.js to set the resolved config reference
 * @param {Object} config - The resolved config object
 */
export function _setResolvedConfig(config) {
	normalizeSandboxPaths(config);
	resolvedConfig = config;
}

/**
 * @internal - Get the current resolved config
 */
function getResolvedConfig() {
	return resolvedConfig;
}
