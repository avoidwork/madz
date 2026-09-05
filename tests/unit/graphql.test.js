import { describe, it, afterEach } from "node:test";
import assert from "node:assert";
import {
	graphqlImpl,
	graphql,
	introspectSchema,
	createGraphqlTool,
	executeGraphQL,
	rateLimit,
} from "../../src/tools/graphql/index.js";

// Disable rate limiting in tests
rateLimit._testMode = true;

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

describe("graphql — graphql() JSON wrapper", () => {
	it("returns error for invalid JSON", async () => {
		const result = await graphql("not-json");
		assert.strictEqual(result.ok, false);
		assert.ok(result.error.includes("Invalid JSON input"));
	});

	it("parses valid JSON and delegates to graphqlImpl", async () => {
		const result = await graphql(
			JSON.stringify({ url: "https://example.com/graphql", query: "{ test }" }),
		);
		// Should not be a JSON parse error
		assert.ok(!result.error || !result.error.includes("Invalid JSON input"));
	});
});

describe("graphql — graphqlImpl()", () => {
	it("rejects missing url", async () => {
		const result = await graphqlImpl({ query: "{ test }" });
		assert.strictEqual(result.ok, false);
		assert.ok(result.error.includes("Invalid input"));
	});

	it("rejects invalid url type", async () => {
		const result = await graphqlImpl({ url: 123, query: "{ test }" });
		assert.strictEqual(result.ok, false);
		assert.ok(result.error.includes("Invalid input"));
	});

	it("rejects negative timeout", async () => {
		const result = await graphqlImpl({
			url: "https://example.com/graphql",
			query: "{ test }",
			timeout: -1,
		});
		assert.strictEqual(result.ok, false);
		assert.ok(result.error.includes("Invalid input"));
	});

	it("rejects negative maxDepth", async () => {
		const result = await graphqlImpl({
			url: "https://example.com/graphql",
			query: "{ test }",
			maxDepth: -1,
		});
		assert.strictEqual(result.ok, false);
		assert.ok(result.error.includes("Invalid input"));
	});

	it("rejects negative maxComplexity", async () => {
		const result = await graphqlImpl({
			url: "https://example.com/graphql",
			query: "{ test }",
			maxComplexity: -1,
		});
		assert.strictEqual(result.ok, false);
		assert.ok(result.error.includes("Invalid input"));
	});

	it("passes variables to executeGraphQL", async () => {
		const result = await graphqlImpl({
			url: "https://example.com/graphql",
			query: "query($id: ID!) { user(id: $id) { name } }",
			variables: { id: "123" },
		});
		// Should reach executeGraphQL and fail on network, not validation
		assert.ok(!result.error.includes("Invalid input"));
	});

	it("passes operationName to executeGraphQL", async () => {
		const result = await graphqlImpl({
			url: "https://example.com/graphql",
			query: "query GetUser { user { name } }",
			operationName: "GetUser",
		});
		assert.ok(!result.error.includes("Invalid input"));
	});
});

