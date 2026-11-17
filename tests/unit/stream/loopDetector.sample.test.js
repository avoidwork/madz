/**
 * Replays a real reasoning loop (tests/fixtures/loop-reasoning.md) through the
 * loop detector the way it arrives in production: as a stream of small,
 * multi-character `reasoning_content` deltas that split mid-word and never
 * align to sentence or paragraph boundaries, with no block ids.
 *
 * A segment is one streamed delta. A looping model re-emits the same tokens,
 * so the unit is cut into deltas once and that same delta sequence repeats.
 * The fixture is a TUI capture of the model repeating the same paragraph; when
 * the loop happens it is one paragraph repeating, sometimes two sentences,
 * sometimes one, sometimes more. Each shape is replayed here.
 */

import { describe, it } from "node:test";
import assert from "node:assert";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { consumeStream } from "../../../src/stream/consume.js";
import { createSegmentLoopDetector } from "../../../src/stream/loopDetector.js";

const FIXTURE = fileURLToPath(new URL("../../fixtures/loop-reasoning.md", import.meta.url));

/**
 * Extract the reasoning paragraphs from the TUI capture. The capture is
 * hard-wrapped and indented; a blank line separates paragraphs. Everything from
 * the tool-call footer onward is TUI chrome, not model output.
 * @returns {string[]} Paragraphs with wrapping collapsed
 */
function loadParagraphs() {
	const text = readFileSync(FIXTURE, "utf8");
	const end = text.indexOf("⚡");
	const body = end === -1 ? text : text.slice(0, end);
	return body
		.split(/\n\s*\n/)
		.map((p) =>
			p
				.replace(/\s*\n\s*/g, " ")
				.replace(/\s+/g, " ")
				.trim(),
		)
		.filter(Boolean);
}

/** @returns {string[]} Sentences of a paragraph */
const sentences = (paragraph) => paragraph.split(/(?<=[.!?])\s+/).filter(Boolean);

/**
 * Deterministic PRNG (mulberry32) so chunking is reproducible.
 * @param {number} seed - Seed
 * @returns {() => number} Function returning floats in [0, 1)
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
 * Cut text into multi-character deltas of `min`..`max` characters. Cuts land
 * anywhere, including mid-word, like real token streaming.
 * @param {string} text - Text to stream
 * @param {number} min - Minimum delta length
 * @param {number} max - Maximum delta length
 * @param {number} seed - PRNG seed
 * @returns {string[]} Deltas whose concatenation equals `text`
 */
function toDeltas(text, min, max, seed) {
	const rand = rng(seed);
	const deltas = [];
	for (let i = 0; i < text.length;) {
		const size = min + Math.floor(rand() * (max - min + 1));
		deltas.push(text.slice(i, i + size));
		i += size;
	}
	return deltas;
}

/**
 * Build the agent stream tuples for reasoning deltas (Chat Completions shape:
 * `additional_kwargs.reasoning_content`, no ids).
 * @param {string[]} deltas - Reasoning deltas
 * @param {{ consumed: number, closed: boolean }} probe - Records consumption
 * @returns {AsyncIterable<Array<unknown>>} The stream
 */
function reasoningStream(deltas, probe) {
	return (async function* () {
		try {
			for (const delta of deltas) {
				probe.consumed++;
				yield [
					[],
					"messages",
					[{ type: "ai", text: "", additional_kwargs: { reasoning_content: delta } }],
				];
			}
		} finally {
			probe.closed = true;
		}
	})();
}

/**
 * Stream `unit` repeated `repeats` times through consumeStream with a fresh detector.
 * @param {string} unit - The repeating unit of reasoning
 * @param {Object} opts - Options
 * @param {number} opts.repeats - Times the unit repeats
 * @param {string} opts.separator - Text between repeats
 * @param {number} opts.min - Minimum delta length
 * @param {number} opts.max - Maximum delta length
 * @param {number} opts.seed - PRNG seed
 * @returns {Promise<{ result: Object, probe: Object, total: number }>} Outcome
 */
