import { describe, it } from "node:test";
import assert from "node:assert";
import { dataTool, DataToolSchema } from "../../../src/tools/data.js";

describe("dataTool tool - dataTool", () => {
	describe("JSON parsing", () => {
		it("parses valid JSON", async () => {
			const result = await dataTool({ action: "parse", input: '{"foo": "bar"}' });
			assert.strictEqual(result.ok, true);
			assert.deepStrictEqual(result.data, { foo: "bar" });
		});

		it("rejects invalid JSON", async () => {
			const result = await dataTool({ action: "parse", input: "not json" });
			assert.strictEqual(result.ok, false);
			assert.ok(result.error);
		});

		it("rejects empty string", async () => {
			const result = await dataTool({ action: "parse", input: "" });
			assert.strictEqual(result.ok, false);
		});
	});

	describe("JSON serialization", () => {
		it("serializes object", async () => {
			const result = await dataTool({ action: "serialize", data: { foo: "bar" } });
			assert.strictEqual(result.ok, true);
			assert.ok(result.data.includes('"foo"'));
		});

		it("serializes with custom indent", async () => {
			const result = await dataTool({ action: "serialize", data: { a: 1 }, indent: 4 });
			assert.strictEqual(result.ok, true);
			assert.ok(result.data.includes("    "));
		});
	});

	describe("JSONPath filtering", () => {
		it("filters by key path", async () => {
			const result = await dataTool({
				action: "filter",
				input: JSON.stringify([{ name: "Alice" }, { name: "Bob" }]),
				path: "$[*].name",
			});
			assert.strictEqual(result.ok, true);
			assert.deepStrictEqual(result.data, ["Alice", "Bob"]);
		});

		it("returns empty array for no matches", async () => {
			const result = await dataTool({
				action: "filter",
				input: JSON.stringify({ a: 1 }),
				path: "$.nonexistent",
			});
			assert.strictEqual(result.ok, true);
			assert.deepStrictEqual(result.data, []);
		});
	});

	describe("JSON transformation", () => {
		it("renames fields", async () => {
			const result = await dataTool({
				action: "transform",
				data: { name: "Alice", age: 30 },
				mapping: { renames: { name: "title" } },
			});
			assert.strictEqual(result.ok, true);
			assert.strictEqual(result.data.title, "Alice");
			assert.strictEqual(result.data.name, undefined);
		});

		it("adds fields", async () => {
			const result = await dataTool({
				action: "transform",
				data: { name: "Alice" },
				mapping: { additions: { age: 30 } },
			});
			assert.strictEqual(result.ok, true);
			assert.strictEqual(result.data.age, 30);
		});

		it("removes fields", async () => {
			const result = await dataTool({
				action: "transform",
				data: { name: "Alice", password: "secret" },
				mapping: { removals: ["password"] },
			});
			assert.strictEqual(result.ok, true);
			assert.strictEqual(result.data.password, undefined);
		});
	});

	describe("YAML parsing", () => {
		it("parses valid YAML", async () => {
			const result = await dataTool({ action: "yamlParse", input: "foo: bar\nbaz: 123" });
			assert.strictEqual(result.ok, true);
			assert.deepStrictEqual(result.data, { foo: "bar", baz: 123 });
		});

		it("rejects invalid YAML", async () => {
			const result = await dataTool({ action: "yamlParse", input: "{{invalid yaml" });
			assert.strictEqual(result.ok, false);
		});
	});

	describe("YAML serialization", () => {
		it("serializes object", async () => {
			const result = await dataTool({ action: "yamlSerialize", data: { foo: "bar" } });
			assert.strictEqual(result.ok, true);
			assert.ok(result.data.includes("foo"));
		});
	});

	describe("YAML path access", () => {
		it("accesses nested value", async () => {
			const result = await dataTool({
				action: "yamlPath",
				input: "database:\n  host: localhost\n  port: 5432",
				path: "database.host",
			});
			assert.strictEqual(result.ok, true);
			assert.strictEqual(result.data, "localhost");
		});

		it("returns null for non-existent path", async () => {
			const result = await dataTool({
				action: "yamlPath",
				input: "{ a: 1 }",
				path: "nonexistent",
			});
			assert.strictEqual(result.ok, true);
			assert.strictEqual(result.data, undefined);
		});
	});

	describe("JSON to CSV", () => {
		it("converts simple array", async () => {
			const result = await dataTool({
				action: "jsonToCsv",
				input: JSON.stringify([
					{ name: "Alice", age: 30 },
					{ name: "Bob", age: 25 },
				]),
			});
			assert.strictEqual(result.ok, true);
			assert.ok(result.data.includes("name"));
			assert.ok(result.data.includes("Alice"));
		});

		it("handles missing fields", async () => {
			const result = await dataTool({
				action: "jsonToCsv",
				input: JSON.stringify([{ name: "Alice" }, { name: "Bob", age: 25 }]),
			});
			assert.strictEqual(result.ok, true);
			assert.ok(result.data.includes("name"));
		});
	});

	describe("CSV to JSON", () => {
		it("converts CSV", async () => {
			const result = await dataTool({
				action: "csvToJson",
				input: "name,age\nAlice,30\nBob,25",
			});
			assert.strictEqual(result.ok, true);
			assert.ok(Array.isArray(result.data));
			assert.strictEqual(result.data[0].name, "Alice");
		});

		it("handles quoted fields", async () => {
			const result = await dataTool({
				action: "csvToJson",
				input: 'name,city\nAlice,"New York"',
			});
			assert.strictEqual(result.ok, true);
			assert.strictEqual(result.data[0].city, "New York");
		});
	});

	describe("JSON to YAML", () => {
		it("converts JSON to YAML", async () => {
			const result = await dataTool({
				action: "jsonToYaml",
				input: JSON.stringify({ foo: "bar", baz: 123 }),
			});
			assert.strictEqual(result.ok, true);
			assert.ok(result.data.includes("foo"));
		});
	});

	describe("YAML to JSON", () => {
		it("converts YAML to JSON", async () => {
			const result = await dataTool({
				action: "yamlToJson",
				input: "foo: bar\nbaz: 123",
			});
			assert.strictEqual(result.ok, true);
			assert.ok(result.data.includes('"foo"'));
		});
	});

	describe("Field mapping", () => {
		it("maps fields in JSON", async () => {
			const result = await dataTool({
				action: "mapFields",
				input: JSON.stringify({ name: "Alice", password: "secret" }),
				mapping: { renames: { name: "title" }, removals: ["password"] },
			});
			assert.strictEqual(result.ok, true);
			assert.ok(result.data.includes('"title"'));
			assert.ok(!result.data.includes('"password"'));
		});
	});

	describe("Schema validation", () => {
		it("validates against schema", async () => {
			const result = await dataTool({
				action: "validate",
				input: JSON.stringify({ name: "Alice", age: 30 }),
				schema: {
					type: "object",
					properties: {
						name: { type: "string" },
						age: { type: "number" },
					},
					required: ["name", "age"],
				},
			});
			assert.strictEqual(result.ok, true);
			assert.strictEqual(result.valid, true);
		});

		it("rejects invalid data", async () => {
			const result = await dataTool({
				action: "validate",
				input: JSON.stringify({ name: "Alice" }),
				schema: {
					type: "object",
					properties: {
						name: { type: "string" },
						age: { type: "number" },
					},
					required: ["name", "age"],
				},
			});
			assert.strictEqual(result.ok, true);
			assert.strictEqual(result.valid, false);
		});
	});

	describe("Unknown action", () => {
		it("rejects unknown action", async () => {
			const result = await dataTool({ action: "unknown" });
			assert.strictEqual(result.ok, false);
			assert.ok(result.error);
		});
	});

	describe("Schema", () => {
		it("has correct schema", () => {
			assert.ok(DataToolSchema);
			const shape = DataToolSchema.shape;
			assert.ok(shape.action);
			assert.ok(shape.input);
			assert.ok(shape.data);
		});
	});
});
