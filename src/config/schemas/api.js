import { z } from "zod";

/**
 * A named credential profile for the `api` tool. Secrets are never stored in
 * config: a profile only names the environment variables that hold them, so the
 * model (and `getConfig`) never sees a token and the tool resolves it at call time.
 */
export const ApiCredentialSchema = z
	.object({
		type: z.enum(["bearer", "basic", "apikey"]),
		/** Env var holding the bearer token / API key value. */
		tokenEnv: z.string().min(1).optional(),
		/** Env var holding the basic-auth username. */
		usernameEnv: z.string().min(1).optional(),
		/** Env var holding the basic-auth password. */
		passwordEnv: z.string().min(1).optional(),
		/** Header name for `apikey` credentials. */
		key: z.string().min(1).optional(),
		/** Hosts (exact or `*.example.com`) this credential may be sent to. Empty = any allowed host. */
		hosts: z.array(z.string()).default([]),
	})
	.superRefine((profile, ctx) => {
		const require = (field) =>
			ctx.addIssue({ code: "custom", path: [field], message: `${field} is required` });
		if (profile.type === "bearer" && !profile.tokenEnv) require("tokenEnv");
		if (profile.type === "apikey") {
			if (!profile.tokenEnv) require("tokenEnv");
			if (!profile.key) require("key");
		}
		if (profile.type === "basic") {
			if (!profile.usernameEnv) require("usernameEnv");
			if (!profile.passwordEnv) require("passwordEnv");
		}
	});

/**
 * Policy for the `api` tool. Lives in server-side config so the model cannot
 * widen the allowlist, raise the rate limit, or change the redirect/retry budget.
 */
export const ApiSchema = z.object({
	/** Allowed hosts / URLs. Empty = any public host (internal addresses are always blocked). */
	allowlist: z.array(z.string()).default([]),
	/** Max requests per second, per host. `0` disables limiting. */
	rateLimit: z.number().int().min(0).default(10),
	/** Max redirects followed per request; every hop is re-validated. `0` returns 3xx responses as-is. */
	maxRedirects: z.number().int().min(0).max(20).default(5),
	/** Retries on 429/502/503/504 and transient network errors (non-idempotent methods retry 429 only). */
	maxRetries: z.number().int().min(0).max(5).default(2),
	/** Max response body size in bytes; also the cap on what the model may request. */
	maxBodySize: z.number().int().positive().default(10485760),
	/** Named credential profiles, referenced by the tool's `credential` field. */
	credentials: z.record(z.string(), ApiCredentialSchema).default({}),
});
