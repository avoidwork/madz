import { describe, it, beforeEach } from "node:test";
import assert from "node:assert";
import {
	getProjectCwd,
	setProjectCwd,
	getWorktreeCwd,
	setWorktreeCwd,
} from "../../../src/workspace/project.js";

describe("workspace - project store", () => {
	beforeEach(() => {
		setProjectCwd("");
		setWorktreeCwd("");
	});

	it("defaults to an empty string", () => {
		assert.strictEqual(getProjectCwd(), "");
	});

	it("stores the active project cwd", () => {
		setProjectCwd("/tmp/project-a");
		assert.strictEqual(getProjectCwd(), "/tmp/project-a");
	});

	it("clears the active project cwd with an empty string", () => {
		setProjectCwd("/tmp/project-a");
		setProjectCwd("");
		assert.strictEqual(getProjectCwd(), "");
	});

	it("treats a falsy value as a clear", () => {
		setProjectCwd("/tmp/project-a");
		setProjectCwd(null);
		assert.strictEqual(getProjectCwd(), "");
	});

	it("worktree cwd defaults to an empty string", () => {
		assert.strictEqual(getWorktreeCwd(), "");
	});

	it("stores the worktree-scoped cwd", () => {
		setWorktreeCwd("/tmp/worktree-a");
		assert.strictEqual(getWorktreeCwd(), "/tmp/worktree-a");
	});

	it("clears the worktree-scoped cwd with an empty string", () => {
		setWorktreeCwd("/tmp/worktree-a");
		setWorktreeCwd("");
		assert.strictEqual(getWorktreeCwd(), "");
	});

	it("treats a falsy value as a clear for the worktree cwd", () => {
		setWorktreeCwd("/tmp/worktree-a");
		setWorktreeCwd(null);
		assert.strictEqual(getWorktreeCwd(), "");
	});

	it("keeps the worktree cwd separate from the project cwd", () => {
		setProjectCwd("/tmp/project-a");
		setWorktreeCwd("/tmp/worktree-a");
		assert.strictEqual(getProjectCwd(), "/tmp/project-a");
		assert.strictEqual(getWorktreeCwd(), "/tmp/worktree-a");
	});
});
