/**
 * useStreaming hook — manages the AI agent streaming lifecycle.
 * Encapsulates AbortController lifecycle, stream event transformation,
 * auto-continue circuit breaker, and interrupt handling.
 */

import { useRef, useCallback } from "react";
import { ActionTypes } from "../state/types.js";

const STREAMING_CURSOR = "\u2588";

/**
 * Create the useStreaming hook factory.
 * Returns a hook function that can be called within a React component.
 * @param {Object} deps - Dependencies injected by the calling component
 * @param {React.Dispatch} deps.dispatch - TUI state dispatcher
 * @param {Object} deps.scrollRef - Scroll ref for auto-scroll
 * @param {Function} deps.addMessage - Add message helper
 * @param {Function} deps.getSessionTokens - Get session token count
 * @param {Object} deps.config - App config
 * @param {Object} deps.sessionState - Session state manager
 * @param {Function} deps.onSaveSession - Session save callback
 * @param {Function} deps.gcManager - GC manager callback
 * @param {Object} deps.checkpointer - Checkpointer for thread management
 * @param {Function} deps.setTodoStreamingCallback - Todo queue callback setter
 * @returns {Object} Hook return value
 */
export function createUseStreaming(deps) {
	const abortControllerRef = useRef(null);
	const isStreamingRef = useRef(false);
	const dispatchPromiseRef = useRef(null);
	const autoContinueCountRef = useRef(0);
	const isAutoContinuingRef = useRef(false);

	/**
	 * Check if the current stream should be aborted.
	 * @returns {boolean}
	 */
	const shouldAbort = useCallback(() => {
		return abortControllerRef.current?.signal?.aborted === true;
	}, []);

	/**
	 * Build a streaming callback for dispatchProvider.
	 * Translates stream events into state updates via the reducer.
	 * @param {Object} streamDeps - Stream-specific dependencies
	 * @returns {Function} Streaming callback
	 */
	const buildStreamingCallback = useCallback(
		(streamDeps) => {
			const {
				setMessages,
				setStatusMessage,
				setIsCompacting,
				committedContentRef,
				committedReasoningRef,
				lastToolCallDisplayRef,
				todoStatusLinesRef,
			} = streamDeps;

			return (event) => {
				if (shouldAbort()) return;
				try {
					if (event.type === "text") {
						committedContentRef.current = (committedContentRef.current || "") + event.text;
						setMessages((prev) => {
							const cloned = [...prev];
							const last = cloned[cloned.length - 1];
							if (last.role === "assistant" && last.streaming) {
								last.content = committedContentRef.current + STREAMING_CURSOR;
							}
							return cloned;
						});
					} else if (event.type === "reasoning") {
						committedReasoningRef.current = (committedReasoningRef.current || "") + event.text;
						setMessages((prev) => {
							const cloned = [...prev];
							const last = cloned[cloned.length - 1];
							if (last.role === "assistant" && last.streaming) {
								last.reasoningContent = (committedReasoningRef.current || "") + STREAMING_CURSOR;
							}
							return cloned;
						});
					} else if (event.type === "tool_start") {
						setMessages((prev) => {
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
							(lastToolCallDisplayRef.current ? lastToolCallDisplayRef.current + "\n" : "") + displayLine;
						setMessages((prev) => {
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
							(lastToolCallDisplayRef.current ? lastToolCallDisplayRef.current + "\n" : "") + errorLine;
						setMessages((prev) => {
							const cloned = [...prev];
							const last = cloned[cloned.length - 1];
							if (last.role === "assistant" && last.streaming) {
								last.activeToolCall = null;
								last.toolCallDisplay = lastToolCallDisplayRef.current;
							}
							return cloned;
						});
					} else if (event.type === "compaction_start") {
						setIsCompacting(true);
					} else if (event.type === "compaction_end") {
						setIsCompacting(false);
					}
				} catch (_cbErr) {
					// Silently ignore streaming callback errors
				}
			};
		},
		[shouldAbort],
	);

	/**
	 * Handle auto-continue: send "Please continue." if agent stalled.
	 * @param {Function} dispatchProvider - Provider dispatch function
	 * @param {string} provider - Provider name
	 * @param {Function} streamingCallback - Streaming callback
	 * @returns {Promise<void>}
	 */
	const handleAutoContinue = useCallback(
		async (dispatchProvider, provider, streamingCallback) => {
			const committedContentRef = { current: "" };
			const committedReasoningRef = { current: "" };
			const lastToolCallDisplayRef = { current: "" };
			const todoStatusLinesRef = { current: "" };

			if (autoContinueCountRef.current >= (deps.config?.agent?.autoContinueLimit ?? 1000)) {
				deps.setStatusMessage("Model appears stuck — starting fresh.");
				deps.setMessages((prev) => {
					const cloned = [...prev];
					const last = cloned[cloned.length - 1];
					if (last.role === "assistant" && last.streaming) {
						last.streaming = false;
					}
					return cloned;
				});
				autoContinueCountRef.current = 0;
				deps.addMessage({
					role: "system",
					content: `I've tried to continue ${deps.config?.agent?.autoContinueLimit ?? 1000} times with no text output. The model may be stuck in a reasoning loop. Please try a new conversation or rephrase your request.`,
				});
				return "";
			}

			deps.setStatusMessage("Continuing...");
			isAutoContinuingRef.current = true;
			try {
				const continuePromise = dispatchProvider(
					"Please continue.",
					provider,
					buildStreamingCallback({
						setMessages: deps.setMessages,
						setStatusMessage: deps.setStatusMessage,
						setIsCompacting: deps.setIsCompacting,
						committedContentRef,
						committedReasoningRef,
						lastToolCallDisplayRef,
						todoStatusLinesRef,
					}),
					abortControllerRef.current?.signal,
				);
				dispatchPromiseRef.current = continuePromise;
				await continuePromise;
				deps.setStatusMessage("Received response");
			} catch (contErr) {
				deps.setStatusMessage(`Error continuing: ${contErr.message}`);
			} finally {
				isAutoContinuingRef.current = false;
				autoContinueCountRef.current++;
			}
			return committedContentRef.current;
		},
		[deps, buildStreamingCallback],
	);

	/**
	 * Handle interrupt: abort current stream and clean up.
	 * @returns {Promise<void>}
	 */
	const handleInterrupt = useCallback(async () => {
		if (abortControllerRef.current) {
			abortControllerRef.current.abort();
			abortControllerRef.current = null;
		}
		isStreamingRef.current = false;
		deps.setMessages((prev) => {
			const cloned = [...prev];
			const last = cloned[cloned.length - 1];
			if (last?.role === "assistant" && last?.streaming) {
				last.streaming = false;
			}
			return cloned;
		});
		deps.setStatusMessage("Interrupted.");

		const dispatchPromise = dispatchPromiseRef.current;
		dispatchPromiseRef.current = null;
		if (dispatchPromise) {
			try {
				await dispatchPromise;
			} catch (_err) {
				// AbortError is expected
			}
		}
	}, [deps]);

	/**
	 * Clean up after a stream completes (success or error).
	 */
	const cleanupStream = useCallback(() => {
		abortControllerRef.current = null;
		isStreamingRef.current = false;
	}, []);

	/**
	 * Start a new stream with an AbortController.
	 * @returns {AbortController}
	 */
	const startStream = useCallback(() => {
		abortControllerRef.current = new AbortController();
		isStreamingRef.current = true;
		return abortControllerRef.current;
	}, []);

	return {
		shouldAbort,
		handleInterrupt,
		cleanupStream,
		startStream,
		handleAutoContinue,
		buildStreamingCallback,
		autoContinueCountRef,
		isAutoContinuingRef,
		abortControllerRef,
		isStreamingRef,
		dispatchPromiseRef,
	};
}
