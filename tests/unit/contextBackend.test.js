/**
 * Context backend tests.
 * Tests the createContextBackend function which creates a FilesystemBackend
 * for the memory context directory.
 */

import { describe, it } from "node:test";
import assert from "node:assert";
import { createContextBackend } from "../../src/agent/contextBackend.js";

describe("createContextBackend", () => {
	it("should return a FilesystemBackend instance", () => {
		const backend = createContextBackend();
		assert.ok(backend, "Should return a backend");
		assert.strictEqual(backend.constructor.name, "FilesystemBackend", "Should be a FilesystemBackend");
	});

	it("should create backend with context directory from config", () => {
		const backend = createContextBackend();
		// The cwd should point to the context directory
		assert.ok(backend.cwd, "Should have cwd");
		assert.ok(
			backend.cwd.includes("memory/context") || backend.cwd.includes("memory\\context"),
			`cwd should reference context directory, got: ${backend.cwd}`,
		);
	});

	it("should return a backend with virtualMode set to false", () => {
		const backend = createContextBackend();
		assert.strictEqual(backend.virtualMode, false, "virtualMode should be false");
	});

	it("should accept an optional cwd parameter", () => {
		const backend = createContextBackend("/tmp");
		assert.ok(backend, "Should return a backend with custom cwd");
		assert.ok(backend.cwd, "Should have cwd");
		assert.ok(
			backend.cwd.includes("/tmp") || backend.cwd.includes("\\tmp"),
			`cwd should reference /tmp, got: ${backend.cwd}`,
		);
	});

	it("should use process.cwd() when no cwd is provided", () => {
		const backend = createContextBackend();
		assert.ok(backend.cwd, "Should have cwd");
		// The cwd should be an absolute path
		assert.ok(
			backend.cwd.startsWith("/") || backend.cwd.match(/^[A-Z]:\\/),
			`cwd should be absolute, got: ${backend.cwd}`,
		);
	});
});
