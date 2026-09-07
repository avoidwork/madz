import { describe, it } from "node:test";
import assert from "node:assert";
import { createTurnTransformer } from "../../../../src/stream/transformers/turn.js";

/**
 * Create a minimal ProtocolEvent-like object for testing.
 * @param {object} opts
 * @param {string} opts.method
 * @param {unknown} opts.data
 * @param {number} [opts.seq]
 * @param {number} [opts.timestamp]
 * @param {string[]} [opts.namespace]
 * @returns {import("@langchain/langgraph").ProtocolEvent}
 */
function makeEvent({ method, data, seq = 1, timestamp = Date.now(), namespace = [] }) {
	return {
		type: "event",
		seq,
		method,
		params: { namespace, timestamp, data },
	};
}

function humanMsg(content = "hello", id = "human-1") {
	return {
		_getType() {
			return "human";
		},
		content,
		id,
	};
}

function aiMsg(content = "hi there", id = "ai-1") {
	return {
		_getType() {
			return "ai";
		},
		content,
		id,
	};
}

/**
 * Collect items from a StreamChannel. Must be called AFTER all pushes are done.
 * The channel must be closed first so iteration terminates.
 * @template T
 * @param {import("@langchain/langgraph").StreamChannel<T>} channel
 * @returns {Promise<T[]>}
 */
async function collect(channel) {
	const items = [];
	for await (const item of channel) {
		items.push(item);
	}
	return items;
}

