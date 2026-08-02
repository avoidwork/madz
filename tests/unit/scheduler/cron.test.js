import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert";
import { Cron, setExecOverride } from "../../../src/scheduler/cron.js";

// --- Mock crontab state ---
let mockCrontabContent = "";
let mockExecCalls = [];

// Mock exec that works with promisified exec (returns a Promise)
function mockExec(command, options) {
	mockExecCalls.push({ command, options });

	// Intercept crontab commands
	if (command.includes("crontab -l")) {
		return Promise.resolve({ stdout: mockCrontabContent || "", stderr: "" });
	}

	if (command.includes("crontab -")) {
		// Read from stdin (the content to install)
		const stdin = options?.input || "";
		mockCrontabContent = stdin;
		return Promise.resolve({ stdout: "", stderr: "" });
	}

	if (command.includes("which crontab")) {
		return Promise.resolve({ stdout: "/usr/bin/crontab", stderr: "" });
	}

	// Reject unknown commands to prevent hanging
	return Promise.reject(new Error(`Unexpected command: ${command}`));
}

describe("cron - Cron.isAvailable", () => {
	beforeEach(() => {
		mockExecCalls = [];
		mockCrontabContent = "";
	});

	afterEach(() => {
		setExecOverride(undefined);
	});

	it("returns available:true when crontab binary exists", async () => {
		setExecOverride(mockExec);
		const result = await Cron.isAvailable();
		assert.ok(result.hasOwnProperty("available"));
		assert.strictEqual(result.available, true);
	});

	it("returns available:false when crontab binary is missing", async () => {
		// Mock which crontab to fail
		const failingExec = (cmd, options, callback) => {
			if (cmd.includes("which crontab")) {
				return callback(new Error("not found"), "", "");
			}
			return exec(cmd, options, callback);
		};
		setExecOverride(failingExec);
		const result = await Cron.isAvailable();
		assert.strictEqual(result.available, false);
		assert.ok(result.error);
	});
});

describe("cron - Cron.add", () => {
	beforeEach(() => {
		mockExecCalls = [];
		mockCrontabContent = "";
	});

	afterEach(() => {
		setExecOverride(undefined);
	});

	it("adds a new entry to empty crontab", async () => {
		setExecOverride(mockExec);
		const result = await Cron.add({ name: "test", cron: "* * * * *", command: "echo test" });
		assert.strictEqual(result.added, true);
		assert.ok(mockCrontabContent.includes("# --- BEGIN madz-schedules ---"));
		assert.ok(mockCrontabContent.includes("# madz-schedule: test"));
	});

	it("replaces existing entry with same name", async () => {
		setExecOverride(mockExec);
		// First add
		await Cron.add({ name: "test", cron: "* * * * *", command: "echo first" });
		// Second add with different cron
		await Cron.add({ name: "test", cron: "0 * * * *", command: "echo second" });
		// Should only have one entry with the new cron
		const count = (mockCrontabContent.match(/madz-schedule: test/g) || []).length;
		assert.strictEqual(count, 1);
		assert.ok(mockCrontabContent.includes("0 * * * *"));
	});

	it("returns error when crontab unavailable", async () => {
		const failingExec = (cmd) => {
			if (cmd.includes("which crontab")) {
				return Promise.reject(new Error("not found"));
			}
			return mockExec(cmd);
		};
		setExecOverride(failingExec);
		const result = await Cron.add({ name: "test", cron: "* * * * *", command: "echo test" });
		assert.strictEqual(result.added, false);
		assert.ok(result.error);
	});

	it("returns error when command is missing", async () => {
		global.exec = mockExec;
		const result = await Cron.add({ name: "test", cron: "* * * * *" });
		assert.strictEqual(result.added, false);
		assert.ok(result.error);
	});
});

describe("cron - Cron.remove", () => {
	beforeEach(() => {
		mockExecCalls = [];
		mockCrontabContent = "";
	});

	afterEach(() => {
		global.exec = originalExec;
	});

	it("removes an entry by name", async () => {
		global.exec = mockExec;
		// Add two entries
		await Cron.add({ name: "test1", cron: "* * * * *", command: "echo 1" });
		await Cron.add({ name: "test2", cron: "0 * * * *", command: "echo 2" });
		// Remove one
		const result = await Cron.remove("test1");
		assert.strictEqual(result.removed, true);
		assert.ok(!mockCrontabContent.includes("madz-schedule: test1"));
		assert.ok(mockCrontabContent.includes("madz-schedule: test2"));
	});

	it("returns error when crontab unavailable", async () => {
		const failingExec = (cmd) => {
			if (cmd.includes("which crontab")) {
				return Promise.reject(new Error("not found"));
			}
			return originalExec(cmd);
		};
		global.exec = failingExec;
		const result = await Cron.remove("test");
		assert.strictEqual(result.removed, false);
		assert.ok(result.error);
	});
});

