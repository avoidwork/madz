import React from "react";
import { Box, Text } from "ink";
import { marked } from "marked";
import { markTokensToTerminal } from "marked-terminal";

marked.use(markTokensToTerminal);

/**
 * Individual message block rendered in the conversation.
 * Human messages render right-aligned, AI/system render left-aligned.
 * AI/system content is rendered via `marked` with a try/catch fallback.
 * @param {Object} props
 * @param {MessageBlock} props.message - The message to render
 * @returns {React$Element}
 */
export function MessageBlock({ message }) {
	const { role, content, toolCalls, streaming } = message;
	const isHuman = role === "human";
	const isSystem = role === "system";
	const align = isHuman ? "flex-end" : "flex-start";
	const color = isHuman ? "white" : isSystem ? "yellow" : "cyan";

	return (
		<Box flexDirection="column" marginBottom={1}>
			<Box justifyContent={align} width={100}>
				<Box flexDirection="column">
					{role !== "human" && (
						<Box>
							<Text color={color} bold>
								{role.toUpperCase()}
							</Text>
						</Box>
					)}
					<Box>
						{renderContent(content)}
						{streaming && (
							<Text bold dimColor>
								{"\u2588"}
							</Text>
						)}
					</Box>
				</Box>
			</Box>
			{toolCalls && toolCalls.length > 0 && (
				<Box flexDirection="column" marginLeft={2}>
					{toolCalls.map((tc) => (
						<ToolCallBlock key={tc.id} toolCall={tc} />
					))}
				</Box>
			)}
		</Box>
	);
}

/**
 * Render content: try `marked` for markdown, fall back to raw text.
 * @param {string} content
 * @returns {React$Element}
 */
function renderContent(content) {
	try {
		const termText = marked.parse(String(content), { terminal: true });
		return <Text>{termText}</Text>;
	} catch {
		return (
			<>
				{String(content)
					.split("\n")
					.map((line, i) => (
						<Text key={i}>{line}</Text>
					))}
			</>
		);
	}
}

/**
 * Renders a tool call sub-block under an AI message.
 * @param {Object} props
 * @param {ToolCall} props.toolCall
 * @returns {React$Element}
 */
function ToolCallBlock({ toolCall }) {
	const parts = [`[${toolCall.name}]`];
	if (toolCall.duration !== undefined) {
		parts.push(" " + toolCall.duration + "ms");
	}
	return (
		<Text color="yellow" dimColor>
			{parts.join("")}
		</Text>
	);
}