describe("createTurnTransformer", () => {
	it("emits turn:start when a new HumanMessage appears in updates channel", async () => {
		const tf = createTurnTransformer();
		const { turns } = tf.init();

		tf.process(
			makeEvent({
				method: "updates",
				data: { values: { messages: [humanMsg("hello", "h1")] } },
				timestamp: 1000,
			}),
		);

		turns.close();
		const events = await collect(turns);
		assert.strictEqual(events.length, 1);
		assert.strictEqual(events[0].type, "turn:start");
		assert.strictEqual(events[0].messageId, "h1");
	});

	it("emits turn:end when AIMessage with content appears and no tool calls pending", async () => {
		const tf = createTurnTransformer();
		const { turns } = tf.init();

		tf.process(
			makeEvent({
				method: "updates",
				data: { values: { messages: [humanMsg("hello", "h1")] } },
				timestamp: 1000,
			}),
		);

		tf.process(
			makeEvent({
				method: "updates",
				data: { values: { messages: [humanMsg("hello", "h1"), aiMsg("response", "a1")] } },
				timestamp: 2000,
			}),
		);

		turns.close();
		const events = await collect(turns);
		assert.strictEqual(events.length, 2);
		assert.strictEqual(events[0].type, "turn:start");
		assert.strictEqual(events[1].type, "turn:end");
		assert.strictEqual(events[1].messageId, "a1");
	});

	it("does not emit turn:end while tool calls are pending", async () => {
		const tf = createTurnTransformer();
		const { turns } = tf.init();

		tf.process(
			makeEvent({
				method: "updates",
				data: { values: { messages: [humanMsg("hello", "h1")] } },
				timestamp: 1000,
			}),
		);

		tf.process(
			makeEvent({
				method: "tools",
				data: { event: "tool-started", tool_call_id: "tc-1", tool_name: "search" },
				timestamp: 1500,
			}),
		);

		// AIMessage appears but tool still pending → no turn:end yet
		tf.process(
			makeEvent({
				method: "updates",
				data: { values: { messages: [humanMsg("hello", "h1"), aiMsg("", "a1")] } },
				timestamp: 2000,
			}),
		);

		tf.process(
			makeEvent({
				method: "tools",
				data: { event: "tool-finished", tool_call_id: "tc-1", output: "results" },
				timestamp: 2500,
			}),
		);

		// Now AIMessage with content → turn:end
		tf.process(
			makeEvent({
				method: "updates",
				data: { values: { messages: [humanMsg("hello", "h1"), aiMsg("final answer", "a1")] } },
				timestamp: 3000,
			}),
		);

		turns.close();
		const events = await collect(turns);
		assert.strictEqual(events.length, 2);
		assert.strictEqual(events[0].type, "turn:start");
		assert.strictEqual(events[1].type, "turn:end");
	});

	it("handles multiple turns in sequence", async () => {
		const tf = createTurnTransformer();
		const { turns } = tf.init();

		// Turn 1
		tf.process(
			makeEvent({
				method: "updates",
				data: { values: { messages: [humanMsg("first", "h1")] } },
				timestamp: 1000,
			}),
		);
		tf.process(
			makeEvent({
				method: "updates",
				data: { values: { messages: [humanMsg("first", "h1"), aiMsg("first response", "a1")] } },
				timestamp: 2000,
			}),
		);

		// Turn 2
		tf.process(
			makeEvent({
				method: "updates",
				data: {
					values: {
						messages: [
							humanMsg("first", "h1"),
							aiMsg("first response", "a1"),
							humanMsg("second", "h2"),
						],
					},
				},
				timestamp: 3000,
			}),
		);
		tf.process(
			makeEvent({
				method: "updates",
				data: {
					values: {
						messages: [
							humanMsg("first", "h1"),
							aiMsg("first response", "a1"),
							humanMsg("second", "h2"),
							aiMsg("second response", "a2"),
						],
					},
				},
				timestamp: 4000,
			}),
		);

		turns.close();
		const events = await collect(turns);
		assert.strictEqual(events.length, 4);
		assert.strictEqual(events[0].type, "turn:start");
		assert.strictEqual(events[0].messageId, "h1");
		assert.strictEqual(events[1].type, "turn:end");
		assert.strictEqual(events[1].messageId, "a1");
		assert.strictEqual(events[2].type, "turn:start");
		assert.strictEqual(events[2].messageId, "h2");
		assert.strictEqual(events[3].type, "turn:end");
		assert.strictEqual(events[3].messageId, "a2");
	});

	it("handles zero tool calls (direct response)", async () => {
		const tf = createTurnTransformer();
		const { turns } = tf.init();

		tf.process(
			makeEvent({
				method: "updates",
				data: { values: { messages: [humanMsg("hello", "h1")] } },
				timestamp: 1000,
			}),
		);
		tf.process(
			makeEvent({
				method: "updates",
				data: { values: { messages: [humanMsg("hello", "h1"), aiMsg("direct response", "a1")] } },
				timestamp: 2000,
			}),
		);

		turns.close();
		const events = await collect(turns);
		assert.strictEqual(events.length, 2);
		assert.strictEqual(events[0].type, "turn:start");
		assert.strictEqual(events[1].type, "turn:end");
	});

	it("handles tool error as resolution", async () => {
		const tf = createTurnTransformer();
		const { turns } = tf.init();

		tf.process(
			makeEvent({
				method: "updates",
				data: { values: { messages: [humanMsg("hello", "h1")] } },
				timestamp: 1000,
			}),
		);

		tf.process(
			makeEvent({
				method: "tools",
				data: { event: "tool-started", tool_call_id: "tc-1", tool_name: "search" },
				timestamp: 1500,
			}),
		);

		tf.process(
			makeEvent({
				method: "tools",
				data: { event: "tool-error", tool_call_id: "tc-1", message: "failed" },
				timestamp: 2000,
			}),
		);

		tf.process(
			makeEvent({
				method: "updates",
				data: { values: { messages: [humanMsg("hello", "h1"), aiMsg("error handled", "a1")] } },
				timestamp: 2500,
			}),
		);

		turns.close();
		const events = await collect(turns);
		assert.strictEqual(events.length, 2);
		assert.strictEqual(events[0].type, "turn:start");
		assert.strictEqual(events[1].type, "turn:end");
	});

	it("emits turn:end on finalize if still in a turn", async () => {
		const tf = createTurnTransformer();
		const { turns } = tf.init();

		tf.process(
			makeEvent({
				method: "updates",
				data: { values: { messages: [humanMsg("hello", "h1")] } },
				timestamp: 1000,
			}),
		);

		tf.finalize();
		turns.close();
		const events = await collect(turns);
		assert.strictEqual(events.length, 2);
		assert.strictEqual(events[0].type, "turn:start");
		assert.strictEqual(events[1].type, "turn:end");
	});

	it("emits turn:end on fail if still in a turn", async () => {
		const tf = createTurnTransformer();
		const { turns } = tf.init();

		tf.process(
			makeEvent({
				method: "updates",
				data: { values: { messages: [humanMsg("hello", "h1")] } },
				timestamp: 1000,
			}),
		);

		tf.fail(new Error("something went wrong"));
		turns.close();
		const events = await collect(turns);
		assert.strictEqual(events.length, 2);
		assert.strictEqual(events[0].type, "turn:start");
		assert.strictEqual(events[1].type, "turn:end");
	});

	it("ignores duplicate HumanMessage IDs (dedup)", async () => {
		const tf = createTurnTransformer();
		const { turns } = tf.init();

		tf.process(
			makeEvent({
				method: "updates",
				data: { values: { messages: [humanMsg("hello", "h1")] } },
				timestamp: 1000,
			}),
		);
		tf.process(
			makeEvent({
				method: "updates",
				data: { values: { messages: [humanMsg("hello", "h1")] } },
				timestamp: 2000,
			}),
		);

		turns.close();
		const events = await collect(turns);
		assert.strictEqual(events.length, 1);
		assert.strictEqual(events[0].type, "turn:start");
	});

	it("works with values channel (full state snapshots)", async () => {
		const tf = createTurnTransformer();
		const { turns } = tf.init();

		tf.process(
			makeEvent({
				method: "values",
				data: { messages: [humanMsg("hello", "h1")] },
				timestamp: 1000,
			}),
		);
		tf.process(
			makeEvent({
				method: "values",
				data: { messages: [humanMsg("hello", "h1"), aiMsg("response", "a1")] },
				timestamp: 2000,
			}),
		);

		turns.close();
		const events = await collect(turns);
		assert.strictEqual(events.length, 2);
		assert.strictEqual(events[0].type, "turn:start");
		assert.strictEqual(events[1].type, "turn:end");
	});

	it("does not emit turn:start for non-human messages", async () => {
		const tf = createTurnTransformer();
		const { turns } = tf.init();

		const sysMsg = {
			_getType() {
				return "system";
			},
			content: "system prompt",
			id: "s1",
		};

		tf.process(
			makeEvent({
				method: "updates",
				data: { values: { messages: [sysMsg] } },
				timestamp: 1000,
			}),
		);

		turns.close();
		const events = await collect(turns);
		assert.strictEqual(events.length, 0);
	});

	it("handles messages without IDs gracefully", async () => {
		const tf = createTurnTransformer();
		const { turns } = tf.init();

		const msgNoId = {
			_getType() {
				return "human";
			},
			content: "hello",
		};

		tf.process(
			makeEvent({
				method: "updates",
				data: { values: { messages: [msgNoId] } },
				timestamp: 1000,
			}),
		);

		turns.close();
		const events = await collect(turns);
		assert.strictEqual(events.length, 0);
	});

	it("guards against re-entrant self-processing", async () => {
		const tf = createTurnTransformer();
		const { turns } = tf.init();

		tf.process(
			makeEvent({
				method: "updates",
				data: { values: { messages: [humanMsg("hello", "h1")] } },
				timestamp: 1000,
			}),
		);
		tf.process(
			makeEvent({
				method: "updates",
				data: { values: { messages: [humanMsg("hello", "h1"), aiMsg("response", "a1")] } },
				timestamp: 2000,
			}),
		);

		turns.close();
		const events = await collect(turns);
		assert.strictEqual(events.length, 2);
	});
});
