import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { Box, Text, useInput } from "ink";
import fg from "fast-glob";

const MAX_VISIBLE = 3;
const DEBOUNCE_MS = 250;
const DEPTH_CAP = 6;
const GLOB_IGNORES = ["**/node_modules/**", "**/.git/**", "**/dist/**"];

/**
 * Derive the autocomplete filter from the token at the cursor.
 * A token is bounded by whitespace (unquoted) or quotes (quoted).
 * Returns { filter, tokenStart, tokenEnd, active } where active is true
 * only when the cursor is inside an `@` token.
 * @param {string} value - The full input text
 * @param {number} cursor - The cursor position
 * @returns {{filter: string, tokenStart: number, tokenEnd: number, active: boolean}}
 */
export function deriveFilter(value, cursor) {
	const pos = Math.max(0, Math.min(cursor, value.length));

	// Determine whether the cursor is inside a quoted region by scanning
	// from the start. Quotes contain the path, so spaces within them are
	// part of the token rather than a boundary.
	let inQuote = false;
	for (let i = 0; i < pos; i++) {
		if (value[i] === '"') inQuote = !inQuote;
	}

	// Walk back to find the token start.
	let start = pos;
	while (start > 0) {
		const ch = value[start - 1];
		if (ch === '"') {
			start--;
			break;
		}
		if (!inQuote && /\s/.test(ch)) {
			break;
		}
		start--;
	}

	// If the region begins with a quote, the token starts at the `@` after it.
	if (value[start] === '"') {
		start++;
	}

	// Walk forward to find the token end.
	let end = pos;
	while (end < value.length) {
		const ch = value[end];
		if (ch === '"') {
			break;
		}
		if (!inQuote && /\s/.test(ch)) {
			break;
		}
		end++;
	}

	// The token must start with `@` and the cursor must be after it.
	const token = value.slice(start, end);
	if (!token.startsWith("@") || pos <= start) {
		return { filter: "", tokenStart: start, tokenEnd: end, active: false };
	}

	const filter = value.slice(start + 1, pos).trim();
	// A quoted `@` with nothing to filter by is invalid — there's no path to
	// match, so don't open the picker.
	if (filter === "" && start > 0 && value[start - 1] === '"') {
		return { filter: "", tokenStart: start, tokenEnd: end, active: false };
	}
	return { filter, tokenStart: start, tokenEnd: end, active: true };
}

/**
 * Replace the `@` token (tokenStart..tokenEnd) with the full selected path.
 * Wraps the path in quotes if it contains whitespace.
 * @param {string} value - The full input text
 * @param {number} tokenStart - Start index of the token
 * @param {number} tokenEnd - End index of the token
 * @param {string} path - The selected file path
 * @returns {string}
 */
export function replaceToken(value, tokenStart, tokenEnd, path) {
	const replacement = /\s/.test(path) ? `"${path}"` : path;
	return value.slice(0, tokenStart) + replacement + value.slice(tokenEnd);
}

/**
 * FilePicker — self-contained input+list component that owns the input while open.
 * Uses a single useInput handler for filtering and navigation to avoid the
 * focus conflict between ink-text-input and ink-select-input.
 * @param {Object} props
 * @param {string} props.value - Current input text
 * @param {(value: string) => void} props.onChange - Callback when value changes
 * @param {() => void} props.onClose - Callback when the picker closes
 * @param {string} [props.cwd] - Working directory to glob (defaults to process.cwd())
 * @returns {React.ReactElement}
 */
/* node:coverage disable */
export function FilePicker({ value, onChange, onClose, cwd }) {
	const [cursor, setCursor] = useState(value.length);
	const [files, setFiles] = useState([]);
	const [focusIndex, setFocusIndex] = useState(0);
	const [loaded, setLoaded] = useState(false);
	const debounceRef = useRef(null);
	const filesRef = useRef([]);

	const { filter, tokenStart, tokenEnd, active } = useMemo(
		() => deriveFilter(value, cursor),
		[value, cursor],
	);

	// Glob the cwd once, cache the result, then filter in JS.
	useEffect(() => {
		let cancelled = false;
		async function load() {
			try {
				const result = await fg("**/*", {
					cwd: cwd || process.cwd(),
					ignore: GLOB_IGNORES,
					onlyFiles: true,
					deep: DEPTH_CAP,
					dot: false,
				});
				if (!cancelled) {
					filesRef.current = result;
					setFiles(result);
					setLoaded(true);
				}
			} catch (_err) {
				if (!cancelled) {
					filesRef.current = [];
					setFiles([]);
					setLoaded(true);
				}
			}
		}
		load();
		return () => {
			cancelled = true;
		};
	}, [cwd]);

	// Debounce the JS filter on filter change.
	useEffect(() => {
		if (debounceRef.current) clearTimeout(debounceRef.current);
		debounceRef.current = setTimeout(() => {
			const q = filter.toLowerCase();
			const matches = q
				? filesRef.current.filter((f) => f.toLowerCase().includes(q))
				: filesRef.current;
			setFiles(matches);
			setFocusIndex(0);
		}, DEBOUNCE_MS);
		return () => {
			if (debounceRef.current) clearTimeout(debounceRef.current);
		};
	}, [filter]);

	const sorted = useMemo(
		() => [...files].sort((a, b) => a.length - b.length || a.localeCompare(b)),
		[files],
	);
	const clampedIndex = Math.min(focusIndex, Math.max(0, sorted.length - 1));

	// Rotating window: show up to MAX_VISIBLE options around the selection.
	const windowStart = useMemo(() => {
		if (sorted.length <= MAX_VISIBLE) return 0;
		const start = Math.max(0, clampedIndex - Math.floor(MAX_VISIBLE / 2));
		return Math.min(start, sorted.length - MAX_VISIBLE);
	}, [clampedIndex, sorted.length]);

	const visible = sorted.slice(windowStart, windowStart + MAX_VISIBLE);

	const handleSelect = useCallback(() => {
		const selected = sorted[clampedIndex];
		if (selected) {
			onChange(replaceToken(value, tokenStart, tokenEnd, selected));
		}
		onClose?.();
	}, [sorted, clampedIndex, value, tokenStart, tokenEnd, onChange, onClose]);

	useInput(
		(input, key) => {
			if (!active) {
				onClose?.();
				return;
			}
			if (key.escape) {
				onClose?.();
				return;
			}
			if (key.return) {
				handleSelect();
				return;
			}
			if (key.upArrow) {
				setFocusIndex((prev) => (prev <= 0 ? sorted.length - 1 : prev - 1));
				return;
			}
			if (key.downArrow) {
				setFocusIndex((prev) => (prev >= sorted.length - 1 ? 0 : prev + 1));
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
		{ isActive: true },
	);

	// Render the input text with a cursor indicator (replicating ink-text-input).
	const before = value.slice(0, cursor);
	const at = value[cursor] || " ";
	const after = value.slice(cursor + 1);

	return React.createElement(
		Box,
		{ flexDirection: "column", paddingX: 1 },
		React.createElement(
			Text,
			null,
			before,
			React.createElement(Text, { inverse: true }, at),
			after,
		),
		!loaded
			? React.createElement(Text, { color: "gray" }, " Loading files...")
			: React.createElement(
					Box,
					{ width: "100%", backgroundColor: "#0d0d0d" },
					visible.map((file, i) => {
						const isSelected = windowStart + i === clampedIndex;
						return React.createElement(
							Text,
							{ key: file, color: isSelected ? "cyan" : undefined },
							isSelected ? "▸ " : "  ",
							file,
						);
					}),
				),
	);
}
/* node:coverage enable */

export default FilePicker;
