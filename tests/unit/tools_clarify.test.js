import { describe, it } from "node:test";
import assert from "node:assert";
import { rmSync, existsSync } from "node:fs";
import { join } from "node:path";
import { clarifyImpl } from "../../src/tools/clarify.js";

const testDir = join(process.cwd(), "memory", "context");

describe("clarify", () => {
	it("returns open_ended when no choices provided", async () => {
		const result = await clarifyImpl(
			{ question: "What is your name?" },
			{ allowedPaths: [], maxReadSize: "1mb" },
		);
		const parsed = JSON.parse(result);
		assert.strictEqual(parsed.answered, true);
		assert.strictEqual(parsed.source, "open_ended");
	});

	it("returns choices when choices array provided", async () => {
		const result = await clarifyImpl(
			{ question: "Which language?", choices: ["Python", "JavaScript"] },
			{ allowedPaths: [], maxReadSize: "1mb" },
		);
		const parsed = JSON.parse(result);
		assert.strictEqual(parsed.answered, true);
		assert.strictEqual(parsed.source, "choices");
	});

	it("creates clarifications file", async () => {
		const filePath = join(testDir, "clarifications.md");
		if (existsSync(testDir)) {
			rmSync(testDir, { recursive: true, force: true });
		}
		await clarifyImpl(
			{
				question: "Test question",
				choices: ["A", "B"],
			},
			{ allowedPaths: [], maxReadSize: "1mb" },
		);
		assert.strictEqual(existsSync(filePath), true);
	});
});
