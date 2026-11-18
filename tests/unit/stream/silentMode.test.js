/**
 * Silent mode (`agent.silent`): when a second text-bearing assistant message
 * starts while the turn is still streaming, the stream is abandoned before that
 * text is forwarded and `silentViolation` is reported so the TUI can nudge.
 */

import { describe, it } from "node:test";
import assert from "node:assert";
import { AIMessageChunk, ToolMessage } from "@langchain/core/messages";
import { consumeStream } from "../../../src/stream/consume.js";
import { shouldNudgeSilent, SILENT_MODE_NUDGE } from "../../../src/tui/conversationArea.js";

const ev = (msg, namespace = []) => [namespace, "messages", [msg, {}]];
const say = (id, text) => new AIMessageChunk({ id, content: text });
const tool = (id, text) => new ToolMessage({ id, content: text, tool_call_id: "t", name: "x" });

const streamOf = (...events) =>
	(async function* () {
		for (const e of events) yield e;
	})();

describe("consumeStream silent mode", () => {
	it("abandons the stream when a second message starts, without forwarding it", async () => {
		const seen = [];
		const result = await consumeStream(
			streamOf(ev(say("A", "first")), ev(tool("T", "ok")), ev(say("B", "second"))),
			(e) => seen.push(e),
			{ silent: true, showToolResults: true },
		);
		assert.strictEqual(result.silentViolation, true);
		assert.strictEqual(result.content, "first");
		assert.ok(!seen.some((e) => e.text === "second"));
	});

	it("does not flag chunks of the same message", async () => {
		const result = await consumeStream(
			streamOf(ev(say("A", "one ")), ev(say("A", "two"))),
			undefined,
			{ silent: true },
		);
		assert.strictEqual(result.silentViolation, false);
		assert.strictEqual(result.content, "one two");
	});

	it("ignores messages with no text (tool-call-only turns)", async () => {
		const result = await consumeStream(
			streamOf(ev(say("A", "")), ev(tool("T", "ok")), ev(say("B", "answer"))),
			undefined,
			{ silent: true },
		);
		assert.strictEqual(result.silentViolation, false);
		assert.strictEqual(result.content, "answer");
	});

	it("ignores subagent messages", async () => {
		const result = await consumeStream(
			streamOf(
				ev(say("A", "mine")),
				ev(say("S1", "sub one"), ["tools:1"]),
				ev(say("S2", "sub two"), ["tools:1"]),
			),
			undefined,
			{ silent: true },
		);
		assert.strictEqual(result.silentViolation, false);
	});

	it("never flags when silent mode is off", async () => {
		const result = await consumeStream(
			streamOf(ev(say("A", "first")), ev(say("B", "second"))),
			undefined,
			{ silent: false },
		);
		assert.strictEqual(result.silentViolation, false);
		assert.strictEqual(result.content, "firstsecond");
	});
});

describe("shouldNudgeSilent", () => {
	const base = {
		silentViolation: true,
		streamingMsgId: "m1",
		lastMessageId: "m1",
		autoContinueCount: 0,
		autoContinueLimit: 10,
	};

	it("uses the agreed nudge text", () => {
		assert.strictEqual(SILENT_MODE_NUDGE, "Stay quiet, silent mode is enabled");
	});

	it("nudges on a violation in the last bubble", () => {
		assert.strictEqual(shouldNudgeSilent(base), true);
	});

	it("does not nudge without a violation", () => {
		assert.strictEqual(shouldNudgeSilent({ ...base, silentViolation: false }), false);
	});

	it("does not nudge an interrupted turn", () => {
		assert.strictEqual(shouldNudgeSilent({ ...base, interrupted: true }), false);
	});

	it("does not nudge when the bubble is not the last", () => {
		assert.strictEqual(shouldNudgeSilent({ ...base, lastMessageId: "m2" }), false);
	});

	it("does not nudge once the limit is reached", () => {
		assert.strictEqual(shouldNudgeSilent({ ...base, autoContinueCount: 10 }), false);
	});
});
