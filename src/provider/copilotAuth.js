import { readFile, writeFile, mkdir, unlink, rename, chmod } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { setTimeout as sleep } from "node:timers/promises";
import { createRequire } from "node:module";

const _require = createRequire(import.meta.url);
/** The application version, read from package.json for the User-Agent header. */
const APP_VERSION = (() => {
	try {
		return _require("../../package.json").version || "0.0.0";
	} catch {
		return "0.0.0";
	}
})();

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

/** Timeout (ms) applied to device-flow HTTP requests. */
const REQUEST_TIMEOUT_MS = 15_000;

/** A bare hostname: no userinfo, port, path, query, fragment, or whitespace. */
const HOST_PATTERN = /^[a-z0-9]([a-z0-9.-]*[a-z0-9])?$/i;

/**
 * Whether the auth-required handler is currently running (single-flight).
 * @type {boolean}
 */
let authFlowActive = false;

/**
 * In-flight device-flow polls keyed by device code (single-flight).
 * @type {Map<string, Promise<Object>>}
 */
const pollsInFlight = new Map();

/**
 * A token the server rejected with 401. Never re-used from disk or memory, so
 * the persisted file need not be deleted on the first 401.
 * @type {string|null}
 */
let rejectedToken = null;

/**
 * Redact a response-body snippet for use in error messages: long token-like
 * strings are masked and the result is truncated.
 * @param {string} text - The raw text
 * @returns {string} A safe snippet
 */
function redactSnippet(text) {
	return String(text ?? "")
		.replace(/\b(gh[a-z]_[A-Za-z0-9]+|[A-Za-z0-9_-]{20,})\b/g, "[redacted]")
		.slice(0, 200);
}

/**
 * Normalize a domain by stripping any scheme and trailing slash, and validate
 * that the result is a bare hostname (no userinfo, port, path, query, fragment
 * or whitespace) so credentials can never be steered to another destination.
 * @param {string} domain - The domain or URL to normalize
 * @returns {string} The normalized domain
 * @throws {Error} When the domain is not a valid bare hostname
 */
