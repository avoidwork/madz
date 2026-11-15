import { describe, it } from "node:test";
import assert from "node:assert";
import { AIMessage } from "@langchain/core/messages";
import {
	createLoopDetectionMiddleware,
	extractMessageContent,
	hashContent,
} from "../../../src/provider/loopDetectionMiddleware.js";

const config = (extra = {}) => ({
	enabled: true,
	windowSize: 10,
	threshold: 2,
	escalationCount: 3,
	escalationWindowMs: 60000,
	...extra,
});

const run = (mw, state, thread = "t") =>
	mw.beforeModel.hook(state, { configurable: { thread_id: thread } });

const ai = (text, reasoning) => {
	const msg = new AIMessage(text);
	if (reasoning !== undefined) {
		msg.additional_kwargs = { reasoning_content: reasoning };
	}
	return msg;
};

describe("extractMessageContent", () => {
	it("extracts string content as text", () => {
		assert.deepStrictEqual(extractMessageContent(new AIMessage("hello")), {
			text: "hello",
			reasoning: "",
		});
	});

	it("extracts reasoning from additional_kwargs", () => {
		const msg = new AIMessage("hello");
		msg.additional_kwargs = { reasoning_content: "think" };
		assert.deepStrictEqual(extractMessageContent(msg), { text: "hello", reasoning: "think" });
	});

	it("extracts reasoning from content blocks", () => {
		const msg = new AIMessage([
			{ type: "text", text: "hello" },
			{ type: "reasoning", reasoning: "think" },
		]);
		assert.deepStrictEqual(extractMessageContent(msg), { text: "hello", reasoning: "think" });
	});

	it("returns empty strings for null/empty input", () => {
		assert.deepStrictEqual(extractMessageContent(null), { text: "", reasoning: "" });
		assert.deepStrictEqual(extractMessageContent({}), { text: "", reasoning: "" });
	});
});

describe("hashContent", () => {
	it("hashes identical content identically", () => {
		assert.strictEqual(hashContent("abc"), hashContent("abc"));
	});

	it("returns undefined for empty or non-string content", () => {
		assert.strictEqual(hashContent(""), undefined);
		assert.strictEqual(hashContent(undefined), undefined);
	});
});

