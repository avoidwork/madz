import { describe, it } from "node:test";
import assert from "node:assert";
import { terminal, process_tool, processTracker, trackProcess } from "../../src/tools/terminal.js";
import { spawn } from "node:child_process";

function cleanupPids(pids) {
	for (const pid of pids) {
		const entry = processTracker.get(pid);
		if (entry) {
			entry.child.kill("SIGTERM");
			processTracker.delete(pid);
		}
	}
}

describe("tools - terminal", () => {
	describe("foreground execution", () => {
		it("executes echo command", async () => {
			const result = await terminal(
				{ command: "echo hello", background: false },
				{ allowedPaths: ["/"], maxReadSize: "1mb" },
			);
			assert.ok(result.includes("hello"));
			assert.ok(result.includes("exitCode"));
		});

		it("executes ls command", async () => {
			const result = await terminal(
				{ command: "ls", background: false },
				{ allowedPaths: ["/"], maxReadSize: "1mb" },
			);
			assert.ok(result.includes("exitCode"));
		});
	});

	describe("background mode", () => {
		it("starts a background process and returns PID", async () => {
			const result = await terminal(
				{ command: "sleep 300", background: true },
				{ allowedPaths: ["/"], maxReadSize: "1mb" },
			);
			assert.ok(result.includes("PID"));
			assert.ok(result.includes("Started process"));

			// Clean up the background process
			const match = result.match(/PID:\s*(\d+)/);
			if (match) {
				const pid = parseInt(match[1]);
				const entry = processTracker.get(pid);
				if (entry) {
					entry.child.kill("SIGTERM");
					processTracker.delete(pid);
				}
			}
		});
	});

	describe("command length enforcement", () => {
		it("rejects command exceeding max length", async () => {
			const longCommand = "x".repeat(4097);
			const result = await terminal(
				{ command: longCommand, background: false },
				{ allowedPaths: ["/"], maxReadSize: "1mb" },
			);
			assert.ok(result.includes("exceeds"));
		});
	});
});

describe("tools - process management", () => {
	it("list shows empty array when no processes", async () => {
		const result = await process_tool(
			{ action: "list" },
			{ allowedPaths: ["/"], maxReadSize: "1mb" },
		);
		const entries = JSON.parse(result);
		assert.strictEqual(Array.isArray(entries), true);
	});

	it("tracks a process", async () => {
		const child = spawn("sh", ["-c", "sleep 300"], { detached: true });
		child.unref();
		const pid = trackProcess(child, "sleep 300");

		const result = await process_tool(
			{ action: "list" },
			{ allowedPaths: ["/"], maxReadSize: "1mb" },
		);
		const entries = JSON.parse(result);
		assert.ok(entries.some((e) => e.pid === pid));

		child.kill("SIGTERM");
		processTracker.delete(pid);
	});

	it("polls process status", async () => {
		const child = spawn("sh", ["-c", "sleep 300"], { detached: true });
		child.unref();
		const pid = trackProcess(child, "sleep 300");

		const result = await process_tool(
			{ action: "poll", processId: pid },
			{ allowedPaths: ["/"], maxReadSize: "1mb" },
		);
		assert.ok(result.includes("status"));

		child.kill("SIGTERM");
		processTracker.delete(pid);
	});

	it("rejects unknown action", async () => {
		const result = await process_tool(
			{ action: "foobar" },
			{ allowedPaths: ["/"], maxReadSize: "1mb" },
		);
		assert.ok(result.includes("Unknown action") || result.includes("Error"));
	});

	it("rejects missing processId for kill action", async () => {
		const result = await process_tool(
			{ action: "kill" },
			{ allowedPaths: ["/"], maxReadSize: "1mb" },
		);
		assert.ok(result.includes("processId"));
	});

	it("handles unknown processId", async () => {
		const result = await process_tool(
			{ action: "kill", processId: 99999 },
			{ allowedPaths: ["/"], maxReadSize: "1mb" },
		);
		assert.ok(result.includes("not found") || result.includes("Error"));
	});
});

describe("tools - trackProcess", () => {
	it("assigns incrementing PIDs", () => {
		const child1 = spawn("sh", ["-c", "sleep 300"], { detached: true });
		child1.unref();
		const pid1 = trackProcess(child1, "cmd1");

		const child2 = spawn("sh", ["-c", "sleep 300"], { detached: true });
		child2.unref();
		const pid2 = trackProcess(child2, "cmd2");

		assert.strictEqual(pid1 < pid2, true);

		cleanupPids([pid1, pid2]);
	});
});