describe("cron - Cron.install", () => {
	beforeEach(() => {
		mockExecCalls = [];
		mockCrontabContent = "";
	});

	afterEach(() => {
		global.exec = originalExec;
	});

	it("installs multiple schedules", async () => {
		global.exec = mockExec;
		const schedules = [
			{ name: "job1", cron: "* * * * *", command: "echo 1" },
			{ name: "job2", cron: "0 * * * *", command: "echo 2" },
		];
		const result = await Cron.install(schedules);
		assert.strictEqual(result.installed, 2);
		assert.ok(mockCrontabContent.includes("madz-schedule: job1"));
		assert.ok(mockCrontabContent.includes("madz-schedule: job2"));
	});

	it("excludes paused schedules", async () => {
		global.exec = mockExec;
		const schedules = [
			{ name: "job1", cron: "* * * * *", command: "echo 1", paused: false },
			{ name: "job2", cron: "0 * * * *", command: "echo 2", paused: true },
		];
		const result = await Cron.install(schedules);
		assert.strictEqual(result.installed, 1);
		assert.ok(mockCrontabContent.includes("madz-schedule: job1"));
		assert.ok(!mockCrontabContent.includes("madz-schedule: job2"));
	});

	it("replaces existing madz block", async () => {
		global.exec = mockExec;
		// Pre-populate with old entries
		mockCrontabContent =
			"# --- BEGIN madz-schedules ---\nold entry\n# --- END madz-schedules ---\n";
		const schedules = [{ name: "new", cron: "* * * * *", command: "echo new" }];
		const result = await Cron.install(schedules);
		assert.strictEqual(result.installed, 1);
		assert.ok(!mockCrontabContent.includes("old entry"));
		assert.ok(mockCrontabContent.includes("madz-schedule: new"));
	});

	it("returns error when crontab unavailable", async () => {
		const failingExec = (cmd) => {
			if (cmd.includes("which crontab")) {
				return Promise.reject(new Error("not found"));
			}
			return originalExec(cmd);
		};
		global.exec = failingExec;
		const result = await Cron.install([]);
		assert.strictEqual(result.installed, 0);
		assert.ok(result.error);
	});
});

describe("cron - Cron.uninstall", () => {
	beforeEach(() => {
		mockExecCalls = [];
		mockCrontabContent = "";
	});

	afterEach(() => {
		global.exec = originalExec;
	});

	it("removes all madz-schedules entries", async () => {
		global.exec = mockExec;
		// Add some entries
		await Cron.add({ name: "test", cron: "* * * * *", command: "echo test" });
		const count = await Cron.uninstall();
		assert.ok(count >= 0);
		assert.ok(!mockCrontabContent.includes("madz-schedules"));
	});

	it("returns 0 when no madz block exists", async () => {
		global.exec = mockExec;
		const count = await Cron.uninstall();
		assert.strictEqual(count, 0);
	});

	it("returns 0 when crontab unavailable", async () => {
		const failingExec = (cmd) => {
			if (cmd.includes("which crontab")) {
				return Promise.reject(new Error("not found"));
			}
			return originalExec(cmd);
		};
		global.exec = failingExec;
		const count = await Cron.uninstall();
		assert.strictEqual(count, 0);
	});
});

describe("cron - Cron.list", () => {
	beforeEach(() => {
		mockExecCalls = [];
		mockCrontabContent = "";
	});

	afterEach(() => {
		global.exec = originalExec;
	});

	it("returns empty array when no entries", async () => {
		global.exec = mockExec;
		const result = await Cron.list();
		assert.ok(Array.isArray(result));
		assert.strictEqual(result.length, 0);
	});

	it("returns entries from crontab", async () => {
		global.exec = mockExec;
		await Cron.add({ name: "test", cron: "* * * * *", command: "echo test" });
		const result = await Cron.list();
		assert.strictEqual(result.length, 1);
		assert.strictEqual(result[0].name, "test");
		assert.strictEqual(result[0].cron, "* * * * *");
		assert.strictEqual(result[0].command, "echo test");
	});

	it("returns multiple entries", async () => {
		global.exec = mockExec;
		await Cron.add({ name: "job1", cron: "* * * * *", command: "echo 1" });
		await Cron.add({ name: "job2", cron: "0 * * * *", command: "echo 2" });
		const result = await Cron.list();
		assert.strictEqual(result.length, 2);
	});
});

describe("cron - Cron.sync", () => {
	beforeEach(() => {
		mockExecCalls = [];
		mockCrontabContent = "";
	});

	afterEach(() => {
		global.exec = originalExec;
	});

	it("returns error when crontab unavailable", async () => {
		const failingExec = (cmd) => {
			if (cmd.includes("which crontab")) {
				return Promise.reject(new Error("not found"));
			}
			return originalExec(cmd);
		};
		global.exec = failingExec;
		const result = await Cron.sync("memory/schedules/");
		assert.ok(result.error);
		assert.strictEqual(result.added, 0);
	});

	it("syncs jobs from disk to crontab", async () => {
		global.exec = mockExec;
		// Create a test job file
		const { mkdirSync, writeFileSync } = await import("node:fs");
		const { join } = await import("node:path");
		const testDir = "memory/__test_sync__/";
		mkdirSync(join(process.cwd(), testDir), { recursive: true });
		writeFileSync(
			join(process.cwd(), testDir, "test-job.json"),
			JSON.stringify({
				name: "test-job",
				cron: "* * * * *",
				command: "echo test",
				enabled: true,
			}),
		);

		const result = await Cron.sync(testDir);
		assert.strictEqual(result.added, 1);
		assert.ok(mockCrontabContent.includes("madz-schedule: test-job"));

		// Cleanup
		const { rmSync } = await import("node:fs");
		rmSync(join(process.cwd(), testDir), { recursive: true, force: true });
	});

	it("skips disabled jobs", async () => {
		global.exec = mockExec;
		const { mkdirSync, writeFileSync } = await import("node:fs");
		const { join } = await import("node:path");
		const testDir = "memory/__test_sync__/";
		mkdirSync(join(process.cwd(), testDir), { recursive: true });
		writeFileSync(
			join(process.cwd(), testDir, "disabled-job.json"),
			JSON.stringify({
				name: "disabled-job",
				cron: "* * * * *",
				command: "echo disabled",
				enabled: false,
			}),
		);

		const result = await Cron.sync(testDir);
		assert.strictEqual(result.added, 0);
		assert.ok(!mockCrontabContent.includes("madz-schedule: disabled-job"));

		// Cleanup
		const { rmSync } = await import("node:fs");
		rmSync(join(process.cwd(), testDir), { recursive: true, force: true });
	});
});
