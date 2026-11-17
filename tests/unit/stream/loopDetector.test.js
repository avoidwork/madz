import { describe, it } from "node:test";
import assert from "node:assert";
import { createSegmentLoopDetector } from "../../../src/stream/loopDetector.js";
import { consumeStream } from "../../../src/stream/consume.js";

/** Push every segment; return whether any push flagged a loop. */
const feed = (d, segments, kind = "reasoning") => {
	let flagged = false;
	for (const s of segments) if (d.push(kind, s)) flagged = true;
	return flagged;
};

const repeat = (unit, times) => Array.from({ length: times }, () => unit).flat();

describe("createSegmentLoopDetector", () => {
	it("flags a unit repeated back-to-back more than threshold times", () => {
		const d = createSegmentLoopDetector({ threshold: 2 });
		const unit = ["alpha ", "beta ", "gamma "];
		assert.strictEqual(feed(d, repeat(unit, 2)), false);
		assert.strictEqual(feed(createSegmentLoopDetector({ threshold: 2 }), repeat(unit, 3)), true);
	});

	it("flags on the segment that completes the final repeat", () => {
		const d = createSegmentLoopDetector({ threshold: 2 });
		const unit = ["a1", "b2", "c3", "d4"];
		const stream = repeat(unit, 3);
		const results = stream.map((s) => d.push("reasoning", s));
		assert.strictEqual(results.lastIndexOf(true), stream.length - 1);
		assert.strictEqual(results.indexOf(true), stream.length - 1);
	});

	it("flags a single segment repeating, such as 'ok'", () => {
		const d = createSegmentLoopDetector({ threshold: 2 });
		assert.strictEqual(d.push("message", "ok"), false);
		assert.strictEqual(d.push("message", "ok"), false);
		assert.strictEqual(d.push("message", "ok"), true);
	});

	it("flags units of different lengths", () => {
		for (const len of [1, 2, 7, 40]) {
			const unit = Array.from({ length: len }, (_, i) => `s${i}`);
			assert.strictEqual(
				feed(createSegmentLoopDetector({ threshold: 2 }), repeat(unit, 3)),
				true,
				`len ${len}`,
			);
		}
	});

	it("does not flag distinct segments", () => {
		const d = createSegmentLoopDetector();
		const stream = Array.from({ length: 500 }, (_, i) => `segment-${i}`);
		assert.strictEqual(feed(d, stream), false);
	});

	it("does not flag a repeat that is not back-to-back", () => {
		const d = createSegmentLoopDetector({ threshold: 2 });
		const unit = ["a1", "b2", "c3"];
		const stream = [...unit, "x1", ...unit, "x2", ...unit, "x3"];
		assert.strictEqual(feed(d, stream), false);
	});

	it("tracks reasoning and message separately", () => {
		const d = createSegmentLoopDetector({ threshold: 2 });
		// Interleaved kinds: each kind alone never repeats back-to-back 3 times.
		assert.strictEqual(d.push("reasoning", "same"), false);
		assert.strictEqual(d.push("message", "same"), false);
		assert.strictEqual(d.push("reasoning", "same"), false);
		assert.strictEqual(d.push("message", "same"), false);
		assert.strictEqual(d.push("reasoning", "same"), true);
	});

	it("ignores empty and non-string deltas", () => {
		const d = createSegmentLoopDetector({ threshold: 2 });
		for (let i = 0; i < 10; i++) {
			assert.strictEqual(d.push("reasoning", ""), false);
			assert.strictEqual(d.push("reasoning", undefined), false);
			assert.strictEqual(d.push("reasoning", null), false);
		}
	});

	it("cannot see a repeat that does not fit in the window", () => {
		const unit = Array.from({ length: 10 }, (_, i) => `s${i}`);
		// Window of 25 cannot hold 3 copies (30 segments).
		assert.strictEqual(
			feed(createSegmentLoopDetector({ threshold: 2, windowSize: 25 }), repeat(unit, 6)),
			false,
		);
		assert.strictEqual(
			feed(createSegmentLoopDetector({ threshold: 2, windowSize: 30 }), repeat(unit, 6)),
			true,
		);
	});

	it("honours a higher threshold", () => {
		const unit = ["a1", "b2"];
		assert.strictEqual(feed(createSegmentLoopDetector({ threshold: 4 }), repeat(unit, 4)), false);
		assert.strictEqual(feed(createSegmentLoopDetector({ threshold: 4 }), repeat(unit, 5)), true);
	});

	it("reset clears state", () => {
		const d = createSegmentLoopDetector({ threshold: 2 });
		const unit = ["a1", "b2"];
		feed(d, repeat(unit, 2));
		d.reset();
		assert.strictEqual(feed(d, unit), false);
		assert.strictEqual(feed(d, repeat(unit, 2)), true);
	});
});

describe("consumeStream with loopDetector", () => {
	const reasoning = (text) => [
		[],
		"messages",
		[{ type: "ai", text: "", additional_kwargs: { reasoning_content: text } }],
	];
	const message = (text) => [[], "messages", [{ type: "ai", text, content: [] }]];

	it("stops consuming, closes the stream and reports loopDetected", async () => {
		let consumed = 0;
		let closed = false;
		const stream = (async function* () {
			try {
				for (let i = 0; i < 100; i++) {
					consumed++;
					yield reasoning("same");
				}
			} finally {
				closed = true;
			}
		})();
		const result = await consumeStream(stream, undefined, {
			loopDetector: createSegmentLoopDetector({ threshold: 2 }),
		});
		assert.strictEqual(result.loopDetected, true);
		assert.strictEqual(consumed, 3);
		assert.ok(closed, "underlying stream is closed");
	});

	it("detects a looping message stream", async () => {
		const stream = (async function* () {
			for (let i = 0; i < 20; i++) yield message("again ");
		})();
		const result = await consumeStream(stream, undefined, {
			loopDetector: createSegmentLoopDetector({ threshold: 2 }),
		});
		assert.strictEqual(result.loopDetected, true);
	});

	it("detects a looping Responses API reasoning block stream", async () => {
		const block = (text) => [
			[],
			"messages",
			[{ type: "ai", text: "", content: [{ type: "reasoning", reasoning: text, id: "r1" }] }],
		];
		const stream = (async function* () {
			for (let i = 0; i < 20; i++) yield block("think ");
		})();
		const result = await consumeStream(stream, undefined, {
			loopDetector: createSegmentLoopDetector({ threshold: 2 }),
		});
		assert.strictEqual(result.loopDetected, true);
	});

	it("does not feed subagent events to the detector", async () => {
		const stream = (async function* () {
			for (let i = 0; i < 20; i++) {
				yield [
					["tools:abc"],
					"messages",
					[{ type: "ai", text: "", additional_kwargs: { reasoning_content: "same" } }],
				];
			}
		})();
		const result = await consumeStream(stream, undefined, {
			loopDetector: createSegmentLoopDetector({ threshold: 2 }),
		});
		assert.strictEqual(result.loopDetected, false);
	});

	it("reports loopDetected false without a detector", async () => {
		const stream = (async function* () {
			yield reasoning("hello");
		})();
		const result = await consumeStream(stream);
		assert.strictEqual(result.loopDetected, false);
	});
});
