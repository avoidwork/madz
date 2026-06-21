import { describe, it, after, beforeEach } from "node:test";
import assert from "node:assert";
import { rmSync, mkdirSync, existsSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { setupAutoSchedule } from "../../src/scheduler/autoSchedule.js";

const TEST_DIR = "memory/__autoschedule_test__";
const SCHEDULES_DIR = "memory/schedules/";
const JOB_FILE = join(SCHEDULES_DIR, "reflection-daily.json");

function setup() {
	try {
		rmSync(TEST_DIR, { recursive: true, force: true });
	} catch {
		// ignore
	}
	try {
		if (existsSync(JOB_FILE)) {
			rmSync(JOB_FILE, { force: true });
		}
	} catch {
		// ignore
	}
	mkdirSync(TEST_DIR, { recursive: true });
}

function cleanup() {
	try {
		rmSync(TEST_DIR, { recursive: true, force: true });
	} catch {
		// ignore
	}
}

beforeEach(setup);
after(cleanup);

function mockCron(addResult = { added: true }) {
	return {
		add: (_job) => {
			return addResult;
		},
	};
}

describe("setupAutoSchedule", () => {
	it("returns a callback function", () => {
		const callback = setupAutoSchedule({ Cron: mockCron() });
		assert.strictEqual(typeof callback, "function");
	});

	it("passes job definition to Cron.add() (4.1)", () => {
		let capturedJob = null;
		const testCron = {
			add: (job) => {
				capturedJob = job;
				return { added: true };
			},
		};
		const callback = setupAutoSchedule({ Cron: testCron });
		callback();

		assert.ok(capturedJob, "Cron.add() should be called");
		assert.strictEqual(capturedJob.name, "reflection-daily");
		assert.strictEqual(capturedJob.cron, "0 2 * * *");
		assert.ok(typeof capturedJob.command === "string");
		assert.ok(
			capturedJob.command.includes('node index.js "run /reflection"'),
			"Command should include the run /reflection command",
		);
	});

	it("command embeds process.cwd() value (4.2)", () => {
		let capturedJob = null;
		const testCron = {
			add: (job) => {
				capturedJob = job;
				return { added: true };
			},
		};
		const callback = setupAutoSchedule({ Cron: testCron });
		callback();

		const expectedCwd = process.cwd();
		assert.ok(
			capturedJob.command.startsWith(`cd ${expectedCwd} &&`),
			`Command should start with "cd ${expectedCwd} &&"`,
		);
	});

	it("writes reflection-daily.json to memory/schedules/ (5.1)", () => {
		const callback = setupAutoSchedule({ Cron: mockCron() });
		callback();

		assert.ok(existsSync(JOB_FILE), "reflection-daily.json should be written");

		const content = JSON.parse(readFileSync(JOB_FILE, "utf-8"));
		assert.strictEqual(content.name, "reflection-daily");
		assert.strictEqual(content.cron, "0 2 * * *");
		assert.ok(
			content.command.startsWith("cd ") && content.command.includes('node index.js "run /reflection"'),
		);
		assert.strictEqual(content.enabled, true);
		assert.ok(content.createdAt);
		assert.ok(content.updatedAt);
	});

	it("skips writing if job file already exists (5.2)", () => {
		const callback = setupAutoSchedule({ Cron: mockCron() });

		// Call once to create the file
		callback();
		assert.ok(existsSync(JOB_FILE));
		const firstSize = statSync(JOB_FILE).size;

		// Call again — should not overwrite, size should be identical
		callback();
		const secondSize = statSync(JOB_FILE).size;

		assert.strictEqual(firstSize, secondSize, "File should not be overwritten on second call");
	});

	it("handles Cron.add() error gracefully (4.3)", () => {
		const testCron = {
			add: () => {
				return { added: false, error: "crontab not available" };
			},
		};
		const callback = setupAutoSchedule({ Cron: testCron });
		// Should not throw
		assert.doesNotThrow(() => callback());
	});

	it("handles Cron.add() exception gracefully (4.4)", () => {
		const testCron = {
			add: () => {
				throw new Error("unexpected error");
			},
		};
		const callback = setupAutoSchedule({ Cron: testCron });
		// Should not throw
		assert.doesNotThrow(() => callback());
	});

	it("calls Cron.add() regardless of profile state (4.5)", () => {
		let callCount = 0;
		const testCron = {
			add: () => {
				callCount++;
				return { added: true };
			},
		};
		const callback = setupAutoSchedule({ Cron: testCron });

		callback();
		callback();
		callback();

		assert.strictEqual(callCount, 3, "Cron.add() should be called each time");
	});
});
