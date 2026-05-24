import React, { useState, useRef } from "react";
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
	const scrollRef = useRef(null);

	const skillList = registry ? registry.list() : [];

	// Process command or dispatch as normal chat
	const handleSubmit = async (text) => {
		if (!text) return;

		// Track user input in chat history (non-empty lines only)
		setChatHistory((prev) => {
			const filtered = prev.filter((line) => line.trim());
			return [...filtered, text];
		});
		setHistoryIndex(-1);

		const trimmed = text.trim();
		addMessage({ role: "user", content: trimmed });

		if (parser.isCommand(trimmed)) {
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
				setStatusMessage(result.message || `${result.action} executed`);
				if (result.message && result.action !== "provider" && result.action !== "schedule") {
					addMessage({ role: "system", content: result.message });
				}
			} catch (err) {
				setStatusMessage(`Error: ${err.message}`);
			}
		} else {
			setStatusMessage("Sending...");
			try {
				const response = await dispatchProvider(text, sessionState?.getProvider());
				const responseContent = response.content || response;
				addMessage({ role: "assistant", content: responseContent });
				sessionState?.addExchange({ role: "assistant", content: responseContent });
				setStatusMessage("Received response");
			} catch (err) {
				setStatusMessage(`Error: ${err.message}`);
				addMessage({ role: "system", content: `Error: ${err.message}` });
			}
		}
	};

	const handleQuit = () => {
		process.exit(0);
	};

	const addMessage = (msg) => {
		const formatted = formatMessage(msg);
		setMessages((prev) => [...prev, { ...msg, formatted }]);
	};

	// Keyboard input handler
	useInput(
		(input, key) => {
			if (key.escape) {
				handleQuit();
			} else if (key.up && chatHistory.length > 0) {
				const newIndex =
					historyIndex === -1 ? chatHistory.length - 1 : Math.max(0, historyIndex - 1);
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
		},
		{ isActive: true },
	);

	const visibleCount = Math.max(messages.length, 20);

	return (
		<Box flexDirection="column" width="100%" height="100%">
			<Box flexDirection="column" flex={1} marginTop={1} paddingX={1}>
				<ConversationPanel
					messages={messages}
					visibleCount={visibleCount}
					onScrollRef={scrollRef}
				/>
			</Box>
			<StatusBar
				inputText={inputText}
				skillCount={skillList.length}
				messageCount={messages.length}
				statusMessage={statusMessage}
			/>
		</Box>
	);
}
