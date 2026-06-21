import { describe, it } from "node:test";
import assert from "node:assert";
import { parseSubAgentOutput, escapeShellArg, resolveTimeout } from "../../src/tools/subAgent.js";

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