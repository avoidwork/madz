/**
 * Integration test: click-to-toggle on collapsible block headers.
 * Renders a MessageBubble under a real ink-mouse MouseProvider with fake TTY
 * streams and feeds SGR mouse sequences through stdin.
 * @see {@link src/tui/headerClick.js}
 */

import { describe, it, afterEach } from "node:test";
import assert from "node:assert";
import React, { useState } from "react";
import { EventEmitter } from "node:events";
import { render } from "ink";
import { MouseProvider } from "@ink-tools/ink-mouse";
import { MouseGate } from "../../src/tui/headerClick.js";
import { MessageBubbleInner, PubSubContext, ScrollContext } from "../../src/tui/messageBubble.js";

/** Minimal TTY-like stdin that supports Ink raw mode and xterm-mouse. */
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
	s.columns = 80;
	s.rows = 24;
	s.frames = [];
	s.write = (d) => {
		s.frames.push(String(d));
		return true;
	};
	return s;
}

const tick = (ms = 40) => new Promise((r) => setTimeout(r, ms));

/** Last frame that contains the given text. */
function lastFrame(stdout) {
	return stdout.frames.filter((f) => f.includes("Assistant")).at(-1) || "";
}

/** 1-indexed terminal row of the first line containing `needle` in the last frame. */
function rowOf(stdout, needle) {
	const lines = lastFrame(stdout).split("\n");
	const idx = lines.findIndex((l) => l.includes(needle));
	return idx === -1 ? -1 : idx + 1;
}

/** Send a left click (press + release) at 1-indexed (x, y). */
async function click(stdin, x, y) {
	stdin.emit("data", `\x1b[<0;${x};${y}M`);
	stdin.emit("data", `\x1b[<0;${x};${y}m`);
	await tick();
}

let instance;
afterEach(() => {
	instance?.unmount();
	instance = undefined;
});

/**
 * Harness: owns the collapse booleans like App does and renders one bubble.
 * @param {Object} props
 * @returns {React.ReactElement}
 */
function Harness({ segments, streaming = false, scroll = { offset: 0 }, stats }) {
	const [reasoningCollapsed, setReasoning] = useState(true);
	const [toolCallCollapsed, setTool] = useState(true);
	stats.state = { reasoningCollapsed, toolCallCollapsed };
	return React.createElement(
		MouseProvider,
		{ autoEnable: false },
		React.createElement(MouseGate, { active: true }),
		React.createElement(
			PubSubContext.Provider,
			{ value: { subscribe: () => {}, unsubscribe: () => {} } },
			React.createElement(
				ScrollContext.Provider,
				{ value: { scrollToBottom: () => {}, getScrollInfo: () => scroll } },
				React.createElement(MessageBubbleInner, {
					role: "assistant",
					content: "",
					segments,
					streaming,
					reasoningCollapsed,
					toolCallCollapsed,
					onToggleReasoning: () => setReasoning((p) => !p),
					onToggleToolCall: () => setTool((p) => !p),
				}),
			),
		),
	);
}

function mount(props) {
	const stdin = makeStdin();
	const stdout = makeStdout();
	const stats = {};
	instance = render(React.createElement(Harness, { ...props, stats }), {
		stdin,
		stdout,
		patchConsole: false,
		interactive: true,
		exitOnCtrlC: false,
	});
	return { stdin, stdout, stats };
}

const SEGMENTS = [
	{ type: "reasoning", content: "pondering deeply" },
	{ type: "tool", name: "read_file", content: "tool output body" },
];

describe("click-to-toggle collapsible blocks", () => {
	it("toggles a tool block open and closed by clicking its header", async () => {
		const { stdin, stdout, stats } = mount({ segments: SEGMENTS });
		await tick(100);
		assert.ok(!lastFrame(stdout).includes("tool output body"));
		const y = rowOf(stdout, "read_file");
		assert.ok(y > 0, "tool header rendered");
		await click(stdin, 4, y);
		assert.strictEqual(stats.state.toolCallCollapsed, false);
		assert.ok(lastFrame(stdout).includes("tool output body"), "body expanded");
		await click(stdin, 4, rowOf(stdout, "read_file"));
		assert.strictEqual(stats.state.toolCallCollapsed, true);
		assert.ok(!lastFrame(stdout).includes("tool output body"), "body collapsed");
		assert.strictEqual(stats.state.reasoningCollapsed, true);
	});

	it("toggles a reasoning block open and closed by clicking its header", async () => {
		const { stdin, stdout, stats } = mount({ segments: SEGMENTS });
		await tick(100);
		const y = rowOf(stdout, "Thinking");
		assert.ok(y > 0, "reasoning header rendered");
		await click(stdin, 4, y);
		assert.strictEqual(stats.state.reasoningCollapsed, false);
		assert.ok(lastFrame(stdout).includes("pondering deeply"));
		await click(stdin, 4, rowOf(stdout, "Thinking"));
		assert.strictEqual(stats.state.reasoningCollapsed, true);
		assert.strictEqual(stats.state.toolCallCollapsed, true);
	});

	it("does not toggle on a click outside any header", async () => {
		const { stdin, stdout, stats } = mount({ segments: SEGMENTS });
		await tick(100);
		const y = rowOf(stdout, "read_file");
		await click(stdin, 4, y + 5);
		await click(stdin, 60, y);
		await click(stdin, 4, 1);
		assert.strictEqual(stats.state.toolCallCollapsed, true);
		assert.strictEqual(stats.state.reasoningCollapsed, true);
	});

	it("toggles while streaming", async () => {
		const { stdin, stdout, stats } = mount({ segments: SEGMENTS, streaming: true });
		await tick(100);
		const y = rowOf(stdout, "read_file");
		assert.ok(y > 0);
		await click(stdin, 4, y);
		assert.strictEqual(stats.state.toolCallCollapsed, false);
	});

	it("does not toggle for a click outside the visible viewport", async () => {
		const viewport = { left: 1, top: 1, right: 80, bottom: 3 };
		const { stdin, stdout, stats } = mount({
			segments: SEGMENTS,
			scroll: { offset: 0, viewport },
		});
		await tick(100);
		const y = rowOf(stdout, "read_file");
		await click(stdin, 4, y);
		assert.strictEqual(stats.state.toolCallCollapsed, true);
	});
});
