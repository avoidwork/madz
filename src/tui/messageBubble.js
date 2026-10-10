import React, { useState, useEffect, useContext, useRef } from "react";
import { Box, Text, useInput } from "ink";
import Spinner from "ink-spinner";
import { MarkdownText } from "./markdownText.js";
import { getRoleLabel, formatCompletedToolCalls, hasCompletedToolCalls } from "./messages.js";
import { getRoleColors, getBubbleStyle, formatTime } from "./conversationPanel.js";

/**
 * Curated list of action-oriented words for the assistant thinking state.
 * A random word is selected on each render to provide visual variety.
 * @type {string[]}
 */
export const THINKING_WORDS = [
	"Brewing",
	"Weaving",
	"Distilling",
	"Assembling",
	"Curating",
	"Simmering",
	"Unspooling",
	"Crafting",
	"Kindling",
	"Polishing",
	"Orchestrating",
	"Converging",
	"Illuminating",
	"Tuning",
	"Sculpting",
	"Harmonizing",
	"Coalescing",
	"Stirring",
	"Unfolding",
	"Refining",
	"Pondering",
	"Forging",
	"Aligning",
	"Resonating",
	"Awakening",
];

/**
 * Returns a random word from the THINKING_WORDS array.
 * @returns {string} A random word from the list
 */
export function getRandomThinkingWord() {
	return THINKING_WORDS[Math.floor(Math.random() * THINKING_WORDS.length)];
}

/**
 * Creates a pub/sub topic manager for component-to-component communication.
 *
 * **Test Pattern**: Create an instance to wire up bubbles independently
 * of React, publish to a topic `msg-{id}` and read back the data that
 * bubbles would receive during streaming.
 *
 * ```js
 * import { createPubSub } from "./messageBubble.js";
 *
 * const { subscribe, publish, unsubscribe } = createPubSub();
 * let receivedChunks = [];
 * const stop = subscribe("msg-5", (data) => {
 *   receivedChunks.push(data?.content ?? "");
 * });
 * publish("msg-5", { content: "Hello world" });
 * // receivedChunks is now ["Hello world"]
 * stop(); // removes subscription
 * ```
 *
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
 * Context for scroll imperative — allows MessageBubble to trigger
 * ScrollView auto-scroll without parent re-render.
 */
export const ScrollContext = React.createContext({ scrollToBottom: () => {} });

/**
 * Creates a throttled segment committer for streaming message updates.
 *
 * During streaming, each published chunk carries the full merged segments
 * array (the accumulated content so far). Committing it to React state
 * re-renders the bubble and re-parses the entire markdown, which is expensive
 * for long messages. This throttle accumulates the incoming segments and
 * commits on a cadence (`throttleMs`), so the bubble re-renders at most once
 * per cadence instead of once per chunk. The cadence targets 30fps (33ms) so
 * renders stay smooth without backing up. When the stream ends
 * (`streaming === false`) or `flush()` is called, the buffered segments are
 * committed immediately so the final content renders.
 *
 * No content is discarded: each `push` carries the full accumulated snapshot,
 * so the buffer always holds the complete content and the commit renders it
 * all.
 *
 * @param {Function} commit - Called with the accumulated segments array to commit
 * @param {number} [throttleMs=33] - Minimum interval between commits in ms (30fps)
 * @returns {{push: Function, flush: Function, dispose: Function}}
 *   `push(segments, streaming)` buffers segments and schedules/commits;
 *   `flush()` commits any buffered segments immediately; `dispose()` clears
 *   any pending timer and buffered data.
 */
