import { describe, it } from "node:test";
import assert from "node:assert";
import { yamlManipulationImpl } from "../../src/tools/yaml.js";

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

	it("rejects invalid YAML input", async () => {
		const result = await yamlManipulationImpl({
			action: "parse",
			input: "name: { invalid: yaml: [",
			format: "yaml",
		});
		assert.strictEqual(result.ok, false);
		assert.ok(result.error.includes("YAML parse error"));
	});

	it("rejects invalid action", async () => {
		const result = await yamlManipulationImpl({
			action: "invalid-action",
			input: "name: test",
			format: "yaml",
		});
		assert.strictEqual(result.ok, false);
	});
});
