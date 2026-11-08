import { getBoundingClientRect } from "@ink-tools/ink-mouse";
import { applyScrollOffset, isCellInRect } from "./headerClick.js";
import { parseMarkdownWithLinks } from "./markdownText.js";
import { stripAnsi } from "./selectionLayout.js";

/**
 * Wrap rendered (ANSI-stripped) text the way a terminal text box does:
 * break at newlines, then at the last space that fits, hard-cutting words
 * longer than the width. Each line records its start index in `text`.
 * @param {string} text - Rendered plain text
 * @param {number} width - Available columns
 * @returns {Array<{text: string, start: number}>} Visual lines
 */
export function wrapRendered(text, width) {
	const w = Math.max(1, Math.floor(width) || 1);
	const lines = [];
	let base = 0;
	for (const raw of text.split("\n")) {
		let pos = 0;
		while (raw.length - pos > w) {
			const space = raw.lastIndexOf(" ", pos + w);
			if (space > pos) {
				lines.push({ text: raw.slice(pos, space), start: base + pos });
				pos = space + 1;
			} else {
				lines.push({ text: raw.slice(pos, pos + w), start: base + pos });
				pos += w;
			}
		}
		lines.push({ text: raw.slice(pos), start: base + pos });
		base += raw.length + 1;
	}
	return lines;
}

/**
 * Locate each link span inside the rendered text, in document order.
 * @param {string} rendered - ANSI-stripped rendered text
 * @param {Array<{text: string, href: string}>} links - Recorded link spans
 * @returns {Array<{start: number, end: number, href: string}>} Index ranges (end exclusive)
 */
export function locateLinks(rendered, links) {
	const ranges = [];
	let cursor = 0;
	for (const link of links) {
		if (!link.text) continue;
		const at = rendered.indexOf(link.text, cursor);
		if (at === -1) continue;
		ranges.push({ start: at, end: at + link.text.length, href: link.href });
		cursor = at + link.text.length;
	}
	return ranges;
}

/**
 * Map a click to a link inside one rendered text block.
 * @param {{x: number, y: number}} click - 1-indexed terminal cell
 * @param {string} content - Markdown source of the block
 * @param {{left: number, top: number, right: number, bottom: number, width: number}|undefined} rect - Block layout rect (before scroll)
 * @param {{offset?: number, viewport?: Object}} [scroll] - Scroll info
 * @returns {string|null} The href under the click, or null
 */
export function hitLink(click, content, rect, scroll = {}) {
	if (!click || !rect || !content) return null;
	const { offset = 0, viewport } = scroll;
	if (viewport && !isCellInRect(click.x, click.y, viewport)) return null;
	const screen = applyScrollOffset(rect, offset);
	if (!isCellInRect(click.x, click.y, screen)) return null;
	const { text, links } = parseMarkdownWithLinks(content);
	if (links.length === 0) return null;
	const rendered = stripAnsi(text);
	const lines = wrapRendered(rendered, rect.width);
	const line = lines[click.y - screen.top];
	const col = click.x - screen.left;
	if (!line || col >= line.text.length) return null;
	const index = line.start + col;
	const range = locateLinks(rendered, links).find((r) => index >= r.start && index < r.end);
	return range ? range.href : null;
}

/** Registered link targets keyed by an owner-chosen id. */
const targets = new Map();

/**
 * Register (or refresh) a rendered block as a link hit-test target.
 * @param {string} id - Unique id for the block
 * @param {{node: unknown, content: string, getScrollInfo?: Function}|null} target - Block, or null to unregister
 * @returns {void}
 */
export function setLinkTarget(id, target) {
	if (target?.node) targets.set(id, target);
	else targets.delete(id);
}

/**
 * Find the link under a click across all registered blocks.
 * @param {{x: number, y: number}} click - 1-indexed terminal cell
 * @returns {string|null} Href, or null when no link was hit
 */
export function findLinkAt(click) {
	for (const { node, content, getScrollInfo } of targets.values()) {
		const href = hitLink(click, content, getBoundingClientRect(node), getScrollInfo?.());
		if (href) return href;
	}
	return null;
}
