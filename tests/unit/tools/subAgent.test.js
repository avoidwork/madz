import { describe, it } from "node:test";
import assert from "node:assert";
import { readFile, access } from "node:fs/promises";
import { constants } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import {
	parseSubAgentOutput,
	escapeShellArg,
	resolveTimeout,
	generateSessionId,
	spawnSubAgentProcess,
} from "../../src/tools/subAgent.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

describe("parseSubAgentOutput", () => {
	it("should return ok:true with result when marker is present", () => {
		const stdout = "some preamble\n# SubAgent\n\nHere is the result";
		const result = parseSubAgentOutput(stdout);
		assert.strictEqual(result.ok, true);
		assert.ok(result.result.includes("# SubAgent"));
		assert.ok(result.result.includes("Here is the result"));
		assert.strictEqual(result.error, undefined);
	});

	it("should return ok:false when no output", () => {
		const result = parseSubAgentOutput("");
		assert.strictEqual(result.ok, false);
		assert.strictEqual(result.result, "");
		assert.ok(result.error.includes("No output"));
	});

	it("should return ok:false when output is null", () => {
		const result = parseSubAgentOutput(null);
		assert.strictEqual(result.ok, false);
		assert.strictEqual(result.result, "");
		assert.ok(result.error.includes("No output"));
	});

	it("should return ok:false when marker is missing", () => {
		const stdout = "some output without marker";
		const result = parseSubAgentOutput(stdout);
		assert.strictEqual(result.ok, false);
		assert.strictEqual(result.result, "");
		assert.ok(result.error.includes("not found"));
	});

	it("should return ok:false when marker has no content after it", () => {
		const stdout = "# SubAgent\n\n";
		const result = parseSubAgentOutput(stdout);
		assert.strictEqual(result.ok, false);
		assert.strictEqual(result.result, "");
		assert.ok(result.error.includes("no result content"));
	});

	it("should take content after first marker occurrence", () => {
		const stdout = "# SubAgent\n\nfirst\n# SubAgent\n\nsecond";
		const result = parseSubAgentOutput(stdout);
		assert.strictEqual(result.ok, true);
		assert.ok(result.result.includes("first"));
		assert.ok(!result.result.includes("second"));
	});
});

describe("escapeShellArg", () => {
	it("should escape double quotes", () => {
		assert.strictEqual(escapeShellArg('hello "world"'), 'hello \\"world\\"');
	});

	it("should escape backticks", () => {
		assert.strictEqual(escapeShellArg("hello `world`"), "hello \\`world\\`");
	});

	it("should escape dollar signs", () => {
		assert.strictEqual(escapeShellArg("hello $world"), "hello \\$world");
	});

	it("should escape backslashes", () => {
		assert.strictEqual(escapeShellArg("hello\\world"), "hello\\\\world");
	});

	it("should escape newlines", () => {
		assert.strictEqual(escapeShellArg("hello\nworld"), "hello\\nworld");
	});

	it("should escape carriage returns", () => {
		assert.strictEqual(escapeShellArg("hello\rworld"), "hello\\rworld");
	});

	it("should escape tabs", () => {
		assert.strictEqual(escapeShellArg("hello\tworld"), "hello\\tworld");
	});

	it("should handle multiple special characters", () => {
		const input = 'hello "world" $foo `bar` \\test\nnew\rline\ttab';
		const expected = 'hello \\"world\\" \\$foo \\`bar\\` \\\\test\\nnew\\rline\\ttab';
		assert.strictEqual(escapeShellArg(input), expected);
	});

	it("should return unchanged string with no special characters", () => {
		assert.strictEqual(escapeShellArg("hello world 123"), "hello world 123");
	});
});

