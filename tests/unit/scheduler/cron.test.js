import { describe, it } from "node:test";
import assert from "node:assert";
import { join } from "node:path";
import { Cron, sanitizeCrontabCommand, prepareCrontabCommand } from "../../../src/scheduler/cron.js";
import { getLogDirectory } from "../../../src/logger.js";

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
	it("replaces bare node with absolute path", () => {
		const result = prepareCrontabCommand("node index.js", "/tmp/test.log");
		assert.strictEqual(result, "/usr/local/bin/node index.js >> /tmp/test.log 2>&1");
	});

	it("uses provided log path", () => {
		const result = prepareCrontabCommand("node test.js", "/custom/path.log");
		assert.strictEqual(result, "/usr/local/bin/node test.js >> /custom/path.log 2>&1");
	});

	it("defaults to logger directory when no log path provided", () => {
		const logDir = getLogDirectory();
		const result = prepareCrontabCommand("node index.js");
		assert.strictEqual(
			result,
			`/usr/local/bin/node index.js >> ${join(logDir, "madz_cron.log")} 2>&1`,
		);
	});

	it("sanitizes newlines in command", () => {
		const result = prepareCrontabCommand("node index.js\r\n", "/tmp/test.log");
		assert.strictEqual(result, "/usr/local/bin/node index.js >> /tmp/test.log 2>&1");
	});
});

describe("cron - Cron.setLogPath", () => {
	it("sets the log path on the Cron instance", () => {
		Cron.setLogPath("/custom/log/path.log");
		const result = prepareCrontabCommand("node test.js", "/custom/log/path.log");
		assert.strictEqual(result, "/usr/local/bin/node test.js >> /custom/log/path.log 2>&1");
	});

	it("is idempotent — subsequent calls overwrite", () => {
		Cron.setLogPath("/first/path.log");
		Cron.setLogPath("/second/path.log");
		const result = prepareCrontabCommand("node test.js", "/second/path.log");
		assert.strictEqual(result, "/usr/local/bin/node test.js >> /second/path.log 2>&1");
	});
});
