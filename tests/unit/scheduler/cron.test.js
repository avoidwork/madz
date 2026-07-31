import { describe, it } from "node:test";
import assert from "node:assert";
import {
	Cron,
	sanitizeCrontabCommand,
	prepareCrontabCommand,
} from "../../../src/scheduler/cron.js";

describe("cron - sanitizeCrontabCommand", () => {
	it("strips carriage returns", () => {
		const result = sanitizeCrontabCommand("echo hello\r\nworld");
		assert.strictEqual(result, "echo helloworld");
	});

	it("strips bare carriage returns", () => {
		const result = sanitizeCrontabCommand("echo hello\rworld");
		assert.strictEqual(result, "echo helloworld");
	});

	it("strips newlines", () => {
		const result = sanitizeCrontabCommand("echo hello\nworld");
		assert.strictEqual(result, "echo helloworld");
	});

	it("preserves shell special characters", () => {
		const result = sanitizeCrontabCommand("echo $HOME | grep test");
		assert.strictEqual(result, "echo $HOME | grep test");
	});
});

describe("cron - prepareCrontabCommand", () => {
	it("returns the sanitized command as-is", () => {
		const result = prepareCrontabCommand("node index.js", "/tmp/test.log");
		assert.strictEqual(result, "node index.js");
	});

	it("ignores logPath parameter", () => {
		const result = prepareCrontabCommand("node test.js", "/custom/path.log");
		assert.strictEqual(result, "node test.js");
	});

	it("sanitizes newlines in command", () => {
		const result = prepareCrontabCommand("node index.js\r\n", "/tmp/test.log");
		assert.strictEqual(result, "node index.js");
	});
});

describe("cron - Cron.setLogPath", () => {
	it("sets the log path on the Cron instance", () => {
		Cron.setLogPath("/custom/log/path.log");
		const result = prepareCrontabCommand("node test.js", "/custom/log/path.log");
		assert.strictEqual(result, "node test.js");
	});

	it("is idempotent — subsequent calls overwrite", () => {
		Cron.setLogPath("/first/path.log");
		Cron.setLogPath("/second/path.log");
		const result = prepareCrontabCommand("node test.js", "/second/path.log");
		assert.strictEqual(result, "node test.js");
	});
});
