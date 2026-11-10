import { describe, it, afterEach } from "node:test";
import assert from "node:assert";
import { mkdirSync, writeFileSync, readFileSync, readdirSync, rmSync, existsSync } from "node:fs";
import { join } from "node:path";
import { cronJobImpl, findSkillScript, runScript } from "../../src/tools/cron/index.js";

const DIR = "memory/__test_cron_audit__/";

/**
 * Cron mock that records calls and can be told to fail.
 * @param {{ add?: string, remove?: string }} [fail] - Error texts to return
 * @returns {{ calls: string[], mod: object }}
 */
function recordingCron(fail = {}) {
	const calls = [];
	return {
		calls,
		mod: {
			async add(job) {
				calls.push(`add:${job.name}`);
				return fail.add ? { added: false, error: fail.add } : { added: true };
			},
			async remove(name) {
				calls.push(`remove:${name}`);
				return fail.remove ? { removed: false, error: fail.remove } : { removed: true };
			},
		},
	};
}

/**
 * Build options.
 * @param {object} [extra] - Overrides
 * @returns {object}
 */
function opts(extra = {}) {
	return { schedulesDir: DIR, cron: recordingCron().mod, ...extra };
}

/**
 * Create a job with the default mock.
 * @param {object} fields - Tool input fields
 * @param {object} [extra] - Option overrides
 * @returns {Promise<object>}
 */
function create(fields, extra) {
	return cronJobImpl({ action: "create", cron: "0 0 * * *", skill: "s", ...fields }, opts(extra));
}

afterEach(() => {
	rmSync(DIR, { recursive: true, force: true });
});

describe("cronJob input validation", () => {
	it("rejects path-traversal job names for every action", async () => {
		for (const action of ["create", "update", "pause", "resume", "run", "remove"]) {
			const result = await cronJobImpl(
				{ action, name: "../../evil", cron: "0 0 * * *", skill: "s" },
				opts(),
			);
			assert.strictEqual(result.ok, false, action);
			assert.ok(result.error.includes("Invalid job name"), action);
		}
		assert.strictEqual(existsSync("memory/evil.json"), false);
	});

	it("rejects job names with separators, dots, spaces and newlines", async () => {
		for (const name of ["a/b", "a.b", "a b", "a\nb", ".hidden", "x".repeat(65)]) {
			assert.strictEqual((await create({ name })).ok, false, JSON.stringify(name));
		}
	});

	it("rejects invalid skill names", async () => {
		const result = await create({ name: "bad-skill", skill: '"; rm -rf ~; "' });
		assert.strictEqual(result.ok, false);
		assert.ok(result.error.includes("Invalid skill name"));
	});

	it("rejects commands containing newlines, null bytes, or only whitespace", async () => {
		for (const command of ["echo a\necho b", "echo a\r", "echo a\0b", "  "]) {
			assert.strictEqual((await create({ name: "nl-cmd", command })).ok, false);
		}
	});

	it("rejects oversized input", async () => {
		const result = await create({ name: "big", input: { blob: "x".repeat(20000) } });
		assert.strictEqual(result.ok, false);
		assert.ok(result.error.includes("input"));
	});

	it("validates cron expressions strictly", async () => {
		const bad = [
			"99 99 99 99 99",
			"* * * * * garbage",
			"/5 * * * *",
			"0 0 L * *",
			"0 0 ? * *",
			"* * * * * *",
			"5-1 * * * *",
			"* * * *",
			"@daily",
		];
		for (const cron of bad) {
			assert.strictEqual((await create({ name: "c", cron })).ok, false, cron);
		}
		const good = [
			"0 0 * * MON",
			"0 0 1 JAN *",
			"0 0 * * 7",
			"*/15 9-17 * * 1-5",
			"0 0 * * mon-fri",
		];
		for (const cron of good) {
			const result = await create({ name: "c", cron });
			assert.strictEqual(result.ok, true, cron);
			await cronJobImpl({ action: "remove", name: "c" }, opts());
		}
	});

	it("findSkillScript returns null for traversal and invalid names", async () => {
		for (const name of ["../x", "a/b", "", undefined, null, ".."]) {
			assert.strictEqual(await findSkillScript(name), null);
		}
	});
});

