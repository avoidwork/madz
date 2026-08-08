import React from "react";
import { Text } from "ink";
import { marked, setOptions, Renderer } from "marked";
import chalk from "chalk";
import { highlight as highlightCli } from "cli-highlight";
import * as emoji from "node-emoji";
import ansiEscapes from "ansi-escapes";
import supportsHyperlinks from "supports-hyperlinks";
import Table from "cli-table3";

// --- Utility: ANSI-aware text length ---
// node:coverage ignore next — ANSI escape matching for reflow
const ESCAPE = "\u001b";
const ANSI_REGEXP = new RegExp(ESCAPE + "\\[[\\d;]*m", "g");
function textLength(str) {
	return str.replace(ANSI_REGEXP, "").length;
}

// --- Utility: HTML entity unescaping ---
function unescapeEntities(html) {
	return html
		.replace(/&amp;/g, "&")
		.replace(/&lt;/g, "<")
		.replace(/&gt;/g, ">")
		.replace(/&quot;/g, '"')
		.replace(/&#39;/g, "'");
}

// --- Utility: Colon escaping for code spans ---
const COLON_REPLACER = "*#COLON|*";
function escapeColon(text) {
	return text.replace(/:/g, COLON_REPLACER);
}
function undoColon(str) {
	return str.split(COLON_REPLACER).join(":");
}

// --- Utility: Text reflow with ANSI awareness ---
function reflowText(text, width, gfm) {
	const HARD_RETURN = "\r";
	const HARD_RETURN_RE = new RegExp(HARD_RETURN);
	const HARD_RETURN_GFM_RE = new RegExp(HARD_RETURN + "|<br />");

	const splitRe = gfm ? HARD_RETURN_GFM_RE : HARD_RETURN_RE;
	const sections = text.split(splitRe);
	const reflowed = [];

	sections.forEach((section) => {
		const fragments = section.split(new RegExp(ESCAPE + "\\[[\\d;]*m", "g"));
		let column = 0;
		let currentLine = "";
		let lastWasEscapeChar = false;

		while (fragments.length) {
			const fragment = fragments[0];

			if (fragment === "") {
				fragments.splice(0, 1);
				lastWasEscapeChar = false;
				continue;
			}

			if (!textLength(fragment)) {
				currentLine += fragment;
				fragments.splice(0, 1);
				lastWasEscapeChar = true;
				continue;
			}

			const words = fragment.split(/[ \t\n]+/);

			for (let i = 0; i < words.length; i++) {
				let word = words[i];
				let addSpace = column != 0;
				if (lastWasEscapeChar) addSpace = false;

				if (column + word.length + addSpace > width) {
					if (word.length <= width) {
						reflowed.push(currentLine);
						currentLine = word;
						column = word.length;
					} else {
						const w = word.substr(0, width - column - addSpace);
						if (addSpace) currentLine += " ";
						currentLine += w;
						reflowed.push(currentLine);
						currentLine = "";
						column = 0;

						word = word.substr(w.length);
						while (word.length) {
							const w = word.substr(0, width);
							if (!w.length) break;
							if (w.length < width) {
								currentLine = w;
								column = w.length;
								break;
							} else {
								reflowed.push(w);
								word = word.substr(width);
							}
						}
					}
				} else {
					if (addSpace) currentLine += " ";
					currentLine += word;
					column += word.length;
				}
				lastWasEscapeChar = false;
			}
		}

		if (textLength(currentLine)) reflowed.push(currentLine);
	});

	return reflowed.join("\n");
}

// --- Utility: Nested list handling ---
const BULLET_POINT_REGEX = "\\*";
const NUMBERED_POINT_REGEX = "\\d+\\.";
const POINT_REGEX = "(?:" + [BULLET_POINT_REGEX, NUMBERED_POINT_REGEX].join("|") + ")";

function fixNestedLists(body, indent) {
	const regex = new RegExp(
		"(\\S(?: |  )?)" + "((?:" + indent + ")+)" + "(" + POINT_REGEX + "(?:.*)+)$",
		"gm",
	);
	return body.replace(regex, "$1\n" + indent + "$2$3");
}

function bulletPointLines(lines, indent) {
	const BULLET_POINT = "* ";
	const isPointedLine = (line) => line.match("^(?:" + indent + ")*" + POINT_REGEX);

	return lines
		.split("\n")
		.filter(Boolean)
		.map((line) => {
			return isPointedLine(line) ? line : " ".repeat(BULLET_POINT.length) + line;
		})
		.join("\n");
}

function numberedLines(lines, indent) {
	const isPointedLine = (line) => line.match("^(?:" + indent + ")*" + POINT_REGEX);
	let num = 0;

	return lines
		.split("\n")
		.filter(Boolean)
		.map((line) => {
			if (isPointedLine(line)) {
				num++;
				return line.replace(/\d+\./, num + ".");
			}
			return " ".repeat((num + 1).toString().length + 2) + line;
		})
		.join("\n");
}

function list(body, ordered, indent) {
	body = body.trim();
	body = ordered ? numberedLines(body, indent) : bulletPointLines(body, indent);
	return body;
}

// --- Utility: Indentation helpers ---
function indentify(indent, text) {
	if (!text) return text;
	return indent + text.split("\n").join("\n" + indent);
}

function indentLines(indent, text) {
	return text.replace(/(^|\n)(.+)/g, "$1" + indent + "$2");
}

// --- Utility: Emoji insertion ---
function insertEmojis(text) {
	return text.replace(/:([A-Za-z0-9_\-\-+]+?):/g, (emojiString) => {
		const emojiSign = emoji.get(emojiString);
		if (!emojiSign) return emojiString;
		return emojiSign + " ";
	});
}

// --- Utility: Table row generation ---
function generateTableRow(text, escape) {
	if (!text) return [];
	escape = escape || ((t) => t);
	const lines = escape(text).split("\n");
	const data = [];
	lines.forEach((line) => {
		if (!line) return;
		const parsed = line.replace(/\*[|]+/g, "").split(/\^[*]+\|[|]+[*^]/);
		data.push(parsed.splice(0, parsed.length - 1));
	});
	return data;
}

// --- Utility: Fix hard return ---
function fixHardReturn(text, reflow) {
	return reflow ? text.replace(/\r/g, "\n") : text;
}

// --- Default options matching marked-terminal's defaults ---
const defaultOptions = {
	code: chalk.yellow,
	blockquote: chalk.gray.italic,
	html: chalk.gray,
	heading: chalk.green.bold,
	firstHeading: chalk.magenta.underline.bold,
	hr: chalk.reset,
	listitem: chalk.reset,
	list: (body, ordered, indent) => list(body, ordered, indent),
	table: chalk.reset,
	paragraph: chalk.reset,
	strong: chalk.bold,
	em: chalk.italic,
	codespan: chalk.yellow,
	del: chalk.dim.gray.strikethrough,
	link: chalk.blue,
	href: chalk.blue.underline,
	text: (t) => t,
	unescape: true,
	emoji: true,
	width: 80,
	showSectionPrefix: true,
	tab: 4,
	tableOptions: {},
};

// --- TerminalRenderer class ---
class TerminalRenderer extends Renderer {
	constructor(options = {}) {
		super();
		this.o = { ...defaultOptions, ...options };
		this.tab =
			typeof this.o.tab === "number" ? " ".repeat(this.o.tab) : " ".repeat(this.o.tab.length || 4);
		this.emoji = this.o.emoji ? insertEmojis : (t) => t;
		this.unescape = this.o.unescape ? unescapeEntities : (t) => t;
		this.transform = (t) => undoColon(this.unescape(this.emoji(t)));
	}

	heading({ tokens, depth }) {
		let text = this.parser.parseInline(tokens);
		let processed = this.transform(text);
		const prefix = this.o.showSectionPrefix
			? Array.from({ length: depth + 1 }).join("#") + " "
			: "";
		processed = prefix + processed;

		if (this.o.reflowText) {
			processed = reflowText(processed, this.o.width, this.options?.gfm);
		}

		const style = depth === 1 ? this.o.firstHeading : this.o.heading;
		return style(processed) + "\n\n";
	}

	paragraph({ tokens }) {
		let processed = this.parser.parseInline(tokens);
		processed = this.transform(processed);

		if (this.o.reflowText) {
			processed = reflowText(processed, this.o.width, this.options?.gfm);
		}

		return this.o.paragraph(processed) + "\n\n";
	}

	strong({ tokens }) {
		const processed = this.parser.parseInline(tokens);
		return this.o.strong(processed);
	}

	em({ tokens }) {
		let processed = this.parser.parseInline(tokens);
		processed = fixHardReturn(processed, this.o.reflowText);
		return this.o.em(processed);
	}

	codespan({ text }) {
		let processed = text;
		processed = fixHardReturn(processed, this.o.reflowText);
		return this.o.codespan(escapeColon(processed));
	}

	code({ text, lang, _escaped }) {
		let code = text;
		code = fixHardReturn(code, this.o.reflowText);

		if (chalk.level === 0) {
			return this.o.code(code) + "\n\n";
		}

		try {
			const highlighted = highlightCli(code, { language: lang });
			return this.o.code(highlighted) + "\n\n";
		} catch {
			return this.o.code(code) + "\n\n";
		}
	}

	blockquote({ tokens }) {
		let processed = this.parser.parse(tokens);
		processed = indentify(this.tab, processed.trim());
		return this.o.blockquote(processed) + "\n\n";
	}

	link({ href, _title, tokens }) {
		const text = this.parser.parseInline(tokens);
		const hasText = text && text !== href;
		let out = "";

		if (this.options?.sanitize) {
			try {
				const prot = decodeURIComponent(unescape(href))
					.replace(/[^\w:]/g, "")
					.toLowerCase();
				if (prot.indexOf("javascript:") === 0) return "";
			} catch {
				return "";
			}
		}

		if (supportsHyperlinks.stdout) {
			const linkText = hasText ? this.emoji(text) : this.emoji(href);
			const link = this.o.href(linkText);
			out = ansiEscapes.link(link, href.replace(/\+/g, "%20"));
		} else {
			if (hasText) out += this.emoji(text) + " (";
			out += this.o.href(href);
			if (hasText) out += ")";
		}
		return this.o.link(out);
	}

	image({ href, title, text, tokens }) {
		if (tokens) {
			text = this.parser.parseInline(tokens);
		}
		let out = "![" + text;
		if (title) out += " – " + title;
		return out + "](" + href + ")\n";
	}

	list(token) {
		const ordered = token.ordered;
		let body = "";
		for (let j = 0; j < token.items.length; j++) {
			body += this.listitem(token.items[j]);
		}
		body = this.o.list(body, ordered, this.tab);
		return fixNestedLists(indentLines(this.tab, body), this.tab) + "\n\n";
	}

	listitem(item) {
		let text = "";
		if (item.task) {
			const checkbox = this.checkbox({ checked: !!item.checked });
			if (item.loose) {
				if (item.tokens.length > 0 && item.tokens[0].type === "paragraph") {
					item.tokens[0].text = checkbox + " " + item.tokens[0].text;
					if (
						item.tokens[0].tokens &&
						item.tokens[0].tokens.length > 0 &&
						item.tokens[0].tokens[0].type === "text"
					) {
						item.tokens[0].tokens[0].text = checkbox + " " + item.tokens[0].tokens[0].text;
					}
				} else {
					item.tokens.unshift({
						type: "text",
						raw: checkbox + " ",
						text: checkbox + " ",
					});
				}
			} else {
				text += checkbox + " ";
			}
		}

		text += this.parser.parse(item.tokens, !!item.loose);
		var transform = (t) => this.o.listitem(t);
		var isNested = text.indexOf("\n") !== -1;
		if (isNested) text = text.trim();

		return "\n" + "* " + transform(text);
	}

	checkbox({ checked }) {
		return "[" + (checked ? "X" : " ") + "] ";
	}

	table(token) {
		let cell = "";
		for (let j = 0; j < token.header.length; j++) {
			cell += this.tablecell(token.header[j]);
		}
		const header = this.tablerow({ text: cell });

		let body = "";
		for (let j = 0; j < token.rows.length; j++) {
			const row = token.rows[j];
			cell = "";
			for (let k = 0; k < row.length; k++) {
				cell += this.tablecell(row[k]);
			}
			body += this.tablerow({ text: cell });
		}

		const table = new Table(
			Object.assign({}, { head: generateTableRow(header)[0] }, this.o.tableOptions),
		);

		generateTableRow(body, this.transform).forEach((row) => {
			table.push(row);
		});

		return this.o.table(table.toString()) + "\n\n";
	}

	tablerow({ text }) {
		return "*|*|*|" + text + "*|*|*|\n";
	}

	tablecell(token) {
		const content = this.parser.parseInline(token.tokens);
		return content + "^*||*^";
	}

	hr() {
		const width = this.o.reflowText ? this.o.width : process.stdout.columns;
		const line = Array.from({ length: width + 1 }).join("-");
		return this.o.hr(line) + "\n\n";
	}

	del({ tokens }) {
		const processed = this.parser.parseInline(tokens);
		return this.o.del(processed);
	}

	br() {
		return this.o.reflowText ? "\r" : "\n";
	}

	html({ text }) {
		return this.o.html(text);
	}

	text(token) {
		if ("text" in token) {
			return this.o.text(token.text);
		}
		return this.o.text(token);
	}
}

// --- Factory function ---
export function createTerminalRenderer(options = {}) {
	return new TerminalRenderer(options);
}

// --- Module-level renderer setup ---
const terminalRenderer = createTerminalRenderer();
setOptions({ renderer: terminalRenderer });

// --- LRU Cache (preserved from original) ---
const STREAMING_CURSOR = "\u2588";
const MAX_CACHE_SIZE = 500;

class LRUCache {
	/**
	 * @param {number} maxSize
	 */
	constructor(maxSize = MAX_CACHE_SIZE) {
		this.maxSize = maxSize;
		this.cache = new Map();
		this.hits = 0;
		this.misses = 0;
	}

	/**
	 * Get a value from the cache. Updates LRU order.
	 * @param {string} key
	 * @returns {unknown}
	 */
	get(key) {
		if (!this.cache.has(key)) {
			this.misses++;
			return undefined;
		}
		this.hits++;
		const value = this.cache.get(key);
		this.cache.delete(key);
		this.cache.set(key, value);
		return value;
	}

	/**
	 * Set a value in the cache. Evicts LRU entry if full.
	 * @param {string} key
	 * @param {unknown} value
	 */
	set(key, value) {
		if (this.cache.has(key)) {
			this.cache.delete(key);
		} else if (this.cache.size >= this.maxSize) {
			const lruKey = this.cache.keys().next().value;
			this.cache.delete(lruKey);
		}
		this.cache.set(key, value);
	}

	/**
	 * Delete a value from the cache.
	 * @param {string} key
	 * @returns {boolean}
	 */
	delete(key) {
		return this.cache.delete(key);
	}

	/**
	 * Check if a key exists in the cache.
	 * @param {string} key
	 * @returns {boolean}
	 */
	has(key) {
		return this.cache.has(key);
	}

	/**
	 * Current number of entries in the cache.
	 * @returns {number}
	 */
	get size() {
		return this.cache.size;
	}

	/**
	 * Cache hit rate (0-1). Returns 0 if no requests made.
	 * @returns {number}
	 */
	get hitRate() {
		const total = this.hits + this.misses;
		return total === 0 ? 0 : this.hits / total;
	}

	/**
	 * Clear all entries from the cache.
	 */
	clear() {
		this.cache.clear();
		this.hits = 0;
		this.misses = 0;
	}
}

const parseCache = new LRUCache(MAX_CACHE_SIZE);

// --- Public API (preserved) ---

/**
 * Parse markdown to ANSI terminal text.
 * @param {string} markdown
 * @returns {string}
 */
// node:coverage ignore next
export function parseMarkdown(markdown) {
	const cached = parseCache.get(markdown);
	if (cached !== undefined) {
		return cached;
	}
	const parsed = marked.parse(markdown).trim();
	parseCache.set(markdown, parsed);
	return parsed;
}

/**
 * Render markdown content as styled terminal text.
 * Strips streaming cursor character before parsing to avoid parser errors.
 * Uses a module-level LRU cache to avoid reparsing identical content.
 * @param {object} props
 * @param {string} props.content - The markdown string to render
 * @returns {React.ReactNode}
 */
export function MarkdownTextInner({ content }) {
	if (content === null || content === undefined || content === "") {
		return null;
	}

	const cleanContent = (content || "").replace(new RegExp(STREAMING_CURSOR, "g"), "");

	const parsed = parseMarkdown(cleanContent);
	return React.createElement(Text, { color: "white" }, parsed);
}

/**
 * Get cache statistics for debugging.
 * @returns {{ size: number, hitRate: number }}
 */
export function getParseCacheStats() {
	return {
		size: parseCache.size,
		hitRate: parseCache.hitRate,
	};
}

/**
 * Memo-wrapped MarkdownText for rendering in the component tree.
 */
export const MarkdownText = React.memo(MarkdownTextInner);
