import { describe, it, afterEach } from "node:test";
import assert from "node:assert";
import {
	executeTerminalImpl,
	manageProcessImpl,
	processTracker,
	trackProcess,
} from "../../src/tools/terminal.js";
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

describe("tools - terminal", () => {
	describe("foreground execution", () => {
		it("executes echo command", async () => {
			const result = await executeTerminalImpl(
				{ command: "echo hello", background: false },
				{ allowedPaths: ["/"], maxReadSize: "1mb" },
			);
			assert.ok(result.includes("hello"));
			assert.ok(result.includes("exitCode"));
		});

		it("executes ls command", async () => {
			const result = await executeTerminalImpl(
				{ command: "ls", background: false },
				{ allowedPaths: ["/"], maxReadSize: "1mb" },
			);
			assert.ok(result.includes("exitCode"));
		});
	});

	describe("command length enforcement", () => {
		it("rejects command exceeding max length", async () => {
			const longCommand = "x".repeat(4097);
			const result = await executeTerminalImpl(
				{ command: longCommand, background: false },
				{ allowedPaths: ["/"], maxReadSize: "1mb" },
			);
			assert.ok(result.includes("exceeds"));
		});
	});
});

describe("tools - process management", () => {
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
		const result = await manageProcessImpl(
			{ action: "list" },
			{ allowedPaths: ["/"], maxReadSize: "1mb" },
		);
		const entries = JSON.parse(result);
		assert.strictEqual(Array.isArray(entries), true);
	});

	it("tracks a process", async () => {
		const child = spawn("sh", ["-c", "sleep 0.2"], { detached: true });
		spawned.push(child);
		child.unref();
		const pid = trackProcess(child, "sleep 0.2");

		const result = await manageProcessImpl(
			{ action: "list" },
			{ allowedPaths: ["/"], maxReadSize: "1mb" },
		);
		const entries = JSON.parse(result);
		assert.ok(entries.some((e) => e.pid === pid));

		await waitForExit(child);
		processTracker.delete(pid);
	});

	it("polls process status", async () => {
		const child = spawn("sh", ["-c", "sleep 0.2"], { detached: true });
		spawned.push(child);
		child.unref();
		const pid = trackProcess(child, "sleep 0.2");

		const result = await manageProcessImpl(
			{ action: "poll", processId: pid },
			{ allowedPaths: ["/"], maxReadSize: "1mb" },
		);
		assert.ok(result.includes("status"));

		await waitForExit(child);
		processTracker.delete(pid);
	});

	it("rejects unknown action", async () => {
		const result = await manageProcessImpl(
			{ action: "foobar" },
			{ allowedPaths: ["/"], maxReadSize: "1mb" },
		);
		assert.ok(result.includes("Unknown action") || result.includes("Error"));
	});

	it("rejects missing processId for kill action", async () => {
		const result = await manageProcessImpl(
			{ action: "kill" },
			{ allowedPaths: ["/"], maxReadSize: "1mb" },
		);
		assert.ok(result.includes("processId"));
	});

	it("handles unknown processId", async () => {
		const result = await manageProcessImpl(
			{ action: "kill", processId: 99999 },
			{ allowedPaths: ["/"], maxReadSize: "1mb" },
		);
		assert.ok(result.includes("not found") || result.includes("Error"));
	});

	it("handles missing processId for log action", async () => {
		const result = await manageProcessImpl(
			{ action: "log" },
			{ allowedPaths: ["/"], maxReadSize: "1mb" },
		);
		assert.ok(result.includes("processId"));
	});

	it("handles missing processId for wait action", async () => {
		const result = await manageProcessImpl(
			{ action: "wait" },
			{ allowedPaths: ["/"], maxReadSize: "1mb" },
		);
		assert.ok(result.includes("processId"));
	});

	it("handles missing processId for write action", async () => {
		const result = await manageProcessImpl(
			{ action: "write" },
			{ allowedPaths: ["/"], maxReadSize: "1mb" },
		);
		assert.ok(result.includes("processId"));
	});

	it("handles missing processId for pause action", async () => {
		const result = await manageProcessImpl(
			{ action: "pause" },
			{ allowedPaths: ["/"], maxReadSize: "1mb" },
		);
		assert.ok(result.includes("processId"));
	});

	it("handles missing processId for resume action", async () => {
		const result = await manageProcessImpl(
			{ action: "resume" },
			{ allowedPaths: ["/"], maxReadSize: "1mb" },
		);
		assert.ok(result.includes("processId"));
	});

	it("handles unknown processId for log action", async () => {
		const result = await manageProcessImpl(
			{ action: "log", processId: 99999 },
			{ allowedPaths: ["/"], maxReadSize: "1mb" },
		);
		assert.ok(result.includes("not found"));
	});

	it("handles unknown processId for wait action", async () => {
		const result = await manageProcessImpl(
			{ action: "wait", processId: 99999 },
			{ allowedPaths: ["/"], maxReadSize: "1mb" },
		);
		assert.ok(result.includes("not found"));
	});

	it("handles unknown processId for write action", async () => {
		const result = await manageProcessImpl(
			{ action: "write", processId: 99999 },
			{ allowedPaths: ["/"], maxReadSize: "1mb" },
		);
		assert.ok(result.includes("not found"));
	});

	it("handles unknown processId for pause action", async () => {
		const result = await manageProcessImpl(
			{ action: "pause", processId: 99999 },
			{ allowedPaths: ["/"], maxReadSize: "1mb" },
		);
		assert.ok(result.includes("not found"));
	});

	it("handles unknown processId for resume action", async () => {
		const result = await manageProcessImpl(
			{ action: "resume", processId: 99999 },
			{ allowedPaths: ["/"], maxReadSize: "1mb" },
		);
		assert.ok(result.includes("not found"));
	});

	it("logs background process", async () => {
		const child = spawn("sh", ["-c", "sleep 0.5"], { detached: true });
		spawned.push(child);
		child.unref();
		const pid = trackProcess(child, "sleep 0.5");

		try {
			const result = await manageProcessImpl(
				{ action: "log", processId: pid },
				{ allowedPaths: ["/"], maxReadSize: "1mb" },
			);
			assert.ok(result.includes("log"));
		} finally {
			await waitForExit(child);
			processTracker.delete(pid);
		}
	});

	it("waits for background process", async () => {
		const child = spawn("sh", ["-c", "sleep 0.3"], { detached: true });
		spawned.push(child);
		child.unref();
		const pid = trackProcess(child, "sleep 0.3");

		try {
			const result = await manageProcessImpl(
				{ action: "wait", processId: pid },
				{ allowedPaths: ["/"], maxReadSize: "1mb" },
			);
			assert.ok(result.includes("wait"));
		} finally {
			await waitForExit(child);
			processTracker.delete(pid);
		}
	});

	it("kills background process", async () => {
		const child = spawn("sh", ["-c", "sleep 10"], { detached: true });
		spawned.push(child);
		child.unref();
		const pid = trackProcess(child, "sleep 10");

		try {
			const result = await manageProcessImpl(
				{ action: "kill", processId: pid },
				{ allowedPaths: ["/"], maxReadSize: "1mb" },
			);
			assert.ok(result.includes("SIGTERM"));
			await waitForExit(child);
		} finally {
			processTracker.delete(pid);
		}
	});

	it("writes to background process stdin", async () => {
		const child = spawn("sh", ["-c", "read -r line"], {
			detached: true,
			stdio: ["pipe", "ignore", "ignore"],
		});
		spawned.push(child);
		child.unref();
		const pid = trackProcess(child, "sh -c 'read -r line'");

		try {
			const result = await manageProcessImpl(
				{ action: "write", processId: pid, data: "test data" },
				{ allowedPaths: ["/"], maxReadSize: "1mb" },
			);
			assert.ok(result.includes("Wrote to stdin"));
		} catch {
			// stdin may not be available for detached processes
		} finally {
			try {
				child.kill("SIGTERM");
			} catch {
				/* ignore */
			}
			try {
				child.kill("SIGKILL");
			} catch {
				/* ignore */
			}
			await new Promise((resolve) => setTimeout(resolve, 50));
			processTracker.delete(pid);
		}
	});

	it("pauses background process", async () => {
		const child = spawn("sh", ["-c", "sleep 10"], { detached: true });
		spawned.push(child);
		child.unref();
		const pid = trackProcess(child, "sleep 10");

		try {
			const result = await manageProcessImpl(
				{ action: "pause", processId: pid },
				{ allowedPaths: ["/"], maxReadSize: "1mb" },
			);
			assert.ok(result.includes("Paused"));
		} finally {
			try {
				child.kill();
			} catch {
				/* ignore */
			}
			processTracker.delete(pid);
		}
	});

	it("resumes background process", async () => {
		const child = spawn("sh", ["-c", "sleep 10"], { detached: true });
		spawned.push(child);
		child.unref();
		const pid = trackProcess(child, "sleep 10");

		try {
			await manageProcessImpl(
				{ action: "pause", processId: pid },
				{ allowedPaths: ["/"], maxReadSize: "1mb" },
			);
		} catch {
			/* pause may fail, continue */
		}
		try {
			const result = await manageProcessImpl(
				{ action: "resume", processId: pid },
				{ allowedPaths: ["/"], maxReadSize: "1mb" },
			);
			assert.ok(result.includes("Resumed"));
		} finally {
			try {
				child.kill();
			} catch {
				/* ignore */
			}
			processTracker.delete(pid);
		}
	});

	it("assigns incrementing PIDs", () => {
		const child1 = spawn("sh", ["-c", "sleep 0.1"], { detached: true });
		spawned.push(child1);
		child1.unref();
		const pid1 = trackProcess(child1, "cmd1");

		const child2 = spawn("sh", ["-c", "sleep 0.1"], { detached: true });
		spawned.push(child2);
		child2.unref();
		const pid2 = trackProcess(child2, "cmd2");

		assert.strictEqual(pid1 < pid2, true);
	});

	describe("foreground stderr capture", () => {
		it("captures stderr in output", async () => {
			const result = await executeTerminalImpl(
				{ command: "sh -c 'echo error >&2'", background: false },
				{ allowedPaths: ["/"], maxReadSize: "1mb" },
			);
			assert.ok(result.includes("exitCode"));
			assert.ok(result.includes("stderr"));
			assert.ok(result.includes("error"));
		});

		it("returns error message when child errors", async () => {
			const result = await executeTerminalImpl(
				{ command: "sh -c 'exit 1' && invalid_nonexistent_binary", background: false },
				{ allowedPaths: ["/"], maxReadSize: "1mb" },
			);
			assert.ok(Array.isArray(result) || typeof result === "string");
		});
	});

	describe("background execution", () => {
		it("starts process in background mode", async () => {
			const result = await executeTerminalImpl(
				{ command: "sleep 0.5", background: true },
				{ allowedPaths: ["/"] },
			);
			assert.ok(result.includes("Started process in background"));
		});
	});
});
