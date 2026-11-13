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

import { resolve } from "node:path";
import { createCopilotFetch, base as copilotBase } from "./copilotAuth.js";
import { logger } from "../shared/logger.js";

/** Timeout (ms) for context-length probe requests. */
const PROBE_TIMEOUT_MS = 5_000;

/**
 * Return `value` when it is a finite number > 0, otherwise `undefined`.
 * @param {*} value - Candidate value
 * @returns {number|undefined} The positive finite number, or undefined
 */
function positive(value) {
	return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : undefined;
}

/**
 * Whether a URL is plain http to a non-local host.
 * @param {URL} url - The parsed URL
 * @returns {boolean} True for insecure remote endpoints
 */
function isInsecureRemote(url) {
	return (
		url.protocol === "http:" && !["localhost", "127.0.0.1", "[::1]", "::1"].includes(url.hostname)
	);
}

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
	if (match) return positive(Number(match[1]));
	return undefined;
}

/**
 * Resolve the model's context window length by probing provider endpoints.
 *
 * Probes in order:
 * 1. The OpenAI-compatible models endpoint (`GET {base_url}/models`). If the
 *    entry matching the configured model has `max_model_len`, it's a vLLM
 *    endpoint and that value is returned. Copilot's `/models` response uses a
 *    different shape (`limits.max_prompt` / `limits.context_window`, or
 *    opencode's `max_prompt_tokens` / `max_context_window_tokens`); the usable
 *    prompt budget is `max_prompt`, not `context_window`.
 * 2. The Ollama native endpoint (`POST {base_url}/api/show`). Ollama returns
 *    `model_info` as a flat object of dotted keys (e.g. `gemma4.context_length`);
 *    the resolver prefers `effective_context_length` (the runtime cap) over the
 *    native `context_length`, and falls back to parsing `num_ctx` from the
 *    `parameters` string.
 *
 * On any failure, returns `undefined` so the caller falls back gracefully.
 * @param {Object} providerConfig - The active provider configuration
 * @param {string} providerConfig.base_url - The provider base URL
 * @param {string} providerConfig.model - The configured model name
 * @param {Object} [providerConfig.credentials] - Provider credentials
 * @param {string} [providerConfig.credentials.apiKey] - The API key
 * @param {Object} [options] - Extra options
 * @param {string} [options.memoryDir] - Memory directory holding `auth.json` (Copilot)
 * @returns {Promise<number|undefined>} The context length, or `undefined`
 */
export async function getModelContextLength(providerConfig = {}, options = {}) {
	// Azure OpenAI and AWS Bedrock have no OpenAI-compatible `/models` endpoint,
	// so probing would fail. Fall back to the configured `contextWindow` rather
	// than probing.
	if (providerConfig.type === "azure-openai" || providerConfig.type === "bedrock") {
		return providerConfig.contextWindow;
	}
	const isCopilot = providerConfig.type === "github-copilot";
	const baseUrl =
		isCopilot && providerConfig.enterpriseUrl
			? copilotBase(providerConfig.enterpriseUrl)
			: providerConfig.base_url;
	const model = providerConfig.model;
	const apiKey = providerConfig.credentials?.apiKey;

	if (!baseUrl || !model) return undefined;

	let parsedBase;
	try {
		parsedBase = new URL(baseUrl);
	} catch {
		return undefined;
	}
	if (apiKey && !isCopilot && isInsecureRemote(parsedBase)) {
		logger.warn("[provider] API key would be sent over http:// to a non-local host; omitting it");
	}
	const sendKey = Boolean(apiKey) && !isCopilot && !isInsecureRemote(parsedBase);

	// Candidate 1: OpenAI-compatible models endpoint (vLLM exposes max_model_len).
	// Copilot's route is `{base}/models` (no `/v1`) and needs the OAuth bearer,
	// which the Copilot fetch interceptor injects.
	const modelsUrl = isCopilot ? `${baseUrl.replace(/\/+$/, "")}/models` : buildModelsUrl(baseUrl);
	try {
		const headers = { Accept: "application/json" };
		if (sendKey) headers.Authorization = `Bearer ${apiKey}`;
		const memoryDir = options.memoryDir ? resolve(options.memoryDir) : undefined;
		const doFetch = isCopilot ? createCopilotFetch(memoryDir, baseUrl) : fetch;
		const res = await doFetch(modelsUrl, {
			headers,
			signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
		});
		if (!res.ok) throw new Error(`models endpoint returned ${res.status}`);
		const data = await res.json();
		const entry = (data?.data || []).find((m) => m?.id === model);
		if (entry && positive(entry.max_model_len)) {
			return entry.max_model_len;
		}
		// Copilot's /models response uses a different shape: a `limits` object
		// with `context_window` / `max_prompt`, or (per opencode) top-level
		// `max_context_window_tokens` / `max_prompt_tokens`. The usable prompt
		// budget is `max_prompt`, not `context_window` — the reported
		// `context_window` (e.g. 400K/1M) is larger than what the API accepts.
		if (entry) {
			// Copilot nests limits under `capabilities.limits`.
			const limits = entry.capabilities?.limits ?? entry.limits;
			const maxPrompt = limits?.max_prompt_tokens ?? limits?.max_prompt ?? entry.max_prompt_tokens;
			if (positive(maxPrompt)) return maxPrompt;
			const contextWindow =
				limits?.max_context_window_tokens ??
				limits?.context_window ??
				entry.max_context_window_tokens;
			if (positive(contextWindow)) return contextWindow;
		}
	} catch {
		// Fall through to the next candidate.
	}

	// Candidate 2: Ollama native endpoint.
	let showUrl;
	try {
		showUrl = buildShowUrl(baseUrl);
	} catch {
		return undefined;
	}
	try {
		// Ollama's native endpoint is unauthenticated; the API key is only sent
		// when the first probe would also have been allowed to carry it.
		const headers = { "Content-Type": "application/json" };
		if (sendKey) headers.Authorization = `Bearer ${apiKey}`;
		const res = await fetch(showUrl, {
			method: "POST",
			headers,
			signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
			body: JSON.stringify({ model }),
		});
		if (!res.ok) throw new Error(`show endpoint returned ${res.status}`);
		const data = await res.json();
		// Ollama's /api/show returns model_info as a flat object of dotted keys
		// (e.g. "gemma4.context_length": 131072), not nested family objects.
		// Scan the flat keys: prefer effective_context_length (the runtime cap,
		// min(native, OLLAMA_CONTEXT_LENGTH)), then native context_length.
		const modelInfo = data?.model_info;
		if (modelInfo && typeof modelInfo === "object") {
			let native;
			for (const [key, value] of Object.entries(modelInfo)) {
				if (key.endsWith(".effective_context_length") && positive(value)) {
					return value;
				}
				if (key.endsWith(".context_length") && positive(value)) {
					native = value;
				}
			}
			if (positive(native)) return native;
		}
		const numCtx = parseNumCtx(data?.parameters);
		if (numCtx !== undefined) return numCtx;
	} catch {
		// Fall through to return undefined.
	}

	return undefined;
}
