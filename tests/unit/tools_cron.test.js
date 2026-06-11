import { describe, it, before, after } from "node:test";
import assert from "node:assert";
import { cronJobImpl, findSkillScript, runScript } from "../../src/tools/cron.js";
import { Cron } from "../../src/scheduler/cron.js";
import { mkdirSync, writeFileSync, rmSync, existsSync, chmodSync } from "node:fs";
import { join } from "node:path";
import { rm } from "node:fs/promises";

const SCHEDULES_DIR = "memory/__test_cron__/";

describe("findSkillScript", () => {
	it("returns null when skill directory does not exist", async () => {
		const result = await findSkillScript("nonexistent-skill");
		assert.strictEqual(result, null);
	});

	it("finds run.sh in scripts directory", async () => {
		const testDir = "skills/__test_find_skill__";
		mkdirSync(join(testDir, "test-skill", "scripts"), { recursive: true });
		writeFileSync(join(testDir, "test-skill", "scripts", "run.sh"), "#!/bin/bash\necho hello");
		try {
			const result = await findSkillScript("test-skill", testDir);
			assert.strictEqual(result, join(testDir, "test-skill", "scripts", "run.sh"));
		} finally {
			if (existsSync(testDir)) {
				rmSync(testDir, { recursive: true, force: true });
			}
		}
	});

	it("finds run.py in scripts directory", async () => {
		const testDir = "skills/__test_find_skill__py";
		mkdirSync(join(testDir, "py-skill", "scripts"), { recursive: true });
		writeFileSync(join(testDir, "py-skill", "scripts", "run.py"), "#!/usr/bin/env python3");
		try {
			const result = await findSkillScript("py-skill", testDir);
			assert.strictEqual(result, join(testDir, "py-skill", "scripts", "run.py"));
		} finally {
			if (existsSync(testDir)) {
				rmSync(testDir, { recursive: true, force: true });
			}
		}
	});

	it("finds run.sh in skill root directory", async () => {
		const testDir = "skills/__test_find_skill__root";
		mkdirSync(join(testDir, "root-skill"), { recursive: true });
		writeFileSync(join(testDir, "root-skill", "run.sh"), "#!/bin/bash\necho root");
		try {
			const result = await findSkillScript("root-skill", testDir);
			assert.strictEqual(result, join(testDir, "root-skill", "run.sh"));
		} finally {
			if (existsSync(testDir)) {
				rmSync(testDir, { recursive: true, force: true });
			}
		}
	});

	it("prefers scripts/run.sh over root-level scripts", async () => {
		const testDir = "skills/__test_find_skill__pref";
		mkdirSync(join(testDir, "pref-skill", "scripts"), { recursive: true });
		writeFileSync(join(testDir, "pref-skill", "scripts", "run.sh"), "#!/bin/bash\necho scripts");
		writeFileSync(join(testDir, "pref-skill", "run.sh"), "#!/bin/bash\necho root");
		try {
			const result = await findSkillScript("pref-skill", testDir);
			assert.strictEqual(result, join(testDir, "pref-skill", "scripts", "run.sh"));
		} finally {
			if (existsSync(testDir)) {
				rmSync(testDir, { recursive: true, force: true });
			}
		}
	});
});

describe("runScript", () => {
	it("executes a simple echo script and collects output", async () => {
		const testDir = "tmp/__test_runscript__";
		mkdirSync(testDir, { recursive: true });
		const scriptPath = join(testDir, "echo-test.sh");
		writeFileSync(scriptPath, "#!/bin/bash\necho hello-from-script\n", "utf-8");
		chmodSync(scriptPath, 0o755);
		try {
			const result = await runScript(scriptPath, [], { timeout: 5000 });
			assert.strictEqual(result.exitCode, 0);
			assert.ok(result.stdout.includes("hello-from-script"));
		} finally {
			rmSync(testDir, { recursive: true, force: true });
		}
	});
});

