import React, { useState, useEffect, useContext } from "react";
import { Box, Text } from "ink";
import { MarkdownText } from "./markdownText.js";
import { getRoleLabel } from "./messages.js";
import { getRoleColors, getBubbleStyle, formatTime } from "./conversationPanel.js";

/**
 * Creates a pub/sub topic manager for component-to-component communication.
 * @returns {{subscribe: Function, unsubscribe: Function, publish: Function, getSubscribers: Function}}
 */
export function createPubSub() {
	const topics = new Map();

	/**
	 * Subscribe to a topic.
	 * @param {string} topic - Topic name
	 * @param {Function} callback - Callback to invoke on publish
	 * @returns {Function} Unsubscribe function
	 */
	function subscribe(topic, callback) {
		const callbacks = topics.get(topic);
		if (callbacks) {
			if (!callbacks.includes(callback)) callbacks.push(callback);
		} else {
			topics.set(topic, [callback]);
		}

		return function unsubscribe() {
			unsubscribeFrom(topic, callback);
		};
	}

	/**
	 * Unsubscribe from a specific topic by callback.
	 * @param {string} topic - Topic name
	 * @param {Function} callback - Callback to remove
	 */
	function unsubscribeFrom(topic, callback) {
		const callbacks = topics.get(topic);
		if (callbacks) {
			const idx = callbacks.indexOf(callback);
			if (idx !== -1) callbacks.splice(idx, 1);
		}
	}

	/**
	 * Publish a message to all listeners of a topic.
	 * @param {string} topic - Topic name
	 * @param {*} data - Data to send
	 * @returns {number} Number of callbacks invoked
	 */
	function publish(topic, data) {
		const callbacks = topics.get(topic);
		if (!callbacks) return 0;

		for (const cb of callbacks) {
			cb(data);
		}
		return callbacks.length;
	}

	/**
	 * Get subscribers for a topic (test/debug).
	 * @param {string} topic - Topic name
	 * @returns {Function[]} Callback array
	 * @internal
	 */
	function getSubscribers(topic) {
		return topics.get(topic) || [];
	}

	return { subscribe, unsubscribe: unsubscribeFrom, publish, getSubscribers };
}

/**
 * Context for pub/sub messaging between MessageList and MessageBubbles.
 * Each bubble subscribes to its own topic so it can append chunks
 * directly without triggering a parent re-render.
 */
export const PubSubContext = React.createContext({ subscribe: () => {}, unsubscribe: () => {} });

/**
 * A single message bubble with its own chunks state.
 *
 * Uses pub/sub to listen for streaming updates directly from MessageList.
 * Each append to the chunks array triggers a re-render of just this bubble.
 *
 * @param {Object} props
 * @param {string} props.role - Message role: "user" | "assistant" | "system"
 * @param {string} props.content - Initial content for first render
 * @param {string} props.topic - Pub/sub topic this bubble listens on
 * @param {string} [props.time] - Timestamp string (HH:MM)
 * @param {string} props.assistantName - Name to display for assistant messages
 * @param {string} [props.reasoningContent] - Thinking/thought content
 * @param {Object} [props.activeToolCall] - {name: string} for running tool
 * @param {string} [props.toolCallDisplay] - Tool call result display text

 * @returns {React.ReactElement}
 */
export function MessageBubble({
	role,
	content,
	topic,
	time,
	assistantName,
	reasoningContent,
	activeToolCall,
	toolCallDisplay,
}) {
	const [chunks, setChunks] = useState([]);
	const { subscribe, unsubscribe } = useContext(PubSubContext);

	// Subscribe to pub/sub updates — each update appends a chunk, triggering
	// re-render of just this bubble without re-rendering the parent.
	useEffect(() => {
		if (!topic) return;

		const handleUpdate = (data) => {
			setChunks((prev) => {
				const newContent = data?.content ?? "";
				// Skip appends when content hasn't changed (avoids duplicate renders)
				if (prev.length > 0 && prev[prev.length - 1] === newContent) return prev;
				return [...prev, newContent];
			});
		};

		subscribe(topic, handleUpdate);
		return () => unsubscribe(topic, handleUpdate);
	}, [topic, subscribe, unsubscribe]);

	// Display the latest chunk (or initial content if no chunks yet)
	const text = chunks.at(-1) || content || "";

	const ts = time || formatTime(new Date());
	const colors = getRoleColors(role);
	const bubble = getBubbleStyle(role);

	const hasReasoning = role === "assistant" && reasoningContent;
	const hasActiveToolCall = role === "assistant" && activeToolCall;
	const hasToolCallDisplay = role === "assistant" && toolCallDisplay;

	const reasoningEl = hasReasoning
		? React.createElement(
				Box,
				{ flexDirection: "row", marginTop: 1, marginLeft: 2 },
				React.createElement(
					Text,
					{ dimColor: true, color: "gray" },
					`(thinking) ` +
						reasoningContent.slice(0, 200) +
						(reasoningContent.length > 200 ? "..." : ""),
				),
			)
		: null;

	const toolCallEl = hasActiveToolCall
		? React.createElement(
				Box,
				{ flexDirection: "row", marginTop: 1, marginLeft: 2 },
				React.createElement(
					Text,
					{ dimColor: true, color: "gray" },
					`- Running: ${activeToolCall.name} ...`,
				),
			)
		: null;

	const toolDisplayEl = hasToolCallDisplay
		? React.createElement(
				Box,
				{ flexDirection: "column", marginTop: 1, marginLeft: 2 },
				...toolCallDisplay
					.split("\n")
					.map((line, i) =>
						React.createElement(Text, { key: `tool-${i}`, color: "gray" }, `  ${line}`),
					),
			)
		: null;

	return React.createElement(
		Box,
		{
			key: `bubble-${role}`,
			flexDirection: "row",
			paddingY: 0,
			justifyContent: bubble.alignment,
			gap: 0,
		},
		React.createElement(
			Box,
			{
				key: `bubble-inner-${role}`,
				flexDirection: "column",
				paddingX: 1,
				borderColor: bubble.border,
				borderStyle: "round",
				maxWidth: "90%",
				gap: 0,
			},
			React.createElement(
				Box,
				{ flexDirection: "row" },
				React.createElement(Text, { color: "gray" }, `[${ts}] `),
				React.createElement(
					Text,
					{ color: colors.label, bold: true },
					`${getRoleLabel(role, assistantName)}: `,
				),
			),
			React.createElement(
				Box,
				{ flexDirection: "row" },
				React.createElement(MarkdownText, { content: text }),
			),
			reasoningEl,
			toolCallEl,
			toolDisplayEl,
		),
	);
}

export default MessageBubble;
