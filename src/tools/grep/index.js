import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { grepImpl } from "../file/index.js";
import { loadConfig } from "../../config/loader.js";

const config = loadConfig();

const GrepSchema = z.object({
	pattern: z.string().describe("Regex pattern to search for across file contents"),
	path: z
		.string()
		.optional()
		.describe(
			"Path to search. Relative paths resolve against the active project cwd; omit to default to the active project cwd (or config.cwd).",
		),
	maxResults: z
		.number()
		.int()
		.positive()
		.optional()
		.describe("Maximum number of results to return"),
});

/**
 * grep tool — perform a literal regex search across file contents.
 * Reuses the file tool's ripgrep/native-fs search logic. Every path is
 * validated against the sandbox allowlist via `validatePath`.
 */
export const grep = tool(
	(input) =>
		grepImpl(input, {
			allowedPaths: config.sandbox?.paths || [],
			maxReadSize: config.sandbox?.maxReadSize || "1mb",
		}),
	{
		name: "grep",
		description:
			"Search file contents by regex. Accepts a pattern (required), an optional path, and an optional maxResults. Uses ripgrep with a native fs fallback. Every path is validated against the sandbox allowlist. Relative paths resolve against the active project cwd; omitting path defaults to the active project cwd (or config.cwd).",
		schema: GrepSchema,
	},
);
