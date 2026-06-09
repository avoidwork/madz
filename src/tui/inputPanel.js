import React from "react";
import { Box, Text } from "ink";

/**
 * Calculate whether the blinking cursor should be visible for the given frame.
 * @param {number} frame - Animation frame counter
 * @returns {boolean}
 */
export function getBlinkState(frame) {
	return frame % 2 === 0;
}

/**
 * Render blinking cursor UI for a given frame count. Pure function for testability.
 * Highlights the character at cursorPosition when it is within the text.
 * @param {string} text - Input text to render after prompt
 * @param {string} char - Cursor character to display
 * @param {number} frame - Animation frame count
 * @param {number} [cursorPosition] - Index of the character under the cursor (default: text.length)
 * @returns {React.ReactElement}
 */
export function renderBlink(text, char, frame, cursorPosition = text.length) {
	const visible = getBlinkState(frame) && char !== undefined;
	const hasHighlight = cursorPosition < text.length && text.length > 0;
	const children = hasHighlight
		? [
				React.createElement(Text, { key: "prefix" }, text.slice(0, cursorPosition)),
				React.createElement(
					Text,
					{
						key: "highlight",
						style: { backgroundColor: "cyan" },
					},
					text[cursorPosition],
				),
				React.createElement(Text, { key: "suffix" }, text.slice(cursorPosition + 1)),
			]
		: [React.createElement(Text, { key: "text", flexGrow: 1 }, text || "")];
	children.push(
		React.createElement(Text, { key: "cursor", bold: true }, visible ? char : "\u200B"),
	);
	return React.createElement(Box, { flexDirection: "row" }, ...children);
}

/**
 * Input cursor component. Renders a static cursor to avoid periodic re-renders.
 * Supports cursor-position highlighting for character-level visual feedback.
 * @param {Object} props
 * @param {string} props.text - Input text to render
 * @param {string} props.char - Cursor character
 * @param {number} [props.cursorPosition] - Index of the character under the cursor (default: text.length)
 * @param {number} [props._testFrame] - Ignored (static cursor, no anim)
 * @returns {React.ReactElement}
 */
export function Blink({ text = "", char = "\u2588", cursorPosition = text.length, _testFrame }) {
	const hasHighlight = cursorPosition < text.length && text.length > 0;
	const children = hasHighlight
		? [
				React.createElement(Text, { key: "prefix" }, text.slice(0, cursorPosition)),
				React.createElement(
					Text,
					{
						key: "highlight",
						style: { backgroundColor: "cyan" },
					},
					text[cursorPosition],
				),
				React.createElement(Text, { key: "suffix" }, text.slice(cursorPosition + 1)),
			]
		: [React.createElement(Text, { key: "text", flexGrow: 1 }, text || "")];
	children.push(React.createElement(Text, { key: "cursor", bold: true }, char || "\u2588"));
	return React.createElement(Box, { flexDirection: "row" }, ...children);
}

/**
 * Display-only input panel with IRC-style prompt and blinking cursor.
 * All input handling (typing, Enter-to-send, history nav, backspace)
 * is handled by App's single useInput hook.
 * Props:
 *   inputText     - current text being typed (for display)
 *   cursorChar    - character to use as cursor indicator
 *   cursorPosition - index of the character under the cursor for highlighting
 */
export function InputPanel({
	inputText = "",
	cursorChar = "\u2588",
	cursorPosition = inputText.length,
}) {
	return React.createElement(Blink, { text: inputText, char: cursorChar, cursorPosition });
}
