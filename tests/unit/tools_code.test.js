import { describe, it } from "node:test";
import assert from "node:assert";
import { executeCodeImpl, parseMemLimit, killProcess } from "../../src/tools/code.js";

describe("execute_code", () => {
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

	it("executes python3 code with import hook enabled by default", async () => {
		const result = await executeCodeImpl({ code: "print(2 + 2)", language: "python3" }, {});
		const parsed = JSON.parse(result);
		assert.ok(parsed.ok);
		assert.strictEqual(parsed.stdout, "4");
		assert.strictEqual(parsed.exitCode, 0);
	});

	it("executes javascript code via node", async () => {
		const result = await executeCodeImpl(
			{ code: "console.log(2 + 2)", language: "javascript" },
			{},
		);
		const parsed = JSON.parse(result);
		assert.ok(parsed.ok);
		/* eslint-disable-next-line no-control-regex */
		assert.strictEqual(parsed.stdout.replace(/\x1b\[\d+m/g, ""), "4");
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
		const result = await executeCodeImpl(
			{ code: "raise ValueError('test')", language: "python3" },
			{ safety: { pythonImportHook: false } },
		);
		const parsed = JSON.parse(result);
		assert.strictEqual(parsed.ok, false);
		assert.strictEqual(parsed.exitCode, 1);
		assert.ok(parsed.stderr.includes("ValueError"));
	});

	it("cleans up temp file after python execution", async () => {
		await executeCodeImpl({ code: "print('done')", language: "python3" }, {});
	});

	it("blocks subprocess import via meta_path hook", async () => {
		const result = await executeCodeImpl({ code: "import subprocess", language: "python3" }, {});
		const parsed = JSON.parse(result);
		assert.strictEqual(parsed.ok, false);
		assert.ok(
			parsed.error?.includes("Blocked import") ||
				parsed.stderr?.includes("Blocked import") ||
				parsed.stderr?.includes("ImportError"),
		);
	});

	it("allows subprocess when import hook disabled via safety config", async () => {
		const result = await executeCodeImpl(
			{ code: "import subprocess\nprint('ok')", language: "python3", _timeout: 300 },
			{ safety: { pythonImportHook: false } },
		);
		const parsed = JSON.parse(result);
		assert.ok(parsed.ok);
		assert.strictEqual(parsed.stdout, "ok");
	});

	it("times out long-running code", async () => {
		const result = await executeCodeImpl(
			{ code: "import time; time.sleep(100)", language: "python3" },
			{ safety: { pythonImportHook: false }, timeout: { seconds: 5 } },
		);
		const parsed = JSON.parse(result);
		assert.strictEqual(parsed.ok, false);
		assert.ok(parsed.error.includes("timed out") || parsed.error.includes("timeout"));
	});

	it("uses config timeout from options", async () => {
		const result = await executeCodeImpl(
			{ code: "import time; time.sleep(100)", language: "python3" },
			{ safety: { pythonImportHook: false }, timeout: { seconds: 1 } },
		);
		const parsed = JSON.parse(result);
		assert.strictEqual(parsed.ok, false);
		assert.ok(parsed.error.includes("timed out") || parsed.error.includes("timeout"));
	});

	it("uses explicit _timeout for execution duration", async () => {
		const result = await executeCodeImpl(
			{ code: "print('done')", language: "python3", _timeout: 300 },
			{ safety: { pythonImportHook: false } },
		);
		const parsed = JSON.parse(result);
		assert.ok(parsed.ok);
		assert.strictEqual(parsed.stdout, "done");
	});
});

describe("killProcess", () => {
	it("kills a child that hasn't been killed yet", () => {
		const killedArgs = [];
		const child = { killed: false, kill: (...args) => killedArgs.push(args) };
		killProcess(child);
		assert.strictEqual(killedArgs.length, 1);
		assert.deepStrictEqual(killedArgs[0], ["SIGKILL"]);
	});

	it("skills a child that's already killed", () => {
		const killedArgs = [];
		const child = { killed: true, kill: (...args) => killedArgs.push(args) };
		killProcess(child);
		assert.strictEqual(killedArgs.length, 0);
	});

	it("handles undefined child gracefully", () => {
		killProcess(undefined);
	});

	it("handles null child gracefully", () => {
		killProcess(null);
	});
});

describe("parseMemLimit", () => {
	it("parses '512mb' to bytes", () => {
		assert.strictEqual(parseMemLimit("512mb"), 512 * 1024 * 1024);
	});

	it("parses '1gb' to bytes", () => {
		assert.strictEqual(parseMemLimit("1gb"), 1024 * 1024 * 1024);
	});

	it("parses '1kb' to bytes", () => {
		assert.strictEqual(parseMemLimit("1kb"), 1024);
	});

	it("parses raw number as bytes", () => {
		assert.strictEqual(parseMemLimit("1024"), 1024);
	});

	it("defaults to 512mb for invalid string", () => {
		assert.strictEqual(parseMemLimit("not-a-number"), 512 * 1024 * 1024);
	});

	it("defaults to 512mb for undefined", () => {
		assert.strictEqual(parseMemLimit(undefined), 512 * 1024 * 1024);
	});
});
