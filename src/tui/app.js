import React, { useState, useEffect, useRef } from "react";
import { Box, useWindowSize, useApp } from "ink";
import { useInput } from "ink";
import { CommandParser } from "./commandParser.js";
import { ConversationPanel } from "./conversationPanel.js";
import { StatusBar } from "./statusBar.js";
import { InputPanel } from "./inputPanel.js";
import { Banner } from "./banner.js";
import { OnboardingPanel } from "./onboardingPanel.js";
import { createSession } from "../session/factory.js";
import { setConfigValue } from "../config/loader.js";
import { isAvailable, getGcCalls } from "../memory/gc.js";
import { loadSystemPrompt } from "../memory/prompts.js";
import { calculateConversationTokens } from "./contextTokens.js";

/**
 * Main App component (Ink). Renders an IRC-style layout:
 * full-height conversation REPL at top, input bar at bottom.
 */
export default function App({
	config,
	registry,
	sessionState,
	dispatchProvider,
	scheduleManager,
	appInfo,
	onboarding,
	onSaveSession,
	gcManager,
	gcTrigger,
}) {
	const [showBanner, setShowBanner] = useState(true);
	const [showOnboarding, setShowOnboarding] = useState(!!onboarding);
	const [onboardingResponse, setOnboardingResponse] = useState(0);
	const [statusMessage, setStatusMessage] = useState("Ready");
	const [chatHistory, setChatHistory] = useState([]);
	const [historyIndex, setHistoryIndex] = useState(-1);
	const [inputText, setInputText] = useState("");
	const [inputFocused, setInputFocused] = useState(true);
	const [contextSize, setContextSize] = useState(0);
	const [isCompacting, setIsCompacting] = useState(false);
	const messageListRef = useRef(null);
	const abortControllerRef = useRef(null);
	const isStreamingRef = useRef(false);
	const dispatchPromiseRef = useRef(null);
	const autoContinueCountRef = useRef(0);
	const isAutoContinuingRef = useRef(false);
	const streamingMsgIdRef = useRef(null);
	const { exit } = useApp();
	const exitRef = useRef(exit);
	exitRef.current = exit;

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
			const conversation = sessionState.getConversation();
			const providerName = sessionState.getProvider();
			const providerConfig = config?.providers?.[providerName] || {};
			const modelName = providerConfig.model || "gpt-4o";
			const encoding = providerConfig.encoding;

			// Calculate conversation tokens
			let totalTokens = calculateConversationTokens(conversation, modelName, encoding);

			// Add system prompt tokens
			const systemPrompt = loadSystemPrompt();
			if (systemPrompt) {
				totalTokens += calculateConversationTokens(
					[{ role: "system", content: systemPrompt }],
					modelName,
					encoding,
				);
			}

			setContextSize(totalTokens);
		}
		return () => {
			process.off("uncaughtException", onUncaught);
			process.off("unhandledRejection", onUnhandled);
		};
	}, []);

	// Process command or dispatch as normal chat
	/**
	 * Handle user input: parse commands or dispatch as chat.
	 * @param {string} text - Raw user input text
	 */
	const handleSubmit = async (text) => {
		const trimmed = text.trim();
		if (!trimmed) return;

		// Abort any active stream before processing a new message
		// This prevents forked UX where both streams render to the same destination
		if (isStreamingRef.current) {
			await handleInterrupt();
		}

		// Track user input in chat history (non-empty lines only)
		setChatHistory((prev) => {
			const filtered = prev.filter((line) => line.trim());
			return [...filtered, trimmed];
		});
		setHistoryIndex(-1);
		setInputText("");

		if (parser.isCommand(trimmed)) {
			await handleCommand(trimmed);
		} else {
			gcManager?.();
			await handleChat(trimmed);
		}
	};

	/**
	 * Handle IRC-style command parsing with dispatch table.
	 * @param {string} trimmed - The command string (sans leading whitespace)
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
				_executeSkill: (skillName, _args) => {
					const skill = registry.get(skillName);
					if (!skill) {
						return {
							action: "skill",
							subAction: "error",
							message: `Skill "${skillName}" not found.`,
						};
					}
					// Skills are prompt-based instructions for the agent to interpret and execute.
					// Load the SKILL.md and pass it to the conversation so the agent can use it.
					const body = registry.getSkillBody(skillName);
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
				handleQuit();
				return;
			}
			if (result.action === "new") {
				handleNewSession();
				return;
			}
			if (result.action === "clear") {
				messageListRef.current?.clear();
				setStatusMessage(result.message || "Conversation cleared.");
				return;
			}
			if (result.action === "unknown") {
				setStatusMessage(result.message);
				return;
			}
			if (result.action === "skill" && result.subAction === "load" && result.skillBody) {
				gcManager?.();
				setStatusMessage("Streaming...");

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
					// Capture the dispatch promise so handleInterrupt can await it
					const dispatchPromise = dispatchProvider(
						result.skillBody,
						sessionState ? sessionState.getProvider() : null,
						createStreamingHandler(
							committedContentRef,
							{ current: "" },
							{ current: "" },
						),
						abortControllerRef.current?.signal,
					);

					// Store the promise so handleInterrupt can await it
					dispatchPromiseRef.current = dispatchPromise;
					await dispatchPromise;

					let responseContent = committedContentRef.current;

					// Auto-continue if the agent stalled with zero text output
					// Circuit breaker: configurable limit (default 1000) of consecutive
					// empty responses to prevent infinite loops when the model generates
					// thinking but no text
					if (!responseContent.trim() && !shouldAbort()) {
						// Show tool results so the user knows work happened
						if (lastToolCallDisplay) {
							messageListRef.current?.updateMessage(streamingMsgIdRef.current, {
								toolCallDisplay: lastToolCallDisplay,
							});
						}

						if (autoContinueCountRef.current >= (config?.agent?.autoContinueLimit ?? 1000)) {
							// Circuit breaker: model is stuck in thinking-only loop
							setStatusMessage("Model appears stuck — starting fresh.");
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

						// Send a quiet continuation signal to the agent
						setStatusMessage("Continuing...");
						isAutoContinuingRef.current = true;
						try {
							// Capture the dispatch promise so handleInterrupt can await it
							const continuePromise = dispatchProvider(
								"Please continue.",
								sessionState ? sessionState.getProvider() : null,
								createStreamingHandler(committedContentRef, () => {
									// Reset flag — text arrived, not stuck anymore
									isAutoContinuingRef.current = false;
								}),
								abortControllerRef.current?.signal,
							);
							// Update the ref so handleInterrupt can await this promise too
							dispatchPromiseRef.current = continuePromise;
							await continuePromise;
							setStatusMessage("Done");
						} catch (contErr) {
							setStatusMessage(`Error continuing: ${contErr.message}`);
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

					// Persist assistant response to session state
					if (sessionState) {
						sessionState.addExchange({
							role: "assistant",
							content: responseContent,
						});
					}
				} catch (err) {
					// Abort is a normal interruption, not an error
					if (err.name === "AbortError") {
						if (sessionState) {
							sessionState.popExchange();
						}
						messageListRef.current?.updateMessage(streamingMsgIdRef.current, {
							streaming: false,
						});
						setStatusMessage("Interrupted.");
					} else {
						messageListRef.current?.updateMessage(streamingMsgIdRef.current, {
							streaming: false,
						});
						setStatusMessage(`Error: ${err.message}`);
					}
				} finally {
					// Reset abort controller and streaming flag
					abortControllerRef.current = null;
					isStreamingRef.current = false;
				}
			} else if (result.action !== "help" && result.action !== "skill") {
				setStatusMessage(result.message || result.action + " executed");
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
			setStatusMessage("Something went wrong");
		}
	};

	/**
	 * Dispatch user text to the AI agent with streaming.
	 * @param {string} text - The user's message text
	 */
	const handleChat = async (text) => {
		if (shouldAbort()) return;
		gcManager?.();
		setStatusMessage("Streaming...");
		addMessage({ role: "user", content: text });

		// Persist user message to session state and recalculate context
		// NOTE: Don't add to sessionState before dispatchProvider — it needs to see
		// an empty conversation to correctly set isNewThread=true for the system prompt
		if (sessionState) {
			const conversation = sessionState.getConversation();
			const providerName = sessionState.getProvider();
			const providerConfig = config?.providers?.[providerName] || {};
			const modelName = providerConfig.model || "gpt-4o";
			const encoding = providerConfig.encoding;

			// Calculate conversation tokens + system prompt
			let totalTokens = calculateConversationTokens(conversation, modelName, encoding);
			const systemPrompt = loadSystemPrompt();
			if (systemPrompt) {
				totalTokens += calculateConversationTokens(
					[{ role: "system", content: systemPrompt }],
					modelName,
					encoding,
				);
			}
			setContextSize(totalTokens);
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
			// Capture the dispatch promise so handleInterrupt can await it
			const dispatchPromise = dispatchProvider(
				text,
				sessionState ? sessionState.getProvider() : null,
				createStreamingHandler(
					committedContentRef,
					{ current: "" },
					{ current: "" },
				),
				abortControllerRef.current?.signal,
			);

			// Store the promise so handleInterrupt can await it
			dispatchPromiseRef.current = dispatchPromise;
			const _response = await dispatchPromise;

			// committedContentRef.current is accumulated from streaming text events —
			// this is the actual AI response. response.content is only the
			// originalMessage fallback from callReactAgentStreaming.
			let responseContent = committedContentRef.current;

			// Auto-continue if the agent stalled with zero text output
			// Circuit breaker: configurable limit (default 1000) of consecutive
			// empty responses to prevent infinite loops when the model generates
			// thinking but no text
			if (!responseContent.trim() && !shouldAbort()) {
				// Show tool results so the user knows work happened
				if (lastToolCallDisplay) {
					messageListRef.current?.updateMessage(streamingMsgIdRef.current, {
						toolCallDisplay: lastToolCallDisplay,
					});
				}

				if (autoContinueCountRef.current >= (config?.agent?.autoContinueLimit ?? 1000)) {
					// Circuit breaker: model is stuck in thinking-only loop
					setStatusMessage("Model appears stuck — starting fresh.");
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

				// Send a quiet continuation signal to the agent
				setStatusMessage("Continuing...");
				isAutoContinuingRef.current = true;
				try {
					// Capture the dispatch promise so handleInterrupt can await it
					const continuePromise = dispatchProvider(
						"Please continue.",
						sessionState ? sessionState.getProvider() : null,
						createStreamingHandler(
							committedContentRef,
							{ current: "" },
							{ current: "" },
							() => {
								// Reset flag — text arrived, not stuck anymore
								isAutoContinuingRef.current = false;
							},
						),
						abortControllerRef.current?.signal,
					);
					// Update the ref so handleInterrupt can await this promise too
					dispatchPromiseRef.current = continuePromise;
					await continuePromise;
					setStatusMessage("Received response");
				} catch (contErr) {
					setStatusMessage(`Error continuing: ${contErr.message}`);
				} finally {
					isAutoContinuingRef.current = false;
					autoContinueCountRef.current++;
				}
			}

			if (shouldAbort()) return;

			// Now persist user message to session state (after dispatchProvider so
			// isNewThread is correctly computed for the system prompt)
			if (sessionState) {
				sessionState.addExchange({ role: "user", content: text });
			}

			finalizeStreaming(responseContent, committedReasoning, lastToolCallDisplay, todoStatusLines);

			// Persist assistant message and recalculate context
			if (sessionState) {
				sessionState.addExchange({
					role: "assistant",
					content: responseContent,
				});
				const conversation = sessionState.getConversation();
				const providerName = sessionState.getProvider();
				const providerConfig = config?.providers?.[providerName] || {};
				const modelName = providerConfig.model || "gpt-4o";
				const encoding = providerConfig.encoding;

				// Calculate conversation tokens + system prompt
				let totalTokens = calculateConversationTokens(conversation, modelName, encoding);
				const systemPrompt = loadSystemPrompt();
				if (systemPrompt) {
					totalTokens += calculateConversationTokens(
						[{ role: "system", content: systemPrompt }],
						modelName,
						encoding,
					);
				}
				setContextSize(totalTokens);
			}
			if (onSaveSession) {
				onSaveSession();
			}
			gcManager?.();
			setStatusMessage("Received response");
		} catch (err) {
			// Abort is a normal interruption, not an error
			if (err.name === "AbortError") {
				// Clean up: remove the assistant's tool-call message (if any) and the user message.
				// The assistant's tool-call message is removed first to prevent orphaned tool_calls
				// from corrupting the conversation history sent to the LLM API on resume.
				if (sessionState) {
					sessionState.removeLastAssistantToolCallMessage();
					sessionState.popExchange();
				}
				setStatusMessage("Interrupted.");
			} else {
				if (onSaveSession) {
					onSaveSession();
				}
				messageListRef.current?.clear();
				setStatusMessage("Something went wrong");
				addMessage({
					role: "system",
					content: `I couldn't connect right now - ${err.message}. Try sending your message again?`,
				});
			}
		} finally {
			// Reset abort controller and streaming flag
			abortControllerRef.current = null;
			isStreamingRef.current = false;
		}
		gcManager?.();
	};

	const handleQuit = () => {
		exit();
		process.exit(0);
	};

	/**
	 * Interrupt the current streaming response. Resets the abort controller
	 * so the user can interrupt future responses. Does NOT quit the app.
	 * Returns a promise that resolves once dispatchProvider has finished
	 * processing the abort and completed its cleanup.
	 */
	const handleInterrupt = async () => {
		if (abortControllerRef.current) {
			abortControllerRef.current.abort();
			abortControllerRef.current = null;
		}
		isStreamingRef.current = false;

		// Clean up the assistant's tool-call message from session state.
		// This removes any orphaned AIMessage with tool_calls that was never
		// completed, preventing corrupted conversation history from being sent
		// to the LLM API on resume.
		if (sessionState) {
			sessionState.removeLastAssistantToolCallMessage();
		}

		messageListRef.current?.updateMessage(streamingMsgIdRef.current, {
			streaming: false,
		});
		setStatusMessage("Interrupted.");

		// Wait for the dispatchProvider promise to resolve (it will throw
		// AbortError and be caught by the try/catch, then run finally).
		// This ensures the stream is fully dead before we proceed.
		const dispatchPromise = dispatchPromiseRef.current;
		dispatchPromiseRef.current = null;
		if (dispatchPromise) {
			try {
				await dispatchPromise;
			} catch (_err) {
				// AbortError is expected — dispatchProvider catches and handles it.
				// We just need to wait for the cleanup to complete.
			}
		}
	};

	/**
	 * Check if the current stream should be aborted.
	 */
	const shouldAbort = () => {
		if (abortControllerRef.current?.signal?.aborted) return true;
		return false;
	};

	/**
	 * Start a new session: generate new UUID, clear conversation, reset state.
	 */
	const handleNewSession = () => {
		const newSession = createSession({ provider: sessionState.getProvider() });
		sessionState.createNewSession(newSession.sessionId);
		setIsCompacting(false);
		messageListRef.current?.clear();
		setChatHistory([]);
		setContextSize(0);
		setStatusMessage("New session started.");
		addMessage({
			role: "system",
			content: `New session started (thread: ${newSession.sessionId.slice(0, 8)}...).`,
		});
	};

	/**
	 * Process onboarding input: forward to onboarding instance and update state.
	 * @param {string} text - Raw user input
	 */
	function processOnboardingInput(text) {
		if (!onboarding || !showOnboarding) return false;
		const trimmed = text.trim();

		if (trimmed === "exit") {
			setShowBanner(true);
			setShowOnboarding(false);
			exitRef.current();
			return true;
		}

		const result = onboarding.processResponse(trimmed);

		if (result.action === "exit") {
			setShowBanner(true);
			setShowOnboarding(false);
			exitRef.current();
			return true;
		}

		if (result.action === "save") {
			const saved = onboarding.save();
			if (saved) {
				addMessage({
					role: "system",
					content: "Profile saved. Let's get started!",
				});
				setShowBanner(true);
				setShowOnboarding(false);
			}
			return true;
		}

		// Track user input in chat history for normal responses during onboarding
		if (trimmed) {
			setChatHistory((prev) => {
				const filtered = prev.filter((l) => l.trim());
				return [...filtered, trimmed];
			});
			setHistoryIndex(-1);
		}

		// Trigger onboarding panel to refresh with new prompt
		setOnboardingResponse((prev) => prev + 1);

		// If there's a pending prompt, keep showing onboarding
		if (result.action === "nextPrompt" && onboarding) {
			return true;
		}

		return true;
	}

	/**
	 * Generate a timestamp string in HH:MM format.
	 * @returns {string}
	 */
	const getTimestamp = () => {
		const now = new Date();
		return (
			String(now.getHours()).padStart(2, "0") + ":" + String(now.getMinutes()).padStart(2, "0")
		);
	};

	const addMessage = (msg) => {
		const time = getTimestamp();
		messageListRef.current?.addMessage(msg.role, msg.content, { time });
	};

	/**
	 * Streaming event handler — single handler for all dispatch streams.
	 * Captures all event types, accumulates content/reasoning, and handles structured events.
	 * @param {Object} committedContentRef - Ref holding accumulated text
	 * @param {Object} [committedReasoningRef] - Ref holding accumulated reasoning
	 * @param {Object} [lastToolCallDisplayRef] - Ref holding accumulated tool call display
	 * @param {Function} [onTextReceived] - Optional callback when text arrives
	 * @returns {Function} Event callback for dispatchProvider
	 */
	const createStreamingHandler = (
		committedContentRef,
		committedReasoningRef,
		lastToolCallDisplayRef,
		onTextReceived,
	) => {
		return (event) => {
			if (shouldAbort()) return;
			try {
				// Capture all events on the message
				const currentEvents = messageListRef.current?.getMessageData(
					streamingMsgIdRef.current,
				)?.events || [];
				messageListRef.current?.updateMessage(streamingMsgIdRef.current, {
					events: [...currentEvents, event],
				});

				if (event.type === "message") {
					committedContentRef.current = (committedContentRef.current || "") + event.text;
					messageListRef.current?.updateMessage(streamingMsgIdRef.current, {
						content: committedContentRef.current + (config?.tui?.cursorChar || "\u2588"),
						streaming: true,
					});
					if (onTextReceived) onTextReceived();
				}

				// Handle on_chat_model_stream — accumulate content and reasoning
				if (event.type === "on_chat_model_stream") {
					if (event.data?.chunk?.content) {
						committedContentRef.current =
							(committedContentRef.current || "") + event.data.chunk.content;
						messageListRef.current?.updateMessage(streamingMsgIdRef.current, {
							content:
								committedContentRef.current +
								(config?.tui?.cursorChar || "\u2588"),
							streaming: true,
						});
					}
					if (event.data?.chunk?.reasoning) {
						committedReasoningRef.current =
							(committedReasoningRef.current || "") + event.data.chunk.reasoning;
					}
				}

				// Handle on_tool_start — set activeToolCall
				if (event.type === "on_tool_start") {
					messageListRef.current?.updateMessage(streamingMsgIdRef.current, {
						activeToolCall: {
							name: event.name,
							input: event.data?.input,
							status: "running",
						},
					});
				}

				// Handle on_tool_end — clear activeToolCall, set toolCallDisplay
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

				// Handle on_tool_error — set activeToolCall with error
				if (event.type === "on_tool_error") {
					messageListRef.current?.updateMessage(streamingMsgIdRef.current, {
						activeToolCall: {
							name: event.name,
							error: event.data?.error,
							status: "error",
						},
					});
				}
			} catch (_cbErr) {
				// Silently ignore streaming callback errors
			}
		};
	};

	/**
	 * Finalize streaming message — strips cursor, sets final state.
	 * @param {string} responseContent - Final accumulated text
	 * @param {string} committedReasoning - Accumulated reasoning content
	 * @param {string} lastToolCallDisplay - Tool call display text
	 * @param {string} todoStatusLines - Todo status lines
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

	// Single input handler - processes all keystrokes here
	// InputPanel now uses ink-text-input for text entry (handles typing, cursor nav, etc.)
	// This hook only handles: Tab (focus toggle), Escape (interrupt/quit), history nav, message list nav
	useInput((input, key) => {
		// Onboarding phase takes priority
		if (showOnboarding) {
			if (key.return && !key.shift) {
				processOnboardingInput(inputText);
				setInputText("");
			} else if (key.escape) {
				handleQuit();
			} else if (input && input !== "\r") {
				setInputText((prev) => prev + input);
			} else if (key.backspace && inputText.length > 0) {
				setInputText((prev) => prev.slice(0, -1));
			}
			return;
		}

		// When banner is showing, any key dismisses it
		if (showBanner) {
			if (key.escape) {
				handleQuit();
				return;
			}
			setShowBanner(false);
			// After dismissal, fall through to normal input processing
		} else {
			if (input === "\t" || key.tab) {
				setInputFocused((prev) => !prev);
				return;
			}

			if (inputFocused) {
				if (key.escape) {
					if (isStreamingRef.current) {
						handleInterrupt();
					} else {
						handleQuit();
					}
				} else if (key.upArrow && chatHistory.length > 0) {
					// History navigation — ink-text-input doesn't handle this
					const newIndex =
						historyIndex === -1 ? chatHistory.length - 1 : Math.max(0, historyIndex - 1);
					setHistoryIndex(newIndex);
					setInputText(chatHistory[newIndex]);
				} else if (key.downArrow) {
					// History navigation — ink-text-input doesn't handle this
					if (historyIndex === -1) return;
					const nextIndex = historyIndex + 1;
					if (nextIndex >= chatHistory.length) {
						setHistoryIndex(-1);
						setInputText("");
					} else {
						setHistoryIndex(nextIndex);
						setInputText(chatHistory[nextIndex]);
					}
				}
			} else {
				if (key.escape) {
					if (isStreamingRef.current) {
						handleInterrupt();
					} else {
						handleQuit();
					}
				} else {
					if (key.upArrow) messageListRef.current?.scrollBy(-1);
					if (key.downArrow) messageListRef.current?.scrollBy(1);
					if (key.pageUp)
						messageListRef.current?.scrollBy(
							-(messageListRef.current?.getScrollRef()?.current?.getViewportHeight?.() || 1),
						);
					if (key.pageDown)
						messageListRef.current?.scrollBy(
							messageListRef.current?.getScrollRef()?.current?.getViewportHeight?.() || 1,
						);
				}
			}
		}
	});

	const { rows } = useWindowSize();

	const statusProps = {
		skillCount: skillList.length,
		messageCount: messageListRef.current?.getMessageCount() || 0,
		contextSize: contextSize,
		statusMessage: statusMessage,
		isCompacting: isCompacting,
	};

	return React.createElement(
		Box,
		{ flexDirection: "column", width: "100%", height: rows },
		showOnboarding
			? React.createElement(OnboardingPanel, {
					onboarding: onboarding,
					responseId: onboardingResponse,
					onComplete: () => {
						setShowBanner(true);
						setShowOnboarding(false);
					},
					onExit: () => {
						setShowBanner(true);
						setShowOnboarding(false);
					},
				})
			: showBanner
				? React.createElement(Banner, {
						onDismiss: () => setShowBanner(false),
						version: appInfo ? appInfo.version : undefined,
					})
				: React.createElement(
						Box,
						{
							key: "conversation-wrapper",
							flexDirection: "column",
							flexGrow: 1,
							backgroundColor: undefined,
						},
						React.createElement(ConversationPanel, {
							assistantName: config?.tui?.name || "Assistant",
							messageListRef,
						}),
					),
		!showBanner && !showOnboarding && React.createElement(StatusBar, statusProps),
		showOnboarding || (!showBanner && !showOnboarding)
			? React.createElement(
					Box,
					{
						key: "input-wrapper",
						flexDirection: "row",
						paddingX: 1,
						paddingY: 0,
					},
					React.createElement(InputPanel, {
						key: inputFocused ? "input-focused" : "input-unfocused",
						value: inputText,
						onChange: setInputText,
						onSubmit: handleSubmit,
						onFocus: () => setInputFocused(true),
						onBlur: () => setInputFocused(false),
						focus: inputFocused,
					}),
				)
			: null,
	);
}
