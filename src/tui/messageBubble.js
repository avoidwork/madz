import React, { useState, useEffect, useContext, useRef } from "react";
import { Box, Text } from "ink";
import Spinner from "ink-spinner";
import { MarkdownText } from "./markdownText.js";
import { getRoleLabel } from "./messages.js";
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
 * A single message bubble with its own chunks state.
 *
 * Uses pub/sub to listen for streaming updates directly from MessageList.
 * Each append to the chunks array triggers a re-render of just this bubble.
 *
 * @param {Object} props
 * @param {string} props.role - Message role: "user" | "assistant" | "system"
 * @param {string} props.content - Initial content for first render
 * @param {string} props.topic - Pub/sub topic this bubble listens on
 * @param {string} [props.time] - Localized time string (e.g., "10:39 AM" for en-US, "22:39" for de-DE)
 * @param {string} props.assistantName - Name to display for assistant messages
 * @param {string} [props.reasoningContent] - Thinking/thought content
 * @param {Object} [props.activeToolCall] - {name: string} for running tool
 * @param {string} [props.toolCallDisplay] - Tool call result display text
 * @param {number} [props.turnStartTime] - Timestamp when the turn started (for live timer)
 * @param {number} [props.turnDuration] - Final elapsed time in ms when streaming ended
 * @param {string[]} [props.completedToolCalls] - List of completed tool call names

 * @returns {React.ReactElement}
 */
export function MessageBubbleInner({
	role,
	content,
	topic,
	time,
	assistantName,
	reasoningContent,
	activeToolCall,
	toolCallDisplay,
	streaming,
	turnStartTime,
	turnDuration,
	completedToolCalls,
}) {
	const [chunks, setChunks] = useState([]);
	const { subscribe, unsubscribe } = useContext(PubSubContext);
	const { scrollToBottom } = useContext(ScrollContext);

	// Subscribe to pub/sub updates — each update appends a chunk, triggering
	// re-render of just this bubble without re-rendering the parent.
	// Also picks up streaming/turnDuration changes so the timer stops
	// without needing a parent re-render.
	const [localStreaming, setLocalStreaming] = useState(streaming);
	const [localTurnDuration, setLocalTurnDuration] = useState(turnDuration);
	const [localCompletedToolCalls, setLocalCompletedToolCalls] = useState(completedToolCalls || []);
	const [localReasoning, setLocalReasoning] = useState(reasoningContent);

	// Sync local state from props when not using pub/sub (session restore, initial render)
	useEffect(() => {
		if (!topic) {
			setLocalStreaming(streaming);
			setLocalTurnDuration(turnDuration);
			setLocalCompletedToolCalls(completedToolCalls || []);
			setLocalReasoning(reasoningContent);
		}
	}, [topic, streaming, turnDuration, completedToolCalls, reasoningContent]);

	useEffect(() => {
		if (!topic) return;

		const handleUpdate = (data) => {
			setChunks((prev) => {
				const newContent = data?.content ?? "";
				if (newContent.length === 0) return prev;
				if (prev.length > 0 && prev[prev.length - 1] === newContent) return prev;
				return [...prev, newContent];
			});
			// Pick up streaming/turnDuration from published data so the
			// timer stops without a parent re-render.
			if (data?.streaming !== undefined) setLocalStreaming(data.streaming);
			if (data?.turnDuration !== undefined) setLocalTurnDuration(data.turnDuration);
			if (data?.completedToolCalls !== undefined)
				setLocalCompletedToolCalls(data.completedToolCalls);
			if (data?.reasoningContent !== undefined) setLocalReasoning(data.reasoningContent);
		};

		subscribe(topic, handleUpdate);
		return () => unsubscribe(topic, handleUpdate);
	}, [topic, subscribe, unsubscribe]);

	// Display the latest chunk (or initial content if no chunks yet)
	const text = chunks.at(-1) || content || "";

	// Trigger scroll-to-bottom when streaming content grows or when streaming starts.
	// Uses ScrollContext to call scrollToBottom directly on the ScrollView,
	// bypassing the broken onContentHeightChange path that never fires
	// when bubbles update via pub/sub (no parent re-render).
	// Dedup is bypassed for streaming (see handleUpdate), so content growth
	// is now reliably detected via text.length changes.
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
		// Also scroll when content grows
		if (text.length > prevContentLengthRef.current) {
			scrollToBottom();
		}
		prevContentLengthRef.current = text.length;
	}, [text, streaming, scrollToBottom]);

	const ts = time || formatTime(new Date());
	const colors = getRoleColors(role);
	const bubble = getBubbleStyle(role);

	// Show reasoning content alongside the response - gray, offset like timer/tool calls.
	// Stays visible after streaming completes so you can review the model's thinking.
	const hasReasoning = role === "assistant" && (localReasoning || true);
	const hasActiveToolCall = role === "assistant" && activeToolCall;
	const hasToolCallDisplay = role === "assistant" && toolCallDisplay;

	const reasoningEl = hasReasoning
		? React.createElement(
				Box,
				{ flexDirection: "row", marginTop: 1, marginLeft: 2 },
				React.createElement(
					Text,
					{ color: "gray" },
					`(thinking) ` + (localReasoning || "hello world")
				),
			)
		: null;

	const toolCallEl = hasActiveToolCall
		? React.createElement(
				Box,
				{ flexDirection: "row", marginTop: 1, marginLeft: 2 },
				React.createElement(Text, { color: "gray" }, `- Running: ${activeToolCall.name} ...`),
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

	const pendingState =
		role === "assistant" && localStreaming && chunks.length === 0 && !content && !localReasoning;

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
					{ flexDirection: "row", marginTop: 1, marginLeft: 2 },
					React.createElement(Text, { color: "gray" }, `⏱ ${formatElapsed(displayElapsed)}`),
				)
			: null;

	// Completed tool calls display
	const completedToolCallsEl =
		role === "assistant" && localCompletedToolCalls && localCompletedToolCalls.length > 0
			? React.createElement(
					Box,
					{ flexDirection: "column", marginTop: 1, marginLeft: 2 },
					React.createElement(
						Text,
						{ color: "gray" },
						`⚡ ${localCompletedToolCalls.length} tool call${localCompletedToolCalls.length !== 1 ? "s" : ""}: ${localCompletedToolCalls.join(", ")}`,
					),
				)
			: null;

	return React.createElement(
		Box,
		{
			key: `bubble-${role}`,
			flexDirection: "row",
			paddingY: 0,
			paddingBottom: 1,
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
			reasoningEl,
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
			!pendingState
				? React.createElement(
						Box,
						{ flexDirection: "row" },
						React.createElement(MarkdownText, {
							content: text,
							color: role === "system" ? "orange" : undefined,
						}),
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
