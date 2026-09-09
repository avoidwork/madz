import { describe, it, before, after } from "node:test";
import assert from "node:assert";
import { mkdtempSync, writeFileSync, rmSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { scanFiles } from "../../../src/vector/indexer.js";

describe("scanFiles", () => {
	/** @type {string} */
	let tmpDir;

	before(() => {
		tmpDir = mkdtempSync(join(tmpdir(), "indexer-test-"));
		mkdirSync(join(tmpDir, "src"), { recursive: true });
		mkdirSync(join(tmpDir, "node_modules"), { recursive: true });
		mkdirSync(join(tmpDir, ".git"), { recursive: true });
		writeFileSync(join(tmpDir, "src", "foo.js"), "const x = 1;");
		writeFileSync(join(tmpDir, "src", "bar.mjs"), "export const y = 2;");
		writeFileSync(join(tmpDir, "node_modules", "dep.js"), "module.exports = {};");
		writeFileSync(join(tmpDir, ".git", "config"), "[core]");
		writeFileSync(join(tmpDir, "README.md"), "# Project");
	});

	after(() => {
		rmSync(tmpDir, { recursive: true, force: true });
	});

	it("finds source files matching include patterns", async () => {
		const files = await scanFiles(
			tmpDir,
			["src/**/*.js", "src/**/*.mjs"],
			["node_modules/**", ".git/**"],
		);
		assert.strictEqual(files.length, 2);
		assert.ok(files.some((f) => f.endsWith("foo.js")));
		assert.ok(files.some((f) => f.endsWith("bar.mjs")));
	});

	it("excludes node_modules and .git files", async () => {
		const files = await scanFiles(tmpDir, ["**/*.js", "**/*.mjs"], ["node_modules/**", ".git/**"]);
		const hasNodeModules = files.some((f) => f.includes("node_modules"));
		const hasGit = files.some((f) => f.includes(".git"));
		assert.ok(!hasNodeModules, "Should not include node_modules files");
		assert.ok(!hasGit, "Should not include .git files");
	});

	it("returns empty array when no files match", async () => {
		const files = await scanFiles(tmpDir, ["*.xyz"], ["node_modules/**", ".git/**"]);
		assert.strictEqual(files.length, 0);
	});
});
