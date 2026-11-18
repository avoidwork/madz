import { describe, it, after } from "node:test";
import assert from "node:assert";
import { createSegmentLoopDetector, destroyPool } from "../../../src/stream/loopDetector.js";
import { checkLoop } from "../../../src/stream/loopCheck.js";
import { consumeStream } from "../../../src/stream/consume.js";

after(async () => {
	await destroyPool();
});

/** Runner that executes the check inline, so unit tests need no thread. */
const inline = { run: async (task) => checkLoop(task.text, task) };

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
				return checkLoop(task.text, task);
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
				seen.push(task.text);
				await new Promise((r) => setTimeout(r, 5));
				return checkLoop(task.text, task);
			},
		};
		const d = createSegmentLoopDetector({ runner: slow });
		d.push("reasoning", "ok ");
		d.push("reasoning", "ok ");
		d.push("reasoning", "ok ");
		assert.strictEqual(await d.settle(), true);
		assert.ok(seen.length >= 2, "the tail was checked again");
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

	it("reset clears state and discards a stale in-flight result", async () => {
		const slow = {
			run: async (task) => {
				await new Promise((r) => setTimeout(r, 10));
				return checkLoop(task.text, task);
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

	it("does not feed subagent events to the detector", async () => {
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
		assert.strictEqual(result.loopDetected, false);
	});

	it("reports loopDetected false without a detector", async () => {
		const stream = (async function* () {
			yield reasoning("hello");
		})();
		assert.strictEqual((await consumeStream(stream)).loopDetected, false);
	});
});
