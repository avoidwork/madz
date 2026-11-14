/**
 * Integration test: click-to-toggle on collapsible block headers inside the
 * SubagentsPanel, under a real ink-mouse MouseProvider with fake TTY streams.
 * @see {@link src/tui/subagentsPanel.js}
 */

import { describe, it, afterEach } from "node:test";
import assert from "node:assert";
import React from "react";
import { EventEmitter } from "node:events";
import { render } from "ink";
import { MouseProvider } from "@ink-tools/ink-mouse";
import { MouseGate } from "../../src/tui/headerClick.js";
import { SubagentsPanel } from "../../src/tui/subagentsPanel.js";

/** Minimal TTY-like stdin that supports Ink raw mode and xterm-mouse. */
function makeStdin() {
	const s = new EventEmitter();
	Object.assign(s, {
		isTTY: true,
		isRaw: false,
		setRawMode: (v) => {
			s.isRaw = v;
		},
		setEncoding: () => {},
		resume: () => {},
		pause: () => {},
		ref: () => {},
		unref: () => {},
		read: () => null,
		readableEncoding: null,
	});
	return s;
}

/** TTY-like stdout that records frames. */
function makeStdout() {
	const s = new EventEmitter();
	Object.assign(s, { isTTY: true, columns: 80, rows: 24, frames: [] });
	s.write = (d) => {
		s.frames.push(String(d));
		return true;
	};
	return s;
}

const tick = (ms = 40) => new Promise((r) => setTimeout(r, ms));
const lastFrame = (stdout) => stdout.frames.filter((f) => f.includes("Subagent")).at(-1) || "";

/** 1-indexed terminal row of the first line containing `needle`. */
function rowOf(stdout, needle) {
	const idx = lastFrame(stdout)
		.split("\n")
		.findIndex((l) => l.includes(needle));
	return idx === -1 ? -1 : idx + 1;
}

/** Send a left click (press + release) at 1-indexed (x, y). */
async function click(stdin, x, y) {
	stdin.emit("data", `\x1b[<0;${x};${y}M`);
	stdin.emit("data", `\x1b[<0;${x};${y}m`);
	await tick();
}

const STORE = {
	"task:abc": {
		namespace: "task:abc",
		segments: [{ type: "tool", name: "read_file", content: "tool output body" }],
		toolCalls: [],
	},
};

/**
 * Harness: SubagentsPanel under a MouseProvider with fixed global toggles.
 * @param {Object} props
 * @returns {React.ReactElement}
 */
function Harness({ reasoningCollapsed = true, toolCallCollapsed = true }) {
	return React.createElement(
		MouseProvider,
		{ autoEnable: false },
		React.createElement(MouseGate, { active: true }),
		React.createElement(SubagentsPanel, {
			subagentStore: STORE,
			activeView: "subagents",
			reasoningCollapsed,
			toolCallCollapsed,
		}),
	);
}

let instance;
afterEach(() => {
	instance?.unmount();
	instance = undefined;
});

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

describe("SubagentsPanel click-to-toggle", () => {
	it("toggles a single tool block open and closed by clicking its header", async () => {
		const { stdin, stdout } = mount({});
		await tick(100);
		assert.ok(!lastFrame(stdout).includes("tool output body"));
		const y = rowOf(stdout, "read_file");
		assert.ok(y > 0, "tool header rendered");
		await click(stdin, 4, y);
		assert.ok(lastFrame(stdout).includes("tool output body"), "body expanded");
		await click(stdin, 4, rowOf(stdout, "read_file"));
		assert.ok(!lastFrame(stdout).includes("tool output body"), "body collapsed again");
	});

	it("a global toggle clears the per-block click override", async () => {
		const { stdin, stdout } = mount({});
		await tick(100);
		await click(stdin, 4, rowOf(stdout, "read_file"));
		assert.ok(lastFrame(stdout).includes("tool output body"));
		instance.rerender(React.createElement(Harness, { toolCallCollapsed: false }));
		await tick(100);
		assert.ok(lastFrame(stdout).includes("tool output body"));
		instance.rerender(React.createElement(Harness, { toolCallCollapsed: true }));
		await tick(100);
		assert.ok(!lastFrame(stdout).includes("tool output body"), "stale click did not return");
	});
});
