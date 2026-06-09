import React from "react";
import { describe, it } from "node:test";
import assert from "node:assert";
import { Blink, renderBlink, InputPanel } from "../../src/tui/inputPanel.js";

describe("renderBlink - cursor position highlight", () => {
	it("renders highlighted character when cursorPosition is within text", () => {
		const result = renderBlink("hello", "█", 0, 1);
		assert.ok(React.isValidElement(result));
		assert.strictEqual(result.props.flexDirection, "row");
		// Should have 4 children: prefix, highlight, suffix, cursor
		assert.strictEqual(result.props.children.length, 4);
		assert.strictEqual(result.props.children[0].key, "prefix");
		assert.strictEqual(result.props.children[0].props.children, "h");
		assert.strictEqual(result.props.children[1].key, "highlight");
		assert.strictEqual(result.props.children[1].props.children, "e");
		assert.strictEqual(result.props.children[1].props.style.backgroundColor, "cyan");
		assert.strictEqual(result.props.children[2].key, "suffix");
		assert.strictEqual(result.props.children[2].props.children, "llo");
		assert.strictEqual(result.props.children[3].key, "cursor");
		assert.strictEqual(result.props.children[3].props.bold, true);
		assert.strictEqual(result.props.children[3].props.children, "█");
	});

	it("renders highlighted first character when cursorPosition is 0", () => {
		const result = renderBlink("hello", "█", 0, 0);
		assert.ok(React.isValidElement(result));
		assert.strictEqual(result.props.children.length, 4);
		assert.strictEqual(result.props.children[0].key, "prefix");
		assert.strictEqual(result.props.children[0].props.children, "");
		assert.strictEqual(result.props.children[1].key, "highlight");
		assert.strictEqual(result.props.children[1].props.children, "h");
		assert.strictEqual(result.props.children[1].props.style.backgroundColor, "cyan");
		assert.strictEqual(result.props.children[2].key, "suffix");
		assert.strictEqual(result.props.children[2].props.children, "ello");
	});

	it("renders highlighted last character when cursorPosition equals text.length - 1", () => {
		const result = renderBlink("hello", "█", 0, 4);
		assert.ok(React.isValidElement(result));
		assert.strictEqual(result.props.children.length, 4);
		assert.strictEqual(result.props.children[0].key, "prefix");
		assert.strictEqual(result.props.children[0].props.children, "hell");
		assert.strictEqual(result.props.children[1].key, "highlight");
		assert.strictEqual(result.props.children[1].props.children, "o");
		assert.strictEqual(result.props.children[1].props.style.backgroundColor, "cyan");
		assert.strictEqual(result.props.children[2].key, "suffix");
		assert.strictEqual(result.props.children[2].props.children, "");
	});

	it("does not highlight when cursorPosition equals text length", () => {
		const result = renderBlink("hello", "█", 0, 5);
		assert.ok(React.isValidElement(result));
		// Should have 2 children: text, cursor (no highlight)
		assert.strictEqual(result.props.children.length, 2);
		assert.strictEqual(result.props.children[0].key, "text");
		assert.strictEqual(result.props.children[0].props.children, "hello");
		assert.strictEqual(result.props.children[0].props.flexGrow, 1);
		assert.strictEqual(result.props.children[1].key, "cursor");
	});

	it("does not highlight when text is empty", () => {
		const result = renderBlink("", "█", 0, 0);
		assert.ok(React.isValidElement(result));
		// Empty text: no highlight even though cursorPosition === 0 and 0 < 0 is false
		assert.strictEqual(result.props.children.length, 2);
		assert.strictEqual(result.props.children[0].key, "text");
		assert.strictEqual(result.props.children[0].props.children, "");
		assert.strictEqual(result.props.children[1].key, "cursor");
	});

	it("renders text segment before cursor as unstyled", () => {
		const result = renderBlink("abcd", "█", 0, 2);
		const prefix = result.props.children[0];
		assert.strictEqual(prefix.key, "prefix");
		assert.strictEqual(prefix.props.children, "ab");
		// Should not have style or other styling props
		assert.strictEqual(prefix.props.style, undefined);
	});

	it("renders text segment after cursor as unstyled", () => {
		const result = renderBlink("abcd", "█", 0, 2);
		const suffix = result.props.children[2];
		assert.strictEqual(suffix.key, "suffix");
		assert.strictEqual(suffix.props.children, "d");
		assert.strictEqual(suffix.props.style, undefined);
	});

	it("preserves blink visibility with cursor highlighting", () => {
		const visible = renderBlink("ab", "█", 0, 0);
		assert.strictEqual(visible.props.children[3].props.children, "█");

		const hidden = renderBlink("ab", "█", 1, 0);
		assert.strictEqual(hidden.props.children[3].props.children, "\u200B");
	});

	it("preserves cursor char when cursorPosition is within text", () => {
		const result = renderBlink("hi", "▌", 0, 0);
		assert.strictEqual(result.props.children[3].props.children, "▌");
		assert.strictEqual(result.props.children[3].props.bold, true);
	});

	it("shows zero-width space when cursor is invisible with highlight", () => {
		const result = renderBlink("x", "_", 1, 0);
		assert.strictEqual(result.props.children[3].props.children, "\u200B");
	});

	it("uses default cursorPosition (text.length) when not provided", () => {
		const result = renderBlink("hello", "█", 0);
		assert.strictEqual(result.props.children.length, 2);
		assert.strictEqual(result.props.children[0].props.children, "hello");
	});

	it("handles cursorPosition one past edge gracefully by not highlighting", () => {
		// cursorPosition = 6 > text.length = 5, so no highlight
		const result = renderBlink("hello", "█", 0, 6);
		assert.strictEqual(result.props.children.length, 2);
		assert.strictEqual(result.props.children[0].props.children, "hello");
	});
});

