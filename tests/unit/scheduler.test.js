import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert";
import { mkdirSync, rmSync, existsSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { ScheduleManager } from "../../src/scheduler/index.js";
import { sanitizeCrontabCommand, buildSkillCommand } from "../../src/scheduler/cron.js";

// --- Helpers ---

function randomSuffix() {
	return Math.random().toString(36).slice(2, 8);
}

function makeTempDir(prefix = "scheduler-test-") {
	const dir = join(tmpdir(), prefix + randomSuffix());
	mkdirSync(dir, { recursive: true });
	return dir;
}

function removeDir(dir) {
	if (existsSync(dir)) {
		rmSync(dir, { recursive: true, force: true });
	}
}

// --- ScheduleManager CRUD ---

describe("scheduler - ScheduleManager", () => {
	it("returns empty results for register with empty array", () => {
		const mgr = new ScheduleManager();
		assert.deepStrictEqual(mgr.register([]), []);
	});

	it("registers valid entries and returns empty results", () => {
		const mgr = new ScheduleManager();
		const results = mgr.register([{ name: "daily", cron: "0 9 * * *", skill: "host-info" }]);
		assert.deepStrictEqual(results, []);
	});

	it("returns errors for entries missing required fields", () => {
		const mgr = new ScheduleManager();
		const results = mgr.register([{ name: "daily", cron: "0 9 * * *" }]);
		assert.strictEqual(results.length, 1);
		assert.strictEqual(results[0].name, "daily");
	});

	it("skips invalid entries but registers valid ones", () => {
		const mgr = new ScheduleManager();
		const results = mgr.register([
			{ name: "good", cron: "0 9 * * *", skill: "host-info" },
			{ name: "bad", cron: "invalid" },
		]);
		assert.strictEqual(results.length, 1);
		assert.strictEqual(mgr.list().length, 1);
	});

	it("list returns all registered schedules", () => {
		const mgr = new ScheduleManager();
		mgr.register([{ name: "daily", cron: "0 9 * * *", skill: "host-info" }]);
		const schedules = mgr.list();
		assert.strictEqual(schedules.length, 1);
		assert.strictEqual(schedules[0].name, "daily");
	});

	it("list returns empty array with no schedules", () => {
		assert.strictEqual(new ScheduleManager().list().length, 0);
	});

	it("pause returns false for unknown name", () => {
		assert.strictEqual(new ScheduleManager().pause("nonexistent"), false);
	});

	it("pause returns true and marks entry paused", () => {
		const mgr = new ScheduleManager();
		mgr.register([{ name: "daily", cron: "0 9 * * *", skill: "host-info" }]);
		assert.strictEqual(mgr.pause("daily"), true);
		assert.strictEqual(mgr.list()[0].paused, true);
	});

	it("resume returns false for unknown name", () => {
		assert.strictEqual(new ScheduleManager().resume("nonexistent"), false);
	});

	it("resume sets paused to false", () => {
		const mgr = new ScheduleManager();
		mgr.register([{ name: "daily", cron: "0 9 * * *", skill: "host-info" }]);
		mgr.pause("daily");
		assert.strictEqual(mgr.resume("daily"), true);
		assert.strictEqual(mgr.list()[0].paused, false);
	});

	it("no longer exposes runNow (removed; the cronJob tool runs jobs)", () => {
		assert.strictEqual(typeof new ScheduleManager().runNow, "undefined");
	});
});

// --- ScheduleManager loadFromDisk ---

describe("scheduler - ScheduleManager.loadFromDisk", () => {
	let testDir;

	beforeEach(() => {
		testDir = makeTempDir("scheduler-load-");
	});
	afterEach(() => {
		removeDir(testDir);
	});

	it("returns empty manager when directory is empty", async () => {
		const mgr = await ScheduleManager.loadFromDisk(testDir);
		assert.deepStrictEqual(mgr.list(), []);
	});

	it("loads valid schedule entries from JSON files", async () => {
		writeFileSync(
			join(testDir, "test-job.json"),
			JSON.stringify({ name: "test-job", cron: "0 * * * *", command: "echo hello", enabled: true }),
		);
		const mgr = await ScheduleManager.loadFromDisk(testDir);
		const schedules = mgr.list();
		assert.strictEqual(schedules.length, 1);
		assert.strictEqual(schedules[0].name, "test-job");
		assert.strictEqual(schedules[0].cron, "0 * * * *");
		assert.strictEqual(schedules[0].command, "echo hello");
		assert.strictEqual(schedules[0].paused, false);
	});

	it("skips entries with enabled: false", async () => {
		writeFileSync(
			join(testDir, "paused-job.json"),
			JSON.stringify({
				name: "paused-job",
				cron: "0 * * * *",
				command: "echo hello",
				enabled: false,
			}),
		);
		const mgr = await ScheduleManager.loadFromDisk(testDir);
		assert.strictEqual(mgr.list().length, 0);
	});

	it("skips entries missing name", async () => {
		writeFileSync(
			join(testDir, "no-name.json"),
			JSON.stringify({ cron: "0 * * * *", command: "echo hello" }),
		);
		const mgr = await ScheduleManager.loadFromDisk(testDir);
		assert.strictEqual(mgr.list().length, 0);
	});

	it("skips entries missing cron", async () => {
		writeFileSync(
			join(testDir, "no-cron.json"),
			JSON.stringify({ name: "no-cron-job", command: "echo hello" }),
		);
		const mgr = await ScheduleManager.loadFromDisk(testDir);
		assert.strictEqual(mgr.list().length, 0);
	});

	it("skips entries missing both skill and command", async () => {
		writeFileSync(
			join(testDir, "no-skill.json"),
			JSON.stringify({ name: "no-skill-job", cron: "0 * * * *" }),
		);
		const mgr = await ScheduleManager.loadFromDisk(testDir);
		assert.strictEqual(mgr.list().length, 0);
	});

	it("skips non-json files", async () => {
		writeFileSync(join(testDir, "readme.txt"), "not a job");
		writeFileSync(
			join(testDir, "real-job.json"),
			JSON.stringify({ name: "real-job", cron: "0 * * * *", command: "echo real" }),
		);
		const mgr = await ScheduleManager.loadFromDisk(testDir);
		const schedules = mgr.list();
		assert.strictEqual(schedules.length, 1);
	});

	it("handles malformed JSON gracefully", async () => {
		writeFileSync(
			join(testDir, "good.json"),
			JSON.stringify({ name: "good", cron: "0 * * * *", command: "echo good" }),
		);
		writeFileSync(join(testDir, "bad.json"), "{ not valid json }");
		const mgr = await ScheduleManager.loadFromDisk(testDir);
		const schedules = mgr.list();
		assert.strictEqual(schedules.length, 1);
		assert.strictEqual(schedules[0].name, "good");
	});

	it("sets skill and command when job has skill field", async () => {
		writeFileSync(
			join(testDir, "skill-job.json"),
			JSON.stringify({ name: "skill-job", cron: "0 * * * *", skill: "test-skill", enabled: true }),
		);
		const mgr = await ScheduleManager.loadFromDisk(testDir);
		const schedules = mgr.list();
		assert.strictEqual(schedules.length, 1);
		assert.strictEqual(schedules[0].skill, "test-skill");
		assert.ok(schedules[0].command.includes("index.js"));
		assert.ok(schedules[0].command.includes("test-skill"));
	});

	it("builds the skill command with buildSkillCommand (escaped, includes input)", async () => {
		const input = { q: 'a"b$c' };
		writeFileSync(
			join(testDir, "esc-job.json"),
			JSON.stringify({ name: "esc-job", cron: "0 * * * *", skill: 'x"y', input }),
		);
		const mgr = await ScheduleManager.loadFromDisk(testDir);
		assert.strictEqual(mgr.list()[0].command, buildSkillCommand('x"y', input));
		assert.ok(mgr.list()[0].command.includes('x\\"y'));
	});

	it("builds the skill command with buildSkillCommand (escaped, includes input)", async () => {
		const input = { q: 'a"b$c' };
		writeFileSync(
			join(testDir, "esc-job.json"),
			JSON.stringify({ name: "esc-job", cron: "0 * * * *", skill: 'x"y', input }),
		);
		const mgr = await ScheduleManager.loadFromDisk(testDir);
		assert.strictEqual(mgr.list()[0].command, buildSkillCommand('x"y', input));
		assert.ok(mgr.list()[0].command.includes('x\\"y'));
	});

	it("builds the skill command with buildSkillCommand (escaped, includes input)", async () => {
		const input = { q: 'a"b$c' };
		writeFileSync(
			join(testDir, "esc-job.json"),
			JSON.stringify({ name: "esc-job", cron: "0 * * * *", skill: 'x"y', input }),
		);
		const mgr = await ScheduleManager.loadFromDisk(testDir);
		assert.strictEqual(mgr.list()[0].command, buildSkillCommand('x"y', input));
		assert.ok(mgr.list()[0].command.includes('x\\"y'));
	});

	it("returns empty manager for nonexistent directory", async () => {
		const mgr = await ScheduleManager.loadFromDisk(
			join(tmpdir(), "scheduler-nonexistent-" + randomSuffix()),
		);
		assert.deepStrictEqual(mgr.list(), []);
	});

	it("sets default input and contextFile on loaded entries", async () => {
		writeFileSync(
			join(testDir, "input-job.json"),
			JSON.stringify({ name: "input-job", cron: "0 * * * *", command: "echo test" }),
		);
		const mgr = await ScheduleManager.loadFromDisk(testDir);
		const schedules = mgr.list();
		assert.deepStrictEqual(schedules[0].input, {});
		assert.strictEqual(schedules[0].contextFile, "");
	});

	it("passes custom input through to loaded entries", async () => {
		writeFileSync(
			join(testDir, "input-job.json"),
			JSON.stringify({
				name: "input-job",
				cron: "0 * * * *",
				command: "echo test",
				input: { key: "val" },
			}),
		);
		const mgr = await ScheduleManager.loadFromDisk(testDir);
		assert.deepStrictEqual(mgr.list()[0].input, { key: "val" });
	});
});

// --- ScheduleManager register with command ---

describe("scheduler - ScheduleManager.register with command", () => {
	it("accepts entries with command instead of skill", () => {
		const mgr = new ScheduleManager();
		const results = mgr.register([{ name: "cmd-entry", cron: "0 * * * *", command: "echo hello" }]);
		assert.deepStrictEqual(results, []);
		assert.strictEqual(mgr.list().length, 1);
		assert.strictEqual(mgr.list()[0].command, "echo hello");
	});

	it("returns error for entries missing both skill and command", () => {
		const mgr = new ScheduleManager();
		const results = mgr.register([{ name: "bad", cron: "0 * * *" }]);
		assert.strictEqual(results.length, 1);
		assert.ok(results[0].error.includes("skill or command"));
	});

	it("sets default input and contextFile on registered entries", () => {
		const mgr = new ScheduleManager();
		mgr.register([{ name: "entry", cron: "0 * * * *", command: "echo x" }]);
		const schedules = mgr.list();
		assert.deepStrictEqual(schedules[0].input, {});
		assert.strictEqual(schedules[0].contextFile, "");
	});

	it("does not overwrite input if provided", () => {
		const mgr = new ScheduleManager();
		mgr.register([{ name: "entry", cron: "0 * * * *", command: "echo x", input: { foo: "bar" } }]);
		const schedules = mgr.list();
		assert.deepStrictEqual(schedules[0].input, { foo: "bar" });
	});

	it("sets contextFile if provided", () => {
		const mgr = new ScheduleManager();
		mgr.register([
			{ name: "entry", cron: "0 * * * *", command: "echo x", contextFile: "/path/to/file" },
		]);
		const schedules = mgr.list();
		assert.strictEqual(schedules[0].contextFile, "/path/to/file");
	});

	it("sets paused: false and lastRun: null on constructor entries", () => {
		const mgr = new ScheduleManager();
		mgr.register([{ name: "entry", cron: "0 * * * *", command: "echo x" }]);
		const entry = mgr.list()[0];
		assert.strictEqual(entry.paused, false);
		assert.strictEqual(entry.lastRun, null);
	});
});

// --- sanitizeCrontabCommand ---

describe("sanitizeCrontabCommand", () => {
	it("normal commands pass through unchanged", () => {
		const result = sanitizeCrontabCommand("node index.js --chat /reflection");
		assert.strictEqual(result, "node index.js --chat /reflection");
	});

	it("commands with newlines, carriage returns or CRLF are rejected", () => {
		assert.throws(() => sanitizeCrontabCommand("echo hello\nworld"), /newlines/);
		assert.throws(() => sanitizeCrontabCommand("echo hello\rworld"), /newlines/);
		assert.throws(() => sanitizeCrontabCommand("echo hello\r\nworld"), /newlines/);
	});

	it("shell special characters are preserved", () => {
		const result = sanitizeCrontabCommand("echo $HOME && ls | grep test; echo `date`");
		assert.strictEqual(result, "echo $HOME && ls | grep test; echo `date`");
	});

	it("empty string returns empty string", () => {
		assert.strictEqual(sanitizeCrontabCommand(""), "");
	});

	it("whitespace-only commands are preserved as-is", () => {
		assert.strictEqual(sanitizeCrontabCommand("   "), "   ");
	});
});
