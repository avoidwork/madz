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

describe("countToolMessageTokens", () => {
	it("should return 0 for empty text", async () => {
		const mod = await import("../../../src/tui/conversationArea.js");
		assert.strictEqual(await mod.countToolMessageTokens({}, ""), 0);
	});

	it("should return 0 when the model has no tokenizer", async () => {
		const mod = await import("../../../src/tui/conversationArea.js");
		assert.strictEqual(await mod.countToolMessageTokens({}, "some tool text"), 0);
	});

	it("should count tokens via the model tokenizer", async () => {
		const mod = await import("../../../src/tui/conversationArea.js");
		const model = {
			getNumTokensFromMessages: async (_messages) => ({ totalCount: 42 }),
		};
		assert.strictEqual(await mod.countToolMessageTokens(model, "tool output"), 42);
	});

	it("should return 0 when the model tokenizer returns no totalCount", async () => {
		const mod = await import("../../../src/tui/conversationArea.js");
		const model = {
			getNumTokensFromMessages: async () => ({}),
		};
		assert.strictEqual(await mod.countToolMessageTokens(model, "tool output"), 0);
	});
});

describe("shouldAutoContinue", () => {
	it("returns true when the last bubble ends on reasoning and the guard is not exhausted", async () => {
		const mod = await import("../../../src/tui/conversationArea.js");
		assert.strictEqual(
			mod.shouldAutoContinue({
				lastEventType: "reasoning",
				streamingMsgId: "3",
				lastMessageId: "3",
				autoContinueCount: 0,
				autoContinueLimit: 1000,
			}),
			true,
		);
	});

	it("returns false when the last event is not reasoning", async () => {
		const mod = await import("../../../src/tui/conversationArea.js");
		assert.strictEqual(
			mod.shouldAutoContinue({
				lastEventType: "message",
				streamingMsgId: "3",
				lastMessageId: "3",
				autoContinueCount: 0,
				autoContinueLimit: 1000,
			}),
			false,
		);
	});

	it("returns false when the streaming bubble is not the last", async () => {
		const mod = await import("../../../src/tui/conversationArea.js");
		assert.strictEqual(
			mod.shouldAutoContinue({
				lastEventType: "reasoning",
				streamingMsgId: "2",
				lastMessageId: "3",
				autoContinueCount: 0,
				autoContinueLimit: 1000,
			}),
			false,
		);
	});

	it("returns false when the loop guard is exhausted", async () => {
		const mod = await import("../../../src/tui/conversationArea.js");
		assert.strictEqual(
			mod.shouldAutoContinue({
				lastEventType: "reasoning",
				streamingMsgId: "3",
				lastMessageId: "3",
				autoContinueCount: 1000,
				autoContinueLimit: 1000,
			}),
			false,
		);
	});

	it("returns true when the turn ends on a tool message", async () => {
		const mod = await import("../../../src/tui/conversationArea.js");
		for (const lastEventType of ["tool", "on_tool_end"]) {
			assert.strictEqual(
				mod.shouldAutoContinue({
					lastEventType,
					streamingMsgId: "3",
					lastMessageId: "3",
					autoContinueCount: 0,
					autoContinueLimit: 1000,
				}),
				true,
			);
		}
	});

	it("returns false when the turn ends on a tool start", async () => {
		const mod = await import("../../../src/tui/conversationArea.js");
		assert.strictEqual(
			mod.shouldAutoContinue({
				lastEventType: "on_tool_start",
				streamingMsgId: "3",
				lastMessageId: "3",
				autoContinueCount: 0,
				autoContinueLimit: 1000,
			}),
			false,
		);
	});

	it("returns false when the turn was interrupted", async () => {
		const mod = await import("../../../src/tui/conversationArea.js");
		assert.strictEqual(
			mod.shouldAutoContinue({
				lastEventType: "tool",
				interrupted: true,
				streamingMsgId: "3",
				lastMessageId: "3",
				autoContinueCount: 0,
				autoContinueLimit: 1000,
			}),
			false,
		);
	});

	it("returns false when lastEventType is undefined", async () => {
		const mod = await import("../../../src/tui/conversationArea.js");
		assert.strictEqual(
			mod.shouldAutoContinue({
				lastEventType: undefined,
				streamingMsgId: "3",
				lastMessageId: "3",
				autoContinueCount: 0,
				autoContinueLimit: 1000,
			}),
			false,
		);
	});
});
