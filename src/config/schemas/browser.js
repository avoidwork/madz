import { z } from "zod";

/**
 * Policy for the `browser` tool. Lives in server-side config so the model cannot
 * widen the allowlist, raise the session cap, or change the timeouts.
 */
export const BrowserSchema = z.object({
	/** Allowed hosts / URLs for every request the browser makes. Empty = any host. */
	allowlist: z.array(z.string()).default([]),
	/** Default per-call timeout in milliseconds. */
	timeoutMs: z.number().int().positive().default(30000),
	/** Idle time in milliseconds after which a persistent session is closed. */
	sessionIdleTimeoutMs: z.number().int().positive().default(300000),
	/** Max persistent sessions open at once. */
	maxSessions: z.number().int().positive().default(5),
	/** Max characters returned by `extract` and `evaluate`. */
	maxContentChars: z.number().int().positive().default(200000),
	/** Quiet time in milliseconds that counts as "network idle" for `waitFor`. */
	networkIdleMs: z.number().int().positive().default(500),
});
