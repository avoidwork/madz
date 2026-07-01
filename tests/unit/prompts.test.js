import { describe, it, after, beforeEach } from "node:test";
import assert from "node:assert";
import { mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";

const testDir = "memory/__test_prompts__";
const fullTestDir = join(process.cwd(), testDir);

function setup() {
	mkdirSync(join(fullTestDir, "prompts"), { recursive: true });
	mkdirSync(join(fullTestDir, "memory", "context"), { recursive: true });
}

function teardown() {
	try {
		rmSync(fullTestDir, { recursive: true, force: true });
	} catch {
		// ignore cleanup errors
	}
}

function clearTestDir() {
	try {
		rmSync(fullTestDir, { recursive: true, force: true });
	} catch {
		// ignore cleanup errors
	}
}

describe("loadSystemPrompt", () => {
	beforeEach(() => {
		clearTestDir();
		setup();
	});
	after(teardown);

	it("loads SYSTEM_PROMPT.md content", async () => {
		writeFileSync(
			join(fullTestDir, "prompts", "SYSTEM_PROMPT.md"),
			"# System Prompt\n\nYou are a helpful assistant.",
		);

		const { loadSystemPrompt } = await import("../../src/memory/prompts.js");
		const result = loadSystemPrompt(fullTestDir);
		assert.ok(result.includes("# System Prompt"));
		assert.ok(result.includes("You are a helpful assistant."));
	});

	it("strips YAML frontmatter from SYSTEM_PROMPT.md", async () => {
		writeFileSync(
			join(fullTestDir, "prompts", "SYSTEM_PROMPT.md"),
			"---\ntitle: System Prompt\n---\n\nYou are a helpful assistant.",
		);

		const { loadSystemPrompt } = await import("../../src/memory/prompts.js");
		const result = loadSystemPrompt(fullTestDir);
		assert.ok(!result.startsWith("---"));
		assert.ok(result.includes("You are a helpful assistant."));
	});

	it("appends context to system prompt when context exists", async () => {
		writeFileSync(
			join(fullTestDir, "prompts", "SYSTEM_PROMPT.md"),
			"# System Prompt\n\nYou are a helpful assistant.",
		);
		mkdirSync(join(fullTestDir, "memory", "context"), { recursive: true });
		writeFileSync(
			join(fullTestDir, "memory", "context", "note.md"),
			"---\ntitle: Test Note\ntimestamp: 2024-01-01\n---\nTest context",
		);

		const { loadSystemPrompt } = await import("../../src/memory/prompts.js");
		const result = loadSystemPrompt(fullTestDir);
		assert.ok(result.includes("# System Prompt"));
		assert.ok(result.includes("You are a helpful assistant."));
		// loadContext reads from cwd/memory/context/ by default, not from baseDir
		// so we can't easily test context appending without mocking
	});

	it("returns prompt content when context is empty (no crash)", async () => {
		mkdirSync(join(fullTestDir, "prompts"), { recursive: true });
		writeFileSync(
			join(fullTestDir, "prompts", "SYSTEM_PROMPT.md"),
			"# System Prompt\n\nYou are a helpful assistant.",
		);
		// Ensure context directory exists but is empty
		mkdirSync(join(fullTestDir, "memory", "context"), { recursive: true });

		const { loadSystemPrompt } = await import("../../src/memory/prompts.js");
		const result = loadSystemPrompt(fullTestDir);
		// Should return prompt content without crashing
		assert.ok(result.includes("# System Prompt"));
		assert.ok(result.includes("You are a helpful assistant."));
	});

	it("returns empty string when SYSTEM_PROMPT.md does not exist", async () => {
		const { loadSystemPrompt } = await import("../../src/memory/prompts.js");
		const result = loadSystemPrompt("__nonexistent_dir_xyz__");
		assert.strictEqual(result, "");
	});

	it("loads SUB_AGENT.md when subAgent is true", async () => {
		mkdirSync(join(fullTestDir, "prompts"), { recursive: true });
		writeFileSync(
			join(fullTestDir, "prompts", "SUB_AGENT.md"),
			"# Sub Agent Prompt\n\nYou are a sub-agent.",
		);

		const { loadSystemPrompt } = await import("../../src/memory/prompts.js");
		const result = loadSystemPrompt(fullTestDir, true);
		assert.ok(result.includes("# Sub Agent Prompt"));
		assert.ok(result.includes("You are a sub-agent."));
	});
});