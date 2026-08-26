import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { filterUrl } from "../sandbox/urlFilter.js";

const DEFAULT_TIMEOUT = 30000;
const DEFAULT_MAX_BODY_SIZE = 10 * 1024 * 1024; // 10MB
const DEFAULT_RATE_LIMIT = 10; // requests per second

/**
 * Simple in-memory rate limiter — tracks request timestamps per URL.
 * @param {string} url - Request URL
 * @param {number} maxRequests - Maximum requests per second
 * @returns {Promise<void>}
 */
async function rateLimit(url, maxRequests) {
	if (!maxRequests || maxRequests <= 0) return;

	const windowMs = 1000; // 1 second window
	const now = Date.now();

	// Get or create the timestamp array for this URL
	if (!rateLimit._windows) {
		rateLimit._windows = new Map();
	}
	let timestamps = rateLimit._windows.get(url);
	if (!timestamps) {
		timestamps = [];
		rateLimit._windows.set(url, timestamps);
	}

	// Remove timestamps outside the window
	const windowStart = now - windowMs;
	while (timestamps.length > 0 && timestamps[0] < windowStart) {
		timestamps.shift();
	}

	// Check if we've exceeded the limit
	if (timestamps.length >= maxRequests) {
		const waitTime = timestamps[0] - windowStart + 1;
		await new Promise((resolve) => setTimeout(resolve, waitTime));
		// Re-check after waiting
		const newTimestamps = rateLimit._windows.get(url);
		const newWindowStart = Date.now() - windowMs;
		while (newTimestamps.length > 0 && newTimestamps[0] < newWindowStart) {
			newTimestamps.shift();
		}
	}

	// Record this request
	const currentTimestamps = rateLimit._windows.get(url);
	currentTimestamps.push(Date.now());
}

// Clean up old entries periodically (every 60 seconds)
setInterval(() => {
	if (rateLimit._windows) {
		const now = Date.now();
		for (const [url, timestamps] of rateLimit._windows) {
			const windowStart = now - 10000; // 10 second cleanup window
			while (timestamps.length > 0 && timestamps[0] < windowStart) {
				timestamps.shift();
			}
			if (timestamps.length === 0) {
				rateLimit._windows.delete(url);
			}
		}
	}
}, 60000);

/**
 * Sanitize response headers by stripping sensitive ones.
 * @param {Headers} headers - Response headers
 * @returns {Record<string, string>}
 */
function sanitizeHeaders(headers) {
	const STRIP_HEADERS = new Set(["set-cookie", "www-authenticate"]);
	const result = {};
	headers.forEach((value, key) => {
		if (!STRIP_HEADERS.has(key.toLowerCase())) {
			result[key] = value;
		}
	});
	return result;
}

/**
 * Make an authenticated HTTP request with allowlist enforcement.
 * @param {string} url - The URL to request
 * @param {object} options - Request options
 * @param {string} [options.method="GET"] - HTTP method
 * @param {Record<string, string>} [options.headers] - Additional headers
 * @param {unknown} [options.body] - Request body
 * @param {object} [options.auth] - Authentication config
 * @param {string} [options.auth.type] - Auth type: "bearer", "basic", "apikey"
 * @param {string} [options.auth.token] - Bearer token or basic password
 * @param {string} [options.auth.key] - API key name
 * @param {number} [options.timeout] - Request timeout in ms
 * @param {string[]} [options.allowlist] - URL allowlist
 * @returns {Promise<{ ok: boolean, status?: number, headers?: Record<string, string>, body?: string, error?: string }>}
 */
export async function makeApiRequest(
	url,
	{
		method = "GET",
		headers: extraHeaders = {},
		body,
		auth,
		timeout = DEFAULT_TIMEOUT,
		allowlist = [],
		maxBodySize = DEFAULT_MAX_BODY_SIZE,
	} = {},
) {
	const validation = filterUrl(url, allowlist);
	if (!validation.allowed) {
		return { ok: false, error: validation.reason };
	}

	// Apply rate limiting per URL
	await rateLimit(url, DEFAULT_RATE_LIMIT);

	const controller = new AbortController();
	const timeoutId = setTimeout(() => controller.abort(), timeout);

	try {
		const fetchHeaders = { ...extraHeaders };

		// Apply authentication
		if (auth) {
			if (auth.type === "bearer" && auth.token) {
				fetchHeaders["Authorization"] = `Bearer ${auth.token}`;
			} else if (auth.type === "basic" && auth.token) {
				const encoded = Buffer.from(auth.token).toString("base64");
				fetchHeaders["Authorization"] = `Basic ${encoded}`;
			} else if (auth.type === "apikey" && auth.key && auth.token) {
				fetchHeaders[auth.key] = auth.token;
			}
		}

		// Set content type for body
		if (body && typeof body === "object" && !extraHeaders["Content-Type"]) {
			fetchHeaders["Content-Type"] = "application/json";
		}

		const fetchOptions = {
			method,
			headers: fetchHeaders,
			signal: controller.signal,
		};

		if (body && (method === "POST" || method === "PUT" || method === "PATCH")) {
			fetchOptions.body = typeof body === "string" ? body : JSON.stringify(body);
		}

		const resp = await fetch(url, fetchOptions);
		clearTimeout(timeoutId);

		// Read body with size limit
		const bodySize = resp.headers.get("content-length");
		if (bodySize && parseInt(bodySize, 10) > maxBodySize) {
			return {
				ok: false,
				status: resp.status,
				error: `Response body too large: ${bodySize} bytes (max: ${maxBodySize})`,
			};
		}

		const text = await resp.text();
		if (text.length > maxBodySize) {
			return {
				ok: false,
				status: resp.status,
				error: `Response body too large: ${text.length} bytes (max: ${maxBodySize})`,
			};
		}

		return {
			ok: true,
			status: resp.status,
			headers: sanitizeHeaders(resp.headers),
			body: text,
		};
	} catch (err) {
		clearTimeout(timeoutId);
		if (err.name === "AbortError") {
			return { ok: false, error: `Request timed out after ${timeout}ms` };
		}
		return { ok: false, error: err.message || "Request failed" };
	}
}

