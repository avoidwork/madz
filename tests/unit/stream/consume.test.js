/**
 * Tests for the stream consumer's event-type tracking.
 * @see {@link src/stream/consume.js}
 */

import { describe, it } from "node:test";
import assert from "node:assert";
import { consumeStream } from "../../../src/stream/consume.js";

/**
 * Build an async iterable of `[namespace, mode, payload]` tuples.
 * @param {Array<Array<unknown>>} chunks
 * @returns {AsyncIterable<Array<unknown>>}
 */
function makeStream(chunks) {
	return (async function* () {
		for (const chunk of chunks) {
			yield chunk;
		}
	})();
}

describe("consumeStream lastEventType", () => {
	it("returns null for an empty stream", async () => {
		const result = await consumeStream(makeStream([]));
		assert.strictEqual(result.lastEventType, null);
	});

	it("tracks message as the last event type", async () => {
		const result = await consumeStream(
			makeStream([
				[
					[],
					"messages",
					[{ _getType: () => "ai", text: "hello", content: [{ type: "text", text: "hello" }] }],
				],
			]),
		);
		assert.strictEqual(result.lastEventType, "message");
		assert.strictEqual(result.content, "hello");
	});

	it("tracks reasoning as the last event type (additional_kwargs)", async () => {
		const result = await consumeStream(
			makeStream([
				[
					[],
					"messages",
					[
						{
							_getType: () => "ai",
							text: "",
							additional_kwargs: { reasoning_content: "thinking..." },
						},
					],
				],
			]),
		);
		assert.strictEqual(result.lastEventType, "reasoning");
		assert.strictEqual(result.reasoning, "thinking...");
	});

	it("tracks reasoning as the last event type (content blocks)", async () => {
		const result = await consumeStream(
			makeStream([
				[
					[],
					"messages",
					[
						{
							_getType: () => "ai",
							content: [{ type: "reasoning", reasoning: "thinking...", id: "r1" }],
						},
					],
				],
			]),
		);
		assert.strictEqual(result.lastEventType, "reasoning");
		assert.strictEqual(result.reasoning, "thinking...");
	});

	it("tracks the last event when reasoning is followed by a message", async () => {
		const result = await consumeStream(
			makeStream([
				[
					[],
					"messages",
					[
						{
							_getType: () => "ai",
							text: "",
							additional_kwargs: { reasoning_content: "thinking..." },
						},
					],
				],
				[
					[],
					"messages",
					[{ _getType: () => "ai", text: "answer", content: [{ type: "text", text: "answer" }] }],
				],
			]),
		);
		assert.strictEqual(result.lastEventType, "message");
	});

	it("tracks a tool event as the last event type", async () => {
		const result = await consumeStream(
			makeStream([
				[[], "messages", [{ _getType: () => "tool", text: "tool output", name: "readFile" }]],
			]),
			null,
			{ showToolResults: true },
		);
		assert.strictEqual(result.lastEventType, "tool");
	});

	it("does not set lastEventType from subagent events", async () => {
		const result = await consumeStream(
			makeStream([
				[
					[],
					"messages",
					[
						{
							_getType: () => "ai",
							text: "orchestrator",
							content: [{ type: "text", text: "orchestrator" }],
						},
					],
				],
				[
					["tools:abc"],
					"messages",
					[
						{
							_getType: () => "ai",
							text: "",
							additional_kwargs: { reasoning_content: "sub thinking" },
						},
					],
				],
			]),
		);
		assert.strictEqual(result.lastEventType, "message");
	});

	it("tracks on_tool_start and on_tool_end events", async () => {
		const events = [];
		const result = await consumeStream(
			makeStream([
				[[], "tools", { event: "on_tool_start", name: "readFile", input: {} }],
				[[], "tools", { event: "on_tool_end", name: "readFile", output: "ok" }],
			]),
			(ev) => events.push(ev),
		);
		assert.strictEqual(result.lastEventType, "on_tool_end");
		assert.strictEqual(events.length, 2);
	});

	it("marks interrupted and stops on a clarify interrupt", async () => {
		const result = await consumeStream(
			makeStream([
				[[], "values", { __interrupt__: [{ value: { question: "?", choices: [] }, id: "i1" }] }],
				[
					[],
					"messages",
					[{ _getType: () => "ai", text: "after", content: [{ type: "text", text: "after" }] }],
				],
			]),
		);
		assert.strictEqual(result.interrupted, true);
		assert.strictEqual(result.lastEventType, null);
	});
});
