import { z } from "zod";
import {
	ProvidersSchema,
	SearchConfigSchema,
	EmailConfigSchema,
	CalendarConfigSchema,
} from "./schemas/providers.js";
import { SandboxScopeSchema } from "./schemas/sandbox.js";
import { MemorySchema } from "./schemas/memory.js";
import { TelemetrySchema } from "./schemas/telemetry.js";
import { SchedulesSchema } from "./schemas/schedules.js";
import { TuiSchema } from "./schemas/tui.js";
import { AgentSchema } from "./schemas/agent.js";
import { LruSchema } from "./schemas/lru.js";
import { PersistenceSchema } from "./schemas/persistence.js";
import { SkillAgentMapSchema } from "./schemas/skillAgentMap.js";
import { SubAgentsTemperatureSchema } from "./schemas/subAgentsTemperature.js";

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
	LruSchema,
	PersistenceSchema,
	SkillAgentMapSchema,
};

// --- Root config ---

export const ConfigSchema = z.object({
	providers: ProvidersSchema.default({}),
	email: EmailConfigSchema.default({}),
	calendar: CalendarConfigSchema.default({}),
	sandbox: SandboxScopeSchema.default({}),
	search: SearchConfigSchema.default({}),
	memory: MemorySchema.default({}),
	telemetry: TelemetrySchema.default({}),
	schedules: SchedulesSchema.default({}),
	tui: TuiSchema.default({}),
	agent: AgentSchema.default({}),
	lru: LruSchema.default({}),
	persistence: PersistenceSchema.default({}),
	skillAgentMap: SkillAgentMapSchema,
	cwd: z.string().default(""),
	subAgentsTemperature: SubAgentsTemperatureSchema,
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
 * @internal - Called by loader.js to set the resolved config reference
 * @param {Object} config - The resolved config object
 */
export function _setResolvedConfig(config) {
	resolvedConfig = config;
}

/**
 * @internal - Get the current resolved config
 */
function getResolvedConfig() {
	return resolvedConfig;
}
