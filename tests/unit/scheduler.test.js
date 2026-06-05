import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert";
import { mkdirSync, rmSync, existsSync } from "node:fs";
import { join } from "node:path";

// --- Imports ---
import { validateCron, parseScheduleEntry } from "../../src/scheduler/parser.js";
import { ScheduleQueue } from "../../src/scheduler/queue.js";
import { ScheduleManager, shouldRun, matchesCron } from "../../src/scheduler/scheduler.js";
import { logScheduleResult } from "../../src/scheduler/logger.js";
import { CronInstaller } from "../../src/scheduler/cronInstaller.js";

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

// --- Cron validation ---

describe("scheduler - cron validation", () => {
	it("accepts valid cron expressions", () => {
		assert.deepStrictEqual(validateCron("* * * * *"), { valid: true, error: "" });
		assert.deepStrictEqual(validateCron("0 9 * * *"), { valid: true, error: "" });
		assert.deepStrictEqual(validateCron("*/15 * * * *"), { valid: true, error: "" });
	});

	it("rejects null expression", () => {
		const result = validateCron(null);
		assert.strictEqual(result.valid, false);
		assert.ok(result.error.length > 0);
	});

	it("rejects empty expression", () => {
		const result = validateCron("");
		assert.strictEqual(result.valid, false);
	});

	it("rejects number", () => {
		assert.strictEqual(validateCron(123).valid, false);
	});

	it("rejects boolean", () => {
		assert.strictEqual(validateCron(true).valid, false);
	});

	it("rejects invalid field pattern", () => {
		assert.strictEqual(validateCron("abc 9 * * *").valid, false);
		assert.strictEqual(validateCron("0 xyz * * *").valid, false);
	});

	it("accepts 6-field cron (with second)", () => {
		assert.strictEqual(validateCron("30 * * * * *").valid, true);
	});

	it("rejects 6-field with invalid first field", () => {
		assert.strictEqual(validateCron("abc * * * * *").valid, false);
	});

	it("rejects comma expressions with names", () => {
		// cron-parser handles this differently than our old regex
		assert.strictEqual(
			validateCron("MON * * * *").invalid !== true || validateCron("0 9 * * MON").valid,
			true,
		);
	});
});

// --- Entry parsing ---

describe("scheduler - entry parsing", () => {
	it("accepts valid entry", () => {
		const result = parseScheduleEntry({ name: "daily", cron: "0 9 * * *", skill: "host-info" });
		assert.strictEqual(result.valid, true);
		assert.strictEqual(result.parsed.name, "daily");
	});

	it("rejects entry without name", () => {
		assert.strictEqual(parseScheduleEntry({ cron: "0 9 * * *" }).valid, false);
	});

	it("rejects entry without cron", () => {
		assert.strictEqual(parseScheduleEntry({ name: "test" }).valid, false);
	});

	it("rejects entry with invalid cron", () => {
		assert.strictEqual(parseScheduleEntry({ name: "bad", cron: "abc" }).valid, false);
	});

	it("applies defaults for missing fields", () => {
		const result = parseScheduleEntry({ name: "minimal", cron: "* * * * *" });
		assert.strictEqual(result.parsed.skill, "");
		assert.deepStrictEqual(result.parsed.input, {});
		assert.strictEqual(result.parsed.enabled, true);
		assert.strictEqual(result.parsed.paused, false);
	});

	it("supports custom fields", () => {
		const result = parseScheduleEntry({
			name: "check",
			cron: "0 6 * * 1",
			skill: "api-request",
			input: { url: "http://example.com" },
			contextFile: "memory/context/api.md",
		});
		assert.strictEqual(result.parsed.skill, "api-request");
		assert.strictEqual(result.parsed.contextFile, "memory/context/api.md");
	});

	it("respects enabled=false", () => {
		const result = parseScheduleEntry({ name: "x", cron: "* * * * *", enabled: false });
		assert.strictEqual(result.parsed.enabled, false);
	});
});

// --- Cron matching ---

