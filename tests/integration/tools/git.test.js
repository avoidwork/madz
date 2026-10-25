import { describe, it, before, after } from "node:test";
import assert from "node:assert";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import { gitImpl } from "../../../src/tools/git/index.js";

let repoDir;

function git(cwd, args) {
	return execFileSync("git", args, { cwd, encoding: "utf-8" });
}

function setupRepo() {
	repoDir = mkdtempSync(join(tmpdir(), "madz-git-test-"));
	git(repoDir, ["init", "-b", "main"]);
	git(repoDir, ["config", "user.email", "test@example.com"]);
	git(repoDir, ["config", "user.name", "Test User"]);
	writeFileSync(join(repoDir, "file.txt"), "hello\n");
	git(repoDir, ["add", "file.txt"]);
	git(repoDir, ["commit", "-m", "initial commit"]);
}

function cleanupRepo() {
	if (repoDir) {
		rmSync(repoDir, { recursive: true, force: true });
	}
}

describe("integration - git tool", () => {
	before(setupRepo);
	after(cleanupRepo);

	it("status returns structured state", async () => {
		const result = await gitImpl({ action: "status" }, { cwd: repoDir });
		assert.strictEqual(result.ok, true);
		assert.ok(result.branch, "should have a branch");
		assert.ok(Array.isArray(result.changes), "changes should be an array");
		assert.ok(typeof result.ahead === "number", "ahead should be a number");
		assert.ok(typeof result.behind === "number", "behind should be a number");
	});

	it("diff returns structured diff", async () => {
		writeFileSync(join(repoDir, "file.txt"), "hello\nworld\n");
		const result = await gitImpl({ action: "diff" }, { cwd: repoDir });
		assert.strictEqual(result.ok, true);
		assert.ok(Array.isArray(result.files), "files should be an array");
		assert.ok(typeof result.additions === "number", "additions should be a number");
		assert.ok(typeof result.deletions === "number", "deletions should be a number");
	});

	it("log returns commit history", async () => {
		const result = await gitImpl({ action: "log" }, { cwd: repoDir });
		assert.strictEqual(result.ok, true);
		assert.ok(Array.isArray(result.commits), "commits should be an array");
		assert.ok(result.commits.length >= 1, "should have at least one commit");
	});

	it("branch returns branches", async () => {
		const result = await gitImpl({ action: "branch" }, { cwd: repoDir });
		assert.strictEqual(result.ok, true);
		assert.ok(Array.isArray(result.branches), "branches should be an array");
		assert.ok(result.current, "should have a current branch");
	});

	it("add stages files", async () => {
		writeFileSync(join(repoDir, "new.txt"), "new\n");
		const result = await gitImpl({ action: "add", path: "new.txt" }, { cwd: repoDir });
		assert.strictEqual(result.ok, true);
		assert.ok(Array.isArray(result.files), "files should be an array");
	});

	it("commit creates a commit", async () => {
		writeFileSync(join(repoDir, "commit.txt"), "commit\n");
		await gitImpl({ action: "add", path: "commit.txt" }, { cwd: repoDir });
		const result = await gitImpl({ action: "commit", message: "test commit" }, { cwd: repoDir });
		assert.strictEqual(result.ok, true);
		assert.ok(result.hash, "should have a hash");
		assert.strictEqual(result.message, "test commit");
	});

	it("checkout switches branches", async () => {
		git(repoDir, ["branch", "feature"]);
		const result = await gitImpl({ action: "checkout", branch: "feature" }, { cwd: repoDir });
		assert.strictEqual(result.ok, true);
		assert.strictEqual(result.branch, "feature");
	});

	it("returns error when not a git repo", async () => {
		const notRepo = mkdtempSync(join(tmpdir(), "madz-git-notrepo-"));
		try {
			const result = await gitImpl({ action: "status" }, { cwd: notRepo });
			assert.strictEqual(result.ok, false);
			assert.ok(result.error, "should have an error");
		} finally {
			rmSync(notRepo, { recursive: true, force: true });
		}
	});

	it("returns error for branch that does not exist", async () => {
		const result = await gitImpl({ action: "checkout", branch: "nonexistent" }, { cwd: repoDir });
		assert.strictEqual(result.ok, false);
		assert.ok(result.error, "should have an error");
	});

	it("rejects destructive command", async () => {
		const result = await gitImpl({ action: "push", force: false }, { cwd: repoDir });
		assert.strictEqual(result.ok, false);
		assert.ok(result.error.includes("force"), "should reject force push");
	});

	it("rejects rebase without explicit opt-in", async () => {
		const result = await gitImpl({ action: "rebase", branch: "main" }, { cwd: repoDir });
		assert.strictEqual(result.ok, false);
		assert.ok(result.error.includes("force"), "should reject rebase without force");
	});

	it("stash stashes changes", async () => {
		writeFileSync(join(repoDir, "stash.txt"), "stash\n");
		const result = await gitImpl({ action: "stash" }, { cwd: repoDir });
		assert.strictEqual(result.ok, true);
	});

	it("show returns ref output", async () => {
		const result = await gitImpl({ action: "show", ref: "HEAD" }, { cwd: repoDir });
		assert.strictEqual(result.ok, true);
		assert.ok(result.output, "should have output");
	});

	it("tag lists tags", async () => {
		const result = await gitImpl({ action: "tag" }, { cwd: repoDir });
		assert.strictEqual(result.ok, true);
		assert.ok(Array.isArray(result.tags), "tags should be an array");
	});

	it("merge merges a branch", async () => {
		git(repoDir, ["checkout", "-b", "merge-feature"]);
		writeFileSync(join(repoDir, "merge.txt"), "merge\n");
		git(repoDir, ["add", "merge.txt"]);
		git(repoDir, ["commit", "-m", "merge feature commit"]);
		git(repoDir, ["checkout", "main"]);
		const result = await gitImpl({ action: "merge", branch: "merge-feature" }, { cwd: repoDir });
		assert.strictEqual(result.ok, true);
		assert.strictEqual(result.branch, "merge-feature");
	});

	it("returns error for empty commit", async () => {
		const result = await gitImpl({ action: "commit", message: "empty" }, { cwd: repoDir });
		assert.strictEqual(result.ok, false);
		assert.ok(result.error, "should have an error");
	});

	it("returns error for merge conflict", async () => {
		git(repoDir, ["checkout", "-b", "conflict-feature"]);
		writeFileSync(join(repoDir, "file.txt"), "conflict\n");
		git(repoDir, ["add", "file.txt"]);
		git(repoDir, ["commit", "-m", "conflict commit"]);
		git(repoDir, ["checkout", "main"]);
		writeFileSync(join(repoDir, "file.txt"), "main\n");
		git(repoDir, ["add", "file.txt"]);
		git(repoDir, ["commit", "-m", "main commit"]);
		const result = await gitImpl({ action: "merge", branch: "conflict-feature" }, { cwd: repoDir });
		assert.strictEqual(result.ok, false);
		assert.ok(result.error, "should have an error");
		// Reset the conflicted state so subsequent tests run clean.
		git(repoDir, ["reset", "--hard", "HEAD"]);
		git(repoDir, ["checkout", "main"]);
	});

	it("handles detached HEAD", async () => {
		git(repoDir, ["checkout", "--detach"]);
		const result = await gitImpl({ action: "status" }, { cwd: repoDir });
		assert.strictEqual(result.ok, true);
		assert.ok(result.branch, "should have a branch");
	});

	it("returns dirty tree changes", async () => {
		writeFileSync(join(repoDir, "dirty.txt"), "dirty\n");
		const result = await gitImpl({ action: "status" }, { cwd: repoDir });
		assert.strictEqual(result.ok, true);
		assert.ok(Array.isArray(result.changes), "changes should be an array");
	});

	it("push pushes to a remote", async () => {
		const remoteDir = mkdtempSync(join(tmpdir(), "madz-git-remote-"));
		try {
			git(remoteDir, ["init", "--bare"]);
			git(repoDir, ["remote", "add", "origin", remoteDir]);
			git(repoDir, ["checkout", "main"]);
			const result = await gitImpl(
				{ action: "push", remote: "origin", branch: "main", force: true },
				{ cwd: repoDir },
			);
			assert.strictEqual(result.ok, true);
			assert.strictEqual(result.remote, "origin");
			assert.strictEqual(result.branch, "main");
		} finally {
			rmSync(remoteDir, { recursive: true, force: true });
		}
	});

	it("rebase succeeds with force opt-in", async () => {
		git(repoDir, ["checkout", "-b", "rebase-feature"]);
		writeFileSync(join(repoDir, "rebase.txt"), "rebase\n");
		git(repoDir, ["add", "rebase.txt"]);
		git(repoDir, ["commit", "-m", "rebase feature commit"]);
		git(repoDir, ["checkout", "main"]);
		writeFileSync(join(repoDir, "main.txt"), "main\n");
		git(repoDir, ["add", "main.txt"]);
		git(repoDir, ["commit", "-m", "main commit"]);
		git(repoDir, ["checkout", "rebase-feature"]);
		const result = await gitImpl(
			{ action: "rebase", branch: "main", force: true },
			{ cwd: repoDir },
		);
		assert.strictEqual(result.ok, true);
		assert.strictEqual(result.branch, "main");
	});

	it("tag creates and lists tags", async () => {
		git(repoDir, ["tag", "v1.0.0"]);
		const result = await gitImpl({ action: "tag" }, { cwd: repoDir });
		assert.strictEqual(result.ok, true);
		assert.ok(result.tags.includes("v1.0.0"), "should list the created tag");
	});
});
