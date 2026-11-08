/**
 * Integration test: click-to-toggle on collapsible block headers.
 * Renders a MessageBubble under a real ink-mouse MouseProvider with fake TTY
 * streams and feeds SGR mouse sequences through stdin.
 * @see {@link src/tui/headerClick.js}
 */

import { describe, it, afterEach } from "node:test";
import assert from "node:assert";
import React from "react";
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
 * Harness: renders one bubble under a MouseProvider. Collapse state for clicks
 * lives inside the bubble (per block); `reasoningCollapsed` / `toolCallCollapsed`
 * are the global (keyboard) defaults and stay fixed here.
 * @param {Object} props
 * @returns {React.ReactElement}
 */
function Harness({
	segments,
	streaming = false,
	scroll = { offset: 0 },
	reasoningCollapsed = true,
	toolCallCollapsed = true,
}) {
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
				}),
			),
		),
	);
}

function mount(props) {
	const stdin = makeStdin();
	const stdout = makeStdout();
	instance = render(React.createElement(Harness, props), {
		stdin,
		stdout,
		patchConsole: false,
		interactive: true,
		exitOnCtrlC: false,
	});
	return { stdin, stdout };
}

const SEGMENTS = [
	{ type: "reasoning", content: "pondering deeply" },
	{ type: "tool", name: "read_file", content: "tool output body" },
];

