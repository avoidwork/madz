import { describe, it, mock } from "node:test";
import assert from "node:assert/strict";
import {
	ApiInputSchema,
	selectApi,
	buildHeaders,
	tokenErrorStatus,
	enforceScope,
	callOpenApi,
	callMcp,
	execute,
} from "../../../../src/tools/poppy/api.js";

const POPPY_JSON = {
	protocol_version: "1.0",
	organization: { name: "Example", domain: "example.com" },
	apis: [
		{ type: "openapi", url: "https://api.example.com/openapi.json", description: "Orders API" },
		{ type: "mcp", url: "https://mcp.example.com/mcp", description: "Inventory MCP" },
	],
};

describe("poppy api - schema validation", () => {
	it("accepts valid api input", () => {
		const result = ApiInputSchema.safeParse({ op: "select", task: "orders" });
		assert.strictEqual(result.success, true);
	});

	it("rejects api input missing op", () => {
		const result = ApiInputSchema.safeParse({ task: "orders" });
		assert.strictEqual(result.success, false);
	});
});

describe("poppy api - selectApi", () => {
	it("selects an openapi API for a matching task", () => {
		const result = selectApi(POPPY_JSON, "orders");
		assert.strictEqual(result.ok, true);
		assert.strictEqual(result.data.type, "openapi");
	});

	it("selects an mcp API for a matching task", () => {
		const result = selectApi(POPPY_JSON, "inventory");
		assert.strictEqual(result.ok, true);
		assert.strictEqual(result.data.type, "mcp");
	});

	it("reports an error when no API matches", () => {
		const result = selectApi(POPPY_JSON, "nonexistent");
		assert.strictEqual(result.ok, false);
	});

	it("reports an error when poppy.json has no apis", () => {
		const result = selectApi({ protocol_version: "1.0" }, "orders");
		assert.strictEqual(result.ok, false);
	});

	it("reports an error for an unknown API type", () => {
		const result = selectApi(
			{ apis: [{ type: "graphql", url: "https://api.example.com", description: "GraphQL" }] },
			"graphql",
		);
		assert.strictEqual(result.ok, false);
	});
});

describe("poppy api - buildHeaders", () => {
	it("includes Poppy-Session and Poppy-Version headers", () => {
		const headers = buildHeaders({ session: "jwt", version: "1.0" });
		assert.strictEqual(headers["Poppy-Session"], "jwt");
		assert.strictEqual(headers["Poppy-Version"], "1.0");
	});

	it("includes access token as bearer", () => {
		const headers = buildHeaders({ accessToken: "token" });
		assert.strictEqual(headers.authorization, "Bearer token");
	});

	it("includes Poppy-Extensions header when extensions present", () => {
		const headers = buildHeaders({ extensions: { ext: ["a"] } });
		assert.strictEqual(headers["Poppy-Extensions"], JSON.stringify({ ext: ["a"] }));
	});

	it("includes Idempotency-Key header when provided", () => {
		const headers = buildHeaders({ idempotencyKey: "key-123" });
		assert.strictEqual(headers["Idempotency-Key"], "key-123");
	});

	it("defaults Poppy-Version when not provided", () => {
		const headers = buildHeaders({});
		assert.strictEqual(headers["Poppy-Version"], "1.0");
	});

	it("omits Idempotency-Key when absent", () => {
		const headers = buildHeaders({});
		assert.strictEqual(headers["Idempotency-Key"], undefined);
	});
});

describe("poppy api - tokenErrorStatus", () => {
	it("maps invalid_token to 401", () => {
		assert.strictEqual(tokenErrorStatus("invalid_token"), 401);
	});

	it("maps insufficient_scope to 403", () => {
		assert.strictEqual(tokenErrorStatus("insufficient_scope"), 403);
	});

	it("maps invalid_session to 400", () => {
		assert.strictEqual(tokenErrorStatus("invalid_session"), 400);
	});

	it("maps session_ended to 400", () => {
		assert.strictEqual(tokenErrorStatus("session_ended"), 400);
	});

	it("maps version_unsupported to 400", () => {
		assert.strictEqual(tokenErrorStatus("version_unsupported"), 400);
	});

	it("maps extension_required to 403", () => {
		assert.strictEqual(tokenErrorStatus("extension_required"), 403);
	});

	it("defaults unknown codes to 500", () => {
		assert.strictEqual(tokenErrorStatus("unknown"), 500);
	});
});

describe("poppy api - enforceScope", () => {
	it("permits a request when the scope is granted", () => {
		const result = enforceScope("orders:read", "orders:read inventory:read");
		assert.strictEqual(result.ok, true);
	});

	it("returns insufficient_scope when the scope is not granted", () => {
		const result = enforceScope("orders:write", "orders:read");
		assert.strictEqual(result.ok, false);
		assert.strictEqual(result.code, "insufficient_scope");
	});

	it("permits a request with no required scope", () => {
		const result = enforceScope("", "orders:read");
		assert.strictEqual(result.ok, true);
	});
});