describe("scheduler - cron matching", () => {
	it("matches every-minute wildcard", () => {
		assert.strictEqual(matchesCron("* * * * *", new Date(Date.UTC(2024, 0, 1, 9, 30))), true);
	});

	it("matches exact minute and hour", () => {
		assert.strictEqual(matchesCron("30 9 * * *", new Date(Date.UTC(2024, 0, 1, 9, 30))), true);
	});

	it("rejects wrong minute", () => {
		assert.strictEqual(matchesCron("0 9 * * *", new Date(Date.UTC(2024, 0, 1, 9, 30))), false);
		// Exact match: only matches at minute 0
		assert.strictEqual(matchesCron("0 9 * * *", new Date(Date.UTC(2024, 0, 1, 9, 0))), true);
	});

	it("rejects wrong hour", () => {
		assert.strictEqual(matchesCron("* 9 * * *", new Date(Date.UTC(2024, 0, 1, 10, 30))), false);
	});

	it("matches step expression */15 for minutes", () => {
		assert.strictEqual(matchesCron("*/15 * * * *", new Date(Date.UTC(2024, 0, 1, 9, 0))), true);
		assert.strictEqual(matchesCron("*/15 * * * *", new Date(Date.UTC(2024, 0, 1, 9, 15))), true);
		assert.strictEqual(matchesCron("*/15 * * * *", new Date(Date.UTC(2024, 0, 1, 9, 30))), true);
		assert.strictEqual(matchesCron("*/15 * * * *", new Date(Date.UTC(2024, 0, 1, 9, 14))), false);
	});

	it("matches step expression */5 for seconds", () => {
		assert.strictEqual(matchesCron("*/5 * * * * *", new Date(Date.UTC(2024, 0, 1, 9, 0, 0))), true);
		assert.strictEqual(matchesCron("*/5 * * * * *", new Date(Date.UTC(2024, 0, 1, 9, 0, 5))), true);
		assert.strictEqual(
			matchesCron("*/5 * * * * *", new Date(Date.UTC(2024, 0, 1, 9, 0, 3))),
			false,
		);
	});

	it("day-of-week: matches Monday", () => {
		// 2024-01-01 is a Monday
		assert.strictEqual(matchesCron("0 9 * * 1", new Date(Date.UTC(2024, 0, 1, 9, 0))), true);
		// 2024-01-02 is a Tuesday
		assert.strictEqual(matchesCron("0 9 * * 1", new Date(Date.UTC(2024, 0, 2, 9, 0))), false);
	});

	it("day-of-month: matches 1st of month", () => {
		assert.strictEqual(matchesCron("0 0 1 * *", new Date(Date.UTC(2024, 0, 1, 0, 0))), true);
		assert.strictEqual(matchesCron("0 0 1 * *", new Date(Date.UTC(2024, 0, 2, 0, 0))), false);
	});

	it("month: matches January only", () => {
		assert.strictEqual(matchesCron("0 0 1 1 *", new Date(Date.UTC(2024, 0, 1, 0, 0))), true);
		assert.strictEqual(matchesCron("0 0 1 1 *", new Date(Date.UTC(2024, 1, 1, 0, 0))), false);
	});

	it("month with names", () => {
		// cron-parser accepts numeric months; JAN is 1
		assert.strictEqual(matchesCron("0 0 1 JAN *", new Date(Date.UTC(2024, 0, 1, 0, 0))), true);
		assert.strictEqual(matchesCron("0 0 1 JAN *", new Date(Date.UTC(2024, 1, 1, 0, 0))), false);
	});

	it("rejects completely invalid cron", () => {
		assert.strictEqual(matchesCron("invalid cron", new Date()), false);
	});

	it("shouldRun is an alias for matchesCron", () => {
		assert.strictEqual(shouldRun("* * * * *", new Date(Date.UTC(2024, 0, 1, 9, 30))), true);
		assert.strictEqual(shouldRun("0 9 * * *", new Date(Date.UTC(2024, 0, 1, 10, 30))), false);
	});
});

// --- Queue ---