describe("click-to-toggle collapsible blocks", () => {
	it("toggles a tool block open and closed by clicking its header", async () => {
		const { stdin, stdout } = mount({ segments: SEGMENTS });
		await tick(100);
		assert.ok(!lastFrame(stdout).includes("tool output body"));
		const y = rowOf(stdout, "read_file");
		assert.ok(y > 0, "tool header rendered");
		await click(stdin, 4, y);
		assert.ok(lastFrame(stdout).includes("tool output body"), "body expanded");
		await click(stdin, 4, rowOf(stdout, "read_file"));
		assert.ok(!lastFrame(stdout).includes("tool output body"), "body collapsed");
		assert.ok(!lastFrame(stdout).includes("pondering deeply"), "reasoning untouched");
	});

	it("toggles a reasoning block open and closed by clicking its header", async () => {
		const { stdin, stdout } = mount({ segments: SEGMENTS });
		await tick(100);
		const y = rowOf(stdout, "Thinking");
		assert.ok(y > 0, "reasoning header rendered");
		await click(stdin, 4, y);
		assert.ok(lastFrame(stdout).includes("pondering deeply"));
		await click(stdin, 4, rowOf(stdout, "Thinking"));
		assert.ok(!lastFrame(stdout).includes("pondering deeply"));
		assert.ok(!lastFrame(stdout).includes("tool output body"), "tool untouched");
	});

	it("does not toggle on a click outside any header", async () => {
		const { stdin, stdout } = mount({ segments: SEGMENTS });
		await tick(100);
		const y = rowOf(stdout, "read_file");
		await click(stdin, 4, y + 5);
		await click(stdin, 60, y);
		await click(stdin, 4, 1);
		assert.ok(!lastFrame(stdout).includes("tool output body"));
		assert.ok(!lastFrame(stdout).includes("pondering deeply"));
	});

	it("toggles while streaming", async () => {
		const { stdin, stdout } = mount({ segments: SEGMENTS, streaming: true });
		await tick(100);
		const y = rowOf(stdout, "read_file");
		assert.ok(y > 0);
		await click(stdin, 4, y);
		assert.ok(lastFrame(stdout).includes("tool output body"));
	});

	it("does not toggle for a click outside the visible viewport", async () => {
		const viewport = { left: 1, top: 1, right: 80, bottom: 3 };
		const { stdin, stdout } = mount({
			segments: SEGMENTS,
			scroll: { offset: 0, viewport },
		});
		await tick(100);
		const y = rowOf(stdout, "read_file");
		await click(stdin, 4, y);
		assert.ok(!lastFrame(stdout).includes("tool output body"));
	});

	it("expands only the clicked reasoning block when there are several", async () => {
		const segments = [
			{ type: "reasoning", content: "first thought" },
			{ type: "reasoning", content: "second thought" },
			{ type: "reasoning", content: "third thought" },
		];
		const { stdin, stdout } = mount({ segments });
		await tick(100);
		const rows = lastFrame(stdout)
			.split("\n")
			.map((l, i) => (l.includes("Thinking") ? i + 1 : -1))
			.filter((r) => r > 0);
		assert.strictEqual(rows.length, 3, "three headers rendered");
		await click(stdin, 4, rows[1]);
		const frame = lastFrame(stdout);
		assert.ok(frame.includes("second thought"), "clicked block expanded");
		assert.ok(!frame.includes("first thought"), "first block still collapsed");
		assert.ok(!frame.includes("third thought"), "third block still collapsed");
	});

	it("collapses only the clicked block when several are expanded", async () => {
		const segments = [
			{ type: "reasoning", content: "first thought" },
			{ type: "reasoning", content: "second thought" },
		];
		const { stdin, stdout } = mount({ segments, reasoningCollapsed: false });
		await tick(100);
		assert.ok(lastFrame(stdout).includes("first thought"));
		assert.ok(lastFrame(stdout).includes("second thought"));
		await click(stdin, 4, rowOf(stdout, "Thinking"));
		const frame = lastFrame(stdout);
		assert.ok(!frame.includes("first thought"), "clicked block collapsed");
		assert.ok(frame.includes("second thought"), "other block still expanded");
	});

	it("expands only the clicked tool block when there are several", async () => {
		const segments = [
			{ type: "tool", name: "read_file", content: "body one" },
			{ type: "tool", name: "write_file", content: "body two" },
		];
		const { stdin, stdout } = mount({ segments });
		await tick(100);
		await click(stdin, 4, rowOf(stdout, "write_file"));
		const frame = lastFrame(stdout);
		assert.ok(frame.includes("body two"));
		assert.ok(!frame.includes("body one"));
	});

	it("app-level toggle overrides click state, and stale clicks do not return", async () => {
		const segments = [
			{ type: "reasoning", content: "first thought" },
			{ type: "reasoning", content: "second thought" },
		];
		const { stdin, stdout } = mount({ segments });
		await tick(100);
		const rows = lastFrame(stdout)
			.split("\n")
			.map((l, i) => (l.includes("Thinking") ? i + 1 : -1))
			.filter((r) => r > 0);
		await click(stdin, 4, rows[1]);
		assert.ok(lastFrame(stdout).includes("second thought"), "clicked block expanded");
		assert.ok(!lastFrame(stdout).includes("first thought"));

		// App-level value flips to expanded: every block follows it.
		instance.rerender(React.createElement(Harness, { segments, reasoningCollapsed: false }));
		await tick(100);
		assert.ok(lastFrame(stdout).includes("first thought"));
		assert.ok(lastFrame(stdout).includes("second thought"));

		// ...and back to collapsed: every block follows, including the clicked one.
		instance.rerender(React.createElement(Harness, { segments, reasoningCollapsed: true }));
		await tick(100);
		assert.ok(!lastFrame(stdout).includes("first thought"));
		assert.ok(!lastFrame(stdout).includes("second thought"), "stale click did not return");
	});

	it("a click after an app-level change wins over the app value again", async () => {
		const segments = [
			{ type: "reasoning", content: "first thought" },
			{ type: "reasoning", content: "second thought" },
		];
		const { stdin, stdout } = mount({ segments, reasoningCollapsed: false });
		await tick(100);
		await click(stdin, 4, rowOf(stdout, "Thinking"));
		assert.ok(!lastFrame(stdout).includes("first thought"), "clicked block collapsed");
		assert.ok(lastFrame(stdout).includes("second thought"));
	});
});