export function createSegmentThrottle(commit, throttleMs = 33) {
	let pending = null;
	let timer = null;

	const commitPending = () => {
		if (pending) {
			commit(pending);
			pending = null;
		}
	};

	return {
		push(segments, streaming) {
			// Accumulate the incoming segments. Each push carries the full merged
			// snapshot, so this holds the complete content — nothing is dropped.
			pending = segments;
			if (streaming === true) {
				// Throttle: schedule a commit if one isn't already pending.
				if (!timer) {
					timer = setTimeout(() => {
						timer = null;
						commitPending();
					}, throttleMs);
				}
			} else {
				// Stream ended (or non-streaming update): commit immediately.
				if (timer) {
					clearTimeout(timer);
					timer = null;
				}
				commitPending();
			}
		},
		flush() {
			if (timer) {
				clearTimeout(timer);
				timer = null;
			}
			commitPending();
		},
		dispose() {
			if (timer) {
				clearTimeout(timer);
				timer = null;
			}
			pending = null;
		},
	};
}

/**
 * A single message bubble with its own segments state.
 *
 * Uses pub/sub to listen for streaming updates directly from MessageList.
 * Each update to segments triggers a re-render of just this bubble.
 *
 * @param {Object} props
 * @param {string} props.role - Message role: "user" | "assistant" | "system"
 * @param {string} props.content - Initial content for first render
 * @param {string} props.topic - Pub/sub topic this bubble listens on
 * @param {string} [props.time] - Localized time string (e.g., "10:39 AM" for en-US, "22:39" for de-DE)
 * @param {string} props.assistantName - Name to display for assistant messages
 * @param {Array<{type: string, content: string}>} [props.segments] - Ordered content segments
 * @param {Object} [props.activeToolCall] - {name: string} for running tool
 * @param {string} [props.toolCallDisplay] - Tool call result display text
 * @param {number} [props.turnStartTime] - Timestamp when the turn started (for live timer)
 * @param {number} [props.turnDuration] - Final elapsed time in ms when streaming ended
 * @param {string[]} [props.completedToolCalls] - List of completed tool call names
 * @param {boolean} [props.showToolResults=false] - Whether to display tool call result lines
 * @param {{start: number, end: number}} [props.selection] - Local character range to highlight (in the bubble's joined text)
 * @returns {React.ReactElement}
 */
