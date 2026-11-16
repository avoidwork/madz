import { z } from "zod";

/**
 * Policy for the `jira` tool. Lives in server-side config so the model cannot
 * raise the rate limit or change the timeout.
 */
export const JiraSchema = z.object({
	/** Register the `jira` tool. Set `JIRA_ENABLED=false` to disable. */
	enabled: z.boolean().default(true),
	/** Base URL of the JIRA Cloud site, e.g. `https://example.atlassian.net`. Empty = unset. */
	baseUrl: z.union([z.literal(""), z.string().url()]).optional(),
	/** Personal access token, sent as a bearer token. Env: `JIRA_TOKEN`. Never exposed to the model. */
	token: z.string().optional(),
	/** Default project key for create and for search when no JQL is given. Env: `JIRA_PROJECT`. */
	project: z.string().optional(),
	/** Default assignee account id for create. Env: `JIRA_ASSIGNEE`. */
	assignee: z.string().optional(),
	/** Max requests per second, per host. `0` disables limiting. */
	rateLimit: z.number().int().min(0).default(10),
	/** Per-attempt timeout in milliseconds. */
	timeout: z.number().int().positive().default(30000),
});
