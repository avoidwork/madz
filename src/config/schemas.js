import { z } from "zod";

// --- Provider schemas ---

export const RateLimitSchema = z.object({
	requestsPerMinute: z.number().int().positive().default(60),
});

export const CredentialsSchema = z.object({
	apiKey: z.string().min(1),
});

const _ProviderConfigBase = z.object({
	type: z.enum(["openai"]),
	base_url: z.string().url(),
	model: z.string().min(1),
	credentials: CredentialsSchema,
	temperature: z.number().min(0).max(2).default(0.7),
	maxTokens: z.number().int().positive().default(4096),
	rateLimit: RateLimitSchema.default({ requestsPerMinute: 60 }),
});

export const ProvidersSchema = z.object({}).passthrough();

// --- Sandbox schemas ---

export const SandboxScopeSchema = z.object({
	paths: z.array(z.string()).default(["memory/", "skills/", "tmp/"]),
	timeout: z.object({
		seconds: z.number().int().min(0).default(30),
		gracePeriod: z.number().int().positive().default(5),
	}),
	memoryLimit: z.string().default("512m"),
	safety: z.object({
		urlFilter: z.boolean().default(true),
		pythonImportHook: z.boolean().default(true),
	}),
	env: z.object({
		allowlist: z.array(z.string()).default(["PATH", "HOME", "NODE_ENV"]),
	}),
	permissions: z.array(z.string()).default([]),
	maxReadSize: z.string().default("1mb"),
	// Skill discovery settings
	skillScanPaths: z.array(z.string()).default(["skills/", ".agents/skills/"]),
	trustProjectSkills: z.boolean().default(true),
});

// --- Memory schemas ---

export const MemorySchema = z.object({
	directory: z.string().default("memory/"),
	contextDir: z.string().default("memory/context/"),
	toolsDir: z.string().default("memory/tools/"),
	errorsDir: z.string().default("memory/errors/"),
	schedulesDir: z.string().default("memory/schedules/"),
	ephemeral: z
		.object({
			ttlDays: z.number().int().positive().default(7),
			maxEntries: z.number().int().positive().default(10),
		})
		.default({ ttlDays: 7, maxEntries: 10 }),
});

// --- Telemetry schemas ---

export const TelemetryExporterSchema = z.object({
	protocol: z.enum(["console", "http", "grpc"]).default("console"),
	endpoint: z.string().url().default("http://localhost:4318"),
	batch: z.object({
		maxSize: z.number().int().positive().default(512),
		scheduledDelay: z.number().int().positive().default(5000),
	}),
});

export const TelemetrySchema = z.object({
	enabled: z.boolean().default(false),
	exporter: TelemetryExporterSchema.default({
		protocol: "console",
		endpoint: "http://localhost:4318",
		batch: { maxSize: 512, scheduledDelay: 5000 },
	}),
	sampling: z.object({
		ratio: z.number().min(0).max(1).default(0.1),
	}),
	redact: z.object({
		paths: z.array(z.string()).default(["credentials.apiKey"]),
	}),
});

// --- Schedule schemas ---

export const ScheduleEntrySchema = z.object({
	name: z.string().min(1),
	cron: z.string().min(1),
	skill: z.string().min(1),
	input: z.record(z.unknown()).default({}),
	contextFile: z.string().default(""),
});

export const SchedulesSchema = z.object({
	maxConcurrent: z.number().int().positive().default(1),
	mode: z.enum(["inprocess", "system"]).default("inprocess"),
	entries: z.array(ScheduleEntrySchema).default([]),
});

// --- TUI schemas ---

export const TuiSchema = z.object({
	name: z.string().default("madz"),
	cursorChar: z.string().default("\u2588"),
});

// --- Persistence schemas ---

export const PersistenceSchema = z.object({
	mode: z.enum(["memory", "sqlite"]).default("memory"),
	sqlite_path: z.string().default("memory/checkpoints.db"),
});

// --- Root config ---

export const ConfigSchema = z.object({
	providers: ProvidersSchema,
	sandbox: SandboxScopeSchema,
	memory: MemorySchema,
	telemetry: TelemetrySchema,
	schedules: SchedulesSchema,
	tui: TuiSchema,
	persistence: PersistenceSchema,
});

// Default values exported for merging
export const DEFAULT_CONFIG = {
	providers: {},
	sandbox: {
		paths: ["memory/", "skills/", "tmp/"],
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
		toolsDir: "memory/tools/",
		errorsDir: "memory/errors/",
		schedulesDir: "memory/schedules/",
		ephemeral: { ttlDays: 7, maxEntries: 10 },
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
	schedules: { maxConcurrent: 1, mode: "inprocess", entries: [] },
	tui: { name: "madz", cursorChar: "\u2588" },
	persistence: { mode: "memory", sqlite_path: "memory/checkpoints.db" },
};
