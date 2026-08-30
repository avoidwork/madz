/**
 * Tests for the YAML manipulation module.
 * @see {@link src/tools/yaml/index.js}
 */

import { describe, it } from "node:test";
import assert from "node:assert";
import { yamlManipulationImpl } from "../../../../src/tools/yaml/index.js";

describe("yamlManipulationImpl", () => {
	describe("parse", () => {
		it("should parse a YAML string", async () => {
			const result = await yamlManipulationImpl({
				action: "parse",
				input: "name: Alice\nage: 30",
			});
			assert.strictEqual(result.ok, true);
			assert.strictEqual(result.data.name, "Alice");
			assert.strictEqual(result.data.age, 30);
		});

		it("should parse nested YAML", async () => {
			const result = await yamlManipulationImpl({
				action: "parse",
				input: "user:\n  name: Bob\n  roles:\n    - admin\n    - user",
			});
			assert.strictEqual(result.ok, true);
			assert.strictEqual(result.data.user.name, "Bob");
			assert.deepStrictEqual(result.data.user.roles, ["admin", "user"]);
		});

		it("should return error for empty YAML", async () => {
			const result = await yamlManipulationImpl({
				action: "parse",
				input: "",
			});
			assert.strictEqual(result.ok, false);
			assert.ok(result.error.includes("parse error"));
		});

		it("should return error for invalid YAML", async () => {
			const result = await yamlManipulationImpl({
				action: "parse",
				input: "{{invalid yaml:::",
			});
			assert.strictEqual(result.ok, false);
			assert.ok(result.error.includes("parse error"));
		});

		it("should throw validation error for missing input", async () => {
			const result = await yamlManipulationImpl({
				action: "parse",
			});
			assert.strictEqual(result.ok, false);
			assert.ok(result.error.includes("input"));
		});
	});

	describe("serialize", () => {
		it("should serialize an object to YAML", async () => {
			const result = await yamlManipulationImpl({
				action: "serialize",
				input: "name: Alice\nage: 30",
			});
			assert.strictEqual(result.ok, true);
			assert.ok(typeof result.data === "string");
			assert.ok(result.data.includes("name"));
			assert.ok(result.data.includes("Alice"));
		});

		it("should serialize nested objects", async () => {
			const result = await yamlManipulationImpl({
				action: "serialize",
				input: "user:\n  name: Bob\n  active: true",
			});
			assert.strictEqual(result.ok, true);
			assert.ok(result.data.includes("user"));
		});
	});

	describe("filter", () => {
		it("should filter by dot-notation path", async () => {
			const result = await yamlManipulationImpl({
				action: "filter",
				input: "name: Alice\naddress:\n  city: NYC\n  zip: 10001",
				path: "address.city",
			});
			assert.strictEqual(result.ok, true);
			assert.strictEqual(result.data, "NYC");
		});

		it("should return error for missing path", async () => {
			const result = await yamlManipulationImpl({
				action: "filter",
				input: "name: Alice",
			});
			assert.strictEqual(result.ok, false);
			assert.ok(result.error.includes("Path is required"));
		});

		it("should return error for non-existent path", async () => {
			const result = await yamlManipulationImpl({
				action: "filter",
				input: "name: Alice",
				path: "address.city",
			});
			assert.strictEqual(result.ok, false);
			assert.ok(result.error.includes("not found"));
		});
	});

	describe("transform", () => {
		it("should transform keys", async () => {
			const result = await yamlManipulationImpl({
				action: "transform",
				input: "firstName: Alice\nlastName: Smith",
				mapping: JSON.stringify({ name: "firstName", surname: "lastName" }),
			});
			assert.strictEqual(result.ok, true);
			assert.strictEqual(result.data.name, "Alice");
			assert.strictEqual(result.data.surname, "Smith");
		});

		it("should return error for missing mapping", async () => {
			const result = await yamlManipulationImpl({
				action: "transform",
				input: "name: Alice",
			});
			assert.strictEqual(result.ok, false);
			assert.ok(result.error.includes("Mapping is required"));
		});
	});

	describe("access", () => {
		it("should access a value by path", async () => {
			const result = await yamlManipulationImpl({
				action: "access",
				input: "name: Alice\naddress:\n  city: NYC",
				path: "address.city",
			});
			assert.strictEqual(result.ok, true);
			assert.strictEqual(result.data, "NYC");
		});

		it("should return error for missing path", async () => {
			const result = await yamlManipulationImpl({
				action: "access",
				input: "name: Alice",
			});
			assert.strictEqual(result.ok, false);
			assert.ok(result.error.includes("Path is required"));
		});
	});

	describe("validation", () => {
		it("should reject unknown action", async () => {
			const result = await yamlManipulationImpl({
				action: "unknown",
				input: "name: Alice",
			});
			assert.strictEqual(result.ok, false);
		});

		it("should reject invalid JSON input", async () => {
			const result = await yamlManipulationImpl({
				action: "parse",
				input: undefined,
			});
			assert.strictEqual(result.ok, false);
		});
	});
});
