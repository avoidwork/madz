import { describe, it, after } from "node:test";
import assert from "node:assert";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { git, gitImpl } from "../../../src/tools/git/index.js";
import { setProjectCwd } from "../../../src/workspace/project.js";

/**
 * Create a managed temp git repo for tests. Uses a directory OUTSIDE the
 * current repo working tree (the parent of the project root) so the nested
 * git repo does not pollute the repo's worktree state. Never uses /tmp.
 * @returns {string} The temp repo path
 */
function makeTempRepo() {
	const base = path.dirname(process.cwd());
	const dir = mkdtempSync(path.join(base, "git-test-"));
	execFileSync("git", ["init", "-q"], { cwd: dir });
	execFileSync(
		"git",
		[
			"-c",
			"user.name=Test",
			"-c",
			"user.email=test@example.com",
			"commit",
			"--allow-empty",
			"-m",
			"init",
		],
		{ cwd: dir },
	);
	return dir;
}

/** @type {string[]} Temp dirs created during the test run, cleaned up in after(). */
const tempDirs = [];

describe("tools - git", () => {
	describe("Zod schema validation", () => {
		it("validates all 21 actions", () => {
			const actions = [
				"status",
				"diff",
				"log",
				"branch",
				"add",
				"commit",
				"push",
				"pull",
				"checkout",
				"merge",
				"rebase",
				"stash",
				"show",
				"tag",
				"worktree",
				"remote",
				"rev-parse",
				"ls-remote",
				"fetch",
				"describe",
			];
			for (const action of actions) {
				const result = git.schema.safeParse({ action });
				assert.ok(result.success, `action '${action}' should be valid`);
			}
		});

		it("rejects invalid action", () => {
			const result = git.schema.safeParse({ action: "invalid" });
			assert.strictEqual(result.success, false);
		});

		it("rejects missing action", () => {
			const result = git.schema.safeParse({});
			assert.strictEqual(result.success, false);
		});

		it("accepts action-specific params", () => {
			const result = git.schema.safeParse({
				action: "commit",
				message: "feat: test",
				path: "src/",
				branch: "main",
				remote: "origin",
				ref: "HEAD",
				limit: 10,
			});
			assert.ok(result.success);
		});

		it("accepts worktree subcommands", () => {
			for (const sub of ["add", "remove", "list", "prune"]) {
				const result = git.schema.safeParse({ action: "worktree", sub });
				assert.ok(result.success, `worktree sub '${sub}' should be valid`);
			}
		});

		it("accepts remote subcommands", () => {
			for (const sub of ["get-url", "add", "set-url"]) {
				const result = git.schema.safeParse({ action: "remote", sub });
				assert.ok(result.success, `remote sub '${sub}' should be valid`);
			}
		});

		it("accepts rev-parse flags", () => {
			for (const flag of ["--show-toplevel", "--abbrev-ref", "--short"]) {
				const result = git.schema.safeParse({ action: "rev-parse", flag });
				assert.ok(result.success, `rev-parse flag '${flag}' should be valid`);
			}
		});

		it("accepts diff mode flags", () => {
			for (const flag of ["cached", "nameOnly", "stat", "patch", "numstat"]) {
				const result = git.schema.safeParse({ action: "diff", [flag]: true });
				assert.ok(result.success, `diff flag '${flag}' should be valid`);
			}
		});

		it("accepts log subject flag", () => {
			const result = git.schema.safeParse({ action: "log", subject: true });
			assert.ok(result.success, "log subject flag should be valid");
		});

		it("accepts tag pattern", () => {
			const result = git.schema.safeParse({ action: "tag", pattern: "1.*" });
			assert.ok(result.success, "tag pattern should be valid");
		});

		it("accepts ls-remote tags flag", () => {
			const result = git.schema.safeParse({ action: "ls-remote", tags: true });
			assert.ok(result.success, "ls-remote tags flag should be valid");
		});

		it("accepts checkout detach flag", () => {
			const result = git.schema.safeParse({ action: "checkout", detach: true });
			assert.ok(result.success, "checkout detach flag should be valid");
		});

		it("accepts branch create flag", () => {
			const result = git.schema.safeParse({ action: "branch", create: true, branch: "feature" });
			assert.ok(result.success, "branch create flag should be valid");
		});

		it("accepts worktree existing flag", () => {
			const result = git.schema.safeParse({
				action: "worktree",
				sub: "add",
				path: "/tmp/worktree",
				branch: "feature",
				existing: true,
			});
			assert.ok(result.success, "worktree existing flag should be valid");
		});
	});
});

