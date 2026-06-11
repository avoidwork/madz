import { describe, it, after, beforeEach } from "node:test";
import assert from "node:assert";
import { rmSync, mkdirSync } from "node:fs";
import { setupAutoSchedule } from "../../src/scheduler/autoSchedule.js";

const TEST_DIR = "memory/__autoschedule_test__";

function setup() {
	try {
		rmSync(TEST_DIR, { recursive: true, force: true });
	} catch {
		// ignore
	}
	mkdirSync(TEST_DIR, { recursive: true });
}

function teardown() {
	try {
		rmSync(TEST_DIR, { recursive: true, force: true });
	} catch {
		// ignore
	}
}

beforeEach(setup);
after(teardown);

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
			capturedJob.command.includes("node index.js --chat"),
			"Command should include the chat command",
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

		// Call multiple times — should always attempt to add
		callback();
		callback();
		callback();

		assert.strictEqual(callCount, 3, "Cron.add() should be called each time");
	});
});
