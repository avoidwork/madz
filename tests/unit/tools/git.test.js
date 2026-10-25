import { describe, it } from "node:test";
import assert from "node:assert";
import { git } from "../../../src/tools/git/index.js";

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
	});
});
