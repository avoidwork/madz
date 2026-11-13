import React from "react";
import { Text } from "ink";
import { marked, setOptions, Renderer } from "marked";
import chalk from "chalk";
import { highlight as highlightCli } from "cli-highlight";
import * as emoji from "node-emoji";
import ansiEscapes from "ansi-escapes";
import supportsHyperlinks from "supports-hyperlinks";
import Table from "cli-table3";
import { lru } from "tiny-lru";
import { stripAnsi } from "./selectionLayout.js";
import { sanitizeForTerminal } from "./sanitize.js";
import { parseSafeUrl } from "./openUrl.js";

/**
 * Link spans recorded by the renderer's `link()` during the current
 * synchronous `marked.parse` call. `null` when no parse is collecting.
 * @type {Array<{text: string, href: string}>|null}
 */
let activeLinks = null;

// --- Utility: HTML entity unescaping ---
const ENTITY_MAP = { "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": '"', "&#39;": "'" };
function unescapeEntities(html) {
	// Single pass so `&amp;lt;` becomes `&lt;` rather than being double-unescaped.
	return html.replace(/&(?:amp|lt|gt|quot|#39);/g, (m) => ENTITY_MAP[m]);
}

// --- Utility: Colon escaping for code spans ---
const COLON_REPLACER = "*#COLON|*";
function escapeColon(text) {
	return text.replace(/:/g, COLON_REPLACER);
}
function undoColon(str) {
	return str.split(COLON_REPLACER).join(":");
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
				return line;
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
	return text.replace(/:([A-Za-z0-9_+-]+?):/g, (emojiString) => {
		const emojiSign = emoji.get(emojiString);
		if (!emojiSign) return emojiString;
		return emojiSign + " ";
	});
}

// --- Utility: Table row generation ---
/**
 * Parse a table row string into cell arrays.
 * Used by the TerminalRenderer to convert internal table markup into cli-table3 rows.
 * @param {string} text - Raw table row text with delimiter markers
 * @param {Function} [escape] - Optional escape function for cell content
 * @returns {Array<Array<string>>} Array of cell arrays (one per row)
 */
export function generateTableRow(text, escape) {
	if (!text) return [];
	escape = escape || ((t) => t);
	const lines = escape(text).split("\n");
	const data = [];
	lines.forEach((line) => {
		if (!line) return;
		const parsed = line.replace(/\*[|]\*[|]\*[|]/g, "").split(/\^\*\|\|\*\^/);
		data.push(parsed.splice(0, parsed.length - 1));
	});
	return data;
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

		const style = depth === 1 ? this.o.firstHeading : this.o.heading;
		return style(processed) + "\n\n";
	}

	paragraph({ tokens }) {
		let processed = this.parser.parseInline(tokens);
		processed = this.transform(processed);

		return this.o.paragraph(processed) + "\n\n";
	}

	strong({ tokens }) {
		const processed = this.parser.parseInline(tokens);
		return this.o.strong(undoColon(processed));
	}

	em({ tokens }) {
		let processed = this.parser.parseInline(tokens);
		return this.o.em(undoColon(processed));
	}

	codespan({ text }) {
		let processed = text;
		return this.o.codespan(escapeColon(processed));
	}

	code({ text, lang, _escaped }) {
		let code = text;

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

		// Only http(s)/mailto hrefs without control characters become real
		// hyperlinks; anything else is rendered as plain text.
		const safeUrl = parseSafeUrl(href);
		const safeHref = safeUrl && sanitizeForTerminal(href) === href ? safeUrl.href : null;
		if (!safeHref) {
			return this.o.link(hasText ? undoColon(this.emoji(text)) : "");
		}
		href = safeHref;

		if (supportsHyperlinks.stdout) {
			const linkText = hasText ? undoColon(this.emoji(text)) : undoColon(this.emoji(href));
			const link = this.o.href(linkText);
			out = ansiEscapes.link(link, href.replace(/\+/g, "%20"));
		} else {
			if (hasText) out += undoColon(this.emoji(text)) + " (";
			out += this.o.href(href);
			if (hasText) out += ")";
		}
		const rendered = this.o.link(out);
		// Record the visible (ANSI-stripped) text so clicks can be mapped back to
		// the href: the link text for OSC 8, or `text (url)` for the fallback.
		if (activeLinks) activeLinks.push({ text: stripAnsi(rendered), href });
		return rendered;
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
		const start = Number(token.start) || 1;
		let body = "";
		for (let j = 0; j < token.items.length; j++) {
			body += this.listitem(token.items[j], ordered ? `${start + j}.` : "*");
		}
		body = this.o.list(body, ordered, this.tab);
		return fixNestedLists(indentLines(this.tab, body), this.tab) + "\n\n";
	}

	listitem(item, marker = "*") {
		// `marked` already emits a `checkbox` token in `item.tokens` for task
		// items, and `checkbox()` renders it as `[ ] ` / `[X] `. Do NOT prepend
		// the checkbox again here — doing so duplicates it (e.g. `[ ] [ ] Text`).
		let text = this.parser.parse(item.tokens, !!item.loose);
		var transform = (t) => this.o.listitem(undoColon(t));
		var isNested = text.indexOf("\n") !== -1;
		if (isNested) text = text.trim();

		return "\n" + marker + " " + transform(text);
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
		const content = undoColon(this.parser.parseInline(token.tokens));
		return content + "^*||*^";
	}

	hr() {
		const width = this.o.reflowText ? this.o.width : process.stdout.columns;
		const line = Array.from({ length: width + 1 }).join("-");
		return this.o.hr(line) + "\n\n";
	}

	del({ tokens }) {
		const processed = this.parser.parseInline(tokens);
		return this.o.del(undoColon(processed));
	}

	br() {
		return this.o.reflowText ? "\r" : "\n";
	}

	html({ text }) {
		return this.o.html(text);
	}

	text(token) {
		if (token.tokens) {
			return this.parser.parseInline(token.tokens);
		}
		return this.o.text(token.text);
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

const parseCache = lru(MAX_CACHE_SIZE);
const STREAMING_CURSOR_RE = new RegExp(STREAMING_CURSOR, "g");

// --- Public API (preserved) ---

/**
 * Parse markdown to ANSI terminal text plus the link spans it contains.
 * The cache carries the link metadata alongside the rendered string.
 * @param {string} markdown
 * @returns {{text: string, links: Array<{text: string, href: string}>}} Rendered text and link spans in document order
 */
export function parseMarkdownWithLinks(markdown) {
	// Untrusted text: drop terminal control characters before parsing.
	markdown = sanitizeForTerminal(markdown);
	const cached = parseCache.get(markdown);
	if (cached !== undefined) {
		return cached;
	}
	const previous = activeLinks;
	activeLinks = [];
	let parsed;
	try {
		parsed = { text: marked.parse(markdown).trim(), links: activeLinks };
	} finally {
		activeLinks = previous;
	}
	parseCache.set(markdown, parsed);
	return parsed;
}

/**
 * Parse markdown to ANSI terminal text.
 * @param {string} markdown
 * @returns {string}
 */
// node:coverage ignore next
export function parseMarkdown(markdown) {
	return parseMarkdownWithLinks(markdown).text;
}

/**
 * Render markdown content as styled terminal text.
 * Strips streaming cursor character before parsing to avoid parser errors.
 * Uses a module-level LRU cache to avoid reparsing identical content.
 * @param {object} props
 * @param {string} props.content - The markdown string to render
 * @param {string} [props.backgroundColor] - Optional background color for selection highlight
 * @returns {React.ReactNode}
 */
export function MarkdownTextInner({ content, backgroundColor }) {
	if (content === null || content === undefined || content === "") {
		return null;
	}

	const cleanContent = (content || "").replace(STREAMING_CURSOR_RE, "");
	const parsed = parseMarkdown(cleanContent);

	return React.createElement(Text, { color: "white", backgroundColor }, parsed);
}

/**
 * Get cache statistics for debugging.
 * @returns {{ size: number, hitRate: number }}
 */
export function getParseCacheStats() {
	const stats = parseCache.stats();
	const total = stats.hits + stats.misses;
	return {
		size: parseCache.size,
		hitRate: total === 0 ? 0 : stats.hits / total,
	};
}

/**
 * Memo-wrapped MarkdownText for rendering in the component tree.
 */
export const MarkdownText = React.memo(MarkdownTextInner);
