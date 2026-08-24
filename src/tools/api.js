import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { filterUrl } from "../sandbox/urlFilter.js";
import { parseSizeString } from "./common.js";

const DEFAULT_TIMEOUT = 30000;
const DEFAULT_MAX_RESPONSE_SIZE = "10mb";

/**
 * Zod schema for REST API client input.
 */
export const ApiClientSchema = z.object({
	url: z.string().url().describe("Target URL (http/https only)"),
	method: z
		.enum(["GET", "POST", "PUT", "DELETE", "PATCH"])
		.optional()
		.describe("HTTP method (default: GET)"),
	headers: z.record(z.string()).optional().describe("Custom headers"),
	body: z.any().optional().describe("Request body (auto-serialized for POST/PUT/PATCH)"),
	auth: z
		.object({
			type: z.enum(["bearer", "basic", "apikey"]).describe("Authentication type"),
			token: z.string().optional().describe("Bearer token or API key"),
			username: z.string().optional().describe("Basic auth username"),
			password: z.string().optional().describe("Basic auth password"),
			headerName: z.string().optional().describe("API key header name (default: X-API-Key)"),
		})
		.optional()
		.describe("Authentication configuration"),
	timeout: z
		.number()
		.int()
		.positive()
		.optional()
		.describe("Request timeout in ms (default: 30000)"),
	maxResponseSize: z.string().optional().describe("Max response body size (default: 10mb)"),
});

/**
 * Build auth headers from auth config.
 * @param {object} auth - Authentication config
 * @returns {object} Headers object with auth
 */
function buildAuthHeaders(auth) {
	const headers = {};

	if (auth.type === "bearer" && auth.token) {
		headers["Authorization"] = `Bearer ${auth.token}`;
	} else if (auth.type === "basic" && auth.username && auth.password) {
		const encoded = Buffer.from(`${auth.username}:${auth.password}`).toString("base64");
		headers["Authorization"] = `Basic ${encoded}`;
	} else if (auth.type === "apikey" && auth.token) {
		const headerName = auth.headerName || "X-API-Key";
		headers[headerName] = auth.token;
	}

	return headers;
}

/**
 * Execute a REST API request with full security controls.
 * @param {z.infer<typeof ApiClientSchema>} input - Tool input
 * @returns {Promise<object>} Response object
 */
export async function apiClient(input) {
	const {
		url,
		method = "GET",
		headers: customHeaders = {},
		body,
		auth,
		timeout,
		maxResponseSize,
	} = input;

	// Validate URL
	const urlValidation = filterUrl(url);
	if (!urlValidation.allowed) {
		return { ok: false, error: urlValidation.reason };
	}

	// Build request config
	const timeoutMs = timeout || DEFAULT_TIMEOUT;
	const maxBytes = parseSizeString(maxResponseSize || DEFAULT_MAX_RESPONSE_SIZE);
	const controller = new AbortController();
	const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

	const requestHeaders = { ...customHeaders };

	// Add auth headers
	if (auth) {
		const authHeaders = buildAuthHeaders(auth);
		Object.assign(requestHeaders, authHeaders);
	}

	// Auto-set content type for methods with body
	if (body && ["POST", "PUT", "PATCH"].includes(method)) {
		if (typeof body === "object" && !Buffer.isBuffer(body)) {
			requestHeaders["Content-Type"] = "application/json";
		}
	}

	const requestOptions = {
		method,
		headers: requestHeaders,
		signal: controller.signal,
	};

	if (body && ["POST", "PUT", "PATCH"].includes(method)) {
		requestOptions.body = typeof body === "string" ? body : JSON.stringify(body);
	}

	try {
		const response = await fetch(url, requestOptions);
		clearTimeout(timeoutId);

		// Read body with size limit
		const responseText = await response.text();

		if (responseText.length > maxBytes) {
			return {
				ok: false,
				error: `Response size (${responseText.length} bytes) exceeds limit (${maxBytes} bytes)`,
				status: response.status,
				statusText: response.statusText,
			};
		}

		// Try to parse JSON response
		let parsedBody;
		try {
			parsedBody = JSON.parse(responseText);
		} catch (_err) {
			parsedBody = responseText;
		}

		return {
			ok: response.ok,
			status: response.status,
			statusText: response.statusText,
			body: parsedBody,
			headers: Object.fromEntries(response.headers.entries()),
		};
	} catch (err) {
		clearTimeout(timeoutId);
		const reason =
			err.name === "AbortError" ? `Request timed out after ${timeoutMs}ms` : err.message;
		return { ok: false, error: reason };
	}
}

/**
 * REST API client tool — make authenticated HTTP requests.
 */
export const apiClientTool = tool(apiClient, {
	name: "apiClient",
	description:
		"Make authenticated REST API requests (GET, POST, PUT, DELETE, PATCH) with URL validation, timeout, and response size limits.",
	schema: ApiClientSchema,
});