export function normalizeDomain(domain) {
	const host = String(domain || DEFAULT_DOMAIN)
		.trim()
		.replace(/^https?:\/\//i, "")
		.replace(/\/+$/, "")
		.replace(/^\/+/, "");
	if (!HOST_PATTERN.test(host)) {
		throw new Error("Invalid GitHub domain: must be a bare hostname");
	}
	return host;
}

/**
 * Build the device-code and token endpoints for a given domain.
 * @param {string} [domain] - The GitHub domain (e.g. "github.com" or a GHE host)
 * @returns {{ deviceCodeUrl: string, tokenUrl: string }} The endpoint URLs
 */
export function getUrls(domain) {
	if (/^http:\/\//i.test(String(domain || ""))) {
		throw new Error("GitHub device flow requires https");
	}
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
		// normalizeDomain validates the host, so the base can't be redirected.
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
export const API_VERSION = process.env.COPILOT_API_VERSION || "2026-06-01";

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
	if (token !== rejectedToken) rejectedToken = null;
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
 * Read the persisted Copilot token from disk. Pure read: it does not modify the
 * in-memory state. A token previously rejected with 401 is treated as absent.
 * @param {string} [memoryDir] - The memory directory
 * @returns {Promise<string|null>} The access token, or null if not present
 */
export async function getToken(memoryDir) {
	const file = authFilePath(memoryDir);
	try {
		const data = await readFile(file, "utf8");
		const parsed = JSON.parse(data);
		const token = parsed?.access_token || null;
		return token && token !== rejectedToken ? token : null;
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
	// Update memory first so a persistence failure still leaves a usable token.
	copilotToken = token;
	rejectedToken = null;
	await mkdir(dirname(file), { recursive: true, mode: 0o700 });
	const tmp = `${file}.${process.pid}.${Date.now()}.tmp`;
	try {
		await writeFile(tmp, JSON.stringify({ access_token: token, expires: 0 }), {
			mode: 0o600,
			flag: "w",
		});
		await rename(tmp, file);
		await chmod(file, 0o600);
	} catch (err) {
		await unlink(tmp).catch(() => {});
		throw err;
	}
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
		signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
	});
	if (!res.ok) {
		const text = await res.text().catch(() => "");
		throw new Error(
			`Device code request failed: ${res.status} ${res.statusText}${text ? ` — ${redactSnippet(text)}` : ""}`,
		);
	}
	const text = await res.text();
	try {
		return JSON.parse(text);
	} catch {
		throw new Error(`Device code request returned invalid JSON: ${redactSnippet(text)}`);
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
export function pollForToken(deviceCode, opts = {}) {
	// Single-flight: concurrent polls for the same device code share one loop.
	const key = String(deviceCode?.device_code ?? "");
	const existing = pollsInFlight.get(key);
	if (existing) return existing;
	const promise = runPoll(deviceCode, opts).finally(() => pollsInFlight.delete(key));
	pollsInFlight.set(key, promise);
	return promise;
}

/**
 * The polling loop behind `pollForToken`.
 * @param {Object} deviceCode - The device-code response
 * @param {Object} opts - Options (see `pollForToken`)
 * @returns {Promise<{ ok: boolean, token?: string, error?: string }>} The result
 */
async function runPoll(deviceCode, opts) {
	const { clientId = CLIENT_ID, memoryDir, onStatus } = opts;
	const { tokenUrl } = getUrls(resolveDomain(opts));
	let interval = (deviceCode.interval ?? 5) * 1000;
	const safety = opts.pollSafetyMs ?? POLL_SAFETY_MS;
	const maxAttempts = opts.maxPollAttempts ?? MAX_POLL_ATTEMPTS;
	const deadline =
		Number.isFinite(deviceCode.expires_in) && deviceCode.expires_in > 0
			? Date.now() + deviceCode.expires_in * 1000
			: Infinity;
	const notify = (status) => {
		try {
			onStatus?.(status);
		} catch {
			// A failing status callback must not break the flow.
		}
	};
	let attempts = 0;

	while (attempts < maxAttempts) {
		if (Date.now() >= deadline) return { ok: false, error: "Device code expired" };
		attempts += 1;
		const body = new URLSearchParams({
			client_id: clientId,
			device_code: deviceCode.device_code,
			grant_type: "urn:ietf:params:oauth:grant-type:device_code",
		});
		let text;
		try {
			const res = await fetch(tokenUrl, {
				method: "POST",
				headers: {
					"Content-Type": "application/x-www-form-urlencoded",
					Accept: "application/json",
				},
				body: body.toString(),
				signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
			});
			text = await res.text();
		} catch (err) {
			return { ok: false, error: `Token request failed: ${err?.message || err}` };
		}
		let data;
		try {
			data = JSON.parse(text);
		} catch {
			return { ok: false, error: `Token endpoint returned invalid JSON: ${redactSnippet(text)}` };
		}

		if (data.access_token) {
			try {
				await persist(data.access_token, memoryDir);
			} catch {
				// Persisting failed; the token is still usable in memory for this session.
				setCopilotToken(data.access_token);
			}
			return { ok: true, token: data.access_token };
		}

		if (data.error === "authorization_pending") {
			notify("pending");
			await sleep(interval + safety);
			continue;
		}

		if (data.error === "slow_down") {
			// RFC 8628: permanently add 5s to the interval on slow_down.
			interval += 5_000;
			notify("slow_down");
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
	if (copilotToken || (await getToken(memoryDir))) {
		return null;
	}
	try {
		const deviceCode = await requestDeviceCode(opts);
		const verificationUri = deviceCode.verification_uri || deviceCode.verification_uri_complete;
		const userCode = deviceCode.user_code;
		if (!verificationUri || !userCode) {
			return null;
		}
		// `deviceCode` is returned because callers (the TUI) hand it to
		// `pollForToken`; treat it as secret and never log it.
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
 * drops the in-memory token (without deleting the persisted file) and invokes the registered `authRequiredHandler` so
 * the caller can surface a fresh device-flow prompt.
 * @param {string} [memoryDir] - The memory directory
 * @param {string} [baseUrl] - The Copilot API base URL; the token is only sent to its host
 * @returns {Function} A fetch-compatible function
 */
export function createCopilotFetch(memoryDir, baseUrl = DEFAULT_BASE_URL) {
	const dir = memoryDir ? resolve(memoryDir) : memoryDir;
	let trustedHost;
	try {
		trustedHost = new URL(baseUrl).host;
	} catch {
		trustedHost = new URL(DEFAULT_BASE_URL).host;
	}
	return async (input, init = {}) => {
		// Only ever attach the token to the expected Copilot host.
		let trusted = false;
		try {
			const url = typeof input === "string" || input instanceof URL ? input : input?.url;
			const parsed = new URL(url);
			trusted = parsed.protocol === "https:" && parsed.host === trustedHost;
		} catch {
			trusted = false;
		}

		const headers = new Headers(typeof input === "object" && input?.headers ? input.headers : {});
		new Headers(init.headers || {}).forEach((value, key) => headers.set(key, value));

		if (!trusted) {
			// Never leak the SDK's placeholder or any bearer to a foreign host.
			headers.delete("Authorization");
			return fetch(input, { ...init, headers, redirect: "manual" });
		}

		// Load the token into state if not already set, then decorate the
		// Authorization header from state, overriding the SDK's placeholder key.
		let oauthToken = copilotToken;
		if (!oauthToken) {
			oauthToken = await getToken(dir);
			if (oauthToken) copilotToken = oauthToken;
		}
		if (oauthToken) {
			headers.set("Authorization", `Bearer ${oauthToken}`);
		} else {
			headers.delete("Authorization");
		}

		// Derive x-initiator from the request body. Only JSON strings and plain
		// objects are inspected; streams and binary bodies are left alone.
		let body = init.body;
		if (typeof body === "string") {
			try {
				body = JSON.parse(body);
			} catch {
				body = undefined;
			}
		} else if (
			!body ||
			typeof body !== "object" ||
			ArrayBuffer.isView(body) ||
			body instanceof ArrayBuffer ||
			typeof body.getReader === "function" ||
			typeof body.pipe === "function" ||
			typeof body.append === "function"
		) {
			body = undefined;
		}
		headers.set("x-initiator", isAgentInitiated(body) ? "agent" : "user");
		// GitHub's Copilot API requires this marker on any request whose payload
		// contains an image; without it the request fails with
		// `400 missing required Copilot-Vision-Request header for vision
		// requests`. It is a routing hint, not a capability toggle.
		if (isVisionRequest(body)) {
			headers.set("Copilot-Vision-Request", "true");
		}
		headers.set("Openai-Intent", "conversation-edits");
		headers.set("X-GitHub-Api-Version", API_VERSION);
		headers.set("User-Agent", `madz/${APP_VERSION}`);

		// Redirects are not followed so the bearer cannot be forwarded elsewhere.
		const res = await fetch(input, { ...init, headers, redirect: "manual" });
		if (res.status === 401 && oauthToken) {
			// The bearer was rejected. Drop it from memory (the persisted file is
			// kept; the rejected value is simply never reused) and invoke the
			// re-auth handler one flow at a time.
			rejectedToken = oauthToken;
			copilotToken = null;
			if (authRequiredHandler && !authFlowActive) {
				authFlowActive = true;
				const handler = authRequiredHandler;
				(async () => {
					try {
						await Promise.resolve(handler());
					} catch {
						// A failing handler must not affect the response.
					} finally {
						authFlowActive = false;
					}
				})();
			}
		}
		return res;
	};
}
