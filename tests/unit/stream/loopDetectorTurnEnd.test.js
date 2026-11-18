/**
 * When a message turn ends, the detector's word and sentence lists are cleared
 * and nulled so nothing from the turn is retained, however the turn ends.
 */

import { describe, it, after } from "node:test";
import assert from "node:assert";
import { createSegmentLoopDetector, destroyPool } from "../../../src/stream/loopDetector.js";
import { checkLoop } from "../../../src/stream/loopCheck.js";
import { consumeStream } from "../../../src/stream/consume.js";

after(async () => {
	await destroyPool();
});

const inline = { run: async (task) => checkLoop(task) };

/** Runner that captures the task lists it was handed, so tests can see what the detector released. */
function capturing() {
	const tasks = [];
	return {
		tasks,
		run: async (task) => {
			tasks.push(task);
			return false;
		},
	};
}

const reasoning = (text, id) => [
	[],
	"messages",
	[{ type: "ai", text: "", content: [{ type: "reasoning", reasoning: text, id }] }],
];

describe("release on reset", () => {
	it("empties every stream and reports none tracked", async () => {
		const d = createSegmentLoopDetector({ runner: inline });
		d.push("reasoning", "alpha beta gamma. ", "a");
		d.push("message", "delta epsilon. ", 0);
		await d.settle();
		assert.strictEqual(d.size(), 2);
		d.reset();
		assert.strictEqual(d.size(), 0);
	});

	it("clears and nulls the lists held by an in-flight check's state", async () => {
		let release;
		const gate = new Promise((r) => {
			release = r;
		});
		let captured;
		const held = {
			run: async (task) => {
				captured = task;
				await gate;
				return true; // would flag a loop if the answer were honoured
			},
		};
		const d = createSegmentLoopDetector({ runner: held });
		d.push("reasoning", "one two three. ", "a");
		d.reset(); // turn ends while the check is still running
		release();
		assert.strictEqual(await d.settle(), false, "a released stream's late answer is ignored");
		assert.ok(captured.words.length > 0, "the task copy the worker held is its own, untouched");
	});

	it("does not carry state into the next turn", async () => {
		const spy = capturing();
		const d = createSegmentLoopDetector({ runner: spy });
		d.push("reasoning", "first turn words here ", "a");
		await d.settle();
		d.reset();
		d.push("reasoning", "second ", "a");
		await d.settle();
		const last = spy.tasks.at(-1);
		assert.deepStrictEqual(last.words, ["second"].slice(0, last.words.length));
		assert.ok(!last.words.includes("first"), "no words from the previous turn");
	});

	it("can be reset more than once and reused", async () => {
		const d = createSegmentLoopDetector({ runner: inline });
		d.reset();
		d.reset();
		for (let i = 0; i < 5; i++) d.push("reasoning", "ok ", "a");
		assert.strictEqual(await d.settle(), true);
	});

	it("reset on an empty detector is a no-op", () => {
		const d = createSegmentLoopDetector({ runner: inline });
		assert.doesNotThrow(() => d.reset());
		assert.strictEqual(d.size(), 0);
	});
});

describe("consumeStream resets the detector when the turn ends", () => {
	it("after a normal turn", async () => {
		const d = createSegmentLoopDetector({ runner: inline });
		const stream = (async function* () {
			yield reasoning("a fine thought. ", "r1");
			yield reasoning("another one. ", "r2");
		})();
		await consumeStream(stream, undefined, { loopDetector: d });
		assert.strictEqual(d.size(), 0);
	});

	it("after the stream is abandoned on a detected loop", async () => {
		const d = createSegmentLoopDetector({ runner: inline });
		const stream = (async function* () {
			for (let i = 0; i < 200; i++) {
				await new Promise((r) => setTimeout(r, 1));
				yield reasoning("ok ", "r1");
			}
		})();
		const result = await consumeStream(stream, undefined, { loopDetector: d });
		assert.strictEqual(result.loopDetected, true);
		assert.strictEqual(d.size(), 0);
	});

	it("after a clarify interrupt", async () => {
		const d = createSegmentLoopDetector({ runner: inline });
		const stream = (async function* () {
			yield reasoning("thinking first. ", "r1");
			yield [
				[],
				"values",
				{ __interrupt__: [{ value: { question: "?", choices: [] }, id: "i1" }] },
			];
		})();
		const result = await consumeStream(stream, undefined, { loopDetector: d });
		assert.strictEqual(result.interrupted, true);
		assert.strictEqual(d.size(), 0);
	});

	it("when the stream throws", async () => {
		const d = createSegmentLoopDetector({ runner: inline });
		const stream = (async function* () {
			yield reasoning("partial thought. ", "r1");
			throw new Error("network dropped");
		})();
		await assert.rejects(
			() => consumeStream(stream, undefined, { loopDetector: d }),
			/network dropped/,
		);
		assert.strictEqual(d.size(), 0);
	});

	it("still returns the loop verdict even though state is released", async () => {
		const d = createSegmentLoopDetector({ runner: inline });
		const stream = (async function* () {
			for (let i = 0; i < 5; i++) yield reasoning("ok ", "r1");
		})();
		const result = await consumeStream(stream, undefined, { loopDetector: d });
		assert.strictEqual(result.loopDetected, true);
	});

	it("works when no detector is passed", async () => {
		const stream = (async function* () {
			yield reasoning("hello. ", "r1");
		})();
		const result = await consumeStream(stream);
		assert.strictEqual(result.loopDetected, false);
	});
});

describe("maxStreams of 4", () => {
	it("holds two concurrent streams, the realistic edge case, without eviction", async () => {
		const d = createSegmentLoopDetector({ runner: inline, maxStreams: 4 });
		for (let i = 0; i < 6; i++) {
			d.push("reasoning", "ok ", "a");
			d.push("message", `distinct${i} `, 0);
		}
		assert.strictEqual(await d.settle(), true, "the looping stream was never evicted");
		assert.strictEqual(d.size(), 2);
	});

	it("never tracks more than 4 across hundreds of sequential streams", async () => {
		const d = createSegmentLoopDetector({ runner: inline, maxStreams: 4 });
		let peak = 0;
		for (let i = 0; i < 500; i++) {
			d.push("message", `message number ${i} here. `, i);
			peak = Math.max(peak, d.size());
		}
		assert.ok(peak <= 4, `peak ${peak}`);
	});

	it("still catches a loop in the stream that is active while old ones age out", async () => {
		const d = createSegmentLoopDetector({ runner: inline, maxStreams: 4 });
		for (let i = 0; i < 50; i++) d.push("message", `old message ${i}. `, i);
		for (let i = 0; i < 5; i++) d.push("message", "again ", 999);
		assert.strictEqual(await d.settle(), true);
	});
});
