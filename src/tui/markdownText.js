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

/**
 * Render markdown content as styled terminal text.
 * @param {object} props
 * @param {string} props.content - The markdown string to render
 * @returns {React.ReactNode}
 */
export function MarkdownTextInner({ content }) {
	if (content === null || content === undefined || content === "") {
		return null;
	}
	const result = parseMarkdown(content || "");
	return React.createElement(Text, { wrap: "hard", color: "white" }, result || "");
}

/**
 * Memo-wrapped MarkdownText for rendering in the component tree.
 */
export const MarkdownText = React.memo(MarkdownTextInner);