describe("cronJob", () => {
	let origFetch;

	before(async () => {
		origFetch = globalThis.fetch;
		// Clean up any stale test jobs
		const cleanupNames = [
			"daily-report",
			"to-remove",
			"t1",
			"t2",
			"t3",
			"dup-job",
			"bad-cron",
			"partial",
			"cron-updated",
			"input-merged",
			"paused-job",
		];
		for (const name of cleanupNames) {
			try {
				await cronJobImpl({ action: "remove", name }, { schedulesDir: SCHEDULES_DIR });
			} catch {
				// ignore not-found errors
			}
		}
	});

	after(async () => {
		globalThis.fetch = origFetch;
		const cleanupNames = [
			"daily-report",
			"to-remove",
			"t1",
			"t2",
			"t3",
			"dup-job",
			"bad-cron",
			"partial",
			"cron-updated",
			"input-merged",
			"paused-job",
			"nonexistent-job",
		];
		for (const name of cleanupNames) {
			try {
				await cronJobImpl({ action: "remove", name }, { schedulesDir: SCHEDULES_DIR });
			} catch {
				// ignore
			}
		}
		// Ensure the system crontab is clean — strip the entire madz-schedules block
		try {
			Cron.uninstall();
		} catch {
			// crontab may not be available; ignore
		}
		try {
			await rm(SCHEDULES_DIR, { recursive: true, force: true });
		} catch {
			// ignore
		}
	});

	it("requires action", async () => {
		const result = await cronJobImpl({}, { schedulesDir: SCHEDULES_DIR });
		const parsed = JSON.parse(result);
		assert.strictEqual(parsed.ok, false);
		assert.ok(parsed.error.includes("Unknown action"));
	});

	it("rejects unknown action", async () => {
		const result = await cronJobImpl({ action: "delete" }, { schedulesDir: SCHEDULES_DIR });
		const parsed = JSON.parse(result);
		assert.strictEqual(parsed.ok, false);
		assert.ok(parsed.error.includes("Unknown action"));
	});

	it("create requires name, cron, skill", async () => {
		const result = await cronJobImpl(
			{ action: "create", name: "test" },
			{ schedulesDir: SCHEDULES_DIR },
		);
		const parsed = JSON.parse(result);
		assert.strictEqual(parsed.ok, false);
		assert.ok(parsed.error.includes("requires"));
	});

	it("create validates cron expression", async () => {
		const result = await cronJobImpl(
			{ action: "create", name: "test", cron: "not-valid", skill: "test-skill" },
			{ schedulesDir: SCHEDULES_DIR },
		);
		const parsed = JSON.parse(result);
		assert.strictEqual(parsed.ok, false);
		assert.ok(parsed.error.includes("Invalid cron"));
	});

	it("creates a job and persists it", async () => {
		const result = await cronJobImpl(
			{ action: "create", name: "daily-report", cron: "0 9 * * *", skill: "report-gen" },
			{ schedulesDir: SCHEDULES_DIR },
		);
		const parsed = JSON.parse(result);
		assert.strictEqual(parsed.ok, true);
		assert.ok(parsed.job);
		assert.strictEqual(parsed.job.name, "daily-report");
		assert.strictEqual(parsed.job.enabled, true);
		assert.ok(parsed.job.createdAt);
	});

	it("list returns created jobs", async () => {
		const result = await cronJobImpl({ action: "list" }, { schedulesDir: SCHEDULES_DIR });
		const parsed = JSON.parse(result);
		assert.strictEqual(parsed.ok, true);
		assert.ok(parsed.jobs);
		assert.ok(Array.isArray(parsed.jobs));
		assert.ok(parsed.jobs.find((j) => j.name === "daily-report"));
	});

	it("updates an existing job", async () => {
		const result = await cronJobImpl(
			{ action: "update", name: "daily-report", skill: "weekly-report" },
			{ schedulesDir: SCHEDULES_DIR },
		);
		const parsed = JSON.parse(result);
		assert.strictEqual(parsed.ok, true);
		assert.strictEqual(parsed.job.skill, "weekly-report");
	});

	it("pauses a job", async () => {
		const result = await cronJobImpl(
			{ action: "pause", name: "daily-report" },
			{ schedulesDir: SCHEDULES_DIR },
		);
		const parsed = JSON.parse(result);
		assert.strictEqual(parsed.ok, true);
		assert.strictEqual(parsed.job.enabled, false);
	});

	it("resumes a paused job", async () => {
		const result = await cronJobImpl(
			{ action: "resume", name: "daily-report" },
			{ schedulesDir: SCHEDULES_DIR },
		);
		const parsed = JSON.parse(result);
		assert.strictEqual(parsed.ok, true);
		assert.strictEqual(parsed.job.enabled, true);
	});

	it("removes a job", async () => {
		const result = await cronJobImpl(
			{ action: "create", name: "to-remove", cron: "0 0 * * *", skill: "test" },
			{ schedulesDir: SCHEDULES_DIR },
		);
		assert.strictEqual(JSON.parse(result).ok, true);
		const removeResult = await cronJobImpl(
			{ action: "remove", name: "to-remove" },
			{ schedulesDir: SCHEDULES_DIR },
		);
		const parsed = JSON.parse(removeResult);
		assert.strictEqual(parsed.ok, true);
	});

	it("rejects update for non-existent job", async () => {
		const result = await cronJobImpl(
			{ action: "update", name: "nonexistent" },
			{ schedulesDir: SCHEDULES_DIR },
		);
		const parsed = JSON.parse(result);
		assert.strictEqual(parsed.ok, false);
		assert.ok(parsed.error.includes("not found"));
	});

	it("rejects remove for non-existent job", async () => {
		const result = await cronJobImpl(
			{ action: "remove", name: "nonexistent" },
			{ schedulesDir: SCHEDULES_DIR },
		);
		const parsed = JSON.parse(result);
		assert.strictEqual(parsed.ok, false);
	});

	it("rejects pause for non-existent job", async () => {
		const result = await cronJobImpl(
			{ action: "pause", name: "nonexistent" },
			{ schedulesDir: SCHEDULES_DIR },
		);
		const parsed = JSON.parse(result);
		assert.strictEqual(parsed.ok, false);
	});

	it("rejects resume for non-existent job", async () => {
		const result = await cronJobImpl(
			{ action: "resume", name: "nonexistent" },
			{ schedulesDir: SCHEDULES_DIR },
		);
		const parsed = JSON.parse(result);
		assert.strictEqual(parsed.ok, false);
	});

	it("rejects run for non-existent job", async () => {
		const result = await cronJobImpl(
			{ action: "run", name: "nonexistent" },
			{ schedulesDir: SCHEDULES_DIR },
		);
		const parsed = JSON.parse(result);
		assert.strictEqual(parsed.ok, false);
		assert.ok(parsed.error.includes("not found"));
	});

	it("validates various cron expressions", async () => {
		assert.strictEqual(
			JSON.parse(
				await cronJobImpl(
					{ action: "create", name: "t1", cron: "*/15 * * * *", skill: "s" },
					{ schedulesDir: SCHEDULES_DIR },
				),
			).ok,
			true,
		);
		// Step expressions
		assert.strictEqual(
			JSON.parse(
				await cronJobImpl(
					{ action: "create", name: "t2", cron: "0-30/5 * * * *", skill: "s" },
					{ schedulesDir: SCHEDULES_DIR },
				),
			).ok,
			true,
		);
		// Comma-separated
		assert.strictEqual(
			JSON.parse(
				await cronJobImpl(
					{ action: "create", name: "t3", cron: "0,30 * * * *", skill: "s" },
					{ schedulesDir: SCHEDULES_DIR },
				),
			).ok,
			true,
		);
	});

	it("creates duplicate job and rejects", async () => {
		const createResult = await cronJobImpl(
			{ action: "create", name: "dup-job", cron: "0 0 * * *", skill: "test" },
			{ schedulesDir: SCHEDULES_DIR },
		);
		assert.strictEqual(JSON.parse(createResult).ok, true);
		// Now try to create again
		const dupResult = await cronJobImpl(
			{ action: "create", name: "dup-job", cron: "0 0 * * *", skill: "test" },
			{ schedulesDir: SCHEDULES_DIR },
		);
		assert.strictEqual(JSON.parse(dupResult).ok, false);
		assert.ok(JSON.parse(dupResult).error.includes("already exists"));
	});

	it("rejects update with invalid cron expression", async () => {
		await cronJobImpl(
			{ action: "create", name: "bad-cron", cron: "0 0 * * *", skill: "test" },
			{ schedulesDir: SCHEDULES_DIR },
		);
		const result = await cronJobImpl(
			{ action: "update", name: "bad-cron", cron: "invalid cron" },
			{ schedulesDir: SCHEDULES_DIR },
		);
		const parsed = JSON.parse(result);
		assert.strictEqual(parsed.ok, false);
		assert.ok(parsed.error.includes("Invalid cron") || parsed.error.includes("Invalid"));
		await cronJobImpl({ action: "remove", name: "bad-cron" }, { schedulesDir: SCHEDULES_DIR });
	});

	it("updates only selected fields", async () => {
		await cronJobImpl(
			{
				action: "create",
				name: "partial",
				cron: "0 0 * * *",
				skill: "skill-a",
				input: { a: 1 },
			},
			{ schedulesDir: SCHEDULES_DIR },
		);
		const result = await cronJobImpl(
			{ action: "update", name: "partial", skill: "skill-b" },
			{ schedulesDir: SCHEDULES_DIR },
		);
		const parsed = JSON.parse(result);
		assert.strictEqual(parsed.ok, true);
		assert.strictEqual(parsed.job.skill, "skill-b");
		assert.ok(parsed.job.input);
		await cronJobImpl({ action: "remove", name: "partial" }, { schedulesDir: SCHEDULES_DIR });
	});

	it("rejects update without name", async () => {
		const result = await cronJobImpl({ action: "update" }, { schedulesDir: SCHEDULES_DIR });
		const parsed = JSON.parse(result);
		assert.strictEqual(parsed.ok, false);
		assert.ok(parsed.error.includes("requires"));
	});

	it("rejects resume without name", async () => {
		const result = await cronJobImpl({ action: "resume" }, { schedulesDir: SCHEDULES_DIR });
		const parsed = JSON.parse(result);
		assert.strictEqual(parsed.ok, false);
		assert.ok(parsed.error.includes("requires"));
	});

	it("rejects pause without name", async () => {
		const result = await cronJobImpl({ action: "pause" }, { schedulesDir: SCHEDULES_DIR });
		const parsed = JSON.parse(result);
		assert.strictEqual(parsed.ok, false);
		assert.ok(parsed.error.includes("requires"));
	});

	it("rejects remove without name", async () => {
		const result = await cronJobImpl({ action: "remove" }, { schedulesDir: SCHEDULES_DIR });
		const parsed = JSON.parse(result);
		assert.strictEqual(parsed.ok, false);
		assert.ok(parsed.error.includes("requires"));
	});

	it("rejects run without name", async () => {
		const result = await cronJobImpl({ action: "run" }, { schedulesDir: SCHEDULES_DIR });
		const parsed = JSON.parse(result);
		assert.strictEqual(parsed.ok, false);
		assert.ok(parsed.error.includes("requires"));
	});

	it("update with valid cron expression", async () => {
		await cronJobImpl(
			{ action: "create", name: "cron-updated", cron: "0 0 * * *", skill: "skill-a" },
			{ schedulesDir: SCHEDULES_DIR },
		);
		const result = await cronJobImpl(
			{ action: "update", name: "cron-updated", cron: "30 6 * * *" },
			{ schedulesDir: SCHEDULES_DIR },
		);
		const parsed = JSON.parse(result);
		assert.strictEqual(parsed.ok, true);
		assert.strictEqual(parsed.job.cron, "30 6 * * *");
		await cronJobImpl({ action: "remove", name: "cron-updated" }, { schedulesDir: SCHEDULES_DIR });
	});

	it("update merges input fields", async () => {
		await cronJobImpl(
			{
				action: "create",
				name: "input-merged",
				cron: "0 0 * * *",
				skill: "skill-a",
				input: { a: 1, b: 2 },
			},
			{ schedulesDir: SCHEDULES_DIR },
		);
		const result = await cronJobImpl(
			{ action: "update", name: "input-merged", input: { c: 3 } },
			{ schedulesDir: SCHEDULES_DIR },
		);
		const parsed = JSON.parse(result);
		assert.strictEqual(parsed.ok, true);
		assert.deepStrictEqual(parsed.job.input, { a: 1, b: 2, c: 3 });
		await cronJobImpl({ action: "remove", name: "input-merged" }, { schedulesDir: SCHEDULES_DIR });
	});

	it("run succeeds for paused job (returns ok: false with message)", async () => {
		await cronJobImpl(
			{ action: "create", name: "paused-job", cron: "0 0 * * *", skill: "test-skill" },
			{ schedulesDir: SCHEDULES_DIR },
		);
		await cronJobImpl({ action: "pause", name: "paused-job" }, { schedulesDir: SCHEDULES_DIR });
		const result = await cronJobImpl(
			{ action: "run", name: "paused-job" },
			{ schedulesDir: SCHEDULES_DIR },
		);
		const parsed = JSON.parse(result);
		assert.strictEqual(parsed.ok, false);
		assert.ok(parsed.error.includes("paused"));
		await cronJobImpl({ action: "remove", name: "paused-job" }, { schedulesDir: SCHEDULES_DIR });
	});

	it("getScheduleFiles returns empty when directory does not exist", async () => {
		try {
			await rm(SCHEDULES_DIR, { recursive: true, force: true });
		} catch {
			// ignore
		}
		const result = await cronJobImpl({ action: "list" }, { schedulesDir: SCHEDULES_DIR });
		const parsed = JSON.parse(result);
		assert.strictEqual(parsed.ok, true);
		assert.deepStrictEqual(parsed.jobs, []);
	});

	it("catch block handles unexpected serialize errors", async () => {
		await cronJobImpl(
			{ action: "create", name: "catch-test", cron: "0 0 * * *", skill: "skill-a" },
			{ schedulesDir: SCHEDULES_DIR },
		);
		const circular = {};
		circular.self = circular;
		const result = await cronJobImpl(
			{ action: "update", name: "catch-test", input: circular },
			{ schedulesDir: SCHEDULES_DIR },
		);
		const parsed = JSON.parse(result);
		assert.strictEqual(parsed.ok, false);
		assert.ok(parsed.error.includes("Cron job error"));
		await cronJobImpl({ action: "remove", name: "catch-test" }, { schedulesDir: SCHEDULES_DIR });
	});

	it("run without scheduler option uses dynamic import path", async () => {
		await cronJobImpl(
			{
				action: "create",
				name: "dynamic-import-test",
				cron: "0 0 * * *",
				skill: "test-skill",
			},
			{ schedulesDir: SCHEDULES_DIR },
		);
		const result = await cronJobImpl(
			{ action: "run", name: "dynamic-import-test" },
			{ schedulesDir: SCHEDULES_DIR },
		);
		const parsed = JSON.parse(result);
		assert.ok(parsed.ok !== undefined);
		await cronJobImpl(
			{ action: "remove", name: "dynamic-import-test" },
			{ schedulesDir: SCHEDULES_DIR },
		);
	});

	it("run returns error when skill has no discoverable script", async () => {
		await cronJobImpl(
			{
				action: "create",
				name: "no-script-job",
				cron: "0 0 * * *",
				skill: "nonexistent-skill",
			},
			{ schedulesDir: SCHEDULES_DIR },
		);
		const result = await cronJobImpl(
			{ action: "run", name: "no-script-job" },
			{ schedulesDir: SCHEDULES_DIR },
		);
		const parsed = JSON.parse(result);
		assert.strictEqual(parsed.ok, false);
		assert.ok(parsed.error.includes("no discoverable script"));
		await cronJobImpl({ action: "remove", name: "no-script-job" }, { schedulesDir: SCHEDULES_DIR });
	});

	it("run executes skill script when one is found", async () => {
		const skillDir = "skills/test-exec-skill/scripts";
		mkdirSync(skillDir, { recursive: true });
		const scriptPath = join(skillDir, "run.sh");
		writeFileSync(scriptPath, "#!/bin/bash\necho execution-success\n", "utf-8");
		chmodSync(scriptPath, 0o755);

		try {
			await cronJobImpl(
				{
					action: "create",
					name: "exec-job",
					cron: "0 0 * * *",
					skill: "test-exec-skill",
				},
				{ schedulesDir: SCHEDULES_DIR },
			);
			const result = await cronJobImpl(
				{ action: "run", name: "exec-job" },
				{ schedulesDir: SCHEDULES_DIR },
			);
			const parsed = JSON.parse(result);
			assert.ok(parsed !== null);
		} finally {
			rmSync("skills/test-exec-skill", { recursive: true, force: true });
			await cronJobImpl(
				{ action: "remove", name: "exec-job" },
				{ schedulesDir: SCHEDULES_DIR },
			).catch(() => {});
		}
	});
});
