import { describe, it } from "node:test";
import assert from "node:assert";
import { yamlManipulationImpl, yamlManipulation, createYamlTool } from "../../src/tools/yaml/index.js";

describe("yaml tool", () => {
	it("parses YAML string to object", async () => {
		const result = await yamlManipulationImpl({
			action: "parse",
			input: "name: test\nvalue: 42",
			format: "yaml",
		});
		assert.strictEqual(result.ok, true);
		assert.strictEqual(result.data.name, "test");
		assert.strictEqual(result.data.value, 42);
	});

	it("serializes object to YAML string", async () => {
		const result = await yamlManipulationImpl({
			action: "serialize",
			input: JSON.stringify({ name: "test", value: 42 }),
			format: "yaml",
		});
		assert.strictEqual(result.ok, true);
		assert.ok(result.data.includes("name: test"));
		assert.ok(result.data.includes("value: 42"));
	});

	it("serializes YAML input to YAML output", async () => {
		const result = await yamlManipulationImpl({
			action: "serialize",
			input: "name: test\nvalue: 42",
			format: "yaml",
		});
		assert.strictEqual(result.ok, true);
		assert.ok(result.data.includes("name: test"));
		assert.ok(result.data.includes("value: 42"));
	});

	it("serialize rejects invalid YAML input", async () => {
		const result = await yamlManipulationImpl({
			action: "serialize",
			input: "{ invalid: yaml: [",
			format: "yaml",
		});
		assert.strictEqual(result.ok, false);
		assert.ok(result.error.includes("YAML parse error"));
	});

	it("transforms with mapping rules", async () => {
		const result = await yamlManipulationImpl({
			action: "transform",
			input: "firstName: Alice\nlastName: Smith\nage: 30",
			format: "yaml",
			mapping: JSON.stringify({ name: "firstName", surname: "lastName", years: "age" }),
		});
		assert.strictEqual(result.ok, true);
		assert.strictEqual(result.data.name, "Alice");
		assert.strictEqual(result.data.surname, "Smith");
		assert.strictEqual(result.data.years, 30);
	});

	it("transform rejects invalid input YAML", async () => {
		const result = await yamlManipulationImpl({
			action: "transform",
			input: "{ invalid: yaml: [",
			mapping: JSON.stringify({ a: "b" }),
		});
		assert.strictEqual(result.ok, false);
		assert.ok(result.error.includes("YAML parse error"));
	});

	it("transform rejects invalid mapping JSON", async () => {
		const result = await yamlManipulationImpl({
			action: "transform",
			input: "a: 1",
			mapping: "{ invalid json }",
		});
		assert.strictEqual(result.ok, false);
		assert.ok(result.error.includes("Invalid mapping JSON"));
	});

	it("transform rejects non-object mapping", async () => {
		const result = await yamlManipulationImpl({
			action: "transform",
			input: "a: 1",
			mapping: JSON.stringify(["not", "an", "object"]),
		});
		assert.strictEqual(result.ok, false);
		assert.ok(result.error.includes("Mapping must be an object"));
	});

	it("transform with nested mapping (dot-notation path)", async () => {
		const result = await yamlManipulationImpl({
			action: "transform",
			input: "user:\n  firstName: Alice\n  lastName: Smith\nage: 30",
			mapping: JSON.stringify({ name: { name: "user.firstName" }, surname: { surname: "user.lastName" } }),
		});
		assert.strictEqual(result.ok, true);
		assert.strictEqual(result.data.name, "Alice");
		assert.strictEqual(result.data.surname, "Smith");
	});

	it("transform with nested mapping skips undefined paths", async () => {
		const result = await yamlManipulationImpl({
			action: "transform",
			input: "user:\n  firstName: Alice",
			mapping: JSON.stringify({ name: { name: "user.firstName" }, missing: { missing: "user.nonexistent" } }),
		});
		assert.strictEqual(result.ok, true);
		assert.strictEqual(result.data.name, "Alice");
		assert.strictEqual(result.data.missing, undefined);
	});

	it("transform handles null/undefined values", async () => {
		const result = await yamlManipulationImpl({
			action: "transform",
			input: "a: null\nc: 42",
			mapping: JSON.stringify({ x: "a", y: "b", z: "c" }),
		});
		assert.strictEqual(result.ok, true);
		assert.strictEqual(result.data.x, null);
		assert.strictEqual(result.data.z, 42);
	});

	it("transform handles array values recursively", async () => {
		const result = await yamlManipulationImpl({
			action: "transform",
			input: "items:\n  - name: Alice\n  - name: Bob",
			mapping: JSON.stringify({ names: "items" }),
		});
		assert.strictEqual(result.ok, true);
		assert.ok(Array.isArray(result.data.names));
		// The transform applies the same mapping rules recursively;
		// nested objects don't have the mapped keys so they become empty objects
		assert.strictEqual(result.data.names.length, 2);
	});

	it("transform requires mapping", async () => {
		const result = await yamlManipulationImpl({
			action: "transform",
			input: "a: 1",
		});
		assert.strictEqual(result.ok, false);
		assert.ok(result.error.includes("Mapping is required"));
	});

	it("filters with path expression", async () => {
		const result = await yamlManipulationImpl({
			action: "filter",
			input: "users:\n  - name: Alice\n  - name: Bob",
			format: "yaml",
			path: "users[*].name",
		});
		assert.strictEqual(result.ok, true);
		assert.ok(Array.isArray(result.data));
		assert.ok(result.data.includes("Alice"));
		assert.ok(result.data.includes("Bob"));
	});

	it("filter rejects invalid input YAML", async () => {
		const result = await yamlManipulationImpl({
			action: "filter",
			input: "{ invalid: yaml: [",
			path: "a",
		});
		assert.strictEqual(result.ok, false);
		assert.ok(result.error.includes("YAML parse error"));
	});

	it("filter requires path", async () => {
		const result = await yamlManipulationImpl({
			action: "filter",
			input: "a: 1",
		});
		assert.strictEqual(result.ok, false);
		assert.ok(result.error.includes("Path is required"));
	});

	it("accesses nested path (dot notation)", async () => {
		const result = await yamlManipulationImpl({
			action: "filter",
			input: "nested:\n  deep:\n    value: 42",
			format: "yaml",
			path: "nested.deep.value",
		});
		assert.strictEqual(result.ok, true);
		assert.strictEqual(result.data, 42);
	});

	it("accesses array index", async () => {
		const result = await yamlManipulationImpl({
			action: "filter",
			input: "items:\n  - a\n  - b\n  - c",
			format: "yaml",
			path: "items[1]",
		});
		assert.strictEqual(result.ok, true);
		assert.strictEqual(result.data, "b");
	});

	it("filter returns undefined for null/undefined intermediate path", async () => {
		const result = await yamlManipulationImpl({
			action: "filter",
			input: "a: null",
			path: "a.b.c",
		});
		assert.strictEqual(result.ok, true);
		assert.strictEqual(result.data, undefined);
	});

	it("filter rejects key not found in array index notation", async () => {
		const result = await yamlManipulationImpl({
			action: "filter",
			input: "items:\n  - a",
			path: "missing[0]",
		});
		assert.strictEqual(result.ok, false);
		assert.ok(result.error.includes("Key not found"));
	});

	it("filter rejects array index out of bounds", async () => {
		const result = await yamlManipulationImpl({
			action: "filter",
			input: "items:\n  - a",
			path: "items[5]",
		});
		assert.strictEqual(result.ok, false);
		assert.ok(result.error.includes("Array index out of bounds"));
	});

	it("filter rejects non-array with array index notation", async () => {
		const result = await yamlManipulationImpl({
			action: "filter",
			input: "items: not-an-array",
			path: "items[0]",
		});
		assert.strictEqual(result.ok, false);
		assert.ok(result.error.includes("Not an array"));
	});

	it("filter rejects path not found", async () => {
		const result = await yamlManipulationImpl({
			action: "filter",
			input: "a: 1",
			path: "b.c",
		});
		assert.strictEqual(result.ok, false);
		assert.ok(result.error.includes("Path not found"));
	});

	it("filter with [*] wildcard returns array values", async () => {
		const result = await yamlManipulationImpl({
			action: "filter",
			input: "users:\n  - name: Alice\n  - name: Bob",
			path: "users[*].name",
		});
		assert.strictEqual(result.ok, true);
		assert.deepStrictEqual(result.data, ["Alice", "Bob"]);
	});

	it("filter with [*] wildcard returns base array when no key after wildcard", async () => {
		const result = await yamlManipulationImpl({
			action: "filter",
			input: "items:\n  - a\n  - b",
			path: "items[*]",
		});
		assert.strictEqual(result.ok, true);
		assert.deepStrictEqual(result.data, ["a", "b"]);
	});

	it("filter with [*] wildcard returns error when base path missing", async () => {
		const result = await yamlManipulationImpl({
			action: "filter",
			input: "a: 1",
			path: "missing[*].name",
		});
		assert.strictEqual(result.ok, false);
		assert.ok(result.error.includes("Path does not lead to an array"));
	});

	it("filter with [*] wildcard rejects non-array base", async () => {
		const result = await yamlManipulationImpl({
			action: "filter",
			input: "items: not-an-array",
			path: "items[*].name",
		});
		assert.strictEqual(result.ok, false);
		assert.ok(result.error.includes("Path does not lead to an array"));
	});

	it("transform nested mapping with null intermediate value", async () => {
		const result = await yamlManipulationImpl({
			action: "transform",
			input: "a: null",
			mapping: JSON.stringify({ x: { x: "a.b" } }),
		});
		assert.strictEqual(result.ok, true);
		assert.strictEqual(result.data.x, undefined);
	});

	it("filter with [*] wildcard returns undefined when base path is null", async () => {
		const result = await yamlManipulationImpl({
			action: "filter",
			input: "a: null",
			path: "a.b[*].name",
		});
		assert.strictEqual(result.ok, true);
		assert.strictEqual(result.data, undefined);
	});

	it("filter with [*] wildcard returns error when base path leads to non-array", async () => {
		const result = await yamlManipulationImpl({
			action: "filter",
			input: "a:\n  b: null",
			path: "a.b[*].name",
		});
		assert.strictEqual(result.ok, false);
		assert.ok(result.error.includes("Path does not lead to an array"));
	});

	it("filter with [*] wildcard skips items missing the key", async () => {
		const result = await yamlManipulationImpl({
			action: "filter",
			input: "users:\n  - name: Alice\n  - notName: Bob",
			path: "users[*].name",
		});
		assert.strictEqual(result.ok, true);
		assert.deepStrictEqual(result.data, ["Alice"]);
	});

	it("rejects invalid action", async () => {
		const result = await yamlManipulationImpl({
			action: "invalid-action",
			input: "name: test",
			format: "yaml",
		});
		assert.strictEqual(result.ok, false);
	});

	it("yamlManipulation outer function parses JSON string input", async () => {
		const result = await yamlManipulation(
			JSON.stringify({ action: "parse", input: "a: 1" }),
		);
		assert.strictEqual(result.ok, true);
		assert.strictEqual(result.data.a, 1);
	});

	it("yamlManipulation outer function rejects invalid JSON input", async () => {
		const result = await yamlManipulation("{ invalid json }");
		assert.strictEqual(result.ok, false);
		assert.ok(result.error.includes("Invalid JSON input"));
	});

	it("createYamlTool returns a LangChain tool with correct schema", () => {
		const tool = createYamlTool();
		assert.strictEqual(tool.name, "yaml");
		assert.ok(typeof tool._call === "function" || typeof tool.invoke === "function");
	});

	it("createYamlTool tool processes input correctly", async () => {
		const tool = createYamlTool();
		const result = await tool.invoke({
			action: "parse",
			input: "hello: world",
		});
		const parsed = JSON.parse(result);
		assert.strictEqual(parsed.ok, true);
		assert.strictEqual(parsed.data.hello, "world");
	});
});