describe("createLoopDetectionMiddleware", () => {
	it("returns null when disabled", () => {
		assert.strictEqual(createLoopDetectionMiddleware({ config: { enabled: false } }), null);
	});

	it("is named LoopDetection and uses beforeModel", () => {
		const mw = createLoopDetectionMiddleware({ config: config() });
		assert.strictEqual(mw.name, "LoopDetection");
		assert.strictEqual(typeof mw.beforeModel.hook, "function");
		assert.strictEqual(mw.wrapModelCall, undefined);
	});

	it("does nothing for empty state", async () => {
		const mw = createLoopDetectionMiddleware({ config: config() });
		assert.strictEqual(await run(mw, { messages: [] }), undefined);
	});

	it("does not flag a loop below the threshold", async () => {
		const mw = createLoopDetectionMiddleware({ config: config() });
		// Two identical messages: threshold is 2, so 2 occurrences is NOT > 2.
		assert.strictEqual(await run(mw, { messages: [ai("same")] }), undefined);
		assert.strictEqual(await run(mw, { messages: [ai("same")] }), undefined);
	});

	it("flags a loop above the threshold and injects a nudge", async () => {
		const mw = createLoopDetectionMiddleware({ config: config() });
		await run(mw, { messages: [ai("same")] });
		await run(mw, { messages: [ai("same")] });
		const out = await run(mw, { messages: [ai("same")] });
		assert.ok(out);
		assert.strictEqual(out.messages.length, 1);
		assert.strictEqual(out.messages[0].content, "You're looping");
	});

	it("clears hash windows after injecting a nudge, preventing immediate re-trigger", async () => {
		const mw = createLoopDetectionMiddleware({ config: config() });
		// Build up a loop and inject a nudge.
		await run(mw, { messages: [ai("same")] });
		await run(mw, { messages: [ai("same")] });
		const out = await run(mw, { messages: [ai("same")] });
		assert.ok(out);
		// The model repeats the same phrase on its next turn. Because the hash
		// windows were cleared on injection, this must NOT immediately re-trigger.
		assert.strictEqual(await run(mw, { messages: [ai("same")] }), undefined);
	});

	it("tracks message and reasoning content independently", async () => {
		const mw = createLoopDetectionMiddleware({ config: config() });
		// Same reasoning, different text: reasoning loop should trigger.
		await run(mw, { messages: [ai("a", "think")] });
		await run(mw, { messages: [ai("b", "think")] });
		const out = await run(mw, { messages: [ai("c", "think")] });
		assert.ok(out);
		assert.strictEqual(out.messages[0].content, "You're looping");
	});

	it("does not false-positive on changing content", async () => {
		const mw = createLoopDetectionMiddleware({ config: config() });
		for (const text of ["a", "b", "c", "d", "e"]) {
			assert.strictEqual(await run(mw, { messages: [ai(text)] }), undefined);
		}
	});

	it("evicts the oldest hash when the window is exceeded", async () => {
		const mw = createLoopDetectionMiddleware({ config: config({ windowSize: 3 }) });
		// Fill the window with distinct hashes, then repeat the first one.
		// With windowSize 3, only the last 3 hashes are retained.
		await run(mw, { messages: [ai("x")] });
		await run(mw, { messages: [ai("y")] });
		await run(mw, { messages: [ai("z")] });
		// "x" was evicted; repeating it should not trigger.
		assert.strictEqual(await run(mw, { messages: [ai("x")] }), undefined);
	});

	it("prunes hashes older than the TTL, preventing false positives", async () => {
		let clock = 0;
		const mw = createLoopDetectionMiddleware({
			config: config({ ttlMs: 100 }),
			now: () => clock,
		});
		// Build up 3 occurrences of "same" at t=0.
		await run(mw, { messages: [ai("same")] });
		await run(mw, { messages: [ai("same")] });
		await run(mw, { messages: [ai("same")] });
		// Advance past the TTL; the old hashes are pruned.
		clock = 200;
		// "same" again should NOT trigger, because the old occurrences expired.
		assert.strictEqual(await run(mw, { messages: [ai("same")] }), undefined);
	});

	// Trigger a single loop detection (3 identical messages, since threshold is 2).
	const triggerLoop = async (mw, text = "same") => {
		await run(mw, { messages: [ai(text)] });
		await run(mw, { messages: [ai(text)] });
		return run(mw, { messages: [ai(text)] });
	};

	it("escalates to onCompact after the escalation count within the window", async () => {
		let compacted = 0;
		const mw = createLoopDetectionMiddleware({
			config: config(),
			onCompact: () => {
				compacted++;
			},
		});
		// 3 nudges injected (each clears the hash window), then the 4th loop
		// detection escalates to compaction.
		for (let i = 0; i < 3; i++) {
			assert.ok(await triggerLoop(mw));
		}
		// The 4th loop detection reaches the escalation count and compacts.
		assert.strictEqual(await triggerLoop(mw), undefined);
		assert.strictEqual(compacted, 1);
	});

	it("resets the escalation counter when the window expires", async () => {
		let compacted = 0;
		let clock = 0;
		const mw = createLoopDetectionMiddleware({
			config: config({ escalationWindowMs: 100 }),
			onCompact: () => {
				compacted++;
			},
			now: () => clock,
		});
		// First nudge at t=0.
		assert.ok(await triggerLoop(mw));
		// Advance clock past the window; nudges should be pruned.
		clock = 200;
		// Two more nudges in the new window (below escalationCount 3), so no compaction.
		assert.ok(await triggerLoop(mw));
		assert.ok(await triggerLoop(mw));
		assert.strictEqual(compacted, 0);
	});

	it("does not compact below the escalation count", async () => {
		let compacted = 0;
		const mw = createLoopDetectionMiddleware({
			config: config(),
			onCompact: () => {
				compacted++;
			},
		});
		// Only 2 nudges (below escalationCount 3).
		assert.ok(await triggerLoop(mw));
		assert.ok(await triggerLoop(mw));
		assert.strictEqual(compacted, 0);
	});

	it("survives a throwing onCompact callback", async () => {
		const mw = createLoopDetectionMiddleware({
			config: config(),
			onCompact: () => {
				throw new Error("boom");
			},
		});
		// 3 nudges, then the 4th loop detection escalates; the throwing
		// onCompact must not propagate.
		for (let i = 0; i < 3; i++) {
			assert.ok(await triggerLoop(mw));
		}
		await triggerLoop(mw);
	});

	it("maintains independent state per thread", async () => {
		const mw = createLoopDetectionMiddleware({ config: config() });
		// Thread "a" loops; thread "b" does not.
		await run(mw, { messages: [ai("same")] }, "a");
		await run(mw, { messages: [ai("same")] }, "a");
		const outA = await run(mw, { messages: [ai("same")] }, "a");
		assert.ok(outA);
		assert.strictEqual(await run(mw, { messages: [ai("same")] }, "b"), undefined);
	});
});
