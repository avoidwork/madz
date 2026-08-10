import { z } from "zod";
import { ProvidersSchema, SearchConfigSchema } from "./schemas/providers.js";
import { SandboxScopeSchema } from "./schemas/sandbox.js";
import { MemorySchema } from "./schemas/memory.js";
import { TelemetrySchema } from "./schemas/telemetry.js";
import { SchedulesSchema } from "./schemas/schedules.js";
import { TuiSchema } from "./schemas/tui.js";
import { AgentSchema } from "./schemas/agent.js";
import { LruSchema } from "./schemas/lru.js";
import { PersistenceSchema } from "./schemas/persistence.js";

// Re-export individual schemas for backward compatibility
export {
	ProvidersSchema,
	SearchConfigSchema,
	SandboxScopeSchema,
	MemorySchema,
	TelemetrySchema,
	SchedulesSchema,
	TuiSchema,
	AgentSchema,
	LruSchema,
	PersistenceSchema,
};

// --- Root config ---

export const ConfigSchema = z.object({
	providers: ProvidersSchema,
	sandbox: SandboxScopeSchema,
	search: SearchConfigSchema.default({}),
	memory: MemorySchema,
	telemetry: TelemetrySchema,
	schedules: SchedulesSchema,
	tui: TuiSchema,
	agent: AgentSchema.default({}),
	lru: LruSchema.default({}),
	persistence: PersistenceSchema,
	cwd: z.string().default(""),
});

// Default values exported for merging
export const DEFAULT_CONFIG = {
	providers: {},
	search: {
		exa: { apiKey: "" },
		firecrawl: { apiKey: "" },
		tavily: { apiKey: "" },
		parallel: { apiKey: "" },
		searxng: { url: "" },
		bing: { apiKey: "" },
		custom: {
			url: "",
			method: "",
			body: "",
			headers: "",
			queryKey: "",
			titleField: "",
			urlField: "",
			descriptionField: "",
			apiKey: "",
		},
	},
	sandbox: {
		paths: ["./", "!node_modules/", "/tmp"],
		timeout: { seconds: 30, gracePeriod: 5 },
		memoryLimit: "512m",
		safety: { urlFilter: true, pythonImportHook: true },
		env: { allowlist: ["PATH", "HOME", "NODE_ENV"] },
		permissions: [],
		maxReadSize: "1mb",
		skillScanPaths: ["skills/", ".agents/skills/"],
		trustProjectSkills: true,
	},
	memory: {
		directory: "memory/",
		contextDir: "memory/context/",
		subAgentsDir: "memory/sub-agents/",
		errorsDir: "memory/errors/",
		schedulesDir: "memory/schedules/",
		sessionsDir: "memory/sessions/",
		ephemeralLimit: 5,
		ephemeral: { ttlDays: 7, maxEntries: 10 },
		gc: { enabled: true, idleTimeoutMs: 300000, maxGcPerHour: 4 },
	},
	telemetry: {
		enabled: false,
		exporter: {
			protocol: "console",
			endpoint: "http://localhost:4318",
			batch: { maxSize: 512, scheduledDelay: 5000 },
		},
		sampling: { ratio: 0.1 },
		redact: { paths: ["credentials.apiKey"] },
	},
	schedules: {
		maxConcurrent: 1,
		mode: "inprocess",
		syncOnInit: true,
		logPath: undefined,
		entries: [],
	},
	agent: { recursionLimit: 1000, autoContinueLimit: 1000, nodeTimeout: 600000 },
	lru: { size: 100, ttl: 600000 },
	tui: { name: "madz", cursorChar: "\u2588" },
	persistence: { mode: "memory", sqlite_path: "memory/checkpoints.db" },
	cwd: "",
};