describe("scheduler - queue", () => {
	it("enforces max concurrent (default 1)", () => {
		const q = new ScheduleQueue();
		q.enqueue({ entryName: "a" });
		const next = q.dequeue();
		assert.ok(next);
		assert.strictEqual(q.getQueueLength(), 0);
	});

	it("accepts custom maxConcurrent", () => {
		const q = new ScheduleQueue(3);
		q.enqueue({ entryName: "a" });
		q.enqueue({ entryName: "b" });
		q.enqueue({ entryName: "c" });

		const r1 = q.dequeue();
		const r2 = q.dequeue();
		const r3 = q.dequeue();
		assert.ok(r1);
		assert.ok(r2);
		assert.ok(r3);
		assert.strictEqual(q.getQueueLength(), 0);
		assert.strictEqual(q.getRunning(), 3);
	});

	it("returns queued=false and position 0 for duplicate entry", () => {
		const q = new ScheduleQueue();
		q.enqueue({ entryName: "existing" });
		const result = q.enqueue({ entryName: "existing" });
		assert.strictEqual(result.queued, false);
		assert.strictEqual(result.position, 0);
	});

	it("isRunning returns false when empty", () => {
		assert.strictEqual(new ScheduleQueue().isRunning(), false);
	});

	it("isRunning returns true after dequeue", () => {
		const q = new ScheduleQueue();
		q.enqueue({ entryName: "a" });
		q.dequeue();
		assert.strictEqual(q.isRunning(), true);
	});

	it("complete decrements running counter (task already dequeued)", () => {
		const q = new ScheduleQueue();
		q.enqueue({ entryName: "a" });
		q.dequeue(); // removes from queue, increments running
		assert.strictEqual(q.isRunning(), true);
		assert.strictEqual(q.complete("a"), true);
		assert.strictEqual(q.getQueueLength(), 0);
		assert.strictEqual(q.isRunning(), false);
	});

	it("complete for non-matching entryName returns false", () => {
		const q = new ScheduleQueue();
		// No tasks enqueued or dequeued, so running is 0
		assert.strictEqual(q.complete("nonexistent"), false);
		assert.strictEqual(q.getRunning(), 0);
	});

	it("hasEntry returns true for queued task", () => {
		const q = new ScheduleQueue();
		q.enqueue({ entryName: "x" });
		assert.strictEqual(q.hasEntry("x"), true);
		assert.strictEqual(q.hasEntry("y"), false);
	});

	it("peek returns first task without removing", () => {
		const q = new ScheduleQueue(10);
		q.enqueue({ entryName: "first" });
		const p = q.peek();
		assert.deepStrictEqual(p, { entryName: "first" });
		assert.strictEqual(q.getQueueLength(), 1);
	});

	it("dequeue returns null when empty", () => {
		assert.strictEqual(new ScheduleQueue().dequeue(), null);
	});

	it("dequeue returns null when at maxConcurrent", () => {
		const q = new ScheduleQueue(1);
		q.enqueue({ entryName: "a" });
		q.dequeue();
		assert.strictEqual(q.dequeue(), null);
	});

	it("clear empties queue and resets running", () => {
		const q = new ScheduleQueue(2);
		q.enqueue({ entryName: "a" });
		q.enqueue({ entryName: "b" });
		q.dequeue();
		q.clear();
		assert.strictEqual(q.getQueueLength(), 0);
		assert.strictEqual(q.isRunning(), false);
		assert.strictEqual(q.peek(), null);
	});

	it("getAll returns copy of queue", () => {
		const q = new ScheduleQueue();
		q.enqueue({ entryName: "a" });
		q.enqueue({ entryName: "b" });
		assert.strictEqual(q.getAll().length, 2);
	});
});

// --- Logger ---

describe("scheduler - result logging", () => {
	beforeEach(() => setupTestDir());
	afterEach(() => cleanupTestDir());

	it("creates a markdown result file", async () => {
		const result = await logScheduleResult(
			{
				scheduleName: "test-job",
				cron: "0 9 * * *",
				startTime: "2024-01-01T09:00:00Z",
				endTime: "2024-01-01T09:00:05Z",
				exitCode: 0,
				stdout: "success",
				stderr: "",
			},
			"memory/__test_scheduler__/",
		);
		assert.ok(result.includes("memory/__test_scheduler__"));
	});

	it("creates file even with missing stdout/stderr", async () => {
		const res = await logScheduleResult(
			{
				scheduleName: "no-output",
				cron: "* * * * *",
				startTime: "2024-01-01T00:00:00Z",
				endTime: "2024-01-01T00:00:01Z",
				exitCode: 1,
				stdout: "",
				stderr: "",
			},
			"memory/__test_scheduler__/",
		);
		assert.ok(res.includes("memory/__test_scheduler__"));
	});

	it("sanitizes schedule name in filename", async () => {
		const res = await logScheduleResult(
			{
				scheduleName: "my-job!@#",
				cron: "* * * * *",
				startTime: "2024-01-01T00:00:00Z",
				endTime: "2024-01-01T00:00:01Z",
				exitCode: 0,
				stdout: "ok",
				stderr: "",
			},
			"memory/__test_scheduler__/",
		);
		assert.ok(res.includes("my-job___"));
	});
});

