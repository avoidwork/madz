import { readFile, writeFile, mkdir, unlink } from "node:fs/promises";
import { dirname, join } from "node:path";
import { setTimeout as sleep } from "node:timers/promises";
import { createRequire } from "node:module";

const _require = createRequire(import.meta.url);
/** The application version, read from package.json for the User-Agent header. */
const APP_VERSION = _require("../../package.json").version;

/**
 * GitHub Copilot OAuth device-flow auth module.
 *
 * Implements the OAuth 2.0 Device Authorization Grant (RFC 8628) against
 * GitHub's Copilot endpoints. The device flow is the correct fit for an
 * input-constrained CLI/TUI client that cannot host a redirect URI, and it
 * works headless in a Docker/VM deployment with no public callback endpoint.
 *
 * The public OAuth client id below is not a secret — it is the project's own
 * app id and is safe to commit.
 */

/** Public OAuth client id for GitHub Copilot. Not a credential. */
export const CLIENT_ID = "Ov23li8tweQw6odWQebz";

/** Default Copilot API base URL. */
export const DEFAULT_BASE_URL = "https://api.githubcopilot.com";

/** Default GitHub auth domain. */
export const DEFAULT_DOMAIN = "github.com";

/** Default scope requested for the device flow. */
export const DEFAULT_SCOPE = "read:user";

/** Path to the persisted token file, relative to the project root. */
export const AUTH_FILE = "memory/auth.json";

/** Safety margin added to the server-provided polling interval (ms). */
const POLL_SAFETY_MS = 5_000;

/** Maximum number of polling attempts before giving up. */
const MAX_POLL_ATTEMPTS = 120;

/**
 * Handler invoked when a Copilot request returns 401 (token expired or
 * invalid). Registered by the TUI so it can surface a fresh device-flow
 * prompt. `null` when no handler is registered.
 * @type {Function|null}
 */
let authRequiredHandler = null;

/**
 * Register the handler invoked when a Copilot request returns 401. Pass
 * `null` to clear. The handler is responsible for re-acquiring a device code
 * and surfacing it to the user.
 * @param {Function|null} handler - The handler, or null to clear
 */
export function setAuthRequiredHandler(handler) {
	authRequiredHandler = handler;
}

/**
 * Normalize a domain by stripping any scheme and trailing slash.
 * @param {string} domain - The domain or URL to normalize
 * @returns {string} The normalized domain
 */
