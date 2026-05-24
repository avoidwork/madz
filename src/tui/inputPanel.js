import React, { useState } from "react";
import { Box, Text } from "ink";
import { useInput } from "ink";

/**
 * Input panel with text entry and Enter-to-send.
 * Props: onSubmit - callback when Enter is pressed
 */
export function InputPanel({ onSubmit = () => {} }) {
	const [inputText, setInputText] = useState("");

	useInput((input) => {
		if (input === "\r" || input === "enter") {
			// Enter-to-send
			if (inputText.trim()) {
				onSubmit(inputText.trim());
				setInputText("");
			}
		} else if (input === "backspace" && inputText.length > 0) {
			setInputText((prev) => prev.slice(0, -1));
		} else {
			// Append character
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
