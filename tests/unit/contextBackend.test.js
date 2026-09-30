/**
 * Context backend tests.
 * Tests the createContextBackend function which creates a FilesystemBackend
 * for the memory context directory.
 */

import { describe, it } from "node:test";
import assert from "node:assert";
import { createContextBackend } from "../../src/agent/contextBackend.js";

describe("createContextBackend", () => {
	it("should return a FilesystemBackend instance", async () => {
		const backend = await createContextBackend();
		assert.ok(backend, "Should return a backend");
		assert.strictEqual(
			backend.constructor.name,
			"FilesystemBackend",
			"Should be a FilesystemBackend",
		);
	});

	it("should create backend with context directory from config", async () => {
		const backend = await createContextBackend();
		// The cwd should point to the context directory
		assert.ok(backend.cwd, "Should have cwd");
		assert.ok(
			backend.cwd.includes("memory/context") || backend.cwd.includes("memory\\context"),
			`cwd should reference context directory, got: ${backend.cwd}`,
		);
	});

	it("should return a backend with virtualMode set to false", async () => {
		const backend = await createContextBackend();
		assert.strictEqual(backend.virtualMode, false, "virtualMode should be false");
	});

	it("should accept an optional cwd parameter", async () => {
		const backend = await createContextBackend("/tmp");
		assert.ok(backend, "Should return a backend with custom cwd");
		assert.ok(backend.cwd, "Should have cwd");
		assert.ok(
			backend.cwd.includes("/tmp") || backend.cwd.includes("\\tmp"),
			`cwd should reference /tmp, got: ${backend.cwd}`,
		);
	});

	it("should use process.cwd() when no cwd is provided", async () => {
		const backend = await createContextBackend();
		assert.ok(backend.cwd, "Should have cwd");
		// The cwd should be an absolute path
		assert.ok(
			backend.cwd.startsWith("/") || backend.cwd.match(/^[A-Z]:\\/),
			`cwd should be absolute, got: ${backend.cwd}`,
		);
	});
});
