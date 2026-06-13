import { describe, it } from "node:test";
import assert from "node:assert";
import {
	isContextLengthError,
	extractContextLength,
	compactConversation,
	createCompactContextTool,
} from "../../src/tools/compactContext.js";
import { buildToolConfig } from "../../src/tools/index.js";

describe("compactContext - error detection", () => {
	it("detects OpenAI-style context length error", () => {
		const err = new Error("This model's maximum context length is 128000 tokens");
		assert.strictEqual(isContextLengthError(err), true);
	});

	it("detects variant error format with 'of'", () => {
		const err = new Error("maximum context length of 8192 tokens exceeded");
		assert.strictEqual(isContextLengthError(err), true);
	});

	it("detects variant error format with 'limit'", () => {
		const err = new Error("maximum context length exceeded (limit: 4096)");
		assert.strictEqual(isContextLengthError(err), true);
	});

	it("does not match non-context-length 400 errors", () => {
		const err = new Error("Invalid API key");
		assert.strictEqual(isContextLengthError(err), false);
	});

	it("does not match other errors", () => {
		const err = new Error("Rate limit exceeded");
		assert.strictEqual(isContextLengthError(err), false);
	});

	it("handles null/undefined input gracefully", () => {
		assert.strictEqual(isContextLengthError(null), false);
		assert.strictEqual(isContextLengthError(undefined), false);
		assert.strictEqual(isContextLengthError({}), false);
	});
});

describe("compactContext - extractContextLength", () => {
	it("extracts context length from OpenAI format", () => {
		const result = extractContextLength("This model's maximum context length is 128000 tokens");
		assert.strictEqual(result, 128000);
	});

	it("extracts context length from 'of' format", () => {
		const result = extractContextLength("maximum context length of 8192 tokens");
		assert.strictEqual(result, 8192);
	});

	it("extracts context length from 'limit' format", () => {
		const result = extractContextLength("maximum context length exceeded (limit: 4096)");
		assert.strictEqual(result, 4096);
	});

	it("returns null when no match", () => {
		const result = extractContextLength("Invalid API key");
		assert.strictEqual(result, null);
	});

	it("returns null for empty string", () => {
		const result = extractContextLength("");
		assert.strictEqual(result, null);
	});

	it("returns null for null input", () => {
		const result = extractContextLength(null);
		assert.strictEqual(result, null);
	});
});

describe("compactContext - compactConversation", () => {
	it("returns empty result for empty conversation", () => {
		const result = compactConversation({
			systemPrompt: "You are helpful.",
			conversation: [],
			targetTokens: 50000,
		});
		assert.strictEqual(result.ok, true);
		assert.strictEqual(result.compactedMessages.length, 0);
	});

	it("retains recent messages in full (tier 1)", () => {
		const conversation = [
			{ role: "user", content: "Hello" },
			{ role: "assistant", content: "Hi there!" },
			{ role: "user", content: "How are you?" },
			{ role: "assistant", content: "I'm doing well, thanks!" },
			{ role: "user", content: "What's the weather?" },
			{ role: "assistant", content: "I can't check weather." },
		];

		const result = compactConversation({
			systemPrompt: "You are helpful.",
			conversation,
			targetTokens: 50000,
			recentCount: 3,
			summarizeWindow: 0,
		});

		assert.strictEqual(result.ok, true);
		// Should have system prompt + 3 full exchanges (6 messages)
		assert.ok(
			result.compactedMessages.length >= 7,
			`Expected at least 7 messages, got ${result.compactedMessages.length}`,
		);
	});

	it("summarizes older exchanges (tier 2)", () => {
		const conversation = [];
		// Create 15 exchanges
		for (let i = 0; i < 15; i++) {
			conversation.push(
				{
					role: "user",
					content: `User message ${i}: This is a detailed message with context about task ${i}.`,
				},
				{ role: "assistant", content: `Assistant response ${i}: Here's the answer for task ${i}.` },
			);
		}

		const result = compactConversation({
			systemPrompt: "You are a helpful assistant.",
			conversation,
			targetTokens: 50000,
			recentCount: 3,
			summarizeWindow: 5,
		});

		assert.strictEqual(result.ok, true);
		// Should have system prompt + 3 recent full exchanges + 5 summaries
		assert.ok(result.compactedMessages.length > 1, "Expected some compacted messages");
		// Check that summaries are present
		const summaryMessages = result.compactedMessages.filter(
			(m) => m.content && m.content.includes("[Conversation Summary]"),
		);
		assert.ok(
			summaryMessages.length >= 5,
			`Expected at least 5 summaries, got ${summaryMessages.length}`,
		);
	});

	it("applies fallback for extreme budget constraints", () => {
		const conversation = [
			{ role: "user", content: "Hello" },
			{ role: "assistant", content: "Hi!" },
		];

		// Very small budget
		const result = compactConversation({
			systemPrompt: "You are helpful.",
			conversation,
			targetTokens: 10,
			recentCount: 3,
			summarizeWindow: 10,
		});

		assert.strictEqual(result.ok, true);
		// Should still return something (even if over budget)
		assert.ok(result.compactedMessages.length > 0, "Expected at least one message");
	});

	it("handles conversation with only user messages", () => {
		const conversation = [
			{ role: "user", content: "First message" },
			{ role: "user", content: "Second message" },
		];

		const result = compactConversation({
			systemPrompt: "You are helpful.",
			conversation,
			targetTokens: 50000,
		});

		assert.strictEqual(result.ok, true);
		assert.ok(result.compactedMessages.length > 0);
	});

	it("tracks token counts", () => {
		const conversation = [
			{ role: "user", content: "Hello world" },
			{ role: "assistant", content: "Hi there" },
		];

		const result = compactConversation({
			systemPrompt: "Test prompt.",
			conversation,
			targetTokens: 50000,
		});

		assert.ok(result.originalTokenCount > 0, "Expected original token count > 0");
		assert.ok(result.compactedTokenCount > 0, "Expected compacted token count > 0");
	});

	it("uses minimal retention when tiered approach exceeds budget", () => {
		const conversation = [
			{ role: "user", content: "A".repeat(1000) },
			{ role: "assistant", content: "B".repeat(1000) },
			{ role: "user", content: "C".repeat(1000) },
			{ role: "assistant", content: "D".repeat(1000) },
		];

		const result = compactConversation({
			systemPrompt: "System prompt with some content.",
			conversation,
			targetTokens: 100,
			recentCount: 3,
			summarizeWindow: 10,
		});

		assert.strictEqual(result.ok, true);
		// Should use minimal retention strategy
		assert.ok(
			result.strategy === "minimal-retention" ||
				result.strategy === "minimal-over-budget" ||
				result.strategy === "last-message-only",
			`Expected minimal strategy, got: ${result.strategy}`,
		);
	});
});

