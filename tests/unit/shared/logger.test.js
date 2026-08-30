/**
 * Tests for the shared logger module.
 * @see {@link src/shared/logger.js}
 */

import { describe, it } from "node:test";
import assert from "node:assert";
import { getLogDirectory } from "../../../src/shared/logger.js";

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
});
