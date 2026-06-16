/**
 * useStreaming hook — manages the streaming pipeline.
 * Handles AbortController lifecycle, stream event transformation,
 * and auto-continue circuit breaker.
 */

import { useRef, useCallback } from 'react';
import { setTodoStreamingCallback } from '../tools/todo_queue.js';

/**
 * Hook that manages streaming state and behavior.
 * @param {Object} options
 * @param {Function} options.dispatchProvider - The dispatch provider function
 * @param {Object} options.sessionState - Session state manager
 * @param {Object} options.config - Application config
 * @param {Function} options.dispatch - React dispatch function
 * @param {Function} options.addMessage - Function to add messages
 * @param {Function} options.getTimestamp - Function to get current timestamp
 * @returns {Object} Streaming hook return value
 */
export function useStreaming({
	dispatchProvider,
	sessionState,
	config,
	dispatch,
	addMessage,
	getTimestamp,
}) {
	const abortControllerRef = useRef(null);
	const isStreamingRef = useRef(false);
	const dispatchPromiseRef = useRef(null);
	const autoContinueCountRef = useRef(0);
	const isAutoContinuingRef = useRef(false);
	const committedContentRef = useRef('');
	const committedReasoningRef = useRef('');
	const lastToolCallDisplayRef = useRef('');
	const todoStatusLinesRef = useRef('');

	/**
	 * Check if the current stream should be aborted.
	 * @returns {boolean}
	 */
	const shouldAbort = useCallback(() => {
		return abortControllerRef.current?.signal?.aborted === true;
	}, []);

	/**
	 * Create a streaming callback for dispatchProvider.
	 * @returns {Function} Streaming callback
	 */
	const createStreamingCallback = useCallback(() => {
		committedContentRef.current = '';
		committedReasoningRef.current = '';
		lastToolCallDisplayRef.current = '';
		todoStatusLinesRef.current = '';

		setTodoStreamingCallback((event) => {
			if (event.type === 'todo_status') {
				const statusLine = event.message
					? `- ${event.message}`
					: `- Todo: ${event.action} ${event.key || ''}`;
				todoStatusLinesRef.current = (todoStatusLinesRef.current ? todoStatusLinesRef.current + '\n' : '') + statusLine;
				dispatch((state) => {
					const cloned = [...state.messages];
					const last = cloned[cloned.length - 1];
					if (last?.role === 'assistant' && last?.streaming) {
						last.toolCallDisplay = lastToolCallDisplayRef.current
							? lastToolCallDisplayRef.current + '\n' + todoStatusLinesRef.current
							: todoStatusLinesRef.current;
					}
					return { ...state, messages: cloned };
				});
			}
		});

		return (event) => {
			if (shouldAbort()) return;
			try {
				switch (event.type) {
					case 'text':
						committedContentRef.current = (committedContentRef.current || '') + event.text;
						dispatch((state) => {
							const cloned = [...state.messages];
							const last = cloned[cloned.length - 1];
							if (last?.role === 'assistant' && last?.streaming) {
								last.content = committedContentRef.current + '\u2588';
							}
							return { ...state, messages: cloned };
						});
						break;

					case 'reasoning':
						committedReasoningRef.current = (committedReasoningRef.current || '') + event.text;
						dispatch((state) => {
							const cloned = [...state.messages];
							const last = cloned[cloned.length - 1];
							if (last?.role === 'assistant' && last?.streaming) {
								last.reasoningContent = (committedReasoningRef.current || '') + '\u2588';
							}
							return { ...state, messages: cloned };
						});
						break;

					case 'tool_start':
						dispatch((state) => {
							const cloned = [...state.messages];
							const last = cloned[cloned.length - 1];
							if (last?.role === 'assistant' && last?.streaming) {
								last.activeToolCall = { name: event.toolName };
								last.toolCallDisplay = lastToolCallDisplayRef.current;
							}
							return { ...state, messages: cloned };
						});
						break;

					case 'tool_end': {
						const resultLine = event.data
							? ` Result: ${JSON.stringify(event.data).slice(0, 200)}`
							: '';
						const displayLine = event.toolName
							? `- Tool: ${event.toolName}${resultLine}`
							: `- Tool: ${event.toolCallId || 'unknown'}${resultLine}`;
						lastToolCallDisplayRef.current =
							(lastToolCallDisplayRef.current ? lastToolCallDisplayRef.current + '\n' : '') + displayLine;
						dispatch((state) => {
							const cloned = [...state.messages];
							const last = cloned[cloned.length - 1];
							if (last?.role === 'assistant' && last?.streaming) {
								last.activeToolCall = null;
								last.toolCallDisplay = lastToolCallDisplayRef.current;
							}
							return { ...state, messages: cloned };
						});
						break;
					}

					case 'tool_error': {
						const errorLine = event.toolName
							? `- Tool: ${event.toolName} (error: ${event.error})`
							: `- Tool call failed (${event.toolCallId || 'unknown'})`;
						lastToolCallDisplayRef.current =
							(lastToolCallDisplayRef.current ? lastToolCallDisplayRef.current + '\n' : '') + errorLine;
						dispatch((state) => {
							const cloned = [...state.messages];
							const last = cloned[cloned.length - 1];
							if (last?.role === 'assistant' && last?.streaming) {
								last.activeToolCall = null;
								last.toolCallDisplay = lastToolCallDisplayRef.current;
							}
							return { ...state, messages: cloned };
						});
						break;
					}

					case 'compaction_start':
						dispatch((state) => ({
							...state,
							isCompacting: true,
							statusMessage: 'Compacting context...',
						}));
						break;

					case 'compaction_end':
						dispatch((state) => ({
							...state,
							isCompacting: false,
							statusMessage: 'Ready',
						}));
						break;
				}
			} catch (_cbErr) {
				// Silently ignore streaming callback errors
			}
		};
	}, [shouldAbort, dispatch]);

	/**
	 * Start a streaming session.
	 * @param {string} text - Message text to stream
	 * @returns {Promise<string>} The committed content
	 */
	const startStreaming = useCallback(async (text) => {
		// Abort any active stream
		if (isStreamingRef.current) {
			await stopStreaming();
		}

		// Create abort controller
		abortControllerRef.current = new AbortController();
		isStreamingRef.current = true;

		// Set streaming state
		dispatch((state) => ({ ...state, isStreaming: true }));

		// Create assistant message placeholder
		const assistantTime = getTimestamp();
		dispatch((state) => ({
			...state,
			messages: [
				...state.messages,
				{
					role: 'assistant',
					content: '',
					time: assistantTime,
					streaming: true,
					toolCalls: [],
					toolCallDisplay: '',
				},
			],
		}));

		// Set up streaming callback
		const streamingCallback = createStreamingCallback();

		// Dispatch
		const dispatchPromise = dispatchProvider(
			text,
			sessionState ? sessionState.getProvider() : null,
			streamingCallback,
			abortControllerRef.current.signal,
		);

		dispatchPromiseRef.current = dispatchPromise;

		try {
			await dispatchPromise;
		} catch (err) {
			if (err.name === 'AbortError') {
				throw err;
			}
			throw err;
		}

		return committedContentRef.current;
	}, [dispatch, dispatchProvider, sessionState, getTimestamp, createStreamingCallback]);

	/**
	 * Handle auto-continue if the agent stalled.
	 * @param {string} responseContent - The response content
	 * @returns {Promise<boolean>} Whether auto-continue was triggered
	 */
	const handleAutoContinue = useCallback(async (responseContent) => {
		if (responseContent.trim() || shouldAbort()) return false;

		const limit = config?.agent?.autoContinueLimit ?? 1000;

		if (autoContinueCountRef.current >= limit) {
			dispatch((state) => ({
				...state,
				statusMessage: 'Model appears stuck — starting fresh.',
			}));
			dispatch((state) => {
				const cloned = [...state.messages];
				const last = cloned[cloned.length - 1];
				if (last?.role === 'assistant' && last?.streaming) {
					last.streaming = false;
				}
				return { ...state, messages: cloned };
			});
			autoContinueCountRef.current = 0;
			addMessage({
				role: 'system',
				content: `I've tried to continue ${limit} times with no text output. The model may be stuck in a reasoning loop. Please try a new conversation or rephrase your request.`,
			});
			return false;
		}

		dispatch((state) => ({ ...state, statusMessage: 'Continuing...', isAutoContinuing: true }));
		isAutoContinuingRef.current = true;

		try {
			const streamingCallback = createStreamingCallback();
			const continuePromise = dispatchProvider(
				'Please continue.',
				sessionState ? sessionState.getProvider() : null,
				streamingCallback,
				abortControllerRef.current.signal,
			);
			dispatchPromiseRef.current = continuePromise;
			await continuePromise;
			dispatch((state) => ({ ...state, statusMessage: 'Received response' }));
		} catch (contErr) {
			dispatch((state) => ({ ...state, statusMessage: `Error continuing: ${contErr.message}` }));
		} finally {
			isAutoContinuingRef.current = false;
			autoContinueCountRef.current++;
		}

		return true;
	}, [config, dispatch, dispatchProvider, sessionState, shouldAbort, createStreamingCallback, addMessage]);

	/**
	 * Finalize a streaming session.
	 * @param {string} responseContent - The final response content
	 */
	const finalizeStreaming = useCallback((responseContent) => {
		dispatch((state) => {
			const cloned = [...state.messages];
			const last = cloned[cloned.length - 1];
			if (last?.role === 'assistant' && last?.streaming) {
				last.content = responseContent;
				last.reasoningContent = committedReasoningRef.current || undefined;
				last.streaming = false;
				last.activeToolCall = null;
				if (lastToolCallDisplayRef.current) {
					last.toolCallDisplay = lastToolCallDisplayRef.current;
				}
				if (todoStatusLinesRef.current) {
					last.toolCallDisplay = last.toolCallDisplay
						? last.toolCallDisplay + '\n' + todoStatusLinesRef.current
						: todoStatusLinesRef.current;
				}
			}
			return { ...state, messages: cloned };
		});
		dispatch((state) => ({ ...state, isStreaming: false }));
	}, [dispatch]);

	/**
	 * Handle interruption (abort).
	 * @returns {Promise<void>}
	 */
	const stopStreaming = useCallback(async () => {
		if (abortControllerRef.current) {
			abortControllerRef.current.abort();
			abortControllerRef.current = null;
		}
		isStreamingRef.current = false;

		dispatch((state) => {
			const cloned = [...state.messages];
			const last = cloned[cloned.length - 1];
			if (last?.role === 'assistant' && last?.streaming) {
				last.streaming = false;
			}
			return { ...state, messages: cloned };
		});
		dispatch((state) => ({ ...state, isStreaming: false, statusMessage: 'Interrupted.' }));

		// Wait for dispatch to complete
		const dispatchPromise = dispatchPromiseRef.current;
		dispatchPromiseRef.current = null;
		if (dispatchPromise) {
			try {
				await dispatchPromise;
			} catch (_err) {
				// AbortError is expected
			}
		}
	}, [dispatch]);

	/**
	 * Clean up after an aborted or errored stream.
	 * @param {Object} options
	 * @param {boolean} options.isAbort - Whether this was an abort
	 * @param {Function} options.sessionState - Session state manager
	 * @param {Function} options.checkpointer - Checkpointer
	 */
	const cleanupAfterStream = useCallback(({ isAbort, sessionState, checkpointer }) => {
		if (isAbort && sessionState) {
			sessionState.popExchange();
		}
		if (isAbort) {
			dispatch((state) => ({
				...state,
				messages: state.messages.filter((m) => !m.streaming),
			}));
		}
		if (checkpointer && sessionState) {
			try {
				const threadId = sessionState.getThreadId();
				if (typeof checkpointer.deleteThread === 'function') {
					checkpointer.deleteThread(threadId);
				}
			} catch (_chkErr) {
				// Not critical
			}
		}
	}, [dispatch]);

	// Expose the streaming state
	const streamingState = {
		isStreaming: isStreamingRef.current,
		isAutoContinuing: isAutoContinuingRef.current,
		autoContinueCount: autoContinueCountRef.current,
		signal: abortControllerRef.current?.signal,
	};

	return {
		startStreaming,
		handleAutoContinue,
		finalizeStreaming,
		stopStreaming,
		cleanupAfterStream,
		shouldAbort,
		streamingState,
	};
}