async function replay(unit, { repeats, separator, min, max, seed }) {
	// A looping model re-emits the same tokens: chunk the unit once, then
	// repeat that identical delta sequence.
	const unitDeltas = toDeltas(unit, min, max, seed);
	const sepDeltas = separator ? [separator] : [];
	const deltas = [];
	for (let i = 0; i < repeats; i++) {
		if (i > 0) deltas.push(...sepDeltas);
		deltas.push(...unitDeltas);
	}
	const probe = { consumed: 0, closed: false };
	// The window must hold threshold + 1 (3) back-to-back copies of the unit;
	// size it to the unit so tiny deltas on long units are still testable.
	const detector = createSegmentLoopDetector({
		threshold: 2,
		windowSize: Math.max(1000, unitDeltas.length * 3 + sepDeltas.length * 2 + 10),
	});
	const result = await consumeStream(reasoningStream(deltas, probe), undefined, {
		loopDetector: detector,
	});
	return { result, probe, total: deltas.length };
}

const paragraphs = loadParagraphs();
const loopParagraph = paragraphs[0];
const twoParagraphs = `${paragraphs[0]}\n\n${paragraphs[1]}`;
const oneSentence = sentences(paragraphs[0])[0];
const twoSentences = sentences(paragraphs[0]).slice(0, 2).join(" ");

// Delta sizes in characters: tiny, typical, and large token groups.
const DELTA_SIZES = [
	[1, 3],
	[2, 8],
	[5, 20],
];
// How the model separates repeats: paragraph break, line break, or just a space.
const SEPARATORS = ["\n\n", "\n", " "];

describe("loop detector replaying the captured reasoning loop", () => {
	it("loads the fixture", () => {
		assert.ok(paragraphs.length >= 6, `expected several paragraphs, got ${paragraphs.length}`);
		assert.ok(loopParagraph.length > 200, "first paragraph is the long repeating one");
		assert.ok(
			paragraphs.filter((p) => p === loopParagraph).length >= 3,
			"the fixture really repeats the paragraph",
		);
	});

	const shapes = [
		["one paragraph", loopParagraph],
		["two paragraphs", twoParagraphs],
		["two sentences", twoSentences],
		["one sentence", oneSentence],
	];

	for (const [label, unit] of shapes) {
		for (const [min, max] of DELTA_SIZES) {
			for (const separator of SEPARATORS) {
				const sep = JSON.stringify(separator);
				it(`detects ${label} repeating (deltas ${min}-${max} chars, separator ${sep})`, async () => {
					const { result, probe, total } = await replay(unit, {
						repeats: 8,
						separator,
						min,
						max,
						seed: 42,
					});
					assert.strictEqual(result.loopDetected, true, "loop must be detected");
					assert.ok(probe.consumed < total, `stopped early (${probe.consumed} of ${total} deltas)`);
					assert.ok(probe.closed, "the underlying stream is closed");
				});
			}
		}
	}

	it("detects the loop before the stream is mostly consumed", async () => {
		const { probe, total, result } = await replay(loopParagraph, {
			repeats: 10,
			separator: "\n\n",
			min: 2,
			max: 8,
			seed: 7,
		});
		assert.strictEqual(result.loopDetected, true);
		// threshold 2 means the 3rd repeat trips it; allow for the unit boundary.
		assert.ok(probe.consumed <= total * 0.5, `consumed ${probe.consumed} of ${total}`);
	});

	it("does not flag the distinct paragraphs of the capture (no false positive)", async () => {
		const unique = [...new Set(paragraphs)];
		assert.ok(unique.length >= 4);
		const text = unique.join("\n\n");
		const probe = { consumed: 0, closed: false };
		const result = await consumeStream(
			reasoningStream(toDeltas(text, 2, 8, 11), probe),
			undefined,
			{
				loopDetector: createSegmentLoopDetector({ threshold: 2 }),
			},
		);
		assert.strictEqual(result.loopDetected, false);
	});

	it("does not flag a paragraph that repeats only twice", async () => {
		const { result } = await replay(loopParagraph, {
			repeats: 2,
			separator: "\n\n",
			min: 2,
			max: 8,
			seed: 3,
		});
		assert.strictEqual(result.loopDetected, false);
	});

	it("reproduces the same outcome regardless of chunking seed", async () => {
		for (const seed of [1, 2, 3, 4, 5]) {
			const { result } = await replay(loopParagraph, {
				repeats: 8,
				separator: "\n\n",
				min: 1,
				max: 12,
				seed,
			});
			assert.strictEqual(result.loopDetected, true, `seed ${seed}`);
		}
	});
});
