import React, { useState, useEffect } from "react";
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
 * Blinking cursor component.
 * Toggles visibility at the given interval using internal state.
 * Uses a zero-width space when invisible so layout height stays constant.
 * @param {Object} props
 * @param {string} props.text - Input text to render
 * @param {string} props.char - Cursor character
 * @param {number} props.ms - Blink interval in ms
 * @param {number} [props._testFrame] - Override frame count for unit testing
 * @returns {React.ReactElement}
 */
export function Blink({ text = "", char = "\u2588", ms = 530, _testFrame }) {
	if (_testFrame !== undefined) {
		return React.createElement(
			Box,
			{ flexDirection: "row" },
			React.createElement(Text, { key: "text", flexGrow: 1 }, text || ""),
			React.createElement(
				Text,
				{ key: "cursor", bold: true },
				getBlinkState(_testFrame) ? char : "\u200B",
			),
		);
	}

	const [visible, setVisible] = useState(true);
	useEffect(() => {
		const timer = setInterval(() => setVisible((prev) => !prev), ms);
		return () => clearInterval(timer);
	}, [ms]);

	return React.createElement(
		Box,
		{ flexDirection: "row" },
		React.createElement(Text, { key: "text", flexGrow: 1 }, text || ""),
		React.createElement(Text, { key: "cursor", bold: true }, visible ? char : "\u200B"),
	);
}

/**
 * Display-only input panel with IRC-style prompt and blinking cursor.
 * All input handling (typing, Enter-to-send, history nav, backspace)
 * is handled by App's single useInput hook.
 * Props:
 *   inputText    - current text being typed (for display)
 *   blinkTimeout - interval in ms between cursor blinks
 *   cursorChar   - character to use as cursor indicator
 */
export function InputPanel({ inputText = "", blinkTimeout = 530, cursorChar = "\u2588" }) {
	return React.createElement(Blink, { text: inputText, char: cursorChar, ms: blinkTimeout });
}
