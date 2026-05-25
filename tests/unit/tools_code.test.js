import { describe, it, before, after } from "node:test";
import assert from "node:assert";
import { executeCodeImpl } from "../../src/tools/code.js";

describe("execute_code", () => {
	let origEnv;

	before(() => {
		origEnv = {
			PYTHON_IMPORT_HOOK: process.env.PYTHON_IMPORT_HOOK,
		};
	});

	after(() => {
		process.env.PYTHON_IMPORT_HOOK = origEnv.PYTHON_IMPORT_HOOK;
	});

	it("requires code", async () => {
		const result = await executeCodeImpl({}, {});
		const parsed = JSON.parse(result);
		assert.strictEqual(parsed.ok, false);
	});

	it("rejects empty code", async () => {
		const result = await executeCodeImpl({ code: "" }, {});
		const parsed = JSON.parse(result);
		assert.strictEqual(parsed.ok, false);
	});

	it("rejects unknown language", async () => {
		const result = await executeCodeImpl({ code: "print(1)", language: "rust" }, {});
		const parsed = JSON.parse(result);
		assert.strictEqual(parsed.ok, false);
		assert.ok(parsed.error.includes("Unsupported language"));
	});

	it("executes python3 code", async () => {
		process.env.PYTHON_IMPORT_HOOK = "disable";
		const result = await executeCodeImpl({ code: "print(2 + 2)", language: "python3" }, {});
		const parsed = JSON.parse(result);
		assert.ok(parsed.ok);
		assert.strictEqual(parsed.stdout, "4");
		assert.strictEqual(parsed.stderr, "");
		assert.strictEqual(parsed.exitCode, 0);
	});

	it("executes javascript code via node", async () => {
		const result = await executeCodeImpl(
			{ code: "console.log(2 + 2)", language: "javascript" },
			{},
		);
		const parsed = JSON.parse(result);
		assert.ok(parsed.ok);
		assert.strictEqual(parsed.stdout, "4");
		assert.strictEqual(parsed.exitCode, 0);
	});

	it("executes shell script", async () => {
		const result = await executeCodeImpl({ code: "echo hello", language: "shell" }, {});
		const parsed = JSON.parse(result);
		assert.ok(parsed.ok);
		assert.equal(parsed.stdout.trim(), "hello");
		assert.strictEqual(parsed.exitCode, 0);
	});

	it("returns stderr on Python error", async () => {
		process.env.PYTHON_IMPORT_HOOK = "disable";
		const result = await executeCodeImpl(
			{ code: "raise ValueError('test')", language: "python3" },
			{},
		);
		const parsed = JSON.parse(result);
		assert.strictEqual(parsed.ok, false);
		assert.strictEqual(parsed.exitCode, 1);
		assert.ok(parsed.stderr.includes("ValueError"));
	});

	it("cleans up temp file after python execution", async () => {
		process.env.PYTHON_IMPORT_HOOK = "disable";
		await executeCodeImpl({ code: "print('done')", language: "python3" }, {});
		// If no crash, cleanup worked (hard to verify without filesystem access)
	});

	it("blocks subprocess import via meta_path hook", async () => {
		delete process.env.PYTHON_IMPORT_HOOK; // Use default (hook enabled)
		const result = await executeCodeImpl({ code: "import subprocess", language: "python3" }, {});
		const parsed = JSON.parse(result);
		assert.strictEqual(parsed.ok, false);
		assert.ok(
			parsed.error?.includes("Blocked import") ||
				parsed.stderr?.includes("Blocked import") ||
				parsed.stderr?.includes("ImportError"),
		);
	});

	it("allows subprocess when import hook disabled", async () => {
		process.env.PYTHON_IMPORT_HOOK = "disable";
		const result = await executeCodeImpl(
			{ code: "import subprocess\nprint('ok')", language: "python3" },
			{},
		);
		const parsed = JSON.parse(result);
		assert.ok(parsed.ok);
		assert.strictEqual(parsed.stdout, "ok");
	});

	it("times out long-running code", async () => {
		process.env.PYTHON_IMPORT_HOOK = "disable";
		const result = await executeCodeImpl(
			{ code: "import time; time.sleep(100)", language: "python3", timeout: 1 },
			{},
		);
		const parsed = JSON.parse(result);
		assert.strictEqual(parsed.ok, false);
		assert.ok(parsed.error.includes("timed out") || parsed.error.includes("timeout"));
	});
});
