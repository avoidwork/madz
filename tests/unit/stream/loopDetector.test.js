import { describe, it } from "node:test";
import assert from "node:assert";
import { createSegmentLoopDetector } from "../../../src/stream/loopDetector.js";
import { consumeStream } from "../../../src/stream/consume.js";

const R = (content, id) => ({ type: "reasoning", content, ...(id !== undefined ? { id } : {}) });
const M = (content, id) => ({ type: "message", content, ...(id !== undefined ? { id } : {}) });

/** Push a reasoning block with its own id, then a different one to close it. */
const complete = (d, content, id) => d.push(R(content, id));

describe("createSegmentLoopDetector", () => {
	it("does not count a segment until it is complete", () => {
		const d = createSegmentLoopDetector({ threshold: 2 });
		// Chunks sharing an id are one segment; nothing has closed yet.
		assert.strictEqual(d.push(R("same ", "a")), false);
		assert.strictEqual(d.push(R("thought", "a")), false);
	});

	it("flags a segment that completes more than threshold times", () => {
		const d = createSegmentLoopDetector({ threshold: 2 });
		// Each new id closes the previous block. Blocks 1..4 are identical; the
		// 3rd completion of the same content exceeds threshold 2.
		assert.strictEqual(complete(d, "same thought", "1"), false); // opens 1
		assert.strictEqual(complete(d, "same thought", "2"), false); // closes 1 (count 1)
		assert.strictEqual(complete(d, "same thought", "3"), false); // closes 2 (count 2)
		assert.strictEqual(complete(d, "same thought", "4"), true); // closes 3 (count 3)
	});

	it("merges chunks that share an id into one segment before hashing", () => {
		const d = createSegmentLoopDetector({ threshold: 2 });
		const feed = (id) => {
			const closed = d.push(R("same ", id)); // a new id closes the previous segment
			d.push(R("thought", id));
			return closed;
		};
		assert.strictEqual(feed("1"), false);
		assert.strictEqual(feed("2"), false); // closes 1 ("same thought")
		assert.strictEqual(feed("3"), false); // closes 2
		assert.strictEqual(feed("4"), true); // closes 3
	});

	it("splits id-less reasoning on a sentence boundary followed by a capital", () => {
		const d = createSegmentLoopDetector({ threshold: 2 });
		// "Check it." then a capitalised chunk starts a new segment, closing the first.
		let flagged = false;
		for (let i = 0; i < 4; i++) {
			if (d.push(R("Check it."))) flagged = true;
			if (d.push(R(" "))) flagged = true;
			if (d.push(R("Again"))) flagged = true;
			if (d.push(R(" now."))) flagged = true;
		}
		// Segments alternate; the first sentence repeats past the threshold.
		assert.ok(flagged);
	});

	it("does not flag distinct segments", () => {
		const d = createSegmentLoopDetector();
		for (let i = 0; i < 20; i++)
			assert.strictEqual(complete(d, `thought number ${i}`, String(i)), false);
	});

	it("flags a very short segment such as 'ok'", () => {
		const d = createSegmentLoopDetector({ threshold: 2 });
		const out = [];
		for (let i = 0; i < 5; i++) out.push(complete(d, "ok", String(i)));
		assert.ok(out.includes(true));
	});

	it("ignores empty and whitespace-only segments", () => {
		const d = createSegmentLoopDetector({ threshold: 2 });
		for (let i = 0; i < 10; i++) assert.strictEqual(complete(d, "  \n ", String(i)), false);
	});

	it("tracks reasoning and message separately", () => {
		const d = createSegmentLoopDetector({ threshold: 2 });
		d.push(R("same", "r1"));
		d.push(R("same", "r2")); // closes r1: reasoning "same" x1
		// These identical-text messages close r2 (reasoning x2) and then m1. If
		// type were ignored, the shared hash would reach 3 here and flag a loop.
		assert.strictEqual(d.push(M("same", "m1")), false);
		assert.strictEqual(d.push(M("same", "m2")), false);
		assert.strictEqual(d.push(M("other", "m3")), false);
	});

	it("does not hash tool segments", () => {
		const d = createSegmentLoopDetector({ threshold: 2 });
		for (let i = 0; i < 10; i++) {
			assert.strictEqual(d.push({ type: "tool", content: "result", name: "x" }), false);
		}
	});

	it("evicts the oldest hash when the window is exceeded", () => {
		const d = createSegmentLoopDetector({ threshold: 2, windowSize: 3 });
		complete(d, "x", "1");
		complete(d, "y", "2");
		complete(d, "z", "3");
		complete(d, "x", "4");
		// "x" was evicted from the 3-entry window; repeating it does not trigger.
		assert.strictEqual(complete(d, "w", "5"), false);
	});

	it("prunes hashes older than ttlMs", () => {
		let clock = 0;
		const d = createSegmentLoopDetector({ threshold: 2, ttlMs: 100, now: () => clock });
		complete(d, "same", "1");
		complete(d, "same", "2");
		complete(d, "same", "3");
		clock = 500;
		complete(d, "same", "4");
		assert.strictEqual(complete(d, "same", "5"), false);
	});

	it("reset clears state", () => {
		const d = createSegmentLoopDetector({ threshold: 2 });
		complete(d, "same", "1");
		complete(d, "same", "2");
		complete(d, "same", "3");
		d.reset();
		assert.strictEqual(complete(d, "same", "4"), false);
		assert.strictEqual(complete(d, "same", "5"), false);
	});
});

describe("consumeStream with loopDetector", () => {
	const reasoningBlock = (text, id) => [
		[],
		"messages",
		[{ type: "ai", text: "", content: [{ type: "reasoning", reasoning: text, id }] }],
	];

	it("stops consuming, closes the stream and reports loopDetected", async () => {
		let consumed = 0;
		let closed = false;
		const stream = (async function* () {
			try {
				for (let i = 0; i < 100; i++) {
					consumed++;
					yield reasoningBlock("same thought", `b${i}`);
				}
			} finally {
				closed = true;
			}
		})();
		const result = await consumeStream(stream, undefined, {
			loopDetector: createSegmentLoopDetector({ threshold: 2 }),
		});
		assert.strictEqual(result.loopDetected, true);
		assert.strictEqual(consumed, 4);
		assert.ok(closed, "underlying stream is closed");
	});

	it("feeds Chat Completions reasoning_content as id-less segments", async () => {
		const chunk = (text) => [
			[],
			"messages",
			[{ type: "ai", text: "", additional_kwargs: { reasoning_content: text } }],
		];
		const stream = (async function* () {
			for (let i = 0; i < 6; i++) {
				yield chunk("Same thought here.");
				yield chunk(" Next");
				yield chunk(" part.");
			}
		})();
		const result = await consumeStream(stream, undefined, {
			loopDetector: createSegmentLoopDetector({ threshold: 2 }),
		});
		assert.strictEqual(result.loopDetected, true);
	});

	it("reports loopDetected false without a detector", async () => {
		const stream = (async function* () {
			yield reasoningBlock("hello", "a");
		})();
		const result = await consumeStream(stream);
		assert.strictEqual(result.loopDetected, false);
	});
});
