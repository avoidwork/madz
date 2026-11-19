import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { searchCodeImpl } from "./searchCode.js";
import { indexCodeImpl } from "./indexCode.js";

/**
 * Zod schema for the `code` tool.
 *
 * A single flat object with an `action` enum (`search` | `index`) so the
 * serialized JSON schema is a plain object rather than a top-level `oneOf`.
 * Per-action requirements are enforced in `superRefine`; madz's own dispatch
 * still branches on `action`. This keeps every provider (including GitHub
 * Copilot, which rejects top-level `oneOf` tool schemas) happy.
 *
 * @type {z.ZodEffects<z.ZodObject, {action: "search" | "index"} & {query?: string, project?: string, topK?: number, fileFilter?: string, mode?: "vector" | "fulltext" | "hybrid", force?: boolean}, unknown>}
 */
export const CodeToolSchema = z
	.object({
		action: z
			.enum(["search", "index"])
			.describe("Search the vector index for code matching a query, or index project source code"),
		query: z
			.string()
			.min(1)
			.optional()
			.describe("Natural language query describing the code to find"),
		project: z
			.string()
			.optional()
			.describe(
				"Project name to search or index (as configured in vector.projects). Defaults to the first project.",
			),
		topK: z.number().int().positive().max(50).default(5).describe("Number of results to return"),
		fileFilter: z
			.string()
			.optional()
			.describe("Optional glob pattern to filter results by file path (e.g., 'src/tools/*.js')"),
		mode: z
			.enum(["vector", "fulltext", "hybrid"])
			.default("hybrid")
			.describe(
				"Search mode: 'vector' (semantic similarity), 'fulltext' (keyword FTS5), or 'hybrid' (both with RRF fusion)",
			),
		force: z.boolean().default(false).describe("Force re-index all files, ignoring mtime cache"),
	})
	.superRefine((data, ctx) => {
		if (data.action === "search" && !data.query) {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				path: ["query"],
				message: "query is required when action is 'search'",
			});
		}
	});

/**
 * Dispatch a `code` tool invocation to the search or index implementation.
 *
 * @param {z.infer<typeof CodeToolSchema>} input - The tool input
 * @param {object} [options] - Runtime options for test injection
 * @returns {Promise<{ok: boolean, results?: Array<object>, count?: number, error?: string}>} Structured results
 */
export async function codeImpl(input, options = {}) {
	if (input.action === "search") {
		return searchCodeImpl(input, options);
	}
	return indexCodeImpl(input, options);
}

export const code = tool(codeImpl, {
	name: "code",
	description:
		"Search and index project source code via a sqlite-vec vector store. " +
		"Use action 'search' to find code by meaning (hybrid vector + keyword, full-text, or vector similarity), " +
		"or action 'index' to build or refresh the index for a project. " +
		"Both actions operate on the same per-project vector store; index before search.",
	schema: CodeToolSchema,
});
