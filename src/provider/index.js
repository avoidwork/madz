/**
 * Provider selection helpers.
 *
 * These functions are provider-agnostic: they operate on `config.providers`
 * and select the active provider by the `enabled` flag. They live here rather
 * than in `openai.js` because they are not specific to any single provider.
 */

/**
 * Get the active provider name from a config object.
 * The active provider is the first provider whose `enabled !== false`, falling
 * back to `openai` when no provider is enabled. Shared between the orchestrator
 * and the TUI status bar so the selection rule is not duplicated.
 * @param {Object} config - The loaded config object
 * @returns {string} The active provider name, or "openai"
 */
export function getActiveProviderName(config) {
	const providers = config?.providers || {};
	return Object.keys(providers).find((name) => providers[name]?.enabled !== false) || "openai";
}

/**
 * Get the active provider configuration from a config object.
 * The active provider is the first provider whose `enabled !== false`, falling
 * back to `openai` when no provider is enabled. Shared between the orchestrator
 * and the TUI status bar so the selection rule is not duplicated.
 * @param {Object} config - The loaded config object
 * @returns {Object} The active provider config, or an empty object
 */
export function getActiveProviderConfig(config) {
	const providers = config?.providers || {};
	return providers[getActiveProviderName(config)] || {};
}

/**
 * Get the active provider's model name from a config object.
 * @param {Object} config - The loaded config object
 * @returns {string} The active model name, or empty string if none is configured
 */
export function getActiveModelName(config) {
	return getActiveProviderConfig(config).model || "";
}
