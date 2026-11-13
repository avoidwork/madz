import React, {
	useState,
	useEffect,
	useRef,
	useCallback,
	useMemo,
	forwardRef,
	useImperativeHandle,
} from "react";
import { Box } from "ink";
import { AIMessage, HumanMessage, SystemMessage } from "@langchain/core/messages";
import { hasId } from "./messages.js";
import { sanitizeLine } from "./sanitize.js";
import { isCancelledToolEvent } from "../shared/cancelledToolMessage.js";
import { ConversationPanel } from "./conversationPanel.js";
import { CommandParser } from "./commandParser.js";
import { createSession } from "../session/factory.js";
import { setConfigValue } from "../config/loader.js";
import { isAvailable, getGcCalls } from "../memory/gc.js";
import { logger } from "../shared/logger.js";
import { formatClarifyPrompt } from "../shared/clarifyPrompt.js";

/**
/**
 * Count the token count of a tool-message text using the model's tokenizer.
 *
 * This is decoupled from display: the tool text is counted toward the live
 * context window but is never folded into the assistant's rendered content.
 *
 * @param {Object} model - The LLM model instance (may expose getNumTokensFromMessages)
 * @param {string} text - The tool-message text to count
 * @returns {Promise<number>} The token count (0 if the model has no tokenizer)
 */
