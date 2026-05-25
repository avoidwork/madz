import { describe, it } from "node:test";
import assert from "node:assert";
import { existsSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { loadSystemPrompt } from "../../src/memory/prompts.js";

describe("loadSystemPrompt", () => {
	const testDir = join(process.cwd(), "memory", "_test_prompts");
	const testPromptPath = join(testDir, "prompts", "SYSTEM_PROMPT.md");

	const stubPrompt = "---\ntype: system\n---\n\nYou are a test assistant.";

	it("returns the system prompt content", () => {
		mkdirSync(join(testDir, "prompts"), { recursive: true });
		writeFileSync(testPromptPath, stubPrompt);

		const result = loadSystemPrompt(testDir);
		assert.strictEqual(result, "You are a test assistant.");
	});

	it("strips frontmatter from system prompt", () => {
		mkdirSync(join(testDir, "prompts"), { recursive: true });
		writeFileSync(testPromptPath, "---\ntype: system\nversion: 1\n---\n\nHello world.");

		const result = loadSystemPrompt(testDir);
		assert.strictEqual(result, "Hello world.");
	});

	it("returns content without frontmatter if no frontmatter present", () => {
		mkdirSync(join(testDir, "prompts"), { recursive: true });
		writeFileSync(testPromptPath, "Plain system prompt text.");

		const result = loadSystemPrompt(testDir);
		assert.strictEqual(result, "Plain system prompt text.");
	});

	it("returns empty string when file does not exist", () => {
		mkdirSync(join(testDir, "prompts"), { recursive: true });
		rmSync(testPromptPath, { force: true });

		const result = loadSystemPrompt(testDir);
		assert.strictEqual(result, "");
	});

	it("returns empty string on filesystem error", () => {
		const result = loadSystemPrompt("/nonexistent/fake/path/that/should/not/exist");
		assert.strictEqual(result, "");
	});

	it("handles truncated frontmatter", () => {
		mkdirSync(join(testDir, "prompts"), { recursive: true });
		writeFileSync(testPromptPath, "---\njust broken frontmatter");

		const result = loadSystemPrompt(testDir);
		assert.strictEqual(result, "---\njust broken frontmatter");
	});

	// Cleanup
	it("cleanup", () => {
		if (existsSync(testDir)) {
			rmSync(testDir, { recursive: true, force: true });
		}
	});
});
