import { z } from "zod";

/**
 * A named JIRA credential profile. Secrets are never stored in config: a profile
 * only names the environment variables that hold the Basic-auth username (email)
 * and password (API token), so the model (and `getConfig`) never sees a token
 * and the tool resolves it at call time. JIRA Cloud uses Basic auth
 * `email:token`, so the profile is always a basic credential.
 */
export const JiraCredentialSchema = z.object({
	/** Env var holding the Basic-auth username (JIRA email). Defaults to `JIRA_EMAIL`. */
	usernameEnv: z.string().min(1).default("JIRA_EMAIL"),
	/** Env var holding the Basic-auth password (JIRA API token). Defaults to `JIRA_TOKEN`. */
	passwordEnv: z.string().min(1).default("JIRA_TOKEN"),
	/** Hosts (exact or `*.example.com`) this credential may be sent to. Empty = any allowed host. */
	hosts: z.array(z.string()).default([]),
});

/**
 * Policy for the `jira` tool. Lives in server-side config so the model cannot
 * raise the rate limit or change the timeout.
 */
export const JiraSchema = z.object({
	/** Register the `jira` tool. Set `JIRA_ENABLED=false` to disable. */
	enabled: z.boolean().default(true),
	/** Base URL of the JIRA Cloud site, e.g. `https://example.atlassian.net`. Empty = unset. */
	baseUrl: z.union([z.literal(""), z.string().url()]).optional(),
	/** Basic-auth username (JIRA email). Env: `JIRA_EMAIL`. Never exposed to the model. */
	email: z.string().optional(),
	/** Basic-auth API token. Env: `JIRA_TOKEN`. Never exposed to the model. */
	token: z.string().optional(),
	/** Default project key for create and for search when no JQL is given. Env: `JIRA_PROJECT`. */
	project: z.string().optional(),
	/** Default assignee account id for create. Env: `JIRA_ASSIGNEE`. */
	assignee: z.string().optional(),
	/** Max requests per second, per host. `0` disables limiting. */
	rateLimit: z.number().int().min(0).default(10),
	/** Per-attempt timeout in milliseconds. */
	timeout: z.number().int().positive().default(30000),
	/** Named credential profiles, referenced by the tool's `credential` field. */
	credentials: z.record(z.string(), JiraCredentialSchema).default({}),
});