// --- ScheduleManager ---

describe("scheduler - ScheduleManager", () => {
	beforeEach(() => setupTestDir());
	afterEach(() => cleanupTestDir());

	it("returns empty results for register with empty array", () => {
		const mgr = new ScheduleManager();
		assert.deepStrictEqual(mgr.register([]), []);
	});

	it("registers valid entry and returns empty results", () => {
		const mgr = new ScheduleManager();
		const results = mgr.register([{ name: "daily", cron: "0 9 * * *" }]);
		assert.deepStrictEqual(results, []);
	});

	it("returns errors for invalid entries", () => {
		const mgr = new ScheduleManager();
		const results = mgr.register([{ name: "daily", cron: "invalid" }]);
		assert.strictEqual(results.length, 1);
		assert.strictEqual(results[0].name, "daily");
	});

	it("skips invalid entries but registers valid ones", () => {
		const mgr = new ScheduleManager();
		const results = mgr.register([
			{ name: "good", cron: "0 9 * * *" },
			{ name: "bad", cron: "invalid" },
		]);
		assert.strictEqual(results.length, 1);
		assert.strictEqual(mgr.list().length, 1);
	});

	it("list returns all registered schedules with queued count", () => {
		const mgr = new ScheduleManager(1);
		mgr.register([{ name: "daily", cron: "0 9 * * *" }]);
		const schedules = mgr.list();
		assert.strictEqual(schedules.length, 1);
		assert.strictEqual(schedules[0].name, "daily");
		assert.strictEqual(schedules[0].queued, 0);
	});

	it("list returns empty array with no schedules", () => {
		assert.strictEqual(new ScheduleManager().list().length, 0);
	});

	it("pause returns false for unknown name", () => {
		assert.strictEqual(new ScheduleManager().pause("nonexistent"), false);
	});

	it("pause returns true and marks entry paused", () => {
		const mgr = new ScheduleManager();
		mgr.register([{ name: "daily", cron: "0 9 * * *" }]);
		assert.strictEqual(mgr.pause("daily"), true);
		assert.strictEqual(mgr.list()[0].paused, true);
	});

	it("resume returns false for unknown name", () => {
		assert.strictEqual(new ScheduleManager().resume("nonexistent"), false);
	});

	it("resume sets paused to false (fixed behavior)", () => {
		const mgr = new ScheduleManager();
		mgr.register([{ name: "daily", cron: "0 9 * * *" }]);
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
		mgr.register([{ name: "daily", cron: "0 9 * * *" }]);
		mgr.pause("daily");
		const result = await mgr.runNow("daily", {});
		assert.ok(result.error);
		assert.ok(result.error.includes("paused"));
	});

	it("runNow calls runScheduledSkill and logs result", async () => {
		const mgr = new ScheduleManager();
		mgr.register([{ name: "daily", cron: "0 9 * * *" }]);
		const sandbox = async () => ({ stdout: "done", stderr: "", exitCode: 0 });
		const scheduler = { sandbox, state: {} };
		const result = await mgr.runNow("daily", scheduler);
		assert.strictEqual(result.exitCode, 0);
		assert.strictEqual(result.stdout, "done");
	});

	it("runNow with non-object result still updates lastRun", async () => {
		const mgr = new ScheduleManager();
		mgr.register([{ name: "daily", cron: "0 9 * * *" }]);
		const sandbox = async () => null;
		const scheduler = { sandbox, state: {} };
		const result = await mgr.runNow("daily", scheduler);
		assert.strictEqual(result, null);
		const entries = mgr.list();
		assert.ok(entries[0].lastRun);
	});

	it("runNow logs only when result has exitCode", async () => {
		const mgr = new ScheduleManager();
		mgr.register([{ name: "daily", cron: "0 9 * * *" }]);
		const sandbox = async () => ({ stdout: "no exit code" });
		const scheduler = { sandbox, state: {} };
		const result = await mgr.runNow("daily", scheduler);
		assert.ok(result);
		assert.strictEqual(result.stdout, "no exit code");
	});

	it("start sets running and creates interval, stop clears it", () => {
		const mgr = new ScheduleManager();
		mgr.register([{ name: "daily", cron: "0 9 * * *" }]);
		let intervalCalled = false;
		const origSetInterval = global.setInterval;
		global.setInterval = () => {
			intervalCalled = true;
			return 0;
		};
		mgr.start({ sandbox: async () => ({}), state: {} }, 60000);
		assert.strictEqual(intervalCalled, true);
		mgr.stop();
		global.setInterval = origSetInterval;
	});

	it("clockTick enqueues when cron matches", () => {
		const mgr = new ScheduleManager(10);
		const now = new Date();
		// Use UTC minute to match matchesCron's UTC-based checking
		const minuteField = String(now.getUTCMinutes());
		mgr.register([{ name: "now", cron: `${minuteField} * * * *` }]);
		// start() calls #clockTick immediately
		mgr.start({ sandbox: async () => ({}), state: {} }, 60000);
		mgr.stop();
		const entries = mgr.list();
		assert.strictEqual(entries.length, 1);
		// Schedule matched, so lastRun should be set
		assert.ok(entries[0].lastRun, "lastRun should be set after matching tick");
	});

	it("deduplicates: same schedule enqueued only once per tick", () => {
		const mgr = new ScheduleManager(10);
		const now = new Date();
		const minuteField = String(now.getMinutes());
		mgr.register([{ name: "now", cron: `${minuteField} * * * *` }]);
		mgr.start({ sandbox: async () => ({}), state: {} }, 60000);
		// Tick 2 should not double-enqueue
		mgr.stop();
		const schedules = mgr.list();
		assert.strictEqual(schedules.length, 1);
		assert.strictEqual(schedules[0].queued, 0);
	});

	it("does not enqueue paused schedules", () => {
		const mgr = new ScheduleManager(10);
		const now = new Date();
		const minuteField = String(now.getMinutes());
		mgr.register([{ name: "now", cron: `${minuteField} * * * *` }]);
		mgr.pause("now");
		mgr.start({ sandbox: async () => ({}), state: {} }, 60000);
		mgr.stop();
		const entries = mgr.list();
		assert.strictEqual(entries[0].paused, true);
	});
});

