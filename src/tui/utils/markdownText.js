import React from "react";
import { Text } from "ink";
import { marked, setOptions } from "marked";
import { markedTerminal } from "marked-terminal";

const terminalRenderer = markedTerminal();
setOptions({ renderer: terminalRenderer.renderer });

/**
 * Parse markdown to ANSI terminal text.
 * @param {string} markdown
 * @returns {string}
 */
// node:coverage ignore next
export function parseMarkdown(markdown) {
	return marked.parse(markdown).trim();
}

const STREAMING_CURSOR = "\u2588";

/**
 * Module-level parse cache keyed by clean content string.
 * Avoids reparsing identical markdown across renders.
 */
const parseCache = new Map();

/**
 * Render markdown content as styled terminal text.
 * Strips streaming cursor character before parsing to avoid parser errors.
 * Uses a module-level cache to avoid reparsing identical content.
 * @param {object} props
 * @param {string} props.content - The markdown string to render
 * @returns {React.ReactNode}
 */
export function MarkdownTextInner({ content }) {
	if (content === null || content === undefined || content === "") {
		return null;
	}

	// Strip streaming cursor character before parsing
	const cleanContent = (content || "").replace(new RegExp(STREAMING_CURSOR, "g"), "");

	// Module-level cache lookup
	if (!parseCache.has(cleanContent)) {
		parseCache.set(cleanContent, parseMarkdown(cleanContent));
	}

	return React.createElement(Text, { color: "white" }, parseCache.get(cleanContent) || "");
}

/**
 * Memo-wrapped MarkdownText for rendering in the component tree.
 */
export const MarkdownText = React.memo(MarkdownTextInner);
