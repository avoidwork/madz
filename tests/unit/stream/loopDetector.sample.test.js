/**
 * Replays looping text through the real loop detector (worker pool included) the
 * way a provider streams it: as multi-character deltas that split mid-word. Every
 * repeat is cut at its OWN random positions, so the repeats do not share delta
 * boundaries (a looping model does not re-emit identical chunks).
 *
 * The fixture is a TUI capture of the model repeating the same paragraph. When
 * the loop happens it is one paragraph repeating, sometimes two sentences,
 * sometimes one, sometimes more, and sometimes just "ok ok ok" with no
 * punctuation. Each shape is replayed here.
 */

import { describe, it, after } from "node:test";
import assert from "node:assert";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { consumeStream } from "../../../src/stream/consume.js";
import { createSegmentLoopDetector, destroyPool } from "../../../src/stream/loopDetector.js";

after(async () => {
	await destroyPool();
});

// Lines 14-21 of the capture: two paragraphs, hard-wrapped by the TUI.
const PASSAGE = readFileSync(
	fileURLToPath(new URL("../../fixtures/loop-reasoning.md", import.meta.url)),
	"utf8",
)
	.split("\n")
	.slice(13, 21)
	.map((line) => line.trim())
	.join(" ")
	.replace(/\s+/g, " ")
	.trim();

const sentences = (text) => text.split(/(?<=[.!?])\s+/).filter(Boolean);
const FIRST_PARAGRAPH = PASSAGE.split(". Writing")[0] + ".";

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
 * Cut text into deltas of `min`..`max` characters at random positions.
 * @param {string} text - Text to cut
 * @param {number} min - Minimum delta length
 * @param {number} max - Maximum delta length
 * @param {() => number} rand - Random source
 * @returns {string[]} Deltas whose concatenation equals `text`
 */
function cut(text, min, max, rand) {
	const out = [];
	for (let i = 0; i < text.length;) {
		const size = min + Math.floor(rand() * (max - min + 1));
		out.push(text.slice(i, i + size));
		i += size;
	}
	return out;
}

/**
 * Repeat `unit` `repeats` times, cutting each copy independently.
 * @param {string} unit - The repeating text
 * @param {number} repeats - Number of copies
 * @param {string} separator - Text between copies
 * @param {number} min - Minimum delta length
 * @param {number} max - Maximum delta length
 * @param {number} seed - PRNG seed
 * @returns {string[]} Deltas
 */
function loopDeltas(unit, repeats, separator, min, max, seed) {
	const rand = rng(seed);
	const out = [];
	for (let r = 0; r < repeats; r++) {
		out.push(...cut(r === 0 ? unit : separator + unit, min, max, rand));
	}
	return out;
}

/**
 * Wrap deltas as an async stream of the given kind. A short real delay between
 * deltas stands in for network latency: a worker check takes a round trip, so
 * deltas arriving faster than that would finish the stream before any check
 * could return.
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

async function run(deltas, wrap) {
	const probe = { consumed: 0, closed: false };
	const stream = (async function* () {
		try {
			for (const d of deltas) {
				probe.consumed++;
				await new Promise((r) => setTimeout(r, 1));
				yield wrap(d);
			}
		} finally {
			probe.closed = true;
		}
	})();
	const result = await consumeStream(stream, undefined, {
		loopDetector: createSegmentLoopDetector({ windowSize: 20, threshold: 2 }),
	});
	return { result, probe, total: deltas.length };
}

const SHAPES = [
	["one paragraph", FIRST_PARAGRAPH, " "],
	["two paragraphs", PASSAGE, " "],
	["two sentences", sentences(FIRST_PARAGRAPH).slice(0, 2).join(" "), " "],
	["one sentence", sentences(FIRST_PARAGRAPH)[0], " "],
	["one sentence (newline separated)", sentences(FIRST_PARAGRAPH)[0], "\n"],
	["'ok ' with no punctuation", "ok ", " "],
	["a short phrase with no punctuation", "let me check that", " "],
];
const SIZES = [
	[1, 3],
	[4, 10],
];

describe("loop detector on the captured loop, each repeat cut independently", () => {
	it("loads the passage", () => {
		assert.ok(PASSAGE.length > 600, `passage is ${PASSAGE.length} chars`);
		assert.ok(FIRST_PARAGRAPH.length > 200);
	});

	for (const [kindLabel, wrap] of Object.entries(STREAM_KINDS)) {
		describe(kindLabel, () => {
			for (const [label, unit, separator] of SHAPES) {
				for (const [min, max] of SIZES) {
					it(`detects ${label} repeating (deltas ${min}-${max} chars)`, async () => {
						for (const seed of [1]) {
							const deltas = loopDeltas(unit, 5, separator, min, max, seed);
							const { result, probe, total } = await run(deltas, wrap);
							assert.strictEqual(result.loopDetected, true, `seed ${seed}`);
							assert.ok(probe.closed, `seed ${seed}: stream closed`);
							// Tiny streams end before a worker round trip can stop them early.
							if (total > 60) {
								assert.ok(probe.consumed < total, `seed ${seed}: stopped early`);
							}
						}
					});
				}
			}

			it("does not flag the passage streamed once", async () => {
				const { result } = await run(loopDeltas(PASSAGE, 1, " ", 4, 10, 1), wrap);
				assert.strictEqual(result.loopDetected, false);
			});

			it("does not flag a sentence that repeats only twice", async () => {
				const { result } = await run(
					loopDeltas(sentences(FIRST_PARAGRAPH)[0], 2, " ", 4, 10, 1),
					wrap,
				);
				assert.strictEqual(result.loopDetected, false);
			});
		});
	}

	it("flags 'ok ' repeated 20 times, the case that failed in practice", async () => {
		for (const [min, max] of [...SIZES, [5, 20]]) {
			for (const seed of [1, 2]) {
				const deltas = cut("ok ".repeat(20), min, max, rng(seed));
				const { result } = await run(deltas, STREAM_KINDS["reasoning_content (Chat Completions)"]);
				assert.strictEqual(result.loopDetected, true, `deltas ${min}-${max}, seed ${seed}`);
			}
		}
	});

	it("flags a sentence repeated 5 times, the other case that failed in practice", async () => {
		const text = "This is a test of streamed repetition. ".repeat(5);
		for (const [min, max] of [...SIZES, [5, 20]]) {
			for (const seed of [1, 2]) {
				const { result } = await run(
					cut(text, min, max, rng(seed)),
					STREAM_KINDS["reasoning_content (Chat Completions)"],
				);
				assert.strictEqual(result.loopDetected, true, `deltas ${min}-${max}, seed ${seed}`);
			}
		}
	});
});
