/**
 * Provider selection helpers.
 *
 * These functions are provider-agnostic: they operate on `config.providers`
 * and select the active provider by the `enabled` flag. They live here rather
 * than in `openai.js` because they are not specific to any single provider.
 */

/**
 * Get the active provider name from a config object.
 * The active provider is the first provider that is enabled: `enabled` is
 * treated as on when it is `undefined` or `true`. Shared between the
 * orchestrator and the TUI status bar so the selection rule is not duplicated.
 * @param {Object} config - The loaded config object
 * @returns {string} The active provider name, or "" when none is enabled (no
 *   implicit fallback; callers that need a provider must report a clear error)
 */
export function getActiveProviderName(config) {
	const providers = config?.providers || {};
	return (
		Object.keys(providers).find(
			(n) => providers[n]?.enabled === undefined || providers[n]?.enabled === true,
		) ?? ""
	);
}

/**
 * Get the active provider configuration from a config object.
 * See `getActiveProviderName`.
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

export { createAzureChatModel, resolveAzureEndpoint } from "./azure.js";
export { createBedrockChatModel, resolveBedrockRegion } from "./bedrock.js";
