import { z } from "zod";

/**
 * Policy for the `confluence` tool. Lives in server-side config so the model
 * cannot raise the rate limit or change the timeout.
 */
export const ConfluenceSchema = z.object({
	/** Register the `confluence` tool. Set `CONFLUENCE_ENABLED=false` to disable. */
	enabled: z.boolean().default(true),
	/** Base URL of the Confluence Cloud site, e.g. `https://example.atlassian.net`. Empty = unset. */
	baseUrl: z.union([z.literal(""), z.string().url()]).optional(),
	/** Personal access token, sent as a bearer token. Env: `CONFLUENCE_TOKEN`. Never exposed to the model. */
	token: z.string().optional(),
	/** Max requests per second, per host. `0` disables limiting. */
	rateLimit: z.number().int().min(0).default(10),
	/** Per-attempt timeout in milliseconds. */
	timeout: z.number().int().positive().default(30000),
});
