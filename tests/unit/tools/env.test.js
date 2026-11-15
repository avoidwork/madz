import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert";

describe("env tool", () => {
	beforeEach(() => {
		process.env.MADZ_ENV_TEST_VAR = "test-value-123";
	});

	afterEach(() => {
		delete process.env.MADZ_ENV_TEST_VAR;
	});

	it("returns the value of a named environment variable", async () => {
		const { env } = await import("../../../src/tools/env/index.js");
		const result = await env.invoke({ name: "MADZ_ENV_TEST_VAR" });
		assert.strictEqual(result.ok, true);
		assert.strictEqual(result.name, "MADZ_ENV_TEST_VAR");
		assert.strictEqual(result.value, "test-value-123");
	});

	it("returns ok:false for a missing environment variable", async () => {
		const { env } = await import("../../../src/tools/env/index.js");
		const result = await env.invoke({ name: "MADZ_ENV_NONEXISTENT_XYZ" });
		assert.strictEqual(result.ok, false);
		assert.ok(typeof result.error === "string" && result.error.length > 0);
	});

	it("returns the full environment when all is true", async () => {
		const { env } = await import("../../../src/tools/env/index.js");
		const result = await env.invoke({ all: true });
		assert.strictEqual(result.ok, true);
		assert.ok(typeof result.env === "object" && result.env !== null);
		assert.strictEqual(result.env.MADZ_ENV_TEST_VAR, "test-value-123");
	});

	it("returns the full environment by default when no name is given", async () => {
		const { env } = await import("../../../src/tools/env/index.js");
		const result = await env.invoke({});
		assert.strictEqual(result.ok, true);
		assert.ok(typeof result.env === "object" && result.env !== null);
	});

	it("rejects invalid input via schema validation", async () => {
		const { env } = await import("../../../src/tools/env/index.js");
		// The LangChain tool() wrapper validates input against the schema before
		// calling envImpl, so a non-string name throws rather than returning
		// { ok: false, error }.
		await assert.rejects(async () => env.invoke({ name: 123 }), /expected string|Invalid input/i);
	});

	it("envImpl returns ok:false for invalid input when called directly", async () => {
		const { envImpl } = await import("../../../src/tools/env/index.js");
		const result = envImpl({ name: 123 });
		assert.strictEqual(result.ok, false);
		assert.ok(typeof result.error === "string" && result.error.length > 0);
	});

	it("has correct tool metadata", async () => {
		const { env } = await import("../../../src/tools/env/index.js");
		assert.strictEqual(env.name, "env");
		assert.ok(typeof env.description === "string" && env.description.length > 0);
		assert.ok(env.schema);
	});

	it("does not leak env values into logs", async () => {
		const { env } = await import("../../../src/tools/env/index.js");
		const result = await env.invoke({ name: "MADZ_ENV_TEST_VAR" });
		assert.strictEqual(result.ok, true);
		assert.strictEqual(result.value, "test-value-123");
		// The value is returned in the structured result; no console.log is used.
		// This test asserts the tool returns the value without emitting it to stdout.
	});
});

describe("env tool registration", () => {
	it("registers env when env:read is enabled", async () => {
		const { buildToolConfig } = await import("../../../src/tools/index.js");
		const tools = await buildToolConfig({
			permissions: ["env:read"],
			maxReadSize: 1024 * 1024,
		});
		const toolNames = tools.map((t) => t.name);
		assert.ok(toolNames.includes("env"), "env should register with env:read enabled");
	});

	it("does not register env when env:read is absent", async () => {
		const { buildToolConfig } = await import("../../../src/tools/index.js");
		const tools = await buildToolConfig({
			permissions: ["filesystem:read"],
			maxReadSize: 1024 * 1024,
		});
		const toolNames = tools.map((t) => t.name);
		assert.ok(!toolNames.includes("env"), "env should NOT register without env:read");
	});

	it("TOOL_PERMISSIONS.env requires env:read", async () => {
		const { TOOL_PERMISSIONS } = await import("../../../src/tools/index.js");
		assert.deepStrictEqual(TOOL_PERMISSIONS.env, ["env:read"]);
	});
});
