import { describe, it } from "node:test";
import assert from "node:assert";
import { date, dateImpl } from "../../src/tools/date/index.js";
import { buildToolConfig } from "../../src/tools/index.js";

describe("date tool - dateImpl", () => {
	it("returns ISO 8601 format by default", () => {
		const result = dateImpl({});
		assert.strictEqual(result.ok, true);
		assert.strictEqual(result.format, "iso");
		assert.ok(
			/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(result.date),
			`Expected ISO 8601 format, got: ${result.date}`,
		);
	});

	it("returns ISO 8601 format when format is 'iso'", () => {
		const result = dateImpl({ format: "iso" });
		assert.strictEqual(result.ok, true);
		assert.strictEqual(result.format, "iso");
		assert.ok(
			/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(result.date),
			`Expected ISO 8601 format, got: ${result.date}`,
		);
	});

	it("returns human-readable format when format is 'human'", () => {
		const result = dateImpl({ format: "human" });
		assert.strictEqual(result.ok, true);
		assert.strictEqual(result.format, "human");
		// Date.toString() returns something like "Wed Jun 03 2026 10:30:00 GMT-0400 (EDT)"
		assert.ok(typeof result.date === "string", "Expected string result");
		assert.ok(result.date.length > 20, "Human format should be a reasonably long string");
	});

	it("returns structured failure for invalid format", () => {
		const result = dateImpl({ format: "invalid" });
		assert.strictEqual(result.ok, false);
		assert.ok(typeof result.error === "string", "Expected error message");
		assert.ok(result.error.length > 0, "Expected non-empty error message");
	});

	it("returns distinct timestamps for separate calls", async () => {
		const result1 = dateImpl({});
		await new Promise((resolve) => setTimeout(resolve, 1050));
		const result2 = dateImpl({});
		assert.notStrictEqual(
			result1.date,
			result2.date,
			"Expected distinct timestamps after 1+ second delay",
		);
	});
});

describe("date tool - singleton export", () => {
	it("exports a LangChain Tool with correct name", () => {
		assert.strictEqual(date.name, "date");
	});

	it("exports a LangChain Tool with description", () => {
		assert.ok(date.description.length > 10, "Expected a descriptive description");
	});

	it("exports a LangChain Tool with a zod schema", () => {
		assert.ok(date.schema, "Expected a schema to be defined");
	});

	it("invokes the tool and returns a JSON string of the structured result", async () => {
		const result = await date.invoke({});
		const parsed = JSON.parse(result);
		assert.strictEqual(parsed.ok, true);
		assert.strictEqual(parsed.format, "iso");
		assert.ok(
			/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(parsed.date),
			`Expected ISO 8601 format, got: ${parsed.date}`,
		);
	});
});

describe("date tool - buildToolConfig", () => {
	it("registers date tool without permissions", async () => {
		const tools = await buildToolConfig({ permissions: [] });
		const toolNames = tools.map((t) => t.name);
		assert.ok(
			toolNames.includes("date"),
			`Expected 'date' tool to be registered, got: ${toolNames.join(", ")}`,
		);
	});
});
