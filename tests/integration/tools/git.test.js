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

	it("diff nameOnly returns changed file names", async () => {
		writeFileSync(join(repoDir, "file.txt"), "hello\nworld\nnameonly\n");
		const result = await gitImpl({ action: "diff", nameOnly: true }, { cwd: repoDir });
		assert.strictEqual(result.ok, true);
		assert.ok(Array.isArray(result.files), "files should be an array");
		assert.ok(result.files.includes("file.txt"), "should include the changed file");
	});

	it("diff stat returns a diffstat string", async () => {
		writeFileSync(join(repoDir, "file.txt"), "hello\nworld\nstat\n");
		const result = await gitImpl({ action: "diff", stat: true }, { cwd: repoDir });
		assert.strictEqual(result.ok, true);
		assert.ok(typeof result.output === "string", "output should be a string");
		assert.ok(result.output.includes("file.txt"), "should mention the changed file");
	});

	it("diff patch returns the raw unified diff", async () => {
		writeFileSync(join(repoDir, "file.txt"), "hello\nworld\npatch\n");
		const result = await gitImpl({ action: "diff", patch: true }, { cwd: repoDir });
		assert.strictEqual(result.ok, true);
		assert.ok(typeof result.output === "string", "output should be a string");
		assert.ok(result.output.includes("+++"), "should contain the unified diff header");
	});

	it("diff cached returns staged changes", async () => {
		writeFileSync(join(repoDir, "file.txt"), "hello\nworld\ncached\n");
		await gitImpl({ action: "add", path: "file.txt" }, { cwd: repoDir });
		const result = await gitImpl({ action: "diff", cached: true }, { cwd: repoDir });
		assert.strictEqual(result.ok, true);
		assert.ok(Array.isArray(result.files), "files should be an array");
		assert.ok(result.files.includes("file.txt"), "should include the staged file");
	});

	it("diff with ref compares against a ref", async () => {
		writeFileSync(join(repoDir, "refdiff.txt"), "refdiff\n");
		await gitImpl({ action: "add", path: "refdiff.txt" }, { cwd: repoDir });
		await gitImpl({ action: "commit", message: "refdiff commit" }, { cwd: repoDir });
		const result = await gitImpl(
			{ action: "diff", ref: "HEAD~1", nameOnly: true },
			{ cwd: repoDir },
		);
		assert.strictEqual(result.ok, true);
		assert.ok(result.files.includes("refdiff.txt"), "should include the committed file");
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

	it("tag creates an annotated tag", async () => {
		const result = await gitImpl(
			{ action: "tag", name: "v1.1.0", message: "release v1.1.0" },
			{ cwd: repoDir },
		);
		assert.strictEqual(result.ok, true);
		assert.strictEqual(result.name, "v1.1.0");
		const list = await gitImpl({ action: "tag" }, { cwd: repoDir });
		assert.ok(list.tags.includes("v1.1.0"), "should list the annotated tag");
	});

	it("describe returns the nearest tag", async () => {
		const result = await gitImpl({ action: "describe" }, { cwd: repoDir });
		assert.strictEqual(result.ok, true);
		assert.ok(result.tag, "should return a tag");
	});

	it("describe returns null when no tag exists", async () => {
		const bare = mkdtempSync(join(tmpdir(), "madz-git-notag-"));
		try {
			git(bare, ["init", "-b", "main"]);
			git(bare, ["config", "user.email", "test@example.com"]);
			git(bare, ["config", "user.name", "Test User"]);
			writeFileSync(join(bare, "file.txt"), "hello\n");
			git(bare, ["add", "file.txt"]);
			git(bare, ["commit", "-m", "initial"]);
			const result = await gitImpl({ action: "describe" }, { cwd: bare });
			assert.strictEqual(result.ok, true);
			assert.strictEqual(result.tag, null);
		} finally {
			rmSync(bare, { recursive: true, force: true });
		}
	});

	it("rev-parse returns the top-level directory", async () => {
		const result = await gitImpl(
			{ action: "rev-parse", flag: "--show-toplevel" },
			{ cwd: repoDir },
		);
		assert.strictEqual(result.ok, true);
		assert.strictEqual(result.output, repoDir);
	});

	it("rev-parse returns the current branch via --abbrev-ref", async () => {
		git(repoDir, ["checkout", "main"]);
		const result = await gitImpl({ action: "rev-parse", flag: "--abbrev-ref" }, { cwd: repoDir });
		assert.strictEqual(result.ok, true);
		assert.strictEqual(result.output, "main");
	});

	it("rev-parse resolves a ref to a hash", async () => {
		const result = await gitImpl({ action: "rev-parse", ref: "HEAD" }, { cwd: repoDir });
		assert.strictEqual(result.ok, true);
		assert.ok(result.hash, "should return a hash");
	});

	it("remote get-url returns the origin URL", async () => {
		const remoteDir = mkdtempSync(join(tmpdir(), "madz-git-remote-url-"));
		try {
			git(remoteDir, ["init", "--bare"]);
			git(repoDir, ["remote", "add", "testorigin", remoteDir]);
			const result = await gitImpl(
				{ action: "remote", sub: "get-url", remote: "testorigin" },
				{ cwd: repoDir },
			);
			assert.strictEqual(result.ok, true);
			assert.strictEqual(result.url, remoteDir);
		} finally {
			rmSync(remoteDir, { recursive: true, force: true });
		}
	});

	it("remote add registers a new remote", async () => {
		const remoteDir = mkdtempSync(join(tmpdir(), "madz-git-remote-add-"));
		try {
			const result = await gitImpl(
				{ action: "remote", sub: "add", remote: "upstream", url: remoteDir },
				{ cwd: repoDir },
			);
			assert.strictEqual(result.ok, true);
			const url = await gitImpl(
				{ action: "remote", sub: "get-url", remote: "upstream" },
				{ cwd: repoDir },
			);
			assert.strictEqual(url.url, remoteDir);
		} finally {
			rmSync(remoteDir, { recursive: true, force: true });
		}
	});

	it("ls-remote lists remote refs", async () => {
		const remoteDir = mkdtempSync(join(tmpdir(), "madz-git-lsremote-"));
		try {
			git(remoteDir, ["init", "--bare"]);
			git(repoDir, ["remote", "add", "testls", remoteDir]);
			git(repoDir, ["checkout", "main"]);
			git(repoDir, ["push", "testls", "main", "--force"]);
			const result = await gitImpl({ action: "ls-remote", remote: "testls" }, { cwd: repoDir });
			assert.strictEqual(result.ok, true);
			assert.ok(result.refs.length >= 1, "should list at least one ref");
			assert.ok(
				result.refs.some((r) => r.ref.includes("main")),
				"should include the main ref",
			);
		} finally {
			rmSync(remoteDir, { recursive: true, force: true });
		}
	});

	it("fetch fetches from a remote", async () => {
		const remoteDir = mkdtempSync(join(tmpdir(), "madz-git-fetch-"));
		try {
			git(remoteDir, ["init", "--bare"]);
			git(repoDir, ["remote", "add", "testfetch", remoteDir]);
			git(repoDir, ["checkout", "main"]);
			git(repoDir, ["push", "testfetch", "main", "--force"]);
			const result = await gitImpl({ action: "fetch", remote: "testfetch" }, { cwd: repoDir });
			assert.strictEqual(result.ok, true);
		} finally {
			rmSync(remoteDir, { recursive: true, force: true });
		}
	});

	it("worktree add creates a linked worktree", async () => {
		const wtPath = join(tmpdir(), `madz-wt-${Date.now()}`);
		try {
			const result = await gitImpl(
				{ action: "worktree", sub: "add", path: wtPath, branch: "wt-feature" },
				{ cwd: repoDir },
			);
			assert.strictEqual(result.ok, true);
			assert.strictEqual(result.path, wtPath);
			assert.strictEqual(result.branch, "wt-feature");
			const list = await gitImpl({ action: "worktree", sub: "list" }, { cwd: repoDir });
			assert.ok(
				list.worktrees.some((w) => w.path === wtPath),
				"should list the new worktree",
			);
		} finally {
			rmSync(wtPath, { recursive: true, force: true });
		}
	});

	it("worktree remove removes a linked worktree", async () => {
		const wtPath = join(tmpdir(), `madz-wt-remove-${Date.now()}`);
		try {
			await gitImpl(
				{ action: "worktree", sub: "add", path: wtPath, branch: "wt-remove" },
				{ cwd: repoDir },
			);
			const result = await gitImpl(
				{ action: "worktree", sub: "remove", path: wtPath, force: true },
				{ cwd: repoDir },
			);
			assert.strictEqual(result.ok, true);
			assert.strictEqual(result.removed, true);
		} finally {
			rmSync(wtPath, { recursive: true, force: true });
		}
	});

	it("checkout -b creates a new branch", async () => {
		const result = await gitImpl(
			{ action: "checkout", branch: "create-me", create: true },
			{ cwd: repoDir },
		);
		assert.strictEqual(result.ok, true);
		assert.strictEqual(result.branch, "create-me");
		git(repoDir, ["checkout", "main"]);
	});

	it("branch -D deletes a branch", async () => {
		git(repoDir, ["branch", "delete-me"]);
		const result = await gitImpl(
			{ action: "branch", delete: true, branch: "delete-me", force: true },
			{ cwd: repoDir },
		);
		assert.strictEqual(result.ok, true);
		assert.strictEqual(result.deleted, true);
	});

	it("log subject returns commit subjects only", async () => {
		const result = await gitImpl({ action: "log", subject: true, limit: 5 }, { cwd: repoDir });
		assert.strictEqual(result.ok, true);
		assert.ok(Array.isArray(result.subjects), "subjects should be an array");
		assert.ok(result.subjects.length >= 1, "should have at least one subject");
		assert.ok(!result.subjects[0].match(/^[a-f0-9]{7,}/), "subjects should not include hashes");
	});

	it("log subject with ref range returns delta subjects", async () => {
		writeFileSync(join(repoDir, "delta.txt"), "delta\n");
		await gitImpl({ action: "add", path: "delta.txt" }, { cwd: repoDir });
		await gitImpl({ action: "commit", message: "feat: delta work" }, { cwd: repoDir });
		const result = await gitImpl(
			{ action: "log", subject: true, ref: "HEAD~1..HEAD" },
			{ cwd: repoDir },
		);
		assert.strictEqual(result.ok, true);
		assert.ok(
			result.subjects.includes("feat: delta work"),
			"should include the delta commit subject",
		);
	});

	it("tag pattern filters tags", async () => {
		git(repoDir, ["tag", "1.0.0"]);
		git(repoDir, ["tag", "1.1.0"]);
		git(repoDir, ["tag", "2.0.0"]);
		const result = await gitImpl({ action: "tag", pattern: "1.*" }, { cwd: repoDir });
		assert.strictEqual(result.ok, true);
		assert.ok(result.tags.includes("1.0.0"), "should include 1.0.0");
		assert.ok(result.tags.includes("1.1.0"), "should include 1.1.0");
		assert.ok(!result.tags.includes("2.0.0"), "should exclude 2.0.0");
	});

	it("ls-remote tags lists remote tags", async () => {
		const remoteDir = mkdtempSync(join(tmpdir(), "madz-git-lsremote-tags-"));
		try {
			git(remoteDir, ["init", "--bare"]);
			git(repoDir, ["remote", "add", "testtags", remoteDir]);
			git(repoDir, ["checkout", "main"]);
			git(repoDir, ["push", "testtags", "main", "--force"]);
			git(repoDir, ["tag", "v9.9.9"]);
			git(repoDir, ["push", "testtags", "v9.9.9"]);
			const result = await gitImpl(
				{ action: "ls-remote", remote: "testtags", tags: true },
				{ cwd: repoDir },
			);
			assert.strictEqual(result.ok, true);
			assert.ok(
				result.refs.some((r) => r.ref.includes("v9.9.9")),
				"should include the pushed tag",
			);
		} finally {
			rmSync(remoteDir, { recursive: true, force: true });
		}
	});

	it("checkout --detach detaches HEAD", async () => {
		git(repoDir, ["checkout", "main"]);
		const result = await gitImpl({ action: "checkout", detach: true }, { cwd: repoDir });
		assert.strictEqual(result.ok, true);
		assert.strictEqual(result.detached, true);
		// Return to main so subsequent tests run on a branch.
		git(repoDir, ["checkout", "main"]);
	});
});
