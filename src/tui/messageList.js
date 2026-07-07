/**
 * MessageList component — manages an array of MessageBubble component instances.
 * Provides imperative methods (addMessage, updateMessage, clear) and handles
 * scroll-to-bottom internally via its own ref.
 *
 * @module messageList
 */

import React, { useState, useRef, useEffect, useCallback } from "react";
import { Box } from "ink";
import { ScrollView } from "ink-scroll-view";
import MessageBubble from "./messageBubble.js";

/**
 * Maximum number of messages to render in the React tree.
 * Limits rendering to the last N messages to prevent performance
 * degradation with very long conversations.
 * @constant {number}
 */
const MAX_RENDER_MESSAGES = 100;

/**
 * Scroll throttle interval in milliseconds during active streaming.
 * Reduces scroll-to-bottom frequency by ~90% while maintaining smooth UX.
 * @constant {number}
 */
const SCROLL_THROTTLE_MS = 100;

/**
 * MessageList component — manages MessageBubble instances and handles scrolling.
 *
 * @param {Object} props
 * @param {React.Ref} [props.scrollRef] - Optional external scroll ref passed from parent
 */
export function MessageList({ scrollRef: externalScrollRef }) {
	const [bubbles, setBubbles] = useState([]);
	const internalScrollRef = useRef(null);
	const scrollRef = externalScrollRef || internalScrollRef;
	const previousMessageCount = useRef(0);
	const previousContentHashRef = useRef(0);
	const lastScrollTimeRef = useRef(0);
	const isUserScrollingRef = useRef(false);
	const bubbleRefs = useRef({});
	const { stdout } = React.useContext(React.createContext({}));

	// We need access to stdout for resize handling — get it from the Ink context
	// Since we can't directly import useStdout here without breaking the module,
	// we'll handle resize via a different approach
	useEffect(() => {
		// Handle terminal resize by remeasuring content heights
		const resizeHandler = () => {
			if (scrollRef.current && stdout?.isTTY && !process.env.CI) {
				scrollRef.current.remeasure();
			}
		};

		// Listen for resize events on the process
		process.on("resize", resizeHandler);
		return () => {
			process.off("resize", resizeHandler);
		};
	}, [stdout, scrollRef]);

	/**
	 * Add a new message bubble to the list.
	 * @param {string} role - Message role: "user", "assistant", or "system"
	 * @param {string} content - Initial message content
	 * @param {Object} [options] - Additional options
	 * @param {string} [options.assistantName] - Name to display for assistant
	 * @param {string} [options.time] - Timestamp string
	 * @returns {string} The ID of the newly created bubble
	 */
	const addMessage = useCallback((role, content, options = {}) => {
		const id = "bubble-" + Date.now() + "-" + Math.random().toString(36).substr(2, 9);
		const newBubble = {
			id,
			role,
			content: content || "",
			assistantName: options.assistantName || "Assistant",
			time: options.time || new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
		};

		setBubbles((prev) => [...prev, newBubble]);
		return id;
	}, []);

	/**
	 * Update an existing message bubble by ID.
	 * @param {string} id - The bubble ID to update
	 * @param {Object} updates - State updates to apply
	 * @param {string} [updates.content] - New content text
	 * @param {boolean} [updates.streaming] - Streaming state
	 * @param {string} [updates.toolCallDisplay] - Tool call display text
	 * @param {string} [updates.reasoningContent] - Reasoning/thinking content
	 * @param {Object} [updates.activeToolCall] - Active tool call {name: string}
	 */
	const updateMessage = useCallback((id, updates) => {
		const bubbleRef = bubbleRefs.current[id];
		if (bubbleRef && bubbleRef.update) {
			bubbleRef.update(updates);
		}

		// Also update the bubble data in state for rendering consistency
		setBubbles((prev) =>
			prev.map((bubble) => {
				if (bubble.id === id) {
					return { ...bubble, ...updates };
				}
				return bubble;
			}),
		);
	}, []);

	/**
	 * Clear all message bubbles from the list.
	 */
	const clear = useCallback(() => {
		setBubbles([]);
		bubbleRefs.current = {};
	}, []);

	// Expose imperative methods via ref
	const listRef = useRef(null);
	useEffect(() => {
		if (listRef.current) {
			listRef.current.addMessage = addMessage;
			listRef.current.updateMessage = updateMessage;
			listRef.current.clear = clear;
		}
	}, [addMessage, updateMessage, clear]);

	// Detect manual scroll-up: when user scrolls away from bottom,
	// suppress auto-scroll until they return to bottom or streaming completes.
	useEffect(() => {
		if (!scrollRef.current) return;

		const checkScrollPosition = () => {
			if (!scrollRef.current) return;
			const maxScroll = scrollRef.current.getMaxScrollOffset?.() || 0;
			const currentScroll = scrollRef.current.getScrollOffset?.() || 0;
			const atBottom = maxScroll - currentScroll < 2; // 2 char tolerance

			if (!atBottom) {
				isUserScrollingRef.current = true;
			} else {
				isUserScrollingRef.current = false;
			}
		};

		checkScrollPosition();
	}, [bubbles, scrollRef]);

	// Auto-scroll to bottom on new content
	useEffect(() => {
		if (!scrollRef.current) return;

		const lastBubble = bubbles[bubbles.length - 1];
		const isStreaming = lastBubble?.streaming === true;
		const streamingContentLen = isStreaming ? (lastBubble?.content || "").length : 0;
		const contentHash = bubbles.length + streamingContentLen;

		const wasScrolling =
			bubbles.length > previousMessageCount.current ||
			(isStreaming && contentHash !== previousContentHashRef.current);

		if (!wasScrolling) return;

		// If user manually scrolled up, suppress auto-scroll
		if (isUserScrollingRef.current && !isStreaming) return;

		const now = Date.now();
		const timeSinceLastScroll = now - lastScrollTimeRef.current;

		// Throttle scroll-to-bottom during active streaming (100ms interval)
		if (isStreaming && timeSinceLastScroll < SCROLL_THROTTLE_MS) {
			previousContentHashRef.current = contentHash;
			return;
		}

		const scrollHandle = () => {
			if (scrollRef.current) {
				scrollRef.current.scrollToBottom();
				previousMessageCount.current = bubbles.length;
				lastScrollTimeRef.current = Date.now();
			}
		};
		previousContentHashRef.current = contentHash;
		const timer = setTimeout(scrollHandle, 0);
		return () => clearTimeout(timer);
	}, [bubbles]);

	// Windowing: only render the last MAX_RENDER_MESSAGES bubbles
	const startIdx = Math.max(0, bubbles.length - MAX_RENDER_MESSAGES);
	const visibleBubbles = bubbles.slice(startIdx);

	return React.createElement(
		Box,
		{ key: "message-list", flexDirection: "column", flexGrow: 1 },
		React.createElement(
			ScrollView,
			{ ref: scrollRef, key: "scroll", focus: false },
			visibleBubbles.map((bubble) =>
				React.createElement(MessageBubble, {
					key: bubble.id,
					ref: (el) => {
						if (el) bubbleRefs.current[bubble.id] = el;
					},
					role: bubble.role,
					content: bubble.content,
					assistantName: bubble.assistantName,
					time: bubble.time,
				}),
			),
		),
	);
}

// Attach imperative methods to the component for ref access
MessageList.prototype.addMessage = function (role, content, options) {
	if (this.current) {
		return this.current.addMessage(role, content, options);
	}
};

MessageList.prototype.updateMessage = function (id, updates) {
	if (this.current) {
		this.current.updateMessage(id, updates);
	}
};

MessageList.prototype.clear = function () {
	if (this.current) {
		this.current.clear();
	}
};

export default MessageList;