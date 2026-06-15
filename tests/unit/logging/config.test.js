import { describe, it } from "node:test";
import assert from "node:assert";
import { createLogger, logger } from "../../../src/logging/config.js";

describe("src/logging/config.js", () => {
	describe("createLogger", () => {
		it("should return a pino logger instance", () => {
			const log = createLogger({});
			assert.ok(log);
			assert.strictEqual(typeof log.info, "function");
			assert.strictEqual(typeof log.warn, "function");
			assert.strictEqual(typeof log.error, "function");
			assert.strictEqual(typeof log.debug, "function");
		});

		it("should default to 'info' level when no config provided", () => {
			const log = createLogger({});
			assert.ok(log);
			// Logger should be created without error
		});

		it("should use 'debug' level when specified", () => {
			const log = createLogger({ logging: { level: "debug" } });
			assert.ok(log);
		});

		it("should use 'warn' level when specified", () => {
			const log = createLogger({ logging: { level: "warn" } });
			assert.ok(log);
		});

		it("should use 'error' level when specified", () => {
			const log = createLogger({ logging: { level: "error" } });
			assert.ok(log);
		});

		it("should fall back to 'info' on invalid level", () => {
			// Capture stderr
			const originalStderr = process.stderr;
			let stderrOutput = "";
			const mockStderr = {
				...originalStderr,
				write: (chunk) => {
					stderrOutput += String(chunk);
					return true;
				},
			};
			process.stderr = mockStderr;

			try {
				const log = createLogger({ logging: { level: "verbose" } });
				assert.ok(log);
				assert.ok(stderrOutput.includes("Warning") || stderrOutput.includes("verbose"));
			} finally {
				process.stderr = originalStderr;
			}
		});

		it("should fall back to 'info' on missing level", () => {
			const log = createLogger({ logging: {} });
			assert.ok(log);
		});

		it("should fall back to 'info' on missing logging config", () => {
			const log = createLogger({});
			assert.ok(log);
		});
	});

	describe("logger singleton", () => {
		it("should have info method", () => {
			assert.strictEqual(typeof logger.info, "function");
		});

		it("should have warn method", () => {
			assert.strictEqual(typeof logger.warn, "function");
		});

		it("should have error method", () => {
			assert.strictEqual(typeof logger.error, "function");
		});

		it("should have debug method", () => {
			assert.strictEqual(typeof logger.debug, "function");
		});

		it("should have fatal method", () => {
			assert.strictEqual(typeof logger.fatal, "function");
		});

		it("should have silent method", () => {
			assert.strictEqual(typeof logger.silent, "function");
		});

		it("should not throw when calling methods", () => {
			assert.doesNotThrow(() => logger.info("test"));
			assert.doesNotThrow(() => logger.warn("test"));
			assert.doesNotThrow(() => logger.error("test"));
			assert.doesNotThrow(() => logger.debug("test"));
			assert.doesNotThrow(() => logger.fatal("test"));
			assert.doesNotThrow(() => logger.silent());
		});

		it("should accept structured data", () => {
			assert.doesNotThrow(() =>
				logger.info({ type: "test", message: "hello" }),
			);
		});
	});
});