describe("compactContext - createCompactContextTool", () => {
	it("returns a LangChain Tool with correct name", () => {
		const toolInstance = createCompactContextTool({});
		assert.strictEqual(toolInstance.name, "compactContext");
	});

	it("returns a LangChain Tool with description", () => {
		const toolInstance = createCompactContextTool({});
		assert.ok(toolInstance.description.length > 10, "Expected a descriptive description");
		assert.ok(
			toolInstance.description.toLowerCase().includes("compaction"),
			"Description should mention compaction",
		);
	});

	it("returns a LangChain Tool with a zod schema", () => {
		const toolInstance = createCompactContextTool({});
		assert.ok(toolInstance.schema, "Expected a schema to be defined");
	});

	it("executes compact action and returns result", async () => {
		const toolInstance = createCompactContextTool({});
		const result = await toolInstance.invoke({
			action: "compact",
			targetTokens: 50000,
		});
		const parsed = JSON.parse(result);
		assert.ok(parsed.ok !== false || !parsed.error, "Expected successful or non-error result");
	});

	it("rejects unknown action", async () => {
		const toolInstance = createCompactContextTool({});
		const result = await toolInstance.invoke({
			action: "unknown",
			targetTokens: 50000,
		});
		const parsed = JSON.parse(result);
		assert.strictEqual(parsed.ok, false);
		assert.ok(parsed.error, "Expected error message for unknown action");
	});

	it("rejects missing targetTokens", async () => {
		const toolInstance = createCompactContextTool({});
		const result = await toolInstance.invoke({
			action: "compact",
		});
		const parsed = JSON.parse(result);
		assert.strictEqual(parsed.ok, false);
		assert.ok(parsed.error, "Expected error for missing targetTokens");
	});

	it("rejects negative targetTokens", async () => {
		const toolInstance = createCompactContextTool({});
		const result = await toolInstance.invoke({
			action: "compact",
			targetTokens: -100,
		});
		const parsed = JSON.parse(result);
		assert.strictEqual(parsed.ok, false);
		assert.ok(parsed.error, "Expected error for negative targetTokens");
	});
});

describe("compactContext - buildToolConfig", () => {
	it("registers compactContext tool without permissions", async () => {
		const tools = await buildToolConfig({ permissions: [] });
		const toolNames = tools.map((t) => t.name);
		assert.ok(
			toolNames.includes("compactContext"),
			`Expected 'compactContext' tool to be registered, got: ${toolNames.join(", ")}`,
		);
	});

	it("registers compactContext with checkpointer option", async () => {
		const tools = await buildToolConfig({
			permissions: [],
			checkpointer: null,
			threadConfig: {},
			systemPrompt: "Test prompt",
		});
		const compactTool = tools.find((t) => t.name === "compactContext");
		assert.ok(compactTool, "Expected compactContext tool to be registered");
	});
});
