import { tool } from "@langchain/core/tools";
import { z } from "zod";

const DateSchema = z.object({
	format: z.enum(["iso", "human"]).optional().describe('Output format: "iso" (default) or "human"'),
});

/**
 * Core date logic: return current time as ISO 8601 or human-readable string.
 * @param {z.infer<typeof DateSchema>} input - The tool input
 * @returns {string} Current date/time in requested format
 */
export function dateImpl(input) {
	const { format = "iso" } = input;
	return format === "human" ? new Date().toString() : new Date().toISOString();
}

/**
 * @param {z.infer<typeof DateSchema>} input - Tool input
 * @returns {string} Current date/time
 */
export const date = tool(dateImpl, {
	name: "date",
	description:
		"Return the current date and time. Defaults to ISO 8601 UTC format; use format='human' for human-readable output.",
	schema: DateSchema,
});

/**
 * Create a date tool with runtime options (unused, kept for consistency).
 * @param {object} _options - Runtime options
 * @returns {object} LangChain Tool instance
 */
export function createDateTool(_options) {
	return tool(dateImpl, {
		name: "date",
		description:
			"Return the current date and time. Defaults to ISO 8601 UTC format; use format='human' for human-readable output.",
		schema: DateSchema,
	});
}
