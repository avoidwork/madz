const CONTEXT_LINES = 3;
const MAX_LCS_CELLS = 4_000_000;

/**
 * Split text into lines, ignoring a single trailing newline.
 * @param {string} text - Text to split
 * @returns {string[]} Lines
 */
function splitLines(text) {
	if (text === "") return [];
	const parts = text.split("\n");
	if (parts[parts.length - 1] === "") parts.pop();
	return parts;
}

/**
 * Compute line-level diff operations using a common prefix/suffix trim followed
 * by a longest-common-subsequence pass on the differing middle. Very large
 * middles fall back to a single replace block.
 * @param {string[]} a - Old lines
 * @param {string[]} b - New lines
 * @returns {Array<{ type: " " | "-" | "+", line: string }>} Diff operations
 */
function diffOps(a, b) {
	let prefix = 0;
	while (prefix < a.length && prefix < b.length && a[prefix] === b[prefix]) prefix++;
	let suffix = 0;
	while (
		suffix < a.length - prefix &&
		suffix < b.length - prefix &&
		a[a.length - 1 - suffix] === b[b.length - 1 - suffix]
	) {
		suffix++;
	}

	const midA = a.slice(prefix, a.length - suffix);
	const midB = b.slice(prefix, b.length - suffix);
	const ops = a.slice(0, prefix).map((line) => ({ type: " ", line }));

	const n = midA.length;
	const m = midB.length;
	if (n * m > MAX_LCS_CELLS || n === 0 || m === 0) {
		for (const line of midA) ops.push({ type: "-", line });
		for (const line of midB) ops.push({ type: "+", line });
	} else {
		const width = m + 1;
		const lcs = new Uint32Array((n + 1) * width);
		for (let i = n - 1; i >= 0; i--) {
			for (let j = m - 1; j >= 0; j--) {
				lcs[i * width + j] =
					midA[i] === midB[j]
						? lcs[(i + 1) * width + j + 1] + 1
						: Math.max(lcs[(i + 1) * width + j], lcs[i * width + j + 1]);
			}
		}
		let i = 0;
		let j = 0;
		while (i < n && j < m) {
			if (midA[i] === midB[j]) {
				ops.push({ type: " ", line: midA[i] });
				i++;
				j++;
			} else if (lcs[(i + 1) * width + j] >= lcs[i * width + j + 1]) {
				ops.push({ type: "-", line: midA[i++] });
			} else {
				ops.push({ type: "+", line: midB[j++] });
			}
		}
		while (i < n) ops.push({ type: "-", line: midA[i++] });
		while (j < m) ops.push({ type: "+", line: midB[j++] });
	}

	for (const line of a.slice(a.length - suffix)) ops.push({ type: " ", line });
	return ops;
}

/**
 * Group diff operations into hunks with surrounding context.
 * @param {Array<{ type: string, line: string }>} ops - Diff operations
 * @returns {Array<{ start: number, end: number }>} Inclusive op index ranges
 */
function hunkRanges(ops) {
	const ranges = [];
	for (let i = 0; i < ops.length; i++) {
		if (ops[i].type === " ") continue;
		const start = Math.max(0, i - CONTEXT_LINES);
		const end = Math.min(ops.length - 1, i + CONTEXT_LINES);
		const last = ranges[ranges.length - 1];
		if (last && start <= last.end + 1) last.end = end;
		else ranges.push({ start, end });
	}
	return ranges;
}

/**
 * Generate a unified diff between old and new text using a real line diff.
 * Hunk line numbers are relative to the file when `startLine` is supplied.
 * @param {string} oldStr - Original text
 * @param {string} newStr - Replacement text
 * @param {object} [options] - Diff options
 * @param {string} [options.label] - File label used in the headers (default "file")
 * @param {number} [options.startLine] - 1-based file line where the text begins (default 1)
 * @param {boolean} [options.headers] - Include the ---/+++ headers (default true)
 * @returns {string} Unified diff
 */
export function generateUnifiedDiff(oldStr, newStr, options = {}) {
	const { label = "file", startLine = 1, headers = true } = options;
	const ops = diffOps(splitLines(oldStr), splitLines(newStr));
	const out = headers ? [`--- a/${label}`, `+++ b/${label}`] : [];

	// Line numbers (1-based, relative to the file) of the next old/new line per op.
	const oldNext = [];
	const newNext = [];
	let o = startLine;
	let n = startLine;
	for (const op of ops) {
		oldNext.push(o);
		newNext.push(n);
		if (op.type !== "+") o++;
		if (op.type !== "-") n++;
	}

	for (const { start, end } of hunkRanges(ops)) {
		const slice = ops.slice(start, end + 1);
		const oldCount = slice.filter((op) => op.type !== "+").length;
		const newCount = slice.filter((op) => op.type !== "-").length;
		const oldStart = oldCount === 0 ? oldNext[start] - 1 : oldNext[start];
		const newStart = newCount === 0 ? newNext[start] - 1 : newNext[start];
		out.push(`@@ -${oldStart},${oldCount} +${newStart},${newCount} @@`);
		for (const op of slice) out.push(`${op.type}${op.line}`);
	}
	return out.join("\n");
}
