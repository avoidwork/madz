#!/usr/bin/env node
/**
 * Minimal MCP server fixture for integration testing.
 *
 * Registers two tools (`add` and `greet`) and speaks the Model Context
 * Protocol over stdio. Used by `tests/integration/mcpTools.test.js` to verify
 * that madz discovers and registers MCP server tools via `buildToolConfig()`.
 *
 * Run standalone: `node tests/fixtures/mcp-server.mjs`
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const server = new McpServer({
	name: "madz-test-server",
	version: "1.0.0",
});

server.registerTool(
	"add",
	{
		title: "Add two numbers",
		description: "Adds two numbers and returns the sum",
		inputSchema: z.object({
			a: z.number().describe("The first number"),
			b: z.number().describe("The second number"),
		}),
	},
	async ({ a, b }) => ({
		content: [{ type: "text", text: `${a + b}` }],
	}),
);

server.registerTool(
	"greet",
	{
		title: "Greet someone",
		description: "Returns a greeting for the given name",
		inputSchema: z.object({
			name: z.string().describe("The name to greet"),
		}),
	},
	async ({ name }) => ({
		content: [{ type: "text", text: `Hello, ${name}!` }],
	}),
);

async function main() {
	const transport = new StdioServerTransport();
	await server.connect(transport);
}

main().catch((err) => {
	console.error(err);
	process.exit(1);
});