describe("tools - git cwd resolution", () => {
	it("git status succeeds against the selected project cwd", async () => {
		const repoRoot = process.cwd();
		setProjectCwd(repoRoot);
		try {
			const result = await gitImpl({ action: "status" }, {});
			assert.strictEqual(result.ok, true);
			assert.ok(result.branch);
		} finally {
			setProjectCwd("");
		}
	});

	it("explicit options.cwd overrides the project cwd", async () => {
		setProjectCwd(path.join(process.cwd(), "tmp", "nonexistent-project"));
		try {
			const result = await gitImpl({ action: "status" }, { cwd: process.cwd() });
			assert.strictEqual(result.ok, true);
			assert.ok(result.branch);
		} finally {
			setProjectCwd("");
		}
	});

	it("falls back to config.cwd when no project is active", async () => {
		setProjectCwd("");
		const result = await gitImpl({ action: "status" }, {});
		assert.strictEqual(result.ok, true);
		assert.ok(result.branch);
	});
});

describe("tools - git branch create", () => {
	it("creates a branch from a start ref", async () => {
		const repo = makeTempRepo();
		tempDirs.push(repo);
		const result = await gitImpl(
			{ action: "branch", branch: "feature", create: true, ref: "main" },
			{ cwd: repo },
		);
		assert.strictEqual(result.ok, true);
		assert.strictEqual(result.created, true);
		assert.strictEqual(result.branch, "feature");
		assert.strictEqual(result.ref, "main");
	});

	it("creates a branch without a start ref", async () => {
		const repo = makeTempRepo();
		tempDirs.push(repo);
		const result = await gitImpl(
			{ action: "branch", branch: "feature", create: true },
			{ cwd: repo },
		);
		assert.strictEqual(result.ok, true);
		assert.strictEqual(result.created, true);
		assert.strictEqual(result.ref, null);
	});

	it("requires a branch for create", async () => {
		const repo = makeTempRepo();
		tempDirs.push(repo);
		const result = await gitImpl({ action: "branch", create: true }, { cwd: repo });
		assert.strictEqual(result.ok, false);
		assert.match(result.error, /branch create requires a branch/);
	});
});

describe("tools - git worktree add existing branch", () => {
	it("links a worktree to an existing branch", async () => {
		const repo = makeTempRepo();
		tempDirs.push(repo);
		execFileSync("git", ["branch", "feature"], { cwd: repo });
		const worktreePath = path.join(repo, "..", `wt-${Date.now()}`);
		tempDirs.push(worktreePath);
		const result = await gitImpl(
			{ action: "worktree", sub: "add", path: worktreePath, branch: "feature", existing: true },
			{ cwd: repo },
		);
		assert.strictEqual(result.ok, true);
		assert.strictEqual(result.branch, "feature");
	});

	it("rejects a path nested inside the repo working tree", async () => {
		const repo = makeTempRepo();
		tempDirs.push(repo);
		const result = await gitImpl(
			{
				action: "worktree",
				sub: "add",
				path: path.join(repo, "nested"),
				branch: "feature",
				existing: true,
			},
			{ cwd: repo },
		);
		assert.strictEqual(result.ok, false);
		assert.match(result.error, /inside the repo working tree/);
	});
});

describe("tools - git branch delete with worktree", () => {
	it("returns a hint when deleting a branch used by a worktree", async () => {
		const repo = makeTempRepo();
		tempDirs.push(repo);
		const worktreePath = path.join(repo, "..", `wt-linked-${Date.now()}`);
		tempDirs.push(worktreePath);
		// Create a worktree on a new branch; the branch is checked out there.
		execFileSync("git", ["worktree", "add", "-b", "linked-branch", worktreePath], { cwd: repo });
		const result = await gitImpl(
			{ action: "branch", delete: true, branch: "linked-branch" },
			{ cwd: repo },
		);
		assert.strictEqual(result.ok, false);
		assert.ok(result.hint, "should return a hint");
		assert.match(result.hint, /worktree/);
	});
});

describe("tools - git worktree remove dirty worktree", () => {
	it("returns a hint when removing a dirty worktree without force", async () => {
		const repo = makeTempRepo();
		tempDirs.push(repo);
		const worktreePath = path.join(repo, "..", `wt-dirty-${Date.now()}`);
		tempDirs.push(worktreePath);
		execFileSync("git", ["worktree", "add", "-b", "dirty-branch", worktreePath], { cwd: repo });
		// Make the worktree dirty by creating an untracked file.
		writeFileSync(path.join(worktreePath, "dirty.txt"), "dirty");
		const result = await gitImpl(
			{ action: "worktree", sub: "remove", path: worktreePath },
			{ cwd: repo },
		);
		assert.strictEqual(result.ok, false);
		assert.ok(result.hint, "should return a hint");
		assert.match(result.hint, /force/);
	});
});

after(() => {
	for (const dir of tempDirs) {
		try {
			rmSync(dir, { recursive: true, force: true });
		} catch {
			// Best-effort cleanup; ignore failures.
		}
	}
});
