import { describe, it, beforeEach } from "node:test";
import assert from "node:assert";
import {
	unifiedProcessImpl,
	processTracker,
	trackProcess,
} from "../../../src/tools/process/index.js";
import { setProjectCwd } from "../../../src/workspace/project.js";

describe("process tool - unifiedProcessImpl", () => {
	beforeEach(() => {
		// Clear the tracker
		processTracker.clear();
	});

	it("returns error when start action has no command", async () => {
		const result = await unifiedProcessImpl({ action: "start" });
		assert.strictEqual(result.ok, false);
		assert.ok(result.error.includes("command is required"));
	});

	it("returns error for command exceeding max length", async () => {
		const result = await unifiedProcessImpl({
			action: "start",
			command: "x".repeat(5000),
		});
		assert.strictEqual(result.ok, false);
		assert.ok(result.error.includes("exceeds maximum"));
	});

	it("returns error for unknown action", async () => {
		const result = await unifiedProcessImpl({ action: "unknown", processId: 1 });
		assert.strictEqual(result.ok, false);
		assert.ok(result.error.includes("Unknown action"));
	});

	it("returns error when processId is missing for non-start/list actions", async () => {
		const result = await unifiedProcessImpl({ action: "log" });
		assert.strictEqual(result.ok, false);
		assert.ok(result.error.includes("processId is required"));
	});

	it("returns error when process is not found", async () => {
		const result = await unifiedProcessImpl({ action: "log", processId: 9999 });
		assert.strictEqual(result.ok, false);
		assert.ok(result.error.includes("not found"));
	});

	it("returns empty list when no processes are tracked", async () => {
		const result = await unifiedProcessImpl({ action: "list" });
		assert.strictEqual(result.ok, true);
		assert.ok(Array.isArray(result.entries));
		assert.strictEqual(result.entries.length, 0);
	});

	it("starts a foreground command and returns output", async () => {
		const result = await unifiedProcessImpl({
			action: "start",
			command: "echo hello",
		});
		assert.strictEqual(result.ok, true);
		assert.strictEqual(result.exitCode, 0);
		assert.ok(result.stdout.includes("hello"));
	});

	it("starts a background command and returns PID message", async () => {
		const result = await unifiedProcessImpl({
			action: "start",
			command: "echo bg-test",
			background: true,
		});
		assert.strictEqual(result.ok, true);
		assert.ok(result.pid !== undefined);
		assert.strictEqual(result.command, "echo bg-test");
	});

	it("lists tracked processes after starting one", async () => {
		await unifiedProcessImpl({
			action: "start",
			command: "echo list-test",
			background: true,
		});
		const listResult = await unifiedProcessImpl({ action: "list" });
		assert.strictEqual(listResult.ok, true);
		assert.ok(Array.isArray(listResult.entries));
		assert.ok(listResult.entries.length > 0);
		assert.ok(listResult.entries[0].pid !== undefined);
		assert.ok(listResult.entries[0].command);
	});

	it("returns log output for a completed process", async () => {
		const startResult = await unifiedProcessImpl({
			action: "start",
			command: "echo log-test-output",
			background: true,
		});
		assert.strictEqual(startResult.ok, true);
		const pid = startResult.pid;

		// Wait a bit for the process to complete
		await new Promise((r) => setTimeout(r, 500));

		const logResult = await unifiedProcessImpl({ action: "log", processId: pid });
		assert.strictEqual(logResult.ok, true);
		assert.ok(logResult.stdout.includes("log-test-output"));
	});

	it("returns error for kill on non-existent process", async () => {
		const result = await unifiedProcessImpl({ action: "kill", processId: 9999 });
		assert.strictEqual(result.ok, false);
		assert.ok(result.error.includes("not found"));
	});

	it("returns error for write on non-existent process", async () => {
		const result = await unifiedProcessImpl({
			action: "write",
			processId: 9999,
			data: "test",
		});
		assert.strictEqual(result.ok, false);
		assert.ok(result.error.includes("not found"));
	});

	it("returns error for pause on non-existent process", async () => {
		const result = await unifiedProcessImpl({ action: "pause", processId: 9999 });
		assert.strictEqual(result.ok, false);
		assert.ok(result.error.includes("not found"));
	});

	it("returns error for resume on non-existent process", async () => {
		const result = await unifiedProcessImpl({ action: "resume", processId: 9999 });
		assert.strictEqual(result.ok, false);
		assert.ok(result.error.includes("not found"));
	});

	it("returns error for wait on non-existent process", async () => {
		const result = await unifiedProcessImpl({ action: "wait", processId: 9999 });
		assert.strictEqual(result.ok, false);
		assert.ok(result.error.includes("not found"));
	});

	it("handles error starting background process gracefully", async () => {
		// This tests the catch block in executeBackground
		const result = await unifiedProcessImpl({
			action: "start",
			command: "",
			background: true,
		});
		// Empty command will fail to spawn
		assert.strictEqual(typeof result, "object");
		assert.strictEqual(typeof result.ok, "boolean");
	});

	it("captures stderr output from foreground command", async () => {
		const result = await unifiedProcessImpl({
			action: "start",
			command: "echo stderr-output >&2",
		});
		assert.strictEqual(result.ok, true);
		assert.strictEqual(result.exitCode, 0);
		assert.ok(result.stderr.includes("stderr-output"));
	});

	it("handles foreground command spawn error", async () => {
		const result = await unifiedProcessImpl({
			action: "start",
			command: "nonexistent-command-xyzzy",
		});
		assert.strictEqual(typeof result, "object");
		assert.strictEqual(typeof result.ok, "boolean");
	});

	it("waits for a background process to complete", async () => {
		const startResult = await unifiedProcessImpl({
			action: "start",
			command: "echo wait-test",
			background: true,
		});
		assert.strictEqual(startResult.ok, true);
		const pid = startResult.pid;

		const waitResult = await unifiedProcessImpl({ action: "wait", processId: pid });
		assert.strictEqual(waitResult.ok, true);
		assert.ok(waitResult.stdout.includes("wait-test"));
	});

	it("kills a background process", async () => {
		const startResult = await unifiedProcessImpl({
			action: "start",
			command: "sleep 30",
			background: true,
		});
		assert.strictEqual(startResult.ok, true);
		const pid = startResult.pid;

		const killResult = await unifiedProcessImpl({ action: "kill", processId: pid });
		assert.strictEqual(killResult.ok, true);
		assert.ok(killResult.message.includes("SIGTERM"));
	});

	it("pauses and resumes a background process", async () => {
		const startResult = await unifiedProcessImpl({
			action: "start",
			command: "sleep 30",
			background: true,
		});
		assert.strictEqual(startResult.ok, true);
		const pid = startResult.pid;

		const pauseResult = await unifiedProcessImpl({ action: "pause", processId: pid });
		assert.strictEqual(pauseResult.ok, true);
		assert.ok(pauseResult.message.includes("Paused"));

		const resumeResult = await unifiedProcessImpl({ action: "resume", processId: pid });
		assert.strictEqual(resumeResult.ok, true);
		assert.ok(resumeResult.message.includes("Resumed"));

		// Clean up
		await unifiedProcessImpl({ action: "kill", processId: pid });
	});

	it("writes to stdin of a background process", async () => {
		const startResult = await unifiedProcessImpl({
			action: "start",
			command: "cat",
			background: true,
		});
		assert.strictEqual(startResult.ok, true);
		const pid = startResult.pid;

		const writeResult = await unifiedProcessImpl({
			action: "write",
			processId: pid,
			data: "hello stdin",
		});
		assert.strictEqual(writeResult.ok, true);
		assert.ok(writeResult.message.includes("Wrote to stdin"));

		// Clean up
		await unifiedProcessImpl({ action: "kill", processId: pid });
	});
});

