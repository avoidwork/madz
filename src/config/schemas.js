import { z } from "zod";

// --- Provider schemas ---

export const RateLimitSchema = z.object({
	requestsPerMinute: z.number().int().positive().default(60),
});

const OpenAICredentialsSchema = z.object({
	apiKey: z.string().min(1),
});

const OpenRouterCredentialsSchema = z.object({
	apiKey: z.string().optional().default(""),
});

const FalCredentialsSchema = z.object({
	apiKey: z.string().optional().default(""),
});

const ExaSearchSchema = z.object({
	apiKey: z.string().optional().default(""),
});

const FirecrawlSearchSchema = z.object({
	apiKey: z.string().optional().default(""),
});

const TavilySearchSchema = z.object({
	apiKey: z.string().optional().default(""),
});

const ParallelSearchSchema = z.object({
	apiKey: z.string().optional().default(""),
});

const SearXNGSearchSchema = z.object({
	url: z.string().optional().default(""),
});

const BingSearchSchema = z.object({
	apiKey: z.string().optional().default(""),
});

const CustomSearchSchema = z.object({
	url: z.string().optional().default(""),
	method: z.string().optional().default(""),
	body: z.string().optional().default(""),
	headers: z.string().optional().default(""),
	queryKey: z.string().optional().default(""),
	titleField: z.string().optional().default(""),
	urlField: z.string().optional().default(""),
	descriptionField: z.string().optional().default(""),
	apiKey: z.string().optional().default(""),
});

const SearchConfigSchema = z.object({
	exa: ExaSearchSchema.default({}),
	firecrawl: FirecrawlSearchSchema.default({}),
	tavily: TavilySearchSchema.default({}),
	parallel: ParallelSearchSchema.default({}),
	searxng: SearXNGSearchSchema.default({}),
	bing: BingSearchSchema.default({}),
	custom: CustomSearchSchema.default({}),
});

const _OpenaiProviderConfigSchema = z.object({
	type: z.literal("openai").default("openai"),
	base_url: z.string().url().default("https://api.openai.com/v1"),
	model: z.string().min(1),
	encoding: z.string().optional(),
	credentials: OpenAICredentialsSchema,
	temperature: z.number().min(0).max(2).default(0.4),
	maxTokens: z.number().int().positive().default(4096),
	rateLimit: RateLimitSchema.default({ requestsPerMinute: 60 }),
});

const _OpenrouterProviderConfigSchema = z.object({
	model: z.string().optional().default("openrouter/auto"),
	credentials: OpenRouterCredentialsSchema,
});

const _FalProviderConfigSchema = z.object({
	model: z.string().optional().default("fal-ai/flux"),
	credentials: FalCredentialsSchema,
});

export const ProvidersSchema = z.object({}).passthrough();

// --- Sandbox schemas ---

export const SandboxScopeSchema = z.object({
	paths: z.array(z.string()).default(["./", "!node_modules/", "/tmp"]),
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
	skillScanPaths: z.array(z.string()).default(["system-skills/", "skills/"]),
	trustProjectSkills: z.boolean().default(true),
});

// --- Memory schemas ---

export const MemoryGcSchema = z.object({
	enabled: z.boolean().default(true),
	idleTimeoutMs: z.number().int().positive().default(300000),
	maxGcPerHour: z.number().int().positive().default(4),
});

export const MemorySchema = z.object({
	directory: z.string().default("memory/"),
	contextDir: z.string().default("memory/context/"),
	toolsDir: z.string().default("memory/tools/"),
	errorsDir: z.string().default("memory/errors/"),
	schedulesDir: z.string().default("memory/schedules/"),
	ephemeralLimit: z.number().int().positive().default(5),
	ephemeral: z
		.object({
			ttlDays: z.number().int().positive().default(7),
			maxEntries: z.number().int().positive().default(10),
		})
		.default({ ttlDays: 7, maxEntries: 10 }),
	gc: MemoryGcSchema.default({ enabled: true, idleTimeoutMs: 300000, maxGcPerHour: 4 }),
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
	syncOnInit: z.boolean().default(true),
	entries: z.array(ScheduleEntrySchema).default([]),
});

// --- TUI schemas ---

export const TuiSchema = z.object({
	name: z.string().default("madz"),
	cursorChar: z.string().default("\u2588"),
});

// --- Agent schemas ---

export const AgentSchema = z.object({
	recursionLimit: z.number().int().positive().default(1000),
	autoContinueLimit: z.number().int().positive().default(1000),
	nodeTimeout: z.number().int().positive().default(600000),
});

// --- LRU cache schemas ---

export const LruSchema = z.object({
	size: z.number().int().positive().default(100),
	ttl: z.number().int().positive().default(600000),
});

// --- Persistence schemas ---

export const PersistenceSchema = z.object({
	mode: z.enum(["memory", "sqlite"]).default("memory"),
	sqlite_path: z.string().default("memory/checkpoints.db"),
});

// --- SubAgent schemas ---

/**
 * Schema for subAgent configuration under process.subAgent.
 * @type {z.ZodType<{ timeout: number; maxConcurrent: number; sessionMode: string; defaultStrategy: string; defaultOnError: string; temperature: number }>}
 */
export const SubAgentConfigSchema = z.object({
	/** Timeout in milliseconds for subAgent execution */
	timeout: z.number().int().positive().default(600000),
	/** Maximum number of concurrent subAgents */
	maxConcurrent: z.number().int().positive().default(4),
	/** Session mode: 'isolated' or 'shared' */
	sessionMode: z.enum(["isolated", "shared"]).default("isolated"),
	/** Default fan-out strategy: 'parallel' or 'sequential' */
	defaultStrategy: z.enum(["parallel", "sequential"]).default("parallel"),
	/** Default error handling: 'continue' or 'fail-fast' */
	defaultOnError: z.enum(["continue", "fail-fast"]).default("continue"),
	/** Sampling temperature (0-2), follows OpenAI API specification */
	temperature: z.number().min(0).max(2).default(0.7),
});

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
	process: z.object({ subAgent: SubAgentConfigSchema.default({}) }).default({ subAgent: {} }),
	cwd: z.string().default(""),
	subAgent: z.boolean().default(false),
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
		toolsDir: "memory/tools/",
		errorsDir: "memory/errors/",
		schedulesDir: "memory/schedules/",
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
	schedules: { maxConcurrent: 1, mode: "inprocess", syncOnInit: true, entries: [] },
	agent: { recursionLimit: 1000, autoContinueLimit: 1000, nodeTimeout: 600000 },
	lru: { size: 100, ttl: 600000 },
	tui: { name: "madz", cursorChar: "\u2588" },
	persistence: { mode: "memory", sqlite_path: "memory/checkpoints.db" },
	process: {
		subAgent: {
			timeout: 600000,
			maxConcurrent: 4,
			sessionMode: "isolated",
			defaultStrategy: "parallel",
			defaultOnError: "continue",
			temperature: 0.7,
		},
	},
	cwd: "",
	subAgent: false,
};
