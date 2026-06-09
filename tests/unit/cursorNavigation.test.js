import { describe, it } from "node:test";
import assert from "node:assert";
import { handleTextInput } from "../../src/tui/cursorPanel.js";

describe("handleTextInput - ArrowRight", () => {
	it("increments cursorPosition without changing inputText", () => {
		const result = handleTextInput("hello", 0, { rightArrow: true }, "");
		assert.strictEqual(result.cursorPosition, 1);
		assert.strictEqual(result.inputText, "hello");
	});

	it("increments cursorPosition incrementally", () => {
		let { inputText, cursorPosition } = handleTextInput("world", 0, { rightArrow: true }, "");
		assert.strictEqual(cursorPosition, 1);
		inputText = "world";
		const r2 = handleTextInput(inputText, cursorPosition, { rightArrow: true }, "");
		assert.strictEqual(r2.cursorPosition, 2);
		assert.strictEqual(r2.inputText, "world");
	});

	it("does not exceed text length when pressing ArrowRight at end", () => {
		const result = handleTextInput("hello", 5, { rightArrow: true }, "");
		assert.strictEqual(result.cursorPosition, 5);
		assert.strictEqual(result.inputText, "hello");
	});

	it("does not exceed text length when past end (graceful)", () => {
		const result = handleTextInput("hi", 3, { rightArrow: true }, "");
		assert.strictEqual(result.cursorPosition, 3);
		assert.strictEqual(result.inputText, "hi");
	});
});

describe("handleTextInput - ArrowLeft", () => {
	it("decrements cursorPosition without changing inputText", () => {
		const result = handleTextInput("hello", 3, { leftArrow: true }, "");
		assert.strictEqual(result.cursorPosition, 2);
		assert.strictEqual(result.inputText, "hello");
	});

	it("does not go below zero when at position zero", () => {
		const result = handleTextInput("hello", 0, { leftArrow: true }, "");
		assert.strictEqual(result.cursorPosition, 0);
		assert.strictEqual(result.inputText, "hello");
	});

	it("decrements correctly from any position", () => {
		const result = handleTextInput("test", 1, { leftArrow: true }, "");
		assert.strictEqual(result.cursorPosition, 0);
		assert.strictEqual(result.inputText, "test");
	});
});

describe("handleTextInput - character insertion", () => {
	it("inserts character at cursor position", () => {
		const result = handleTextInput("hllo", 1, {}, "e");
		assert.strictEqual(result.inputText, "hello");
		assert.strictEqual(result.cursorPosition, 2);
	});

	it("inserts at beginning when cursorPosition is 0", () => {
		const result = handleTextInput("ello", 0, {}, "h");
		assert.strictEqual(result.inputText, "hello");
		assert.strictEqual(result.cursorPosition, 1);
	});

	it("appends at end when cursorPosition equals text length", () => {
		const result = handleTextInput("hel", 3, {}, "lo");
		assert.strictEqual(result.inputText, "hello");
		assert.strictEqual(result.cursorPosition, 4);
	});

	it("does not insert carriage return", () => {
		const result = handleTextInput("hi", 1, {}, "\r");
		assert.strictEqual(result.inputText, "hi");
		assert.strictEqual(result.cursorPosition, 1);
	});

	it("does not insert newline", () => {
		const result = handleTextInput("hi", 1, {}, "\n");
		assert.strictEqual(result.inputText, "hi");
		assert.strictEqual(result.cursorPosition, 1);
	});

	it("preserves characters to the right of cursor", () => {
		const result = handleTextInput("hcx", 1, {}, "ello");
		assert.strictEqual(result.inputText, "hellocx");
		assert.strictEqual(result.cursorPosition, 2);
	});
});

describe("handleTextInput - backspace", () => {
	it("deletes character to the left of cursor", () => {
		const result = handleTextInput("hel", 2, { backspace: true }, "");
		assert.strictEqual(result.inputText, "hl");
		assert.strictEqual(result.cursorPosition, 1);
	});

	it("deletes character at cursor position - 1", () => {
		const result = handleTextInput("helo", 3, { backspace: true }, "");
		assert.strictEqual(result.inputText, "heo");
		assert.strictEqual(result.cursorPosition, 2);
	});

	it("does nothing when cursorPosition is 0", () => {
		const result = handleTextInput("hello", 0, { backspace: true }, "");
		assert.strictEqual(result.inputText, "hello");
		assert.strictEqual(result.cursorPosition, 0);
	});

	it("does nothing when text is empty", () => {
		const result = handleTextInput("", 0, { backspace: true }, "");
		assert.strictEqual(result.inputText, "");
		assert.strictEqual(result.cursorPosition, 0);
	});

	it("preserves text to the right of deleted character", () => {
		const result = handleTextInput("hxllo", 3, { backspace: true }, "");
		assert.strictEqual(result.inputText, "hxlo");
		assert.strictEqual(result.cursorPosition, 2);
	});

	it("does not handle backspace when backspace flag is false", () => {
		const result = handleTextInput("hello", 3, { backspace: false }, "");
		assert.strictEqual(result.inputText, "hello");
		assert.strictEqual(result.cursorPosition, 3);
	});
});

describe("handleTextInput - no-op cases", () => {
	it("returns unchanged state for no matching key or character", () => {
		const result = handleTextInput("hello", 2, {}, "");
		assert.strictEqual(result.inputText, "hello");
		assert.strictEqual(result.cursorPosition, 2);
	});

	it("returns unchanged state when key object has no relevant keys", () => {
		const result = handleTextInput("hi", 1, {}, "");
		assert.strictEqual(result.inputText, "hi");
		assert.strictEqual(result.cursorPosition, 1);
	});
});

describe("handleTextInput - combined operations", () => {
	it("type then backspace at cursor returns original", () => {
		let state = handleTextInput("abc", 1, {}, "x");
		assert.strictEqual(state.inputText, "axbc");
		assert.strictEqual(state.cursorPosition, 2);
		state = handleTextInput(state.inputText, state.cursorPosition, { backspace: true }, "");
		assert.strictEqual(state.inputText, "abc");
		assert.strictEqual(state.cursorPosition, 1);
	});

	it("ArrowLeft then ArrowRight restores position", () => {
		let { cursorPosition, inputText } = handleTextInput("test", 3, { rightArrow: true }, "");
		assert.strictEqual(cursorPosition, 4);
		cursorPosition = 4;
		inputText = "test";
		const r = handleTextInput(inputText, cursorPosition, { leftArrow: true }, "");
		assert.strictEqual(r.cursorPosition, 3);
		assert.strictEqual(r.inputText, "test");
	});

	it("insert then move then backspace", () => {
		let state = handleTextInput("abc", 1, {}, "x");
		assert.strictEqual(state.inputText, "axbc");
		assert.strictEqual(state.cursorPosition, 2);
		state = handleTextInput(state.inputText, state.cursorPosition, { leftArrow: true }, "");
		assert.strictEqual(state.cursorPosition, 1);
		state = handleTextInput(state.inputText, state.cursorPosition, { backspace: true }, "");
		assert.strictEqual(state.inputText, "xbc");
		assert.strictEqual(state.cursorPosition, 0);
	});
});
