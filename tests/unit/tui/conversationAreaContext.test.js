import { describe, it } from "node:test";
import assert from "node:assert";
import React from "react";
import { render } from "ink";
import ConversationArea from "../../../src/tui/conversationArea.js";

const words = (n) => Array.from({ length: n }, (_, i) => `w${i}`).join(" ");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Deterministic tokenizer: one token per whitespace-separated word. */
const model = {
	getNumTokensFromMessages: async (msgs) => ({
		totalCount: msgs.reduce(
			(n, m) =>
				n +
				String(m.content ?? "")
					.split(/\s+/)
					.filter(Boolean).length,
			0,
		),
	}),
};

/**
 * Mount ConversationArea, send one chat turn whose provider emits the given
 * stream events, and return every value reported to onContextChange.
 * @param {Array<Object>} events - Stream events the provider emits
 * @returns {Promise<number[]>} Context sizes reported during the turn
 */
async function runTurnWithEvents(events) {
	const reported = [];
	const ref = React.createRef();
	const dispatchProvider = async (_text, _provider, handler) => {
		for (const event of events) await handler(event);
		await sleep(150);
		return { content: "", lastEventType: "message" };
	};
	const { unmount } = render(
		React.createElement(ConversationArea, {
			ref,
			config: { tui: { name: "madz" } },
			model,
			dispatchProvider,
			messageCountRef: { current: 0 },
			onContextChange: (n) => reported.push(n),
			onCompactingChange: () => {},
			onInterruptInput: () => {},
			onQuit: () => {},
			onNewSession: () => {},
			contextWindow: 10000,
		}),
	);
	try {
		await sleep(50);
		await ref.current.handleChat("hi");
		await sleep(250);
	} finally {
		unmount();
	}
	return reported;
}

describe("ConversationArea live context counter", () => {
	it("counts streamed message text", async () => {
		const reported = await runTurnWithEvents([{ type: "message", text: words(30) }]);
		assert.strictEqual(reported.at(-1), 30);
	});

	it("counts streamed reasoning text", async () => {
		const reported = await runTurnWithEvents([{ type: "reasoning", text: words(100) }]);
		assert.strictEqual(reported.at(-1), 100);
	});

	it("counts reasoning and message text together", async () => {
		const reported = await runTurnWithEvents([
			{ type: "reasoning", text: words(40) },
			{ type: "message", text: words(30) },
		]);
		assert.strictEqual(reported.at(-1), 70);
	});

	it("counts tool result text", async () => {
		const reported = await runTurnWithEvents([{ type: "tool", text: words(50), name: "readFile" }]);
		assert.strictEqual(reported.at(-1), 50);
	});

	it("counts the tool call name and arguments", async () => {
		const reported = await runTurnWithEvents([
			{ type: "on_tool_start", name: "readFile", data: { input: { path: "/x" } } },
		]);
		// `readFile {"path":"/x"}` is two whitespace-separated tokens.
		assert.strictEqual(reported.at(-1), 2);
	});

	it("counts tool call and tool result together", async () => {
		const reported = await runTurnWithEvents([
			{ type: "on_tool_start", name: "readFile", data: { input: { path: "/x" } } },
			{ type: "tool", text: words(50), name: "readFile" },
		]);
		assert.strictEqual(reported.at(-1), 52);
	});
});
