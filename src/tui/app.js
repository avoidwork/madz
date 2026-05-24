import React, { useState } from "react";
import { Box } from "ink";
import { useInput } from "ink";
import { CommandParser } from "./commandParser.js";
import { ConversationPanel } from "./conversationPanel.js";
import { StatusBar } from "./statusBar.js";
import { formatMessage } from "./messages.js";

const parser = new CommandParser();

/**
 * Main App component (Ink). Renders an IRC-style layout:
 * full-height conversation REPL at top, input bar at bottom.
 */
export default function App({ config, registry, sessionState, dispatchProvider }) {
	const [messages, setMessages] = useState([]);
	const [inputText, setInputText] = useState("");
	const [statusMessage, setStatusMessage] = useState("Ready");
	const [chatHistory, setChatHistory] = useState([]);
	const [historyIndex, setHistoryIndex] = useState(-1);
	const [scrollOffset] = useState(0);

	const skillList = registry ? registry.list() : [];

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

		addMessage({ role: "user", content: trimmed });

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
				_setConfigValue: config && typeof config.setValue === "function" ? config.setValue : null,
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
		} catch (err) {
			setStatusMessage("Error: " + err.message);
		}
	};

	// Handle normal chat message dispatch
	const handleChat = async (text) => {
		setStatusMessage("Sending...");
		try {
			const response = await dispatchProvider(
				text,
				sessionState ? sessionState.getProvider() : null,
			);
			const responseContent = response.content || response;
			addMessage({ role: "assistant", content: responseContent });
			if (sessionState) {
				sessionState.addExchange({ role: "assistant", content: responseContent });
			}
			setStatusMessage("Received response");
		} catch (err) {
			setStatusMessage("Error: " + err.message);
			addMessage({ role: "system", content: "Error: " + err.message });
		}
	};

	const handleQuit = () => {
		process.exit(0);
	};

	const addMessage = (msg) => {
		const formatted = formatMessage(msg);
		setMessages((prev) => [...prev, { ...msg, formatted: formatted }]);
	};

	// Keyboard input handler - handles input typing and chat history navigation
	useInput((input, key) => {
		if (key.escape) {
			handleQuit();
		} else if (key.up && chatHistory.length > 0) {
			const newIndex = historyIndex === -1 ? chatHistory.length - 1 : Math.max(0, historyIndex - 1);
			setHistoryIndex(newIndex);
			setInputText(chatHistory[newIndex]);
		} else if (key.down) {
			if (historyIndex === -1) return;
			const nextIndex = historyIndex + 1;
			if (nextIndex >= chatHistory.length) {
				setHistoryIndex(-1);
				setInputText("");
			} else {
				setHistoryIndex(nextIndex);
				setInputText(chatHistory[nextIndex]);
			}
		} else if (key.enter && !key.shift) {
			setInputText("");
			handleSubmit(input);
		} else if (input && input !== "\r") {
			setInputText((prev) => prev + input);
		}
	});

	const visibleCount = Math.max(messages.length, 20);

	return React.createElement(
		Box,
		{ flexDirection: "column", width: "100%", height: "100%" },
		React.createElement(
			Box,
			{ flexDirection: "column", flex: 1, marginTop: 1, paddingX: 1 },
			React.createElement(ConversationPanel, {
				messages: messages,
				visibleCount: visibleCount,
				scrollOffset: scrollOffset,
			}),
		),
		React.createElement(StatusBar, {
			inputText: inputText,
			skillCount: skillList.length,
			messageCount: messages.length,
			statusMessage: statusMessage,
		}),
	);
}
