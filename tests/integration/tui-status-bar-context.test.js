/**
 * Integration test: the rendered status bar reflects the live context counter.
 * Mounts ConversationArea and InputArea wired the way App wires them
 * (ConversationArea.onContextChange -> InputArea.setContextSize), streams events,
 * and reads the frames Ink actually writes.
 */

import { describe, it, afterEach } from "node:test";
import assert from "node:assert";
import React from "react";
import { EventEmitter } from "node:events";
import { render } from "ink";
import ConversationArea from "../../src/tui/conversationArea.js";
import InputArea from "../../src/tui/inputArea.js";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const words = (n) => Array.from({ length: n }, (_, i) => `w${i}`).join(" ");

/** Minimal TTY-like stdin that supports Ink raw mode. */
function makeStdin() {
	const s = new EventEmitter();
	s.isTTY = true;
	s.isRaw = false;
	s.setRawMode = (v) => {
		s.isRaw = v;
	};
	s.setEncoding = () => {};
	s.resume = () => {};
	s.pause = () => {};
	s.ref = () => {};
	s.unref = () => {};
	s.read = () => null;
	s.readableEncoding = null;
	return s;
}

/** TTY-like stdout that records frames. */
function makeStdout() {
	const s = new EventEmitter();
	s.isTTY = true;
	s.columns = 120;
	s.rows = 40;
	s.frames = [];
	s.write = (d) => {
		s.frames.push(String(d));
		return true;
	};
	return s;
}

/** One token per whitespace-separated word. */
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

let instance;
afterEach(() => {
	instance?.unmount();
	instance = undefined;
});

/**
 * Mount both components wired like App and send one turn emitting `events`.
 * @param {Array<Object>} events - Stream events the provider emits
 * @returns {Promise<{stdout: Object, reported: number[]}>} Output frames and reported sizes
 */
async function runWired(events) {
	const stdout = makeStdout();
	const stdin = makeStdin();
	const reported = [];
	const convRef = React.createRef();
	const inputRef = React.createRef();
	const dispatchProvider = async (_text, _provider, handler) => {
		for (const event of events) await handler(event);
		await sleep(150);
		return { content: "", lastEventType: "message" };
	};
	const messageCountRef = { current: 0 };
	const Wired = () =>
		React.createElement(
			React.Fragment,
			null,
			React.createElement(ConversationArea, {
				ref: convRef,
				config: { tui: { name: "madz" } },
				model,
				dispatchProvider,
				messageCountRef,
				contextWindow: 1000,
				onContextChange: (n) => {
					reported.push(n);
					inputRef.current?.setContextSize(n);
				},
				onCompactingChange: () => {},
				onInterruptInput: () => {},
				onQuit: () => {},
				onNewSession: () => {},
			}),
			React.createElement(InputArea, {
				ref: inputRef,
				onSubmit: () => {},
				messageCountRef,
				contextWindow: 1000,
				appInfo: { version: "0", model: "m" },
				statusBar: {},
			}),
		);
	instance = render(React.createElement(Wired), { stdout, stdin, debug: true });
	await sleep(100);
	await convRef.current.handleChat("hi");
	await sleep(300);
	return { stdout, reported };
}

describe("status bar reflects the live context counter", () => {
	it("shows the context meter after streamed reasoning", async () => {
		const { stdout, reported } = await runWired([{ type: "reasoning", text: words(500) }]);
		assert.strictEqual(reported.at(-1), 500);
		const last = stdout.frames.filter((f) => f.includes("%")).at(-1) || "";
		assert.match(last, /50%/, `status bar did not show 50%; last frame:\n${last}`);
	});

	it("shows the context meter after a tool call and result", async () => {
		const { stdout, reported } = await runWired([
			{ type: "on_tool_start", name: "readFile", data: { input: { path: "/x" } } },
			{ type: "tool", text: words(298), name: "readFile" },
		]);
		assert.strictEqual(reported.at(-1), 300);
		const last = stdout.frames.filter((f) => f.includes("%")).at(-1) || "";
		assert.match(last, /30%/, `status bar did not show 30%; last frame:\n${last}`);
	});
});
