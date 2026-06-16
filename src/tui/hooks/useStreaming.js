/**
 * Streaming hook for TUI.
 * Manages AbortController lifecycle, translates stream events into
 * state transitions, and handles the auto-continue circuit breaker.
 *
 * This replaces the inline streaming callback logic that was previously
 * duplicated in handleChat() and handleCommand().
 */
import { useRef, useCallback, useMemo } from "react";

/**
 * Streaming state object exposed by the useStreaming hook.
 * @typedef {Object} StreamingState
 * @property {boolean} isStreaming - Whether a stream is currently active
 * @property {boolean} isAutoContinuing - Whether auto-continue is active
 * @property {number} autoContinueCount - Consecutive empty response count
 * @property {string} committedContent - Accumulated text content
 * @property {string} committedReasoning - Accumulated reasoning content
 * @property {string} lastToolCallDisplay - Last tool call display string
 * @property {string} todoStatusLines - Todo status lines
 */

/**
 * Create a streaming hook instance.
 * @returns {Object} Hook instance with state and methods
 */
export function useStreaming() {
	// Refs for mutable streaming state (avoids React re-render cycles during streaming)
	const abortControllerRef = useRef(null);
	const isStreamingRef = useRef(false);
	const isAutoContinuingRef = useRef(false);
	const autoContinueCountRef = useRef(0);
	const dispatchPromiseRef = useRef(null);
	const committedContentRef = useRef("");
	const committedReasoningRef = useRef("");
	const lastToolCallDisplayRef = useRef("");
	const todoStatusLinesRef = useRef("");

	/**
	 * Create a streaming state snapshot.
	 * @returns {StreamingState}
	 */
	const getStreamingState = useCallback(() => {
		return {
			isStreaming: isStreamingRef.current,
			isAutoContinuing: isAutoContinuingRef.current,
			autoContinueCount: autoContinueCountRef.current,
			committedContent: committedContentRef.current,
			committedReasoning: committedReasoningRef.current,
			lastToolCallDisplay: lastToolCallDisplayRef.current,
			todoStatusLines: todoStatusLinesRef.current,
		};
	}, []);

	/**
	 * Reset all streaming refs to initial state.
	 */
	const resetStreaming = useCallback(() => {
		abortControllerRef.current = null;
		isStreamingRef.current = false;
		isAutoContinuingRef.current = false;
		autoContinueCountRef.current = 0;
		dispatchPromiseRef.current = null;
		committedContentRef.current = "";
		committedReasoningRef.current = "";
		lastToolCallDisplayRef.current = "";
		todoStatusLinesRef.current = "";
	}, []);

	/**
	 * Abort the current stream.
	 * @returns {void}
	 */
	const abort = useCallback(() => {
		if (abortControllerRef.current) {
			abortControllerRef.current.abort();
			abortControllerRef.current = null;
		}
		isStreamingRef.current = false;
	}, []);

	/**
	 * Check if the current stream should be aborted.
	 * @returns {boolean}
	 */
	const shouldAbort = useCallback(() => {
		return !!(abortControllerRef.current?.signal?.aborted);
	}, []);

	/**
	 * Create a streaming event transformer callback.
	 * This callback is passed to dispatchProvider and updates
	 * committed content, tool call display, and todo status.
	 * @param {Function} setMessageCallback - React setState callback for message updates
	 * @returns {Function} Event transformer callback
	 */
	const createEventTransformer = useCallback(
		(setMessageCallback) => {
			return (event) => {
				if (shouldAbort()) return;

				try {
					if (event.type === "text") {
						committedContentRef.current =
							(committedContentRef.current || "") + event.text;
						setMessageCallback((prev) => {
							const cloned = [...prev];
							const last = cloned[cloned.length - 1];
							if (last.role === "assistant" && last.streaming) {
								last.content = committedContentRef.current + "\u2588";
							}
							return cloned;
						});
					} else if (event.type === "reasoning") {
						committedReasoningRef.current =
							(committedReasoningRef.current || "") + event.text;
						setMessageCallback((prev) => {
							const cloned = [...prev];
							const last = cloned[cloned.length - 1];
							if (last.role === "assistant" && last.streaming) {
								last.reasoningContent =
									(committedReasoningRef.current || "") + "\u2588";
							}
							return cloned;
						});
					} else if (event.type === "tool_start") {
						setMessageCallback((prev) => {
							const cloned = [...prev];
							const last = cloned[cloned.length - 1];
							if (last.role === "assistant" && last.streaming) {
								last.activeToolCall = { name: event.toolName };
								last.toolCallDisplay = lastToolCallDisplayRef.current;
							}
							return cloned;
						});
					} else if (event.type === "tool_end") {
						const resultLine = event.data
							? ` Result: ${JSON.stringify(event.data).slice(0, 200)}`
							: "";
						const displayLine = event.toolName
							? `- Tool: ${event.toolName}${resultLine}`
							: `- Tool: ${event.toolCallId || "unknown"}${resultLine}`;
						lastToolCallDisplayRef.current =
							(lastToolCallDisplayRef.current
								? lastToolCallDisplayRef.current + "\n"
								: "") + displayLine;
						setMessageCallback((prev) => {
							const cloned = [...prev];
							const last = cloned[cloned.length - 1];
							if (last.role === "assistant" && last.streaming) {
								last.activeToolCall = null;
								last.toolCallDisplay = lastToolCallDisplayRef.current;
							}
							return cloned;
						});
					} else if (event.type === "tool_error") {
						const errorLine = event.toolName
							? `- Tool: ${event.toolName} (error: ${event.error})`
							: `- Tool call failed (${event.toolCallId || "unknown"})`;
						lastToolCallDisplayRef.current =
							(lastToolCallDisplayRef.current
								? lastToolCallDisplayRef.current + "\n"
								: "") + errorLine;
						setMessageCallback((prev) => {
							const cloned = [...prev];
							const last = cloned[cloned.length - 1];
							if (last.role === "assistant" && last.streaming) {
								last.activeToolCall = null;
								last.toolCallDisplay = lastToolCallDisplayRef.current;
							}
							return cloned;
						});
					} else if (event.type === "compaction_start") {
						setMessageCallback((prev) => {
							const cloned = [...prev];
							const last = cloned[cloned.length - 1];
							if (last.role === "assistant" && last.streaming) {
								last.activeToolCall = null;
								last.toolCallDisplay = lastToolCallDisplayRef.current
									? lastToolCallDisplayRef.current + "\nCompacting context..."
									: "Compacting context...";
							}
							return cloned;
						});
					} else if (event.type === "compaction_end") {
						setMessageCallback((prev) => {
							const cloned = [...prev];
							const last = cloned[cloned.length - 1];
							if (last.role === "assistant" && last.streaming) {
								last.activeToolCall = null;
								last.toolCallDisplay = lastToolCallDisplayRef.current;
							}
							return cloned;
						});
					} else if (event.type === "todo_status") {
						const statusLine = event.message
							? `- ${event.message}`
							: `- Todo: ${event.action} ${event.key || ""}`;
						todoStatusLinesRef.current =
							(todoStatusLinesRef.current
								? todoStatusLinesRef.current + "\n"
								: "") + statusLine;
						setMessageCallback((prev) => {
							const cloned = [...prev];
							const last = cloned[cloned.length - 1];
							if (last.role === "assistant" && last.streaming) {
								last.toolCallDisplay = lastToolCallDisplayRef.current
									? lastToolCallDisplayRef.current + "\n" + todoStatusLinesRef.current
									: todoStatusLinesRef.current;
							}
							return cloned;
						});
					}
				} catch (_cbErr) {
					// Silently ignore streaming callback errors
				}
			};
		},
		[shouldAbort],
	);

	/**
	 * Start a new stream session.
	 * Creates AbortController, resets accumulated content, sets streaming flag.
	 * @param {Function} setMessageCallback - React setState callback
	 * @returns {Object} Stream session with transformer and abort method
	 */
	const startStream = useCallback(
		(setMessageCallback) => {
			resetStreaming();
			abortControllerRef.current = new AbortController();
			isStreamingRef.current = true;

			return {
				transformer: createEventTransformer(setMessageCallback),
				abort: () => {
					if (abortControllerRef.current) {
						abortControllerRef.current.abort();
						abortControllerRef.current = null;
					}
					isStreamingRef.current = false;
				},
				get state() {
					return getStreamingState();
				},
			};
		},
		[resetStreaming, createEventTransformer, getStreamingState],
	);

	/**
	 * Execute auto-continue with circuit breaker.
	 * @param {Function} dispatchProvider - Provider dispatch function
	 * @param {string} continuationText - Text to send for continuation
	 * @param {Function} setMessageCallback - React setState callback
	 * @param {number} limit - Circuit breaker limit (default 1000)
	 * @returns {Promise<void>}
	 */
	const autoContinue = useCallback(
		async (dispatchProvider, continuationText, setMessageCallback, limit = 1000) => {
			if (autoContinueCountRef.current >= limit) {
				return { exceeded: true };
			}

			isAutoContinuingRef.current = true;
			try {
				const continuePromise = dispatchProvider(
					continuationText,
					null, // provider name — caller should pass this
					createEventTransformer(setMessageCallback),
					abortControllerRef.current?.signal,
				);
				dispatchPromiseRef.current = continuePromise;
				await continuePromise;
				return { exceeded: false };
			} catch (err) {
				return { error: err.message };
			} finally {
				isAutoContinuingRef.current = false;
				autoContinueCountRef.current++;
			}
		},
		[createEventTransformer],
	);

	/**
	 * Store the dispatch promise for interrupt handling.
	 * @param {Promise} promise - The dispatch provider promise
	 */
	const setDispatchPromise = useCallback((promise) => {
		dispatchPromiseRef.current = promise;
	}, []);

	/**
	 * Get the current dispatch promise (for interrupt handling).
	 * @returns {Promise|null}
	 */
	const getDispatchPromise = useCallback(() => {
		return dispatchPromiseRef.current;
	}, []);

	/**
	 * Clear the dispatch promise reference.
	 */
	const clearDispatchPromise = useCallback(() => {
		dispatchPromiseRef.current = null;
	}, []);

	// Public API — memoized to avoid unnecessary re-renders
	const api = useMemo(
		() => ({
			startStream,
			abort,
			autoContinue,
			getStreamingState,
			shouldAbort,
			setDispatchPromise,
			getDispatchPromise,
			clearDispatchPromise,
			resetStreaming,
			get state() {
				return getStreamingState();
			},
		}),
		[startStream, abort, autoContinue, getStreamingState, shouldAbort, setDispatchPromise, getDispatchPromise, clearDispatchPromise, resetStreaming],
	);

	return api;
}
