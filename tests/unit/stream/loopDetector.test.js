import { describe, it } from "node:test";
import assert from "node:assert";
import { createStreamLoopDetector } from "../../../src/stream/loopDetector.js";
import { consumeStream } from "../../../src/stream/consume.js";

const SENTENCE = "I need to verify the config schemas are set up correctly. ";

describe("createStreamLoopDetector", () => {
	it("flags a sentence repeated beyond the threshold", () => {
		const d = createStreamLoopDetector({ threshold: 2 });
		assert.strictEqual(d.push("reasoning", SENTENCE), false);
		assert.strictEqual(d.push("reasoning", SENTENCE), false);
		// Third completed sentence (> threshold 2) is flagged.
		assert.strictEqual(d.push("reasoning", SENTENCE), true);
	});

	it("handles deltas split mid-sentence", () => {
		const d = createStreamLoopDetector({ threshold: 2 });
		const text = SENTENCE.repeat(4);
		let flagged = false;
		for (let i = 0; i < text.length; i += 7) {
			if (d.push("reasoning", text.slice(i, i + 7))) flagged = true;
		}
		assert.ok(flagged);
	});

	it("does not flag distinct sentences", () => {
		const d = createStreamLoopDetector();
		for (let i = 0; i < 20; i++) {
			assert.strictEqual(d.push("reasoning", `This is unique sentence number ${i} here. `), false);
		}
	});

	it("ignores short sentences", () => {
		const d = createStreamLoopDetector();
		for (let i = 0; i < 10; i++) assert.strictEqual(d.push("message", "Ok. "), false);
	});

	it("tracks reasoning and message independently", () => {
		const d = createStreamLoopDetector({ threshold: 2 });
		d.push("reasoning", SENTENCE);
		d.push("reasoning", SENTENCE);
		assert.strictEqual(d.push("message", SENTENCE), false);
	});

	it("flags a long repeat with no sentence boundary via maxBuffer", () => {
		const d = createStreamLoopDetector({ threshold: 2, maxBuffer: 40 });
		const chunk = "x".repeat(41);
		d.push("reasoning", chunk);
		d.push("reasoning", chunk);
		assert.strictEqual(d.push("reasoning", chunk), true);
	});

	it("flush counts a trailing unterminated segment", () => {
		const d = createStreamLoopDetector({ threshold: 2 });
		const tail = "a trailing segment with no terminal punctuation";
		for (let i = 0; i < 2; i++) {
			d.push("message", tail);
			assert.strictEqual(d.flush("message"), false);
		}
		d.push("message", tail);
		assert.strictEqual(d.flush("message"), true);
	});

	it("prunes hashes older than ttlMs", () => {
		let clock = 0;
		const d = createStreamLoopDetector({ threshold: 2, ttlMs: 100, now: () => clock });
		d.push("reasoning", SENTENCE);
		d.push("reasoning", SENTENCE);
		clock = 500;
		assert.strictEqual(d.push("reasoning", SENTENCE), false);
	});

	it("reset clears state", () => {
		const d = createStreamLoopDetector({ threshold: 2 });
		d.push("reasoning", SENTENCE);
		d.push("reasoning", SENTENCE);
		d.reset();
		assert.strictEqual(d.push("reasoning", SENTENCE), false);
	});
});

describe("consumeStream with loopDetector", () => {
	const reasoningChunk = (text) => [
		[],
		"messages",
		[{ type: "ai", text: "", additional_kwargs: { reasoning_content: text } }],
	];

	it("stops consuming and reports loopDetected", async () => {
		let consumed = 0;
		let closed = false;
		const stream = (async function* () {
			try {
				for (let i = 0; i < 100; i++) {
					consumed++;
					yield reasoningChunk(SENTENCE);
				}
			} finally {
				closed = true;
			}
		})();
		const result = await consumeStream(stream, undefined, {
			loopDetector: createStreamLoopDetector({ threshold: 2 }),
		});
		assert.strictEqual(result.loopDetected, true);
		assert.strictEqual(consumed, 3);
		assert.ok(closed, "underlying stream is closed");
	});

	it("reports loopDetected false without a detector", async () => {
		const stream = (async function* () {
			yield reasoningChunk(SENTENCE);
		})();
		const result = await consumeStream(stream);
		assert.strictEqual(result.loopDetected, false);
	});
});
