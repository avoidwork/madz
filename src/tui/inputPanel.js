import React, { useState } from "react";
import { Box, Text } from "ink";
import { useInput } from "ink";

/**
 * Input panel with IRC-style prompt, Enter-to-send, and history navigation.
 * Renders a prompt prefix ("> " for normal input, ": " for commands).
 * Props:
 *   onSubmit - callback when Enter is pressed with trimmed text
 *   chatHistory - array of submitted messages for up/down history navigation
 */
export function InputPanel({ onSubmit = () => {}, chatHistory = [] }) {
	const [inputText, setInputText] = useState("");
	const [historyIndex, setHistoryIndex] = useState(-1);

	useInput((input, key) => {
		if (key.up && chatHistory.length > 0) {
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
			if (inputText.trim()) {
				onSubmit(inputText.trim());
				setInputText("");
				setHistoryIndex(-1);
			}
		} else if (key.backspace && inputText.length > 0) {
			setInputText((prev) => prev.slice(0, -1));
		} else if (input && input !== "\r") {
			setInputText((prev) => prev + input);
		}
	});

	const isCommand = inputText.startsWith(":");
	const color = isCommand ? "magenta" : "green";
	const prompt = isCommand ? ":" : ">";

	return (
		<Box flexDirection="row">
			<Text color={color}>{prompt} </Text>
			<Text>{inputText}</Text>
			<Text dim> </Text>
		</Box>
	);
}
