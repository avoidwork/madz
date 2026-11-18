/**
 * Detection is restricted to the single stream a delta belongs to. Streams
 * can stream concurrently, so deltas from different streams interleave; state
 * keyed only by kind would mix them. These tests interleave streams on purpose.
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
const detector = (extra = {}) => createSegmentLoopDetector({ runner: inline, ...extra });

describe("per-stream detection", () => {
	it("flags a loop inside one stream", async () => {
		const d = detector();
		for (let i = 0; i < 5; i++) d.push("reasoning", "ok ", "a");
		assert.strictEqual(await d.settle(), true);
	});

	it("does not flag when each stream repeats only below the threshold", async () => {
		const d = detector();
		// 2 copies in stream a and 2 in stream b: 4 combined would trip a shared list.
		for (const id of ["a", "b"]) {
			d.push("reasoning", "Same thing. ", id);
			d.push("reasoning", "Same thing. ", id);
		}
		assert.strictEqual(await d.settle(), false);
	});

	it("is not hidden by another stream interleaving into the stream", async () => {
		const d = detector();
		// Stream a loops on 'ok'; stream b streams unrelated words between every delta.
		// A shared word list would see 'ok w1 ok w2 ok w3 ...' and never find a repeat.
		for (let i = 0; i < 6; i++) {
			d.push("reasoning", "ok ", "a");
			d.push("reasoning", `unrelated${i} `, "b");
		}
		assert.strictEqual(await d.settle(), true);
	});

	it("does not invent a loop from two streams that merely alternate", async () => {
		const d = detector();
		// a says 'x y' and b says 'x y', interleaved, so a shared list reads 'x x y y x x y y'.
		for (let i = 0; i < 4; i++) {
			d.push("reasoning", "x ", `a${i}`);
			d.push("reasoning", "y ", `b${i}`);
		}
		assert.strictEqual(await d.settle(), false);
	});

	it("keeps reasoning and message with the same id separate", async () => {
		const d = detector();
		for (let i = 0; i < 2; i++) {
			d.push("reasoning", "Same thing. ", "0");
			d.push("message", "Same thing. ", "0");
		}
		assert.strictEqual(await d.settle(), false);
	});

	it("keys deltas with no id by kind alone", async () => {
		const d = detector();
		for (let i = 0; i < 5; i++) d.push("reasoning", "ok ");
		assert.strictEqual(await d.settle(), true);
	});

	it("treats a numeric id and its string form as the same stream", async () => {
		const d = detector();
		d.push("message", "ok ", 0);
		d.push("message", "ok ", "0");
		d.push("message", "ok ", 0);
		assert.strictEqual(await d.settle(), true);
	});

	it("treats id 0 as a real stream, not as 'no id'", async () => {
		const d = detector();
		for (let i = 0; i < 3; i++) d.push("reasoning", "ok ", 0);
		for (let i = 0; i < 3; i++) d.push("reasoning", "different ");
		assert.strictEqual(await d.settle(), true, "stream 0 looped");
	});

	it("a word split across deltas stays inside its own stream", async () => {
		const d = detector();
		// Stream a is mid-word when stream b's delta arrives.
		d.push("reasoning", "ok", "a");
		d.push("reasoning", "zzz ", "b");
		d.push("reasoning", " ok", "a");
		d.push("reasoning", " ok ", "a");
		assert.strictEqual(await d.settle(), true);
	});

	it("runs one check per stream, so concurrent streams check at the same time", async () => {
		let running = 0;
		let peak = 0;
		const slow = {
			run: async (task) => {
				running++;
				peak = Math.max(peak, running);
				await new Promise((r) => setTimeout(r, 10));
				running--;
				return checkLoop(task);
			},
		};
		const d = createSegmentLoopDetector({ runner: slow });
		d.push("reasoning", "alpha ", "a");
		d.push("reasoning", "beta ", "b");
		d.push("reasoning", "gamma ", "c");
		await d.settle();
		assert.strictEqual(peak, 3);
	});

	it("still allows only one check at a time within a stream", async () => {
		let running = 0;
		let peak = 0;
		const slow = {
			run: async (task) => {
				running++;
				peak = Math.max(peak, running);
				await new Promise((r) => setTimeout(r, 5));
				running--;
				return checkLoop(task);
			},
		};
		const d = createSegmentLoopDetector({ runner: slow });
		for (let i = 0; i < 30; i++) d.push("reasoning", `word${i} `, "a");
		await d.settle();
		assert.strictEqual(peak, 1);
	});
});

describe("tracked stream limit", () => {
	it("evicts the least recently updated stream past maxStreams", async () => {
		const d = detector({ maxStreams: 2 });
		d.push("reasoning", "ok ok ", "old");
		d.push("reasoning", "x ", "b");
		d.push("reasoning", "y ", "c"); // evicts 'old'
		d.push("reasoning", "ok ", "old"); // starts over: only one 'ok'
		assert.strictEqual(await d.settle(), false);
	});

	it("does not evict a stream that keeps receiving deltas", async () => {
		const d = detector({ maxStreams: 2 });
		d.push("reasoning", "ok ", "busy");
		d.push("reasoning", "x ", "b");
		d.push("reasoning", "ok ", "busy"); // refreshes 'busy'
		d.push("reasoning", "y ", "c"); // evicts 'b', not 'busy'
		d.push("reasoning", "ok ", "busy");
		assert.strictEqual(await d.settle(), true);
	});

	it("bounds memory across many short-lived streams", async () => {
		const seen = new Set();
		const spy = {
			run: async (task) => {
				seen.add(task);
				return false;
			},
		};
		const d = createSegmentLoopDetector({ runner: spy, maxStreams: 16 });
		for (let i = 0; i < 5000; i++) d.push("message", "hello there ", i);
		await d.settle();
		assert.ok(seen.size > 0);
	});

	it("drops a stream's state after ttlMs without touching the others", async () => {
		let clock = 0;
		const d = detector({ ttlMs: 100, now: () => clock });
		d.push("reasoning", "ok ok ", "a");
		clock = 50;
		d.push("reasoning", "ok ok ", "b");
		clock = 120; // a is stale (120 > 100), b is not (70)
		d.push("reasoning", "ok ", "a");
		d.push("reasoning", "ok ", "b");
		assert.strictEqual(await d.settle(), true, "b kept its history and reached 3");
	});
});

describe("consumeStream passes each stream's id to the detector", () => {
	const reasoningBlock = (id, text) => [
		[],
		"messages",
		[{ type: "ai", text: "", content: [{ type: "reasoning", reasoning: text, id }] }],
	];
	const message = (index, text) => [[], "messages", [{ type: "ai", text, content: [{ index }] }]];
	const tick = () => new Promise((r) => setTimeout(r, 2));

	it("flags a loop in one Responses API stream while another stream interleaves", async () => {
		const stream = (async function* () {
			for (let i = 0; i < 20; i++) {
				await tick();
				yield reasoningBlock("r1", "ok ");
				yield reasoningBlock("r2", `different${i} `);
			}
		})();
		const result = await consumeStream(stream, undefined, { loopDetector: detector() });
		assert.strictEqual(result.loopDetected, true);
	});

	it("does not flag two streams whose combined text would repeat", async () => {
		const stream = (async function* () {
			for (let i = 0; i < 4; i++) {
				yield reasoningBlock(`a${i}`, "x ");
				yield reasoningBlock(`b${i}`, "y ");
			}
		})();
		const result = await consumeStream(stream, undefined, { loopDetector: detector() });
		assert.strictEqual(result.loopDetected, false);
	});

	it("keys message text by its content-block index", async () => {
		const stream = (async function* () {
			for (let i = 0; i < 20; i++) {
				await tick();
				yield message(0, "again ");
				yield message(1, `other${i} `);
			}
		})();
		const result = await consumeStream(stream, undefined, { loopDetector: detector() });
		assert.strictEqual(result.loopDetected, true);
	});

	it("does not flag message text split across different block indexes", async () => {
		const stream = (async function* () {
			for (let i = 0; i < 6; i++) yield message(i, "same ");
		})();
		const result = await consumeStream(stream, undefined, { loopDetector: detector() });
		assert.strictEqual(result.loopDetected, false);
	});

	it("still detects a Chat Completions reasoning_content loop that has no id", async () => {
		const stream = (async function* () {
			for (let i = 0; i < 20; i++) {
				await tick();
				yield [
					[],
					"messages",
					[{ type: "ai", text: "", additional_kwargs: { reasoning_content: "ok " } }],
				];
			}
		})();
		const result = await consumeStream(stream, undefined, { loopDetector: detector() });
		assert.strictEqual(result.loopDetected, true);
	});
});
