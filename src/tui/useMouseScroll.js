import { useEffect, useRef } from "react";

/**
 * Regex matching SGR mouse sequences: `\x1b[<b;x;yM` (press) or `\x1b[<b;x;ym` (release).
 * Group 1 = button code, Group 2 = x, Group 3 = y, Group 4 = M (press) or m (release).
 */
const SGR_MOUSE_RE = /\x1b\[<(\d+);(\d+);(\d+)([Mm])/g;

/**
 * Parse SGR mouse sequences from a data buffer.
 * @param {string} data - Raw terminal input
 * @returns {Array<{button: number, x: number, y: number, isPress: boolean}>} Parsed sequences
 */
export function parseSgrMouseSequence(data) {
	const results = [];
	let match;
	SGR_MOUSE_RE.lastIndex = 0;
	while ((match = SGR_MOUSE_RE.exec(data)) !== null) {
		results.push({
			button: Number.parseInt(match[1], 10),
			x: Number.parseInt(match[2], 10),
			y: Number.parseInt(match[3], 10),
			isPress: match[4] === "M",
		});
	}
	return results;
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
 * Hook that enables terminal mouse reporting and parses SGR mouse sequences
 * to detect wheel-up/wheel-down events, invoking a callback with a delta.
 *
 * Enables mouse reporting (`\x1b[?1000h` / `\x1b[?1006h`) on mount and disables
 * it (`\x1b[?1000l` / `\x1b[?1006l`) on unmount. Only attaches when stdout is a
 * TTY and not in CI. The stdin listener is removed on unmount.
 *
 * @param {Function} [onScroll] - Called with -1 (wheel-up) or +1 (wheel-down)
 * @returns {void}
 */
export function useMouseScroll(onScroll) {
	const onScrollRef = useRef(onScroll);
	onScrollRef.current = onScroll;
	const bufferRef = useRef("");

	useEffect(() => {
		const stdout = process.stdout;
		const stdin = process.stdin;
		if (!stdout?.isTTY || process.env.CI) return;

		stdout.write("\x1b[?1000h\x1b[?1006h");

		const handleData = (chunk) => {
			bufferRef.current += chunk.toString();
			const re = /\x1b\[<(\d+);(\d+);(\d+)([Mm])/g;
			let match;
			let lastIndex = 0;
			while ((match = re.exec(bufferRef.current)) !== null) {
				const button = Number.parseInt(match[1], 10);
				const isPress = match[4] === "M";
				if (isPress) {
					const delta = buttonToDelta(button);
					if (delta !== null) onScrollRef.current?.(delta);
				}
				lastIndex = re.lastIndex;
			}
			// Keep only trailing partial data after the last complete match.
			bufferRef.current = bufferRef.current.slice(lastIndex);
		};

		stdin.on("data", handleData);
		return () => {
			stdin.off("data", handleData);
			stdout.write("\x1b[?1000l\x1b[?1006l");
		};
	}, []);
}
