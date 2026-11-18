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

describe("shouldContinueAfterCompact", () => {
	it("continues after a successful compaction", async () => {
		const mod = await import("../../../src/tui/conversationArea.js");
		assert.strictEqual(
			mod.shouldContinueAfterCompact({
				compacted: true,
				autoContinueCount: 0,
				autoContinueLimit: 1000,
			}),
			true,
		);
	});

	it("does not continue after a failed compaction", async () => {
		const mod = await import("../../../src/tui/conversationArea.js");
		for (const compacted of [false, undefined, null]) {
			assert.strictEqual(
				mod.shouldContinueAfterCompact({
					compacted,
					autoContinueCount: 0,
					autoContinueLimit: 1000,
				}),
				false,
				`compacted ${compacted}`,
			);
		}
	});

	it("stops once the shared auto-continue limit is reached", async () => {
		const mod = await import("../../../src/tui/conversationArea.js");
		assert.strictEqual(
			mod.shouldContinueAfterCompact({
				compacted: true,
				autoContinueCount: 999,
				autoContinueLimit: 1000,
			}),
			true,
		);
		assert.strictEqual(
			mod.shouldContinueAfterCompact({
				compacted: true,
				autoContinueCount: 1000,
				autoContinueLimit: 1000,
			}),
			false,
		);
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

	it("strike 1 nudges", async () => {
		const mod = await import("../../../src/tui/conversationArea.js");
		const out = mod.decideLoopAction({ ...base, nudges: [] });
		assert.strictEqual(out.action, "nudge");
		assert.deepStrictEqual(out.nudges, [100000]);
	});

	it("strike 2 nudges and records both strikes", async () => {
		const mod = await import("../../../src/tui/conversationArea.js");
		const out = mod.decideLoopAction({ ...base, nudges: [95000] });
		assert.strictEqual(out.action, "nudge");
		assert.deepStrictEqual(out.nudges, [95000, 100000]);
	});

	it("strike 3 compacts instead of nudging: three strikes and you're out", async () => {
		const mod = await import("../../../src/tui/conversationArea.js");
		const out = mod.decideLoopAction({ ...base, nudges: [90000, 95000] });
		assert.strictEqual(out.action, "compact");
		assert.deepStrictEqual(out.nudges, [], "the counter resets after compaction");
	});

	it("plays out strikes 1 to 3 in order", async () => {
		const mod = await import("../../../src/tui/conversationArea.js");
		let nudges = [];
		const actions = [];
		for (const now of [100000, 110000, 120000]) {
			const out = mod.decideLoopAction({ ...base, nudges, now });
			actions.push(out.action);
			nudges = out.nudges;
		}
		assert.deepStrictEqual(actions, ["nudge", "nudge", "compact"]);
	});

	it("starts counting again after a compaction", async () => {
		const mod = await import("../../../src/tui/conversationArea.js");
		const afterCompact = mod.decideLoopAction({ ...base, nudges: [90000, 95000] }).nudges;
		const next = mod.decideLoopAction({ ...base, nudges: afterCompact, now: 130000 });
		assert.strictEqual(next.action, "nudge", "the next loop is strike 1 again");
	});

	it("drops strikes older than the window so a slow loop does not escalate", async () => {
		const mod = await import("../../../src/tui/conversationArea.js");
		// Two earlier strikes are outside the 60s window, so this is strike 1 again.
		const out = mod.decideLoopAction({ ...base, nudges: [10000, 20000] });
		assert.strictEqual(out.action, "nudge");
		assert.deepStrictEqual(out.nudges, [100000]);
	});

	it("counts only the strikes inside the window", async () => {
		const mod = await import("../../../src/tui/conversationArea.js");
		// One old strike, one recent: this loop is only strike 2.
		const out = mod.decideLoopAction({ ...base, nudges: [10000, 95000] });
		assert.strictEqual(out.action, "nudge");
		assert.deepStrictEqual(out.nudges, [95000, 100000]);
	});

	it("treats a strike exactly at the window edge as still inside it", async () => {
		const mod = await import("../../../src/tui/conversationArea.js");
		const out = mod.decideLoopAction({ ...base, nudges: [40000, 41000] });
		assert.strictEqual(out.action, "compact");
	});

	it("honours a different escalationCount", async () => {
		const mod = await import("../../../src/tui/conversationArea.js");
		assert.strictEqual(mod.decideLoopAction({ ...base, escalationCount: 1 }).action, "compact");
		assert.strictEqual(
			mod.decideLoopAction({ ...base, escalationCount: 2, nudges: [95000] }).action,
			"compact",
		);
		assert.strictEqual(
			mod.decideLoopAction({ ...base, escalationCount: 5, nudges: [91000, 92000, 93000] }).action,
			"nudge",
		);
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
