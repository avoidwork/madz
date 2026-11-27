import { describe, it, mock } from "node:test";
import assert from "node:assert";
import { MCPAdapter } from "@langchain/mcp-adapters";
import { buildToolConfig } from "../../src/tools/index.js";

/**
 * Integration tests for OAuth2 auth fields on MCP server configs.
 *
 * These mock `MCPAdapter.prototype.listTools` so no real network connection is
 * made, and verify that `buildToolConfig()` forwards the `headers` and
 * `authProvider` fields from an http/sse server config to the adapter
 * unchanged.
 */

const authProvider = { token: async () => "test-token" };

describe("MCP OAuth2 auth fields (integration)", () => {
	it("forwards headers and authProvider from an http server to the adapter", async () => {
		const listToolsMock = mock.method(MCPAdapter.prototype, "listTools", async () => []);

		try {
			const config = {
				mcp: {
					base44: {
						transport: "http",
						url: "https://base44.com/mcp",
						headers: { Authorization: "Bearer token" },
						authProvider,
					},
				},
			};

			const tools = await buildToolConfig({
				permissions: ["network:outbound"],
				maxReadSize: 1024 * 1024,
				config,
			});

			const servers = tools.mcpAdapter.config.servers;
			assert.deepStrictEqual(servers.base44.headers, {
				Authorization: "Bearer token",
			});
			assert.strictEqual(servers.base44.authProvider, authProvider);

			await tools.mcpAdapter.close();
		} finally {
			listToolsMock.mock.restore();
		}
	});

	it("forwards headers and authProvider from an sse server to the adapter", async () => {
		const listToolsMock = mock.method(MCPAdapter.prototype, "listTools", async () => []);

		try {
			const config = {
				mcp: {
					base44: {
						transport: "sse",
						url: "https://base44.com/mcp",
						headers: { Authorization: "Bearer token" },
						authProvider,
					},
				},
			};

			const tools = await buildToolConfig({
				permissions: ["network:outbound"],
				maxReadSize: 1024 * 1024,
				config,
			});

			const servers = tools.mcpAdapter.config.servers;
			assert.deepStrictEqual(servers.base44.headers, {
				Authorization: "Bearer token",
			});
			assert.strictEqual(servers.base44.authProvider, authProvider);

			await tools.mcpAdapter.close();
		} finally {
			listToolsMock.mock.restore();
		}
	});
});
