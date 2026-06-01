import { describe, it } from "node:test";
import assert from "node:assert";
import { mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { runScheduledSkill } from "../../src/scheduler/runner.js";

describe("runScheduledSkill", () => {
	it("passes skill name, input, context, and permissions to sandbox", async () => {
		const captured = {};
		const sandbox = async (opts) => {
			captured.name = opts.skillName;
			captured.input = opts.input;
			captured.context = opts.context;
			captured.permissions = opts.permissions;
			return { stdout: "ok", exitCode: 0 };
		};

		const result = await runScheduledSkill(
			{ skill: "test-skill", input: { key: "val" } },
			sandbox,
			{ skills: ["filesystem:read"] },
		);

		assert.strictEqual(captured.name, "test-skill");
		assert.deepStrictEqual(captured.input, { key: "val" });
		assert.strictEqual(captured.context, "");
		assert.deepStrictEqual(captured.permissions, ["filesystem:read"]);
		assert.strictEqual(result.exitCode, 0);
		assert.strictEqual(result.stdout, "ok");
	});

	it("no contextFile skips context loading (empty string)", async () => {
		const captured = {};
		const sandbox = async (opts) => {
			captured.context = opts.context;
			return { stdout: "ok" };
		};

		await runScheduledSkill({ skill: "test" }, sandbox, {});

		assert.strictEqual(captured.context, "");
	});

	it("existing contextFile reads file content", async () => {
		const testDir = join(tmpdir(), "madz-sched-ctx-" + Date.now());
		mkdirSync(testDir, { recursive: true });
		const ctxFile = join(testDir, "context.md");
		writeFileSync(ctxFile, "---\ntitle: context\n---\nContext body text\n", "utf-8");

		try {
			const captured = {};
			const sandbox = async (opts) => {
				captured.context = opts.context;
				return { stdout: "ok" };
			};

			await runScheduledSkill({ skill: "test", contextFile: ctxFile }, sandbox, {});

			assert.ok(captured.context.includes("Context body text"));
		} finally {
			try {
				rmSync(testDir, { recursive: true, force: true });
			} catch {
				// ignore
			}
		}
	});

	it("missing contextFile falls back to loadContext", async () => {
		const captured = {};
		const sandbox = async (opts) => {
			captured.context = opts.context;
			return { stdout: "ok" };
		};

		// Non-existent context file → should call loadContext which returns "" for non-existent dir
		await runScheduledSkill(
			{ skill: "test", contextFile: "/nonexistent/context/file.md" },
			sandbox,
			{ contextDir: "__nonexistent_ctx_dir_xyz__/" },
		);

		// loadContext returns "" when directory does not exist
		assert.strictEqual(captured.context, "");
	});

	it("empty contextFile skips loadContext (contextFile is empty string)", async () => {
		const captured = {};
		const sandbox = async (opts) => {
			captured.context = opts.context;
			return { stdout: "ok" };
		};

		await runScheduledSkill({ skill: "test", contextFile: "" }, sandbox, {});

		assert.strictEqual(captured.context, "");
	});

	it("contextFile with non-string value is treated as truthy and skipped", async () => {
		const captured = {};
		const sandbox = async (opts) => {
			captured.context = opts.context;
			return { stdout: "ok" };
		};

		await runScheduledSkill({ skill: "test", contextFile: 0 }, sandbox, {});

		// 0 is falsy, so the `if (contextFile && existsSync(contextFile))` skips
		assert.strictEqual(captured.context, "");
	});
});
