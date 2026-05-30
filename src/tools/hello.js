import { tool } from "@langchain/core/tools";
import { z } from "zod";

/**
 * Simple debug tool that always returns hello_world!
 * @param {object} input - Tool input
 * @param {object} _options - Runtime options
 * @returns {Promise<string>} JSON string result
 */
export async function helloWorldImpl(_input, _options) {
	return JSON.stringify({ result: "hello_world!" });
}

/**
 * @param {z.infer<typeof HelloSchema>} input - Tool input
 * @param {object} _options - Runtime options
 * @returns {string} JSON result string
 */
export const hello_world = tool(helloWorldImpl, {
	name: "hello_world",
	description: "A simple debug tool that always returns 'hello_world!'.",
	schema: z.object({
		name: z.string().optional().describe("Optional greeting target — e.g. 'world'"),
	}),
});

/**
 * Create a hello_world tool with runtime options
 * @returns {object} LangChain Tool
 */
export function createHelloWorldTool() {
	return tool(helloWorldImpl, {
		name: "hello_world",
		description: "A simple debug tool that returns 'hello_world!'",
		schema: z.object({
			name: z.string().optional().describe("Optional greeting target"),
		}),
	});
}