describe("cronJob command construction", () => {
	it("escapes shell metacharacters from input in the derived command", async () => {
		const payload = '"; touch /tmp/madz-pwned; echo "$(id)`id`';
		const result = await create({ name: "inject", skill: "report-gen", input: { q: payload } });
		assert.strictEqual(result.ok, true);
		const cmd = result.job.command;
		assert.ok(cmd.includes("\\$(id)"));
		assert.ok(cmd.includes("\\`id\\`"));

		// Run the real derived command with `node index.js` swapped for printf; the
		// payload must come out as data, not execute.
		const harmless = cmd.replace(/^cd [^&]+&& node index\.js --message/, "printf %s");
		const out = await runScript("/bin/sh", ["-c", harmless], { timeout: 5000 });
		assert.strictEqual(out.exitCode, 0);
		assert.ok(out.stdout.includes("touch /tmp/madz-pwned"));
		assert.ok(out.stdout.includes("$(id)"));
		assert.strictEqual(existsSync("/tmp/madz-pwned"), false);
	});

	it("update regenerates a derived command when skill or input changes", async () => {
		await create({ name: "regen", skill: "skill-a", input: { a: 1 } });
		const bySkill = await cronJobImpl(
			{ action: "update", name: "regen", skill: "skill-b" },
			opts(),
		);
		assert.ok(bySkill.job.command.includes("Run the skill-b skill"));
		const byInput = await cronJobImpl({ action: "update", name: "regen", input: { b: 2 } }, opts());
		assert.ok(byInput.job.command.includes("skill-b"));
		assert.ok(byInput.job.command.includes('\\"b\\":2'));
	});

	it("update keeps an explicit command when the skill changes", async () => {
		await create({ name: "keep", skill: "a", command: "echo mine" });
		const result = await cronJobImpl({ action: "update", name: "keep", skill: "b" }, opts());
		assert.strictEqual(result.job.command, "echo mine");
	});

	it("update with an empty command re-derives it and syncs the crontab", async () => {
		const { calls, mod } = recordingCron();
		await create({ name: "empty", skill: "a", command: "echo mine" }, { cron: mod });
		calls.length = 0;
		const result = await cronJobImpl(
			{ action: "update", name: "empty", command: "" },
			opts({ cron: mod }),
		);
		assert.strictEqual(result.ok, true);
		assert.ok(result.job.command.includes("Run the a skill"));
		assert.deepStrictEqual(calls, ["add:empty"]);
	});
});

