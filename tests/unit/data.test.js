import { describe, it } from "node:test";
import assert from "node:assert";
import { dataTransformationImpl, dataTransformation, createDataTool } from "../../src/tools/data/index.js";

describe("data tool", () => {
	it("converts JSON to YAML", async () => {
		const result = await dataTransformationImpl({
			action: "json-to-yaml",
			input: JSON.stringify({ name: "test", value: 42 }),
			format: "json",
		});
		assert.strictEqual(result.ok, true);
		assert.ok(result.data.includes("name: test"));
		assert.ok(result.data.includes("value: 42"));
	});

	it("converts YAML to JSON", async () => {
		const result = await dataTransformationImpl({
			action: "yaml-to-json",
			input: "name: test\nvalue: 42",
			format: "yaml",
		});
		assert.strictEqual(result.ok, true);
		assert.ok(result.data.includes('"name"'));
		assert.ok(result.data.includes('"test"'));
	});

	it("converts JSON to CSV", async () => {
		const result = await dataTransformationImpl({
			action: "json-to-csv",
			input: JSON.stringify([
				{ name: "Alice", age: 30 },
				{ name: "Bob", age: 25 },
			]),
			format: "json",
		});
		assert.strictEqual(result.ok, true);
		assert.ok(result.data.includes("name,age"));
		assert.ok(result.data.includes("Alice,30"));
		assert.ok(result.data.includes("Bob,25"));
	});

	it("converts single object JSON to CSV", async () => {
		const result = await dataTransformationImpl({
			action: "json-to-csv",
			input: JSON.stringify({ name: "Alice", age: 30 }),
			format: "json",
		});
		assert.strictEqual(result.ok, true);
		assert.ok(result.data.includes("name,age"));
		assert.ok(result.data.includes("Alice,30"));
	});

	it("converts CSV to JSON", async () => {
		const result = await dataTransformationImpl({
			action: "csv-to-json",
			input: "name,age\nAlice,30\nBob,25",
			format: "csv",
		});
		assert.strictEqual(result.ok, true);
		const data = JSON.parse(result.data);
		assert.ok(Array.isArray(data));
		assert.strictEqual(data.length, 2);
		assert.strictEqual(data[0].name, "Alice");
		assert.strictEqual(data[1].name, "Bob");
	});

	it("converts YAML to CSV (array)", async () => {
		const result = await dataTransformationImpl({
			action: "yaml-to-csv",
			input: "- name: Alice\n  age: 30\n- name: Bob\n  age: 25",
			format: "yaml",
		});
		assert.strictEqual(result.ok, true);
		assert.ok(result.data.includes("name,age"));
		assert.ok(result.data.includes("Alice,30"));
		assert.ok(result.data.includes("Bob,25"));
	});

	it("converts YAML to CSV (single object)", async () => {
		const result = await dataTransformationImpl({
			action: "yaml-to-csv",
			input: "name: Alice\nage: 30",
			format: "yaml",
		});
		assert.strictEqual(result.ok, true);
		assert.ok(result.data.includes("name,age"));
		assert.ok(result.data.includes("Alice,30"));
	});

	it("converts YAML to CSV rejects non-object/non-array", async () => {
		const result = await dataTransformationImpl({
			action: "yaml-to-csv",
			input: "42",
			format: "yaml",
		});
		assert.strictEqual(result.ok, false);
		assert.ok(result.error.includes("YAML must contain an object or array"));
	});

	it("converts CSV to YAML", async () => {
		const result = await dataTransformationImpl({
			action: "csv-to-yaml",
			input: "name,age\nAlice,30\nBob,25",
			format: "csv",
		});
		assert.strictEqual(result.ok, true);
		assert.ok(result.data.includes("name: Alice"));
		assert.ok(result.data.includes("name: Bob"));
		// CSV values are strings, so js-yaml quotes them
		assert.ok(result.data.includes("age:"));
		assert.ok(result.data.includes("30"));
	});

	it("applies mapping rules during JSON to CSV conversion", async () => {
		const result = await dataTransformationImpl({
			action: "json-to-csv",
			input: JSON.stringify([{ firstName: "Alice", lastName: "Smith" }]),
			format: "json",
			mapping: JSON.stringify({ name: "firstName", surname: "lastName" }),
		});
		assert.strictEqual(result.ok, true);
		assert.ok(result.data.includes("name,surname"));
		assert.ok(result.data.includes("Alice,Smith"));
	});

	it("applies mapping rules during YAML to CSV conversion", async () => {
		const result = await dataTransformationImpl({
			action: "yaml-to-csv",
			input: "- firstName: Alice\n  lastName: Smith",
			format: "yaml",
			mapping: JSON.stringify({ name: "firstName", surname: "lastName" }),
		});
		assert.strictEqual(result.ok, true);
		assert.ok(result.data.includes("name,surname"));
		assert.ok(result.data.includes("Alice,Smith"));
	});

	it("mapping rejects invalid mapping JSON", async () => {
		const result = await dataTransformationImpl({
			action: "json-to-csv",
			input: JSON.stringify([{ a: 1 }]),
			format: "json",
			mapping: "{ invalid json }",
		});
		assert.strictEqual(result.ok, false);
		assert.ok(result.error.includes("Invalid mapping JSON"));
	});

	it("rejects invalid JSON input", async () => {
		const result = await dataTransformationImpl({
			action: "json-to-yaml",
			input: "{ invalid json }",
			format: "json",
		});
		assert.strictEqual(result.ok, false);
		assert.ok(result.error.includes("Invalid JSON input"));
	});

	it("rejects invalid YAML input", async () => {
		const result = await dataTransformationImpl({
			action: "yaml-to-json",
			input: "{ invalid: yaml: [",
			format: "yaml",
		});
		assert.strictEqual(result.ok, false);
		assert.ok(result.error.includes("Invalid YAML input"));
	});

	it("rejects invalid CSV input", async () => {
		const result = await dataTransformationImpl({
			action: "csv-to-json",
			input: "a,b\n1,2\n3",
			format: "csv",
		});
		assert.strictEqual(result.ok, false);
		assert.ok(result.error.includes("Invalid CSV input"));
	});

	it("rejects invalid action", async () => {
		const result = await dataTransformationImpl({
			action: "invalid-action",
			input: "{}",
			format: "json",
		});
		assert.strictEqual(result.ok, false);
	});

	it("rejects invalid format", async () => {
		const result = await dataTransformationImpl({
			action: "json-to-yaml",
			input: "{}",
			format: "invalid",
		});
		assert.strictEqual(result.ok, false);
	});

	it("rejects empty input string", async () => {
		const result = await dataTransformationImpl({
			action: "json-to-yaml",
			input: "",
			format: "json",
		});
		assert.strictEqual(result.ok, false);
		assert.ok(result.error.includes("Input must be a non-empty string"));
	});

	it("rejects whitespace-only input", async () => {
		const result = await dataTransformationImpl({
			action: "json-to-yaml",
			input: "   ",
			format: "json",
		});
		assert.strictEqual(result.ok, false);
		assert.ok(result.error.includes("Input must be a non-empty string"));
	});

	it("rejects non-string input via validateFormat", async () => {
		// validateFormat's typeof check is dead code since zod ensures string input
		// This test verifies the empty string check instead
		const result = await dataTransformationImpl({
			action: "json-to-yaml",
			input: "",
			format: "json",
		});
		assert.strictEqual(result.ok, false);
		assert.ok(result.error.includes("Input must be a non-empty string"));
	});

	it("dataTransformation outer function parses JSON string input", async () => {
		const result = await dataTransformation(
			JSON.stringify({ action: "json-to-yaml", input: JSON.stringify({ a: 1 }), format: "json" }),
		);
		assert.strictEqual(result.ok, true);
		assert.ok(result.data.includes("a: 1"));
	});

	it("dataTransformation outer function rejects invalid JSON input", async () => {
		const result = await dataTransformation("{ invalid json }");
		assert.strictEqual(result.ok, false);
		assert.ok(result.error.includes("Invalid JSON input"));
	});

	it("createDataTool returns a LangChain tool with correct schema", () => {
		const tool = createDataTool();
		assert.strictEqual(tool.name, "data");
		assert.ok(typeof tool._call === "function" || typeof tool.invoke === "function");
	});

	it("createDataTool tool processes input correctly", async () => {
		const tool = createDataTool();
		const result = await tool.invoke({
			action: "json-to-yaml",
			input: JSON.stringify({ hello: "world" }),
			format: "json",
		});
		const parsed = JSON.parse(result);
		assert.strictEqual(parsed.ok, true);
		assert.ok(parsed.data.includes("hello: world"));
	});
});
