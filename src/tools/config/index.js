import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { loadConfig } from "../../config/loader.js";

/**
 * Keys whose values are secrets and must be masked before the config is
 * exposed to an agent. Matched case-insensitively against object keys.
 * `credentials` is intentionally excluded — it is a container object (e.g.
 * `{ apiKey }`) that should be recursed into, not masked as a whole.
 * @type {RegExp}
 */
const SECRET_KEY_PATTERN =
	/^(apiKey|clientSecret|secret|token|password|passwd|serviceAccountKey|privateKey|accessToken|refreshToken|authToken|consumerKey|consumerSecret|signingKey|webhookSecret|sessionKey)$/i;

/**
 * Recursively mask secret values in a config object.
 *
 * Returns a new object — the source config is never mutated. Any key matching
 * `SECRET_KEY_PATTERN` whose value is a non-empty string is replaced with
 * `"***"`. Empty strings and non-string values are preserved so the agent can
 * still tell whether a credential is configured.
 *
 * @param {unknown} value - The config value to mask
 * @returns {unknown} A masked copy of the value
 */
function maskSecrets(value) {
	if (Array.isArray(value)) {
		return value.map(maskSecrets);
	}
	if (value && typeof value === "object") {
		const out = {};
		for (const [key, val] of Object.entries(value)) {
			if (SECRET_KEY_PATTERN.test(key) && typeof val === "string" && val !== "") {
				out[key] = "***";
			} else {
				out[key] = maskSecrets(val);
			}
		}
		return out;
	}
	return value;
}

// Module-level cache for the masked config. Keyed on the source config
// reference from loadConfig(), so a fresh load (new reference) recomputes the
// mask while repeated calls reuse the cached result.
let cachedMasked = null;
let cachedSource = null;

/**
 * Get the full harness configuration as a parsed JSON object, with secrets
 * masked.
 *
 * Calls loadConfig() and returns the result with any apiKey/secret/token
 * values replaced by "***". The masked result is cached for reuse and
 * recomputed only when loadConfig() returns a new config object.
 *
 * @param {z.infer<typeof GetConfigSchema>} [_input] - The tool input (empty object)
 * @returns {Promise<{ ok: boolean, config?: object, error?: string }>} Structured result with the masked config on success or an error message on failure
 */
export async function getConfigImpl(_input = {}) {
	try {
		const config = loadConfig();
		if (cachedSource !== config) {
			cachedMasked = maskSecrets(config);
			cachedSource = config;
		}
		return { ok: true, config: cachedMasked };
	} catch (err) {
		return { ok: false, error: err.message };
	}
}

/**
 * @internal - Reset the cached masked config so the next getConfigImpl()
 * recomputes it. Used by tests and after config mutations.
 */
export function _resetGetConfigCache() {
	cachedMasked = null;
	cachedSource = null;
}

export const getConfig = tool(getConfigImpl, {
	name: "getConfig",
	description:
		"Get the full harness configuration as a parsed JSON object, with secrets masked. " +
		"Calls loadConfig() and returns the result with any apiKey/secret/token values replaced by '***'. " +
		"Requires only filesystem:read permission — no input parameters needed.",
	schema: z.object({}).strict(),
});
