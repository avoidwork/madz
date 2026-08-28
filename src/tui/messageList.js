import React, { useRef, useEffect, useState, forwardRef } from "react";
import { Box, Text, useStdout } from "ink";
import { ScrollView } from "ink-scroll-view";
import { MessageBubble, PubSubContext, ScrollContext } from "./messageBubble.js";

/**
 * Pub/Sub wrapper component for MessageList children.
 * Supplies subscribe/unsubscribe/publish methods from MessageList via context.
 * @param {Object} props
 * @param {Function} props.subscribe - Subscribe to a topic
 * @param {Function} props.unsubscribe - Unsubscribe from a topic
 * @param {Function} props.publish - Publish to a topic
 * @param {Array} props.children
 * @returns {React.ReactElement}
 */
export function PubSubProvider({ subscribe, unsubscribe, publish, children }) {
	const list = React.Children.toArray(children);
	return React.createElement(
		PubSubContext.Provider,
		{ value: { subscribe, unsubscribe, publish } },
		...list,
	);
}

// Monotonic counter for generating stable message IDs.
let _messageIdCounter = 0;

/**
 * Manages an array of MessageBubble component instances.
 * Provides imperative API: addMessage, updateMessage, clear.
 * Owns ScrollView rendering with scroll management.
 * Uses pub/sub to notify individual bubbles of streaming updates
 * without requiring parent re-renders.
 *
 * @param {Object} props
 * @param {Array} [props.messages] - Initial messages array for session restore
 * @param {string} [props.assistantName] - Name to display for assistant messages
 * @param {React.Ref} [props.forwardRef] - For exposed imperative API
 * @param {React.Ref} [props.scrollRef] - Forwarded scroll ref for external keyboard nav
 * @returns {React.ReactElement}
 */