describe("cronJob crontab consistency", () => {
	it("pause removes the crontab entry and resume restores it", async () => {
		const { calls, mod } = recordingCron();
		await create({ name: "pr" }, { cron: mod });
		calls.length = 0;
		const paused = await cronJobImpl({ action: "pause", name: "pr" }, opts({ cron: mod }));
		assert.strictEqual(paused.ok, true);
		assert.deepStrictEqual(calls, ["remove:pr"]);
		calls.length = 0;
		const resumed = await cronJobImpl({ action: "resume", name: "pr" }, opts({ cron: mod }));
		assert.strictEqual(resumed.ok, true);
		assert.deepStrictEqual(calls, ["add:pr"]);
	});

	it("pause does not mark the job paused when crontab removal fails", async () => {
		await create({ name: "pf" });
		const { mod } = recordingCron({ remove: "boom" });
		const result = await cronJobImpl({ action: "pause", name: "pf" }, opts({ cron: mod }));
		assert.strictEqual(result.ok, false);
		const { jobs } = await cronJobImpl({ action: "list" }, opts());
		assert.strictEqual(jobs.find((j) => j.name === "pf").enabled, true);
	});

	it("create fails and persists nothing when crontab registration fails", async () => {
		const { mod } = recordingCron({ add: "crontab exploded" });
		const result = await create({ name: "af" }, { cron: mod });
		assert.strictEqual(result.ok, false);
		assert.ok(result.error.includes("crontab exploded"));
		const { jobs } = await cronJobImpl({ action: "list" }, opts());
		assert.ok(!jobs.find((j) => j.name === "af"));
	});

	it("remove keeps the job file when crontab removal fails", async () => {
		await create({ name: "rf" });
		const { mod } = recordingCron({ remove: "boom" });
		const result = await cronJobImpl({ action: "remove", name: "rf" }, opts({ cron: mod }));
		assert.strictEqual(result.ok, false);
		const { jobs } = await cronJobImpl({ action: "list" }, opts());
		assert.ok(jobs.find((j) => j.name === "rf"));
	});

	it("remove tolerates an unavailable crontab", async () => {
		await create({ name: "rn" });
		const { mod } = recordingCron({ remove: "System crontab is not available" });
		const result = await cronJobImpl({ action: "remove", name: "rn" }, opts({ cron: mod }));
		assert.strictEqual(result.ok, true);
	});

	it("update surfaces crontab failures and leaves the job unchanged", async () => {
		await create({ name: "uf" });
		const { mod } = recordingCron({ add: "nope" });
		const result = await cronJobImpl(
			{ action: "update", name: "uf", cron: "5 5 * * *" },
			opts({ cron: mod }),
		);
		assert.strictEqual(result.ok, false);
		const { jobs } = await cronJobImpl({ action: "list" }, opts());
		assert.strictEqual(jobs.find((j) => j.name === "uf").cron, "0 0 * * *");
	});

	it("update of a paused job does not re-add it to the crontab", async () => {
		const { calls, mod } = recordingCron();
		await create({ name: "up" }, { cron: mod });
		await cronJobImpl({ action: "pause", name: "up" }, opts({ cron: mod }));
		calls.length = 0;
		const result = await cronJobImpl(
			{ action: "update", name: "up", cron: "1 1 * * *" },
			opts({ cron: mod }),
		);
		assert.strictEqual(result.ok, true);
		assert.deepStrictEqual(calls, []);
	});
});

describe("cronJob persistence", () => {
	it("refuses to treat a corrupt job file as absent", async () => {
		mkdirSync(DIR, { recursive: true });
		writeFileSync(join(DIR, "corrupt.json"), "{ not json");
		const result = await create({ name: "corrupt" });
		assert.strictEqual(result.ok, false);
		assert.ok(result.error.includes("corrupt"));
		assert.strictEqual(readFileSync(join(DIR, "corrupt.json"), "utf-8"), "{ not json");
		const listed = await cronJobImpl({ action: "list" }, opts());
		assert.strictEqual(listed.ok, true);
		assert.ok(!listed.jobs.find((j) => j.name === "corrupt"));
	});

	it("leaves no temp files behind and writes valid JSON", async () => {
		await create({ name: "atomic" });
		await cronJobImpl({ action: "pause", name: "atomic" }, opts());
		assert.ok(!readdirSync(DIR).some((f) => f.endsWith(".tmp")));
		assert.strictEqual(JSON.parse(readFileSync(join(DIR, "atomic.json"), "utf-8")).enabled, false);
	});

	it("serializes concurrent creates of the same job so exactly one wins", async () => {
		const results = await Promise.all(Array.from({ length: 5 }, () => create({ name: "race" })));
		assert.strictEqual(results.filter((r) => r.ok).length, 1);
	});

	it("list is sorted by name", async () => {
		for (const name of ["zz-job", "aa-job", "mm-job"]) await create({ name });
		const { jobs } = await cronJobImpl({ action: "list" }, opts());
		const names = jobs.map((j) => j.name);
		assert.deepStrictEqual(names, [...names].sort());
	});

	it("resolves a relative schedulesDir to an absolute path", async () => {
		const result = await create({ name: "abs" });
		assert.strictEqual(result.ok, true);
		assert.ok(existsSync(join(process.cwd(), DIR, "abs.json")));
	});
});

