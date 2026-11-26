import { describe, it, before, after, beforeEach, afterEach } from "node:test";
import assert from "node:assert";
import { mkdtempSync, rmSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

/**
 * Regression tests for the immutable `config.appPath`.
 *
 * `appPath` is captured once at bootstrap (before any `process.chdir()`) and
 * must never drift, so app-centric tools keep resolving their storage paths
 * against the app root even after the TUI switches the process working
 * directory into a selected project.
 */
describe("config.appPath — immutable application root", () => {
	let loader;
	let originalCwd;

	beforeEach(async () => {
		originalCwd = process.cwd();
		loader = await import("../../../src/config/loader.js");
		loader._resetConfigCache();
	});

	afterEach(() => {
		process.chdir(originalCwd);
		loader._resetConfigCache();
	});

	it("defaults appPath to empty string when not pinned at bootstrap", () => {
		const config = loader.loadConfig();
		assert.strictEqual(config.appPath, "");
	});

	it("keeps appPath stable across cached loadConfig calls after a chdir", () => {
		const dir = mkdtempSync(join(tmpdir(), "appPath-stable-"));
		try {
			const pinned = loader.setAppPath(dir);
			// Simulate the TUI switching into a project.
			process.chdir(tmpdir());
			const again = loader.loadConfig();
			assert.strictEqual(again.appPath, pinned, "appPath must not drift after chdir");
		} finally {
			rmSync(dir, { recursive: true, force: true });
		}
	});

	it("does not overwrite appPath with the live process cwd on a fresh load", () => {
		// Pin appPath explicitly, then change cwd and force a re-read of
		// config.yaml (cache reset); appPath must NOT be re-derived from the
		// new process.cwd(). loadConfig() caches the config object, so a
		// second call without a cache reset returns the same pinned value.
		const dir = mkdtempSync(join(tmpdir(), "appPath-pinned-"));
		try {
			const pinned = loader.setAppPath(dir);
			const other = mkdtempSync(join(tmpdir(), "appPath-"));
			process.chdir(other);
			// Without a cache reset, loadConfig() returns the cached config
			// whose appPath is still the pinned value.
			const second = loader.loadConfig();
			assert.strictEqual(second.appPath, pinned, "appPath must stay pinned, not follow chdir");
			assert.notStrictEqual(second.appPath, other);
			rmSync(other, { recursive: true, force: true });
		} finally {
			rmSync(dir, { recursive: true, force: true });
		}
	});

	it("throws when setAppPath is given a non-existent path and leaves appPath unchanged", () => {
		const before = loader.loadConfig().appPath;
		assert.throws(
			() => loader.setAppPath(join(tmpdir(), "does-not-exist-xyz")),
			/resolve|not a directory/i,
		);
		assert.strictEqual(
			loader.loadConfig().appPath,
			before,
			"appPath must be unchanged after a rejected setAppPath",
		);
	});

	it("throws when setAppPath is given an empty or non-string value", () => {
		assert.throws(() => loader.setAppPath(""), /non-empty string path/i);
		assert.throws(() => loader.setAppPath(123), /non-empty string path/i);
	});

	it("throws when setAppPath is given a file (not a directory) and leaves appPath unchanged", () => {
		const before = loader.loadConfig().appPath;
		const filePath = join(tmpdir(), `appPath-file-${Date.now()}.txt`);
		writeFileSync(filePath, "not a dir");
		try {
			assert.throws(() => loader.setAppPath(filePath), /not a directory/i);
			assert.strictEqual(
				loader.loadConfig().appPath,
				before,
				"appPath must be unchanged after a rejected setAppPath",
			);
		} finally {
			rmSync(filePath, { force: true });
		}
	});

	it("allows an explicit appPath override via setAppPath and preserves it across chdir", () => {
		const dir = mkdtempSync(join(tmpdir(), "appPath-set-"));
		try {
			const normalized = loader.setAppPath(dir);
			assert.strictEqual(loader.loadConfig().appPath, normalized);
			// A subsequent chdir must not move it.
			process.chdir(tmpdir());
			assert.strictEqual(loader.loadConfig().appPath, normalized);
		} finally {
			rmSync(dir, { recursive: true, force: true });
		}
	});
});

/**
 * The memory tool resolves its storage paths against `config.appPath`, so a
 * memory entry written after the process cwd has been switched into a project
 * still lands under the app root — never inside the selected project.
 */
describe("memory module resolves against appPath after chdir", () => {
	let loader;
	let memory;
	let originalCwd;
	let appRoot;
	let projectDir;

	before(async () => {
		originalCwd = process.cwd();
		appRoot = mkdtempSync(join(tmpdir(), "appRoot-"));
		projectDir = mkdtempSync(join(tmpdir(), "project-"));
		loader = await import("../../../src/config/loader.js");
		loader._resetConfigCache();
		// Pin the immutable app root, then import the memory module so its
		// top-level cwd accessor captures appRoot.
		loader.setAppPath(appRoot);
		memory = await import("../../../src/tools/memory/index.js");
	});

	after(() => {
		process.chdir(originalCwd);
		loader._resetConfigCache();
		rmSync(appRoot, { recursive: true, force: true });
		rmSync(projectDir, { recursive: true, force: true });
	});

	beforeEach(() => {
		// Simulate the TUI having switched into a project.
		process.chdir(projectDir);
	});

	afterEach(() => {
		process.chdir(originalCwd);
	});

	it("writes a memory entry under the app root, not the switched project cwd", async () => {
		// The memory tool's saveEntry does not create the entries directory;
		// bootstrap normally calls ensureContextDir. Create it under the app
		// root so the write succeeds and lands in the right place.
		mkdirSync(join(appRoot, "memory", "context"), { recursive: true });

		const result = await memory.memoryImpl(
			{ action: "create", key: "appPathProbe", value: "hello" },
			{ maxEntries: 100, contextDir: "memory/context/" },
		);
		assert.strictEqual(result.ok, true);

		// The entry must live under the app root, not the project directory.
		assert.ok(
			existsSync(join(appRoot, "memory", "context", "app_path_probe.md")),
			"entry written under app root",
		);
		assert.ok(
			!existsSync(join(projectDir, "memory", "context", "app_path_probe.md")),
			"entry must NOT be written into the project cwd",
		);
	});
});
