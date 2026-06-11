import { describe, it, after, beforeEach } from "node:test";
import assert from "node:assert";
import { mkdirSync, rmSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { setupAutoSchedule } from "../../src/scheduler/autoSchedule.js";

const TEST_DIR = "memory/__autoschedule_test__";
const SCHEDULES_DIR = join(TEST_DIR, "schedules");

function setup() {
	try {
		rmSync(TEST_DIR, { recursive: true, force: true });
	} catch {
		// ignore
	}
	mkdirSync(SCHEDULES_DIR, { recursive: true });
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

function options(overrides = {}) {
	return {
		schedulesDir: SCHEDULES_DIR,
		hasProfile: overrides.hasProfile ?? (() => false),
		...overrides,
	};
}

describe("setupAutoSchedule", () => {
	it("returns a callback function (4.1)", () => {
		const callback = setupAutoSchedule(options());
		assert.strictEqual(typeof callback, "function");
	});
});

describe("auto-schedule callback", () => {
	it("creates job file on first profile write (4.2)", () => {
		const callback = setupAutoSchedule(options({ hasProfile: () => false }));
		callback();

		const jobPath = join(SCHEDULES_DIR, "reflection-daily.json");
		assert.ok(existsSync(jobPath), "Job file should be created");

		const content = JSON.parse(readFileSync(jobPath, "utf-8"));
		assert.strictEqual(content.name, "reflection-daily");
		assert.strictEqual(content.cron, "0 2 * * *");
		assert.strictEqual(content.enabled, true);
	});

	it("skips if profile already exists (4.3)", () => {
		const callback = setupAutoSchedule(options({ hasProfile: () => true }));
		callback();

		const jobPath = join(SCHEDULES_DIR, "reflection-daily.json");
		assert.ok(!existsSync(jobPath), "Job file should NOT be created when profile exists");
	});

	it("skips if job file already exists (4.4)", () => {
		// Pre-create the job file
		const jobPath = join(SCHEDULES_DIR, "reflection-daily.json");
		mkdirSync(SCHEDULES_DIR, { recursive: true });
		writeFileSync(
			jobPath,
			JSON.stringify({ name: "reflection-daily", cron: "0 2 * * *" }, null, 2),
			"utf-8",
		);

		const callback = setupAutoSchedule(options({ hasProfile: () => false }));
		callback();

		// File should still exist and be unchanged
		assert.ok(existsSync(jobPath));
		const content = JSON.parse(readFileSync(jobPath, "utf-8"));
		assert.strictEqual(content.cron, "0 2 * * *");
	});

	it("handles hasProfile() error gracefully (4.5)", () => {
		const callback = setupAutoSchedule(
			options({ hasProfile: () => { throw new Error("disk error"); } }),
		);
		// Should not throw
		assert.doesNotThrow(() => callback());

		const jobPath = join(SCHEDULES_DIR, "reflection-daily.json");
		assert.ok(!existsSync(jobPath), "Job file should NOT be created on error");
	});

	it("job JSON has correct name, cron, command, and enabled fields (4.6)", () => {
		const callback = setupAutoSchedule(options({ hasProfile: () => false }));
		callback();

		const jobPath = join(SCHEDULES_DIR, "reflection-daily.json");
		const content = JSON.parse(readFileSync(jobPath, "utf-8"));

		assert.strictEqual(content.name, "reflection-daily");
		assert.strictEqual(content.cron, "0 2 * * *");
		assert.ok(typeof content.command === "string");
		assert.ok(content.command.includes("node index.js --chat"), "Command should include the chat command");
		assert.strictEqual(content.enabled, true);
	});

	it("command embeds correct process.cwd() value (4.7)", () => {
		const callback = setupAutoSchedule(options({ hasProfile: () => false }));
		callback();

		const jobPath = join(SCHEDULES_DIR, "reflection-daily.json");
		const content = JSON.parse(readFileSync(jobPath, "utf-8"));

		const expectedCwd = process.cwd();
		assert.ok(
			content.command.startsWith(`cd ${expectedCwd} &&`),
			`Command should start with "cd ${expectedCwd} &&"`,
		);
	});
});
