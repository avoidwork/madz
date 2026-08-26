import { describe, it } from "node:test";
import assert from "node:assert";
import { graphqlImpl } from "../../src/tools/graphql.js";

describe("graphql tool", () => {
	it("rejects blocked scheme (file://)", async () => {
		const result = await graphqlImpl({
			url: "file:///etc/passwd",
			query: "{ __schema { types { name } } }",
		});
		assert.strictEqual(result.ok, false);
		assert.ok(result.error.includes("Blocked scheme"));
	});

	it("rejects blocked scheme (gopher://)", async () => {
		const result = await graphqlImpl({
			url: "gopher://example.com",
			query: "{ __schema { types { name } } }",
		});
		assert.strictEqual(result.ok, false);
		assert.ok(result.error.includes("Blocked scheme"));
	});

	it("rejects internal IP (127.0.0.1)", async () => {
		const result = await graphqlImpl({
			url: "http://127.0.0.1:8080/graphql",
			query: "{ __schema { types { name } } }",
		});
		assert.strictEqual(result.ok, false);
		assert.ok(result.error.includes("internal host"));
	});

	it("rejects internal IP (169.254.169.254)", async () => {
		const result = await graphqlImpl({
			url: "http://169.254.169.254/graphql",
			query: "{ __schema { types { name } } }",
		});
		assert.strictEqual(result.ok, false);
		assert.ok(result.error.includes("internal host"));
	});

	it("rejects invalid URL", async () => {
		const result = await graphqlImpl({
			url: "not-a-url",
			query: "{ __schema { types { name } } }",
		});
		assert.strictEqual(result.ok, false);
		assert.ok(result.error.includes("Invalid input"));
	});

	it("triggers introspection when no query provided", async () => {
		// Without a query, the tool sends the introspection query
		// This will fail to connect (no server), but should not error on validation
		const result = await graphqlImpl({ url: "https://example.com/graphql" });
		// Should not be a validation error — it's a network error (no server running)
		assert.ok(!result.error.includes("Invalid input"));
	});

	it("rejects invalid GraphQL query", async () => {
		const result = await graphqlImpl({
			url: "https://example.com/graphql",
			query: "invalid graphql query {{{",
		});
		assert.strictEqual(result.ok, false);
	});
});
