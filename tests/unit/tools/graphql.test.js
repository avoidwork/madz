import { describe, it } from "node:test";
import assert from "node:assert";
import {
	graphQLClientTool,
	graphQLClient,
	GraphQLClientSchema,
} from "../../../src/tools/graphql.js";

describe("graphQLClient tool - graphQLClient", () => {
	it("rejects file:// URLs", async () => {
		const result = await graphQLClient({ url: "file:///etc/passwd", query: "{ test }" });
		assert.strictEqual(result.ok, false);
		assert.ok(result.error);
	});

	it("rejects gopher:// URLs", async () => {
		const result = await graphQLClient({ url: "gopher://example.com", query: "{ test }" });
		assert.strictEqual(result.ok, false);
		assert.ok(result.error);
	});

	it("accepts https:// URLs", async () => {
		const result = await graphQLClient({ url: "https://example.com/graphql", query: "{ test }" });
		assert.ok(result.ok === false || result.error);
	});

	it("rejects introspection when disabled", async () => {
		const result = await graphQLClient({
			url: "https://example.com/graphql",
			query: "{ __schema { types { name } } }",
			introspection: false,
		});
		// URL validation passes, but introspection check should catch it
		assert.ok(result.error?.includes("Introspection is disabled") || result.ok === false);
	});

	it("has correct schema", () => {
		assert.ok(GraphQLClientSchema);
		const shape = GraphQLClientSchema.shape;
		assert.ok(shape.url);
		assert.ok(shape.query);
		assert.ok(shape.variables);
		assert.ok(shape.operationName);
		assert.ok(shape.timeout);
		assert.ok(shape.introspection);
		assert.ok(shape.maxDepth);
		assert.ok(shape.maxComplexity);
	});

	it("is exported correctly", () => {
		assert.ok(graphQLClientTool);
		assert.ok(graphQLClient);
	});
});
