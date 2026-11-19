import { describe, it } from "node:test";
import assert from "node:assert";
import React from "react";
import { render } from "ink";
import ConversationArea, { abortable } from "../../../src/tui/conversationArea.js";

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

/**
 * Mount ConversationArea with an existing conversation (baseline context) and
 * send one turn; return every value reported to onContextChange, in order.
 * @param {Array<Object>} events - Stream events the provider emits
 * @param {number} baselineWords - Words already in the checkpointer conversation
 * @returns {Promise<number[]>} Context sizes reported, in order
 */
async function runTurnWithBaseline(events, baselineWords) {
	const { SessionStateManager } = await import("../../../src/session/stateManager.js");
	const sessionState = new SessionStateManager();
	const history = [{ role: "user", content: words(baselineWords) }];
	sessionState.loadConversation(history);
	const reported = [];
	const ref = React.createRef();
	const dispatchProvider = async (_text, _provider, handler) => {
		for (const event of events) {
			await handler(event);
			await sleep(60);
		}
		await sleep(150);
		return { content: "", lastEventType: "message" };
	};
	const { unmount } = render(
		React.createElement(ConversationArea, {
			ref,
			config: { tui: { name: "madz" } },
			model,
			sessionState,
			dispatchProvider,
			getContextMessages: async () => history,
			messageCountRef: { current: 0 },
			onContextChange: (n) => reported.push(n),
			onCompactingChange: () => {},
			onInterruptInput: () => {},
			onQuit: () => {},
			onNewSession: () => {},
			contextWindow: 100000,
		}),
	);
	try {
		await sleep(150);
		reported.length = 0;
		await ref.current.handleChat("hi");
		await sleep(250);
	} finally {
		unmount();
	}
	return reported;
}

describe("ConversationArea context size never drops below the baseline mid-turn", () => {
	it("keeps the full size while reasoning, tool calls and messages stream", async () => {
		const reported = await runTurnWithBaseline(
			[
				{ type: "reasoning", text: words(20) },
				{ type: "on_tool_start", name: "readFile", data: { input: { path: "/x" } } },
				{ type: "tool", text: words(30), name: "readFile" },
				{ type: "message", text: words(10) },
			],
			1000,
		);
		assert.ok(reported.length > 0, "no context updates reported");
		const low = Math.min(...reported);
		assert.ok(
			low >= 1000,
			`context size dropped to ${low} (baseline 1000); reported: ${JSON.stringify(reported)}`,
		);
	});
});

describe("ConversationArea context size is monotonic while the pre-turn recount is slow", () => {
	it("does not let a slow recount overwrite a newer streaming value", async () => {
		const { SessionStateManager } = await import("../../../src/session/stateManager.js");
		const sessionState = new SessionStateManager();
		const history = [{ role: "user", content: words(1000) }];
		sessionState.loadConversation(history);
		// Real tokenizers and checkpointer reads take time. Make the recount that
		// handleChat starts for the new user message ("hi") finish after streaming.
		const slowModel = {
			getNumTokensFromMessages: async (msgs) => {
				if (msgs.some((m) => m.content === "hi")) await sleep(300);
				return model.getNumTokensFromMessages(msgs);
			},
		};
		const reported = [];
		const ref = React.createRef();
		const dispatchProvider = async (_text, _provider, handler) => {
			await handler({ type: "reasoning", text: words(50) });
			await sleep(500);
			return { content: "", lastEventType: "message" };
		};
		const { unmount } = render(
			React.createElement(ConversationArea, {
				ref,
				config: { tui: { name: "madz" } },
				model: slowModel,
				sessionState,
				dispatchProvider,
				getContextMessages: async () => history,
				messageCountRef: { current: 0 },
				onContextChange: (n) => reported.push(n),
				onCompactingChange: () => {},
				onInterruptInput: () => {},
				onQuit: () => {},
				onNewSession: () => {},
				contextWindow: 100000,
			}),
		);
		try {
			await sleep(150);
			reported.length = 0;
			await ref.current.handleChat("hi");
			await sleep(400);
		} finally {
			unmount();
		}
		assert.ok(reported.length > 0, "no context updates reported");
		assert.strictEqual(
			reported.at(-1),
			1050,
			`final size should be the streamed total; reported: ${JSON.stringify(reported)}`,
		);
		for (let i = 1; i < reported.length; i++) {
			assert.ok(
				reported[i] >= reported[i - 1],
				`context size dropped from ${reported[i - 1]} to ${reported[i]}; reported: ${JSON.stringify(reported)}`,
			);
		}
	});
});

describe("abortable", () => {
	it("resolves with the value when the signal never aborts", async () => {
		const controller = new AbortController();
		assert.strictEqual(await abortable(Promise.resolve(7), controller.signal), 7);
	});

	it("passes the promise through when no signal is given", async () => {
		assert.strictEqual(await abortable(Promise.resolve(3)), 3);
	});

	it("rejects with an AbortError as soon as the signal aborts", async () => {
		const controller = new AbortController();
		const pending = abortable(
			sleep(500).then(() => "late"),
			controller.signal,
		);
		controller.abort();
		await assert.rejects(pending, (err) => err.name === "AbortError");
	});

	it("rejects immediately when the signal is already aborted", async () => {
		const controller = new AbortController();
		controller.abort();
		await assert.rejects(
			abortable(Promise.resolve(1), controller.signal),
			(err) => err.name === "AbortError",
		);
	});

	it("propagates the promise's own rejection", async () => {
		const controller = new AbortController();
		await assert.rejects(abortable(Promise.reject(new Error("boom")), controller.signal), /boom/);
	});
});

describe("ConversationArea aborts a superseded context update", () => {
	it("abandons the in-flight recount when a newer update begins", async () => {
		const { SessionStateManager } = await import("../../../src/session/stateManager.js");
		const sessionState = new SessionStateManager();
		const history = [{ role: "user", content: words(1000) }];
		sessionState.loadConversation(history);
		let recountsStarted = 0;
		const slowModel = {
			getNumTokensFromMessages: async (msgs) => {
				if (msgs.some((m) => m.content === "hi")) {
					recountsStarted++;
					await sleep(300);
				}
				return model.getNumTokensFromMessages(msgs);
			},
		};
		const reported = [];
		const ref = React.createRef();
		const dispatchProvider = async (_text, _provider, handler) => {
			await handler({ type: "reasoning", text: words(50) });
			await sleep(500);
			return { content: "", lastEventType: "message" };
		};
		const { unmount } = render(
			React.createElement(ConversationArea, {
				ref,
				config: { tui: { name: "madz" } },
				model: slowModel,
				sessionState,
				dispatchProvider,
				getContextMessages: async () => history,
				messageCountRef: { current: 0 },
				onContextChange: (n) => reported.push(n),
				onCompactingChange: () => {},
				onInterruptInput: () => {},
				onQuit: () => {},
				onNewSession: () => {},
				contextWindow: 100000,
			}),
		);
		try {
			await sleep(150);
			reported.length = 0;
			await ref.current.handleChat("hi");
			await sleep(600);
		} finally {
			unmount();
		}
		assert.strictEqual(recountsStarted, 1, "the pre-turn recount should have started");
		assert.ok(
			!reported.includes(1001),
			`the superseded recount's value was applied; reported: ${JSON.stringify(reported)}`,
		);
		assert.strictEqual(reported.at(-1), 1050);
	});
});

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
