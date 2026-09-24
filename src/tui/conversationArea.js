import React, {
	useState,
	useEffect,
	useRef,
	useCallback,
	forwardRef,
	useImperativeHandle,
} from "react";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { Box } from "ink";
import { ConversationPanel, formatTime } from "./conversationPanel.js";
import { CommandParser } from "./commandParser.js";
import { createSession } from "../session/factory.js";
import { setConfigValue } from "../config/loader.js";
import { isAvailable, getGcCalls } from "../memory/gc.js";
import { loadSystemPrompt } from "../memory/prompts.js";
import { calculateConversationTokens } from "./contextTokens.js";
import { estimateContextCost } from "../provider/tokenBudgetMiddleware.js";
import { logger } from "../shared/logger.js";

/**
 * Determine whether a completed turn should trigger a silent auto-continue.
 *
 * A turn is "reasoning-only" when the stream ended with reasoning segments
 * present but no message segments. In that case the model produced thinking
 * but no actual response, so we dispatch a silent "continue" to nudge it.
 *
 * @param {Array<{type: string, content: string}>} [segments] - The message's ordered content segments
 * @returns {boolean} True if a silent auto-continue should be dispatched
 */
export function shouldAutoContinue(segments) {
	const segs = segments || [];
	const hasReasoning = segs.some((s) => s.type === "reasoning");
	const hasMessage = segs.some((s) => s.type === "message");
	return hasReasoning && !hasMessage;
}

/**
 * Compute the total context token count: conversation + full system prompt
 * (SYSTEM_PROMPT + AGENTS.md) + output budget. Mirrors the system prompt
 * construction in `createDeepAgentsOrchestrator` and the token-budget
 * middleware's `estimateCost`, so the TUI context counter reflects the same
 * context window the model sees.
 * @param {Object} params - Computation inputs
 * @param {Array} params.conversation - Conversation messages
 * @param {string} params.systemPrompt - Base system prompt (SYSTEM_PROMPT + memory context)
 * @param {string} [params.agentsContent] - AGENTS.md content, appended when present
 * @param {number} [params.maxTokens] - Output token budget added to the count
 * @param {string} [params.modelName] - Model name for tiktoken resolution
 * @param {string} [params.encoding] - Explicit tiktoken encoding name
 * @param {Array} [params.tools] - Orchestrator tool definitions (StructuredTool[])
 * @param {Array} [params.subagents] - Subagent definitions whose descriptions are
 *   embedded in the `task` tool the orchestrator sees
 * @returns {Promise<number>} Total context token count
 */
