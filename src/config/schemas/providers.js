import { z } from "zod";

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

export const SearchConfigSchema = z.object({
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
	host: z.string().nullable().default("imap.gmail.com"),
	port: z.number().int().positive().default(993),
	secure: z.boolean().nullable().default(true),
});

export const EmailProviderSchema = z.discriminatedUnion("type", [
	GmailProviderSchema,
	GraphProviderSchema,
	ImapProviderSchema,
]);

export const EmailConfigSchema = z.object({
	provider: EmailProviderSchema,
	defaultFolder: z.string().nullable().default("INBOX"),
	maxAttachments: z.number().int().positive().default(10),
	maxAttachmentSize: z.string().nullable().default("25mb"),
});
