import { describe, it, after } from "node:test";
import assert from "node:assert";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { createSegmentLoopDetector, destroyPool } from "../../../src/stream/loopDetector.js";
import { checkLoop } from "../../../src/stream/loopCheck.js";
import { consumeStream } from "../../../src/stream/consume.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

after(async () => {
	await destroyPool();
});

/** Runner that executes the check inline, so unit tests need no thread. */
const inline = { run: async (task) => checkLoop(task) };

const detector = (extra = {}) => createSegmentLoopDetector({ runner: inline, ...extra });

/** Push every delta, letting checks finish between pushes; return the first index flagged. */
async function firstFlag(d, deltas, kind = "reasoning") {
	for (let i = 0; i < deltas.length; i++) {
		if (d.push(kind, deltas[i])) return i;
		await d.settle();
		if (d.push(kind, "")) return i; // no-op push, keeps shape symmetric
	}
	return (await d.settle()) ? deltas.length - 1 : -1;
}

describe("createSegmentLoopDetector (worker-backed)", () => {
	it("flags 'ok' repeated with no punctuation", async () => {
		const d = detector();
		const deltas = Array.from({ length: 20 }, () => "ok ");
		assert.ok((await firstFlag(d, deltas)) >= 0);
	});

	it("flags a repeated sentence", async () => {
		const d = detector();
		const deltas = Array.from({ length: 5 }, () => "This is a test of streamed repetition. ");
		assert.ok((await firstFlag(d, deltas)) >= 0);
	});

	it("flags garbled repetition of the same content", async () => {
		const d = detector();
		const deltas = [
			"The skill savs branch creation happens BEFORE staging. ",
			"The skill says branch creation happens BEFUKE staging. ",
			"The skill says branch creation happens BEFORE staging. ",
			"The skill savs branch creation happens BEFORE staginq. ",
		];
		assert.ok((await firstFlag(d, deltas)) >= 0);
	});

	it("flags the captured garbled loop fixture", async () => {
		const fixture = await readFile(join(__dirname, "../../fixtures/loop-garbled.md"), "utf8");
		const d = detector({ windowSize: 20, threshold: 2 });
		for (let i = 0; i < fixture.length; i += 64) {
			d.push("reasoning", fixture.slice(i, i + 64));
		}
		assert.strictEqual(await d.settle(), true);
	});

	it("does not flag distinct text", async () => {
		const d = detector();
		const deltas = Array.from({ length: 40 }, (_, i) => `Sentence number ${i} is unique. `);
		assert.strictEqual(await firstFlag(d, deltas), -1);
	});

	it("ignores empty and non-string deltas", () => {
		const d = detector();
		for (let i = 0; i < 10; i++) {
			assert.strictEqual(d.push("reasoning", ""), false);
			assert.strictEqual(d.push("reasoning", undefined), false);
			assert.strictEqual(d.push("reasoning", null), false);
		}
	});

	it("tracks reasoning and message text separately", async () => {
		const d = detector();
		// Each kind alone has 2 copies; combined text would have 4.
		for (const kind of ["reasoning", "message"]) {
			d.push(kind, "Same thing. ");
			d.push(kind, "Same thing. ");
		}
		assert.strictEqual(await d.settle(), false);
	});

	it("reports a flag on the first push after the check completes", async () => {
		const d = detector();
		d.push("reasoning", "ok ok ok ");
		assert.strictEqual(await d.settle(), true);
		assert.strictEqual(d.push("reasoning", "more "), true);
	});

	it("keeps at most one check in flight per kind", async () => {
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
		for (let i = 0; i < 30; i++) d.push("reasoning", `word${i} `);
		await d.settle();
		assert.strictEqual(peak, 1);
	});

	it("re-checks text that arrived while a check was running", async () => {
		const seen = [];
		const slow = {
			run: async (task) => {
				seen.push(task);
				await new Promise((r) => setTimeout(r, 5));
				return checkLoop(task);
			},
		};
		const d = createSegmentLoopDetector({ runner: slow });
		d.push("reasoning", "ok ");
		d.push("reasoning", "ok ");
		d.push("reasoning", "ok ");
		assert.strictEqual(await d.settle(), true);
		assert.ok(seen.length >= 2, "the tail was checked again");
		assert.ok(seen.at(-1).words.length > seen[0].words.length, "the later check saw newer words");
	});

	it("treats a failing check as not looping and keeps streaming", async () => {
		const broken = {
			run: async () => {
				throw new Error("worker died");
			},
		};
		const d = createSegmentLoopDetector({ runner: broken });
		assert.strictEqual(d.push("reasoning", "ok ok ok ok "), false);
		assert.strictEqual(await d.settle(), false);
	});

	it("drops accumulated text older than ttlMs", async () => {
		let clock = 0;
		const d = detector({ ttlMs: 100, now: () => clock });
		d.push("reasoning", "ok ok ");
		await d.settle();
		clock = 500;
		d.push("reasoning", "ok ");
		assert.strictEqual(await d.settle(), false);
	});

	it("does not expire text when ttlMs is unset", async () => {
		let clock = 0;
		const d = detector({ now: () => clock });
		d.push("reasoning", "ok ok ");
		await d.settle();
		clock = 10_000_000;
		d.push("reasoning", "ok ");
		assert.strictEqual(await d.settle(), true);
	});

	it("keeps only the last windowSize sentences and wordWindowSize words", async () => {
		const seen = [];
		const spy = {
			run: async (task) => {
				seen.push(task);
				return false;
			},
		};
		const d = createSegmentLoopDetector({
			runner: spy,
			windowSize: 5,
			maxLoopSentences: 1,
			threshold: 2,
			wordWindowSize: 12,
		});
		for (let i = 0; i < 100; i++) {
			d.push("reasoning", `Unique sentence number ${i} here. `);
			await d.settle();
		}
		const last = seen.at(-1);
		assert.ok(last.sentences.length <= 5, `sentences ${last.sentences.length}`);
		assert.ok(last.words.length <= 12, `words ${last.words.length}`);
		assert.strictEqual(last.sentences.at(-1), "Unique sentence number 99 here.");
	});

	it("widens the sentence window to hold threshold + 1 copies of the longest loop", async () => {
		const seen = [];
		const spy = {
			run: async (task) => {
				seen.push(task);
				return false;
			},
		};
		const d = createSegmentLoopDetector({ runner: spy, windowSize: 20, threshold: 10 });
		for (let i = 0; i < 200; i++) {
			d.push("reasoning", `Unique sentence number ${i} here. `);
			await d.settle();
		}
		// max(20, 5 * (10 + 1)) = 55
		assert.strictEqual(seen.at(-1).sentences.length, 55);
		assert.strictEqual(seen.at(-1).maxLoopSentences, 5);
		assert.strictEqual(seen.at(-1).similarityThreshold, 0.85);
	});

	it("passes configured similarityThreshold and maxLoopSentences to the worker task", async () => {
		const seen = [];
		const spy = {
			run: async (task) => {
				seen.push(task);
				return false;
			},
		};
		const d = createSegmentLoopDetector({
			runner: spy,
			similarityThreshold: 0.9,
			maxLoopSentences: 3,
		});
		d.push("reasoning", "One sentence here. ");
		await d.settle();
		assert.strictEqual(seen[0].similarityThreshold, 0.9);
		assert.strictEqual(seen[0].maxLoopSentences, 3);
	});

	it("sends the worker a bounded task however long the stream gets", async () => {
		const sizes = [];
		const spy = {
			run: async (task) => {
				sizes.push(task.sentences.length + task.words.length);
				return false;
			},
		};
		const d = createSegmentLoopDetector({ runner: spy, windowSize: 20, wordWindowSize: 200 });
		for (let i = 0; i < 2000; i++) {
			d.push("reasoning", `Distinct sentence ${i} goes here. `);
			if (i % 50 === 0) await d.settle();
		}
		await d.settle();
		assert.ok(Math.max(...sizes) <= 220, `max task size ${Math.max(...sizes)}`);
	});

	it("does not start a check for a delta that completes no sentence or word", async () => {
		let calls = 0;
		const spy = {
			run: async () => {
				calls++;
				return false;
			},
		};
		const d = createSegmentLoopDetector({ runner: spy });
		d.push("reasoning", "hel");
		d.push("reasoning", "lo");
		d.push("reasoning", " wor");
		await d.settle();
		const afterFirstWord = calls;
		d.push("reasoning", "l");
		d.push("reasoning", "d");
		await d.settle();
		assert.strictEqual(calls, afterFirstWord, "no new check until a word completes");
	});

	it("finds a sentence whose boundary falls across two deltas", async () => {
		const d = detector();
		for (const delta of ["Same thing.", " ", "Same thing.", " ", "Same thing.", " ", "x"]) {
			d.push("reasoning", delta);
		}
		assert.strictEqual(await d.settle(), true);
	});

	it("reaches the same verdict however the stream is chunked", async () => {
		const text = "This is a test of streamed repetition. ".repeat(5);
		for (const size of [1, 2, 3, 5, 8, 13]) {
			const d = detector();
			for (let i = 0; i < text.length; i += size) d.push("reasoning", text.slice(i, i + size));
			assert.strictEqual(await d.settle(), true, `chunk size ${size}`);
		}
	});

	it("drops state older than ttlMs for that kind only", async () => {
		let clock = 0;
		const d = detector({ ttlMs: 100, now: () => clock });
		d.push("reasoning", "ok ok ");
		await d.settle();
		clock = 50;
		d.push("message", "fresh ");
		clock = 500;
		d.push("reasoning", "ok ");
		assert.strictEqual(await d.settle(), false);
	});

	it("reset clears state and discards a stale in-flight result", async () => {
		const slow = {
			run: async (task) => {
				await new Promise((r) => setTimeout(r, 10));
				return checkLoop(task);
			},
		};
		const d = createSegmentLoopDetector({ runner: slow });
		d.push("reasoning", "ok ok ok ");
		d.reset();
		assert.strictEqual(await d.settle(), false);
		assert.strictEqual(d.push("reasoning", "fresh start "), false);
	});

	it("runs the check in a real worker thread by default", async () => {
		const d = createSegmentLoopDetector();
		d.push("reasoning", "ok ok ok ok ");
		assert.strictEqual(await d.settle(), true);
	});

	it("caps the worker pool at maxThreads", async () => {
		await destroyPool();
		const d = createSegmentLoopDetector({ maxThreads: 2 });
		d.push("reasoning", "ok ok ok ok ");
		assert.strictEqual(await d.settle(), true);
		await destroyPool();
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
		let closed = false;
		let consumed = 0;
		const stream = (async function* () {
			try {
				for (let i = 0; i < 400; i++) {
					consumed++;
					await new Promise((r) => setImmediate(r));
					yield reasoning("ok ");
				}
			} finally {
				closed = true;
			}
		})();
		const result = await consumeStream(stream, undefined, { loopDetector: detector() });
		assert.strictEqual(result.loopDetected, true);
		assert.ok(consumed < 400, `stopped early (${consumed})`);
		assert.ok(closed, "underlying stream is closed");
	});

	it("collects a loop flagged by a check still running when the stream ends", async () => {
		const stream = (async function* () {
			yield reasoning("ok ");
			yield reasoning("ok ");
			yield reasoning("ok ");
		})();
		const result = await consumeStream(stream, undefined, { loopDetector: detector() });
		assert.strictEqual(result.loopDetected, true);
	});

	it("detects a looping message stream", async () => {
		const stream = (async function* () {
			for (let i = 0; i < 20; i++) yield message("again ");
		})();
		const result = await consumeStream(stream, undefined, { loopDetector: detector() });
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
		const result = await consumeStream(stream, undefined, { loopDetector: detector() });
		assert.strictEqual(result.loopDetected, true);
	});

	it("feeds subagent reasoning to the detector by default", async () => {
		const stream = (async function* () {
			for (let i = 0; i < 20; i++) {
				yield [
					["tools:abc"],
					"messages",
					[{ type: "ai", text: "", additional_kwargs: { reasoning_content: "same " } }],
				];
			}
		})();
		const result = await consumeStream(stream, undefined, { loopDetector: detector() });
		assert.strictEqual(result.loopDetected, true);
	});

	it("does not feed subagent reasoning when subagent detection is disabled", async () => {
		const stream = (async function* () {
			for (let i = 0; i < 20; i++) {
				yield [
					["tools:abc"],
					"messages",
					[{ type: "ai", text: "", additional_kwargs: { reasoning_content: "same " } }],
				];
			}
		})();
		const result = await consumeStream(stream, undefined, {
			loopDetector: detector(),
			subagent: false,
		});
		assert.strictEqual(result.loopDetected, false);
	});

	it("feeds subagent message text to the detector by default", async () => {
		const stream = (async function* () {
			for (let i = 0; i < 20; i++) {
				yield [["tools:abc"], "messages", [{ type: "ai", text: "same ", content: [] }]];
			}
		})();
		const result = await consumeStream(stream, undefined, { loopDetector: detector() });
		assert.strictEqual(result.loopDetected, true);
	});

	it("does not feed subagent message text when subagent detection is disabled", async () => {
		const stream = (async function* () {
			for (let i = 0; i < 20; i++) {
				yield [["tools:abc"], "messages", [{ type: "ai", text: "same ", content: [] }]];
			}
		})();
		const result = await consumeStream(stream, undefined, {
			loopDetector: detector(),
			subagent: false,
		});
		assert.strictEqual(result.loopDetected, false);
	});

	it("reports loopDetected false without a detector", async () => {
		const stream = (async function* () {
			yield reasoning("hello");
		})();
		assert.strictEqual((await consumeStream(stream)).loopDetected, false);
	});
});
