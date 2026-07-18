import React, { useRef, useEffect, forwardRef } from "react";
import { Box, Text, useStdout } from "ink";
import { ScrollView } from "ink-scroll-view";
import { MessageBubble } from "./messageBubble.js";

/**
 * Scroll throttle interval in ms during active streaming.
 */
const SCROLL_THROTTLE_MS = 100;

/**
 * Maximum number of messages to render in the React tree.
 */
const MAX_RENDER_MESSAGES = 100;

// Monotonic counter for generating stable message IDs.
let _messageIdCounter = 0;

/**
 * Manages an array of MessageBubble component instances.
 * Provides imperative API: addMessage, updateMessage, clear.
 * Owns ScrollView rendering with scroll management.
 * @param {Object} props
 * @param {Array} [props.messages] - Initial messages array for session restore
 * @param {string} [props.assistantName] - Name to display for assistant messages
 * @param {React.Ref} [props.forwardRef] - For exposed imperative API
 * @param {React.Ref} [props.scrollRef] - Forwarded scroll ref for external keyboard nav
 * @returns {React.ReactElement}
 */
export const MessageList = forwardRef(function MessageList(
	{ messages: _messages = [], assistantName = "Assistant", scrollRef: externalScrollRef },
	forwardRef,
) {
	const internalRef = useRef(null);
	const scrollRef = externalScrollRef || internalRef;
	const idsRef = useRef([]);
	const idToIdxRef = useRef(new Map());
	const dataRef = useRef(new Map());
	const lastMsgCountRef = useRef(0);
	const lastContentLenRef = useRef(0);
	const lastScrollTimeRef = useRef(0);
	const isUserScrollingRef = useRef(false);
	const forceRenderKeyRef = useRef(0);
	const { stdout } = useStdout();

	// --- Imperative API: exposed via ref ---
	const imperativeApiRef = useRef(null);
	imperativeApiRef.current = {
		/**
		 * Add a new message to the list.
		 * @param {string} role - "user" | "assistant" | "system"
		 * @param {string} content - Message content
		 * @param {Object} [options] - Additional properties
		 * @param {string} [options.time] - Timestamp
		 * @param {string} [options.reasoningContent] - Thinking content
		 * @param {Object} [options.activeToolCall] - {name: string}
		 * @param {string} [options.toolCallDisplay] - Tool call display text
		 * @param {boolean} [options.streaming] - Streaming flag
		 * @returns {string} The assigned message ID
		 */
		addMessage(role, content, options = {}) {
			const id = (++_messageIdCounter).toString();
			dataRef.current.set(id, {
				id,
				role,
				content: content || "",
				time: options.time,
				reasoningContent: options.reasoningContent,
				activeToolCall: options.activeToolCall,
				toolCallDisplay: options.toolCallDisplay,
				streaming: options.streaming || false,
			});
			idsRef.current.push(id);
			idToIdxRef.current.set(id, idsRef.current.length - 1);
			forceRenderKeyRef.current += 1;
			return id;
		},

		/**
		 * Update an existing message by its ID.
		 * @param {string} id - Message ID
		 * @param {Object} updates - Partial state updates to merge
		 */
		updateMessage(id, updates) {
			const idx = idToIdxRef.current.get(id);
			if (idx === undefined) return;

			const existing = dataRef.current.get(id);
			if (existing) {
				dataRef.current.set(id, { ...existing, ...updates });
			}

			idsRef.current[idx] = id;
			forceRenderKeyRef.current += 1;
		},

		/**
		 * Get data for a message by ID.
		 * @param {string} id - Message ID
		 * @returns {Object|null}
		 */
		getMessageData(id) {
			return dataRef.current.get(id) || null;
		},

		/**
		 * Clear all messages.
		 */
		clear() {
			idsRef.current = [];
			idToIdxRef.current = new Map();
			dataRef.current = new Map();
			lastMsgCountRef.current = 0;
			forceRenderKeyRef.current += 1;
		},

		/**
		 * Initialize the list from a messages data array.
		 * @param {Array<{role: string, content: string, time?: string, reasoningContent?: string, activeToolCall?: Object, toolCallDisplay?: string}>} msgs
		 */
		setMessages(msgs) {
			idsRef.current = [];
			idToIdxRef.current = new Map();
			dataRef.current = new Map();
			for (const m of msgs) {
				const id = (++_messageIdCounter).toString();
				dataRef.current.set(id, {
					id,
					role: m.role,
					content: m.content || "",
					time: m.time,
					reasoningContent: m.reasoningContent,
					activeToolCall: m.activeToolCall,
					toolCallDisplay: m.toolCallDisplay,
					streaming: m.streaming || false,
				});
				idsRef.current.push(id);
				idToIdxRef.current.set(id, idsRef.current.length - 1);
			}
			forceRenderKeyRef.current += 1;
		},

		/**
		 * Get current message count (data count).
		 * @returns {number}
		 */
		getMessageCount() {
			return idsRef.current.length;
		},

		/**
		 * Get the ref handle for the ScrollView.
		 * @returns {React.Ref}
		 */
		getScrollRef() {
			return scrollRef;
		},

		/**
		 * Get internal state (test/debug).
		 * @returns {Object}
		 * @internal
		 */
		_getState() {
			return {
				ids: idsRef.current,
				idToIdx: idToIdxRef.current,
				data: dataRef.current,
				forceRenderKey: forceRenderKeyRef.current,
				scrollRef: scrollRef,
			};
		},

		/**
		 * Reset refs (test isolation).
		 * @internal
		 */
		_reset() {
			idsRef.current = [];
			idToIdxRef.current = new Map();
			dataRef.current = new Map();
			lastMsgCountRef.current = 0;
			forceRenderKeyRef.current = 0;
		},
	};

	// Forward the imperative API through the ref
	useEffect(() => {
		if (forwardRef) {
			forwardRef.current = imperativeApiRef.current;
		}
		return () => {
			if (forwardRef) {
				forwardRef.current = null;
			}
		};
	}, [forwardRef]);

	// Handle terminal resize by remeasuring content heights.
	useEffect(() => {
		const resizeHandler = () => {
			if (scrollRef.current && stdout.isTTY && !process.env.CI) {
				scrollRef.current.remeasure();
			}
		};
		stdout.on("resize", resizeHandler);
		return () => {
			stdout.off("resize", resizeHandler);
		};
	}, [stdout, scrollRef]);

	// Detect manual scroll-up: when user scrolls away from bottom,
	// suppress auto-scroll until they return to bottom or streaming completes.
	useEffect(() => {
		if (!scrollRef.current) return;

		const checkScrollPosition = () => {
			if (!scrollRef.current) return;
			const maxScroll = scrollRef.current.getMaxScrollOffset?.() || 0;
			const currentScroll = scrollRef.current.getScrollOffset?.() || 0;
			const atBottom = maxScroll - currentScroll < 2;

			if (!atBottom) {
				isUserScrollingRef.current = true;
			} else {
				isUserScrollingRef.current = false;
			}
		};

		checkScrollPosition();
	}, [lastMsgCountRef.current, scrollRef]);

	// Scroll-to-bottom with throttle during active streaming.
	useEffect(() => {
		if (!scrollRef.current) return;

		if (lastScrollTimeRef.current === undefined) {
			lastScrollTimeRef.current = Date.now();
		}

		const lastId = idsRef.current[idsRef.current.length - 1];
		const lastData = lastId ? dataRef.current.get(lastId) : null;
		const isStreaming = lastData?.streaming ?? false;
		const contentLen = lastData?.content?.length || 0;
		const contentHash = idsRef.current.length + contentLen;

		const wasScrolling =
			idsRef.current.length > lastMsgCountRef.current || contentHash !== lastContentLenRef.current;

		if (!wasScrolling) return;

		if (isUserScrollingRef.current && !isStreaming) return;

		const now = Date.now();
		const timeSinceLastScroll = now - lastScrollTimeRef.current;

		if (isStreaming && timeSinceLastScroll < SCROLL_THROTTLE_MS) {
			lastContentLenRef.current = contentHash;
			return;
		}

		scrollRef.current.remeasure();

		const scrollHandle = () => {
			if (scrollRef.current && idsRef.current.length) {
				forceRenderKeyRef.current = Date.now();
				scrollRef.current.scrollToBottom();
				lastMsgCountRef.current = idsRef.current.length;
				lastScrollTimeRef.current = Date.now();
			}
		};
		lastContentLenRef.current = contentHash;
		const timer = setTimeout(scrollHandle, 0);
		return () => clearTimeout(timer);
	}, [scrollRef]);

	// Render the last MAX_RENDER_MESSAGES as MessageBubble elements.
	const renderData = idsRef.current.slice(-MAX_RENDER_MESSAGES);

	const children = renderData.map((id) => {
		const data = dataRef.current.get(id);
		if (!data) return null;
		return React.createElement(MessageBubble, {
			key: `${id}-${forceRenderKeyRef.current}`,
			role: data.role,
			content: data.content,
			time: data.time,
			reasoningContent: data.reasoningContent,
			activeToolCall: data.activeToolCall,
			toolCallDisplay: data.toolCallDisplay,
			streaming: data.streaming,
			assistantName,
		});
	});

	if (children.length === 0) {
		children.push(
			React.createElement(
				Text,
				{ key: "empty", color: "gray" },
				" No messages yet. Start chatting!",
			),
		);
	}

	return React.createElement(
		Box,
		{ key: "panel", flexDirection: "column", flexGrow: 1 },
		React.createElement(ScrollView, { ref: scrollRef, key: "scroll", focus: false }, ...children),
	);
});