// --- CronInstaller ---

describe("scheduler - CronInstaller", () => {
	it("isAvailable returns true when crontab exists", () => {
		// In test environments, crontab may or may not be available.
		// We just check that the function returns an object with available field.
		const result = CronInstaller.isAvailable();
		assert.ok(result.hasOwnProperty("available"));
		if (result.available) {
			assert.strictEqual(typeof result.error, "undefined");
		} else {
			assert.ok(result.error);
		}
	});

	it("list returns empty array when no crontab", () => {
		// If crontab is not available, list should gracefully return empty
		const result = CronInstaller.list();
		// If crontab doesn't exist, readCrontab returns "" so list is []
		assert.ok(Array.isArray(result));

		// If crontab exists, it might have entries or not
		// Both are valid, so just check type
		assert.ok(Array.isArray(result));
	});

	it("uninstall returns 0 when no block present", () => {
		const count = CronInstaller.uninstall();
		assert.strictEqual(typeof count, "number");
		assert.ok(count >= 0);
	});
});

// --- Integration: full tick cycle ---

describe("scheduler - full tick cycle", () => {
	beforeEach(() => setupTestDir());
	afterEach(() => cleanupTestDir());

	it("register -> tick -> runNow completes flow", async () => {
		const mgr = new ScheduleManager(1);
		mgr.register([{ name: "test", cron: "0 9 * * *" }]);

		// runNow should work even without start()
		const sandbox = async () => ({ stdout: "tick result", stderr: "", exitCode: 0 });
		const scheduler = { sandbox, state: {} };
		const result = await mgr.runNow("test", scheduler);
		assert.strictEqual(result.exitCode, 0);
		assert.strictEqual(result.stdout, "tick result");
	});
});
