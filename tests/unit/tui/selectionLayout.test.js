/**
 * Tests for the TUI selection layout resolver.
 * @see {@link src/tui/selectionLayout.js}
 */

import { describe, it } from "node:test";
import assert from "node:assert";

const { stripAnsi, wrapText, buildLayout, mapCoordToChar, extractSelection } =
	await import("../../../src/tui/selectionLayout.js");

describe("stripAnsi", () => {
	it("removes ANSI escape sequences", () => {
		assert.strictEqual(stripAnsi("\x1b[31mred\x1b[0m"), "red");
	});

	it("leaves plain text unchanged", () => {
		assert.strictEqual(stripAnsi("hello world"), "hello world");
	});
});

describe("wrapText", () => {
	it("wraps text at the column boundary", () => {
		const lines = wrapText("hello world", 5);
		assert.deepStrictEqual(
			lines.map((l) => l.text),
			["hello", " worl", "d"],
		);
	});

	it("records start offsets for each wrapped line", () => {
		const lines = wrapText("hello world", 5);
		assert.deepStrictEqual(
			lines.map((l) => l.start),
			[0, 5, 10],
		);
	});

	it("returns a single line for text shorter than width", () => {
		const lines = wrapText("hi", 10);
		assert.strictEqual(lines.length, 1);
		assert.strictEqual(lines[0].text, "hi");
		assert.strictEqual(lines[0].start, 0);
	});
});

describe("buildLayout", () => {
	it("builds a flattened line layout with global character indices", () => {
		const layout = buildLayout({
			width: 10,
			scrollOffset: 0,
			messages: [{ text: "hello world", top: 0 }],
		});
		assert.strictEqual(layout.lines.length, 2);
		assert.strictEqual(layout.lines[0].text, "hello worl");
		assert.strictEqual(layout.lines[0].top, 0);
		assert.strictEqual(layout.lines[0].startIndex, 0);
		assert.strictEqual(layout.lines[1].text, "d");
		assert.strictEqual(layout.lines[1].top, 1);
		assert.strictEqual(layout.lines[1].startIndex, 11);
		assert.strictEqual(layout.fullText, "hello worl\nd\n");
	});

	it("strips ANSI from message text", () => {
		const layout = buildLayout({
			width: 10,
			scrollOffset: 0,
			messages: [{ text: "\x1b[31mhello\x1b[0m", top: 0 }],
		});
		assert.strictEqual(layout.lines[0].text, "hello");
	});
});

describe("mapCoordToChar", () => {
	it("maps a coordinate to the correct global character index", () => {
		const layout = buildLayout({
			width: 10,
			scrollOffset: 0,
			messages: [{ text: "hello world", top: 0 }],
		});
		// (0, 0) -> first char of line 1
		assert.strictEqual(mapCoordToChar(layout, { x: 0, y: 0 }), 0);
		// (4, 0) -> 5th char of line 1
		assert.strictEqual(mapCoordToChar(layout, { x: 4, y: 0 }), 4);
		// (0, 1) -> first char of line 2. fullText is "hello worl\nd\n", so
		// line 2's "d" begins at index 11 (after "hello worl\n").
		assert.strictEqual(mapCoordToChar(layout, { x: 0, y: 1 }), 11);
	});

	it("adds the scroll offset to the mouse y coordinate", () => {
		// "hello world foo" (15 chars) at width 5 wraps to 3 lines (rows 0-2).
		const layout = buildLayout({
			width: 5,
			scrollOffset: 2,
			messages: [{ text: "hello world foo", top: 0 }],
		});
		// Viewport y=0 maps to content row 2 (the third wrapped line).
		assert.strictEqual(mapCoordToChar(layout, { x: 0, y: 0 }), 12);
	});

	it("clamps x to the line length", () => {
		const layout = buildLayout({
			width: 10,
			scrollOffset: 0,
			messages: [{ text: "hello", top: 0 }],
		});
		// x beyond the line length clamps to the last character.
		assert.strictEqual(mapCoordToChar(layout, { x: 100, y: 0 }), 5);
	});

	it("returns -1 for a coordinate outside the rendered content", () => {
		const layout = buildLayout({
			width: 10,
			scrollOffset: 0,
			messages: [{ text: "hello", top: 0 }],
		});
		assert.strictEqual(mapCoordToChar(layout, { x: 0, y: 5 }), -1);
	});
});

describe("extractSelection", () => {
	it("extracts text within a single line", () => {
		const layout = buildLayout({
			width: 10,
			scrollOffset: 0,
			messages: [{ text: "hello world", top: 0 }],
		});
		const text = extractSelection(layout, { x: 0, y: 0 }, { x: 5, y: 0 });
		assert.strictEqual(text, "hello");
	});

	it("extracts text spanning multiple wrapped lines", () => {
		const layout = buildLayout({
			width: 10,
			scrollOffset: 0,
			messages: [{ text: "hello world", top: 0 }],
		});
		const text = extractSelection(layout, { x: 0, y: 0 }, { x: 1, y: 1 });
		assert.strictEqual(text, "hello worl\nd");
	});

	it("orders start/end regardless of drag direction", () => {
		const layout = buildLayout({
			width: 10,
			scrollOffset: 0,
			messages: [{ text: "hello world", top: 0 }],
		});
		// Drag from right to left.
		const text = extractSelection(layout, { x: 5, y: 0 }, { x: 0, y: 0 });
		assert.strictEqual(text, "hello");
	});

	it("returns empty string for an empty selection", () => {
		const layout = buildLayout({
			width: 10,
			scrollOffset: 0,
			messages: [{ text: "hello world", top: 0 }],
		});
		const text = extractSelection(layout, { x: 3, y: 0 }, { x: 3, y: 0 });
		assert.strictEqual(text, "");
	});

	it("returns empty string when start or end is outside the content", () => {
		const layout = buildLayout({
			width: 10,
			scrollOffset: 0,
			messages: [{ text: "hello", top: 0 }],
		});
		const text = extractSelection(layout, { x: 0, y: 0 }, { x: 0, y: 10 });
		assert.strictEqual(text, "");
	});

	it("extracts text across multiple messages", () => {
		const layout = buildLayout({
			width: 10,
			scrollOffset: 0,
			messages: [
				{ text: "first", top: 0 },
				{ text: "second", top: 1 },
			],
		});
		// Select from start of "first" to end of "second".
		const text = extractSelection(layout, { x: 0, y: 0 }, { x: 6, y: 1 });
		assert.strictEqual(text, "first\nsecond");
	});
});
