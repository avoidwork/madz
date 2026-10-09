import { test, describe } from "node:test";
import assert from "node:assert";
import { McpSchema } from "../../../../src/config/schemas/mcp.js";

describe("McpSchema", () => {
	describe("default", () => {
		test("should default to an empty servers map", () => {
			const result = McpSchema.safeParse({});
			assert.strictEqual(result.success, true);
			assert.deepStrictEqual(result.data.servers, {});
		});

		test("should accept undefined and default to empty", () => {
			const result = McpSchema.safeParse(undefined);
			assert.strictEqual(result.success, true);
			assert.deepStrictEqual(result.data.servers, {});
		});
	});

	describe("stdio transport", () => {
		test("should validate a complete stdio server", () => {
			const result = McpSchema.safeParse({
				servers: {
					"local-fs": {
						transport: "stdio",
						command: "npx",
						args: ["-y", "@modelcontextprotocol/server-filesystem", "/tmp"],
						env: { API_KEY: "secret" },
						agents: ["coding"],
					},
				},
			});
			assert.strictEqual(result.success, true);
			assert.strictEqual(result.data.servers["local-fs"].transport, "stdio");
			assert.strictEqual(result.data.servers["local-fs"].command, "npx");
			assert.deepStrictEqual(result.data.servers["local-fs"].args, [
				"-y",
				"@modelcontextprotocol/server-filesystem",
				"/tmp",
			]);
			assert.deepStrictEqual(result.data.servers["local-fs"].env, { API_KEY: "secret" });
			assert.deepStrictEqual(result.data.servers["local-fs"].agents, ["coding"]);
		});

		test("should default args to empty array", () => {
			const result = McpSchema.safeParse({
				servers: {
					"local-fs": { transport: "stdio", command: "npx" },
				},
			});
			assert.strictEqual(result.success, true);
			assert.deepStrictEqual(result.data.servers["local-fs"].args, []);
		});

		test("should reject stdio without command", () => {
			const result = McpSchema.safeParse({
				servers: {
					"local-fs": { transport: "stdio", args: ["-y"] },
				},
			});
			assert.strictEqual(result.success, false);
		});

		test("should reject stdio with empty command", () => {
			const result = McpSchema.safeParse({
				servers: {
					"local-fs": { transport: "stdio", command: "" },
				},
			});
			assert.strictEqual(result.success, false);
		});
	});

	describe("http transport", () => {
		test("should validate a complete http server", () => {
			const result = McpSchema.safeParse({
				servers: {
					docs: {
						transport: "http",
						url: "https://docs.langchain.com/mcp",
						agents: ["search", "research"],
					},
				},
			});
			assert.strictEqual(result.success, true);
			assert.strictEqual(result.data.servers.docs.transport, "http");
			assert.strictEqual(result.data.servers.docs.url, "https://docs.langchain.com/mcp");
			assert.deepStrictEqual(result.data.servers.docs.agents, ["search", "research"]);
		});

		test("should reject http without url", () => {
			const result = McpSchema.safeParse({
				servers: {
					docs: { transport: "http" },
				},
			});
			assert.strictEqual(result.success, false);
		});

		test("should reject http with invalid url", () => {
			const result = McpSchema.safeParse({
				servers: {
					docs: { transport: "http", url: "not-a-url" },
				},
			});
			assert.strictEqual(result.success, false);
		});
	});

	describe("sse transport", () => {
		test("should validate a complete sse server", () => {
			const result = McpSchema.safeParse({
				servers: {
					legacy: {
						transport: "sse",
						url: "https://example.com/mcp",
					},
				},
			});
			assert.strictEqual(result.success, true);
			assert.strictEqual(result.data.servers.legacy.transport, "sse");
			assert.strictEqual(result.data.servers.legacy.url, "https://example.com/mcp");
		});

		test("should reject sse without url", () => {
			const result = McpSchema.safeParse({
				servers: {
					legacy: { transport: "sse" },
				},
			});
			assert.strictEqual(result.success, false);
		});
	});

	describe("transport discrimination", () => {
		test("should reject unknown transport", () => {
			const result = McpSchema.safeParse({
				servers: {
					bad: { transport: "websocket", url: "https://example.com" },
				},
			});
			assert.strictEqual(result.success, false);
		});

		test("should reject stdio with url (wrong fields for transport)", () => {
			const result = McpSchema.safeParse({
				servers: {
					bad: { transport: "stdio", url: "https://example.com" },
				},
			});
			assert.strictEqual(result.success, false);
		});

		test("should reject http with command (wrong fields for transport)", () => {
			const result = McpSchema.safeParse({
				servers: {
					bad: { transport: "http", command: "npx" },
				},
			});
			assert.strictEqual(result.success, false);
		});
	});

	describe("strict mode", () => {
		test("should reject unknown top-level keys", () => {
			const result = McpSchema.safeParse({
				servers: {},
				unknown: true,
			});
			assert.strictEqual(result.success, false);
		});

		test("should reject unknown keys on a server", () => {
			const result = McpSchema.safeParse({
				servers: {
					docs: { transport: "http", url: "https://example.com", bogus: "x" },
				},
			});
			assert.strictEqual(result.success, false);
		});
	});
});
