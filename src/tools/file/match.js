const MAX_FUZZY_TARGET = 50_000;
const MAX_SUGGESTION_LINES = 5000;

/**
 * Calculate Levenshtein edit distance between two strings.
 * @param {string} a - First string
 * @param {string} b - Second string
 * @returns {number} Edit distance
 */
export function levenshteinDistance(a, b) {
	if (a.length === 0) return b.length;
	if (b.length === 0) return a.length;

	let prev = Array.from({ length: a.length + 1 }, (_, j) => j);
	for (let i = 1; i <= b.length; i++) {
		const row = [i];
		for (let j = 1; j <= a.length; j++) {
			row[j] =
				b.charAt(i - 1) === a.charAt(j - 1)
					? prev[j - 1]
					: Math.min(prev[j - 1] + 1, row[j - 1] + 1, prev[j] + 1);
		}
		prev = row;
	}
	return prev[a.length];
}

/**
 * Escape a string for literal use inside a regular expression.
 * @param {string} text - Text to escape
 * @returns {string} Escaped text
 */
export function escapeRegExp(text) {
	return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Build a regular expression that matches `target` while tolerating differences
 * in horizontal whitespace (spaces vs tabs, indentation, trailing spaces) and
 * line endings (LF vs CRLF). The number of line breaks must still match, so a
 * match can never span extra blank lines. Because the expression runs against the
 * original text, match offsets are always exact.
 * @param {string} target - Text to look for
 * @returns {RegExp} Global regular expression
 */
export function buildWhitespaceRegex(target) {
	const parts = target.split(/(\s+)/);
	const last = parts.length - 1;
	const pattern = parts
		.map((part, i) => {
			if (i % 2 === 0) return escapeRegExp(part);
			const breaks = (part.match(/\n/g) || []).length;
			if (breaks > 0) return `[ \\t]*(?:\\r?\\n[ \\t]*){${breaks}}`;
			const edge = (i === 1 && parts[0] === "") || (i === last - 1 && parts[last] === "");
			return edge ? "[ \\t]*" : "[ \\t]+";
		})
		.join("");
	return new RegExp(pattern, "g");
}

/**
 * Find every non-overlapping exact occurrence of `target`.
 * @param {string} target - Text to look for (non-empty)
 * @param {string} content - Text to search
 * @returns {Array<{ start: number, end: number }>} Match ranges
 */
function findAllExact(target, content) {
	const found = [];
	let from = 0;
	for (;;) {
		const idx = content.indexOf(target, from);
		if (idx === -1) return found;
		found.push({ start: idx, end: idx + target.length });
		from = idx + target.length;
	}
}

/**
 * Locate `target` in `fileContent`. Tries an exact match first, then a
 * whitespace-tolerant match. Every returned offset refers to the original
 * `fileContent`, so it is safe to slice and replace with. Case-insensitive and
 * newline-insensitive matching are intentionally not attempted because they can
 * silently edit the wrong text.
 * @param {string} target - Target string
 * @param {string} fileContent - File content to search within
 * @returns {Array<{ found: boolean, start?: number, end?: number, matched?: string, tier?: string }>}
 *   All matches, or a single `{ found: false }` entry
 */
export function fuzzyMatch(target, fileContent) {
	if (typeof target !== "string" || target === "") return [{ found: false }];

	const exact = findAllExact(target, fileContent);
	if (exact.length > 0) {
		return exact.map((m) => ({
			found: true,
			...m,
			matched: fileContent.slice(m.start, m.end),
			tier: "exact",
		}));
	}

	if (target.trim() === "" || target.length > MAX_FUZZY_TARGET) return [{ found: false }];

	const matches = [];
	for (const m of fileContent.matchAll(buildWhitespaceRegex(target))) {
		matches.push({
			found: true,
			start: m.index,
			end: m.index + m[0].length,
			matched: m[0],
			tier: "whitespace",
		});
	}
	return matches.length > 0 ? matches : [{ found: false }];
}

/**
 * 1-based line number of a character offset.
 * @param {string} content - Text
 * @param {number} offset - Character offset
 * @returns {number} Line number
 */
export function lineNumberAt(content, offset) {
	let line = 1;
	for (let i = content.indexOf("\n"); i !== -1 && i < offset; i = content.indexOf("\n", i + 1)) {
		line++;
	}
	return line;
}

/**
 * Suggest file lines that resemble the first line of `target`.
 * @param {string} target - Text that could not be found
 * @param {string} content - File content
 * @param {number} [max] - Maximum suggestions
 * @returns {string[]} Suggestions formatted as "<line>: <text>"
 */
export function suggestSimilarLines(target, content, max = 5) {
	const needle = (target.split("\n").find((l) => l.trim() !== "") || "").trim().toLowerCase();
	if (needle === "") return [];
	const threshold = Math.floor(needle.length / 2);
	const lines = content.split("\n").slice(0, MAX_SUGGESTION_LINES);
	const suggestions = [];
	for (let i = 0; i < lines.length && suggestions.length < max; i++) {
		const text = lines[i].trim();
		if (Math.abs(text.length - needle.length) > threshold) continue;
		const dist = levenshteinDistance(needle, text.toLowerCase());
		if (dist > 0 && dist <= threshold) suggestions.push(`${i + 1}: ${text}`);
	}
	return suggestions;
}