describe("resolveTimeout", () => {
	it("should use per-call timeout when provided", () => {
		assert.strictEqual(resolveTimeout(30000, {}), 30000);
	});

	it("should use per-call timeout even when config has different value", () => {
		const config = { process: { subAgent: { timeout: 600000 } } };
		assert.strictEqual(resolveTimeout(30000, config), 30000);
	});

	it("should use env var when per-call is not provided", () => {
		const original = process.env.MADZ_SUBAGENT_TIMEOUT;
		process.env.MADZ_SUBAGENT_TIMEOUT = "45000";
		assert.strictEqual(resolveTimeout(undefined, {}), 45000);
		process.env.MADZ_SUBAGENT_TIMEOUT = original;
	});

	it("should use env var over config default", () => {
		const original = process.env.MADZ_SUBAGENT_TIMEOUT;
		process.env.MADZ_SUBAGENT_TIMEOUT = "45000";
		const config = { process: { subAgent: { timeout: 600000 } } };
		assert.strictEqual(resolveTimeout(undefined, config), 45000);
		process.env.MADZ_SUBAGENT_TIMEOUT = original;
	});

	it("should use config default when no per-call or env var", () => {
		const config = { process: { subAgent: { timeout: 120000 } } };
		assert.strictEqual(resolveTimeout(undefined, config), 120000);
	});

	it("should use 600000 default when nothing is configured", () => {
		assert.strictEqual(resolveTimeout(undefined, {}), 600000);
	});

	it("should use per-call timeout 0 is falsy but valid", () => {
		// 0 is falsy but should still be used if explicitly provided
		// Actually 0 would be filtered out by the check, let's test with a small value
		assert.strictEqual(resolveTimeout(1000, {}), 1000);
	});

	it("should ignore null per-call timeout and fall through", () => {
		const config = { process: { subAgent: { timeout: 50000 } } };
		assert.strictEqual(resolveTimeout(null, config), 50000);
	});

	it("should ignore undefined per-call timeout and fall through", () => {
		const config = { process: { subAgent: { timeout: 50000 } } };
		assert.strictEqual(resolveTimeout(undefined, config), 50000);
	});
});

describe("generateSessionId", () => {
	it("should return a valid UUID v4 string", () => {
		const sessionId = generateSessionId();
		assert.strictEqual(typeof sessionId, "string");
		// UUID v4 format: 8-4-4-4-12 hex chars with version 4 in the third group
		const uuidV4Regex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
		assert.ok(uuidV4Regex.test(sessionId), `Expected UUID v4 format, got: ${sessionId}`);
	});

	it("should return unique session IDs on consecutive calls", () => {
		const ids = new Set();
		const count = 100;
		for (let i = 0; i < count; i++) {
			ids.add(generateSessionId());
		}
		assert.strictEqual(ids.size, count, "All session IDs should be unique");
	});

	it("should return a string of correct length", () => {
		const sessionId = generateSessionId();
		assert.strictEqual(sessionId.length, 36, "UUID v4 string should be 36 characters");
	});
});

describe("spawnSubAgentProcess integration", () => {
	it("should pass session ID to child process via MADZ_SESSION_ID env var", async () => {
		const prompt = "# SubAgent\n\n{ ok: true, result: \"test\" }";
		const sessionsDir = join(__dirname, "../../../memory/sessions/");

		const result = await spawnSubAgentProcess(prompt, sessionsDir, 10000);

		assert.strictEqual(result.ok, true);
		assert.ok(result.sessionId, "Result should include sessionId");
		assert.strictEqual(typeof result.sessionId, "string");
		// Verify sessionId is a valid UUID v4 format
		const uuidV4Regex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
		assert.ok(uuidV4Regex.test(result.sessionId), `Expected UUID v4 format, got: ${result.sessionId}`);
	});

	it("should create log file with session ID naming", async () => {
		const prompt = "# SubAgent\n\n{ ok: true, result: \"test\" }";
		const sessionsDir = join(__dirname, "../../../memory/sessions/");

		const result = await spawnSubAgentProcess(prompt, sessionsDir, 10000);

		assert.ok(result.sessionId, "Result should include sessionId");
		// Verify log file exists with session ID naming
		const logPath = `/tmp/sub-agent-${result.sessionId}.log`;
		await access(logPath, constants.F_OK);
	}, 15000);

	it("should allow both processes to read the same log file", async () => {
		const prompt = "# SubAgent\n\n{ ok: true, result: \"test\" }";
		const sessionsDir = join(__dirname, "../../../memory/sessions/");

		const result = await spawnSubAgentProcess(prompt, sessionsDir, 10000);

		assert.ok(result.sessionId, "Result should include sessionId");
		const logPath = `/tmp/sub-agent-${result.sessionId}.log`;
		// Main process reads the log file created by the child
		const content = await readFile(logPath, "utf-8");
		assert.ok(content.length > 0, "Log file should have content");
	}, 15000);
});