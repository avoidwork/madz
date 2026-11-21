import { describe, it, mock } from "node:test";
import assert from "node:assert";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { logger } from "../../src/shared/logger.js";

/**
 * Tests that the previously-silent catch sites now log failures via the
 * structured logger rather than swallowing them silently. The logger's
 * debug method is mocked so we can assert it was invoked on failure.
 */
describe("error logging on silent catch sites", () => {
	it("chunker logs stat/read failures", async () => {
		const debugMock = mock.method(logger, "debug", () => {});
		try {
			const { chunkFile } = await import("../../src/vector/chunker.js");
			const tmpDir = mkdtempSync(join(process.cwd(), "tmp", "chunklog-"));
			try {
				const result = await chunkFile(join(tmpDir, "missing.js"), {});
				assert.strictEqual(result.length, 0);
				assert.ok(debugMock.mock.calls.length >= 1, "expected logger.debug on stat failure");
			} finally {
				rmSync(tmpDir, { recursive: true, force: true });
			}
		} finally {
			debugMock.mock.restore();
		}
	});

	it("urlFilter logs invalid URL parse failures", async () => {
		const debugMock = mock.method(logger, "debug", () => {});
		try {
			const { filterUrl } = await import("../../src/sandbox/urlFilter.js");
			const result = filterUrl("not a url", []);
			assert.strictEqual(result.allowed, false);
			assert.ok(debugMock.mock.calls.length >= 1, "expected logger.debug on invalid URL");
		} finally {
			debugMock.mock.restore();
		}
	});

	it("webhook logs JSON parse failures", async () => {
		const debugMock = mock.method(logger, "debug", () => {});
		try {
			const { webhookManagement } = await import("../../src/tools/webhook/index.js");
			const result = await webhookManagement("{not valid json");
			assert.strictEqual(result.ok, false);
			assert.ok(debugMock.mock.calls.length >= 1, "expected logger.debug on invalid JSON");
		} finally {
			debugMock.mock.restore();
		}
	});
});