export function MessageBubbleInner({
	role,
	content,
	topic,
	time,
	assistantName,
	segments: initialSegments,
	activeToolCall,
	toolCallDisplay,
	streaming,
	turnStartTime,
	turnDuration,
	completedToolCalls,
	showToolResults = false,
	renderIndex,
	onRemeasure,
	selection,
}) {
	const [segments, setSegments] = useState(initialSegments || []);
	const { subscribe, unsubscribe } = useContext(PubSubContext);
	const { scrollToBottom } = useContext(ScrollContext);

	// Subscribe to pub/sub updates — each update appends/coalesces a segment,
	// triggering re-render of just this bubble without re-rendering the parent.
	// Also picks up streaming/turnDuration changes so the timer stops
	// without needing a parent re-render.
	const [localStreaming, setLocalStreaming] = useState(streaming);
	const [localTurnDuration, setLocalTurnDuration] = useState(turnDuration);
	const [localCompletedToolCalls, setLocalCompletedToolCalls] = useState(completedToolCalls || []);
	const [localToolCallDisplay, setLocalToolCallDisplay] = useState(toolCallDisplay);
	const [localActiveToolCall, setLocalActiveToolCall] = useState(activeToolCall);
	const [localContent, setLocalContent] = useState(content);

	// Collapse state for reasoning and tool-call blocks. Each is a boolean
	// toggle; defaults to expanded for reasoning (so thinking stays visible
	// during streaming) and collapsed for tool-call results (so long outputs
	// don't flood the stream).
	const [reasoningCollapsed, setReasoningCollapsed] = useState(false);
	const [toolCallCollapsed, setToolCallCollapsed] = useState(true);

	// Sync local state from props when not using pub/sub (session restore, initial render)
	useEffect(() => {
		if (!topic) {
			setLocalStreaming(streaming);
			setLocalTurnDuration(turnDuration);
			setLocalCompletedToolCalls(completedToolCalls || []);
			setLocalToolCallDisplay(toolCallDisplay);
			setLocalActiveToolCall(activeToolCall);
		}
	}, [topic, streaming, turnDuration, completedToolCalls, toolCallDisplay, activeToolCall]);

	useEffect(() => {
		if (!topic) return;

		// Throttle segment commits during streaming so the bubble re-renders on a
		// cadence instead of once per chunk. The final chunk (streaming === false)
		// flushes immediately so the completed content renders.
		const throttle = createSegmentThrottle((segments) => {
			setSegments(segments.map((s) => ({ ...s })));
		});

		const handleUpdate = (data) => {
			// Replace segments entirely from parent — messageList.updateMessage
			// already handles coalescing. The published data contains the full
			// merged segments, so we just copy them.
			if (data?.segments) {
				throttle.push(data.segments, data.streaming);
			} else if (data?.streaming === false) {
				// Stream ended without a segments payload (finalize path): flush
				// any buffered segments so the completed content renders now.
				throttle.flush();
			}
			// Pick up streaming/turnDuration from published data so the
			// timer stops without a parent re-render.
			if (data?.streaming !== undefined) setLocalStreaming(data.streaming);
			if (data?.turnDuration !== undefined) setLocalTurnDuration(data.turnDuration);
			if (data?.completedToolCalls !== undefined)
				setLocalCompletedToolCalls(data.completedToolCalls);
			if (data?.toolCallDisplay !== undefined) setLocalToolCallDisplay(data.toolCallDisplay);
			if (data?.activeToolCall !== undefined) setLocalActiveToolCall(data.activeToolCall);
			if (data?.content !== undefined) setLocalContent(data.content);
		};

		subscribe(topic, handleUpdate);
		return () => {
			unsubscribe(topic, handleUpdate);
			throttle.dispose();
		};
	}, [topic, subscribe, unsubscribe]);

	// Display the latest content — use segments if available, otherwise fall back to localContent
	// (which tracks pub/sub content updates for non-segment messages like system messages).
	const text = segments.length > 0 ? segments.map((s) => s.content).join("") : localContent || "";

	/**
	 * Split a string into highlighted and non-highlighted parts based on the
	 * bubble's local selection range. The selection range is expressed in
	 * character indices into the bubble's joined `text`.
	 * @param {string} str - Text to split
	 * @param {number} offset - Character offset of `str` within the bubble's joined text
	 * @returns {Array<{text: string, highlighted: boolean}>} Segments with highlight flags
	 */
	function splitHighlight(str, offset) {
		if (!selection) return [{ text: str, highlighted: false }];
		const start = Math.max(0, selection.start - offset);
		const end = Math.max(0, selection.end - offset);
		const parts = [];
		if (start > 0) parts.push({ text: str.slice(0, start), highlighted: false });
		if (end > start) parts.push({ text: str.slice(start, end), highlighted: true });
		if (end < str.length) parts.push({ text: str.slice(end), highlighted: false });
		return parts.length > 0 ? parts : [{ text: str, highlighted: false }];
	}

	// Trigger scroll-to-bottom when streaming content grows or when streaming starts.
	// When a bubble grows via pub/sub, the parent doesn't re-render, so the
	// ScrollView's MeasurableItem never re-measures and contentHeight stays stale.
	// Call onRemeasure(renderIndex) to force a re-measure, which updates
	// contentHeight and fires onContentHeightChange, which drives auto-scroll.
	const prevContentLengthRef = useRef(0);
	const hasScrolledOnStreamStartRef = useRef(false);
	useEffect(() => {
		if (!streaming) {
			prevContentLengthRef.current = text.length;
			hasScrolledOnStreamStartRef.current = false;
			return;
		}
		// Scroll when streaming first starts (even if content is empty)
		if (!hasScrolledOnStreamStartRef.current) {
			scrollToBottom();
			hasScrolledOnStreamStartRef.current = true;
		}
		// Force re-measure when content grows so the ScrollView updates
		// contentHeight and fires onContentHeightChange.
		if (text.length > prevContentLengthRef.current) {
			onRemeasure?.(renderIndex);
		}
		prevContentLengthRef.current = text.length;
	}, [text, streaming, scrollToBottom, onRemeasure, renderIndex]);

	const ts = time || formatTime(new Date());
	const colors = getRoleColors(role);
	const bubble = getBubbleStyle(role);

	// Show reasoning segments alongside the response - gray, offset like timer/tool calls.
	// Stays visible after streaming completes so you can review the model's thinking.
	const hasReasoning = role === "assistant" && segments.some((s) => s.type === "reasoning");
	const hasActiveToolCall = role === "assistant" && localActiveToolCall;
	const hasToolCallDisplay = role === "assistant" && localToolCallDisplay && showToolResults;

	// Render segments in order — reasoning segments get gray "(thinking)" prefix,
	// message segments render as normal MarkdownText. Reasoning segments are
	// collapsible: when collapsed they render a single `💭 Thinking…` line,
	// expandable on demand via a click/keyboard toggle.
	let segmentOffset = 0;
	const segmentEls = segments.map((seg, i) => {
		if (seg.type === "reasoning") {
			if (reasoningCollapsed) {
				return React.createElement(
					Box,
					{ key: `seg-${i}`, flexDirection: "row", marginLeft: 2, flexShrink: 0 },
					React.createElement(Text, { color: "gray" }, "💭 Thinking…"),
				);
			}
			return React.createElement(
				Box,
				{ key: `seg-${i}`, flexDirection: "row", marginLeft: 2, flexShrink: 0 },
				React.createElement(Text, { color: "gray" }, seg.content),
			);
		}
		const parts = splitHighlight(seg.content, segmentOffset);
		segmentOffset += seg.content.length;
		return React.createElement(
			Box,
			{ key: `seg-${i}`, flexDirection: "row", flexShrink: 0 },
			...parts.map((part, j) =>
				React.createElement(MarkdownText, {
					key: `seg-${i}-${j}`,
					content: part.text,
					color: role === "system" ? "orange" : undefined,
					backgroundColor: part.highlighted ? "blue" : undefined,
				}),
			),
		);
	});

	// Fallback for non-segments path (session restore, non-streaming messages)
	const fallbackContentEl =
		!hasReasoning && segments.length === 0 && localContent
			? React.createElement(
					Box,
					{ flexDirection: "row", flexShrink: 0 },
					...splitHighlight(localContent, 0).map((part, j) =>
						React.createElement(MarkdownText, {
							key: `fallback-${j}`,
							content: part.text,
							color: role === "system" ? "orange" : undefined,
							backgroundColor: part.highlighted ? "blue" : undefined,
						}),
					),
				)
			: null;

	const toolCallEl = hasActiveToolCall
		? React.createElement(
				Box,
				{ flexDirection: "row", marginLeft: 2, flexShrink: 0 },
				React.createElement(Text, { color: "gray" }, `- Running: ${localActiveToolCall.name} ...`),
			)
		: null;

	const toolDisplayEl = hasToolCallDisplay
		? React.createElement(
				Box,
				{ flexDirection: "column", marginLeft: 2, flexShrink: 0 },
				React.createElement(
					Text,
					{ color: "gray" },
					toolCallCollapsed ? "▸ tool result (ctrl+t to expand)" : "▾ tool result",
				),
				...(toolCallCollapsed
					? []
					: localToolCallDisplay
							.split("\n")
							.map((line, i) =>
								React.createElement(Text, { key: `tool-${i}`, color: "gray" }, `  ${line}`),
							)),
			)
		: null;

	const pendingState =
		role === "assistant" && localStreaming && segments.length === 0 && !localContent;

	// Memoize the thinking word so it doesn't rotate on every render
	const thinkingWordRef = useRef(null);
	if (!thinkingWordRef.current) {
		thinkingWordRef.current = getRandomThinkingWord();
	}

	// Live timer: updates every 200ms while streaming, shows final duration when done
	const [liveElapsed, setLiveElapsed] = useState(0);
	useEffect(() => {
		if (!localStreaming || !turnStartTime) {
			setLiveElapsed(0);
			return;
		}
		const interval = setInterval(() => {
			setLiveElapsed(Date.now() - turnStartTime);
		}, 200);
		return () => clearInterval(interval);
	}, [localStreaming, turnStartTime]);

	const displayElapsed = localTurnDuration || liveElapsed;

	/**
	 * Format elapsed ms to the nearest logical unit.
	 * @param {number} ms
	 * @returns {string}
	 */
	function formatElapsed(ms) {
		if (ms < 1000) return `${ms}ms`;
		if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
		if (ms < 3600000) return `${Math.floor(ms / 60000)}m ${Math.floor((ms % 60000) / 1000)}s`;
		if (ms < 86400000) return `${Math.floor(ms / 3600000)}h ${Math.floor((ms % 3600000) / 60000)}m`;
		return `${Math.floor(ms / 86400000)}d ${Math.floor((ms % 86400000) / 3600000)}h`;
	}

	// Timer display element
	const timerEl =
		role === "assistant" && (localStreaming || localTurnDuration)
			? React.createElement(
					Box,
					{ flexDirection: "row", marginLeft: 2, flexShrink: 0 },
					React.createElement(Text, { color: "gray" }, `⏱ ${formatElapsed(displayElapsed)}`),
				)
			: null;

	// Keyboard toggle for collapse/expand. `ctrl+r` toggles reasoning, `ctrl+t`
	// toggles tool-call results. Only active when the bubble has the relevant
	// content. Modifier keys are used so the toggles don't collide with normal
	// message input.
	useInput((input, key) => {
		if (key?.escape) return;
		if (key?.ctrl && input === "r" && hasReasoning) {
			setReasoningCollapsed((prev) => !prev);
		} else if (key?.ctrl && input === "t" && hasToolCallDisplay) {
			setToolCallCollapsed((prev) => !prev);
		}
	});

	// Completed tool calls display — collapsed into a count map so repeated
	// calls render as `name ×count` instead of a long list of duplicates.
	const { total: completedTotal, text: completedText } =
		formatCompletedToolCalls(localCompletedToolCalls);
	const completedToolCallsEl =
		role === "assistant" && hasCompletedToolCalls(localCompletedToolCalls)
			? React.createElement(
					Box,
					{ flexDirection: "column", marginLeft: 2, flexShrink: 0 },
					React.createElement(
						Text,
						{ color: "gray" },
						`⚡ ${completedTotal} tool call${completedTotal !== 1 ? "s" : ""}: ${completedText}`,
					),
				)
			: null;

	return React.createElement(
		Box,
		{
			key: `bubble-${role}`,
			flexDirection: "row",
			//paddingY: 1,
			justifyContent: bubble.alignment,
			gap: 0,
		},
		React.createElement(
			Box,
			{
				key: `bubble-inner-${role}`,
				flexDirection: "column",
				paddingX: 1,
				paddingY: 1,
				width: "100%",
				gap: 1,
				...(role === "system" || role === "user" ? { backgroundColor: "#0d0d0d" } : {}),
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
			...segmentEls,
			fallbackContentEl,
			pendingState
				? React.createElement(
						Box,
						{ flexDirection: "row" },
						React.createElement(
							Text,
							{ color: "cyan" },
							React.createElement(Spinner, { type: "dots2" }),
							` ${thinkingWordRef.current}`,
						),
					)
				: null,
			toolCallEl,
			toolDisplayEl,
			timerEl,
			completedToolCallsEl,
		),
	);
}

/**
 * Memo-wrapped MessageBubble for rendering in the component tree.
 * Prevents re-renders when props haven't changed (content via streaming
 * is handled by pub/sub, not prop updates).
 */
export const MessageBubble = React.memo(MessageBubbleInner);

export default MessageBubble;
