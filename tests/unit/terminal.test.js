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
});
