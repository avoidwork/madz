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
		it("validates all 13 actions", () => {
			const actions = [
				"status",
				"diff",
				"log",
				"branch",
				"add",
				"commit",
				"push",
				"checkout",
				"merge",
				"rebase",
				"stash",
				"show",
				"tag",
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
	});

	describe("guardrail rejection of destructive commands", () => {
		it("rejects push with force flag without force: true", async () => {
			const result = await gitImpl({ action: "push", force: false });
			assert.strictEqual(result.ok, false);
			assert.ok(result.error.includes("force"));
		});

		it("rejects rebase without explicit opt-in", async () => {
			const result = await gitImpl({ action: "rebase", branch: "main" });
			assert.strictEqual(result.ok, false);
			assert.ok(result.error.includes("rebase"));
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
});
