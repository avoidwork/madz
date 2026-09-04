import React, { useState, useCallback, forwardRef, useImperativeHandle } from "react";
import { Box } from "ink";
import { StatusBar } from "./statusBar.js";
import { InputPanel } from "./inputPanel.js";

/**
 * InputArea — owns all input and status state.
 * Renders StatusBar and InputPanel.
 * Reads messageCount from a ref exposed by ConversationArea.
 * @type {React.ForwardRefRenderFunction}
 */
const InputArea = forwardRef(function InputArea(
	{ onSubmit, onFocus, onBlur, focus, skillCount, messageCountRef, showBanner, showOnboarding },
	ref,
) {
	const [inputText, setInputText] = useState("");
	const [historyIndex, setHistoryIndex] = useState(-1);
	const [chatHistory, setChatHistory] = useState([]);
	const [statusMessage, setStatusMessage] = useState("Ready");
	const [contextSize, setContextSize] = useState(0);
	const [isCompacting, setIsCompacting] = useState(false);

	/**
	 * Handle input-side submit: trim, track in chatHistory, clear input, call onSubmit.
	 */
	const handleSubmit = useCallback(
		(text) => {
			const trimmed = text.trim();
			if (!trimmed) return;

			// Track user input in chat history (non-empty lines only)
			setChatHistory((prev) => {
				const filtered = prev.filter((line) => line.trim());
				return [...filtered, trimmed];
			});
			setHistoryIndex(-1);
			setInputText("");

			// Forward to App's onSubmit (which routes to ConversationArea)
			onSubmit(trimmed);
		},
		[onSubmit],
	);

	// Expose imperative methods to App
	useImperativeHandle(ref, () => ({
		navigateHistory: (direction) => {
			if (direction === "up") {
				if (chatHistory.length === 0) return;
				const newIndex =
					historyIndex === -1 ? chatHistory.length - 1 : Math.max(0, historyIndex - 1);
				setHistoryIndex(newIndex);
				setInputText(chatHistory[newIndex]);
			} else if (direction === "down") {
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
		},
		clearInput: () => setInputText(""),
		getInputText: () => inputText,
		clearHistory: () => {
			setChatHistory([]);
			setHistoryIndex(-1);
		},
		addToHistory: (text) => {
			if (!text?.trim()) return;
			setChatHistory((prev) => {
				const filtered = prev.filter((l) => l.trim());
				return [...filtered, text.trim()];
			});
			setHistoryIndex(-1);
		},
		setStatusMessage,
		setContextSize,
		setIsCompacting,
	}));

	const messageCount = messageCountRef?.current || 0;

	// Don't render during banner mode
	if (showBanner && !showOnboarding) return null;

	return React.createElement(
		React.Fragment,
		null,
		// StatusBar only in normal mode (not during onboarding)
		!showBanner && !showOnboarding
			? React.createElement(StatusBar, {
					statusMessage,
					skillCount,
					messageCount,
					contextSize,
					isCompacting,
				})
			: null,
		// InputPanel in normal mode and during onboarding
		React.createElement(
			Box,
			{
				key: "input-wrapper",
				flexDirection: "row",
				paddingX: 1,
				paddingY: 0,
			},
			React.createElement(InputPanel, {
				key: focus ? "input-focused" : "input-unfocused",
				value: inputText,
				onChange: setInputText,
				onSubmit: handleSubmit,
				onFocus,
				onBlur,
				focus,
			}),
		),
	);
});

export default InputArea;
