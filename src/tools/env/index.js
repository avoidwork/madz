import { tool } from "@langchain/core/tools";
import { z } from "zod";

const EnvSchema = z.object({
	name: z.string().optional().describe("Name of the environment variable to read"),
	all: z.boolean().optional().describe("Return the full process.env object"),
});

/**
 * Core env tool logic: read environment variables from process.env.
 * When `name` is provided, returns that single variable's value. When `all`
 * is true (or no `name` is given), returns the full environment. Values are
 * returned only in the structured result and never logged.
 * @param {z.infer<typeof EnvSchema>} [input] - The tool input
 * @returns {{ ok: boolean, name?: string, value?: string, env?: object, error?: string }} Structured result
 */
export function envImpl(input = {}) {
	const parsed = EnvSchema.safeParse(input);
	if (!parsed.success) {
		return { ok: false, error: parsed.error.issues.map((i) => i.message).join("; ") };
	}

	const { name, all } = parsed.data;

	if (name) {
		const value = process.env[name];
		if (value === undefined) {
			return { ok: false, error: `Environment variable '${name}' is not set` };
		}
		return { ok: true, name, value };
	}

	if (all) {
		return { ok: true, env: { ...process.env } };
	}

	// Default: return the full environment when no name is given.
	return { ok: true, env: { ...process.env } };
}

/**
 * First-class env tool. Reads environment variables from process.env.
 * Gated by the `env:read` permission scope. Values are returned only in the
 * structured result and never logged.
 */
export const env = tool((input, options = {}) => envImpl(input, options), {
	name: "env",
	description:
		"Read environment variables from process.env. Pass { name: 'VAR' } to read a single variable, or { all: true } to return the full environment. Values are returned in the structured result and are never logged.",
	schema: EnvSchema,
});