export async function countToolMessageTokens(model, text) {
	if (!text) return 0;
	if (model && typeof model.getNumTokensFromMessages === "function") {
		const { totalCount } = await model.getNumTokensFromMessages([new AIMessage(text)]);
		return totalCount || 0;
	}
	return 0;
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
		resumeProvider,
		scheduleManager,
		onSaveSession,
		gcManager,
		gcTrigger,
		onContextChange,
		onCompactingChange,
		onStreamingChange,
		onInterruptInput,
		onSubagentUpdate,
		onQuit,
		onNewSession,
		onViewChange,
		messageCountRef,
		compactContext,
		getContextMessages,
		model,
		systemPrompt,
		activeProject,
		setActiveProject,
		selection,
		reasoningCollapsed,
		toolCallCollapsed,
		hidden = false,
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
	const toolMessageTokensRef = useRef(0);
	const contextUpdateTimerRef = useRef(null);
	const pendingContextRef = useRef({ content: "" });
	// Tracks a pending clarification question surfaced by the `clarify` tool.
	// When set, the next user input is treated as the answer and routed to
	// `resumeProvider` instead of dispatching a new message.
	const pendingClarifyRef = useRef(null);
	// Subagent store is lifted to App state. The streaming handler reports each
	// subagent_* event via onSubagentUpdate, which updates App's state and
	// re-renders the SUBAGENTS panel live. This component no longer owns the
	// store — it just forwards events upward.

	const skillList = useMemo(() => (registry ? registry.list() : []), [registry]);
	const parser = useMemo(() => new CommandParser(), []);

	// Latest addMessage for the long-lived process handlers below.
	const addMessageRef = useRef(null);

	// Register global error handlers once on mount, remove on unmount
	useEffect(() => {
		function onUncaught(err) {
			// An uncaught exception leaves the process in an undefined state:
			// restore the terminal, report it, and exit instead of continuing.
			try {
				process.stdout.write("\x1b[?1000l\x1b[?1002l\x1b[?1003l\x1b[?1006l");
			} catch {
				// stdout may be closed
			}
			process.stderr.write(`Uncaught error: ${err?.stack || err?.message || String(err)}\n`);
			process.exit(1);
		}
		function onUnhandled(reason) {
			const msg = sanitizeLine(reason?.message || String(reason));
			addMessageRef.current?.({ role: "system", content: `Unhandled rejection: ${msg}` });
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
			if (contextUpdateTimerRef.current) {
				clearTimeout(contextUpdateTimerRef.current);
				contextUpdateTimerRef.current = null;
			}
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
		// Abandon any pending clarification: the paused question no longer
		// applies, so the next message must not be routed to it as an answer.
		pendingClarifyRef.current = null;

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

		// Update message list if there's a streaming message. Set turnDuration
		// so the timer stays visible after an interrupt — the bubble renders the
		// timer when `localStreaming || localTurnDuration`, and a plain
		// `streaming: false` update leaves both falsy, hiding the elapsed time.
		if (streamingMsgIdRef.current) {
			const msgData = messageListRef.current?.getMessageData(streamingMsgIdRef.current);
			const startTime = msgData?.turnStartTime;
			const elapsed = startTime ? Date.now() - startTime : 0;
			messageListRef.current?.updateMessage(streamingMsgIdRef.current, {
				streaming: false,
				turnDuration: elapsed,
			});
		}

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
	 * Compact the context window on demand.
	 * Invokes the agent's compaction routine, syncs the TUI conversation view,
	 * recomputes the context size.
	 */
	const handleCompact = async () => {
		if (!compactContext) {
			addMessage({ role: "system", content: "Compaction is not available." });
			return;
		}
		const compactMsgId = addMessage({ role: "system", content: "Compacting context window..." });
		try {
			const result = await compactContext();
			if (result?.ok) {
				const parts = [];
				if (result.removedVision > 0) {
					parts.push(`${result.removedVision} vision message(s) removed`);
				}
				if (result.trimmed > 0) {
					parts.push(`${result.trimmed} message(s) trimmed`);
				}
				const detail = parts.length > 0 ? parts.join(", ") : "no changes needed";
				const msg = `Context compacted: ${detail}.`;
				messageListRef.current?.updateMessage(compactMsgId, { content: msg });
				// Recompute the context size so the status bar reflects the reduced window.
				await updateContextSize(sessionState, config);
			} else {
				const msg = `Compaction failed: ${result?.error || "unknown error"}`;
				messageListRef.current?.updateMessage(compactMsgId, { content: msg });
			}
		} catch (err) {
			const msg = `Compaction failed: ${err.message}`;
			messageListRef.current?.updateMessage(compactMsgId, { content: msg });
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
				_activeProject: activeProject,
				_setActiveProject: setActiveProject,
				_clearActiveProject: () => setActiveProject(""),
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
				return;
			}
			if (result.action === "compact") {
				await handleCompact();
				return;
			}
			if (result.action === "unknown") {
				return;
			}
			if (result.action === "view") {
				onViewChange?.(result.value);
				return;
			}
			if (result.action === "project" && result.subAction === "clear") {
				// Silently notify the agent that we've returned to the root directory.
				// The active project was already reset via _clearActiveProject above.
				await handleChat("We are now working in madz root directory", { silentUser: true });
			} else if (result.action === "skill" && result.subAction === "invoke") {
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
			}
			if (
				result.message &&
				result.action !== "provider" &&
				result.action !== "schedule" &&
				result.action !== "skill" &&
				result.action !== "project"
			) {
				addMessage({ role: "system", content: result.message });
			}
		} catch (err) {
			addMessage({ role: "system", content: `Command error: ${err.message}` });
		}
	};

	const handleChat = async (text, options = {}) => {
		if (shouldAbort()) return;
		gcManager?.();
		// Reset the tool-message token accumulator at the start of each turn so
		// tool tokens from a previous turn do not leak into the next.
		toolMessageTokensRef.current = 0;

		// If a clarification question is pending, the input is the user's answer.
		// Route it to `resumeProvider` to continue the paused agent rather than
		// dispatching a new message.
		if (pendingClarifyRef.current) {
			pendingClarifyRef.current = null;
			addMessage({ role: "user", content: text });
			if (sessionState) {
				// Record the answer so an abort during the resumed turn pops this
				// exchange rather than an unrelated earlier one.
				sessionState.addExchange({ role: "user", content: text });
			}
			await resumeClarify(text);
			return;
		}

		// silentUser: dispatch the message without rendering it as a user message
		// in the TUI (e.g., synthesized skill prompts). The assistant's streaming
		// response still renders normally.
		if (!options.silentUser) {
			addMessage({ role: "user", content: text });
		}

		if (sessionState) {
			sessionState.addExchange({ role: "user", content: text });
			// Build the full message set: the real checkpointer conversation
			// (which includes tool calls/messages) plus the just-sent user
			// message. On the first turn the checkpointer doesn't have the
			// message yet, so we append it explicitly rather than replacing the
			// whole conversation with a single message.
			let contextMessages = [];
			if (typeof getContextMessages === "function") {
				const ctx = await getContextMessages();
				if (ctx && ctx.length > 0) contextMessages = ctx;
			}
			updateContextSize(sessionState, config, [...contextMessages, new HumanMessage(text)]);
		}

		await runTurn((handler, signal) =>
			dispatchProvider(text, sessionState ? sessionState.getProvider() : null, handler, signal),
		);
	};

	/**
	 * Run one assistant turn: open a streaming bubble, dispatch to the provider,
	 * then finalize. Shared by normal chat and clarify resumes so the lifecycle
	 * (abort handling, session bookkeeping, cleanup) cannot drift between them.
	 * @param {(handler: Function, signal: AbortSignal) => Promise<Object>} dispatch - Starts the
	 *   provider call with the streaming handler and abort signal
	 * @returns {Promise<void>}
	 */
	const runTurn = async (dispatch) => {
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

		const committedContentRef = { current: "" };
		const committedReasoningRef = { current: "" };
		const lastToolCallDisplayRef = { current: "" };
		const todoStatusLines = "";
		/** @type {Object<string, number>} */
		const completedToolCalls = {};

		abortControllerRef.current = new AbortController();
		isStreamingRef.current = true;
		onStreamingChange?.(true);

		try {
			const preStreamContextSize = contextSize;

			const dispatchPromise = dispatch(
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
			const response = await dispatchPromise;

			const responseContent = committedContentRef.current;
			const committedReasoning = committedReasoningRef.current;

			if (shouldAbort()) return;

			finalizeStreaming(
				responseContent,
				committedReasoning,
				lastToolCallDisplayRef.current,
				todoStatusLines,
				turnStartTime,
				completedToolCalls,
			);

			// A turn that ended on a `clarify` interrupt is paused, not complete:
			// the agent has not produced its answer yet, so no assistant exchange
			// is recorded. The resumed turn records the real response.
			if (sessionState && !response?.interrupted) {
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
		} catch (err) {
			if (err.name === "AbortError") {
				if (sessionState) {
					sessionState.removeLastAssistantToolCallMessage();
					sessionState.popExchange();
				}
			} else {
				if (onSaveSession) {
					onSaveSession();
				}
				addMessage({
					role: "system",
					content: `I couldn't connect right now - ${err.message}. Try sending your message again?`,
				});
			}
		} finally {
			abortControllerRef.current = null;
			isStreamingRef.current = false;
			onStreamingChange?.(false);
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
		pendingClarifyRef.current = null;
		if (onSaveSession) {
			await onSaveSession();
		}
		const newSession = createSession({ provider: sessionState.getProvider() });
		sessionState.createNewSession(newSession.sessionId);
		setIsCompacting(false);
		onCompactingChange?.(false);
		messageListRef.current?.clear();
		// Recompute the context size for the fresh thread rather than hard-setting
		// 0. The system prompt (SYSTEM_PROMPT.md + AGENTS.md + memory context) is
		// still in the window even with an empty conversation, so the counter must
		// reflect that baseline — not a misleading 0.
		await updateContextSize(sessionState, config);
		addMessage({
			role: "system",
			content: `New session started (thread: ${newSession.sessionId.slice(0, 8)}...).`,
		});
	};

	/**
	 * Generate a raw timestamp for a message bubble. The bubble formats it at
	 * render time, so this returns a Date rather than a pre-formatted string.
	 * @returns {Date}
	 */
	const getTimestamp = () => new Date();

	/**
	 * Calculate total context tokens and set contextSize. Uses the model's own
	 * tokenizer via `model.getNumTokensFromMessages(messages)` so the count
	 * reflects the message set the model sees. The configured output budget
	 * (`maxTokens`) is deliberately NOT added — the status-bar context meter
	 * must reflect actual context usage against the context window, not the
	 * reserved output budget.
	 */
	/**
	 * Normalize a message into a real LangChain message object.
	 *
	 * `model.getNumTokensFromMessages` calls `_getType()` on each message, so
	 * plain `{ role, content }` objects (from `sessionState.getConversation()`)
	 * crash. Real LangChain messages (BaseMessage instances) pass through
	 * unchanged; plain objects are converted to the matching message class.
	 * @param {Object} message - A message from the conversation or graph state
	 * @returns {Object} A real LangChain message object
	 */
	const toLangChainMessage = (message) => {
		if (message && typeof message._getType === "function") return message;
		const role = message?.role || "user";
		const content = message?.content ?? "";
		if (role === "assistant") return new AIMessage(content);
		if (role === "system") return new SystemMessage(content);
		return new HumanMessage(content);
	};

	const updateContextSize = useCallback(
		async (sessionState, config, messages) => {
			// Cancel any pending debounced update so a stale streaming-era
			// value doesn't overwrite this accurate full-conversation recount.
			if (contextUpdateTimerRef.current) {
				clearTimeout(contextUpdateTimerRef.current);
				contextUpdateTimerRef.current = null;
			}
			if (!sessionState) return;
			// When an explicit message set is provided (e.g. the user's just-sent
			// message, which isn't in the checkpointer yet on the first turn), use
			// it directly. Otherwise source the conversation from the real
			// checkpointer session when the accessor is available, so the counter
			// reflects the full message set the model sees (tool calls, tool
			// messages, content blocks). Fall back to the lossy sessionState array
			// when the accessor is unavailable.
			let counted = messages;
			if (!counted) {
				counted = sessionState.getConversation();
				if (typeof getContextMessages === "function") {
					const contextMessages = await getContextMessages();
					if (contextMessages && contextMessages.length > 0) {
						counted = contextMessages;
					}
				}
			}
			// Normalize every message to a real LangChain object before counting.
			counted = counted.map(toLangChainMessage);
			// Include the system prompt in the count so the context window reflects
			// what the model actually sees on every turn. It's not part of graph
			// state, so it must be prepended here.
			if (systemPrompt) {
				counted = [new SystemMessage(systemPrompt), ...counted];
			}
			// The output budget (maxTokens) is intentionally not added to the
			// count. The status-bar context meter must reflect actual context
			// usage against the context window, not the reserved output budget.
			let totalTokens = 0;
			if (model && typeof model.getNumTokensFromMessages === "function") {
				const { totalCount } = await model.getNumTokensFromMessages(counted);
				totalTokens = totalCount;
			}
			setContextSize(totalTokens);
			onContextChange?.(totalTokens);
		},
		[model, getContextMessages, systemPrompt],
	);

	const addMessage = (msg) => {
		const time = getTimestamp();
		const id = messageListRef.current?.addMessage(msg.role, msg.content, { time });
		if (messageCountRef) {
			messageCountRef.current = messageListRef.current?.getMessageCount() || 0;
		}
		return id;
	};
	addMessageRef.current = addMessage;

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
			completedToolCalls = {},
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
					const cached = tokenCacheRef.current;
					if (text && cached.content !== text) {
						cached.content = text;
						if (model && typeof model.getNumTokensFromMessages === "function") {
							try {
								const { totalCount } = await model.getNumTokensFromMessages([new AIMessage(text)]);
								cached.tokens = totalCount;
							} catch {
								cached.tokens = 0;
							}
						} else {
							cached.tokens = 0;
						}
					}
					onContextUpdate(preStreamContextSize + cached.tokens + toolMessageTokensRef.current);
				}, 33);
			};

			return async (event) => {
				if (shouldAbort()) return;
				try {
					// Subagent events are routed to the dedicated subagent store
					// keyed by namespace, never to the orchestrator's assistant
					// bubble. This keeps each subagent's reasoning/message
					// segments and tool calls separate from the main conversation.
					if (
						event.type === "subagent_message" ||
						event.type === "subagent_reasoning" ||
						event.type === "subagent_tool" ||
						event.type === "subagent_tool_start" ||
						event.type === "subagent_tool_end"
					) {
						onSubagentUpdate?.(event);
						return;
					}

					// A `clarify` interrupt fired. Surface the question to the
					// user and arm the pending-clarify state so the next input is
					// routed to `resumeProvider` as the answer.
					if (event.type === "clarify") {
						const question = event.question || "";
						const choices = event.choices || [];
						addMessage({ role: "system", content: formatClarifyPrompt(question, choices) });
						pendingClarifyRef.current = { question, choices };
						return;
					}

					const currentEvents =
						messageListRef.current?.getMessageData(streamingMsgIdRef.current)?.events || [];
					messageListRef.current?.updateMessage(streamingMsgIdRef.current, {
						events: [...currentEvents, event],
					});

					if (event.type === "message") {
						const newText = event.data?.text || event.text || "";
						committedContentRef.current = (committedContentRef.current || "") + newText;
						messageListRef.current?.updateMessage(streamingMsgIdRef.current, {
							segments: [
								{
									type: "message",
									content: newText,
									// Normalize the content-block index to `id` so message
									// segments coalesce by block identity, mirroring how
									// reasoning segments target by `id`.
									...(hasId(event.index) ? { id: event.index } : {}),
								},
							],
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
								segments: [
									{
										type: "reasoning",
										content: reasoningText,
										...(hasId(event.id) ? { id: event.id } : {}),
									},
								],
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
						completedToolCalls[event.name] = (completedToolCalls[event.name] || 0) + 1;
						messageListRef.current?.updateMessage(streamingMsgIdRef.current, {
							activeToolCall: null,
							completedToolCalls: { ...completedToolCalls },
						});
					}

					if (event.type === "tool") {
						const toolText = event.data?.text || event.text || "";
						const toolName = event.data?.name || event.name || "";
						if (toolText) {
							// Count the tool-message text toward the live context
							// window. This is decoupled from display: the tool text
							// is never folded into committedContentRef, so it does
							// not pollute the rendered assistant message.
							toolMessageTokensRef.current += await countToolMessageTokens(model, toolText);
							debouncedContextUpdate(committedContentRef.current);

							// Cancelled tool calls (synthetic message) stay in provider
							// context (counted above) but never render as a tool call.
							if (!isCancelledToolEvent(event)) {
								// Render the tool text as a distinct `tool` segment so it
								// shows as a separate block toggled by toolCallCollapsed.
								messageListRef.current?.updateMessage(streamingMsgIdRef.current, {
									segments: [{ type: "tool", content: toolText, name: toolName }],
									streaming: true,
								});
								messageListRef.current?._triggerRender();
							}
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
	 * Resume a paused agent after a `clarify` interrupt, streaming the
	 * continuation into a fresh assistant bubble.
	 * @param {string} answer - The user's answer to the clarification question
	 * @returns {Promise<void>}
	 */
	const resumeClarify = (answer) =>
		runTurn((handler, signal) => resumeProvider(answer, handler, signal));

	/**
	 * Finalize streaming message.
	 */
	const finalizeStreaming = (
		responseContent,
		committedReasoning,
		lastToolCallDisplay,
		todoStatusLines,
		turnStartTime = 0,
		completedToolCalls = {},
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
		scrollToBottom: () => messageListRef.current?.scrollToBottom(),
		getViewportHeight: () =>
			messageListRef.current?.getScrollRef()?.current?.getViewportHeight?.() || 1,
		getScrollOffset: () =>
			messageListRef.current?.getScrollRef()?.current?.getScrollOffset?.() || 0,
		/**
		 * Get the rendered message layout for selection mapping.
		 * Returns an array of `{ text, top }` where `text` is the message's
		 * plain content and `top` is the content row of its first text line.
		 * @returns {Array<{text: string, top: number}>}
		 */
		getSelectionMessages: () => {
			const list = messageListRef.current;
			if (!list || typeof list.getMessages !== "function") return [];
			return list.getMessages();
		},
		/**
		 * Set the in-conversation search query.
		 * @param {string} query - The search query
		 */
		setSearchQuery: (query) => messageListRef.current?.setSearchQuery?.(query),
		/**
		 * Clear the in-conversation search.
		 */
		clearSearch: () => messageListRef.current?.clearSearch?.(),
		/**
		 * Jump to the next search match.
		 */
		searchNext: () => messageListRef.current?.searchNext?.(),
		/**
		 * Jump to the previous search match.
		 */
		searchPrev: () => messageListRef.current?.searchPrev?.(),
		messageCountRef,
		isStreaming: () => isStreamingRef.current,
	}));

	// When hidden (a panel view is active), keep the full subtree mounted but
	// hide it with `display: "none"` so the MessageList state (idsRef, dataRef,
	// contentRef, scroll position) survives the round-trip. Returning an empty
	// Box here would unmount ConversationPanel → MessageList and destroy that
	// state, so returning to the conversation view would remount it empty.
	return React.createElement(
		Box,
		{
			key: "conversation-wrapper",
			flexDirection: "column",
			flexGrow: 1,
			display: hidden ? "none" : "flex",
		},
		React.createElement(ConversationPanel, {
			assistantName: config?.tui?.name || "Assistant",
			showToolResults: config?.tui?.showToolResults,
			overscan: config?.tui?.overscan,
			messageListRef,
			selection,
			reasoningCollapsed,
			toolCallCollapsed,
		}),
	);
});

export default ConversationArea;