export function normalizeDomain(domain) {
	return String(domain || DEFAULT_DOMAIN)
		.replace(/^https?:\/\//i, "")
		.replace(/\/+$/, "")
		.replace(/^\/+/, "");
}

/**
 * Build the device-code and token endpoints for a given domain.
 * @param {string} [domain] - The GitHub domain (e.g. "github.com" or a GHE host)
 * @returns {{ deviceCodeUrl: string, tokenUrl: string }} The endpoint URLs
 */
export function getUrls(domain) {
	const host = normalizeDomain(domain);
	return {
		deviceCodeUrl: `https://${host}/login/device/code`,
		tokenUrl: `https://${host}/login/oauth/access_token`,
	};
}

/**
 * Resolve the Copilot API base URL for a given enterprise URL.
 *
 * For enterprise/GHE deployments the Copilot API is served from a dedicated
 * `copilot-api.<domain>` host (matching opencode), not from `<domain>/api/v1`.
 * The public default (`https://api.githubcopilot.com`) is unchanged.
 * @param {string} [enterpriseUrl] - An optional enterprise/GHE URL
 * @returns {string} The Copilot API base URL
 */
export function base(enterpriseUrl) {
	if (enterpriseUrl) {
		const host = normalizeDomain(enterpriseUrl);
		return `https://copilot-api.${host}`;
	}
	return DEFAULT_BASE_URL;
}

/**
 * Resolve the auth file path. Uses the configured memory directory when
 * provided, otherwise defaults to `memory/auth.json`.
 * @param {string} [memoryDir] - The memory directory (e.g. "memory/")
 * @returns {string} The absolute-or-relative auth file path
 */
export function authFilePath(memoryDir) {
	return memoryDir ? join(memoryDir, "auth.json") : AUTH_FILE;
}

/** GitHub Copilot API version header value. */
export const API_VERSION = "2026-06-01";

/**
 * In-memory Copilot refresh-token state. This is the single source of truth
 * for the Authorization header on every request. It is initialized from the
 * persisted auth file (or the OAuth device-flow response) and updated whenever
 * a fresh token is obtained. Requests decorate the header from this state —
 * they never delete it.
 * @type {string|null}
 */
let copilotToken = null;

/**
 * Set the in-memory Copilot token state. Called when a token is loaded from
 * disk or obtained from the OAuth device flow.
 * @param {string|null} token - The refresh token, or null to clear
 */
export function setCopilotToken(token) {
	copilotToken = token;
}

/**
 * Get the in-memory Copilot token state.
 * @returns {string|null} The refresh token, or null if not set
 */
export function getCopilotToken() {
	return copilotToken;
}

/**
 * Read the persisted Copilot token from disk and update the in-memory state.
 * @param {string} [memoryDir] - The memory directory
 * @returns {Promise<string|null>} The access token, or null if not present
 */
export async function getToken(memoryDir) {
	const file = authFilePath(memoryDir);
	try {
		const data = await readFile(file, "utf8");
		const parsed = JSON.parse(data);
		const token = parsed?.access_token || null;
		copilotToken = token;
		return token;
	} catch {
		return null;
	}
}

/**
 * Persist the Copilot token to the auth file with mode `0o600` and update the
 * in-memory state.
 * @param {string} token - The access token to persist
 * @param {string} [memoryDir] - The memory directory
 * @returns {Promise<void>}
 */
export async function persist(token, memoryDir) {
	const file = authFilePath(memoryDir);
	await mkdir(dirname(file), { recursive: true });
	await writeFile(file, JSON.stringify({ access_token: token, expires: 0 }), {
		mode: 0o600,
		flag: "w",
	});
	copilotToken = token;
}

/**
 * Delete the persisted Copilot token.
 * @param {string} [memoryDir] - The memory directory
 * @returns {Promise<void>}
 */
export async function clearToken(memoryDir) {
	const file = authFilePath(memoryDir);
	try {
		await unlink(file);
	} catch {
		// Ignore missing file.
	}
	copilotToken = null;
}

/**
 * Resolve the GitHub domain from either `deploymentType` or `domain`.
 * `deploymentType` is the public parameter name (e.g. "github.com"); `domain`
 * is accepted as an alias for backward compatibility.
 * @param {Object} opts - The options object
 * @returns {string} The resolved domain
 */
function resolveDomain(opts = {}) {
	return opts.deploymentType ?? opts.domain ?? DEFAULT_DOMAIN;
}

/**
 * Initiate the OAuth device flow and return the device-code response.
 * @param {Object} [opts] - Options
 * @param {string} [opts.deploymentType] - The GitHub domain (e.g. "github.com")
 * @param {string} [opts.domain] - Alias for `deploymentType`
 * @param {string} [opts.clientId] - The OAuth client id
 * @param {string} [opts.scope] - The requested scope
 * @param {string} [opts.baseUrl] - The Copilot API base URL (unused here, kept for symmetry)
 * @returns {Promise<Object>} The device-code response (device_code, user_code, verification_uri, interval)
 */
export async function requestDeviceCode(opts = {}) {
	const { clientId = CLIENT_ID, scope = DEFAULT_SCOPE } = opts;
	const { deviceCodeUrl } = getUrls(resolveDomain(opts));
	const body = new URLSearchParams({
		client_id: clientId,
		scope,
	});
	const res = await fetch(deviceCodeUrl, {
		method: "POST",
		headers: {
			"Content-Type": "application/x-www-form-urlencoded",
			Accept: "application/json",
		},
		body: body.toString(),
	});
	if (!res.ok) {
		const text = await res.text().catch(() => "");
		throw new Error(
			`Device code request failed: ${res.status} ${res.statusText}${text ? ` — ${text.slice(0, 200)}` : ""}`,
		);
	}
	const text = await res.text();
	try {
		return JSON.parse(text);
	} catch {
		throw new Error(`Device code request returned invalid JSON: ${text.slice(0, 200)}`);
	}
}

/**
 * Poll the token endpoint for an access token, handling `authorization_pending`
 * and `slow_down` per RFC 8628.
 * @param {Object} deviceCode - The device-code response from `requestDeviceCode`
 * @param {Object} [opts] - Options
 * @param {string} [opts.deploymentType] - The GitHub domain (e.g. "github.com")
 * @param {string} [opts.domain] - Alias for `deploymentType`
 * @param {string} [opts.clientId] - The OAuth client id
 * @param {string} [opts.memoryDir] - The memory directory for persistence
 * @param {Function} [opts.onStatus] - Callback for status updates (e.g. printing the verification URL)
 * @param {number} [opts.pollSafetyMs] - Safety margin added to the polling interval (default 5000)
 * @param {number} [opts.maxPollAttempts] - Maximum polling attempts (default 120)
 * @returns {Promise<{ ok: boolean, token?: string, error?: string }>} The result
 */
export async function pollForToken(deviceCode, opts = {}) {
	const { clientId = CLIENT_ID, memoryDir } = opts;
	const { tokenUrl } = getUrls(resolveDomain(opts));
	const interval = (deviceCode.interval ?? 5) * 1000;
	const safety = opts.pollSafetyMs ?? POLL_SAFETY_MS;
	const maxAttempts = opts.maxPollAttempts ?? MAX_POLL_ATTEMPTS;
	let attempts = 0;

	while (attempts < maxAttempts) {
		attempts += 1;
		const body = new URLSearchParams({
			client_id: clientId,
			device_code: deviceCode.device_code,
			grant_type: "urn:ietf:params:oauth:grant-type:device_code",
		});
		const res = await fetch(tokenUrl, {
			method: "POST",
			headers: {
				"Content-Type": "application/x-www-form-urlencoded",
				Accept: "application/json",
			},
			body: body.toString(),
		});
		const text = await res.text();
		let data;
		try {
			data = JSON.parse(text);
		} catch {
			return { ok: false, error: `Token endpoint returned invalid JSON: ${text.slice(0, 200)}` };
		}

		if (data.access_token) {
			await persist(data.access_token, memoryDir);
			return { ok: true, token: data.access_token };
		}

		if (data.error === "authorization_pending") {
			await sleep(interval + safety);
			continue;
		}

		if (data.error === "slow_down") {
			// RFC 8628: add 5s to the interval on slow_down.
			await sleep(interval + safety);
			continue;
		}

		return { ok: false, error: data.error || data.error_description || "Unknown error" };
	}

	return { ok: false, error: "Polling timed out" };
}

/**
 * Produce an auth prompt for the chat UI: request a fresh device code and
 * return the verification URL and user code so the user can authorize from a
 * browser. Short-circuits to `null` when a token is already present.
 *
 * This is the chat-facing auth flow. It does NOT poll — it only acquires the
 * device code. The caller is responsible for starting the poll (e.g. in the
 * background) and for falling back to a static message when the request fails
 * (e.g. no network).
 * @param {Object} [opts] - Options
 * @param {string} [opts.deploymentType] - The GitHub domain (e.g. "github.com")
 * @param {string} [opts.domain] - Alias for `deploymentType`
 * @param {string} [opts.clientId] - The OAuth client id
 * @param {string} [opts.scope] - The requested scope
 * @param {string} [opts.memoryDir] - The memory directory for persistence
 * @returns {Promise<{ verificationUri: string, userCode: string, deviceCode: Object } | null>}
 *   The prompt data, or `null` when already authenticated or the request failed.
 */
export async function getAuthPrompt(opts = {}) {
	const { memoryDir } = opts;
	if (await getToken(memoryDir)) {
		return null;
	}
	try {
		const deviceCode = await requestDeviceCode(opts);
		const verificationUri = deviceCode.verification_uri || deviceCode.verification_uri_complete;
		const userCode = deviceCode.user_code;
		if (!verificationUri || !userCode) {
			return null;
		}
		return {
			verificationUri,
			userCode,
			deviceCode,
			deploymentType: resolveDomain(opts),
		};
	} catch {
		return null;
	}
}

/**
 * Determine whether a Copilot request is agent-initiated or user-initiated,
 * mirroring opencode's heuristic. A request is agent-initiated when the last
 * message is not a plain user text message (e.g. it is a tool call, a tool
 * result, or a continuation after a tool call). This drives the `x-initiator`
 * header that GitHub Copilot uses to classify the interaction.

 * @param {Object} [body] - The parsed request body
 * @returns {boolean} True if the request is agent-initiated
 */
function isAgentInitiated(body) {
	if (!body) return false;
	// Completions API
	if (Array.isArray(body.messages)) {
		const last = body.messages[body.messages.length - 1];
		if (!last) return false;
		return last.role !== "user";
	}
	// Responses API
	if (Array.isArray(body.input)) {
		const last = body.input[body.input.length - 1];
		if (!last) return false;
		return last.role !== "user";
	}
	return false;
}

/**
 * Content-part types that carry an image, across the three Copilot API shapes:
 * `image_url` (Completions API), `input_image` (Responses API), and `image`
 * (Anthropic Messages API). Matching opencode's vision detection.
 * @type {ReadonlySet<string>}
 */
const VISION_PART_TYPES = Object.freeze(new Set(["image_url", "input_image", "image"]));

/**
 * Determine whether a message content value carries image content. Recurses
 * into Anthropic `tool_result` blocks, which can nest images in their own
 * `content` array — matching opencode's Messages API detection.
 * @param {string|Array} content - The message content
 * @returns {boolean} True if any part carries an image
 */
function hasImageParts(content) {
	if (!Array.isArray(content)) return false;
	return content.some((part) => {
		if (!part || typeof part !== "object") return false;
		if (VISION_PART_TYPES.has(part.type)) return true;
		if (part.type === "tool_result") return hasImageParts(part.content);
		return false;
	});
}

/**
 * Determine whether a Copilot request carries image content anywhere in the
 * conversation.
 *
 * GitHub's Copilot API rejects vision requests that omit the
 * `Copilot-Vision-Request` header with `400 missing required
 * Copilot-Vision-Request header for vision requests`. The header is required
 * whenever the payload contains an image — not only when the final message
 * carries it — so this scans every message, matching opencode, which checks
 * the whole body rather than the last item.
 *
 * Handles all three request shapes opencode supports: Completions
 * (`body.messages` + `image_url`), Responses (`body.input` + `input_image`),
 * and the Anthropic Messages shim (`body.messages` + `image`, including images
 * nested inside `tool_result` blocks).
 * @param {Object} [body] - The parsed request body
 * @returns {boolean} True if the request includes image content
 */
function isVisionRequest(body) {
	if (!body) return false;
	let items = [];
	if (Array.isArray(body.messages)) items = body.messages;
	else if (Array.isArray(body.input)) items = body.input;
	return items.some((item) => hasImageParts(item?.content));
}

/**
 * Create a fetch interceptor that injects `Authorization: Bearer <oauth-token>`
 * on every request, matching opencode's approach. The raw OAuth device-flow
 * access token is a valid Copilot bearer — it is sent directly, with no
 * `copilot_internal/v2/token` exchange. This avoids both the 403 faux
 * rate-limit (from hammering the exchange endpoint) and the 400 malformed
 * header (from an exchanged token that is empty or malformed).
 *
 * The interceptor also sets the headers GitHub Copilot expects: the API
 * version, an `Openai-Intent`, a `User-Agent`, and `x-initiator` (agent/user)
 * derived from the request body. This is passed to `ChatOpenAI` as
 * `configuration.fetch` so it survives `bindTools()` and picks up a re-auth
 * without rebuilding the model.
 *
 * When a response returns 401 (token expired or invalid), the interceptor
 * clears the stored token and invokes the registered `authRequiredHandler` so
 * the caller can surface a fresh device-flow prompt.
 * @param {string} [memoryDir] - The memory directory
 * @returns {Function} A fetch-compatible function
 */
export function createCopilotFetch(memoryDir) {
	return async (input, init = {}) => {
		// Load the token from disk into state if not already set, then decorate
		// the Authorization header from state. We never delete the header — we
		// simply set it, which overrides whatever the SDK injected (the
		// placeholder apiKey). This mirrors opencode's approach.
		const oauthToken = copilotToken ?? (await getToken(memoryDir));
		const headers = new Headers(init.headers || {});
		if (oauthToken) {
			headers.set("Authorization", `Bearer ${oauthToken}`);
		}

		// Derive x-initiator from the request body. The body may be a string
		// (JSON) or already parsed; guard against parse failures.
		let body = init.body;
		if (typeof body === "string") {
			try {
				body = JSON.parse(body);
			} catch {
				body = undefined;
			}
		}
		headers.set("x-initiator", isAgentInitiated(body) ? "agent" : "user");
		// GitHub's Copilot API requires this marker on any request whose payload
		// contains an image; without it the request fails with
		// `400 missing required Copilot-Vision-Request header for vision
		// requests`. Set it whenever image content is present, matching
		// opencode. It is a routing hint, not a capability toggle, so sending it
		// for a non-vision-capable model is harmless.
		if (isVisionRequest(body)) {
			headers.set("Copilot-Vision-Request", "true");
		}
		headers.set("Openai-Intent", "conversation-edits");
		headers.set("X-GitHub-Api-Version", API_VERSION);
		headers.set("User-Agent", `madz/${APP_VERSION}`);

		let res = await fetch(input, { ...init, headers });
		if (res.status === 401 && oauthToken) {
			// The bearer was rejected (expired or invalid). Clear the stored
			// token and invoke the re-auth handler so the caller can surface a
			// fresh device-flow prompt.
			await clearToken(memoryDir);
			if (authRequiredHandler) {
				authRequiredHandler();
			}
		}
		return res;
	};
}
