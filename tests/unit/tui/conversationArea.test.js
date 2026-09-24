/**
 * Tests for the ConversationArea component.
 * @see {@link src/tui/conversationArea.js}
 */

import { describe, it } from "node:test";
import assert from "node:assert";

describe("ConversationArea module", () => {
	it("should have a default export", async () => {
		const mod = await import("../../../src/tui/conversationArea.js");
		assert.ok(mod.default);
	});
});

describe("computeContextSize", () => {
	it("includes AGENTS.md in the context count", async () => {
		const mod = await import("../../../src/tui/conversationArea.js");
		const conversation = [{ role: "user", content: "Hello, world!" }];
		const systemPrompt = "You are a helpful assistant.";
		const agentsContent = "# AGENTS.md\n\nProject rules.";
		const withAgents = await mod.computeContextSize({
			conversation,
			systemPrompt,
			agentsContent,
			maxTokens: 0,
			modelName: "gpt-4o",
		});
		const withoutAgents = await mod.computeContextSize({
			conversation,
			systemPrompt,
			agentsContent: undefined,
			maxTokens: 0,
			modelName: "gpt-4o",
		});
		assert.ok(withAgents > withoutAgents, "AGENTS.md should increase the context count");
	});

	it("includes maxTokens in the context count", async () => {
		const mod = await import("../../../src/tui/conversationArea.js");
		const conversation = [{ role: "user", content: "Hello, world!" }];
		const systemPrompt = "You are a helpful assistant.";
		const base = await mod.computeContextSize({
			conversation,
			systemPrompt,
			maxTokens: 0,
			modelName: "gpt-4o",
		});
		const withBudget = await mod.computeContextSize({
			conversation,
			systemPrompt,
			maxTokens: 4096,
			modelName: "gpt-4o",
		});
		assert.strictEqual(withBudget, base + 4096);
	});

	it("handles an absent AGENTS.md gracefully", async () => {
		const mod = await import("../../../src/tui/conversationArea.js");
		const conversation = [{ role: "user", content: "Hello, world!" }];
		const result = await mod.computeContextSize({
			conversation,
			systemPrompt: "You are a helpful assistant.",
			agentsContent: undefined,
			maxTokens: 0,
			modelName: "gpt-4o",
		});
		assert.strictEqual(typeof result, "number");
		assert.ok(result > 0);
	});

	it("adds zero for an unset output budget", async () => {
		const mod = await import("../../../src/tui/conversationArea.js");
		const conversation = [{ role: "user", content: "Hello, world!" }];
		const result = await mod.computeContextSize({
			conversation,
			systemPrompt: "You are a helpful assistant.",
			agentsContent: "# AGENTS.md",
			maxTokens: undefined,
			modelName: "gpt-4o",
		});
		assert.strictEqual(typeof result, "number");
		assert.ok(result > 0);
	});
});

describe("shouldAutoContinue", () => {
	it("should return true when reasoning is present and no message", async () => {
		const mod = await import("../../../src/tui/conversationArea.js");
		const segments = [{ type: "reasoning", content: "Thinking..." }];
		assert.strictEqual(mod.shouldAutoContinue(segments), true);
	});

	it("should return false when a message segment is present", async () => {
		const mod = await import("../../../src/tui/conversationArea.js");
		const segments = [
			{ type: "reasoning", content: "Thinking..." },
			{ type: "message", content: "The answer is 42." },
		];
		assert.strictEqual(mod.shouldAutoContinue(segments), false);
	});

	it("should return false when only reasoning is absent", async () => {
		const mod = await import("../../../src/tui/conversationArea.js");
		const segments = [{ type: "message", content: "Hello." }];
		assert.strictEqual(mod.shouldAutoContinue(segments), false);
	});

	it("should return false for empty or undefined segments", async () => {
		const mod = await import("../../../src/tui/conversationArea.js");
		assert.strictEqual(mod.shouldAutoContinue([]), false);
		assert.strictEqual(mod.shouldAutoContinue(undefined), false);
	});

	it("should return false when no segments exist", async () => {
		const mod = await import("../../../src/tui/conversationArea.js");
		assert.strictEqual(mod.shouldAutoContinue(null), false);
	});
});
