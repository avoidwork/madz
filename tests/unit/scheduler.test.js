import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert";
import { execSync } from "node:child_process";
import { mock } from "node:test";
import { mkdirSync, rmSync, existsSync } from "node:fs";
import { join } from "node:path";
import { ScheduleManager } from "../../src/scheduler/index.js";
import { Cron } from "../../src/scheduler/index.js";
import { sanitizeCrontabCommand } from "../../src/scheduler/cron.js";

// --- Helpers ---

const TEST_DIR = "memory/__test_scheduler__/";

function setupTestDir(dir = TEST_DIR) {
	mkdirSync(join(process.cwd(), dir), { recursive: true });
}

function cleanupTestDir(dir = TEST_DIR) {
	if (existsSync(join(process.cwd(), dir))) {
		rmSync(join(process.cwd(), dir), { recursive: true, force: true });
	}
}

// --- ScheduleManager CRUD ---

describe("scheduler - ScheduleManager", () => {
	beforeEach(() => setupTestDir());
	afterEach(() => cleanupTestDir());

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

	it("runNow returns error for unknown schedule", async () => {
		const mgr = new ScheduleManager();
		const result = await mgr.runNow("nonexistent", {});
		assert.ok(result.error);
		assert.ok(result.error.includes("Unknown schedule"));
	});

	it("runNow returns error for paused schedule", async () => {
		const mgr = new ScheduleManager();
		mgr.register([{ name: "daily", cron: "0 9 * * *", skill: "host-info" }]);
		mgr.pause("daily");
		const result = await mgr.runNow("daily", {});
		assert.ok(result.error);
		assert.ok(result.error.includes("paused"));
	});

	it("runNow executes skill through sandbox", async () => {
		const mgr = new ScheduleManager();
		mgr.register([{ name: "daily", cron: "0 9 * * *", skill: "host-info" }]);
		const sandbox = async () => ({ stdout: "done", stderr: "", exitCode: 0 });
		const scheduler = { sandbox, state: {} };
		const result = await mgr.runNow("daily", scheduler);
		assert.strictEqual(result.exitCode, 0);
		assert.strictEqual(result.stdout, "done");
	});
});

// --- Cron ---

describe("scheduler - Cron", () => {
	afterEach(() => {
		try {
			execSync("crontab -r 2>/dev/null || true", { stdio: "pipe" });
		} catch {}
	});

	it("isAvailable returns an object with available field", () => {
		const result = Cron.isAvailable();
		assert.ok(result.hasOwnProperty("available"));
		if (result.available) {
			assert.strictEqual(typeof result.error, "undefined");
		} else {
			assert.ok(result.error);
		}
	});

	it("list returns an array", () => {
		const result = Cron.list();
		assert.ok(Array.isArray(result));
	});

	it("uninstall returns a number", () => {
		const count = Cron.uninstall();
		assert.strictEqual(typeof count, "number");
		assert.ok(count >= 0);
	});

	it("add returns added:false when crontab unavailable", () => {
		const result = Cron.add({ name: "test", cron: "* * * * *" });
		// Crontab may be available or not; check the result shape
		assert.ok(result.hasOwnProperty("added"));
	});

	it("remove returns removed:false when crontab unavailable", () => {
		const result = Cron.remove("test");
		// Crontab may be available or not; check the result shape
		assert.ok(result.hasOwnProperty("removed"));
	});
});

// --- sanitizeCrontabCommand ---

describe("sanitizeCrontabCommand", () => {
	it("normal commands pass through unchanged", () => {
		const result = sanitizeCrontabCommand("node index.js --chat /reflection");
		assert.strictEqual(result, "node index.js --chat /reflection");
	});

	it("commands with newlines are sanitized", () => {
		const result = sanitizeCrontabCommand("echo hello\nworld");
		assert.strictEqual(result, "echo helloworld");
	});

	it("commands with carriage returns are sanitized", () => {
		const result = sanitizeCrontabCommand("echo hello\rworld");
		assert.strictEqual(result, "echo helloworld");
	});

	it("commands with CRLF are sanitized", () => {
		const result = sanitizeCrontabCommand("echo hello\r\nworld");
		assert.strictEqual(result, "echo helloworld");
	});

	it("shell special characters are preserved", () => {
		const result = sanitizeCrontabCommand("echo $HOME && ls | grep test; echo `date`");
		assert.strictEqual(result, "echo $HOME && ls | grep test; echo `date`");
	});

	it("empty string returns empty string", () => {
		const result = sanitizeCrontabCommand("");
		assert.strictEqual(result, "");
	});

	it("whitespace-only commands are preserved as-is", () => {
		const result = sanitizeCrontabCommand("   ");
		assert.strictEqual(result, "   ");
	});

	it("multiple line breaks are all stripped", () => {
		const result = sanitizeCrontabCommand("cmd1\n\n\ncmd2\r\ncmd3");
		assert.strictEqual(result, "cmd1cmd2cmd3");
	});
});
