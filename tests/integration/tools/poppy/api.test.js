import { describe, it, mock } from "node:test";
import assert from "node:assert/strict";
import { execute } from "../../../../src/tools/poppy/api.js";

const POPPY_JSON = {
	protocol_version: "1.0",
	organization: { name: "Example", domain: "example.com" },
	apis: [
		{ type: "openapi", url: "https://api.example.com/openapi.json", description: "Orders API" },
		{ type: "mcp", url: "https://mcp.example.com/mcp", description: "Inventory MCP" },
	],
};

describe("poppy - integration api", () => {
	it("selects an OpenAPI API and calls it with Poppy headers", async () => {
		mock.method(global, "fetch", async (url, init) => {
			const href = String(url);
			if (href.includes("api.example.com/orders")) {
				assert.strictEqual(init.headers["Poppy-Session"], "session-jwt");
				assert.strictEqual(init.headers["Poppy-Version"], "1.0");
				assert.strictEqual(init.headers.authorization, "Bearer access-token");
				return { ok: true, status: 200, json: async () => ({ order: "123" }) };
			}
			return { ok: false, status: 404, json: async () => ({}) };
		});

		const selected = await execute({ op: "select", task: "orders", poppyJson: POPPY_JSON });
		assert.strictEqual(selected.ok, true);
		assert.strictEqual(selected.data.type, "openapi");

		const result = await execute({
			op: "call",
			apiType: "openapi",
			endpoint: "https://api.example.com/orders",
			session: "session-jwt",
			accessToken: "access-token",
		});
		assert.strictEqual(result.ok, true);
		assert.strictEqual(result.data.order, "123");
	});

	it("maps an invalid_token error from an OpenAPI call", async () => {
		mock.method(global, "fetch", async () => ({
			ok: false,
			status: 401,
			json: async () => ({ error: "invalid_token" }),
		}));
		const result = await execute({
			op: "call",
			apiType: "openapi",
			endpoint: "https://api.example.com/orders",
		});
		assert.strictEqual(result.ok, false);
		assert.strictEqual(result.code, "invalid_token");
		assert.strictEqual(result.status, 401);
	});

	it("enforces a scope on a company-side endpoint", async () => {
		const result = await execute({
			op: "enforce_scope",
			scope: "orders:write",
			grantedScopes: "orders:read",
		});
		assert.strictEqual(result.ok, false);
		assert.strictEqual(result.code, "insufficient_scope");
	});
});
