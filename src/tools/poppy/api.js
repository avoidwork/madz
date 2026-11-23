import { z } from "zod";
import { MCPAdapter } from "@langchain/mcp-adapters";
import { fetchJson } from "./common.js";
import { validateUrl } from "./discovery.js";
import { buildExtensionsHeader } from "./extensions.js";
import { signClientAssertion } from "./identity.js";

/** Poppy protocol version sent as the `Poppy-Version` header. */
const POPPY_VERSION = "1.0";

/** Access token error codes mapped to HTTP status per Poppy spec section 7. */
const TOKEN_ERROR_STATUS = Object.freeze({
	invalid_token: 401,
	insufficient_scope: 403,
	invalid_session: 400,
	session_ended: 400,
	version_unsupported: 400,
	extension_required: 403,
});

/**
 * Zod schema for the `api` action input. Required fields: `op`. Optional
 * fields: `task`, `apiType`, `endpoint`, `method`, `path`, `body`,
 * `session`, `accessToken`, `version`, `extensions`, `scope`,
 * `idempotencyKey`, `poppyJson`, `tokenEndpoint`.
 */
export const ApiInputSchema = z.object({
	op: z.string().min(1),
	task: z.string().optional(),
	apiType: z.enum(["openapi", "mcp"]).optional(),
	endpoint: z.string().optional(),
	method: z.string().optional(),
	path: z.string().optional(),
	body: z.unknown().optional(),
	session: z.string().optional(),
	accessToken: z.string().optional(),
	version: z.string().optional(),
	extensions: z.record(z.string(), z.array(z.unknown())).optional(),
	scope: z.string().optional(),
	grantedScopes: z.string().optional(),
	idempotencyKey: z.string().optional(),
	poppyJson: z.unknown().optional(),
	tokenEndpoint: z.string().optional(),
});

/**
 * Zod schema for a Poppy `poppy.json` `apis` entry. Required fields: `type`,
 * `url`, `description`.
 */
const ApiEntrySchema = z.object({
	type: z.string().min(1),
	url: z.string().min(1),
	description: z.string().min(1),
});

/**
 * Select the right API entry from a `poppy.json` document for a task.
 * @param {object} poppyJson - The parsed poppy.json document
 * @param {string} task - The task description to match against
 * @returns {{ok: boolean, data?: object, error?: string}} Result
 */
export function selectApi(poppyJson, task) {
	const apis = poppyJson?.apis;
	if (!Array.isArray(apis) || apis.length === 0) {
		return { ok: false, error: "poppy.json declares no apis" };
	}
	const entries = apis.map((entry) => ApiEntrySchema.safeParse(entry));
	const valid = entries.filter((e) => e.success).map((e) => e.data);
	if (valid.length === 0) {
		return { ok: false, error: "poppy.json apis entries are invalid" };
	}
	const taskLower = (task ?? "").toLowerCase();
	let match = null;
	for (const entry of valid) {
		if (entry.type === "openapi" || entry.type === "mcp") {
			if (taskLower && entry.description.toLowerCase().includes(taskLower)) {
				match = entry;
				break;
			}
		}
	}
	if (!match) {
		return { ok: false, error: "No openapi or mcp API matches the task" };
	}
	return { ok: true, data: match };
}

/**
 * Build the request headers for an OpenAPI call, including the Poppy-Session,
 * Poppy-Version, Poppy-Extensions, and access token headers as needed.
 * @param {object} input - Tool input
 * @param {string} [input.session] - The Poppy-Session JWT
 * @param {string} [input.accessToken] - The access token
 * @param {string} [input.version] - The Poppy protocol version
 * @param {object} [input.extensions] - Poppy extensions
 * @param {string} [input.idempotencyKey] - Idempotency key
 * @returns {object} The request headers
 */
export function buildHeaders(input) {
	const headers = {};
	if (input.session) {
		headers["Poppy-Session"] = input.session;
	}
	if (input.accessToken) {
		headers.authorization = `Bearer ${input.accessToken}`;
	}
	if (input.version) {
		headers["Poppy-Version"] = input.version;
	} else {
		headers["Poppy-Version"] = POPPY_VERSION;
	}
	if (input.extensions && Object.keys(input.extensions).length > 0) {
		const header = buildExtensionsHeader(input.extensions);
		if (header) {
			headers["Poppy-Extensions"] = header;
		}
	}
	if (input.idempotencyKey) {
		headers["Idempotency-Key"] = input.idempotencyKey;
	}
	return headers;
}

/**
 * Map an access token error code to its HTTP status per Poppy spec section 7.
 * @param {string} code - The Poppy error code
 * @returns {number} The HTTP status
 */
export function tokenErrorStatus(code) {
	return TOKEN_ERROR_STATUS[code] ?? 500;
}

/**
 * Enforce a required scope against the granted scopes, returning
 * `insufficient_scope` (403) when not granted.
 * @param {string} requiredScope - The required scope
 * @param {string} grantedScopes - The granted scopes (space-delimited)
 * @returns {{ok: boolean, error?: string, code?: string}} Result
 */
