/**
 * Provider model context-length resolver.
 *
 * Determines the model's context window length by probing the provider's
 * endpoints. Ollama and vLLM both expose OpenAI-compatible APIs and are
 * configured as `type: openai`, so the resolver does NOT branch on the provider
 * `type` field. Instead it probes all candidate endpoints and uses whichever
 * one succeeds in returning a usable context length.
 *
 * The resolver is defensive: on any failure (unreachable, model not found,
 * field absent, non-200) it moves on to the next candidate or returns
 * `undefined`. It never throws, so the caller falls back gracefully.
 */

/**
 * Construct the OpenAI-compatible models URL from a base URL without
 * duplicating a `/v1` prefix. The models route is `/models`, not `/v1/models`.
 * If `base_url` already ends with `/v1`, append `/models`; otherwise append
 * `/v1/models`.
 * @param {string} baseUrl - The provider base URL (e.g. `https://host/v1`)
 * @returns {string} The models endpoint URL
 */
export function buildModelsUrl(baseUrl) {
	const trimmed = baseUrl.replace(/\/+$/, "");
	return /\/v1$/i.test(trimmed) ? `${trimmed}/models` : `${trimmed}/v1/models`;
}

/**
 * Construct the Ollama native `/api/show` URL relative to the base host,
 * ignoring any `/v1` prefix on the base URL.
 * @param {string} baseUrl - The provider base URL (e.g. `https://host/v1`)
 * @returns {string} The Ollama `/api/show` endpoint URL
 */
export function buildShowUrl(baseUrl) {
	const trimmed = baseUrl.replace(/\/+$/, "");
	// Strip a trailing /v1 (and any path) so the Ollama native route is
	// relative to the host, not the OpenAI-compatible prefix.
	const host = trimmed.replace(/\/v1$/i, "");
	return `${host}/api/show`;
}

/**
 * Parse `num_ctx` from an Ollama model `parameters` string.
 * @param {string} parameters - The Ollama model parameters string
 * @returns {number|undefined} The parsed `num_ctx`, or `undefined`
 */
export function parseNumCtx(parameters) {
	if (typeof parameters !== "string") return undefined;
	const match = parameters.match(/num_ctx\s+(\d+)/);
	if (match) return Number(match[1]);
	return undefined;
}

/**
 * Resolve the model's context window length by probing provider endpoints.
 *
 * Probes in order:
 * 1. The OpenAI-compatible models endpoint (`GET {base_url}/models`). If the
 *    entry matching the configured model has `max_model_len`, it's a vLLM
 *    endpoint and that value is returned.
 * 2. The Ollama native endpoint (`POST {base_url}/api/show`). If the response
 *    has `model_info.<family>.context_length`, return it; otherwise parse
 *    `num_ctx` from the `parameters` string.
 *
 * On any failure, returns `undefined` so the caller falls back gracefully.
 * @param {Object} providerConfig - The active provider configuration
 * @param {string} providerConfig.base_url - The provider base URL
 * @param {string} providerConfig.model - The configured model name
 * @param {Object} [providerConfig.credentials] - Provider credentials
 * @param {string} [providerConfig.credentials.apiKey] - The API key
 * @returns {Promise<number|undefined>} The context length, or `undefined`
 */
export async function getModelContextLength(providerConfig = {}) {
	const baseUrl = providerConfig.base_url;
	const model = providerConfig.model;
	const apiKey = providerConfig.credentials?.apiKey;

	if (!baseUrl || !model) return undefined;

	// Candidate 1: OpenAI-compatible models endpoint (vLLM exposes max_model_len).
	const modelsUrl = buildModelsUrl(baseUrl);
	try {
		const headers = { Accept: "application/json" };
		if (apiKey) headers.Authorization = `Bearer ${apiKey}`;
		const res = await fetch(modelsUrl, { headers });
		if (!res.ok) throw new Error(`models endpoint returned ${res.status}`);
		const data = await res.json();
		const entry = (data?.data || []).find((m) => m?.id === model);
		if (entry && typeof entry.max_model_len === "number") {
			return entry.max_model_len;
		}
	} catch {
		// Fall through to the next candidate.
	}

	// Candidate 2: Ollama native endpoint.
	const showUrl = buildShowUrl(baseUrl);
	try {
		const headers = { "Content-Type": "application/json" };
		if (apiKey) headers.Authorization = `Bearer ${apiKey}`;
		const res = await fetch(showUrl, {
			method: "POST",
			headers,
			body: JSON.stringify({ model }),
		});
		if (!res.ok) throw new Error(`show endpoint returned ${res.status}`);
		const data = await res.json();
		const modelInfo = data?.model_info;
		if (modelInfo && typeof modelInfo === "object") {
			for (const family of Object.values(modelInfo)) {
				if (family && typeof family.context_length === "number") {
					return family.context_length;
				}
			}
		}
		const numCtx = parseNumCtx(data?.parameters);
		if (numCtx !== undefined) return numCtx;
	} catch {
		// Fall through to return undefined.
	}

	return undefined;
}
