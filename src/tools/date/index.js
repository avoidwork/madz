import { tool } from "@langchain/core/tools";
import { z } from "zod";

const DateSchema = z.object({
	format: z.enum(["iso", "human"]).optional().describe('Output format: "iso" (default) or "human"'),
});

/**
 * Core date logic: return current time as ISO 8601 or human-readable string.
 * @param {z.infer<typeof DateSchema>} input - The tool input
 * @returns {{ ok: boolean, date?: string, format?: string, error?: string }} Current date/time in requested format
 */
export function dateImpl(input) {
	const { format = "iso" } = input;
	if (format !== "iso" && format !== "human") {
		return { ok: false, error: `Invalid format: ${format}. Expected "iso" or "human".` };
	}
	return {
		ok: true,
		date: format === "human" ? new Date().toString() : new Date().toISOString(),
		format,
	};
}

/**
 * @param {z.infer<typeof DateSchema>} input - Tool input
 * @returns {Promise<string>} JSON string of the structured date result
 */
export const date = tool(
	async (input) => {
		const result = dateImpl(input);
		return JSON.stringify(result, null, 2);
	},
	{
		name: "date",
		description:
			"Return the current date and time. Defaults to ISO 8601 UTC format; use format='human' for human-readable output.",
		schema: DateSchema,
	},
);
