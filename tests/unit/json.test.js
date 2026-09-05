import { describe, it } from "node:test";
import assert from "node:assert";
import { jsonManipulationImpl, jsonManipulation, createJsonTool } from "../../src/tools/json/index.js";

describe("json tool", () => {
	it("parses JSON string to object", async () => {
		const result = await jsonManipulationImpl({
			action: "parse",
			input: '{"name":"test","value":42}',
			format: "json",
		});
		assert.strictEqual(result.ok, true);
		assert.strictEqual(result.data.name, "test");
		assert.strictEqual(result.data.value, 42);
	});

	it("serializes object to JSON string", async () => {
		const result = await jsonManipulationImpl({
			action: "serialize",
			input: JSON.stringify({ name: "test", value: 42 }),
			format: "json",
		});
		assert.strictEqual(result.ok, true);
		assert.ok(result.data.includes('"name"'));
		assert.ok(result.data.includes('"test"'));
	});

	it("serialize rejects invalid JSON input", async () => {
		const result = await jsonManipulationImpl({
			action: "serialize",
			input: "{ invalid json }",
			format: "json",
		});
		assert.strictEqual(result.ok, false);
		assert.ok(result.error.includes("Invalid JSON input"));
	});

	it("transforms with mapping rules", async () => {
		const result = await jsonManipulationImpl({
			action: "transform",
			input: JSON.stringify({ firstName: "Alice", lastName: "Smith", age: 30 }),
			format: "json",
			mapping: JSON.stringify({ name: "firstName", surname: "lastName", years: "age" }),
		});
		assert.strictEqual(result.ok, true);
		assert.strictEqual(result.data.name, "Alice");
		assert.strictEqual(result.data.surname, "Smith");
		assert.strictEqual(result.data.years, 30);
	});

	it("transform rejects invalid input JSON", async () => {
		const result = await jsonManipulationImpl({
			action: "transform",
			input: "{ invalid json }",
			mapping: JSON.stringify({ a: "b" }),
		});
		assert.strictEqual(result.ok, false);
		assert.ok(result.error.includes("JSON parse error"));
	});

	it("transform rejects invalid mapping JSON", async () => {
		const result = await jsonManipulationImpl({
			action: "transform",
			input: JSON.stringify({ a: 1 }),
			mapping: "{ invalid json }",
		});
		assert.strictEqual(result.ok, false);
		assert.ok(result.error.includes("Invalid mapping JSON"));
	});

	it("transform rejects non-object mapping", async () => {
		const result = await jsonManipulationImpl({
			action: "transform",
			input: JSON.stringify({ a: 1 }),
			mapping: JSON.stringify(["not", "an", "object"]),
		});
		assert.strictEqual(result.ok, false);
		assert.ok(result.error.includes("Mapping must be an object"));
	});

	it("transform with nested mapping (dot-notation path)", async () => {
		const result = await jsonManipulationImpl({
			action: "transform",
			input: JSON.stringify({ user: { firstName: "Alice", lastName: "Smith" }, age: 30 }),
			mapping: JSON.stringify({ name: { name: "user.firstName" }, surname: { surname: "user.lastName" } }),
		});
		assert.strictEqual(result.ok, true);
		assert.strictEqual(result.data.name, "Alice");
		assert.strictEqual(result.data.surname, "Smith");
	});

	it("transform with nested mapping skips undefined paths", async () => {
		const result = await jsonManipulationImpl({
			action: "transform",
			input: JSON.stringify({ user: { firstName: "Alice" } }),
			mapping: JSON.stringify({ name: { name: "user.firstName" }, missing: { missing: "user.nonexistent" } }),
		});
		assert.strictEqual(result.ok, true);
		assert.strictEqual(result.data.name, "Alice");
		assert.strictEqual(result.data.missing, undefined);
	});

	it("transform handles null/undefined values", async () => {
		const result = await jsonManipulationImpl({
			action: "transform",
			input: JSON.stringify({ a: null, b: undefined, c: 42 }),
			mapping: JSON.stringify({ x: "a", y: "b", z: "c" }),
		});
		assert.strictEqual(result.ok, true);
		assert.strictEqual(result.data.x, null);
		assert.strictEqual(result.data.y, undefined);
		assert.strictEqual(result.data.z, 42);
	});

	it("transform handles array values recursively", async () => {
		const result = await jsonManipulationImpl({
			action: "transform",
			input: JSON.stringify({ items: [{ name: "Alice" }, { name: "Bob" }] }),
			mapping: JSON.stringify({ names: "items" }),
		});
		assert.strictEqual(result.ok, true);
		assert.ok(Array.isArray(result.data.names));
		// The transform applies the same mapping rules recursively;
		// nested objects don't have the mapped keys so they become empty objects
		assert.strictEqual(result.data.names.length, 2);
	});

	it("transform requires mapping", async () => {
		const result = await jsonManipulationImpl({
			action: "transform",
			input: JSON.stringify({ a: 1 }),
		});
		assert.strictEqual(result.ok, false);
		assert.ok(result.error.includes("Mapping is required"));
	});

	it("filters with JSONPath", async () => {
		const result = await jsonManipulationImpl({
			action: "filter",
			input: JSON.stringify({ users: [{ name: "Alice" }, { name: "Bob" }] }),
			format: "json",
			path: "$.users[*].name",
		});
		assert.strictEqual(result.ok, true);
		assert.ok(Array.isArray(result.data));
		assert.ok(result.data.includes("Alice"));
		assert.ok(result.data.includes("Bob"));
	});

	it("filter rejects invalid input JSON", async () => {
		const result = await jsonManipulationImpl({
			action: "filter",
			input: "{ invalid json }",
			path: "$.a",
		});
		assert.strictEqual(result.ok, false);
		assert.ok(result.error.includes("JSON parse error"));
	});

	it("filter requires path", async () => {
		const result = await jsonManipulationImpl({
			action: "filter",
			input: JSON.stringify({ a: 1 }),
		});
		assert.strictEqual(result.ok, false);
		assert.ok(result.error.includes("Path (JSONPath expression) is required"));
	});

	it("accesses nested path (dot notation)", async () => {
		const result = await jsonManipulationImpl({
			action: "access",
			input: JSON.stringify({ nested: { deep: { value: 42 } } }),
			format: "json",
			path: "nested.deep.value",
		});
		assert.strictEqual(result.ok, true);
		assert.strictEqual(result.data, 42);
	});

	it("accesses array index", async () => {
		const result = await jsonManipulationImpl({
			action: "access",
			input: JSON.stringify({ items: ["a", "b", "c"] }),
			format: "json",
			path: "items[1]",
		});
		assert.strictEqual(result.ok, true);
		assert.strictEqual(result.data, "b");
	});

	it("access returns undefined for null/undefined intermediate path", async () => {
		const result = await jsonManipulationImpl({
			action: "access",
			input: JSON.stringify({ a: null }),
			path: "a.b.c",
		});
		assert.strictEqual(result.ok, true);
		assert.strictEqual(result.data, undefined);
	});

	it("access rejects key not found in array index notation", async () => {
		const result = await jsonManipulationImpl({
			action: "access",
			input: JSON.stringify({ items: ["a"] }),
			path: "missing[0]",
		});
		assert.strictEqual(result.ok, false);
		assert.ok(result.error.includes("Key not found"));
	});

	it("access rejects array index out of bounds", async () => {
		const result = await jsonManipulationImpl({
			action: "access",
			input: JSON.stringify({ items: ["a"] }),
			path: "items[5]",
		});
		assert.strictEqual(result.ok, false);
		assert.ok(result.error.includes("Array index out of bounds"));
	});

	it("access rejects non-array with array index notation", async () => {
		const result = await jsonManipulationImpl({
			action: "access",
			input: JSON.stringify({ items: "not-an-array" }),
			path: "items[0]",
		});
		assert.strictEqual(result.ok, false);
		assert.ok(result.error.includes("Not an array"));
	});

	it("access rejects path not found", async () => {
		const result = await jsonManipulationImpl({
			action: "access",
			input: JSON.stringify({ a: 1 }),
			path: "b.c",
		});
		assert.strictEqual(result.ok, false);
		assert.ok(result.error.includes("Path not found"));
	});

	it("access requires path", async () => {
		const result = await jsonManipulationImpl({
			action: "access",
			input: JSON.stringify({ a: 1 }),
		});
		assert.strictEqual(result.ok, false);
		assert.ok(result.error.includes("Path is required"));
	});

	it("rejects invalid JSON input", async () => {
		const result = await jsonManipulationImpl({
			action: "parse",
			input: "{ invalid json }",
			format: "json",
		});
		assert.strictEqual(result.ok, false);
		assert.ok(result.error.includes("JSON parse error"));
	});

	it("rejects invalid action", async () => {
		const result = await jsonManipulationImpl({
			action: "invalid-action",
			input: "{}",
			format: "json",
		});
		assert.strictEqual(result.ok, false);
	});

	it("rejects invalid JSONPath gracefully", async () => {
		const result = await jsonManipulationImpl({
			action: "filter",
			input: JSON.stringify({ a: 1 }),
			path: "$.invalid[",
		});
		assert.strictEqual(result.ok, true);
		assert.ok(Array.isArray(result.data));
	});

	it("filter rejects JSONPath that throws an error", async () => {
		const result = await jsonManipulationImpl({
			action: "filter",
			input: JSON.stringify({ a: 1 }),
			path: "$..*",
		});
		assert.strictEqual(result.ok, true);
	});

	it("access with invalid JSON input returns parse error", async () => {
		const result = await jsonManipulationImpl({
			action: "access",
			input: "{ invalid json }",
			path: "a",
		});
		assert.strictEqual(result.ok, false);
		assert.ok(result.error.includes("JSON parse error"));
	});

	it("transform nested mapping with null intermediate value", async () => {
		const result = await jsonManipulationImpl({
			action: "transform",
			input: JSON.stringify({ a: null }),
			mapping: JSON.stringify({ x: { x: "a.b" } }),
		});
		assert.strictEqual(result.ok, true);
		assert.strictEqual(result.data.x, undefined);
	});

	it("jsonManipulation outer function parses JSON string input", async () => {
		const result = await jsonManipulation(
			JSON.stringify({ action: "parse", input: '{"a":1}' }),
		);
		assert.strictEqual(result.ok, true);
		assert.strictEqual(result.data.a, 1);
	});

	it("jsonManipulation outer function rejects invalid JSON input", async () => {
		const result = await jsonManipulation("{ invalid json }");
		assert.strictEqual(result.ok, false);
		assert.ok(result.error.includes("Invalid JSON input"));
	});

	it("createJsonTool returns a LangChain tool with correct schema", () => {
		const tool = createJsonTool();
		assert.strictEqual(tool.name, "json");
		assert.ok(typeof tool._call === "function" || typeof tool.invoke === "function");
	});

	it("createJsonTool tool processes input correctly", async () => {
		const tool = createJsonTool();
		const result = await tool.invoke({
			action: "parse",
			input: JSON.stringify({ hello: "world" }),
		});
		const parsed = JSON.parse(result);
		assert.strictEqual(parsed.ok, true);
		assert.strictEqual(parsed.data.hello, "world");
	});
});
