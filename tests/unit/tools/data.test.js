import { describe, it } from "node:test";
import assert from "node:assert";
import { dataTransformationImpl } from "../../../src/tools/data/index.js";

describe("dataTransformationImpl", () => {
	it("converts JSON to YAML", async () => {
		const result = await dataTransformationImpl({
			action: "json-to-yaml",
			input: '{"name": "test", "value": 42}',
			format: "json",
		});
		assert.ok(result.ok);
		assert.ok(result.data.includes("name: test"));
	});

	it("converts YAML to JSON", async () => {
		const result = await dataTransformationImpl({
			action: "yaml-to-json",
			input: "name: test\nvalue: 42\n",
			format: "yaml",
		});
		assert.ok(result.ok);
		assert.ok(result.data.includes('"name"'));
	});

	it("converts JSON to CSV", async () => {
		const result = await dataTransformationImpl({
			action: "json-to-csv",
			input: '[{"name": "Alice", "age": 30}, {"name": "Bob", "age": 25}]',
			format: "json",
		});
		assert.ok(result.ok);
		assert.ok(result.data.includes("Alice"));
	});

	it("converts CSV to JSON", async () => {
		const result = await dataTransformationImpl({
			action: "csv-to-json",
			input: "name,age\nAlice,30\nBob,25\n",
			format: "csv",
		});
		assert.ok(result.ok);
		assert.ok(result.data.includes("Alice"));
	});

	it("converts YAML to CSV", async () => {
		const result = await dataTransformationImpl({
			action: "yaml-to-csv",
			input: "- name: Alice\n  age: 30\n- name: Bob\n  age: 25\n",
			format: "yaml",
		});
		assert.ok(result.ok);
		assert.ok(result.data.includes("Alice"));
	});

	it("converts CSV to YAML", async () => {
		const result = await dataTransformationImpl({
			action: "csv-to-yaml",
			input: "name,age\nAlice,30\n",
			format: "csv",
		});
		assert.ok(result.ok);
		assert.ok(result.data.includes("Alice"));
	});

	it("rejects invalid JSON input", async () => {
		const result = await dataTransformationImpl({
			action: "json-to-yaml",
			input: "{invalid}",
			format: "json",
		});
		assert.ok(!result.ok);
		assert.ok(result.error.includes("Invalid JSON input"));
	});

	it("rejects invalid YAML input", async () => {
		const result = await dataTransformationImpl({
			action: "yaml-to-json",
			input: "\tinvalid:\t: yaml",
			format: "yaml",
		});
		assert.ok(!result.ok);
		assert.ok(result.error.includes("Invalid YAML input"));
	});

	it("rejects invalid CSV input", async () => {
		const result = await dataTransformationImpl({
			action: "csv-to-json",
			input: "a,b\n1",
			format: "csv",
		});
		assert.ok(!result.ok);
		assert.ok(result.error.includes("Invalid CSV input"));
	});

	it("rejects unknown action via schema", async () => {
		const result = await dataTransformationImpl({
			action: "unknown-action",
			input: "{}",
			format: "json",
		});
		assert.ok(!result.ok);
		assert.ok(result.error.includes("Invalid input"));
	});

	it("rejects invalid schema", async () => {
		const result = await dataTransformationImpl({});
		assert.ok(!result.ok);
		assert.ok(result.error.includes("Invalid input"));
	});

	it("handles JSON to CSV with mapping", async () => {
		const result = await dataTransformationImpl({
			action: "json-to-csv",
			input: '[{"name": "Alice", "age": 30}]',
			format: "json",
			mapping: '{"FullName": "name"}',
		});
		assert.ok(result.ok);
		assert.ok(result.data.includes("FullName"));
	});

	it("rejects invalid mapping JSON", async () => {
		const result = await dataTransformationImpl({
			action: "json-to-csv",
			input: '[{"name": "Alice"}]',
			format: "json",
			mapping: "{invalid}",
		});
		assert.ok(!result.ok);
		assert.ok(result.error.includes("Invalid mapping JSON"));
	});

	it("handles empty input string", async () => {
		const result = await dataTransformationImpl({
			action: "json-to-yaml",
			input: "",
			format: "json",
		});
		assert.ok(!result.ok);
		assert.ok(result.error.includes("non-empty string"));
	});

	it("handles single object JSON to CSV", async () => {
		const result = await dataTransformationImpl({
			action: "json-to-csv",
			input: '{"name": "Alice", "age": 30}',
			format: "json",
		});
		assert.ok(result.ok);
		assert.ok(result.data.includes("Alice"));
	});

	it("handles YAML object to CSV", async () => {
		const result = await dataTransformationImpl({
			action: "yaml-to-csv",
			input: "name: Alice\nage: 30\n",
			format: "yaml",
		});
		assert.ok(result.ok);
		assert.ok(result.data.includes("Alice"));
	});

	it("handles YAML scalar to CSV (error)", async () => {
		const result = await dataTransformationImpl({
			action: "yaml-to-csv",
			input: "just a string",
			format: "yaml",
		});
		assert.ok(!result.ok);
		assert.ok(result.error.includes("must contain an object or array"));
	});
});
