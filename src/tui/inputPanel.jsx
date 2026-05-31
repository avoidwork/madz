import React from "react";
import { Box, Text } from "ink";
import { useInput } from "ink";

/**
 * Input panel for user text entry and command execution.
 * Supports `/` commands, message history, and Tab focus toggle.
 * @param {Object} props
 * @param {string} props.input - Current input buffer
 * @param {boolean} props.hasFocus - Whether this panel has focus
 * @param {React.Dispatch<React.SetStateAction<string>>} props.setInput - Setter for input buffer
 * @param {(text: string) => void} props.onSubmit - Called when Enter is pressed
 * @param {() => void} props.onToggleFocus - Called when Tab is pressed
 * @param {string} props.promptChar - Prompt character
 * @param {string[]} props.messageHistory - Deduplicated history of recent user messages (from session state)
 * @returns {React$Element}
 */
export function InputPanel({
	input,
	hasFocus,
	setInput,
	onSubmit,
	onToggleFocus,
	promptChar,
	messageHistory,
}) {
	const [blink, setBlink] = React.useState(true);
	const [histIdx, setHistIdx] = React.useState(-1);

	// Blinking cursor
	React.useEffect(() => {
		const interval = setInterval(() => setBlink((v) => !v), 500);
		return () => clearInterval(interval);
	}, []);

	// Capture input
	useInput((typed, key) => {
		if (key.tab) {
			onToggleFocus();
			return true;
		}

		if (typed === "/") {
			return;
		}

		if (key.return) {
			const trimmed = input.trim();
			if (trimmed === "") return;

			if (trimmed.startsWith("/")) {
				handleCommand(trimmed, onSubmit);
				setInput("");
				setHistIdx(-1);
				return;
			}

			onSubmit(trimmed);
			setInput("");
			setHistIdx(-1);
			return;
		}

		// Arrow history navigation
		if (key.upArrow) {
			if (messageHistory.length > 0) {
				const nextIdx = histIdx === -1 ? messageHistory.length - 1 : Math.max(0, histIdx - 1);
				setHistIdx(nextIdx);
				setInput(messageHistory[nextIdx] || "");
			}
			return true; // consume key
		}
		if (key.downArrow) {
			if (histIdx > 0) {
				const nextIdx = histIdx - 1;
				setHistIdx(nextIdx);
				setInput(messageHistory[nextIdx] || "");
			} else {
				setHistIdx(-1);
				setInput("");
			}
			return true; // consume key
		}

		// Escape to cancel input
		if (key.escape) {
			setInput("");
			setHistIdx(-1);
			return true;
		}

		// Regular character
		if (!key.ctrl && !key.alt && !key.meta && typed.length === 1) {
			setInput((prev) => prev + typed);
			setHistIdx(-1);
		}
		return true;
	});

	const displayText = input || "";
	const hasPrefix = displayText.startsWith("/");

	return (
		<Box flexDirection="row" alignItems="center">
			<Text color={hasFocus ? "green" : "gray"} dimColor={!hasFocus}>
				{promptChar}
			</Text>
			<Box flexGrow={1}>
				<Text color={hasPrefix ? "green" : "white"}>{displayText}</Text>
				{blink && <Text bold>{hasFocus ? " " : "["}</Text>}
			</Box>
			{hasFocus && (
				<Text color="green" dimColor>
					"|"
				</Text>
			)}
		</Box>
	);
}

/**
 * Handle slash-commands typed by the user.
 * @param {string} command - The command string (e.g., "/help")
 * @param {(text: string) => void} onSubmit - Callback to add the command output to conversation
 */
function handleCommand(command, onSubmit) {
	const parts = command.slice(1).trim().split(/\s+/);
	const cmd = parts[0]?.toLowerCase();

	const commands = {
		help: "",
		clear: "CONVERSATION_CLEAR",
		skill: (name) => (name ? `CONSOLE_SKILL_${name}` : "/skill <name> - Invoke a discovered skill"),
		exit: "CONSOLE_EXIT",
	};

	const handler = commands[cmd];
	if (handler !== undefined) {
		const result = typeof handler === "function" ? handler(parts[1]) : handler;
		onSubmit?.(result);
	} else {
		onSubmit?.(`Unknown command: /${cmd}. Type /help for available commands.`);
	}
}
