import assert from "node:assert";
import { describe, it } from "node:test";
import { INTERRUPT } from "@langchain/langgraph";
import { surfaceInterrupt } from "../../../src/stream/interrupt.js";

describe("surfaceInterrupt", () => {
	it("emits a clarify event for an interrupt chunk and reports it", () => {
		const events = [];
		const payload = {
			[INTERRUPT]: [{ id: "i1", value: { question: "Which?", choices: ["A", "B"] } }],
		};
		const paused = surfaceInterrupt("values", payload, (e) => events.push(e));
		assert.strictEqual(paused, true);
		assert.deepStrictEqual(events, [
			{ type: "clarify", question: "Which?", choices: ["A", "B"], interruptId: "i1" },
		]);
	});

	it("emits only the first interrupt", () => {
		const events = [];
		const payload = {
			[INTERRUPT]: [
				{ id: "i1", value: { question: "First?" } },
				{ id: "i2", value: { question: "Second?" } },
			],
		};
		surfaceInterrupt("values", payload, (e) => events.push(e));
		assert.strictEqual(events.length, 1);
		assert.strictEqual(events[0].question, "First?");
	});

	it("reports the pause even without a callback", () => {
		const payload = { [INTERRUPT]: [{ id: "i1", value: { question: "Q?" } }] };
		assert.strictEqual(surfaceInterrupt("values", payload), true);
	});

	it("does not emit when the interrupt has no value", () => {
		const events = [];
		const payload = { [INTERRUPT]: [{ id: "i1" }] };
		assert.strictEqual(
			surfaceInterrupt("values", payload, (e) => events.push(e)),
			true,
		);
		assert.strictEqual(events.length, 0);
	});

	it("ignores non-values modes and ordinary chunks", () => {
		const cb = () => assert.fail("should not emit");
		assert.strictEqual(surfaceInterrupt("messages", { [INTERRUPT]: [{}] }, cb), false);
		assert.strictEqual(surfaceInterrupt("values", { messages: [] }, cb), false);
		assert.strictEqual(surfaceInterrupt("values", null, cb), false);
	});
});
