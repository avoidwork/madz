import React, { useRef, useEffect, useState, forwardRef, useCallback } from "react";
import { Box, Text, useStdout, useWindowSize } from "ink";
import { VirtualScrollView } from "./scrollView.js";
import { MessageBubble, PubSubContext, ScrollContext } from "./messageBubble.js";
import { stripAnsi, wrapText } from "./selectionLayout.js";
import { hasCompletedToolCalls, normalizeCompletedToolCalls } from "./messages.js";

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
 * Determine whether a message bubble should be rendered.
 * An assistant bubble is skipped only when it is not streaming, has empty
 * content, and has no non-empty `reasoning` or `message` segments. This keeps
 * interrupted assistant responses (which may hold only reasoning/partial
 * message segments with empty `content`) visible in the message list.
 * @param {Object} data - Message data
 * @param {string} content - Stable content from contentRef
 * @returns {boolean} True if the bubble should be rendered
 */
export function shouldRenderBubble(data, content) {
	if (data.role !== "assistant") return true;
	if (data.streaming) return true;
	if ((content || data.content || "").trim()) return true;
	return (data.segments || []).some(
		(s) => (s.type === "reasoning" || s.type === "message") && (s.content || "").trim(),
	);
}

/**
 * Estimate the rendered height (in rows) of a message bubble.
 *
 * This is a pure function (no React, no DOM) that approximates how many rows a
 * message occupies in the conversation panel. It is reused by both the selection
 * map (`getMessages()`) and the virtualized scroll view's height estimation so
 * the two cannot drift.
 *
 * The estimate accounts for:
 * - The header row (timestamp + role label): 1 row
 * - The wrapped lines of the joined segment/content text
 * - One row per reasoning segment
 * - One row per tool-call display line
 * - One row for the active tool-call indicator
 * - One row for the completed tool-calls summary
 *
 * @param {Object} data - Message data (with `segments`, `content`, `toolCallDisplay`, `activeToolCall`, `completedToolCalls`)
 * @param {number} width - Terminal width in columns
 * @returns {number} Estimated height in rows
 */
export function estimateMessageHeight(data, width) {
	const text = (data.segments || []).map((s) => s.content).join("") || data.content || "";
	const wrapped = wrapText(stripAnsi(text), width);
	let height = 1 + wrapped.length;

	// Each reasoning segment renders as its own row.
	if (data.segments) {
		for (const seg of data.segments) {
			if (seg.type === "reasoning") height += 1;
		}
	}

	// Tool-call display renders one row per line.
	if (data.toolCallDisplay) {
		height += data.toolCallDisplay.split("\n").length;
	}

	// Active tool-call indicator.
	if (data.activeToolCall) height += 1;

	// Completed tool-calls summary.
	if (hasCompletedToolCalls(data.completedToolCalls)) height += 1;

	return height;
}

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
 * @param {boolean} [props.showToolResults=false] - Whether to display tool call result lines
 * @param {{start: number, end: number}} [props.selection] - Global character range to highlight
 * @param {React.Ref} [props.forwardRef] - For exposed imperative API
 * @param {React.Ref} [props.scrollRef] - Forwarded scroll ref for external keyboard nav
 * @returns {React.ReactElement}
 */