describe("cronJob run", () => {
	it("executes the job command and records the outcome", async () => {
		await create({ name: "ok", command: "echo run-ok-output" });
		const result = await cronJobImpl({ action: "run", name: "ok" }, opts());
		assert.strictEqual(result.ok, true);
		assert.ok(result.result.stdout.includes("run-ok-output"));
		const job = JSON.parse(readFileSync(join(DIR, "ok.json"), "utf-8"));
		assert.strictEqual(job.lastStatus, "success");
		assert.strictEqual(job.lastExitCode, 0);
		assert.ok(job.lastRun);
	});

	it("reports failure and records the exit code", async () => {
		await create({ name: "bad", command: "exit 3" });
		const result = await cronJobImpl({ action: "run", name: "bad" }, opts());
		assert.strictEqual(result.ok, false);
		assert.ok(result.error.includes("code 3"));
		const job = JSON.parse(readFileSync(join(DIR, "bad.json"), "utf-8"));
		assert.strictEqual(job.lastStatus, "failure");
		assert.strictEqual(job.lastExitCode, 3);
	});

	it("works for command-only jobs (no skill)", async () => {
		await cronJobImpl(
			{ action: "create", name: "cmd-only", cron: "0 0 * * *", command: "echo hi" },
			opts(),
		);
		const result = await cronJobImpl({ action: "run", name: "cmd-only" }, opts());
		assert.strictEqual(result.ok, true);
	});

	it("times out and kills a hung command", async () => {
		await create({ name: "hang", command: "sleep 30" });
		const started = Date.now();
		const result = await cronJobImpl({ action: "run", name: "hang" }, opts({ runTimeout: 200 }));
		assert.strictEqual(result.ok, false);
		assert.ok(result.error.includes("timed out"));
		assert.ok(Date.now() - started < 5000);
		const job = JSON.parse(readFileSync(join(DIR, "hang.json"), "utf-8"));
		assert.strictEqual(job.lastStatus, "timeout");
	});

	it("refuses to run a paused job", async () => {
		await create({ name: "paused", command: "echo x" });
		await cronJobImpl({ action: "pause", name: "paused" }, opts());
		const result = await cronJobImpl({ action: "run", name: "paused" }, opts());
		assert.strictEqual(result.ok, false);
		assert.ok(result.error.includes("paused"));
	});
});

describe("runScript hardening", () => {
	it("reports a signal-killed process as a failure, not success", async () => {
		const result = await runScript("/bin/sh", ["-c", "kill -9 $$"], { timeout: 5000 });
		assert.notStrictEqual(result.exitCode, 0);
	});

	it("escalates to SIGKILL for a process that ignores SIGTERM", async () => {
		const started = Date.now();
		const result = await runScript(
			"/bin/sh",
			["-c", "trap '' TERM; while true; do sleep 1; done"],
			{ timeout: 200 },
		);
		assert.strictEqual(result.timedOut, true);
		assert.ok(Date.now() - started < 8000);
	});

	it("surfaces the spawn error message", async () => {
		const result = await runScript("/nonexistent/binary", [], { timeout: 2000 });
		assert.strictEqual(result.exitCode, -1);
		assert.ok(result.error?.includes("ENOENT"));
	});

	it("caps collected output", async () => {
		const result = await runScript("/bin/sh", ["-c", "head -c 3000000 /dev/zero | tr '\\0' x"], {
			timeout: 10000,
		});
		assert.ok(result.stdout.length <= 1024 * 1024);
	});
});
