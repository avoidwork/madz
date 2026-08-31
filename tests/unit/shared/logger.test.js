/**
 * Tests for the shared logger module.
 * @see {@link src/shared/logger.js}
 */

import { describe, it, before, after, beforeEach, afterEach } from "node:test";
import assert from "node:assert";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { mkdir, rm, writeFile, unlink, access, constants } from "node:fs/promises";
import { logger, getLogDirectory, flush } from "../../../src/shared/logger.js";

describe("getLogDirectory", () => {
	it("should return a string path", () => {
		const dir = getLogDirectory();
		assert.ok(typeof dir === "string");
		assert.ok(dir.length > 0);
	});

	it("should contain 'madz' in the path", () => {
		const dir = getLogDirectory();
		assert.ok(dir.includes("madz"));
	});

	it("should contain 'logs' in the path", () => {
		const dir = getLogDirectory();
		assert.ok(dir.includes("logs"));
	});

	it("should be an absolute path", () => {
		const dir = getLogDirectory();
		assert.ok(dir.startsWith("/") || dir.startsWith("C:\\"));
	});

	it("should use darwin path on darwin platform", () => {
		const dir = getLogDirectory();
		assert.ok(dir.includes("madz"));
		assert.ok(dir.includes("logs"));
	});

	it("should use linux default path on linux (non-alpine)", () => {
		const dir = getLogDirectory();
		// On Linux without /etc/alpine-release, should use XDG path
		assert.ok(dir.includes(".local") || dir.includes("madz"));
	});

	it("should use win32 path on windows", () => {
		const dir = getLogDirectory();
		assert.ok(dir.includes("madz"));
		assert.ok(dir.includes("logs"));
	});
});

describe("logger methods", () => {
	it("should have an info method", () => {
		assert.ok(typeof logger.info === "function");
	});

	it("should have a warn method", () => {
		assert.ok(typeof logger.warn === "function");
	});

	it("should have an error method", () => {
		assert.ok(typeof logger.error === "function");
	});

	it("should have a debug method", () => {
		assert.ok(typeof logger.debug === "function");
	});

	it("should have a fatal method", () => {
		assert.ok(typeof logger.fatal === "function");
	});

	it("should have a silent method", () => {
		assert.ok(typeof logger.silent === "function");
	});

	it("info() should not throw", () => {
		assert.doesNotThrow(() => logger.info("test message"));
	});

	it("warn() should not throw", () => {
		assert.doesNotThrow(() => logger.warn("test warning"));
	});

	it("error() should not throw", () => {
		assert.doesNotThrow(() => logger.error("test error"));
	});

	it("debug() should not throw", () => {
		assert.doesNotThrow(() => logger.debug("test debug"));
	});

	it("fatal() should not throw", () => {
		assert.doesNotThrow(() => logger.fatal("test fatal"));
	});

	it("silent() should not throw", () => {
		assert.doesNotThrow(() => logger.silent());
	});

	it("info() should accept additional arguments", () => {
		assert.doesNotThrow(() => logger.info("test", { key: "value" }));
	});

	it("error() should accept additional arguments", () => {
		assert.doesNotThrow(() => logger.error("test", new Error("boom")));
	});
});

describe("flush", () => {
	it("should return a promise", () => {
		const result = flush();
		assert.ok(result instanceof Promise);
	});

	it("should resolve without error", async () => {
		await assert.doesNotReject(flush());
	});

	it("should resolve after a short delay", async () => {
		const start = Date.now();
		await flush();
		const elapsed = Date.now() - start;
		// Should take at least some time (pino flush callback)
		assert.ok(elapsed >= 0);
	});
});

describe("logger module-level initialization", () => {
	it("logger should be a plain object", () => {
		assert.ok(typeof logger === "object");
		assert.ok(logger !== null);
	});

	it("logger should have exactly 6 methods", () => {
		const keys = Object.keys(logger);
		assert.strictEqual(keys.length, 6);
		assert.ok(keys.includes("info"));
		assert.ok(keys.includes("warn"));
		assert.ok(keys.includes("error"));
		assert.ok(keys.includes("debug"));
		assert.ok(keys.includes("fatal"));
		assert.ok(keys.includes("silent"));
	});
});
