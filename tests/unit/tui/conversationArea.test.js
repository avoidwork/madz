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

describe("decideLoopAction", () => {
	const base = {
		loopDetected: true,
		streamingMsgId: "3",
		lastMessageId: "3",
		nudges: [],
		now: 100000,
		escalationCount: 3,
		escalationWindowMs: 60000,
	};

	it("nudges when the detector flagged the last bubble and there are no recent nudges", async () => {
		const mod = await import("../../../src/tui/conversationArea.js");
		assert.deepStrictEqual(mod.decideLoopAction(base), { action: "nudge", nudges: [100000] });
	});

	it("does nothing when no loop was detected", async () => {
		const mod = await import("../../../src/tui/conversationArea.js");
		assert.strictEqual(mod.decideLoopAction({ ...base, loopDetected: false }).action, "none");
		assert.strictEqual(mod.decideLoopAction({ ...base, loopDetected: undefined }).action, "none");
	});

	it("does nothing when the streaming bubble is not the last message", async () => {
		const mod = await import("../../../src/tui/conversationArea.js");
		assert.strictEqual(mod.decideLoopAction({ ...base, lastMessageId: "4" }).action, "none");
	});

	it("records each nudge and keeps nudging below the escalation count", async () => {
		const mod = await import("../../../src/tui/conversationArea.js");
		const out = mod.decideLoopAction({ ...base, nudges: [90000, 95000] });
		assert.strictEqual(out.action, "nudge");
		assert.deepStrictEqual(out.nudges, [90000, 95000, 100000]);
	});

	it("compacts instead of nudging once escalationCount nudges fall within the window", async () => {
		const mod = await import("../../../src/tui/conversationArea.js");
		const out = mod.decideLoopAction({ ...base, nudges: [80000, 90000, 95000] });
		assert.strictEqual(out.action, "compact");
		assert.deepStrictEqual(out.nudges, [], "counter resets after escalation");
	});

	it("drops nudges older than the window so a slow loop does not escalate", async () => {
		const mod = await import("../../../src/tui/conversationArea.js");
		// Two of the three are outside the 60s window.
		const out = mod.decideLoopAction({ ...base, nudges: [10000, 20000, 95000] });
		assert.strictEqual(out.action, "nudge");
		assert.deepStrictEqual(out.nudges, [95000, 100000]);
	});

	it("treats a nudge exactly at the window edge as still inside it", async () => {
		const mod = await import("../../../src/tui/conversationArea.js");
		const out = mod.decideLoopAction({ ...base, nudges: [40000, 41000, 42000] });
		assert.strictEqual(out.action, "compact");
	});

	it("leaves the nudge timestamps untouched when it does nothing", async () => {
		const mod = await import("../../../src/tui/conversationArea.js");
		const nudges = [90000];
		assert.strictEqual(
			mod.decideLoopAction({ ...base, loopDetected: false, nudges }).nudges,
			nudges,
		);
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
