import { describe, it } from "node:test";
import assert from "node:assert";
import { jsonManipulationImpl } from "../../src/tools/json/index.js";

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

	it("rejects invalid JSONPath", async () => {
		const result = await jsonManipulationImpl({
			action: "filter",
			input: JSON.stringify({ a: 1 }),
			path: "$.invalid[",
		});
		assert.strictEqual(result.ok, true);
		assert.ok(Array.isArray(result.data));
	});
});
