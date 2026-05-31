import React from "react";
import { Box, Text } from "ink";
import { ScrollView } from "ink-scroll-view";
import { MessageBlock } from "./messageBlock.jsx";

/**
 * Scrollable conversation panel that renders a list of message blocks.
 * @param {Object} props
 * @param {MessageBlock[]} props.messages - List of message blocks to render
 * @param {React.Ref} props.scrollRef - Ref to the ScrollView instance
 * @param {boolean} props.atBottom - Whether the user is at the bottom of the view
 * @param {boolean} props.shouldAutoScroll - Whether to auto-scroll to bottom
 * @returns {React$Element}
 */
export function ConversationPanel({ messages, scrollRef, atBottom, shouldAutoScroll }) {
	React.useEffect(() => {
		if (shouldAutoScroll && atBottom && scrollRef.current) {
			scrollRef.current.scrollToBottom();
		}
	}, [messages.length, atBottom, shouldAutoScroll]);

	return (
		<Box flexDirection="column" flexGrow={1} overflow="hidden">
			<ScrollView ref={scrollRef}>
				{messages.map((msg) => (
					<MessageBlock key={msg.id} message={msg} />
				))}
				<StreamingIndicator scrollRef={scrollRef} />
			</ScrollView>
		</Box>
	);
}

/**
 * Streaming indicator: shows a blinking cursor in the scroll view.
 * Only renders when there are pending streaming blocks.
 * @param {Object} props
 * @param {React.Ref} props.scrollRef
 * @returns {React$Element}
 */
function StreamingIndicator() {
	const [visible, setVisible] = React.useState(true);

	React.useEffect(() => {
		const interval = setInterval(() => setVisible((v) => !v), 500);
		return () => clearInterval(interval);
	}, []);

	return visible ? (
		<Box>
			<Text color="cyan" bold>
				{"\u2588"}
			</Text>
		</Box>
	) : null;
}
