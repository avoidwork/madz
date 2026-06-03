import { describe, it } from "node:test";
import assert from "node:assert";
import { createDateTool, dateImpl } from "../../src/tools/date.js";
import { buildToolConfig } from "../../src/tools/index.js";

describe("date tool - dateImpl", () => {
	it("returns ISO 8601 format by default", () => {
		const result = dateImpl({});
		assert.ok(
			/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(result),
			`Expected ISO 8601 format, got: ${result}`,
		);
	});

	it("returns ISO 8601 format when format is 'iso'", () => {
		const result = dateImpl({ format: "iso" });
		assert.ok(
			/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(result),
			`Expected ISO 8601 format, got: ${result}`,
		);
	});

	it("returns human-readable format when format is 'human'", () => {
		const result = dateImpl({ format: "human" });
		// Date.toString() returns something like "Wed Jun 03 2026 10:30:00 GMT-0400 (EDT)"
		assert.ok(typeof result === "string", "Expected string result");
		assert.ok(result.length > 20, "Human format should be a reasonably long string");
	});

	it("returns distinct timestamps for separate calls", async () => {
		const result1 = dateImpl({});
		await new Promise((resolve) => setTimeout(resolve, 1050));
		const result2 = dateImpl({});
		assert.notStrictEqual(result1, result2, "Expected distinct timestamps after 1+ second delay");
	});
});

describe("date tool - createDateTool", () => {
	it("returns a LangChain Tool with correct name", () => {
		const toolInstance = createDateTool({});
		assert.strictEqual(toolInstance.name, "date");
	});

	it("returns a LangChain Tool with description", () => {
		const toolInstance = createDateTool({});
		assert.ok(toolInstance.description.length > 10, "Expected a descriptive description");
	});

	it("returns a LangChain Tool with a zod schema", () => {
		const toolInstance = createDateTool({});
		assert.ok(toolInstance.schema, "Expected a schema to be defined");
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
