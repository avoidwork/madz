import { describe, it, mock } from "node:test";
import assert from "node:assert";
import { MCPAdapter } from "@langchain/mcp-adapters";
import { buildToolConfig } from "../../src/tools/index.js";
import { LangChainOAuthClientProvider } from "../../src/tools/mcp/authProvider.js";

/**
 * Integration tests for OAuth2 auth fields on MCP server configs.
 *
 * These mock `MCPAdapter.prototype.listTools` so no real network connection is
 * made, and verify that `buildToolConfig()` forwards the `headers` field and
 * wraps the typed `authProvider` config into a built-in
 * `LangChainOAuthClientProvider` for an http/sse server.
 */

describe("MCP OAuth2 auth fields (integration)", () => {
	it("forwards headers and wraps authProvider config from an http server", async () => {
		const listToolsMock = mock.method(MCPAdapter.prototype, "listTools", async () => []);

		try {
			const config = {
				mcp: {
					docs: {
						transport: "http",
						url: "https://example.com/mcp",
						headers: { Authorization: "Bearer token" },
						authProvider: {
							clientId: "my-client",
							scopes: ["app:mcp", "offline"],
						},
					},
				},
			};

			const tools = await buildToolConfig({
				permissions: ["network:outbound"],
				maxReadSize: 1024 * 1024,
				config,
			});

			const servers = tools.mcpAdapter.config.servers;
			assert.deepStrictEqual(servers.docs.headers, {
				Authorization: "Bearer token",
			});
			assert.ok(servers.docs.authProvider instanceof LangChainOAuthClientProvider);

			await tools.mcpAdapter.close();
		} finally {
			listToolsMock.mock.restore();
		}
	});

	it("forwards headers and wraps authProvider config from an sse server", async () => {
		const listToolsMock = mock.method(MCPAdapter.prototype, "listTools", async () => []);

		try {
			const config = {
				mcp: {
					docs: {
						transport: "sse",
						url: "https://example.com/mcp",
						headers: { Authorization: "Bearer token" },
						authProvider: {
							clientId: "my-client",
							scopes: ["app:mcp", "offline"],
						},
					},
				},
			};

			const tools = await buildToolConfig({
				permissions: ["network:outbound"],
				maxReadSize: 1024 * 1024,
				config,
			});

			const servers = tools.mcpAdapter.config.servers;
			assert.deepStrictEqual(servers.docs.headers, {
				Authorization: "Bearer token",
			});
			assert.ok(servers.docs.authProvider instanceof LangChainOAuthClientProvider);

			await tools.mcpAdapter.close();
		} finally {
			listToolsMock.mock.restore();
		}
	});
});
