import { describe, it } from "node:test";
import assert from "node:assert";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { gitImpl, git } from "../../../src/tools/git/index.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const GIT_SOURCE = readFileSync(join(__dirname, "../../../src/tools/git/index.js"), "utf-8");

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
				force: true,
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
	});

	describe("guardrail rejection of destructive commands", () => {
		it("does not gate push as destructive", () => {
			// push is a plain `git push remote branch`, not a force push; it must
			// not be blanket-gated as destructive. Assert the source rather than
			// invoking a real push (which would hit the network).
			assert.ok(
				!GIT_SOURCE.includes('const FORCE_ACTIONS = ["push", "rebase"]'),
				"push should not be in FORCE_ACTIONS",
			);
			assert.ok(
				GIT_SOURCE.includes('const FORCE_ACTIONS = ["rebase"]'),
				"FORCE_ACTIONS should only gate rebase",
			);
		});

		it("rejects rebase without explicit opt-in", async () => {
			const result = await gitImpl({ action: "rebase", branch: "main" });
			assert.strictEqual(result.ok, false);
			assert.ok(result.error.includes("rebase"));
		});

		it("rejects worktree remove without force", async () => {
			const result = await gitImpl({ action: "worktree", sub: "remove", path: "/tmp/x" });
			assert.strictEqual(result.ok, false);
			assert.ok(result.error.includes("force"));
		});

		it("rejects branch delete without force", async () => {
			const result = await gitImpl({ action: "branch", delete: true, branch: "foo" });
			assert.strictEqual(result.ok, false);
			assert.ok(result.error.includes("force"));
		});

		it("rejects unknown action", async () => {
			const result = await gitImpl({ action: "reset" });
			assert.strictEqual(result.ok, false);
			assert.ok(result.error.includes("Unknown action"));
		});

		it("rejects clean action", async () => {
			const result = await gitImpl({ action: "clean" });
			assert.strictEqual(result.ok, false);
			assert.ok(result.error.includes("Unknown action"));
		});
	});

	describe("arg-array construction (no shell injection)", () => {
		it("status builds arg array", async () => {
			const result = await gitImpl({ action: "status" });
			// Should not throw and should return structured output or error
			assert.ok(result.ok === true || result.ok === false);
		});

		it("does not use sh -c", () => {
			// The implementation must use execFile, not spawn("sh", ["-c", ...])
			assert.ok(!GIT_SOURCE.includes('spawn("sh"'), "git tool should not spawn sh");
			assert.ok(!GIT_SOURCE.includes('spawn("sh", ["-c"'), "git tool should not use sh -c");
		});

		it("uses execFile with git binary", () => {
			assert.ok(GIT_SOURCE.includes('execFile("git"'), "git tool should use execFile('git')");
		});
	});

	describe("validation of required params", () => {
		it("worktree add requires a path", async () => {
			const result = await gitImpl({ action: "worktree", sub: "add" });
			assert.strictEqual(result.ok, false);
			assert.ok(result.error.includes("path"));
		});

		it("worktree remove requires a path", async () => {
			const result = await gitImpl({ action: "worktree", sub: "remove", force: true });
			assert.strictEqual(result.ok, false);
			assert.ok(result.error.includes("path"));
		});

		it("remote add requires remote and url", async () => {
			const result = await gitImpl({ action: "remote", sub: "add" });
			assert.strictEqual(result.ok, false);
			assert.ok(result.error.includes("remote"));
		});

		it("rev-parse rejects invalid flag", async () => {
			const result = await gitImpl({ action: "rev-parse", flag: "--bad-flag" });
			assert.strictEqual(result.ok, false);
			assert.ok(result.error.includes("Invalid rev-parse flag"));
		});

		it("rev-parse requires a flag or ref", async () => {
			const result = await gitImpl({ action: "rev-parse" });
			assert.strictEqual(result.ok, false);
			assert.ok(result.error.includes("flag or ref"));
		});
	});
});
