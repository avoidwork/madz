import { describe, it, afterEach } from "node:test";
import assert from "node:assert";
import { unifiedProcessImpl, processTracker, trackProcess } from "../../src/tools/process.js";
import { spawn } from "node:child_process";

let spawned = [];

function cleanup() {
	for (const child of spawned) {
		try {
			child.kill("SIGTERM");
		} catch {
			/* ignore */
		}
	}
	spawned = [];
}

/**
 * Wait for a detached child to actually exit.
 * @param {import("node:child_process").ChildProcess} child
 */
async function waitForExit(child) {
	return new Promise((resolve) => {
		if (child.exitCode !== null) {
			resolve();
			return;
		}
		child.on("exit", () => {
			const idx = spawned.indexOf(child);
			if (idx !== -1) spawned.splice(idx, 1);
			resolve();
		});
		const timer = setTimeout(() => {
			try {
				child.kill("SIGKILL");
			} catch {
				/* ignore */
			}
			resolve();
		}, 5000);
		child.on("exit", () => clearTimeout(timer));
	});
}

describe("tools - process (unified)", () => {
	describe("start action — foreground", () => {
		it("executes echo command in foreground", async () => {
			const result = await unifiedProcessImpl(
				{ action: "start", command: "echo hello", background: false },
				{ allowedPaths: ["/"], maxReadSize: "1mb" },
			);
			assert.ok(result.includes("hello"));
			assert.ok(result.includes("exitCode"));
		});

		it("executes ls command in foreground", async () => {
			const result = await unifiedProcessImpl(
				{ action: "start", command: "ls", background: false },
				{ allowedPaths: ["/"], maxReadSize: "1mb" },
			);
			assert.ok(result.includes("exitCode"));
		});
	});

	describe("start action — background", () => {
		afterEach(() => {
			cleanup();
			const pids = Array.from(processTracker.keys());
			for (const pid of pids) {
				const entry = processTracker.get(pid);
				if (entry) {
					try {
						entry.child.kill("SIGKILL");
					} catch {
						/* ignore */
					}
				}
				processTracker.delete(pid);
			}
		});

		it("starts background process and returns PID", async () => {
			const result = await unifiedProcessImpl(
				{ action: "start", command: "sleep 30", background: true },
				{ allowedPaths: ["/"], maxReadSize: "1mb" },
			);
			assert.ok(result.includes("Started process in background"));
			const pidMatch = result.match(/PID: (\d+)/);
			assert.ok(pidMatch, "Should contain PID");
		});

		it("rejects command exceeding max length", async () => {
			const longCommand = "x".repeat(4097);
			const result = await unifiedProcessImpl(
				{ action: "start", command: longCommand, background: false },
				{ allowedPaths: ["/"], maxReadSize: "1mb" },
			);
			assert.ok(result.includes("exceeds"));
		});
	});

	describe("process lifecycle actions", () => {
		afterEach(() => {
			cleanup();
			const pids = Array.from(processTracker.keys());
			for (const pid of pids) {
				const entry = processTracker.get(pid);
				if (entry) {
					try {
						entry.child.kill("SIGKILL");
					} catch {
						/* ignore */
					}
				}
				processTracker.delete(pid);
			}
		});

		it("list shows empty array when no processes", async () => {
			const result = await unifiedProcessImpl(
				{ action: "list" },
				{ allowedPaths: ["/"], maxReadSize: "1mb" },
			);
			const entries = JSON.parse(result);
			assert.strictEqual(entries.length, 0);
		});

		it("list shows running process", async () => {
			await unifiedProcessImpl(
				{ action: "start", command: "sleep 30", background: true },
				{ allowedPaths: ["/"], maxReadSize: "1mb" },
			);
			const result = await unifiedProcessImpl(
				{ action: "list" },
				{ allowedPaths: ["/"], maxReadSize: "1mb" },
			);
			const entries = JSON.parse(result);
			assert.strictEqual(entries.length, 1);
			assert.strictEqual(entries[0].command, "sleep 30");
		});

		it("log captures stdout from background process", async () => {
			const child = spawn("sh", ["-c", "echo hello_world"], {
				cwd: process.cwd(),
				detached: true,
				stdio: ["ignore", "pipe", "pipe"],
			});
			const pid = trackProcess(child, "echo hello_world");
			spawned.push(child);

			await waitForExit(child);

			const result = await unifiedProcessImpl(
				{ action: "log", processId: pid },
				{ allowedPaths: ["/"], maxReadSize: "1mb" },
			);
			assert.ok(result.includes("hello_world"));
		});

		it("wait returns exit status", async () => {
			const child = spawn("sh", ["-c", "echo done"], {
				cwd: process.cwd(),
				detached: true,
				stdio: ["ignore", "pipe", "pipe"],
			});
			const pid = trackProcess(child, "echo done");
			spawned.push(child);

			await waitForExit(child);

			const result = await unifiedProcessImpl(
				{ action: "wait", processId: pid },
				{ allowedPaths: ["/"], maxReadSize: "1mb" },
			);
			assert.ok(result.includes("completed"));
		});

		it("kill terminates process", async () => {
			const child = spawn("sh", ["-c", "sleep 60"], {
				cwd: process.cwd(),
				detached: true,
				stdio: ["ignore", "pipe", "pipe"],
			});
			const pid = trackProcess(child, "sleep 60");
			spawned.push(child);

			const result = await unifiedProcessImpl(
				{ action: "kill", processId: pid },
				{ allowedPaths: ["/"], maxReadSize: "1mb" },
			);
			assert.ok(result.includes("SIGTERM"));

			// Wait for kill to complete
			await new Promise((r) => setTimeout(r, 6000));
			cleanup();
		});

		it("write sends data to stdin", async () => {
			const child = spawn("sh", ["-c", "cat"], {
				cwd: process.cwd(),
				detached: true,
				stdio: ["pipe", "pipe", "pipe"],
			});
			const pid = trackProcess(child, "cat");
			spawned.push(child);

			const result = await unifiedProcessImpl(
				{ action: "write", processId: pid, data: "test input" },
				{ allowedPaths: ["/"], maxReadSize: "1mb" },
			);
			assert.ok(result.includes("Wrote to stdin"));
			child.kill("SIGTERM");
		});

		it("returns error for non-existent process", async () => {
			const result = await unifiedProcessImpl(
				{ action: "log", processId: 99999 },
				{ allowedPaths: ["/"], maxReadSize: "1mb" },
			);
			assert.ok(result.includes("not found"));
		});

		it("returns error for invalid action", async () => {
			const child = spawn("sh", ["-c", "sleep 60"], {
				cwd: process.cwd(),
				detached: true,
				stdio: ["ignore", "pipe", "pipe"],
			});
			const pid = trackProcess(child, "sleep 60");
			spawned.push(child);

			const result = await unifiedProcessImpl(
				{ action: "invalid", processId: pid },
				{ allowedPaths: ["/"], maxReadSize: "1mb" },
			);
			assert.ok(result.includes("Unknown action"));
			child.kill("SIGTERM");
		});

		it("returns error when processId required but missing", async () => {
			const result = await unifiedProcessImpl(
				{ action: "log" },
				{ allowedPaths: ["/"], maxReadSize: "1mb" },
			);
			assert.ok(result.includes("processId is required"));
		});
	});
});