export async function computeContextSize({
	conversation,
	systemPrompt,
	agentsContent,
	maxTokens,
	modelName,
	encoding,
	tools,
	subagents,
}) {
	let totalTokens = await estimateContextCost(conversation, {
		model: modelName,
		encoding,
		maxTokens,
		tools,
	});
	let fullSystemPrompt = systemPrompt;
	if (agentsContent) {
		fullSystemPrompt = systemPrompt + "\n\n---\n\n" + agentsContent;
	}
	if (fullSystemPrompt) {
		totalTokens += await calculateConversationTokens(
			[{ role: "system", content: fullSystemPrompt }],
			modelName,
			encoding,
		);
	}
	// The orchestrator's request includes a `task` tool whose description embeds
	// every subagent description (deepagents renders these via
	// describeSubagentForTool as `- <name>: <description>`). Count those lines.
	if (subagents && subagents.length > 0) {
		const subagentLines = subagents.map((s) => `- ${s.name}: ${s.description || ""}`).join("\n");
		totalTokens += await calculateConversationTokens(
			[{ role: "system", content: subagentLines }],
			modelName,
			encoding,
		);
	}
	return totalTokens;
}

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
		onViewChange,
		messageCountRef,
		contextEstimate,
	},
	ref,
) {
	const [contextSize, setContextSize] = useState(0);
	const [, setIsCompacting] = useState(false);
	// Wrapper that updates both local state and the status bar (via InputArea)
	const updateContextDisplay = useCallback(
		(size) => {
			setContextSize(size);
			onContextChange?.(size);
		},
		[setContextSize, onContextChange],
	);
	const messageListRef = useRef(null);
	const abortControllerRef = useRef(null);
	const isStreamingRef = useRef(false);
	const dispatchPromiseRef = useRef(null);
	const streamingMsgIdRef = useRef(null);
	const tokenCacheRef = useRef({ content: "", tokens: 0 });
	const contextUpdateTimerRef = useRef(null);
	const pendingContextRef = useRef({ content: "" });

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

	// On mount, load any existing conversation from session state.
	// This covers session resume: the panel populates sessionState before
	// switching back to the conversation view, and this component mounts
	// fresh (the ref is null during the synchronous view change, so the
	// App-level loadConversation call is a no-op).
	useEffect(() => {
		const conv = sessionState?.getConversation();
		if (conv && conv.length > 0) {
			messageListRef.current?.clear();
			for (const exchange of conv) {
				if (exchange.role && exchange.content !== undefined) {
					messageListRef.current?.addMessage(exchange.role, exchange.content, {
						time: exchange.timestamp,
					});
				}
			}
			if (messageCountRef) {
				messageCountRef.current = messageListRef.current?.getMessageCount() || 0;
			}
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
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
				_onViewChange: onViewChange,
				_skillList: skillList,
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
			if (result.action === "view") {
				onViewChange?.(result.value);
				return;
			}
			if (result.action === "skill" && result.subAction === "invoke") {
				// Route /SKILL through the deepagents skill system by synthesizing the
				// "Run the <skill> skill [args]" prompt and dispatching it via handleChat.
				// The synthesized prompt is silent — it stays out of the TUI message list
				// (and is not rendered as a user message), but the agent's streaming
				// response still renders normally.
				const skillPrompt = `Run the ${result.name} skill${result.args?.length ? " " + result.args.join(" ") : ""}`;
				await handleChat(skillPrompt, { silentUser: true });
			} else {
				// Show the user's command in the chat display for non-skill commands
				addMessage({ role: "user", content: trimmed });
				if (result.action !== "help" && result.action !== "skill") {
					onStatusChange?.(result.message || result.action + " executed");
				}
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

	const handleChat = async (text, options = {}) => {
		if (shouldAbort()) return;
		gcManager?.();
		onStatusChange?.("Streaming...");
		// silentUser: dispatch the message without rendering it as a user message
		// in the TUI (e.g., synthesized skill prompts). The assistant's streaming
		// response still renders normally.
		if (!options.silentUser) {
			addMessage({ role: "user", content: text });
		}

		if (sessionState) {
			sessionState.addExchange({ role: "user", content: text });
			updateContextSize(sessionState, config);
		}

		const assistantTime = getTimestamp();
		const turnStartTime = Date.now();
		streamingMsgIdRef.current = messageListRef.current.addMessage("assistant", "", {
			time: assistantTime,
			streaming: true,
			turnStartTime,
		});
		if (messageCountRef) {
			messageCountRef.current = messageListRef.current?.getMessageCount() || 0;
		}

		let committedContentRef = { current: "" };
		const committedReasoningRef = { current: "" };
		const lastToolCallDisplayRef = { current: "" };
		let todoStatusLines = "";
		/** @type {string[]} */
		const completedToolCalls = [];

		abortControllerRef.current = new AbortController();
		isStreamingRef.current = true;

		try {
			const preStreamContextSize = contextSize;

			const dispatchPromise = dispatchProvider(
				text,
				sessionState ? sessionState.getProvider() : null,
				createStreamingHandler(
					committedContentRef,
					committedReasoningRef,
					lastToolCallDisplayRef,
					undefined,
					preStreamContextSize,
					updateContextDisplay,
					completedToolCalls,
					turnStartTime,
				),
				abortControllerRef.current?.signal,
			);

			dispatchPromiseRef.current = dispatchPromise;
			const _response = await dispatchPromise;

			let responseContent = committedContentRef.current;
			const committedReasoning = committedReasoningRef.current;

			// Reasoning-only completion: the stream ended with reasoning but no
			// message content. Dispatch a silent "continue" so the model produces
			// an actual response. The signal is the bubble's streaming flag turning
			// false (stream complete) combined with reasoning segments and no
			// message segments.
			if (!shouldAbort()) {
				const msgData = messageListRef.current?.getMessageData(streamingMsgIdRef.current);
				const segments = msgData?.segments || [];

				if (shouldAutoContinue(segments)) {
					// Finalize the reasoning bubble so its timer stops, then dispatch
					// a silent continue that streams into a fresh assistant bubble.
					finalizeStreaming(
						responseContent,
						committedReasoning,
						lastToolCallDisplayRef.current,
						todoStatusLines,
						turnStartTime,
						completedToolCalls,
					);
					await handleChat("Please continue.", { silentUser: true });
					return;
				}
			}

			if (shouldAbort()) return;

			finalizeStreaming(
				responseContent,
				committedReasoning,
				lastToolCallDisplayRef.current,
				todoStatusLines,
				turnStartTime,
				completedToolCalls,
			);

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
	 * Calculate total context tokens (conversation + system prompt + AGENTS.md +
	 * output budget) and set contextSize. Mirrors the system prompt construction
	 * in `createDeepAgentsOrchestrator` so the count includes AGENTS.md, and adds
	 * the configured output budget (`maxTokens`) to match the token-budget
	 * middleware's `estimateCost`.
	 */
	const updateContextSize = useCallback(
		async (sessionState, config) => {
			// Cancel any pending debounced update so a stale streaming-era
			// value doesn't overwrite this accurate full-conversation recount.
			if (contextUpdateTimerRef.current) {
				clearTimeout(contextUpdateTimerRef.current);
				contextUpdateTimerRef.current = null;
			}
			if (!sessionState) return;
			const conversation = sessionState.getConversation();
			const providerName = sessionState.getProvider();
			const providerConfig = config?.providers?.[providerName] || {};
			const modelName = providerConfig.model || "gpt-4o";
			const encoding = providerConfig.encoding;
			const maxTokens = providerConfig.maxTokens || 0;

			const systemPrompt = await loadSystemPrompt();
			// Append AGENTS.md the same way createDeepAgentsOrchestrator does, so
			// the context counter reflects the full system prompt the model sees.
			let agentsContent;
			const agentsPath = join(config?.cwd || process.cwd(), "AGENTS.md");
			try {
				agentsContent = await readFile(agentsPath, "utf-8");
			} catch {
				logger.debug(`[conversationArea] Failed to load AGENTS.md: ${agentsPath}`);
			}
			const totalTokens = await computeContextSize({
				conversation,
				systemPrompt,
				agentsContent,
				maxTokens,
				modelName,
				encoding,
				tools: contextEstimate?.tools,
				subagents: contextEstimate?.subagents,
			});
			setContextSize(totalTokens);
			onContextChange?.(totalTokens);
		},
		[calculateConversationTokens, contextEstimate],
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
			completedToolCalls = [],
		) => {
			// Debounced context size update — coalesces rapid chunks into a single
			// token calculation every ~200ms so the status bar stays responsive.
			const debouncedContextUpdate = (content) => {
				if (contextUpdateTimerRef.current) {
					clearTimeout(contextUpdateTimerRef.current);
				}
				pendingContextRef.current.content = content;
				contextUpdateTimerRef.current = setTimeout(async () => {
					contextUpdateTimerRef.current = null;
					const text = pendingContextRef.current.content;
					if (!text || preStreamContextSize == null || !onContextUpdate) return;
					const cached = tokenCacheRef.current;
					if (cached.content !== text) {
						cached.content = text;
						cached.tokens = await calculateConversationTokens(
							[{ role: "assistant", content: text }],
							config?.providers?.[sessionState?.getProvider()]?.model || "gpt-4o",
							config?.providers?.[sessionState?.getProvider()]?.encoding,
						);
					}
					onContextUpdate(preStreamContextSize + cached.tokens);
				}, 33);
			};

			return async (event) => {
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
							segments: [{ type: "message", content: newText }],
							content: committedContentRef.current,
							streaming: true,
						});
						messageListRef.current?._triggerRender();
						if (onTextReceived) onTextReceived();
						debouncedContextUpdate(committedContentRef.current);
					}

					if (event.type === "reasoning") {
						const reasoningText = event.data?.text || event.text || "";
						if (reasoningText) {
							if (
								!(
									committedReasoningRef.current.endsWith(".") ||
									committedReasoningRef.current.endsWith("?") ||
									committedReasoningRef.current.endsWith("!")
								) &&
								!/^[A-Z]/.test(reasoningText)
							) {
								committedReasoningRef.current =
									(committedReasoningRef.current || "") + reasoningText;
							}
							messageListRef.current?.updateMessage(streamingMsgIdRef.current, {
								segments: [{ type: "reasoning", content: reasoningText }],
								streaming: true,
							});
							messageListRef.current?._triggerRender();
						}
					}

					if (event.type === "on_chat_model_stream") {
						if (event.data?.chunk?.content) {
							const chunkContent = event.data.chunk.content;
							committedContentRef.current = (committedContentRef.current || "") + chunkContent;
							messageListRef.current?.updateMessage(streamingMsgIdRef.current, {
								segments: [{ type: "message", content: chunkContent }],
								content: committedContentRef.current,
								streaming: true,
							});
							messageListRef.current?._triggerRender();
							debouncedContextUpdate(committedContentRef.current);
						}
						if (event.data?.chunk?.reasoning) {
							const reasoningChunk = event.data.chunk.reasoning;
							if (
								!(
									committedReasoningRef.current.endsWith(".") ||
									committedReasoningRef.current.endsWith("?") ||
									committedReasoningRef.current.endsWith("!")
								) &&
								!/^[A-Z]/.test(reasoningChunk)
							) {
								committedReasoningRef.current =
									(committedReasoningRef.current || "") + reasoningChunk;
							}
							messageListRef.current?.updateMessage(streamingMsgIdRef.current, {
								segments: [{ type: "reasoning", content: reasoningChunk }],
								streaming: true,
							});
							messageListRef.current?._triggerRender();
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
						completedToolCalls.push(event.name);
						messageListRef.current?.updateMessage(streamingMsgIdRef.current, {
							activeToolCall: null,
							completedToolCalls: [...completedToolCalls],
						});
					}

					if (event.type === "tool_result") {
						const toolText = event.data?.text || event.text || "";
						if (toolText) {
							lastToolCallDisplayRef.current =
								(lastToolCallDisplayRef.current ? lastToolCallDisplayRef.current + "\n" : "") +
								toolText;
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
		turnStartTime = 0,
		completedToolCalls = [],
	) => {
		const elapsed = turnStartTime ? Date.now() - turnStartTime : 0;
		const updates = {
			content: responseContent,

			streaming: false,
			activeToolCall: null,
			turnDuration: elapsed,
			completedToolCalls,
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
		/**
		 * Bulk-load conversation exchanges into the message list.
		 * Clears existing messages and repopulates from the array.
		 * @param {Array<{ role: string, content: string }>} conversation
		 */
		loadConversation: (conversation) => {
			messageListRef.current?.clear();
			if (Array.isArray(conversation)) {
				for (const exchange of conversation) {
					if (exchange.role && exchange.content !== undefined) {
						messageListRef.current?.addMessage(exchange.role, exchange.content, {
							time: exchange.timestamp,
						});
					}
				}
			}
			if (messageCountRef) {
				messageCountRef.current = messageListRef.current?.getMessageCount() || 0;
			}
		},
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
			showToolResults: config?.tui?.showToolResults,
			messageListRef,
		}),
	);
});

export default ConversationArea;
