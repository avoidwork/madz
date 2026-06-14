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
	const [messages, setMessages] = useState([]);
	const [statusMessage, setStatusMessage] = useState("Ready");
	const [chatHistory, setChatHistory] = useState([]);
	const [historyIndex, setHistoryIndex] = useState(-1);
	const [inputText, setInputText] = useState("");
	const [inputFocused, setInputFocused] = useState(true);
	const [contextSize, setContextSize] = useState(0);
	const [isCompacting, setIsCompacting] = useState(false);
	const scrollRef = useRef(null);
	const isQuittingRef = useRef(false);
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
					encoding
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
				setMessages([]);
				setStatusMessage(result.message || "Conversation cleared.");
				return;
			}
			if (result.action === "unknown") {
				setStatusMessage(result.message);
				return;
			}
			if (result.action !== "help") {
				setStatusMessage(result.message || result.action + " executed");
			}
			if (result.message && result.action !== "provider" && result.action !== "schedule") {
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
		if (isQuittingRef.current) return;
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
					encoding
				);
			}
			setContextSize(totalTokens);
		}

		const assistantTime = getTimestamp();
		setMessages((prev) => [
			...prev,
			{
				role: "assistant",
				content: "",
				time: assistantTime,
				streaming: true,
				toolCalls: [],
				toolCallDisplay: "",
			},
		]);

		let committedContent = "";
		let committedReasoning = "";
		let lastToolCallDisplay = "";
		let todoStatusLines = "";

		// Wire the streaming callback into the todo queue so status events
		// flow through the LangGraph stream to the TUI.
		setTodoStreamingCallback((event) => {
			if (event.type === "todo_status") {
				const statusLine = event.message
					? `- ${event.message}`
					: `- Todo: ${event.action} ${event.key || ""}`;
				todoStatusLines = (todoStatusLines ? todoStatusLines + "\n" : "") + statusLine;
				setMessages((prev) => {
					const cloned = [...prev];
					const last = cloned[cloned.length - 1];
					if (last.role === "assistant" && last.streaming) {
						last.toolCallDisplay = lastToolCallDisplay
							? lastToolCallDisplay + "\n" + todoStatusLines
							: todoStatusLines;
					}
					return cloned;
				});
			}
		});

		try {
			const _response = await dispatchProvider(
				text,
				sessionState ? sessionState.getProvider() : null,
				(event) => {
					if (isQuittingRef.current) return;
					try {
						if (event.type === "text") {
							committedContent = (committedContent || "") + event.text;
							setMessages((prev) => {
								const cloned = [...prev];
								const last = cloned[cloned.length - 1];
								if (last.role === "assistant" && last.streaming) {
									last.content = committedContent + "\u2588";
								}
								return cloned;
							});
						} else if (event.type === "reasoning") {
							committedReasoning = (committedReasoning || "") + event.text;
							setMessages((prev) => {
								const cloned = [...prev];
								const last = cloned[cloned.length - 1];
								if (last.role === "assistant" && last.streaming) {
									last.reasoningContent = (committedReasoning || "") + "\u2588";
								}
								return cloned;
							});
						} else if (event.type === "tool_start") {
							setMessages((prev) => {
								const cloned = [...prev];
								const last = cloned[cloned.length - 1];
								if (last.role === "assistant" && last.streaming) {
									last.activeToolCall = { name: event.toolName };
									last.toolCallDisplay = lastToolCallDisplay;
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
							lastToolCallDisplay =
								(lastToolCallDisplay ? lastToolCallDisplay + "\n" : "") + displayLine;
							setMessages((prev) => {
								const cloned = [...prev];
								const last = cloned[cloned.length - 1];
								if (last.role === "assistant" && last.streaming) {
									last.activeToolCall = null;
									last.toolCallDisplay = lastToolCallDisplay;
								}
								return cloned;
							});
						} else if (event.type === "tool_error") {
							const errorLine = event.toolName
								? `- Tool: ${event.toolName} (error: ${event.error})`
								: `- Tool call failed (${event.toolCallId || "unknown"})`;
							lastToolCallDisplay =
								(lastToolCallDisplay ? lastToolCallDisplay + "\n" : "") + errorLine;
							setMessages((prev) => {
								const cloned = [...prev];
								const last = cloned[cloned.length - 1];
								if (last.role === "assistant" && last.streaming) {
									last.activeToolCall = null;
									last.toolCallDisplay = lastToolCallDisplay;
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
				},
			);

			// committedContent is accumulated from streaming text events —
			// this is the actual AI response. response.content is only the
			// originalMessage fallback from callReactAgentStreaming.
			const responseContent = committedContent;

			if (isQuittingRef.current) return;

			// Now persist user message to session state (after dispatchProvider so
			// isNewThread is correctly computed for the system prompt)
			if (sessionState) {
				sessionState.addExchange({ role: "user", content: text });
			}

			setMessages((prev) => {
				const cloned = [...prev];
				const last = cloned[cloned.length - 1];
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
				return cloned;
			});

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
						encoding
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
			if (onSaveSession) {
				onSaveSession();
			}
			setMessages((prev) => prev.filter((msg) => !isStreamingMessage(msg)));
			setStatusMessage("Something went wrong");
			addMessage({
				role: "system",
				content: `I couldn't connect right now - ${err.message}. Try sending your message again?`,
			});
		}
		gcManager?.();
	};

	const handleQuit = () => {
		isQuittingRef.current = true;
		exit();
		// Force process exit to break pending async streams
		process.exit(0);
	};

	/**
	 * Start a new session: generate new UUID, clear conversation, reset state.
	 */
	const handleNewSession = () => {
		const newSession = createSession({ provider: sessionState.getProvider() });
		sessionState.createNewSession(newSession.sessionId);
		setMessages([]);
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
		setMessages((prev) => [...prev, { ...msg, time }]);
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
					handleQuit();
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
					handleQuit();
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
		messageCount: messages.length,
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
							messages: messages,
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
