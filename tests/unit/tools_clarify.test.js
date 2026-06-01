import { describe, it, after } from "node:test";
import assert from "node:assert";
import { rmSync, existsSync } from "node:fs";
import { join } from "node:path";
import { clarifyImpl } from "../../src/tools/clarify.js";

const TEST_DIR = join(process.cwd(), "memory", "__test_clarify__");
const CLARIFICATION_FILE = join(TEST_DIR, "clarifications.md");

function setup() {
	rmSync(TEST_DIR, { recursive: true, force: true });
}

function teardown() {
	rmSync(TEST_DIR, { recursive: true, force: true });
}

describe("clarify", () => {
	const testOptions = {
		allowedPaths: [],
		maxReadSize: "1mb",
		clarificationsFile: "./memory/__test_clarify__/clarifications.md",
	};

	it("returns open_ended when no choices provided", async () => {
		const result = await clarifyImpl({ question: "What is your name?" }, testOptions);
		const parsed = JSON.parse(result);
		assert.strictEqual(parsed.answered, true);
		assert.strictEqual(parsed.source, "open_ended");
	});

	it("returns choices when choices array provided", async () => {
		const result = await clarifyImpl(
			{ question: "Which language?", choices: ["Python", "JavaScript"] },
			testOptions,
		);
		const parsed = JSON.parse(result);
		assert.strictEqual(parsed.answered, true);
		assert.strictEqual(parsed.source, "choices");
	});

	it("creates clarifications file", async () => {
		setup();
		await clarifyImpl(
			{
				question: "Test question",
				choices: ["A", "B"],
			},
			testOptions,
		);
		assert.strictEqual(existsSync(CLARIFICATION_FILE), true);
	});

	after(teardown);
});
