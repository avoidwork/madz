import React, { useState, useEffect, useRef } from "react";
import { Box, useWindowSize, useApp } from "ink";
import { useInput } from "ink";
import { CommandParser } from "./commandParser.js";
import { ConversationPanel } from "./conversationPanel.js";
import { StatusBar } from "./statusBar.js";
import { InputPanel } from "./inputPanel.js";
import { isStreamingMessage } from "./messages.js";
import { Banner } from "./banner.js";
import { OnboardingPanel } from "./onboardingPanel.js";
import { createSession } from "../session/factory.js";
import { setConfigValue } from "../config/loader.js";
import { isAvailable, getGcCalls } from "../memory/gc.js";
import { loadSystemPrompt } from "../memory/prompts.js";
import { setTodoStreamingCallback } from "../tools/todo_queue.js";
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
	const messagesRef = useRef([]);
	const [, forceRender] = useState(0);
	const [statusMessage, setStatusMessage] = useState("Ready");
	const [chatHistory, setChatHistory] = useState([]);
	const [historyIndex, setHistoryIndex] = useState(-1);
	const [inputText, setInputText] = useState("");
	const [inputFocused, setInputFocused] = useState(true);
	const [contextSize, setContextSize] = useState(0);
	const [isCompacting, setIsCompacting] = useState(false);
	const scrollRef = useRef(null);
	const abortControllerRef = useRef(null);
	const isStreamingRef = useRef(false);
	const dispatchPromiseRef = useRef(null);
	const autoContinueCountRef = useRef(0);
	const isAutoContinuingRef = useRef(false);
	const renderTickRef = useRef(0);
	const { exit } = useApp();
	const exitRef = useRef(exit);
	exitRef.current = exit;

	const skillList = registry ? registry.list() : [];
	const RENDER_THROTTLE = 5;

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
				messagesRef.current = [];
				forceRender((n) => n + 1);
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
				messagesRef.current.push({
					role: "assistant",
					content: "",
					time: assistantTime,
					streaming: true,
					toolCalls: [],
					toolCallDisplay: "",
				});
				forceRender((n) => n + 1);

				let committedContentRef = { current: "" };
				let committedReasoning = "";
				let lastToolCallDisplay = "";
				let todoStatusLines = "";

				// Set up abort controller for this stream
				abortControllerRef.current = new AbortController();
				isStreamingRef.current = true;

				setTodoStreamingCallback((event) => {
					if (event.type === "todo_status") {
						const statusLine = event.message
							? `- ${event.message}`
							: `- Todo: ${event.action} ${event.key || ""}`;
						todoStatusLines = (todoStatusLines ? todoStatusLines + "\n" : "") + statusLine;
						const msgs = messagesRef.current;
						const last = msgs[msgs.length - 1];
						if (last.role === "assistant" && last.streaming) {
							last.toolCallDisplay = lastToolCallDisplay
								? lastToolCallDisplay + "\n" + todoStatusLines
								: todoStatusLines;
						}
					}
				});

				try {
					// Capture the dispatch promise so handleInterrupt can await it
					const dispatchPromise = dispatchProvider(
						result.skillBody,
						sessionState ? sessionState.getProvider() : null,
						createStreamingHandler(committedContentRef),
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
							const msgs = messagesRef.current;
							const last = msgs[msgs.length - 1];
							if (last.role === "assistant" && last.streaming) {
								last.toolCallDisplay = lastToolCallDisplay;
							}
						}

						if (autoContinueCountRef.current >= (config?.agent?.autoContinueLimit ?? 1000)) {
							// Circuit breaker: model is stuck in thinking-only loop
							setStatusMessage("Model appears stuck — starting fresh.");
							const msgs = messagesRef.current;
							const last = msgs[msgs.length - 1];
							if (last.role === "assistant" && last.streaming) {
								last.streaming = false;
							}
							forceRender((n) => n + 1);
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
						const msgs = messagesRef.current;
						const last = msgs[msgs.length - 1];
						if (last.role === "assistant" && last.streaming) {
							last.streaming = false;
						}
						forceRender((n) => n + 1);
						setStatusMessage("Interrupted.");
					} else {
						const msgs = messagesRef.current;
						const last = msgs[msgs.length - 1];
						if (last.role === "assistant" && last.streaming) {
							last.streaming = false;
						}
						forceRender((n) => n + 1);
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
		messagesRef.current.push({
			role: "assistant",
			content: "",
			time: assistantTime,
			streaming: true,
			toolCalls: [],
			toolCallDisplay: "",
		});
		forceRender((n) => n + 1);

		let committedContentRef = { current: "" };
		let committedReasoning = "";
		let lastToolCallDisplay = "";
		let todoStatusLines = "";

		// Set up abort controller for this stream
		abortControllerRef.current = new AbortController();
		isStreamingRef.current = true;

		// Wire the streaming callback into the todo queue so status events
		// flow through the LangGraph stream to the TUI.
		setTodoStreamingCallback((event) => {
			if (event.type === "todo_status") {
				const statusLine = event.message
					? `- ${event.message}`
					: `- Todo: ${event.action} ${event.key || ""}`;
				todoStatusLines = (todoStatusLines ? todoStatusLines + "\n" : "") + statusLine;
				const msgs = messagesRef.current;
				const last = msgs[msgs.length - 1];
				if (last.role === "assistant" && last.streaming) {
					last.toolCallDisplay = lastToolCallDisplay
						? lastToolCallDisplay + "\n" + todoStatusLines
						: todoStatusLines;
				}
			}
		});

		try {
			// Capture the dispatch promise so handleInterrupt can await it
			const dispatchPromise = dispatchProvider(
				text,
				sessionState ? sessionState.getProvider() : null,
				createStreamingHandler(committedContentRef),
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
					const msgs = messagesRef.current;
					const last = msgs[msgs.length - 1];
					if (last.role === "assistant" && last.streaming) {
						last.toolCallDisplay = lastToolCallDisplay;
					}
				}

				if (autoContinueCountRef.current >= (config?.agent?.autoContinueLimit ?? 1000)) {
					// Circuit breaker: model is stuck in thinking-only loop
					setStatusMessage("Model appears stuck — starting fresh.");
					const msgs = messagesRef.current;
					const last = msgs[msgs.length - 1];
					if (last.role === "assistant" && last.streaming) {
						last.streaming = false;
					}
					forceRender((n) => n + 1);
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
				// Clear the partial streaming assistant message from UI
				messagesRef.current = messagesRef.current.filter((msg) => !isStreamingMessage(msg));
				forceRender((n) => n + 1);
				setStatusMessage("Interrupted.");
			} else {
				if (onSaveSession) {
					onSaveSession();
				}
				messagesRef.current = messagesRef.current.filter((msg) => !isStreamingMessage(msg));
				forceRender((n) => n + 1);
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

		const msgs = messagesRef.current;
		const last = msgs[msgs.length - 1];
		if (last?.role === "assistant" && last?.streaming) {
			last.streaming = false;
		}
		forceRender((n) => n + 1);
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
		messagesRef.current = [];
		forceRender((n) => n + 1);
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
		messagesRef.current.push({ ...msg, time });
		forceRender((n) => n + 1);
	};

	/**
	 * Streaming event handler — single handler for all dispatch streams.
	 * @param {Object} committedContentRef - Ref holding accumulated text
	 * @param {Function} [onTextReceived] - Optional callback when text arrives
	 * @returns {Function} Event callback for dispatchProvider
	 */
	const createStreamingHandler = useCallback((committedContentRef, onTextReceived) => {
		return (event) => {
			if (shouldAbort()) return;
			try {
				if (event.type === "message") {
					committedContentRef.current = (committedContentRef.current || "") + event.text;
					const msgs = messagesRef.current;
					const last = msgs[msgs.length - 1];
					if (last.role === "assistant" && last.streaming) {
						last.content = committedContentRef.current + "\u2588";
					}
					// Throttle: only forceRender every N ticks during streaming
					renderTickRef.current++;
					if (renderTickRef.current % RENDER_THROTTLE === 0) {
						forceRender((n) => n + 1);
					}
					if (onTextReceived) onTextReceived();
				}
			} catch (_cbErr) {
				// Silently ignore streaming callback errors
			}
		};
	}, [onTextReceived]);

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
		const msgs = messagesRef.current;
		const last = msgs[msgs.length - 1];
		if (last.role === "assistant" && last.streaming) {
			last.content = responseContent;
			last.reasoningContent = committedReasoning || undefined;
			last.streaming = false;
			last.activeToolCall = null;
			if (lastToolCallDisplay) {
				last.toolCallDisplay = lastToolCallDisplay;
			}
			if (todoStatusLines) {
				last.toolCallDisplay = last.toolCallDisplay
					? last.toolCallDisplay + "\n" + todoStatusLines
					: todoStatusLines;
			}
		}
		forceRender((n) => n + 1);
	};

	// Single input handler - processes all keystrokes here
	// InputPanel is now a display-only component (no useInput handler)
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
				} else if (key.return && !key.shift) {
					handleSubmit(inputText);
				} else if (key.upArrow && chatHistory.length > 0) {
					const newIndex =
						historyIndex === -1 ? chatHistory.length - 1 : Math.max(0, historyIndex - 1);
					setHistoryIndex(newIndex);
					setInputText(chatHistory[newIndex]);
				} else if (key.downArrow) {
					if (historyIndex === -1) return;
					const nextIndex = historyIndex + 1;
					if (nextIndex >= chatHistory.length) {
						setHistoryIndex(-1);
						setInputText("");
					} else {
						setHistoryIndex(nextIndex);
						setInputText(chatHistory[nextIndex]);
					}
				} else if (key.backspace && inputText.length > 0) {
					setInputText((prev) => prev.slice(0, -1));
				} else if (input && input !== "\r") {
					setInputText((prev) => prev + input);
				}
			} else {
				if (key.escape) {
					if (isStreamingRef.current) {
						handleInterrupt();
					} else {
						handleQuit();
					}
				} else {
					const ref = scrollRef.current;
					if (ref) {
						if (key.upArrow) ref.scrollBy(-1);
						if (key.downArrow) ref.scrollBy(1);
						if (key.pageUp) {
							const height = ref.getViewportHeight() || 1;
							ref.scrollBy(-height);
						}
						if (key.pageDown) {
							const height = ref.getViewportHeight() || 1;
							ref.scrollBy(height);
						}
					}
				}
			}
		}
	});

	const { rows } = useWindowSize();

	const statusProps = {
		skillCount: skillList.length,
		messageCount: messagesRef.current.length,
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
							messages: messagesRef.current,
							assistantName: config?.tui?.name || "Assistant",
							scrollRef: scrollRef,
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
						inputText: inputText,
						cursorChar: config?.tui?.cursorChar ?? "\u2588",
						cursorColor: inputFocused ? undefined : "#202020",
					}),
				)
			: null,
	);
}