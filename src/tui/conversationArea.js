import React, {
	useState,
	useEffect,
	useRef,
	useCallback,
	forwardRef,
	useImperativeHandle,
} from "react";
import { Box } from "ink";
import { ConversationPanel, formatTime } from "./conversationPanel.js";
import { CommandParser } from "./commandParser.js";
import { createSession } from "../session/factory.js";
import { setConfigValue } from "../config/loader.js";
import { isAvailable, getGcCalls } from "../memory/gc.js";
import { loadSystemPrompt } from "../memory/prompts.js";
import { calculateConversationTokens } from "./contextTokens.js";
import { logger } from "../shared/logger.js";

/**
 * ConversationArea — owns all conversation and streaming state.
 * Communicates with InputArea exclusively via stable App-provided callbacks.
 * @type {React.ForwardRefRenderFunction}
 */
const ConversationArea = forwardRef(function ConversationArea(
	{
		config,
		registry,
		sessionState,
		dispatchProvider,
		scheduleManager,
		onSaveSession,
		gcManager,
		gcTrigger,
		onStatusChange,
		onContextChange,
		onCompactingChange,
		onInterruptInput,
		onQuit,
		onNewSession,
		messageCountRef,
	},
	ref,
) {
	const [contextSize, setContextSize] = useState(0);
	const [, setIsCompacting] = useState(false);
	const messageListRef = useRef(null);
	const abortControllerRef = useRef(null);
	const isStreamingRef = useRef(false);
	const dispatchPromiseRef = useRef(null);
	const autoContinueCountRef = useRef(0);
	const isAutoContinuingRef = useRef(false);
	const streamingMsgIdRef = useRef(null);
	const tokenCacheRef = useRef({ content: "", tokens: 0 });

	const skillList = registry ? registry.list() : [];
	const parser = new CommandParser();

	// Register global error handlers once on mount, remove on unmount
	useEffect(() => {
		function onUncaught(err) {
			addMessage({ role: "system", content: `Uncaught error: ${err.message}` });
		}
		function onUnhandled(reason) {
			const msg = reason?.message || String(reason);
			addMessage({ role: "system", content: `Unhandled rejection: ${msg}` });
		}
		process.on("uncaughtException", onUncaught);
		process.on("unhandledRejection", onUnhandled);
		// Initialize contextSize from the current conversation token count + system prompt
		if (sessionState) {
			updateContextSize(sessionState, config);
		}
		return () => {
			process.off("uncaughtException", onUncaught);
			process.off("unhandledRejection", onUnhandled);
		};
	}, []);

	/**
	 * Interrupt the current streaming response.
	 */
	const handleInterrupt = async () => {
		// Abort any active stream
		if (abortControllerRef.current) {
			abortControllerRef.current.abort();
			abortControllerRef.current = null;
		}
		isStreamingRef.current = false;

		// Clear input buffer via callback to InputArea
		onInterruptInput?.();

		// Clean up session state if needed
		if (sessionState) {
			sessionState.removeLastAssistantToolCallMessage();
			sessionState.popExchange();
		}

		// Reset abort controller and streaming flags
		abortControllerRef.current = new AbortController();
		isStreamingRef.current = false;

		// Update message list if there's a streaming message
		if (streamingMsgIdRef.current) {
			messageListRef.current?.updateMessage(streamingMsgIdRef.current, {
				streaming: false,
			});
		}

		// Set status message for visual feedback
		onStatusChange?.("Interrupted.");

		// Wait for the dispatchProvider promise to resolve
		const dispatchPromise = dispatchPromiseRef.current;
		dispatchPromiseRef.current = null;
		if (dispatchPromise) {
			try {
				await dispatchPromise;
			} catch (_err) {
				// AbortError is expected
			}
		}
	};

	/**
	 * Handle user input: parse commands or dispatch as chat.
	 */
	const handleCommand = async (trimmed) => {
		try {
			// Always show the user's command in the chat display
			addMessage({ role: "user", content: trimmed });

			const result = parser.parse(trimmed, {
				_sessionState: sessionState,
				_setConfigValue: (dotPath, valueStr) => {
					if (config) {
						setConfigValue(config, dotPath, valueStr);
					}
				},
				_scheduleList: scheduleManager ? scheduleManager.list() : [],
				_schedulePause: (name) => {
					scheduleManager?.pause(name);
					return scheduleManager.list();
				},
				_scheduleResume: (name) => {
					scheduleManager?.resume(name);
					return scheduleManager.list();
				},
				_contextList: false,
				_gcTrigger: gcTrigger,
				_gcStatus: gcTrigger
					? () => ({
							available: isAvailable(),
							calls: getGcCalls(),
							hourCalls: getGcCalls().length,
						})
					: null,
				_skillList: skillList,
				_executeSkill: async (skillName, _args) => {
					const skill = registry.get(skillName);
					if (!skill) {
						return {
							action: "skill",
							subAction: "error",
							message: `Skill "${skillName}" not found.`,
						};
					}
					const body = await registry.getSkillBody(skillName);
					return {
						action: "skill",
						subAction: "load",
						name: skillName,
						skillBody: body || "",
						message: body
							? `Skill "${skillName}" loaded.\n${body}`
							: `Skill "${skillName}" loaded. No instructions found.`,
					};
				},
			});
			if (result.action === "quit") {
				onQuit?.();
				return;
			}
			if (result.action === "new") {
				onNewSession?.();
				return;
			}
			if (result.action === "clear") {
				messageListRef.current?.clear();
				onStatusChange?.(result.message || "Conversation cleared.");
				return;
			}
			if (result.action === "unknown") {
				onStatusChange?.(result.message);
				return;
			}
			if (result.action === "skill" && result.subAction === "load" && result.skillBody) {
				gcManager?.();
				onStatusChange?.("Streaming...");

				if (sessionState) {
					sessionState.addExchange({ role: "user", content: trimmed });
				}

				const assistantTime = getTimestamp();
				streamingMsgIdRef.current = messageListRef.current.addMessage("assistant", "", {
					time: assistantTime,
					streaming: true,
				});

				let committedContentRef = { current: "" };
				let committedReasoning = "";
				let lastToolCallDisplay = "";
				let todoStatusLines = "";

				// Set up abort controller for this stream
				abortControllerRef.current = new AbortController();
				isStreamingRef.current = true;

				try {
					const preStreamContextSize = contextSize;

					const dispatchPromise = dispatchProvider(
						result.skillBody,
						sessionState ? sessionState.getProvider() : null,
						createStreamingHandler(
							committedContentRef,
							{ current: "" },
							{ current: "" },
							undefined,
							preStreamContextSize,
							setContextSize,
						),
						abortControllerRef.current?.signal,
					);

					dispatchPromiseRef.current = dispatchPromise;
					await dispatchPromise;

					let responseContent = committedContentRef.current;

					if (!responseContent.trim() && !shouldAbort()) {
						if (lastToolCallDisplay) {
							messageListRef.current?.updateMessage(streamingMsgIdRef.current, {
								toolCallDisplay: lastToolCallDisplay,
							});
						}

						if (autoContinueCountRef.current >= (config?.agent?.autoContinueLimit ?? 1000)) {
							onStatusChange?.("Model appears stuck — starting fresh.");
							messageListRef.current?.updateMessage(streamingMsgIdRef.current, {
								streaming: false,
							});
							autoContinueCountRef.current = 0;
							addMessage({
								role: "system",
								content: `I've tried to continue ${config?.agent?.autoContinueLimit ?? 1000} times with no text output. The model may be stuck in a reasoning loop. Please try a new conversation or rephrase your request.`,
							});
							return;
						}

						onStatusChange?.("Continuing...");
						isAutoContinuingRef.current = true;
						try {
							const continuePromise = dispatchProvider(
								"Please continue.",
								sessionState ? sessionState.getProvider() : null,
								createStreamingHandler(
									committedContentRef,
									() => {
										isAutoContinuingRef.current = false;
									},
									preStreamContextSize,
									setContextSize,
								),
								abortControllerRef.current?.signal,
							);
							dispatchPromiseRef.current = continuePromise;
							await continuePromise;
							onStatusChange?.("Done");
						} catch (contErr) {
							onStatusChange?.(`Error continuing: ${contErr.message}`);
						} finally {
							isAutoContinuingRef.current = false;
							autoContinueCountRef.current++;
						}
					}

					if (shouldAbort()) return;

					finalizeStreaming(
						responseContent,
						committedReasoning,
						lastToolCallDisplay,
						todoStatusLines,
					);

					if (sessionState) {
						sessionState.addExchange({
							role: "assistant",
							content: responseContent,
						});
					}
				} catch (err) {
					if (err.name === "AbortError") {
						if (sessionState) {
							sessionState.popExchange();
						}
						messageListRef.current?.updateMessage(streamingMsgIdRef.current, {
							streaming: false,
						});
						onStatusChange?.("Interrupted.");
					} else {
						messageListRef.current?.updateMessage(streamingMsgIdRef.current, {
							streaming: false,
						});
						onStatusChange?.(`Error: ${err.message}`);
					}
				} finally {
					abortControllerRef.current = null;
					isStreamingRef.current = false;
				}
			} else if (result.action !== "help" && result.action !== "skill") {
				onStatusChange?.(result.message || result.action + " executed");
			}
			if (
				result.message &&
				result.action !== "provider" &&
				result.action !== "schedule" &&
				result.action !== "skill"
			) {
				addMessage({ role: "system", content: result.message });
			}
		} catch (err) {
			addMessage({ role: "system", content: `Command error: ${err.message}` });
			onStatusChange?.("Something went wrong");
		}
	};

	const handleChat = async (text) => {
		if (shouldAbort()) return;
		gcManager?.();
		onStatusChange?.("Streaming...");
		addMessage({ role: "user", content: text });

		if (sessionState) {
			sessionState.addExchange({ role: "user", content: text });
			updateContextSize(sessionState, config);
		}

		const assistantTime = getTimestamp();
		streamingMsgIdRef.current = messageListRef.current.addMessage("assistant", "", {
			time: assistantTime,
			streaming: true,
		});

		let committedContentRef = { current: "" };
		let committedReasoning = "";
		let lastToolCallDisplay = "";
		let todoStatusLines = "";

		abortControllerRef.current = new AbortController();
		isStreamingRef.current = true;

		try {
			const preStreamContextSize = contextSize;

			const dispatchPromise = dispatchProvider(
				text,
				sessionState ? sessionState.getProvider() : null,
				createStreamingHandler(
					committedContentRef,
					{ current: "" },
					{ current: "" },
					undefined,
					preStreamContextSize,
					setContextSize,
				),
				abortControllerRef.current?.signal,
			);

			dispatchPromiseRef.current = dispatchPromise;
			const _response = await dispatchPromise;

			let responseContent = committedContentRef.current;

			if (!responseContent.trim() && !shouldAbort()) {
				if (lastToolCallDisplay) {
					messageListRef.current?.updateMessage(streamingMsgIdRef.current, {
						toolCallDisplay: lastToolCallDisplay,
					});
				}

				if (autoContinueCountRef.current >= (config?.agent?.autoContinueLimit ?? 1000)) {
					onStatusChange?.("Model appears stuck — starting fresh.");
					messageListRef.current?.updateMessage(streamingMsgIdRef.current, {
						streaming: false,
					});
					autoContinueCountRef.current = 0;
					addMessage({
						role: "system",
						content: `I've tried to continue ${config?.agent?.autoContinueLimit ?? 1000} times with no text output. The model may be stuck in a reasoning loop. Please try a new conversation or rephrase your request.`,
					});
					return;
				}

				onStatusChange?.("Continuing...");
				isAutoContinuingRef.current = true;
				try {
					const continuePromise = dispatchProvider(
						"Please continue.",
						sessionState ? sessionState.getProvider() : null,
						createStreamingHandler(
							committedContentRef,
							{ current: "" },
							{ current: "" },
							() => {
								isAutoContinuingRef.current = false;
							},
							preStreamContextSize,
							setContextSize,
						),
						abortControllerRef.current?.signal,
					);
					dispatchPromiseRef.current = continuePromise;
					await continuePromise;
					onStatusChange?.("Received response");
				} catch (contErr) {
					onStatusChange?.(`Error continuing: ${contErr.message}`);
				} finally {
					isAutoContinuingRef.current = false;
					autoContinueCountRef.current++;
				}
			}

			if (shouldAbort()) return;

			if (sessionState) {
				sessionState.addExchange({ role: "user", content: text });
			}

			finalizeStreaming(responseContent, committedReasoning, lastToolCallDisplay, todoStatusLines);

			if (sessionState) {
				sessionState.addExchange({
					role: "assistant",
					content: responseContent,
				});
				updateContextSize(sessionState, config);
			}
			if (onSaveSession) {
				onSaveSession();
			}
			gcManager?.();
			onStatusChange?.("Received response");
		} catch (err) {
			if (err.name === "AbortError") {
				if (sessionState) {
					sessionState.removeLastAssistantToolCallMessage();
					sessionState.popExchange();
				}
				onStatusChange?.("Interrupted.");
			} else {
				if (onSaveSession) {
					onSaveSession();
				}
				onStatusChange?.("Something went wrong");
				addMessage({
					role: "system",
					content: `I couldn't connect right now - ${err.message}. Try sending your message again?`,
				});
			}
		} finally {
			abortControllerRef.current = null;
			isStreamingRef.current = false;
		}
		gcManager?.();
	};

	/**
	 * Check if the current stream should be aborted.
	 */
	const shouldAbort = () => {
		if (abortControllerRef.current?.signal?.aborted) return true;
		return false;
	};

	/**
	 * Start a new session.
	 */
	const handleNewSession = async () => {
		if (onSaveSession) {
			await onSaveSession();
		}
		const newSession = createSession({ provider: sessionState.getProvider() });
		sessionState.createNewSession(newSession.sessionId);
		setIsCompacting(false);
		onCompactingChange?.(false);
		messageListRef.current?.clear();
		setContextSize(0);
		onContextChange?.(0);
		onStatusChange?.("New session started.");
		addMessage({
			role: "system",
			content: `New session started (thread: ${newSession.sessionId.slice(0, 8)}...).`,
		});
	};

	/**
	 * Generate a timestamp string in HH:MM format.
	 * @returns {string}
	 */
	const getTimestamp = () => formatTime(new Date());

	/**
	 * Calculate total context tokens (conversation + system prompt) and set contextSize.
	 */
	const updateContextSize = useCallback(
		(sessionState, config) => {
			if (!sessionState) return;
			const conversation = sessionState.getConversation();
			const providerName = sessionState.getProvider();
			const providerConfig = config?.providers?.[providerName] || {};
			const modelName = providerConfig.model || "gpt-4o";
			const encoding = providerConfig.encoding;

			let totalTokens = calculateConversationTokens(conversation, modelName, encoding);
			loadSystemPrompt().then((systemPrompt) => {
				if (systemPrompt) {
					totalTokens += calculateConversationTokens(
						[{ role: "system", content: systemPrompt }],
						modelName,
						encoding,
					);
				}
				setContextSize(totalTokens);
				onContextChange?.(totalTokens);
			});
		},
		[calculateConversationTokens],
	);

	const addMessage = (msg) => {
		const time = getTimestamp();
		messageListRef.current?.addMessage(msg.role, msg.content, { time });
		if (messageCountRef) {
			messageCountRef.current = messageListRef.current?.getMessageCount() || 0;
		}
	};

	/**
	 * Streaming event handler.
	 */
	const createStreamingHandler = useCallback(
		(
			committedContentRef,
			committedReasoningRef,
			lastToolCallDisplayRef,
			onTextReceived,
			preStreamContextSize,
			onContextUpdate,
		) => {
			return (event) => {
				if (shouldAbort()) return;
				try {
					const currentEvents =
						messageListRef.current?.getMessageData(streamingMsgIdRef.current)?.events || [];
					messageListRef.current?.updateMessage(streamingMsgIdRef.current, {
						events: [...currentEvents, event],
					});

					if (event.type === "message") {
						const newText = event.data?.text || event.text || "";
						committedContentRef.current = (committedContentRef.current || "") + newText;
						messageListRef.current?.updateMessage(streamingMsgIdRef.current, {
							content: committedContentRef.current,
							streaming: true,
						});
						messageListRef.current?._triggerRender();
						if (onTextReceived) onTextReceived();
						if (committedContentRef.current && preStreamContextSize != null && onContextUpdate) {
							const cached = tokenCacheRef.current;
							if (cached.content !== committedContentRef.current) {
								cached.content = committedContentRef.current;
								cached.tokens = calculateConversationTokens(
									[{ role: "assistant", content: committedContentRef.current }],
									config?.providers?.[sessionState?.getProvider()]?.model || "gpt-4o",
									config?.providers?.[sessionState?.getProvider()]?.encoding,
								);
							}
							onContextUpdate(preStreamContextSize + cached.tokens);
						}
					}

					if (event.type === "on_chat_model_stream") {
						if (event.data?.chunk?.content) {
							const chunkContent = event.data.chunk.content;
							committedContentRef.current = (committedContentRef.current || "") + chunkContent;
							messageListRef.current?.updateMessage(streamingMsgIdRef.current, {
								content: committedContentRef.current,
								streaming: true,
							});
							messageListRef.current?._triggerRender();
						}
						if (event.data?.chunk?.reasoning) {
							committedReasoningRef.current =
								(committedReasoningRef.current || "") + event.data.chunk.reasoning;
						}
					}

					if (event.type === "on_tool_start") {
						messageListRef.current?.updateMessage(streamingMsgIdRef.current, {
							activeToolCall: {
								name: event.name,
								input: event.data?.input,
								status: "running",
							},
						});
					}

					if (event.type === "on_tool_end") {
						messageListRef.current?.updateMessage(streamingMsgIdRef.current, {
							activeToolCall: null,
						});
						if (event.data?.output) {
							lastToolCallDisplayRef.current =
								(lastToolCallDisplayRef.current || "") + event.data.output;
							messageListRef.current?.updateMessage(streamingMsgIdRef.current, {
								toolCallDisplay: lastToolCallDisplayRef.current,
							});
						}
					}

					if (event.type === "on_tool_error") {
						messageListRef.current?.updateMessage(streamingMsgIdRef.current, {
							activeToolCall: {
								name: event.name,
								error: event.data?.error,
								status: "error",
							},
						});
					}
				} catch (cbErr) {
					logger.debug(`[streaming] callback error: ${cbErr.message}`);
				}
			};
		},
	);

	/**
	 * Finalize streaming message.
	 */
	const finalizeStreaming = (
		responseContent,
		committedReasoning,
		lastToolCallDisplay,
		todoStatusLines,
	) => {
		const updates = {
			content: responseContent,
			reasoningContent: committedReasoning || undefined,
			streaming: false,
			activeToolCall: null,
		};
		if (lastToolCallDisplay) {
			updates.toolCallDisplay = lastToolCallDisplay;
		}
		if (todoStatusLines) {
			const prevTool = messageListRef.current?.getMessageData(
				streamingMsgIdRef.current,
			)?.toolCallDisplay;
			if (prevTool) {
				updates.toolCallDisplay = prevTool + "\n" + todoStatusLines;
			} else {
				updates.toolCallDisplay = todoStatusLines;
			}
		}
		messageListRef.current?.updateMessage(streamingMsgIdRef.current, updates);
	};

	// Expose imperative methods to App
	useImperativeHandle(ref, () => ({
		interrupt: handleInterrupt,
		handleCommand,
		handleChat,
		newSession: handleNewSession,
		clear: () => messageListRef.current?.clear(),
		addMessage,
		scrollBy: (delta) => messageListRef.current?.scrollBy(delta),
		getViewportHeight: () =>
			messageListRef.current?.getScrollRef()?.current?.getViewportHeight?.() || 1,
		messageCountRef,
		isStreaming: () => isStreamingRef.current,
	}));

	return React.createElement(
		Box,
		{ key: "conversation-wrapper", flexDirection: "column", flexGrow: 1 },
		React.createElement(ConversationPanel, {
			assistantName: config?.tui?.name || "Assistant",
			messageListRef,
		}),
	);
});

export default ConversationArea;