describe("Blink - cursorPosition prop forwarding", () => {
	it("accepts cursorPosition prop with default text.length", () => {
		const result = Blink({ text: "hello", char: "█" });
		assert.ok(React.isValidElement(result));
		// cursorPosition defaults to text.length = 5, no highlight
		assert.strictEqual(result.props.children.length, 2);
		assert.strictEqual(result.props.children[0].props.children, "hello");
	});

	it("highlights character at cursorPosition 0", () => {
		const result = Blink({ text: "hello", char: "█", cursorPosition: 0 });
		assert.strictEqual(result.props.children[1].props.children, "h");
		assert.strictEqual(result.props.children[1].props.style.backgroundColor, "cyan");
	});

	it("highlights character at cursorPosition 2", () => {
		const result = Blink({ text: "abcd", char: "█", cursorPosition: 2 });
		assert.strictEqual(result.props.children[1].props.children, "c");
		assert.strictEqual(result.props.children[1].props.style.backgroundColor, "cyan");
		assert.strictEqual(result.props.children[0].props.children, "ab");
		assert.strictEqual(result.props.children[2].props.children, "d");
	});

	it("does not highlight when cursorPosition equals text length", () => {
		const result = Blink({ text: "hello", char: "█", cursorPosition: 5 });
		assert.strictEqual(result.props.children.length, 2);
	});

	it("does not highlight for empty text", () => {
		const result = Blink({ text: "", char: "█", cursorPosition: 0 });
		assert.strictEqual(result.props.children.length, 2);
	});

	it("preserves existing blink props and structure", () => {
		const result = Blink({ text: "test", char: "▌", cursorPosition: 2 });
		assert.strictEqual(result.props.flexDirection, "row");
		assert.strictEqual(result.props.children[3].props.bold, true);
		assert.strictEqual(result.props.children[3].props.children, "▌");
	});
});

describe("InputPanel - cursorPosition prop passthrough", () => {
	it("passes cursorPosition with no highlight when at text end", () => {
		const result = InputPanel({ inputText: "hello", cursorChar: "█", cursorPosition: 5 });
		assert.ok(React.isValidElement(result));
	});

	it("renders Blink element as output", () => {
		const result = InputPanel({ inputText: "hello", cursorChar: "█", cursorPosition: 2 });
		assert.ok(React.isValidElement(result));
	});

	it("renders highlighted character when cursorPosition is within text", () => {
		const result = InputPanel({ inputText: "abcd", cursorChar: "█", cursorPosition: 1 });
		assert.ok(React.isValidElement(result));
		const blinkOutput = Blink(result.props);
		assert.ok(React.isValidElement(blinkOutput));
		assert.strictEqual(blinkOutput.props.children[1].props.children, "b");
		assert.strictEqual(blinkOutput.props.children[1].props.style.backgroundColor, "cyan");
	});

	it("uses default cursorPosition (inputText.length) when not provided", () => {
		const result = InputPanel({ inputText: "hello", cursorChar: "█" });
		assert.ok(React.isValidElement(result));
		const blinkOutput = Blink(result.props);
		assert.strictEqual(blinkOutput.props.children.length, 2);
	});

	it("passes cursorChar through to Blink", () => {
		const result = InputPanel({ inputText: "x", cursorChar: "▌", cursorPosition: 0 });
		assert.ok(React.isValidElement(result));
		const blinkOutput = Blink(result.props);
		assert.strictEqual(blinkOutput.props.children[3].props.children, "▌");
	});
});
