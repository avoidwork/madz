import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { filterUrl } from "../sandbox/urlFilter.js";

const DEFAULT_TIMEOUT = 30000;
const DEFAULT_MAX_DEPTH = 10;
const DEFAULT_MAX_COMPLEXITY = 1000;

/**
 * Zod schema for GraphQL client input.
 */
export const GraphQLClientSchema = z.object({
	url: z.string().url().describe("GraphQL endpoint URL"),
	query: z.string().describe("GraphQL query or mutation string"),
	variables: z.record(z.any()).optional().describe("Query variables"),
	operationName: z.string().optional().describe("Operation name"),
	timeout: z
		.number()
		.int()
		.positive()
		.optional()
		.describe("Request timeout in ms (default: 30000)"),
	headers: z.record(z.string()).optional().describe("Custom headers"),
	introspection: z.boolean().optional().describe("Enable schema introspection (default: false)"),
	maxDepth: z.number().int().positive().optional().describe("Max query depth (default: 10)"),
	maxComplexity: z
		.number()
		.int()
		.positive()
		.optional()
		.describe("Max query complexity (default: 1000)"),
});

/**
 * Calculate query depth from AST.
 * @param {string} query - GraphQL query string
 * @returns {number} Maximum depth
 */
function calculateDepth(query) {
	let maxDepth = 0;
	let currentDepth = 0;
	let inBlock = false;

	for (let i = 0; i < query.length; i++) {
		const char = query[i];
		if (char === "{") {
			currentDepth++;
			if (currentDepth > maxDepth) maxDepth = currentDepth;
		} else if (char === "}") {
			currentDepth--;
		} else if (char === '"') {
			// Skip string literals
			inBlock = !inBlock;
			while (inBlock && i < query.length - 1) {
				i++;
				if (query[i] === '"') {
					inBlock = false;
				}
			}
		}
	}

	return maxDepth;
}

/**
 * Estimate query complexity.
 * @param {string} query - GraphQL query string
 * @returns {number} Estimated complexity
 */
function estimateComplexity(query) {
	// Count field selections (rough estimate)
	const fieldMatches = query.match(/\b[a-zA-Z_][a-zA-Z0-9_]*\s*\(/g);
	const fieldCount = fieldMatches ? fieldMatches.length : 0;

	// Count nested selections
	const openBraces = (query.match(/\{/g) || []).length;
	const closeBraces = (query.match(/\}/g) || []).length;
	const nestingLevel = Math.min(openBraces, closeBraces);

	// Each level of nesting multiplies complexity
	return fieldCount * (nestingLevel + 1);
}

/**
 * Check if a query is an introspection query.
 * @param {string} query - GraphQL query string
 * @returns {boolean}
 */
function isIntrospectionQuery(query) {
	return query.includes("__schema") || query.includes("__type");
}

/**
 * Execute a GraphQL query or mutation.
 * @param {z.infer<typeof GraphQLClientSchema>} input - Tool input
 * @returns {Promise<object>} Response object
 */
export async function graphQLClient(input) {
	const {
		url,
		query,
		variables,
		operationName,
		timeout,
		headers: customHeaders = {},
		introspection,
		maxDepth,
		maxComplexity,
	} = input;

	// Validate URL
	const urlValidation = filterUrl(url);
	if (!urlValidation.allowed) {
		return { ok: false, error: urlValidation.reason };
	}

	// Check introspection
	if (!introspection && isIntrospectionQuery(query)) {
		return { ok: false, error: "Introspection is disabled. Enable introspection to query schema." };
	}

	// Check depth limit
	const depth = calculateDepth(query);
	if (depth > (maxDepth || DEFAULT_MAX_DEPTH)) {
		return {
			ok: false,
			error: `Query depth (${depth}) exceeds limit (${maxDepth || DEFAULT_MAX_DEPTH})`,
		};
	}

	// Check complexity limit
	const complexity = estimateComplexity(query);
	if (complexity > (maxComplexity || DEFAULT_MAX_COMPLEXITY)) {
		return {
			ok: false,
			error: `Query complexity (${complexity}) exceeds limit (${maxComplexity || DEFAULT_MAX_COMPLEXITY})`,
		};
	}

	// Build request
	const timeoutMs = timeout || DEFAULT_TIMEOUT;
	const controller = new AbortController();
	const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

	const requestBody = { query };
	if (variables) requestBody.variables = variables;
	if (operationName) requestBody.operationName = operationName;

	const requestHeaders = {
		...customHeaders,
		"Content-Type": "application/json",
	};

	try {
		const response = await fetch(url, {
			method: "POST",
			headers: requestHeaders,
			body: JSON.stringify(requestBody),
			signal: controller.signal,
		});

		clearTimeout(timeoutId);

		const responseText = await response.text();
		let parsedBody;
		try {
			parsedBody = JSON.parse(responseText);
		} catch (_err) {
			return {
				ok: false,
				error: `Non-JSON response: ${responseText.slice(0, 500)}`,
				status: response.status,
			};
		}

		// Check for GraphQL errors
		if (parsedBody.errors && parsedBody.errors.length > 0) {
			return {
				ok: false,
				errors: parsedBody.errors,
				data: parsedBody.data,
			};
		}

		return {
			ok: true,
			data: parsedBody.data,
		};
	} catch (err) {
		clearTimeout(timeoutId);
		const reason =
			err.name === "AbortError" ? `Request timed out after ${timeoutMs}ms` : err.message;
		return { ok: false, error: reason };
	}
}

/**
 * GraphQL client tool — execute queries and mutations.
 */
export const graphQLClientTool = tool(graphQLClient, {
	name: "graphQLClient",
	description:
		"Execute GraphQL queries and mutations with depth/complexity limits, timeout, and optional schema introspection.",
	schema: GraphQLClientSchema,
});
