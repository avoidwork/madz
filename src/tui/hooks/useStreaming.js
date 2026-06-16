/**
 * useStreaming — Extracted streaming logic hook.
 * Manages AbortController lifecycle, transforms stream events into state updates,
 * and handles the auto-continue circuit breaker.
 *
 * Separates *how we stream* from *what we stream*.
 */
import { useState, useRef, useCallback, useEffect } from "react";
import { TUIActionType } from "../state/types.js";
import { updateLastMessage } from "../state/reducer.js";

const STREAMING_CURSOR = "\u2588";

/**
 * Hook for managing AI agent streaming.
 * @param {Object} options
 * @param {Function} options.dispatch - React dispatch function from useReducer
 * @param {Function} options.getAbortSignal - Returns current AbortSignal
 * @param {Function} options.shouldAbort - Returns true if stream should be aborted
 * @param {number} [options.autoContinueLimit=1000] - Max auto-continue attempts
 * @param {Function} [options.onAbort] - Called when stream is aborted
 * @param {Function} [options.onComplete] - Called when stream completes successfully
 * @param {Function} [options.onError] - Called on non-abort errors
 * @returns {Object} Streaming state and controls
 */
export function useStreaming({
	dispatch,
	getAbortSignal,
	shouldAbort,
	autoContinueLimit = 1000,
	onAbort,
	onComplete,
	onError,
}) {
	const [committedContent, setCommittedContent] = useState("");
	const [committedReasoning, setCommittedReasoning] = useState("");
	const [lastToolCallDisplay, setLastToolCallDisplay] = useState("");
	const [todoStatusLines, setTodoStatusLines] = useState("");
	const [isCompacting, setIsCompacting] = useState(false);
	const [statusMessage, setStatusMessage] = useState("Streaming...");

	const autoContinueCountRef = useRef(0);
	const isAutoContinuingRef = useRef(false);

	// Reset state when a new stream starts
	useEffect(() => {
		setCommittedContent("");
		setCommittedReasoning("");
		setLastToolCallDisplay("");
		setTodoStatusLines("");
		setIsCompacting(false);
		setStatusMessage("Streaming...");
		autoContinueCountRef.current = 0;
		isAutoContinuingRef.current = false;
	}, []);

	/**
	 * Transform a stream event into state updates.
	 * @param {Object} event - Stream event from dispatchProvider
	 */
	const handleStreamEvent = useCallback(
		(event) => {
			if (shouldAbort()) return;

			switch (event.type) {
				case "text": {
					setCommittedContent((prev) => (prev || "") + event.text);
					dispatch({
						type: TUIActionType.SET_STREAMING,
						streaming: true,
					});
					dispatch({
						type: TUIActionType.UPDATE_MESSAGE,
						updates: {
							content: (committedContent || "") + event.text + STREAMING_CURSOR,
							streaming: true,
						},
					});
					break;
				}

				case "reasoning": {
					setCommittedReasoning((prev) => (prev || "") + event.text);
					dispatch({
						type: TUIActionType.UPDATE_MESSAGE,
						updates: {
							reasoningContent: (committedReasoning || "") + event.text + STREAMING_CURSOR,
						},
					});
					break;
				}

				case "tool_start": {
					dispatch({
						type: TUIActionType.UPDATE_MESSAGE,
						updates: {
							activeToolCall: { name: event.toolName },
							toolCallDisplay: lastToolCallDisplay,
						},
					});
					break;
				}

				case "tool_end": {
					const resultLine = event.data
						? ` Result: ${JSON.stringify(event.data).slice(0, 200)}`
						: "";
					const displayLine = event.toolName
						? `- Tool: ${event.toolName}${resultLine}`
						: `- Tool: ${event.toolCallId || "unknown"}${resultLine}`;
					setLastToolCallDisplay((prev) =>
						(prev ? prev + "\n" : "") + displayLine
					);
					dispatch({
						type: TUIActionType.UPDATE_MESSAGE,
						updates: {
							activeToolCall: null,
							toolCallDisplay:
								(lastToolCallDisplay || "") + "\n" + displayLine,
						},
					});
					break;
				}

				case "tool_error": {
					const errorLine = event.toolName
						? `- Tool: ${event.toolName} (error: ${event.error})`
						: `- Tool call failed (${event.toolCallId || "unknown"})`;
					setLastToolCallDisplay((prev) =>
						(prev ? prev + "\n" : "") + errorLine
					);
					dispatch({
						type: TUIActionType.UPDATE_MESSAGE,
						updates: {
							activeToolCall: null,
							toolCallDisplay:
								(lastToolCallDisplay || "") + "\n" + errorLine,
						},
					});
					break;
				}

				case "compaction_start": {
					setIsCompacting(true);
					setStatusMessage("Compacting context...");
					dispatch({
						type: TUIActionType.SET_COMPACTING,
						compacting: true,
					});
					dispatch({
						type: TUIActionType.SET_STATUS,
						message: "Compacting context...",
					});
					break;
				}

				case "compaction_end": {
					setIsCompacting(false);
					setStatusMessage("Streaming...");
					dispatch({
						type: TUIActionType.SET_COMPACTING,
						compacting: false,
					});
					dispatch({
						type: TUIActionType.SET_STATUS,
						message: "Streaming...",
					});
					break;
				}

				case "todo_status": {
					const statusLine = event.message
						? `- ${event.message}`
						: `- Todo: ${event.action} ${event.key || ""}`;
					setTodoStatusLines((prev) =>
						(prev ? prev + "\n" : "") + statusLine
					);
					dispatch({
						type: TUIActionType.UPDATE_MESSAGE,
						updates: {
							toolCallDisplay:
								(lastToolCallDisplay || "") +
								"\n" +
								(todoStatusLines || "") +
								statusLine,
						},
					});
					break;
				}
			}
		},
		[
			shouldAbort,
			dispatch,
			committedContent,
			committedReasoning,
			lastToolCallDisplay,
			todoStatusLines,
		]
	);

	/**
	 * Handle auto-continue when agent returns zero text output.
	 * @param {Function} dispatchProvider - The dispatch provider function
	 * @param {string} provider - Provider name
	 * @returns {Promise<boolean>} True if auto-continue was triggered
	 */
	const handleAutoContinue = useCallback(
		async (dispatchProvider, provider) => {
			if (
				autoContinueCountRef.current >= autoContinueLimit ||
				shouldAbort()
			) {
				if (autoContinueCountRef.current >= autoContinueLimit) {
					setStatusMessage("Model appears stuck — starting fresh.");
					dispatch({
						type: TUIActionType.SET_STATUS,
						message: "Model appears stuck — starting fresh.",
					});
					dispatch({
						type: TUIActionType.UPDATE_MESSAGE,
						updates: { streaming: false },
					});
					autoContinueCountRef.current = 0;
					dispatch({
						type: TUIActionType.ADD_MESSAGE,
						message: {
							role: "system",
							content: `I've tried to continue ${autoContinueLimit} times with no text output. The model may be stuck in a reasoning loop. Please try a new conversation or rephrase your request.`,
						},
					});
				}
				return false;
			}

			setStatusMessage("Continuing...");
			dispatch({
				type: TUIActionType.SET_STATUS,
				message: "Continuing...",
			});
			isAutoContinuingRef.current = true;
			dispatch({
				type: TUIActionType.SET_AUTO_CONTINUING,
				autoContinuing: true,
			});

			try {
				await dispatchProvider(
					"Please continue.",
					provider,
					handleStreamEvent,
					getAbortSignal()
				);
				setStatusMessage("Received response");
				dispatch({
					type: TUIActionType.SET_STATUS,
					message: "Received response",
				});
			} catch (contErr) {
				setStatusMessage(`Error continuing: ${contErr.message}`);
				dispatch({
					type: TUIActionType.SET_STATUS,
					message: `Error continuing: ${contErr.message}`,
				});
			} finally {
				isAutoContinuingRef.current = false;
				dispatch({
					type: TUIActionType.SET_AUTO_CONTINUING,
					autoContinuing: false,
				});
				autoContinueCountRef.current++;
				dispatch({
					type: TUIActionType.INCREMENT_AUTO_CONTINUE,
				});
			}

			return true;
		},
		[autoContinueLimit, shouldAbort, dispatch, handleStreamEvent, getAbortSignal]
	);

	/**
	 * Finalize the stream — commit content, clear streaming flags.
	 */
	const finalizeStream = useCallback(() => {
		dispatch({
			type: TUIActionType.UPDATE_MESSAGE,
			updates: {
				content: committedContent,
				reasoningContent: committedReasoning || undefined,
				streaming: false,
				activeToolCall: null,
				toolCallDisplay: lastToolCallDisplay || todoStatusLines,
			},
		});
	}, [dispatch, committedContent, committedReasoning, lastToolCallDisplay, todoStatusLines]);

	/**
	 * Handle abort — clear streaming state and await dispatch cleanup.
	 * @param {Promise} dispatchPromise - The dispatch promise to await
	 */
	const handleAbort = useCallback(
		async (dispatchPromise) => {
			dispatch({
				type: TUIActionType.SET_STREAMING,
				streaming: false,
			});
			dispatch({
				type: TUIActionType.UPDATE_MESSAGE,
				updates: { streaming: false },
			});
			dispatch({
				type: TUIActionType.SET_STATUS,
				message: "Interrupted.",
			});

			if (dispatchPromise) {
				try {
					await dispatchPromise;
				} catch (_err) {
					// AbortError is expected
				}
			}

			if (onAbort) onAbort();
		},
		[dispatch, onAbort]
	);

	/**
	 * Handle error — clear streaming state and show error message.
	 * @param {Error} err - The error that occurred
	 * @param {Promise} dispatchPromise - The dispatch promise to await
	 */
	const handleError = useCallback(
		(err, dispatchPromise) => {
			dispatch({
				type: TUIActionType.SET_STREAMING,
				streaming: false,
			});
			dispatch({
				type: TUIActionType.UPDATE_MESSAGE,
				updates: { streaming: false },
			});
			dispatch({
				type: TUIActionType.SET_STATUS,
				message: `Error: ${err.message}`,
			});

			if (dispatchPromise) {
				try {
					void dispatchPromise;
				} catch (_e) {
					// Already handled
				}
			}

			if (onError) onError(err);
		},
		[dispatch, onError]
	);

	return {
		// State
		committedContent,
		committedReasoning,
		lastToolCallDisplay,
		todoStatusLines,
		isCompacting,
		statusMessage,
		autoContinueCount: autoContinueCountRef.current,
		isAutoContinuing: isAutoContinuingRef.current,

		// Handlers
		handleStreamEvent,
		handleAutoContinue,
		finalizeStream,
		handleAbort,
		handleError,

		// Reset
		reset: () => {
			setCommittedContent("");
			setCommittedReasoning("");
			setLastToolCallDisplay("");
			setTodoStatusLines("");
			setIsCompacting(false);
			setStatusMessage("Streaming...");
			autoContinueCountRef.current = 0;
			isAutoContinuingRef.current = false;
		},
	};
}
