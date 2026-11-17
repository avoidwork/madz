/**
 * A segment is one streamed delta: a small group of characters. This test cuts
 * lines 14-21 of the captured loop (tests/fixtures/loop-reasoning.md) once into
 * random 4-10 character segments, then repeats that same segment array, which is
 * what a looping model does (it re-emits the same tokens). The detector must flag
 * the loop while the stream is still running.
 *
 * The detector must behave identically for every kind of stream, so the same
 * segment array is replayed through each: Chat Completions `reasoning_content`,
 * Responses API reasoning blocks, and message text.
 */

import { describe, it } from "node:test";
import assert from "node:assert";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { consumeStream } from "../../../src/stream/consume.js";
import { createSegmentLoopDetector } from "../../../src/stream/loopDetector.js";

// Lines 14-21 of the capture: two paragraphs, hard-wrapped by the TUI.
const TEXT = readFileSync(
	fileURLToPath(new URL("../../fixtures/loop-reasoning.md", import.meta.url)),
	"utf8",
)
	.split("\n")
	.slice(13, 21)
	.map((line) => line.trim())
	.join(" ")
	.replace(/\s+/g, " ")
	.trim();

/**
 * Deterministic PRNG (mulberry32).
 * @param {number} seed - Seed
 * @returns {() => number} Floats in [0, 1)
 */
function rng(seed) {
	let a = seed;
	return () => {
		a |= 0;
		a = (a + 0x6d2b79f5) | 0;
		let t = Math.imul(a ^ (a >>> 15), 1 | a);
		t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

/**
 * Break text into random segments of `min`..`max` characters.
 * @param {string} text - Text to break up
 * @param {number} seed - PRNG seed
 * @param {number} [min=4] - Minimum segment length
 * @param {number} [max=10] - Maximum segment length
 * @returns {string[]} Segments whose concatenation equals `text`
 */
function toSegments(text, seed, min = 4, max = 10) {
	const rand = rng(seed);
	const out = [];
	for (let i = 0; i < text.length;) {
		const size = min + Math.floor(rand() * (max - min + 1));
		out.push(text.slice(i, i + size));
		i += size;
	}
	return out;
}

/**
 * The kinds of stream the detector sees, each wrapping a segment in the event
 * shape `consumeStream` receives for that kind.
 */
const STREAM_KINDS = {
	"reasoning_content (Chat Completions)": (s) => [
		[],
		"messages",
		[{ type: "ai", text: "", additional_kwargs: { reasoning_content: s } }],
	],
	"reasoning block (Responses API)": (s) => [
		[],
		"messages",
		[{ type: "ai", text: "", content: [{ type: "reasoning", reasoning: s, id: "r1" }] }],
	],
	"message text": (s) => [[], "messages", [{ type: "ai", text: s, content: [] }]],
};

/**
 * Wrap segments as a stream of the given kind.
 * @param {string[]} segments - Segments to emit
 * @param {(s: string) => Array<unknown>} wrap - Builds the event for one segment
 * @param {{ consumed: number, closed: boolean }} probe - Records consumption
 * @returns {AsyncIterable<Array<unknown>>} The stream
 */
function streamOf(segments, wrap, probe) {
	return (async function* () {
		try {
			for (const s of segments) {
				probe.consumed++;
				yield wrap(s);
			}
		} finally {
			probe.closed = true;
		}
	})();
}

/**
 * Stream segments through consumeStream with a fresh detector.
 * @param {string[]} segments - Segments to emit
 * @param {(s: string) => Array<unknown>} wrap - Event builder for the stream kind
 * @returns {Promise<{ result: Object, probe: Object }>} Outcome
 */
async function run(segments, wrap) {
	const probe = { consumed: 0, closed: false };
	const result = await consumeStream(streamOf(segments, wrap, probe), undefined, {
		loopDetector: createSegmentLoopDetector({ threshold: 2 }),
	});
	return { result, probe };
}

const repeat = (segments, times) => Array.from({ length: times }, () => segments).flat();

describe("loop detector with the passage broken into 4-10 char segments", () => {
	it("breaks the passage into segments that rebuild the text", () => {
		const segments = toSegments(TEXT, 1);
		assert.strictEqual(segments.join(""), TEXT);
		assert.ok(segments.every((s) => s.length >= 1 && s.length <= 10));
		assert.ok(
			segments.slice(0, -1).every((s) => s.length >= 4),
			"all but the last are 4-10 chars",
		);
	});

	it("sizes the default window to hold three copies of the passage", () => {
		const n = toSegments(TEXT, 1).length;
		// Three back-to-back copies must fit in the default window to be detectable.
		const defaultWindow = 1000;
		assert.ok(
			n * 3 <= defaultWindow,
			`3 copies = ${n * 3} segments, default window ${defaultWindow}`,
		);
	});

	for (const [label, wrap] of Object.entries(STREAM_KINDS)) {
		describe(label, () => {
			for (const seed of [1, 2, 3, 4, 5]) {
				it(`flags the repeating segment array mid-stream (seed ${seed})`, async () => {
					const segments = toSegments(TEXT, seed);
					const { result, probe } = await run(repeat(segments, 6), wrap);
					assert.strictEqual(result.loopDetected, true);
					// threshold 2: the third back-to-back copy completes the loop.
					assert.strictEqual(probe.consumed, segments.length * 3);
					assert.ok(probe.closed, "underlying stream is closed");
				});
			}

			it("does not flag the passage streamed once", async () => {
				const { result } = await run(toSegments(TEXT, 1), wrap);
				assert.strictEqual(result.loopDetected, false);
			});

			it("does not flag the passage repeated only twice", async () => {
				const { result } = await run(repeat(toSegments(TEXT, 1), 2), wrap);
				assert.strictEqual(result.loopDetected, false);
			});

			it("flags a repeat of only the first paragraph's segments", async () => {
				const segments = toSegments(TEXT.split(". Writing")[0], 9);
				const { result, probe } = await run(repeat(segments, 6), wrap);
				assert.strictEqual(result.loopDetected, true);
				assert.strictEqual(probe.consumed, segments.length * 3);
			});
		});
	}

	it("detects the loop at the same segment in every kind of stream", async () => {
		for (const seed of [1, 2, 3]) {
			const stream = repeat(toSegments(TEXT, seed), 6);
			const outcomes = [];
			for (const wrap of Object.values(STREAM_KINDS)) {
				const { result, probe } = await run(stream, wrap);
				outcomes.push({ detected: result.loopDetected, consumed: probe.consumed });
			}
			assert.ok(outcomes[0].detected, `seed ${seed}: loop detected`);
			for (const o of outcomes) assert.deepStrictEqual(o, outcomes[0], `seed ${seed}`);
		}
	});

	it("detects the loop at the same segment when pushed straight to the detector", () => {
		const stream = repeat(toSegments(TEXT, 1), 6);
		const at = {};
		for (const kind of ["reasoning", "message"]) {
			const d = createSegmentLoopDetector({ threshold: 2 });
			at[kind] = stream.findIndex((s) => d.push(kind, s));
		}
		assert.ok(at.reasoning > 0);
		assert.strictEqual(at.message, at.reasoning);
	});
});
