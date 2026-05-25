import React, { useState, useEffect } from "react";
import { Box, Text, useWindowSize } from "ink";
import { useInput } from "ink";
import { CommandParser } from "./commandParser.js";
import { ConversationPanel } from "./conversationPanel.js";
import { StatusBar } from "./statusBar.js";
import { InputPanel } from "./inputPanel.js";
import { calcVisibleCount } from "./messages.js";
import { Banner } from "./banner.js";
import { setConfigValue } from "../config/loader.js";

const EXIT_MESSAGE = "\n";

/**
 * Main App component (Ink). Renders an IRC-style layout:
 * full-height conversation REPL at top, input bar at bottom.
 */
export default function App({ config, registry, sessionState, dispatchProvider }) {
	const [showBanner, setShowBanner] = useState(true);
	const [messages, setMessages] = useState([]);
	const [streamingContent, setStreamingContent] = useState(null);
	const [statusMessage, setStatusMessage] = useState("Ready");
	const [chatHistory, setChatHistory] = useState([]);
	const [historyIndex, setHistoryIndex] = useState(-1);
	const [inputText, setInputText] = useState("");
	const [scrollOffset, setScrollOffset] = useState(0);
	const [isScrolling, setIsScrolling] = useState(false);

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

	// Handle normal chat message dispatch
	const handleChat = async (text) => {
		setStatusMessage("Streaming...");
		addMessage({ role: "user", content: text });
		const now = new Date();
		const time =
			String(now.getHours()).padStart(2, "0") + ":" + String(now.getMinutes()).padStart(2, "0");

		let finalContent = "";

		const response = await dispatchProvider(
			text,
			sessionState ? sessionState.getProvider() : null,
			(chunk) => {
				finalContent = chunk;
				setStreamingContent(chunk);
			},
		);

		const responseContent = response.content || finalContent || "";
		setStreamingContent(null);
		if (sessionState) {
			sessionState.addExchange({
				role: "assistant",
				content: responseContent,
			});
		}
		addMessage({ role: "assistant", content: responseContent, time });
		setStatusMessage("Received response");
	};

	const handleQuit = () => {
		process.exit(0);
	};

	const addMessage = (msg) => {
		const now = new Date();
		const time =
			String(now.getHours()).padStart(2, "0") + ":" + String(now.getMinutes()).padStart(2, "0");
		setMessages((prev) => [...prev, { ...msg, time }]);
		setScrollOffset(0);
		setIsScrolling(false);
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
	const visibleCount = calcVisibleCount(rows - 2, 3);

	const statusProps = {
		skillCount: skillList.length,
		messageCount: messages.length,
		statusMessage: statusMessage,
	};

	return React.createElement(
		Box,
		{ flexDirection: "column", width: "100%", height: rows },
		showBanner
			? React.createElement(Banner, { onDismiss: () => setShowBanner(false) })
			: React.createElement(ConversationPanel, {
					messages: messages,
					streamingContent: streamingContent,
					streamingIndex: streamingIndex,
					visibleCount: visibleCount,
					scrollOffset: scrollOffset,
					assistantName: config?.tui?.name || "Assistant",
					isScrolling: isScrolling,
					onScroll: (offset, scrolling) => {
						setScrollOffset(offset);
						setIsScrolling(scrolling);
					},
				}),
		!showBanner && React.createElement(StatusBar, statusProps),
		!showBanner &&
			React.createElement(InputPanel, {
				inputText: inputText,
			}),
		!showBanner && React.createElement(Text, { key: "exit-newline" }, EXIT_MESSAGE),
	);
}
