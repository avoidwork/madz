import { z } from "zod";

/**
 * Configuration for the `poppy` tool's client metadata document (CIMD).
 * These values are sourced from config/env and used by the `identity`
 * action's `build_metadata` operation when not provided as input params.
 * All fields are optional so an unconfigured `poppy` section is valid;
 * the tool falls back to input params when config values are absent.
 */
export const PoppyConfigSchema = z.object({
	/** The agent's client_id URL. Env: `POPPY_CLIENT_ID`. Empty = unset. */
	clientId: z.union([z.literal(""), z.string().url()]).optional(),
	/** The agent's display name. Env: `POPPY_CLIENT_NAME`. Empty = unset. */
	clientName: z.union([z.literal(""), z.string().min(1)]).optional(),
	/** The public JWKS URL. Env: `POPPY_JWKS_URI`. Empty = unset. */
	jwksUri: z.union([z.literal(""), z.string().url()]).optional(),
	/** Valid redirect URIs. Env: `POPPY_REDIRECT_URIS_0`, `POPPY_REDIRECT_URIS_1`, etc. Empty = unset. */
	redirectUris: z.array(z.string()).optional(),
	/** Optional logo URL. Env: `POPPY_LOGO_URI`. Empty = unset. */
	logoUri: z.union([z.literal(""), z.string().url()]).optional(),
});
