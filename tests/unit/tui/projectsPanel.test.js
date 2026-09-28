import { describe, it } from "node:test";
import assert from "node:assert";
import { filterProjectDirs } from "../../../src/tui/projectsPanel.js";

function dirent(name, isDirectory = true) {
	return { name, isDirectory: () => isDirectory };
}

describe("filterProjectDirs", () => {
	it("returns only directories", () => {
		const result = filterProjectDirs([dirent("alpha"), dirent("file.txt", false), dirent("beta")]);
		assert.deepStrictEqual(result, ["alpha", "beta"]);
	});

	it("excludes hidden directories (starting with '.')", () => {
		const result = filterProjectDirs([
			dirent("alpha"),
			dirent(".git"),
			dirent(".worktrees"),
			dirent("beta"),
		]);
		assert.deepStrictEqual(result, ["alpha", "beta"]);
	});

	it("excludes hidden files as well", () => {
		const result = filterProjectDirs([dirent(".env", false), dirent("alpha")]);
		assert.deepStrictEqual(result, ["alpha"]);
	});

	it("excludes git worktree directories (ending in '.worktrees')", () => {
		const result = filterProjectDirs([dirent("alpha"), dirent("madz.worktrees"), dirent("beta")]);
		assert.deepStrictEqual(result, ["alpha", "beta"]);
	});

	it("sorts results alphabetically", () => {
		const result = filterProjectDirs([dirent("zeta"), dirent("alpha"), dirent("mid")]);
		assert.deepStrictEqual(result, ["alpha", "mid", "zeta"]);
	});

	it("returns an empty array when no directories are present", () => {
		const result = filterProjectDirs([dirent("file.txt", false)]);
		assert.deepStrictEqual(result, []);
	});
});
