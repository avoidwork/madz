import { describe, it } from "node:test";
import assert from "node:assert";
import { AIMessage, HumanMessage, ToolMessage } from "@langchain/core/messages";
import {
	compactMessages,
	findTailStart,
	buildTranscript,
	SUMMARY_PREFIX,
	DEFAULT_KEEP_MESSAGES,
} from "../../../src/agent/compaction.js";

const human = (t) => new HumanMessage(t);
const ai = (t, calls) => new AIMessage({ content: t, tool_calls: calls });
const tool = (id, t, name = "t") => new ToolMessage({ content: t, tool_call_id: id, name });
const model = (text = "SUMMARY") => ({ invoke: async () => ({ text }) });

describe("findTailStart", () => {
	it("keeps the last N messages", () => {
		const msgs = [human("a"), ai("b"), human("c"), ai("d"), human("e"), ai("f"), human("g")];
		assert.strictEqual(findTailStart(msgs, 5), 2);
	});

	it("keeps everything when fewer than N", () => {
		assert.strictEqual(findTailStart([human("a"), ai("b")], 5), 0);
	});

	it("never starts the tail on a tool result (moves forward past it)", () => {
		const msgs = [
			human("a"),
			ai("call", [{ id: "1", name: "t", args: {} }]),
			tool("1", "r1"),
			ai("done"),
			human("next"),
		];
		// keep=3 would start at the tool message; it moves forward to "done".
		assert.strictEqual(findTailStart(msgs, 3), 3);
	});

	it("can shrink the tail to zero when it is all tool results", () => {
		const msgs = [
			human("a"),
			ai("call", [
				{ id: "1", name: "t", args: {} },
				{ id: "2", name: "t", args: {} },
			]),
			tool("1", "r1"),
			tool("2", "r2"),
		];
		assert.strictEqual(findTailStart(msgs, 2), 4);
	});

	it("treats keep 0 as no tail", () => {
		assert.strictEqual(findTailStart([human("a"), ai("b")], 0), 2);
	});
});

describe("buildTranscript", () => {
	it("labels roles, tool calls and tool names", () => {
		const out = buildTranscript([
			human("hi"),
			ai("calling", [{ id: "1", name: "grep", args: {} }]),
			tool("1", "found", "grep"),
		]);
		assert.match(out, /human: hi/);
		assert.match(out, /ai \[tool calls: grep\]: calling/);
		assert.match(out, /tool:grep: found/);
	});

	it("truncates very long messages", () => {
		const out = buildTranscript([human("x".repeat(10000))]);
		assert.ok(out.length < 5000);
		assert.match(out, /truncated/);
	});

	it("replaces image blocks with a placeholder", () => {
		const out = buildTranscript([
			new HumanMessage({
				content: [
					{ type: "text", text: "look" },
					{ type: "image_url", image_url: { url: "data:image/png;base64,AAAA" } },
				],
			}),
		]);
		assert.match(out, /\[image\]/);
		assert.ok(!out.includes("AAAA"));
	});
});