export function enforceScope(requiredScope, grantedScopes) {
	if (!requiredScope) {
		return { ok: true };
	}
	const granted = (grantedScopes ?? "").split(/\s+/).filter(Boolean);
	if (!granted.includes(requiredScope)) {
		return { ok: false, error: `Insufficient scope: ${requiredScope}`, code: "insufficient_scope" };
	}
	return { ok: true };
}

/**
 * Call an OpenAPI endpoint with the Poppy headers and access token.
 * @param {object} input - Tool input
 * @param {string} input.endpoint - The OpenAPI endpoint URL
 * @param {string} [input.method="GET"] - The HTTP method
 * @param {unknown} [input.body] - The request body
 * @param {object} [options] - Runtime options
 * @returns {Promise<{ok: boolean, data?: object, error?: string, code?: string}>} Result
 */
export async function callOpenApi(input, options = {}) {
	const endpoint = input.endpoint;
	if (!endpoint) {
		return { ok: false, error: "endpoint is required" };
	}
	const validation = await validateUrl(endpoint);
	if (!validation.ok) {
		return { ok: false, error: validation.error };
	}
	const headers = buildHeaders(input);
	const result = await fetchJson(endpoint, {
		method: input.method ?? "GET",
		headers,
		body: input.body !== undefined ? JSON.stringify(input.body) : undefined,
		...options,
	});
	if (!result.ok) {
		const code = result.data?.error ?? result.data?.code;
		if (code && TOKEN_ERROR_STATUS[code]) {
			return { ok: false, error: result.error, code, status: TOKEN_ERROR_STATUS[code] };
		}
		return { ok: false, error: result.error };
	}
	return { ok: true, data: result.data };
}

/**
 * Call a remote MCP server over Streamable HTTP transport with the session
 * header, requesting a token with `resource` set to the MCP server's URL.
 * @param {object} input - Tool input
 * @param {string} input.endpoint - The MCP server URL
 * @param {string} [input.task] - The task to perform on the MCP server
 * @param {object} [options] - Runtime options
 * @returns {Promise<{ok: boolean, data?: object, error?: string, code?: string}>} Result
 */
export async function callMcp(input, _options = {}) {
	const endpoint = input.endpoint;
	if (!endpoint) {
		return { ok: false, error: "endpoint is required" };
	}
	const validation = await validateUrl(endpoint);
	if (!validation.ok) {
		return { ok: false, error: validation.error };
	}

	// Request a token with `resource` set to the MCP server's URL, using a
	// `private_key_jwt` client assertion rather than `client_credentials`.
	let accessToken = input.accessToken;
	if (!accessToken && input.tokenEndpoint) {
		const body = new URLSearchParams({
			grant_type: "client_credentials",
			resource: endpoint,
		});
		if (input.privateKey && input.clientId) {
			const assertion = await signClientAssertion({
				privateKey: input.privateKey,
				clientId: input.clientId,
				audience: input.issuer ?? new URL(input.tokenEndpoint).origin,
			});
			body.set("client_assertion_type", "urn:ietf:params:oauth:client-assertion-type:jwt-bearer");
			body.set("client_assertion", assertion.jwt);
		}
		const tokenResult = await fetchJson(input.tokenEndpoint, {
			method: "POST",
			headers: { "content-type": "application/x-www-form-urlencoded" },
			body: body.toString(),
		});
		if (!tokenResult.ok) {
			return { ok: false, error: `Token request failed: ${tokenResult.error}` };
		}
		accessToken = tokenResult.data?.access_token;
	}

	const headers = buildHeaders({ ...input, accessToken });
	const adapter = new MCPAdapter({
		servers: {
			poppy: {
				transport: "http",
				url: endpoint,
				headers,
			},
		},
		onConnectionError: "ignore",
	});
	try {
		const tools = await adapter.listTools();
		const tool = tools.find((t) => t.name.includes(input.task ?? ""));
		if (!tool) {
			return { ok: false, error: `No MCP tool matches task: ${input.task}` };
		}
		const result = await tool.invoke(input.body ?? {});
		return { ok: true, data: result };
	} catch (err) {
		return { ok: false, error: err.message };
	} finally {
		await adapter.close();
	}
}

/**
 * Dispatch the `api` action on its `op` field.
 * @param {object} input - Tool input
 * @param {object} [options] - Runtime options
 * @returns {Promise<{ok: boolean, data?: object, error?: string, code?: string}>} Result
 */
export async function execute(input, options = {}) {
	const parsed = ApiInputSchema.safeParse(input);
	if (!parsed.success) {
		return {
			ok: false,
			error: `Invalid api input: ${parsed.error.issues.map((i) => i.message).join("; ")}`,
		};
	}
	const data = parsed.data;
	switch (data.op) {
		case "select":
			return selectApi(data.poppyJson, data.task);
		case "call":
			if (data.apiType === "mcp") {
				return callMcp(data, options);
			}
			return callOpenApi(data, options);
		case "enforce_scope":
			return enforceScope(data.scope, data.grantedScopes);
		default:
			return { ok: false, error: `Unknown api operation: ${data.op}` };
	}
}