export const MessageList = React.memo(
	forwardRef(function MessageList(
		{
			messages: _messages = [],
			assistantName = "Assistant",
			showToolResults = false,
			overscan = 10,
			scrollRef: externalScrollRef,
			selection,
		},
		forwardRef,
	) {
		const internalRef = useRef(null);
		const scrollRef = externalScrollRef || internalRef;
		const idsRef = useRef([]);
		const idToIdxRef = useRef(new Map());
		const dataRef = useRef(new Map());
		const contentRef = useRef(new Map());
		const lastMsgCountRef = useRef(0);
		const { stdout } = useStdout();
		const { rows } = useWindowSize();

		// The ScrollView needs a bounded height for reliable viewport measurement.
		// The docs example gives it an explicit height. Here we derive it from the
		// terminal height minus the input panel and status bar (2 rows). Without a
		// bounded height, flexGrow makes the viewport measure the full terminal,
		// so scrollToBottom() computes an oversized viewport and content scrolls
		// offscreen behind the input panel / status bar.
		const scrollViewportHeight = Math.max(1, rows - 2);

		// Pub/sub topics map — each topic key maps to an array of pending update listeners
		const topicsRef = useRef(new Map());

		// Subscribe to a specific topic. Wrapped in useCallback with empty deps so
		// the identity is stable across renders. The bubble's pub/sub effect depends
		// on `subscribe`/`unsubscribe`; if they change identity on every render, the
		// effect tears down and rebuilds on every streaming chunk, which would
		// dispose the segment throttle before it can commit.
		const subscribe = useCallback((topic, callback) => {
			const callbacks = topicsRef.current.get(topic);
			if (callbacks) {
				if (!callbacks.includes(callback)) callbacks.push(callback);
			} else {
				topicsRef.current.set(topic, [callback]);
			}
		}, []);

		// Unsubscribe from a specific topic. Stable identity (see subscribe).
		const unsubscribe = useCallback((topic, callback) => {
			const callbacks = topicsRef.current.get(topic);
			if (callbacks) {
				const idx = callbacks.indexOf(callback);
				if (idx !== -1) callbacks.splice(idx, 1);
			}
		}, []);

		// Publish a message to all listeners of a topic. Stable identity.
		const publish = useCallback((topic, data) => {
			const callbacks = topicsRef.current.get(topic);
			if (callbacks) {
				for (const cb of callbacks) cb(data);
			}
		}, []);

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
			 * @param {Array<{type: string, content: string}>} [options.segments] - Ordered content segments
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
					segments: options.segments,
					activeToolCall: options.activeToolCall,
					toolCallDisplay: options.toolCallDisplay,
					events: options.events,
					streaming: options.streaming || false,
					turnStartTime: options.turnStartTime,
					turnDuration: options.turnDuration,
					completedToolCalls: options.completedToolCalls,
				});

				idsRef.current.push(id);
				idToIdxRef.current.set(id, idsRef.current.length - 1);

				// Reset scroll-up suppression — new messages should auto-scroll
				isUserScrolledUpRef.current = false;

				triggerRender();

				// Imperative scroll-to-bottom DISABLED — relying on
				// onContentHeightChange to drive auto-scroll instead.
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
					// Handle segment append/coalesce: if updates contains a new segment,
					// coalesce with the last segment if same type, otherwise push.
					if (updates.segments && existing.segments) {
						const newSeg = updates.segments[updates.segments.length - 1];
						const mergedSegments = existing.segments.map((s) => ({ ...s }));
						if (newSeg.type === "reasoning") {
							// Reasoning coalesces with the last reasoning segment even if
							// a message interleaved between chunks — otherwise continuous
							// reasoning gets split into separate reasoning blocks. Search backwards
							// for the last reasoning segment.
							let lastReasoning = null;
							for (let i = mergedSegments.length - 1; i >= 0; i--) {
								if (mergedSegments[i].type === "reasoning") {
									lastReasoning = mergedSegments[i];
									break;
								}
							}
							// Grammatical sentence boundary: a period followed by a
							// capital letter starts a new block; otherwise coalesce.
							if (
								lastReasoning &&
								(lastReasoning.content.endsWith(".") ||
									lastReasoning.content.endsWith("?") ||
									lastReasoning.content.endsWith("!")) &&
								/^[A-Z]/.test(newSeg.content)
							) {
								mergedSegments.push({ ...newSeg });
							} else if (lastReasoning) {
								lastReasoning.content += newSeg.content;
							} else {
								mergedSegments.push({ ...newSeg });
							}
						} else {
							// Message segments require a type match to append; a mismatch
							// (e.g., message after reasoning) forces a new block.
							const lastSeg = mergedSegments[mergedSegments.length - 1];
							if (lastSeg && lastSeg.type === newSeg.type) {
								lastSeg.content += newSeg.content;
							} else {
								mergedSegments.push({ ...newSeg });
							}
						}
						dataRef.current.set(id, { ...existing, ...updates, segments: mergedSegments });
					} else {
						dataRef.current.set(id, { ...existing, ...updates });
					}
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
			 * @param {Array<{role: string, content: string, time?: string, segments?: Array<{type: string, content: string}>, activeToolCall?: Object, toolCallDisplay?: string, events?: Array<Object>}>} msgs
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
						segments: m.segments,
						activeToolCall: m.activeToolCall,
						toolCallDisplay: m.toolCallDisplay,
						events: m.events,
						streaming: m.streaming || false,
						turnStartTime: m.turnStartTime,
						turnDuration: m.turnDuration,
						completedToolCalls: normalizeCompletedToolCalls(m.completedToolCalls),
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
			 * Get the rendered message layout for selection mapping.
			 * Returns an array of `{ text, top }` where `text` is the message's
			 * plain content (ANSI stripped) and `top` is the content row of its
			 * first text line. The `top` is computed by accumulating the wrapped
			 * line count of each preceding message plus a header row per bubble.
			 * @returns {Array<{text: string, top: number}>}
			 */
			getMessages() {
				const width = Math.max(1, typeof window !== "undefined" ? window.innerWidth : 80);
				const result = [];
				let top = 0;
				for (const id of idsRef.current) {
					const data = dataRef.current.get(id);
					if (!data) continue;
					const text = (data.segments || []).map((s) => s.content).join("") || data.content || "";
					result.push({ text, top });
					top += estimateMessageHeight(data, width);
				}
				return result;
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
				scrollRef.current?.scrollBy?.(delta);
			},

			/**
			 * Scroll to the bottom of the ScrollView.
			 * Called by MessageBubble when streaming content grows.
			 */
			scrollToBottom() {
				scrollRef.current?.scrollToBottom?.();
			},

			/**
			 * Force the ScrollView to re-measure a specific item by its render index.
			 * Used when a bubble grows via pub/sub (no parent re-render) so the
			 * ScrollView's contentHeight updates and onContentHeightChange fires.
			 * @param {number} index - Render index of the item to re-measure
			 */
			remeasureItem(index) {
				scrollRef.current?.remeasureItem?.(index);
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
		const handleContentHeightChange = useCallback(
			(height, previousHeight) => {
				if (!scrollRef.current || height <= previousHeight) return;
				// Respect manual scroll-up: don't jump user back to bottom if they're reading
				if (isUserScrolledUpRef.current) return;
				scrollRef.current.scrollToBottom?.();
				lastMsgCountRef.current = idsRef.current.length;
			},
			[scrollRef, isUserScrolledUpRef, idsRef],
		);

		// Track manual scroll position via the ScrollView's onScroll callback.
		// When the user scrolls away from the bottom (mouse or keyboard), suppress
		// auto-scroll; when they return to the bottom, resume it.
		const handleScroll = useCallback(
			(offset) => {
				const bottom = scrollRef.current?.getBottomOffset?.() || 0;
				isUserScrolledUpRef.current = offset < bottom;
			},
			[scrollRef, isUserScrolledUpRef],
		);

		// Virtualized render window. The data layer stores all messages; the
		// render layer mounts only the visible window plus an overscan buffer via
		// VirtualScrollView, instead of rendering every message bubble.
		const renderDataRef = useRef([]);
		const textOffsetsRef = useRef([]);
		const prevRenderCountRef = useRef(-1);
		const prevSelectionRef = useRef(null);

		const currentCount = idsRef.current.length;
		const selectionChanged = JSON.stringify(selection) !== JSON.stringify(prevSelectionRef.current);
		if (currentCount !== prevRenderCountRef.current || selectionChanged) {
			prevSelectionRef.current = selection;

			// Build the render data (all messages) and the cumulative text offsets
			// used to map the global selection range to each bubble's local range.
			const renderData = [];
			const textOffsets = [];
			let textOffset = 0;
			for (const id of idsRef.current) {
				const data = dataRef.current.get(id);
				if (!data) continue;
				// Skip rendering empty assistant bubbles that aren't streaming.
				// Keep bubbles that carry non-empty reasoning/message segments so
				// interrupted assistant responses persist in the message list.
				if (!shouldRenderBubble(data, contentRef.current.get(id))) {
					continue;
				}
				const stableContent = contentRef.current.get(id) || data.content;
				const bubbleText =
					(data.segments || []).map((s) => s.content).join("") || stableContent || "";
				textOffsets.push(textOffset);
				textOffset += bubbleText.length;
				renderData.push({ id, data, stableContent });
			}

			renderDataRef.current = renderData;
			textOffsetsRef.current = textOffsets;
			prevRenderCountRef.current = currentCount;
		}

		const renderData = renderDataRef.current;
		const textOffsets = textOffsetsRef.current;

		// Render a single message bubble for a given item and global index.
		const renderItem = useCallback(
			(item, renderIndex) => {
				const { id, data, stableContent } = item;
				const bubbleText =
					(data.segments || []).map((s) => s.content).join("") || stableContent || "";
				let localSelection = null;
				if (selection) {
					const bubbleStart = textOffsets[renderIndex] || 0;
					const bubbleEnd = bubbleStart + bubbleText.length;
					const selStart = Math.max(selection.start, bubbleStart);
					const selEnd = Math.min(selection.end, bubbleEnd);
					if (selEnd > selStart) {
						localSelection = {
							start: selStart - bubbleStart,
							end: selEnd - bubbleStart,
						};
					}
				}
				return React.createElement(MessageBubble, {
					key: id,
					role: data.role,
					content: stableContent,
					time: data.time,
					segments: data.segments,
					activeToolCall: data.activeToolCall,
					toolCallDisplay: data.toolCallDisplay,
					events: data.events,
					streaming: data.streaming,
					assistantName,
					topic: `msg-${id}`,
					turnStartTime: data.turnStartTime,
					turnDuration: data.turnDuration,
					completedToolCalls: data.completedToolCalls,
					showToolResults,
					renderIndex,
					onRemeasure: (index) => scrollRef.current?.remeasureItem?.(index),
					selection: localSelection,
				});
			},
			[selection, textOffsets, assistantName, showToolResults, scrollRef],
		);

		const width = Math.max(1, typeof window !== "undefined" ? window.innerWidth : 80);

		return React.createElement(
			PubSubProvider,
			{ subscribe, unsubscribe, publish },
			React.createElement(
				ScrollContext.Provider,
				{
					value: React.useMemo(
						() => ({ scrollToBottom: imperativeApiRef.current?.scrollToBottom }),
						[],
					),
				},
				React.createElement(
					Box,
					{ key: "panel", flexDirection: "column" },
					renderData.length === 0
						? React.createElement(
								Text,
								{ key: "empty", color: "gray" },
								" No messages yet. Start chatting!",
							)
						: React.createElement(VirtualScrollView, {
								ref: scrollRef,
								key: "scroll",
								items: renderData,
								height: scrollViewportHeight,
								overscan,
								estimateHeight: (item) => estimateMessageHeight(item.data, width),
								renderItem,
								onContentHeightChange: handleContentHeightChange,
								onScroll: handleScroll,
							}),
				),
			),
		);
	}),
);