describe("compactMessages", () => {
	it("returns [summary, ...last 5] for a long history", async () => {
		const msgs = Array.from({ length: 12 }, (_, i) => (i % 2 ? ai(`m${i}`) : human(`m${i}`)));
		const result = await compactMessages({ messages: msgs, model: model("S") });
		assert.strictEqual(result.messages.length, 1 + DEFAULT_KEEP_MESSAGES);
		assert.ok(result.messages[0].content.startsWith(SUMMARY_PREFIX));
		assert.ok(result.messages[0].content.includes("S"));
		assert.strictEqual(result.messages[1].content, "m7");
		assert.strictEqual(result.messages.at(-1).content, "m11");
		assert.strictEqual(result.summarized, 7);
		assert.strictEqual(result.kept, 5);
	});

	it("marks the summary as a HumanMessage so strict providers accept it", async () => {
		const msgs = Array.from({ length: 8 }, (_, i) => human(`m${i}`));
		const { messages } = await compactMessages({ messages: msgs, model: model() });
		assert.strictEqual(messages[0]._getType(), "human");
		assert.strictEqual(messages[0].additional_kwargs.madz_summary, true);
	});

	it("returns null when there is nothing before the tail", async () => {
		const msgs = [human("a"), ai("b"), human("c")];
		assert.strictEqual(await compactMessages({ messages: msgs, model: model() }), null);
	});

	it("returns null when the only older content is a prior summary", async () => {
		const prior = human(`${SUMMARY_PREFIX}\n\nold`);
		const msgs = [prior, human("a"), ai("b"), human("c"), ai("d"), human("e")];
		assert.strictEqual(await compactMessages({ messages: msgs, model: model() }), null);
	});

	it("folds a prior summary into the new one", async () => {
		let seen = "";
		const m = {
			invoke: async (input) => {
				seen = input[0].content;
				return { text: "NEW" };
			},
		};
		const prior = human(`${SUMMARY_PREFIX}\n\nOLD FACTS`);
		const msgs = [prior, ...Array.from({ length: 8 }, (_, i) => human(`m${i}`))];
		const { messages } = await compactMessages({ messages: msgs, model: m });
		assert.match(seen, /OLD FACTS/);
		assert.strictEqual(messages.length, 6);
	});

	it("never leaves a tool result without its tool call in the tail", async () => {
		const msgs = [
			human("a"),
			human("b"),
			human("c"),
			ai("call", [{ id: "1", name: "t", args: {} }]),
			tool("1", "r"),
			ai("answer"),
			human("more"),
		];
		const { messages } = await compactMessages({ messages: msgs, model: model(), keep: 3 });
		const tail = messages.slice(1);
		assert.notStrictEqual(tail[0]._getType(), "tool");
		assert.deepStrictEqual(
			tail.map((m) => m.content),
			["answer", "more"],
		);
	});

	it("offloads the summarized history to the backend", async () => {
		const writes = [];
		const backend = { write: async (path, content) => writes.push({ path, content }) };
		const msgs = Array.from({ length: 9 }, (_, i) => human(`m${i}`));
		const result = await compactMessages({
			messages: msgs,
			model: model(),
			backend,
			threadId: "thr/1",
		});
		assert.strictEqual(writes.length, 1);
		assert.match(writes[0].path, /^\/conversation_history\/thr_1-\d+\.md$/);
		assert.match(writes[0].content, /m0/);
		assert.ok(!writes[0].content.includes("m8"));
		assert.match(result.messages[0].content, /saved to \/conversation_history/);
	});

	it("continues when the offload fails", async () => {
		const backend = {
			write: async () => {
				throw new Error("disk full");
			},
		};
		const msgs = Array.from({ length: 9 }, (_, i) => human(`m${i}`));
		const result = await compactMessages({ messages: msgs, model: model(), backend });
		assert.strictEqual(result.offloadPath, null);
		assert.ok(!result.messages[0].content.includes("saved to"));
	});

	it("throws when the summarizer fails so callers can keep state", async () => {
		const m = {
			invoke: async () => {
				throw new Error("model down");
			},
		};
		const msgs = Array.from({ length: 9 }, (_, i) => human(`m${i}`));
		await assert.rejects(() => compactMessages({ messages: msgs, model: m }), /model down/);
	});

	it("throws on an empty summary", async () => {
		const msgs = Array.from({ length: 9 }, (_, i) => human(`m${i}`));
		await assert.rejects(
			() => compactMessages({ messages: msgs, model: model("   ") }),
			/empty output/,
		);
	});

	it("honors a custom keep", async () => {
		const msgs = Array.from({ length: 9 }, (_, i) => human(`m${i}`));
		const { messages } = await compactMessages({ messages: msgs, model: model(), keep: 2 });
		assert.strictEqual(messages.length, 3);
	});
});
