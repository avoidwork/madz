import React, { useState } from "react";
import { Box, Text } from "ink";
import { getRoleLabel, getVisibleMessages } from "./messages.js";
import { useInput } from "ink";

export function ConversationPanel({ messages = [], visibleCount = 20 }) {
	const [scrollOffset, setScrollOffset] = useState(0);

	const { messages: visibleMessages, bottomReached } = getVisibleMessages(
		messages,
		scrollOffset,
		visibleCount,
	);

	useInput((_, key) => {
		if (key.up && scrollOffset > 0) {
			setScrollOffset((prev) => Math.max(0, prev - 1));
		}
		if (key.down && !bottomReached) {
			setScrollOffset((prev) => Math.min(messages.length - visibleCount, prev + 1));
		}
	});

	return (
		<Box flexDirection="column">
			<Text bold color="cyan">
				{" "}
				Conversation{" "}
			</Text>
			{visibleMessages.map((msg, i) => (
				<Box key={i}>
					<Text color="gray">[{getRoleLabel(msg.role)}] </Text>
					<Text wrap="wrap">{msg.content}</Text>
				</Box>
			))}
			{messages.length === 0 && <Text gray> No messages yet. Start chatting!</Text>}
		</Box>
	);
}
