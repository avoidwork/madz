import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert";
import {
	unifiedProcessImpl,
	processTracker,
	trackProcess,
} from "../../../src/tools/process/index.js";

describe("process tool - unifiedProcessImpl", () => {
	beforeEach(() => {
		// Clear the tracker
		processTracker.clear();
	});

	it("returns error when start action has no command", async () => {
		const result = await unifiedProcessImpl({ action: "start" });
		assert.ok(result.startsWith("Error: command is required"));
	});

	it("returns error for command exceeding max length", async () => {
		const result = await unifiedProcessImpl({
			action: "start",
			command: "x".repeat(5000),
		});
		assert.ok(result.includes("exceeds maximum"));
	});

	it("returns error for unknown action", async () => {
		const result = await unifiedProcessImpl({ action: "unknown" });
		assert.ok(result.includes("Unknown action"));
	});

	it("returns error when processId is missing for non-start/list actions", async () => {
		const result = await unifiedProcessImpl({ action: "log" });
		assert.ok(result.includes("processId is required"));
	});

	it("returns error when process is not found", async () => {
		const result = await unifiedProcessImpl({ action: "log", processId: 9999 });
		assert.ok(result.includes("not found"));
	});

	it("returns empty list when no processes are tracked", async () => {
		const result = await unifiedProcessImpl({ action: "list" });
		assert.strictEqual(result, "[]");
	});

	it("starts a foreground command and returns output", async () => {
		const result = await unifiedProcessImpl({
			action: "start",
			command: "echo hello",
		});
		assert.ok(result.includes("exitCode: 0"));
		assert.ok(result.includes("hello"));
	});

	it("starts a background command and returns PID message", async () => {
		const result = await unifiedProcessImpl({
			action: "start",
			command: "echo bg-test",
			background: true,
		});
		assert.ok(result.includes("Started process in background"));
		assert.ok(result.includes("PID:"));
	});

	it("lists tracked processes after starting one", async () => {
		await unifiedProcessImpl({
			action: "start",
			command: "echo list-test",
			background: true,
		});
		const listResult = await unifiedProcessImpl({ action: "list" });
		const parsed = JSON.parse(listResult);
		assert.ok(Array.isArray(parsed));
		assert.ok(parsed.length > 0);
		assert.ok(parsed[0].pid !== undefined);
		assert.ok(parsed[0].command);
	});

	it("returns log output for a completed process", async () => {
		const startResult = await unifiedProcessImpl({
			action: "start",
			command: "echo log-test-output",
			background: true,
		});
		// Extract PID from result
		const pidMatch = startResult.match(/PID: (\d+)/);
		assert.ok(pidMatch, "Should have a PID");
		const pid = parseInt(pidMatch[1], 10);

		// Wait a bit for the process to complete
		await new Promise((r) => setTimeout(r, 500));

		const logResult = await unifiedProcessImpl({ action: "log", processId: pid });
		assert.ok(logResult.includes("log-test-output"));
	});

	it("returns error for kill on non-existent process", async () => {
		const result = await unifiedProcessImpl({ action: "kill", processId: 9999 });
		assert.ok(result.includes("not found"));
	});

	it("returns error for write on non-existent process", async () => {
		const result = await unifiedProcessImpl({
			action: "write",
			processId: 9999,
			data: "test",
		});
		assert.ok(result.includes("not found"));
	});

	it("returns error for pause on non-existent process", async () => {
		const result = await unifiedProcessImpl({ action: "pause", processId: 9999 });
		assert.ok(result.includes("not found"));
	});

	it("returns error for resume on non-existent process", async () => {
		const result = await unifiedProcessImpl({ action: "resume", processId: 9999 });
		assert.ok(result.includes("not found"));
	});

	it("returns error for wait on non-existent process", async () => {
		const result = await unifiedProcessImpl({ action: "wait", processId: 9999 });
		assert.ok(result.includes("not found"));
	});

	it("handles error starting background process gracefully", async () => {
		// This tests the catch block in executeBackground
		const result = await unifiedProcessImpl({
			action: "start",
			command: "",
			background: true,
		});
		// Empty command will fail to spawn
		assert.ok(typeof result === "string");
	});
});

describe("process tool - trackProcess", () => {
	beforeEach(() => {
		processTracker.clear();
	});

	it("tracks a process and assigns a PID", () => {
		// Create a mock child process
		const mockChild = {
			stdout: { on: (event, cb) => {} },
			stderr: { on: (event, cb) => {} },
			on: (event, cb) => {},
		};
		const pid = trackProcess(mockChild, "echo test");
		assert.ok(typeof pid === "number");
		assert.ok(pid >= 1000);
		const entry = processTracker.get(pid);
		assert.ok(entry);
		assert.strictEqual(entry.command, "echo test");
		assert.strictEqual(entry.status, "running");
	});

	it("updates status to exited on process exit", () => {
		let exitHandler;
		const mockChild = {
			stdout: { on: (event, cb) => {} },
			stderr: { on: (event, cb) => {} },
			on: (event, cb) => {
				if (event === "exit") exitHandler = cb;
			},
		};
		const pid = trackProcess(mockChild, "echo test");
		exitHandler(0);
		const entry = processTracker.get(pid);
		assert.strictEqual(entry.status, "exited");
	});

	it("updates status to error on process error", () => {
		let errorHandler;
		const mockChild = {
			stdout: { on: (event, cb) => {} },
			stderr: { on: (event, cb) => {} },
			on: (event, cb) => {
				if (event === "error") errorHandler = cb;
			},
		};
		const pid = trackProcess(mockChild, "echo test");
		errorHandler();
		const entry = processTracker.get(pid);
		assert.strictEqual(entry.status, "error");
	});

	it("collects stdout data", () => {
		let stdoutHandler;
		const mockChild = {
			stdout: { on: (event, cb) => { stdoutHandler = cb; } },
			stderr: { on: (event, cb) => {} },
			on: (event, cb) => {},
		};
		const pid = trackProcess(mockChild, "echo test");
		stdoutHandler(Buffer.from("hello world"));
		const entry = processTracker.get(pid);
		assert.strictEqual(entry.stdout, "hello world");
	});

	it("collects stderr data", () => {
		let stderrHandler;
		const mockChild = {
			stdout: { on: (event, cb) => {} },
			stderr: { on: (event, cb) => { stderrHandler = cb; } },
			on: (event, cb) => {},
		};
		const pid = trackProcess(mockChild, "echo test");
		stderrHandler(Buffer.from("error output"));
		const entry = processTracker.get(pid);
		assert.strictEqual(entry.stderr, "error output");
	});
});