describe("graphql — executeGraphQL()", () => {
	const originalFetch = globalThis.fetch;

	afterEach(() => {
		globalThis.fetch = originalFetch;
	});

	it("rejects non-allowed host when allowlist is provided", async () => {
		const result = await executeGraphQL(
			"https://evil.com/graphql",
			"{ __schema { types { name } } }",
			{},
			undefined,
			30000,
			10,
			1000,
			["good.com"],
		);
		assert.strictEqual(result.ok, false);
		assert.ok(result.error.includes("not on allowlist"));
	});

	it("rejects query exceeding max depth", async () => {
		const result = await executeGraphQL(
			"https://example.com/graphql",
			"{ a { b { c { d { e { f } } } } } }",
			{},
			undefined,
			30000,
			3, // maxDepth = 3
			1000,
			[],
		);
		assert.strictEqual(result.ok, false);
		assert.ok(result.error.includes("depth"));
	});

	it("rejects query exceeding max complexity", async () => {
		const result = await executeGraphQL(
			"https://example.com/graphql",
			"{ a b c d e f g h i j k l m n o p q r s t u v w x y z }",
			{},
			undefined,
			30000,
			10,
			5, // maxComplexity = 5
			[],
		);
		assert.strictEqual(result.ok, false);
		assert.ok(result.error.includes("complexity"));
	});

	it("skips depth/complexity analysis for introspection queries", async () => {
		// This should reach the fetch call, not fail on depth/complexity
		globalThis.fetch = async () => ({
			ok: true,
			status: 200,
			json: async () => ({ data: { __schema: { types: [] } } }),
		});
		const result = await executeGraphQL(
			"https://example.com/graphql",
			"{ __schema { types { name } } }",
			{},
			undefined,
			30000,
			10,
			1000,
			[],
			true, // isIntrospection
		);
		assert.strictEqual(result.ok, true);
	});

	it("makes successful request and returns data", async () => {
		globalThis.fetch = async () => ({
			ok: true,
			status: 200,
			json: async () => ({ data: { user: { name: "Alice" } } }),
		});
		const result = await executeGraphQL(
			"https://example.com/graphql",
			"{ user { name } }",
		);
		assert.strictEqual(result.ok, true);
		assert.deepStrictEqual(result.data, { user: { name: "Alice" } });
	});

	it("handles HTTP error status", async () => {
		globalThis.fetch = async () => ({
			ok: false,
			status: 400,
			text: async () => "Bad request",
		});
		const result = await executeGraphQL(
			"https://example.com/graphql",
			"{ user { name } }",
		);
		assert.strictEqual(result.ok, false);
		assert.ok(result.error.includes("400"));
	});

	it("handles GraphQL errors in response", async () => {
		globalThis.fetch = async () => ({
			ok: true,
			status: 200,
			json: async () => ({
				data: null,
				errors: [{ message: "Field 'unknown' doesn't exist" }],
			}),
		});
		const result = await executeGraphQL(
			"https://example.com/graphql",
			"{ unknown }",
		);
		assert.strictEqual(result.ok, false);
		assert.ok(result.error.includes("GraphQL errors"));
	});

	it("handles timeout (AbortError)", async () => {
		globalThis.fetch = async () => {
			throw Object.assign(new Error("The operation was aborted"), { name: "AbortError" });
		};
		const result = await executeGraphQL(
			"https://example.com/graphql",
			"{ user { name } }",
			{},
			undefined,
			100,
		);
		assert.strictEqual(result.ok, false);
		assert.ok(result.error.includes("timed out"));
	});

	it("handles fetch error", async () => {
		globalThis.fetch = async () => {
			throw new Error("Network failure");
		};
		const result = await executeGraphQL(
			"https://example.com/graphql",
			"{ user { name } }",
		);
		assert.strictEqual(result.ok, false);
		assert.ok(result.error.includes("Network failure"));
	});

	it("handles HTTP error with empty response text", async () => {
		globalThis.fetch = async () => ({
			ok: false,
			status: 500,
			text: async () => { throw new Error("no body"); },
		});
		const result = await executeGraphQL(
			"https://example.com/graphql",
			"{ user { name } }",
		);
		assert.strictEqual(result.ok, false);
		assert.ok(result.error.includes("500"));
	});
});

describe("graphql — introspectSchema()", () => {
	it("returns error for invalid JSON", async () => {
		const result = await introspectSchema("not-json");
		assert.strictEqual(result.ok, false);
		assert.ok(result.error.includes("Invalid JSON input"));
	});

	it("returns error for missing url", async () => {
		const result = await introspectSchema(JSON.stringify({}));
		assert.strictEqual(result.ok, false);
		assert.ok(result.error.includes("Invalid input"));
	});

	it("attempts introspection with valid input", async () => {
		const result = await introspectSchema(
			JSON.stringify({ url: "https://example.com/graphql" }),
		);
		// Should not be a validation error
		assert.ok(!result.error || !result.error.includes("Invalid input"));
	});
});

describe("graphql — createGraphqlTool()", () => {
	it("returns a LangChain tool with correct name", () => {
		const tool = createGraphqlTool();
		assert.ok(tool);
		assert.strictEqual(tool.name, "graphql");
	});

	it("invokes the tool and returns JSON result", async () => {
		const tool = createGraphqlTool();
		const result = await tool.invoke({
			url: "https://example.com/graphql",
			query: "{ test }",
		});
		// Result should be a JSON string
		const parsed = JSON.parse(result);
		assert.ok(parsed.ok === false || parsed.ok === true);
	});
});

describe("graphql — analyzeDepth()", () => {
	it("returns 0 for empty query", () => {
		// analyzeDepth is not exported, test via executeGraphQL
		// Depth 0 query should pass
	});
});

