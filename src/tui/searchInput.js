import React, { useState } from "react";
import { Box, Text, useInput } from "ink";

/**
 * SearchInput — a self-contained in-conversation search input.
 * Owns a single useInput handler for printable chars (insert into the query),
 * backspace (delete before cursor), left/right (move cursor), Enter (jump to
 * next match), Shift+Enter (jump to previous match), Escape (exit search), and
 * Ctrl+F (toggle search off). Renders a visible "Search:" label with the query
 * text and a cursor indicator, so search mode is obvious in the input area.
 * @param {Object} props
 * @param {string} props.value - The current search query
 * @param {(value: string) => void} props.onChange - Callback when the query changes
 * @param {() => void} props.onNext - Callback to jump to the next match
 * @param {() => void} props.onPrev - Callback to jump to the previous match
 * @param {() => void} props.onExit - Callback to exit search mode
 * @param {() => void} [props.onToggle] - Callback to toggle search mode off (Ctrl+F)
 * @param {boolean} [props.focus=true] - Whether the input is focused
 */
export function SearchInput({
	value = "",
	onChange,
	onNext,
	onPrev,
	onExit,
	onToggle,
	focus = true,
}) {
	const [cursor, setCursor] = useState(value.length);

	useInput(
		(input, key) => {
			if (key.ctrl && input === "f") {
				onToggle?.();
				return;
			}
			if (key.escape) {
				onExit?.();
				return;
			}
			if (key.return && !key.shift) {
				onNext?.();
				return;
			}
			if (key.return && key.shift) {
				onPrev?.();
				return;
			}
			if (key.leftArrow) {
				setCursor((prev) => Math.max(0, prev - 1));
				return;
			}
			if (key.rightArrow) {
				setCursor((prev) => Math.min(value.length, prev + 1));
				return;
			}
			if (key.backspace || key.delete) {
				if (cursor > 0) {
					const next = value.slice(0, cursor - 1) + value.slice(cursor);
					onChange(next);
					setCursor((prev) => Math.max(0, prev - 1));
				}
				return;
			}
			// Printable characters insert at cursor.
			if (input && input.length === 1 && input >= " ") {
				const next = value.slice(0, cursor) + input + value.slice(cursor);
				onChange(next);
				setCursor((prev) => prev + 1);
			}
		},
		{ isActive: focus },
	);

	// Render the query text with a cursor indicator (replicating ink-text-input).
	const before = value.slice(0, cursor);
	const at = value[cursor] || " ";
	const after = value.slice(cursor + 1);

	return React.createElement(
		Box,
		{ flexDirection: "row", width: "100%", paddingX: 1 },
		React.createElement(Text, { color: "cyan" }, "Search: "),
		React.createElement(
			Text,
			null,
			before,
			React.createElement(Text, { inverse: true }, at),
			after,
		),
	);
}

export default SearchInput;
