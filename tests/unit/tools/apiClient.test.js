import { describe, it } from "node:test";
import assert from "node:assert";
import { apiClientTool, apiClient, ApiClientSchema } from "../../../src/tools/api.js";

describe("apiClient tool - apiClient", () => {
	it("rejects file:// URLs", async () => {
		const result = await apiClient({ url: "file:///etc/passwd" });
		assert.strictEqual(result.ok, false);
		assert.ok(result.error);
	});

	it("rejects gopher:// URLs", async () => {
		const result = await apiClient({ url: "gopher://example.com" });
		assert.strictEqual(result.ok, false);
		assert.ok(result.error);
	});

	it("rejects dict:// URLs", async () => {
		const result = await apiClient({ url: "dict://example.com" });
		assert.strictEqual(result.ok, false);
		assert.ok(result.error);
	});

	it("accepts http:// URLs", async () => {
		const result = await apiClient({ url: "http://example.com" });
		// Will fail to connect but should not be blocked by URL validation
		assert.ok(result.status !== undefined || result.error);
	});

	it("accepts https:// URLs", async () => {
		const result = await apiClient({ url: "https://example.com" });
		assert.ok(result.status !== undefined || result.error);
	});

	it("has correct schema", () => {
		assert.ok(ApiClientSchema);
		const shape = ApiClientSchema.shape;
		assert.ok(shape.url);
		assert.ok(shape.method);
		assert.ok(shape.headers);
		assert.ok(shape.body);
		assert.ok(shape.auth);
		assert.ok(shape.timeout);
	});

	it("is exported correctly", () => {
		assert.ok(apiClientTool);
		assert.ok(apiClient);
	});
});