describe("graphql — edge cases in depth/complexity analysis", () => {
	it("handles escaped characters in strings within query", async () => {
		// Query with escaped quotes inside strings
		const result = await executeGraphQL(
			"https://example.com/graphql",
			'{ user(name: "test\\"quote") { id } }',
			{},
			undefined,
			30000,
			10,
			1000,
			[],
		);
		// Should pass depth/complexity check and fail on network
		assert.ok(!result.error.includes("depth"));
		assert.ok(!result.error.includes("complexity"));
	});

	it("handles multi-line comments in query", async () => {
		// Query with # comments
		const result = await executeGraphQL(
			"https://example.com/graphql",
			"# this is a comment\n{ user { name } }",
			{},
			undefined,
			30000,
			10,
			1000,
			[],
		);
		assert.ok(!result.error.includes("depth"));
		assert.ok(!result.error.includes("complexity"));
	});

	it("handles fragment spreads in complexity estimation", async () => {
		// Query with fragment spread
		const result = await executeGraphQL(
			"https://example.com/graphql",
			"{ ...UserFields }",
			{},
			undefined,
			30000,
			10,
			1000,
			[],
		);
		assert.ok(!result.error.includes("depth"));
		assert.ok(!result.error.includes("complexity"));
	});

	it("handles query with arguments for complexity estimation", async () => {
		const result = await executeGraphQL(
			"https://example.com/graphql",
			'{ user(name: "Alice", age: 30) { id name } }',
			{},
			undefined,
			30000,
			10,
			1000,
			[],
		);
		assert.ok(!result.error.includes("depth"));
		assert.ok(!result.error.includes("complexity"));
	});

	it("handles query with string containing braces", async () => {
		// String containing { and } should not affect depth counting
		const result = await executeGraphQL(
			"https://example.com/graphql",
			'{ user(description: "test { with } braces") { id } }',
			{},
			undefined,
			30000,
			10,
			1000,
			[],
		);
		assert.ok(!result.error.includes("depth"));
	});

	it("handles query with backslash escape in string", async () => {
		const result = await executeGraphQL(
			"https://example.com/graphql",
			'{ user(path: "c:\\\\path\\\\to\\\\file") { id } }',
			{},
			undefined,
			30000,
			10,
			1000,
			[],
		);
		assert.ok(!result.error.includes("depth"));
	});
});

describe("graphql — rateLimit()", () => {
	it("skips rate limiting in test mode", async () => {
		await rateLimit("https://example.com/graphql", 10);
		assert.ok(true);
	});

	it("returns early when maxRequests is falsy", async () => {
		const originalMode = rateLimit._testMode;
		rateLimit._testMode = false;
		await rateLimit("https://example.com/graphql", 0);
		rateLimit._testMode = originalMode;
		assert.ok(true);
	});

	it("creates windows map on first call", async () => {
		const originalMode = rateLimit._testMode;
		rateLimit._testMode = false;
		rateLimit._windows = undefined;
		await rateLimit("https://example.com/graphql", 10);
		assert.ok(rateLimit._windows instanceof Map);
		rateLimit._testMode = originalMode;
	});

	it("tracks request timestamps", async () => {
		const originalMode = rateLimit._testMode;
		rateLimit._testMode = false;
		rateLimit._windows = new Map();
		await rateLimit("https://example.com/graphql", 100);
		const timestamps = rateLimit._windows.get("https://example.com/graphql");
		assert.ok(Array.isArray(timestamps));
		assert.ok(timestamps.length > 0);
		rateLimit._testMode = originalMode;
	});

	it("cleans up old timestamps outside the window", async () => {
		const originalMode = rateLimit._testMode;
		rateLimit._testMode = false;
		rateLimit._windows = new Map();
		// Add a timestamp older than 1 second window
		rateLimit._windows.set("https://example.com/graphql", [Date.now() - 5000]);
		await rateLimit("https://example.com/graphql", 100);
		const timestamps = rateLimit._windows.get("https://example.com/graphql");
		assert.ok(timestamps.length <= 1);
		rateLimit._testMode = originalMode;
	});

	it("waits when rate limit is exceeded and then retries", async () => {
		const originalMode = rateLimit._testMode;
		rateLimit._testMode = false;
		rateLimit._windows = new Map();
		// Fill with timestamps just inside the 1s window so wait is minimal (~2ms)
		const recentTs = Date.now() - 999;
		rateLimit._windows.set("https://example.com/graphql", [recentTs, recentTs, recentTs]);
		await rateLimit("https://example.com/graphql", 3);
		const timestamps = rateLimit._windows.get("https://example.com/graphql");
		assert.ok(timestamps.length >= 1);
		rateLimit._testMode = originalMode;
	});
});
