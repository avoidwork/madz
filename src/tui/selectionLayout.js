import ansiRegex from "ansi-regex";

const ANSI_RE = ansiRegex();

/**
 * Strip ANSI escape sequences from a string.
 * @param {string} text - Text that may contain ANSI escape sequences
 * @returns {string} Text with ANSI escape sequences removed
 */
export function stripAnsi(text) {
	return text.replace(ANSI_RE, "");
}

/**
 * Wrap text into lines of at most `width` columns.
 *
 * Hard-wraps at the column boundary (no word-boundary reflow). Each returned
 * line records the character offset (`start`) at which it begins in the
 * original text, so the layout resolver can map a rendered column back to a
 * global character index.
 *
 * @param {string} text - Text to wrap
 * @param {number} width - Maximum line width in columns
 * @returns {Array<{text: string, start: number}>} Wrapped lines with start offsets
 */
export function wrapText(text, width) {
	const lines = [];
	let start = 0;
	let remaining = text;
	while (remaining.length > width) {
		lines.push({ text: remaining.slice(0, width), start });
		start += width;
		remaining = remaining.slice(width);
	}
	lines.push({ text: remaining, start });
	return lines;
}

/**
 * Build a layout model from message data.
 *
 * Each message provides its plain text (ANSI stripped) and the content row
 * (`top`) at which its first text line is rendered. The function wraps each
 * message's text into lines of `width` columns and assigns each line a content
 * row and a global character index.
 *
 * @param {Object} params
 * @param {number} params.width - Terminal width in columns
 * @param {number} params.scrollOffset - Scroll offset in rows (from getScrollOffset())
 * @param {Array<{text: string, top: number}>} params.messages - Message plain text and content top row
 * @returns {{ width: number, scrollOffset: number, lines: Array<{text: string, top: number, startIndex: number}>, fullText: string }}
 *   Layout model with flattened lines and the full rendered text.
 */
export function buildLayout({ width, scrollOffset, messages }) {
	const lines = [];
	let fullText = "";
	for (const msg of messages) {
		const text = stripAnsi(msg.text || "");
		const wrapped = wrapText(text, width);
		for (let i = 0; i < wrapped.length; i++) {
			lines.push({
				text: wrapped[i].text,
				top: msg.top + i,
				startIndex: fullText.length,
			});
			fullText += wrapped[i].text + "\n";
		}
	}
	return { width, scrollOffset, lines, fullText };
}

/**
 * Map a viewport-relative `(x, y)` coordinate to a global character index in
 * the flattened conversation text.
 *
 * The scroll offset is added to the mouse `y` coordinate to resolve the
 * correct content row. The `x` coordinate is clamped to the line's length.
 *
 * @param {Object} layout - Layout model from buildLayout()
 * @param {{x: number, y: number}} coord - Viewport-relative coordinate
 * @returns {number} Global character index, or -1 if the coordinate is outside the rendered content
 */
export function mapCoordToChar(layout, coord) {
	const contentRow = coord.y + layout.scrollOffset;
	let line = null;
	for (const l of layout.lines) {
		if (l.top === contentRow) {
			line = l;
			break;
		}
	}
	if (!line) return -1;
	const col = Math.max(0, Math.min(coord.x, line.text.length));
	return line.startIndex + col;
}

/**
 * Extract the selected text between two viewport-relative coordinates.
 *
 * The start and end coordinates are mapped to global character indices, ordered
 * so the earlier index is first. If either coordinate is outside the rendered
 * content, or the selection is empty (start === end), an empty string is
 * returned.
 *
 * @param {Object} layout - Layout model from buildLayout()
 * @param {{x: number, y: number}} start - Selection start coordinate
 * @param {{x: number, y: number}} end - Selection end coordinate
 * @returns {string} The selected text, or "" for an empty/out-of-bounds selection
 */
export function extractSelection(layout, start, end) {
	const startIdx = mapCoordToChar(layout, start);
	const endIdx = mapCoordToChar(layout, end);
	if (startIdx === -1 || endIdx === -1) return "";
	const [a, b] = startIdx <= endIdx ? [startIdx, endIdx] : [endIdx, startIdx];
	if (a === b) return "";
	return layout.fullText.slice(a, b);
}
