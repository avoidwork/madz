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
export function MarkdownText({ content }) {
	if (content === null || content === undefined || content === "") {
		return null;
	}
	const text = content || "";
	const result = parseMarkdown(text);
	return React.createElement(Text, { wrap: "hard", color: "white" }, result || "");
}
