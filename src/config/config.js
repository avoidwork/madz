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
});

// Derive defaults from Zod schema — config.yaml is the source of truth,
// this is only used as a validation scaffold for merging.
export const DEFAULT_CONFIG = ConfigSchema.parse({});
