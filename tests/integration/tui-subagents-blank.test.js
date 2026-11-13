/**
 * Regression test: the SubagentsPanel must not go blank when estimated item
 * heights are far larger than the measured heights.
 *
 * Collapsed tool output inflates `estimateSubagentHeight`, so auto-scroll jumps
 * to an estimated bottom. Once items are measured the content shrinks, and an
 * unclamped scroll offset would sit past the end and mount nothing.
 * @see {@link src/tui/scrollView.js}
 */

import { describe, it, afterEach } from "node:test";
import assert from "node:assert";
import React from "react";
import { EventEmitter } from "node:events";
import { render } from "ink";
import { MouseProvider } from "@ink-tools/ink-mouse";
import { SubagentsPanel } from "../../src/tui/subagentsPanel.js";

/** Minimal TTY-like stdin that supports Ink raw mode. */
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

const tick = (ms = 400) => new Promise((r) => setTimeout(r, ms));
const ESC = String.fromCharCode(27);
const stripAnsi = (s) => s.replaceAll(new RegExp(ESC + "\\[[0-9;?]*[A-Za-z]", "g"), "");

/**
 * The text of the most recent frame Ink actually painted. Synchronized-output
 * toggles (`?2026h/l`) and cursor show/hide are not paints. A blank redraw
 * (erase codes plus newlines) IS a paint and yields an empty string, which is
 * exactly the "view went blank" symptom this test guards against.
 */
function lastPaintedFrame(stdout) {
	const modeToggle = new RegExp("^" + ESC + "\\[\\?(2026|25)[hl]$");
	const paints = stdout.frames.filter((f) => !modeToggle.test(f));
	return stripAnsi(paints.at(-1) || "").trim();
}

/**
 * Build a store of subagents whose collapsed render is tiny but whose
 * estimated height is huge because of long tool output.
 * @param {number} count - Number of subagents.
 * @returns {Object} Subagent store keyed by namespace.
 */
function makeStore(count) {
	const big = "x".repeat(6000);
	return Object.fromEntries(
		Array.from({ length: count }, (_, n) => [
			`task:${n}`,
			{
				namespace: `task:${n}`,
				segments: [
					{ type: "reasoning", content: "thinking ".repeat(300) },
					{ type: "tool", name: `tool_${n}_a`, content: big },
					{ type: "tool", name: `tool_${n}_b`, content: big },
					{ type: "message", content: `done ${n}` },
				],
				toolCalls: [],
			},
		]),
	);
}

let instance;
afterEach(() => {
	instance?.unmount();
	instance = undefined;
});

describe("SubagentsPanel does not go blank", () => {
	it("keeps tool blocks visible when estimated height exceeds measured height", async () => {
		const stdout = makeStdout();
		instance = render(
			React.createElement(
				MouseProvider,
				{ autoEnable: false },
				React.createElement(SubagentsPanel, {
					subagentStore: makeStore(3),
					activeView: "subagents",
					reasoningCollapsed: true,
					toolCallCollapsed: true,
				}),
			),
			{
				stdin: makeStdin(),
				stdout,
				patchConsole: false,
				interactive: true,
				exitOnCtrlC: false,
			},
		);
		await tick();

		const frame = lastPaintedFrame(stdout);
		assert.match(frame, /tool_\d_[ab]/, `expected a tool header in the final frame, got: ${frame}`);
	});

	it("stays populated as the store grows", async () => {
		const stdout = makeStdout();
		const tree = (store) =>
			React.createElement(
				MouseProvider,
				{ autoEnable: false },
				React.createElement(SubagentsPanel, {
					subagentStore: store,
					activeView: "subagents",
					reasoningCollapsed: true,
					toolCallCollapsed: true,
				}),
			);
		instance = render(tree(makeStore(1)), {
			stdin: makeStdin(),
			stdout,
			patchConsole: false,
			interactive: true,
			exitOnCtrlC: false,
		});
		await tick(200);
		for (const n of [2, 3, 4]) {
			instance.rerender(tree(makeStore(n)));
			await tick(250);
		}

		const frame = lastPaintedFrame(stdout);
		assert.match(frame, /tool_\d_[ab]/, `expected a tool header in the final frame, got: ${frame}`);
	});
});