describe("poppy api - callOpenApi", () => {
	it("calls an OpenAPI endpoint with Poppy headers", async () => {
		mock.method(global, "fetch", async (url, init) => {
			assert.strictEqual(String(url), "https://api.example.com/orders");
			assert.strictEqual(init.headers["Poppy-Session"], "jwt");
			assert.strictEqual(init.headers["Poppy-Version"], "1.0");
			assert.strictEqual(init.headers.authorization, "Bearer token");
			return { ok: true, status: 200, json: async () => ({ data: "ok" }) };
		});
		const result = await callOpenApi({
			endpoint: "https://api.example.com/orders",
			session: "jwt",
			accessToken: "token",
		});
		assert.strictEqual(result.ok, true);
		assert.strictEqual(result.data.data, "ok");
	});

	it("rejects a non-HTTPS endpoint", async () => {
		const result = await callOpenApi({ endpoint: "http://api.example.com/orders" });
		assert.strictEqual(result.ok, false);
	});

	it("maps an invalid_token error to 401", async () => {
		mock.method(global, "fetch", async () => ({
			ok: false,
			status: 401,
			json: async () => ({ error: "invalid_token" }),
		}));
		const result = await callOpenApi({ endpoint: "https://api.example.com/orders" });
		assert.strictEqual(result.ok, false);
		assert.strictEqual(result.code, "invalid_token");
		assert.strictEqual(result.status, 401);
	});
});

describe("poppy api - callMcp", () => {
	it("calls an MCP server over Streamable HTTP transport", async () => {
		const { MCPAdapter } = await import("@langchain/mcp-adapters");
		const invoke = mock.method(MCPAdapter.prototype, "listTools", async () => [
			{ name: "inventory_lookup", invoke: async () => ({ stock: 5 }) },
		]);
		const close = mock.method(MCPAdapter.prototype, "close", async () => {});
		const result = await callMcp({
			endpoint: "https://mcp.example.com/mcp",
			task: "inventory",
			accessToken: "token",
		});
		assert.strictEqual(result.ok, true);
		assert.strictEqual(result.data.stock, 5);
		invoke.mock.restore();
		close.mock.restore();
	});

	it("rejects a non-HTTPS MCP endpoint", async () => {
		const result = await callMcp({ endpoint: "http://mcp.example.com/mcp" });
		assert.strictEqual(result.ok, false);
	});

	it("requests a token with resource set to the MCP server URL", async () => {
		const { MCPAdapter } = await import("@langchain/mcp-adapters");
		const invoke = mock.method(MCPAdapter.prototype, "listTools", async () => [
			{ name: "inventory_lookup", invoke: async () => ({ stock: 5 }) },
		]);
		const close = mock.method(MCPAdapter.prototype, "close", async () => {});
		mock.method(global, "fetch", async (url, init) => {
			assert.strictEqual(String(url), "https://company.example.com/token");
			const body = new URLSearchParams(init.body);
			assert.strictEqual(body.get("resource"), "https://mcp.example.com/mcp");
			return { ok: true, status: 200, json: async () => ({ access_token: "mcp-token" }) };
		});
		const result = await callMcp({
			endpoint: "https://mcp.example.com/mcp",
			task: "inventory",
			tokenEndpoint: "https://company.example.com/token",
		});
		assert.strictEqual(result.ok, true);
		assert.strictEqual(result.data.stock, 5);
		invoke.mock.restore();
		close.mock.restore();
	});

	it("returns an error when no MCP tool matches the task", async () => {
		const { MCPAdapter } = await import("@langchain/mcp-adapters");
		const invoke = mock.method(MCPAdapter.prototype, "listTools", async () => [
			{ name: "inventory_lookup", invoke: async () => ({}) },
		]);
		const close = mock.method(MCPAdapter.prototype, "close", async () => {});
		const result = await callMcp({
			endpoint: "https://mcp.example.com/mcp",
			task: "nonexistent",
			accessToken: "token",
		});
		assert.strictEqual(result.ok, false);
		invoke.mock.restore();
		close.mock.restore();
	});
});

describe("poppy api - execute", () => {
	it("dispatches select op", async () => {
		const result = await execute({ op: "select", task: "orders", poppyJson: POPPY_JSON });
		assert.strictEqual(result.ok, true);
		assert.strictEqual(result.data.type, "openapi");
	});

	it("dispatches enforce_scope op", async () => {
		const result = await execute({
			op: "enforce_scope",
			scope: "orders:read",
			grantedScopes: "orders:read",
		});
		assert.strictEqual(result.ok, true);
	});

	it("returns an error for an unknown op", async () => {
		const result = await execute({ op: "unknown" });
		assert.strictEqual(result.ok, false);
	});
});
