import React, { useState, useEffect, useMemo, useRef } from "react";
import { Box, Text, useInput } from "ink";

/** Maximum number of visible options in the picker list. */
export const MAX_VISIBLE = 3;

/**
 * Derive the command autocomplete filter from the token at the cursor.
 * A token is bounded by whitespace. The token must start with `/`, be at a
 * word boundary (start of input or preceded by a space), and be followed by a
 * non-whitespace character for the picker to be active. The word being
 * processed is the one to the left of the cursor, with no space between it and
 * the cursor. Returns { filter, tokenStart, tokenEnd, active }.
 * @param {string} value - The full input text
 * @param {number} cursor - The cursor position
 * @returns {{filter: string, tokenStart: number, tokenEnd: number, active: boolean}}
 */
export function deriveCommandFilter(value, cursor) {
	const pos = Math.max(0, Math.min(cursor, value.length));

	// Determine the word to the left of the cursor: walk left until whitespace
	// or the start of the input. The cursor is at the end of this word.
	let wordStart = pos;
	while (wordStart > 0 && !/\s/.test(value[wordStart - 1])) {
		wordStart--;
	}

	// The word must start with `/`.
	if (value[wordStart] !== "/") {
		return { filter: "", tokenStart: 0, tokenEnd: 0, active: false };
	}

	// Word boundary required: the `/` must be at the start of the input or be
	// preceded by a space.
	if (wordStart > 0 && value[wordStart - 1] !== " ") {
		return { filter: "", tokenStart: 0, tokenEnd: 0, active: false };
	}

	// The `/` must be followed by a non-whitespace character. This rejects
	// bare `/` and `/` followed by a space, while allowing command names that
	// start with a hyphen or any other non-space char.
	const token = value.slice(wordStart, pos);
	if (!/^\/[^\s]/.test(token)) {
		return { filter: "", tokenStart: 0, tokenEnd: 0, active: false };
	}

	// Determine the token end: walk forward from the `/`. Whitespace ends the token.
	let end = wordStart + 1;
	while (end < value.length) {
		if (/\s/.test(value[end])) {
			break;
		}
		end++;
	}

	const filter = value.slice(wordStart + 1, pos);

	return { filter, tokenStart: wordStart, tokenEnd: end, active: true };
}

/**
 * Determine whether the command picker should be open for the given input text.
 * Mirrors `deriveCommandFilter`'s word-boundary logic so the open/close gate and
 * the picker's active state agree. The cursor is assumed to be at the end of the
 * input (the position when typing), which is where the picker trigger is
 * evaluated. Returns `true` only when a valid `/` trigger token exists.
 * @param {string} value - The full input text
 * @returns {boolean} Whether the command picker should be open
 */
export function shouldOpenCommandPicker(value) {
	return deriveCommandFilter(value, value.length).active;
}

/**
 * Replace the `/` token in the input with the selected command.
 * @param {string} value - The full input text
 * @param {number} tokenStart - Start index of the token
 * @param {number} tokenEnd - End index of the token
 * @param {string} command - The selected command name
 * @returns {string} The updated input text
 */
export function replaceCommandToken(value, tokenStart, tokenEnd, command) {
	return value.slice(0, tokenStart) + command + value.slice(tokenEnd);
}

/**
 * CommandPicker — a self-contained input + command list component.
 * Owns a single useInput handler for printable chars (insert at cursor),
 * backspace (delete before cursor), left/right (move cursor), up/down
 * (navigate list), Enter (select), and Escape (close).
 * @param {Object} props
 * @param {string} props.value - The current input text
 * @param {(value: string) => void} props.onChange - Callback when input changes
 * @param {() => void} props.onClose - Callback when the picker closes
 * @param {string[]} props.commandList - The list of command/skill names to suggest
 */
export function CommandPicker({ value, onChange, onClose, commandList = [] }) {
	const [cursor, setCursor] = useState(value.length);
	const [selectedIndex, setSelectedIndex] = useState(0);
	const commandListRef = useRef(commandList);

	// Keep the command list in a ref so the filter can read the latest value
	// without re-deriving on every render.
	useEffect(() => {
		commandListRef.current = commandList;
	}, [commandList]);

	const { filter, tokenStart, tokenEnd } = useMemo(
		() => deriveCommandFilter(value, cursor),
		[value, cursor],
	);

	// Filter the command list in JS (substring match, case-insensitive).
	const filteredCommands = useMemo(() => {
		const needle = filter.toLowerCase();
		if (!needle) return commandListRef.current;
		return commandListRef.current.filter((c) => c.toLowerCase().includes(needle));
	}, [filter]);

	// Clamp selected index when the filtered list shrinks.
	const clampedIndex = Math.min(selectedIndex, Math.max(0, filteredCommands.length - 1));

	// Rotating window: show up to MAX_VISIBLE options around the selection.
	// Returns the visible slice and the start offset so the render can map a
	// visible position back to its index in the full filtered list.
	const { visibleCommands, windowStart } = useMemo(() => {
		if (filteredCommands.length <= MAX_VISIBLE) {
			return { visibleCommands: filteredCommands, windowStart: 0 };
		}
		const start = Math.max(0, Math.min(clampedIndex - 1, filteredCommands.length - MAX_VISIBLE));
		return {
			visibleCommands: filteredCommands.slice(start, start + MAX_VISIBLE),
			windowStart: start,
		};
	}, [filteredCommands, clampedIndex]);

	useInput(
		(input, key) => {
			if (key.escape) {
				onClose?.();
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
			if (key.upArrow) {
				setSelectedIndex((prev) => (prev <= 0 ? filteredCommands.length - 1 : prev - 1));
				return;
			}
			if (key.downArrow) {
				setSelectedIndex((prev) => (prev >= filteredCommands.length - 1 ? 0 : prev + 1));
				return;
			}
			if (key.return) {
				const selected = filteredCommands[clampedIndex];
				if (selected) {
					onChange(replaceCommandToken(value, tokenStart, tokenEnd, selected));
					onClose?.();
				}
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
		{ isActive: true },
	);

	// Render the input text with a cursor indicator (replicating ink-text-input).
	const before = value.slice(0, cursor);
	const at = value[cursor] || " ";
	const after = value.slice(cursor + 1);

	return React.createElement(
		Box,
		{ flexDirection: "column", width: "100%", paddingX: 1 },
		React.createElement(
			Text,
			null,
			before,
			React.createElement(Text, { inverse: true }, at),
			after,
		),
		filteredCommands.length === 0
			? React.createElement(Text, { color: "gray" }, " No matching commands.")
			: visibleCommands.map((command, i) => {
					const isSelected = windowStart + i === clampedIndex;
					return React.createElement(
						Box,
						{ key: command, flexDirection: "row" },
						React.createElement(
							Text,
							{ color: isSelected ? "cyan" : undefined },
							isSelected ? "▸ " : "  ",
							command,
						),
					);
				}),
	);
}

export default CommandPicker;
