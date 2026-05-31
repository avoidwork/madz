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
 * @param {string} text - Input text to render after prompt
 * @param {string} char - Cursor character to display
 * @param {number} frame - Animation frame count
 * @returns {React.ReactElement}
 */
export function renderBlink(text, char, frame) {
	const visible = getBlinkState(frame) && char !== undefined;
	return React.createElement(
		Box,
		{ flexDirection: "row" },
		React.createElement(Text, { key: "text", flexGrow: 1 }, text || ""),
		React.createElement(Text, { key: "cursor", bold: true }, visible ? char : "\u200B"),
	);
}

/**
 * Input cursor component. Renders a static cursor to avoid periodic re-renders.
 * @param {Object} props
 * @param {string} props.text - Input text to render
 * @param {string} props.char - Cursor character
 * @param {number} [props._testFrame] - Ignored (static cursor, no anim)
 * @returns {React.ReactElement}
 */
export function Blink({ text = "", char = "\u2588", _testFrame }) {
	return React.createElement(
		Box,
		{ flexDirection: "row" },
		React.createElement(Text, { key: "text", flexGrow: 1 }, text || ""),
		React.createElement(Text, { key: "cursor", bold: true }, char || "\u2588"),
	);
}

/**
 * Display-only input panel with IRC-style prompt and blinking cursor.
 * All input handling (typing, Enter-to-send, history nav, backspace)
 * is handled by App's single useInput hook.
 * Props:
 *   inputText    - current text being typed (for display)
 *   cursorChar   - character to use as cursor indicator
 */
export function InputPanel({ inputText = "", cursorChar = "\u2588" }) {
	return React.createElement(Blink, { text: inputText, char: cursorChar });
}
