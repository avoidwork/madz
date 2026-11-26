import { describe, it, after } from "node:test";
import assert from "node:assert";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { createSegmentLoopDetector, destroyPool } from "../../../src/stream/loopDetector.js";
import { LoopDetectionSchema } from "../../../src/config/schemas/loopDetection.js";

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

const WORDS = PASSAGE.split(" ");

/** Stream a unit of WORDS-only text so only the word check can catch it. */
async function flaggedWithWordWindow(wordWindowSize, copies) {
	const d = createSegmentLoopDetector({ wordWindowSize });
	for (let c = 0; c < copies; c++) d.push("reasoning", PASSAGE + " ");
	return d.settle();
}

describe("loopDetection config schema", () => {
	it("defaults wordWindowSize to 2090", () => {
		assert.strictEqual(LoopDetectionSchema.parse({}).wordWindowSize, 2090);
	});

	it("accepts a configured wordWindowSize", () => {
		assert.strictEqual(LoopDetectionSchema.parse({ wordWindowSize: 2500 }).wordWindowSize, 2500);
	});

	it("rejects a zero, negative or fractional wordWindowSize", () => {
		for (const bad of [0, -5, 1.5]) {
			assert.throws(
				() => LoopDetectionSchema.parse({ wordWindowSize: bad }),
				`wordWindowSize ${bad}`,
			);
		}
	});

	it("still rejects unknown keys (strict)", () => {
		assert.throws(() => LoopDetectionSchema.parse({ wordWindow: 5 }));
	});

	it("keeps the other defaults", () => {
		const cfg = LoopDetectionSchema.parse({});
		assert.strictEqual(cfg.maxStreams, 4);
		assert.strictEqual(cfg.threshold, 2);
		assert.strictEqual(cfg.ttlMs, 60000);
		assert.strictEqual(cfg.escalationCount, 3);
		assert.strictEqual(cfg.escalationWindowMs, 60000);
		assert.strictEqual(cfg.minChain, 5);
		assert.strictEqual(cfg.maxChain, 8);
		assert.strictEqual(cfg.maxRun, 50);
	});

	it("defaults minChain to 5, maxChain to 8 and maxRun to 50 and rejects non-positive or fractional values", () => {
		assert.strictEqual(LoopDetectionSchema.parse({}).minChain, 5);
		assert.strictEqual(LoopDetectionSchema.parse({}).maxChain, 8);
		assert.strictEqual(LoopDetectionSchema.parse({}).maxRun, 50);
		assert.strictEqual(LoopDetectionSchema.parse({ minChain: 2 }).minChain, 2);
		assert.strictEqual(LoopDetectionSchema.parse({ maxChain: 5 }).maxChain, 5);
		assert.strictEqual(LoopDetectionSchema.parse({ maxRun: 20 }).maxRun, 20);
		for (const bad of [0, -1, 2.5]) {
			assert.throws(() => LoopDetectionSchema.parse({ minChain: bad }), `${bad}`);
			assert.throws(() => LoopDetectionSchema.parse({ maxChain: bad }), `${bad}`);
			assert.throws(() => LoopDetectionSchema.parse({ maxRun: bad }), `${bad}`);
		}
	});

	it("defaults subagent to true", () => {
		assert.strictEqual(LoopDetectionSchema.parse({}).subagent, true);
	});

	it("accepts a configured subagent value", () => {
		assert.strictEqual(LoopDetectionSchema.parse({ subagent: false }).subagent, false);
	});

	it("rejects a non-boolean subagent", () => {
		assert.throws(() => LoopDetectionSchema.parse({ subagent: "yes" }));
	});
});

describe("loopDetection maxStreams", () => {
	it("defaults to 4", () => {
		assert.strictEqual(LoopDetectionSchema.parse({}).maxStreams, 4);
	});

	it("accepts a configured value", () => {
		assert.strictEqual(LoopDetectionSchema.parse({ maxStreams: 5000 }).maxStreams, 5000);
	});

	it("rejects zero, negative and fractional values", () => {
		for (const bad of [0, -1, 2.5]) {
			assert.throws(() => LoopDetectionSchema.parse({ maxStreams: bad }), `maxStreams ${bad}`);
		}
	});

	it("is set in config.yaml to the schema default", () => {
		const yaml = readFileSync(
			fileURLToPath(new URL("../../../config.yaml", import.meta.url)),
			"utf8",
		);
		assert.match(yaml, /^\s+maxStreams: 4$/m);
	});
});

describe("loopDetection maxThreads", () => {
	it("defaults to 4", () => {
		assert.strictEqual(LoopDetectionSchema.parse({}).maxThreads, 4);
	});

	it("accepts a configured value", () => {
		assert.strictEqual(LoopDetectionSchema.parse({ maxThreads: 2 }).maxThreads, 2);
	});

	it("rejects zero, negative and fractional values", () => {
		for (const bad of [0, -1, 2.5]) {
			assert.throws(() => LoopDetectionSchema.parse({ maxThreads: bad }), `maxThreads ${bad}`);
		}
	});

	it("is set in config.yaml to the schema default", () => {
		const yaml = readFileSync(
			fileURLToPath(new URL("../../../config.yaml", import.meta.url)),
			"utf8",
		);
		assert.match(yaml, /^\s+maxThreads: 4$/m);
	});
});

describe("wordWindowSize is big enough for the captured loop", () => {
	it("the two-paragraph passage needs more words than the old 200-word window", () => {
		assert.ok(WORDS.length * 3 > 200, `3 copies = ${WORDS.length * 3} words`);
	});

	it("the default 2090 holds eleven copies (threshold 10 + 1) of the two-paragraph passage", () => {
		assert.ok(WORDS.length * 11 <= 2090, `11 copies = ${WORDS.length * 11} words`);
	});

	it("catches the two-paragraph loop at the default size", async () => {
		assert.strictEqual(await flaggedWithWordWindow(2090, 4), true);
	});

	it("misses the same loop when the window holds only one copy", async () => {
		assert.strictEqual(await flaggedWithWordWindow(WORDS.length, 4), false);
	});

	it("catches it again once the window holds two copies", async () => {
		assert.strictEqual(await flaggedWithWordWindow(WORDS.length * 2, 4), true);
	});
});