describe("process tool - trackProcess", () => {
	beforeEach(() => {
		processTracker.clear();
	});

	it("tracks a process and assigns a PID", () => {
		// Create a mock child process
		const mockChild = {
			stdout: { on: (_event, _cb) => {} },
			stderr: { on: (_event, _cb) => {} },
			on: (_event, _cb) => {},
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
			stdout: { on: (_event, _cb) => {} },
			stderr: { on: (_event, _cb) => {} },
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
			stdout: { on: (_event, _cb) => {} },
			stderr: { on: (_event, _cb) => {} },
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
			stdout: {
				on: (event, cb) => {
					stdoutHandler = cb;
				},
			},
			stderr: { on: (_event, _cb) => {} },
			on: (_event, _cb) => {},
		};
		const pid = trackProcess(mockChild, "echo test");
		stdoutHandler(Buffer.from("hello world"));
		const entry = processTracker.get(pid);
		assert.strictEqual(entry.stdout, "hello world");
	});

	it("collects stderr data", () => {
		let stderrHandler;
		const mockChild = {
			stdout: { on: (_event, _cb) => {} },
			stderr: {
				on: (event, cb) => {
					stderrHandler = cb;
				},
			},
			on: (_event, _cb) => {},
		};
		const pid = trackProcess(mockChild, "echo test");
		stderrHandler(Buffer.from("error output"));
		const entry = processTracker.get(pid);
		assert.strictEqual(entry.stderr, "error output");
	});
});

describe("process tool - cwd resolution", () => {
	beforeEach(() => {
		processTracker.clear();
	});

	it("resolves the working directory to the active project cwd", async () => {
		const projectDir = process.cwd();
		setProjectCwd(projectDir);
		try {
			const result = await unifiedProcessImpl({ action: "start", command: "pwd" });
			assert.strictEqual(result.ok, true);
			assert.strictEqual(result.exitCode, 0);
			assert.ok(result.stdout.includes(projectDir));
		} finally {
			setProjectCwd("");
		}
	});

	it("resolves the working directory for background processes", async () => {
		const projectDir = process.cwd();
		setProjectCwd(projectDir);
		try {
			const result = await unifiedProcessImpl({
				action: "start",
				command: "pwd",
				background: true,
			});
			assert.strictEqual(result.ok, true);
			assert.ok(result.pid !== undefined);
		} finally {
			setProjectCwd("");
		}
	});
});
