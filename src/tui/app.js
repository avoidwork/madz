import React, { useState, useEffect } from "react";
import { Box, Text, useWindowSize } from "ink";
import { useInput } from "ink";
import { CommandParser } from "./commandParser.js";
import { ConversationPanel } from "./conversationPanel.js";
import { StatusBar } from "./statusBar.js";
import { InputPanel } from "./inputPanel.js";
import { isStreamingMessage } from "./messages.js";
import { Banner } from "./banner.js";
import { setConfigValue } from "../config/loader.js";
import fs from "node:fs";

const EXIT_MESSAGE = "\n";

/**
 * Main App component (Ink). Renders an IRC-style layout:
 * full-height conversation REPL at top, input bar at bottom.
 */
export default function App({ config, registry, sessionState, dispatchProvider, appInfo }) {
	const [showBanner, setShowBanner] = useState(true);
	const [messages, setMessages] = useState([]);
	const [statusMessage, setStatusMessage] = useState("Ready");
	const [chatHistory, setChatHistory] = useState([]);
	const [historyIndex, setHistoryIndex] = useState(-1);
	const [inputText, setInputText] = useState("");

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
		return () => {
			process.off("uncaughtException", onUncaught);
			process.off("unhandledRejection", onUnhandled);
		};
	}, []);

	// Process command or dispatch as normal chat
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
			await handleChat(trimmed);
		}
	};

	// Handle IRC-style command parsing
	const handleCommand = async (trimmed) => {
		try {
			const result = parser.parse(trimmed, {
				_sessionState: sessionState,
				_setConfigValue: (dotPath, valueStr) => {
					if (config) {
						setConfigValue(config, dotPath, valueStr);
					}
				},
				_scheduleList: [],
				_schedulePause: () => {},
				_scheduleResume: () => {},
				_contextList: false,
			});
			if (result.action === "quit") {
				handleQuit();
				return;
			}
			if (result.action === "unknown") {
				setStatusMessage(result.message);
				return;
			}
			setStatusMessage(result.message || result.action + " executed");
			if (result.message && result.action !== "provider" && result.action !== "schedule") {
				addMessage({ role: "system", content: result.message });
			}
		} catch (_err) {
			setStatusMessage("Something went wrong");
		}
	};

	// Handle normal chat message dispatch with streaming
	const handleChat = async (text) => {
		setStatusMessage("Streaming...");
		addMessage({ role: "user", content: text });

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

		let _currentToolCallCount = 0;
		let committedContent = "";
		let committedReasoning = "";
		let lastToolCallDisplay = "";
		let _activeToolCall = null;

		try {
			const _response = await dispatchProvider(
				text,
				sessionState ? sessionState.getProvider() : null,
				(event) => {
					try {
						const cbData = {
							type: event.type,
							text: (event.text || "").slice(0, 80),
							toolName: event.toolName || "",
							toolCallId: event.toolCallId || "",
							data: event.data,
							error: event.error || "",
						};
						fs.appendFileSync("/tmp/madz_tui.log", JSON.stringify(cbData) + "\n");
					} catch {
						/* */
					}
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
							activeToolCall = {
								name: event.toolName,
								toolCallId: event.toolCallId,
								startedAt: Date.now(),
							};
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
							_currentToolCallCount++;
							activeToolCall = null;
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
							activeToolCall = null;
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
						}
					} catch (cbErr) {
						// oxlint-disable no-console
						console.error("[TUI] streaming callback error:", cbErr.message);
						// oxlint-enable no-console
					}
				},
			);

			// committedContent is accumulated from streaming text events —
			// this is the actual AI response. response.content is only the
			// originalMessage fallback from callReactAgentStreaming.
			const responseContent = committedContent;

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
				}
				return cloned;
			});

			if (sessionState) {
				sessionState.addExchange({
					role: "assistant",
					content: responseContent,
				});
			}
			setStatusMessage("Received response");
		} catch (err) {
			setMessages((prev) => prev.filter((msg) => !isStreamingMessage(msg)));
			setStatusMessage("Something went wrong");
			addMessage({
				role: "system",
				content: `I couldn't connect right now - ${err.message}. Try sending your message again?`,
			});
		}
	};

	const handleQuit = () => {
		process.exit(0);
	};

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
		// When banner is showing, any key dismisses it
		if (showBanner) {
			if (key.escape) {
				handleQuit();
				return;
			}
			setShowBanner(false);
			// After dismissal, fall through to normal input processing
		} else {
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
		}
	});

	const { rows } = useWindowSize();

	const statusProps = {
		skillCount: skillList.length,
		messageCount: messages.length,
		statusMessage: statusMessage,
		appInfo: appInfo,
	};

	return React.createElement(
		Box,
		{ flexDirection: "column", width: "100%", height: rows },
		showBanner
			? React.createElement(Banner, { onDismiss: () => setShowBanner(false) })
			: React.createElement(ConversationPanel, {
					messages: messages,
					assistantName: config?.tui?.name || "Assistant",
				}),
		!showBanner && React.createElement(StatusBar, statusProps),
		!showBanner &&
			React.createElement(InputPanel, {
				inputText: inputText,
				blinkTimeout: config?.tui?.blinkTimeout ?? 530,
				cursorChar: config?.tui?.cursorChar ?? "\u2588",
			}),
		!showBanner && React.createElement(Text, { key: "exit-newline" }, EXIT_MESSAGE),
	);
}
