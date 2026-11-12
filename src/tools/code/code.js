import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { searchCodeImpl, CodeSearchSchema } from "./searchCode.js";
import { indexCodeImpl, CodeIndexSchema } from "./indexCode.js";

/**
 * Zod schema for the `code` tool.
 *
 * Discriminates on `action` so each action carries only the fields it needs:
 * `search` queries the vector index, `index` builds/maintains it. Both operate
 * on the same sqlite-vec store for a project.
 *
 * @type {z.ZodDiscriminatedUnion<"action", [typeof CodeSearchSchema, typeof CodeIndexSchema]>}
 */
export const CodeToolSchema = z.discriminatedUnion("action", [CodeSearchSchema, CodeIndexSchema]);

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
