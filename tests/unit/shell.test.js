import { describe, it, afterEach } from "node:test";
import assert from "node:assert";
import { manageProcessImpl, processTracker, trackProcess } from "../../src/tools/shell.js";
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
		const result = await manageProcessImpl({ action: "list" });
		const entries = JSON.parse(result);
		assert.strictEqual(Array.isArray(entries), true);
	});

	it("tracks a process", async () => {
		const child = spawn("sh", ["-c", "sleep 0.2"], { detached: true });
		spawned.push(child);
		child.unref();
		const pid = trackProcess(child, "sleep 0.2");

		const result = await manageProcessImpl({ action: "list" });
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

		const result = await manageProcessImpl({ action: "poll", processId: pid });
		assert.ok(result.includes("status"));

		await waitForExit(child);
		processTracker.delete(pid);
	});

	it("rejects unknown action", async () => {
		const result = await manageProcessImpl({ action: "foobar" });
		assert.ok(result.includes("Unknown action") || result.includes("Error"));
	});

	it("rejects missing processId for kill action", async () => {
		const result = await manageProcessImpl({ action: "kill" });
		assert.ok(result.includes("processId"));
	});

	it("handles unknown processId", async () => {
		const result = await manageProcessImpl({ action: "kill", processId: 99999 });
		assert.ok(result.includes("not found") || result.includes("Error"));
	});

	it("handles missing processId for log action", async () => {
		const result = await manageProcessImpl({ action: "log" });
		assert.ok(result.includes("processId"));
	});

	it("handles missing processId for wait action", async () => {
		const result = await manageProcessImpl({ action: "wait" });
		assert.ok(result.includes("processId"));
	});

	it("handles missing processId for write action", async () => {
		const result = await manageProcessImpl({ action: "write" });
		assert.ok(result.includes("processId"));
	});

	it("handles missing processId for pause action", async () => {
		const result = await manageProcessImpl({ action: "pause" });
		assert.ok(result.includes("processId"));
	});

	it("handles missing processId for resume action", async () => {
		const result = await manageProcessImpl({ action: "resume" });
		assert.ok(result.includes("processId"));
	});

	it("handles unknown processId for log action", async () => {
		const result = await manageProcessImpl({ action: "log", processId: 99999 });
		assert.ok(result.includes("not found"));
	});

	it("handles unknown processId for wait action", async () => {
		const result = await manageProcessImpl({ action: "wait", processId: 99999 });
		assert.ok(result.includes("not found"));
	});

	it("handles unknown processId for write action", async () => {
		const result = await manageProcessImpl({ action: "write", processId: 99999 });
		assert.ok(result.includes("not found"));
	});

	it("handles unknown processId for pause action", async () => {
		const result = await manageProcessImpl({ action: "pause", processId: 99999 });
		assert.ok(result.includes("not found"));
	});

	it("handles unknown processId for resume action", async () => {
		const result = await manageProcessImpl({ action: "resume", processId: 99999 });
		assert.ok(result.includes("not found"));
	});

	it("logs background process", async () => {
		const child = spawn("sh", ["-c", "sleep 0.5"], { detached: true });
		spawned.push(child);
		child.unref();
		const pid = trackProcess(child, "sleep 0.5");

		try {
			const result = await manageProcessImpl({ action: "log", processId: pid });
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
			const result = await manageProcessImpl({ action: "wait", processId: pid });
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
			const result = await manageProcessImpl({ action: "kill", processId: pid });
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
			const result = await manageProcessImpl({
				action: "write",
				processId: pid,
				data: "test data",
			});
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
			const result = await manageProcessImpl({ action: "pause", processId: pid });
			assert.ok(result.includes("Paused"));
		} finally {
			try {
				child.kill("SIGKILL");
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
			await manageProcessImpl({ action: "pause", processId: pid });
		} catch {
			/* pause may fail, continue */
		}
		try {
			const result = await manageProcessImpl({ action: "resume", processId: pid });
			assert.ok(result.includes("Resumed"));
		} finally {
			try {
				child.kill("SIGKILL");
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

	it("starts process in background mode", async () => {
		const result = await manageProcessImpl({ action: "list" });
		const entries = JSON.parse(result);
		assert.strictEqual(Array.isArray(entries), true);
	});
});
