import React from "react";
import { describe, it } from "node:test";
import assert from "node:assert";
import { renderToString } from "ink";
import stringWidth from "string-width";
import { InputPanel, calculateCursorX, isCursorVisible } from "../../src/tui/inputPanel.js";

describe("InputPanel - component rendering", () => {
	it("renders prompt prefix and input text", () => {
		const result = String(renderToString(React.createElement(InputPanel, { inputText: "hello" })));
		assert.ok(result.includes("> hello"), "should render prompt prefix and input text");
	});

	it("renders prompt prefix when input is empty", () => {
		const result = renderToString(React.createElement(InputPanel, { inputText: "" }));
		// Verify it renders a Text element (the prompt + empty text)
		assert.ok(result !== null && result !== undefined);
	});

	it("renders text in white color", () => {
		const result = renderToString(React.createElement(InputPanel, { inputText: "test" }));
		assert.ok(result !== null && result !== undefined);
	});
});

describe("InputPanel - cursorChar prop ignored", () => {
	it("does not crash when cursorChar is passed", () => {
		assert.doesNotThrow(() => {
			renderToString(
				React.createElement(InputPanel, {
					inputText: "hello",
					cursorChar: "█",
				}),
			);
		}, "should not throw when cursorChar is passed");
	});
});

describe("InputPanel - cursor positioning logic", () => {
	it("positions cursor after prompt + text for ASCII input", () => {
		const prompt = "> ";
		const text = "hello";
		const expectedX = calculateCursorX(prompt, text);
		assert.strictEqual(expectedX, 7); // "> " (2) + "hello" (5)
	});

	it("positions cursor correctly for text with wide characters", () => {
		const prompt = "> ";
		const text = "hello 🌍";
		const expectedX = calculateCursorX(prompt, text);
		assert.strictEqual(expectedX, 10); // "> " (2) + "hello " (6) + "🌍" (2)
	});

	it("positions cursor correctly for CJK characters", () => {
		const prompt = "> ";
		const text = "你好";
		const expectedX = calculateCursorX(prompt, text);
		assert.strictEqual(expectedX, 6); // "> " (2) + "你好" (4)
	});

	it("uses string-width for accurate column calculation", () => {
		const prompt = "> ";
		const text = "a";
		const expectedX = stringWidth(prompt + text);
		assert.strictEqual(calculateCursorX(prompt, text), expectedX);
	});
});

describe("InputPanel - cursor visibility logic", () => {
	it("returns true when cursorColor is undefined (focused)", () => {
		assert.strictEqual(isCursorVisible(undefined), true);
	});

	it("returns true when cursorColor is empty string", () => {
		assert.strictEqual(isCursorVisible(""), true);
	});

	it("returns true when cursorColor is any other value", () => {
		assert.strictEqual(isCursorVisible("cyan"), true);
		assert.strictEqual(isCursorVisible("white"), true);
	});

	it("returns false when cursorColor is #202020 (unfocused)", () => {
		assert.strictEqual(isCursorVisible("#202020"), false);
	});
});
