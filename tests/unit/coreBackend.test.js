/**
 * Core backend tests.
 * Tests the createCoreBackend function which creates a LocalShellBackend
 * sandboxed to the current working directory.
 */

import { describe, it } from "node:test";
import assert from "node:assert";
import { createCoreBackend } from "../../src/agent/coreBackend.js";

describe("createCoreBackend", () => {
	it("should return a LocalShellBackend instance", () => {
		const backend = createCoreBackend();
		assert.ok(backend, "Should return a backend");
		assert.strictEqual(
			backend.constructor.name,
			"LocalShellBackend",
			"Should be a LocalShellBackend",
		);
	});

	it("should have cwd set to process.cwd()", () => {
		const backend = createCoreBackend();
		assert.ok(backend.cwd, "Should have cwd");
		assert.strictEqual(backend.cwd, process.cwd(), "cwd should be process.cwd()");
	});

	it("should have virtualMode set to false", () => {
		const backend = createCoreBackend();
		assert.strictEqual(backend.virtualMode, false, "virtualMode should be false");
	});

	it("should have expected backend methods", () => {
		const backend = createCoreBackend();
		assert.strictEqual(typeof backend.read, "function", "Should have read method");
		assert.strictEqual(typeof backend.write, "function", "Should have write method");
		assert.strictEqual(typeof backend.execute, "function", "Should have execute method");
		assert.strictEqual(typeof backend.ls, "function", "Should have ls method");
		assert.strictEqual(typeof backend.glob, "function", "Should have glob method");
	});
});
