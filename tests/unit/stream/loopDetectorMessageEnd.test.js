/**
 * A message turn is: start, stream, end. When it ends the detector's word and
 * sentence lists are cleared and nulled, so a long run of hundreds of messages
 * never accumulates state. The end is the chunk carrying a `finish_reason`, a
 * different message id arriving, or a tool result following the AI message.
 */

import { describe, it, after } from "node:test";
import assert from "node:assert";
import { AIMessageChunk, ToolMessage } from "@langchain/core/messages";
import { createSegmentLoopDetector, destroyPool } from "../../../src/stream/loopDetector.js";
import { checkLoop } from "../../../src/stream/loopCheck.js";
import { consumeStream } from "../../../src/stream/consume.js";

after(async () => {
	await destroyPool();
});

const inline = { run: async (task) => checkLoop(task) };
const ev = (msg) => [[], "messages", [msg, {}]];
const think = (id, text, extra = {}) =>
	new AIMessageChunk({ id, content: "", additional_kwargs: { reasoning_content: text }, ...extra });
const say = (id, text, extra = {}) => new AIMessageChunk({ id, content: text, ...extra });

/** A detector that records how many streams it held each time something was pushed. */
function watched() {
	const d = createSegmentLoopDetector({ runner: inline });
	const sizes = [];
	const push = d.push.bind(d);
	d.push = (...args) => {
		const out = push(...args);
		sizes.push(d.size());
		return out;
	};
	const resets = [];
	const reset = d.reset.bind(d);
	d.reset = () => {
		resets.push(d.size());
		return reset();
	};
	return { d, sizes, resets };
}

describe("end of a message turn releases the lists", () => {
	it("releases when the last chunk carries a finish_reason", async () => {
		const { d, resets } = watched();
		const stream = (async function* () {
			yield ev(think("A", "plan it. "));
			yield ev(say("A", "done", { response_metadata: { finish_reason: "stop" } }));
			yield ev(think("B", "next message. "));
		})();
		await consumeStream(stream, undefined, { loopDetector: d });
		assert.ok(
			resets.length >= 2,
			`released at the message end and at the stream end (${resets.length})`,
		);
		assert.ok(resets[0] > 0, "the first release happened while the message's state existed");
	});

	it("releases when a different message id arrives", async () => {
		const { d, sizes } = watched();
		const stream = (async function* () {
			yield ev(think("A", "first thought. "));
			yield ev(think("B", "second thought. ")); // new id, no finish_reason on A
		})();
		await consumeStream(stream, undefined, { loopDetector: d });
		// After B's delta the detector holds only B, because A was released at the id change.
		assert.strictEqual(sizes.at(-1), 1);
	});

	it("releases when a tool result follows the AI message", async () => {
		const { d, resets } = watched();
		const stream = (async function* () {
			yield ev(think("A", "calling a tool. "));
			yield ev(new ToolMessage({ content: "result", tool_call_id: "t1" }));
			yield ev(say("B", "answer"));
		})();
		await consumeStream(stream, undefined, { loopDetector: d });
		assert.ok(resets.length >= 2);
	});

	it("never accumulates across hundreds of sequential messages", async () => {
		const { d, sizes } = watched();
		const stream = (async function* () {
			for (let i = 0; i < 400; i++) {
				yield ev(think(`m${i}`, `reasoning for message ${i}. `));
				yield ev(say(`m${i}`, `answer ${i}`, { response_metadata: { finish_reason: "stop" } }));
			}
		})();
		await consumeStream(stream, undefined, { loopDetector: d });
		assert.ok(Math.max(...sizes) <= 2, `peak tracked ${Math.max(...sizes)}`);
	});

	it("does not carry one message's words into the next", async () => {
		const tasks = [];
		const spy = {
			run: async (task) => {
				tasks.push({ words: [...task.words] });
				return false;
			},
		};
		const d = createSegmentLoopDetector({ runner: spy });
		const stream = (async function* () {
			yield ev(think("A", "alpha beta gamma delta "));
			yield ev(say("A", "x", { response_metadata: { finish_reason: "stop" } }));
			yield ev(think("B", "epsilon zeta "));
		})();
		await consumeStream(stream, undefined, { loopDetector: d });
		const sawBoth = tasks.some((t) => t.words.includes("alpha") && t.words.includes("epsilon"));
		assert.strictEqual(sawBoth, false, "no check mixed message A and message B");
	});
});

describe("a loop is still caught across message boundaries", () => {
	it("flags a loop inside one message", async () => {
		const d = createSegmentLoopDetector({ runner: inline });
		const stream = (async function* () {
			for (let i = 0; i < 200; i++) {
				await new Promise((r) => setTimeout(r, 1));
				yield ev(think("A", "ok "));
			}
		})();
		assert.strictEqual(
			(await consumeStream(stream, undefined, { loopDetector: d })).loopDetected,
			true,
		);
	});

	it("keeps the verdict of a loop in the last deltas of a message that ends right after", async () => {
		const d = createSegmentLoopDetector({ runner: inline });
		const stream = (async function* () {
			yield ev(think("A", "ok "));
			yield ev(think("A", "ok "));
			yield ev(think("A", "ok ", { response_metadata: { finish_reason: "stop" } }));
		})();
		const result = await consumeStream(stream, undefined, { loopDetector: d });
		assert.strictEqual(result.loopDetected, true, "end() read the verdict before releasing");
	});

	it("does not treat the same short answer repeated across separate messages as one loop", async () => {
		const d = createSegmentLoopDetector({ runner: inline });
		const stream = (async function* () {
			for (let i = 0; i < 6; i++) {
				yield ev(say(`m${i}`, "ok ", { response_metadata: { finish_reason: "stop" } }));
			}
		})();
		const result = await consumeStream(stream, undefined, { loopDetector: d });
		assert.strictEqual(result.loopDetected, false);
	});

	it("ignores subagent messages when deciding where a message ends", async () => {
		const { d, resets } = watched();
		const stream = (async function* () {
			yield ev(think("A", "main thought. "));
			yield [
				["tools:abc"],
				"messages",
				[say("S", "sub", { response_metadata: { finish_reason: "stop" } }), {}],
			];
			yield ev(think("A", "still the same message. "));
		})();
		await consumeStream(stream, undefined, { loopDetector: d });
		assert.strictEqual(resets.length, 1, "only the final stream-end release");
	});

	it("still resets once at the end of the stream", async () => {
		const { d, resets } = watched();
		const stream = (async function* () {
			yield ev(think("A", "only message. "));
		})();
		await consumeStream(stream, undefined, { loopDetector: d });
		assert.strictEqual(resets.length, 1);
		assert.strictEqual(d.size(), 0);
	});
});

describe("end()", () => {
	it("returns the verdict and releases", async () => {
		const d = createSegmentLoopDetector({ runner: inline });
		for (let i = 0; i < 5; i++) d.push("reasoning", "ok ", "a");
		assert.strictEqual(await d.end(), true);
		assert.strictEqual(d.size(), 0);
	});

	it("returns false and releases when nothing looped", async () => {
		const d = createSegmentLoopDetector({ runner: inline });
		d.push("reasoning", "a fine thought. ", "a");
		assert.strictEqual(await d.end(), false);
		assert.strictEqual(d.size(), 0);
	});

	it("can be called on an empty detector", async () => {
		const d = createSegmentLoopDetector({ runner: inline });
		assert.strictEqual(await d.end(), false);
	});
});
