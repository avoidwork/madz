import { z } from "zod";

export const RateLimitSchema = z.object({
	requestsPerMinute: z.number().int().positive().default(60),
	maxRetries: z.number().int().min(0).max(10).default(6),
	maxConcurrency: z.number().int().min(1).optional(),
	maxTokensMinute: z.number().int().min(0).default(0),
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

const SearXNGSearchSchema = z.object({
	url: z.string().optional().default(""),
});

const BingSearchSchema = z.object({
	apiKey: z.string().optional().default(""),
});

const TavilySearchSchema = z.object({
	apiKey: z.string().optional().default(""),
});

const ExaSearchSchema = z.object({
	apiKey: z.string().optional().default(""),
});

const FirecrawlSearchSchema = z.object({
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

const DuckDuckGoSearchSchema = z.object({
	region: z.string().optional().default(""),
	safeSearch: z.enum(["0", "1", "2"]).optional().default("0"),
	time: z.enum(["", "d", "w", "m", "y"]).optional().default(""),
	baseUrl: z.string().url().optional().default("https://html.duckduckgo.com/html/"),
});

export const SearchConfigSchema = z.object({
	duckduckgo: DuckDuckGoSearchSchema.default({}),
	searxng: SearXNGSearchSchema.default({}),
	bing: BingSearchSchema.default({}),
	custom: CustomSearchSchema.default({}),
	tavily: TavilySearchSchema.default({}),
	exa: ExaSearchSchema.default({}),
	firecrawl: FirecrawlSearchSchema.default({}),
});

const ReasoningConfigSchema = z
	.object({
		effort: z.enum(["low", "medium", "high"]).default("medium"),
	})
	.default({ effort: "medium" });

export const OpenaiProviderConfigSchema = z.object({
	type: z.literal("openai").default("openai"),
	enabled: z.boolean().default(true),
	base_url: z.string().url().default("https://api.openai.com/v1"),
	model: z.string().min(1),
	encoding: z.string().optional(),
	credentials: OpenAICredentialsSchema,
	temperature: z.number().min(0).max(2).default(0.4),
	maxTokens: z.number().int().min(-1).default(-1),
	reasoning: ReasoningConfigSchema,
	rateLimit: RateLimitSchema.default({ requestsPerMinute: 60 }),
});

export const CopilotProviderConfigSchema = z.object({
	type: z.literal("github-copilot").default("github-copilot"),
	enabled: z.boolean().default(true),
	base_url: z.string().url().default("https://api.githubcopilot.com"),
	model: z.string().min(1),
	encoding: z.string().optional(),
	enterpriseUrl: z.string().url().optional(),
	temperature: z.number().min(0).max(2).default(0.4),
	maxTokens: z.number().int().min(-1).default(-1),
	reasoning: ReasoningConfigSchema,
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

// --- Email Provider Config Schemas ---

export const GmailProviderSchema = z.object({
	type: z.literal("gmail").default("gmail"),
	userId: z.string().nullable().default("me"),
	fromAddress: z.string().nullable().default(""),
});

export const GraphProviderSchema = z.object({
	type: z.literal("graph").default("graph"),
	userId: z.string().nullable().default("me"),
});

export const ImapProviderSchema = z.object({
	type: z.literal("imap").default("imap"),
	imapHost: z.string().nullable().default("imap.gmail.com"),
	imapPort: z.number().int().positive().default(993),
	imapSecure: z.boolean().nullable().default(true),
	smtpHost: z.string().nullable().default(""),
	smtpPort: z.number().int().positive().default(587),
});

export const EmailProviderSchema = z.discriminatedUnion("type", [
	GmailProviderSchema,
	GraphProviderSchema,
	ImapProviderSchema,
]);

export const EmailConfigSchema = z.object({
	provider: EmailProviderSchema.default({ type: "gmail" }),
	defaultFolder: z.string().nullable().default("INBOX"),
	maxAttachments: z.number().int().positive().default(10),
	maxAttachmentSize: z.string().nullable().default("25mb"),
});

// --- Calendar Provider Config Schemas ---

const _GoogleCalendarCredentialsSchema = z.object({
	apiKey: z.string().optional().default(""),
	serviceAccountKey: z.string().optional().default(""),
	serviceAccountEmail: z.string().optional().default(""),
	impersonateEmail: z.string().optional().default(""),
});

const GoogleCalendarConfigSchema = z.object({
	type: z.literal("google").default("google"),
	apiKey: z.string().optional().default(""),
	serviceAccountKey: z.string().optional().default(""),
	serviceAccountEmail: z.string().optional().default(""),
	impersonateEmail: z.string().optional().default(""),
	rateLimit: RateLimitSchema.default({ requestsPerMinute: 60 }),
});

const _MsGraphCredentialsSchema = z.object({
	tenantId: z.string().optional().default(""),
	clientId: z.string().optional().default(""),
	clientSecret: z.string().optional().default(""),
	delegatedUser: z.string().optional().default(""),
});

const MsGraphConfigSchema = z.object({
	type: z.literal("msgraph").default("msgraph"),
	tenantId: z.string().optional().default(""),
	clientId: z.string().optional().default(""),
	clientSecret: z.string().optional().default(""),
	delegatedUser: z.string().optional().default(""),
	rateLimit: RateLimitSchema.default({ requestsPerMinute: 60 }),
});

export const CalendarConfigSchema = z.object({
	active: z.enum(["google", "msgraph"]).optional(),
	google: GoogleCalendarConfigSchema.default({}),
	msgraph: MsGraphConfigSchema.default({}),
});