/**
 * REST API client tool — make authenticated GET/POST/PUT/DELETE requests.
 * @param {string} input - JSON string with url, method, headers, body, auth, timeout, allowlist
 * @returns {Promise<{ ok: boolean, status?: number, headers?: Record<string, string>, body?: string, error?: string }>}
 */
export async function api(input) {
	let parsed;
	try {
		parsed = JSON.parse(input);
	} catch {
		return { ok: false, error: "Invalid JSON input" };
	}
	return apiImpl(parsed);
}

/**
 * REST API client implementation — takes a validated plain object.
 * @param {object} input - Parsed input object
 * @returns {Promise<{ ok: boolean, status?: number, headers?: Record<string, string>, body?: string, error?: string }>}
 */
export async function apiImpl(input) {
	const schema = z.object({
		url: z.string().url(),
		method: z.enum(["GET", "POST", "PUT", "DELETE", "PATCH"]).optional().default("GET"),
		headers: z.record(z.string()).optional(),
		body: z.unknown().optional(),
		auth: z
			.object({
				type: z.enum(["bearer", "basic", "apikey"]),
				token: z.string().optional(),
				key: z.string().optional(),
			})
			.optional(),
		timeout: z.number().int().positive().optional(),
		allowlist: z.array(z.string()).optional(),
		maxBodySize: z.number().int().positive().optional(),
	});

	const validated = schema.safeParse(input);
	if (!validated.success) {
		return {
			ok: false,
			error: `Invalid input: ${validated.error.issues.map((e) => `${e.path.join(".")}: ${e.message}`).join(", ")}`,
		};
	}

	return makeApiRequest(validated.data.url, {
		method: validated.data.method,
		headers: validated.data.headers,
		body: validated.data.body,
		auth: validated.data.auth,
		timeout: validated.data.timeout || DEFAULT_TIMEOUT,
		allowlist: validated.data.allowlist || [],
		maxBodySize: validated.data.maxBodySize || DEFAULT_MAX_BODY_SIZE,
	});
}

/**
 * Create the LangChain tool wrapper for the REST API client.
 * @returns {object} LangChain Tool instance
 */
export function createApiTool() {
	return tool(
		async (input) => {
			const result = await apiImpl(input);
			return JSON.stringify(result, null, 2);
		},
		{
			name: "api",
			description:
				"Make authenticated HTTP requests (GET/POST/PUT/DELETE/PATCH) to external APIs. Supports bearer, basic, and API key authentication. Enforces URL allowlist and scheme blocking. Response headers are sanitized (Set-Cookie, WWW-Authenticate stripped). Default timeout: 30s. Max response body: 10MB.",
			schema: z.object({
				url: z.string().url().describe("Target URL"),
				method: z
					.enum(["GET", "POST", "PUT", "DELETE", "PATCH"])
					.optional()
					.default("GET")
					.describe("HTTP method"),
				headers: z.record(z.string()).optional().describe("Additional HTTP headers"),
				body: z
					.unknown()
					.optional()
					.describe("Request body (auto-serialized to JSON for non-GET requests)"),
				auth: z
					.object({
						type: z.enum(["bearer", "basic", "apikey"]).describe("Authentication type"),
						token: z
							.string()
							.optional()
							.describe("Auth token (bearer token, basic password, or API key value)"),
						key: z.string().optional().describe("API key header name (for apikey auth type)"),
					})
					.optional()
					.describe("Authentication configuration"),
				timeout: z
					.number()
					.int()
					.positive()
					.optional()
					.describe("Request timeout in milliseconds (default: 30000)"),
				allowlist: z
					.array(z.string())
					.optional()
					.describe("URL allowlist — hosts must match one entry"),
				maxBodySize: z
					.number()
					.int()
					.positive()
					.optional()
					.describe("Maximum response body size in bytes (default: 10485760)"),
			}),
		},
	);
}
