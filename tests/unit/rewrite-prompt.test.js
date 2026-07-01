/**
 * Tests for the rewrite-prompt skill.
 * @module tests/unit/rewrite-prompt
 */

import { describe, it } from "node:test";
import assert from "node:assert";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const SCRIPT_PATH = join(__dirname, "../../system-skills/rewrite-prompt/scripts/rewrite-prompt.js");

/**
 * Spawns the rewrite-prompt script with the given input and arguments.
 * @param {string} input — The prompt text to send via stdin.
 * @param {string[]} args — Additional command-line arguments.
 * @returns {Promise<{stdout: string, stderr: string, exitCode: number}>}
 */
function runRewritePrompt(input, args = []) {
	return new Promise((resolve) => {
		const proc = spawn("node", [SCRIPT_PATH, ...args], {
			env: { ...process.env, NODE_ENV: "test" },
		});

		let stdout = "";
		let stderr = "";

		proc.stdout.on("data", (chunk) => {
			stdout += chunk.toString();
		});

		proc.stderr.on("data", (chunk) => {
			stderr += chunk.toString();
		});

		proc.on("close", (code) => {
			resolve({ stdout: stdout.trim(), stderr: stderr.trim(), exitCode: code });
		});

		proc.stdin.write(input);
		proc.stdin.end();
	});
}

describe("rewrite-prompt", () => {
	it("should return error for empty input", async () => {
		const result = await runRewritePrompt("");
		assert.strictEqual(result.exitCode, 1);
		assert.ok(result.stderr.includes("Error"));
		assert.ok(result.stderr.includes("No input provided"));
	});

	it("should return error for whitespace-only input", async () => {
		const result = await runRewritePrompt("   \n\n  ");
		assert.strictEqual(result.exitCode, 1);
		assert.ok(result.stderr.includes("Error"));
	});

	it("should rewrite a vague prompt with added context", async () => {
		const result = await runRewritePrompt("write code for a list");
		assert.strictEqual(result.exitCode, 0);
		assert.ok(result.stdout.length > 0);
		assert.ok(result.stdout.includes("Context"));
		assert.ok(result.stdout.includes("Task"));
		assert.ok(result.stdout.includes("Constraints"));
		assert.ok(result.stdout.includes("Output"));
	});

	it("should restructure an unstructured prompt into clear format", async () => {
		const result = await runRewritePrompt(
			"i need you to help me make something that can take a bunch of numbers and sort them in a way that makes sense and maybe also show me the top 5 or something",
		);
		assert.strictEqual(result.exitCode, 0);
		assert.ok(result.stdout.includes("Context"));
		assert.ok(result.stdout.includes("Task"));
		assert.ok(result.stdout.includes("sort"));
	});

	it("should minimally modify an already-structured prompt", async () => {
		const structuredPrompt = `Context: Building a Node.js API
Task: Create a REST endpoint
Constraints: Must use Express
Output: Code example`;
		const result = await runRewritePrompt(structuredPrompt);
		assert.strictEqual(result.exitCode, 0);
		// Already-structured prompts should be returned as-is
		assert.strictEqual(result.stdout, structuredPrompt);
	});

	it("should process a very long prompt without truncation", async () => {
		const longPrompt = "write code for " + "a ".repeat(500);
		const result = await runRewritePrompt(longPrompt);
		assert.strictEqual(result.exitCode, 0);
		assert.ok(result.stdout.length > 0);
		// The output should contain key elements from the input
		assert.ok(result.stdout.includes("write code"));
	});

	it("should preserve user intent through rewriting", async () => {
		const result = await runRewritePrompt("create a function that sorts an array");
		assert.strictEqual(result.exitCode, 0);
		// The rewritten prompt should still contain the core action
		assert.ok(
			result.stdout.toLowerCase().includes("sort") ||
				result.stdout.toLowerCase().includes("function") ||
				result.stdout.toLowerCase().includes("array"),
		);
	});

	it("should handle file argument input", async () => {
		const fs = await import("node:fs");
		const os = await import("node:os");
		const tmpFile = join(os.tmpdir(), "rewrite-prompt-test-input.txt");
		const testPrompt = "write a hello world function";

		try {
			fs.writeFileSync(tmpFile, testPrompt, "utf-8");
			const result = await runRewritePrompt("", [tmpFile]);
			assert.strictEqual(result.exitCode, 0);
			assert.ok(result.stdout.length > 0);
		} finally {
			fs.rmSync(tmpFile, { force: true });
		}
	});

	it("should handle non-existent file argument", async () => {
		const result = await runRewritePrompt("", ["/nonexistent/file.txt"]);
		assert.strictEqual(result.exitCode, 1);
		assert.ok(result.stderr.includes("Error"));
	});

	it("should add missing environment context to vague prompts", async () => {
		const result = await runRewritePrompt("build a web app");
		assert.strictEqual(result.exitCode, 0);
		assert.ok(result.stdout.includes("environment"));
	});

	it("should add missing constraint context to vague prompts", async () => {
		const result = await runRewritePrompt("make it fast");
		assert.strictEqual(result.exitCode, 0);
		assert.ok(result.stdout.includes("constraint"));
	});

	it("should add missing output format context to vague prompts", async () => {
		const result = await runRewritePrompt("explain how sorting works");
		assert.strictEqual(result.exitCode, 0);
		assert.ok(result.stdout.includes("output"));
	});
});
