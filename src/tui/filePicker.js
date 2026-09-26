import React, { useState, useEffect, useMemo, useRef } from "react";
import { Box, Text, useInput } from "ink";
import fg from "fast-glob";

/** Maximum number of visible options in the picker list. */
export const MAX_VISIBLE = 3;

/** Debounce interval (ms) for the initial glob. */
export const GLOB_DEBOUNCE_MS = 250;

/** Directories excluded from the file glob. */
const EXCLUDED_DIRS = ["**/node_modules/**", "**/.git/**", "**/dist/**"];

/**
 * Derive the autocomplete filter from the token at the cursor.
 * A token is bounded by whitespace. The token must start with `@` and the
 * cursor must be within the token for the picker to be active. Returns
 * { filter, tokenStart, tokenEnd, active }.
 * @param {string} value - The full input text
 * @param {number} cursor - The cursor position
 * @returns {{filter: string, tokenStart: number, tokenEnd: number, active: boolean}}
 */
export function deriveFilter(value, cursor) {
	const pos = Math.max(0, Math.min(cursor, value.length));

	// Find the last `@` at or before the cursor.
	const lastAt = value.lastIndexOf("@", pos);
	if (lastAt === -1) {
		return { filter: "", tokenStart: 0, tokenEnd: 0, active: false };
	}

	// The cursor must be after the `@` for the picker to be active.
	if (pos <= lastAt) {
		return { filter: "", tokenStart: lastAt, tokenEnd: lastAt, active: false };
	}

	// Determine the token end: walk forward from the `@`. Whitespace ends the token.
	let end = lastAt + 1;
	while (end < value.length) {
		if (/\s/.test(value[end])) {
			break;
		}
		end++;
	}

	const filter = value.slice(lastAt + 1, pos);

	return { filter, tokenStart: lastAt, tokenEnd: end, active: true };
}

/**
 * Replace the `@` token in the input with the selected path.
 * @param {string} value - The full input text
 * @param {number} tokenStart - Start index of the token
 * @param {number} tokenEnd - End index of the token
 * @param {string} path - The selected file path
 * @returns {string} The updated input text
 */
export function replaceToken(value, tokenStart, tokenEnd, path) {
	return value.slice(0, tokenStart) + path + value.slice(tokenEnd);
}

/**
 * FilePicker — a self-contained input + file list component.
 * Owns a single useInput handler for printable chars (insert at cursor),
 * backspace (delete before cursor), left/right (move cursor), up/down
 * (navigate list), Enter (select), and Escape (close).
 * @param {Object} props
 * @param {string} props.value - The current input text
 * @param {(value: string) => void} props.onChange - Callback when input changes
 * @param {() => void} props.onClose - Callback when the picker closes
 * @param {string} [props.cwd] - The working directory to glob
 */
export function FilePicker({ value, onChange, onClose, cwd }) {
	const [cursor, setCursor] = useState(value.length);
	const [files, setFiles] = useState([]);
	const [loaded, setLoaded] = useState(false);
	const [selectedIndex, setSelectedIndex] = useState(0);
	const filesRef = useRef([]);

	const { filter, tokenStart, tokenEnd } = useMemo(
		() => deriveFilter(value, cursor),
		[value, cursor],
	);

	// Glob the cwd once, cache the result, then filter in JS.
	useEffect(() => {
		let cancelled = false;
		const debounced = setTimeout(async () => {
			try {
				const results = await fg("**/*", {
					cwd,
					onlyFiles: true,
					ignore: EXCLUDED_DIRS,
					dot: false,
					deep: 10,
				});
				if (!cancelled) {
					filesRef.current = results;
					setFiles(results);
					setLoaded(true);
				}
			} catch (_err) {
				if (!cancelled) {
					filesRef.current = [];
					setFiles([]);
					setLoaded(true);
				}
			}
		}, GLOB_DEBOUNCE_MS);

		return () => {
			cancelled = true;
			clearTimeout(debounced);
		};
	}, [cwd]);

	// Filter the cached file list in JS (substring match, case-insensitive).
	const filteredFiles = useMemo(() => {
		const needle = filter.toLowerCase();
		if (!needle) return filesRef.current;
		return filesRef.current.filter((f) => f.toLowerCase().includes(needle));
	}, [filter, files]);

	// Clamp selected index when the filtered list shrinks.
	const clampedIndex = Math.min(selectedIndex, Math.max(0, filteredFiles.length - 1));

	// Rotating window: show up to MAX_VISIBLE options around the selection.
	const visibleFiles = useMemo(() => {
		if (filteredFiles.length <= MAX_VISIBLE) return filteredFiles;
		const start = Math.max(0, Math.min(clampedIndex - 1, filteredFiles.length - MAX_VISIBLE));
		return filteredFiles.slice(start, start + MAX_VISIBLE);
	}, [filteredFiles, clampedIndex]);

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
				setSelectedIndex((prev) => (prev <= 0 ? filteredFiles.length - 1 : prev - 1));
				return;
			}
			if (key.downArrow) {
				setSelectedIndex((prev) => (prev >= filteredFiles.length - 1 ? 0 : prev + 1));
				return;
			}
			if (key.return) {
				const selected = filteredFiles[clampedIndex];
				if (selected) {
					onChange(replaceToken(value, tokenStart, tokenEnd, selected));
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
		!loaded
			? React.createElement(Text, { color: "gray" }, " Loading files...")
			: filteredFiles.length === 0
				? React.createElement(Text, { color: "gray" }, " No matching files.")
				: visibleFiles.map((file, i) => {
						const isSelected = i === clampedIndex;
						return React.createElement(
							Box,
							{ key: file, flexDirection: "row" },
							React.createElement(
								Text,
								{ color: isSelected ? "cyan" : undefined },
								isSelected ? "▸ " : "  ",
								file,
							),
						);
					}),
	);
}

export default FilePicker;
