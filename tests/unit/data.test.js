import { describe, it } from "node:test";
import assert from "node:assert";
import { dataTransformationImpl } from "../../src/tools/data.js";

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
			input: JSON.stringify([{ name: "Alice", age: 30 }, { name: "Bob", age: 25 }]),
			format: "json",
		});
		assert.strictEqual(result.ok, true);
		assert.ok(result.data.includes("name,age"));
		assert.ok(result.data.includes("Alice,30"));
		assert.ok(result.data.includes("Bob,25"));
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

	it("applies mapping rules during conversion", async () => {
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
});
