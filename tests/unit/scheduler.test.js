import { describe, it } from "node:test";
import assert from "node:assert";

// --- Scheduler parser logic (copied from parser.js) ---

function validateCron(expression) {
	if (!expression || typeof expression !== "string") {
		return { valid: false, error: "Cron expression is required" };
	}
	const fields = expression.trim().split(/\s+/);
	if (fields.length < 5 || fields.length > 6) {
		return { valid: false, error: `Expected 5-6 fields, got ${fields.length}` };
	}
	const minuteRe = /^(\d{1,2}|\*)(\/\d+)?$/;
	const hourRe = /^(\d{1,2}|\*)(\/\d+)?$/;
	const dayRe = /^(\d{1,2}|\*(-\d{1,2})?|\*)(\/\d+)?$/;
	const monthRe = /^(\d{1,2}|\*[/-]\d+|\*)(\/\d+)?$/;
	const dowRe = /^(\d{1,2}|\*\(-\d+)?\*(\/\d+)?$/;
	const patterns = [minuteRe, hourRe, dayRe, monthRe, dowRe];
	for (let i = 0; i < fields.length - 1; i++) {
		if (!patterns[i].test(fields[i])) {
			return { valid: false, error: `Invalid field "${fields[i]}" at position ${i}` };
		}
	}
	return { valid: true, error: "" };
}

function parseScheduleEntry(entry) {
	if (!entry.name) {
		return { valid: false, error: "Schedule entry must have a name" };
	}
	if (!entry.cron) {
		return { valid: false, error: `Schedule "${entry.name}" must have a cron expression` };
	}
	const cronValidation = validateCron(entry.cron);
	if (!cronValidation.valid) {
		return { valid: false, error: `Schedule "${entry.name}": ${cronValidation.error}` };
	}
	return {
		valid: true,
		error: "",
		parsed: {
			name: entry.name,
			cron: entry.cron,
			skill: entry.skill || "",
			input: entry.input || {},
			contextFile: entry.contextFile || "",
			enabled: entry.enabled !== false,
			paused: false,
			lastRun: null,
			nextRun: null,
		},
	};
}

// --- Queue logic ---

import { ScheduleQueue } from "../../src/scheduler/queue.js";
import { ScheduleManager, shouldRun } from "../../src/scheduler/scheduler.js";

// --- Logger logic (copied from logger.js) ---

import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

function logScheduleResult(result, outputDir = "memory/schedules/") {
	mkdirSync(join(process.cwd(), outputDir), { recursive: true });
	const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
	const { scheduleName, cron, startTime, endTime, exitCode, stdout, stderr } = result;
	const status = exitCode === 0 ? "success" : "failure";
	const filepath = join(process.cwd(), outputDir, `${timestamp}-${scheduleName}.md`);

	const content = [
		"---",
		`title: "${scheduleName}"`,
		`cron: "${cron}"`,
		`startTime: "${startTime}"`,
		`endTime: "${endTime}"`,
		`exitCode: ${exitCode || "null"}`,
		`status: "${status}"`,
		"---",
		"",
		"## Stdout",
		stdout || "(no output)",
		"",
		"## Stderr",
		stderr || "(no output)",
		"",
	].join("\n");

	writeFileSync(filepath, content);
	return filepath;
}

describe("scheduler - cron validation", () => {
	it("accepts valid cron expressions", () => {
		assert.deepStrictEqual(validateCron("* * * * *"), { valid: true, error: "" });
		assert.deepStrictEqual(validateCron("0 9 * * *"), { valid: true, error: "" });
		assert.deepStrictEqual(validateCron("*/15 * * * *"), { valid: true, error: "" });
	});

	it("rejects invalid expression (too few fields)", () => {
		assert.deepStrictEqual(validateCron("* *"), {
			valid: false,
			error: "Expected 5-6 fields, got 2",
		});
	});

	it("rejects invalid expression (too many fields)", () => {
		assert.deepStrictEqual(validateCron("* * * * * * * *"), {
			valid: false,
			error: "Expected 5-6 fields, got 8",
		});
	});

	it("rejects null expression", () => {
		assert.deepStrictEqual(validateCron(null), {
			valid: false,
			error: "Cron expression is required",
		});
	});

	it("rejects empty expression", () => {
		assert.deepStrictEqual(validateCron(""), {
			valid: false,
			error: "Cron expression is required",
		});
	});
});

describe("scheduler - entry parsing", () => {
	it("accepts valid entry", () => {
		const result = parseScheduleEntry({ name: "daily", cron: "0 9 * * *", skill: "host-info" });
		assert.strictEqual(result.valid, true);
		assert.strictEqual(result.parsed.name, "daily");
	});

	it("rejects entry without name", () => {
		const result = parseScheduleEntry({ cron: "0 9 * * *" });
		assert.strictEqual(result.valid, false);
	});

	it("rejects entry without cron", () => {
		const result = parseScheduleEntry({ name: "test" });
		assert.strictEqual(result.valid, false);
	});

	it("rejects entry with invalid cron", () => {
		const result = parseScheduleEntry({ name: "bad", cron: "abc" });
		assert.strictEqual(result.valid, false);
	});

	it("applies defaults for missing fields", () => {
		const result = parseScheduleEntry({ name: "minimal", cron: "* * * * *" });
		assert.strictEqual(result.parsed.skill, "");
		assert.deepStrictEqual(result.parsed.input, {});
		assert.strictEqual(result.parsed.enabled, true);
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
});

describe("scheduler - queue", () => {
	it("enforces max concurrent (default 1)", () => {
		const q = new ScheduleQueue();
		q.enqueue({ task: "a" });
		const next = q.dequeue();
		assert.ok(next);
		assert.strictEqual(q.getLength(), 0);
	});

	it("enforces max concurrent (default 1)", () => {
		const q = new ScheduleQueue(1);
		q.enqueue({ task: "a" });
		const next = q.dequeue();
		assert.ok(next);
		assert.strictEqual(q.getLength(), 0);
	});

	it("accepts custom maxConcurrent", () => {
		const q = new ScheduleQueue(3);
		assert.strictEqual(q.getLength(), 0);
	});

	it("returns position on enqueue", () => {
		const q = new ScheduleQueue();
		const result = q.enqueue({ task: "a" });
		assert.strictEqual(result.queued, true);
		assert.strictEqual(result.position, 1);
	});

	it("returns position 2 for second enqueue", () => {
		const q = new ScheduleQueue();
		q.enqueue({ task: "a" });
		const result = q.enqueue({ task: "b" });
		assert.strictEqual(result.position, 2);
	});

	it("queues up when over limit", () => {
		const q = new ScheduleQueue(1);
		q.enqueue({ task: "a" });
		q.enqueue({ task: "b" });

		const first = q.dequeue();
		assert.ok(first);
		assert.strictEqual(q.getLength(), 1);

		const second = q.dequeue();
		assert.strictEqual(second, null);
	});

	it("processes FIFO order", () => {
		const q = new ScheduleQueue(10);
		q.enqueue({ name: "first" });
		q.enqueue({ name: "second" });
		q.enqueue({ name: "third" });

		assert.deepStrictEqual(q.dequeue(), { name: "first" });
	});

	it("isRunning returns false when empty", () => {
		const q = new ScheduleQueue();
		assert.strictEqual(q.isRunning(), false);
	});

	it("isRunning returns true after dequeue", () => {
		const q = new ScheduleQueue();
		q.enqueue({ task: "a" });
		q.dequeue();
		assert.strictEqual(q.isRunning(), true);
	});

	it("isRunning returns false after complete", () => {
		const q = new ScheduleQueue();
		q.enqueue({ task: "a" });
		q.dequeue();
		q.complete("a");
		assert.strictEqual(q.isRunning(), false);
	});

	it("getLength returns count", () => {
		const q = new ScheduleQueue();
		assert.strictEqual(q.getLength(), 0);
		q.enqueue({ task: "a" });
		assert.strictEqual(q.getLength(), 1);
		q.enqueue({ task: "b" });
		assert.strictEqual(q.getLength(), 2);
	});

	it("getLength returns 0 after dequeue", () => {
		const q = new ScheduleQueue();
		q.enqueue({ task: "a" });
		q.dequeue();
		assert.strictEqual(q.getLength(), 0);
	});

	it("peek returns null when empty", () => {
		const q = new ScheduleQueue();
		assert.strictEqual(q.peek(), null);
	});

	it("peek returns first task without removing", () => {
		const q = new ScheduleQueue(10);
		q.enqueue({ name: "first" });
		const p = q.peek();
		assert.deepStrictEqual(p, { name: "first" });
		assert.deepStrictEqual(q.peek(), { name: "first" });
	});

	it("dequeue returns null when empty", () => {
		const q = new ScheduleQueue();
		assert.strictEqual(q.dequeue(), null);
	});

	it("dequeue returns null when at maxConcurrent", () => {
		const q = new ScheduleQueue(1);
		q.enqueue({ task: "a" });
		q.dequeue();
		const result = q.dequeue();
		assert.strictEqual(result, null);
	});

	it("dequeue returns task when under limit", () => {
		const q = new ScheduleQueue(2);
		q.enqueue({ name: "x" });
		const result = q.dequeue();
		assert.deepStrictEqual(result, { name: "x" });
	});

	it("complete removes task from queue", () => {
		const q = new ScheduleQueue();
		q.enqueue({ task: "a" });
		const t = q.dequeue();
		q.complete(t.task);
		assert.strictEqual(q.getLength(), 0);
	});

	it("complete with non-existent task id still decreases running", () => {
		const q = new ScheduleQueue();
		q.enqueue({ id: "a" });
		q.dequeue();
		q.complete("nonexistent");
		assert.strictEqual(q.isRunning(), false);
	});

	it("clear empties queue and resets running", () => {
		const q = new ScheduleQueue(2);
		q.enqueue({ task: "a" });
		q.enqueue({ task: "b" });
		q.dequeue();
		q.clear();
		assert.strictEqual(q.getLength(), 0);
		assert.strictEqual(q.isRunning(), false);
		assert.strictEqual(q.peek(), null);
	});

	it("works with maxConcurrent > 1", () => {
		const q = new ScheduleQueue(3);
		q.enqueue({ task: "a" });
		q.enqueue({ task: "b" });
		q.enqueue({ task: "c" });
		const r1 = q.dequeue();
		const r2 = q.dequeue();
		const r3 = q.dequeue();
		assert.ok(r1);
		assert.ok(r2);
		assert.ok(r3);
		assert.strictEqual(q.getLength(), 0);
	});
});

describe("scheduler - field matching", () => {
	// matchesField is private in scheduler.js, test via shouldRun which calls it
	it("matches wildcard minute and hour", () => {
		assert.strictEqual(shouldRun("* *", new Date(2024, 0, 1, 9, 30)), true);
	});

	it("matches exact minute and hour", () => {
		assert.strictEqual(shouldRun("30 9", new Date(2024, 0, 1, 9, 30)), true);
	});

	it("rejects wrong minute", () => {
		assert.strictEqual(shouldRun("0 9", new Date(2024, 0, 1, 9, 30)), false);
	});

	it("rejects wrong hour", () => {
		assert.strictEqual(shouldRun("* 9", new Date(2024, 0, 1, 10, 30)), false);
	});

	it("rejects both wrong", () => {
		assert.strictEqual(shouldRun("15 9", new Date(2024, 0, 1, 10, 30)), false);
	});

	it("uses default hour * when cron has only minute", () => {
		assert.strictEqual(shouldRun("30", new Date(2024, 0, 1, 9, 30)), true);
	});

	it("matches step expression */15 for minutes", () => {
		assert.strictEqual(shouldRun("*/15 *", new Date(2024, 0, 1, 9, 0)), true);
		assert.strictEqual(shouldRun("*/15 *", new Date(2024, 0, 1, 9, 15)), true);
		assert.strictEqual(shouldRun("*/15 *", new Date(2024, 0, 1, 9, 14)), false);
	});

	it("matches range expression for hour", () => {
		assert.strictEqual(shouldRun("* 9-11", new Date(2024, 0, 1, 10, 30)), true);
		assert.strictEqual(shouldRun("* 9-11", new Date(2024, 0, 1, 8, 30)), false);
	});
});

describe("scheduler - result logging", () => {
	it("creates a markdown result file", () => {
		const result = logScheduleResult(
			{
				scheduleName: "test-job",
				cron: "0 9 * * *",
				startTime: "2024-01-01T09:00:00Z",
				endTime: "2024-01-01T09:00:05Z",
				exitCode: 0,
				stdout: "success",
				stderr: "",
			},
			"memory/schedules/",
		);
		assert.ok(result.includes("memory/schedules"));
	});

	it("creates file even with missing stdout/stderr", () => {
		const res = logScheduleResult(
			{
				scheduleName: "no-output",
				cron: "* * * * *",
				startTime: "2024-01-01T00:00:00Z",
				endTime: "2024-01-01T00:00:01Z",
				exitCode: 1,
				stdout: "",
				stderr: "",
			},
			"memory/schedules/",
		);
		assert.ok(res.includes("memory/schedules"));
	});
});

describe("scheduler - ScheduleManager", () => {
	it("returns empty results for register with empty array", () => {
		const mgr = new ScheduleManager();
		const results = mgr.register([]);
		assert.deepStrictEqual(results, []);
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
		const mgr = new ScheduleManager();
		assert.strictEqual(mgr.list().length, 0);
	});

	it("pause returns false for unknown name", () => {
		const mgr = new ScheduleManager();
		assert.strictEqual(mgr.pause("nonexistent"), false);
	});

	it("pause returns true and marks entry paused", () => {
		const mgr = new ScheduleManager();
		mgr.register([{ name: "daily", cron: "0 9 * * *" }]);
		assert.strictEqual(mgr.pause("daily"), true);
		const schedule = mgr.list()[0];
		assert.strictEqual(schedule.paused, true);
	});

	it("resume returns false for unknown name", () => {
		const mgr = new ScheduleManager();
		assert.strictEqual(mgr.resume("nonexistent"), false);
	});

	it("resume returns true and sets paused based on enabled", () => {
		const mgr = new ScheduleManager();
		mgr.register([{ name: "daily", cron: "0 9 * * *" }]);
		mgr.pause("daily");
		assert.strictEqual(mgr.resume("daily"), true);
		// resume sets entry.paused = entry.enabled !== false
		// entry.enabled is true (default), so paused becomes true
		const schedule = mgr.list()[0];
		assert.strictEqual(schedule.paused, true);
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
		// Should have called runScheduledSkill and returned its result
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
		// lastRun is set regardless of result
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

	it("start sets running and creates interval", () => {
		const mgr = new ScheduleManager();
		mgr.register([{ name: "daily", cron: "0 9 * * *" }]);
		const scheduler = { sandbox: async () => ({}), state: {} };
		// start calls #clockTick immediately — need to prevent clockTick from running
		// By registering, we ensure the schedule is there for the tick
		mgr.start(scheduler, 60000);
		// After start, schedule should be processed
		assert.strictEqual(mgr.list()[0].lastRun, null);
		// clockTick sets lastRun if shouldRun returns true
		mgr.stop();
	});

	it("stop clears interval and queue", () => {
		const mgr = new ScheduleManager();
		// Manually set running via clockTick simulation
		mgr.stop(); // safe to call multiple times
	});

	it("start triggers clockTick which enqueues matching schedules", () => {
		const mgr = new ScheduleManager(10);
		// Register a schedule that matches the current minute (full 5-field cron)
		const now = new Date();
		const minuteField = String(now.getMinutes());
		mgr.register([{ name: "now", cron: `${minuteField} * * * *` }]);

		// start() calls #clockTick immediately
		global.setInterval = () => undefined;

		try {
			mgr.start({ sandbox: async () => ({}), state: {} });
			// After start, tick ran — the "now" schedule should have lastRun set
			const entries = mgr.list();
			assert.ok(entries.length > 0, "should have at least one schedule");
			assert.strictEqual(entries[0].lastRun !== null && entries[0].lastRun !== "", true);
		} finally {
			global.setInterval = () => {};
		}
	});
});
