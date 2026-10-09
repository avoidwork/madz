import { describe, it, before, after } from "node:test";
import assert from "node:assert";
import { join } from "node:path";
import { buildToolConfig, MCP_TOOL_CLASSIFICATIONS } from "../../src/tools/index.js";

/**
 * Integration tests for config-driven MCP server tool registration.
 *
 * These spin up a real stdio MCP server (tests/fixtures/mcp-server.mjs) and
 * verify that `buildToolConfig()` discovers its tools, registers them alongside
 * the built-in tools, classifies them via the per-server `agents` list, and
 * attaches the adapter for shutdown.
 */

const FIXTURE_SERVER = join(process.cwd(), "tests", "fixtures", "mcp-server.mjs");

describe("MCP server tool registration (integration)", () => {
	let tools;
	let mcpTools;

	before(async () => {
		const config = {
			mcp: {
				"madz-test": {
					transport: "stdio",
					command: "node",
					args: [FIXTURE_SERVER],
					agents: ["coding", "search"],
				},
			},
		};

		tools = await buildToolConfig({
			permissions: ["filesystem:read", "filesystem:write", "network:outbound"],
			maxReadSize: "1mb",
			config,
		});

		// The adapter prefixes tool names with the server name.
		mcpTools = tools.filter((t) => t.name.startsWith("madz-test_"));
	});

	after(async () => {
		// Close the MCP adapter so the spawned stdio server process is cleaned up.
		if (tools?.mcpAdapter) {
			await tools.mcpAdapter.close();
		}
	});

	it("discovers and registers tools from the MCP server", () => {
		const names = mcpTools.map((t) => t.name);
		assert.ok(names.includes("madz-test_add"), "should register the 'add' tool");
		assert.ok(names.includes("madz-test_greet"), "should register the 'greet' tool");
	});

	it("appends MCP tools to the built-in tool list", () => {
		// The built-in tools are still present alongside the MCP tools.
		const names = tools.map((t) => t.name);
		assert.ok(names.includes("clarify"), "built-in tools should still be present");
		assert.ok(names.includes("date"), "built-in tools should still be present");
		assert.ok(mcpTools.length >= 2, "should have at least the two MCP tools");
	});

	it("classifies MCP tools by the per-server agents list", () => {
		assert.deepStrictEqual(
			MCP_TOOL_CLASSIFICATIONS["madz-test_add"],
			["coding", "search"],
			"add tool should be classified for coding + search",
		);
		assert.deepStrictEqual(
			MCP_TOOL_CLASSIFICATIONS["madz-test_greet"],
			["coding", "search"],
			"greet tool should be classified for coding + search",
		);
	});

	it("attaches the MCP adapter for shutdown", () => {
		assert.ok("mcpAdapter" in tools, "should attach the adapter to the tools array");
		assert.ok(tools.mcpAdapter, "adapter should be a truthy object");
	});

	it("returns executable LangChain tools", async () => {
		const addTool = mcpTools.find((t) => t.name === "madz-test_add");
		assert.ok(addTool, "add tool should be present");
		assert.ok(typeof addTool.invoke === "function", "tool should be invokable");

		const result = await addTool.invoke({ a: 2, b: 3 });
		assert.match(result, /5/, "add(2,3) should return 5");
	});

	it("defaults classification to orchestrator when no agents list is set", async () => {
		const config = {
			mcp: {
				"madz-test": {
					transport: "stdio",
					command: "node",
					args: [FIXTURE_SERVER],
				},
			},
		};

		const defaultTools = await buildToolConfig({
			permissions: ["filesystem:read", "filesystem:write", "network:outbound"],
			maxReadSize: "1mb",
			config,
		});

		const defaultMcpTools = defaultTools.filter((t) => t.name.startsWith("madz-test_"));
		for (const tool of defaultMcpTools) {
			assert.deepStrictEqual(
				MCP_TOOL_CLASSIFICATIONS[tool.name],
				["orchestrator"],
				`${tool.name} should default to orchestrator classification`,
			);
		}

		await defaultTools.mcpAdapter.close();
	});

	it("warns and skips a server that fails to connect", async () => {
		const config = {
			mcp: {
				"broken-server": {
					transport: "stdio",
					command: "node",
					args: ["/nonexistent/mcp-server.mjs"],
				},
			},
		};

		// Should not throw — the failure path warns and skips.
		const result = await buildToolConfig({
			permissions: ["filesystem:read", "filesystem:write", "network:outbound"],
			maxReadSize: "1mb",
			config,
		});

		assert.ok(Array.isArray(result), "should still return a tools array");
		assert.ok(
			!result.some((t) => t.name.startsWith("broken-server_")),
			"should not register tools from a failed server",
		);
	});
});