export const MessageList = React.memo(
	forwardRef(function MessageList(
		{ messages: _messages = [], assistantName = "Assistant", scrollRef: externalScrollRef },
		forwardRef,
	) {
		const internalRef = useRef(null);
		const scrollRef = externalScrollRef || internalRef;
		const idsRef = useRef([]);
		const idToIdxRef = useRef(new Map());
		const dataRef = useRef(new Map());
		const contentRef = useRef(new Map());
		const lastMsgCountRef = useRef(0);
		const [scrollOffset, setScrollOffset] = useState(0);
		const { stdout } = useStdout();

		// Pub/sub topics map — each topic key maps to an array of pending update listeners
		const topicsRef = useRef(new Map());

		// Subscribe to a specific topic
		const subscribe = (topic, callback) => {
			const callbacks = topicsRef.current.get(topic);
			if (callbacks) {
				if (!callbacks.includes(callback)) callbacks.push(callback);
			} else {
				topicsRef.current.set(topic, [callback]);
			}
		};

		// Unsubscribe from a specific topic
		const unsubscribe = (topic, callback) => {
			const callbacks = topicsRef.current.get(topic);
			if (callbacks) {
				const idx = callbacks.indexOf(callback);
				if (idx !== -1) callbacks.splice(idx, 1);
			}
		};

		// Publish a message to all listeners of a topic
		const publish = (topic, data) => {
			const callbacks = topicsRef.current.get(topic);
			if (callbacks) {
				for (const cb of callbacks) cb(data);
			}
		};

		// Trigger a re-render of the MessageList tree (needed for add/remove/clear)
		// eslint-disable-next-line no-unused-vars, no-shadow
		const [renderTick, setRenderTick] = useState(0);
		const triggerRender = () => setRenderTick((n) => n + 1);

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
			 * @param {Array<Object>} [options.events] - Raw stream events
			 * @param {boolean} [options.streaming] - Streaming flag
			 * @returns {string} The assigned message ID
			 */
			addMessage(role, content, options = {}) {
				const id = (++_messageIdCounter).toString();
				const stableContent = content || "";

				// Store content in a separate ref for reference stability —
				// the same string reference persists across updates so React.memo
				// can skip re-renders when content hasn't actually changed.
				contentRef.current.set(id, stableContent);

				dataRef.current.set(id, {
					id,
					role,
					content: stableContent,
					time: options.time,
					reasoningContent: options.reasoningContent,
					activeToolCall: options.activeToolCall,
					toolCallDisplay: options.toolCallDisplay,
					events: options.events,
					streaming: options.streaming || false,
				});

				idsRef.current.push(id);
				idToIdxRef.current.set(id, idsRef.current.length - 1);

				// Reset scroll-up suppression — new messages should auto-scroll
				isUserScrolledUpRef.current = false;

				triggerRender();

				// Imperative scroll-to-bottom — mirrors the approach used in
				// MessageBubble for streaming content. handleContentHeightChange
				// is unreliable because the children array guard can prevent
				// the ScrollView from detecting a height change.
				// Scroll for all message types to ensure the latest content is visible.
				if (role === "user" || role === "system" || role === "assistant") {
					scrollRef.current?.scrollToBottom?.();
				}

				return id;
			},

			/**
			 * Update an existing message by its ID.
			 * Uses pub/sub to notify the specific bubble without re-rendering the parent.
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

				// Update content ref for reference stability — only replace if
				// content actually changed (same string, same reference).
				if (updates.content !== undefined) {
					const stableContent = updates.content || "";
					const prevContent = contentRef.current.get(id);
					if (prevContent !== stableContent) {
						contentRef.current.set(id, stableContent);
					}
				}

				// Notify the bubble via pub/sub — this triggers re-render of just that bubble.
				// Streaming content updates do NOT trigger a parent re-render; the scroll
				// effect (onContentHeightChange) detects content growth and scrolls to bottom.
				publish(`msg-${id}`, dataRef.current.get(id));
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
				contentRef.current = new Map();
				lastMsgCountRef.current = 0;
				triggerRender();
			},

			/**
			 * Initialize the list from a messages data array.
			 * @param {Array<{role: string, content: string, time?: string, reasoningContent?: string, activeToolCall?: Object, toolCallDisplay?: string, events?: Array<Object>}>} msgs
			 */
			setMessages(msgs) {
				idsRef.current = [];
				idToIdxRef.current = new Map();
				dataRef.current = new Map();
				contentRef.current = new Map();

				for (const m of msgs) {
					const id = (++_messageIdCounter).toString();
					const stableContent = m.content || "";

					contentRef.current.set(id, stableContent);

					dataRef.current.set(id, {
						id,
						role: m.role,
						content: stableContent,
						time: m.time,
						reasoningContent: m.reasoningContent,
						activeToolCall: m.activeToolCall,
						toolCallDisplay: m.toolCallDisplay,
						events: m.events,
						streaming: m.streaming || false,
					});

					idsRef.current.push(id);
					idToIdxRef.current.set(id, idsRef.current.length - 1);
				}

				triggerRender();
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
			 * Scroll by a delta (positive = down, negative = up).
			 * @param {number} delta - Number of rows to scroll
			 */
			scrollBy(delta) {
				setScrollOffset((prev) => Math.max(0, prev + delta));
			},

			/**
			 * Scroll to the bottom of the ScrollView.
			 * Called by MessageBubble when streaming content grows.
			 */
			scrollToBottom() {
				scrollRef.current?.scrollToBottom?.();
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
					topicKeys: [...topicsRef.current.keys()],
					scrollRef: scrollRef,
				};
			},

			/**
			 * Force a re-render of the MessageList tree.
			 * Used by streaming handlers to trigger ScrollView re-measurement.
			 * @internal
			 */
			_triggerRender() {
				triggerRender();
			},

			/**
			 * Reset refs (test isolation).
			 * @internal
			 */
			_reset() {
				idsRef.current = [];
				idToIdxRef.current = new Map();
				dataRef.current = new Map();
				topicsRef.current = new Map();
				lastMsgCountRef.current = 0;
				_messageIdCounter = 0;
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

		// No-op: scroll-to-bottom is handled exclusively via onContentHeightChange.
		// Pub/sub "scroll-to-bottom" removed — dual scroll paths caused race conditions.

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
		const isUserScrolledUpRef = useRef(false);

		// Scroll-to-bottom whenever content height changes (new message added).
		// Fires on children array changes — covers user, system, and assistant messages.
		// Uses the imperative scrollToBottom() API exposed by ScrollView.
		// Respects manual scroll-up detection: only auto-scrolls when user is at bottom.
		const handleContentHeightChange = (height, previousHeight) => {
			if (!scrollRef.current || height <= previousHeight) return;
			// Respect manual scroll-up: don't jump user back to bottom if they're reading
			if (isUserScrolledUpRef.current) return;
			scrollRef.current.scrollToBottom?.();
			lastMsgCountRef.current = idsRef.current.length;
		};

		// Virtual render window — removed. All messages are now rendered
		// through the ScrollView mechanism. The data layer stores all messages
		// and the render layer renders all of them without a cap.
		const childrenRef = useRef(null);
		const prevRenderCountRef = useRef(-1);

		const currentCount = idsRef.current.length;
		if (currentCount !== prevRenderCountRef.current) {
			const renderData = idsRef.current;

			// Rebuild children only when message count changes.
			if (childrenRef.current === null || childrenRef.current._count !== renderData.length) {
				const newChildren = renderData.map((id) => {
					const data = dataRef.current.get(id);
					if (!data) return null;
					// Use stable content reference from contentRef for React.memo to work
					const stableContent = contentRef.current.get(id) || data.content;
					return React.createElement(MessageBubble, {
						key: id,
						role: data.role,
						content: stableContent,
						time: data.time,
						reasoningContent: data.reasoningContent,
						activeToolCall: data.activeToolCall,
						toolCallDisplay: data.toolCallDisplay,
						events: data.events,
						streaming: data.streaming,
						assistantName,
						topic: `msg-${id}`,
					});
				});

				if (newChildren.length === 0) {
					newChildren.push(
						React.createElement(
							Text,
							{ key: "empty", color: "gray" },
							" No messages yet. Start chatting!",
						),
					);
				}

				newChildren._count = renderData.length;
				childrenRef.current = newChildren;
			}

			prevRenderCountRef.current = currentCount;
		}

		const children = childrenRef.current;

		// Sync scroll offset back from ScrollView (e.g., keyboard nav).
		const handleScroll = (offset) => {
			setScrollOffset(offset);
			// Track when user is at bottom vs scrolled up
			if (offset === 0) {
				isUserScrolledUpRef.current = false;
			} else {
				isUserScrolledUpRef.current = true;
			}
		};

		return React.createElement(
			PubSubProvider,
			{ subscribe, unsubscribe, publish },
			React.createElement(
				ScrollContext.Provider,
				{ value: { scrollToBottom: imperativeApiRef.current?.scrollToBottom } },
				React.createElement(
					Box,
					{ key: "panel", flexDirection: "column", flexGrow: 1 },
					React.createElement(
						ScrollView,
						{
							ref: scrollRef,
							key: "scroll",
							grow: 1,
							scrollOffset,
							onContentHeightChange: handleContentHeightChange,
							onScroll: handleScroll,
						},
						...children,
					),
				),
			),
		);
	}),
);
