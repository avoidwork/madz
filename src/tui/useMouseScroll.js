import { useEffect, useRef } from "react";

/**
 * Regex matching SGR mouse sequences: `\x1b[<b;x;yM` (press/move) or `\x1b[<b;x;ym` (release).
 * Group 1 = button code, Group 2 = x, Group 3 = y, Group 4 = M (press/move) or m (release).
 */
// eslint-disable-next-line no-control-regex -- matching ESC control sequences is the purpose of this regex
const SGR_MOUSE_RE = /\x1b\[<(\d+);(\d+);(\d+)([Mm])/g;

/**
 * Parse SGR mouse sequences from a data buffer.
 * @param {string} data - Raw terminal input
 * @returns {{ events: Array<{button: number, x: number, y: number, isPress: boolean}>, lastIndex: number }}
 *   Parsed sequences plus the index of the first unconsumed byte. Callers use
 *   `lastIndex` to retain trailing partial data (an incomplete sequence split
 *   across chunks) for the next call.
 */
export function parseSgrMouseSequence(data) {
	const events = [];
	let match;
	let lastIndex = 0;
	SGR_MOUSE_RE.lastIndex = 0;
	while ((match = SGR_MOUSE_RE.exec(data)) !== null) {
		events.push({
			button: Number.parseInt(match[1], 10),
			x: Number.parseInt(match[2], 10),
			y: Number.parseInt(match[3], 10),
			isPress: match[4] === "M",
		});
		lastIndex = SGR_MOUSE_RE.lastIndex;
	}
	return { events, lastIndex };
}

/**
 * Map an SGR button code to a scroll delta.
 * @param {number} button - SGR button code
 * @returns {number|null} -1 for wheel-up, 1 for wheel-down, null otherwise
 */
export function buttonToDelta(button) {
	if (button === 64) return -1;
	if (button === 65) return 1;
	return null;
}

/**
 * Classify an SGR button code as a left-button drag (selection) event.
 * @param {number} button - SGR button code
 * @returns {boolean} True for button 0 (left-button drag), false otherwise
 */
export function buttonToSelection(button) {
	return button === 0;
}

/**
 * Scale a scroll delta by the configured number of lines per wheel event.
 * @param {number} delta - Base scroll delta (-1 for wheel-up, +1 for wheel-down)
 * @param {number} [lines=1] - Number of lines to scroll per wheel event
 * @returns {number} The scaled delta
 */
export function scaleScrollDelta(delta, lines = 1) {
	return delta * lines;
}

/**
 * Hook that enables terminal mouse reporting and parses SGR mouse sequences
 * to detect wheel-up/wheel-down events and left-button drag selection.
 *
 * When `enabled` is true, mouse reporting (`\x1b[?1000h` / `\x1b[?1006h`) and
 * button-event tracking (`\x1b[?1002h`) are enabled and a stdin listener is
 * attached. When `enabled` is false, mouse reporting is disabled and the
 * listener is removed, so mouse events bubble out to the terminal's native
 * handling (text selection, link clicks). Only attaches when stdout is a TTY
 * and not in CI.
 *
 * Wheel events (button codes 64/65) invoke `onScroll` with a delta. Left-button
 * drag (button code 0) tracks a selection: press records the start `(x, y)`,
 * move while held updates the end, and release finalizes and invokes `onSelect`
 * with the start/end coordinates.
 *
 * @param {Function} [onScroll] - Called with -1 (wheel-up) or +1 (wheel-down)
 * @param {Function} [onSelect] - Called with `{ start: {x, y}, end: {x, y} }` on release
 * @param {Function} [onSelectionChange] - Called with `{ start: {x, y}, end: {x, y} }` on press/move for live highlighting
 * @param {boolean} [enabled=true] - Whether mouse reporting is active. When false, mouse events bubble out to the terminal.
 * @returns {void}
 */
export function useMouseScroll(onScroll, onSelect, onSelectionChange, enabled = true) {
	const onScrollRef = useRef(onScroll);
	onScrollRef.current = onScroll;
	const onSelectRef = useRef(onSelect);
	onSelectRef.current = onSelect;
	const onSelectionChangeRef = useRef(onSelectionChange);
	onSelectionChangeRef.current = onSelectionChange;
	const bufferRef = useRef("");
	const selectionRef = useRef(null);

	useEffect(() => {
		const stdout = process.stdout;
		const stdin = process.stdin;
		if (!stdout?.isTTY || process.env.CI) return;

		// When disabled, ensure mouse reporting is off so the terminal's native
		// selection/link handling is restored. No listener is attached, so mouse
		// events bubble out to the terminal.
		if (!enabled) {
			stdout.write("\x1b[?1000l\x1b[?1006l\x1b[?1002l");
			return;
		}

		stdout.write("\x1b[?1000h\x1b[?1006h\x1b[?1002h");

		const handleData = (chunk) => {
			bufferRef.current += chunk.toString();
			const { events, lastIndex } = parseSgrMouseSequence(bufferRef.current);
			for (const event of events) {
				if (buttonToSelection(event.button)) {
					// Left-button drag selection.
					if (event.isPress) {
						// Press or move while held. If no selection is active, this is
						// the initial press — record the start. Otherwise it is a drag
						// move — update the end.
						if (selectionRef.current === null) {
							selectionRef.current = {
								start: { x: event.x, y: event.y },
								end: { x: event.x, y: event.y },
							};
						} else {
							selectionRef.current.end = { x: event.x, y: event.y };
						}
						// Notify for live highlighting during the drag.
						onSelectionChangeRef.current?.(selectionRef.current);
					} else {
						// Release — finalize the selection.
						const selection = selectionRef.current;
						selectionRef.current = null;
						if (selection) {
							onSelectRef.current?.(selection);
						}
					}
				} else if (event.isPress) {
					const delta = buttonToDelta(event.button);
					if (delta !== null) onScrollRef.current?.(delta);
				}
			}
			// Keep only trailing partial data after the last complete match.
			bufferRef.current = bufferRef.current.slice(lastIndex);
		};

		stdin.on("data", handleData);
		return () => {
			stdin.off("data", handleData);
			stdout.write("\x1b[?1000l\x1b[?1006l\x1b[?1002l");
		};
	}, [enabled]);
}
