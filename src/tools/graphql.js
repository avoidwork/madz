import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { filterUrl } from "../sandbox/urlFilter.js";

const DEFAULT_TIMEOUT = 30000;
const DEFAULT_MAX_DEPTH = 10;
const DEFAULT_MAX_COMPLEXITY = 1000;
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

	if (!rateLimit._windows) {
		rateLimit._windows = new Map();
	}
	let timestamps = rateLimit._windows.get(url);
	if (!timestamps) {
		timestamps = [];
		rateLimit._windows.set(url, timestamps);
	}

	const windowStart = now - windowMs;
	while (timestamps.length > 0 && timestamps[0] < windowStart) {
		timestamps.shift();
	}

	if (timestamps.length >= maxRequests) {
		const waitTime = timestamps[0] - windowStart + 1;
		await new Promise((resolve) => setTimeout(resolve, waitTime));
		const newTimestamps = rateLimit._windows.get(url);
		const newWindowStart = Date.now() - windowMs;
		while (newTimestamps.length > 0 && newTimestamps[0] < newWindowStart) {
			newTimestamps.shift();
		}
	}

	const currentTimestamps = rateLimit._windows.get(url);
	currentTimestamps.push(Date.now());
}

// Clean up old entries periodically
setInterval(() => {
	if (rateLimit._windows) {
		const now = Date.now();
		for (const [url, timestamps] of rateLimit._windows) {
			const windowStart = now - 10000;
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
 * Simple query depth analyzer — walks the parsed query AST to compute max depth.
 * @param {string} query - GraphQL query string
 * @returns {number} Max depth
 */
function analyzeDepth(query) {
	let maxDepth = 0;
	let currentDepth = 0;
	let inString = false;
	let escapeNext = false;

	for (let i = 0; i < query.length; i++) {
		const ch = query[i];

		if (escapeNext) {
			escapeNext = false;
			continue;
		}

		if (ch === "\\") {
			escapeNext = true;
			continue;
		}

		if (ch === '"') {
			inString = !inString;
			continue;
		}

		if (inString) continue;

		if (ch === "{") {
			currentDepth++;
			maxDepth = Math.max(maxDepth, currentDepth);
		} else if (ch === "}") {
			currentDepth = Math.max(0, currentDepth - 1);
		}
	}

	return maxDepth;
}

/**
 * Simple query complexity estimator — counts selections, arguments, and fragments.
 * @param {string} query - GraphQL query string
 * @returns {number} Estimated complexity
 */
function estimateComplexity(query) {
	// Count field selections (opening braces not in strings)
	let selections = 0;
	let inString = false;
	let escapeNext = false;
	let inComment = false;

	for (let i = 0; i < query.length; i++) {
		const ch = query[i];

		if (escapeNext) {
			escapeNext = false;
			continue;
		}

		if (ch === "\\") {
			escapeNext = true;
			continue;
		}

		if (ch === '"') {
			inString = !inString;
			continue;
		}

		if (inString) continue;

		// Handle multi-line comments
		if (ch === "#" && !inString) {
			inComment = true;
			continue;
		}
		if (ch === "\n") {
			inComment = false;
			continue;
		}
		if (inComment) continue;

		if (ch === "{") {
			selections++;
		}
	}

	// Count arguments (key: value pairs)
	const argMatches = query.match(/(?<!=)\s+\w+\s*:/g);
	const args = argMatches ? argMatches.length : 0;

	// Count fragment spreads and inline fragments
	const fragments = (query.match(/.../g) || []).length;

	// Base complexity: 1 per selection + 2 per argument + 5 per fragment
	return selections + args * 2 + fragments * 5;
}

/**
 * Execute a GraphQL query or mutation.
 * @param {string} url - GraphQL endpoint URL
 * @param {string} query - GraphQL query/mutation string
 * @param {object} [variables] - Query variables
 * @param {string} [operationName] - Operation name
 * @param {number} [timeout] - Request timeout in ms
 * @param {number} [maxDepth] - Maximum query depth
 * @param {number} [maxComplexity] - Maximum query complexity
 * @param {string[]} [allowlist] - URL allowlist
 * @param {boolean} [isIntrospection] - Skip depth/complexity analysis for introspection
 * @returns {Promise<{ ok: boolean, data?: unknown, error?: string }>}
 */
export async function executeGraphQL(
	url,
	query,
	variables = {},
	operationName,
	timeout = DEFAULT_TIMEOUT,
	maxDepth = DEFAULT_MAX_DEPTH,
	maxComplexity = DEFAULT_MAX_COMPLEXITY,
	allowlist = [],
	isIntrospection = false,
) {
	const validation = filterUrl(url, allowlist);
	if (!validation.allowed) {
		return { ok: false, error: validation.reason };
	}

	// Apply rate limiting per URL
	await rateLimit(url, DEFAULT_RATE_LIMIT);

	// Skip depth/complexity analysis for introspection queries
	if (!isIntrospection) {
		// Analyze query constraints
		const depth = analyzeDepth(query);
		if (depth > maxDepth) {
			return {
				ok: false,
				error: `Query depth ${depth} exceeds maximum allowed depth ${maxDepth}`,
			};
		}

		const complexity = estimateComplexity(query);
		if (complexity > maxComplexity) {
			return {
				ok: false,
				error: `Query complexity ${complexity} exceeds maximum allowed complexity ${maxComplexity}`,
			};
		}
	}

	try {
		// Use native fetch with graphql-request style body
		const controller = new AbortController();
		const timeoutId = setTimeout(() => controller.abort(), timeout);

		const body = JSON.stringify({
			query,
			variables,
			...(operationName ? { operationName } : {}),
		});

		const resp = await fetch(url, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body,
			signal: controller.signal,
		});

		clearTimeout(timeoutId);

		if (!resp.ok) {
			const text = await resp.text().catch(() => "");
			return { ok: false, error: `GraphQL request failed (${resp.status}): ${text.slice(0, 500)}` };
		}

		const result = await resp.json();

		// If there are errors in the response, include them
		if (result.errors && result.errors.length > 0) {
			return {
				ok: false,
				data: result.data,
				error: `GraphQL errors: ${result.errors.map((e) => e.message).join("; ")}`,
			};
		}

		return { ok: true, data: result.data };
	} catch (err) {
		if (err.name === "AbortError") {
			return { ok: false, error: `GraphQL request timed out after ${timeout}ms` };
		}
		return { ok: false, error: err.message || "GraphQL request failed" };
	}
}

/**
 * Standard GraphQL introspection query.
 * @returns {string}
 */
const INTROSPECTION_QUERY = `
  query IntrospectionQuery {
    __schema {
      queryType { name }
      mutationType { name }
      subscriptionType { name }
      types {
        ...FullType
      }
      directives {
        name
        description
        locations
        args {
          ...InputValue
        }
      }
    }
  }
  fragment FullType on __Type {
    kind
    name
    description
    fields(includeDeprecated: true) {
      name
      description
      args {
        ...InputValue
      }
      type { ...TypeRef }
      isDeprecated
      deprecationReason
    }
    inputFields {
      ...InputValue
    }
    interfaces {
      ...TypeRef
    }
    enumValues(includeDeprecated: true) {
      name
      description
      isDeprecated
      deprecationReason
    }
    possibleTypes {
      ...TypeRef
    }
  }
  fragment InputValue on __InputValue {
    name
    description
    type { ...TypeRef }
    defaultValue
  }
  fragment TypeRef on __Type {
    kind
    name
    ofType {
      kind
      name
      ofType {
        kind
        name
        ofType {
          kind
          name
          ofType {
            kind
            name
            ofType {
              kind
              name
              ofType {
                kind
                name
                ofType {
                  kind
                  name
                }
              }
            }
          }
        }
      }
    }
  }
`;

/**
 * GraphQL client tool — execute queries and mutations against GraphQL endpoints.
 * @param {string} input - JSON string with url, query, variables, operationName, timeout, maxDepth, maxComplexity, allowlist
 * @returns {Promise<{ ok: boolean, data?: unknown, error?: string }>}
 */
export async function graphql(input) {
	let parsed;
	try {
		parsed = JSON.parse(input);
	} catch {
		return { ok: false, error: "Invalid JSON input" };
	}
	return graphqlImpl(parsed);
}

/**
 * GraphQL client implementation — takes a plain object.
 * @param {object} input - Parsed input object
 * @returns {Promise<{ ok: boolean, data?: unknown, error?: string }>}
 */
export async function graphqlImpl(input) {
	const schema = z.object({
		url: z.string().url(),
		query: z
			.string()
			.optional()
			.describe("GraphQL query/mutation string (required for query/mutation actions)"),
		variables: z.record(z.unknown()).optional(),
		operationName: z.string().optional(),
		timeout: z.number().int().positive().optional(),
		maxDepth: z.number().int().positive().optional(),
		maxComplexity: z.number().int().positive().optional(),
		allowlist: z.array(z.string()).optional(),
	});

	const validated = schema.safeParse(input);
	if (!validated.success) {
		return {
			ok: false,
			error: `Invalid input: ${validated.error.issues.map((e) => `${e.path.join(".")}: ${e.message}`).join(", ")}`,
		};
	}

	const { url, query, variables, operationName, timeout, maxDepth, maxComplexity, allowlist } =
		validated.data;

	// Introspection — no depth/complexity limits
	if (!query) {
		return executeGraphQL(
			url,
			INTROSPECTION_QUERY,
			variables || {},
			operationName,
			timeout || DEFAULT_TIMEOUT,
			maxDepth,
			maxComplexity,
			allowlist || [],
			true, // isIntrospection
		);
	}

	return executeGraphQL(
		url,
		query,
		variables || {},
		operationName,
		timeout || DEFAULT_TIMEOUT,
		maxDepth || DEFAULT_MAX_DEPTH,
		maxComplexity || DEFAULT_MAX_COMPLEXITY,
		allowlist || [],
		false, // isIntrospection
	);
}

/**
 * Schema introspection tool — fetch the GraphQL schema.
 * @param {string} input - JSON string with url, timeout, allowlist
 * @returns {Promise<{ ok: boolean, schema?: string, error?: string }>}
 */
export async function introspectSchema(input) {
	let parsed;
	try {
		parsed = JSON.parse(input);
	} catch {
		return { ok: false, error: "Invalid JSON input" };
	}

	const schema = z.object({
		url: z.string().url(),
		timeout: z.number().int().positive().optional(),
		allowlist: z.array(z.string()).optional(),
	});

	const validated = schema.safeParse(parsed);
	if (!validated.success) {
		return {
			ok: false,
			error: `Invalid input: ${validated.error.issues.map((e) => `${e.path.join(".")}: ${e.message}`).join(", ")}`,
		};
	}

	const introspectionQuery = `{
		__schema {
			queryType { name }
			mutationType { name }
			types { name kind }
			directives { name description locations args { name type { name kind } description } }
		}
	}`;

	return executeGraphQL(
		validated.data.url,
		introspectionQuery,
		{},
		undefined,
		validated.data.timeout || DEFAULT_TIMEOUT,
		DEFAULT_MAX_DEPTH,
		DEFAULT_MAX_COMPLEXITY,
		validated.data.allowlist || [],
	);
}

/**
 * Create the LangChain tool wrapper for the GraphQL client.
 * @returns {object} LangChain Tool instance
 */
export function createGraphqlTool() {
	return tool(
		async (input) => {
			const result = await graphqlImpl(input);
			return JSON.stringify(result, null, 2);
		},
		{
			name: "graphql",
			description:
				"Execute GraphQL queries and mutations against a GraphQL endpoint. Supports query variables, operation names, and schema introspection. Enforces query depth limits (default: 10) and complexity limits (default: 1000) to prevent DoS. Default timeout: 30s.",
			schema: z.object({
				url: z.string().url().describe("GraphQL endpoint URL"),
				query: z.string().min(1).describe("GraphQL query or mutation string"),
				variables: z.record(z.unknown()).optional().describe("Query variables as key-value pairs"),
				operationName: z
					.string()
					.optional()
					.describe("Operation name (for multi-operation documents)"),
				timeout: z
					.number()
					.int()
					.positive()
					.optional()
					.describe("Request timeout in milliseconds (default: 30000)"),
				maxDepth: z
					.number()
					.int()
					.positive()
					.optional()
					.describe("Maximum query depth (default: 10)"),
				maxComplexity: z
					.number()
					.int()
					.positive()
					.optional()
					.describe("Maximum query complexity (default: 1000)"),
				allowlist: z
					.array(z.string())
					.optional()
					.describe("URL allowlist — host must match one entry"),
			}),
		},
	);
}
